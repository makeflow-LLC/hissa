"use client";

import { useId, useState } from "react";

/**
 * شرحٌ مطويّ خلف أيقونة.
 *
 * كان الشرح يُعرض دائماً تحت كل عنوان، فامتلأت اللوحتان بفقرات يقرؤها
 * المستخدم مرّةً ثم تظلّ تزاحم ما جاء يفعله. صار سطراً واحداً يضغطه من
 * أراد: من يعرف الخيار لا يراه أصلاً، ومن لا يعرفه يجده في مكانه.
 *
 * لا نستخدم `title=` ولا تلميحاً يظهر بالمرور: الجوّال لا مرور فيه،
 * وجمهور المنصة أكثره على الجوّال.
 */
export default function Hint({
  children,
  label = "ما هذا؟",
}: {
  children: React.ReactNode;
  /** نصّ الزرّ — غيّره حين يكون السؤال أدقّ من «ما هذا؟» */
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();

  return (
    <div className="hint-wrap">
      <button
        type="button"
        className={`hint-btn ${open ? "hint-btn-open" : ""}`}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="hint-icon" aria-hidden="true">
          ؟
        </span>
        {label}
      </button>
      {open && (
        <p className="hint" id={id}>
          {children}
        </p>
      )}
    </div>
  );
}
