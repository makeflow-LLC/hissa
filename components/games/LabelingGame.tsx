"use client";

import { useMemo, useRef, useState } from "react";
import { shuffle, type GameProps } from "@/components/games/shared";
import { useGameSound } from "@/components/games/useGameSound";

/**
 * «سمِّ الأجزاء»: صورةٌ عليها نقاط، والطالب يسحب كل اسم إلى موضعه.
 *
 * **السحب بأحداث المؤشّر لا بسحب HTML5.** واجهة `dragstart/drop` لا تعمل
 * على شاشات اللمس إطلاقاً، وجمهورنا على الجوال — فاللعبة كانت ستبدو
 * معطّلة عند أكثر من يفتحها. و`pointer*` تغطّي الفأرة واللمس والقلم بشيفرة
 * واحدة.
 *
 * ومعها **طريق ثانٍ بالضغط**: يضغط الطالب الاسم فيُحدَّد، ثم يضغط النقطة.
 * الأصابع الصغيرة والأجهزة البطيئة تُفشل السحب الدقيق كثيراً، وترك
 * طريقٍ واحد يعني أن يعجز بعض الطلاب عن اللعب أصلاً.
 */
export default function LabelingGame({ items, imageUrl, onFinish }: GameProps) {
  const play = useGameSound();

  /** النقاط بترتيبها الأصلي (مواضعها)، والأسماء مخلوطة في الدرج */
  const targets = useMemo(
    () => items.map((it, i) => ({ i, x: it.x ?? 50, y: it.y ?? 50, name: it.a })),
    [items]
  );
  const tray = useMemo(() => shuffle(items.map((_, i) => i)), [items]);

  /** أي اسم وُضع على أي نقطة: مفتاحه رقم النقطة */
  const [placed, setPlaced] = useState<Record<number, number>>({});
  const [picked, setPicked] = useState<number | null>(null);
  const [wrongAt, setWrongAt] = useState<number | null>(null);
  const [drag, setDrag] = useState<{ label: number; x: number; y: number } | null>(
    null
  );
  const [done, setDone] = useState(false);
  const boardRef = useRef<HTMLDivElement>(null);

  const usedLabels = new Set(Object.values(placed));
  const remaining = tray.filter((l) => !usedLabels.has(l));

  function assign(targetIdx: number, labelIdx: number) {
    if (done || placed[targetIdx] !== undefined) return;

    // الاسم الصحيح للنقطة هو صاحبها نفسه — النقاط والأسماء عنصرٌ واحد
    if (targetIdx !== labelIdx) {
      play("wrong");
      setWrongAt(targetIdx);
      setTimeout(() => setWrongAt(null), 600);
      return;
    }

    play("right");
    const next = { ...placed, [targetIdx]: labelIdx };
    setPlaced(next);
    setPicked(null);

    if (Object.keys(next).length === items.length) {
      setDone(true);
      play("win");
      // كل الأسماء وُضعت في مواضعها الصحيحة — الخطأ لا يُثبَّت أصلاً
      setTimeout(() => onFinish(items.length, items.length), 700);
    }
  }

  /** أقرب نقطة إلى إحداثيات الإفلات، إن كانت داخل مداها */
  function targetAt(clientX: number, clientY: number): number | null {
    const board = boardRef.current;
    if (!board) return null;
    const r = board.getBoundingClientRect();
    const px = ((clientX - r.left) / r.width) * 100;
    const py = ((clientY - r.top) / r.height) * 100;
    let best: number | null = null;
    let bestD = Infinity;
    for (const t of targets) {
      if (placed[t.i] !== undefined) continue;
      const d = Math.hypot(t.x - px, t.y - py);
      if (d < bestD) {
        bestD = d;
        best = t.i;
      }
    }
    // ١٢٪ من مقاس الصورة: مدىً سخيّ يغفر ارتعاش الإصبع
    return bestD <= 12 ? best : null;
  }

  return (
    <div className="game game-labeling">
      <p className="game-status">
        🏷️ {Object.keys(placed).length} من {items.length}
      </p>

      <div className="label-board" ref={boardRef}>
        {imageUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={imageUrl} alt="" className="label-image" draggable={false} />
        ) : (
          <p className="drafts-empty">لا صورة لهذا النشاط.</p>
        )}

        {targets.map((t) => {
          const filled = placed[t.i] !== undefined;
          return (
            <button
              key={t.i}
              type="button"
              className={`label-target ${filled ? "label-filled" : ""} ${
                wrongAt === t.i ? "label-shake" : ""
              } ${picked !== null && !filled ? "label-open" : ""}`}
              style={{ left: `${t.x}%`, top: `${t.y}%` }}
              onClick={() => {
                if (picked !== null) assign(t.i, picked);
              }}
              aria-label={filled ? t.name : `نقطة ${t.i + 1}`}
            >
              {filled ? t.name : t.i + 1}
            </button>
          );
        })}
      </div>

      {!done && (
        <>
          <p className="form-hint">
            اسحب الاسم إلى نقطته — أو اضغط الاسم ثم اضغط النقطة.
          </p>
          <div className="label-tray">
            {remaining.map((l) => (
              <button
                key={l}
                type="button"
                className={`label-chip ${picked === l ? "label-picked" : ""} ${
                  drag?.label === l ? "label-dragging" : ""
                }`}
                onPointerDown={(e) => {
                  (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
                  setDrag({ label: l, x: e.clientX, y: e.clientY });
                }}
                onPointerMove={(e) => {
                  if (drag?.label === l) setDrag({ label: l, x: e.clientX, y: e.clientY });
                }}
                onPointerUp={(e) => {
                  const moved =
                    drag && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 8;
                  const hit = targetAt(e.clientX, e.clientY);
                  setDrag(null);
                  // سحبةٌ حقيقية فوق نقطة ⇐ إفلات؛ ضغطةٌ ثابتة ⇐ تحديد
                  if (hit !== null) assign(hit, l);
                  else if (!moved) setPicked((p) => (p === l ? null : l));
                }}
                onPointerCancel={() => setDrag(null)}
              >
                {items[l].a}
              </button>
            ))}
          </div>
        </>
      )}

      {drag && (
        <span
          className="label-ghost"
          style={{ left: drag.x, top: drag.y }}
          aria-hidden="true"
        >
          {items[drag.label].a}
        </span>
      )}

      {done && <p className="form-ok">🎉 أتممت الصورة كاملة!</p>}
    </div>
  );
}
