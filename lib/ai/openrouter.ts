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

/* ==================== توليد الصور ==================== */

/**
 * نموذج الصور.
 *
 * طلب المالك «gpt2» ولا وجود لهذا الاسم على OpenRouter. وأقرب ما يطابقه
 * — `openai/gpt-5.4-image-2` — **قِيس فوُجد غير صالح**: ثلاث دقائق للصورة
 * الواحدة و‎$0.226‎ لها. والثلاث دقائق وحدها تُسقط الميزة، فهي فوق مهلة
 * الدالّة على المستضيف مهما رفعناها.
 *
 * ونموذج Google أنجزها في **ثماني ثوانٍ** بثلث الكلفة. فهو الافتراضيّ،
 * ويُبدَّل بـ`OPENROUTER_IMAGE_MODEL` دون نشرٍ جديد إن أردنا تجربة غيره.
 */
const DEFAULT_IMAGE_MODEL = "google/gemini-3.1-flash-image";

/** توليد الصورة أبطأ من النصّ، والمهلة تبقى دون مهلة المستضيف */
const IMAGE_TIMEOUT_MS = 110_000;

export interface AiImageResult {
  ok: boolean;
  /** الصورة كـ data URL — تُرفع إلى الحاوية ثم يُخزَّن رابطها */
  dataUrl?: string;
  tokens?: number;
  cost?: number;
  message?: string;
}

/**
 * صورةٌ واحدة من وصفٍ نصّي.
 *
 * OpenRouter يعيد الصور في `message.images[].image_url.url` كـdata URL،
 * لا في `content` — فقراءة النصّ وحده تُرجع فراغاً وتبدو كفشلٍ بلا سبب.
 */
export async function image({
  prompt,
  size = "1024x1536",
}: {
  prompt: string;
  size?: string;
}): Promise<AiImageResult> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    return { ok: false, message: "ميزات الذكاء الاصطناعي غير مفعّلة على الخادم." };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), IMAGE_TIMEOUT_MS);

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://hissa.sbs",
        "X-Title": "Hissa Platform",
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_IMAGE_MODEL || DEFAULT_IMAGE_MODEL,
        modalities: ["image", "text"],
        messages: [{ role: "user", content: prompt }],
        // بعض المزوّدين يقرؤها من الجذر وبعضهم من `image_config`
        image_config: { size },
      }),
    });

    const raw = await res.text();
    let data: {
      choices?: {
        message?: {
          content?: string;
          images?: { image_url?: { url?: string } }[];
        };
      }[];
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
      console.error("[openrouter:image]", res.status, code, upstream);

      const hint =
        code === 402
          ? "رصيد الذكاء الاصطناعي نفد — اشحن حساب OpenRouter."
          : code === 429
            ? "الخدمة مزدحمة الآن. أعد المحاولة بعد قليل."
            : code === 401 || code === 403
              ? "مفتاح OpenRouter غير صالح أو غير مصرّح — راجع إعداد الخادم."
              : code === 404
                ? "نموذج الصور المحدّد غير متاح — راجع OPENROUTER_IMAGE_MODEL."
                : "تعذّر توليد الصورة.";
      return {
        ok: false,
        message: upstream ? `${hint} (${code}: ${upstream.slice(0, 160)})` : hint,
      };
    }

    const url = data.choices?.[0]?.message?.images?.[0]?.image_url?.url ?? "";
    if (!url.startsWith("data:image/")) {
      /**
       * يقع هذا حين يردّ النموذج بنصٍّ يعتذر بدل صورة — رفضٌ لمحتوى، أو
       * وصفٌ لم يفهمه. ونعرض اعتذاره: أنفع للمعلّم من «تعذّر التوليد».
       */
      const said = (data.choices?.[0]?.message?.content ?? "").trim();
      console.error("[openrouter:image] no image in reply:", said.slice(0, 200));
      return {
        ok: false,
        message: said
          ? `لم يُنتِج النموذج صورة: ${said.slice(0, 200)}`
          : "لم يُنتِج النموذج صورة — أعد المحاولة أو بدّل الموضوع.",
      };
    }

    return {
      ok: true,
      dataUrl: url,
      tokens: data.usage?.total_tokens ?? 0,
      cost: data.usage?.cost ?? 0,
    };
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    const why = e instanceof Error ? e.message : String(e);
    console.error("[openrouter:image] fetch failed:", why);
    return {
      ok: false,
      message: aborted
        ? "استغرق توليد الصورة وقتاً طويلاً — أعد المحاولة."
        : `تعذّر الوصول إلى خدمة توليد الصور (${why.slice(0, 120)})`,
    };
  } finally {
    clearTimeout(timer);
  }
}

/* ==================== توليد الصوت ==================== */

/**
 * نموذج قراءة النصّ.
 *
 * طلب المالك «google 3.1 flash tts» ولا وجود له على OpenRouter — نماذج
 * Google الصوتية هناك موسيقية (`lyria`) لا قارئة. والمتاح فعلاً هو
 * `openai/gpt-audio` وأخوه المصغَّر، وقِيس فقرأ العربية في خمس ثوانٍ
 * بأقلّ من سنتٍ واحد. يُبدَّل بـ`OPENROUTER_AUDIO_MODEL`.
 */
