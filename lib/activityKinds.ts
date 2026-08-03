/**
 * أنواع الأنشطة التفاعلية.
 *
 * **المحتوى واحد واللعبة تتبدّل.** كل نشاط قائمةُ أزواج `{a, b}`، وما
 * يختلف هو معنى الطرفين وكيف يُعرضان. لذلك يستطيع المعلّم أن يُدخل
 * محتواه مرّةً ثم يجرّبه في ستّ ألعاب دون إعادة كتابة حرف.
 */

import { SUPABASE_URL } from "@/lib/supabase/config";

export type ActivityKind =
  | "match"
  | "flashcards"
  | "quiz"
  | "anagram"
  | "sort"
  | "wheel"
  | "memory"
  | "truefalse"
  | "balloons"
  | "speed"
  | "pyramid";

export interface ActivityItem {
  a: string;
  b: string;
  /** صورة اختيارية للعنصر — رابط داخل مساحة تخزين المشروع وحدها */
  img?: string;
}

/**
 * الصورة تُقصر على مضيف Supabase الخاص بالمشروع.
 *
 * نفس قاعدة `sanitizeLessonHtml`: التسجيل كمعلّم مفتوح للجميع، ورابط
 * صورة خارجيّ يُعرض في متصفّح الطالب يكشف عنوانه للمضيف الخارجي ويصلح
 * منارةَ تتبّع. والرفع إلى حاويتنا مضمونٌ بالسياسة نفسها.
 */
export function safeImageUrl(raw: unknown): string {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  try {
    const u = new URL(s);
    const host = new URL(SUPABASE_URL).hostname;
    if (u.protocol !== "https:" || u.hostname !== host) return "";
    return s.slice(0, 600);
  } catch {
    return "";
  }
}

export interface KindSpec {
  value: ActivityKind;
  label: string;
  icon: string;
  /** ماذا تفعل هذه اللعبة، بجملة يقرؤها المعلّم قبل أن يختارها */
  about: string;
  /** عنوان العمود الأوّل والثاني في المحرّر */
  labelA: string;
  labelB: string;
  /** بعض الألعاب لا تحتاج الطرف الثاني */
  needsB: boolean;
  /** أقلّ عدد أزواج تعمل به اللعبة */
  min: number;
  /** هل تُحتسب لها درجة؟ العجلة والبطاقات تدريبٌ بلا تسجيل */
  scored: boolean;
  /** مثال يوضّح الشكل المطلوب — يُعرض في المحرّر لا يُحفظ */
  exampleA: string;
  exampleB: string;
  /** هل تعرض هذه اللعبة صور العناصر؟ يظهر عمود الصورة في المحرّر عندها */
  usesImages?: boolean;
}

