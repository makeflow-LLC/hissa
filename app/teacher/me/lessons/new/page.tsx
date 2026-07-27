import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser, getMyTeacherContent } from "@/lib/data/queries";
import LessonForm from "@/components/LessonForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "درس جديد | منصة حصة" };

export default async function NewLessonPage({
  searchParams,
}: {
  searchParams: Promise<{ unit?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?role=teacher&next=/teacher/me/lessons/new");

  const content = await getMyTeacherContent();
  if (!content) redirect("/teacher/onboarding");

  const { unit } = await searchParams;
  const units = content.units.map((u) => ({ id: u.id, title: u.title }));

  const initial = unit
    ? {
        id: "",
        unit_id: unit,
        title: "",
        description: "",
        duration: "",
        emoji: "📚",
        video_url: null,
        status: "published",
        is_free_preview: false,
        is_restricted: false,
        sections: [],
        quiz: [],
      }
    : null;

  return (
    <main className="container container-narrow">
      <nav className="breadcrumb">
        <Link href="/teacher/me/content" className="back-link">
          → إدارة المحتوى
        </Link>
      </nav>
      <h1 className="dashboard-title">➕ درس جديد</h1>
      <LessonForm units={units} initial={initial} />
    </main>
  );
}
