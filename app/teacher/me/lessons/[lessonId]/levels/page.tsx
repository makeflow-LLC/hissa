import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import Hint from "@/components/Hint";
import ConnectionNotice from "@/components/ConnectionNotice";
import LevelStudio from "@/components/LevelStudio";
import {
  getCurrentUser,
  getLessonLevels,
  getMyCredits,
  getMyTeacherContent,
} from "@/lib/data/queries";
import { isAiConfigured } from "@/lib/ai/openrouter";

export const dynamic = "force-dynamic";

/** إعادة كتابة درسٍ كامل تستغرق نحو نصف دقيقة — أطول من مهلة المستضيف الافتراضية */
export const maxDuration = 60;

export const metadata: Metadata = { title: "مستويات الدرس | منصة حصة" };

export default async function LevelsPage({
  params,
}: {
  params: Promise<{ lessonId: string }>;
}) {
  const { lessonId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?role=teacher&next=/teacher/me/lessons/${lessonId}/levels`);

  let content;
  let credits = 0;
  let levels;
  try {
    [content, credits, levels] = await Promise.all([
      getMyTeacherContent(),
      getMyCredits(),
      getLessonLevels(lessonId),
    ]);
  } catch {
    return <ConnectionNotice />;
  }
  if (!content) redirect("/teacher/onboarding");

  const lesson = [
    ...content.units.flatMap((u) => u.lessons),
    ...content.looseLessons,
  ].find((l) => l.id === lessonId);
  if (!lesson) notFound();

  return (
    <main className="container container-narrow">
      <PageHeader
        backHref={`/teacher/me/lessons/${lessonId}`}
        backLabel={lesson.title}
        emoji="🪜"
        title="مستويات الدرس"
        subtitle="نفس الدرس بلغةٍ أسهل أو أعمق — يختار الطالب ما يناسبه."
      />

      <Hint>
        الصفّ الواحد فيه من يقرأ ببطء ومن أتقن وبقي عنده وقت، والدرس واحد.
        هنا تولّد نسخةً <strong>مبسّطة</strong> وأخرى <strong>موسّعة</strong>،
        فيظهر للطالب مبدّلٌ فوق الشرح يختار به. والنسخة تُحفظ{" "}
        <strong>داخل الدرس</strong> لا في ملفّ: تقدّمه واختباره يبقيان على
        الدرس نفسه فلا يتشتّت.
        <br />
        والقاعدة الملزِمة في التوليد: <strong>لا تُحذف فكرة ولا تُضاف
        معلومة</strong> — التبسيط في اللغة والأمثلة لا في المحتوى، لأن
        الطالب سيُختبر في الاختبار نفسه.
      </Hint>

      {isAiConfigured() ? (
        <LevelStudio lessonId={lessonId} credits={credits} levels={levels} />
      ) : (
        <p className="drafts-empty">
          هذه الميزة تحتاج تفعيل الذكاء الاصطناعي على الخادم.
        </p>
      )}
    </main>
  );
}
