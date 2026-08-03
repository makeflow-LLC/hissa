import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import Hint from "@/components/Hint";
import ActivityBuilder from "@/components/ActivityBuilder";
import ActivityPublishBar from "@/components/ActivityPublishBar";
import ActivityPlayer from "@/components/ActivityPlayer";
import ActivityLeaderboard from "@/components/ActivityLeaderboard";
import ConnectionNotice from "@/components/ConnectionNotice";
import { kindSpec } from "@/lib/activityKinds";
import {
  getCurrentUser,
  getMyTeacher,
  getMyActivity,
  getMyGroups,
  getMyTeacherContent,
  getMyActivityTemplates,
  getActivityPlays,
  getActivityLeaderboard,
} from "@/lib/data/queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "تعديل نشاط | منصة حصة" };

export default async function EditActivityPage({
  params,
}: {
  params: Promise<{ activityId: string }>;
}) {
  const { activityId } = await params;

  const user = await getCurrentUser();
  if (!user) redirect(`/login?role=teacher&next=/teacher/me/activities/${activityId}`);

  const teacher = await getMyTeacher();
  if (!teacher) redirect("/teacher/onboarding");

  let activity, groups, content, templates, plays, leaders;
  try {
    [activity, groups, content, templates, plays, leaders] = await Promise.all([
      getMyActivity(activityId),
      getMyGroups(),
      getMyTeacherContent(),
      getMyActivityTemplates(),
      getActivityPlays(activityId),
      getActivityLeaderboard(activityId),
    ]);
  } catch {
    return <ConnectionNotice />;
  }
  if (!activity) notFound();

  const spec = kindSpec(activity.kind);
  const lessons = (content?.units ?? []).flatMap((u) =>
    u.lessons.map((l) => ({ id: l.id, title: l.title }))
  );

  return (
    <main className="container">
      <PageHeader
        backHref="/teacher/me/activities"
        backLabel="الأنشطة"
        emoji={spec.icon}
        title={activity.title}
        subtitle={`${spec.label} · ${activity.items.length} عنصراً`}
      />

      <ActivityPublishBar activityId={activity.id} status={activity.status} />

      <section className="dashboard-section">
        <h2 className="section-title">▶️ جرّبها كما يراها طالبك</h2>
        <Hint>
          العبها بنفسك قبل النشر — تكتشف الصف الناقص أو الكلمة الملتبسة أسرع
          من مراجعة الجدول. لا تُسجَّل لك نتيجة هنا.
        </Hint>
        {activity.items.length === 0 ? (
          <p className="drafts-empty">أضِف عناصر أولاً لتجرّبها.</p>
        ) : (
          <ActivityPlayer
            preview
            activity={{
              id: activity.id,
              title: activity.title,
              instructions: activity.instructions,
              kind: activity.kind,
              items: activity.items,
              imageUrl: activity.image_url ?? "",
              teacherName: teacher.name,
              showLeaderboard: activity.show_leaderboard,
              bestScore: null,
              bestTotal: null,
              plays: 0,
            }}
          />
        )}
      </section>

      <section className="dashboard-section">
        <h2 className="section-title">✏️ تعديل النشاط</h2>
        <ActivityBuilder
          activity={activity}
          groups={groups}
          lessons={lessons}
          myTemplates={templates}
        />
      </section>

      {activity.show_leaderboard && (
        <section className="dashboard-section">
          <h2 className="section-title">🏆 لوحة الصدارة كما يراها طلابك</h2>
          <Hint>
            تعرض أفضل نتيجة لكل طالب لا آخرها، فالإعادة لا تُنقص أحداً. إن
            رأيت المنافسة تُثبّط بعض طلابك فأطفئها من نموذج التعديل.
          </Hint>
          <ActivityLeaderboard rows={leaders} />
        </section>
      )}

      <section className="dashboard-section">
        <h2 className="section-title">🎯 من لعبه</h2>
        {plays.length === 0 ? (
          <p className="drafts-empty">لم يلعبه أحد بعد.</p>
        ) : (
          <ul className="result-list">
            {plays.map((p) => (
              <li key={p.id} className="result-row">
                <Link
                  href={`/teacher/me/students/${p.studentId}`}
                  className="result-title"
                >
                  {p.studentName}
                </Link>
                {p.total > 0 ? (
                  <span className="pill pill-free">
                    {p.score} من {p.total}
                  </span>
                ) : (
                  <span className="pill pill-draft">أنهاه</span>
                )}
                <span className="group-meta">
                  {p.seconds > 0 && `${p.seconds} ثانية · `}
                  {new Date(p.played_at).toLocaleDateString("ar-EG", {
                    day: "numeric",
                    month: "long",
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
