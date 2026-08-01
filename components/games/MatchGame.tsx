"use client";

import { useMemo, useState } from "react";
import { shuffle, type GameProps } from "@/components/games/shared";
import { useGameSound } from "@/components/games/useGameSound";

/**
 * مطابقة: عمودان مبعثران، يضغط الطالب طرفاً ثم ما يقابله.
 *
 * الضغط لا السحب: السحب والإفلات على الجوال يصارع تمرير الصفحة، وجمهور
 * المنصة كلّه تقريباً على الجوال.
 */
export default function MatchGame({ items, onFinish }: GameProps) {
  const play = useGameSound();
  const left = useMemo(() => shuffle(items.map((_, i) => i)), [items]);
  const right = useMemo(() => shuffle(items.map((_, i) => i)), [items]);

  const [picked, setPicked] = useState<number | null>(null);
  const [done, setDone] = useState<number[]>([]);
  const [wrong, setWrong] = useState<number | null>(null);
  const [misses, setMisses] = useState(0);

  function tapRight(i: number) {
    if (picked === null || done.includes(i)) return;
    if (picked === i) {
      const next = [...done, i];
      setDone(next);
      setPicked(null);
      play(next.length === items.length ? "win" : "right");
      if (next.length === items.length) {
        // الدرجة: العناصر كلّها ناقصاً الأخطاء، ولا تنزل تحت الصفر
        onFinish(Math.max(0, items.length - misses), items.length);
      }
    } else {
      setMisses((m) => m + 1);
      play("wrong");
      setWrong(i);
      setTimeout(() => setWrong(null), 500);
      setPicked(null);
    }
  }

  return (
    <div className="game game-match">
      <p className="game-status">
        ✅ {done.length} من {items.length} · ✕ {misses} خطأ
      </p>

      <div className="match-cols">
        <ul className="match-col">
          {left.map((i) => (
            <li key={i}>
              <button
                type="button"
                className={`match-cell ${done.includes(i) ? "match-done" : ""} ${
                  picked === i ? "match-picked" : ""
                }`}
                disabled={done.includes(i)}
                onClick={() => setPicked(picked === i ? null : i)}
              >
                {items[i].a}
              </button>
            </li>
          ))}
        </ul>

        <ul className="match-col">
          {right.map((i) => (
            <li key={i}>
              <button
                type="button"
                className={`match-cell ${done.includes(i) ? "match-done" : ""} ${
                  wrong === i ? "match-wrong" : ""
                }`}
                disabled={done.includes(i)}
                onClick={() => tapRight(i)}
              >
                {items[i].b}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <p className="form-hint">
        {picked === null
          ? "اضغط عنصراً من العمود الأيمن، ثم ما يقابله في الأيسر."
          : "الآن اضغط ما يقابله."}
      </p>
    </div>
  );
}
