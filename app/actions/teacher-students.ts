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

/** هل هذا الطالب يتابع المعلّم فعلاً؟ لا نراسل أو نمنح غير المتابعين. */
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
 * target: "all" = كل محتوى المعلّم الخاص، أو "lesson:<id>" / "session:<id>".
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

  let lessonId: string | null = null;
  let sessionId: string | null = null;
  if (target.startsWith("lesson:")) lessonId = target.slice(7) || null;
  else if (target.startsWith("session:")) sessionId = target.slice(8) || null;

  // العنصر المستهدف يجب أن يكون ملك هذا المعلّم
  if (lessonId) {
    const { data } = await supabase
      .from("lessons")
      .select("id")
      .eq("id", lessonId)
      .eq("teacher_id", teacher.id)
      .maybeSingle();
    if (!data) return { ok: false, message: "الدرس المختار غير صالح." };
  }
  if (sessionId) {
    const { data } = await supabase
      .from("live_sessions")
      .select("id")
      .eq("id", sessionId)
      .eq("teacher_id", teacher.id)
      .maybeSingle();
    if (!data) return { ok: false, message: "الحصة المختارة غير صالحة." };
  }

  const { error } = await supabase.from("student_grants").insert({
    teacher_id: teacher.id,
    student_id: studentId,
    lesson_id: lessonId,
    session_id: sessionId,
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
