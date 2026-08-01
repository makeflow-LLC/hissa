"use client";

import { useRef, useState } from "react";
import type { GameProps } from "@/components/games/shared";

/**
 * عجلة عشوائية: تدور وتقف على عنصر.
 *
 * أداة صفٍّ لا لعبة درجات — لاختيار طالب أو سؤال مراجعة أمام الجميع.
 * لذلك لا تُحتسب لها نتيجة، ويبقى «إنهاء» زرّاً صريحاً بيد اللاعب.
 *
 * **الاختيار يسبق الدوران**: نقرّر الفائز أولاً ثم نحسب الزاوية التي
 * تقف عندها العجلة، فلا يعتمد النتيجةُ على دقّة الحركة أو على انقطاعها
 * إن أخفى المتصفّح الصفحة في أثنائها.
 */
export default function WheelGame({ items, onFinish }: GameProps) {
  const [angle, setAngle] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const slice = 360 / items.length;

  function spin() {
    if (spinning) return;
    setSpinning(true);
    setWinner(null);

    const pick = Math.floor(Math.random() * items.length);
    // خمس دورات كاملة ثم الوقوف على منتصف قطاع الفائز
    const target = 360 * 5 + (360 - (pick * slice + slice / 2));
    setAngle((a) => a + target);

    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setWinner(pick);
      setSpinning(false);
    }, 3200);
  }

  return (
    <div className="game game-wheel">
      <div className="wheel-wrap">
        <span className="wheel-pointer" aria-hidden="true">
          ▼
        </span>
        {/*
          طبقة قصّ بين الغلاف والعجلة: العنصر المُدار صندوقه المحيط أكبر
          من نفسه (مربّع بزاوية ٤٥° يصير ١٫٤ ضعفاً)، فيزيد عرض الصفحة ولو
          لم يُرسم منه شيء خارج الدائرة. القصّ على الأب يحتوي ذلك، ويبقى
          المؤشّر خارجه فلا يُقصّ.
        */}
        <div className="wheel-clip">
          <div
            className="wheel"
            style={{
              transform: `rotate(${angle}deg)`,
              transition: spinning ? "transform 3s cubic-bezier(.17,.67,.16,1)" : "none",
            }}
          >
            {items.map((it, i) => (
              <span
                key={i}
                className="wheel-slice"
                style={{ transform: `rotate(${i * slice + slice / 2}deg)` }}
              >
                <span className="wheel-label">{it.a}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      <p className="wheel-result" aria-live="polite">
        {winner === null ? (spinning ? "…" : "اضغط «أدر العجلة»") : items[winner].a}
      </p>
      {winner !== null && items[winner].b && (
        <p className="form-hint">{items[winner].b}</p>
      )}

      <div className="card-actions">
        <button
          type="button"
          className="btn btn-primary"
          disabled={spinning}
          onClick={spin}
        >
          🎡 {winner === null ? "أدر العجلة" : "أدرها مجدداً"}
        </button>
        <button type="button" className="btn btn-outline" onClick={() => onFinish(0, 0)}>
          إنهاء
        </button>
      </div>
    </div>
  );
}
