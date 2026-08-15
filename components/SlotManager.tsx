"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import {
  deleteSlot,
  saveSlots,
  setSlotOpen,
  type BookingState,
} from "@/app/actions/booking";
import Hint from "@/components/Hint";
import InfoTip from "@/components/InfoTip";
import type { MySlotRow } from "@/lib/data/queries";

const initial: BookingState = { ok: false };

function today(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * توليد اللحظات المطلقة **في المتصفّح** — وبإضافة الأيام إلى مكوّن
 * التاريخ لا بجمع ٧×٢٤ ساعة.
 *
 * الفرق ليس تدقيقاً نظرياً: بين أسبوعٍ وأسبوع قد يتغيّر التوقيت الصيفي،
 * فيصير «الخامسة عصراً» رابعةً أو سادسة في بعض النسخ. وبناء التاريخ من
 * مكوّناته يترك للمتصفّح حساب الإزاحة الصحيحة لكل يوم.
 */
function buildInstants(date: string, times: string[], weeks: number): string[] {
  if (!date || times.length === 0) return [];
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) return [];
  const out: string[] = [];
  for (let w = 0; w < weeks; w++) {
    for (const t of times) {
      const [hh, mm] = t.split(":").map(Number);
      const dt = new Date(y, m - 1, d + 7 * w, hh || 0, mm || 0, 0, 0);
      if (!Number.isNaN(dt.getTime())) out.push(dt.toISOString());
    }
  }
  return out.sort();
}

function when(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString("ar", {
        weekday: "long",
        day: "numeric",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
      });
}

