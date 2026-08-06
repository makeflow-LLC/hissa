import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import Hint from "@/components/Hint";
import ConnectionNotice from "@/components/ConnectionNotice";
import { getCurrentUser, getMyTeacher, getTeacherAssignments } from "@/lib/data/queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "الواجبات | منصة حصة" };

export default async function AssignmentsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?role=teacher&next=/teacher/me/assignments");
  const teacher = await getMyTeacher();
  if (!teacher) redirect("/teacher/onboarding");

  let list;
  try {
    list = await getTeacherAssignments();
  } catch {
    return <ConnectionNotice />;
  }
  const toGrade = list.reduce((n, a) => n + a.ungraded, 0);

  return (
    <main className="container">
      <PageHeader
        backHref="/teacher/me"
        backLabel="لوحة المعلّم"
        emoji="📋"
        title="الواجبات"
        subtitle={
          toGrade > 0 ? `${toGrade} تسليماً بانتظار تصحيحك` : "واجبٌ له موعد وتسليم ولوحة."
        }
        actions={
          <Link href="/teacher/me/assignments/new" className="btn btn-primary">
            ➕ واجب جديد
          </Link>
        }
      />

      <Hint>
        الواجب هنا كيانٌ قائم لا جملةً داخل الدرس: له موعد تسليم، ويسلّمه
        الطالب من لوحته، وترى أنت من سلّم ومن تأخّر ومن لم يسلّم — ثم
        تصحّحه وتكتب ملاحظتك. والمسودّة لا يراها أحد حتى تنشرها.
      </Hint>

      {list.length === 0 ? (
        <p className="drafts-empty">
          لا واجبات بعد. أنشئ أوّل واجب وحدّد موعده.
        </p>
      ) : (
        <ul className="exam-list">
          {list.map((a) => (
            <li key={a.id} className="exam-card">
              <div className="exam-card-main">
                <h2 className="exam-card-title">
                  <Link href={`/teacher/me/assignments/${a.id}`}>📋 {a.title}</Link>
                </h2>
                <p className="exam-card-meta">
                  👥 {a.groupName}
                  {a.lessonTitle ? ` · 📖 ${a.lessonTitle}` : ""}
                </p>
                <p className="exam-card-meta">
                  {a.dueAt
                    ? `⏰ ${new Date(a.dueAt).toLocaleString("ar", { dateStyle: "medium", timeStyle: "short" })}`
                    : "بلا موعد"}
                  {" · "}
                  📤 سلّم {a.submitted} من {a.targets}
                  {a.ungraded > 0 ? ` · ✍️ ${a.ungraded} بانتظار التصحيح` : ""}
                </p>
              </div>
              <div className="exam-card-side">
                {a.status === "published" ? (
                  <span className="pill pill-live">منشور</span>
                ) : (
                  <span className="pill pill-draft">مسودّة</span>
                )}
                <div className="card-actions">
                  <Link
                    href={`/teacher/me/assignments/${a.id}`}
                    className="btn btn-outline btn-sm"
                  >
                    فتح
                  </Link>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
