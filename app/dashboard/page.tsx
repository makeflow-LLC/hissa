"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Teacher } from "@/lib/teachers";
import { getAllLessons } from "@/lib/teachers";
import { getStudentsForTeacher } from "@/lib/students";
import { useTeacherAuth } from "@/lib/useTeacherAuth";
import { useLessonDrafts } from "@/lib/useLessonDrafts";

export default function DashboardPage() {
  const { teacher, loaded } = useTeacherAuth();
  const router = useRouter();

  useEffect(() => {
    if (loaded && !teacher) router.replace("/login");
  }, [loaded, teacher, router]);

  if (!loaded || !teacher) {
    return (
      <main className="container">
        <p className="empty-state">جارٍ التحميل…</p>
      </main>
    );
  }

  return <DashboardContent teacher={teacher} />;
}

function DashboardContent({ teacher }: { teacher: Teacher }) {
  const { drafts, loaded: draftsLoaded, removeDraft } = useLessonDrafts(teacher.slug);

  const students = getStudentsForTeacher(teacher);
  const allLessons = getAllLessons(teacher);
  const totalLessons = allLessons.length;
  const subscribers = students.filter((s) => s.subscribed);

  return (
    <main className="container">
      <section className="dashboard-header">
        <div className="dashboard-welcome">
          <div className="teacher-avatar" style={{ background: teacher.gradient }}>
            {teacher.initials}
          </div>
          <div>
            <h1 className="dashboard-title">مرحباً، {teacher.name} 👋</h1>
            <p className="dashboard-subtitle">
              {teacher.subject} — {teacher.stage} · هذه لوحة التحكم الخاصة بك
            </p>
          </div>
        </div>
        <Link href="/dashboard/new-lesson" className="btn btn-primary btn-lg">
          ＋ تصميم حصة جديدة
        </Link>
      </section>

      <section className="dashboard-stats">
        <div className="stat-box">
          <span className="stat-value">{totalLessons}</span>
          <span className="stat-label">درساً مسجّلاً</span>
        </div>
        <div className="stat-box">
          <span className="stat-value">{teacher.liveSessions.length}</span>
          <span className="stat-label">حصص مباشرة</span>
        </div>
        <div className="stat-box">
          <span className="stat-value">{students.length}</span>
          <span className="stat-label">إجمالي الطلاب</span>
        </div>
        <div className="stat-box stat-box-success">
          <span className="stat-value">{subscribers.length}</span>
          <span className="stat-label">مشتركاً نشطاً</span>
        </div>
      </section>

      <section className="dashboard-section">
        <h2 className="section-title">📊 إنجاز الطلاب حسب الوحدات</h2>
        <div className="units-progress-grid">
          {teacher.units.map((unit, ui) => {
            const unitIds = unit.lessons.map((l) => l.id);
            const finishers = students.filter((s) =>
              unitIds.every((id) => s.completedLessonIds.includes(id))
            ).length;
            const avg =
              students.length && unitIds.length
                ? Math.round(
                    (students.reduce(
                      (sum, s) =>
                        sum +
                        unitIds.filter((id) => s.completedLessonIds.includes(id))
                          .length,
                      0
                    ) /
                      (students.length * unitIds.length)) *
                      100
                  )
                : 0;
            return (
              <article key={unit.id} className="unit-progress-card">
                <header className="unit-progress-head">
                  <span className="unit-number">الوحدة {ui + 1}</span>
                  <h3 className="unit-progress-title">{unit.title}</h3>
                </header>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${avg}%` }} />
                </div>
                <p className="unit-progress-meta">
                  متوسط الإنجاز {avg}٪ · أتمّها بالكامل {finishers} من{" "}
                  {students.length} طالباً
                </p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="dashboard-section">
        <h2 className="section-title">👥 طلابك ({students.length})</h2>
        <div className="table-wrap">
          <table className="students-table">
            <thead>
              <tr>
                <th>الطالب</th>
                <th>الاشتراك</th>
                <th>التقدّم في المنهج</th>
                <th>انضم في</th>
                <th>آخر نشاط</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => {
                const pct = totalLessons
                  ? Math.round((s.completedLessonIds.length / totalLessons) * 100)
                  : 0;
                return (
                  <tr key={s.id}>
                    <td className="student-name">{s.name}</td>
                    <td>
                      {s.subscribed ? (
                        <span className="badge badge-success">مشترك</span>
                      ) : (
                        <span className="badge badge-muted">زائر</span>
                      )}
                    </td>
                    <td>
                      <div className="table-progress">
                        <div className="progress-track progress-track-sm">
                          <div
                            className="progress-fill"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="table-progress-label">
                          {s.completedLessonIds.length}/{totalLessons}
                        </span>
                      </div>
                    </td>
                    <td className="table-muted">{s.joined}</td>
                    <td className="table-muted">{s.lastActive}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="dashboard-section">
        <h2 className="section-title">📝 حصصك الجديدة (مسودات)</h2>
        {!draftsLoaded || drafts.length === 0 ? (
          <p className="drafts-empty">
            لا توجد مسودات بعد —{" "}
            <Link href="/dashboard/new-lesson" className="back-link">
              صمّم حصتك الأولى
            </Link>
            .
          </p>
        ) : (
          <ul className="drafts-list">
            {drafts.map((d) => (
              <li key={d.id} className="draft-row">
                <span className="draft-emoji" aria-hidden="true">
                  {d.emoji}
                </span>
                <span className="draft-body">
                  <span className="draft-title">
                    {d.title}
                    <span
                      className={`badge ${
                        d.kind === "live" ? "badge-live" : "badge-success"
                      }`}
                    >
                      {d.kind === "live" ? "حصة مباشرة" : "درس مسجّل"}
                    </span>
                  </span>
                  <span className="draft-meta">
                    {d.unitTitle} · ⏱ {d.duration} · أُنشئت في {d.createdAt}
                  </span>
                </span>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => removeDraft(d.id)}
                >
                  حذف
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
