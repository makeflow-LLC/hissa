"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { finishReview, type ReviewState } from "@/app/actions/reviews";
import type { QuizQuestionRow } from "@/lib/data/types";

const initial: ReviewState = { ok: false };

/**
 * جلسة مراجعة: ثلاثة أسئلة من الدرس، لا الدرس كلّه.
 *
 * القصد استدعاء المعلومة لا إعادة قراءتها — والاستدعاء هو ما يثبّتها.
 * ولذلك ثلاثة: جلسةٌ تُنجَز في دقيقة تُعاد كل يوم، وجلسةٌ تأخذ ربع ساعة
 * تُؤجَّل إلى الأبد.
 *
 * **التصحيح في الخادم**: نرسل الاختيارات فقط ويقرأ هو المفتاح.
 */
export default function ReviewSession({
  lessonId,
  lessonTitle,
  teacherSlug,
  questions,
}: {
  lessonId: string;
  lessonTitle: string;
  teacherSlug: string;
  questions: QuizQuestionRow[];
}) {
  const [state, finish, saving] = useActionState(finishReview, initial);
  const [choices, setChoices] = useState<Record<string, number>>({});

  // ثلاثة أسئلة مختارةٌ بثبات من معرّف الدرس، فلا تتبدّل عند كل رسم
  const picked = questions.slice(0, 3);
  const allAnswered = picked.every((q) => choices[q.id] !== undefined);

  if (state.ok) {
    return (
      <div className="review-done">
        <p className="exam-score">
          {state.total ? `${state.score} من ${state.total}` : "✓ تمّت المراجعة"}
        </p>
        <p className="form-ok">
          {state.total === 0
            ? "سجّلنا مراجعتك — سيعود الدرس بعد مدّة أطول."
            : (state.score ?? 0) * 2 >= (state.total ?? 1)
              ? "أحسنت — سيعود هذا الدرس بعد مدّة أطول."
              : "لا بأس — سيعود غداً لتثبّته."}
        </p>
        <div className="card-actions">
          <Link href="/dashboard/review" className="btn btn-primary">
            التالي
          </Link>
          <Link
            href={`/teacher/${teacherSlug}/lesson/${lessonId}`}
            className="btn btn-outline"
          >
            افتح الدرس
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form action={finish} className="exam-form review-session">
      <input type="hidden" name="lessonId" value={lessonId} />
      <input type="hidden" name="choices" value={JSON.stringify(choices)} />

      <h2 className="section-title">🔁 {lessonTitle}</h2>

      {picked.length === 0 ? (
        <>
          <p className="form-hint">
            لا أسئلة في هذا الدرس — أعِد قراءته ثم أكّد المراجعة.
          </p>
          <Link
            href={`/teacher/${teacherSlug}/lesson/${lessonId}`}
            className="btn btn-outline"
          >
            📖 افتح الدرس
          </Link>
        </>
      ) : (
        <ol className="review-questions">
          {picked.map((q, i) => (
            <li key={q.id}>
              <p className="game-prompt">{q.prompt}</p>
              <div className="game-choices">
                {q.options.map((o, k) => (
                  <button
                    key={k}
                    type="button"
                    className={`game-choice ${choices[q.id] === k ? "choice-right" : ""}`}
                    onClick={() => setChoices((c) => ({ ...c, [q.id]: k }))}
                    aria-pressed={choices[q.id] === k}
                    aria-label={`السؤال ${i + 1} الخيار ${k + 1}`}
                  >
                    {o}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ol>
      )}

      <div className="card-actions">
        <button
          type="submit"
          className="btn btn-primary"
          disabled={saving || (picked.length > 0 && !allAnswered)}
        >
          {saving ? "…يُحفظ" : "✓ أنهيتُ المراجعة"}
        </button>
      </div>
      {state.message && <p className="form-error">{state.message}</p>}
    </form>
  );
}
