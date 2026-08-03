"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { chat, extractJson, isAiConfigured } from "@/lib/ai/openrouter";
import { designSystem } from "@/lib/ai/prompts";
import { stripTags } from "@/lib/sanitize";
import { spend, refund } from "@/lib/ai/spend";
import {
  cleanPlan,
  composeSections,
  type LessonPlan,
} from "@/lib/ai/lessonPlan";

/**
 * تصميم درسٍ كامل أطول من تلخيصه: أقسامٌ وأهدافٌ ومفرداتٌ وأسئلةٌ ونشاط
 * في ردٍّ واحد، والنموذج استدلاليّ فرموز التفكير تُخصم من السقف نفسه.
 */
const DESIGN_MAX_TOKENS = 14_000;

export interface DesignState {
  ok: boolean;
  message?: string;
  plan?: LessonPlan;
  remaining?: number;
}

export interface SaveDesignState {
  ok: boolean;
  message?: string;
  lessonId?: string;
}

async function requireTeacher() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, teacher: null };
  const { data } = await supabase
    .from("teachers")
    .select("id, slug, subject, stages")
    .eq("owner_id", user.id)
    .maybeSingle();
  return {
    supabase,
    teacher: data as {
      id: string;
      slug: string;
      subject: string;
      stages: string[] | null;
    } | null,
  };
}

/* ==================== التوليد ==================== */

export async function designLesson(
  _prev: DesignState,
  formData: FormData
): Promise<DesignState> {
  if (!isAiConfigured())
    return { ok: false, message: "ميزات الذكاء الاصطناعي غير مفعّلة." };

  const { supabase, teacher } = await requireTeacher();
  if (!teacher) return { ok: false, message: "هذه الميزة للمعلّمين فقط." };

  const topic = stripTags(String(formData.get("topic") ?? "")).trim().slice(0, 300);
  if (!topic) return { ok: false, message: "اكتب موضوع الدرس أولاً." };

  const grade = stripTags(String(formData.get("grade") ?? "")).trim().slice(0, 80);
  const notes = stripTags(String(formData.get("notes") ?? "")).trim().slice(0, 600);
  /**
   * مادّةٌ مرجعية يلصقها المعلّم — فقرة من كتاب المنهج، تعريفاتٌ بعينها،
   * أمثلةٌ يريدها. تُنزع وسومها كأيّ مُدخَل، وحدّها أعلى من حدّ التوصيات
   * لأنها محتوىً لا توجيه.
   */
  const references = stripTags(String(formData.get("references") ?? ""))
    .trim()
    .slice(0, 6000);
  const minutes = clamp(Number(formData.get("minutes")), 10, 120, 45);
  const sections = clamp(Number(formData.get("sections")), 2, 8, 4);
  const questions = clamp(Number(formData.get("questions")), 0, 10, 5);

  /**
   * الخصم قبل النداء، والردّ إن فشل — نفس ترتيب بقية الأدوات، وسببه أن
   * الخصم بعد النجاح يجعل قطعَ الطلب طريقاً لاستدعاء النموذج بلا حساب.
   */
  const paid = await spend(supabase, "design");
  if (!paid.ok) return { ok: false, message: paid.message };

  const res = await chat({
    system: designSystem(
      {
        subject: teacher.subject,
        stages: (teacher.stages ?? []) as string[],
        grade: grade || undefined,
        lessonTitle: topic,
      },
      { minutes, sections, questions, hasRefs: Boolean(references) }
    ),
    user: [
      `موضوع الدرس المطلوب: ${topic}`,
      grade ? `الصفّ: ${grade}` : "",
      notes ? `توصيات المعلّم التي يجب الالتزام بها: ${notes}` : "",
      references
        ? `المادّة المرجعية التي يجب أن يُبنى الدرس عليها:\n---\n${references}\n---`
        : "",
      questions === 0 ? "لا تُنتج أسئلة — اترك quiz مصفوفة فارغة." : "",
      "صمّم الدرس الآن وأعِد JSON فقط.",
    ]
      .filter(Boolean)
      .join("\n"),
    temperature: 0.6,
    maxTokens: DESIGN_MAX_TOKENS,
  });

  if (!res.ok) {
    await refund(supabase, "design");
    return { ok: false, message: `${res.message} (أُعيدت الكريدتان إلى رصيدك)` };
  }

  const plan = cleanPlan(extractJson<unknown>(res.text ?? ""), minutes);
  if (!plan) {
    await refund(supabase, "design");
    return {
      ok: false,
      message: "تعذّر قراءة الخطّة المولَّدة — أعد المحاولة. (أُعيدت الكريدتان)",
    };
  }

  return { ok: true, plan, remaining: paid.remaining };
}

