"use client";

import { useActionState, useMemo, useState } from "react";
import {
  saveExamQuestions,
  type ExamActionState,
} from "@/app/actions/exams";
import AutoTextarea from "@/components/AutoTextarea";
import TemplatePicker from "@/components/TemplatePicker";
import type { ExamTemplate } from "@/lib/examTemplates";
import type { ExamQuestion, QuestionKind } from "@/lib/data/types";

const initial: ExamActionState = { ok: false };

interface QuestionUI {
  id: string;
  kind: QuestionKind;
  prompt: string;
  options: string[];
  /** `null` = لم يحدّد المعلّم الإجابة الصحيحة بعد — لا تُفترَض عنه */
  correct_index: number | null;
  correct_bool: boolean | null;
  model_answer: string;
  points: number;
}

let seq = 0;
const newId = () => `q${++seq}-${Math.random().toString(36).slice(2, 7)}`;

/** تقريبٌ إلى ربع علامة — يمنع 9.999999999 من الظهور في المجموع */
const round = (n: number) => Math.round(n * 100) / 100;

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

/** تبديل موضعَي سؤالين — إعادة الترتيب بلا سحب ولا إفلات */
function swap(list: QuestionUI[], a: number, b: number): QuestionUI[] {
  if (b < 0 || b >= list.length) return list;
  const next = [...list];
  [next[a], next[b]] = [next[b], next[a]];
  return next;
}

function blank(kind: QuestionKind): QuestionUI {
  return {
    id: newId(),
    kind,
    prompt: "",
    options: kind === "mcq" ? ["", "", "", ""] : [],
    correct_index: null,
    correct_bool: null,
    model_answer: "",
    points: 1,
  };
}

