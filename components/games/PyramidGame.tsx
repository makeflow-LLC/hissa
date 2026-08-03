"use client";

import { useMemo, useState } from "react";
import { buildChoices, scramble, shuffle, type GameProps } from "@/components/games/shared";
import { useGameSound } from "@/components/games/useGameSound";
import { normalizeArabic } from "@/lib/arabic";

/** أقصى ارتفاع للهرم — أكثر من ذلك يطول اللعب ويضيق العرض على الجوال */
const MAX_LEVELS = 8;
const LIVES = 3;

type Challenge = "choice" | "truefalse" | "image" | "anagram" | "type";

interface Level {
  idx: number;
  kind: Challenge;
  /** خيارات الاختيار والصورة */
  choices?: string[];
  correct?: number;
  /** جملة «صح أو خطأ» */
  shown?: string;
  isTrue?: boolean;
  /** حروف مبعثرة */
  scrambled?: string;
}

/** هل تصلح هذه الإجابة للكتابة أو لترتيب الحروف؟ */
const isShort = (b: string) => b.replace(/\s/g, "").length <= 20;
const canScramble = (b: string) => b.replace(/\s/g, "").length >= 3 && isShort(b);

/**
 * هرم المعلومات: يصعد الطالب درجةً درجة، وكل درجة **تحدٍّ من نوع آخر**.
 *
 * الفكرة أن رتابة السؤال الواحد المكرّر هي ما يُنهي اللعب مبكّراً؛ فبدل
 * عشرة أسئلة اختيار متشابهة، يقابل الطالبُ اختياراً ثم حكماً على جملة ثم
 * صورةً ثم حروفاً مبعثرة ثم كتابةً بيده. والصعوبة تتدرّج مع الارتفاع:
 * القاعدة اختيارٌ من أربعة، والقمّة كتابةٌ من الذاكرة بلا خيارات.
 *
 * والمحاولات ثلاث: الخطأ يُنقص محاولة ولا يُعيد اللاعب إلى القاعدة —
 * إسقاطه من القمّة إلى الأرض عقوبةٌ تُنفّر من إعادة اللعب، والغرض تدريبٌ
 * لا امتحان.
 */
