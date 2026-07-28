/**
 * تطبيع النص العربي للبحث.
 *
 * البحث الحرفي يفشل في العربية لأسباب يومية: الطالب يكتب «احمد» والاسم
 * مخزَّن «أحمد»، أو «رياضيه» و«رياضية»، أو ينسخ نصاً مشكّلاً. التطبيع
 * يوحّد هذه الصور قبل المقارنة على الطرفين.
 */

/** التشكيل والتطويل — تُحذف تماماً */
const DIACRITICS = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/g;

/** الأرقام العربية-الهندية ← لاتينية، ليطابق «٥» الرقم 5 */
const ARABIC_DIGITS: Record<string, string> = {
  "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4",
  "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
  "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4",
  "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9",
};

export function normalizeArabic(input: string): string {
  if (!input) return "";
  return input
    .normalize("NFKD")
    .replace(DIACRITICS, "")
    // صور الألف كلها ← ا
    .replace(/[إأآٱا]/g, "ا")
    // الألف المقصورة ← ياء، والهمزات المتطرفة ← حرفها الأصلي
    .replace(/ى/g, "ي")
    .replace(/[ؤئء]/g, "ي")
    // التاء المربوطة ← هاء (رياضية = رياضيه)
    .replace(/ة/g, "ه")
    .replace(/[٠-٩۰-۹]/g, (d) => ARABIC_DIGITS[d] ?? d)
    // الرموز والفواصل ← مسافة، ثم ضغط المسافات
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .toLowerCase();
}

/**
 * هل يطابق النص كل كلمات الاستعلام؟
 * نطابق كل كلمة على حدة، فيجد «احمد رياضيات» المعلّم أحمد في مادة
 * الرياضيات حتى لو لم تتجاور الكلمتان في النص.
 */
export function matchesQuery(haystack: string, query: string): boolean {
  const q = normalizeArabic(query);
  if (!q) return true;
  const target = normalizeArabic(haystack);
  return q.split(" ").every((word) => target.includes(word));
}
