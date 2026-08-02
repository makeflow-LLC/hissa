import type { QuestionKind } from "@/lib/data/types";

/** سؤال داخل قالب — نفس شكل ما يرسله محرّر الأسئلة */
export interface TemplateQuestion {
  kind: QuestionKind;
  prompt: string;
  options: string[];
  correct_index: number | null;
  correct_bool: boolean | null;
  model_answer: string;
  points: number;
}

export interface ExamTemplate {
  id: string;
  name: string;
  description: string;
  questions: TemplateQuestion[];
  /** قالب من المنصة لا يُحذف، بخلاف قوالب المعلّم */
  builtin?: boolean;
}

/**
 * القالب هيكلٌ لا مفتاح إجابة، فالإجابة الصحيحة تبدأ **غير محدّدة**.
 * كانت `correct_index: 0` و`correct_bool: true`، فيرث المعلّم مفتاحاً
 * لم يضعه: خياراً أوّلَ صحيحاً وجملةً صحيحة — ثم يُنشر الاختبار بمفتاحٍ
 * لا يعلم به أحد.
 */
function mcq(points: number, choices = 4): TemplateQuestion {
  return {
    kind: "mcq",
    prompt: "",
    options: Array.from({ length: choices }, () => ""),
    correct_index: null,
    correct_bool: null,
    model_answer: "",
    points,
  };
}

function tf(points: number): TemplateQuestion {
  return {
    kind: "truefalse",
    prompt: "",
    options: [],
    correct_index: null,
    correct_bool: null,
    model_answer: "",
    points,
  };
}

function text(points: number): TemplateQuestion {
  return {
    kind: "text",
    prompt: "",
    options: [],
    correct_index: null,
    correct_bool: null,
    model_answer: "",
    points,
  };
}

const repeat = (n: number, make: () => TemplateQuestion) =>
  Array.from({ length: n }, make);

/**
 * قوالب المنصة الجاهزة.
 *
 * **بنيةٌ لا محتوى**: عدد الأسئلة وأنواعها وعلاماتها جاهزة، ونصّ كل سؤال
 * يتركه القالب فارغاً. اختلاف المواد والمراحل يجعل أي سؤال «جاهز» إمّا
 * ساذجاً أو في غير موضعه؛ أمّا ما يضيع وقت المعلّم فعلاً فهو ضبط النوع
 * والعلامة لكل سؤال على حدة — وهذا ما يوفّره القالب.
 */
export const BUILTIN_TEMPLATES: ExamTemplate[] = [
  {
    id: "builtin:quick-mcq",
    name: "اختبار قصير — ٥ اختيار من متعدّد",
    description: "٥ أسئلة × علامتان = ١٠ علامات · يُصحَّح آلياً بالكامل",
    builtin: true,
    questions: repeat(5, () => mcq(2)),
  },
  {
    id: "builtin:truefalse",
    name: "صح وخطأ سريع — ١٠ أسئلة",
    description: "١٠ أسئلة × علامة = ١٠ علامات · يُصحَّح آلياً بالكامل",
    builtin: true,
    questions: repeat(10, () => tf(1)),
  },
  {
    id: "builtin:unit-mixed",
    name: "اختبار وحدة — مختلط",
    description: "٦ اختيار + ٤ صح وخطأ + سؤالان نصّيان = ٢٦ علامة",
    builtin: true,
    questions: [
      ...repeat(6, () => mcq(2)),
      ...repeat(4, () => tf(1)),
      ...repeat(2, () => text(5)),
    ],
  },
  {
    id: "builtin:essay",
    name: "اختبار مقالي — ٤ أسئلة «علّل واذكر»",
    description: "٤ أسئلة نصّية × ٥ = ٢٠ علامة · تصحيحك أنت",
    builtin: true,
    questions: repeat(4, () => text(5)),
  },
  {
    id: "builtin:final",
    name: "اختبار نهاية فصل — ٢٠ سؤالاً",
    description: "١٠ اختيار + ٦ صح وخطأ + ٤ نصّية = ٤٦ علامة",
    builtin: true,
    questions: [
      ...repeat(10, () => mcq(2)),
      ...repeat(6, () => tf(1)),
      ...repeat(4, () => text(5)),
    ],
  },
];

/** مجموع علامات قالب — للعرض في قائمة الاختيار */
export function templatePoints(t: ExamTemplate): number {
  return t.questions.reduce((n, q) => n + Number(q.points || 0), 0);
}
