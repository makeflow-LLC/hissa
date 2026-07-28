import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import AskTeacherForm from "@/components/AskTeacherForm";
import {
  getCurrentUser,
  getMyMessages,
  getMyParentReports,
  getMyStudentProfile,
  getStudentDashboard,
  getStudentName,
  isCurrentUserTeacher,
} from "@/lib/data/queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "لوحتي | منصة حصة" };

export default async function StudentDashboard() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard");
  // حساب المعلّم له لوحته الخاصة — لا لوحة طالب على البريد نفسه
  if (await isCurrentUserTeacher()) redirect("/teacher/me");

  const [name, data, profile, messages, reports] = await Promise.all([
    getStudentName(),
    getStudentDashboard(),
    getMyStudentProfile(),
    getMyMessages(),
    getMyParentReports(),
  ]);
  const { following = [] } = data ?? {};

  const totalLessons = following.reduce((n, f) => n + f.total, 0);
  const totalDone = following.reduce((n, f) => n + f.done, 0);

  return (
    <main className="container">
      <section className="dashboard-header">
        <div className="dashboard-welcome">
          <div className="teacher-avatar" style={{ background: "linear-gradient(135deg, #4f46e5, #8b5cf6)" }}>
            {name?.slice(0, 2) ?? "طا"}
          </div>
          <div>
            <h1 className="dashboard-title">مرحباً، {name} 👋</h1>
            <p className="dashboard-subtitle">
              هذه لوحتك: معلّموك وتقدّمك في المناهج
            </p>
          </div>
        </div>
        <div className="dashboard-header-actions">
          <Link href="/dashboard/profile" className="btn btn-primary">
            ✏️ بياناتي
          </Link>
          <Link href="/" className="btn btn-outline">
            ＋ استكشف معلّمين جدداً
          </Link>
        </div>
      </section>

      {!profile?.profile_done && (
        <div className="visitor-banner">
          <strong>أكمل بياناتك.</strong> اسمك وصفّك يساعدان معلّميك على متابعتك
          ومعرفة مستواك.
          <Link href="/dashboard/profile" className="btn btn-primary btn-sm">
            أكمل الآن
          </Link>
        </div>
      )}

      {messages.length > 0 && (
        <section className="dashboard-section">
          <h2 className="section-title">✉️ مراسلاتك مع معلّميك</h2>
          <ul className="messages-list">
            {messages.map((m) => (
              <li
                key={m.id}
                className={`message-row ${
                  m.sender === "student" ? "message-row-mine" : ""
                }`}
              >
                <div className="message-head">
                  {m.sender === "student" ? (
                    <strong className="message-from">أنت ← {m.teacherName}</strong>
                  ) : (
                    <Link href={`/teacher/${m.teacherSlug}`} className="message-from">
                      {m.teacherName}
                    </Link>
                  )}
                  <span className="message-date">
                    {new Date(m.created_at).toLocaleDateString("ar-EG", {
                      day: "numeric",
                      month: "long",
                    })}
                  </span>
                  {m.student_id === null && (
                    <span className="pill pill-free">📢 لكل الطلاب</span>
                  )}
                </div>
                <p className="message-body">{m.body}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {reports.length > 0 && (
        <section className="dashboard-section">
          <h2 className="section-title">📋 تقارير معلّميك</h2>
          <ul className="messages-list">
            {reports.map((r) => (
              <li key={r.id} className="message-row report-row">
                <div className="message-head">
                  <strong className="message-from">{r.teacherName}</strong>
                  {r.period && <span className="pill pill-free">{r.period}</span>}
                  <span className="pill pill-live">{r.performance}</span>
                  <span className="message-date">
                    {new Date(r.created_at).toLocaleDateString("ar-EG", {
                      day: "numeric",
                      month: "long",
                    })}
                  </span>
                </div>
                {r.strengths && (
                  <p className="message-body">✅ نقاط القوة: {r.strengths}</p>
                )}
                {r.improvements && (
                  <p className="message-body">📌 للتحسين: {r.improvements}</p>
                )}
                {r.note && <p className="message-body">📝 {r.note}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="dashboard-stats">
        <div className="stat-box">
          <span className="stat-value">{following.length}</span>
          <span className="stat-label">معلّم تتابعه</span>
        </div>
        <div className="stat-box stat-box-success">
          <span className="stat-value">{totalDone}</span>
          <span className="stat-label">درساً أنجزته</span>
        </div>
        <div className="stat-box">
          <span className="stat-value">{totalLessons}</span>
          <span className="stat-label">درساً متاحاً لك</span>
        </div>
      </section>

      {/* ===== معلّميّ + تقدّمي ===== */}
      <section className="dashboard-section">
        <h2 className="section-title">👨‍🏫 معلّميّ وتقدّمي</h2>
        {following.length === 0 ? (
          <p className="drafts-empty">
            لا تتابع أي معلم بعد — افتح صفحة معلّم واضغط «تابع هذا المعلم» ليظهر
            تقدّمك هنا.{" "}
            <Link href="/" className="back-link">
              ابدأ من الدليل
            </Link>
            .
          </p>
        ) : (
          <div className="units-progress-grid">
            {following.map((f) => {
              const pct = f.total ? Math.round((f.done / f.total) * 100) : 0;
              return (
                <article key={f.teacher.id} className="unit-progress-card">
                  <header className="follow-head">
                    {f.teacher.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={f.teacher.avatar_url}
                        alt={f.teacher.name}
                        className="follow-avatar"
                      />
                    ) : (
                      <span
                        className="follow-avatar follow-avatar-initials"
                        style={{ background: f.teacher.gradient }}
                        aria-hidden="true"
                      >
                        {f.teacher.initials}
                      </span>
                    )}
                    <div>
                      <h3 className="unit-progress-title">
                        <Link href={`/teacher/${f.teacher.slug}`} className="plain-link">
                          {f.teacher.name}
                        </Link>
                      </h3>
                      <span className="tag tag-subject">{f.teacher.subject}</span>
                    </div>
                  </header>

                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="unit-progress-meta">
                    أنجزت {f.done} من {f.total} دروس ({pct}٪)
                  </p>

                  <ul className="unit-mini-list">
                    {f.units.map((u) => {
                      const upct = u.total ? Math.round((u.done / u.total) * 100) : 0;
                      return (
                        <li key={u.id} className="unit-mini">
                          <span className="unit-mini-title">{u.title}</span>
                          <span className="unit-mini-track">
                            <span
                              className="unit-mini-fill"
                              style={{ width: `${upct}%` }}
                            />
                          </span>
                          <span className="unit-mini-count">
                            {u.done}/{u.total}
                          </span>
                        </li>
                      );
                    })}
                  </ul>

                  {f.nextLesson ? (
                    <Link
                      href={`/teacher/${f.teacher.slug}/lesson/${f.nextLesson.id}`}
                      className="btn btn-primary btn-block"
                    >
                      أكمل التعلّم ← {f.nextLesson.title}
                    </Link>
                  ) : (
                    <p className="finished-note">🎉 أنجزت منهج هذا المعلم بالكامل!</p>
                  )}

                  <AskTeacherForm
                    teacherId={f.teacher.id}
                    teacherSlug={f.teacher.slug}
                    teacherName={f.teacher.name}
                  />
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