export default function ExamBuilder({
  examId,
  initialQuestions,
  locked,
  myTemplates,
  targetPoints,
}: {
  examId: string;
  initialQuestions: ExamQuestion[];
  /** بدأ طلاب الاختبار ⇒ الأسئلة مقفلة حفاظاً على عدالة التصحيح */
  locked: boolean;
  /** قوالب حفظها المعلّم بنفسه، تُضاف إلى قوالب المنصة */
  myTemplates: ExamTemplate[];
  /** العلامة الكلّية التي قصدها المعلّم — تُقارَن بالمجموع لحظةً بلحظة */
  targetPoints: number | null;
}) {
  const [state, action, pending] = useActionState(saveExamQuestions, initial);
  const [questions, setQuestions] = useState<QuestionUI[]>(
    initialQuestions.length
      ? initialQuestions.map((q) => ({
          id: newId(),
          kind: q.kind,
          prompt: q.prompt,
          options: q.options.length ? [...q.options] : ["", "", "", ""],
          correct_index: q.correct_index,
          correct_bool: q.correct_bool,
          model_answer: q.model_answer,
          points: Number(q.points),
        }))
      : [blank("mcq")]
  );

  const totalPoints = useMemo(
    () => round(questions.reduce((n, q) => n + (Number(q.points) || 0), 0)),
    [questions]
  );
  const pointsOk = !targetPoints || Math.abs(totalPoints - targetPoints) < 0.001;

  /**
   * ما يمنع الحفظ، معروضاً وهو يُكتب لا بعد الضغط.
   *
   * الخادم يرفض السؤال بلا نصّ، والاختيارَ بأقلّ من خيارين — وكان يردّ
   * رسالةً واحدة عامّة بعد الحفظ لا تقول أيّ سؤال هو المعطوب.
   */
  const problems = useMemo(() => {
    const out: string[] = [];
    questions.forEach((q, i) => {
      if (!q.prompt.trim()) out.push(`السؤال ${i + 1} بلا نصّ`);
      else if (q.kind === "mcq") {
        const filled = q.options.filter((o) => o.trim()).length;
        if (filled < 2) out.push(`السؤال ${i + 1} يحتاج خيارين على الأقل`);
        else if (q.correct_index === null)
          out.push(`السؤال ${i + 1}: لم تحدّد الإجابة الصحيحة`);
        else if (!q.options[q.correct_index]?.trim())
          out.push(`السؤال ${i + 1}: الإجابة الصحيحة المختارة فارغة`);
      } else if (q.kind === "truefalse" && q.correct_bool === null) {
        out.push(`السؤال ${i + 1}: اختر «صح» أو «خطأ»`);
      }
    });
    return out;
  }, [questions]);

  /**
   * الخيارات الفارغة تُحذف عند الحفظ، **وفهرس الإجابة الصحيحة يُنقل معها**.
   *
   * كان الفهرس يُرسل كما هو بعد الحذف: خيارات «أ، (فارغ)، ج، د» والصحيح
   * «ج» (فهرس ٢) تصير «أ، ج، د» فيشير الفهرس ٢ إلى «د» — فينتقل مفتاح
   * الإجابة إلى خيارٍ آخر دون أن يلمس المعلّم شيئاً.
   */
  const payload = useMemo(
    () =>
      JSON.stringify(
        questions.map((q) => {
          if (q.kind !== "mcq") {
            return {
              kind: q.kind,
              prompt: q.prompt.trim(),
              options: [],
              correct_index: null,
              correct_bool: q.kind === "truefalse" ? q.correct_bool : null,
              model_answer: q.kind === "text" ? q.model_answer.trim() : "",
              points: q.points,
            };
          }
          const kept: number[] = [];
          const options = q.options
            .map((o, oi) => ({ text: o.trim(), oi }))
            .filter((x) => {
              if (!x.text) return false;
              kept.push(x.oi);
              return true;
            })
            .map((x) => x.text);
          const moved = q.correct_index === null ? -1 : kept.indexOf(q.correct_index);
          return {
            kind: q.kind,
            prompt: q.prompt.trim(),
            options,
            correct_index: moved >= 0 ? moved : null,
            correct_bool: null,
            model_answer: "",
            points: q.points,
          };
        })
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

      <TemplatePicker
        myTemplates={myTemplates}
        currentPayload={payload}
        hasQuestions={questions.some((q) => q.prompt.trim() !== "")}
        onApply={(qs, mode) =>
          setQuestions((prev) => {
            const mapped = qs.map((q) => ({
              id: newId(),
              kind: q.kind,
              prompt: q.prompt,
              options: q.options.length ? [...q.options] : ["", "", "", ""],
              correct_index: q.correct_index ?? 0,
              correct_bool: q.correct_bool ?? true,
              model_answer: q.model_answer,
              points: Number(q.points),
            }));
            return mode === "append" ? [...prev, ...mapped] : mapped;
          })
        }
      />

      <div className="exam-builder-head">
        <span className="pill pill-free">
          {questions.length} سؤالاً · مجموع {totalPoints} علامة
        </span>
        {targetPoints ? (
          <span className={`pill ${pointsOk ? "pill-live" : "pill-low"}`}>
            {pointsOk
              ? `✓ يطابق العلامة الكلّية (${targetPoints})`
              : totalPoints < targetPoints
                ? `⚠ الاختبار من ${targetPoints} — ينقص ${round(targetPoints - totalPoints)}`
                : `⚠ الاختبار من ${targetPoints} — يزيد ${round(totalPoints - targetPoints)}`}
          </span>
        ) : null}
        {targetPoints && !pointsOk && questions.length > 0 && (
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => {
              /* توزيع متساوٍ مع ضبط الكسر على السؤال الأخير حتى يضبط المجموع تماماً */
              const each = Math.round((targetPoints / questions.length) * 4) / 4;
              setQuestions((prev) =>
                prev.map((q, i) =>
                  i === prev.length - 1
                    ? { ...q, points: round(targetPoints - each * (prev.length - 1)) }
                    : { ...q, points: each }
                )
              );
            }}
          >
            ⚖️ وزّع {targetPoints} بالتساوي
          </button>
        )}
      </div>

      {problems.length > 0 && (
        <p className="form-error exam-problems">
          ⚠ قبل الحفظ: {problems.join(" · ")}
        </p>
      )}

      <ol className="exam-questions">
        {questions.map((q, i) => (
          <li key={q.id} className="exam-question">
            {/* الرقم والحذف في سطر، والحقول تحتهما: تكديسها في سطر واحد
                على الجوال كان يترك زر الحذف وحيداً في آخر السطر */}
            <div className="exam-question-head">
              <span className="exam-question-num">{i + 1}</span>
              <span className="card-actions">
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  disabled={i === 0}
                  onClick={() => setQuestions((p) => swap(p, i, i - 1))}
                  aria-label={`تحريك السؤال ${i + 1} لأعلى`}
                  title="لأعلى"
                >
                  ▲
                </button>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  disabled={i === questions.length - 1}
                  onClick={() => setQuestions((p) => swap(p, i, i + 1))}
                  aria-label={`تحريك السؤال ${i + 1} لأسفل`}
                  title="لأسفل"
                >
                  ▼
                </button>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() =>
                    setQuestions((p) => [
                      ...p.slice(0, i + 1),
                      { ...p[i], id: newId() },
                      ...p.slice(i + 1),
                    ])
                  }
                  aria-label={`تكرار السؤال ${i + 1}`}
                  title="تكرار"
                >
                  ⧉
                </button>
                <button
                  type="button"
                  className="btn btn-outline btn-sm btn-danger"
                  onClick={() => setQuestions((p) => p.filter((_, j) => j !== i))}
                  aria-label={`حذف السؤال ${i + 1}`}
                >
                  ✕
                </button>
              </span>
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
                <span className="form-label">
                  الخيارات — اختر الإجابة الصحيحة
                  {q.correct_index === null && (
                    <span className="key-missing"> ⚠️ لم تُحدَّد بعد</span>
                  )}
                </span>
                {q.options.map((opt, oi) => (
                  <div
                    key={oi}
                    className={`quiz-option-edit ${
                      q.correct_index === oi ? "quiz-option-key" : ""
                    }`}
                  >
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
                <span className="form-label">
                  الإجابة الصحيحة
                  {q.correct_bool === null && (
                    <span className="key-missing"> ⚠️ لم تُحدَّد بعد</span>
                  )}
                </span>
                <div className="form-row">
                  <label
                    className={`stage-option ${
                      q.correct_bool === true ? "quiz-option-key" : ""
                    }`}
                  >
                    <input
                      type="radio"
                      name={`tf-${q.id}`}
                      checked={q.correct_bool === true}
                      onChange={() => patch(i, { correct_bool: true })}
                    />
                    صح
                  </label>
                  <label
                    className={`stage-option ${
                      q.correct_bool === false ? "quiz-option-key" : ""
                    }`}
                  >
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
        {/*
          يُمنع الحفظ ما دام سؤالٌ ناقصاً، والسبب مكتوبٌ بجوار الزرّ لا في
          أعلى نموذجٍ طويل: الخادم يرفضه على أي حال، ورحلةٌ ذهاباً وإياباً
          لتُقرأ الرسالة ليست لطفاً بالمعلّم.
        */}
        <button
          type="submit"
          className="btn btn-primary"
          disabled={pending || problems.length > 0}
        >
          {pending ? "…جارٍ الحفظ" : "💾 حفظ الأسئلة"}
        </button>
        {problems.length > 0 && (
          <span className="form-error exam-problems">{problems[0]}</span>
        )}
      </div>

      {state.message && (
        <p className={state.ok ? "form-ok" : "form-error"}>{state.message}</p>
      )}
    </form>
  );
}
