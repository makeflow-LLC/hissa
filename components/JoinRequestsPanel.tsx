"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { decideJoinRequest } from "@/app/actions/teacher-groups";
import type { JoinRequest } from "@/lib/data/types";

export default function JoinRequestsPanel({
  requests,
}: {
  requests: JoinRequest[];
}) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  function decide(studentId: string, approve: boolean, reason = "") {
    setError("");
    startTransition(async () => {
      const res = await decideJoinRequest(studentId, approve, reason);
      if (!res.ok) setError(res.message ?? "تعذّر حفظ القرار.");
      else {
        setRejecting(null);
        setNote("");
      }
      router.refresh();
    });
  }

  if (requests.length === 0) return null;

  return (
    <div className="requests-list">
      {requests.map((r) => (
        <article key={r.studentId} className="request-card">
          <div className="student-main">
            {r.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={r.avatarUrl} alt="" className="student-avatar" />
            ) : (
              <span className="student-avatar student-avatar-fallback">🎓</span>
            )}
            <div className="student-info">
              <span className="student-name">{r.name}</span>
              <span className="student-meta">
                {r.grade || "الصف غير محدّد"}
                {r.school && <> · {r.school}</>}
                {r.city && <> · {r.city}</>}
              </span>
              <span className="student-meta">
                طلب في{" "}
                {new Date(r.requestedAt).toLocaleDateString("ar-EG", {
                  day: "numeric",
                  month: "long",
                })}
              </span>
            </div>
          </div>

          {r.note && <p className="request-note">«{r.note}»</p>}

          {rejecting === r.studentId ? (
            <div className="join-form">
              <label className="form-field">
                <span className="form-label">سبب الرفض (اختياري — يراه الطالب)</span>
                <input
                  type="text"
                  value={note}
                  maxLength={300}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="مثلاً: الصف مكتمل هذا الفصل"
                />
              </label>
              <div className="form-row">
                <button
                  type="button"
                  className="btn btn-outline btn-sm btn-danger"
                  disabled={busy}
                  onClick={() => decide(r.studentId, false, note)}
                >
                  تأكيد الرفض
                </button>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  disabled={busy}
                  onClick={() => setRejecting(null)}
                >
                  تراجع
                </button>
              </div>
            </div>
          ) : (
            <div className="form-row">
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={busy}
                onClick={() => decide(r.studentId, true)}
              >
                ✓ قبول
              </button>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                disabled={busy}
                onClick={() => {
                  setRejecting(r.studentId);
                  setNote("");
                }}
              >
                رفض
              </button>
            </div>
          )}
        </article>
      ))}
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
