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

/** أيّام الأسبوع بترتيب التقويم العربي — الفهرس هو `Date#getDay` */
const DAYS = [
  "الأحد",
  "الاثنين",
  "الثلاثاء",
  "الأربعاء",
  "الخميس",
  "الجمعة",
  "السبت",
];

/** أوقاتٌ جاهزة تغطّي يوم المعلّم من الصباح إلى الليل */
const PRESET_TIMES = [
  "08:00",
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
  "19:00",
  "20:00",
  "21:00",
];

/** «17:00» ⇒ «٥:٠٠ م» — المعلّم يقرأ ساعته لا ساعة الحاسوب */
function timeLabel(t: string): string {
  const [hh, mm] = t.split(":").map(Number);
  const d = new Date(2000, 0, 1, hh || 0, mm || 0);
  return d.toLocaleTimeString("ar", { hour: "numeric", minute: "2-digit" });
}

/** أقرب تاريخٍ قادم ليوم الأسبوع المطلوب (اليوم نفسه إن لم يمضِ) */
function nextDateFor(weekday: number): Date {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  d.setDate(d.getDate() + ((weekday - d.getDay() + 7) % 7));
  return d;
}

/**
 * توليد اللحظات المطلقة **في المتصفّح** — وبإضافة الأيام إلى مكوّن
 * التاريخ لا بجمع ٧×٢٤ ساعة.
 *
 * الفرق ليس تدقيقاً نظرياً: بين أسبوعٍ وأسبوع قد يتغيّر التوقيت الصيفي،
 * فيصير «الخامسة عصراً» رابعةً أو سادسة في بعض النسخ. وبناء التاريخ من
 * مكوّناته يترك للمتصفّح حساب الإزاحة الصحيحة لكل يوم.
 */
