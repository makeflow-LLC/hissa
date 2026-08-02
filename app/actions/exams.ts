"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { stripTags } from "@/lib/sanitize";
import type { QuestionKind } from "@/lib/data/types";

export interface ExamActionState {
  ok: boolean;
  message?: string;
  /** معرّف الاختبار بعد الإنشاء، ليحوّل النموذج إلى صفحة تحريره */
  examId?: string;
  /** مجموع الأسئلة يخالف العلامة الكلّية — تعرضه الواجهة مع خيار النشر رغم ذلك */
  pointsMismatch?: { sum: number; target: number };
}

const NOT_TEACHER: ExamActionState = {
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
    .select("id, slug")
    .eq("owner_id", user.id)
    .maybeSingle();
  return { supabase, teacher: data as { id: string; slug: string } | null, user };
}

function refresh(examId?: string) {
  revalidatePath("/teacher/me/exams");
  revalidatePath("/dashboard");
  if (examId) revalidatePath(`/teacher/me/exams/${examId}`);
}

/**
 * لحظة مطلقة يرسلها النموذج، أو null إن تُرك الحقل فارغاً.
 *
 * **يجب أن يصل النصّ حاملاً منطقته الزمنية** (`…Z` أو أوفست): النموذج
 * يحسبها في المتصفّح لأنه وحده يعرف منطقة المعلّم. نصّاً بلا منطقة —
 * كالذي يعطيه `datetime-local` مباشرةً — يفهمه الخادم بتوقيت UTC، وكان
 * ذلك يضيف فرق المنطقة إلى كل حفظ (١١:٣٥ تعود ١٤:٣٥ في غزة).
 */
