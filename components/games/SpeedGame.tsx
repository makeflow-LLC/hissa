"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildChoices, shuffle, type GameProps } from "@/components/games/shared";
import { useGameSound } from "@/components/games/useGameSound";

const SECONDS = 60;

/**
 * تحدّي السرعة: ستّون ثانية، والأسئلة تدور فلا تنتهي.
 *
 * **الدرجة عدد الإجابات الصحيحة من عدد ما ظهر**، لا من عدد الأسئلة: من
 * أجاب ١٢ صحيحةً من ١٤ ظهرت له أفضل ممّن أجاب ٦ من ٦ ببطء — ولو قسمنا
 * على عدد العناصر لتساوى المتسرّع والمتأنّي.
 *
 * والسلسلة (streak) تُعرض للتشجيع ولا تضاعف الدرجة: مضاعفتها تجعل الرقم
 * غير مفهوم، والمقصود متعةٌ لا حسابٌ معقّد.
 */
export default function SpeedGame({ items, onFinish }: GameProps) {
  const play = useGameSound();
  const order = useMemo(
    () => shuffle(items.map((_, i) => i)),
    [items]
  );

  const [left, setLeft] = useState(SECONDS);
  const [n, setN] = useState(0);
  const [right, setRight] = useState(0);
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);
  const done = useRef(false);

  // الأسئلة تدور: العنصر يعود بعد أن تنتهي القائمة
  const idx = order[n % order.length];
  const { choices, correct } = useMemo(() => buildChoices(items, idx), [items, idx]);

  const stop = useCallback(
    (score: number, total: number) => {
      if (done.current) return;
      done.current = true;
      play("win");
      onFinish(score, total);
    },
    [onFinish, play]
  );

  /**
   * القيم الحيّة في `ref` لا في الحالة وحدها: المؤقّت يُنشأ مرّةً، ولو
   * قرأ `right` و`n` من الإغلاق لرأى قيمهما لحظةَ إنشائه — أي صفرين —
   * فتنتهي كل جولة بنتيجة صفر مهما أجاب اللاعب.
   */
  const rightRef = useRef(0);
  const nRef = useRef(0);
  rightRef.current = right;
  nRef.current = n;

  useEffect(() => {
    const t = setInterval(() => {
      setLeft((s) => {
        if (s > 1) return s - 1;
        clearInterval(t);
        // المجموع: عدد ما ظهر فعلاً، لا عدد عناصر النشاط
        stop(rightRef.current, Math.max(1, nRef.current));
        return 0;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [stop]);

  function pick(c: number) {
    if (chosen !== null || left <= 0) return;
    setChosen(c);
    const ok = c === correct;
    if (ok) {
      setRight((r) => r + 1);
      setStreak((s) => {
        const next = s + 1;
        setBest((b) => Math.max(b, next));
        return next;
      });
      play("right");
    } else {
      setStreak(0);
      play("wrong");
    }
    setTimeout(() => {
      setN((v) => v + 1);
      setChosen(null);
    }, 420);
  }

  const pct = (left / SECONDS) * 100;

  return (
    <div className="game game-speed">
      <div className="speed-bar" aria-hidden="true">
        <span style={{ width: `${pct}%` }} className={left <= 10 ? "speed-low" : ""} />
      </div>
      <p className="game-status">
        ⏱ {left} ثانية · ✅ {right} · 🔥 سلسلة {streak}
        {best > 1 && ` (أطولها ${best})`}
      </p>

      <p className="game-prompt">{items[idx].a}</p>

      <div className="game-choices">
        {choices.map((c, i) => (
          <button
            key={`${n}-${i}`}
            type="button"
            className={`game-choice ${
              chosen === null
                ? ""
                : i === correct
                  ? "choice-right"
                  : i === chosen
                    ? "choice-wrong"
                    : "choice-dim"
            }`}
            disabled={chosen !== null || left <= 0}
            onClick={() => pick(i)}
          >
            {c}
          </button>
        ))}
      </div>
    </div>
  );
}
