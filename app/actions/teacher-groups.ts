"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { stripTags } from "@/lib/sanitize";

export interface GroupsActionState {
  ok: boolean;
  message?: string;
}

const NOT_TEACHER: GroupsActionState = {
  ok: false,
  message: "سجّل الدخول كمعلّم أولاً.",
};

/**
 * صف المعلّم المملوك للمستخدم الحالي.
 * كل إجراء هنا يعيد استخراجه من الجلسة ويقيّد كتابته بـ teacher_id، فلا
 * يكفي تمرير معرّف مجموعة من الواجهة للوصول إلى مجموعات معلّم آخر.
 */
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

/** المجموعة تخصّ هذا المعلّم؟ */
async function ownsGroup(
  supabase: Awaited<ReturnType<typeof createClient>>,
  teacherId: string,
  groupId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("student_groups")
    .select("id")
    .eq("id", groupId)
    .eq("teacher_id", teacherId)
    .maybeSingle();
  return Boolean(data);
}

function refresh() {
  revalidatePath("/teacher/me/students");
  revalidatePath("/dashboard");
}

/* ==================== المجموعات ==================== */

export async function createGroup(
  _prev: GroupsActionState,
  formData: FormData
): Promise<GroupsActionState> {
  const { supabase, teacher } = await requireMyTeacher();
  if (!teacher) return NOT_TEACHER;

  const name = stripTags(String(formData.get("name") ?? "")).trim().slice(0, 80);
  const description = stripTags(String(formData.get("description") ?? ""))
    .trim()
    .slice(0, 300);
  if (!name) return { ok: false, message: "اكتب اسم المجموعة." };

  const { count } = await supabase
    .from("student_groups")
    .select("id", { count: "exact", head: true })
    .eq("teacher_id", teacher.id);

  const { error } = await supabase.from("student_groups").insert({
    teacher_id: teacher.id,
    name,
    description,
    position: count ?? 0,
  });
  if (error) return { ok: false, message: "تعذّر إنشاء المجموعة." };

  refresh();
  return { ok: true, message: `أُنشئت مجموعة «${name}».` };
}

export async function renameGroup(
  _prev: GroupsActionState,
  formData: FormData
): Promise<GroupsActionState> {
  const { supabase, teacher } = await requireMyTeacher();
  if (!teacher) return NOT_TEACHER;

  const groupId = String(formData.get("groupId") ?? "").trim();
  const name = stripTags(String(formData.get("name") ?? "")).trim().slice(0, 80);
  const description = stripTags(String(formData.get("description") ?? ""))
    .trim()
    .slice(0, 300);
  if (!groupId || !name) return { ok: false, message: "اكتب اسم المجموعة." };

  const { error } = await supabase
    .from("student_groups")
    .update({ name, description })
    .eq("id", groupId)
    .eq("teacher_id", teacher.id);
  if (error) return { ok: false, message: "تعذّر تعديل المجموعة." };

  refresh();
  return { ok: true, message: "حُفظت المجموعة." };
}

export async function deleteGroup(
  _prev: GroupsActionState,
  formData: FormData
): Promise<GroupsActionState> {
  const { supabase, teacher } = await requireMyTeacher();
  if (!teacher) return NOT_TEACHER;

  const groupId = String(formData.get("groupId") ?? "").trim();
  if (!groupId) return { ok: false, message: "المجموعة غير محدّدة." };

  // الأعضاء يسقطون بالتتابع (on delete cascade) — الطالب نفسه لا يُمسّ
  const { error } = await supabase
    .from("student_groups")
    .delete()
    .eq("id", groupId)
    .eq("teacher_id", teacher.id);
  if (error) return { ok: false, message: "تعذّر حذف المجموعة." };

  refresh();
  return { ok: true, message: "حُذفت المجموعة." };
}

/** إضافة طالب إلى مجموعة أو إخراجه منها */
export async function setGroupMembership(
  groupId: string,
  studentId: string,
  member: boolean
): Promise<GroupsActionState> {
  const { supabase, teacher } = await requireMyTeacher();
  if (!teacher) return NOT_TEACHER;
  if (!(await ownsGroup(supabase, teacher.id, groupId))) {
    return { ok: false, message: "هذه المجموعة ليست لك." };
  }

  if (member) {
    // القبول شرط العضوية — تفرضه السياسة أيضاً، ونتحقّق هنا لنعطي رسالة مفهومة
    const { data: follow } = await supabase
      .from("follows")
      .select("teacher_id")
      .eq("teacher_id", teacher.id)
      .eq("student_id", studentId)
      .eq("status", "approved")
      .maybeSingle();
    if (!follow) return { ok: false, message: "هذا الطالب ليس منضمّاً إليك." };

    const { error } = await supabase
      .from("student_group_members")
      .upsert(
        { group_id: groupId, student_id: studentId },
        { onConflict: "group_id,student_id" }
      );
    if (error) return { ok: false, message: "تعذّرت إضافة الطالب." };
  } else {
    const { error } = await supabase
      .from("student_group_members")
      .delete()
      .eq("group_id", groupId)
      .eq("student_id", studentId);
    if (error) return { ok: false, message: "تعذّر إخراج الطالب." };
  }

  refresh();
  return { ok: true, message: member ? "أُضيف إلى المجموعة." : "أُخرج من المجموعة." };
}

