"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { chat, extractJson, image, isAiConfigured } from "@/lib/ai/openrouter";
import { posterImagePrompt, posterOptionsSystem } from "@/lib/ai/prompts";
import { spend, refund } from "@/lib/ai/spend";
import { CREDIT_COST } from "@/lib/ai/credits";
import { stripTags } from "@/lib/sanitize";
import {
  POSTER_SIZE,
  isPosterKind,
  type PosterKind,
  type PosterOption,
} from "@/lib/ai/poster";

/** أقصى نصّ درسٍ يُرسل للتحليل — حمايةٌ من الكلفة ومن تجاوز السياق */
const MAX_INPUT_CHARS = 12_000;

export interface PosterOptionsState {
  ok: boolean;
  message?: string;
  options?: PosterOption[];
  lessonTitle?: string;
}

export interface PosterState {
  ok: boolean;
  message?: string;
  imageUrl?: string;
  remaining?: number;
}

/**
 * يجمع سياق الدرس بعد التحقّق من أنه **درس المستدعي هو**.
 * تمرير معرّف درس غريب لا يفتح شيئاً: الاستعلام مقيَّدٌ بـ`teacher_id`.
 */
async function loadLesson(lessonId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "سجّل الدخول كمعلّم أولاً." as string };

  const { data: teacher } = await supabase
    .from("teachers")
    .select("id, name, subject, stages, credits")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!teacher) return { error: "هذه الميزة للمعلّمين فقط." };

  const { data: lesson } = await supabase
    .from("lessons")
    .select("id, title, description, sections")
    .eq("id", lessonId)
    .eq("teacher_id", teacher.id)
    .maybeSingle();
  if (!lesson) return { error: "الدرس غير موجود أو ليس من دروسك." };

  const sections = Array.isArray(lesson.sections) ? lesson.sections : [];
  const body = sections
    .map((s) => {
      const o = s as Record<string, unknown>;
      const heading = String(o.heading ?? "");
      const inner = o.html
        ? String(o.html)
        : Array.isArray(o.paragraphs)
          ? (o.paragraphs as unknown[]).map(String).join(" ")
          : "";
      return `${heading}\n${stripTags(inner)}`;
    })
    .join("\n\n")
    .slice(0, MAX_INPUT_CHARS);

  return {
    supabase,
    teacher: teacher as {
      id: string;
      name: string;
      subject: string;
      stages: string[] | null;
      credits: number;
    },
    lesson: lesson as { id: string; title: string; description: string },
    body,
    userId: user.id,
  };
}

/* ==================== ١) ماذا يصلح في هذا الدرس؟ ==================== */

/**
 * يقرأ النموذج الدرس ويقترح مواضيع يصلح كلٌّ منها لتصميمٍ قائم بذاته.
 *
 * **بلا ثمن** عن قصد: درسٌ عن النبات يحتمل ملصقاً عن أجزائه أو عن الخلية
 * أو عن البناء الضوئي، وإجبار المعلّم على الدفع ليرى الخيارات يجعله
 * يدفع مرّتين للوصول إلى ما يريد. لكنّه مشروطٌ برصيدٍ يكفي للتوليد —
 * فمن لا يستطيع الشراء لا يفتح نداءً على النموذج بلا حدّ.
 */
export async function posterOptions(
  _prev: PosterOptionsState,
  formData: FormData
): Promise<PosterOptionsState> {
  if (!isAiConfigured())
    return { ok: false, message: "ميزات الذكاء الاصطناعي غير مفعّلة." };

  const lessonId = String(formData.get("lessonId") ?? "").trim();
  const kindRaw = String(formData.get("kind") ?? "poster");
  const kind: PosterKind = isPosterKind(kindRaw) ? kindRaw : "poster";

  const ctx = await loadLesson(lessonId);
  if ("error" in ctx) return { ok: false, message: ctx.error };
  if (!ctx.body.trim())
    return { ok: false, message: "اكتب شرح الدرس أولاً — لا محتوى لتحليله." };

  if (ctx.teacher.credits < CREDIT_COST.poster)
    return {
      ok: false,
      message: `تحتاج ${CREDIT_COST.poster} كريدت للتوليد، ورصيدك ${ctx.teacher.credits}. تواصل مع الإدارة لشحنه.`,
    };

  const res = await chat({
    system: posterOptionsSystem(
      {
        subject: ctx.teacher.subject,
        stages: (ctx.teacher.stages ?? []) as string[],
        lessonTitle: ctx.lesson.title,
      },
      kind
    ),
    user: `نصّ الدرس:\n---\n${ctx.body}\n---\nاستخرج المواضيع الآن وأعِد JSON فقط.`,
    temperature: 0.5,
  });
  if (!res.ok) return { ok: false, message: res.message };

  const parsed = extractJson<unknown[]>(res.text ?? "");
  if (!Array.isArray(parsed))
    return { ok: false, message: "تعذّرت قراءة المواضيع — أعد المحاولة." };

  // مخرجات النموذج مُدخَلٌ غير موثوق: تُنزع وسومها وتُقصّ حقلاً حقلاً
  const options = parsed
    .slice(0, 8)
    .map((x) => {
      const o = (x ?? {}) as Record<string, unknown>;
      return {
        title: stripTags(String(o.title ?? "")).trim().slice(0, 120),
        blurb: stripTags(String(o.blurb ?? "")).trim().slice(0, 400),
        visual: stripTags(String(o.visual ?? "")).trim().slice(0, 40),
      };
    })
    .filter((o) => o.title && o.blurb);

  if (options.length === 0)
    return { ok: false, message: "لم يُنتِج النموذج مواضيع صالحة — أعد المحاولة." };

  return { ok: true, options, lessonTitle: ctx.lesson.title };
}