export const KINDS: KindSpec[] = [
  {
    value: "match",
    label: "مطابقة",
    icon: "🔗",
    about:
      "يظهر الطرفان مبعثرين، ويضغط الطالب الكلمة ثم ما يقابلها. أنسب للمصطلحات ومعانيها.",
    labelA: "الطرف الأول",
    labelB: "ما يقابله",
    needsB: true,
    min: 3,
    scored: true,
    exampleA: "الفاعل",
    exampleB: "من قام بالفعل",
  },
  {
    value: "pyramid",
    label: "هرم المعلومات",
    icon: "🔺",
    about:
      "يصعد الطالب درجات الهرم، وكل درجة تحدٍّ من نوع آخر: اختيار، ثم صح وخطأ، ثم صورة، ثم ترتيب حروف، ثم كتابة الإجابة — وتشتدّ الصعوبة كلّما ارتفع. له ثلاث محاولات.",
    labelA: "السؤال",
    labelB: "الإجابة الصحيحة",
    needsB: true,
    min: 5,
    scored: true,
    exampleA: "أكبر كواكب المجموعة الشمسية",
    exampleB: "المشتري",
    usesImages: true,
  },
  {
    value: "flashcards",
    label: "بطاقات تعليمية",
    icon: "🃏",
    about:
      "بطاقة تُقلَب: الوجه سؤال والظهر جواب. مراجعة هادئة يتحكّم الطالب بسرعتها، بلا درجة.",
    labelA: "وجه البطاقة",
    labelB: "ظهرها",
    needsB: true,
    min: 2,
    scored: false,
    exampleA: "ما جمع «كتاب»؟",
    exampleB: "كُتُب",
  },
  {
    value: "quiz",
    label: "اختيار سريع",
    icon: "⚡",
    about:
      "سؤال وأربعة خيارات، والخيارات الخاطئة تُبنى من إجابات بقية الأسئلة — فلا تكتبها أنت.",
    labelA: "السؤال",
    labelB: "الإجابة الصحيحة",
    needsB: true,
    min: 4,
    scored: true,
    exampleA: "عاصمة مصر؟",
    exampleB: "القاهرة",
  },
  {
    value: "anagram",
    label: "رتّب الحروف",
    icon: "🔤",
    about:
      "تُبعثر حروف الكلمة ويعيد الطالب ترتيبها. الطرف الثاني تلميح اختياري يظهر عند الحاجة.",
    labelA: "الكلمة",
    labelB: "تلميح (اختياري)",
    needsB: false,
    min: 2,
    scored: true,
    exampleA: "مدرسة",
    exampleB: "مكان التعلّم",
  },
  {
    value: "sort",
    label: "صنّف في مجموعات",
    icon: "🗂️",
    about:
      "يضع الطالب كل عنصر في فئته. اكتب العنصر في الطرف الأول واسم فئته في الثاني.",
    labelA: "العنصر",
    labelB: "فئته",
    needsB: true,
    min: 4,
    scored: true,
    exampleA: "الأسد",
    exampleB: "حيوان مفترس",
  },
  {
    value: "memory",
    label: "ذاكرة البطاقات",
    icon: "🧠",
    about:
      "بطاقات مقلوبة يفتح الطالب اثنتين ليجد الزوج المتطابق. تدريبٌ على الربط والتركيز معاً.",
    labelA: "الطرف الأول",
    labelB: "ما يقابله",
    needsB: true,
    min: 3,
    scored: true,
    exampleA: "H₂O",
    exampleB: "الماء",
  },
  {
    value: "truefalse",
    label: "صح أو خطأ",
    icon: "⚖️",
    about:
      "تُعرض جملة «س = ص» وقد تكون صحيحة أو مركّبة من زوجين مختلفين — والمنصة تركّبها بنفسها من أزواجك.",
    labelA: "الطرف الأول",
    labelB: "ما يقابله",
    needsB: true,
    min: 4,
    scored: true,
    exampleA: "عاصمة الأردن",
    exampleB: "عمّان",
  },
  {
    value: "balloons",
    label: "فرقعة البالونات",
    icon: "🎈",
    about:
      "بالونات تصعد تحمل إجابات، يفرقع الطالب الصحيحة قبل أن تفلت. لعبة سريعة تناسب المراجعة الحماسية.",
    labelA: "السؤال",
    labelB: "الإجابة الصحيحة",
    needsB: true,
    min: 4,
    scored: true,
    exampleA: "٧ × ٨",
    exampleB: "٥٦",
  },
  {
    value: "speed",
    label: "تحدّي السرعة",
    icon: "⏱️",
    about:
      "ستّون ثانية: كم إجابة صحيحة تجمع؟ مع سلسلة تتضاعف كلّما تتابع صوابك. الأسئلة تدور فلا تنتهي.",
    labelA: "السؤال",
    labelB: "الإجابة الصحيحة",
    needsB: true,
    min: 4,
    scored: true,
    exampleA: "جمع «قلم»",
    exampleB: "أقلام",
  },
  {
    value: "wheel",
    label: "عجلة عشوائية",
    icon: "🎡",
    about:
      "عجلة تدور وتقف على عنصر — لاختيار طالب أو سؤال أمام الصفّ. بلا درجة ولا إجابات.",
    labelA: "العنصر",
    labelB: "ملاحظة (اختيارية)",
    needsB: false,
    min: 2,
    scored: false,
    exampleA: "سؤال المراجعة الأول",
    exampleB: "",
  },
];