function when(formData: FormData, key: string): string | null {
  const raw = String(formData.get(key) ?? "").trim();
  if (!raw) return null;
  if (!/(?:Z|[+-]\d{2}:?\d{2})$/.test(raw)) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/* ==================== إنشاء الاختبار وتعديله ==================== */

export async function saveExam(
  _prev: ExamActionState,
  formData: FormData
): Promise<ExamActionState> {
  const { supabase, teacher } = await requireMyTeacher();
  if (!teacher) return NOT_TEACHER;

  const examId = String(formData.get("examId") ?? "").trim();
  const title = stripTags(String(formData.get("title") ?? "")).trim().slice(0, 150);
  const description = stripTags(String(formData.get("description") ?? ""))
    .trim()
    .slice(0, 600);
  const groupId = String(formData.get("groupId") ?? "").trim();
  const opensAt = when(formData, "opensAt");
  const closesAt = when(formData, "closesAt");
  const durRaw = String(formData.get("duration") ?? "").trim();
  const duration = durRaw ? Math.max(1, Math.min(600, Number(durRaw) || 0)) : null;
  const targetRaw = String(formData.get("targetPoints") ?? "").trim();
  const targetPoints = targetRaw
    ? Math.max(1, Math.min(1000, Number(targetRaw) || 0))
    : null;

  if (!title) return { ok: false, message: "اكتب عنوان الاختبار." };
  if (!groupId) return { ok: false, message: "اختر المجموعة المستهدفة." };
  if (opensAt && closesAt && closesAt <= opensAt) {
    return { ok: false, message: "وقت الإغلاق يجب أن يكون بعد وقت الفتح." };
  }

  // المجموعة يجب أن تكون من مجموعات هذا المعلّم — السياسة تفرضها أيضاً
  const { data: group } = await supabase
    .from("student_groups")
    .select("id")
    .eq("id", groupId)
    .eq("teacher_id", teacher.id)
    .maybeSingle();
  if (!group) return { ok: false, message: "المجموعة المختارة ليست من مجموعاتك." };

  const row = {
    teacher_id: teacher.id,
    group_id: groupId,
    title,
    description,
    opens_at: opensAt,
    closes_at: closesAt,
    duration_minutes: duration,
    target_points: targetPoints,
  };

  if (examId) {
    const { data: updated, error } = await supabase
      .from("exams")
      .update(row)
      .eq("id", examId)
      .eq("teacher_id", teacher.id)
      .select("id")
      .maybeSingle();
    if (error || !updated) return { ok: false, message: "تعذّر حفظ الاختبار." };
    refresh(examId);
    return { ok: true, message: "حُفظ الاختبار.", examId };
  }

  const { data: created, error } = await supabase
    .from("exams")
    .insert(row)
    .select("id")
    .single();
  if (error || !created) return { ok: false, message: "تعذّر إنشاء الاختبار." };

  refresh(created.id as string);
  return { ok: true, message: "أُنشئ الاختبار — أضِف أسئلته.", examId: created.id as string };
}

interface QuestionInput {
  kind: QuestionKind;
  prompt: string;
  options: string[];
  correct_index: number | null;
  correct_bool: boolean | null;
  model_answer: string;
  points: number;
}

/** يقرأ الأسئلة القادمة من النموذج ويتحقّق من كل حقل بحسب نوعه */
function parseQuestions(raw: string): QuestionInput[] {
  try {
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr
      .map((q) => {
        const o = q as Record<string, unknown>;
        const kind = String(o.kind ?? "mcq") as QuestionKind;
        const prompt = stripTags(String(o.prompt ?? "")).trim();
        const points = Math.max(0.25, Math.min(100, Number(o.points ?? 1) || 1));
        const options = Array.isArray(o.options)
          ? (o.options as unknown[]).map((x) => stripTags(String(x)).trim()).filter(Boolean)
          : [];

        if (kind === "mcq") {
          /**
           * **لا افتراض للإجابة الصحيحة.** كان `Number(o.correct_index ?? 0)`
           * يحوّل «لم يُختَر شيء» إلى الخيار الأول ويمرّره فحصُ الصلاحية —
           * فيُنشر اختبارٌ مفتاحه لم يضعه أحد، ويحصل الطالب على العلامة
           * الكاملة وهو مخطئ، ولا المعلّم ولا الطالب يعرف السبب. القيمة
           * الغائبة تبقى `null` ويُرفض السؤال برسالة تسمّي رقمه.
           */
          const ci = o.correct_index;
          const n = typeof ci === "number" ? ci : Number.NaN;
          return {
            kind,
            prompt,
            options,
            correct_index:
              Number.isInteger(n) && n >= 0 && n < options.length ? n : null,
            correct_bool: null,
            model_answer: "",
            points,
          };
        }
        if (kind === "truefalse") {
          // `=== true` وحده كان يجعل «لم يُختَر» تساوي «خطأ» بصمت
          return {
            kind,
            prompt,
            options: [],
            correct_index: null,
            correct_bool: typeof o.correct_bool === "boolean" ? o.correct_bool : null,
            model_answer: "",
            points,
          };
        }
        return {
          kind: "text" as const,
          prompt,
          options: [],
          correct_index: null,
          correct_bool: null,
          model_answer: stripTags(String(o.model_answer ?? "")).slice(0, 2000),
          points,
        };
      });
  } catch {
    return [];
  }
}

/**
 * ما يمنع حفظ الأسئلة، بجملة عربية تسمّي رقم السؤال — أو فارغ إن صحّت.
 *
 * كان الفلتر يحذف السؤال الناقص بصمت: يضغط المعلّم «حفظ» فتُقال له
 * «حُفظ سؤالان» وهو كتب ثلاثة، ولا يعرف أيّها سقط ولا لماذا.
 */
function questionsProblem(qs: QuestionInput[]): string {
  if (qs.length === 0) return "لم تكتب أي سؤال بعد.";
  for (let i = 0; i < qs.length; i++) {
    const q = qs[i];
    const n = i + 1;
    if (!q.prompt) return `السؤال ${n}: اكتب نصّ السؤال.`;
    if (q.kind === "mcq") {
      if (q.options.length < 2) return `السؤال ${n}: اكتب خيارين على الأقل.`;
      if (q.correct_index === null)
        return `السؤال ${n}: حدّد أي الخيارات هو الصحيح — لا يُفترض عنك.`;
    }
    if (q.kind === "truefalse" && q.correct_bool === null)
      return `السؤال ${n}: اختر «صح» أو «خطأ» كإجابة صحيحة.`;
  }
  return "";
}

export async function saveExamQuestions(
  _prev: ExamActionState,
  formData: FormData
): Promise<ExamActionState> {
  const { supabase, teacher } = await requireMyTeacher();
  if (!teacher) return NOT_TEACHER;

  const examId = String(formData.get("examId") ?? "").trim();
  if (!examId) return { ok: false, message: "الاختبار غير محدّد." };

  const { data: exam } = await supabase
    .from("exams")
    .select("id, status")
    .eq("id", examId)
    .eq("teacher_id", teacher.id)
    .maybeSingle();
  if (!exam) return { ok: false, message: "هذا الاختبار ليس لك." };

  const questions = parseQuestions(String(formData.get("questions") ?? "[]"));
  const problem = questionsProblem(questions);
  if (problem) return { ok: false, message: problem };

  /**
   * تغيير الأسئلة بعد أن أجاب طلاب يفسد تصحيحهم، فنمنعه.
   * التعديل ممكن ما دام لم يبدأ أحد.
   */
  const { count } = await supabase
    .from("exam_attempts")
    .select("id", { count: "exact", head: true })
    .eq("exam_id", examId);
  if ((count ?? 0) > 0) {
    return {
      ok: false,
      message: "بدأ طلاب هذا الاختبار بالفعل، فلا يمكن تغيير أسئلته الآن.",
    };
  }

  // استبدال كامل: أبسط من مطابقة كل سؤال، ولا محاولات قائمة تتأثّر
  await supabase.from("exam_questions").delete().eq("exam_id", examId);
  const { error } = await supabase.from("exam_questions").insert(
    questions.map((q, i) => ({
      exam_id: examId,
      position: i,
      kind: q.kind,
      prompt: q.prompt,
      options: q.options,
      correct_index: q.correct_index,
      correct_bool: q.correct_bool,
      model_answer: q.model_answer,
      points: q.points,
    }))
  );
  if (error) return { ok: false, message: "تعذّر حفظ الأسئلة." };

  refresh(examId);
  return { ok: true, message: `حُفظ ${questions.length} سؤالاً.`, examId };
}

/**
 * نشر الاختبار أو إعادته مسودّة.
 *
 * قبل النشر نجمع علامات الأسئلة ونقارنها بالعلامة الكلّية التي قصدها
 * المعلّم: «الاختبار من ١٠» ومجموع أسئلته ٨ خطأٌ لا يكتشفه أحد إلا بعد
 * أن يقدّم الطلاب. ومع ذلك لا نمنعه منعاً باتّاً — `force` تتيح النشر
 * كما هو، لأن المعلّم قد يقصد فعلاً مجموعاً مخالفاً لما كتبه أوّلاً.
 */
export async function setExamStatus(
  examId: string,
  publish: boolean,
  force = false
): Promise<ExamActionState> {
  const { supabase, teacher } = await requireMyTeacher();
  if (!teacher) return NOT_TEACHER;

  if (publish) {
    const [{ data: qs }, { data: exam }] = await Promise.all([
      supabase.from("exam_questions").select("points").eq("exam_id", examId),
      supabase
        .from("exams")
        .select("target_points")
        .eq("id", examId)
        .eq("teacher_id", teacher.id)
        .maybeSingle(),
    ]);

    const rows = (qs ?? []) as { points: number }[];
    if (rows.length === 0) {
      return { ok: false, message: "أضِف سؤالاً واحداً على الأقل قبل النشر." };
    }

    const sum = rows.reduce((n, q) => n + Number(q.points || 0), 0);
    const target = Number((exam as { target_points: number | null } | null)?.target_points ?? 0);
    if (!force && target > 0 && Math.abs(sum - target) > 0.001) {
      const diff = Math.round(Math.abs(sum - target) * 100) / 100;
      return {
        ok: false,
        message:
          sum < target
            ? `مجموع علامات الأسئلة ${sum} والاختبار من ${target} — ينقص ${diff}. صحّح العلامات أو غيّر العلامة الكلّية.`
            : `مجموع علامات الأسئلة ${sum} والاختبار من ${target} — يزيد ${diff}. صحّح العلامات أو غيّر العلامة الكلّية.`,
        pointsMismatch: { sum, target },
      };
    }
  }

  const { data: changed, error } = await supabase
    .from("exams")
    .update({ status: publish ? "published" : "draft" })
    .eq("id", examId)
    .eq("teacher_id", teacher.id)
    .select("id");

  if (error) return { ok: false, message: "تعذّر تغيير الحالة." };
  if (!changed || changed.length === 0) {
    return { ok: false, message: "لم يتغيّر شيء — حدّث الصفحة." };
  }

  refresh(examId);
  return {
    ok: true,
    message: publish ? "نُشر الاختبار لطلاب المجموعة." : "أُعيد إلى المسودّة.",
  };
}

export async function deleteExam(
  _prev: ExamActionState,
  formData: FormData
): Promise<ExamActionState> {
  const { supabase, teacher } = await requireMyTeacher();
  if (!teacher) return NOT_TEACHER;

  const examId = String(formData.get("examId") ?? "").trim();
  const { error } = await supabase
    .from("exams")
    .delete()
    .eq("id", examId)
    .eq("teacher_id", teacher.id);
  if (error) return { ok: false, message: "تعذّر حذف الاختبار." };

  refresh();
  return { ok: true, message: "حُذف الاختبار." };
}

/* ==================== تقديم الطالب ==================== */

/** هل الاختبار مفتوح الآن؟ يُفحص على الخادم لا في الواجهة */
function windowState(
  opens: string | null,
  closes: string | null
): { open: boolean; reason?: string } {
  const now = Date.now();
  if (opens && now < new Date(opens).getTime()) {
    return { open: false, reason: "لم يفتح الاختبار بعد." };
  }
  if (closes && now > new Date(closes).getTime()) {
    return { open: false, reason: "أُغلق وقت هذا الاختبار." };
  }
  return { open: true };
}

export async function startExam(examId: string): Promise<ExamActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "سجّل الدخول أولاً." };

  const { data: exam } = await supabase
    .from("exams")
    .select("id, opens_at, closes_at, status")
    .eq("id", examId)
    .maybeSingle();
  if (!exam) return { ok: false, message: "الاختبار غير متاح لك." };

  const w = windowState(exam.opens_at, exam.closes_at);
  if (!w.open) return { ok: false, message: w.reason };

  const { data: existing } = await supabase
    .from("exam_attempts")
    .select("id, status")
    .eq("exam_id", examId)
    .eq("student_id", user.id)
    .maybeSingle();
  if (existing) {
    if (existing.status !== "in_progress") {
      return { ok: false, message: "قدّمت هذا الاختبار من قبل." };
    }
    return { ok: true, examId };
  }

  // مجموع العلامات يُحسب من الأسئلة نفسها لا مما يرسله المتصفّح
  const { data: qs } = await supabase.rpc("get_exam_paper", { e_id: examId });
  const max = ((qs ?? []) as { points: number }[]).reduce(
    (n, q) => n + Number(q.points || 0),
    0
  );

  const { error } = await supabase.from("exam_attempts").insert({
    exam_id: examId,
    student_id: user.id,
    max_score: max,
  });
  if (error) return { ok: false, message: "تعذّر بدء الاختبار." };

  revalidatePath(`/exam/${examId}`);
  return { ok: true, examId };
}

