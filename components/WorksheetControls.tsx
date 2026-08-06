"use client";

import { useState } from "react";
import { LEVEL_ICON, LEVEL_LABEL, type ReadingLevel } from "@/lib/ai/levels";

/**
 * ضبط ورقة العمل قبل طباعتها.
 *
 * **بلا ذكاء اصطناعي ولا كريدت**: الورقة تُبنى من محتوى الدرس الموجود،
 * والطباعة من المتصفّح إلى PDF أو إلى الطابعة. والطباعة ليست ترفاً في
 * مدارسنا — كثير من الصفوف بلا أجهزة.
 *
 * والخيارات تُطبَّق بأصنافٍ على `<body>` لا بإعادة رسم: هكذا يرى المعلّم
 * الورقة نفسها التي ستُطبع، لا معاينةً تقاربها.
 */
export default function WorksheetControls({
  levels,
  hasQuiz,
}: {
  levels: ReadingLevel[];
  hasQuiz: boolean;
}) {
  const [level, setLevel] = useState<ReadingLevel>("standard");
  const [withQuiz, setWithQuiz] = useState(hasQuiz);
  const [withKey, setWithKey] = useState(hasQuiz);
  const [withLines, setWithLines] = useState(false);

  function apply(next: Partial<Record<string, boolean | string>>) {
    const root = document.documentElement;
    const v = { level, withQuiz, withKey, withLines, ...next };
    root.dataset.wsLevel = String(v.level);
    root.classList.toggle("ws-no-quiz", !v.withQuiz);
    root.classList.toggle("ws-no-key", !v.withKey);
    root.classList.toggle("ws-with-lines", Boolean(v.withLines));
  }

  return (
    <div className="worksheet-controls no-print">
      <div className="form-row">
        <label className="form-field">
          <span className="form-label">مستوى النصّ</span>
          <select
            value={level}
            onChange={(e) => {
              const v = e.target.value as ReadingLevel;
              setLevel(v);
              apply({ level: v });
            }}
          >
            {levels.map((l) => (
              <option key={l} value={l}>
                {LEVEL_ICON[l]} {LEVEL_LABEL[l]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="worksheet-toggles">
        {hasQuiz && (
          <>
            <label className="stage-option">
              <input
                type="checkbox"
                checked={withQuiz}
                onChange={(e) => {
                  setWithQuiz(e.target.checked);
                  apply({ withQuiz: e.target.checked });
                }}
              />
              <span>أرفِق الأسئلة</span>
            </label>
            <label className="stage-option">
              <input
                type="checkbox"
                checked={withKey}
                onChange={(e) => {
                  setWithKey(e.target.checked);
                  apply({ withKey: e.target.checked });
                }}
              />
              <span>أرفِق مفتاح الإجابة (صفحة منفصلة)</span>
            </label>
          </>
        )}
        <label className="stage-option">
          <input
            type="checkbox"
            checked={withLines}
            onChange={(e) => {
              setWithLines(e.target.checked);
              apply({ withLines: e.target.checked });
            }}
          />
          <span>أضِف سطوراً للكتابة بعد كل سؤال</span>
        </label>
      </div>

      <div className="card-actions">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => window.print()}
        >
          🖨️ اطبع أو احفظ PDF
        </button>
        <span className="form-hint">
          من نافذة الطباعة اختر «حفظ كـPDF» إن أردت ملفاً.
        </span>
      </div>
    </div>
  );
}
