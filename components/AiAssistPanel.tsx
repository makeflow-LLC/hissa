"use client";

import { useState, useTransition } from "react";
import { aiFormat, aiQuiz, aiSummarize } from "@/app/actions/ai";

export interface AiQuizQuestion {
  prompt: string;
  options: string[];
  correct_index: number;
}

type Mode = "summary" | "quiz" | null;

/**
 * مساعد الذكاء الاصطناعي داخل نموذج الدرس.
 *
 * مبدأ ثابت: النموذج **يقترح ولا ينشر**. كل نتيجة تُدرَج في المحرّر
 * ليراجعها المعلّم ويعدّلها قبل الحفظ — فخطأ علمي منشور باسمه يضرّه.
 */
export default function AiAssistPanel({
  lessonId,
  enabled,
  getDraft,
  onSummary,
  onQuiz,
}: {
  /** فارغ لدرس لم يُحفظ بعد — الأدوات تعمل على المكتوب في المحرّر */
  lessonId: string;
  /** يُعطَّل فقط حين لا يكون مفتاح النموذج مضبوطاً */
  enabled: boolean;
  /** يقرأ ما في المحرّر لحظة الضغط، لا ما هو محفوظ في قاعدة البيانات */
  getDraft: () => { html: string; title: string };
  onSummary: (html: string) => void;
  onQuiz: (questions: AiQuizQuestion[]) => void;
}) {
  const [mode, setMode] = useState<Mode>(null);
  const [note, setNote] = useState("");
  const [count, setCount] = useState(5);
  const [busy, startBusy] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);

  if (!enabled) {
    return (
      <div className="ai-panel ai-panel-off">
        <span className="ai-badge">✨ مساعد الذكاء الاصطناعي</span>
        <p className="form-hint">
          مفتاح النموذج غير مضبوط على الخادم، فالأدوات معطّلة.
        </p>
      </div>
    );
  }

  function run(kind: "summary" | "quiz") {
    setMsg(null);
    startBusy(async () => {
      // نلتقط ما في المحرّر الآن — لا يلزم حفظ الدرس قبل الاستفادة
      const draft = getDraft();
      const res =
        kind === "summary"
          ? await aiSummarize(lessonId, note, draft)
          : await aiQuiz(lessonId, count, note, draft);

      if (!res.ok) {
        setMsg({ ok: false, text: res.message ?? "تعذّر التنفيذ." });
        return;
      }
      if (typeof res.remaining === "number") setRemaining(res.remaining);

      if (kind === "summary" && res.html) {
        onSummary(res.html);
        setMsg({ ok: true, text: "أُضيف الملخّص كقسم جديد — راجعه وعدّله." });
      } else if (kind === "quiz" && res.quiz) {
        onQuiz(res.quiz);
        setMsg({
          ok: true,
          text: `أُضيفت ${res.quiz.length} أسئلة — راجع الإجابات الصحيحة قبل الحفظ.`,
        });
      }
      setMode(null);
      setNote("");
    });
  }

  return (
    <div className="ai-panel">
      <div className="ai-panel-head">
        <span className="ai-badge">✨ مساعد الذكاء الاصطناعي</span>
        {remaining !== null && (
          <span className="ai-remaining">بقي لك {remaining} توليدة هذا الشهر</span>
        )}
      </div>

      <p className="form-hint">
        يقترح ولا ينشر — كل نتيجة تُدرَج في المحرّر لتراجعها وتعدّلها قبل الحفظ.
        يراعي المادة والمرحلة الدراسية المسجّلة في ملفك.
      </p>

      <div className="ai-actions">
        <button
          type="button"
          className={`btn btn-outline btn-sm ${mode === "summary" ? "btn-active" : ""}`}
          onClick={() => setMode(mode === "summary" ? null : "summary")}
          disabled={busy}
        >
          📝 لخّص الدرس
        </button>
        <button
          type="button"
          className={`btn btn-outline btn-sm ${mode === "quiz" ? "btn-active" : ""}`}
          onClick={() => setMode(mode === "quiz" ? null : "quiz")}
          disabled={busy}
        >
          ❓ اقترح أسئلة
        </button>
      </div>

      {mode && (
        <div className="ai-form">
          {mode === "quiz" && (
            <label className="form-field">
              <span className="form-label">عدد الأسئلة</span>
              <select
                className="filter-select"
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
              >
                {[3, 5, 7, 10].map((n) => (
                  <option key={n} value={n}>
                    {n} أسئلة
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="form-field">
            <span className="form-label">🎯 توصياتك للنموذج (اختياري)</span>
            <textarea
              className="search-input form-textarea"
              rows={2}
              maxLength={500}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                mode === "summary"
                  ? "مثال: ركّز على القوانين وأضف جدول مقارنة، وتجنّب الأمثلة الطويلة."
                  : "مثال: اجعل سؤالين تطبيقيين على حساب المساحة، وتجنّب أسئلة التعريف."
              }
            />
            <span className="form-hint">
              وجّه النموذج بما تريده بالضبط — سيلتزم بتوصياتك.
            </span>
          </label>

          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => run(mode)}
            disabled={busy}
          >
            {busy ? "⏳ جارٍ التوليد… (قد يستغرق نصف دقيقة)" : "✨ ولّد الآن"}
          </button>
        </div>
      )}

      {msg && (
        <p className={msg.ok ? "form-success" : "form-error"}>{msg.text}</p>
      )}
    </div>
  );
}

/** زر تحسين تنسيق قسم واحد — يعيد النص منسّقاً بالمعنى نفسه */
export function AiFormatButton({
  lessonId,
  html,
  title,
  enabled,
  onResult,
}: {
  lessonId: string;
  html: string;
  /** عنوان الدرس كما هو في النموذج الآن — يوجّه صياغة النموذج */
  title?: string;
  enabled: boolean;
  onResult: (html: string) => void;
}) {
  const [busy, startBusy] = useTransition();
  const [err, setErr] = useState("");

  if (!enabled) return null;

  return (
    <>
      <button
        type="button"
        className="btn btn-outline btn-sm ai-format-btn"
        disabled={busy}
        onClick={() => {
          setErr("");
          startBusy(async () => {
            const res = await aiFormat(lessonId, html, "", { title });
            if (res.ok && res.html) onResult(res.html);
            else setErr(res.message ?? "تعذّر التنسيق.");
          });
        }}
        title="إعادة تنسيق هذا القسم دون تغيير معناه"
      >
        {busy ? "⏳ جارٍ التنسيق…" : "✨ حسّن التنسيق"}
      </button>
      {err && <p className="form-error">{err}</p>}
    </>
  );
}
