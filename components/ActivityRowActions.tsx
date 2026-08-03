"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { duplicateActivity, deleteActivity } from "@/app/actions/activities";

/** استنساخ النشاط أو حذفه، من صفّه في القائمة */
export default function ActivityRowActions({
  activityId,
  title,
  onDeleted,
}: {
  activityId: string;
  title: string;
  /** يُخفي الصفّ فوراً — لا ينتظر وصول صفحةٍ جديدة من الخادم */
  onDeleted?: () => void;
}) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [err, setErr] = useState("");

  return (
    <>
      <button
        type="button"
        className="btn btn-outline btn-sm"
        disabled={busy}
        onClick={() => {
          setErr("");
          startTransition(async () => {
            const res = await duplicateActivity(activityId);
            if (res.ok && res.activityId)
              router.push(`/teacher/me/activities/${res.activityId}`);
            else setErr(res.message ?? "تعذّر الاستنساخ.");
            router.refresh();
          });
        }}
      >
        📄 استنساخ
      </button>
      <button
        type="button"
        className="btn btn-outline btn-sm btn-danger"
        disabled={busy}
        onClick={() => {
          if (!window.confirm(`حذف نشاط «${title}» ونتائجه؟`)) return;
          setErr("");
          startTransition(async () => {
            const res = await deleteActivity(activityId);
            if (res.ok) onDeleted?.();
            else setErr(res.message ?? "تعذّر الحذف.");
            router.refresh();
          });
        }}
      >
        {busy ? "…" : "🗑"}
      </button>
      {err && <span className="form-error">{err}</span>}
    </>
  );
}
