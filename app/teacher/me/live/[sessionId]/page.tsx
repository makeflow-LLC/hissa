import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser, getMyLive } from "@/lib/data/queries";
import LiveForm, { type LiveFormInitial } from "@/components/LiveForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "تعديل حصة | منصة حصة" };

export default async function EditLivePage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?role=teacher&next=/teacher/me/content");

  const { sessionId } = await params;
  const row = await getMyLive(sessionId);
  if (!row) notFound();

  const initial: LiveFormInitial = {
    id: String(row.id),
    title: String(row.title ?? ""),
    description: String(row.description ?? ""),
    schedule: String(row.schedule ?? ""),
    duration: String(row.duration ?? ""),
    seats_left: Number(row.seats_left ?? 0),
    emoji: String(row.emoji ?? "🔴"),
    status: String(row.status ?? "published"),
    is_paid: Boolean(row.is_paid),
    price: Number(row.price ?? 0),
    currency: String(row.currency ?? "EGP"),
  };

  return (
    <main className="container container-narrow">
      <nav className="breadcrumb">
        <Link href="/teacher/me/content" className="back-link">
          → إدارة المحتوى
        </Link>
      </nav>
      <h1 className="dashboard-title">✏️ تعديل الحصة</h1>
      <LiveForm initial={initial} />
    </main>
  );
}
