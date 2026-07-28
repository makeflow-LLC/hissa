"use client";

import { useState, useTransition } from "react";
import { submitQuiz } from "@/app/actions/quiz";

export interface QuizQuestion {
  id: string;
  prompt: string;
  options: string[];
  correctIndex: number;
}

/**
 * اختبار قصير في نهاية الدرس.
 * النتيجة تُحفظ في قاعدة البيانات ليراها المعلّم؛ والتصحيح النهائي يتم
 * على الخادم لا هنا، فلا يستطيع أحد إرسال درجة كاملة من المتصفح.
 */
export default function QuizSection({
  questions,
  lessonId,
  teacherSlug,
  previous,
}: {
  questions: QuizQuestion[];
  lessonId: string;
  teacherSlug: string;
  /** محاولة سابقة إن وُجدت */
  previous: { score: number; total: number } | null;
}) {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [checked, setChecked] = useState(false);
  const [saving, startSaving] = useTransition();
  const [saved, setSaved] = useState<{ score: number; total: number } | null>(
    previous
  );
  const [saveErr, setSaveErr] = useState("");

  if (questions.length === 0) return null;

  const answeredAll = questions.every((q) => answers[q.id] !== undefined);
  const score = questions.filter((q) => answers[q.id] === q.correctIndex).length;

  function submit() {
    setChecked(true);
    setSaveErr("");
    startSaving(async () => {
      const res = await submitQuiz(lessonId, teacherSlug, answers);
      if (res.ok && res.score !== undefined && res.total !== undefined) {
        setSaved({ score: res.score, total: res.total });
      } else {
        setSaveErr(res.message ?? "تعذّر حفظ النتيجة.");
      }
    });
  }

  return (
    <section className="lesson-block">
      <h2 className="content-heading">❓ اختبر فهمك</h2>
      {saved && !checked && (
        <p className="quiz-previous">
          📊 نتيجتك السابقة: {saved.score} من {saved.total} — يمكنك إعادة الحل
          وستُحدَّث نتيجتك.
        </p>
      )}
      <div className="quiz">
        {questions.map((q, qi) => (
          <div key={q.id} className="quiz-question">
            <p className="quiz-prompt">
              {qi + 1}. {q.prompt}
            </p>
            <div className="quiz-options">
              {q.options.map((opt, oi) => {
                const selected = answers[q.id] === oi;
                let cls = "quiz-option";
                if (selected) cls += " quiz-option-selected";
                if (checked && oi === q.correctIndex) cls += " quiz-option-correct";
                if (checked && selected && oi !== q.correctIndex)
                  cls += " quiz-option-wrong";
                return (
                  <label key={oi} className={cls}>
                    <input
                      type="radio"
                      name={q.id}
                      checked={selected}
                      disabled={checked}
                      onChange={() => setAnswers((a) => ({ ...a, [q.id]: oi }))}
                    />
                    {opt}
                  </label>
                );
              })}
            </div>
          </div>
        ))}

        {checked ? (
          <div className="quiz-result">
            <p className="quiz-score">
              نتيجتك: {score} من {questions.length}{" "}
              {score === questions.length ? "🎉 ممتاز!" : score >= questions.length / 2 ? "👏 جيد جداً" : "💪 راجع الدرس وحاول مجدداً"}
            </p>
            <p className="quiz-saved-note">
              {saving
                ? "⏳ جارٍ حفظ نتيجتك…"
                : saveErr
                  ? `⚠️ ${saveErr}`
                  : "✅ حُفظت نتيجتك — يراها معلّمك."}
            </p>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => {
                setAnswers({});
                setChecked(false);
              }}
            >
              إعادة المحاولة
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="btn btn-primary"
            disabled={!answeredAll || saving}
            onClick={submit}
          >
            {saving ? "جارٍ الحفظ…" : "تحقق من إجاباتك"}
          </button>
        )}
      </div>
    </section>
  );
}
