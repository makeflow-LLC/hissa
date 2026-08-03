/**
 * خطّة الدرس — ما يُنتجه «مصمّم الدروس» ويراجعه المعلّم قبل أن تصير حصّة.
 *
 * هذا الملفّ **ليس `server-only`** عن قصد: الواجهة تعرض الخطّة وتحرّرها،
 * فتحتاج النوعَ نفسه الذي يتحقّق منه الخادم. لكن `cleanPlan` — رغم كونه
 * هنا — **حارسٌ خادميّ**: يُستدعى في إجراء الخادم عند التوليد وعند الحفظ
 * معاً، فلا يعتمد الأمان على استدعاءٍ في المتصفّح يستطيع أيّ أحد تخطّيه.
 */

import { cleanItems, KINDS, type ActivityKind } from "@/lib/activityKinds";
import { sanitizeLessonHtml, stripTags } from "@/lib/sanitize";

export interface PlanTerm {
  /** المصطلح */
  term: string;
  /** معناه بجملة */
  meaning: string;
}

export interface PlanSection {
  heading: string;
  html: string;
}

export interface PlanQuestion {
  prompt: string;
  options: string[];
  correct_index: number;
}

export interface LessonPlan {
  title: string;
  /** وصف قصير يظهر في قائمة الدروس */
  description: string;
  /** «٤٥ دقيقة» — نصّ لا رقم، كبقية مدد الدروس */
  duration: string;
  emoji: string;
  /** أهداف التعلّم: «أن يكون الطالب قادراً على…» */
  objectives: string[];
  vocabulary: PlanTerm[];
  /** التمهيد — سؤال أو موقف يفتح الدرس */
  starter: string;
  /** صلب الشرح */
  sections: PlanSection[];
  /** لمن لم يفهم بعد */
  scaffold: string;
  /** لمن أتقن وبقي عنده وقت */
  stretch: string;
  homework: string;
  quiz: PlanQuestion[];
  /** نشاط تفاعليّ مقترح من محتوى الدرس */
  activity: { kind: ActivityKind; title: string; items: { a: string; b: string }[] } | null;
}

/** خطّة فارغة — تُستعمل قبل أول توليد */
export const EMPTY_PLAN: LessonPlan = {
  title: "",
  description: "",
  duration: "",
  emoji: "📚",
  objectives: [],
  vocabulary: [],
  starter: "",
  sections: [],
  scaffold: "",
  stretch: "",
  homework: "",
  quiz: [],
  activity: null,
};

/** هل في الخطّة ما يُحفظ؟ */
export function planHasContent(p: LessonPlan): boolean {
  return Boolean(
    p.title.trim() ||
      p.sections.some((s) => s.heading.trim() || s.html.trim()) ||
      p.objectives.length ||
      p.quiz.length
  );
}

/* ==================== التحقّق من مخرجات النموذج ==================== */

const text = (v: unknown, max: number) =>
  stripTags(String(v ?? "")).trim().slice(0, max);
const htmlOf = (v: unknown) => sanitizeLessonHtml(String(v ?? "")).slice(0, 20_000);

const list = <T,>(v: unknown, max: number, map: (x: unknown) => T | null): T[] =>
  (Array.isArray(v) ? v : []).slice(0, max).map(map).filter((x): x is T => x !== null);

/**
 * **مخرجات النموذج مُدخَلٌ غير موثوق** — كنصٍّ يكتبه أيّ معلّم.
 *
 * فكل حقل يُعقَّم أو يُقصّ هنا حقلاً حقلاً، ولا يُقبل شيء لمجرّد أن شكل
 * الردّ بدا صحيحاً: الـHTML يمرّ بالمعقّم نفسه الذي يمرّ به شرح المعلّم،
 * والنصّ العاديّ تُنزع وسومه، ومفتاح كل سؤال يُتحقَّق أنه داخل مدى خياراته.
 *
 * وتُستدعى **مرّتين**: عند التوليد وعند الحفظ. فالخطّة تعبر المتصفّح بينهما
 * — يحرّرها المعلّم — فلا يجوز أن يعتمد الأمان على ما عاد منه.
 */
