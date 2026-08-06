import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import {
  getCurrentUser,
  getMyLessonForEdit,
  getMyTeacherContent,
} from "@/lib/data/queries";
import LessonForm from "@/components/LessonForm";
import { isAiConfigured } from "@/lib/ai/openrouter";

export const dynamic = "force-dynamic";

/**
 * أدوات الذكاء الاصطناعي تُستدعى من هذه الصفحة، ونداء النموذج يستغرق
 * ١٠–٢٠ ثانية عادةً — وأكثر مع ملفّ PDF من عدّة صفحات. والمهلة
 * الافتراضية للدالّة على Vercel أقصر من ذلك، فتُقتل العملية قبل أن يردّ
 * النموذج ويرى المعلّم عطلاً لا سبب له. المهلة هنا تشمل إجراءات
 * الخادم المستدعاة من الصفحة.
 */
export const maxDuration = 60;

export const metadata: Metadata = { title: "تعديل درس | منصة حصة" };

export default async function EditLessonPage({
  params,
}: {
  params: Promise<{ lessonId: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?role=teacher&next=/teacher/me/content");

  const { lessonId } = await params;
  const [content, initial] = await Promise.all([
    getMyTeacherContent(),
    getMyLessonForEdit(lessonId),
  ]);
  if (!content) redirect("/teacher/onboarding");
  if (!initial) notFound();

  const units = content.units.map((u) => ({ id: u.id, title: u.title }));

  return (
    <main className="container container-narrow">
      <PageHeader
        backHref="/teacher/me/content"
        backLabel="إدارة المحتوى"
        emoji="✏️"
        title="تعديل الدرس"
        actions={
          <>
            <Link
              href={`/teacher/me/lessons/${lessonId}/levels`}
              className="btn btn-outline"
            >
              🪜 المستويات
            </Link>
            <Link
              href={`/teacher/me/lessons/${lessonId}/worksheet`}
              className="btn btn-outline"
            >
              🖨️ ورقة عمل
            </Link>
            <Link
              href={`/teacher/me/lessons/${lessonId}/visuals`}
              className="btn btn-outline"
            >
              🎨 بطاقات وملصقات
            </Link>
          </>
        }
      />
      <LessonForm units={units} initial={initial} aiEnabled={isAiConfigured()} />
    </main>
  );
}
