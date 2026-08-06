import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import Hint from "@/components/Hint";
import ConnectionNotice from "@/components/ConnectionNotice";
import ReviewSession from "@/components/ReviewSession";
import {
  getCurrentUser,
  getDueReviews,
  getReviewQuestions,
} from "@/lib/data/queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "مراجعة اليوم | منصة حصة" };

export default async function ReviewPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard/review");

  let due;
  try {
    due = await getDueReviews();
  } catch {
    return <ConnectionNotice />;
  }

  // درسٌ واحد في كل مرّة: قائمةٌ من عشرة تُرهِب فتُؤجَّل
  const first = due[0];
  const questions = first ? await getReviewQuestions(first.lessonId) : [];

  return (
    <main className="container container-narrow">
      <PageHeader
        backHref="/dashboard"
        backLabel="لوحتي"
        emoji="🔁"
        title="مراجعة اليوم"
        subtitle={
          due.length > 0
            ? `${due.length} ${due.length === 1 ? "درس ينتظر" : "دروس تنتظر"} مراجعتك`
            : "لا مراجعات اليوم."
        }
      />

      <Hint>
        الدرس الذي أنهيته يعود إليك بعد ٣ أيام، ثم ٧، ثم ٢١، ثم ٦٠ —
        فتُستدعى المعلومة قُبيل نسيانها فيطول أثرها. وإن تعثّرت في المراجعة
        عاد الدرس غداً بدل أن يبتعد. ثلاثة أسئلة فقط في كل جلسة: دقيقةٌ
        تُعاد كل يوم خيرٌ من ربع ساعةٍ تُؤجَّل إلى الأبد.
      </Hint>

      {!first ? (
        <div className="review-empty">
          <p className="drafts-empty">
            لا شيء للمراجعة الآن. أنهِ درساً جديداً وسيعود إليك بعد ثلاثة
            أيام.
          </p>
          <Link href="/dashboard" className="btn btn-primary">
            العودة إلى لوحتي
          </Link>
        </div>
      ) : (
        <>
          <ReviewSession
            key={first.lessonId}
            lessonId={first.lessonId}
            lessonTitle={first.lessonTitle}
            teacherSlug={first.teacherSlug}
            questions={questions}
          />
          {due.length > 1 && (
            <p className="form-hint">
              وبعده {due.length - 1}{" "}
              {due.length - 1 === 1 ? "درس آخر" : "دروس أخرى"}.
            </p>
          )}
        </>
      )}
    </main>
  );
}
