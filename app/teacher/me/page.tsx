import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser, getMyTeacher } from "@/lib/data/queries";
import ShareProfile from "@/components/ShareProfile";
import Stars from "@/components/Stars";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "لوحة المعلّم" };

export default async function TeacherMePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?role=teacher&next=/teacher/me");

  const teacher = await getMyTeacher();
  if (!teacher) redirect("/teacher/onboarding");

  return (
    <main className="container">
      <section className="dashboard-header">
        <div className="dashboard-welcome">
          {teacher.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={teacher.avatar_url} alt={teacher.name} className="teacher-avatar-img" />
          ) : (
            <div className="teacher-avatar" style={{ background: teacher.gradient }}>
              {teacher.initials}
            </div>
          )}
          <div>
            <h1 className="dashboard-title">{teacher.name}</h1>
            <p className="dashboard-subtitle">
              {teacher.subject} · {teacher.stages.join(" / ")}
              {teacher.experience_years > 0 && (
                <> · خبرة {teacher.experience_years} سنة</>
              )}
            </p>
          </div>
        </div>
        <div className="dashboard-header-actions">
          <Link href="/teacher/me/students" className="btn btn-primary">
            👥 طلابي
          </Link>
          <Link href="/teacher/onboarding" className="btn btn-outline">
            ✏️ تعديل بياناتي
          </Link>
          <Link href={`/teacher/${teacher.slug}`} className="btn btn-outline">
            👁 معاينة صفحتي كما يراها الطالب
          </Link>
        </div>
      </section>

      {!teacher.is_published && (
        <div className="visitor-banner">
          بروفايلك غير منشور حالياً في الدليل. عدّل بياناتك واحفظها لنشره.
        </div>
      )}

      <section className="dashboard-stats">
        <div className="stat-box">
          <span className="stat-value">{teacher.experience_years}</span>
          <span className="stat-label">سنوات خبرة</span>
        </div>
        <div className="stat-box">
          <span className="stat-value stat-rating">
            {teacher.rating}
            <Stars rating={Number(teacher.rating)} />
          </span>
          <span className="stat-label">{teacher.rating_count} تقييماً</span>
        </div>
        <div className="stat-box">
          <span className="stat-value">{teacher.stages.length}</span>
          <span className="stat-label">مراحل تدرّسها</span>
        </div>
      </section>

      {teacher.qualification && (
        <section className="dashboard-section">
          <h2 className="section-title">🎓 المؤهل العلمي</h2>
          <p className="me-qualification">{teacher.qualification}</p>
        </section>
      )}

      {teacher.bio && (
        <section className="dashboard-section">
          <h2 className="section-title">📝 نبذة عنك</h2>
          <p className="me-bio">{teacher.bio}</p>
        </section>
      )}

      <ShareProfile slug={teacher.slug} teacherName={teacher.name} />

      <section className="dashboard-section">
        <div className="section-head-row">
          <h2 className="section-title">🎬 محتواك</h2>
          <Link href="/teacher/me/content" className="btn btn-primary">
            إدارة المحتوى
          </Link>
        </div>
        <p className="drafts-empty">
          أضِف الوحدات والدروس المسجّلة والحصص المباشرة، وتظهر مباشرةً في{" "}
          <Link href={`/teacher/${teacher.slug}`} className="back-link">
            بروفايلك العام
          </Link>{" "}
          للطلاب.
        </p>
      </section>
    </main>
  );
}
