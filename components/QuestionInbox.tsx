"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import {
  answerQuestion,
  setQuestionHidden,
  deleteQuestion,
  type QuestionState,
} from "@/app/actions/questions";
import type { LessonQuestionRow } from "@/lib/data/queries";

const initial: QuestionState = { ok: false };

/** صفٌّ واحد في صندوق الأسئلة — لكلٍّ نموذجه، فلا يرسل حفظُ واحد الكلَّ */
function Row({ q }: { q: LessonQuestionRow }) {
  const router = useRouter();
  const [state, answer, saving] = useActionState(answerQuestion, initial);
  const [open, setOpen] = useState(!q.answeredAt);

  return (
    <li className={`qa-item ${q.answeredAt ? "" : "qa-pending"}`}>
      <div className="qa-meta">
        <strong>{q.studentName}</strong>
        {q.lessonTitle && (
          <Link href={`/teacher/me/lessons/${q.lessonId}`} className="group-meta">
            {q.lessonTitle}
          </Link>
        )}
        {q.votes > 0 && (
          <span className="pill pill-live">🙋 {q.votes} يسألون نفسه</span>
        )}
        {!q.answeredAt && <span className="pill pill-low">بانتظارك</span>}
        {q.hidden && <span className="pill pill-draft">مخفيّ</span>}
      </div>

      <p className="qa-body">{q.body}</p>

      {q.answeredAt && !open ? (
        <>
          <p className="qa-answer">{q.answer}</p>
          <div className="card-actions">
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => setOpen(true)}
            >
              ✏️ عدّل الجواب
            </button>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={async () => {
                await setQuestionHidden(q.id, !q.hidden);
                router.refresh();
              }}
            >
              {q.hidden ? "👁 أظهِر" : "🙈 أخفِ"}
            </button>
          </div>
        </>
      ) : (
        <form action={answer} className="qa-form">
          <input type="hidden" name="questionId" value={q.id} />
          <textarea
            name="answer"
            rows={3}
            maxLength={4000}
            defaultValue={q.answer}
            placeholder="اكتب الجواب — سيقرؤه كل طلابك تحت الدرس"
            required
          />
          <div className="card-actions">
            <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
              {saving ? "…يُحفظ" : "📢 انشر الجواب"}
            </button>
            <button
              type="button"
              className="btn btn-outline btn-sm btn-danger"
              onClick={async () => {
                if (!window.confirm("حذف هذا السؤال؟")) return;
                await deleteQuestion(q.id);
                router.refresh();
              }}
            >
              🗑
            </button>
          </div>
          {state.message && (
            <p className={state.ok ? "form-ok" : "form-error"}>{state.message}</p>
          )}
        </form>
      )}
    </li>
  );
}

export default function QuestionInbox({ questions }: { questions: LessonQuestionRow[] }) {
  if (questions.length === 0)
    return <p className="drafts-empty">لا أسئلة بعد — ستظهر هنا فور أن يسأل طالب.</p>;
  return (
    <ul className="qa-list">
      {questions.map((q) => (
        <Row key={q.id} q={q} />
      ))}
    </ul>
  );
}
