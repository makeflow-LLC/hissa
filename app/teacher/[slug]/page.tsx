import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser, getTeacherProfile } from "@/lib/data/queries";
import TeacherTabs from "@/components/TeacherTabs";
import FollowButton from "@/components/FollowButton";
import ConnectionNotice from "@/components/ConnectionNotice";
import Stars from "@/components/Stars";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const profile = await getTeacherProfile((await params).slug);
  return { title: profile ? `${profile.teacher.name} | منصة حصة` : "منصة حصة" };
}

export default async function TeacherProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await getCurrentUser();

  let profile: Awaited<ReturnType<typeof getTeacherProfile>> = null;
  let loadError: string | undefined;
  try {
    profile = await getTeacherProfile(slug);
  } catch (e) {
    loadError = e instanceof Error ? e.message : String(e);
  }

  // فشل الاتصال ≠ معلم غير موجود: نميّز بينهما بوضوح
  if (loadError) {
    return (
      <main className="container container-narrow">
        <ConnectionNotice detail={loadError} />
      </main>
    );
  }
  if (!profile) notFound();

  const { teacher, units, liveSessions } = profile;
  const lessonCount = units.reduce((n, u) => n + u.lessons.length, 0);
  const waDigits = teacher.whatsapp?.replace(/[^0-9]/g, "") ?? "";

  return (
    <main className="container">
      <nav className="breadcrumb">
        <Link href="/" className="back-link">
          → دليل المعلّمين
        </Link>
      </nav>

      <section className="profile-header">
        {teacher.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={teacher.avatar_url} alt={teacher.name} className="profile-avatar-img" />
        ) : (
          <div className="profile-avatar" style={{ background: teacher.gradient }}>
            {teacher.initials}
          </div>
        )}
        <h1 className="profile-name">{teacher.name}</h1>
        <div className="teacher-tags">
          <span className="tag tag-subject">{teacher.subject}</span>
          {teacher.stages.map((s) => (
            <span key={s} className="tag tag-stage">
              {s}
            </span>
          ))}
        </div>

        {(teacher.qualification || teacher.experience_years > 0) && (
          <div className="profile-credentials">
            {teacher.qualification && (
              <span className="credential">
                <span aria-hidden="true">🎓</span> {teacher.qualification}
              </span>
            )}
            {teacher.experience_years > 0 && (
              <span className="credential">
                <span aria-hidden="true">⏳</span> خبرة {teacher.experience_years} سنة
              </span>
            )}
          </div>
        )}

        <p className="profile-bio">{teacher.bio}</p>

        <div className="profile-actions">
          <FollowButton
            teacherId={teacher.id}
            teacherSlug={teacher.slug}
            isFollowing={profile.isFollowing}
            isAuthed={Boolean(user)}
          />
          {waDigits && (
            <a
              href={`https://wa.me/${waDigits}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-whatsapp"
            >
              💬 تواصل واتساب
            </a>
          )}
        </div>

        <div className="stats-row">
          <div className="stat-box">
            <span className="stat-value">{lessonCount}</span>
            <span className="stat-label">درساً مسجّلاً</span>
          </div>
          <div className="stat-box">
            <span className="stat-value">{liveSessions.length}</span>
            <span className="stat-label">حصص مباشرة</span>
          </div>
          <div className="stat-box">
            <span className="stat-value stat-rating">
              {teacher.rating}
              <Stars rating={Number(teacher.rating)} />
            </span>
            <span className="stat-label">{teacher.rating_count} تقييماً</span>
          </div>
        </div>
      </section>

      {!user && (
        <div className="visitor-banner">
          <strong>أنت تتصفّح كزائر.</strong> ترى عناوين الدروس ووصفها، ودرساً واحداً
          كعيّنة مجانية. سجّل الدخول مجاناً لمشاهدة كل الدروس وتحميل المرفقات
          والتسجيل في الحصص.
          <Link
            href={`/login?next=${encodeURIComponent(`/teacher/${slug}`)}`}
            className="btn btn-primary btn-sm"
          >
            سجّل الدخول
          </Link>
        </div>
      )}

      <TeacherTabs profile={profile} isAuthed={Boolean(user)} />
    </main>
  );
}
