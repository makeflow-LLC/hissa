import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import ActivityPlayer from "@/components/ActivityPlayer";
import ConnectionNotice from "@/components/ConnectionNotice";
import { kindSpec } from "@/lib/activityKinds";
import {
  getCurrentUser,
  getActivityToPlay,
  isCurrentUserTeacher,
} from "@/lib/data/queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "نشاط تفاعلي | منصة حصة" };

export default async function PlayActivityPage({
  params,
}: {
  params: Promise<{ activityId: string }>;
}) {
  const { activityId } = await params;

  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/activity/${activityId}`);

  // المعلّم يجرّب نشاطه من صفحة تحريره حيث يعدّله
  if (await isCurrentUserTeacher()) {
    redirect(`/teacher/me/activities/${activityId}`);
  }

  let activity;
  try {
    activity = await getActivityToPlay(activityId);
  } catch {
    return <ConnectionNotice />;
  }
  if (!activity) notFound();

  const spec = kindSpec(activity.kind);

  return (
    <main className="container container-narrow">
      <PageHeader
        backHref="/dashboard"
        backLabel="لوحتي"
        emoji={spec.icon}
        title={activity.title}
        subtitle={`${spec.label} · ${activity.teacherName}`}
      />

      <ActivityPlayer activity={activity} />

      <p className="content-foot-hint">
        <Link href="/dashboard" className="back-link">
          ← رجوع إلى لوحتي
        </Link>
      </p>
    </main>
  );
}
