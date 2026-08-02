"use client";

import { useMemo, useState } from "react";
import { shuffle, type GameProps } from "@/components/games/shared";
import { useGameSound } from "@/components/games/useGameSound";

interface Card {
  id: number;
  pair: number;
  text: string;
}

/**
 * ذاكرة البطاقات: بطاقات مقلوبة، يفتح الطالب اثنتين ليجد الزوج.
 *
 * **الكشف الأول لا يُحاسَب عليه.** لعبة الذاكرة تبدأ بالضرورة بجهل: لا
 * سبيل لمعرفة ما تحت البطاقة إلا بفتحها، فأول `n` محاولاتٍ خاطئة (بعدد
 * الأزواج) استكشافٌ لا خطأ. ما بعدها يُخصم منه نصفه — نسياناً لا جهلاً.
 * وقبل هذا كان الخصم يبدأ من المحاولة الأولى، فيخرج اللاعب المتقن بنصف
 * الدرجة ويظنّ اللعبة ظالمة.
 */
function scoreOf(pairs: number, misses: number): number {
  const excess = Math.max(0, misses - pairs);
  return Math.max(1, pairs - Math.floor(excess / 2));
}
export default function MemoryGame({ items, onFinish }: GameProps) {
  const play = useGameSound();

  const cards = useMemo<Card[]>(
    () =>
      shuffle(
        items.flatMap((it, i) => [
          { id: i * 2, pair: i, text: it.a },
          { id: i * 2 + 1, pair: i, text: it.b },
        ])
      ),
    [items]
  );

  const [open, setOpen] = useState<number[]>([]);
  const [found, setFound] = useState<number[]>([]);
  const [misses, setMisses] = useState(0);
  const [locked, setLocked] = useState(false);

  function flip(idx: number) {
    if (locked || open.includes(idx) || found.includes(cards[idx].pair)) return;

    const next = [...open, idx];
    setOpen(next);
    play("pop");
    if (next.length < 2) return;

    const [x, y] = next;
    setLocked(true);

    if (cards[x].pair === cards[y].pair) {
      play("right");
      const nf = [...found, cards[x].pair];
      setTimeout(() => {
        setFound(nf);
        setOpen([]);
        setLocked(false);
        if (nf.length === items.length) {
          play("win");
          onFinish(scoreOf(items.length, misses), items.length);
        }
      }, 450);
    } else {
      play("wrong");
      setMisses((m) => m + 1);
      setTimeout(() => {
        setOpen([]);
        setLocked(false);
      }, 800);
    }
  }

  return (
    <div className="game game-memory">
      <p className="game-status">
        ✅ {found.length} من {items.length} زوجاً · ✕ {misses} محاولة خاطئة
      </p>

      <div className="memory-grid">
        {cards.map((c, i) => {
          const isOpen = open.includes(i) || found.includes(c.pair);
          return (
            <button
              key={c.id}
              type="button"
              className={`memory-card ${isOpen ? "memory-open" : ""} ${
                found.includes(c.pair) ? "memory-found" : ""
              }`}
              onClick={() => flip(i)}
              aria-label={isOpen ? c.text : "بطاقة مقلوبة"}
            >
              <span className="memory-face">{isOpen ? c.text : "؟"}</span>
            </button>
          );
        })}
      </div>

      <p className="form-hint">
        افتح بطاقتين لتجد الزوج المتطابق. أوّل {items.length} محاولات خاطئة
        استكشافٌ لا يُخصم منك.
      </p>
    </div>
  );
}
