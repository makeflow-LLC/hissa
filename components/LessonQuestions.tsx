"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import {
  askQuestion,
  toggleQuestionVote,
  type QuestionState,
} from "@/app/actions/questions";
import type { LessonQuestionRow } from "@/lib/data/queries";

const initial: QuestionState = { ok: false };

/**
 * أسئلة الدرس وأجوبتها.
 *
 * الفكرة كلّها أن السؤال يُجاب **مرّةً واحدة**: اليوم يسأل الطالب في
 * الرسائل الخاصّة فيجيب المعلّم، ثم يسأل زميله السؤال نفسه بعد ساعة.
 * وهنا يُنشر الجواب تحت الدرس فيقرؤه كل من يأتي بعده.
 *
 * والأسئلة غير المُجابة لا يراها إلا صاحبها (تفرضه RLS): وإلا صارت
 * الصفحة جداراً من الأسئلة المعلّقة، وانكشف لكل زميلٍ ما لم يفهمه زميله
 * قبل أن يصل جوابٌ يفيده.
 */
export default function LessonQuestions({
  lessonId,
  questions,
  canAsk,
}: {
  lessonId: string;
  questions: LessonQuestionRow[];
  canAsk: boolean;
}) {
  const router = useRouter();
  const [state, ask, asking] = useActionState(askQuestion, initial);
  const [open, setOpen] = useState(false);
  const [voting, setVoting] = useState<string | null>(null);

  const answered = questions.filter((q) => q.answeredAt && !q.hidden);
  const mineWaiting = questions.filter((q) => !q.answeredAt && q.mine);

  return (
    <section className="lesson-qa">
      <div className="section-head-row">
        <h2 className="section-title">
          ❓ أسئلة الطلاب{answered.length > 0 ? ` (${answered.length})` : ""}
        </h2>
        {canAsk && (
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? "إلغاء" : "✍️ اسأل"}
          </button>
        )}
      </div>

      {canAsk && open && (
        <form action={ask} className="qa-form">
          <input type="hidden" name="lessonId" value={lessonId} />
          <textarea
            name="body"
            rows={3}
            maxLength={1000}
            placeholder="ما الذي لم يتّضح لك في هذا الدرس؟"
            required
          />
          <div className="card-actions">
            <button type="submit" className="btn btn-primary btn-sm" disabled={asking}>
              {asking ? "…يُرسَل" : "أرسِل السؤال"}
            </button>
            <span className="form-hint">
              جوابك سيظهر هنا لبقية الطلاب — فاسأل بوضوح.
            </span>
          </div>
          {state.message && (
            <p className={state.ok ? "form-ok" : "form-error"}>{state.message}</p>
          )}
        </form>
      )}

      {!canAsk && (
        <p className="form-hint">
          الأسئلة متاحة للطلاب الذين قبِلهم المعلّم في صفّه.
        </p>
      )}

      {mineWaiting.length > 0 && (
        <ul className="qa-list qa-waiting">
          {mineWaiting.map((q) => (
            <li key={q.id} className="qa-item">
              <p className="qa-body">{q.body}</p>
              <span className="pill pill-draft">بانتظار جواب المعلّم</span>
            </li>
          ))}
        </ul>
      )}

      {answered.length === 0 ? (
        <p className="drafts-empty">لا أسئلة مُجابة بعد على هذا الدرس.</p>
      ) : (
        <ul className="qa-list">
          {answered.map((q) => (
            <li key={q.id} className="qa-item">
              <p className="qa-body">
                <span aria-hidden="true">🙋 </span>
                {q.body}
              </p>
              <p className="qa-answer">
                <span aria-hidden="true">👩‍🏫 </span>
                {q.answer}
              </p>
              <div className="qa-foot">
                {/*
                  «عندي نفس السؤال» يرفعه في ترتيب المعلّم بدل أن يُكتب
                  من جديد — فيُقاس إلحاحه بعدد المنتظرين لا بترتيب وصوله.
                */}
                <button
                  type="button"
                  className={`btn btn-outline btn-sm ${q.votedByMe ? "btn-active" : ""}`}
                  disabled={voting === q.id}
                  onClick={async () => {
                    setVoting(q.id);
                    await toggleQuestionVote(q.id);
                    setVoting(null);
                    router.refresh();
                  }}
                >
                  {q.votedByMe ? "✓ عندي نفسه" : "🙋 عندي نفس السؤال"}
                  {q.votes > 0 ? ` · ${q.votes}` : ""}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
