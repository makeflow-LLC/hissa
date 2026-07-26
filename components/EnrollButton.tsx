"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { enrollInSession } from "@/app/actions/student";

interface Props {
  sessionId: string;
  teacherSlug: string;
  isPaid: boolean;
  price: number;
  currency: string;
  /** enrolled | pending_payment | undefined (غير مسجّل) */
  enrolledStatus?: string;
  isAuthed: boolean;
  whatsapp: string | null;
}

export default function EnrollButton({
  sessionId,
  teacherSlug,
  isPaid,
  price,
  currency,
  enrolledStatus,
  isAuthed,
  whatsapp,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message?: string } | null>(null);

  if (!isAuthed) {
    return (
      <button
        type="button"
        className="btn btn-outline btn-book"
        onClick={() =>
          router.push(`/login?next=${encodeURIComponent(`/teacher/${teacherSlug}`)}`)
        }
      >
        🔒 سجّل الدخول للتسجيل
      </button>
    );
  }

  if (enrolledStatus === "enrolled") {
    return <span className="badge badge-success enroll-state">✓ مسجّل في الحصة</span>;
  }

  if (enrolledStatus === "pending_payment") {
    const waDigits = whatsapp?.replace(/[^0-9]/g, "") ?? "";
    return (
      <span className="enroll-state-col">
        <span className="badge badge-warn">بانتظار تأكيد الدفع</span>
        {waDigits && (
          <a
            href={`https://wa.me/${waDigits}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-whatsapp btn-sm"
          >
            💬 راسل المعلم
          </a>
        )}
      </span>
    );
  }

  return (
    <span className="enroll-state-col">
      <button
        type="button"
        className="btn btn-primary btn-book"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const r = await enrollInSession(sessionId, teacherSlug);
            setResult(r);
            if (r.ok) router.refresh();
          })
        }
      >
        {pending ? "جارٍ التسجيل…" : "سجّل في الحصة"}
      </button>
      {isPaid && price > 0 && (
        <span className="price-hint">
          {price} {currency} — يؤكّدها المعلم
        </span>
      )}
      {result?.message && (
        <span className={result.ok ? "enroll-msg-ok" : "enroll-msg-err"}>
          {result.message}
        </span>
      )}
    </span>
  );
}