/**
 * تسليم الإجابات وتصحيحها.
 *
 * **التصحيح كلّه على الخادم**: المتصفّح يرسل اختياراته فقط، والخادم يقرأ
 * الإجابات الصحيحة من قاعدة البيانات ويحتسب الدرجة. لو وثقنا بدرجة
 * يرسلها العميل لسلّم كل طالب علامة تامّة.
 */
export async function submitExam(
  examId: string,
  answers: {
    questionId: string;
    choiceIndex?: number | null;
    boolAnswer?: boolean | null;
    text?: string;
  }[]
): Promise<ExamActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "سجّل الدخول أولاً." };

  const { data: exam } = await supabase
    .from("exams")
    .select("id, opens_at, closes_at, duration_minutes")
    .eq("id", examId)
    .maybeSingle();
  if (!exam) return { ok: false, message: "الاختبار غير متاح لك." };

  const { data: attempt } = await supabase
    .from("exam_attempts")
    .select("id, status, started_at")
    .eq("exam_id", examId)
    .eq("student_id", user.id)
    .maybeSingle();
  if (!attempt) return { ok: false, message: "ابدأ الاختبار أولاً." };
  if (attempt.status !== "in_progress") {
    return { ok: false, message: "سلّمت هذا الاختبار من قبل." };
  }

  const w = windowState(exam.opens_at, exam.closes_at);
  if (!w.open) return { ok: false, message: w.reason };

  /**
   * المدّة تُفحص هنا لا في المتصفّح وحده: عدّاد الواجهة يوقفه أي طالب من
   * أدوات المطوّر. المهلة الإضافية دقيقتان — الشبكة البطيئة لا ينبغي أن
   * تُلغي ورقة سُلّمت في وقتها.
   */
  if (exam.duration_minutes) {
    const ends =
      new Date(attempt.started_at).getTime() + exam.duration_minutes * 60_000;
    if (Date.now() > ends + 120_000) {
      return { ok: false, message: "انقضى وقت إجابتك على هذا الاختبار." };
    }
  }

  /**
   * قراءة الإجابات الصحيحة تتم بجلسة المعلّم؟ لا — بجلسة الطالب، لكن
   * سياسة exam_questions تمنعه. لذلك نقرأها عبر دالة الخدمة نفسها التي
   * تُخفيها عنه، ثم نطابق هنا: نستخدم RPC تُصحّح داخل قاعدة البيانات.
   */
  const { data: graded, error: gradeErr } = await supabase.rpc("grade_exam_attempt", {
    a_id: attempt.id,
    payload: answers.map((a) => ({
      question_id: a.questionId,
      choice_index: a.choiceIndex ?? null,
      bool_answer: a.boolAnswer ?? null,
      text_answer: (a.text ?? "").slice(0, 5000),
    })),
  });

  if (gradeErr) return { ok: false, message: "تعذّر تسليم الاختبار." };

  const res = (graded ?? {}) as { needs_manual?: boolean };
  revalidatePath(`/exam/${examId}`);
  revalidatePath("/dashboard");
  return {
    ok: true,
    message: res.needs_manual
      ? "سُلّم اختبارك. بعض الأسئلة تحتاج تصحيح معلّمك، وستظهر درجتك النهائية بعده."
      : "سُلّم اختبارك وظهرت درجتك.",
  };
}

