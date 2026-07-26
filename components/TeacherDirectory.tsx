"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { STAGES, subjects, teachers, type Stage } from "@/lib/teachers";
import { mergeTeacherProfile, useAllProfileOverrides } from "@/lib/useTeacherProfile";
import Stars from "@/components/Stars";

const ALL_SLUGS = teachers.map((t) => t.slug);

export default function TeacherDirectory() {
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState<Stage | "">("");
  const [subject, setSubject] = useState("");
  const overridesMap = useAllProfileOverrides(ALL_SLUGS);

  const merged = useMemo(
    () =>
      teachers.map((t) => ({
        teacher: t,
        profile: mergeTeacherProfile(t, overridesMap[t.slug] ?? {}),
      })),
    [overridesMap]
  );

  const filtered = useMemo(() => {
    const q = query.trim();
    return merged.filter(
      ({ teacher, profile }) =>
        (!q || profile.name.includes(q) || teacher.name.includes(q)) &&
        (!stage || profile.stages.includes(stage)) &&
        (!subject || teacher.subject === subject)
    );
  }, [merged, query, stage, subject]);

  return (
    <>
      <div className="filters" role="search">
        <input
          type="search"
          className="search-input"
          placeholder="ابحث عن معلّم بالاسم…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="البحث بالاسم"
        />
        <select
          className="filter-select"
          value={stage}
          onChange={(e) => setStage(e.target.value as Stage | "")}
          aria-label="فلترة حسب المرحلة"
        >
          <option value="">كل المراحل</option>
          {STAGES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          className="filter-select"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          aria-label="فلترة حسب المادة"
        >
          <option value="">كل المواد</option>
          {subjects.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="empty-state">لا توجد نتائج مطابقة — جرّب تعديل البحث أو الفلاتر.</p>
      ) : (
        <div className="teachers-grid">
          {filtered.map(({ teacher: t, profile }) => {
            const lessonCount = t.units.reduce((n, u) => n + u.lessons.length, 0);
            return (
              <article key={t.slug} className="teacher-card">
                {profile.avatar ? (
                  // صورة data URL من localStorage — خارج نطاق next/image
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.avatar} alt={profile.name} className="teacher-avatar-img" />
                ) : (
                  <div className="teacher-avatar" style={{ background: t.gradient }}>
                    {t.initials}
                  </div>
                )}
                <h2 className="teacher-name">{profile.name}</h2>
                <div className="teacher-tags">
                  <span className="tag tag-subject">{t.subject}</span>
                  {profile.stages.map((s) => (
                    <span key={s} className="tag tag-stage">
                      {s}
                    </span>
                  ))}
                </div>
                <div className="teacher-rating">
                  <Stars rating={t.rating} />
                  <span className="teacher-rating-value">{t.rating}</span>
                  <span className="teacher-rating-count">({t.ratingCount})</span>
                </div>
                <p className="teacher-counts">
                  🎬 {lessonCount} درساً مسجّلاً · 🔴 {t.liveSessions.length} حصص مباشرة
                </p>
                <Link href={`/teacher/${t.slug}`} className="btn btn-primary">
                  عرض البروفايل
                </Link>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
