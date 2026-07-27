import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser, getLessonPage } from "@/lib/data/queries";
import { sanitizeLessonHtml } from "@/lib/sanitize";
import VideoPlayer from "@/components/VideoPlayer";
import LessonCompleteButton from "@/components/LessonCompleteButton";
import QuizSection from "@/components/QuizSection";
import ConnectionNotice from "@/components/ConnectionNotice";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; lessonId: string }>;
}): Promise<Metadata> {
  const { slug, lessonId } = await params;
  const page = await getLessonPage(slug, lessonId);
  return {
    title: page
      ? `${page.lesson.title} | ${page.teacher.name} | منصة حصة`
      : "منصة حصة",
  };
}

export default async function LessonPage({
  params,
}: {
  params: Promise<{ slug: string; lessonId: string }>;
}) {
  const { slug, lessonId } = await params;
  const user = await getCurrentUser();

  let page: Awaited<ReturnType<typeof getLessonPage>> = null;
  let loadError: string | undefined;
  try {
    page = await getLessonPage(slug, lessonId);
  } catch (e) {
    loadError = e instanceof Error ? e.message : String(e);
  }

  if (loadError) {
    return (
      <main className="container container-narrow">
        <ConnectionNotice detail={loadError} />
      </main>
    );
  }
  if (!page) notFound();

  const {
    teacher,
    unit,
    lesson,
    content,
    attachments,
    quiz,
    unitLessons,
    index,
    total,
    prev,
    next,
    isCompleted,
    locked,
  } = page;
  const isAuthed = Boolean(user);
  const loginHref = `/login?next=${encodeURIComponent(
    `/teacher/${slug}/lesson/${lessonId}`
  )}`;

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
        {unit && <span className="unit-chip">{unit.title}</span>}
        {lesson.is_free_preview && (
          <span className="unit-chip unit-chip-free">🎁 عيّنة مجانية</span>
        )}
        <h1 className="lesson-page-title">{lesson.title}</h1>
        <p className="lesson-page-description">{lesson.description}</p>
        <div className="lesson-page-meta">
          <span className="lesson-duration">⏱ {lesson.duration}</span>
          <span className="lesson-order">
            الدرس {index + 1} من {total}
          </span>
        </div>
      </header>

      {locked ? (
        <section className="locked-panel">
          <span className="locked-icon" aria-hidden="true">
            🔒
          </span>
          <h2 className="locked-title">سجّل الدخول للمشاهدة</h2>
          <p className="locked-text">
            هذا الدرس متاح للطلاب المسجّلين — والتسجيل مجاني تماماً ولا يتطلب أي دفع.
            بعد الدخول ستشاهد الفيديو والشرح الكامل، وتحمّل المرفقات، ويُحفظ تقدّمك.
          </p>
          <Link href={loginHref} className="btn btn-primary btn-lg">
            سجّل الدخول مجاناً
          </Link>
          <p className="locked-hint">
            💡 يمكنك تجربة{" "}
            <Link href={`/teacher/${teacher.slug}`} className="back-link">
              العيّنة المجانية في بروفايل المعلم
            </Link>{" "}
            قبل التسجيل.
          </p>
        </section>
      ) : (
        <>
          {content?.video_url && (
            <VideoPlayer
              src={content.video_url}
              gradient={lesson.gradient}
              emoji={lesson.emoji}
              title={lesson.title}
              duration={lesson.duration}
            />
          )}

          {content && content.sections.length > 0 && (
            <article className="lesson-content">
              {content.sections.map((section, si) => (
                <section key={si}>
                  {section.heading && (
                    <h2 className="content-heading">{section.heading}</h2>
                  )}
                  {section.html ? (
                    // محتوى المعلّم مُعقَّم هنا أيضاً وليس عند الحفظ فقط:
                    // لا نثق بما هو مخزّن مسبقاً في قاعدة البيانات.
                    <div
                      className="rich-content"
                      dangerouslySetInnerHTML={{
                        __html: sanitizeLessonHtml(section.html),
                      }}
                    />
                  ) : (
                    (section.paragraphs ?? []).map((p, i) => (
                      <p key={i} className="content-paragraph">
                        {p}
                      </p>
                    ))
                  )}
                </section>
              ))}
            </article>
          )}

          {content && content.gallery.length > 0 && (
            <section className="lesson-block">
              <h2 className="content-heading">🖼️ صور ورسومات توضيحية</h2>
              <div className="gallery-grid">
                {content.gallery.map((img, i) => (
                  <figure key={img.id ?? i} className="gallery-item">
                    <div
                      className="gallery-image"
                      style={{ background: img.gradient }}
                      aria-hidden="true"
                    >
                      {img.emoji}
                    </div>
                    <figcaption className="gallery-caption">{img.caption}</figcaption>
                  </figure>
                ))}
              </div>
            </section>
          )}

          <section className="lesson-block">
            <h2 className="content-heading">📎 المرفقات</h2>
            {isAuthed ? (
              attachments.length > 0 ? (
                <ul className="attachments-list">
                  {attachments.map((att) => (
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
                      <a href={att.file_path} download className="btn btn-outline">
                        ⬇ تحميل
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="drafts-empty">لا توجد مرفقات لهذا الدرس.</p>
              )
            ) : (
              <div className="locked-inline">
                🔒 تحميل المرفقات متاح للطلاب المسجّلين.{" "}
                <Link href={loginHref} className="back-link">
                  سجّل الدخول مجاناً
                </Link>
              </div>
            )}
          </section>

          {isAuthed && quiz.length > 0 && (
            <QuizSection
              questions={quiz.map((q) => ({
                id: q.id,
                prompt: q.prompt,
                options: q.options,
                correctIndex: q.correct_index,
              }))}
            />
          )}
        </>
      )}

      <div className="lesson-actions">
        {prev ? (
          <Link
            href={`/teacher/${teacher.slug}/lesson/${prev.id}`}
            className="btn btn-outline lesson-nav-btn"
          >
            → الدرس السابق
            <span className="lesson-nav-name">{prev.title}</span>
          </Link>
        ) : (
          <span className="lesson-nav-placeholder" />
        )}
        {!locked && (
          <LessonCompleteButton
            lessonId={lesson.id}
            teacherSlug={teacher.slug}
            isCompleted={isCompleted}
            isAuthed={isAuthed}
          />
        )}
        {next ? (
          <Link
            href={`/teacher/${teacher.slug}/lesson/${next.id}`}
            className="btn btn-outline lesson-nav-btn lesson-nav-next"
          >
            الدرس التالي ←
            <span className="lesson-nav-name">{next.title}</span>
          </Link>
        ) : (
          <span className="lesson-nav-placeholder" />
        )}
      </div>

      {unit && (
        <section className="lesson-block">
          <h2 className="content-heading">📚 باقي دروس {unit.title}</h2>
          <ol className="unit-lessons">
            {unitLessons.map((l, li) => {
              const rowLocked = !isAuthed && !l.is_free_preview;
              return (
                <li key={l.id}>
                  <Link
                    href={`/teacher/${teacher.slug}/lesson/${l.id}`}
                    className={`lesson-row ${
                      l.id === lesson.id ? "lesson-row-current" : ""
                    } ${rowLocked ? "lesson-row-locked" : ""}`}
                    aria-current={l.id === lesson.id ? "page" : undefined}
                  >
                    <span
                      className="lesson-row-thumb"
                      style={{ background: l.gradient }}
                      aria-hidden="true"
                    >
                      {rowLocked ? "🔒" : l.emoji}
                    </span>
                    <span className="lesson-row-body">
                      <span className="lesson-row-title">
                        {li + 1}. {l.title}
                      </span>
                    </span>
                    <span className="lesson-row-meta">
                      <span className="lesson-duration">⏱ {l.duration}</span>
                      {l.is_free_preview && (
                        <span className="badge badge-free">🎁 مجاني</span>
                      )}
                      {l.id === lesson.id && (
                        <span className="lesson-current-badge">تشاهده الآن</span>
                      )}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
        </section>
      )}
    </main>
  );
}
