import { redirect } from "next/navigation";
import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import ExamForm from "@/components/ExamForm";
import ConnectionNotice from "@/components/ConnectionNotice";
import { getCurrentUser, getMyTeacher, getMyGroups } from "@/lib/data/queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "اختبار جديد | منصة حصة" };

export default async function NewExamPage({
  searchParams,
}: {
  searchParams: Promise<{ group?: string }>;
}) {
  const { group } = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login?role=teacher&next=/teacher/me/exams/new");

  const teacher = await getMyTeacher();
  if (!teacher) redirect("/teacher/onboarding");

  let groups;
  try {
    groups = await getMyGroups();
  } catch {
    return <ConnectionNotice />;
  }

  return (
    <main className="container">
      <PageHeader
        backHref="/teacher/me/exams"
        backLabel="الاختبارات"
        emoji="➕"
        title="اختبار جديد"
        subtitle="اكتب بيانات الاختبار أوّلاً، ثم تُفتح لك صفحة كتابة الأسئلة."
      />
      <section className="dashboard-section">
        {/* المجموعة تأتي مختارةً حين يبدأ المعلّم من لوحة مجموعته */}
        <ExamForm groups={groups} defaultGroupId={group} />
      </section>
    </main>
  );
}
