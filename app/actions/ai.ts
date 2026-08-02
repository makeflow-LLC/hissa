"use server";

import { createClient } from "@/lib/supabase/server";
import { chat, extractJson, isAiConfigured } from "@/lib/ai/openrouter";
import {
  formatSystem,
  quizSystem,
  summarySystem,
  type TeachingContext,
} from "@/lib/ai/prompts";
import { sanitizeLessonHtml, stripTags } from "@/lib/sanitize";

/** سقف شهري لكل معلّم — المنصة مجانية، فالاستهلاك بلا حدّ خسارة مباشرة */
const MONTHLY_LIMIT = 40;

/** أقصى طول محتوى نرسله للنموذج (حماية من التكلفة ومن تجاوز السياق) */
const MAX_INPUT_CHARS = 12_000;

export interface AiActionState {
  ok: boolean;
  message?: string;
  html?: string;
  quiz?: { prompt: string; options: string[]; correct_index: number }[];
  remaining?: number;
}

interface LessonContext {
  supabase: Awaited<ReturnType<typeof createClient>>;
  teacherId: string;
  ctx: TeachingContext;
  plainText: string;
  html: string;
}

/**
 * يجمع سياق الدرس بعد التحقّق من أن المستدعي يملكه.
 * المرحلة والمادة تأتيان من صف المعلّم نفسه، فيخاطب النموذجُ المستوى
 * الصحيح دون أن يخمّنه من نصّ الدرس.
 *
 * النصّ يأتي من المحرّر لا من قاعدة البيانات (`draft`): المعلّم يريد
 * تحسين ما كتبه للتوّ، وإلزامه بالحفظ أولاً يعني أن يحفظ نصّاً يعرف أنه
 * يحتاج تحسيناً. و`lessonId` صار اختيارياً حتى تعمل الأدوات على درس
 * جديد لم يُحفظ بعد ولا معرّف له.
 */
async function loadLessonContext(
  lessonId: string,
  draft?: { html?: string; title?: string }
): Promise<{ data?: LessonContext; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "سجّل الدخول كمعلّم أولاً." };

  const { data: teacher } = await supabase
    .from("teachers")
    .select("id, subject, stages")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!teacher) return { error: "هذه الميزة للمعلّمين فقط." };

  // درس محفوظ؟ نقرأه للتحقّق من الملكية وللحصول على الوحدة والعنوان
  const lesson = lessonId
    ? (
        await supabase
          .from("lessons")
          .select("id, title, sections, unit_id")
          .eq("id", lessonId)
          .eq("teacher_id", teacher.id)
          .maybeSingle()
      ).data
    : null;
  if (lessonId && !lesson) {
    return { error: "الدرس غير موجود أو ليس من دروسك." };
  }

  let unitTitle: string | null = null;
  if (lesson?.unit_id) {
    const { data: unit } = await supabase
      .from("units")
      .select("title")
      .eq("id", lesson.unit_id)
      .maybeSingle();
    unitTitle = unit?.title ?? null;
  }

  const savedSections = Array.isArray(lesson?.sections) ? lesson.sections : [];
  const savedHtml = savedSections
    .map((s) => {
      const o = s as Record<string, unknown>;
      const heading = String(o.heading ?? "");
      const body = o.html
        ? String(o.html)
        : Array.isArray(o.paragraphs)
          ? (o.paragraphs as unknown[]).map((p) => `<p>${String(p)}</p>`).join("")
          : "";
      return (heading ? `<h3>${heading}</h3>` : "") + body;
    })
    .join("\n");

  // ما في المحرّر أولى بالمحفوظ؛ ونعود إلى المحفوظ إن جاء المحرّر فارغاً
  const draftHtml = (draft?.html ?? "").trim();
  const html = stripTags(draftHtml).trim() ? draftHtml : savedHtml;
  const plainText = stripTags(html).slice(0, MAX_INPUT_CHARS);

  return {
    data: {
      supabase,
      teacherId: teacher.id,
      ctx: {
        subject: teacher.subject,
        stages: (teacher.stages ?? []) as string[],
        lessonTitle: (draft?.title ?? "").trim() || lesson?.title || "درس جديد",
        unitTitle,
      },
      plainText,
      html: html.slice(0, MAX_INPUT_CHARS),
    },
  };
}

