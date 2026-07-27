"use client";

import { useState } from "react";
import Link from "next/link";
import type { TeacherProfile } from "@/lib/data/types";
import EnrollButton from "@/components/EnrollButton";

export default function TeacherTabs({
  profile,
  isAuthed,
  canEnroll,
}: {
  profile: TeacherProfile;
  isAuthed: boolean;
  /** حساب المعلّم لا يسجّل في الحصص كطالب — الدوران منفصلان */
  canEnroll: boolean;
}) {
  const { teacher, units, liveSessions, completedLessonIds, enrolledSessionIds } = profile;
  const [tab, setTab] = useState<"recorded" | "live">("recorded");

  const done = new Set(completedLessonIds);
  const totalLessons = units.reduce((n, u) => n + u.lessons.length, 0);
  const doneCount = units
    .flatMap((u) => u.lessons)
    .filter((l) => done.has(l.id)).length;
  const progressPct = totalLessons ? Math.round((doneCount / totalLessons) * 100) : 0;

  return (
    <section>
      <div className="tabs" role="tablist" aria-label="محتوى المعلم">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "recorded"}
          className={`tab ${tab === "recorded" ? "tab-active" : ""}`}
          onClick={() => setTab("recorded")}
        >
          🎬 الدروس المسجّلة
          <span className="tab-count">{totalLessons}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "live"}
          className={`tab ${tab === "live" ? "tab-active" : ""}`}
          onClick={() => setTab("live")}
        >
          🔴 الحصص المباشرة
          <span className="tab-count">{liveSessions.length}</span>
        </button>
      </div>

      {tab === "recorded" ? (
        <div>
          {isAuthed && (
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

          {units.map((unit, ui) => {
            const unitDone = unit.lessons.filter((l) => done.has(l.id)).length;
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
        </div>
      ) : (
        <div className="live-grid">
          {liveSessions.map((s) => (
            <article key={s.id} className="live-card">
              <div
                className="live-thumb"
                style={{ background: s.gradient }}
                aria-hidden="true"
              >
                {s.emoji}
              </div>
              <div className="live-body">
                <h3 className="live-title">
                  {s.title}
                  <span className="live-badge">مباشر</span>
                  {s.is_paid ? (
                    <span className="badge badge-paid">
                      💰 {s.price} {s.currency}
                    </span>
                  ) : (
                    <span className="badge badge-free">مجانية</span>
                  )}
                </h3>
                <p className="live-description">{s.description}</p>
                <div className="live-meta">
                  <span className="live-schedule">📅 {s.schedule}</span>
                  <span className="lesson-duration">⏱ {s.duration}</span>
                  <span className="live-seats">🪑 متبقٍ {s.seats_left} مقعداً</span>
                </div>
              </div>
              {canEnroll || !isAuthed ? (
                <EnrollButton
                  sessionId={s.id}
                  teacherSlug={teacher.slug}
                  isPaid={s.is_paid}
                  price={Number(s.price)}
                  currency={s.currency}
                  enrolledStatus={enrolledSessionIds[s.id]}
                  isAuthed={isAuthed}
                  whatsapp={teacher.whatsapp}
                />
              ) : (
                <p className="live-teacher-note">
                  التسجيل في الحصص متاح لحسابات الطلاب.
                </p>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
