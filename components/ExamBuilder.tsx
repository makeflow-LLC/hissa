"use client";

import { useActionState, useMemo, useState } from "react";
import {
  saveExamQuestions,
  type ExamActionState,
} from "@/app/actions/exams";
import AutoTextarea from "@/components/AutoTextarea";
import type { ExamQuestion, QuestionKind } from "@/lib/data/types";

const initial: ExamActionState = { ok: false };

interface QuestionUI {
  id: string;
  kind: QuestionKind;
  prompt: string;
  options: string[];
  correct_index: number;
  correct_bool: boolean;
  model_answer: string;
  points: number;
}

let seq = 0;
const newId = () => `q${++seq}-${Math.random().toString(36).slice(2, 7)}`;

const KINDS: { value: QuestionKind; label: string; hint: string }[] = [
  {
    value: "mcq",
    label: "اختيار من متعدّد",
    hint: "يُصحَّح آلياً فور التسليم.",
  },
  {
    value: "truefalse",
    label: "صح / خطأ",
    hint: "يُصحَّح آلياً فور التسليم.",
  },
  {
    value: "text",
    label: "إجابة نصّية (علّل، اذكر…)",
    hint: "تصحّحه بنفسك بعد التسليم.",
  },
];

function blank(kind: QuestionKind): QuestionUI {
  return {
    id: newId(),
    kind,
    prompt: "",
    options: kind === "mcq" ? ["", "", "", ""] : [],
    correct_index: 0,
    correct_bool: true,
    model_answer: "",
    points: 1,
  };
}

