"use client";

import { useMemo, useState } from "react";
import { shuffle, type GameProps } from "@/components/games/shared";

/**
 * بطاقات تعليمية: وجه وظهر، يقلبها الطالب ويتنقّل بينها.
 *
 * بلا درجة عمداً — المراجعة الذاتية يفسدها التسجيل: الطالب يقول لنفسه
 * «عرفتها» فيغشّ نفسه، أو يتوتّر من رقمٍ لا معنى له. تُسجَّل اللعبة
 * بدرجة صفرية من صفر، أي حضورٌ لا تقويم.
 */
export default function FlashcardsGame({ items, onFinish }: GameProps) {
  const order = useMemo(() => shuffle(items.map((_, i) => i)), [items]);
  const [step, setStep] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const it = items[order[step]];

  return (
    <div className="game game-cards">
      <p className="game-status">
        بطاقة {step + 1} من {order.length}
      </p>

      <button
        type="button"
        className={`flashcard ${flipped ? "flashcard-back" : ""}`}
        onClick={() => setFlipped((v) => !v)}
        aria-label={flipped ? "اقلب إلى الوجه" : "اقلب لترى الجواب"}
      >
        <span className="flashcard-text">{flipped ? it.b : it.a}</span>
        <span className="flashcard-hint">{flipped ? "الجواب" : "اضغط لترى الجواب"}</span>
      </button>

      <div className="card-actions game-nav">
        <button
          type="button"
          className="btn btn-outline"
          disabled={step === 0}
          onClick={() => {
            setStep((s) => s - 1);
            setFlipped(false);
          }}
        >
          ← السابقة
        </button>

        {step + 1 < order.length ? (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setStep((s) => s + 1);
              setFlipped(false);
            }}
          >
            التالية →
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => onFinish(0, 0)}
          >
            ✓ أنهيت المراجعة
          </button>
        )}
      </div>
    </div>
  );
}
