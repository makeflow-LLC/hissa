"use client";

import { useId, useState } from "react";

/**
 * نسخة سطرية من `Hint` تُوضع بجانب عنوان حقل أو زرّ.
 *
 * حيث لا تتّسع فقرة كاملة تحت العنوان — بجانب «العلامة» أو «المجموعة
 * المستهدفة» مثلاً — تكفي أيقونة صغيرة تفتح جملةً واحدة تحتها.
 */
export default function InfoTip({
  children,
  label = "شرح",
}: {
  children: React.ReactNode;
  /** يُقرأ بقارئ الشاشة، ولا يظهر نصّاً */
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();

  return (
    <>
      <button
        type="button"
        className={`infotip-btn ${open ? "infotip-btn-open" : ""}`}
        aria-expanded={open}
        aria-controls={id}
        aria-label={label}
        onClick={() => setOpen((v) => !v)}
      >
        ؟
      </button>
      {open && (
        <span className="infotip-body" id={id} role="note">
          {children}
        </span>
      )}
    </>
  );
}
