"use client";

import { useActionState, useState } from "react";
import {
  grantAccess,
  sendMessage,
  type StudentsActionState,
} from "@/app/actions/teacher-students";
import ParentReportForm from "@/components/ParentReportForm";

const initialState: StudentsActionState = { ok: false };

export interface GrantTarget {
  value: string;
  label: string;
}

/**
 * لوحة إجراءات على طالب واحد: رسالة ومنح وصول.
 * تُطوى افتراضياً حتى لا تُثقل قائمة الطلاب على الجوال.
 */
export default function StudentActionsPanel({
  studentId,
  studentName,
  targets,
  guardianPhone,
  teacherName,
  progress,
}: {
  studentId: string;
  studentName: string;
  targets: GrantTarget[];
  guardianPhone: string | null;
  teacherName: string;
  progress: { done: number; total: number; pct: number };
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"message" | "parent">("message");
  const [msgState, msgAction, msgPending] = useActionState(
    sendMessage,
    initialState
  );
  const [grantState, grantAction, grantPending] = useActionState(
    grantAccess,
    initialState
  );

  if (!open) {
    return (
      <button
        type="button"
        className="btn btn-outline btn-sm"
        onClick={() => setOpen(true)}
      >
        ✉️ رسالة / تقرير / صلاحية
      </button>
    );
  }

  return (
    <div className="student-actions">
      <div className="student-actions-head">
        <strong>إجراءات على {studentName}</strong>
        <button
          type="button"
          className="install-close"
          onClick={() => setOpen(false)}
          aria-label="إغلاق"
        >
          ✕
        </button>
      </div>

      <div className="tabs tabs-sm" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "message"}
          className={`tab ${tab === "message" ? "tab-active" : ""}`}
          onClick={() => setTab("message")}
        >
          ✉️ رسالة وصلاحية
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "parent"}
          className={`tab ${tab === "parent" ? "tab-active" : ""}`}
          onClick={() => setTab("parent")}
        >
          👨‍👩‍👦 تقرير لوليّ الأمر
        </button>
      </div>

      {tab === "parent" ? (
        <ParentReportForm
          studentId={studentId}
          studentName={studentName}
          guardianPhone={guardianPhone}
          teacherName={teacherName}
          progress={progress}
        />
      ) : (
        <>
      <form action={msgAction} className="student-action-form">
        <input type="hidden" name="studentId" value={studentId} />
        <label className="form-field">
          <span className="form-label">رسالة تظهر على لوحته</span>
          <textarea
            name="body"
            className="search-input form-textarea"
            rows={2}
            maxLength={1000}
            placeholder="مثال: أحسنت في الوحدة الأولى — راجع الدرس الثالث قبل الحصة."
            required
          />
        </label>
        <button type="submit" className="btn btn-primary btn-sm" disabled={msgPending}>
          {msgPending ? "جارٍ الإرسال…" : "إرسال الرسالة"}
        </button>
        {msgState.message && (
          <p className={msgState.ok ? "form-success" : "form-error"}>
            {msgState.message}
          </p>
        )}
      </form>

      <form action={grantAction} className="student-action-form">
        <input type="hidden" name="studentId" value={studentId} />
        <label className="form-field">
          <span className="form-label">منح وصول لمحتوى خاص</span>
          <select name="target" className="filter-select" defaultValue="all">
            <option value="all">كل محتواي الخاص</option>
            {targets.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <span className="form-hint">
            المحتوى المُعلَّم «خاص» لا يظهر لأحد إلا من منحته الوصول.
          </span>
        </label>
        <button
          type="submit"
          className="btn btn-outline btn-sm"
          disabled={grantPending}
        >
          {grantPending ? "…" : "🔓 منح الوصول"}
        </button>
        {grantState.message && (
          <p className={grantState.ok ? "form-success" : "form-error"}>
            {grantState.message}
          </p>
        )}
      </form>
        </>
      )}
    </div>
  );
}
