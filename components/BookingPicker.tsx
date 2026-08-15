"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { requestBooking, type BookingState } from "@/app/actions/booking";
import type { SlotRow } from "@/lib/data/queries";

const initial: BookingState = { ok: false };

function dayKey(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function dayLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("ar", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString("ar", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function priceLabel(s: SlotRow): string {
  if (s.price === null) return "السعر يُتّفق عليه";
  if (s.price === 0) return "مجّاناً";
  return `${s.price} ${s.currency}`;
}

/**
 * اختيار موعد على غرار Calendly: يومٌ ثمّ وقت، لا قائمةً طويلة.
 *
 * الأزرار بمساحةٍ يبلغها الإبهام: جمهورنا على الهواتف، وقائمة `select`
 * بعشرين موعداً تعني فتحَ قائمةٍ والتمرير فيها لاختيار الساعة الخامسة.
 */
export default function BookingPicker({
  teacherId,
  teacherSlug,
  teacherName,
  slots,
  isAuthed,
  isTeacherAccount,
  defaultName,
  whatsapp,
  phone,
}: {
  teacherId: string;
  teacherSlug: string;
  teacherName: string;
  slots: SlotRow[];
  isAuthed: boolean;
  isTeacherAccount: boolean;
  /** اسم الطالب من ملفّه — يُملأ سلفاً ويبقى قابلاً للتعديل */
  defaultName: string;
  /**
   * رقما التواصل — يصلان فارغين ما لم يأذن المعلّم **وما لم يكن القارئ
   * مسجّلاً**. الترشيح يقع في الخادم لا هنا: قيمةٌ تصل المتصفّح قد
   * تُقرأ من مصدر الصفحة مهما أخفتها الواجهة.
   */
  whatsapp: string;
  phone: string;
}) {
  const [state, action, pending] = useActionState(requestBooking, initial);
  const [chosenDay, setChosenDay] = useState<string>("");
  const [chosenSlot, setChosenSlot] = useState<string>("");

  const days = useMemo(() => {
    const map = new Map<string, SlotRow[]>();
    for (const s of slots) {
      const k = dayKey(s.startsAt);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(s);
    }
    return [...map.entries()].map(([key, list]) => ({
      key,
      label: dayLabel(list[0].startsAt),
      free: list.filter((s) => !s.taken).length,
      list,
    }));
  }, [slots]);

  const activeDay = days.find((d) => d.key === chosenDay) ?? days[0];
  const slot = slots.find((s) => s.id === chosenSlot) ?? null;

  const waDigits = whatsapp.replace(/[^0-9]/g, "");
  const telDigits = phone.replace(/[^0-9+]/g, "");
  const hasContact = Boolean(waDigits || telDigits);

  if (slots.length === 0) return null;

  return (
    <section className="booking-box">
      <h2 className="section-title">🗓 احجز حصّة مباشرة</h2>
      <p className="booking-intro">
        اختر موعداً من مواعيد المعلّم المتاحة، واكتب موضوع الحصّة. يصل الطلب
        إلى المعلّم للمراجعة، وعند موافقته يصلك رابط اللقاء ورقمه على واتساب
        لتنسيق ما بقي.
      </p>

      {/*
        السؤال قبل الحجز: «هل تشرح هذا الدرس؟»، «هل يناسبك وقتٌ آخر؟».
        وبلا وسيلةٍ للسؤال يحجز الطالب على الظنّ أو ينصرف.
      */}
      {hasContact && (
        <div className="booking-contact">
          <span className="booking-contact-label">
            سؤالٌ قبل الحجز؟ راسل {teacherName}:
          </span>
          <div className="card-actions">
            {waDigits && (
              <a
                href={`https://wa.me/${waDigits}?text=${encodeURIComponent(
                  "السلام عليكم، عندي سؤال عن حجز حصّة."
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-whatsapp btn-sm"
              >
                💬 واتساب
              </a>
            )}
            {telDigits && (
              <a href={`tel:${telDigits}`} className="btn btn-outline btn-sm">
                📞 {phone}
              </a>
            )}
          </div>
        </div>
      )}

      <div className="booking-days">
        {days.map((d) => (
          <button
            key={d.key}
            type="button"
            className={`booking-day ${activeDay?.key === d.key ? "is-active" : ""}`}
            onClick={() => {
              setChosenDay(d.key);
              setChosenSlot("");
            }}
          >
            <span className="booking-day-label">{d.label}</span>
            <span className="booking-day-free">
              {d.free > 0 ? `${d.free} موعداً متاحاً` : "لا متاح"}
            </span>
          </button>
        ))}
      </div>

      <div className="booking-times">
        {activeDay?.list.map((s) => (
          <button
            key={s.id}
            type="button"
            disabled={s.taken}
            className={`booking-time ${chosenSlot === s.id ? "is-active" : ""}`}
            onClick={() => setChosenSlot(s.id)}
          >
            <strong>{timeLabel(s.startsAt)}</strong>
            <span>{s.taken ? "محجوز" : `${s.minutes} دقيقة`}</span>
          </button>
        ))}
      </div>

      {slot && (
        <div className="booking-chosen">
          <p className="booking-chosen-line">
            ✅ {dayLabel(slot.startsAt)} — {timeLabel(slot.startsAt)} ·{" "}
            {slot.minutes} دقيقة · {priceLabel(slot)}
          </p>
          {slot.note && <p className="booking-chosen-note">{slot.note}</p>}

          {!isAuthed ? (
            <Link
              href={`/login?next=${encodeURIComponent(`/teacher/${teacherSlug}`)}`}
              className="btn btn-primary"
            >
              سجّل الدخول لتحجز
            </Link>
          ) : isTeacherAccount ? (
            <p className="form-hint">حساب المعلّم لا يحجز عند معلّم آخر.</p>
          ) : (
            <form action={action} className="exam-form">
              <input type="hidden" name="slotId" value={slot.id} />
              <input type="hidden" name="teacherId" value={teacherId} />
              <input type="hidden" name="slug" value={teacherSlug} />

              <label className="form-field">
                <span className="form-label">اسم الطالب أو الطلاب *</span>
                <input
                  type="text"
                  name="participants"
                  defaultValue={defaultName}
                  maxLength={300}
                  placeholder="مثال: أحمد خالد — أو: أحمد ومريم"
                  required
                />
              </label>

              <label className="form-field">
                <span className="form-label">موضوع الحصّة *</span>
                <input
                  type="text"
                  name="topic"
                  maxLength={300}
                  placeholder="مثال: مراجعة الوحدة الثالثة — المعادلات"
                  required
                />
              </label>

              <div className="card-actions">
                <button type="submit" className="btn btn-primary" disabled={pending}>
                  {pending ? "…جارٍ الإرسال" : "📩 أرسل طلب الحجز"}
                </button>
              </div>

              {state.message && (
                <p className={state.ok ? "form-ok" : "form-error"}>{state.message}</p>
              )}
            </form>
          )}
        </div>
      )}
    </section>
  );
}
