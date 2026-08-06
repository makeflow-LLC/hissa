import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  getCurrentUser,
  getLessonPage,
  getLessonLevels,
  getLessonQuestions,
  isApprovedStudentOf,
  isCurrentUserTeacher,
} from "@/lib/data/queries";
import { sanitizeLessonHtml } from "@/lib/sanitize";
import VideoPlayer from "@/components/VideoPlayer";
import LessonCompleteButton from "@/components/LessonCompleteButton";
import QuizSection from "@/components/QuizSection";
import LessonQuestions from "@/components/LessonQuestions";
import LessonLevels from "@/components/LessonLevels";
import ConnectionNotice from "@/components/ConnectionNotice";

export const dynamic = "force-dynamic";

const ATTACH_ICON: Record<string, string> = {
  pdf: "📕",
  worksheet: "📄",
  doc: "📝",
  slides: "📊",
  sheet: "📈",
  image: "🖼️",
};
const ATTACH_LABEL: Record<string, string> = {
  pdf: "PDF",
  worksheet: "ورقة عمل",
  doc: "مستند",
  slides: "عرض تقديمي",
  sheet: "جدول",
  image: "صورة",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; lessonId: string }>;
}): Promise<Metadata> {
  const { slug, lessonId } = await params;
  let page: Awaited<ReturnType<typeof getLessonPage>> = null;
  try {
    page = await getLessonPage(slug, lessonId);
  } catch {
    /* فشل الاتصال لا يمنع التصيير */
  }
  if (!page) return { title: "منصة حصة" };

  const { lesson, teacher, unit } = page;
  const title = `${lesson.title} | ${teacher.name} | منصة حصة`;
  const description =
    lesson.description?.trim() ||
    `درس «${lesson.title}» في ${teacher.subject} مع ${teacher.name}${
      unit ? ` — ${unit.title}` : ""
    } على منصة حصة.`;

  return {
    title,
    description: description.slice(0, 300),
    alternates: { canonical: `/teacher/${slug}/lesson/${lessonId}` },
    openGraph: {
      title,
      description: description.slice(0, 300),
      url: `/teacher/${slug}/lesson/${lessonId}`,
      type: "article",
    },
  };
}

export default async function LessonPage({
  params,
}: {
  params: Promise<{ slug: string; lessonId: string }>;
}) {
  const { slug, lessonId } = await params;
  const user = await getCurrentUser();
  // حساب المعلّم لا يحفظ تقدّماً كطالب — الدوران منفصلان
  const isTeacherAccount = user ? await isCurrentUserTeacher() : false;

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
    quizAttempt,
  } = page;
  const isAuthed = Boolean(user);

  /**
   * الأسئلة تُقرأ فقط لمن يستطيع رؤيتها — و`canAsk` يحدّده انتماء الطالب
   * إلى صفّ هذا المعلّم. وهو **إخفاءٌ للواجهة لا حماية**: سياسة الإدراج
   * في القاعدة تشترط قبولاً معتمَداً على أي حال.
   */
  const canRead = isAuthed && !isTeacherAccount && !locked;
  const [questions, canAsk] = canRead
    ? await Promise.all([
        getLessonQuestions(lesson.id),
        isApprovedStudentOf(teacher.id),
      ])
    : [[], false];

  // نسخ المستويات — السياسة ترث بوّابة الدرس، فتعود فارغةً للزائر
  const levels = !locked && isAuthed ? await getLessonLevels(lesson.id) : [];

  const loginHref = `/login?next=${encodeURIComponent(
    `/teacher/${slug}/lesson/${lessonId}`
  )}`;

  // بيانات منظّمة: الدرس جزء من منهج معلّم
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LearningResource",
    name: lesson.title,
    description: lesson.description || undefined,
    url: `https://hissa.sbs/teacher/${teacher.slug}/lesson/${lesson.id}`,
    inLanguage: "ar",
    learningResourceType: "درس مسجّل",
    educationalLevel: teacher.stages.join(", "),
    about: teacher.subject,
    isPartOf: unit ? { "@type": "Course", name: unit.title } : undefined,
    author: {
      "@type": "Person",
      name: teacher.name,
      url: `https://hissa.sbs/teacher/${teacher.slug}`,
    },
    isAccessibleForFree: lesson.is_free_preview,
  };

  return (
    <main className="container container-narrow">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
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
            /*
              المحتوى مُعقَّم هنا أيضاً لا عند الحفظ فقط — لا نثق بما هو
              مخزَّن مسبقاً. ويشمل ذلك نسخ المستويات: هي مخرجات نموذج،
              أي مُدخَلٌ غير موثوق كأيّ نصٍّ آخر.
            */
            <LessonLevels
              standard={content.sections.map((x) => ({
                ...x,
                html: x.html ? sanitizeLessonHtml(x.html) : x.html,
              }))}
              levels={levels.map((l) => ({
                level: l.level,
                sections: l.sections.map((x) => ({
                  ...x,
                  html: x.html ? sanitizeLessonHtml(x.html) : x.html,
                })),
              }))}
            />
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
                        {ATTACH_ICON[att.kind] ?? "📎"}
                      </span>
                      <span className="attachment-body">
                        <span className="attachment-name">{att.name}</span>
                        <span className="attachment-size">
                          {ATTACH_LABEL[att.kind] ?? "ملف"}
                          {att.size && <> · {att.size}</>}
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

          {isAuthed && !isTeacherAccount && quiz.length > 0 && (
            <QuizSection
              lessonId={lesson.id}
              teacherSlug={teacher.slug}
              previous={quizAttempt}
              questions={quiz.map((q) => ({
                id: q.id,
                prompt: q.prompt,
                options: q.options,
                correctIndex: q.correct_index,
              }))}
            />
          )}

          {/*
            بنك الأسئلة تحت الدرس مباشرةً — حيث يقع السؤال في ذهن الطالب.
            وضعُه في الرسائل الخاصّة هو ما جعل السؤال الواحد يُجاب عشرين
            مرّة.
          */}
          {isAuthed && !isTeacherAccount && (
            <LessonQuestions
              lessonId={lesson.id}
              questions={questions}
              canAsk={canAsk}
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
        {!locked && !isTeacherAccount && (
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
