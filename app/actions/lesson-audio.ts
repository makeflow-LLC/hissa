"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isAiConfigured, speak } from "@/lib/ai/openrouter";
import { spend, refund } from "@/lib/ai/spend";
import { stripTags } from "@/lib/sanitize";

/**
 * أقصى نصٍّ يُقرأ.
 *
 * الصوت يعود PCM خاماً بنحو **٢٫٧ ميغابايت للدقيقة**، وحدّ الملفّ في
 * الحاوية ٢٠ ميغابايت — فدرسٌ طويل يتجاوزه ويسقط الرفع بعد أن يكون
 * الصوت قد وُلِّد ودُفع ثمنه. والقصّ هنا يمنع ذلك ويُقال للمعلّم صراحةً.
 */
const MAX_CHARS = 6000;

export interface AudioState {
  ok: boolean;
  message?: string;
  audioUrl?: string;
  seconds?: number;
  remaining?: number;
}

export async function readLessonAloud(
  _prev: AudioState,
  formData: FormData
): Promise<AudioState> {
  if (!isAiConfigured())
    return { ok: false, message: "ميزات الذكاء الاصطناعي غير مفعّلة." };

  const lessonId = String(formData.get("lessonId") ?? "").trim();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "سجّل الدخول كمعلّم أولاً." };

  const { data: teacher } = await supabase
    .from("teachers")
    .select("id, stages")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!teacher) return { ok: false, message: "هذه الميزة للمعلّمين فقط." };

  // الدرس درسُ المستدعي أو لا شيء — التقييد بـ`teacher_id` لا بالمعرّف وحده
  const { data: lesson } = await supabase
    .from("lessons")
    .select("id, title, sections")
    .eq("id", lessonId)
    .eq("teacher_id", teacher.id)
    .maybeSingle();
  if (!lesson) return { ok: false, message: "الدرس غير موجود أو ليس من دروسك." };

  const sections = Array.isArray(lesson.sections) ? lesson.sections : [];
  const plain = sections
    .map((s) => {
      const o = s as Record<string, unknown>;
      const heading = String(o.heading ?? "");
      const inner = o.html
        ? String(o.html)
        : Array.isArray(o.paragraphs)
          ? (o.paragraphs as unknown[]).map(String).join(" ")
          : "";
      return `${heading}. ${stripTags(inner)}`;
    })
    .join("\n\n")
    .replace(/\s+/g, " ")
    .trim();

  if (!plain) return { ok: false, message: "لا شرح في هذا الدرس ليُقرأ." };

  const trimmed = plain.slice(0, MAX_CHARS);
  const cut = plain.length > MAX_CHARS;

  const paid = await spend(supabase, "tts");
  if (!paid.ok) return { ok: false, message: paid.message };

  const stage = ((teacher.stages ?? []) as string[]).join(" و");
  const res = await speak({
    text: [
      `اقرأ النصّ التالي بصوتٍ عربيّ فصيح واضح، بوتيرةٍ هادئة تناسب طالباً في المرحلة ${stage || "الدراسية"}.`,
      "اقرأ النصّ كما هو ولا تُضِف مقدّمةً ولا تعليقاً ولا خاتمة، ولا تقل شيئاً غير النصّ.",
      "",
      `عنوان الدرس: ${lesson.title}`,
      "",
      trimmed,
    ].join("\n"),
  });

  if (!res.ok || !res.wav) {
    await refund(supabase, "tts");
    return { ok: false, message: `${res.message} (أُعيد الكريدت إلى رصيدك)` };
  }

  const path = `${user.id}/audio/${crypto.randomUUID()}.wav`;
  const { error: upErr } = await supabase.storage
    .from("lesson-media")
    .upload(path, res.wav, { contentType: "audio/wav" });
  if (upErr) {
    console.error("[audio] upload failed:", upErr.message);
    await refund(supabase, "tts");
    return { ok: false, message: "تعذّر حفظ الملفّ الصوتي. (أُعيد الكريدت)" };
  }

  const audioUrl = supabase.storage.from("lesson-media").getPublicUrl(path)
    .data.publicUrl;

  await supabase
    .from("lessons")
    .update({ audio_url: audioUrl })
    .eq("id", lessonId)
    .eq("teacher_id", teacher.id);

  revalidatePath(`/teacher/me/lessons/${lessonId}`);
  return {
    ok: true,
    audioUrl,
    seconds: res.seconds,
    remaining: paid.remaining,
    message: cut
      ? `جاهز — لكن الدرس أطول من ${MAX_CHARS} حرف، فقُرئ أوّله فقط.`
      : "جاهز.",
  };
}

/** إزالة صوت الدرس — الرابط فقط؛ الملفّ يبقى في الحاوية بلا مرجع */
export async function clearLessonAudio(lessonId: string): Promise<{ ok: boolean }> {
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

  const { data } = await supabase
    .from("lessons")
    .update({ audio_url: null })
    .eq("id", lessonId)
    .eq("teacher_id", teacher.id)
    .select("id");

  revalidatePath(`/teacher/me/lessons/${lessonId}`);
  return { ok: Boolean(data && data.length > 0) };
}
