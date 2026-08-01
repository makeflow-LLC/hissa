"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { startExam, submitExam } from "@/app/actions/exams";
import AutoTextarea from "@/components/AutoTextarea";
import { deadlineFor } from "@/lib/examTime";
import type { ExamPaperQuestion } from "@/lib/data/types";

interface Answer {
  choiceIndex: number | null;
  boolAnswer: boolean | null;
  text: string;
}

const blank: Answer = { choiceIndex: null, boolAnswer: null, text: "" };

function remainingLabel(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0
    ? `${h}:${pad(m % 60)}:${pad(s % 60)}`
    : `${pad(m)}:${pad(s % 60)}`;
}

/**
 * تقديم الطالب للاختبار.
 *
 * **لا تصحيح هنا.** المكوّن يرسل اختيارات الطالب فقط؛ الخادم يقرأ الإجابات
 * الصحيحة ويحتسب الدرجة. لو صُحِّح في المتصفّح ووُثِق بدرجة يرسلها، لسلّم
 * كلُّ طالب علامةً تامّة.
 */
export default function ExamTaker({
  examId,
  questions,
  startedAt,
  durationMinutes,
  closesAt,
}: {
  examId: string;
  questions: ExamPaperQuestion[];
  /** وقت بدء المحاولة، أو null إن لم يبدأ بعد */
  startedAt: string | null;
  durationMinutes: number | null;
  closesAt: string | null;
}) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [left, setLeft] = useState<number | null>(null);
  const submittedRef = useRef(false);

  const answered = questions.filter((q) => {
    const a = answers[q.id];
    if (!a) return false;
    return a.choiceIndex !== null || a.boolAnswer !== null || a.text.trim() !== "";
  }).length;

  const send = useCallback(() => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setErr("");
    setMsg("");
    startTransition(async () => {
      const res = await submitExam(
        examId,
        questions.map((q) => {
          const a = answers[q.id] ?? blank;
          return {
            questionId: q.id,
            choiceIndex: q.kind === "mcq" ? a.choiceIndex : null,
            boolAnswer: q.kind === "truefalse" ? a.boolAnswer : null,
            text: q.kind === "text" ? a.text : "",
          };
        })
      );
      if (res.ok) setMsg(res.message ?? "سُلّم اختبارك.");
      else {
        setErr(res.message ?? "تعذّر التسليم.");
        submittedRef.current = false;
      }
      router.refresh();
    });
  }, [examId, questions, answers, router]);

  /**
   * عدّاد الوقت. انتهاؤه **والصفحة مفتوحة** يسلّم ما كُتب تلقائياً بدل أن
   * يضيع مجهود الطالب على شاشة مغلقة.
   *
   * أمّا من فتح الصفحة وقد انقضى وقته أصلاً فلا يُسلَّم عنه شيء: تسليم ورقة
   * فارغة نيابةً عنه يحرق محاولته الوحيدة. يُعرض له أن وقته انتهى ويقرّر هو.
   */
  const deadline = startedAt
    ? deadlineFor(startedAt, durationMinutes, closesAt)
    : null;
  const expiredAtMount = useRef<boolean | null>(null);

  useEffect(() => {
    if (!deadline) return;
    const tick = () => {
      const ms = deadline - Date.now();
      setLeft(ms);
      if (expiredAtMount.current === null) expiredAtMount.current = ms <= 0;
      if (ms <= 0 && expiredAtMount.current === false) send();
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [deadline, send]);

  if (!startedAt) {
    return (
      <div className="exam-start">
        <p className="form-hint">
          {questions.length} سؤالاً
          {durationMinutes ? ` · مدّة الإجابة ${durationMinutes} دقيقة تبدأ من ضغطك على «ابدأ»` : ""}
          . لك محاولة واحدة فقط.
        </p>
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy}
          onClick={() => {
            setErr("");
            startTransition(async () => {
              const res = await startExam(examId);
              if (!res.ok) setErr(res.message ?? "تعذّر بدء الاختبار.");
              router.refresh();
            });
          }}
        >
          {busy ? "…لحظة" : "▶️ ابدأ الاختبار"}
        </button>
        {err && <p className="form-error">{err}</p>}
      </div>
    );
  }

  function patch(id: string, next: Partial<Answer>) {
    setAnswers((prev) => ({ ...prev, [id]: { ...blank, ...prev[id], ...next } }));
  }

  return (
    <div className="exam-taker">
      <div className="exam-taker-bar">
        <span className="pill pill-free">
          أجبتَ {answered} من {questions.length}
        </span>
        {left !== null &&
          (left <= 0 ? (
            <span className="pill pill-low">⌛ انتهى وقتك — سلّم الآن</span>
          ) : (
            <span className={left < 60_000 ? "pill pill-low" : "pill pill-draft"}>
              ⏳ متبقٍّ {remainingLabel(left)}
            </span>
          ))}
      </div>

      <ol className="exam-paper">
        {questions.map((q, i) => {
          const a = answers[q.id] ?? blank;
          return (
            <li key={q.id} className="exam-paper-question">
              <p className="exam-paper-prompt">
                <span className="exam-question-num">{i + 1}</span>
                {q.prompt}{" "}
                <span className="group-meta">({q.points} علامة)</span>
              </p>

              {q.kind === "mcq" && (
                <div className="exam-choices">
                  {q.options.map((opt, oi) => (
                    <label key={oi} className="exam-choice">
                      <input
                        type="radio"
                        name={`q-${q.id}`}
                        checked={a.choiceIndex === oi}
                        onChange={() => patch(q.id, { choiceIndex: oi })}
                      />
                      <span>{opt}</span>
                    </label>
                  ))}
                </div>
              )}

              {q.kind === "truefalse" && (
                <div className="exam-choices">
                  <label className="exam-choice">
                    <input
                      type="radio"
                      name={`q-${q.id}`}
                      checked={a.boolAnswer === true}
                      onChange={() => patch(q.id, { boolAnswer: true })}
                    />
                    <span>صح</span>
                  </label>
                  <label className="exam-choice">
                    <input
                      type="radio"
                      name={`q-${q.id}`}
                      checked={a.boolAnswer === false}
                      onChange={() => patch(q.id, { boolAnswer: false })}
                    />
                    <span>خطأ</span>
                  </label>
                </div>
              )}

              {q.kind === "text" && (
                <AutoTextarea
                  className="search-input"
                  value={a.text}
                  onChange={(e) => patch(q.id, { text: e.target.value })}
                  placeholder="اكتب إجابتك…"
                />
              )}
            </li>
          );
        })}
      </ol>

      <div className="card-actions exam-submit-row">
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy}
          onClick={() => {
            if (
              answered < questions.length &&
              !window.confirm(
                `لم تُجب عن ${questions.length - answered} سؤالاً. تسلّم الآن؟`
              )
            )
              return;
            send();
          }}
        >
          {busy ? "…جارٍ التسليم" : "📤 سلّم الاختبار"}
        </button>
      </div>

      {msg && <p className="form-ok">{msg}</p>}
      {err && <p className="form-error">{err}</p>}
    </div>
  );
}
