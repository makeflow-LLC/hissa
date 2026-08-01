import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import Hint from "@/components/Hint";
import GradingBoard from "@/components/GradingBoard";
import ConnectionNotice from "@/components/ConnectionNotice";
import {
  getCurrentUser,
  getMyTeacher,
  getMyExam,
  getExamAttempts,
} from "@/lib/data/queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "نتائج الاختبار | منصة حصة" };

export default async function GradeExamPage({
  params,
}: {
  params: Promise<{ examId: string }>;
}) {
  const { examId } = await params;

  const user = await getCurrentUser();
  if (!user) redirect(`/login?role=teacher&next=/teacher/me/exams/${examId}/grade`);

  const teacher = await getMyTeacher();
  if (!teacher) redirect("/teacher/onboarding");

  let data;
  let attempts;
  try {
    [data, attempts] = await Promise.all([
      getMyExam(examId),
      getExamAttempts(examId),
    ]);
  } catch {
    return <ConnectionNotice />;
  }
  if (!data) notFound();

  const submitted = attempts.filter((a) => a.status !== "in_progress");
  const average =
    submitted.length > 0
      ? Math.round(
          (submitted.reduce(
            (n, a) => n + (a.max_score > 0 ? ((a.auto_score + a.manual_score) / a.max_score) * 100 : 0),
            0
          ) /
            submitted.length) *
            10
        ) / 10
      : null;

  return (
    <main className="container">
      <PageHeader
        backHref={`/teacher/me/exams/${examId}`}
        backLabel={data.exam.title}
        emoji="📊"
        title="النتائج والتصحيح"
        subtitle={
          submitted.length > 0
            ? `${submitted.length} تسليماً · المعدّل ${average}%`
            : "لا تسليمات بعد."
        }
      />

      <Hint>
        الأسئلة الموضوعية صُحِّحت آلياً لحظة التسليم. ما ينتظرك هنا هو الأسئلة
        النصّية فقط — امنح كل إجابة علامتها، ويُحدَّث مجموع الطالب فوراً.
      </Hint>

      <section className="dashboard-section">
        <GradingBoard questions={data.questions} attempts={attempts} />
      </section>
    </main>
  );
}
