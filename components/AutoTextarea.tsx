"use client";

import { useEffect, useRef } from "react";

/**
 * حقل نصّي يكبر بمقدار محتواه.
 *
 * السؤال قد يكون فقرة كاملة، وحقل بارتفاع ثابت يخفي أكثره خلف تمرير
 * داخلي — فيحرّر المعلّم ما لا يراه. نضبط الارتفاع على scrollHeight بعد
 * كل تغيير، فيظهر النصّ كاملاً دائماً.
 *
 * (`field-sizing: content` يفعل هذا بلا JS لكنه غير مدعوم في سفاري بعد،
 * ومعظم طلابنا ومعلّمينا على الجوال.)
 */
export default function AutoTextarea({
  value,
  minRows = 2,
  ...rest
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  value: string;
  minRows?: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      value={value}
      rows={minRows}
      // نمنع شريط التمرير الداخلي: الارتفاع يتبع المحتوى
      style={{ overflowY: "hidden", resize: "none" }}
      {...rest}
    />
  );
}
