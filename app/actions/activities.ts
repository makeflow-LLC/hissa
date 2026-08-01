"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { stripTags } from "@/lib/sanitize";
import {
  activityProblem,
  cleanItems,
  kindSpec,
  type ActivityItem,
  type ActivityKind,
} from "@/lib/activityKinds";

export interface ActivityActionState {
  ok: boolean;
  message?: string;
  activityId?: string;
}

const NOT_TEACHER: ActivityActionState = {
  ok: false,
  message: "سجّل الدخول كمعلّم أولاً.",
};

async function requireMyTeacher() {
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

function refresh(id?: string) {
  revalidatePath("/teacher/me/activities");
  revalidatePath("/dashboard");
  if (id) revalidatePath(`/teacher/me/activities/${id}`);
}

/** النوع المرسَل، أو `match` إن جاء بما لا نعرفه */
function readKind(raw: unknown): ActivityKind {
  const k = String(raw ?? "");
  return (["match", "flashcards", "quiz", "anagram", "sort", "wheel"] as const).includes(
    k as ActivityKind
  )
    ? (k as ActivityKind)
    : "match";
}

/** العناصر تصل نصّاً JSON من المحرّر، وتُنظَّف وتُعقَّم هنا */
function readItems(raw: unknown, kind: ActivityKind): ActivityItem[] {
  let parsed: unknown;
  try {
    parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return [];
  }
  const arr = Array.isArray(parsed) ? parsed : [];
  return cleanItems(
    arr.map((x) => {
      const o = (x ?? {}) as Record<string, unknown>;
      return {
        a: stripTags(String(o.a ?? "")),
        b: stripTags(String(o.b ?? "")),
      };
    }),
    kind
  );
}

/* ==================== إنشاء النشاط وتعديله ==================== */

export async function saveActivity(
  _prev: ActivityActionState,
  formData: FormData
): Promise<ActivityActionState> {
  const { supabase, teacher } = await requireMyTeacher();
  if (!teacher) return NOT_TEACHER;

  const id = String(formData.get("activityId") ?? "").trim();
  const title = stripTags(String(formData.get("title") ?? "")).trim().slice(0, 150);
  const instructions = stripTags(String(formData.get("instructions") ?? ""))
    .trim()
    .slice(0, 500);
  const kind = readKind(formData.get("kind"));
  const items = readItems(formData.get("items"), kind);
  const groupId = String(formData.get("groupId") ?? "").trim() || null;
  const lessonId = String(formData.get("lessonId") ?? "").trim() || null;

  if (!title) return { ok: false, message: "اكتب عنوان النشاط." };

  // المجموعة والدرس — إن حُدّدا — يجب أن يكونا لهذا المعلّم
  if (groupId) {
    const { data: g } = await supabase
      .from("student_groups")
      .select("id")
      .eq("id", groupId)
      .eq("teacher_id", teacher.id)
      .maybeSingle();
    if (!g) return { ok: false, message: "المجموعة المختارة ليست من مجموعاتك." };
  }
  if (lessonId) {
    const { data: l } = await supabase
      .from("lessons")
      .select("id")
      .eq("id", lessonId)
      .eq("teacher_id", teacher.id)
      .maybeSingle();
    if (!l) return { ok: false, message: "الدرس المختار ليس من دروسك." };
  }

  const row = {
    teacher_id: teacher.id,
    group_id: groupId,
    lesson_id: lessonId,
    title,
    instructions,
    kind,
    items,
  };

  if (id) {
    const { data: updated, error } = await supabase
      .from("activities")
      .update(row)
      .eq("id", id)
      .eq("teacher_id", teacher.id)
      .select("id")
      .maybeSingle();
    if (error || !updated) return { ok: false, message: "تعذّر حفظ النشاط." };
    refresh(id);
    return { ok: true, message: `حُفظ النشاط (${items.length} عنصراً).`, activityId: id };
  }

  const { data: created, error } = await supabase
    .from("activities")
    .insert(row)
    .select("id")
    .single();
  if (error || !created) return { ok: false, message: "تعذّر إنشاء النشاط." };

  refresh(created.id as string);
  return {
    ok: true,
    message: "أُنشئ النشاط — أضِف عناصره ثم انشره.",
    activityId: created.id as string,
  };
}

/**
 * نشر النشاط أو إعادته مسودّة.
 *
 * لكل لعبة حدّها الأدنى من العناصر (المطابقة ثلاثة، الاختيار السريع
 * أربعة…) — لأن اللعبة دونه لا تكون لعبة. `activityProblem` هي نفسها
 * التي يعرضها المحرّر لحظةً بلحظة، فلا يفاجأ المعلّم عند النشر برفضٍ لم
 * يره قادماً.
 */
export async function setActivityStatus(
  id: string,
  publish: boolean
): Promise<ActivityActionState> {
  const { supabase, teacher } = await requireMyTeacher();
  if (!teacher) return NOT_TEACHER;

  if (publish) {
    const { data: act } = await supabase
      .from("activities")
      .select("kind, items")
      .eq("id", id)
      .eq("teacher_id", teacher.id)
      .maybeSingle();
    if (!act) return { ok: false, message: "هذا النشاط ليس لك." };

    const a = act as { kind: ActivityKind; items: unknown };
    const problem = activityProblem(
      a.kind,
      Array.isArray(a.items) ? (a.items as ActivityItem[]) : []
    );
    if (problem) return { ok: false, message: problem };
  }

  const { data: changed, error } = await supabase
    .from("activities")
    .update({ status: publish ? "published" : "draft" })
    .eq("id", id)
    .eq("teacher_id", teacher.id)
    .select("id");

  if (error) return { ok: false, message: "تعذّر تغيير الحالة." };
  if (!changed || changed.length === 0) {
    return { ok: false, message: "لم يتغيّر شيء — حدّث الصفحة." };
  }

  refresh(id);
  return {
    ok: true,
    message: publish ? "نُشر النشاط لطلابك." : "أُعيد إلى المسودّة.",
  };
}

export async function deleteActivity(id: string): Promise<ActivityActionState> {
  const { supabase, teacher } = await requireMyTeacher();
  if (!teacher) return NOT_TEACHER;

  const { error } = await supabase
    .from("activities")
    .delete()
    .eq("id", id)
    .eq("teacher_id", teacher.id);
  if (error) return { ok: false, message: "تعذّر حذف النشاط." };

  refresh();
  return { ok: true, message: "حُذف النشاط." };
}

/**
 * استنساخ نشاط — والنسخة مسودّة دائماً، كنسخة الاختبار.
 *
 * أرخص طريق إلى نشاط جديد: نشاطٌ نجح، يبدّل المعلّم نوعه أو يعدّل بعض
 * عناصره.
 */
export async function duplicateActivity(id: string): Promise<ActivityActionState> {
  const { supabase, teacher } = await requireMyTeacher();
  if (!teacher) return NOT_TEACHER;

  const { data: src } = await supabase
    .from("activities")
    .select("group_id, lesson_id, title, instructions, kind, items")
    .eq("id", id)
    .eq("teacher_id", teacher.id)
    .maybeSingle();
  if (!src) return { ok: false, message: "هذا النشاط ليس لك." };

  const s = src as {
    group_id: string | null;
    lesson_id: string | null;
    title: string;
    instructions: string;
    kind: ActivityKind;
    items: unknown;
  };

  const { data: created, error } = await supabase
    .from("activities")
    .insert({
      teacher_id: teacher.id,
      group_id: s.group_id,
      lesson_id: s.lesson_id,
      title: `${s.title} — نسخة`.slice(0, 150),
      instructions: s.instructions,
      kind: s.kind,
      items: s.items,
      status: "draft",
    })
    .select("id")
    .single();
  if (error || !created) return { ok: false, message: "تعذّر استنساخ النشاط." };

  refresh(created.id as string);
  return {
    ok: true,
    message: "أُنشئت نسخة مسودّة — عدّلها ثم انشرها.",
    activityId: created.id as string,
  };
}

/* ==================== قوالب المعلّم ==================== */

export async function saveActivityTemplate(
  _prev: ActivityActionState,
  formData: FormData
): Promise<ActivityActionState> {
  const { supabase, teacher } = await requireMyTeacher();
  if (!teacher) return NOT_TEACHER;

  const name = stripTags(String(formData.get("name") ?? "")).trim().slice(0, 100);
  if (!name) return { ok: false, message: "اكتب اسماً للقالب." };

  const kind = readKind(formData.get("kind"));
  const items = readItems(formData.get("items"), kind);
  if (items.length === 0) {
    return { ok: false, message: "أضِف عنصراً واحداً على الأقل قبل حفظ القالب." };
  }

  const { error } = await supabase
    .from("activity_templates")
    .insert({ teacher_id: teacher.id, name, kind, items });
  if (error) return { ok: false, message: "تعذّر حفظ القالب." };

  refresh();
  return {
    ok: true,
    message: `حُفظ القالب «${name}» (${kindSpec(kind).label} · ${items.length} عنصراً).`,
  };
}

export async function deleteActivityTemplate(
  templateId: string
): Promise<ActivityActionState> {
  const { supabase, teacher } = await requireMyTeacher();
  if (!teacher) return NOT_TEACHER;

  const { error } = await supabase
    .from("activity_templates")
    .delete()
    .eq("id", templateId)
    .eq("teacher_id", teacher.id);
  if (error) return { ok: false, message: "تعذّر حذف القالب." };

  refresh();
  return { ok: true, message: "حُذف القالب." };
}

/* ==================== لعبة الطالب ==================== */

/**
 * تسجيل نتيجة لعبة.
 *
 * **النتيجة يحسبها المتصفّح، ونحن نعلم ذلك.** النشاط تدريبٌ لا امتحان:
 * المطابقة لا تُلعَب أصلاً دون أن يرى الطالب الطرفين، فإخفاء الإجابات
 * مستحيل هنا بخلاف `exams`. لذلك تُحفظ النتيجة للتشجيع ومتابعة النشاط،
 * ولا تدخل في أي معدّل رسمي — ومن أراد تقويماً محميّاً فالاختبارات
 * موضعه. نقصّ الأرقام إلى مدى معقول حتى لا تُحقن قيم عبثية.
 */
export async function recordPlay(
  activityId: string,
  score: number,
  total: number,
  seconds: number
): Promise<ActivityActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "سجّل الدخول أولاً." };

  const t = Math.max(0, Math.min(1000, Number(total) || 0));
  const s = Math.max(0, Math.min(t, Number(score) || 0));
  const sec = Math.max(0, Math.min(24 * 3600, Math.round(Number(seconds) || 0)));

  // السياسة تفرض can_play_activity أيضاً — هذا مجرّد ردّ مفهوم
  const { error } = await supabase.from("activity_plays").insert({
    activity_id: activityId,
    student_id: user.id,
    score: s,
    total: t,
    seconds: sec,
  });
  if (error) {
    return {
      ok: false,
      message:
        error.code === "42501"
          ? "هذا النشاط ليس متاحاً لك."
          : "تعذّر حفظ نتيجتك.",
    };
  }

  revalidatePath("/dashboard");
  revalidatePath(`/activity/${activityId}`);
  return { ok: true, message: "سُجّلت نتيجتك." };
}
