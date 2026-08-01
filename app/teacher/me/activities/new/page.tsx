import { redirect } from "next/navigation";
import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import ActivityBuilder from "@/components/ActivityBuilder";
import ConnectionNotice from "@/components/ConnectionNotice";
import {
  getCurrentUser,
  getMyTeacher,
  getMyGroups,
  getMyTeacherContent,
  getMyActivityTemplates,
} from "@/lib/data/queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "نشاط جديد | منصة حصة" };

export default async function NewActivityPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?role=teacher&next=/teacher/me/activities/new");

  const teacher = await getMyTeacher();
  if (!teacher) redirect("/teacher/onboarding");

  let groups, content, templates;
  try {
    [groups, content, templates] = await Promise.all([
      getMyGroups(),
      getMyTeacherContent(),
      getMyActivityTemplates(),
    ]);
  } catch {
    return <ConnectionNotice />;
  }

  const lessons = (content?.units ?? []).flatMap((u) =>
    u.lessons.map((l) => ({ id: l.id, title: l.title }))
  );

  return (
    <main className="container">
      <PageHeader
        backHref="/teacher/me/activities"
        backLabel="الأنشطة"
        emoji="➕"
        title="نشاط جديد"
        subtitle="اختر اللعبة، واكتب الأزواج، ثم انشره."
      />
      <section className="dashboard-section">
        <ActivityBuilder groups={groups} lessons={lessons} myTemplates={templates} />
      </section>
    </main>
  );
}
