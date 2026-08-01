"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { gradeAnswer } from "@/app/actions/exams";
import type { AttemptForGrading, ExamQuestion } from "@/lib/data/types";

/**
 * نتائج الطلاب وتصحيح الأسئلة النصّية.
 *
 * الأسئلة الموضوعية صُحِّحت داخل قاعدة البيانات لحظة التسليم، فلا شيء
 * هنا يُغيّرها. المتبقّي هو ما لا يُصحَّح آلياً: «علّل»، «اذكر السبب» —
 * يقرؤها المعلّم ويمنحها علامتها، ثم يُعاد احتساب المجموع على الخادم.
 */
export default function GradingBoard({
  questions,
  attempts,
}: {
  questions: ExamQuestion[];
  attempts: AttemptForGrading[];
}) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [open, setOpen] = useState<string | null>(
    attempts.find((a) => a.status === "submitted")?.id ?? null
  );
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [err, setErr] = useState("");

  const byId = useMemo(
    () => new Map(questions.map((q) => [q.id, q])),
    [questions]
  );

  if (attempts.length === 0) {
    return <p className="drafts-empty">لم يقدّم أحد هذا الاختبار بعد.</p>;
  }

  function save(answerId: string, points: number) {
    setErr("");
    startTransition(async () => {
      const res = await gradeAnswer(answerId, points);
      if (!res.ok) setErr(res.message ?? "تعذّر حفظ العلامة.");
      router.refresh();
    });
  }

  return (
    <div className="grading-board">
      {err && <p className="form-error">{err}</p>}

      <ul className="attempt-list">
        {attempts.map((a) => {
          const pending = a.answers.filter(
            (ans) => byId.get(ans.question_id)?.kind === "text" && !ans.graded
          ).length;
          const total = Number(a.auto_score) + Number(a.manual_score);
          const isOpen = open === a.id;

          return (
            <li key={a.id} className="attempt-card">
              <button
                type="button"
                className="attempt-head"
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? null : a.id)}
              >
                <span className="attempt-name">{a.studentName}</span>
                <span className="attempt-badges">
                  {a.status === "in_progress" ? (
                    <span className="pill pill-draft">لم يسلّم بعد</span>
                  ) : pending > 0 ? (
                    <span className="pill pill-low">✍️ {pending} بانتظار تصحيحك</span>
                  ) : (
                    <span className="pill pill-live">✓ مكتمل</span>
                  )}
                  {/* «من» لا «/»: الشرطة في سياق عربي تُقرأ معكوسة فتوهم
                      أن العلامة الكاملة هي الأصغر */}
                  <span className="attempt-score">
                    {total} من {a.max_score}
                  </span>
                  <span aria-hidden="true">{isOpen ? "▲" : "▼"}</span>
                </span>
              </button>

              {isOpen && (
                <ol className="attempt-answers">
                  {questions.map((q) => {
                    const ans = a.answers.find((x) => x.question_id === q.id);
                    const key = ans?.id ?? q.id;

                    return (
                      <li key={q.id} className="attempt-answer">
                        <p className="attempt-prompt">
                          {q.prompt}{" "}
                          <span className="group-meta">({q.points} علامة)</span>
                        </p>

                        {!ans ? (
                          <p className="attempt-empty">— لم يجب —</p>
                        ) : q.kind === "mcq" ? (
                          <p
                            className={
                              ans.choice_index === q.correct_index
                                ? "attempt-right"
                                : "attempt-wrong"
                            }
                          >
                            {ans.choice_index === null
                              ? "— لم يجب —"
                              : q.options[ans.choice_index] ?? "—"}
                            {ans.choice_index !== q.correct_index && (
                              <span className="attempt-correct">
                                {" "}
                                (الصحيح: {q.options[q.correct_index ?? 0] ?? "—"})
                              </span>
                            )}
                          </p>
                        ) : q.kind === "truefalse" ? (
                          <p
                            className={
                              ans.bool_answer === q.correct_bool
                                ? "attempt-right"
                                : "attempt-wrong"
                            }
                          >
                            {ans.bool_answer === null
                              ? "— لم يجب —"
                              : ans.bool_answer
                                ? "صح"
                                : "خطأ"}
                            {ans.bool_answer !== q.correct_bool && (
                              <span className="attempt-correct">
                                {" "}
                                (الصحيح: {q.correct_bool ? "صح" : "خطأ"})
                              </span>
                            )}
                          </p>
                        ) : (
                          <div className="attempt-text-block">
                            <p className="attempt-text">
                              {ans.text_answer || "— لم يجب —"}
                            </p>
                            {q.model_answer && (
                              <p className="attempt-model">
                                📌 إجابتك النموذجية: {q.model_answer}
                              </p>
                            )}
                            <div className="attempt-grade-row">
                              <label className="form-label" htmlFor={`g-${key}`}>
                                العلامة
                              </label>
                              <input
                                id={`g-${key}`}
                                type="number"
                                min={0}
                                max={q.points}
                                step={0.25}
                                className="attempt-grade-input"
                                value={drafts[ans.id] ?? String(ans.awarded)}
                                onChange={(e) =>
                                  setDrafts((d) => ({ ...d, [ans.id]: e.target.value }))
                                }
                              />
                              <span className="group-meta">من {q.points}</span>
                              <button
                                type="button"
                                className="btn btn-outline btn-sm"
                                disabled={busy}
                                onClick={() =>
                                  save(
                                    ans.id,
                                    Number(drafts[ans.id] ?? ans.awarded) || 0
                                  )
                                }
                              >
                                {ans.graded ? "تعديل العلامة" : "اعتماد العلامة"}
                              </button>
                              <button
                                type="button"
                                className="btn btn-outline btn-sm"
                                disabled={busy}
                                onClick={() => save(ans.id, Number(q.points))}
                              >
                                ✓ علامة كاملة
                              </button>
                              {ans.graded && (
                                <span className="pill pill-live">صُحِّح</span>
                              )}
                            </div>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ol>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
