"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  requestReportCard,
  cancelReportCardRequest,
} from "@/app/actions/student";
import type { MyCardRequest } from "@/lib/data/types";

/**
 * طلب الطالب بطاقة تقييم من معلّم انضمّ إليه.
 * البطاقة كانت تصدر بمبادرة المعلّم وحده، فمن أرادها لوليّ أمره لم يجد
 * سبيلاً لطلبها داخل المنصة.
 */
export default function RequestReportCard({
  teachers,
  myRequests,
}: {
  /** المعلّمون المنضمّ إليهم — هم وحدهم من يجوز طلب بطاقة منهم */
  teachers: { id: string; name: string }[];
  myRequests: MyCardRequest[];
}) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  if (teachers.length === 0) return null;

  const pendingNames = new Set(
    myRequests.filter((r) => r.status === "pending").map((r) => r.teacherName)
  );

  function run(fn: () => Promise<{ ok: boolean; message?: string }>) {
    setErr("");
    setMsg("");
    startTransition(async () => {
      const res = await fn();
      if (res.ok) setMsg(res.message ?? "");
      else setErr(res.message ?? "تعذّر تنفيذ الطلب.");
      router.refresh();
    });
  }

  return (
    <div className="card-request-block">
      <div className="card-actions">
        {teachers.map((t) => {
          const waiting = pendingNames.has(t.name);
          return (
            <button
              key={t.id}
              type="button"
              className="btn btn-outline btn-sm"
              disabled={busy || waiting}
              onClick={() => run(() => requestReportCard(t.id))}
            >
              {waiting ? `⏳ طلب معلّق عند ${t.name}` : `🏅 اطلب بطاقة من ${t.name}`}
            </button>
          );
        })}
      </div>

      {myRequests.length > 0 && (
        <ul className="join-status-list">
          {myRequests.map((r) => (
            <li key={r.id} className="join-status-row">
              <span className="join-status-name">{r.teacherName}</span>
              {r.status === "pending" ? (
                <>
                  <span className="pill pill-draft">⏳ بانتظار معلّمك</span>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    disabled={busy}
                    onClick={() => run(() => cancelReportCardRequest(r.id))}
                  >
                    سحب
                  </button>
                </>
              ) : r.status === "done" ? (
                <span className="pill pill-live">✓ صدرت البطاقة</span>
              ) : (
                <span className="pill pill-low">أُغلق الطلب</span>
              )}
            </li>
          ))}
        </ul>
      )}

      {msg && <p className="form-ok">{msg}</p>}
      {err && <p className="form-error">{err}</p>}
    </div>
  );
}
