"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { stripTags } from "@/lib/sanitize";

export interface StudentsActionState {
  ok: boolean;
  message?: string;
}

/** صف المعلّم المملوك للمستخدم الحالي */
async function requireMyTeacher() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, teacher: null };
  const { data } = await supabase
    .from("teachers")
    .select("id, slug")
    .eq("owner_id", user.id)
    .maybeSingle();
  return { supabase, teacher: data as { id: string; slug: string } | null };
}

/**
 * هل هذا الطالب منضمّ فعلاً (مقبولاً)؟ لا نراسل ولا نمنح ولا نقيّم من
 * لم يُقبل بعد — الطلب المعلّق ليس انضماماً.
 */
async function followsMe(
  supabase: Awaited<ReturnType<typeof createClient>>,
  teacherId: string,
  studentId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("follows")
    .select("teacher_id")
    .eq("teacher_id", teacherId)
    .eq("student_id", studentId)
    .eq("status", "approved")
    .maybeSingle();
  return Boolean(data);
}

/**
 * إرسال رسالة. لها ثلاث وجهات، والفارق بينها حقلان لا جدولان:
 *
 * | الحقول | الوجهة |
 * |---|---|
 * | `studentId` | خاصّة بطالب واحد |
 * | `groupId` | تعميم لأعضاء مجموعة بعينها |
 * | لا هذا ولا ذاك | تعميم لكل المتابعين |
 *
 * الرسالة نص صِرف — تُعرض على لوحة الطالب، فنزيل أي وسوم HTML.
 */
export async function sendMessage(
  _prev: StudentsActionState,
  formData: FormData
): Promise<StudentsActionState> {
  const { supabase, teacher } = await requireMyTeacher();
  if (!teacher) return { ok: false, message: "سجّل الدخول كمعلّم أولاً." };

  const body = stripTags(String(formData.get("body") ?? "")).slice(0, 1000);
  const studentId = String(formData.get("studentId") ?? "").trim() || null;
  const groupId = String(formData.get("groupId") ?? "").trim() || null;
  if (!body) return { ok: false, message: "اكتب نص الرسالة." };

  if (studentId && !(await followsMe(supabase, teacher.id, studentId))) {
    return { ok: false, message: "هذا الطالب لا يتابعك." };
  }

  // المجموعة يجب أن تكون من مجموعات هذا المعلّم — السياسة تفرضها أيضاً
  let groupName = "";
  if (groupId) {
    const { data: group } = await supabase
      .from("student_groups")
      .select("name")
      .eq("id", groupId)
      .eq("teacher_id", teacher.id)
      .maybeSingle();
    if (!group) return { ok: false, message: "هذه المجموعة ليست لك." };
    groupName = (group as { name: string }).name;
  }

  const { error } = await supabase.from("teacher_messages").insert({
    teacher_id: teacher.id,
    // رسالة المجموعة تعميم، فلا تحمل طالباً بعينه
    student_id: groupId ? null : studentId,
    group_id: groupId,
    body,
  });
  if (error) return { ok: false, message: "تعذّر إرسال الرسالة — حاول مجدداً." };

  revalidatePath("/teacher/me/students");
  revalidatePath("/dashboard");
  if (groupId) revalidatePath(`/teacher/me/groups/${groupId}`);
  return {
    ok: true,
    message: groupId
      ? `أُرسلت إلى أعضاء «${groupName}».`
      : studentId
        ? "أُرسلت الرسالة."
        : "أُرسلت الرسالة لكل متابعيك.",
  };
}

/** حذف رسالة أرسلها المعلّم */
export async function deleteMessage(formData: FormData): Promise<void> {
  const { supabase, teacher } = await requireMyTeacher();
  if (!teacher) return;
  const id = String(formData.get("messageId") ?? "");
  if (!id) return;
  await supabase
    .from("teacher_messages")
    .delete()
    .eq("id", id)
    .eq("teacher_id", teacher.id);
  revalidatePath("/teacher/me/students");
}

