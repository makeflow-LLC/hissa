import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import Hint from "@/components/Hint";
import ConnectionNotice from "@/components/ConnectionNotice";
import {
  getCurrentUser,
  getMyTeacher,
  getMyExams,
  getMyGroups,
} from "@/lib/data/queries";
import ExamWindow from "@/components/ExamWindow";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "الاختبارات | منصة حصة" };

export default async function TeacherExamsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?role=teacher&next=/teacher/me/exams");

  const teacher = await getMyTeacher();
  if (!teacher) redirect("/teacher/onboarding");

  let exams;
  let groups;
  try {
    [exams, groups] = await Promise.all([getMyExams(), getMyGroups()]);
  } catch {
    return <ConnectionNotice />;
  }

  return (
    <main className="container">
      <PageHeader
        backHref="/teacher/me"
        backLabel="لوحة المعلّم"
        emoji="📝"
        title="الاختبارات"
        subtitle="اختبار موجّه إلى مجموعة بعينها، بوقت محدّد وعلامة لكل سؤال."
        actions={
          groups.length > 0 ? (
            <Link href="/teacher/me/exams/new" className="btn btn-primary">
              ➕ اختبار جديد
            </Link>
          ) : undefined
        }
      />

      <Hint>
        الأسئلة الموضوعية (اختيار من متعدّد، صح وخطأ) تُصحَّح آلياً لحظة
        التسليم، والأسئلة النصّية (علّل، اذكر السبب) تصحّحها أنت بنفسك من شاشة
        التصحيح.
      </Hint>

      {groups.length === 0 && (
        <p className="drafts-empty">
          لا مجموعات لديك بعد، والاختبار يُوجَّه إلى مجموعة. أنشئ مجموعة من{" "}
          <Link href="/teacher/me/students" className="back-link">
            صفحة طلابي
          </Link>{" "}
          أولاً.
        </p>
      )}

      {groups.length > 0 && exams.length === 0 && (
        <p className="drafts-empty">
          لا اختبارات بعد. أنشئ أوّل اختبار واربطه بإحدى مجموعاتك.
        </p>
      )}

      {exams.length > 0 && (
        <ul className="exam-list">
          {exams.map((e) => (
            <li key={e.id} className="exam-card">
              <div className="exam-card-main">
                <h2 className="exam-card-title">
                  <Link href={`/teacher/me/exams/${e.id}`}>{e.title}</Link>
                </h2>
                <p className="exam-card-meta">
                  👥 {e.groupName} · {e.questionCount} سؤالاً · {e.totalPoints}{" "}
                  علامة
                </p>
                <p className="exam-card-meta">
                  🕒 <ExamWindow opens={e.opens_at} closes={e.closes_at} />
                </p>
              </div>

              <div className="exam-card-side">
                {e.status === "published" ? (
                  <span className="pill pill-live">منشور</span>
                ) : (
                  <span className="pill pill-draft">مسودّة</span>
                )}
                {e.submittedCount > 0 && (
                  <span className="pill pill-free">{e.submittedCount} تسليماً</span>
                )}
                {e.needsGrading > 0 && (
                  <Link href={`/teacher/me/exams/${e.id}/grade`} className="pill pill-low">
                    ✍️ {e.needsGrading} بانتظار تصحيحك
                  </Link>
                )}
                <div className="card-actions">
                  <Link
                    href={`/teacher/me/exams/${e.id}`}
                    className="btn btn-outline btn-sm"
                  >
                    ✏️ تعديل
                  </Link>
                  <Link
                    href={`/teacher/me/exams/${e.id}/grade`}
                    className="btn btn-outline btn-sm"
                  >
                    📊 النتائج
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