/* ==================== التصحيح اليدوي ==================== */

/** المعلّم يمنح علامة لإجابة نصّية */
export async function gradeAnswer(
  answerId: string,
  points: number
): Promise<ExamActionState> {
  const { supabase, teacher } = await requireMyTeacher();
  if (!teacher) return NOT_TEACHER;

  const { data: row } = await supabase
    .from("exam_answers")
    .select("id, attempt_id, question_id")
    .eq("id", answerId)
    .maybeSingle();
  if (!row) return { ok: false, message: "الإجابة غير موجودة." };

  // العلامة لا تتجاوز علامة السؤال
  const { data: q } = await supabase
    .from("exam_questions")
    .select("points")
    .eq("id", row.question_id)
    .maybeSingle();
  const max = Number(q?.points ?? 0);
  const awarded = Math.max(0, Math.min(max, Number(points) || 0));

  const { error } = await supabase
    .from("exam_answers")
    .update({ awarded, graded: true })
    .eq("id", answerId);
  if (error) return { ok: false, message: "تعذّر حفظ العلامة." };

  // إعادة احتساب مجموع المحاولة بعد كل تصحيح
  const { error: recalcErr } = await supabase.rpc("recalc_attempt_score", {
    a_id: row.attempt_id,
  });
  if (recalcErr) return { ok: false, message: "حُفظت العلامة لكن تعذّر تحديث المجموع." };

  revalidatePath("/teacher/me/exams");
  revalidatePath("/dashboard");
  return { ok: true, message: "حُفظت العلامة." };
}

