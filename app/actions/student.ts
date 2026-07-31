"use server";

import { revalidatePath } from "next/cache";
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
  return `أنت منضمّ بالفعل إلى ${other} في المادة نفسها. المنصة تسمح بمعلّم واحد لكل مادة، فألغِ انضمامك هناك أولاً إن أردت الانتقال.`;
}

/**
 * إرسال طلب انضمام إلى معلّم.
 * الانضمام لم يعد فورياً: يصل الطلب معلّقاً حتى يبتّه المعلّم.
 */
export async function requestJoin(
  teacherId: string,
  teacherSlug: string,
  note = ""
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NEED_LOGIN;
  if (await isTeacherAccount(supabase, user.id)) return TEACHER_ACCOUNT;

  // طلب سابق مرفوض لا يمنع محاولة جديدة — نزيله ثم نطلب من جديد
  await supabase
    .from("follows")
    .delete()
    .eq("student_id", user.id)
    .eq("teacher_id", teacherId)
    .eq("status", "rejected");

  const { error } = await supabase.from("follows").insert({
    student_id: user.id,
    teacher_id: teacherId,
    status: "pending",
    student_note: stripTags(note).slice(0, 500),
  });

  if (error) {
    const clash = subjectClashMessage(error.message ?? "");
    if (clash) return { ok: false, message: clash };
    if (error.code === "23505") {
      return { ok: false, message: "لديك طلب سابق لهذا المعلّم." };
    }
    return { ok: false, message: "تعذّر إرسال طلب الانضمام." };
  }

  revalidatePath(`/teacher/${teacherSlug}`);
  revalidatePath("/dashboard");
  return { ok: true, message: "أُرسل طلبك، وستظهر النتيجة هنا بعد ردّ المعلّم." };
}

/** سحب طلب معلّق أو إلغاء انضمام قائم */
export async function cancelJoin(
  teacherId: string,
  teacherSlug: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NEED_LOGIN;

  const { error } = await supabase
    .from("follows")
    .delete()
    .eq("student_id", user.id)
    .eq("teacher_id", teacherId);

  if (error) return { ok: false, message: "تعذّر إلغاء الانضمام." };

  revalidatePath(`/teacher/${teacherSlug}`);
  revalidatePath("/dashboard");
  return { ok: true, message: "أُلغي انضمامك لهذا المعلّم." };
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