/** عدّ استهلاك الشهر الجاري وفرض السقف */
async function checkQuota(
  supabase: Awaited<ReturnType<typeof createClient>>,
  teacherId: string
): Promise<{ ok: boolean; remaining: number }> {
  const since = new Date();
  since.setDate(1);
  since.setHours(0, 0, 0, 0);

  const { count } = await supabase
    .from("ai_usage")
    .select("id", { count: "exact", head: true })
    .eq("teacher_id", teacherId)
    .gte("created_at", since.toISOString());

  const used = count ?? 0;
  return { ok: used < MONTHLY_LIMIT, remaining: Math.max(0, MONTHLY_LIMIT - used) };
}

async function recordUsage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  teacherId: string,
  kind: "quiz" | "summary" | "format",
  tokens: number,
  cost: number
): Promise<void> {
  await supabase
    .from("ai_usage")
    .insert({ teacher_id: teacherId, kind, tokens, cost });
}

const QUOTA_MESSAGE = `استنفدت حصّتك الشهرية (${MONTHLY_LIMIT} توليدة). تتجدّد مع بداية الشهر القادم.`;

/* ------------------------------ التلخيص ------------------------------ */

/**
 * ملخّص منسّق للدرس. `instructions` توصيات يكتبها المعلّم بنفسه
 * (مثل «ركّز على القوانين» أو «أضف أمثلة محلولة») وتُضاف إلى الطلب.
 */
export async function aiSummarize(
  lessonId: string,
  instructions: string,
  draft?: { html?: string; title?: string }
): Promise<AiActionState> {
  if (!isAiConfigured()) {
    return { ok: false, message: "ميزات الذكاء الاصطناعي غير مفعّلة." };
  }

  const { data, error } = await loadLessonContext(lessonId, draft);
  if (!data) return { ok: false, message: error };
  if (!data.plainText.trim()) {
    return { ok: false, message: "اكتب شرح الدرس أولاً ثم اطلب التلخيص." };
  }

  const quota = await checkQuota(data.supabase, data.teacherId);
  if (!quota.ok) return { ok: false, message: QUOTA_MESSAGE };

  const note = stripTags(instructions).slice(0, 500);
  const res = await chat({
    system: summarySystem(data.ctx),
    user: [
      "نصّ الدرس:",
      "---",
      data.plainText,
      "---",
      note ? `توصيات المعلّم التي يجب الالتزام بها: ${note}` : "",
      "اكتب الملخّص الآن بصيغة HTML فقط.",
    ]
      .filter(Boolean)
      .join("\n"),
  });

  if (!res.ok) return { ok: false, message: res.message };

  await recordUsage(
    data.supabase,
    data.teacherId,
    "summary",
    res.tokens ?? 0,
    res.cost ?? 0
  );

  // مخرجات النموذج مُدخَل غير موثوق كأي مُدخَل آخر — تُعقَّم قبل العرض
  return {
    ok: true,
    html: sanitizeLessonHtml(res.text ?? ""),
    remaining: quota.remaining - 1,
  };
}

/* --------------------------- تحسين التنسيق --------------------------- */

