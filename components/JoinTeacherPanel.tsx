"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { requestJoin, cancelJoin } from "@/app/actions/student";
import type { FollowStatus } from "@/lib/data/types";

interface Props {
  teacherId: string;
  teacherSlug: string;
  teacherName: string;
  status: FollowStatus;
  /** سبب الرفض إن كتبه المعلّم */
  decisionNote: string;
  /** شروط الانضمام التي كتبها المعلّم مسبقاً */
  joinInstructions: string;
  /** معلّم آخر في المادة نفسها يمنع الانضمام هنا */
  clashTeacher: string;
  isAuthed: boolean;
}

export default function JoinTeacherPanel({
  teacherId,
  teacherSlug,
  teacherName,
  status,
  decisionNote,
  joinInstructions,
  clashTeacher,
  isAuthed,
}: Props) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  if (!isAuthed) {
    return (
      <button
        type="button"
        className="btn btn-outline"
        onClick={() =>
          router.push(`/login?next=${encodeURIComponent(`/teacher/${teacherSlug}`)}`)
        }
      >
        ＋ اطلب الانضمام
      </button>
    );
  }

  function run(fn: () => Promise<{ ok: boolean; message?: string }>) {
    setError("");
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.message ?? "تعذّر تنفيذ الطلب.");
      else {
        setOpen(false);
        setNote("");
      }
      router.refresh();
    });
  }

  if (status === "approved") {
    return (
      <div className="join-panel">
        <span className="join-state join-state-ok">✓ أنت منضمّ إلى هذا المعلّم</span>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          disabled={busy}
          onClick={() => run(() => cancelJoin(teacherId, teacherSlug))}
        >
          إلغاء الانضمام
        </button>
        {error && <p className="form-error">{error}</p>}
      </div>
    );
  }

  if (status === "pending") {
    return (
      <div className="join-panel">
        <span className="join-state join-state-wait">
          ⏳ طلبك قيد المراجعة عند {teacherName}
        </span>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          disabled={busy}
          onClick={() => run(() => cancelJoin(teacherId, teacherSlug))}
        >
          سحب الطلب
        </button>
        {error && <p className="form-error">{error}</p>}
      </div>
    );
  }

  return (
    <div className="join-panel">
      {status === "rejected" && (
        <p className="join-state join-state-no">
          لم يُقبل طلبك السابق.
          {decisionNote ? ` سبب المعلّم: ${decisionNote}` : ""}
        </p>
      )}

      {clashTeacher ? (
        <p className="join-blocked">
          أنت منضمّ إلى <strong>{clashTeacher}</strong> في المادة نفسها. المنصة
          تسمح بمعلّم واحد لكل مادة — ألغِ انضمامك هناك أولاً إن أردت الانتقال.
        </p>
      ) : !open ? (
        <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
          ＋ اطلب الانضمام
        </button>
      ) : (
        <div className="join-form">
          {joinInstructions && (
            <div className="join-terms">
              <h4>شروط الانضمام</h4>
              <p>{joinInstructions}</p>
            </div>
          )}
          <label className="form-field">
            <span className="form-label">رسالة للمعلّم (اختيارية)</span>
            <textarea
              rows={3}
              value={note}
              maxLength={500}
              onChange={(e) => setNote(e.target.value)}
              placeholder="عرّف بنفسك أو اذكر صفّك…"
            />
          </label>
          <div className="form-row">
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy}
              onClick={() => run(() => requestJoin(teacherId, teacherSlug, note))}
            >
              {busy ? "…جارٍ الإرسال" : "إرسال الطلب"}
            </button>
            <button
              type="button"
              className="btn btn-outline"
              disabled={busy}
              onClick={() => setOpen(false)}
            >
              إلغاء
            </button>
          </div>
        </div>
      )}

      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
