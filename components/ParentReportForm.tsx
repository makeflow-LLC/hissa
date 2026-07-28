"use client";

import { useActionState, useState } from "react";
import {
  saveParentReport,
  type StudentsActionState,
} from "@/app/actions/teacher-students";

const PERFORMANCE = ["ممتاز", "جيد جداً", "جيد", "يحتاج متابعة"];

const initialState: StudentsActionState = { ok: false };

/**
 * تقرير المعلّم لوليّ أمر الطالب.
 * يُحفظ في المنصة (يراه الطالب على لوحته) ويُرسل لوليّ الأمر عبر واتساب
 * بضغطة — فوليّ الأمر لا يملك حساباً هنا.
 */
export default function ParentReportForm({
  studentId,
  studentName,
  guardianPhone,
  teacherName,
  progress,
}: {
  studentId: string;
  studentName: string;
  guardianPhone: string | null;
  teacherName: string;
  progress: { done: number; total: number; pct: number };
}) {
  const [state, formAction, pending] = useActionState(
    saveParentReport,
    initialState
  );

  const [period, setPeriod] = useState("");
  const [performance, setPerformance] = useState("جيد");
  const [strengths, setStrengths] = useState("");
  const [improvements, setImprovements] = useState("");
  const [note, setNote] = useState("");

  const waDigits = guardianPhone?.replace(/[^0-9]/g, "") ?? "";

  const message = [
    `السلام عليكم، أنا ${teacherName} من منصة حصة.`,
    ``,
    `📋 تقرير عن الطالب: ${studentName}`,
    period && `🗓️ الفترة: ${period}`,
    `📊 المستوى العام: ${performance}`,
    `📚 التقدّم في المنهج: ${progress.done} من ${progress.total} دروس (${progress.pct}٪)`,
    strengths && `\n✅ نقاط القوة:\n${strengths}`,
    improvements && `\n📌 ما يحتاج تحسيناً:\n${improvements}`,
    note && `\n📝 ملاحظة:\n${note}`,
  ]
    .filter(Boolean)
    .join("\n");

  const waUrl = waDigits
    ? `https://wa.me/${waDigits}?text=${encodeURIComponent(message)}`
    : null;

  return (
    <div className="parent-report">
      <form action={formAction} className="student-action-form">
        <input type="hidden" name="studentId" value={studentId} />

        <div className="form-grid">
          <label className="form-field">
            <span className="form-label">الفترة</span>
            <input
              type="text"
              name="period"
              className="search-input"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              placeholder="مثال: الأسبوع الثالث — أكتوبر"
            />
          </label>
          <label className="form-field">
            <span className="form-label">المستوى العام</span>
            <select
              name="performance"
              className="filter-select"
              value={performance}
              onChange={(e) => setPerformance(e.target.value)}
            >
              {PERFORMANCE.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="form-field">
          <span className="form-label">✅ نقاط القوة</span>
          <textarea
            name="strengths"
            className="search-input form-textarea"
            rows={2}
            maxLength={500}
            value={strengths}
            onChange={(e) => setStrengths(e.target.value)}
            placeholder="مثال: منتظم في حل التمارين وفهمه للكسور ممتاز."
          />
        </label>

        <label className="form-field">
          <span className="form-label">📌 ما يحتاج تحسيناً</span>
          <textarea
            name="improvements"
            className="search-input form-textarea"
            rows={2}
            maxLength={500}
            value={improvements}
            onChange={(e) => setImprovements(e.target.value)}
            placeholder="مثال: يحتاج مراجعة جدول الضرب قبل الوحدة القادمة."
          />
        </label>

        <label className="form-field">
          <span className="form-label">📝 ملاحظة لوليّ الأمر</span>
          <textarea
            name="note"
            className="search-input form-textarea"
            rows={2}
            maxLength={500}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="مثال: أرجو متابعة حلّه للواجب يومياً."
          />
        </label>

        <div className="parent-report-actions">
          <button type="submit" className="btn btn-primary btn-sm" disabled={pending}>
            {pending ? "جارٍ الحفظ…" : "💾 حفظ التقرير"}
          </button>
          {waUrl ? (
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-whatsapp btn-sm"
            >
              💬 إرسال لوليّ الأمر
            </a>
          ) : (
            <span className="form-hint">
              لا يوجد رقم وليّ أمر في بيانات الطالب — اطلب منه إضافته.
            </span>
          )}
        </div>

        {state.message && (
          <p className={state.ok ? "form-success" : "form-error"}>{state.message}</p>
        )}
      </form>
    </div>
  );
}
