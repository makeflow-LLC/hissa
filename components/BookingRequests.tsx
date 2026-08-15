"use client";

import { useActionState } from "react";
import { decideBooking, type BookingState } from "@/app/actions/booking";
import Hint from "@/components/Hint";
import type { BookingRow } from "@/lib/data/queries";

const initial: BookingState = { ok: false };

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

const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "قيد المراجعة", cls: "pill-draft" },
  approved: { label: "موافَق عليه", cls: "pill-live" },
  rejected: { label: "مردود", cls: "pill-muted" },
  cancelled: { label: "ملغى", cls: "pill-muted" },
};

function RequestCard({ b }: { b: BookingRow }) {
  const [state, action, pending] = useActionState(decideBooking, initial);
  const s = STATUS[b.status] ?? STATUS.pending;

  return (
    <li className="exam-card">
      <div className="exam-card-main">
        <h3 className="exam-card-title">🗓 {when(b.startsAt)}</h3>
        <p className="exam-card-meta">
          👤 {b.participants} · 📝 {b.topic}
        </p>
        <p className="exam-card-meta">
          {b.minutes} دقيقة ·{" "}
          {b.price === null
            ? "السعر يُتّفق عليه"
            : b.price === 0
              ? "مجّاناً"
              : `${b.price} ${b.currency}`}
        </p>
        {b.status === "approved" && b.meetUrl && (
          <p className="exam-card-meta">
            🔗{" "}
            <a href={b.meetUrl} target="_blank" rel="noopener noreferrer">
              رابط اللقاء
            </a>
          </p>
        )}
        {b.teacherNote && <p className="exam-card-meta">💬 {b.teacherNote}</p>}

        {b.status === "pending" && (
          <form action={action} className="booking-decide">
            <input type="hidden" name="bookingId" value={b.id} />

            <label className="form-field">
              <span className="form-label">رابط اللقاء (Google Meet)</span>
              <input
                type="url"
                name="meetUrl"
                placeholder="https://meet.google.com/xxx-xxxx-xxx"
                dir="ltr"
              />
            </label>
            <label className="form-field">
              <span className="form-label">ملاحظة للطالب</span>
              <input
                type="text"
                name="note"
                maxLength={500}
                placeholder="مثال: احضر دفتر التمارين — أو سبب الاعتذار"
              />
            </label>

            {/*
              القرار يُحمل على الزرّ نفسه (`name`/`value` للمُرسِل) لا في
              حقلٍ مخفيّ يضبطه `onClick`: تحديث الحالة في React غير متزامن،
              وليس مضموناً أن يبلغ الـDOM قبل انطلاق حدث الإرسال — فيصل
              القرار فارغاً أحياناً.
            */}
            <div className="card-actions">
              <button
                type="submit"
                name="decision"
                value="approved"
                className="btn btn-primary btn-sm"
                disabled={pending}
              >
                ✅ وافق وأرسل الرابط
              </button>
              <button
                type="submit"
                name="decision"
                value="rejected"
                className="btn btn-outline btn-sm"
                disabled={pending}
              >
                ↩︎ اعتذر
              </button>
            </div>
            {state.message && (
              <p className={state.ok ? "form-ok" : "form-error"}>{state.message}</p>
            )}
          </form>
        )}
      </div>
      <div className="exam-card-side">
        <span className={`pill ${s.cls}`}>{s.label}</span>
      </div>
    </li>
  );
}

export default function BookingRequests({ bookings }: { bookings: BookingRow[] }) {
  const pending = bookings.filter((b) => b.status === "pending");
  const decided = bookings.filter((b) => b.status !== "pending");

  return (
    <section>
      <h2 className="section-title">
        📥 طلبات الحجز {pending.length > 0 && <>— {pending.length} بانتظارك</>}
      </h2>
      <Hint>
        الطلب لا يصير حصّةً بمجرّد ضغط الطالب: تقرأه، وتضع رابط اللقاء، ثم
        توافق — فيصل الرابط إلى لوحته، ويظهر له رقمك على واتساب لتنسيق ما
        بقي. والاعتذار قرارٌ كامل أيضاً، فاكتب سببه ليعرف الطالب.
      </Hint>

      {bookings.length === 0 ? (
        <p className="drafts-empty">لا طلبات بعد.</p>
      ) : (
        <ul className="exam-list">
          {[...pending, ...decided].map((b) => (
            <RequestCard key={b.id} b={b} />
          ))}
        </ul>
      )}
    </section>
  );
}
