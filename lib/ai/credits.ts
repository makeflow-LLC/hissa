/**
 * أثمان أدوات الذكاء الاصطناعي بالكريدت.
 *
 * حلّ الرصيدُ محلّ السقف الشهري (`MONTHLY_LIMIT`) لثلاثة أسباب: السقف
 * كان يسوّي بين أداةٍ رخيصة وأخرى تكلّف أضعافها، ولا يستطيع أحدٌ زيادته
 * لمعلّمٍ بعينه، ويصفّر نفسه أوّل الشهر بلا قرار من أحد.
 *
 * **الثمن هنا للعرض، والخصم في القاعدة.** `spend_credits` في 0026 هي من
 * تخصم فعلاً وتتحقّق من الكفاية في جملة UPDATE واحدة؛ وما في هذا الملفّ
 * يُخبر المعلّم بالثمن قبل أن يضغط ويُمرَّر إلى الدالّة. لا تجعل الواجهة
 * وحدها حارساً على الرصيد.
 */

export type AiTool = "quiz" | "summary" | "format" | "design" | "poster" | "tts";

export const CREDIT_COST: Record<AiTool, number> = {
  summary: 1,
  format: 1,
  quiz: 1,
  tts: 1,
  design: 2,
  poster: 2,
};

/** رصيد المعلّم الجديد — يُمنح عند إنشاء الملفّ (`teachers.credits` default) */
export const STARTING_CREDITS = 40;

export const TOOL_LABEL: Record<AiTool, string> = {
  summary: "تلخيص الدرس",
  format: "تحسين التنسيق",
  quiz: "توليد الأسئلة",
  design: "تصميم درس كامل",
  poster: "بطاقة أو ملصق أو مخطّط",
  tts: "تحويل الدرس إلى صوت",
};

/** «٢ كريدت» بصيغة عربية سليمة */
export function creditWord(n: number): string {
  if (n === 1) return "كريدت واحد";
  if (n === 2) return "كريدتان";
  return `${n} كريدت`;
}

export const OUT_OF_CREDITS =
  "لا يكفي رصيدك من الكريدت. تواصل مع إدارة المنصّة لشحنه.";
