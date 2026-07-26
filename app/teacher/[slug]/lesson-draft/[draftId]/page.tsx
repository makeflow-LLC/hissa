"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { getTeacherBySlug } from "@/lib/teachers";
import { useLessonDrafts, type LessonDraft } from "@/lib/useLessonDrafts";
import { getMedia } from "@/lib/mediaStore";
import QuizSection from "@/components/QuizSection";

/**
 * صفحة حصة صممها المعلم. المسودات محفوظة محلياً في متصفح المستخدم
 * (localStorage + IndexedDB)، لذا تُعرض الصفحة بالكامل على العميل.
 */
export default function DraftLessonPage({
  params,
}: {
  params: Promise<{ slug: string; draftId: string }>;
}) {
  const { slug, draftId } = use(params);
  const teacher = getTeacherBySlug(slug);
  const { drafts, loaded } = useLessonDrafts(slug);

  if (!teacher) {
    return (
      <main className="container container-narrow">
        <p className="empty-state">المعلم غير موجود.</p>
      </main>
    );
  }

  if (!loaded) {
    return (
      <main className="container container-narrow">
        <p className="empty-state">جارٍ التحميل…</p>
      </main>
    );
  }

  const draft = drafts.find((d) => d.id === draftId);
  if (!draft) {
    return (
      <main className="container container-narrow">
        <p className="empty-state">
          هذه الحصة لم تعد متاحة.{" "}
          <Link href={`/teacher/${slug}`} className="back-link">
            العودة لبروفايل المعلم
          </Link>
        </p>
      </main>
    );
  }

  return <DraftLessonView teacher={{ slug, name: teacher.name }} draft={draft} />;
}

function DraftLessonView({
  teacher,
  draft,
}: {
  teacher: { slug: string; name: string };
  draft: LessonDraft;
}) {
  /** روابط Blob للوسائط المحملة من IndexedDB */
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    const urls: string[] = [];
    (async () => {
      const entries: [string, string][] = [];
      for (const m of draft.media) {
        const blob = await getMedia(m.id);
        if (blob) {
          const url = URL.createObjectURL(blob);
          urls.push(url);
          entries.push([m.id, url]);
        }
      }
      if (!cancelled) setMediaUrls(Object.fromEntries(entries));
    })();
    return () => {
      cancelled = true;
      for (const url of urls) URL.revokeObjectURL(url);
    };
  }, [draft]);

  const video = draft.media.find((m) => m.kind === "video");
  const images = draft.media.filter((m) => m.kind === "image");
  const files = draft.media.filter((m) => m.kind === "file");
  const paragraphs = draft.detail
    .split("\n")
    .map((p) => p.trim())
    .filter(Boolean);

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
        <span className="breadcrumb-current">{draft.title}</span>
      </nav>

      <header className="lesson-header">
        <span className="unit-chip">
          {draft.kind === "live" ? "حصة مباشرة" : draft.unitTitle}
        </span>
        <span className="unit-chip unit-chip-new">✨ حصة جديدة</span>
        <h1 className="lesson-page-title">{draft.title}</h1>
        <p className="lesson-page-description">{draft.description}</p>
        <div className="lesson-page-meta">
          <span className="lesson-duration">⏱ {draft.duration}</span>
          {draft.kind === "live" && draft.detail && (
            <span className="live-schedule">📅 {draft.detail}</span>
          )}
        </div>
      </header>

      {draft.kind === "recorded" &&
        (video && mediaUrls[video.id] ? (
          <div className="video-frame">
            {/* فيديو رفعه المعلم محلياً — لا توجد ترجمة نصية له */}
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video className="video-el" src={mediaUrls[video.id]} controls playsInline />
          </div>
        ) : (
          <div className="video-frame video-poster video-poster-draft" aria-hidden="true">
            <span className="video-poster-emoji">{draft.emoji}</span>
            <span className="video-poster-meta">
              <span className="video-poster-title">
                {video ? "جارٍ تحميل الفيديو…" : "لم يُرفع فيديو لهذه الحصة بعد"}
              </span>
              <span className="video-poster-duration">⏱ {draft.duration}</span>
            </span>
          </div>
        ))}

      {paragraphs.length > 0 && draft.kind === "recorded" && (
        <article className="lesson-content">
          <section>
            <h2 className="content-heading">شرح الدرس</h2>
            {paragraphs.map((p, i) => (
              <p key={i} className="content-paragraph">
                {p}
              </p>
            ))}
          </section>
        </article>
      )}

      {images.length > 0 && (
        <section className="lesson-block">
          <h2 className="content-heading">🖼️ صور ورسومات توضيحية</h2>
          <div className="gallery-grid">
            {images.map((img) => (
              <figure key={img.id} className="gallery-item">
                {mediaUrls[img.id] ? (
                  // صور مرفوعة محلياً (Blob URLs) — خارج نطاق next/image
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={mediaUrls[img.id]} alt={img.name} className="gallery-photo" />
                ) : (
                  <div className="gallery-image" aria-hidden="true">
                    ⏳
                  </div>
                )}
                <figcaption className="gallery-caption">{img.name}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      {files.length > 0 && (
        <section className="lesson-block">
          <h2 className="content-heading">📎 المرفقات</h2>
          <ul className="attachments-list">
            {files.map((att) => (
              <li key={att.id} className="attachment-row">
                <span className="attachment-icon" aria-hidden="true">
                  📄
                </span>
                <span className="attachment-body">
                  <span className="attachment-name">{att.name}</span>
                  <span className="attachment-size">{att.size}</span>
                </span>
                {mediaUrls[att.id] ? (
                  <a
                    href={mediaUrls[att.id]}
                    download={att.name}
                    className="btn btn-outline"
                  >
                    ⬇ تحميل
                  </a>
                ) : (
                  <span className="table-muted">جارٍ التحميل…</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <QuizSection questions={draft.quiz} />

      <div className="lesson-actions">
        <Link href={`/teacher/${teacher.slug}`} className="btn btn-outline">
          → العودة لبروفايل المعلم
        </Link>
        {draft.kind === "live" && (
          <button type="button" className="btn btn-primary">
            احجز مقعدك
          </button>
        )}
      </div>
    </main>
  );
}
