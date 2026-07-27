"use client";

import { useActionState, useEffect, useRef } from "react";
import { createUnit, type ContentFormState } from "@/app/actions/teacher-content";

const initialState: ContentFormState = { ok: false };

export default function AddUnitForm() {
  const [state, formAction, pending] = useActionState(createUnit, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="add-unit-form">
      <input
        type="text"
        name="title"
        className="search-input"
        placeholder="عنوان وحدة جديدة (مثال: الوحدة الأولى — الجبر)"
        required
      />
      <input
        type="text"
        name="description"
        className="search-input"
        placeholder="وصف اختياري"
      />
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? "…" : "➕ إضافة وحدة"}
      </button>
      {state.message && !state.ok && <p className="form-error">{state.message}</p>}
    </form>
  );
}
