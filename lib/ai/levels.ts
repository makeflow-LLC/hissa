/**
 * مستويات قراءة الدرس.
 *
 * ليست ملفّاً يُصدَّر كما في Diffit، بل نسخةٌ تُحفظ **داخل الدرس** فيبدّل
 * الطالب مستواه بنفسه — فالتمايز يتبع الطالب بدل أن يوزّع المعلّم
 * أوراقاً مختلفة، ويبقى التقدّم والاختبار على الدرس نفسه لا يتشتّت.
 */

export type ReadingLevel = "simple" | "standard" | "advanced";

export const LEVEL_LABEL: Record<ReadingLevel, string> = {
  simple: "مبسّط",
  standard: "الأصلي",
  advanced: "موسّع",
};

export const LEVEL_ICON: Record<ReadingLevel, string> = {
  simple: "🌱",
  standard: "📖",
  advanced: "🌳",
};

export const LEVEL_ABOUT: Record<ReadingLevel, string> = {
  simple:
    "جُمَل أقصر ومفردات أسهل وأمثلة محسوسة — لمن يقرأ ببطء أو يتعثّر في المصطلحات.",
  standard: "الدرس كما كتبتَه، بلا تغيير.",
  advanced:
    "تعليلٌ أعمق ومصطلحات أدقّ وامتدادٌ لما بعد المنهج — لمن أتقن وبقي عنده وقت.",
};

/** المستويان المولَّدان — `standard` هو الدرس نفسه فلا يُولَّد */
export const GENERATED_LEVELS: Exclude<ReadingLevel, "standard">[] = [
  "simple",
  "advanced",
];

export function isGeneratedLevel(v: unknown): v is "simple" | "advanced" {
  return v === "simple" || v === "advanced";
}
