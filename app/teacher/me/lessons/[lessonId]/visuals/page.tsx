import { redirect } from "next/navigation";
import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import Hint from "@/components/Hint";
import ConnectionNotice from "@/components/ConnectionNotice";
import PosterStudio from "@/components/PosterStudio";
import {
  getCurrentUser,
  getMyCredits,
  getMyTeacherContent,
  getLessonPosters,
} from "@/lib/data/queries";
import { isAiConfigured } from "@/lib/ai/openrouter";

export const dynamic = "force-dynamic";

/**
 * توليد الصورة أبطأ من النصّ بكثير — يقارب الدقيقة. ومهلة الدالّة
 * الافتراضية على المستضيف أقصر، فتُقتل العملية قبل أن تعود الصورة ولا
 * تستطيع أي معالجةٍ داخل التطبيق أن تشرح ما جرى.
 */
export const maxDuration = 120;

export const metadata: Metadata = { title: "بطاقات وملصقات الدرس | منصة حصة" };

export default async function LessonVisualsPage({
  params,
}: {
  params: Promise<{ lessonId: string }>;
}) {
  const { lessonId } = await params;

  const user = await getCurrentUser();
  if (!user)
    redirect(`/login?role=teacher&next=/teacher/me/lessons/${lessonId}/visuals`);

  let content;
  let credits = 0;
  let posters;
  try {
    [content, credits, posters] = await Promise.all([
      getMyTeacherContent(),
      getMyCredits(),
      getLessonPosters(lessonId),
    ]);
  } catch {
    return <ConnectionNotice />;
  }
  if (!content) redirect("/teacher/onboarding");

  // الدروس مجمَّعةٌ تحت وحداتها في `TeacherContent`، فنبحث عبرها كلّها
  const lesson = content.units
    .flatMap((u) => u.lessons)
    .find((l) => l.id === lessonId);
  if (!lesson) redirect("/teacher/me/content");

  return (
    <main className="container">
      <PageHeader
        backHref={`/teacher/me/lessons/${lessonId}`}
        backLabel={lesson.title}
        emoji="🎨"
        title="وسائل الدرس"
        subtitle="بطاقاتٌ وملصقاتٌ ومخطّطاتٌ من درسك — تُطبع وتُعلَّق."
      />

      <Hint>
        درسٌ واحد يحتمل عدّة مواد مرئية: ملصقاً عن الأجزاء، وبطاقةً عن
        المصطلحات، ومخطّطاً عن الخطوات. فالمنصّة تقرأ درسك أولاً وتعرض عليك
        ما يصلح — <strong>بلا ثمن</strong> — ثم ترسم ما تختاره وحده. اسمك
        يُكتب أسفل كل تصميم.
      </Hint>

      {isAiConfigured() ? (
        <>
          <section className="dashboard-section">
            <h2 className="section-title">🖼️ بطاقات وملصقات ومخطّطات</h2>
            <PosterStudio
              lessonId={lessonId}
              lessonTitle={lesson.title}
              credits={credits}
              posters={posters}
            />
          </section>
        </>
      ) : (
        <p className="drafts-empty">
          هذه الميزة تحتاج تفعيل الذكاء الاصطناعي على الخادم.
        </p>
      )}
    </main>
  );
}