function instantFor(weekday: number, time: string, week: number): Date {
  const base = nextDateFor(weekday);
  const [hh, mm] = time.split(":").map(Number);
  return new Date(
    base.getFullYear(),
    base.getMonth(),
    base.getDate() + 7 * week,
    hh || 0,
    mm || 0,
    0,
    0
  );
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

function dayDate(weekday: number): string {
  return nextDateFor(weekday).toLocaleDateString("ar", {
    day: "numeric",
    month: "long",
  });
}

export default function SlotManager({ slots }: { slots: MySlotRow[] }) {
  const [state, action, pending] = useActionState(saveSlots, initial);

  const [days, setDays] = useState<number[]>([]);
  const [times, setTimes] = useState<string[]>([]);
  /** استثناءات من التقاطع: «هذا الوقت في هذا اليوم وحده لا يناسبني» */
  const [skipped, setSkipped] = useState<string[]>([]);
  const [weeks, setWeeks] = useState(2);
  const [custom, setCustom] = useState("");

  const toggle = <T,>(list: T[], v: T): T[] =>
    list.includes(v) ? list.filter((x) => x !== v) : [...list, v];

  /*
    الأيّام والتواريخ تُحسب **بعد التركيب** لا أثناء التصيير: الخادم يعمل
    بـUTC والمتصفّح بتوقيت المعلّم، فحسابها في الطرفين يعطي نصّين مختلفين
    ويكسر الترطيب. (نفس درس `toLocalInput` في نموذج الاختبار.)

    والترتيب يبدأ من **اليوم** لا من الأحد أبداً: الترتيب الثابت كان يضع
    «السبت ١٥ أغسطس» بعد «الجمعة ٢١» — صفٌّ تنزل تواريخه ثم تقفز، فيقرؤه
    المعلّم على أنه خلل.
  */
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const order = useMemo(() => {
    const start = mounted ? new Date().getDay() : 0;
    return Array.from({ length: 7 }, (_, i) => (start + i) % 7);
  }, [mounted]);
  const byWeekOrder = (a: number, b: number) => order.indexOf(a) - order.indexOf(b);

  /** جدول الأسبوع: كل يومٍ مختار وأوقاته، ناقصاً ما استُثني */
  const week = useMemo(
    () =>
      [...days]
        .sort(byWeekOrder)
        .map((d) => ({
          day: d,
          times: [...times].sort().filter((t) => !skipped.includes(`${d}|${t}`)),
        }))
        .filter((r) => r.times.length > 0),
    [days, times, skipped, order]
  );

  const instants = useMemo(() => {
    const out: string[] = [];
    for (let w = 0; w < weeks; w++) {
      for (const row of week) {
        for (const t of row.times) out.push(instantFor(row.day, t, w).toISOString());
      }
    }
    return [...new Set(out)].sort();
  }, [week, weeks]);

  const perWeek = week.reduce((n, r) => n + r.times.length, 0);

  /*
    الاختيار يُمسح بعد الفتح الناجح: بقاؤه يغري بضغطةٍ ثانية تعيد الطلب
    نفسه، فيردّ الخادم «هذه المواعيد مفتوحةٌ عندك أصلاً» — رسالةٌ تبدو
    عطلاً وهي في الحقيقة صحّةٌ في مكانها الخطأ.
  */
  useEffect(() => {
    if (state.ok) {
      setDays([]);
      setTimes([]);
      setSkipped([]);
    }
  }, [state.ok, state.message]);

  const [busy, startTransition] = useTransition();
  const [rowMsg, setRowMsg] = useState("");

  function run(fn: () => Promise<BookingState>) {
    startTransition(async () => {
      const r = await fn();
      setRowMsg(r.message ?? "");
    });
  }

  function addCustom() {
    if (!custom || times.includes(custom)) return;
    setTimes([...times, custom].sort());
    setCustom("");
  }

  return (
    <>
      <form action={action} className="exam-form">
        <input type="hidden" name="slots" value={JSON.stringify(instants)} />

        <Hint>
          فكّر بأيّام أسبوعك لا بالتواريخ: اختر الأيّام التي تُدرّس فيها، ثمّ
          الساعات التي تناسبك — والباقي يُحسب وحده. إن لم يناسبك وقتٌ في يومٍ
          بعينه فاضغطه في «جدول أسبوعك» أسفلُ ليُرفع منه وحده.
        </Hint>

        {/* ①  أيّام الأسبوع */}
        <div className="form-field">
          <span className="form-label">١) أيّام أسبوعك *</span>
          <div className="week-days">
            {order.map((i) => (
              <button
                key={i}
                type="button"
                className={`week-day ${days.includes(i) ? "is-on" : ""}`}
                aria-pressed={days.includes(i)}
                onClick={() => setDays(toggle(days, i))}
              >
                <span className="week-day-name">{DAYS[i]}</span>
                <span className="week-day-date">{mounted ? dayDate(i) : ""}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ②  ساعات اليوم */}
        <div className="form-field">
          <span className="form-label">٢) الساعات المتاحة *</span>
          <div className="time-grid">
            {PRESET_TIMES.map((t) => (
              <button
                key={t}
                type="button"
                className={`time-pick ${times.includes(t) ? "is-on" : ""}`}
                aria-pressed={times.includes(t)}
                onClick={() => setTimes(toggle(times, t))}
              >
                {timeLabel(t)}
              </button>
            ))}
            {times
              .filter((t) => !PRESET_TIMES.includes(t))
              .map((t) => (
                <button
                  key={t}
                  type="button"
                  className="time-pick is-on"
                  aria-pressed="true"
                  onClick={() => setTimes(toggle(times, t))}
                >
                  {timeLabel(t)}
                </button>
              ))}
          </div>
          <div className="slot-time-add">
            <input
              type="time"
              className="search-input"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              aria-label="وقت آخر"
            />
            <button type="button" className="btn btn-outline btn-sm" onClick={addCustom}>
              ➕ وقت آخر
            </button>
          </div>
        </div>

        {/* ③  جدول الأسبوع الناتج */}
        {perWeek > 0 && (
          <div className="form-field">
            <span className="form-label">
              ٣) جدول أسبوعك
              <InfoTip>
                هذا ما سيراه الطالب. اضغط أي وقتٍ هنا لترفعه من يومه وحده — مثلاً
                إن كنت متاحاً الأحد من الخامسة والثلاثاء من السابعة فقط.
              </InfoTip>
            </span>
            <ul className="week-table">
              {[...days]
                .sort(byWeekOrder)
                .map((d) => (
                  <li key={d} className="week-table-row">
                    <span className="week-table-day">{DAYS[d]}</span>
                    <div className="week-table-times">
                      {[...times].sort().map((t) => {
                        const off = skipped.includes(`${d}|${t}`);
                        return (
                          <button
                            key={t}
                            type="button"
                            className={`time-pick ${off ? "is-off" : "is-on"}`}
                            onClick={() => setSkipped(toggle(skipped, `${d}|${t}`))}
                            aria-label={`${off ? "أعِد" : "ارفع"} ${timeLabel(t)} يوم ${DAYS[d]}`}
                          >
                            {timeLabel(t)}
                          </button>
                        );
                      })}
                    </div>
                  </li>
                ))}
            </ul>
          </div>
        )}

        {/* ④  التفاصيل */}
        <div className="form-row">
          <label className="form-field">
            <span className="form-label">مدّة الحصّة (دقيقة)</span>
            <input type="number" name="minutes" min={10} max={480} defaultValue={60} />
          </label>
          <label className="form-field">
            <span className="form-label">
              يتكرّر كم أسبوعاً؟
              <InfoTip>
                ١ يعني هذا الأسبوع وحده. ٤ تفتح الجدول نفسه في الأسابيع الأربعة
                القادمة، فلا تعود إلى هنا كل أسبوع.
              </InfoTip>
            </span>
            <input
              type="number"
              min={1}
              max={12}
              value={weeks}
              onChange={(e) =>
                setWeeks(Math.max(1, Math.min(12, Number(e.target.value) || 1)))
              }
            />
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
          {instants.length > 0 ? (
            <>
              📋 {perWeek} موعداً في الأسبوع × {weeks} ={" "}
              <strong>{instants.length} موعداً</strong> — أوّلها{" "}
              {when(instants[0])}
            </>
          ) : (
            "اختر يوماً وساعةً على الأقل."
          )}
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
