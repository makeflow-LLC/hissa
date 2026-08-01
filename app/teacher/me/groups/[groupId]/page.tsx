import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import Hint from "@/components/Hint";
import GroupDetailsForm from "@/components/GroupDetailsForm";
import GroupMembersPanel from "@/components/GroupMembersPanel";
import GroupBroadcast from "@/components/GroupBroadcast";
import GroupLessonAccess from "@/components/GroupLessonAccess";
import ConnectionNotice from "@/components/ConnectionNotice";
import { getCurrentUser, getMyTeacher, getGroupHub } from "@/lib/data/queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "لوحة المجموعة | منصة حصة" };

export default async function GroupHubPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;

  const user = await getCurrentUser();
  if (!user) redirect(`/login?role=teacher&next=/teacher/me/groups/${groupId}`);

  const teacher = await getMyTeacher();
  if (!teacher) redirect("/teacher/onboarding");

  let hub;
  try {
    hub = await getGroupHub(groupId);
  } catch {
    return <ConnectionNotice />;
  }
  if (!hub) notFound();

  const { group, members, candidates, announcements, exams, restrictedLessons } = hub;

  // متوسّطات المجموعة: صورة سريعة عن حال الصفّ قبل النزول إلى الأفراد
  const withScores = members.filter((m) => m.examAvg !== null);
  const groupExamAvg = withScores.length
    ? Math.round(
        (withScores.reduce((n, m) => n + (m.examAvg ?? 0), 0) / withScores.length) * 10
      ) / 10
    : null;
  const groupProgress = members.length
    ? Math.round(members.reduce((n, m) => n + m.progressPct, 0) / members.length)
    : 0;
  const waiting = members.filter((m) => m.awaitingReply).length;

  return (
    <main className="container">
      <PageHeader
        backHref="/teacher/me/students"
        backLabel="طلابي"
        emoji="👥"
        title={group.name}
        subtitle={
          group.schedule
            ? `${group.memberCount} طالباً · 🕒 ${group.schedule}`
            : `${group.memberCount} طالباً`
        }
        actions={
          <Link
            href={`/teacher/me/exams/new?group=${group.id}`}
            className="btn btn-primary"
          >
            ➕ اختبار لهذه المجموعة
          </Link>
        }
      />

      {group.goal && (
        <p className="group-goal">
          🎯 <strong>هدف الفصل:</strong> {group.goal}
        </p>
      )}

      <section className="dashboard-stats">
        <div className="stat-box">
          <span className="stat-value">{group.memberCount}</span>
          <span className="stat-label">طالباً</span>
        </div>
        <div className="stat-box">
          <span className="stat-value">{groupProgress}%</span>
          <span className="stat-label">متوسّط التقدّم</span>
        </div>
        <div className="stat-box">
          {groupExamAvg === null ? (
            <>
              <span className="stat-value stat-value-muted">—</span>
              <span className="stat-label">لا اختبارات بعد</span>
            </>
          ) : (
            <>
              <span className="stat-value">{groupExamAvg}%</span>
              <span className="stat-label">متوسّط الاختبارات</span>
            </>
          )}
        </div>
      </section>

      {waiting > 0 && (
        <div className="visitor-banner">
          ✉️ <strong>{waiting}</strong> من طلاب هذه المجموعة أرسلوا رسالة تنتظر ردّك.
        </div>
      )}

      {group.whatsapp_link && (
        <a
          href={group.whatsapp_link}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-outline whatsapp-group-btn"
        >
          💬 فتح مجموعة الواتساب
        </a>
      )}

      <section className="dashboard-section">
        <h2 className="section-title">📢 تعميم للمجموعة</h2>
        <Hint>
          يصل أعضاء هذه المجموعة وحدهم — لا بقية متابعيك. يظهر على لوحة كل
          عضو مع إشعار لحظي وصوت إن كان على المنصة، ويستطيع الطالب الردّ عليه
          في محادثة خاصّة بينكما.
        </Hint>
        <GroupBroadcast
          groupId={group.id}
          memberCount={group.memberCount}
          announcements={announcements}
        />
      </section>

      <section className="dashboard-section">
        <h2 className="section-title">🧑‍🎓 الأعضاء وإنجازهم</h2>
        <Hint>
          لكل طالب تقدّمه في دروسك، ومعدّل اختبارات هذه المجموعة، وآخر بطاقة
          تقييم صدرت له. «ينتظر ردّك» تعني أن آخر رسالة في محادثتكما منه هو.
        </Hint>
        <GroupMembersPanel
          groupId={group.id}
          members={members}
          candidates={candidates}
        />
      </section>

      <section className="dashboard-section">
        <h2 className="section-title">📝 اختبارات المجموعة</h2>
        <Hint>
          الاختبار يُوجَّه إلى مجموعة واحدة، فما تنشئه هنا لا يراه إلا طلاب هذه
          المجموعة. الأسئلة الموضوعية تُصحَّح آلياً، والنصّية تنتظر تصحيحك.
        </Hint>
        {exams.length === 0 ? (
          <p className="drafts-empty">
            لا اختبارات لهذه المجموعة بعد.{" "}
            <Link href={`/teacher/me/exams/new?group=${group.id}`} className="back-link">
              أنشئ أوّل اختبار
            </Link>
            .
          </p>
        ) : (
          <ul className="exam-list">
            {exams.map((e) => (
              <li key={e.id} className="exam-card">
                <div className="exam-card-main">
                  <h3 className="exam-card-title">
                    <Link href={`/teacher/me/exams/${e.id}`}>{e.title}</Link>
                  </h3>
                  <p className="exam-card-meta">{e.submittedCount} تسليماً</p>
                </div>
                <div className="exam-card-side">
                  {e.status === "published" ? (
                    <span className="pill pill-live">منشور</span>
                  ) : (
                    <span className="pill pill-draft">مسودّة</span>
                  )}
                  {e.needsGrading > 0 && (
                    <Link
                      href={`/teacher/me/exams/${e.id}/grade`}
                      className="pill pill-low"
                    >
                      ✍️ {e.needsGrading} بانتظار تصحيحك
                    </Link>
                  )}
                  <Link
                    href={`/teacher/me/exams/${e.id}/grade`}
                    className="btn btn-outline btn-sm"
                  >
                    📊 النتائج
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="dashboard-section">
        <h2 className="section-title">🔒 دروس خاصّة للمجموعة</h2>
        <Hint>
          الدرس المعلَّم «خاص» مخفيّ تماماً — حتى عنوانه — عمّن لا منحة له.
          من هنا تمنحه لأعضاء المجموعة كلّهم دفعةً واحدة بدل منحه طالباً طالباً.
        </Hint>
        <GroupLessonAccess
          groupId={group.id}
          memberCount={group.memberCount}
          lessons={restrictedLessons}
        />
      </section>

      <section className="dashboard-section">
        <h2 className="section-title">⚙️ بيانات المجموعة</h2>
        <GroupDetailsForm group={group} />
      </section>
    </main>
  );
}
