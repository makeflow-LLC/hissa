"use client";

import { useMemo, useRef, useState } from "react";
import { shuffle, type GameProps } from "@/components/games/shared";
import { useGameSound } from "@/components/games/useGameSound";
import { normalizeArabic } from "@/lib/arabic";
import ImageFrame from "@/components/ImageFrame";

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

  /**
   * نشاطٌ حُفظ قبل أن تُوضع مواضع أسمائه — **يُقال صراحةً لا يُلعب**.
   *
   * كان الافتراض `x ?? 50` يضع كل النقاط في منتصف الصورة فوق بعضها: لعبةٌ
   * لا تُلعب أصلاً، ولا شيء في الشاشة يفسّر لماذا. والأنشطة القديمة تُشفى
   * بفتحها في المحرّر وحفظها — فالمواضع صارت تُوضع تلقائياً.
   */
  const unplaced = items.some((it) => it.x === undefined || it.y === undefined);

  /** النقاط بترتيبها الأصلي (مواضعها)، والأسماء مخلوطة في الدرج */
  const targets = useMemo(
    () => items.map((it, i) => ({ i, x: it.x ?? 50, y: it.y ?? 50, name: it.a })),
    [items]
  );
  const tray = useMemo(() => shuffle(items.map((_, i) => i)), [items]);

  /**
   * نصف قطر القبول لكل نقطة — **مشتقٌّ من تباعد النقاط لا رقماً ثابتاً**.
   *
   * كان حدّاً أدنى ٥٦ بكسل: على صورةٍ صغيرة أو نقاطٍ متقاربة تقع نقطتان
   * داخل هذا المدى معاً، فيلتقط الإفلاتُ «الأقرب» لا ما قصده الطالب —
   * وهذا بعينه ما يبدو «مطابقةً غير دقيقة». والآن لكل نقطة نصفُ المسافة
   * إلى أقرب جارة لها، فلا يتداخل مداها مع مدى غيرها أبداً.
   */
  const radii = useMemo(() => {
    return targets.map((t) => {
      let nearest = Infinity;
      for (const o of targets) {
        if (o.i === t.i) continue;
        nearest = Math.min(nearest, Math.hypot(o.x - t.x, o.y - t.y));
      }
      return Number.isFinite(nearest) ? nearest / 2 : 100;
    });
  }, [targets]);

  /** أي اسم وُضع على أي نقطة: مفتاحه رقم النقطة */
  const [placed, setPlaced] = useState<Record<number, number>>({});
  const [picked, setPicked] = useState<number | null>(null);
  const [misses, setMisses] = useState(0);
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
  const startRef = useRef({ x: 0, y: 0 });

  const usedLabels = new Set(Object.values(placed));
  const remaining = tray.filter((l) => !usedLabels.has(l));

  function assign(targetIdx: number, labelIdx: number) {
    if (done || placed[targetIdx] !== undefined) return;

    /**
     * المطابقة **بالاسم لا برقم الصفّ**: معلّمٌ يسمّي جزأين بنفس الاسم
     * («ورقة» و«ورقة») كان يرى إفلاتاً صحيحاً يُرفض لأن الرقمين مختلفان،
     * وهو خطأٌ لا يفهمه الطالب ولا يستطيع تجاوزه.
     */
    const ok =
      normalizeArabic(items[targetIdx].a) === normalizeArabic(items[labelIdx].a);

    if (!ok) {
      play("wrong");
      setMisses((m) => m + 1);
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
      const score = scoreOf(items.length, misses);
      if (score === items.length) play("win");
      setTimeout(() => onFinish(score, items.length), 800);
    }
  }

  /**
   * أقرب نقطة إلى موضع الإصبع — **بالبكسل لا بالنسبة المئوية**.
   *
   * المقارنة بالنسب كانت تخلط مقياسين: ١٢٪ من عرض صورة عريضة مسافةٌ
   * أكبر بكثير من ١٢٪ من ارتفاعها، فيتّسع المدى أفقياً ويضيق رأسياً.
   */
  function targetAt(clientX: number, clientY: number): number | null {
    // الإطار = مستطيل الصورة بالضبط (انظر `ImageFrame`)
    const el = boardRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return null;

    let best: number | null = null;
    let bestScore = Infinity;
    for (const t of targets) {
      if (placed[t.i] !== undefined) continue;
      const tx = r.left + (t.x / 100) * r.width;
      const ty = r.top + (t.y / 100) * r.height;
      const d = Math.hypot(tx - clientX, ty - clientY);

      // مدى هذه النقطة بالبكسل، محصورٌ بين هدفٍ يُلمس وهدفٍ لا يبتلع جيرانه
      const spanPx = (radii[t.i] / 100) * Math.min(r.width, r.height);
      const radius = Math.max(26, Math.min(spanPx, 90));
      if (d > radius) continue;
      // النسبة إلى المدى تجعل النقطة الضيّقة تفوز على جارةٍ فضفاضة أبعد
      const rel = d / radius;
      if (rel < bestScore) {
        bestScore = rel;
        best = t.i;
      }
    }
    return best;
  }

  const filledCount = Object.keys(placed).length;

  if (!imageUrl || unplaced) {
    return (
      <div className="game game-labeling">
        <p className="form-error">
          {!imageUrl
            ? "لا صورة لهذا النشاط بعد."
            : "لم تُوضَع مواضع الأسماء على الصورة بعد، فلا يمكن لعبه."}
        </p>
        <p className="form-hint">
          إن كنتَ المعلّم: افتح النشاط في المحرّر — تُوضع النقاط تلقائياً
          موزّعةً على الصورة، اسحب كلّاً منها إلى موضعها ثم احفظ.
        </p>
      </div>
    );
  }

  return (
    <div className="game game-labeling">
      <p className="game-status">
        🏷️ {filledCount} من {items.length}
        {misses > 0 && ` · ✕ ${misses}`}
      </p>

      <div className="label-board">
        <ImageFrame src={imageUrl} frameRef={boardRef}>
            {targets.map((t) => {
              const filled = placed[t.i] !== undefined;
              return (
                <button
                  key={t.i}
                  type="button"
                  className={`label-target ${filled ? "label-filled" : "label-empty"} ${
                    wrongAt === t.i ? "label-shake" : ""
                  } ${drag?.over === t.i ? "label-over" : ""} ${
                    picked !== null && !filled ? "label-open" : ""
                  }`}
                  style={{ left: `${t.x}%`, top: `${t.y}%` }}
                  onClick={() => {
                    if (picked !== null) assign(t.i, picked);
                  }}
                  aria-label={filled ? t.name : "نقطة فارغة"}
                >
                  {/* النقطة الفارغة بلا رقم: رقم الصفّ لا معنى له عند
                      الطالب، ويظهر مبعثراً كلّما امتلأت نقطة */}
                  {filled ? t.name : ""}
                </button>
              );
          })}
        </ImageFrame>
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
                   * بكسلات تبتلع الضغطة فلا يُحدَّد شيء ولا يُوضع شيء.
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

      {done && (
        <p className="form-ok">
          🎉 أتممت الصورة كاملة!
          {misses > 0 && ` (بـ${misses} محاولة خاطئة)`}
        </p>
      )}
    </div>
  );
}

/**
 * الدرجة: عدد الأسماء ناقصاً ثلث المحاولات الخاطئة.
 *
 * كانت اللعبة تعطي العلامة الكاملة دائماً — لأن الإفلات الخاطئ يُرفض ولا
 * يُثبَّت — فيخرج المتقن والمتخبّط بنفس النتيجة وتفقد الدرجة معناها.
 * والخصم رفيقٌ عمداً: التجريب على صورةٍ جديدة جزءٌ من التعلّم لا غشّ.
 */
function scoreOf(n: number, misses: number): number {
  return Math.max(1, n - Math.floor(misses / 3));
}
