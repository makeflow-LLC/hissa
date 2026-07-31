import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import {
  getCurrentUser,
  getMyStudentProfile,
  isCurrentUserTeacher,
} from "@/lib/data/queries";
import StudentProfileForm from "@/components/StudentProfileForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "بياناتي" };

export default async function StudentProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard/profile");
  if (await isCurrentUserTeacher()) redirect("/teacher/me");

  const profile = await getMyStudentProfile();

  return (
    <main className="container container-narrow">
      <PageHeader
        backHref="/dashboard"
        backLabel="لوحتي"
        emoji="🎓"
        title="بياناتي"
      />
      <p className="dashboard-subtitle form-page-subtitle">
        تساعد معلّميك على معرفتك ومتابعة مستواك. الاسم والصف مطلوبان، وكل ما
        عداهما اختياري.
      </p>

      <StudentProfileForm initial={profile} />
    </main>
  );
}
