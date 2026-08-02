import "server-only";

/**
 * عميل OpenRouter — خادمي بحت.
 *
 * المفتاح يُقرأ من متغيّر بيئة لا يبدأ بـ NEXT_PUBLIC، فلا يصل إلى
 * المتصفح إطلاقاً. لو وصل لسُرق خلال ساعات واستُنزف الرصيد.
 */

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-3.1-pro-preview";

/** النموذج استدلالي: رموز التفكير تُخصم من السقف، فنترك مساحة سخيّة */
const DEFAULT_MAX_TOKENS = 8000;
/**
 * أقصر من مهلة الدالّة على المستضيف (٦٠ ثانية) عمداً: لو تجاوزناها
 * قُتلت العملية من الخارج فيرى المعلّم عطلاً بلا رسالة، أمّا الإلغاء
 * من عندنا فيردّ جملةً عربية تقول ما حدث.
 */
const TIMEOUT_MS = 55_000;

export interface AiResult {
  ok: boolean;
  text?: string;
  tokens?: number;
  cost?: number;
  message?: string;
}

export function isAiConfigured(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

/**
 * ملفّ PDF يُرسَل إلى النموذج نفسه ليقرأ صفحاته.
 *
 * لا يُستعمل إلا حين يعجز الاستخراج النصّي — أي مع الملفّ الممسوح ضوئياً.
 * محرّك `native` يعني أن النموذج يعالج الصفحات بنفسه وتُحاسَب رموزها
 * كمُدخَل، وهو أغلى من النصّ بكثير؛ ولذلك يبقى الطريق الأول هو الافتراضي
 * والسقف الشهري يحدّ الخسارة في كل الأحوال.
 */
export interface PdfPart {
  filename: string;
  /** محتوى الملفّ بترميز base64، بلا بادئة data: */
  base64: string;
}

export async function chat({
  system,
  user,
  pdf,
  maxTokens = DEFAULT_MAX_TOKENS,
  temperature = 0.4,
}: {
  system: string;
  user: string;
  pdf?: PdfPart;
  maxTokens?: number;
  temperature?: number;
}): Promise<AiResult> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    return { ok: false, message: "ميزات الذكاء الاصطناعي غير مفعّلة على الخادم." };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        // يستخدمها OpenRouter في لوحة الإحصاءات
        "HTTP-Referer": "https://hissa.sbs",
        "X-Title": "Hissa Platform",
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL || DEFAULT_MODEL,
        max_tokens: maxTokens,
        temperature,
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content: pdf
              ? [
                  { type: "text", text: user },
                  {
                    type: "file",
                    file: {
                      filename: pdf.filename,
                      file_data: `data:application/pdf;base64,${pdf.base64}`,
                    },
                  },
                ]
              : user,
          },
        ],
        ...(pdf
          ? { plugins: [{ id: "file-parser", pdf: { engine: "native" } }] }
          : {}),
      }),
    });

    /**
     * الردّ ليس JSON دائماً: بوّابة وسيطة قد تردّ صفحة HTML عند 502 أو
     * عند تجاوز حجم الجسم. قراءة النصّ أولاً تمنع استثناءً يبتلع السبب.
     */
    const raw = await res.text();
    let data: {
      choices?: { message?: { content?: string }; finish_reason?: string }[];
      usage?: { total_tokens?: number; cost?: number };
      error?: { message?: string; code?: number };
    };
    try {
      data = JSON.parse(raw);
    } catch {
      data = {};
    }

    if (!res.ok || data.error) {
      const code = data.error?.code ?? res.status;
      const upstream = (data.error?.message ?? raw.slice(0, 200)).trim();

      /**
       * **سبب العطل يُقال، لا يُخفى.**
       * كانت كل الأخطاء عدا 402 و429 تُختصر في «تعذّر الاتصال… حاول
       * مجدداً»، فيعيد المعلّم المحاولة عشر مرّات والسبب مفتاحٌ منتهٍ أو
       * نموذجٌ لا يقرأ الملفات — وهي أعطال لا تُصلحها إعادةُ المحاولة.
       * والرسالة تخصّ المعلّم وحده (الأدوات كلّها خلف حساب معلّم) ولا
       * تحمل المفتاح ولا أي سرّ.
       */
      console.error("[openrouter]", res.status, code, upstream);

      const hint =
        code === 402
          ? "رصيد الذكاء الاصطناعي نفد — اشحن حساب OpenRouter."
          : code === 429
            ? "الخدمة مزدحمة الآن. أعد المحاولة بعد قليل."
            : code === 401 || code === 403
              ? "مفتاح OpenRouter غير صالح أو غير مصرّح — راجع إعداد الخادم."
              : code === 404
                ? "النموذج المحدّد غير متاح، أو لا يقرأ الملفات المرفقة."
                : code === 413
                  ? "الملفّ أكبر ممّا تقبله الخدمة — جرّب ملفاً أصغر."
                  : "تعذّر الاتصال بخدمة الذكاء الاصطناعي.";

      return {
        ok: false,
        message: upstream ? `${hint} (${code}: ${upstream.slice(0, 160)})` : hint,
      };
    }

    const text = data.choices?.[0]?.message?.content?.trim() ?? "";
    if (!text) {
      // يحدث حين يستهلك التفكير كامل السقف قبل كتابة الإجابة
      return {
        ok: false,
        message: "لم يُنتِج النموذج نتيجة — جرّب مجدداً أو قلّل حجم المحتوى.",
      };
    }

    return {
      ok: true,
      text,
      tokens: data.usage?.total_tokens ?? 0,
      cost: data.usage?.cost ?? 0,
    };
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    const why = e instanceof Error ? e.message : String(e);
    console.error("[openrouter] fetch failed:", why);
    return {
      ok: false,
      message: aborted
        ? "استغرقت العملية وقتاً طويلاً — جرّب ملفاً أقلّ صفحات."
        : `تعذّر الوصول إلى خدمة الذكاء الاصطناعي (${why.slice(0, 120)})`,
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * يستخرج JSON من ردّ النموذج.
 * النماذج تحيط JSON أحياناً بشرح أو بسياج ```json — فنلتقط أول كائن
 * أو مصفوفة متوازنة بدل الاعتماد على نظافة الردّ.
 */
export function extractJson<T>(raw: string): T | null {
  const cleaned = raw.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
  const start = cleaned.search(/[[{]/);
  if (start === -1) return null;

  const open = cleaned[start];
  const close = open === "[" ? "]" : "}";
  let depth = 0;
  let inStr = false;
  let esc = false;

  for (let i = start; i < cleaned.length; i++) {
    const c = cleaned[i];
    if (esc) {
      esc = false;
      continue;
    }
    if (c === "\\") {
      esc = true;
      continue;
    }
    if (c === '"') inStr = !inStr;
    if (inStr) continue;
    if (c === open) depth++;
    else if (c === close) {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(cleaned.slice(start, i + 1)) as T;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}
