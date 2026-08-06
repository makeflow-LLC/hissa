"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { stripTags } from "@/lib/sanitize";

export interface AssignmentState {
  ok: boolean;
  message?: string;
  assignmentId?: string;
}

async function myTeacher() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, teacher: null, user: null };
  const { data } = await supabase
    .from("teachers")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();
  return { supabase, teacher: data as { id: string } | null, user };
}

/**
 * إنشاء واجب أو تعديله.
 *
 * الموعد يصل **لحظةً مطلقة** يحسبها المتصفّح، لا نصّاً بلا منطقة زمنية:
 * `datetime-local` يعطي «2026-08-10T20:00» فيفهمه الخادم بتوقيته هو،
 * فيُخزَّن موعدٌ يخالف ما قصده المعلّم ويُعرض عليه محرَّفاً. نفس درس
 * نافذة الاختبارات.
 */
export async function saveAssignment(
  _prev: AssignmentState,
  formData: FormData
): Promise<AssignmentState> {
  const { supabase, teacher } = await myTeacher();
  if (!teacher) return { ok: false, message: "سجّل الدخول كمعلّم أولاً." };

  const id = String(formData.get("assignmentId") ?? "").trim();
  const title = stripTags(String(formData.get("title") ?? "")).trim().slice(0, 200);
  const body = stripTags(String(formData.get("body") ?? "")).trim().slice(0, 4000);
  if (!title) return { ok: false, message: "عنوان الواجب مطلوب." };

  const groupId = String(formData.get("groupId") ?? "").trim() || null;
  const lessonId = String(formData.get("lessonId") ?? "").trim() || null;
  const dueRaw = String(formData.get("dueAt") ?? "").trim();

  let dueAt: string | null = null;
  if (dueRaw) {
    // نرفض ما لا منطقة زمنية له، فلا يعود الشكل القديم صامتاً
    const d = new Date(dueRaw);
    if (Number.isNaN(d.getTime()) || !/[Zz]|[+-]\d\d:?\d\d$/.test(dueRaw))
      return { ok: false, message: "موعد التسليم غير صالح." };
    dueAt = d.toISOString();
  }

  const base = {
    title,
    body,
    group_id: groupId,
    lesson_id: lessonId,
    due_at: dueAt,
  };

  if (id) {
    const { data, error } = await supabase
      .from("assignments")
      .update(base)
      .eq("id", id)
      .eq("teacher_id", teacher.id)
      .select("id");
    if (error || !data || data.length === 0)
      return { ok: false, message: "تعذّر حفظ الواجب." };
    revalidatePath("/teacher/me/assignments");
    return { ok: true, message: "حُفظ.", assignmentId: id };
  }

  const { data, error } = await supabase
    .from("assignments")
    .insert({ ...base, teacher_id: teacher.id, status: "draft" })
    .select("id")
    .single();
  if (error || !data) return { ok: false, message: "تعذّر إنشاء الواجب." };

  revalidatePath("/teacher/me/assignments");
  return { ok: true, message: "أُنشئ الواجب مسودّةً.", assignmentId: data.id as string };
}

/** النشر يجعله يظهر لطلابه — والمسودّة لا يراها أحد */
export async function setAssignmentStatus(
  id: string,
  status: "draft" | "published"
): Promise<AssignmentState> {
  const { supabase, teacher } = await myTeacher();
  if (!teacher) return { ok: false, message: "سجّل الدخول كمعلّم أولاً." };

  const { data, error } = await supabase
    .from("assignments")
    .update({ status })
    .eq("id", id)
    .eq("teacher_id", teacher.id)
    .select("id");
  if (error || !data || data.length === 0)
    return { ok: false, message: "تعذّر التغيير." };

  revalidatePath("/teacher/me/assignments");
  revalidatePath(`/teacher/me/assignments/${id}`);
  return { ok: true, message: status === "published" ? "نُشر الواجب." : "صار مسودّة." };
}

export async function deleteAssignment(id: string): Promise<{ ok: boolean }> {
  const { supabase, teacher } = await myTeacher();
  if (!teacher) return { ok: false };
  const { data } = await supabase
    .from("assignments")
    .delete()
    .eq("id", id)
    .eq("teacher_id", teacher.id)
    .select("id");
  revalidatePath("/teacher/me/assignments");
  return { ok: Boolean(data && data.length > 0) };
}

/**
 * تصحيح تسليم — عبر `grade_submission` لا بكتابةٍ مباشرة.
 *
 * عمودا `grade` و`feedback` محجوبان عن دور `authenticated` كلّه بمنحة
 * أعمدة (وإلا وضع الطالب علامته بنفسه من REST)، والدالّة `security
 * definer` تتحقّق أن المستدعي صاحب الواجب ثم تكتب.
 */
export async function gradeSubmission(
  _prev: AssignmentState,
  formData: FormData
): Promise<AssignmentState> {
  const supabase = await createClient();
  const id = String(formData.get("submissionId") ?? "").trim();
  const raw = String(formData.get("grade") ?? "").trim();
  const note = stripTags(String(formData.get("feedback") ?? "")).trim().slice(0, 2000);

  let grade: number | null = null;
  if (raw) {
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0 || n > 1000)
      return { ok: false, message: "العلامة رقمٌ بين ٠ و١٠٠٠." };
    grade = n;
  }

  const { data, error } = await supabase.rpc("grade_submission", {
    s_id: id,
    g: grade,
    note,
  });
  if (error || data !== true)
    return { ok: false, message: "تعذّر التصحيح — هل التسليم من واجباتك؟" };

  revalidatePath("/teacher/me/assignments");
  return { ok: true, message: "حُفظ التصحيح." };
}

/**
 * تسليم الطالب.
 *
 * `upsert` لا `insert`: الطالب يعدّل تسليمه ما لم يُصحَّح بعد، والقيد
 * الفريد على (الواجب، الطالب) يمنع نسختين.
 */
export async function submitAssignment(
  _prev: AssignmentState,
  formData: FormData
): Promise<AssignmentState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "سجّل الدخول أولاً." };

  const assignmentId = String(formData.get("assignmentId") ?? "").trim();
  const body = stripTags(String(formData.get("body") ?? "")).trim().slice(0, 8000);
  if (!body) return { ok: false, message: "اكتب إجابتك أولاً." };

  const { data: existing } = await supabase
    .from("assignment_submissions")
    .select("id, graded_at")
    .eq("assignment_id", assignmentId)
    .eq("student_id", user.id)
    .maybeSingle();

  if (existing) {
    if (existing.graded_at)
      return { ok: false, message: "صُحّح تسليمك — لم يعد قابلاً للتعديل." };
    const { data, error } = await supabase
      .from("assignment_submissions")
      .update({ body, submitted_at: new Date().toISOString() })
      .eq("id", existing.id)
      .select("id");
    if (error || !data || data.length === 0)
      return { ok: false, message: "تعذّر حفظ التعديل." };
    revalidatePath("/dashboard");
    return { ok: true, message: "حُدّث تسليمك." };
  }

  const { error } = await supabase
    .from("assignment_submissions")
    .insert({ assignment_id: assignmentId, student_id: user.id, body });
  if (error) {
    console.error("[assignments] submit failed:", error.message);
    return { ok: false, message: "تعذّر التسليم — تأكّد أن الواجب موجّهٌ إليك." };
  }

  revalidatePath("/dashboard");
  return { ok: true, message: "سُلّم الواجب." };
}
