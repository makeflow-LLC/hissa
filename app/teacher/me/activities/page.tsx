import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import Hint from "@/components/Hint";
import ConnectionNotice from "@/components/ConnectionNotice";
import ActivityRowActions from "@/components/ActivityRowActions";
import { kindSpec } from "@/lib/activityKinds";
import {
  getCurrentUser,
  getMyTeacher,
  getMyActivities,
} from "@/lib/data/queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "الأنشطة التفاعلية | منصة حصة" };

export default async function ActivitiesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?role=teacher&next=/teacher/me/activities");

  const teacher = await getMyTeacher();
  if (!teacher) redirect("/teacher/onboarding");

  let activities;
  try {
    activities = await getMyActivities();
  } catch {
    return <ConnectionNotice />;
  }

  return (
    <main className="container">
      <PageHeader
        backHref="/teacher/me"
        backLabel="لوحة المعلّم"
        emoji="🎮"
        title="الأنشطة التفاعلية"
        subtitle="ألعاب قصيرة يتدرّب بها طلابك — محتوى واحد يُلعب بستّ طرق."
        actions={
          <Link href="/teacher/me/activities/new" className="btn btn-primary">
            ➕ نشاط جديد
          </Link>
        }
      />

      <Hint>
        تكتب الأزواج مرّةً — كلمة ومعناها، سؤالاً وجوابه، عنصراً وفئته — ثم
        تختار كيف تُلعب: مطابقةً، أو بطاقات، أو اختياراً سريعاً، أو ترتيب
        حروف، أو تصنيفاً، أو عجلة. تبديل اللعبة لا يُعيد إدخال المحتوى.
        والنشاط تدريبٌ لا امتحان، فنتيجته تشجيع ولا تدخل في العلامات الرسمية.
      </Hint>

      {activities.length === 0 ? (
        <p className="drafts-empty">
          لا أنشطة بعد. أنشئ أوّل نشاط وجرّبه بنفسك قبل نشره لطلابك.
        </p>
      ) : (
        <ul className="exam-list">
          {activities.map((a) => {
            const spec = kindSpec(a.kind);
            return (
              <li key={a.id} className="exam-card">
                <div className="exam-card-main">
                  <h2 className="exam-card-title">
                    <Link href={`/teacher/me/activities/${a.id}`}>
                      {spec.icon} {a.title}
                    </Link>
                  </h2>
                  <p className="exam-card-meta">
                    {spec.label} · {a.items.length} عنصراً · 👥 {a.audience}
                  </p>
                  <p className="exam-card-meta">
                    {a.playCount > 0
                      ? `🎯 ${a.playCount} لعبة من ${a.playerCount} طالباً`
                      : "لم يلعبه أحد بعد"}
                  </p>
                </div>

                <div className="exam-card-side">
                  {a.status === "published" ? (
                    <span className="pill pill-live">منشور</span>
                  ) : (
                    <span className="pill pill-draft">مسودّة</span>
                  )}
                  <div className="card-actions">
                    <Link
                      href={`/teacher/me/activities/${a.id}`}
                      className="btn btn-outline btn-sm"
                    >
                      ✏️ تعديل
                    </Link>
                    <ActivityRowActions activityId={a.id} title={a.title} />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
