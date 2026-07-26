import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTeacherBySlug, teachers } from "@/lib/teachers";

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

  return (
    <main className="container">
      <nav className="breadcrumb">
        <Link href="/" className="back-link">
          ← العودة لدليل المعلّمين
        </Link>
      </nav>

      <section className="profile-header">
        <div
          className="profile-avatar"
          style={{ background: teacher.gradient }}
        >
          {teacher.initials}
        </div>
        <h1 className="profile-name">{teacher.name}</h1>
        <div className="teacher-tags">
          <span className="tag tag-subject">{teacher.subject}</span>
          <span className="tag tag-stage">{teacher.stage}</span>
        </div>
        <p className="profile-bio">{teacher.bio}</p>
      </section>

      <section>
        <h2 className="section-title">الحصص المتاحة</h2>
        <div className="lessons-list">
          {teacher.lessons.map((lesson) => (
            <article key={lesson.id} className="lesson-card">
              <div
                className="lesson-image"
                style={{ background: lesson.gradient }}
                aria-hidden="true"
              >
                {lesson.emoji}
              </div>
              <div className="lesson-body">
                <h3 className="lesson-title">{lesson.title}</h3>
                <p className="lesson-description">{lesson.description}</p>
                <span className="lesson-duration">⏱ {lesson.duration}</span>
              </div>
              <button type="button" className="btn btn-primary btn-book">
                احجز
              </button>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
