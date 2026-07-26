"use client";

import { useState } from "react";
import Link from "next/link";
import type { Teacher } from "@/lib/teachers";
import { useLessonProgress } from "@/lib/useLessonProgress";
import { useLessonDrafts } from "@/lib/useLessonDrafts";

export default function TeacherTabs({ teacher }: { teacher: Teacher }) {
  const [tab, setTab] = useState<"recorded" | "live">("recorded");
  const { completed, loaded, isCompleted } = useLessonProgress(teacher.slug);
  const { drafts, loaded: draftsLoaded } = useLessonDrafts(teacher.slug);

  const recordedDrafts = draftsLoaded ? drafts.filter((d) => d.kind === "recorded") : [];
  const liveDrafts = draftsLoaded ? drafts.filter((d) => d.kind === "live") : [];

  const totalLessons = teacher.units.reduce((n, u) => n + u.lessons.length, 0);
  const doneCount = loaded
    ? teacher.units
        .flatMap((u) => u.lessons)
        .filter((l) => completed.includes(l.id)).length
    : 0;
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
          <span className="tab-count">{totalLessons + recordedDrafts.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "live"}
          className={`tab ${tab === "live" ? "tab-active" : ""}`}
          onClick={() => setTab("live")}
        >
          🔴 الحصص المباشرة
          <span className="tab-count">{teacher.liveSessions.length + liveDrafts.length}</span>
        </button>
      </div>

      {tab === "recorded" ? (
        <div>
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

          {recordedDrafts.length > 0 && (
            <section className="unit unit-new">
              <header className="unit-header">
                <div>
                  <h3 className="unit-title">
                    <span className="unit-number unit-number-new">جديد</span>
                    دروس جديدة من المعلم
                  </h3>
                  <p className="unit-description">
                    حصص صمّمها المعلم مؤخراً وستُضاف للمنهج.
                  </p>
                </div>
              </header>
              <ol className="unit-lessons">
                {recordedDrafts.map((d) => (
                  <li key={d.id}>
                    <Link
                      href={`/teacher/${teacher.slug}/lesson-draft/${d.id}`}
                      className="lesson-row"
                    >
                      <span className="lesson-row-thumb lesson-row-thumb-draft" aria-hidden="true">
                        {d.emoji}
                      </span>
                      <span className="lesson-row-body">
                        <span className="lesson-row-title">{d.title}</span>
                        <span className="lesson-row-description">{d.description}</span>
                      </span>
                      <span className="lesson-row-meta">
                        <span className="lesson-duration">⏱ {d.duration}</span>
                        {d.quiz.length > 0 && (
                          <span className="lesson-quiz-badge">❓ {d.quiz.length} أسئلة</span>
                        )}
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {teacher.units.map((unit, ui) => {
            const unitDone = loaded
              ? unit.lessons.filter((l) => completed.includes(l.id)).length
              : 0;
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
                  <span className="unit-progress">
                    {unitDone}/{unit.lessons.length} منجز
                  </span>
                </header>
                <ol className="unit-lessons">
                  {unit.lessons.map((lesson, li) => (
                    <li key={lesson.id}>
                      <Link
                        href={`/teacher/${teacher.slug}/lesson/${lesson.id}`}
                        className={`lesson-row ${
                          isCompleted(lesson.id) ? "lesson-row-done" : ""
                        }`}
                      >
                        <span
                          className="lesson-row-thumb"
                          style={{ background: lesson.gradient }}
                          aria-hidden="true"
                        >
                          {lesson.emoji}
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
                          {isCompleted(lesson.id) && (
                            <span className="lesson-done-badge">✓ منجز</span>
                          )}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ol>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="live-grid">
          {liveDrafts.map((d) => (
            <article key={d.id} className="live-card">
              <div className="live-thumb lesson-row-thumb-draft" aria-hidden="true">
                {d.emoji}
              </div>
              <div className="live-body">
                <h3 className="live-title">
                  {d.title}
                  <span className="live-badge">مباشر</span>
                  <span className="badge badge-new">جديد</span>
                </h3>
                <p className="live-description">{d.description}</p>
                <div className="live-meta">
                  <span className="live-schedule">📅 {d.detail}</span>
                  <span className="lesson-duration">⏱ {d.duration}</span>
                </div>
              </div>
              <button type="button" className="btn btn-primary btn-book">
                احجز
              </button>
            </article>
          ))}
          {teacher.liveSessions.map((s) => (
            <article key={s.id} className="live-card">
              <div className="live-thumb" style={{ background: s.gradient }} aria-hidden="true">
                {s.emoji}
              </div>
              <div className="live-body">
                <h3 className="live-title">
                  {s.title}
                  <span className="live-badge">مباشر</span>
                </h3>
                <p className="live-description">{s.description}</p>
                <div className="live-meta">
                  <span className="live-schedule">📅 {s.schedule}</span>
                  <span className="lesson-duration">⏱ {s.duration}</span>
                  <span className="live-seats">🪑 متبقٍ {s.seatsLeft} مقعداً</span>
                </div>
              </div>
              <button type="button" className="btn btn-primary btn-book">
                احجز
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
