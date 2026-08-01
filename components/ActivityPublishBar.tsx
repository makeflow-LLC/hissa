"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setActivityStatus } from "@/app/actions/activities";

/** نشر النشاط لطلابه أو إعادته مسودّة */
export default function ActivityPublishBar({
  activityId,
  status,
}: {
  activityId: string;
  status: "draft" | "published";
}) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  function run(publish: boolean) {
    setMsg("");
    setErr("");
    startTransition(async () => {
      const res = await setActivityStatus(activityId, publish);
      if (res.ok) setMsg(res.message ?? "");
      else setErr(res.message ?? "تعذّر تنفيذ الأمر.");
      router.refresh();
    });
  }

  return (
    <div className="exam-publish-bar">
      <div className="card-actions">
        {status === "published" ? (
          <>
            <span className="pill pill-live">✓ منشور لطلابك</span>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              disabled={busy}
              onClick={() => run(false)}
            >
              إعادته مسودّة
            </button>
          </>
        ) : (
          <>
            <span className="pill pill-draft">مسودّة — لا يراها أحد</span>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={busy}
              onClick={() => run(true)}
            >
              🚀 انشر النشاط
            </button>
          </>
        )}
      </div>

      {msg && <p className="form-ok">{msg}</p>}
      {err && <p className="form-error">{err}</p>}
    </div>
  );
}