/* ==================== القوالب والاستنساخ ==================== */

/**
 * قراءة أسئلة قالب.
 *
 * أرخى من `parseQuestions` في موضع واحد: **لا يشترط نصّ السؤال**. القالب
 * قد يكون هيكلاً محضاً — «ستّة اختيار وأربعة صح وخطأ وسؤالان نصّيان» —
 * وهو أنفع صوره؛ ولو أسقطنا السؤال الفارغ لخرج القالب خالياً. أمّا
 * التحقّق من النوع والعلامة والخيارات فباقٍ كما هو.
 */
function parseTemplateQuestions(raw: unknown): QuestionInput[] {
  let arr: unknown;
  try {
    arr = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return [];
  }
  if (!Array.isArray(arr)) return [];

  return arr.slice(0, 100).map((q) => {
    const o = (q ?? {}) as Record<string, unknown>;
    const kind: QuestionKind =
      o.kind === "truefalse" || o.kind === "text" ? o.kind : "mcq";
    const points = Math.max(0.25, Math.min(100, Number(o.points ?? 1) || 1));
    const prompt = stripTags(String(o.prompt ?? "")).trim().slice(0, 2000);
    const options = Array.isArray(o.options)
      ? (o.options as unknown[]).slice(0, 8).map((x) => stripTags(String(x)).trim())
      : [];

    if (kind === "mcq") {
      /**
       * القالب **هيكلٌ لا مفتاح إجابة**: يُطبَّق في المحرّر بخيارات فارغة،
       * فلا معنى لأن يحمل «الخيار الأول صحيح». `null` تُلزم المعلّم بأن
       * يختار بنفسه بدل أن يرث افتراضاً لا يعلم به.
       */
      const ci = o.correct_index;
      const max = Math.max(options.length, 1);
      const n = typeof ci === "number" ? ci : Number.NaN;
      return {
        kind,
        prompt,
        options: options.length ? options : ["", "", "", ""],
        correct_index: Number.isInteger(n) && n >= 0 && n < max ? n : null,
        correct_bool: null,
        model_answer: "",
        points,
      };
    }
    if (kind === "truefalse") {
      return {
        kind,
        prompt,
        options: [],
        correct_index: null,
        correct_bool: typeof o.correct_bool === "boolean" ? o.correct_bool : null,
        model_answer: "",
        points,
      };
    }
    return {
      kind: "text" as const,
      prompt,
      options: [],
      correct_index: null,
      correct_bool: null,
      model_answer: stripTags(String(o.model_answer ?? "")).slice(0, 2000),
      points,
    };
  });
}

