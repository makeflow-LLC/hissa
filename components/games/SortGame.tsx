"use client";

import { useMemo, useState } from "react";
import { shuffle, type GameProps } from "@/components/games/shared";

/**
 * صنّف في مجموعات: عنصرٌ واحد في كل مرّة، والفئات أزرارٌ تحته.
 *
 * عنصرٌ واحد لا لوحةٌ كاملة: عرض عشرين عنصراً وستّ سلال معاً يحتاج شاشةً
 * عريضة وسحباً بالفأرة، وكلاهما غير متاح هنا.
 */
export default function SortGame({ items, onFinish }: GameProps) {
  const cats = useMemo(
    () => shuffle([...new Set(items.map((i) => i.b))]),
    [items]
  );
  const order = useMemo(() => shuffle(items.map((_, i) => i)), [items]);

  const [step, setStep] = useState(0);
  const [score, setScore] = useState(0);
  const [chosen, setChosen] = useState<string | null>(null);

  const it = items[order[step]];

  function pick(cat: string) {
    if (chosen !== null) return;
    setChosen(cat);
    const right = cat === it.b;
    if (right) setScore((s) => s + 1);

    setTimeout(() => {
      if (step + 1 >= order.length) {
        onFinish(right ? score + 1 : score, order.length);
      } else {
        setStep((s) => s + 1);
        setChosen(null);
      }
    }, 850);
  }

  return (
    <div className="game game-sort">
      <p className="game-status">
        عنصر {step + 1} من {order.length} · ✅ {score}
      </p>

      <p className="game-prompt sort-item">{it.a}</p>
      <p className="form-hint">إلى أي فئة ينتمي؟</p>

      <div className="game-choices">
        {cats.map((c) => (
          <button
            key={`${step}-${c}`}
            type="button"
            className={`game-choice ${
              chosen === null
                ? ""
                : c === it.b
                  ? "choice-right"
                  : c === chosen
                    ? "choice-wrong"
                    : "choice-dim"
            }`}
            disabled={chosen !== null}
            onClick={() => pick(c)}
          >
            {c}
          </button>
        ))}
      </div>
    </div>
  );
}