export async function aiFormat(
  lessonId: string,
  html: string,
  instructions: string,
  draft?: { title?: string }
): Promise<AiActionState> {
  if (!isAiConfigured()) {
    return { ok: false, message: "ميزات الذكاء الاصطناعي غير مفعّلة." };
  }

  const { data, error } = await loadLessonContext(lessonId, {
    html,
    title: draft?.title,
  });
  if (!data) return { ok: false, message: error };

  const source = html.slice(0, MAX_INPUT_CHARS);
  if (!stripTags(source).trim()) {
    return { ok: false, message: "لا يوجد نص لتنسيقه في هذا القسم." };
  }

  const quota = await checkQuota(data.supabase, data.teacherId);
  if (!quota.ok) return { ok: false, message: QUOTA_MESSAGE };

  const note = stripTags(instructions).slice(0, 500);
  const res = await chat({
    system: formatSystem(data.ctx),
    user: [
      "النص المطلوب تحسين تنسيقه:",
      "---",
      source,
      "---",
      note ? `توصيات المعلّم: ${note}` : "",
      "أعِد النص منسّقاً بصيغة HTML فقط، بالمعنى نفسه.",
    ]
      .filter(Boolean)
      .join("\n"),
  });

  if (!res.ok) return { ok: false, message: res.message };

  await recordUsage(
    data.supabase,
    data.teacherId,
    "format",
    res.tokens ?? 0,
    res.cost ?? 0
  );

  return {
    ok: true,
    html: sanitizeLessonHtml(res.text ?? ""),
    remaining: quota.remaining - 1,
  };
}

/* --------------------------- توليد الأسئلة --------------------------- */

export async function aiQuiz(
  lessonId: string,
  count: number,
  instructions: string,
  draft?: { html?: string; title?: string }
): Promise<AiActionState> {
  if (!isAiConfigured()) {
    return { ok: false, message: "ميزات الذكاء الاصطناعي غير مفعّلة." };
  }

  const { data, error } = await loadLessonContext(lessonId, draft);
  if (!data) return { ok: false, message: error };
  if (!data.plainText.trim()) {
    return { ok: false, message: "اكتب شرح الدرس أولاً ثم اطلب توليد الأسئلة." };
  }

  const quota = await checkQuota(data.supabase, data.teacherId);
  if (!quota.ok) return { ok: false, message: QUOTA_MESSAGE };

  const n = Math.min(10, Math.max(3, count || 5));
  const note = stripTags(instructions).slice(0, 500);

  const res = await chat({
    system: quizSystem(data.ctx, n),
    user: [
      "نصّ الدرس:",
      "---",
      data.plainText,
      "---",
      note ? `توصيات المعلّم: ${note}` : "",
      `أعِد الآن ${n} أسئلة بصيغة JSON فقط.`,
    ]
      .filter(Boolean)
      .join("\n"),
    temperature: 0.7,
  });

  if (!res.ok) return { ok: false, message: res.message };

  const parsed = extractJson<
    { prompt?: unknown; options?: unknown; correct_index?: unknown }[]
  >(res.text ?? "");
  if (!Array.isArray(parsed)) {
    return { ok: false, message: "تعذّر قراءة الأسئلة المولَّدة — أعد المحاولة." };
  }

  // ننظّف كل سؤال ونتحقّق من صلاحيته بدل الثقة بشكل الردّ
  const quiz = parsed
    .map((q) => {
      const options = Array.isArray(q.options)
        ? (q.options as unknown[]).map((o) => stripTags(String(o)).slice(0, 200))
        : [];
      // لا نُسقِط الفهرس الغائب إلى صفر: سؤالٌ مفتاحه «الخيار الأول»
      // لم يقصده أحد هو نفس الخلل الذي كان في محرّر الاختبارات
      const ci = Number(q.correct_index);
      return {
        prompt: stripTags(String(q.prompt ?? "")).slice(0, 400),
        options: options.filter(Boolean),
        correct_index: Number.isInteger(ci) ? ci : -1,
      };
    })
    .filter(
      (q) =>
        q.prompt &&
        q.options.length >= 2 &&
        q.correct_index >= 0 &&
        q.correct_index < q.options.length
    );

  if (quiz.length === 0) {
    return { ok: false, message: "لم تُنتَج أسئلة صالحة — أعد المحاولة." };
  }

  await recordUsage(
    data.supabase,
    data.teacherId,
    "quiz",
    res.tokens ?? 0,
    res.cost ?? 0
  );

  return { ok: true, quiz, remaining: quota.remaining - 1 };
}
