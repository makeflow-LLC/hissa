"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

function parts(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return {
    d: Math.floor(s / 86400),
    h: Math.floor((s % 86400) / 3600),
    m: Math.floor((s % 3600) / 60),
    s: s % 60,
  };
}

/**
 * عدّاد تنازلي لموعد فتح الاختبار.
 *
 * الطالب يصل قبل الموعد فيجد «لم يفتح بعد» وحدها، فلا يدري أيبقى أم يعود
 * ومتى — فيظلّ يفتح الصفحة كل دقيقة. العدّاد يجيب عن السؤال، ويُنعش
 * الصفحة نفسه لحظةَ بلوغ الصفر فيدخل الاختبار دون أن يفعل شيئاً.
 *
 * زرّ التحديث يبقى معروضاً رغم ذلك: ساعة الجهاز قد تتقدّم أو تتأخّر عن
 * الخادم، والخادم هو من يقرّر الفتح فعلاً.
 */
export default function ExamCountdown({ opensAt }: { opensAt: string }) {
  const router = useRouter();
  const [left, setLeft] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  /**
   * حالة الإنعاش التلقائي: `idle` قبل أول قراءة، `armed` إن كان الموعد
   * في المستقبل عند الفتح، `done` بعد الإنعاش أو إن كان الموعد قد مضى
   * أصلاً.
   *
   * `useRef` لا متغيّر داخل التأثير: `router.refresh()` يُعيد جلب مكوّن
   * الخادم فيُعاد تشغيل التأثير، ومتغيّرٌ محلّي كان يبدأ من الصفر في كل
   * مرّة. ولو تقدّمت ساعة الطالب دقيقةً على الخادم لدارت الصفحة في حلقة
   * إنعاشٍ لا تنتهي تقصف الخادم.
   */
  const auto = useRef<"idle" | "armed" | "done">("idle");

  useEffect(() => {
    const target = new Date(opensAt).getTime();
    if (Number.isNaN(target)) return;

    const tick = () => {
      const ms = target - Date.now();
      setLeft(ms);

      if (auto.current === "idle") auto.current = ms > 0 ? "armed" : "done";
      // بلغ الموعد والصفحة مفتوحة ⇒ إنعاشٌ واحد ليُعيد الخادم فحص النافذة
      if (ms <= 0 && auto.current === "armed") {
        auto.current = "done";
        router.refresh();
      }
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [opensAt, router]);

  const p = left === null ? null : parts(left);
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div className="exam-countdown">
      <p className="exam-countdown-label">⏳ يفتح الاختبار بعد</p>

      {p === null ? (
        <p className="exam-countdown-clock">…</p>
      ) : left !== null && left <= 0 ? (
        <p className="exam-countdown-clock">حان الموعد</p>
      ) : (
        <p className="exam-countdown-clock" dir="ltr">
          {p.d > 0 && <span className="cd-part">{p.d} يوم </span>}
          {pad(p.h)}:{pad(p.m)}:{pad(p.s)}
        </p>
      )}

      <p className="form-hint">
        {left !== null && left <= 0
          ? "اضغط «تحديث» لتبدأ."
          : "أبقِ هذه الصفحة مفتوحة — تُفتح تلقائياً عند الموعد."}
      </p>

      <button
        type="button"
        className="btn btn-primary"
        disabled={refreshing}
        onClick={() => {
          setRefreshing(true);
          router.refresh();
          // مؤشّر بصري قصير: `refresh` لا يُرجع وعداً ننتظره
          setTimeout(() => setRefreshing(false), 1200);
        }}
      >
        {refreshing ? "…جارٍ التحديث" : "🔄 تحديث"}
      </button>
    </div>
  );
}
