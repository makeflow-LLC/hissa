"use client";

import { useEffect, useMemo, useState } from "react";
import { scramble, shuffle, type GameProps } from "@/components/games/shared";

/**
 * رتّب الحروف: تُعرض حروف الكلمة مبعثرة ويبنيها الطالب بالضغط.
 *
 * الضغط لا الكتابة: لوحة المفاتيح العربية على الجوال تُبطئ اللعبة، وحروف
 * كالهمزة تُكتب بأشكال مختلفة فيُرفض جوابٌ صحيح.
 */
export default function AnagramGame({ items, onFinish }: GameProps) {
  const order = useMemo(() => shuffle(items.map((_, i) => i)), [items]);
  const [step, setStep] = useState(0);
  const [score, setScore] = useState(0);
  const [picked, setPicked] = useState<number[]>([]);
  const [state, setState] = useState<"play" | "right" | "wrong">("play");
  const [showHint, setShowHint] = useState(false);

  const it = items[order[step]];
  const target = useMemo(() => it.a.replace(/\s+/g, ""), [it.a]);
  const letters = useMemo(() => [...scramble(it.a)], [it.a]);

  // إعادة الضبط عند كل كلمة جديدة
  useEffect(() => {
    setPicked([]);
    setState("play");
    setShowHint(false);
  }, [step]);

  const built = picked.map((i) => letters[i]).join("");

  function tap(i: number) {
    if (state !== "play" || picked.includes(i)) return;
    const next = [...picked, i];
    setPicked(next);
    if (next.length !== letters.length) return;

    const ok = next.map((j) => letters[j]).join("") === target;
    setState(ok ? "right" : "wrong");
    if (ok) setScore((s) => s + 1);

    setTimeout(() => {
      if (step + 1 >= order.length) {
        onFinish(ok ? score + 1 : score, order.length);
      } else {
        setStep((s) => s + 1);
      }
    }, 1000);
  }

  return (
    <div className="game game-anagram">
      <p className="game-status">
        كلمة {step + 1} من {order.length} · ✅ {score}
      </p>

      <p
        className={`anagram-slot ${
          state === "right" ? "choice-right" : state === "wrong" ? "choice-wrong" : ""
        }`}
      >
        {built || "…"}
      </p>
      {state === "wrong" && <p className="form-error">الصحيح: {target}</p>}

      <div className="anagram-letters">
        {letters.map((ch, i) => (
          <button
            key={i}
            type="button"
            className="anagram-letter"
            disabled={picked.includes(i) || state !== "play"}
            onClick={() => tap(i)}
          >
            {ch}
          </button>
        ))}
      </div>

      <div className="card-actions">
        <button
          type="button"
          className="btn btn-outline btn-sm"
          disabled={picked.length === 0 || state !== "play"}
          onClick={() => setPicked((p) => p.slice(0, -1))}
        >
          ⌫ تراجع
        </button>
        {it.b && (
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => setShowHint(true)}
          >
            💡 تلميح
          </button>
        )}
      </div>

      {showHint && it.b && <p className="hint">{it.b}</p>}
    </div>
  );
}
