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
 * إرسال رسالة إلى طالب بعينه أو إلى كل المتابعين (studentId فارغ).
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
  if (!body) return { ok: false, message: "اكتب نص الرسالة." };

  if (studentId && !(await followsMe(supabase, teacher.id, studentId))) {
    return { ok: false, message: "هذا الطالب لا يتابعك." };
  }

  const { error } = await supabase.from("teacher_messages").insert({
    teacher_id: teacher.id,
    student_id: studentId,
    body,
  });
  if (error) return { ok: false, message: "تعذّر إرسال الرسالة — حاول مجدداً." };

  revalidatePath("/teacher/me/students");
  return {
    ok: true,
    message: studentId ? "أُرسلت الرسالة." : "أُرسلت الرسالة لكل متابعيك.",
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
