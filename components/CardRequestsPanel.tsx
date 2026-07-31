"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { decideCardRequest } from "@/app/actions/teacher-groups";
import type { CardRequest } from "@/lib/data/types";

/** طلبات الطلاب لبطاقات التقييم، معروضة على المعلّم ليبتّ فيها */
export default function CardRequestsPanel({
  requests,
}: {
  requests: CardRequest[];
}) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [err, setErr] = useState("");

  if (requests.length === 0) return null;

  function decide(id: string, done: boolean) {
    setErr("");
    startTransition(async () => {
      const res = await decideCardRequest(id, done);
      if (!res.ok) setErr(res.message ?? "تعذّر حفظ القرار.");
      router.refresh();
    });
  }

  return (
    <div className="requests-list">
      {requests.map((r) => (
        <article key={r.id} className="request-card">
          <div className="student-info">
            <span className="student-name">🏅 {r.studentName}</span>
            <span className="student-meta">
              يطلب بطاقة تقييم ·{" "}
              {new Date(r.createdAt).toLocaleDateString("ar-EG", {
                day: "numeric",
                month: "long",
              })}
            </span>
          </div>
          <div className="form-row">
            {/* الإصدار نفسه من بطاقة الطالب بالأسفل — هنا نغلق الطلب فقط */}
            <button
              type="button"
              className="btn btn-outline btn-sm"
              disabled={busy}
              onClick={() => decide(r.id, true)}
            >
              ✓ عُلّم منجزاً
            </button>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              disabled={busy}
              onClick={() => decide(r.id, false)}
            >
              إغلاق
            </button>
          </div>
        </article>
      ))}
      {err && <p className="form-error">{err}</p>}
    </div>
  );
}
