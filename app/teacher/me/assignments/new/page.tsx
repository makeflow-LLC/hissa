import { redirect } from "next/navigation";
import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import ConnectionNotice from "@/components/ConnectionNotice";
import AssignmentForm from "@/components/AssignmentForm";
import {
  getCurrentUser,
  getMyGroups,
  getMyTeacherContent,
} from "@/lib/data/queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "واجب جديد | منصة حصة" };

export default async function NewAssignmentPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?role=teacher&next=/teacher/me/assignments/new");

  let groups;
  let content;
  try {
    [groups, content] = await Promise.all([getMyGroups(), getMyTeacherContent()]);
  } catch {
    return <ConnectionNotice />;
  }
  if (!content) redirect("/teacher/onboarding");

  const lessons = [
    ...content.units.flatMap((u) => u.lessons),
    ...content.looseLessons,
  ].map((l) => ({ id: l.id, title: l.title }));

  return (
    <main className="container container-narrow">
      <PageHeader
        backHref="/teacher/me/assignments"
        backLabel="الواجبات"
        emoji="📋"
        title="واجب جديد"
      />
      <AssignmentForm groups={groups} lessons={lessons} />
    </main>
  );
}
