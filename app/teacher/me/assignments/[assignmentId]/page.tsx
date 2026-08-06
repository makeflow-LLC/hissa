import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import ConnectionNotice from "@/components/ConnectionNotice";
import AssignmentActions from "@/components/AssignmentActions";
import SubmissionGrader from "@/components/SubmissionGrader";
import { getCurrentUser, getAssignmentBoard } from "@/lib/data/queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "لوحة الواجب | منصة حصة" };

export default async function AssignmentBoardPage({
  params,
}: {
  params: Promise<{ assignmentId: string }>;
}) {
  const { assignmentId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?role=teacher&next=/teacher/me/assignments/${assignmentId}`);

  let board;
  try {
    board = await getAssignmentBoard(assignmentId);
  } catch {
    return <ConnectionNotice />;
  }
  // معرّفٌ ليس لهذا المعلّم يعود `null` — لا يفتح شيئاً
  if (!board) notFound();

  const { assignment: a, submissions } = board;
  const ungraded = submissions.filter((s) => !s.gradedAt).length;

  return (
    <main className="container">
      <PageHeader
        backHref="/teacher/me/assignments"
        backLabel="الواجبات"
        emoji="📋"
        title={a.title}
        subtitle={
          <>
            👥 {a.groupName}
            {a.dueAt
              ? ` · ⏰ ${new Date(a.dueAt).toLocaleString("ar", { dateStyle: "medium", timeStyle: "short" })}`
              : " · بلا موعد"}
            {" · "}
            {a.status === "published" ? "منشور" : "مسودّة"}
          </>
        }
        actions={<AssignmentActions id={a.id} status={a.status} title={a.title} />}
      />

      {a.body && <p className="assignment-body">{a.body}</p>}

      <section className="dashboard-section">
        <h2 className="section-title">
          📤 التسليمات ({submissions.length})
          {ungraded > 0 && (
            <span className="pill pill-low"> {ungraded} بانتظار التصحيح</span>
          )}
        </h2>
        {submissions.length === 0 ? (
          <p className="drafts-empty">
            لم يسلّم أحد بعد.
            {a.status !== "published" && " انشر الواجب أولاً ليصل طلابك."}
          </p>
        ) : (
          <ul className="submission-list">
            {submissions.map((s) => (
              <SubmissionGrader key={s.id} s={s} />
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
