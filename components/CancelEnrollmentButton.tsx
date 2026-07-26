"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelEnrollment } from "@/app/actions/student";

export default function CancelEnrollmentButton({
  sessionId,
  teacherSlug,
}: {
  sessionId: string;
  teacherSlug: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      className="btn btn-outline btn-sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await cancelEnrollment(sessionId, teacherSlug);
          router.refresh();
        })
      }
    >
      {pending ? "…" : "إلغاء التسجيل"}
    </button>
  );
}
