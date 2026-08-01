import type { ActivityItem } from "@/lib/activityKinds";

/** خلط قائمة — نسخة لا تمسّ الأصل */
export function shuffle<T>(list: T[]): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * ما تحتاجه كل لعبة من قشرة اللاعب.
 *
 * `onFinish` هي المخرج الوحيد: تُبلّغ القشرةَ بالنتيجة فتحفظها وتعرض
 * شاشة النهاية. اللعبة لا تعرف شيئاً عن قاعدة البيانات ولا عن الحفظ.
 */
export interface GameProps {
  items: ActivityItem[];
  onFinish: (score: number, total: number) => void;
}

/**
 * خلط حروف كلمة عربية مع ضمان أن تختلف عن أصلها.
 *
 * الكلمات القصيرة قد تعود إلى ترتيبها بالصدفة فيبدو السؤال محلولاً؛
 * نحاول مرّات ثم نقبل ما وصلنا إليه بدل الدوران بلا نهاية.
 */
export function scramble(word: string): string {
  const letters = [...word.replace(/\s+/g, "")];
  if (letters.length < 2) return word;
  for (let attempt = 0; attempt < 12; attempt++) {
    const s = shuffle(letters).join("");
    if (s !== letters.join("")) return s;
  }
  return [...letters].reverse().join("");
}

/** خيارات سؤال: الإجابة الصحيحة + مشتّتات من إجابات بقية العناصر */
export function buildChoices(
  items: ActivityItem[],
  index: number,
  count = 4
): { choices: string[]; correct: number } {
  const right = items[index].b;
  const pool = shuffle(
    items
      .filter((_, i) => i !== index)
      .map((i) => i.b)
      .filter((b) => b && b !== right)
  );
  const uniq: string[] = [];
  for (const p of pool) {
    if (!uniq.includes(p)) uniq.push(p);
    if (uniq.length >= count - 1) break;
  }
  const choices = shuffle([right, ...uniq]);
  return { choices, correct: choices.indexOf(right) };
}