/**
 * حفظ أسئلة المعلّم الحالية قالباً لإعادة استعمالها.
 *
 * لقطةٌ جامدة: تعديل الاختبار بعدها لا يغيّر القالب، وتعديل القالب لا
 * يمسّ اختباراً استُعمل فيه. لولا ذلك لتغيّرت اختبارات سابقة من تحت يد
 * المعلّم.
 */
export async function saveExamTemplate(
  _prev: ExamActionState,
  formData: FormData
): Promise<ExamActionState> {
  const { supabase, teacher } = await requireMyTeacher();
  if (!teacher) return NOT_TEACHER;

  const name = stripTags(String(formData.get("name") ?? "")).trim().slice(0, 100);
  if (!name) return { ok: false, message: "اكتب اسماً للقالب." };

  const questions = parseTemplateQuestions(formData.get("questions"));
  if (questions.length === 0) {
    return { ok: false, message: "أضِف سؤالاً واحداً على الأقل قبل حفظ القالب." };
  }

  const { error } = await supabase.from("exam_templates").insert({
    teacher_id: teacher.id,
    name,
    description: `${questions.length} سؤالاً · ${questions.reduce(
      (n, q) => n + q.points,
      0
    )} علامة`,
    questions,
  });
  if (error) return { ok: false, message: "تعذّر حفظ القالب." };

  revalidatePath("/teacher/me/exams");
  return { ok: true, message: `حُفظ القالب «${name}».` };
}