/* ==================== ٢) ارسمها ==================== */

export async function generatePoster(
  _prev: PosterState,
  formData: FormData
): Promise<PosterState> {
  if (!isAiConfigured())
    return { ok: false, message: "ميزات الذكاء الاصطناعي غير مفعّلة." };

  const lessonId = String(formData.get("lessonId") ?? "").trim();
  const kindRaw = String(formData.get("kind") ?? "poster");
  const kind: PosterKind = isPosterKind(kindRaw) ? kindRaw : "poster";
  const topic = stripTags(String(formData.get("topic") ?? "")).trim().slice(0, 200);
  const blurb = stripTags(String(formData.get("blurb") ?? "")).trim().slice(0, 500);
  const visual = stripTags(String(formData.get("visual") ?? "")).trim().slice(0, 40);
  const grade = stripTags(String(formData.get("grade") ?? "")).trim().slice(0, 80);

  if (!topic) return { ok: false, message: "اختر موضوعاً أولاً." };

  const ctx = await loadLesson(lessonId);
  if ("error" in ctx) return { ok: false, message: ctx.error };

  /**
   * الخصم **قبل النداء**: بعده يعني أن قطع الطلب يستدعي النموذج بلا
   * حساب. وكل ما يمكن التحقّق منه — الملكية والمُدخَلات — تحقّقنا منه
   * فوقه، فلا يُخصم إلا وقد قارب الفشل أن يكون من الخدمة وحدها. وذاك
   * يُردّ (`refund`).
   */
  const paid = await spend(ctx.supabase, "poster");
  if (!paid.ok) return { ok: false, message: paid.message };

  const res = await image({
    prompt: posterImagePrompt({
      kind,
      topic,
      blurb,
      visual,
      subject: ctx.teacher.subject,
      stage: (ctx.teacher.stages ?? []).join(" و"),
      grade,
      lessonTitle: ctx.lesson.title,
      teacherName: ctx.teacher.name,
    }),
    size: POSTER_SIZE[kind],
  });

  if (!res.ok || !res.dataUrl) {
    await refund(ctx.supabase, "poster");
    return { ok: false, message: `${res.message} (أُعيد الكريدت إلى رصيدك)` };
  }

  /**
   * تُرفع الصورة إلى مجلّد المعلّم في `lesson-media` — نفس مسار صور
   * الدروس وسياستها (0007): أول جزءٍ من المسار هو `auth.uid()`، فلا يكتب
   * معلّمٌ في مجلّد غيره. ولا نخزّن الـdata URL في القاعدة: صورةٌ بحجم
   * ميغابايت داخل صفٍّ تُقرأ مع كل استعلام قائمة.
   */
  const match = /^data:(image\/[a-z+]+);base64,(.+)$/i.exec(res.dataUrl);
  if (!match) {
    await refund(ctx.supabase, "poster");
    return { ok: false, message: "وصلت الصورة بصيغة غير مفهومة. (أُعيد الكريدت)" };
  }
  const [, mime, b64] = match;
  const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
  const path = `${ctx.userId}/posters/${crypto.randomUUID()}.${ext}`;

  const { error: upErr } = await ctx.supabase.storage
    .from("lesson-media")
    .upload(path, Buffer.from(b64, "base64"), { contentType: mime });
  if (upErr) {
    console.error("[poster] upload failed:", upErr.message);
    await refund(ctx.supabase, "poster");
    return { ok: false, message: "تعذّر حفظ الصورة. (أُعيد الكريدت إلى رصيدك)" };
  }

  const imageUrl = ctx.supabase.storage.from("lesson-media").getPublicUrl(path)
    .data.publicUrl;

  await ctx.supabase.from("lesson_posters").insert({
    teacher_id: ctx.teacher.id,
    lesson_id: ctx.lesson.id,
    kind,
    title: topic,
    topic: blurb,
    image_url: imageUrl,
  });

  revalidatePath(`/teacher/me/lessons/${lessonId}/visuals`);
  return { ok: true, imageUrl, remaining: paid.remaining };
}

export async function deletePoster(id: string): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const { data: teacher } = await supabase
    .from("teachers")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!teacher) return { ok: false };

  // `select` بعد الحذف: بدونه يُعلَن النجاح ولو لم يُمسّ صفّ
  const { data } = await supabase
    .from("lesson_posters")
    .delete()
    .eq("id", id)
    .eq("teacher_id", teacher.id)
    .select("id");

  revalidatePath("/teacher/me/lessons");
  return { ok: Boolean(data && data.length > 0) };
}
