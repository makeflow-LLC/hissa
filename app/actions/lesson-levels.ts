"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { chat, extractJson, isAiConfigured } from "@/lib/ai/openrouter";
import { levelSystem } from "@/lib/ai/prompts";
import { spend, refund } from "@/lib/ai/spend";
import { sanitizeLessonHtml, stripTags } from "@/lib/sanitize";
import { isGeneratedLevel } from "@/lib/ai/levels";

const MAX_INPUT_CHARS = 14_000;

export interface LevelState {
  ok: boolean;
  message?: string;
  remaining?: number;
}

/**
 * توليد نسخةٍ أسهل أو أعمق من الدرس.
 *
 * والنسخة تُحفظ في `lesson_levels` لا في ملفّ: يبدّل الطالب مستواه من
 * صفحة الدرس نفسها، ويبقى تقدّمه واختباره على الدرس الواحد.
 */
export async function generateLevel(
  _prev: LevelState,
  formData: FormData
): Promise<LevelState> {
  if (!isAiConfigured())
    return { ok: false, message: "ميزات الذكاء الاصطناعي غير مفعّلة." };

  const lessonId = String(formData.get("lessonId") ?? "").trim();
  const levelRaw = String(formData.get("level") ?? "");
  if (!isGeneratedLevel(levelRaw))
    return { ok: false, message: "مستوى غير معروف." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "سجّل الدخول كمعلّم أولاً." };

  const { data: teacher } = await supabase
    .from("teachers")
    .select("id, subject, stages")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!teacher) return { ok: false, message: "هذه الميزة للمعلّمين فقط." };

  // الدرس درسُ المستدعي أو لا شيء
  const { data: lesson } = await supabase
    .from("lessons")
    .select("id, title, sections")
    .eq("id", lessonId)
    .eq("teacher_id", teacher.id)
    .maybeSingle();
  if (!lesson) return { ok: false, message: "الدرس غير موجود أو ليس من دروسك." };

  const sections = (Array.isArray(lesson.sections) ? lesson.sections : []) as Record<
    string,
    unknown
  >[];
  const source = sections
    .map((s) => {
      const body = s.html
        ? String(s.html)
        : Array.isArray(s.paragraphs)
          ? (s.paragraphs as unknown[]).map((p) => `<p>${String(p)}</p>`).join("")
          : "";
      return { heading: String(s.heading ?? ""), html: body };
    })
    .filter((s) => s.heading || stripTags(s.html).trim());

  if (source.length === 0)
    return { ok: false, message: "اكتب شرح الدرس أولاً ثم ولّد المستوى." };

  const paid = await spend(supabase, "level");
  if (!paid.ok) return { ok: false, message: paid.message };

  const res = await chat({
    system: levelSystem(
      {
        subject: teacher.subject,
        stages: (teacher.stages ?? []) as string[],
        lessonTitle: lesson.title,
      },
      levelRaw
    ),
    user: [
      `أقسام الدرس الأصلية (${source.length} أقسام) — أعِد كتابتها بنفس العدد والترتيب والعناوين:`,
      JSON.stringify(source).slice(0, MAX_INPUT_CHARS),
      "أعِد JSON فقط.",
    ].join("\n"),
    temperature: 0.4,
    maxTokens: 12_000,
  });

  if (!res.ok) {
    await refund(supabase, "level");
    return { ok: false, message: `${res.message} (أُعيد الكريدت إلى رصيدك)` };
  }

  const parsed = extractJson<unknown[]>(res.text ?? "");
  if (!Array.isArray(parsed)) {
    await refund(supabase, "level");
    return { ok: false, message: "تعذّرت قراءة النسخة المولَّدة — أعد المحاولة. (أُعيد الكريدت)" };
  }

  /**
   * مخرجات النموذج مُدخَلٌ غير موثوق: تُعقَّم بنفس معقّم شرح المعلّم.
   * وتُقصّ إلى عدد الأقسام الأصلي — نسخةٌ ناقصةٌ أو زائدةٌ تعني طالباً
   * يدرس درساً غير درس زملائه.
   */
  const clean = parsed
    .slice(0, source.length)
    .map((x, i) => {
      const o = (x ?? {}) as Record<string, unknown>;
      return {
        heading: stripTags(String(o.heading ?? source[i].heading)).trim().slice(0, 200),
        html: sanitizeLessonHtml(String(o.html ?? "")).slice(0, 20_000),
      };
    })
    .filter((s) => stripTags(s.html).trim());

  if (clean.length === 0) {
    await refund(supabase, "level");
    return { ok: false, message: "عادت النسخة فارغة — أعد المحاولة. (أُعيد الكريدت)" };
  }

  const { error } = await supabase
    .from("lesson_levels")
    .upsert(
      { lesson_id: lessonId, level: levelRaw, sections: clean },
      { onConflict: "lesson_id,level" }
    );
  if (error) {
    console.error("[levels] save failed:", error.message);
    await refund(supabase, "level");
    return { ok: false, message: "تعذّر حفظ النسخة. (أُعيد الكريدت)" };
  }

  revalidatePath(`/teacher/me/lessons/${lessonId}/levels`);
  return {
    ok: true,
    message: `جاهزة — ${clean.length} أقسام${clean.length < source.length ? " (أقلّ من الأصل، راجِعها)" : ""}.`,
    remaining: paid.remaining,
  };
}

export async function deleteLevel(
  lessonId: string,
  level: string
): Promise<{ ok: boolean }> {
  if (!isGeneratedLevel(level)) return { ok: false };
  const supabase = await createClient();
  const { data } = await supabase
    .from("lesson_levels")
    .delete()
    .eq("lesson_id", lessonId)
    .eq("level", level)
    .select("level");
  revalidatePath(`/teacher/me/lessons/${lessonId}/levels`);
  return { ok: Boolean(data && data.length > 0) };
}