/**
 * منح طالب وصولاً إلى محتوى خاص.
 * target: "all" = كل دروس المعلّم الخاصة، أو "lesson:<id>" لدرس بعينه.
 */
export async function grantAccess(
  _prev: StudentsActionState,
  formData: FormData
): Promise<StudentsActionState> {
  const { supabase, teacher } = await requireMyTeacher();
  if (!teacher) return { ok: false, message: "سجّل الدخول كمعلّم أولاً." };

  const studentId = String(formData.get("studentId") ?? "").trim();
  const target = String(formData.get("target") ?? "all").trim();
  if (!studentId) return { ok: false, message: "اختر الطالب." };

  if (!(await followsMe(supabase, teacher.id, studentId))) {
    return { ok: false, message: "هذا الطالب لا يتابعك." };
  }

  const lessonId = target.startsWith("lesson:") ? target.slice(7) || null : null;

  // الدرس المستهدف يجب أن يكون ملك هذا المعلّم
  if (lessonId) {
    const { data } = await supabase
      .from("lessons")
      .select("id")
      .eq("id", lessonId)
      .eq("teacher_id", teacher.id)
      .maybeSingle();
    if (!data) return { ok: false, message: "الدرس المختار غير صالح." };
  }

  const { error } = await supabase.from("student_grants").insert({
    teacher_id: teacher.id,
    student_id: studentId,
    lesson_id: lessonId,
  });
  // 23505 = المنحة موجودة أصلاً، وهذا ليس خطأ يهمّ المعلّم
  if (error && error.code !== "23505") {
    return { ok: false, message: "تعذّر منح الوصول — حاول مجدداً." };
  }

  revalidatePath("/teacher/me/students");
  return { ok: true, message: "مُنح الطالب الوصول." };
}

/**
 * منح كل أعضاء مجموعة وصولاً إلى درس خاص (أو سحبه عنهم).
 *
 * «درس خاص للمجموعة» ليس نوعاً جديداً من الدروس: هو درس `is_restricted`
 * تُمنَح المجموعةُ كلُّها وصولاً إليه دفعةً واحدة، فيعمل بنفس ما تفرضه
 * سياسة `lessons` أصلاً — لا مسار صلاحيات ثانياً يُخطئ أحدهما الآخر.
 */
export async function setGroupLessonAccess(
  groupId: string,
  lessonId: string,
  grant: boolean
): Promise<StudentsActionState> {
  const { supabase, teacher } = await requireMyTeacher();
  if (!teacher) return { ok: false, message: "سجّل الدخول كمعلّم أولاً." };

  const [{ data: group }, { data: lesson }] = await Promise.all([
    supabase
      .from("student_groups")
      .select("id")
      .eq("id", groupId)
      .eq("teacher_id", teacher.id)
      .maybeSingle(),
    supabase
      .from("lessons")
      .select("id")
      .eq("id", lessonId)
      .eq("teacher_id", teacher.id)
      .maybeSingle(),
  ]);
  if (!group) return { ok: false, message: "هذه المجموعة ليست لك." };
  if (!lesson) return { ok: false, message: "هذا الدرس ليس لك." };

  const { data: members } = await supabase
    .from("student_group_members")
    .select("student_id")
    .eq("group_id", groupId);
  const ids = ((members ?? []) as { student_id: string }[]).map((m) => m.student_id);
  if (ids.length === 0) return { ok: false, message: "لا أعضاء في هذه المجموعة." };

  if (grant) {
    /**
     * الفهرس الفريد على `student_grants` مبنيّ على تعبير `coalesce`، فلا
     * يقبل `onConflict` بأسماء أعمدة. نقرأ الموجود ونُدرج الناقص فقط.
     */
    const { data: existing } = await supabase
      .from("student_grants")
      .select("student_id")
      .eq("teacher_id", teacher.id)
      .eq("lesson_id", lessonId)
      .in("student_id", ids);
    const have = new Set(
      ((existing ?? []) as { student_id: string }[]).map((g) => g.student_id)
    );
    const missing = ids.filter((id) => !have.has(id));

    if (missing.length > 0) {
      const { error } = await supabase.from("student_grants").insert(
        missing.map((student_id) => ({
          teacher_id: teacher.id,
          student_id,
          lesson_id: lessonId,
        }))
      );
      if (error) return { ok: false, message: "تعذّر منح المجموعة الوصول." };
    }
  } else {
    const { error } = await supabase
      .from("student_grants")
      .delete()
      .eq("teacher_id", teacher.id)
      .eq("lesson_id", lessonId)
      .in("student_id", ids);
    if (error) return { ok: false, message: "تعذّر سحب الوصول." };
  }

  revalidatePath(`/teacher/me/groups/${groupId}`);
  revalidatePath("/teacher/me/students");
  return {
    ok: true,
    message: grant
      ? `مُنح ${ids.length} طالباً الوصول إلى الدرس.`
      : "سُحب وصول المجموعة إلى الدرس.",
  };
}

