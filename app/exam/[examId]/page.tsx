import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import ExamTaker from "@/components/ExamTaker";
import ExamWindow from "@/components/ExamWindow";
import ConnectionNotice from "@/components/ConnectionNotice";
import {
  getCurrentUser,
  getExamPaper,
  isCurrentUserTeacher,
} from "@/lib/data/queries";
import { examWindowState } from "@/lib/examTime";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "اختبار | منصة حصة" };

export default async function ExamPage({
  params,
}: {
  params: Promise<{ examId: string }>;
}) {
  const { examId } = await params;

  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/exam/${examId}`);

  // المعلّم يعاين اختباره من لوحته، لا من شاشة التقديم
  if (await isCurrentUserTeacher()) redirect(`/teacher/me/exams/${examId}`);

  let data;
  try {
    data = await getExamPaper(examId);
  } catch {
    return <ConnectionNotice />;
  }
  if (!data) notFound();

  const { exam, questions, attempt, myAnswers } = data;
  const state = examWindowState(exam.opens_at, exam.closes_at);
  const done = attempt && attempt.status !== "in_progress";
  const answerOf = new Map(myAnswers.map((a) => [a.question_id, a]));

  return (
    <main className="container">
      <PageHeader
        backHref="/dashboard"
        backLabel="لوحتي"
        emoji="📝"
        title={exam.title}
        subtitle={
          <>
            🕒 <ExamWindow opens={exam.opens_at} closes={exam.closes_at} />
          </>
        }
      />

      {exam.description && <p className="exam-intro">{exam.description}</p>}

      {done ? (
        <section className="dashboard-section">
          <h2 className="section-title">📊 نتيجتك</h2>
          <p className="exam-score">
            {Number(attempt.auto_score) + Number(attempt.manual_score)} من{" "}
            {attempt.max_score}
          </p>
          {attempt.status === "submitted" ? (
            <p className="form-hint">
              ⏳ بعض أسئلتك نصّية وتنتظر تصحيح معلّمك — الدرجة أعلاه غير نهائية
              حتى ينتهي منها.
            </p>
          ) : (
            <p className="form-ok">✓ اكتمل تصحيح اختبارك.</p>
          )}

          <ol className="exam-paper exam-paper-review">
            {questions.map((q, i) => {
              const a = answerOf.get(q.id);
              return (
                <li key={q.id} className="exam-paper-question">
                  <p className="exam-paper-prompt">
                    <span className="exam-question-num">{i + 1}</span>
                    {q.prompt}{" "}
                    <span className="group-meta">
                      ({a ? Number(a.awarded) : 0} من {q.points})
                    </span>
                  </p>
                  <p className="attempt-text">
                    إجابتك:{" "}
                    {!a
                      ? "— لم تجب —"
                      : q.kind === "mcq"
                        ? a.choice_index === null
                          ? "— لم تجب —"
                          : (q.options[a.choice_index] ?? "—")
                        : q.kind === "truefalse"
                          ? a.bool_answer === null
                            ? "— لم تجب —"
                            : a.bool_answer
                              ? "صح"
                              : "خطأ"
                          : a.text_answer || "— لم تجب —"}
                  </p>
                  {q.kind === "text" && a && !a.graded && (
                    <p className="form-hint">بانتظار تصحيح معلّمك.</p>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      ) : state !== "open" ? (
        <p className="drafts-empty">
          {state === "before"
            ? "لم يفتح هذا الاختبار بعد. عُد في موعده."
            : "أُغلق وقت هذا الاختبار."}
        </p>
      ) : questions.length === 0 ? (
        <p className="drafts-empty">لا أسئلة في هذا الاختبار بعد.</p>
      ) : (
        <section className="dashboard-section">
          <ExamTaker
            examId={exam.id}
            questions={questions}
            startedAt={attempt?.started_at ?? null}
            durationMinutes={exam.duration_minutes}
            closesAt={exam.closes_at}
          />
        </section>
      )}

      <p className="content-foot-hint">
        <Link href="/dashboard" className="back-link">
          ← رجوع إلى لوحتي
        </Link>
      </p>
    </main>
  );
}