const DEFAULT_AUDIO_MODEL = "openai/gpt-audio-mini";

const AUDIO_TIMEOUT_MS = 110_000;

/** تردّد العيّنة الذي يعيده النموذج — يدخل ترويسة WAV */
const PCM_RATE = 24_000;

export interface AiAudioResult {
  ok: boolean;
  /** WAV جاهز للتشغيل */
  wav?: Buffer;
  seconds?: number;
  cost?: number;
  message?: string;
}

/**
 * يلفّ عيّنات PCM الخام بترويسة WAV.
 *
 * ضروريّ لا تجميليّ: النموذج **لا يعيد إلا `pcm16`** (طلبُ mp3 مع البثّ
 * يعود فارغاً)، والمتصفّحات لا تشغّل PCM خاماً في عنصر `<audio>`. وهي
 * أربعةٌ وأربعون بايتاً تُغني عن مكتبة ترميزٍ كاملة.
 */
function wavOf(pcm: Buffer): Buffer {
  const channels = 1;
  const bits = 16;
  const head = Buffer.alloc(44);
  head.write("RIFF", 0);
  head.writeUInt32LE(36 + pcm.length, 4);
  head.write("WAVE", 8);
  head.write("fmt ", 12);
  head.writeUInt32LE(16, 16);
  head.writeUInt16LE(1, 20); // PCM
  head.writeUInt16LE(channels, 22);
  head.writeUInt32LE(PCM_RATE, 24);
  head.writeUInt32LE((PCM_RATE * channels * bits) / 8, 28);
  head.writeUInt16LE((channels * bits) / 8, 32);
  head.writeUInt16LE(bits, 34);
  head.write("data", 36);
  head.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([head, pcm]);
}

/**
 * يقرأ النموذج نصّاً بصوتٍ عربيّ.
 *
 * **بالبثّ إلزاماً**: الخدمة ترفض إخراج الصوت بغيره صراحةً
 * («Audio output requires stream: true»)، فالطلب العاديّ يعود بخطأ ٤٠٠
 * لا بصوت.
 */
export async function speak({
  text,
  voice = "alloy",
}: {
  text: string;
  voice?: string;
}): Promise<AiAudioResult> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    return { ok: false, message: "ميزات الذكاء الاصطناعي غير مفعّلة على الخادم." };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AUDIO_TIMEOUT_MS);

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://hissa.sbs",
        "X-Title": "Hissa Platform",
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_AUDIO_MODEL || DEFAULT_AUDIO_MODEL,
        stream: true,
        modalities: ["text", "audio"],
        audio: { voice, format: "pcm16" },
        messages: [{ role: "user", content: text }],
      }),
    });

    if (!res.ok || !res.body) {
      const raw = await res.text().catch(() => "");
      console.error("[openrouter:audio]", res.status, raw.slice(0, 200));
      const hint =
        res.status === 402
          ? "رصيد الذكاء الاصطناعي نفد — اشحن حساب OpenRouter."
          : res.status === 429
            ? "الخدمة مزدحمة الآن. أعد المحاولة بعد قليل."
            : res.status === 401 || res.status === 403
              ? "مفتاح OpenRouter غير صالح أو غير مصرّح."
              : "تعذّر توليد الصوت.";
      return { ok: false, message: hint };
    }

    // البثّ يصل أسطراً `data: {...}`، وقطع الصوت base64 داخل `delta.audio.data`
    const parts: Buffer[] = [];
    let cost = 0;
    let carry = "";
    const decoder = new TextDecoder();

    for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
      carry += decoder.decode(chunk, { stream: true });
      const lines = carry.split("\n");
      // آخر سطر قد يكون نصفَ سطر — يُترك للدفعة التالية
      carry = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const payload = line.slice(6).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const j = JSON.parse(payload) as {
            choices?: { delta?: { audio?: { data?: string } } }[];
            usage?: { cost?: number };
          };
          const b64 = j.choices?.[0]?.delta?.audio?.data;
          if (b64) parts.push(Buffer.from(b64, "base64"));
          if (j.usage?.cost) cost = j.usage.cost;
        } catch {
          // سطرٌ غير مكتمل أو تعليق من البوّابة — يُتجاوز
        }
      }
    }

    const pcm = Buffer.concat(parts);
    if (pcm.length === 0) {
      return { ok: false, message: "لم يُنتِج النموذج صوتاً — أعد المحاولة." };
    }

    return {
      ok: true,
      wav: wavOf(pcm),
      seconds: Math.round(pcm.length / 2 / PCM_RATE),
      cost,
    };
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    const why = e instanceof Error ? e.message : String(e);
    console.error("[openrouter:audio] failed:", why);
    return {
      ok: false,
      message: aborted
        ? "استغرقت القراءة وقتاً طويلاً — جرّب درساً أقصر."
        : `تعذّر الوصول إلى خدمة الصوت (${why.slice(0, 120)})`,
    };
  } finally {
    clearTimeout(timer);
  }
}
