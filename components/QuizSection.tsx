"use client";

import { useState } from "react";
import type { QuizQuestion } from "@/lib/useLessonDrafts";

/** اختبار تفاعلي قصير في نهاية الحصة: يختار الطالب ثم يتحقق من إجاباته */
export default function QuizSection({ questions }: { questions: QuizQuestion[] }) {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [checked, setChecked] = useState(false);

  if (questions.length === 0) return null;

  const answeredAll = questions.every((q) => answers[q.id] !== undefined);
  const score = questions.filter((q) => answers[q.id] === q.correctIndex).length;

  return (
    <section className="lesson-block">
      <h2 className="content-heading">❓ اختبر فهمك</h2>
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
            disabled={!answeredAll}
            onClick={() => setChecked(true)}
          >
            تحقق من إجاباتك
          </button>
        )}
      </div>
    </section>
  );
}