export default function SlotManager({ slots }: { slots: MySlotRow[] }) {
  const [state, action, pending] = useActionState(saveSlots, initial);

  const [date, setDate] = useState(today());
  const [time, setTime] = useState("17:00");
  const [times, setTimes] = useState<string[]>([]);
  const [weeks, setWeeks] = useState(1);

  const instants = useMemo(
    () => buildInstants(date, times, weeks),
    [date, times, weeks]
  );

  /*
    الأوقات تُمسح بعد الفتح الناجح: بقاؤها يغري بضغطةٍ ثانية تعيد الطلب
    نفسه، فيردّ الخادم «هذه المواعيد مفتوحةٌ عندك أصلاً» — رسالةٌ تبدو
    عطلاً وهي في الحقيقة صحّةٌ في مكانها الخطأ.
  */
  useEffect(() => {
    if (state.ok) setTimes([]);
  }, [state.ok, state.message]);

  const [busy, startTransition] = useTransition();
  const [rowMsg, setRowMsg] = useState("");

  function run(fn: () => Promise<BookingState>) {
    startTransition(async () => {
      const r = await fn();
      setRowMsg(r.message ?? "");
    });
  }

  function addTime() {
    if (!time || times.includes(time)) return;
    setTimes([...times, time].sort());
  }

  return (
    <>
      <form action={action} className="exam-form">
        <input type="hidden" name="slots" value={JSON.stringify(instants)} />

        <Hint>
          افتح مواعيدك مسبقاً كما تفعل في أي تقويم: اختر اليوم، أضف الأوقات
          التي تناسبك فيه، وكرّرها لعدّة أسابيع إن كانت ثابتة. الطالب يرى
          المتاح منها ويضغطه، ولا يصير الموعد حصّةً حتى توافق أنت.
        </Hint>

        <div className="form-row">
          <label className="form-field">
            <span className="form-label">اليوم *</span>
            <input
              type="date"
              value={date}
              min={today()}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </label>
          <label className="form-field">
            <span className="form-label">
              يتكرّر كم أسبوعاً؟
              <InfoTip>
                ١ يعني هذا اليوم وحده. ٤ تفتح الموعد نفسه في اليوم نفسه من
                الأسابيع الأربعة القادمة.
              </InfoTip>
            </span>
            <input
              type="number"
              min={1}
              max={12}
              value={weeks}
              onChange={(e) => setWeeks(Math.max(1, Math.min(12, Number(e.target.value) || 1)))}
            />
          </label>
        </div>

        <div className="form-field">
          <span className="form-label">أوقات ذلك اليوم *</span>
          <div className="slot-time-add">
            <input
              type="time"
              className="search-input"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
            <button type="button" className="btn btn-outline btn-sm" onClick={addTime}>
              ➕ أضف وقتاً
            </button>
          </div>
          {times.length > 0 && (
            <div className="slot-chips">
              {times.map((t) => (
                <button
                  key={t}
                  type="button"
                  className="slot-chip"
                  onClick={() => setTimes(times.filter((x) => x !== t))}
                  aria-label={`احذف ${t}`}
                >
                  {t} <span aria-hidden="true">×</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="form-row">
          <label className="form-field">
            <span className="form-label">مدّة الحصّة (دقيقة)</span>
            <input type="number" name="minutes" min={10} max={480} defaultValue={60} />
          </label>
          <label className="form-field">
            <span className="form-label">
              السعر — اختياريّ
              <InfoTip>
                اتركه فارغاً ليظهر «السعر يُتّفق عليه»، أو اكتب ٠ للحصّة
                المجانية. المنصّة لا تحصّل مالاً ولا تسجّل دفعاً: الرقم هنا
                إعلانٌ منك، والتنسيق يقع بينك وبين الطالب على واتساب.
              </InfoTip>
            </span>
            <input
              type="number"
              name="price"
              min={0}
              step={0.5}
              placeholder="يُتّفق عليه"
            />
          </label>
          <label className="form-field">
            <span className="form-label">العملة</span>
            <input type="text" name="currency" defaultValue="ILS" maxLength={8} />
          </label>
        </div>

        <label className="form-field">
          <span className="form-label">ملاحظة تظهر مع الموعد</span>
          <input
            type="text"
            name="note"
            maxLength={200}
            placeholder="مثال: حصّة تقوية — عبر Google Meet"
          />
        </label>

        <p className="form-hint">
          {instants.length > 0
            ? `سيُفتح ${instants.length} موعداً — أوّلها ${when(instants[0])}`
            : "أضف وقتاً واحداً على الأقل."}
        </p>

        <div className="card-actions">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={pending || instants.length === 0}
          >
            {pending ? "…جارٍ الفتح" : "🗓 افتح هذه المواعيد"}
          </button>
        </div>

        {state.message && (
          <p className={state.ok ? "form-ok" : "form-error"}>{state.message}</p>
        )}
      </form>

      <h2 className="section-title">📅 مواعيدك القادمة</h2>
      {rowMsg && <p className="form-hint">{rowMsg}</p>}

      {slots.length === 0 ? (
        <p className="drafts-empty">لا مواعيد مفتوحة. افتح أوّل موعد من الأعلى.</p>
      ) : (
        <ul className="slot-list">
          {slots.map((s) => (
            <li key={s.id} className="slot-row">
              <div className="slot-row-main">
                <strong>{when(s.startsAt)}</strong>
                <span className="slot-row-meta">
                  {s.minutes} دقيقة ·{" "}
                  {s.price === null
                    ? "السعر يُتّفق عليه"
                    : s.price === 0
                      ? "مجّاناً"
                      : `${s.price} ${s.currency}`}
                  {s.note ? ` · ${s.note}` : ""}
                </span>
                {s.booking && (
                  <span className="slot-row-meta">
                    👤 {s.booking.participants} — {s.booking.topic}
                  </span>
                )}
              </div>
              <div className="slot-row-side">
                {s.booking ? (
                  <span
                    className={`pill ${s.booking.status === "approved" ? "pill-live" : "pill-draft"}`}
                  >
                    {s.booking.status === "approved" ? "محجوز ✅" : "طلبٌ قيد المراجعة"}
                  </span>
                ) : s.isOpen ? (
                  <span className="pill pill-live">متاح</span>
                ) : (
                  <span className="pill pill-draft">مغلق</span>
                )}
                {!s.booking && (
                  <div className="card-actions">
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      disabled={busy}
                      onClick={() => run(() => setSlotOpen(s.id, !s.isOpen))}
                    >
                      {s.isOpen ? "أغلقه" : "افتحه"}
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      disabled={busy}
                      onClick={() => run(() => deleteSlot(s.id))}
                    >
                      حذف
                    </button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
