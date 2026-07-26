import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser, getStudentDashboard, getStudentName } from "@/lib/data/queries";
import CancelEnrollmentButton from "@/components/CancelEnrollmentButton";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "لوحتي | منصة حصة" };

export default async function StudentDashboard() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard");

  const [name, data] = await Promise.all([getStudentName(), getStudentDashboard()]);
  const { enrollments = [], following = [] } = data ?? {};

  const totalLessons = following.reduce((n, f) => n + f.total, 0);
  const totalDone = following.reduce((n, f) => n + f.done, 0);
  const pending = enrollments.filter((e) => e.status === "pending_payment").length;

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
              هذه لوحتك: حصصك ومعلّموك وتقدّمك في المناهج
            </p>
          </div>
        </div>
        <Link href="/" className="btn btn-outline">
          ＋ استكشف معلّمين جدداً
        </Link>
      </section>

      <section className="dashboard-stats">
        <div className="stat-box">
          <span className="stat-value">{enrollments.length}</span>
          <span className="stat-label">حصة مسجّل فيها</span>
        </div>
        <div className="stat-box">
          <span className="stat-value">{following.length}</span>
          <span className="stat-label">معلّم تتابعه</span>
        </div>
        <div className="stat-box stat-box-success">
          <span className="stat-value">{totalDone}</span>
          <span className="stat-label">درساً أنجزته</span>
        </div>
        {pending > 0 && (
          <div className="stat-box stat-box-warn">
            <span className="stat-value">{pending}</span>
            <span className="stat-label">بانتظار تأكيد الدفع</span>
          </div>
        )}
      </section>

      {/* ===== حصصي ===== */}
      <section className="dashboard-section">
        <h2 className="section-title">🔴 حصصي</h2>
        {enrollments.length === 0 ? (
          <p className="drafts-empty">
            لم تسجّل في أي حصة بعد —{" "}
            <Link href="/" className="back-link">
              تصفّح المعلّمين واختر حصة
            </Link>
            .
          </p>
        ) : (
          <div className="live-grid">
            {enrollments.map((e) => (
              <article key={e.id} className="live-card">
                <div
                  className="live-thumb"
                  style={{ background: e.session.gradient }}
                  aria-hidden="true"
                >
                  {e.session.emoji}
                </div>
                <div className="live-body">
                  <h3 className="live-title">
                    {e.session.title}
                    {e.status === "pending_payment" ? (
                      <span className="badge badge-warn">بانتظار تأكيد الدفع</span>
                    ) : (
                      <span className="badge badge-success">مسجّل</span>
                    )}
                  </h3>
                  <p className="live-description">{e.session.description}</p>
                  <div className="live-meta">
                    <span className="live-schedule">📅 {e.session.schedule}</span>
                    <span className="lesson-duration">⏱ {e.session.duration}</span>
                    <Link
                      href={`/teacher/${e.session.teacherSlug}`}
                      className="back-link"
                    >
                      {e.session.teacherName}
                    </Link>
                  </div>
                  {e.status === "pending_payment" && (
                    <p className="pending-note">
                      💬 سيتواصل معك المعلم عبر واتساب لتأكيد الدفع وفتح الوصول
                      {e.session.price > 0 && (
                        <> — السعر {e.session.price} {e.session.currency}</>
                      )}
                      .
                    </p>
                  )}
                </div>
                <CancelEnrollmentButton
                  sessionId={e.session.id}
                  teacherSlug={e.session.teacherSlug}
                />
              </article>
            ))}
          </div>
        )}
      </section>

      {/* ===== معلّميّ + تقدّمي ===== */}
      <section className="dashboard-section">
        <h2 className="section-title">👨‍🏫 معلّميّ وتقدّمي</h2>
        {following.length === 0 ? (
          <p className="drafts-empty">
            لا تتابع أي معلم بعد — افتح بروفايل معلم واضغط «تابع هذا المعلم» ليظهر
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
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
