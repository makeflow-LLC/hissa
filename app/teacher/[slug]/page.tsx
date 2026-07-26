import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTeacherBySlug, teachers } from "@/lib/teachers";
import TeacherTabs from "@/components/TeacherTabs";
import TeacherProfileHeader from "@/components/TeacherProfileHeader";

export function generateStaticParams() {
  return teachers.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const teacher = getTeacherBySlug((await params).slug);
  return {
    title: teacher ? `${teacher.name} | منصة حصة` : "منصة حصة",
  };
}

export default async function TeacherProfile({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const teacher = getTeacherBySlug((await params).slug);
  if (!teacher) notFound();

  const lessonCount = teacher.units.reduce((n, u) => n + u.lessons.length, 0);

  return (
    <main className="container">
      <nav className="breadcrumb">
        <Link href="/" className="back-link">
          → دليل المعلّمين
        </Link>
      </nav>

      <TeacherProfileHeader teacher={teacher} lessonCount={lessonCount} />

      <TeacherTabs teacher={teacher} />
    </main>
  );
}
