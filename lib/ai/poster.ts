/**
 * أنواع المواد المرئية المولَّدة من الدرس.
 *
 * هنا لا في `prompts.ts`: ذاك `server-only` فلا تستطيع الواجهة استيراد
 * تسمياته، وتكرارُ الأسماء في الطرفين يعني أن يتغيّر أحدهما وحده يوماً.
 */

export type PosterKind = "poster" | "card" | "diagram";

export const POSTER_LABEL: Record<PosterKind, string> = {
  poster: "ملصق تعليمي",
  card: "بطاقة تعليمية",
  diagram: "مخطّط توضيحي",
};

export const POSTER_ICON: Record<PosterKind, string> = {
  poster: "🖼️",
  card: "🃏",
  diagram: "🗺️",
};

export const POSTER_ABOUT: Record<PosterKind, string> = {
  poster: "رأسيّ يُعلَّق على جدار الصفّ ويُقرأ من بعيد — فكرةٌ واحدة كبيرة.",
  card: "مربّعة يحملها الطالب أو يراها على جوّاله — مراجعةٌ سريعة.",
  diagram: "يشرح البنية أو التسلسل بالرسم لا بالسرد — أجزاء أو خطوات أو دورة.",
};

/** مقاس الصورة لكل نوع — البطاقة مربّعة والملصق رأسيّ والمخطّط عريض */
export const POSTER_SIZE: Record<PosterKind, string> = {
  poster: "1024x1536",
  card: "1024x1024",
  diagram: "1536x1024",
};

export interface PosterOption {
  title: string;
  blurb: string;
  visual: string;
}

export const POSTER_KINDS: PosterKind[] = ["poster", "card", "diagram"];

export function isPosterKind(v: unknown): v is PosterKind {
  return v === "poster" || v === "card" || v === "diagram";
}
