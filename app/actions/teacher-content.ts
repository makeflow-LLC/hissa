"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { sanitizeLessonHtml, stripTags } from "@/lib/sanitize";

/**
 * إجراءات إدارة محتوى المعلّم — تكتب في جداول units / lessons /
 * quiz_questions / live_sessions الحقيقية المملوكة للمستخدم الحالي.
 * كل إجراء يعيد التحقق من الملكية خادمياً (teacher_id يخص المستخدم)،
 * وسياسات RLS (owner_id = auth.uid()) تشكّل خط الدفاع الثاني.
 */

const LESSON_GRADIENTS = [
  "linear-gradient(135deg, #6366f1, #8b5cf6)",
  "linear-gradient(135deg, #ec4899, #f43f5e)",
  "linear-gradient(135deg, #10b981, #14b8a6)",
  "linear-gradient(135deg, #f59e0b, #f97316)",
  "linear-gradient(135deg, #3b82f6, #06b6d4)",
  "linear-gradient(135deg, #8b5cf6, #d946ef)",
];

function pickGradient(): string {
  return LESSON_GRADIENTS[Math.floor(Math.random() * LESSON_GRADIENTS.length)];
}

export interface ContentFormState {
  ok: boolean;
  message?: string;
}

/** المعلّم المملوك للمستخدم الحالي (id + slug) أو null. */
async function requireMyTeacher() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, teacher: null };
  const { data: teacher } = await supabase
    .from("teachers")
    .select("id, slug")
    .eq("owner_id", user.id)
    .maybeSingle();
  return { supabase, teacher: teacher as { id: string; slug: string } | null };
}

/* ------------------------------ الوحدات ------------------------------ */

/** إنشاء وحدة جديدة (تُلحق في نهاية الترتيب). */
export async function createUnit(
  _prev: ContentFormState,
  formData: FormData
): Promise<ContentFormState> {
  const { supabase, teacher } = await requireMyTeacher();
  if (!teacher) return { ok: false, message: "سجّل الدخول كمعلّم أولاً." };

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  if (!title) return { ok: false, message: "عنوان الوحدة مطلوب." };

  const { count } = await supabase
    .from("units")
    .select("id", { count: "exact", head: true })
    .eq("teacher_id", teacher.id);

  const { error } = await supabase.from("units").insert({
    teacher_id: teacher.id,
    title,
    description,
    position: count ?? 0,
  });
  if (error) return { ok: false, message: "تعذّر إنشاء الوحدة — حاول مجدداً." };

  revalidatePath("/teacher/me/content");
  revalidatePath(`/teacher/${teacher.slug}`);
  return { ok: true };
}

