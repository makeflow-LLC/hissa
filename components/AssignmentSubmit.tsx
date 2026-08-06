"use client";

import { useActionState } from "react";
import { submitAssignment, type AssignmentState } from "@/app/actions/assignments";
import type { StudentAssignment } from "@/lib/data/queries";

const initial: AssignmentState = { ok: false };

/** تسليم الطالب — قابلٌ للتعديل ما لم يُصحَّح */
export default function AssignmentSubmit({ a }: { a: StudentAssignment }) {
  const [state, send, saving] = useActionState(submitAssignment, initial);
  const graded = a.grade !== null;
  const late = Boolean(a.dueAt && a.submittedAt && a.submittedAt > a.dueAt);

  return (
    <div className="assignment-card">
      <div className="qa-meta">
        <strong>{a.title}</strong>
        <span className="group-meta">{a.teacherName}</span>
        {a.dueAt && (
          <span className={`pill ${overdue(a) ? "pill-low" : "pill-draft"}`}>
            {overdue(a) ? "فات الموعد" : "الموعد"}:{" "}
            {new Date(a.dueAt).toLocaleString("ar", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </span>
        )}
        {a.submittedAt && (
          <span className="pill pill-live">
            سُلّم{late ? " (متأخّر)" : ""}
          </span>
        )}
      </div>

      {a.body && <p className="assignment-body">{a.body}</p>}

      {graded ? (
        <div className="assignment-graded">
          <p className="exam-score">علامتك: {a.grade}</p>
          {a.feedback && <p className="form-ok">💬 {a.feedback}</p>}
          <p className="form-hint">تسليمك: {a.myBody}</p>
        </div>
      ) : (
        <form action={send} className="qa-form">
          <input type="hidden" name="assignmentId" value={a.id} />
          <textarea
            name="body"
            rows={4}
            defaultValue={a.myBody}
            maxLength={8000}
            placeholder="اكتب إجابتك هنا…"
            required
          />
          <div className="card-actions">
            <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
              {saving ? "…يُرسَل" : a.submittedAt ? "💾 حدّث تسليمي" : "📤 سلّم"}
            </button>
            {a.submittedAt && (
              <span className="form-hint">
                يمكنك التعديل ما لم يصحّحه المعلّم.
              </span>
            )}
          </div>
          {state.message && (
            <p className={state.ok ? "form-ok" : "form-error"}>{state.message}</p>
          )}
        </form>
      )}
    </div>
  );
}

function overdue(a: StudentAssignment): boolean {
  return Boolean(a.dueAt && !a.submittedAt && new Date(a.dueAt) < new Date());
}
