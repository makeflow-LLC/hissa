import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import Hint from "@/components/Hint";
import ConnectionNotice from "@/components/ConnectionNotice";
import { getCurrentUser, getMyTeacher, getInsights } from "@/lib/data/queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "أين يتعثّر صفّي | منصة حصة" };

export default async function InsightsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?role=teacher&next=/teacher/me/insights");
  const teacher = await getMyTeacher();
  if (!teacher) redirect("/teacher/onboarding");

  let data;
  try {
    data = await getInsights();
  } catch {
    return <ConnectionNotice />;
  }

  return (
    <main className="container">
      <PageHeader
        backHref="/teacher/me"
        backLabel="لوحة المعلّم"
        emoji="🔍"
        title="أين يتعثّر صفّي؟"
        subtitle="ثلاث قراءات من نتائج طلابك — لا تحتاج منك إدخال شيء."
      />

      <Hint>
        هذه الصفحة لا تضيف بياناتٍ جديدة: تقرأ ما سجّلته المنصّة أصلاً من
        إجابات الاختبارات وتقدّم الدروس ونشاط الطلاب، وتقول لك ما يعنيه.
        الغرض أن تعرف <strong>ماذا تفعل غداً</strong>، لا أن ترى أرقاماً.
      </Hint>

      {/* ===== أصعب الأسئلة ===== */}
      <section className="dashboard-section">
        <h2 className="section-title">📉 الأسئلة التي أخطأها أكثر الطلاب</h2>
        {data.hardQuestions.length === 0 ? (
          <p className="drafts-empty">
            لا نتائج كافية بعد — تظهر هنا بعد أن يقدّم طالبان اختباراً.
          </p>
        ) : (
          <ul className="insight-list">
            {data.hardQuestions.map((q) => (
              <li key={q.prompt + q.examId} className="insight-row">
                <div className="insight-main">
                  <span className="insight-title">{q.prompt}</span>
                  <span className="group-meta">{q.examTitle}</span>
                </div>
                <span
                  className={`pill ${q.wrongPct >= 60 ? "pill-low" : "pill-draft"}`}
                >
                  {q.wrong} من {q.answered} أخطأوا ({q.wrongPct}%)
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="form-hint">
          نسبةٌ عالية في سؤالٍ بعينه تعني غالباً أن الفكرة لم تصل — لا أن
          الطلاب لم يذاكروا.
        </p>
      </section>

      {/* ===== الدروس التي يتوقّف عندها الصفّ ===== */}
      <section className="dashboard-section">
        <h2 className="section-title">🧗 الدروس التي يتوقّف عندها الصفّ</h2>
        {data.lessonReach.length === 0 ? (
          <p className="drafts-empty">لا دروس منشورة بعد.</p>
        ) : (
          <ul className="insight-list">
            {data.lessonReach.slice(0, 12).map((l) => (
              <li key={l.lessonId} className="insight-row">
                <div className="insight-main">
                  <Link
                    href={`/teacher/me/lessons/${l.lessonId}`}
                    className="insight-title"
                  >
                    {l.title}
                  </Link>
                  <span className="group-meta">{l.unit}</span>
                </div>
                <span className="insight-bar" aria-hidden="true">
                  <span
                    className="insight-bar-fill"
                    style={{ width: `${Math.max(2, l.pct)}%` }}
                  />
                </span>
                <span
                  className={`pill ${l.pct < 30 ? "pill-low" : l.pct < 70 ? "pill-draft" : "pill-live"}`}
                >
                  {l.done} من {l.students} ({l.pct}%)
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ===== الغائبون ===== */}
      <section className="dashboard-section">
        <h2 className="section-title">😴 طلابٌ لم يظهروا منذ أسبوعين</h2>
        {data.quietStudents.length === 0 ? (
          <p className="drafts-empty">كل طلابك نشطون. 👏</p>
        ) : (
          <ul className="insight-list">
            {data.quietStudents.map((s) => (
              <li key={s.studentId} className="insight-row">
                <div className="insight-main">
                  <Link
                    href={`/teacher/me/students/${s.studentId}`}
                    className="insight-title"
                  >
                    {s.name}
                  </Link>
                  {s.grade && <span className="group-meta">{s.grade}</span>}
                </div>
                <span className="pill pill-low">
                  {s.lastSeen
                    ? `منذ ${s.quietDays} يوماً`
                    : "لم يبدأ بعد"}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="form-hint">
          الطالب المتعثّر لا يشكو — يختفي فقط. رسالةٌ قصيرة تُعيد أكثرهم.
        </p>
      </section>
    </main>
  );
}
