"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setExamStatus, deleteExam } from "@/app/actions/exams";

/**
 * نشر الاختبار لطلاب المجموعة أو إعادته مسودّة، وحذفه.
 *
 * المسودّة لا يراها أحد — يكتب المعلّم أسئلته على راحته، ولا تصل الطلاب
 * إلا بضغطة نشر واحدة صريحة.
 */
export default function ExamPublishBar({
  examId,
  status,
  questionCount,
  hasAttempts,
}: {
  examId: string;
  status: "draft" | "published";
  questionCount: number;
  /** بدأ طلاب الاختبار ⇒ الحذف يمحو إجاباتهم، فنطلب تأكيداً */
  hasAttempts: boolean;
}) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  function run(fn: () => Promise<{ ok: boolean; message?: string }>, after?: () => void) {
    setMsg("");
    setErr("");
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        setMsg(res.message ?? "");
        after?.();
      } else {
        setErr(res.message ?? "تعذّر تنفيذ الأمر.");
      }
      router.refresh();
    });
  }

  return (
    <div className="exam-publish-bar">
      <div className="card-actions">
        {status === "published" ? (
          <>
            <span className="pill pill-live">✓ منشور لطلاب المجموعة</span>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              disabled={busy}
              onClick={() => run(() => setExamStatus(examId, false))}
            >
              إعادته مسودّة
            </button>
          </>
        ) : (
          <>
            <span className="pill pill-draft">مسودّة — لا يراها أحد</span>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={busy || questionCount === 0}
              onClick={() => run(() => setExamStatus(examId, true))}
            >
              🚀 انشر الاختبار
            </button>
          </>
        )}

        <button
          type="button"
          className="btn btn-outline btn-sm btn-danger"
          disabled={busy}
          onClick={() => {
            const warn = hasAttempts
              ? "بدأ طلاب هذا الاختبار — حذفه يمحو إجاباتهم ودرجاتهم. متأكّد؟"
              : "حذف الاختبار وأسئلته نهائياً. متأكّد؟";
            if (!window.confirm(warn)) return;
            const fd = new FormData();
            fd.set("examId", examId);
            run(
              () => deleteExam({ ok: false }, fd),
              () => router.push("/teacher/me/exams")
            );
          }}
        >
          🗑 حذف الاختبار
        </button>
      </div>

      {questionCount === 0 && status === "draft" && (
        <p className="form-hint">أضِف سؤالاً واحداً على الأقل قبل النشر.</p>
      )}
      {msg && <p className="form-ok">{msg}</p>}
      {err && <p className="form-error">{err}</p>}
    </div>
  );
}