/** سحب منحة وصول */
export async function revokeAccess(formData: FormData): Promise<void> {
  const { supabase, teacher } = await requireMyTeacher();
  if (!teacher) return;
  const grantId = String(formData.get("grantId") ?? "");
  if (!grantId) return;
  await supabase
    .from("student_grants")
    .delete()
    .eq("id", grantId)
    .eq("teacher_id", teacher.id);
  revalidatePath("/teacher/me/students");
}

/* ------------------------- تقرير وليّ الأمر ------------------------- */

const PERFORMANCE = ["ممتاز", "جيد جداً", "جيد", "يحتاج متابعة"] as const;

/**
 * تقرير دوري عن الطالب موجَّه لوليّ أمره.
 * وليّ الأمر لا يملك حساباً على المنصة، فالتقرير يُحفظ هنا (يراه الطالب
 * أيضاً على لوحته) وتُبنى منه رسالة واتساب يرسلها المعلّم بضغطة.
 */
export async function saveParentReport(
  _prev: StudentsActionState,
  formData: FormData
): Promise<StudentsActionState> {
  const { supabase, teacher } = await requireMyTeacher();
  if (!teacher) return { ok: false, message: "سجّل الدخول كمعلّم أولاً." };

  const studentId = String(formData.get("studentId") ?? "").trim();
  if (!studentId) return { ok: false, message: "اختر الطالب." };
  if (!(await followsMe(supabase, teacher.id, studentId))) {
    return { ok: false, message: "هذا الطالب لا يتابعك." };
  }

  const perfRaw = String(formData.get("performance") ?? "جيد");
  const performance = (PERFORMANCE as readonly string[]).includes(perfRaw)
    ? perfRaw
    : "جيد";

  const { error } = await supabase.from("parent_reports").insert({
    teacher_id: teacher.id,
    student_id: studentId,
    period: stripTags(String(formData.get("period") ?? "")).slice(0, 60),
    performance,
    strengths: stripTags(String(formData.get("strengths") ?? "")).slice(0, 500),
    improvements: stripTags(String(formData.get("improvements") ?? "")).slice(0, 500),
    note: stripTags(String(formData.get("note") ?? "")).slice(0, 500),
  });
  if (error) return { ok: false, message: "تعذّر حفظ التقرير — حاول مجدداً." };

  revalidatePath("/teacher/me/students");
  return { ok: true, message: "حُفظ التقرير — أرسله لوليّ الأمر بالزر أدناه." };
}

/** حذف تقرير كتبه المعلّم */
export async function deleteParentReport(formData: FormData): Promise<void> {
  const { supabase, teacher } = await requireMyTeacher();
  if (!teacher) return;
  const id = String(formData.get("reportId") ?? "");
  if (!id) return;
  await supabase
    .from("parent_reports")
    .delete()
    .eq("id", id)
    .eq("teacher_id", teacher.id);
  revalidatePath("/teacher/me/students");
}
