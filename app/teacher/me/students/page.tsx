import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import {
  getCardRequests,
  getCurrentUser,
  getJoinRequests,
  getMyGroups,
  getMyStudents,
  getMyTeacher,
  getMyThreads,
} from "@/lib/data/queries";
import BroadcastForm from "@/components/BroadcastForm";
import JoinRequestsPanel from "@/components/JoinRequestsPanel";
import GroupsManager from "@/components/GroupsManager";
import CardRequestsPanel from "@/components/CardRequestsPanel";
import Hint from "@/components/Hint";
import ConnectionNotice from "@/components/ConnectionNotice";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "طلابي" };

/**
 * قائمة الطلاب: صفٌّ لكل طالب يفتح ملفّه الكامل.
 *
 * كانت كل بطاقة تحمل نماذج بطاقة التقييم والمنح والمراسلة ومجموعاته دفعةً
 * واحدة، فصارت الصفحة جداراً من الحقول يصعب مسحه بالعين. التفصيل انتقل إلى
 * `/teacher/me/students/[studentId]`، وبقيت هنا القائمة وما يخصّ الصفّ كلّه.
 */
export default async function TeacherStudentsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?role=teacher&next=/teacher/me/students");

  const teacher = await getMyTeacher();
  if (!teacher) redirect("/teacher/onboarding");

  let students: Awaited<ReturnType<typeof getMyStudents>> = [];
  let threads: Awaited<ReturnType<typeof getMyThreads>> = [];
  let requests: Awaited<ReturnType<typeof getJoinRequests>> = [];
  let groups: Awaited<ReturnType<typeof getMyGroups>> = [];
  let cardRequests: Awaited<ReturnType<typeof getCardRequests>> = [];
  let loadError: string | undefined;
  try {
    [students, threads, requests, groups, cardRequests] = await Promise.all([
      getMyStudents(),
      getMyThreads(),
      getJoinRequests(),
      getMyGroups(),
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

  /** من تنتظر رسالتُه ردّاً — يُرفع إلى أعلى القائمة */
  const awaiting = new Set(
    threads.filter((t) => t.unansweredCount > 0).map((t) => t.studentId)
  );
  const ordered = [...students].sort(
    (a, b) => Number(awaiting.has(b.profile.id)) - Number(awaiting.has(a.profile.id))
  );

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
        subtitle="اضغط اسم أي طالب لتفتح ملفّه: تقدّمه ونتائجه ومحادثتكما وبطاقات تقييمه."
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
          <span className="stat-value">{awaiting.size}</span>
          <span className="stat-label">ينتظر ردّك</span>
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
            أصدر البطاقة من ملفّ الطالب، ويُغلق الطلب تلقائياً.
          </Hint>
          <CardRequestsPanel requests={cardRequests} />
        </section>
      )}

      <section className="dashboard-section">
        <h2 className="section-title">🗂️ المجموعات</h2>
        <Hint>
          المجموعة صفٌّ له لوحته: تعميم يصل أعضاءه وحدهم، واختبار يخصّه، ورابط
          واتساب، ومنح دروسك الخاصة دفعةً واحدة. الطالب قد يكون في أكثر من مجموعة.
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
              إعلان واحد يصل كل طلاب صفّك دفعةً واحدة. لرسالة تخصّ طالباً واحداً
              افتح ملفّه، ولمجموعة بعينها افتح لوحتها.
            </Hint>
            <BroadcastForm />
          </section>

          <section className="dashboard-section">
            <h2 className="section-title">قائمة الطلاب</h2>
            <ul className="student-rows">
              {ordered.map((s) => (
                <li key={s.profile.id}>
                  <Link
                    href={`/teacher/me/students/${s.profile.id}`}
                    className="student-row"
                  >
                    {s.profile.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.profile.avatar_url} alt="" className="student-avatar" />
                    ) : (
                      <span className="student-avatar student-avatar-fallback">🎓</span>
                    )}
                    <span className="student-row-body">
                      <span className="student-name">{s.profile.full_name}</span>
                      <span className="student-meta">
                        {s.profile.grade || "الصف غير محدّد"}
                        {s.profile.school && <> · {s.profile.school}</>}
                      </span>
                      <span className="student-row-bar" aria-hidden="true">
                        <span style={{ width: `${s.progressPct}%` }} />
                      </span>
                    </span>
                    <span className="student-row-side">
                      {awaiting.has(s.profile.id) && (
                        <span className="pill pill-low">✉️ ينتظر ردّك</span>
                      )}
                      <span className="group-meta">
                        {s.completedLessons} من {s.totalLessons} درساً
                      </span>
                      <span className="follow-head-go" aria-hidden="true">
                        ‹
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </main>
  );
}
