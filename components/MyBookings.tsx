"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { cancelBooking } from "@/app/actions/booking";
import type { BookingRow } from "@/lib/data/queries";

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
  pending: { label: "قيد مراجعة المعلّم", cls: "pill-draft" },
  approved: { label: "مؤكَّد ✅", cls: "pill-live" },
  rejected: { label: "اعتذر المعلّم", cls: "pill-muted" },
  cancelled: { label: "ملغى", cls: "pill-muted" },
};

export default function MyBookings({ bookings }: { bookings: BookingRow[] }) {
  const [busy, startTransition] = useTransition();
  const [msg, setMsg] = useState("");

  return (
    <ul className="exam-list">
      {bookings.map((b) => {
        const s = STATUS[b.status] ?? STATUS.pending;
        const wa = (b.whatsapp ?? "").replace(/[^0-9]/g, "");
        return (
          <li key={b.id} className="exam-card">
            <div className="exam-card-main">
              <h3 className="exam-card-title">🗓 {when(b.startsAt)}</h3>
              <p className="exam-card-meta">
                {b.teacherSlug ? (
                  <Link href={`/teacher/${b.teacherSlug}`}>👩‍🏫 {b.teacherName}</Link>
                ) : (
                  <>👩‍🏫 {b.teacherName}</>
                )}{" "}
                · {b.minutes} دقيقة ·{" "}
                {b.price === null
                  ? "السعر يُتّفق عليه"
                  : b.price === 0
                    ? "مجّاناً"
                    : `${b.price} ${b.currency}`}
              </p>
              <p className="exam-card-meta">📝 {b.topic}</p>
              {b.teacherNote && <p className="exam-card-meta">💬 {b.teacherNote}</p>}

              {b.status === "approved" && (
                <div className="card-actions">
                  {b.meetUrl && (
                    <a
                      href={b.meetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-primary btn-sm"
                    >
                      🎥 ادخل اللقاء
                    </a>
                  )}
                  {/* الرقم يُكشف بعد الموافقة وحدها — لتنسيق السعر وما بقي */}
                  {wa && (
                    <a
                      href={`https://wa.me/${wa}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-whatsapp btn-sm"
                    >
                      💬 نسّق مع المعلّم
                    </a>
                  )}
                </div>
              )}

              {b.status === "pending" && (
                <div className="card-actions">
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    disabled={busy}
                    onClick={() =>
                      startTransition(async () => {
                        const r = await cancelBooking(b.id);
                        setMsg(r.message ?? "");
                      })
                    }
                  >
                    ألغِ الطلب
                  </button>
                </div>
              )}
            </div>
            <div className="exam-card-side">
              <span className={`pill ${s.cls}`}>{s.label}</span>
            </div>
          </li>
        );
      })}
      {msg && <p className="form-hint">{msg}</p>}
    </ul>
  );
}
