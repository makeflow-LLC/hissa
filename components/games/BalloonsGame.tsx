"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { buildChoices, shuffle, type GameProps } from "@/components/games/shared";
import { useGameSound } from "@/components/games/useGameSound";

const RISE_MS = 9000;

/**
 * فرقعة البالونات: بالونات تصعد تحمل إجابات، والطالب يفرقع الصحيحة.
 *
 * الصعود حركةُ CSS خالصة لا مؤقّتٌ يحرّك كل إطار: المتصفّح يرسمها على
 * بطاقة الرسوميات فتبقى ناعمة على الأجهزة الضعيفة — وهي أجهزة جمهورنا.
 * ولا نحتاج إلا مؤقّتاً واحداً يعلن انقضاء الجولة.
 */
export default function BalloonsGame({ items, onFinish }: GameProps) {
  const play = useGameSound();
  const order = useMemo(() => shuffle(items.map((_, i) => i)), [items]);

  const [step, setStep] = useState(0);
  const [score, setScore] = useState(0);
  const [popped, setPopped] = useState<number | null>(null);
  const [missed, setMissed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const idx = order[step];
  const { choices, correct } = useMemo(
    () => buildChoices(items, idx),
    [items, idx]
  );

  // انقضاء وقت البالونة: تُحسب خطأً وننتقل
  useEffect(() => {
    if (popped !== null || missed) return;
    timer.current = setTimeout(() => {
      play("wrong");
      setMissed(true);
    }, RISE_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [step, popped, missed, play]);

  /**
   * الانتقال بعد نتيجة الجولة.
   *
   * `score` هنا **محدَّثٌ سلفاً**: `pop` تزيده في نفس الحدث الذي يضبط
   * `popped`، فتُعاد التهيئة بالقيمتين معاً ويراهما هذا الأثر جديدين. وكان
   * يُزاد مرّةً ثانية عند الجولة الأخيرة فتخرج نتيجةٌ مستحيلة: «٦ من ٥».
   */
  useEffect(() => {
    if (popped === null && !missed) return;
    const t = setTimeout(() => {
      if (step + 1 >= order.length) {
        if (score === order.length) play("win");
        onFinish(score, order.length);
      } else {
        setStep((s) => s + 1);
        setPopped(null);
        setMissed(false);
      }
    }, 900);
    return () => clearTimeout(t);
  }, [popped, missed, score, step, order.length, onFinish, play]);

  function pop(i: number) {
    if (popped !== null || missed) return;
    setPopped(i);
    if (i === correct) {
      setScore((s) => s + 1);
      play("pop");
    } else play("wrong");
  }

  return (
    <div className="game game-balloons">
      <p className="game-status">
        سؤال {step + 1} من {order.length} · ✅ {score}
      </p>
      <p className="game-prompt">{items[idx].a}</p>

      <div className="balloon-sky">
        {choices.map((c, i) => (
          <button
            key={`${step}-${i}`}
            type="button"
            className={`balloon balloon-${i % 4} ${
              popped === i ? (i === correct ? "balloon-pop" : "balloon-bad") : ""
            } ${(popped !== null || missed) && i === correct ? "balloon-reveal" : ""}`}
            style={{ animationDuration: `${RISE_MS}ms`, animationDelay: `${i * 240}ms` }}
            disabled={popped !== null || missed}
            onClick={() => pop(i)}
          >
            <span className="balloon-text">{c}</span>
          </button>
        ))}
      </div>

      {missed && <p className="form-error">⏱ أفلتت البالونة!</p>}
      {popped !== null && (
        <p className={popped === correct ? "form-ok" : "form-error"}>
          {popped === correct ? "💥 أحسنت!" : `✕ الصحيح: ${choices[correct]}`}
        </p>
      )}
    </div>
  );
}
