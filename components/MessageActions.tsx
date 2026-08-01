"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { askTeacher, dismissMessage } from "@/app/actions/student";

/**
 * ما يفعله الطالب برسالة وصلته: يردّ عليها، أو يزيلها من قائمته.
 *
 * الإزالة ليست حذفاً من الجدول حين تكون الرسالة تعميماً: الصفّ واحد
 * يقرؤه كل أعضاء المجموعة، فالطالب يسجّل إخفاءً يخصّه (انظر
 * `dismissMessage`). أمّا رسالته هو فتُحذف فعلاً.
 */
export default function MessageActions({
  messageId,
  teacherId,
  teacherSlug,
  teacherName,
  canReply,
}: {
  messageId: string;
  teacherId: string;
  teacherSlug: string;
  teacherName: string;
  /** رسالة الطالب نفسه لا يُردّ عليها */
  canReply: boolean;
}) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [err, setErr] = useState("");

  function run(fn: () => Promise<{ ok: boolean; message?: string }>, after?: () => void) {
    setErr("");
    startTransition(async () => {
      const res = await fn();
      if (res.ok) after?.();
      else setErr(res.message ?? "تعذّر تنفيذ الأمر.");
      router.refresh();
    });
  }

  return (
    <div className="message-actions">
      <div className="card-actions">
        {canReply && (
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => setOpen((v) => !v)}
          >
            ↩️ ردّ
          </button>
        )}
        <button
          type="button"
          className="btn btn-outline btn-sm btn-danger"
          disabled={busy}
          onClick={() => run(() => dismissMessage(messageId))}
          title="تختفي من قائمتك أنت وحدك"
        >
          🗑 إزالة
        </button>
      </div>

      {open && (
        <div className="member-msg">
          <textarea
            className="search-input"
            rows={2}
            maxLength={1000}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={`ردّك على ${teacherName}…`}
            aria-label="نص الردّ"
          />
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={busy || !draft.trim()}
            onClick={() =>
              run(
                () => askTeacher(teacherId, teacherSlug, draft.trim()),
                () => {
                  setDraft("");
                  setOpen(false);
                }
              )
            }
          >
            {busy ? "…جارٍ الإرسال" : "إرسال"}
          </button>
        </div>
      )}

      {err && <p className="form-error">{err}</p>}
    </div>
  );
}