export function cleanPlan(raw: unknown, fallbackMinutes: number): LessonPlan | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;

  const objectives = list<string>(o.objectives, 8, (x) => text(x, 300) || null);

  const vocabulary = list<PlanTerm>(o.vocabulary, 15, (x) => {
    const t = (x ?? {}) as Record<string, unknown>;
    const term = text(t.term, 120);
    const meaning = text(t.meaning, 400);
    return term && meaning ? { term, meaning } : null;
  });

  const sections = list<PlanSection>(o.sections, 10, (x) => {
    const s = (x ?? {}) as Record<string, unknown>;
    const heading = text(s.heading, 200);
    const body = htmlOf(s.html);
    return heading || stripTags(body).trim() ? { heading, html: body } : null;
  });

  const quiz = list<PlanQuestion>(o.quiz, 12, (x) => {
    const q = (x ?? {}) as Record<string, unknown>;
    const prompt = text(q.prompt, 400);
    const options = list<string>(q.options, 6, (v) => text(v, 200) || null);
    /**
     * لا نُسقِط الفهرس الغائب إلى صفر — نفس قاعدة محرّر الاختبارات:
     * سؤالٌ مفتاحه «الخيار الأول» لم يقصده أحد يُصحَّح خطأً بلا أثرٍ ظاهر.
     */
    const ci = Number(q.correct_index);
    if (!prompt || options.length < 2) return null;
    if (!Number.isInteger(ci) || ci < 0 || ci >= options.length) return null;
    return { prompt, options, correct_index: ci };
  });

  let activity: LessonPlan["activity"] = null;
  const a = o.activity as Record<string, unknown> | undefined;
  if (a && typeof a === "object") {
    const kindRaw = String(a.kind ?? "");
    const kind: ActivityKind = KINDS.some((k) => k.value === kindRaw)
      ? (kindRaw as ActivityKind)
      : "match";
    // نمرّ بمنظّف الأنشطة نفسه، فلا طريق ثانٍ للتحقّق يخالف الأول
    const items = cleanItems(
      (Array.isArray(a.items) ? a.items : []).map((x) => {
        const it = (x ?? {}) as Record<string, unknown>;
        return { a: text(it.a, 200), b: text(it.b, 200) };
      }),
      kind
    ).map((it) => ({ a: it.a, b: it.b }));
    if (items.length >= 3)
      activity = { kind, title: text(a.title, 150) || "نشاط الدرس", items };
  }

  const plan: LessonPlan = {
    title: text(o.title, 150),
    description: text(o.description, 300),
    duration: text(o.duration, 40) || `${fallbackMinutes} دقيقة`,
    // رمزٌ واحد لا جملة: النموذج يعيد أحياناً «📐 هندسة»
    emoji: [...text(o.emoji, 8)][0] ?? "📚",
    objectives,
    vocabulary,
    starter: htmlOf(o.starter),
    sections,
    scaffold: htmlOf(o.scaffold),
    stretch: htmlOf(o.stretch),
    homework: htmlOf(o.homework),
    quiz,
    activity,
  };

  return plan.title || plan.sections.length ? plan : null;
}

/* ==================== تركيب أقسام الدرس ==================== */

/** بنود قائمة من نصوص عادية — تُهرَّب لأنها تدخل HTML */
function ul(items: string[]): string {
  return `<ul>${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * ترتيب الأقسام كما يقرؤها الطالب: يعرف إلى أين يمضي، ثم يُفتح له الباب،
 * ثم الشرح، ثم المصطلحات مرجعاً، ثم المخرجان — إعادةٌ لمن لم يفهم وامتدادٌ
 * لمن أتقن — ثم الواجب.
 */
export function composeSections(
  p: LessonPlan,
  want: {
    objectives: boolean;
    vocabulary: boolean;
    starter: boolean;
    support: boolean;
    homework: boolean;
  }
): PlanSection[] {
  const out: PlanSection[] = [];

  if (want.objectives && p.objectives.length)
    out.push({ heading: "🎯 أهداف الدرس", html: ul(p.objectives) });

  if (want.starter && stripTags(p.starter).trim())
    out.push({ heading: "🚀 لنبدأ", html: p.starter });

  for (const s of p.sections)
    if (s.heading || stripTags(s.html).trim()) out.push(s);

  if (want.vocabulary && p.vocabulary.length)
    out.push({
      heading: "📖 مصطلحات الدرس",
      html:
        "<table><thead><tr><th>المصطلح</th><th>معناه</th></tr></thead><tbody>" +
        p.vocabulary
          .map((v) => `<tr><td><strong>${esc(v.term)}</strong></td><td>${esc(v.meaning)}</td></tr>`)
          .join("") +
        "</tbody></table>",
    });

  if (want.support) {
    if (stripTags(p.scaffold).trim())
      out.push({ heading: "🪜 لم تفهم بعد؟ اقرأ هذا", html: p.scaffold });
    if (stripTags(p.stretch).trim())
      out.push({ heading: "🌟 تحدٍّ لمن أتقن", html: p.stretch });
  }

  if (want.homework && stripTags(p.homework).trim())
    out.push({ heading: "📝 الواجب", html: p.homework });

  // الجداول والقوائم المبنيّة هنا تمرّ بالمعقّم كغيرها — لا استثناء لمصدرٍ
  return out.map((s) => ({ heading: s.heading, html: sanitizeLessonHtml(s.html) }));
}
