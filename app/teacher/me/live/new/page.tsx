import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser, getMyTeacher } from "@/lib/data/queries";
import LiveForm from "@/components/LiveForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "حصة مباشرة جديدة | منصة حصة" };

export default async function NewLivePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?role=teacher&next=/teacher/me/live/new");

  const teacher = await getMyTeacher();
  if (!teacher) redirect("/teacher/onboarding");

  return (
    <main className="container container-narrow">
      <nav className="breadcrumb">
        <Link href="/teacher/me/content" className="back-link">
          → إدارة المحتوى
        </Link>
      </nav>
      <h1 className="dashboard-title">🔴 حصة مباشرة جديدة</h1>
      <LiveForm initial={null} />
    </main>
  );
}
