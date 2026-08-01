import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import AskTeacherForm from "@/components/AskTeacherForm";
import ExamWindow from "@/components/ExamWindow";
import MessageActions from "@/components/MessageActions";
import RequestReportCard from "@/components/RequestReportCard";
import Hint from "@/components/Hint";
import {
  getCurrentUser,
  getMyMessages,
  getMyCardRequests,
  getMyParentReports,
  getMyPendingJoins,
  getMyReportCards,
  getMyStudentExams,
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

  const [
    name,
    data,
    profile,
    messages,
    reports,
    pendingJoins,
    reportCards,
    cardRequests,
    exams,
  ] = await Promise.all([
      getStudentName(),
      getStudentDashboard(),
      getMyStudentProfile(),
      getMyMessages(),
      getMyParentReports(),
      getMyPendingJoins(),
      getMyReportCards(),
      getMyCardRequests(),
      getMyStudentExams(),
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
            🔎 معلّمون جدد
          </Link>
          <Link href="/help?role=student" className="btn btn-outline">
            ❓ دليل الاستخدام
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

      {pendingJoins.length > 0 && (
        <section className="dashboard-section">
          <h2 className="section-title">🙋 طلبات انضمامك</h2>
          <Hint>
            الانضمام غير المتابعة: بعد قبول المعلّم تصلك رسائله ومحتواه الخاص
            وبطاقات تقييمك، ويصير بإمكانك تقييمه.
          </Hint>
          <p className="dashboard-subtitle">
            هذه الطلبات وحدها ما زالت معلّقة. المعلّمون الذين قُبلت طلبك عندهم
            يظهرون في «معلّميّ» بالأسفل.
          </p>
          <ul className="join-status-list">
            {pendingJoins.map((j) => (
              <li key={j.teacherSlug} className="join-status-row">
                {/* اسم المعلّم أولاً وبوضوح: الطالب قد يكون له أكثر من طلب */}
                <Link href={`/teacher/${j.teacherSlug}`} className="join-status-name">
                  {j.teacherName}
                </Link>
                {j.status === "pending" ? (
                  <span className="pill pill-draft">
                    ⏳ بانتظار موافقة {j.teacherName}
                  </span>
                ) : (
                  <span className="pill pill-low">
                    لم يُقبل{j.note ? ` — ${j.note}` : ""}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {exams.length > 0 && (
        <section className="dashboard-section">
          <h2 className="section-title">📝 اختباراتي</h2>
          <Hint>
            اختبارات يوجّهها معلّمك إلى مجموعتك. لكل اختبار وقتٌ محدّد ومحاولة
            واحدة، والدرجة تظهر فور التسليم إلا الأسئلة النصّية فينتظر تصحيح
            معلّمك.
          </Hint>
          <ul className="exam-list">
            {exams.map((e) => {
              const a = e.attempt;
              return (
                <li key={e.id} className="exam-card">
                  <div className="exam-card-main">
                    <h3 className="exam-card-title">
                      <Link href={`/exam/${e.id}`}>{e.title}</Link>
                    </h3>
                    <p className="exam-card-meta">
                      👩‍🏫 {e.teacherName} · {e.questionCount} سؤالاً ·{" "}
                      {e.totalPoints} علامة
                    </p>
                    <p className="exam-card-meta">
                      🕒 <ExamWindow opens={e.opens_at} closes={e.closes_at} />
                      {e.duration_minutes ? ` · ${e.duration_minutes} دقيقة` : ""}
                    </p>
                  </div>
                  <div className="exam-card-side">
                    {!a ? (
                      <Link href={`/exam/${e.id}`} className="btn btn-primary btn-sm">
                        ▶️ ابدأ
                      </Link>
                    ) : a.status === "in_progress" ? (
                      <Link href={`/exam/${e.id}`} className="btn btn-primary btn-sm">
                        ↩️ أكمل الاختبار
                      </Link>
                    ) : (
                      <>
                        {/*
                          النتيجة أوّلاً وبخطٍّ ظاهر: الطالب يفتح لوحته ليعرف
                          كم أخذ، فعرضُ الحالة وحدها يجعله يفتح صفحة الاختبار
                          ليقرأ رقماً واحداً.
                        */}
                        <span className="exam-result">
                          نتيجتك {a.auto_score + a.manual_score} من {a.max_score}
                        </span>
                        <span
                          className={
                            a.status === "graded" ? "pill pill-live" : "pill pill-draft"
                          }
                        >
                          {a.status === "graded"
                            ? "✓ صُحِّح"
                            : "⏳ درجة مبدئية — بانتظار تصحيح معلّمك"}
                        </span>
                        <Link href={`/exam/${e.id}`} className="btn btn-outline btn-sm">
                          إجاباتي
                        </Link>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {reportCards.length > 0 && (
        <section className="dashboard-section">
          <h2 className="section-title">🏅 بطاقات تقييمي</h2>
          <Hint>
            تقييم مكتوب من معلّمك في نهاية وحدة أو فصل — يصلح لتطلع عليه أسرتك.
          </Hint>
          <div className="report-cards">
            {reportCards.map((c) => (
              <article key={c.id} className="report-card">
                <header className="report-card-head">
                  <strong>{c.title}</strong>
                  <span className="group-meta">
                    {c.teacherName}
                    {c.unitTitle && <> · {c.unitTitle}</>}
                    {c.term && <> · {c.term}</>}
                  </span>
                </header>

                <ul className="report-scales">
                  {[
                    ["الفهم والاستيعاب", c.understanding],
                    ["المشاركة", c.participation],
                    ["الواجبات", c.homework],
                    ["الانضباط", c.behavior],
                  ]
                    .filter(([, v]) => v !== null && v !== undefined)
                    .map(([label, v]) => (
                      <li key={String(label)} className="report-scale">
                        <span>{label}</span>
                        <span className="report-stars" aria-label={`${v} من 5`}>
                          {"★".repeat(Number(v))}
                          {"☆".repeat(5 - Number(v))}
                        </span>
                      </li>
                    ))}
                </ul>

                {c.score !== null && (
                  <p className="report-score">
                    الدرجة: <strong>{c.score}</strong>
                    {c.max_score !== null && <> من {c.max_score}</>}
                  </p>
                )}

                {c.strengths && (
                  <p className="report-note">
                    <strong>نقاط القوة:</strong> {c.strengths}
                  </p>
                )}
                {c.improvements && (
                  <p className="report-note">
                    <strong>ما تحتاج تحسينه:</strong> {c.improvements}
                  </p>
                )}
                {c.note && <p className="report-note">{c.note}</p>}

                <span className="group-meta">
                  {new Date(c.issued_at).toLocaleDateString("ar-EG", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              </article>
            ))}
          </div>
        </section>
      )}

      {messages.length > 0 && (
        <section className="dashboard-section">
          <h2 className="section-title">✉️ مراسلاتك مع معلّميك</h2>
          <Hint>
            اسأل معلّمك عمّا لم يتّضح لك في درس. تصلك إشارة صوتية فور وصول ردّه
            وأنت على هذه الصفحة. زرّ «إزالة» يخفي الرسالة من قائمتك أنت وحدك —
            التعميم يبقى عند بقية زملائك.
          </Hint>
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
                  {m.student_id === null &&
                    (m.group_id ? (
                      <span className="pill pill-free">
                        👥 لمجموعة {m.groupName}
                      </span>
                    ) : (
                      <span className="pill pill-free">📢 لكل الطلاب</span>
                    ))}
                </div>
                <p className="message-body">{m.body}</p>
                <MessageActions
                  messageId={m.id}
                  teacherId={m.teacher_id}
                  teacherSlug={m.teacherSlug}
                  teacherName={m.teacherName}
                  canReply={m.sender === "teacher"}
                />
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
        <Hint>
          صفوفك التي قَبِلك معلّموها. الشريط يبيّن كم أنجزت من منهج كل معلّم،
          فتعرف أين توقّفت وأين تحتاج أن تلحق.
        </Hint>

        {following.length > 0 && (
          <div className="dashboard-subsection">
            <Hint>
              تحتاج تقييماً مكتوباً لأسرتك أو لتعرف مستواك؟ اطلبه من معلّمك
              مباشرة، ويصلك على هذه اللوحة حين يصدره.
            </Hint>
            <RequestReportCard
              teachers={following.map((f) => ({
                id: f.teacher.id,
                name: f.teacher.name,
              }))}
              myRequests={cardRequests}
            />
          </div>
        )}

        {following.length === 0 ? (
          <p className="drafts-empty">
            لم تنضمّ إلى أي صفّ بعد — افتح صفحة معلّم واضغط «انضم إلى الصف» ليظهر
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
                  {/*
                    الرأس كلّه رابط: الطالب يضغط الصورة أو الاسم فيصل إلى
                    دروس معلّمه مباشرةً، بدل أن يعود إلى الدليل ويبحث عنه.
                  */}
                  <Link
                    href={`/teacher/${f.teacher.slug}`}
                    className="follow-head follow-head-link"
                    aria-label={`دروس ${f.teacher.name}`}
                  >
                    {f.teacher.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={f.teacher.avatar_url}
                        alt=""
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
                      <h3 className="unit-progress-title">{f.teacher.name}</h3>
                      <span className="tag tag-subject">{f.teacher.subject}</span>
                    </div>
                    <span className="follow-head-go" aria-hidden="true">
                      ‹
                    </span>
                  </Link>

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