/** تعديل عنوان/وصف وحدة يملكها المعلّم. */
export async function renameUnit(formData: FormData): Promise<void> {
  const { supabase, teacher } = await requireMyTeacher();
  if (!teacher) return;
  const unitId = String(formData.get("unitId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  if (!unitId || !title) return;
  await supabase
    .from("units")
    .update({ title, description })
    .eq("id", unitId)
    .eq("teacher_id", teacher.id);
  revalidatePath("/teacher/me/content");
  revalidatePath(`/teacher/${teacher.slug}`);
}

/** حذف وحدة (تبقى دروسها بلا وحدة عبر on delete set null). */
export async function deleteUnit(formData: FormData): Promise<void> {
  const { supabase, teacher } = await requireMyTeacher();
  if (!teacher) return;
  const unitId = String(formData.get("unitId") ?? "");
  if (!unitId) return;
  await supabase.from("units").delete().eq("id", unitId).eq("teacher_id", teacher.id);
  revalidatePath("/teacher/me/content");
  revalidatePath(`/teacher/${teacher.slug}`);
}

/* ------------------------------ الدروس ------------------------------ */

interface SectionInput {
  heading: string;
  html: string;
}
interface QuizInput {
  prompt: string;
  options: string[];
  correct_index: number;
}

/** هل بقي في HTML المعقَّم محتوى فعلي (نص أو صورة أو جدول)؟ */
function htmlHasContent(html: string): boolean {
  if (/<(img|table|hr)\b/i.test(html)) return true;
  return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim().length > 0;
}

/**
 * يقرأ أقسام الشرح ويعقّمها. المحتوى يصل كـ HTML من محرّر المعلّم،
 * وهو مُدخَل غير موثوق يُعرض على متصفّحات الطلاب — فلا يُخزَّن أبداً
 * قبل المرور على sanitizeLessonHtml.
 */
function parseSections(raw: string): SectionInput[] {
  try {
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr
      .map((s) => {
        const o = s as Record<string, unknown>;
        return {
          heading: stripTags(String(o.heading ?? "")),
          html: sanitizeLessonHtml(String(o.html ?? "")),
        };
      })
      .filter((s) => s.heading || htmlHasContent(s.html));
  } catch {
    return [];
  }
}

function parseQuiz(raw: string): QuizInput[] {
  try {
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr
      .map((q) => {
        const o = q as Record<string, unknown>;
        const prompt = String(o.prompt ?? "").trim();
        const options = Array.isArray(o.options)
          ? (o.options as unknown[]).map((x) => String(x).trim())
          : [];
        const ci = Number(o.correct_index ?? 0);
        return {
          prompt,
          options: options.filter(Boolean),
          correct_index: Number.isFinite(ci) ? ci : 0,
        };
      })
      .filter((q) => q.prompt && q.options.length >= 2);
  } catch {
    return [];
  }
}

/** إنشاء أو تعديل درس مسجّل يملكه المعلّم، مع أقسام الشرح وأسئلة الاختبار. */
export async function saveLesson(
  _prev: ContentFormState,
  formData: FormData
): Promise<ContentFormState> {
  const { supabase, teacher } = await requireMyTeacher();
  if (!teacher) return { ok: false, message: "سجّل الدخول كمعلّم أولاً." };

  const lessonId = String(formData.get("lessonId") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const duration = String(formData.get("duration") ?? "").trim();
  const emoji = String(formData.get("emoji") ?? "").trim() || "📚";
  const videoUrl = String(formData.get("video_url") ?? "").trim() || null;
  const unitIdRaw = String(formData.get("unit_id") ?? "").trim();
  const unitId = unitIdRaw ? unitIdRaw : null;
  const status =
    String(formData.get("status") ?? "published") === "draft" ? "draft" : "published";
  const isFreePreview = formData.get("is_free_preview") === "on";
  const isRestricted = formData.get("is_restricted") === "on";
  const sections = parseSections(String(formData.get("sections") ?? "[]"));
  const quiz = parseQuiz(String(formData.get("quiz") ?? "[]"));

  if (!title) return { ok: false, message: "عنوان الدرس مطلوب." };

  // تحقّق من أن الوحدة (إن اختيرت) تخص المعلّم نفسه
  if (unitId) {
    const { data: u } = await supabase
      .from("units")
      .select("id")
      .eq("id", unitId)
      .eq("teacher_id", teacher.id)
      .maybeSingle();
    if (!u) return { ok: false, message: "الوحدة المختارة غير صالحة." };
  }

  const base = {
    title,
    description,
    duration,
    emoji,
    video_url: videoUrl,
    unit_id: unitId,
    status,
    sections,
    is_free_preview: isFreePreview,
    is_restricted: isRestricted,
  };

  let savedId = lessonId;

  if (lessonId) {
    // تعديل: نتأكّد من الملكية بتقييد teacher_id
    const { data: updated, error } = await supabase
      .from("lessons")
      .update(base)
      .eq("id", lessonId)
      .eq("teacher_id", teacher.id)
      .select("id")
      .maybeSingle();
    if (error || !updated) {
      return { ok: false, message: "تعذّر حفظ الدرس — حاول مجدداً." };
    }
  } else {
    // إنشاء: الموضع في نهاية دروس الوحدة (أو دروس المعلّم بلا وحدة)
    const posQuery = supabase
      .from("lessons")
      .select("id", { count: "exact", head: true })
      .eq("teacher_id", teacher.id);
    const { count } = unitId
      ? await posQuery.eq("unit_id", unitId)
      : await posQuery.is("unit_id", null);

    const { data: created, error } = await supabase
      .from("lessons")
      .insert({
        ...base,
        teacher_id: teacher.id,
        gradient: pickGradient(),
        position: count ?? 0,
      })
      .select("id")
      .single();
    if (error || !created) {
      return { ok: false, message: "تعذّر إنشاء الدرس — حاول مجدداً." };
    }
    savedId = created.id as string;
  }

  // عيّنة مجانية واحدة فقط لكل معلّم: نلغي العلم عن بقية الدروس
  if (isFreePreview && savedId) {
    await supabase
      .from("lessons")
      .update({ is_free_preview: false })
      .eq("teacher_id", teacher.id)
      .neq("id", savedId);
  }

  // أسئلة الاختبار: نستبدلها بالكامل (حذف ثم إدراج)
  await supabase.from("quiz_questions").delete().eq("lesson_id", savedId);
  if (quiz.length > 0) {
    await supabase.from("quiz_questions").insert(
      quiz.map((q, i) => ({
        lesson_id: savedId,
        prompt: q.prompt,
        options: q.options,
        correct_index: Math.min(q.correct_index, q.options.length - 1),
        position: i,
      }))
    );
  }

  revalidatePath("/teacher/me/content");
  revalidatePath(`/teacher/${teacher.slug}`);
  revalidatePath(`/teacher/${teacher.slug}/lesson/${savedId}`);
  return { ok: true };
}

/** حذف درس يملكه المعلّم. */
export async function deleteLesson(formData: FormData): Promise<void> {
  const { supabase, teacher } = await requireMyTeacher();
  if (!teacher) return;
  const lessonId = String(formData.get("lessonId") ?? "");
  if (!lessonId) return;
  await supabase
    .from("lessons")
    .delete()
    .eq("id", lessonId)
    .eq("teacher_id", teacher.id);
  revalidatePath("/teacher/me/content");
  revalidatePath(`/teacher/${teacher.slug}`);
}

/* --------------------------- الحصص المباشرة --------------------------- */

/** إنشاء أو تعديل حصة مباشرة يملكها المعلّم (مع التسعير). */
export async function saveLive(
  _prev: ContentFormState,
  formData: FormData
): Promise<ContentFormState> {
  const { supabase, teacher } = await requireMyTeacher();
  if (!teacher) return { ok: false, message: "سجّل الدخول كمعلّم أولاً." };

  const sessionId = String(formData.get("sessionId") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const schedule = String(formData.get("schedule") ?? "").trim();
  const duration = String(formData.get("duration") ?? "").trim();
  const emoji = String(formData.get("emoji") ?? "").trim() || "🔴";
  const seats = Math.max(
    0,
    Math.min(9999, parseInt(String(formData.get("seats_left") ?? "0"), 10) || 0)
  );
  const status =
    String(formData.get("status") ?? "published") === "draft" ? "draft" : "published";
  const isPaid = formData.get("is_paid") === "on";
  const price = isPaid
    ? Math.max(0, parseFloat(String(formData.get("price") ?? "0")) || 0)
    : 0;
  const currency = String(formData.get("currency") ?? "EGP").trim() || "EGP";

  if (!title) return { ok: false, message: "عنوان الحصة مطلوب." };

  const base = {
    title,
    description,
    schedule,
    duration,
    emoji,
    seats_left: seats,
    status,
    is_paid: isPaid,
    price,
    currency,
    is_restricted: formData.get("is_restricted") === "on",
  };

  if (sessionId) {
    const { data: updated, error } = await supabase
      .from("live_sessions")
      .update(base)
      .eq("id", sessionId)
      .eq("teacher_id", teacher.id)
      .select("id")
      .maybeSingle();
    if (error || !updated) {
      return { ok: false, message: "تعذّر حفظ الحصة — حاول مجدداً." };
    }
  } else {
    const { error } = await supabase.from("live_sessions").insert({
      ...base,
      teacher_id: teacher.id,
      gradient: pickGradient(),
    });
    if (error) return { ok: false, message: "تعذّر إنشاء الحصة — حاول مجدداً." };
  }

  revalidatePath("/teacher/me/content");
  revalidatePath(`/teacher/${teacher.slug}`);
  return { ok: true };
}

/** حذف حصة مباشرة يملكها المعلّم. */
export async function deleteLive(formData: FormData): Promise<void> {
  const { supabase, teacher } = await requireMyTeacher();
  if (!teacher) return;
  const sessionId = String(formData.get("sessionId") ?? "");
  if (!sessionId) return;
  await supabase
    .from("live_sessions")
    .delete()
    .eq("id", sessionId)
    .eq("teacher_id", teacher.id);
  revalidatePath("/teacher/me/content");
  revalidatePath(`/teacher/${teacher.slug}`);
}

/** توجيه بسيط (يُستخدم بعد الحفظ من نماذج العميل). */
export async function goToContent(): Promise<never> {
  redirect("/teacher/me/content");
}