export async function deleteExamTemplate(
  templateId: string
): Promise<ExamActionState> {
  const { supabase, teacher } = await requireMyTeacher();
  if (!teacher) return NOT_TEACHER;

  const { error } = await supabase
    .from("exam_templates")
    .delete()
    .eq("id", templateId)
    .eq("teacher_id", teacher.id);
  if (error) return { ok: false, message: "تعذّر حذف القالب." };

  revalidatePath("/teacher/me/exams");
  return { ok: true, message: "حُذف القالب." };
}

/**
 * استنساخ اختبار قائم: نسخة مسودّة بأسئلته كاملةً بلا محاولات.
 *
 * النسخة تولد **مسودّة دائماً** مهما كان الأصل منشوراً: نسخةٌ تصل الطلاب
 * لحظة إنشائها قبل أن يراجعها المعلّم أسوأ من لا شيء. والنافذة الزمنية
 * تُنسخ كما هي ليعدّلها، لا لتُترك فارغة فيُفتح الاختبار أبداً.
 */
export async function duplicateExam(examId: string): Promise<ExamActionState> {
  const { supabase, teacher } = await requireMyTeacher();
  if (!teacher) return NOT_TEACHER;

  const { data: exam } = await supabase
    .from("exams")
    .select("*")
    .eq("id", examId)
    .eq("teacher_id", teacher.id)
    .maybeSingle();
  if (!exam) return { ok: false, message: "هذا الاختبار ليس لك." };

  const src = exam as {
    group_id: string;
    title: string;
    description: string;
    opens_at: string | null;
    closes_at: string | null;
    duration_minutes: number | null;
    target_points: number | null;
  };

  const { data: created, error } = await supabase
    .from("exams")
    .insert({
      teacher_id: teacher.id,
      group_id: src.group_id,
      title: `${src.title} — نسخة`.slice(0, 150),
      description: src.description,
      opens_at: src.opens_at,
      closes_at: src.closes_at,
      duration_minutes: src.duration_minutes,
      target_points: src.target_points,
      status: "draft",
    })
    .select("id")
    .single();
  if (error || !created) return { ok: false, message: "تعذّر استنساخ الاختبار." };

  const newId = created.id as string;

  const { data: qs } = await supabase
    .from("exam_questions")
    .select("position, kind, prompt, options, correct_index, correct_bool, model_answer, points")
    .eq("exam_id", examId)
    .order("position");

  const rows = (qs ?? []) as Record<string, unknown>[];
  if (rows.length > 0) {
    const { error: qErr } = await supabase
      .from("exam_questions")
      .insert(rows.map((q) => ({ ...q, exam_id: newId })));
    if (qErr) {
      // لا نترك اختباراً فارغاً معلّقاً إن فشل نسخ الأسئلة
      await supabase.from("exams").delete().eq("id", newId).eq("teacher_id", teacher.id);
      return { ok: false, message: "تعذّر نسخ الأسئلة." };
    }
  }

  refresh(newId);
  return {
    ok: true,
    message: `أُنشئت نسخة مسودّة بـ${rows.length} سؤالاً — عدّلها ثم انشرها.`,
    examId: newId,
  };
}
