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
  const [drag, setDrag] = useState<{
    label: number;
    x: number;
    y: number;
    /** بَعُدت الإصبع عن نقطة البدء؟ حينها هي سحبةٌ لا ضغطة */
    moved: boolean;
    /** النقطة التي ستستقبل الإفلات لو رُفعت الإصبع الآن */
    over: number | null;
  } | null>(null);
  const [done, setDone] = useState(false);
  const boardRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const startRef = useRef({ x: 0, y: 0 });

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

  /**
   * أقرب نقطة إلى موضع الإصبع — **بالبكسل لا بالنسبة المئوية**.
   *
   * المقارنة بالنسب كانت تخلط مقياسين: ١٢٪ من عرض صورة عريضة مسافةٌ
   * أكبر بكثير من ١٢٪ من ارتفاعها، فيتّسع المدى أفقياً ويضيق رأسياً
   * ويبدو السحب «غير دقيق» — يُصيب أحياناً ويُخطئ أحياناً بلا سبب ظاهر.
   * والقياس بالبكسل واحدٌ في الاتجاهين.
   */
  function targetAt(clientX: number, clientY: number): number | null {
    // مستطيل **الصورة** لا الإطار: حدّ الإطار بكسلٌ يزيح الأصل والمقياس
    const el = imgRef.current ?? boardRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return null;

    let best: number | null = null;
    let bestD = Infinity;
    for (const t of targets) {
      if (placed[t.i] !== undefined) continue;
      const tx = r.left + (t.x / 100) * r.width;
      const ty = r.top + (t.y / 100) * r.height;
      const d = Math.hypot(tx - clientX, ty - clientY);
      if (d < bestD) {
        bestD = d;
        best = t.i;
      }
    }
    // نصف قطر سخيّ يغفر ارتعاش الإصبع، ولا يقلّ عن مقاس هدفٍ يُلمس
    const radius = Math.max(56, Math.min(r.width, r.height) * 0.18);
    return bestD <= radius ? best : null;
  }

  return (
    <div className="game game-labeling">
      <p className="game-status">
        🏷️ {Object.keys(placed).length} من {items.length}
      </p>

      <div className="label-board" ref={boardRef}>
        {imageUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            ref={imgRef}
            src={imageUrl}
            alt=""
            className="label-image"
            draggable={false}
          />
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
              } ${drag?.over === t.i ? "label-over" : ""} ${
                picked !== null && !filled ? "label-open" : ""
              }`}
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
                  e.currentTarget.setPointerCapture?.(e.pointerId);
                  startRef.current = { x: e.clientX, y: e.clientY };
                  setDrag({ label: l, x: e.clientX, y: e.clientY, moved: false, over: null });
                }}
                onPointerMove={(e) => {
                  if (drag?.label !== l) return;
                  const moved =
                    Math.hypot(
                      e.clientX - startRef.current.x,
                      e.clientY - startRef.current.y
                    ) > 10;
                  setDrag({
                    label: l,
                    x: e.clientX,
                    y: e.clientY,
                    moved: drag.moved || moved,
                    over: targetAt(e.clientX, e.clientY),
                  });
                }}
                onPointerUp={(e) => {
                  const wasMoved = drag?.moved ?? false;
                  const hit = targetAt(e.clientX, e.clientY);
                  setDrag(null);

                  if (hit !== null) {
                    assign(hit, l);
                    return;
                  }
                  /**
                   * السحبة التي لم تصب هدفاً **تُبقي الاسم محدَّداً** بدل
                   * أن تضيع: كان الشرط `!moved` يعني أن ارتعاشة إصبع ١٠
                   * بكسلات تبتلع الضغطة فلا يُحدَّد شيء ولا يُوضع شيء —
                   * وهو ما يبدو للطالب عطلاً في التحديد.
                   * والضغطة على اسمٍ محدَّد أصلاً تُلغي تحديده (تراجُع).
                   */
                  setPicked((p) => (p === l && !wasMoved ? null : l));
                }}
                onPointerCancel={() => setDrag(null)}
              >
                {items[l].a}
              </button>
            ))}
          </div>
        </>
      )}

      {/* الشريحة الطائرة **على الإصبع تماماً**: لو رُسمت فوقه لاختلف ما
          يراه الطالب عن الموضع الذي يُحتسب عند الإفلات */}
      {drag?.moved && (
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
