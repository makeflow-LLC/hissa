import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getAllLessons, getLessonContext, teachers } from "@/lib/teachers";
import VideoPlayer from "@/components/VideoPlayer";
import LessonCompleteButton from "@/components/LessonCompleteButton";

export function generateStaticParams() {
  return teachers.flatMap((t) =>
    getAllLessons(t).map(({ lesson }) => ({ slug: t.slug, lessonId: lesson.id }))
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; lessonId: string }>;
}): Promise<Metadata> {
  const { slug, lessonId } = await params;
  const ctx = getLessonContext(slug, lessonId);
  return {
    title: ctx ? `${ctx.lesson.title} | ${ctx.teacher.name} | منصة حصة` : "منصة حصة",
  };
}

export default async function LessonPage({
  params,
}: {
  params: Promise<{ slug: string; lessonId: string }>;
}) {
  const { slug, lessonId } = await params;
  const ctx = getLessonContext(slug, lessonId);
  if (!ctx) notFound();

  const { teacher, unit, lesson, index, total, prev, next } = ctx;

  return (
    <main className="container container-narrow">
      <nav className="breadcrumb">
        <Link href="/" className="back-link">
          دليل المعلّمين
        </Link>
        <span className="breadcrumb-sep">/</span>
        <Link href={`/teacher/${teacher.slug}`} className="back-link">
          {teacher.name}
        </Link>
        <span className="breadcrumb-sep">/</span>
        <span className="breadcrumb-current">{lesson.title}</span>
      </nav>

      <header className="lesson-header">
        <span className="unit-chip">{unit.title}</span>
        <h1 className="lesson-page-title">{lesson.title}</h1>
        <p className="lesson-page-description">{lesson.description}</p>
        <div className="lesson-page-meta">
          <span className="lesson-duration">⏱ {lesson.duration}</span>
          <span className="lesson-order">
            الدرس {index + 1} من {total}
          </span>
        </div>
      </header>

      <VideoPlayer
        src={lesson.videoUrl}
        gradient={lesson.gradient}
        emoji={lesson.emoji}
        title={lesson.title}
        duration={lesson.duration}
      />

      <article className="lesson-content">
        {lesson.sections.map((section) => (
          <section key={section.heading}>
            <h2 className="content-heading">{section.heading}</h2>
            {section.paragraphs.map((p, i) => (
              <p key={i} className="content-paragraph">
                {p}
              </p>
            ))}
          </section>
        ))}
      </article>

      <section className="lesson-block">
        <h2 className="content-heading">🖼️ صور ورسومات توضيحية</h2>
        <div className="gallery-grid">
          {lesson.gallery.map((img) => (
            <figure key={img.id} className="gallery-item">
              <div className="gallery-image" style={{ background: img.gradient }} aria-hidden="true">
                {img.emoji}
              </div>
              <figcaption className="gallery-caption">{img.caption}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className="lesson-block">
        <h2 className="content-heading">📎 المرفقات</h2>
        <ul className="attachments-list">
          {lesson.attachments.map((att) => (
            <li key={att.id} className="attachment-row">
              <span className="attachment-icon" aria-hidden="true">
                {att.kind === "worksheet" ? "📄" : "📕"}
              </span>
              <span className="attachment-body">
                <span className="attachment-name">{att.name}</span>
                <span className="attachment-size">
                  {att.kind === "worksheet" ? "ورقة عمل" : "PDF"} · {att.size}
                </span>
              </span>
              <a href={att.file} download className="btn btn-outline">
                ⬇ تحميل
              </a>
            </li>
          ))}
        </ul>
      </section>

      <div className="lesson-actions">
        {prev ? (
          <Link href={`/teacher/${teacher.slug}/lesson/${prev.id}`} className="btn btn-outline lesson-nav-btn">
            → الدرس السابق
            <span className="lesson-nav-name">{prev.title}</span>
          </Link>
        ) : (
          <span className="lesson-nav-placeholder" />
        )}
        <LessonCompleteButton teacherSlug={teacher.slug} lessonId={lesson.id} />
        {next ? (
          <Link href={`/teacher/${teacher.slug}/lesson/${next.id}`} className="btn btn-outline lesson-nav-btn lesson-nav-next">
            الدرس التالي ←
            <span className="lesson-nav-name">{next.title}</span>
          </Link>
        ) : (
          <span className="lesson-nav-placeholder" />
        )}
      </div>

      <section className="lesson-block">
        <h2 className="content-heading">📚 باقي دروس {unit.title}</h2>
        <ol className="unit-lessons">
          {unit.lessons.map((l, li) => (
            <li key={l.id}>
              <Link
                href={`/teacher/${teacher.slug}/lesson/${l.id}`}
                className={`lesson-row ${l.id === lesson.id ? "lesson-row-current" : ""}`}
                aria-current={l.id === lesson.id ? "page" : undefined}
              >
                <span className="lesson-row-thumb" style={{ background: l.gradient }} aria-hidden="true">
                  {l.emoji}
                </span>
                <span className="lesson-row-body">
                  <span className="lesson-row-title">
                    {li + 1}. {l.title}
                  </span>
                </span>
                <span className="lesson-row-meta">
                  <span className="lesson-duration">⏱ {l.duration}</span>
                  {l.id === lesson.id && <span className="lesson-current-badge">تشاهده الآن</span>}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
