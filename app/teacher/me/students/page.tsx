import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import {
  getCardRequests,
  getCurrentUser,
  getIssuedReportCards,
  getJoinRequests,
  getMyGroups,
  getMyStudents,
  getMyTeacher,
  getMyQuizStats,
  getMyTeacherContent,
  getMyThreads,
} from "@/lib/data/queries";
import { revokeAccess } from "@/app/actions/teacher-students";
import StudentActionsPanel, {
  type GrantTarget,
} from "@/components/StudentActionsPanel";
import BroadcastForm from "@/components/BroadcastForm";
import JoinRequestsPanel from "@/components/JoinRequestsPanel";
import GroupsManager from "@/components/GroupsManager";
import StudentGroupChips from "@/components/StudentGroupChips";
import ReportCardForm from "@/components/ReportCardForm";
import CardRequestsPanel from "@/components/CardRequestsPanel";
import Hint from "@/components/Hint";
import ReplyForm from "@/components/ReplyForm";
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
  let threads: Awaited<ReturnType<typeof getMyThreads>> = [];
  let requests: Awaited<ReturnType<typeof getJoinRequests>> = [];
  let groups: Awaited<ReturnType<typeof getMyGroups>> = [];
  let cards: Awaited<ReturnType<typeof getIssuedReportCards>> = [];
  let cardRequests: Awaited<ReturnType<typeof getCardRequests>> = [];
  let loadError: string | undefined;
  try {
    [students, content, quizStats, threads, requests, groups, cards, cardRequests] =
      await Promise.all([
        getMyStudents(),
        getMyTeacherContent(),
        getMyQuizStats(),
        getMyThreads(),
        getJoinRequests(),
        getMyGroups(),
        getIssuedReportCards(),
        getCardRequests(),
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

  const waiting = threads.filter((t) => t.unansweredCount > 0).length;

  const units = (content?.units ?? []).map((u) => ({ id: u.id, title: u.title }));

  const avgProgress = students.length
    ? Math.round(students.reduce((n, s) => n + s.progressPct, 0) / students.length)
    : 0;

  return (
    <main className="container">
      <PageHeader
        backHref="/teacher/me"
        backLabel="لوحة المعلّم"
        emoji="👥"
        title="طلابي"
        subtitle="طلاب صفّك وتقدّمهم في منهجك — راسلهم، وأصدر بطاقات تقييم، وامنحهم وصولاً لدروسك الخاصة."
      />

      <section className="dashboard-stats">
        <div className="stat-box">
          <span className="stat-value">{students.length}</span>
          <span className="stat-label">طالباً منضمّاً</span>
        </div>
        <div className="stat-box">
          <span className="stat-value">{avgProgress}%</span>
          <span className="stat-label">متوسّط التقدّم</span>
        </div>
        <div className="stat-box">
          <span className="stat-value">{requests.length}</span>
          <span className="stat-label">طلب انضمام</span>
        </div>
      </section>

      {requests.length > 0 && (
        <section className="dashboard-section">
          <h2 className="section-title">
            🙋 طلبات الانضمام
            <span className="pill pill-low"> {requests.length} بانتظار قرارك</span>
          </h2>
          <Hint>
            هؤلاء قرؤوا شروطك ووافقوا عليها. قبل قبولك لا يرون محتواك الخاص ولا
            يراسلونك ولا يُقيّمونك.
          </Hint>
          <JoinRequestsPanel requests={requests} />
        </section>
      )}

      {cardRequests.length > 0 && (
        <section className="dashboard-section">
          <h2 className="section-title">
            🏅 طلبات بطاقات التقييم
            <span className="pill pill-low"> {cardRequests.length}</span>
          </h2>
          <Hint>
            طلاب يريدون تقييماً مكتوباً — غالباً ليطلعوا عليه أولياء أمورهم.
            أصدر البطاقة من بطاقة الطالب بالأسفل، ويُغلق الطلب تلقائياً.
          </Hint>
          <CardRequestsPanel requests={cardRequests} />
        </section>
      )}

      <section className="dashboard-section">
        <h2 className="section-title">🗂️ المجموعات</h2>
        <Hint>
          قسّم طلابك حسب موعد الحصة أو المستوى لتتابع كل فئة على حدة. الطالب
          الواحد قد يكون في أكثر من مجموعة، ورقم واتسابك لا يظهر إلا لأعضائها.
        </Hint>
        <GroupsManager groups={groups} />
      </section>

      {students.length === 0 ? (
        <p className="drafts-empty">
          لا ينضمّ إليك أي طالب بعد. شارك رابط صفحتك من{" "}
          <Link href="/teacher/me" className="back-link">
            لوحة المعلّم
          </Link>{" "}
          ليصلك أول طلب انضمام.
        </p>
      ) : (
        <>
          <section className="dashboard-section">
            <h2 className="section-title">📢 رسالة لكل المنضمّين</h2>
            <Hint>
              إعلان واحد يصل كل طلاب صفّك دفعةً واحدة — مواعيد، تذكير بواجب، أو
              تغيير طارئ. المتابعون غير المنضمّين لا يستلمونه.
            </Hint>
            <BroadcastForm />
          </section>

          {threads.length > 0 && (
            <section className="dashboard-section">
              <Hint>
                خيط لكل طالب. ما ينتظر ردّك يظهر أولاً حتى لا يضيع سؤال.
              </Hint>
              <h2 className="section-title">
                💬 محادثات الطلاب
                {waiting > 0 && (
                  <span className="pill pill-low"> {waiting} بانتظار ردّك</span>
                )}
              </h2>
              <div className="threads-list">
                {threads.map((t) => (
                  <article key={t.studentId} className="thread-card">
                    <header className="thread-head">
                      <strong>{t.studentName}</strong>
                      {t.unansweredCount > 0 && (
                        <span className="pill pill-low">بانتظار ردّك</span>
                      )}
                    </header>
                    <ul className="thread-messages">
                      {t.messages.map((m) => (
                        <li
                          key={m.id}
                          className={`thread-msg ${
                            m.sender === "student"
                              ? "thread-msg-student"
                              : "thread-msg-teacher"
                          }`}
                        >
                          <span className="thread-msg-who">
                            {m.sender === "student" ? t.studentName : "أنت"}
                          </span>
                          <span className="thread-msg-body">{m.body}</span>
                          <span className="thread-msg-date">
                            {new Date(m.created_at).toLocaleDateString("ar-EG", {
                              day: "numeric",
                              month: "long",
                            })}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <ReplyForm
                      studentId={t.studentId}
                      studentName={t.studentName}
                    />
                  </article>
                ))}
              </div>
            </section>
          )}

          {quizStats.length > 0 && (
            <section className="dashboard-section">
              <h2 className="section-title">📝 نتائج الاختبارات</h2>
              <Hint>
                متوسّط كل درس ودرجة كل طالب — يكشف الدرس الذي يحتاج إعادة شرح
                قبل أن يتراكم الضعف.
              </Hint>
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
            <Hint>
              كل بطاقة تجمع تقدّم الطالب ومجموعاته وبطاقات تقييمه وأدوات
              مراسلته ومنحه وصولاً لدرس خاص.
            </Hint>
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

                  <StudentGroupChips
                    studentId={s.profile.id}
                    groups={groups}
                    memberOf={s.groupIds}
                  />

                  <ReportCardForm
                    studentId={s.profile.id}
                    studentName={s.profile.full_name}
                    units={units}
                    existing={cards.filter((c) => c.student_id === s.profile.id)}
                  />

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
