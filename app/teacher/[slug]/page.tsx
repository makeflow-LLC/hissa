import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTeacherBySlug, teachers } from "@/lib/teachers";
import TeacherTabs from "@/components/TeacherTabs";
import Stars from "@/components/Stars";

export function generateStaticParams() {
  return teachers.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const teacher = getTeacherBySlug((await params).slug);
  return {
    title: teacher ? `${teacher.name} | منصة حصة` : "منصة حصة",
  };
}

export default async function TeacherProfile({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const teacher = getTeacherBySlug((await params).slug);
  if (!teacher) notFound();

  const lessonCount = teacher.units.reduce((n, u) => n + u.lessons.length, 0);

  return (
    <main className="container">
      <nav className="breadcrumb">
        <Link href="/" className="back-link">
          → دليل المعلّمين
        </Link>
      </nav>

      <section className="profile-header">
        <div className="profile-avatar" style={{ background: teacher.gradient }}>
          {teacher.initials}
        </div>
        <h1 className="profile-name">{teacher.name}</h1>
        <div className="teacher-tags">
          <span className="tag tag-subject">{teacher.subject}</span>
          <span className="tag tag-stage">{teacher.stage}</span>
        </div>
        <p className="profile-bio">{teacher.bio}</p>

        <div className="stats-row">
          <div className="stat-box">
            <span className="stat-value">{lessonCount}</span>
            <span className="stat-label">درساً مسجّلاً</span>
          </div>
          <div className="stat-box">
            <span className="stat-value">{teacher.liveSessions.length}</span>
            <span className="stat-label">حصص مباشرة</span>
          </div>
          <div className="stat-box">
            <span className="stat-value stat-rating">
              {teacher.rating}
              <Stars rating={teacher.rating} />
            </span>
            <span className="stat-label">{teacher.ratingCount} تقييماً</span>
          </div>
        </div>
      </section>

      <TeacherTabs teacher={teacher} />
    </main>
  );
}
