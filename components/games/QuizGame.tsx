"use client";

import { useMemo, useState } from "react";
import { buildChoices, shuffle, type GameProps } from "@/components/games/shared";
import { useGameSound } from "@/components/games/useGameSound";

/**
 * اختيار سريع: سؤال وأربعة خيارات.
 *
 * **المشتّتات تُبنى من إجابات بقية العناصر** فلا يكتبها المعلّم — وهذا ما
 * يجعل النشاط أرخص من الاختبار الرسمي: صفٌّ واحد بسؤال وجوابه يكفي.
 */
export default function QuizGame({ items, onFinish }: GameProps) {
  const play = useGameSound();
  const order = useMemo(() => shuffle(items.map((_, i) => i)), [items]);
  const [step, setStep] = useState(0);
  const [score, setScore] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);

  const idx = order[step];
  const { choices, correct } = useMemo(
    () => buildChoices(items, idx),
    [items, idx]
  );

  function pick(c: number) {
    if (chosen !== null) return;
    setChosen(c);
    const right = c === correct;
    if (right) setScore((s) => s + 1);
    play(right ? "right" : "wrong");

    setTimeout(() => {
      if (step + 1 >= order.length) {
        if (right && score + 1 === order.length) play("win");
        onFinish(right ? score + 1 : score, order.length);
      } else {
        setStep((s) => s + 1);
        setChosen(null);
      }
    }, 850);
  }

  return (
    <div className="game game-quiz">
      <p className="game-status">
        سؤال {step + 1} من {order.length} · ✅ {score}
      </p>

      <p className="game-prompt">{items[idx].a}</p>

      <div className="game-choices">
        {choices.map((c, i) => (
          <button
            key={`${step}-${i}`}
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
            disabled={chosen !== null}
            onClick={() => pick(i)}
          >
            {c}
          </button>
        ))}
      </div>
    </div>
  );
}
