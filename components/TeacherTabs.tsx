"use client";

import Link from "next/link";
import type { TeacherProfile } from "@/lib/data/types";

/**
 * منهج المعلّم: الوحدات ودروسها مع تقدّم الطالب.
 * كان هنا تبويبان (مسجّلة / مباشرة) وأُلغيت الحصص المباشرة من المنصة،
 * فلم يعد للتبويب معنى — المنهج يُعرض مباشرة.
 */
export default function TeacherTabs({
  profile,
  isAuthed,
}: {
  profile: TeacherProfile;
  isAuthed: boolean;
}) {
  const { teacher, units, completedLessonIds } = profile;

  const done = new Set(completedLessonIds);
  const totalLessons = units.reduce((n, u) => n + u.lessons.length, 0);
  const doneCount = units
    .flatMap((u) => u.lessons)
    .filter((l) => done.has(l.id)).length;
  const progressPct = totalLessons ? Math.round((doneCount / totalLessons) * 100) : 0;

  return (
    <section>
      <h2 className="section-title">🎬 المنهج — {totalLessons} درساً</h2>

      {isAuthed && totalLessons > 0 && (
        <div className="progress-card">
          <div className="progress-labels">
            <span className="progress-title">تقدّمك في المنهج</span>
            <span className="progress-value">
              أنجزت {doneCount} من {totalLessons} دروس ({progressPct}٪)
            </span>
          </div>
          <div
            className="progress-track"
            role="progressbar"
            aria-valuenow={doneCount}
            aria-valuemin={0}
            aria-valuemax={totalLessons}
            aria-label="نسبة إنجاز الدروس"
          >
            <div className="progress-fill" style={{ width: `${progressPct}%` }} />
          </div>
        </div>
      )}

      {totalLessons === 0 && (
        <p className="drafts-empty">لم ينشر هذا المعلّم دروساً بعد.</p>
      )}

      {units.map((unit, ui) => {
        const unitDone = unit.lessons.filter((l) => done.has(l.id)).length;
        if (unit.lessons.length === 0) return null;
        return (
          <section key={unit.id} className="unit">
            <header className="unit-header">
              <div>
                <h3 className="unit-title">
                  <span className="unit-number">الوحدة {ui + 1}</span>
                  {unit.title}
                </h3>
                <p className="unit-description">{unit.description}</p>
              </div>
              {isAuthed && (
                <span className="unit-progress">
                  {unitDone}/{unit.lessons.length} منجز
                </span>
              )}
            </header>
            <ol className="unit-lessons">
              {unit.lessons.map((lesson, li) => {
                const isDone = done.has(lesson.id);
                const locked = !isAuthed && !lesson.is_free_preview;
                return (
                  <li key={lesson.id}>
                    <Link
                      href={`/teacher/${teacher.slug}/lesson/${lesson.id}`}
                      className={`lesson-row ${isDone ? "lesson-row-done" : ""} ${
                        locked ? "lesson-row-locked" : ""
                      }`}
                    >
                      <span
                        className="lesson-row-thumb"
                        style={{ background: lesson.gradient }}
                        aria-hidden="true"
                      >
                        {locked ? "🔒" : lesson.emoji}
                      </span>
                      <span className="lesson-row-body">
                        <span className="lesson-row-title">
                          {li + 1}. {lesson.title}
                        </span>
                        <span className="lesson-row-description">
                          {lesson.description}
                        </span>
                      </span>
                      <span className="lesson-row-meta">
                        <span className="lesson-duration">⏱ {lesson.duration}</span>
                        {lesson.is_free_preview && (
                          <span className="badge badge-free">🎁 عيّنة مجانية</span>
                        )}
                        {isDone && <span className="lesson-done-badge">✓ منجز</span>}
                        {locked && (
                          <span className="lesson-locked-badge">
                            سجّل الدخول للمشاهدة
                          </span>
                        )}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}
    </section>
  );
}