export default function PyramidGame({ items, onFinish }: GameProps) {
  const play = useGameSound();

  const levels = useMemo<Level[]>(() => {
    const order = shuffle(items.map((_, i) => i)).slice(0, MAX_LEVELS);

    return order.map((idx, step) => {
      const it = items[idx];
      const ratio = order.length > 1 ? step / (order.length - 1) : 0;

      /**
       * ترتيب الأفضليات بحسب الارتفاع، ثم أول نوع يقبله العنصر.
       * الصورة تُقدَّم حين توجد لأنها أوضح تحدٍّ وأمتعه، ولا معنى لإخفائها.
       */
      const alt = step % 2 === 0;
      const wish: Challenge[] = it.img
        ? ["image", "choice", "truefalse"]
        : ratio < 0.34
          ? ["choice", "truefalse"]
          : ratio < 0.67
            ? // التناوب مقصود: بغيره يفوز «صح أو خطأ» بكل درجات الوسط
              // (فهو النوع الوحيد الذي يقبله كل عنصر) فيضيع التنوّع المطلوب
              alt
              ? ["anagram", "truefalse", "choice"]
              : ["truefalse", "anagram", "choice"]
            : alt
              ? ["type", "anagram", "choice"]
              : ["anagram", "type", "choice"];

      for (const kind of wish) {
        if (kind === "anagram" && !canScramble(it.b)) continue;
        if (kind === "type" && !isShort(it.b)) continue;

        if (kind === "choice" || kind === "image") {
          const { choices, correct } = buildChoices(items, idx);
          if (choices.length < 2) continue;
          return { idx, kind, choices, correct };
        }
        if (kind === "truefalse") {
          // نصف الجُمل خاطئة، تُركَّب من إجابة عنصر آخر — لا يكتبها المعلّم
          const wrong = items.filter((o, j) => j !== idx && o.b && o.b !== it.b);
          const flip = wrong.length > 0 && step % 2 === 1;
          return {
            idx,
            kind,
            shown: flip ? wrong[Math.floor(Math.random() * wrong.length)].b : it.b,
            isTrue: !flip,
          };
        }
        if (kind === "anagram") return { idx, kind, scrambled: scramble(it.b) };
        if (kind === "type") return { idx, kind };
      }

      const { choices, correct } = buildChoices(items, idx);
      return { idx, kind: "choice", choices, correct };
    });
  }, [items]);

  const [step, setStep] = useState(0);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(LIVES);
  const [typed, setTyped] = useState("");
  const [verdict, setVerdict] = useState<"right" | "wrong" | null>(null);
  const [done, setDone] = useState(false);
  /** نفدت المحاولات قبل القمّة — يُقال للطالب لماذا انتهت اللعبة */
  const [fell, setFell] = useState(false);

  const lv = levels[step];
  const item = items[lv.idx];

  function settle(ok: boolean) {
    if (verdict !== null || done) return;
    setVerdict(ok ? "right" : "wrong");
    play(ok ? "right" : "wrong");

    const nextScore = ok ? score + 1 : score;
    const nextLives = ok ? lives : lives - 1;
    if (ok) setScore(nextScore);
    else setLives(nextLives);

    setTimeout(() => {
      // نفدت المحاولات، أو بلغ القمّة
      if (nextLives <= 0 || step + 1 >= levels.length) {
        setDone(true);
        if (nextLives <= 0) setFell(true);
        if (nextScore === levels.length) play("win");
        onFinish(nextScore, levels.length);
        return;
      }
      setStep((s) => s + 1);
      setTyped("");
      setVerdict(null);
    }, 950);
  }

  const label: Record<Challenge, string> = {
    choice: "اختر الإجابة",
    image: "ما الذي تراه؟",
    truefalse: "احكم على الجملة",
    anagram: "رتّب الحروف",
    type: "اكتب الإجابة",
  };

  return (
    <div className="game game-pyramid">
      <p className="game-status">
        🔺 الدرجة {step + 1} من {levels.length} · ✅ {score} ·{" "}
        <span className="pyr-lives" aria-label={`${lives} محاولات متبقية`}>
          {"❤️".repeat(Math.max(0, lives))}
          {"🤍".repeat(Math.max(0, LIVES - lives))}
        </span>
      </p>

      {/* الهرم مقلوبٌ بصرياً: القاعدة أسفل والقمّة أعلى، والدرجة الحالية تتوهّج */}
      <ol className="pyramid" aria-hidden="true">
        {levels
          .map((_, i) => i)
          .reverse()
          .map((i) => (
            <li
              key={i}
              className={`pyr-step ${
                i < step ? "pyr-done" : i === step ? "pyr-now" : ""
              }`}
              style={{ width: `${40 + (i / Math.max(1, levels.length - 1)) * 55}%` }}
            >
              {i === levels.length - 1 ? "👑" : i + 1}
            </li>
          ))}
      </ol>

      <span className="pyr-tag">{label[lv.kind]}</span>

      {lv.kind === "image" && item.img && (
        <div className="pyr-image">
          {/*
            عنصر <img> عاديّ لا next/image: الأخير يرفض مضيفاً غير مُعلَن في
            `images.remotePatterns` ويسقط الصفحة وقت التشغيل، والصور هنا
            تأتي من حاوية المشروع بأبعاد متغيّرة ولا يفيدها التحسين.
          */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.img} alt="" className="pyr-img" />
        </div>
      )}

      <p className="game-prompt">
        {lv.kind === "image"
          ? item.a || "ما هذا؟"
          : lv.kind === "truefalse"
            ? ""
            : item.a}
      </p>

      {lv.kind === "truefalse" && (
        <p className="tf-statement">
          <span className="tf-a">{item.a}</span>
          <span className="tf-eq" aria-hidden="true">
            =
          </span>
          <span className="tf-b">{lv.shown}</span>
        </p>
      )}

      {lv.kind === "anagram" && (
        <p className="pyr-scrambled" dir="rtl">
          {lv.scrambled}
        </p>
      )}

      {(lv.kind === "choice" || lv.kind === "image") && (
        <div className="game-choices">
          {lv.choices!.map((c, i) => (
            <button
              key={`${step}-${i}`}
              type="button"
              className={`game-choice ${
                verdict === null
                  ? ""
                  : i === lv.correct
                    ? "choice-right"
                    : "choice-dim"
              }`}
              disabled={verdict !== null}
              onClick={() => settle(i === lv.correct)}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {lv.kind === "truefalse" && (
        <div className="tf-buttons">
          <button
            type="button"
            className="game-choice"
            disabled={verdict !== null}
            onClick={() => settle(lv.isTrue === true)}
          >
            ✔️ صح
          </button>
          <button
            type="button"
            className="game-choice"
            disabled={verdict !== null}
            onClick={() => settle(lv.isTrue === false)}
          >
            ✖️ خطأ
          </button>
        </div>
      )}

      {(lv.kind === "type" || lv.kind === "anagram") && (
        <form
          className="pyr-answer"
          onSubmit={(e) => {
            e.preventDefault();
            // المقارنة بعد التطبيع: الهمزات والتاء المربوطة لا تُسقِط إجابة صحيحة
            settle(normalizeArabic(typed) === normalizeArabic(item.b));
          }}
        >
          <input
            type="text"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            disabled={verdict !== null}
            placeholder="اكتب إجابتك…"
            aria-label="إجابتك"
            autoComplete="off"
          />
          <button
            type="submit"
            className="btn btn-primary"
            disabled={verdict !== null || !typed.trim()}
          >
            تحقّق
          </button>
        </form>
      )}

      {verdict && (
        <p className={verdict === "right" ? "form-ok" : "form-error"}>
          {verdict === "right" ? "✓ أحسنت — اصعد!" : `✕ الصحيح: ${item.b}`}
        </p>
      )}

      {/* نهايةٌ بلا سبب تُربك: نقول إن المحاولات نفدت لا أن اللعبة تعطّلت */}
      {fell && (
        <p className="form-error">
          💔 نفدت محاولاتك الثلاث عند الدرجة {step + 1} — أعِد المحاولة.
        </p>
      )}
    </div>
  );
}
