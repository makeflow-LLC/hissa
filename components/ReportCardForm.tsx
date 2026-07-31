"use client";

import { useActionState, useState } from "react";
import {
  saveReportCard,
  deleteReportCard,
  type GroupsActionState,
} from "@/app/actions/teacher-groups";
import type { ReportCard } from "@/lib/data/types";

const initial: GroupsActionState = { ok: false };

/** التقديرات الأربعة التي تُملأ بنجوم من ٥ */
const SCALES = [
  { key: "understanding", label: "الفهم والاستيعاب" },
  { key: "participation", label: "المشاركة" },
  { key: "homework", label: "الواجبات" },
  { key: "behavior", label: "الانضباط" },
] as const;

function ScaleField({
  name,
  label,
  value,
}: {
  name: string;
  label: string;
  value: number | null;
}) {
  return (
    <label className="scale-field">
      <span className="form-label">{label}</span>
      <select name={name} defaultValue={value === null ? "" : String(value)}>
        <option value="">—</option>
        {[5, 4, 3, 2, 1, 0].map((n) => (
          <option key={n} value={n}>
            {n} / 5
          </option>
        ))}
      </select>
    </label>
  );
}

export default function ReportCardForm({
  studentId,
  studentName,
  units,
  existing,
}: {
  studentId: string;
  studentName: string;
  units: { id: string; title: string }[];
  /** بطاقات صدرت لهذا الطالب سابقاً */
  existing: ReportCard[];
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ReportCard | null>(null);
  const [state, action, pending] = useActionState(saveReportCard, initial);
  const [, removeAction] = useActionState(deleteReportCard, initial);

  const card = editing;

  return (
    <div className="report-card-block">
      <div className="form-row">
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => {
            setEditing(null);
            setOpen((v) => !v);
          }}
        >
          🏅 {open ? "إغلاق" : "بطاقة تقييم"}
        </button>
        {existing.length > 0 && (
          <span className="group-meta">{existing.length} بطاقة صادرة</span>
        )}
      </div>

      {existing.length > 0 && (
        <ul className="report-card-list">
          {existing.map((c) => (
            <li key={c.id} className="report-card-row">
              <span className="report-card-title">
                🏅 {c.title}
                {c.term && <> · {c.term}</>}
              </span>
              <span className="group-meta">
                {new Date(c.issued_at).toLocaleDateString("ar-EG", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </span>
              <div className="form-row">
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => {
                    setEditing(c);
                    setOpen(true);
                  }}
                >
                  تعديل
                </button>
                <form action={removeAction}>
                  <input type="hidden" name="cardId" value={c.id} />
                  <button
                    type="submit"
                    className="btn btn-outline btn-sm btn-danger"
                  >
                    حذف
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}

      {open && (
        <form action={action} className="report-form" key={card?.id ?? "new"}>
          <input type="hidden" name="studentId" value={studentId} />
          {card && <input type="hidden" name="cardId" value={card.id} />}

          <label className="form-field">
            <span className="form-label">عنوان البطاقة *</span>
            <input
              type="text"
              name="title"
              maxLength={120}
              required
              defaultValue={card?.title ?? `تقييم ${studentName}`}
              placeholder="مثلاً: تقييم نهاية الوحدة الأولى"
            />
          </label>

          <div className="form-grid-2">
            <label className="form-field">
              <span className="form-label">الوحدة (إن كانت بطاقة نهاية وحدة)</span>
              <select name="unitId" defaultValue={card?.unit_id ?? ""}>
                <option value="">— بدون وحدة —</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-field">
              <span className="form-label">الفصل / الفترة</span>
              <input
                type="text"
                name="term"
                maxLength={80}
                defaultValue={card?.term ?? ""}
                placeholder="مثلاً: الفصل الأول"
              />
            </label>
          </div>

          <div className="scales-grid">
            {SCALES.map((s) => (
              <ScaleField
                key={s.key}
                name={s.key}
                label={s.label}
                value={card ? (card[s.key] as number | null) : null}
              />
            ))}
          </div>

          <div className="form-grid-2">
            <label className="form-field">
              <span className="form-label">الدرجة</span>
              <input
                type="number"
                name="score"
                step="0.25"
                defaultValue={card?.score ?? ""}
                placeholder="مثلاً: 18"
              />
            </label>
            <label className="form-field">
              <span className="form-label">من</span>
              <input
                type="number"
                name="maxScore"
                step="0.25"
                defaultValue={card?.max_score ?? ""}
                placeholder="مثلاً: 20"
              />
            </label>
          </div>

          <label className="form-field">
            <span className="form-label">نقاط القوة</span>
            <textarea
              name="strengths"
              rows={2}
              maxLength={1000}
              defaultValue={card?.strengths ?? ""}
              placeholder="ما أتقنه الطالب فعلاً…"
            />
          </label>

          <label className="form-field">
            <span className="form-label">ما يحتاج تحسينه</span>
            <textarea
              name="improvements"
              rows={2}
              maxLength={1000}
              defaultValue={card?.improvements ?? ""}
              placeholder="خطوة أو خطوتان عمليّتان…"
            />
          </label>

          <label className="form-field">
            <span className="form-label">ملاحظة عامة</span>
            <textarea
              name="note"
              rows={2}
              maxLength={1000}
              defaultValue={card?.note ?? ""}
            />
          </label>

          <div className="form-row">
            <button type="submit" className="btn btn-primary btn-sm" disabled={pending}>
              {pending ? "…جارٍ الحفظ" : card ? "حفظ التعديل" : "إصدار البطاقة"}
            </button>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => {
                setOpen(false);
                setEditing(null);
              }}
            >
              إلغاء
            </button>
          </div>

          {state.message && (
            <p className={state.ok ? "form-ok" : "form-error"}>{state.message}</p>
          )}
        </form>
      )}
    </div>
  );
}
