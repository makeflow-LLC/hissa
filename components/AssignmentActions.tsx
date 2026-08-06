"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  setAssignmentStatus,
  deleteAssignment,
} from "@/app/actions/assignments";

/** نشر الواجب أو سحبه أو حذفه، من صفحته */
export default function AssignmentActions({
  id,
  status,
  title,
}: {
  id: string;
  status: string;
  title: string;
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [err, setErr] = useState("");
  const published = status === "published";

  return (
    <div className="card-actions">
      <button
        type="button"
        className={`btn btn-sm ${published ? "btn-outline" : "btn-primary"}`}
        disabled={busy}
        onClick={() =>
          start(async () => {
            const r = await setAssignmentStatus(id, published ? "draft" : "published");
            if (!r.ok) setErr(r.message ?? "تعذّر التغيير.");
            router.refresh();
          })
        }
      >
        {published ? "📥 اسحب إلى مسودّة" : "📢 انشر لطلابي"}
      </button>
      <button
        type="button"
        className="btn btn-outline btn-sm btn-danger"
        disabled={busy}
        onClick={() =>
          start(async () => {
            if (!window.confirm(`حذف واجب «${title}» وتسليماته؟`)) return;
            await deleteAssignment(id);
            router.push("/teacher/me/assignments");
          })
        }
      >
        🗑 حذف
      </button>
      {err && <span className="form-error">{err}</span>}
    </div>
  );
}
