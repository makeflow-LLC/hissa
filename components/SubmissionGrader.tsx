"use client";

import { useActionState } from "react";
import { gradeSubmission, type AssignmentState } from "@/app/actions/assignments";
import type { SubmissionRow } from "@/lib/data/queries";

const initial: AssignmentState = { ok: false };

/**
 * تصحيح تسليمٍ واحد.
 *
 * العلامة والملاحظة عمودان **محجوبان عن دور `authenticated` كلّه** بمنحة
 * أعمدة، فلا يستطيع الطالب أن يضعهما لنفسه من REST؛ والكتابة تمرّ
 * بدالّة `security definer` تتحقّق أن المستدعي صاحب الواجب.
 */
export default function SubmissionGrader({ s }: { s: SubmissionRow }) {
  const [state, grade, saving] = useActionState(gradeSubmission, initial);

  return (
    <li className="submission-item">
      <div className="qa-meta">
        <strong>{s.studentName}</strong>
        <span className="group-meta">
          {new Date(s.submittedAt).toLocaleString("ar", {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </span>
        {s.late && <span className="pill pill-low">متأخّر</span>}
        {s.gradedAt && <span className="pill pill-live">صُحّح</span>}
      </div>

      <p className="submission-body">{s.body}</p>

      <form action={grade} className="grade-form">
        <input type="hidden" name="submissionId" value={s.id} />
        <input
          type="number"
          name="grade"
          className="search-input grade-input"
          defaultValue={s.grade ?? ""}
          min={0}
          max={1000}
          step="0.5"
          placeholder="علامة"
          aria-label={`علامة ${s.studentName}`}
        />
        <input
          type="text"
          name="feedback"
          className="search-input"
          defaultValue={s.feedback}
          placeholder="ملاحظة للطالب"
          maxLength={2000}
          aria-label={`ملاحظة لـ${s.studentName}`}
        />
        <button type="submit" className="btn btn-outline btn-sm" disabled={saving}>
          {saving ? "…" : "حفظ"}
        </button>
      </form>
      {state.message && (
        <p className={state.ok ? "form-ok" : "form-error"}>{state.message}</p>
      )}
    </li>
  );
}
