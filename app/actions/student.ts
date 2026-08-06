"use server";

import { revalidatePath } from "next/cache";
import { scheduleReview, unscheduleReview } from "@/app/actions/reviews";
import { createClient } from "@/lib/supabase/server";
import { stripTags } from "@/lib/sanitize";

export interface ActionResult {
  ok: boolean;
  message?: string;
}

const NEED_LOGIN: ActionResult = {
  ok: false,
  message: "سجّل الدخول أولاً للمتابعة.",
};

const TEACHER_ACCOUNT: ActionResult = {
  ok: false,
  message: "هذا الحساب حساب معلّم. لمتابعة المعلّمين كطالب استخدم بريداً آخر.",
};

/**
 * الحساب الواحد إمّا معلّم وإمّا طالب — لا يجمع الدورين.
 * كل إجراء طالب يتحقّق خادمياً من أن صاحب الجلسة لا يملك بروفايل معلّم،
 * فلا يكفي إخفاء الأزرار في الواجهة.
 */
async function isTeacherAccount(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("teachers")
    .select("id")
    .eq("owner_id", userId)
    .maybeSingle();
  return Boolean(data);
}

/**
 * رسالة القاعدة «معلّم واحد لكل مادة» تأتي من مُشغّل قاعدة البيانات
 * بالصيغة ONE_TEACHER_PER_SUBJECT:<اسم المعلّم الآخر>. نترجمها هنا إلى
 * جملة يفهمها الطالب بدل تسريب نصّ الخطأ الخام.
 */
function subjectClashMessage(raw: string): string | null {
  const m = raw.match(/ONE_TEACHER_PER_SUBJECT:(.*)$/);
  if (!m) return null;
  const other = m[1].trim();
  return `أنت منضمّ بالفعل إلى ${other} في المادة نفسها. المنصة تسمح بالانضمام إلى معلّم واحد لكل مادة، فألغِ انضمامك هناك أولاً إن أردت الانتقال. (المتابعة غير مقيّدة — تابع من شئت.)`;
}

/** يجهّز جلسة طالب صالحة، أو يعيد سبب الرفض */
async function requireStudent() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, deny: NEED_LOGIN };
  if (await isTeacherAccount(supabase, user.id)) {
    return { supabase, user: null, deny: TEACHER_ACCOUNT };
  }
  return { supabase, user, deny: null };
}

/**
 * متابعة معلّم أو إلغاؤها.
 *
 * المتابعة إشارة اهتمام فورية لا تحتاج موافقة ولا تمنح صلاحية: لا رسائل،
 * ولا مجموعات، ولا محتوى خاص. الالتحاق بالصف هو `requestJoin`.
 */
export async function toggleFollow(
  teacherId: string,
  teacherSlug: string,
  following: boolean
): Promise<ActionResult> {
  const { supabase, user, deny } = await requireStudent();
  if (deny || !user) return deny ?? NEED_LOGIN;

  if (following) {
    const { error } = await supabase
      .from("follows")
      .delete()
      .eq("student_id", user.id)
      .eq("teacher_id", teacherId);
    if (error) return { ok: false, message: "تعذّر إلغاء المتابعة." };
  } else {
    const { error } = await supabase
      .from("follows")
      .insert({ student_id: user.id, teacher_id: teacherId, status: "following" });
    if (error) return { ok: false, message: "تعذّر حفظ المتابعة." };
  }

  revalidatePath(`/teacher/${teacherSlug}`);
  revalidatePath("/dashboard");
  return {
    ok: true,
    message: following ? "أُلغيت المتابعة." : "تتابع هذا المعلّم الآن.",
  };
}

/**
 * طلب الانضمام إلى صفّ المعلّم.
 *
 * لا يحمل الطلب رسالة من الطالب: الاتجاه معاكس — المعلّم هو من يكتب
 * شروطه مسبقاً في لوحته، والطالب يقرؤها ثم يوافق عليها بإرسال الطلب.
 */
