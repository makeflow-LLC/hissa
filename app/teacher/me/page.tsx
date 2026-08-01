import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import {
  getCurrentUser,
  getMyTeacher,
  getRecentExamResults,
} from "@/lib/data/queries";
import ShareProfile from "@/components/ShareProfile";
import Hint from "@/components/Hint";
import Stars from "@/components/Stars";
import AvailabilityToggle from "@/components/AvailabilityToggle";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "لوحة المعلّم" };

export default async function TeacherMePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?role=teacher&next=/teacher/me");

  const teacher = await getMyTeacher();
  if (!teacher) redirect("/teacher/onboarding");

  const results = await getRecentExamResults();
  const needGrading = results.filter((r) => r.status === "submitted").length;

  return (
    <main className="container">
      <section className="dashboard-header">
        <div className="dashboard-welcome">
          {teacher.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={teacher.avatar_url} alt={teacher.name} className="teacher-avatar-img" />
          ) : (
            <div className="teacher-avatar" style={{ background: teacher.gradient }}>
              {teacher.initials}
            </div>
          )}
          <div>
            <h1 className="dashboard-title">{teacher.name}</h1>
            <p className="dashboard-subtitle">
              {teacher.subject} · {teacher.stages.join(" / ")}
              {teacher.experience_years > 0 && (
                <> · خبرة {teacher.experience_years} سنة</>
              )}
            </p>
          </div>
        </div>
        {/*
          صفّان لا صفّ واحد: خمسة أزرار في سطر واحد على الجوال تتقاسم
          العرض بالتساوي، فينكمش كلٌّ منها إلى عرض أطول كلمة فيه ويصير
          نصّه عموداً — وهو ما جعل اللوحة متعبة للعين.
        */}
        <div className="dashboard-header-actions">
          <Link href="/teacher/me/students" className="btn btn-primary">
            👥 طلابي
          </Link>
          <Link href="/teacher/me/exams" className="btn btn-primary">
            📝 الاختبارات
          </Link>
        </div>
        <div className="dashboard-header-secondary">
          <Link href="/teacher/me/content" className="btn btn-outline btn-sm">
            🎬 المحتوى
          </Link>
          <Link href="/teacher/onboarding" className="btn btn-outline btn-sm">
            ✏️ بياناتي
          </Link>
          <Link href={`/teacher/${teacher.slug}`} className="btn btn-outline btn-sm">
            👁 معاينة صفحتي
          </Link>
          <Link href="/help?role=teacher" className="btn btn-outline btn-sm">
            ❓ الدليل
          </Link>
        </div>
      </section>

      <section className="dashboard-section">
        <AvailabilityToggle
          status={teacher.availability}
          note={teacher.availability_note}
        />
      </section>

      {!teacher.is_published && (
        <div className="visitor-banner">
          بروفايلك غير منشور حالياً في الدليل. عدّل بياناتك واحفظها لنشره.
        </div>
      )}

      <section className="dashboard-stats">
        <div className="stat-box">
          <span className="stat-value">{teacher.experience_years}</span>
          <span className="stat-label">سنوات خبرة</span>
        </div>
        <div className="stat-box">
          {teacher.rating_count > 0 ? (
            <>
              <span className="stat-value stat-rating">
                {teacher.rating}
                <Stars rating={Number(teacher.rating)} />
              </span>
              <span className="stat-label">{teacher.rating_count} تقييماً</span>
            </>
          ) : (
            <>
              <span className="stat-value stat-value-muted">—</span>
              <span className="stat-label">لا تقييمات بعد</span>
            </>
          )}
        </div>
        <div className="stat-box">
          <span className="stat-value">{teacher.stages.length}</span>
          <span className="stat-label">مراحل تدرّسها</span>
        </div>
      </section>

      {teacher.qualification && (
        <section className="dashboard-section">
          <h2 className="section-title">🎓 المؤهل العلمي</h2>
          <p className="me-qualification">{teacher.qualification}</p>
        </section>
      )}

      {teacher.bio && (
        <section className="dashboard-section">
          <h2 className="section-title">📝 نبذة عنك</h2>
          <p className="me-bio">{teacher.bio}</p>
        </section>
      )}

      <ShareProfile slug={teacher.slug} teacherName={teacher.name} />

      <section className="dashboard-section">
        <div className="section-head-row">
          <h2 className="section-title">🎬 محتواك</h2>
          <Link href="/teacher/me/content" className="btn btn-primary">
            إدارة المحتوى
          </Link>
        </div>
        <Hint>
          الوحدة تجمع دروساً متسلسلة، والدرس يحمل الشرح والفيديو والمرفقات
          والاختبار. ما تحفظه «مسودّة» لا يراه الطلاب حتى تنشره.
        </Hint>
        <p className="drafts-empty">
          أضِف الوحدات والدروس المسجّلة، وتظهر مباشرةً في{" "}
          <Link href={`/teacher/${teacher.slug}`} className="back-link">
            بروفايلك العام
          </Link>{" "}
          للطلاب.
        </p>
      </section>

      <section className="dashboard-section">
        <div className="section-head-row">
          <h2 className="section-title">
            📝 الاختبارات
            {needGrading > 0 && (
              <span className="pill pill-low"> {needGrading} بانتظار تصحيحك</span>
            )}
          </h2>
          <Link href="/teacher/me/exams" className="btn btn-primary">
            إدارة الاختبارات
          </Link>
        </div>
        <Hint>
          الاختبار يُوجَّه إلى مجموعة بعينها فلا يراه غير طلابها، وله وقت فتح
          وإغلاق وعلامة لكل سؤال. الاختيار من متعدّد وصح/خطأ يُصحَّحان آلياً،
          وأسئلة «علّل» و«اذكر السبب» تصحّحها بنفسك.
        </Hint>

        {/* أحدث النتائج على اللوحة نفسها: من قدّم وكم أخذ، بلا تنقّل */}
        {results.length === 0 ? (
          <p className="drafts-empty">لا نتائج بعد — لم يقدّم أحد اختباراً.</p>
        ) : (
          <ul className="result-list">
            {results.map((r) => (
              <li key={r.attemptId} className="result-row">
                <Link
                  href={`/teacher/me/students/${r.studentId}`}
                  className="result-title"
                >
                  {r.studentName}
                </Link>
                <span className="group-meta">{r.examTitle}</span>
                <span
                  className={`pill ${
                    r.pct >= 70 ? "pill-live" : r.pct >= 40 ? "pill-draft" : "pill-low"
                  }`}
                >
                  {r.score} من {r.maxScore} ({r.pct}%)
                </span>
                {r.status === "submitted" && (
                  <Link
                    href={`/teacher/me/exams/${r.examId}/grade`}
                    className="btn btn-outline btn-sm"
                  >
                    ✍️ صحّح
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
