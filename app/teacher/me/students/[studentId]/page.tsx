import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import Hint from "@/components/Hint";
import ReplyForm from "@/components/ReplyForm";
import ReportCardForm from "@/components/ReportCardForm";
import StudentGroupChips from "@/components/StudentGroupChips";
import StudentActionsPanel, {
  type GrantTarget,
} from "@/components/StudentActionsPanel";
import ConnectionNotice from "@/components/ConnectionNotice";
import { revokeAccess } from "@/app/actions/teacher-students";
import {
  getCurrentUser,
  getMyTeacher,
  getMyGroups,
  getMyTeacherContent,
  getStudentForTeacher,
} from "@/lib/data/queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "ملفّ الطالب | منصة حصة" };

export default async function StudentProfilePage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;

  const user = await getCurrentUser();
  if (!user) redirect(`/login?role=teacher&next=/teacher/me/students/${studentId}`);

  const teacher = await getMyTeacher();
  if (!teacher) redirect("/teacher/onboarding");

  let s;
  let groups;
  let content;
  try {
    [s, groups, content] = await Promise.all([
      getStudentForTeacher(studentId),
      getMyGroups(),
      getMyTeacherContent(),
    ]);
  } catch {
    return <ConnectionNotice />;
  }
  if (!s) notFound();

  const units = (content?.units ?? []).map((u) => ({ id: u.id, title: u.title }));
  const targets: GrantTarget[] = (content?.units ?? []).flatMap((u) =>
    u.lessons
      .filter((l) => l.is_restricted)
      .map((l) => ({ value: `lesson:${l.id}`, label: `🔒 ${l.title}` }))
  );

  const wa = s.profile.whatsapp?.replace(/[^0-9]/g, "") ?? "";
  const graded = s.exams.filter((e) => e.status !== "in_progress");
  const examAvg = graded.length
    ? Math.round((graded.reduce((n, e) => n + e.pct, 0) / graded.length) * 10) / 10
    : null;

  return (
    <main className="container">
      <PageHeader
        backHref="/teacher/me/students"
        backLabel="طلابي"
        emoji="🎓"
        title={s.profile.full_name}
        subtitle={
          [
            s.profile.grade || "الصف غير محدّد",
            s.profile.school,
            s.profile.city,
            s.profile.age ? `${s.profile.age} سنة` : "",
          ]
            .filter(Boolean)
            .join(" · ")
        }
      />

      {/* وسائل التواصل والمجموعات: أوّل ما يحتاجه المعلّم عن طالبه */}
      <section className="profile-strip">
        {wa && (
          <a
            href={`https://wa.me/${wa}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-whatsapp btn-sm"
          >
            💬 واتساب الطالب
          </a>
        )}
        {s.profile.phone && (
          <a href={`tel:${s.profile.phone}`} className="btn btn-outline btn-sm">
            📞 هاتفه
          </a>
        )}
        {s.profile.guardian_phone && (
          <a
            href={`tel:${s.profile.guardian_phone}`}
            className="btn btn-outline btn-sm"
          >
            👨‍👩‍👦 وليّ الأمر
          </a>
        )}
        {s.groups.map((g) => (
          <Link
            key={g.id}
            href={`/teacher/me/groups/${g.id}`}
            className="pill pill-free"
          >
            👥 {g.name}
          </Link>
        ))}
      </section>

      <section className="dashboard-stats">
        <div className="stat-box">
          <span className="stat-value">{s.progressPct}%</span>
          <span className="stat-label">
            أنهى {s.completedLessons} من {s.totalLessons} درساً
          </span>
        </div>
        <div className="stat-box">
          {examAvg === null ? (
            <>
              <span className="stat-value stat-value-muted">—</span>
              <span className="stat-label">لا اختبارات بعد</span>
            </>
          ) : (
            <>
              <span className="stat-value">{examAvg}%</span>
              <span className="stat-label">متوسّط اختباراته</span>
            </>
          )}
        </div>
        <div className="stat-box">
          <span className="stat-value">{s.cards.length}</span>
          <span className="stat-label">بطاقة تقييم</span>
        </div>
      </section>

      <div className="progress-track" aria-hidden="true">
        <div className="progress-fill" style={{ width: `${s.progressPct}%` }} />
      </div>

      <section className="dashboard-section">
        <h2 className="section-title">📝 نتائجه في اختباراتك</h2>
        <Hint>
          نتيجة كل اختبار وجّهته إلى مجموعة هذا الطالب. اضغط «صحّح» للانتقال إلى
          ورقته وتصحيح أسئلتها النصّية.
        </Hint>
        {s.exams.length === 0 ? (
          <p className="drafts-empty">لم يقدّم أيّ اختبار بعد.</p>
        ) : (
          <ul className="result-list">
            {s.exams.map((e) => (
              <li key={e.attemptId} className="result-row">
                <span className="result-title">{e.title}</span>
                {e.status === "in_progress" ? (
                  <span className="pill pill-draft">لم يسلّم بعد</span>
                ) : (
                  <>
                    <span
                      className={`pill ${
                        e.pct >= 70 ? "pill-live" : e.pct >= 40 ? "pill-draft" : "pill-low"
                      }`}
                    >
                      {e.score} من {e.maxScore} ({e.pct}%)
                    </span>
                    {e.status === "submitted" && (
                      <span className="pill pill-low">بانتظار تصحيحك</span>
                    )}
                  </>
                )}
                <Link
                  href={`/teacher/me/exams/${e.examId}/grade`}
                  className="btn btn-outline btn-sm"
                >
                  {e.status === "submitted" ? "✍️ صحّح" : "📊 الورقة"}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {s.quizzes.length > 0 && (
        <section className="dashboard-section">
          <h2 className="section-title">📚 اختبارات الدروس القصيرة</h2>
          <ul className="result-list">
            {s.quizzes.map((q) => {
              const pct = q.total ? Math.round((q.score / q.total) * 100) : 0;
              return (
                <li key={q.lessonId} className="result-row">
                  <span className="result-title">{q.lessonTitle}</span>
                  <span
                    className={`pill ${
                      pct >= 70 ? "pill-live" : pct >= 40 ? "pill-draft" : "pill-low"
                    }`}
                  >
                    {q.score} من {q.total}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="dashboard-section">
        <h2 className="section-title">💬 محادثتكما</h2>
        {s.messages.length === 0 ? (
          <p className="drafts-empty">لا رسائل بينكما بعد.</p>
        ) : (
          <ul className="thread-messages">
            {s.messages.map((m) => (
              <li
                key={m.id}
                className={`thread-msg ${
                  m.sender === "student" ? "thread-msg-student" : "thread-msg-teacher"
                }`}
              >
                <span className="thread-msg-who">
                  {m.sender === "student" ? s.profile.full_name : "أنت"}
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
        )}
        <ReplyForm studentId={studentId} studentName={s.profile.full_name} />
      </section>

      <section className="dashboard-section">
        <h2 className="section-title">🗂️ مجموعاته ووصوله</h2>
        <Hint>
          ضَع الطالب في مجموعة أو أخرجه منها، وامنحه وصولاً إلى درس خاص. الدرس
          الخاص مخفيّ تماماً — حتى عنوانه — عمّن لا منحة له.
        </Hint>
        <StudentGroupChips
          studentId={studentId}
          groups={groups}
          memberOf={s.groups.map((g) => g.id)}
        />

        {s.grants.length > 0 && (
          <ul className="grants-list">
            {s.grants.map((g) => (
              <li key={g.id} className="grant-row">
                <span className="pill pill-free">
                  🔓 {g.lesson_id ? "درس خاص" : "كل المحتوى الخاص"}
                </span>
                <form action={revokeAccess}>
                  <input type="hidden" name="grantId" value={g.id} />
                  <button type="submit" className="btn btn-outline btn-sm btn-danger">
                    سحب
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}

        <StudentActionsPanel
          studentId={studentId}
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
      </section>

      <section className="dashboard-section">
        <h2 className="section-title">🏅 بطاقات تقييمه</h2>
        <Hint>
          تقييم نهاية وحدة أو فصل: تقديرات للفهم والمشاركة والواجبات والانضباط،
          ونقاط قوّته وما يحتاج تحسينه. يقرؤها الطالب على لوحته.
        </Hint>
        <ReportCardForm
          studentId={studentId}
          studentName={s.profile.full_name}
          units={units}
          existing={s.cards}
        />
      </section>
    </main>
  );
}
