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
const TIMEOUT_MS = 90_000;

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

export async function chat({
  system,
  user,
  maxTokens = DEFAULT_MAX_TOKENS,
  temperature = 0.4,
}: {
  system: string;
  user: string;
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
          { role: "user", content: user },
        ],
      }),
    });

    const data = (await res.json()) as {
      choices?: { message?: { content?: string }; finish_reason?: string }[];
      usage?: { total_tokens?: number; cost?: number };
      error?: { message?: string; code?: number };
    };

    if (!res.ok || data.error) {
      const code = data.error?.code ?? res.status;
      return {
        ok: false,
        message:
          code === 402
            ? "رصيد الذكاء الاصطناعي نفد — راجع حساب المزوّد."
            : code === 429
              ? "الخدمة مزدحمة الآن. أعد المحاولة بعد قليل."
              : "تعذّر الاتصال بخدمة الذكاء الاصطناعي. حاول مجدداً.",
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
    return {
      ok: false,
      message: aborted
        ? "استغرقت العملية وقتاً طويلاً — جرّب محتوى أقصر."
        : "تعذّر الاتصال بخدمة الذكاء الاصطناعي.",
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
