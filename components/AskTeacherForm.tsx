"use client";

import { useState, useTransition } from "react";
import { askTeacher } from "@/app/actions/student";

/**
 * صندوق سؤال الطالب لمعلّم يتابعه.
 * يُطوى افتراضياً حتى لا يزاحم بطاقة التقدّم في لوحة الطالب.
 */
export default function AskTeacherForm({
  teacherId,
  teacherSlug,
  teacherName,
}: {
  teacherId: string;
  teacherSlug: string;
  teacherName: string;
}) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [sending, startSending] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(
    null
  );

  if (!open) {
    return (
      <button
        type="button"
        className="btn btn-outline btn-sm btn-block"
        onClick={() => setOpen(true)}
      >
        ✉️ اسأل {teacherName}
      </button>
    );
  }

  function send() {
    setResult(null);
    startSending(async () => {
      const res = await askTeacher(teacherId, teacherSlug, body);
      setResult({ ok: res.ok, message: res.message ?? "" });
      if (res.ok) {
        setBody("");
        setOpen(false);
      }
    });
  }

  return (
    <div className="ask-box">
      <textarea
        className="search-input form-textarea"
        rows={2}
        maxLength={1000}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={`اكتب سؤالك لـ${teacherName}…`}
        aria-label="نص السؤال"
      />
      <div className="ask-actions">
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={send}
          disabled={sending || !body.trim()}
        >
          {sending ? "جارٍ الإرسال…" : "إرسال"}
        </button>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => setOpen(false)}
        >
          إلغاء
        </button>
      </div>
      {result && (
        <p className={result.ok ? "form-success" : "form-error"}>{result.message}</p>
      )}
    </div>
  );
}
