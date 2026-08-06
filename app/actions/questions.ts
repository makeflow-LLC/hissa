"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { stripTags } from "@/lib/sanitize";

export interface QuestionState {
  ok: boolean;
  message?: string;
}

/**
 * الطالب يسأل تحت الدرس.
 *
 * والجواب يُنشر لمن يأتي بعده — وهذا هو الفرق كلّه عن الرسالة الخاصّة:
 * السؤال الواحد يُجاب مرّةً واحدة بدل عشرين.
 */
export async function askQuestion(
  _prev: QuestionState,
  formData: FormData
): Promise<QuestionState> {
  const lessonId = String(formData.get("lessonId") ?? "").trim();
  const body = stripTags(String(formData.get("body") ?? "")).trim().slice(0, 1000);
  if (!body) return { ok: false, message: "اكتب سؤالك أولاً." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "سجّل الدخول لتسأل." };

  // معلّم الدرس يُقرأ من الخادم لا يُرسَل من المتصفّح
  const { data: teacherId, error: ownerErr } = await supabase.rpc("lesson_owner", {
    l_id: lessonId,
  });
  if (ownerErr || !teacherId)
    return { ok: false, message: "الدرس غير موجود." };

  const { error } = await supabase.from("lesson_questions").insert({
    lesson_id: lessonId,
    teacher_id: teacherId,
    student_id: user.id,
    body,
  });
  if (error) {
    console.error("[questions] ask failed:", error.message);
    return {
      ok: false,
      message: "لا يمكنك السؤال هنا — يجب أن يقبلك المعلّم في صفّه أولاً.",
    };
  }

  revalidatePath("/teacher");
  return { ok: true, message: "وصل سؤالك. سيظهر الجواب هنا." };
}

/** المعلّم يجيب — الجواب يظهر لكل طلابه تحت الدرس */
export async function answerQuestion(
  _prev: QuestionState,
  formData: FormData
): Promise<QuestionState> {
  const id = String(formData.get("questionId") ?? "").trim();
  const answer = stripTags(String(formData.get("answer") ?? "")).trim().slice(0, 4000);
  if (!answer) return { ok: false, message: "اكتب الجواب أولاً." };

  const supabase = await createClient();
  // الملكية تفرضها السياسة؛ و`select` يكشف إن لم يُمسّ صفّ
  const { data, error } = await supabase
    .from("lesson_questions")
    .update({ answer, answered_at: new Date().toISOString() })
    .eq("id", id)
    .select("id");
  if (error || !data || data.length === 0)
    return { ok: false, message: "تعذّر حفظ الجواب — هل السؤال من أسئلة دروسك؟" };

  revalidatePath("/teacher/me/questions");
  return { ok: true, message: "نُشر الجواب." };
}

/** إخفاء سؤال لا يصلح للنشر — دون حذفه */
export async function setQuestionHidden(id: string, hidden: boolean): Promise<void> {
  const supabase = await createClient();
  await supabase.from("lesson_questions").update({ hidden }).eq("id", id);
  revalidatePath("/teacher/me/questions");
}

export async function deleteQuestion(id: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from("lesson_questions").delete().eq("id", id);
  revalidatePath("/teacher/me/questions");
}

/**
 * «عندي نفس السؤال».
 *
 * يرفع السؤال في ترتيب المعلّم بدل أن يكتبه الطالب من جديد — فيُقاس
 * إلحاحه بعدد من ينتظرونه لا بترتيب وصوله.
 */
export async function toggleQuestionVote(id: string): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const { data: existing } = await supabase
    .from("question_votes")
    .select("question_id")
    .eq("question_id", id)
    .eq("student_id", user.id)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("question_votes")
      .delete()
      .eq("question_id", id)
      .eq("student_id", user.id);
  } else {
    await supabase
      .from("question_votes")
      .insert({ question_id: id, student_id: user.id });
  }
  return { ok: true };
}
