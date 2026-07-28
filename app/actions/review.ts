"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { stripTags } from "@/lib/sanitize";

export interface ReviewState {
  ok: boolean;
  message?: string;
}

/**
 * تقييم الطالب لمعلّمه.
 *
 * الأهلية مفروضة في RLS أيضاً (0009): لا يقيّم إلا من أنجز درساً واحداً
 * على الأقل لهذا المعلّم — فلا تكفي المتابعة ولا مجرّد التسجيل. المتوسط
 * يُعاد حسابه بمشغّل على teachers، فلا نكتبه من هنا.
 */
export async function saveReview(
  _prev: ReviewState,
  formData: FormData
): Promise<ReviewState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "سجّل الدخول أولاً." };

  const { data: isTeacher } = await supabase
    .from("teachers")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (isTeacher) {
    return { ok: false, message: "حسابات المعلّمين لا تقيّم معلّمين آخرين." };
  }

  const teacherId = String(formData.get("teacherId") ?? "").trim();
  const teacherSlug = String(formData.get("teacherSlug") ?? "").trim();
  const rating = parseInt(String(formData.get("rating") ?? "0"), 10);
  const comment = stripTags(String(formData.get("comment") ?? "")).slice(0, 600);

  if (!teacherId) return { ok: false, message: "معلّم غير معروف." };
  if (!(rating >= 1 && rating <= 5)) {
    return { ok: false, message: "اختر تقييماً من ١ إلى ٥ نجوم." };
  }

  const { error } = await supabase
    .from("reviews")
    .upsert(
      {
        teacher_id: teacherId,
        student_id: user.id,
        rating,
        comment,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "teacher_id,student_id" }
    );

  if (error) {
    // 42501 = منعته RLS ⇒ لم يُنجز درساً لهذا المعلّم بعد
    return {
      ok: false,
      message:
        error.code === "42501"
          ? "التقييم متاح بعد إنجاز درس واحد على الأقل من دروس هذا المعلّم."
          : "تعذّر حفظ التقييم — حاول مجدداً.",
    };
  }

  if (teacherSlug) revalidatePath(`/teacher/${teacherSlug}`);
  revalidatePath("/");
  return { ok: true, message: "شكراً — سُجّل تقييمك." };
}

/** حذف تقييم الطالب لنفسه */
export async function deleteReview(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const teacherId = String(formData.get("teacherId") ?? "");
  const teacherSlug = String(formData.get("teacherSlug") ?? "");
  if (!teacherId) return;
  await supabase
    .from("reviews")
    .delete()
    .eq("teacher_id", teacherId)
    .eq("student_id", user.id);
  if (teacherSlug) revalidatePath(`/teacher/${teacherSlug}`);
  revalidatePath("/");
}
