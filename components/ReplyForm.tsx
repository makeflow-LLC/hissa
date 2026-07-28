"use client";

import { useActionState, useEffect, useRef } from "react";
import { sendMessage, type StudentsActionState } from "@/app/actions/teacher-students";

const initialState: StudentsActionState = { ok: false };

/** ردّ المعلّم داخل خيط محادثة طالب بعينه */
export default function ReplyForm({
  studentId,
  studentName,
}: {
  studentId: string;
  studentName: string;
}) {
  const [state, formAction, pending] = useActionState(sendMessage, initialState);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);

  return (
    <form ref={ref} action={formAction} className="thread-reply">
      <input type="hidden" name="studentId" value={studentId} />
      <textarea
        name="body"
        className="search-input form-textarea"
        rows={2}
        maxLength={1000}
        placeholder={`ردّك على ${studentName}…`}
        aria-label="نص الردّ"
        required
      />
      <button type="submit" className="btn btn-primary btn-sm" disabled={pending}>
        {pending ? "جارٍ الإرسال…" : "إرسال الردّ"}
      </button>
      {state.message && (
        <p className={state.ok ? "form-success" : "form-error"}>{state.message}</p>
      )}
    </form>
  );
}
