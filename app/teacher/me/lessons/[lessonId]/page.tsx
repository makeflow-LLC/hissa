import Link from "next/link";
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
      <nav className="breadcrumb">
        <Link href="/teacher/me/content" className="back-link">
          → إدارة المحتوى
        </Link>
      </nav>
      <h1 className="dashboard-title">✏️ تعديل الدرس</h1>
      <LessonForm units={units} initial={initial} aiEnabled={isAiConfigured()} />
    </main>
  );
}