export async function requestJoin(
  teacherId: string,
  teacherSlug: string
): Promise<ActionResult> {
  const { supabase, user, deny } = await requireStudent();
  if (deny || !user) return deny ?? NEED_LOGIN;

  // متابع أصلاً (أو طلب سابق مرفوض)؟ نرفع حالته بدل إنشاء صف ثانٍ
  const { data: existing } = await supabase
    .from("follows")
    .select("status")
    .eq("student_id", user.id)
    .eq("teacher_id", teacherId)
    .maybeSingle();

  if (existing?.status === "approved") {
    return { ok: false, message: "أنت منضمّ إلى هذا المعلّم بالفعل." };
  }
  if (existing?.status === "pending") {
    return { ok: false, message: "طلبك قيد المراجعة عند المعلّم." };
  }

  const { error } = existing
    ? await supabase
        .from("follows")
        .update({ status: "pending", decision_note: "" })
        .eq("student_id", user.id)
        .eq("teacher_id", teacherId)
    : await supabase
        .from("follows")
        .insert({ student_id: user.id, teacher_id: teacherId, status: "pending" });

  if (error) {
    const clash = subjectClashMessage(error.message ?? "");
    if (clash) return { ok: false, message: clash };
    return { ok: false, message: "تعذّر إرسال طلب الانضمام." };
  }

  revalidatePath(`/teacher/${teacherSlug}`);
  revalidatePath("/dashboard");
  return { ok: true, message: "أُرسل طلبك، وستظهر النتيجة هنا بعد ردّ المعلّم." };
}

/**
 * سحب طلب معلّق أو مغادرة الصف — مع البقاء متابعاً.
 * إلغاء المتابعة نفسه من `toggleFollow`.
 */
export async function cancelJoin(
  teacherId: string,
  teacherSlug: string
): Promise<ActionResult> {
  const { supabase, user, deny } = await requireStudent();
  if (deny || !user) return deny ?? NEED_LOGIN;

  const { error } = await supabase
    .from("follows")
    .update({ status: "following", decision_note: "" })
    .eq("student_id", user.id)
    .eq("teacher_id", teacherId);

  if (error) return { ok: false, message: "تعذّر إلغاء الانضمام." };

  revalidatePath(`/teacher/${teacherSlug}`);
  revalidatePath("/dashboard");
  return { ok: true, message: "أُلغي انضمامك، وما زلت تتابع هذا المعلّم." };
}

