"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { duplicateExam } from "@/app/actions/exams";

/**
 * استنساخ اختبار: نسخة مسودّة بأسئلته كاملةً، ينتقل إليها المعلّم فوراً.
 *
 * أسرع طريق إلى اختبار جديد ليس قالباً فارغاً بل اختباراً سابقاً نجح:
 * ينسخه ويغيّر ما يلزم. والنسخة مسودّة دائماً حتى لو كان الأصل منشوراً.
 */
export default function DuplicateExamButton({
  examId,
  title,
}: {
  examId: string;
  title: string;
}) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [err, setErr] = useState("");

  return (
    <>
      <button
        type="button"
        className="btn btn-outline btn-sm"
        disabled={busy}
        title={`استنساخ «${title}»`}
        onClick={() => {
          setErr("");
          startTransition(async () => {
            const res = await duplicateExam(examId);
            if (res.ok && res.examId) router.push(`/teacher/me/exams/${res.examId}`);
            else setErr(res.message ?? "تعذّر الاستنساخ.");
            router.refresh();
          });
        }}
      >
        {busy ? "…" : "📄 استنساخ"}
      </button>
      {err && <span className="form-error">{err}</span>}
    </>
  );
}
