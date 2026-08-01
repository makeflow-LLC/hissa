import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import Hint from "@/components/Hint";
import ExamForm from "@/components/ExamForm";
import ExamBuilder from "@/components/ExamBuilder";
import ExamPublishBar from "@/components/ExamPublishBar";
import ConnectionNotice from "@/components/ConnectionNotice";
import {
  getCurrentUser,
  getMyTeacher,
  getMyExam,
  getMyGroups,
  getExamAttempts,
  getMyExamTemplates,
} from "@/lib/data/queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "تعديل اختبار | منصة حصة" };

export default async function EditExamPage({
  params,
}: {
  params: Promise<{ examId: string }>;
}) {
  const { examId } = await params;

  const user = await getCurrentUser();
  if (!user) redirect(`/login?role=teacher&next=/teacher/me/exams/${examId}`);

  const teacher = await getMyTeacher();
  if (!teacher) redirect("/teacher/onboarding");

  let data;
  let groups;
  let attempts;
  let templates;
  try {
    [data, groups, attempts, templates] = await Promise.all([
      getMyExam(examId),
      getMyGroups(),
      getExamAttempts(examId),
      getMyExamTemplates(),
    ]);
  } catch {
    return <ConnectionNotice />;
  }
  if (!data) notFound();

  const { exam, questions } = data;
  const totalPoints = questions.reduce((n, q) => n + Number(q.points), 0);

  return (
    <main className="container">
      <PageHeader
        backHref="/teacher/me/exams"
        backLabel="الاختبارات"
        emoji="📝"
        title={exam.title}
        subtitle={`${questions.length} سؤالاً · ${totalPoints} علامة`}
        actions={
          <Link
            href={`/teacher/me/exams/${exam.id}/grade`}
            className="btn btn-outline"
          >
            📊 النتائج والتصحيح
          </Link>
        }
      />

      <ExamPublishBar
        examId={exam.id}
        status={exam.status}
        questionCount={questions.length}
        hasAttempts={attempts.length > 0}
      />

      <section className="dashboard-section">
        <h2 className="section-title">⚙️ بيانات الاختبار</h2>
        <ExamForm exam={exam} groups={groups} />
      </section>

      <section className="dashboard-section">
        <h2 className="section-title">❓ الأسئلة</h2>
        <Hint>
          حدّد لكل سؤال نوعه وعلامته. الاختيار من متعدّد وصح/خطأ يُصحَّحان
          آلياً، والسؤال النصّي ينتظر تصحيحك — والإجابة النموذجية التي تكتبها لا
          يراها الطالب، إنما تعينك أنت وقت التصحيح.
        </Hint>
        <ExamBuilder
          examId={exam.id}
          initialQuestions={questions}
          locked={attempts.length > 0}
          myTemplates={templates}
          targetPoints={exam.target_points}
        />
      </section>
    </main>
  );
}
