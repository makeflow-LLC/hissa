"use client";

import { useActionState, useEffect, useRef } from "react";
import { sendMessage, type StudentsActionState } from "@/app/actions/teacher-students";

const initialState: StudentsActionState = { ok: false };

/** رسالة واحدة تصل لكل متابعي المعلّم (studentId فارغ = تعميم) */
export default function BroadcastForm() {
  const [state, formAction, pending] = useActionState(sendMessage, initialState);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);

  return (
    <form ref={ref} action={formAction} className="broadcast-form">
      <textarea
        name="body"
        className="search-input form-textarea"
        rows={2}
        maxLength={1000}
        placeholder="اكتب إعلاناً يصل لكل طلابك… مثال: حصة المراجعة يوم الخميس ٨ مساءً."
        required
      />
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? "جارٍ الإرسال…" : "📢 إرسال للجميع"}
      </button>
      {state.message && (
        <p className={state.ok ? "form-success" : "form-error"}>{state.message}</p>
      )}
    </form>
  );
}
