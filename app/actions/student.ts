"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface ActionResult {
  ok: boolean;
  message?: string;
  /** الحالة الناتجة للتسجيل: enrolled أو pending_payment */
  status?: string;
}

const NEED_LOGIN: ActionResult = {
  ok: false,
  message: "سجّل الدخول أولاً للمتابعة.",
};

/**
 * التسجيل في حصة مباشرة.
 * الحصة المجانية → مسجّل فوراً. المدفوعة → بانتظار تأكيد المعلم للدفع.
 * التسعير بيد المعلم، ولا تمر أي أموال عبر المنصة.
 */
export async function enrollInSession(
  sessionId: string,
  teacherSlug: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NEED_LOGIN;

  const { data: session } = await supabase
    .from("live_sessions")
    .select("id, is_paid")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session) return { ok: false, message: "الحصة غير موجودة." };

  const status = session.is_paid ? "pending_payment" : "enrolled";

  const { error } = await supabase
    .from("enrollments")
    .upsert(
      { student_id: user.id, session_id: sessionId, status },
      { onConflict: "student_id,session_id" }
    );
  if (error) return { ok: false, message: "تعذّر إتمام التسجيل — حاول مرة أخرى." };

  revalidatePath(`/teacher/${teacherSlug}`);
  revalidatePath("/dashboard");

  return {
    ok: true,
    status,
    message: session.is_paid
      ? "سيتواصل معك المعلم عبر واتساب لتأكيد الدفع وفتح الوصول."
      : "تم تسجيلك في الحصة بنجاح.",
  };
}

/** إلغاء التسجيل في حصة */
export async function cancelEnrollment(
  sessionId: string,
  teacherSlug?: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NEED_LOGIN;

  const { error } = await supabase
    .from("enrollments")
    .delete()
    .eq("student_id", user.id)
    .eq("session_id", sessionId);
  if (error) return { ok: false, message: "تعذّر إلغاء التسجيل." };

  if (teacherSlug) revalidatePath(`/teacher/${teacherSlug}`);
  revalidatePath("/dashboard");
  return { ok: true, message: "أُلغي تسجيلك في الحصة." };
}

/** متابعة معلم أو إلغاء متابعته */
export async function toggleFollow(
  teacherId: string,
  teacherSlug: string,
  following: boolean
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NEED_LOGIN;

  const { error } = following
    ? await supabase
        .from("follows")
        .delete()
        .eq("student_id", user.id)
        .eq("teacher_id", teacherId)
    : await supabase
        .from("follows")
        .upsert(
          { student_id: user.id, teacher_id: teacherId },
          { onConflict: "student_id,teacher_id" }
        );

  if (error) return { ok: false, message: "تعذّر تحديث المتابعة." };

  revalidatePath(`/teacher/${teacherSlug}`);
  revalidatePath("/dashboard");
  return { ok: true, message: following ? "أُلغيت المتابعة." : "تتابع هذا المعلم الآن." };
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
