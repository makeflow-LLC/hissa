"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * سلّم التباعد بالأيام.
 *
 * ليست أرقاماً اعتباطية: التباعد المتزايد هو المبدأ الوحيد في علم التعلّم
 * الذي لا خلاف على أثره — تُستدعى المعلومة قُبيل نسيانها، فيطول أثرها في
 * كل مرّة. والمحطّة الأخيرة تتكرّر بلا نهاية بدل أن يسقط الدرس.
 */
const LADDER = [3, 7, 21, 60] as const;

export interface ReviewState {
  ok: boolean;
  message?: string;
  score?: number;
  total?: number;
}

function nextDue(stage: number): { stage: number; due: string } {
  const next = Math.min(stage, LADDER.length - 1);
  const days = LADDER[next];
  const d = new Date();
  d.setDate(d.getDate() + days);
  return { stage: Math.min(stage + 1, LADDER.length - 1), due: d.toISOString() };
}

/**
 * يُجدوَل الدرس للمراجعة أوّل ما يُنهيه الطالب.
 *
 * تُستدعى من `toggleLessonComplete`، ولا تُنشئ صفّاً إن وُجد: إعادة تعليم
 * الدرس منجزاً لا ينبغي أن تعيد عدّاد المراجعة إلى الصفر.
 */
export async function scheduleReview(lessonId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: existing } = await supabase
    .from("lesson_reviews")
    .select("lesson_id")
    .eq("student_id", user.id)
    .eq("lesson_id", lessonId)
    .maybeSingle();
  if (existing) return;

  const first = new Date();
  first.setDate(first.getDate() + LADDER[0]);
  await supabase.from("lesson_reviews").insert({
    student_id: user.id,
    lesson_id: lessonId,
    stage: 0,
    due_at: first.toISOString(),
  });
}

/** يُلغى الجدول حين يُلغي الطالب إنجاز الدرس */
export async function unscheduleReview(lessonId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from("lesson_reviews")
    .delete()
    .eq("student_id", user.id)
    .eq("lesson_id", lessonId);
}

/**
 * إنهاء جلسة مراجعة.
 *
 * **التصحيح في الخادم**: الواجهة ترسل اختياراتها فقط، ونقرأ نحن
 * `correct_index` — كأيّ اختبار. ونتيجةٌ ضعيفة تُنزل الدرس درجةً في
 * السلّم فيعود أقرب: المراجعة التي فشلت يجب أن تتكرّر أسرع لا أبطأ.
 */
export async function finishReview(
  _prev: ReviewState,
  formData: FormData
): Promise<ReviewState> {
  const lessonId = String(formData.get("lessonId") ?? "").trim();
  let choices: Record<string, number> = {};
  try {
    choices = JSON.parse(String(formData.get("choices") ?? "{}"));
  } catch {
    choices = {};
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "سجّل الدخول أولاً." };

  const { data: row } = await supabase
    .from("lesson_reviews")
    .select("stage")
    .eq("student_id", user.id)
    .eq("lesson_id", lessonId)
    .maybeSingle();
  if (!row) return { ok: false, message: "هذا الدرس ليس في قائمة مراجعتك." };

  const { data: questions } = await supabase
    .from("quiz_questions")
    .select("id, correct_index")
    .eq("lesson_id", lessonId);

  const qs = (questions ?? []) as { id: string; correct_index: number }[];
  const asked = qs.filter((q) => choices[q.id] !== undefined);
  const score = asked.filter((q) => choices[q.id] === q.correct_index).length;
  const total = asked.length;

  /**
   * أقلّ من النصف = تراجعٌ درجةً في السلّم لا تقدّم. وبلا أسئلة أصلاً
   * نعدّها مراجعةً ناجحة: الطالب أعاد قراءة الدرس، وهو المقصود.
   */
  const passed = total === 0 || score * 2 >= total;
  const current = Number(row.stage ?? 0);
  const { stage, due } = passed
    ? nextDue(current)
    : {
        stage: Math.max(0, current - 1),
        due: (() => {
          const d = new Date();
          d.setDate(d.getDate() + 1);
          return d.toISOString();
        })(),
      };

  await supabase
    .from("lesson_reviews")
    .update({
      stage,
      due_at: due,
      last_result: total === 0 ? null : Math.round((score / Math.max(total, 1)) * 100),
      reviewed_at: new Date().toISOString(),
    })
    .eq("student_id", user.id)
    .eq("lesson_id", lessonId);

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/review");
  return { ok: true, score, total };
}