export const kindSpec = (k: ActivityKind): KindSpec =>
  KINDS.find((x) => x.value === k) ?? KINDS[0];

/** قوالب جاهزة من المنصة: النوع وعدد الصفوف الفارغة */
export interface ActivityTemplate {
  id: string;
  name: string;
  kind: ActivityKind;
  items: ActivityItem[];
  builtin?: boolean;
}

const empty = (n: number): ActivityItem[] =>
  Array.from({ length: n }, () => ({ a: "", b: "" }));

/**
 * قوالب المنصة — **هيكلٌ لا محتوى**، لنفس سبب قوالب الاختبارات: المادة
 * والمرحلة تختلفان فأي محتوى «جاهز» في غير موضعه، وما يوفّره القالب هو
 * اختيار اللعبة وعدد الصفوف.
 */
export const BUILTIN_ACTIVITY_TEMPLATES: ActivityTemplate[] = KINDS.map((k) => ({
  id: `builtin:${k.value}`,
  name: `${k.icon} ${k.label}`,
  kind: k.value,
  items: empty(Math.max(k.min, 6)),
  builtin: true,
}));

/** تنظيف قائمة العناصر: قصّ، وحذف الفارغ، وحدّ أعلى */
export function cleanItems(raw: unknown, kind: ActivityKind): ActivityItem[] {
  const spec = kindSpec(kind);
  const arr = Array.isArray(raw) ? raw : [];
  return arr
    .slice(0, 60)
    .map((x) => {
      const o = (x ?? {}) as Record<string, unknown>;
      const img = safeImageUrl(o.img);
      return {
        a: String(o.a ?? "").trim().slice(0, 200),
        b: String(o.b ?? "").trim().slice(0, 200),
        ...(img ? { img } : {}),
      };
    })
    .filter((it) => (spec.needsB ? it.a && it.b : it.a));
}

/** ما يمنع نشر النشاط، بجملة عربية — أو فارغ إن كان صالحاً */
export function activityProblem(
  kind: ActivityKind,
  items: ActivityItem[]
): string {
  const spec = kindSpec(kind);
  const clean = cleanItems(items, kind);
  if (clean.length < spec.min) {
    return spec.needsB
      ? `«${spec.label}» تحتاج ${spec.min} صفوف مكتملة الطرفين على الأقل — عندك ${clean.length}.`
      : `«${spec.label}» تحتاج ${spec.min} عناصر على الأقل — عندك ${clean.length}.`;
  }
  if (kind === "sort") {
    const cats = new Set(clean.map((i) => i.b));
    if (cats.size < 2) return "التصنيف يحتاج فئتين مختلفتين على الأقل.";
    if (cats.size > 6) return "التصنيف يقبل ٦ فئات كحدّ أقصى ليتّسع لها الجوال.";
  }
  if (kind === "anagram" && clean.some((i) => i.a.replace(/\s/g, "").length < 3)) {
    return "كل كلمة في «رتّب الحروف» يجب أن تكون ٣ حروف فأكثر.";
  }
  /**
   * الهرم يمزج أنواع التحدّي، ومنها «رتّب الحروف» و«اكتب الإجابة» —
   * وكلاهما يحتاج إجابةً قصيرة يمكن كتابتها. فننبّه إن كانت كل الإجابات
   * جُملاً طويلة، لأن اللعبة عندها تنحصر في الاختيار وتفقد تنوّعها.
   */
  if (kind === "pyramid") {
    const short = clean.filter((i) => i.b.replace(/\s/g, "").length <= 20).length;
    if (short < 2)
      return "«هرم المعلومات» يحتاج إجابتين قصيرتين على الأقل (كلمة أو كلمتين) ليتنوّع التحدّي.";
  }
  // الذاكرة تعرض ضِعف العدد بطاقاتٍ على الشاشة، فتكتظّ بعد ثمانية أزواج
  if (kind === "memory" && clean.length > 8) {
    return "«ذاكرة البطاقات» تقبل ٨ أزواج كحدّ أقصى ليتّسع لها الجوال — عندك " + clean.length + ".";
  }
  return "";
}
