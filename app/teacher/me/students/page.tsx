import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import {
  getCurrentUser,
  getMyStudents,
  getMyTeacher,
  getMyQuizStats,
  getMyTeacherContent,
} from "@/lib/data/queries";
import { revokeAccess } from "@/app/actions/teacher-students";
import StudentActionsPanel, {
  type GrantTarget,
} from "@/components/StudentActionsPanel";
import BroadcastForm from "@/components/BroadcastForm";
import ConnectionNotice from "@/components/ConnectionNotice";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "طلابي" };

export default async function TeacherStudentsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?role=teacher&next=/teacher/me/students");

  const teacher = await getMyTeacher();
  if (!teacher) redirect("/teacher/onboarding");

  let students: Awaited<ReturnType<typeof getMyStudents>> = [];
  let content: Awaited<ReturnType<typeof getMyTeacherContent>> = null;
  let quizStats: Awaited<ReturnType<typeof getMyQuizStats>> = [];
  let loadError: string | undefined;
  try {
    [students, content, quizStats] = await Promise.all([
      getMyStudents(),
      getMyTeacherContent(),
      getMyQuizStats(),
    ]);
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

  // أهداف المنح: الدروس المُعلَّمة «خاصة» فقط
  const targets: GrantTarget[] = (content?.units ?? []).flatMap((u) =>
    u.lessons
      .filter((l) => l.is_restricted)
      .map((l) => ({ value: `lesson:${l.id}`, label: `🔒 ${l.title}` }))
  );

  const avgProgress = students.length
    ? Math.round(students.reduce((n, s) => n + s.progressPct, 0) / students.length)
    : 0;

  return (
    <main className="container">
      <nav className="breadcrumb">
        <Link href="/teacher/me" className="back-link">
          → لوحة المعلّم
        </Link>
      </nav>

      <section className="dashboard-header">
        <div>
          <h1 className="dashboard-title">👥 طلابي</h1>
          <p className="dashboard-subtitle">
            الطلاب الذين يتابعونك وتقدّمهم في منهجك — راسلهم، وأرسل تقريراً
            لوليّ الأمر، وامنحهم وصولاً لدروسك الخاصة.
          </p>
        </div>
      </section>

      <section className="dashboard-stats">
        <div className="stat-box">
          <span className="stat-value">{students.length}</span>
          <span className="stat-label">طالباً يتابعك</span>
        </div>
        <div className="stat-box">
          <span className="stat-value">{avgProgress}%</span>
          <span className="stat-label">متوسّط التقدّم</span>
        </div>
        <div className="stat-box">
          <span className="stat-value">{targets.length}</span>
          <span className="stat-label">درساً خاصاً</span>
        </div>
      </section>

      {students.length === 0 ? (
        <p className="drafts-empty">
          لا يتابعك أي طالب بعد. شارك رابط صفحتك من{" "}
          <Link href="/teacher/me" className="back-link">
            لوحة المعلّم
          </Link>{" "}
          ليبدأ الطلاب بمتابعتك.
        </p>
      ) : (
        <>
          <section className="dashboard-section">
            <h2 className="section-title">📢 رسالة لكل المتابعين</h2>
            <BroadcastForm />
          </section>

          {quizStats.length > 0 && (
            <section className="dashboard-section">
              <h2 className="section-title">📝 نتائج الاختبارات</h2>
              <div className="quiz-stats">
                {quizStats.map((q) => (
                  <article key={q.lessonId} className="quiz-stat-card">
                    <header className="quiz-stat-head">
                      <strong>{q.lessonTitle}</strong>
                      <span className="quiz-stat-meta">
                        {q.attempts} محاولة · متوسّط {q.avgPct}%
                      </span>
                    </header>
                    <ul className="quiz-stat-rows">
                      {q.rows.map((r, i) => {
                        const pct = r.total
                          ? Math.round((r.score / r.total) * 100)
                          : 0;
                        return (
                          <li key={i} className="quiz-stat-row">
                            <span className="quiz-stat-name">{r.studentName}</span>
                            <span
                              className={`pill ${
                                pct >= 70
                                  ? "pill-live"
                                  : pct >= 40
                                    ? "pill-draft"
                                    : "pill-low"
                              }`}
                            >
                              {r.score} / {r.total} ({pct}%)
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </article>
                ))}
              </div>
            </section>
          )}

          <section className="dashboard-section">
            <h2 className="section-title">قائمة الطلاب</h2>
            <div className="students-list">
              {students.map((s) => (
                <article key={s.profile.id} className="student-card">
                  <div className="student-main">
                    {s.profile.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={s.profile.avatar_url}
                        alt=""
                        className="student-avatar"
                      />
                    ) : (
                      <span className="student-avatar student-avatar-fallback">
                        🎓
                      </span>
                    )}
                    <div className="student-info">
                      <span className="student-name">{s.profile.full_name}</span>
                      <span className="student-meta">
                        {s.profile.grade || "الصف غير محدّد"}
                        {s.profile.school && <> · {s.profile.school}</>}
                        {s.profile.city && <> · {s.profile.city}</>}
                        {s.profile.age && <> · {s.profile.age} سنة</>}
                      </span>
                      {(s.profile.whatsapp ||
                        s.profile.phone ||
                        s.profile.guardian_phone) && (
                        <span className="student-contacts">
                          {s.profile.whatsapp && (
                            <a
                              href={`https://wa.me/${s.profile.whatsapp.replace(
                                /[^0-9]/g,
                                ""
                              )}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="student-contact"
                            >
                              💬 واتساب
                            </a>
                          )}
                          {s.profile.phone && (
                            <a
                              href={`tel:${s.profile.phone}`}
                              className="student-contact"
                            >
                              📞 هاتفه
                            </a>
                          )}
                          {s.profile.guardian_phone && (
                            <a
                              href={`tel:${s.profile.guardian_phone}`}
                              className="student-contact"
                            >
                              👨‍👩‍👦 ولي الأمر
                            </a>
                          )}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="student-progress">
                    <div className="progress-labels">
                      <span className="progress-title">تقدّمه في منهجك</span>
                      <span className="progress-value">
                        {s.completedLessons} / {s.totalLessons} ({s.progressPct}%)
                      </span>
                    </div>
                    <div
                      className="progress-track"
                      role="progressbar"
                      aria-valuenow={s.completedLessons}
                      aria-valuemin={0}
                      aria-valuemax={s.totalLessons}
                      aria-label={`تقدّم ${s.profile.full_name}`}
                    >
                      <div
                        className="progress-fill"
                        style={{ width: `${s.progressPct}%` }}
                      />
                    </div>
                  </div>

                  {s.grants.length > 0 && (
                    <ul className="grants-list">
                      {s.grants.map((g) => (
                        <li key={g.id} className="grant-row">
                          <span className="pill pill-free">
                            🔓{" "}
                            {g.lesson_id ? "درس خاص" : "كل المحتوى الخاص"}
                          </span>
                          <form action={revokeAccess}>
                            <input type="hidden" name="grantId" value={g.id} />
                            <button
                              type="submit"
                              className="btn btn-outline btn-sm btn-danger"
                            >
                              سحب
                            </button>
                          </form>
                        </li>
                      ))}
                    </ul>
                  )}

                  <StudentActionsPanel
                    studentId={s.profile.id}
                    studentName={s.profile.full_name}
                    targets={targets}
                    guardianPhone={s.profile.guardian_phone}
                    teacherName={teacher.name}
                    progress={{
                      done: s.completedLessons,
                      total: s.totalLessons,
                      pct: s.progressPct,
                    }}
                  />
                </article>
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