export default function ExamBuilder({
  examId,
  initialQuestions,
  locked,
}: {
  examId: string;
  initialQuestions: ExamQuestion[];
  /** بدأ طلاب الاختبار ⇒ الأسئلة مقفلة حفاظاً على عدالة التصحيح */
  locked: boolean;
}) {
  const [state, action, pending] = useActionState(saveExamQuestions, initial);
  const [questions, setQuestions] = useState<QuestionUI[]>(
    initialQuestions.length
      ? initialQuestions.map((q) => ({
          id: newId(),
          kind: q.kind,
          prompt: q.prompt,
          options: q.options.length ? [...q.options] : ["", "", "", ""],
          correct_index: q.correct_index ?? 0,
          correct_bool: q.correct_bool ?? true,
          model_answer: q.model_answer,
          points: Number(q.points),
        }))
      : [blank("mcq")]
  );

  const totalPoints = useMemo(
    () => questions.reduce((n, q) => n + (Number(q.points) || 0), 0),
    [questions]
  );

  const payload = useMemo(
    () =>
      JSON.stringify(
        questions.map((q) => ({
          kind: q.kind,
          prompt: q.prompt.trim(),
          options: q.kind === "mcq" ? q.options.map((o) => o.trim()).filter(Boolean) : [],
          correct_index: q.kind === "mcq" ? q.correct_index : null,
          correct_bool: q.kind === "truefalse" ? q.correct_bool : null,
          model_answer: q.kind === "text" ? q.model_answer.trim() : "",
          points: q.points,
        }))
      ),
    [questions]
  );

  function patch(i: number, next: Partial<QuestionUI>) {
    setQuestions((prev) => prev.map((q, j) => (j === i ? { ...q, ...next } : q)));
  }

  if (locked) {
    return (
      <div className="exam-locked">
        <p className="form-hint">
          🔒 بدأ طلاب هذا الاختبار بالفعل، فالأسئلة مقفلة — تغييرها الآن يفسد
          تصحيح من أجاب. أنشئ اختباراً جديداً إن أردت تعديل الأسئلة.
        </p>
        <ol className="exam-readonly">
          {initialQuestions.map((q) => (
            <li key={q.id}>
              <strong>{q.prompt}</strong>{" "}
              <span className="group-meta">({q.points} علامة)</span>
            </li>
          ))}
        </ol>
      </div>
    );
  }

  return (
    <form action={action} className="exam-builder">
      <input type="hidden" name="examId" value={examId} />
      <input type="hidden" name="questions" value={payload} />

      <div className="exam-builder-head">
        <span className="pill pill-free">
          {questions.length} سؤالاً · مجموع {totalPoints} علامة
        </span>
      </div>

      <ol className="exam-questions">
        {questions.map((q, i) => (
          <li key={q.id} className="exam-question">
            {/* الرقم والحذف في سطر، والحقول تحتهما: تكديسها في سطر واحد
                على الجوال كان يترك زر الحذف وحيداً في آخر السطر */}
            <div className="exam-question-head">
              <span className="exam-question-num">{i + 1}</span>
              <button
                type="button"
                className="btn btn-outline btn-sm btn-danger"
                onClick={() => setQuestions((p) => p.filter((_, j) => j !== i))}
                aria-label={`حذف السؤال ${i + 1}`}
              >
                ✕ حذف
              </button>
            </div>

            <div className="exam-question-top">
              <label className="form-field exam-kind">
                <span className="form-label">نوع السؤال</span>
                <select
                  value={q.kind}
                  onChange={(e) => {
                    const kind = e.target.value as QuestionKind;
                    patch(i, {
                      kind,
                      options: kind === "mcq" ? ["", "", "", ""] : [],
                    });
                  }}
                >
                  {KINDS.map((k) => (
                    <option key={k.value} value={k.value}>
                      {k.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-field exam-points">
                <span className="form-label">العلامة</span>
                <input
                  type="number"
                  min={0.25}
                  step={0.25}
                  value={q.points}
                  onChange={(e) => patch(i, { points: Number(e.target.value) })}
                />
              </label>
            </div>

            <p className="hint exam-kind-hint">
              {KINDS.find((k) => k.value === q.kind)?.hint}
            </p>

            <label className="form-field">
              <span className="form-label">نص السؤال *</span>
              <AutoTextarea
                className="search-input"
                value={q.prompt}
                onChange={(e) => patch(i, { prompt: e.target.value })}
                placeholder="اكتب السؤال كاملاً…"
              />
            </label>

            {q.kind === "mcq" && (
              <div className="form-field">
                <span className="form-label">الخيارات — اختر الإجابة الصحيحة</span>
                {q.options.map((opt, oi) => (
                  <div key={oi} className="quiz-option-edit">
                    <input
                      type="radio"
                      name={`correct-${q.id}`}
                      checked={q.correct_index === oi}
                      onChange={() => patch(i, { correct_index: oi })}
                      aria-label={`الخيار ${oi + 1} هو الصحيح`}
                    />
                    <input
                      type="text"
                      className="search-input"
                      value={opt}
                      onChange={(e) =>
                        patch(i, {
                          options: q.options.map((o, j) =>
                            j === oi ? e.target.value : o
                          ),
                        })
                      }
                      placeholder={`الخيار ${oi + 1}`}
                    />
                  </div>
                ))}
              </div>
            )}

            {q.kind === "truefalse" && (
              <div className="form-field">
                <span className="form-label">الإجابة الصحيحة</span>
                <div className="form-row">
                  <label className="stage-option">
                    <input
                      type="radio"
                      name={`tf-${q.id}`}
                      checked={q.correct_bool === true}
                      onChange={() => patch(i, { correct_bool: true })}
                    />
                    صح
                  </label>
                  <label className="stage-option">
                    <input
                      type="radio"
                      name={`tf-${q.id}`}
                      checked={q.correct_bool === false}
                      onChange={() => patch(i, { correct_bool: false })}
                    />
                    خطأ
                  </label>
                </div>
              </div>
            )}

            {q.kind === "text" && (
              <label className="form-field">
                <span className="form-label">إجابة نموذجية (تراها أنت وحدك)</span>
                <AutoTextarea
                  className="search-input"
                  value={q.model_answer}
                  onChange={(e) => patch(i, { model_answer: e.target.value })}
                  placeholder="النقاط التي تتوقّعها في الإجابة — تعينك عند التصحيح."
                />
              </label>
            )}
          </li>
        ))}
      </ol>

      <div className="card-actions">
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => setQuestions((p) => [...p, blank("mcq")])}
        >
          ➕ اختيار من متعدّد
        </button>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => setQuestions((p) => [...p, blank("truefalse")])}
        >
          ➕ صح / خطأ
        </button>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => setQuestions((p) => [...p, blank("text")])}
        >
          ➕ سؤال نصّي
        </button>
      </div>

      <div className="card-actions">
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "…جارٍ الحفظ" : "💾 حفظ الأسئلة"}
        </button>
      </div>

      {state.message && (
        <p className={state.ok ? "form-ok" : "form-error"}>{state.message}</p>
      )}
    </form>
  );
}
