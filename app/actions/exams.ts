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

/** نصّ تاريخ من حقل datetime-local إلى ISO، أو null إن تُرك فارغاً */
function when(formData: FormData, key: string): string | null {
  const raw = String(formData.get(key) ?? "").trim();
  if (!raw) return null;
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
          const ci = Number(o.correct_index ?? 0);
          return {
            kind,
            prompt,
            options,
            // الفهرس خارج المدى يعني سؤالاً بلا إجابة صحيحة — نرفضه لاحقاً
            correct_index: Number.isInteger(ci) && ci >= 0 && ci < options.length ? ci : null,
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
            correct_bool: o.correct_bool === true,
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
      })
      .filter((q) => {
        if (!q.prompt) return false;
        if (q.kind === "mcq") return q.options.length >= 2 && q.correct_index !== null;
        return true;
      });
  } catch {
    return [];
  }
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
  if (questions.length === 0) {
    return {
      ok: false,
      message:
        "لا يوجد سؤال صالح. تأكّد أن لكل سؤال نصّاً، وأن سؤال الاختيار من متعدّد له خياران على الأقل وإجابة صحيحة محدّدة.",
    };
  }

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

export async function setExamStatus(
  examId: string,
  publish: boolean
): Promise<ExamActionState> {
  const { supabase, teacher } = await requireMyTeacher();
  if (!teacher) return NOT_TEACHER;

  if (publish) {
    const { count } = await supabase
      .from("exam_questions")
      .select("id", { count: "exact", head: true })
      .eq("exam_id", examId);
    if ((count ?? 0) === 0) {
      return { ok: false, message: "أضِف سؤالاً واحداً على الأقل قبل النشر." };
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