function clamp(n: number, min: number, max: number, dflt: number): number {
  if (!Number.isFinite(n)) return dflt;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/* ==================== الحفظ كحصّة ==================== */

/**
 * يحوّل الخطّة إلى **درسٍ حقيقيّ**: صفٌّ في `lessons` بأقسامه، وأسئلته في
 * `quiz_questions`، ونشاطه — إن طُلب — صفٌّ في `activities`.
 *
 * والدرس يهبط **مسودّةً دائماً**، كنسخة الاختبار المستنسخة تماماً: نصٌّ
 * كتبه نموذجٌ ولم يقرأه المعلّم بعدُ يجب ألّا يبلغ طالباً. النشر خطوةٌ
 * يخطوها المعلّم من محرّر الدرس بعد المراجعة.
 */
export async function saveDesignedLesson(
  _prev: SaveDesignState,
  formData: FormData
): Promise<SaveDesignState> {
  const { supabase, teacher } = await requireTeacher();
  if (!teacher) return { ok: false, message: "سجّل الدخول كمعلّم أولاً." };

  let parsed: unknown;
  try {
    parsed = JSON.parse(String(formData.get("plan") ?? "null"));
  } catch {
    return { ok: false, message: "تعذّرت قراءة الخطّة." };
  }
  const plan = cleanPlan(parsed, 45);
  if (!plan) return { ok: false, message: "لا خطّة لحفظها." };
  if (!plan.title) return { ok: false, message: "عنوان الدرس مطلوب." };

  const unitIdRaw = String(formData.get("unitId") ?? "").trim();
  const unitId = unitIdRaw || null;
  if (unitId) {
    const { data: u } = await supabase
      .from("units")
      .select("id")
      .eq("id", unitId)
      .eq("teacher_id", teacher.id)
      .maybeSingle();
    if (!u) return { ok: false, message: "الوحدة المختارة غير صالحة." };
  }

  const sections = composeSections(plan, {
    objectives: formData.get("withObjectives") === "on",
    vocabulary: formData.get("withVocabulary") === "on",
    starter: formData.get("withStarter") === "on",
    support: formData.get("withSupport") === "on",
    homework: formData.get("withHomework") === "on",
  });
  if (sections.length === 0)
    return { ok: false, message: "لا محتوى في الخطّة — أبقِ قسماً واحداً على الأقل." };

  // الموضع في نهاية دروس الوحدة — و`is null` لا `eq null` للدروس بلا وحدة
  const posQuery = supabase
    .from("lessons")
    .select("id", { count: "exact", head: true })
    .eq("teacher_id", teacher.id);
  const { count } = unitId
    ? await posQuery.eq("unit_id", unitId)
    : await posQuery.is("unit_id", null);

  const { data: created, error } = await supabase
    .from("lessons")
    .insert({
      teacher_id: teacher.id,
      unit_id: unitId,
      title: plan.title,
      description: plan.description,
      duration: plan.duration,
      emoji: plan.emoji,
      status: "draft",
      sections,
      position: count ?? 0,
    })
    .select("id")
    .single();
  if (error || !created)
    return { ok: false, message: "تعذّر إنشاء الدرس — حاول مجدداً." };

  const lessonId = created.id as string;

  if (formData.get("withQuiz") === "on" && plan.quiz.length > 0) {
    await supabase.from("quiz_questions").insert(
      plan.quiz.map((q, i) => ({
        lesson_id: lessonId,
        prompt: q.prompt,
        options: q.options,
        correct_index: q.correct_index,
        position: i,
      }))
    );
  }

  if (formData.get("withActivity") === "on" && plan.activity) {
    await supabase.from("activities").insert({
      teacher_id: teacher.id,
      lesson_id: lessonId,
      title: plan.activity.title,
      kind: plan.activity.kind,
      items: plan.activity.items,
      status: "draft",
    });
  }

  revalidatePath("/teacher/me/content");
  revalidatePath("/teacher/me/activities");
  revalidatePath(`/teacher/${teacher.slug}`);
  return { ok: true, lessonId };
}
