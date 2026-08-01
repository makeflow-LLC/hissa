/**
 * صياغة نافذة الاختبار الزمنية بالعربية.
 *
 * الدوال هنا **عرضٌ فقط**؛ فتح الاختبار وإغلاقه يُفحصان على الخادم
 * (`windowState` في `app/actions/exams.ts`). ما يُعرض هنا مجرّد تسهيل
 * للقارئ، وتغييره في المتصفّح لا يفتح اختباراً مغلقاً.
 */

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("ar-EG", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });

export function formatWindow(
  opens: string | null,
  closes: string | null
): string {
  if (!opens && !closes) return "مفتوح بلا وقت محدّد";
  if (opens && closes) return `من ${fmt(opens)} إلى ${fmt(closes)}`;
  if (opens) return `يفتح ${fmt(opens)}`;
  return `يغلق ${fmt(closes as string)}`;
}

export type ExamWindowState = "before" | "open" | "closed";

export function examWindowState(
  opens: string | null,
  closes: string | null,
  now: number = Date.now()
): ExamWindowState {
  if (opens && now < new Date(opens).getTime()) return "before";
  if (closes && now > new Date(closes).getTime()) return "closed";
  return "open";
}

/** الوقت المتبقّي لمحاولة بدأت، بحسب مدّة الاختبار ووقت إغلاقه */
export function deadlineFor(
  startedAt: string,
  durationMinutes: number | null,
  closesAt: string | null
): number | null {
  const ends: number[] = [];
  if (durationMinutes)
    ends.push(new Date(startedAt).getTime() + durationMinutes * 60_000);
  if (closesAt) ends.push(new Date(closesAt).getTime());
  return ends.length ? Math.min(...ends) : null;
}
