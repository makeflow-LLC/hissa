"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { stripTags } from "@/lib/sanitize";

export interface ActionResult {
  ok: boolean;
  message?: string;
}

const NEED_LOGIN: ActionResult = {
  ok: false,
  message: "سجّل الدخول أولاً للمتابعة.",
};

const TEACHER_ACCOUNT: ActionResult = {
  ok: false,
  message: "هذا الحساب حساب معلّم. لمتابعة المعلّمين كطالب استخدم بريداً آخر.",
};

/**
 * الحساب الواحد إمّا معلّم وإمّا طالب — لا يجمع الدورين.
 * كل إجراء طالب يتحقّق خادمياً من أن صاحب الجلسة لا يملك بروفايل معلّم،
 * فلا يكفي إخفاء الأزرار في الواجهة.
 */
async function isTeacherAccount(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("teachers")
    .select("id")
    .eq("owner_id", userId)
    .maybeSingle();
  return Boolean(data);
}

/** متابعة معلم أو إلغاء متابعته */
export async function toggleFollow(
  teacherId: string,
  teacherSlug: string,
  following: boolean
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NEED_LOGIN;
  if (await isTeacherAccount(supabase, user.id)) return TEACHER_ACCOUNT;

  const { error } = following
    ? await supabase
        .from("follows")
        .delete()
        .eq("student_id", user.id)
        .eq("teacher_id", teacherId)
    : await supabase
        .from("follows")
        .upsert(
          { student_id: user.id, teacher_id: teacherId },
          { onConflict: "student_id,teacher_id" }
        );

  if (error) return { ok: false, message: "تعذّر تحديث المتابعة." };

  revalidatePath(`/teacher/${teacherSlug}`);
  revalidatePath("/dashboard");
  return { ok: true, message: following ? "أُلغيت المتابعة." : "تتابع هذا المعلم الآن." };
}

/** تعليم درس كمنجز أو التراجع عن ذلك */
export async function toggleLessonComplete(
  lessonId: string,
  teacherSlug: string,
  completed: boolean
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NEED_LOGIN;
  if (await isTeacherAccount(supabase, user.id)) return TEACHER_ACCOUNT;

  const { error } = completed
    ? await supabase
        .from("lesson_progress")
        .delete()
        .eq("student_id", user.id)
        .eq("lesson_id", lessonId)
    : await supabase.from("lesson_progress").upsert(
        { student_id: user.id, lesson_id: lessonId, completed: true },
        { onConflict: "student_id,lesson_id" }
      );

  if (error) return { ok: false, message: "تعذّر حفظ التقدّم." };

  revalidatePath(`/teacher/${teacherSlug}`);
  revalidatePath(`/teacher/${teacherSlug}/lesson/${lessonId}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

/**
 * سؤال الطالب لمعلّم يتابعه.
 * الرسالة نص صِرف تُعرض في خيط المحادثة، وسياسة RLS من 0011 تفرض
 * أن يكون المرسِل طالباً متابعاً يكتب باسمه هو.
 */
export async function askTeacher(
  teacherId: string,
  teacherSlug: string,
  body: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NEED_LOGIN;
  if (await isTeacherAccount(supabase, user.id)) return TEACHER_ACCOUNT;

  const text = stripTags(body).slice(0, 1000);
  if (!text) return { ok: false, message: "اكتب سؤالك أولاً." };

  const { error } = await supabase.from("teacher_messages").insert({
    teacher_id: teacherId,
    student_id: user.id,
    sender: "student",
    body: text,
  });
  if (error) {
    return {
      ok: false,
      message:
        error.code === "42501"
          ? "تابع هذا المعلّم أولاً لتتمكّن من مراسلته."
          : "تعذّر إرسال سؤالك — حاول مجدداً.",
    };
  }

  revalidatePath("/dashboard");
  revalidatePath(`/teacher/${teacherSlug}`);
  return { ok: true, message: "أُرسل سؤالك — سيصل معلّمك." };
}