/** تعليم درس كمنجز أو التراجع عن ذلك */
export async function toggleLessonComplete(
  lessonId: string,
  teacherSlug: string,
  completed: boolean
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NEED_LOGIN;
  if (await isTeacherAccount(supabase, user.id)) return TEACHER_ACCOUNT;

  const { error } = completed
    ? await supabase
        .from("lesson_progress")
        .delete()
        .eq("student_id", user.id)
        .eq("lesson_id", lessonId)
    : await supabase.from("lesson_progress").upsert(
        { student_id: user.id, lesson_id: lessonId, completed: true },
        { onConflict: "student_id,lesson_id" }
      );

  if (error) return { ok: false, message: "تعذّر حفظ التقدّم." };

  /**
   * الدرس المنجَز يدخل قائمة المراجعة المتباعدة، والملغى يخرج منها.
   *
   * هنا لا في الواجهة: «أنهيت الدرس» و«جدوِله للمراجعة» فعلٌ واحد في ذهن
   * الطالب، وفصلهما يعني زرّاً ثانياً لا يضغطه أحد.
   */
  if (completed) await unscheduleReview(lessonId);
  else await scheduleReview(lessonId);

  revalidatePath(`/teacher/${teacherSlug}`);
  revalidatePath(`/teacher/${teacherSlug}/lesson/${lessonId}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

/**
 * سؤال الطالب لمعلّم يتابعه.
 * الرسالة نص صِرف تُعرض في خيط المحادثة، وسياسة RLS من 0011 تفرض
 * أن يكون المرسِل طالباً متابعاً يكتب باسمه هو.
 */
export async function askTeacher(
  teacherId: string,
  teacherSlug: string,
  body: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NEED_LOGIN;
  if (await isTeacherAccount(supabase, user.id)) return TEACHER_ACCOUNT;

  const text = stripTags(body).slice(0, 1000);
  if (!text) return { ok: false, message: "اكتب سؤالك أولاً." };

  const { error } = await supabase.from("teacher_messages").insert({
    teacher_id: teacherId,
    student_id: user.id,
    sender: "student",
    body: text,
  });
  if (error) {
    return {
      ok: false,
      message:
        error.code === "42501"
          ? "تابع هذا المعلّم أولاً لتتمكّن من مراسلته."
          : "تعذّر إرسال سؤالك — حاول مجدداً.",
    };
  }

  revalidatePath("/dashboard");
  revalidatePath(`/teacher/${teacherSlug}`);
  return { ok: true, message: "أُرسل سؤالك — سيصل معلّمك." };
}

/**
 * طلب الطالب بطاقة تقييم من معلّمه.
 *
 * الطلب مجرّد بلا نصّ: المعلّم هو من يقرّر الوحدة والفصل والتقديرات عند
 * الإصدار، فرسالة من الطالب هنا لا تضيف إلا صندوق وارد ثانياً.
 */
export async function requestReportCard(
  teacherId: string
): Promise<ActionResult> {
  const { supabase, user, deny } = await requireStudent();
  if (deny || !user) return deny ?? NEED_LOGIN;

  const { error } = await supabase.from("report_card_requests").insert({
    teacher_id: teacherId,
    student_id: user.id,
    status: "pending",
  });

  if (error) {
    // فهرس فريد جزئي يمنع أكثر من طلب معلّق لنفس المعلّم
    if (error.code === "23505") {
      return { ok: false, message: "لديك طلب معلّق عند هذا المعلّم بالفعل." };
    }
    if (error.code === "42501") {
      return { ok: false, message: "انضمّ إلى صفّ هذا المعلّم أولاً." };
    }
    return { ok: false, message: "تعذّر إرسال الطلب." };
  }

  revalidatePath("/dashboard");
  return { ok: true, message: "أُرسل طلبك — سيصدر معلّمك البطاقة عند مراجعته." };
}

/** سحب طلب بطاقة معلّق */
export async function cancelReportCardRequest(
  requestId: string
): Promise<ActionResult> {
  const { supabase, user, deny } = await requireStudent();
  if (deny || !user) return deny ?? NEED_LOGIN;

  const { error } = await supabase
    .from("report_card_requests")
    .delete()
    .eq("id", requestId)
    .eq("student_id", user.id);

  if (error) return { ok: false, message: "تعذّر سحب الطلب." };

  revalidatePath("/dashboard");
  return { ok: true, message: "سُحب الطلب." };
}

/**
 * إخفاء رسالة انتهى منها الطالب.
 *
 * رسالته هو تُحذف فعلاً، أمّا رسالة المعلّم — وقد تكون تعميماً يقرؤه
 * عشرون طالباً — فتُسجَّل في `message_dismissals` باسمه وحده. حذفها من
 * الجدول كان يمحوها عن زملائه كلّهم.
 */
export async function dismissMessage(messageId: string): Promise<ActionResult> {
  const { supabase, user, deny } = await requireStudent();
  if (deny || !user) return deny ?? NEED_LOGIN;

  const { data: msg } = await supabase
    .from("teacher_messages")
    .select("id, sender, student_id")
    .eq("id", messageId)
    .maybeSingle();
  if (!msg) return { ok: false, message: "الرسالة غير موجودة." };

  const row = msg as { id: string; sender: string; student_id: string | null };

  if (row.sender === "student" && row.student_id === user.id) {
    const { error } = await supabase
      .from("teacher_messages")
      .delete()
      .eq("id", messageId);
    if (error) return { ok: false, message: "تعذّر حذف الرسالة." };
  } else {
    const { error } = await supabase
      .from("message_dismissals")
      .insert({ message_id: messageId, student_id: user.id });
    // 23505 = مخفيّة أصلاً، وهذا ليس خطأ
    if (error && error.code !== "23505") {
      return { ok: false, message: "تعذّر إخفاء الرسالة." };
    }
  }

  revalidatePath("/dashboard");
  return { ok: true, message: "أُزيلت من قائمتك." };
}