/* ==================== طلبات الانضمام ==================== */

/** قبول طلب انضمام أو رفضه مع سبب اختياري */
export async function decideJoinRequest(
  studentId: string,
  approve: boolean,
  note = ""
): Promise<GroupsActionState> {
  const { supabase, teacher } = await requireMyTeacher();
  if (!teacher) return NOT_TEACHER;

  /**
   * `.select()` مقصود: بدونه يعود التحديث ناجحاً وإن لم يطابق صفاً واحداً
   * (طلب سُحب، أو بُتّ من نافذة أخرى)، فيرى المعلّم «قُبل الطالب» ولا شيء
   * تغيّر — نفس صنف العطل الذي أضاع شرح الدرس.
   */
  const { data: changed, error } = await supabase
    .from("follows")
    .update({
      status: approve ? "approved" : "rejected",
      decided_at: new Date().toISOString(),
      decision_note: stripTags(note).slice(0, 300),
    })
    .eq("teacher_id", teacher.id)
    .eq("student_id", studentId)
    .eq("status", "pending")
    .select("student_id");

  if (error) return { ok: false, message: "تعذّر حفظ القرار." };
  if (!changed || changed.length === 0) {
    return {
      ok: false,
      message:
        "لم يعد هذا الطلب معلّقاً — ربما سحبه الطالب أو بُتَّ من جهاز آخر. حدّث الصفحة لترى حالته.",
    };
  }

  refresh();
  revalidatePath(`/teacher/${teacher.slug}`);
  return {
    ok: true,
    message: approve ? "قُبل الطالب في صفّك." : "رُفض الطلب.",
  };
}

/* ==================== بطاقات التقييم ==================== */

/** يقرأ تقديراً من ٠ إلى ٥، ويعيد null إن تُرك فارغاً */
function grade(formData: FormData, key: string): number | null {
  const raw = String(formData.get(key) ?? "").trim();
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 5) return null;
  return Math.round(n);
}

function num(formData: FormData, key: string): number | null {
  const raw = String(formData.get(key) ?? "").trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export async function saveReportCard(
  _prev: GroupsActionState,
  formData: FormData
): Promise<GroupsActionState> {
  const { supabase, teacher } = await requireMyTeacher();
  if (!teacher) return NOT_TEACHER;

  const cardId = String(formData.get("cardId") ?? "").trim();
  const studentId = String(formData.get("studentId") ?? "").trim();
  const title = stripTags(String(formData.get("title") ?? "")).trim().slice(0, 120);
  const unitId = String(formData.get("unitId") ?? "").trim() || null;
  const term = stripTags(String(formData.get("term") ?? "")).trim().slice(0, 80);

  if (!studentId) return { ok: false, message: "اختر الطالب." };
  if (!title) return { ok: false, message: "اكتب عنوان البطاقة." };

  // البطاقة لا تُصدَر إلا لطالب منضمّ فعلاً
  const { data: follow } = await supabase
    .from("follows")
    .select("teacher_id")
    .eq("teacher_id", teacher.id)
    .eq("student_id", studentId)
    .eq("status", "approved")
    .maybeSingle();
  if (!follow) return { ok: false, message: "هذا الطالب ليس منضمّاً إليك." };

  // الوحدة — إن اختيرت — يجب أن تكون من منهج هذا المعلّم
  if (unitId) {
    const { data: unit } = await supabase
      .from("units")
      .select("id")
      .eq("id", unitId)
      .eq("teacher_id", teacher.id)
      .maybeSingle();
    if (!unit) return { ok: false, message: "الوحدة المختارة غير صالحة." };
  }

  const row = {
    teacher_id: teacher.id,
    student_id: studentId,
    unit_id: unitId,
    term,
    title,
    understanding: grade(formData, "understanding"),
    participation: grade(formData, "participation"),
    homework: grade(formData, "homework"),
    behavior: grade(formData, "behavior"),
    score: num(formData, "score"),
    max_score: num(formData, "maxScore"),
    strengths: stripTags(String(formData.get("strengths") ?? "")).slice(0, 1000),
    improvements: stripTags(String(formData.get("improvements") ?? "")).slice(0, 1000),
    note: stripTags(String(formData.get("note") ?? "")).slice(0, 1000),
  };

  const { error } = cardId
    ? await supabase
        .from("report_cards")
        .update(row)
        .eq("id", cardId)
        .eq("teacher_id", teacher.id)
    : await supabase.from("report_cards").insert(row);

  if (error) return { ok: false, message: "تعذّر حفظ بطاقة التقييم." };

  refresh();
  return { ok: true, message: cardId ? "حُفظت البطاقة." : "صدرت بطاقة التقييم." };
}

export async function deleteReportCard(
  _prev: GroupsActionState,
  formData: FormData
): Promise<GroupsActionState> {
  const { supabase, teacher } = await requireMyTeacher();
  if (!teacher) return NOT_TEACHER;

  const cardId = String(formData.get("cardId") ?? "").trim();
  if (!cardId) return { ok: false, message: "البطاقة غير محدّدة." };

  const { error } = await supabase
    .from("report_cards")
    .delete()
    .eq("id", cardId)
    .eq("teacher_id", teacher.id);
  if (error) return { ok: false, message: "تعذّر حذف البطاقة." };

  refresh();
  return { ok: true, message: "حُذفت البطاقة." };
}
