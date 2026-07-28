"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface QuizResult {
  ok: boolean;
  score?: number;
  total?: number;
  message?: string;
}

/**
 * حفظ محاولة الطالب في اختبار الدرس.
 *
 * **التصحيح يتم على الخادم**: العميل يرسل اختياراته فقط، ونقرأ الإجابات
 * الصحيحة من قاعدة البيانات. لو صحّحنا في المتصفح واكتفينا باستقبال
 * الدرجة، لأمكن لأي طالب أن يرسل درجة كاملة مباشرةً.
 */
export async function submitQuiz(
  lessonId: string,
  teacherSlug: string,
  chosen: Record<string, number>
): Promise<QuizResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "سجّل الدخول أولاً." };

  const { data: teacher } = await supabase
    .from("teachers")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (teacher) {
    return { ok: false, message: "حسابات المعلّمين لا تحلّ الاختبارات." };
  }

  const { data: questions } = await supabase
    .from("quiz_questions")
    .select("id, correct_index")
    .eq("lesson_id", lessonId)
    .order("position");

  const qs = (questions ?? []) as { id: string; correct_index: number }[];
  if (qs.length === 0) return { ok: false, message: "لا أسئلة في هذا الدرس." };

  const answers = qs.map((q) => {
    const picked = chosen[q.id];
    return {
      question_id: q.id,
      chosen: Number.isFinite(picked) ? picked : null,
      correct: picked === q.correct_index,
    };
  });
  const score = answers.filter((a) => a.correct).length;

  const { error } = await supabase.from("quiz_attempts").upsert(
    {
      lesson_id: lessonId,
      student_id: user.id,
      score,
      total: qs.length,
      answers,
      created_at: new Date().toISOString(),
    },
    { onConflict: "lesson_id,student_id" }
  );
  if (error) return { ok: false, message: "تعذّر حفظ نتيجتك — حاول مجدداً." };

  revalidatePath(`/teacher/${teacherSlug}/lesson/${lessonId}`);
  return { ok: true, score, total: qs.length };
}
