"use client";

import { useMemo, useState } from "react";
import { shuffle, type GameProps } from "@/components/games/shared";
import { useGameSound } from "@/components/games/useGameSound";

/**
 * صح أو خطأ — **والجُمل تُركَّب تلقائياً**.
 *
 * نصفها أزواج صحيحة كما كتبها المعلّم، ونصفها زوجٌ رُكِّب طرفه الثاني من
 * عنصر آخر. فالمعلّم لا يكتب جملةً خاطئة واحدة، والمنصة تصنعها من نفس
 * المحتوى — وهذا ما يجعل اللعبة العاشرة بلا كلفة إدخال جديدة.
 */
export default function TrueFalseGame({ items, onFinish }: GameProps) {
  const play = useGameSound();

  const rounds = useMemo(() => {
    const order = shuffle(items.map((_, i) => i));
    return order.map((i, n) => {
      // نُخطئ العنصر عمداً في نصف الجولات تقريباً
      const shouldBeTrue = n % 2 === 0;
      if (shouldBeTrue) return { a: items[i].a, b: items[i].b, correct: true };
      const others = items.filter((_, j) => j !== i && items[j].b !== items[i].b);
      if (others.length === 0) return { a: items[i].a, b: items[i].b, correct: true };
      const wrong = others[Math.floor(Math.random() * others.length)];
      return { a: items[i].a, b: wrong.b, correct: false };
    });
  }, [items]);

  const [step, setStep] = useState(0);
  const [score, setScore] = useState(0);
  const [answer, setAnswer] = useState<boolean | null>(null);

  const r = rounds[step];

  function pick(said: boolean) {
    if (answer !== null) return;
    setAnswer(said);
    const right = said === r.correct;
    if (right) {
      setScore((s) => s + 1);
      play("right");
    } else play("wrong");

    setTimeout(() => {
      if (step + 1 >= rounds.length) {
        if (right && score + 1 === rounds.length) play("win");
        onFinish(right ? score + 1 : score, rounds.length);
      } else {
        setStep((s) => s + 1);
        setAnswer(null);
      }
    }, 900);
  }

  return (
    <div className="game game-tf">
      <p className="game-status">
        جملة {step + 1} من {rounds.length} · ✅ {score}
      </p>

      <p className="tf-statement">
        <span className="tf-a">{r.a}</span>
        <span className="tf-eq" aria-hidden="true">
          =
        </span>
        <span className="tf-b">{r.b}</span>
      </p>

      {answer !== null && (
        <p className={answer === r.correct ? "form-ok" : "form-error"}>
          {answer === r.correct
            ? "✓ صحيح"
            : r.correct
              ? "✕ بل كانت صحيحة"
              : "✕ بل كانت خاطئة"}
        </p>
      )}

      <div className="tf-buttons">
        <button
          type="button"
          className={`game-choice tf-yes ${
            answer === null ? "" : r.correct ? "choice-right" : answer ? "choice-wrong" : "choice-dim"
          }`}
          disabled={answer !== null}
          onClick={() => pick(true)}
        >
          ✔️ صح
        </button>
        <button
          type="button"
          className={`game-choice tf-no ${
            answer === null ? "" : !r.correct ? "choice-right" : answer === false ? "choice-wrong" : "choice-dim"
          }`}
          disabled={answer !== null}
          onClick={() => pick(false)}
        >
          ✖️ خطأ
        </button>
      </div>
    </div>
  );
}
