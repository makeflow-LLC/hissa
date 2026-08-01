import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";

export const revalidate = 3600;

const BASE = "https://hissa.sbs";

/**
 * خريطة موقع ديناميكية: الصفحات الثابتة + كل معلّم منشور + دروسه
 * المنشورة. عناوين الدروس ووصفها عامة للزائر (بوابة الزائر تحجب
 * المحتوى لا العنوان)، وهي بالضبط ما يستحق الفهرسة.
 *
 * تفشل «مغلقة»: إن تعذّر الاتصال نعيد الصفحات الثابتة بدل رمي خطأ،
 * فلا يفقد الموقع خريطته كلها بسبب عطل مؤقت.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE, changeFrequency: "daily", priority: 1 },
    { url: `${BASE}/teacher/join`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE}/help`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${BASE}/terms`, changeFrequency: "yearly", priority: 0.2 },
  ];

  try {
    const supabase = await createClient();
    const { data: teachers } = await supabase
      .from("teachers")
      .select("id, slug, created_at")
      .eq("is_published", true);

    const rows = (teachers ?? []) as {
      id: string;
      slug: string;
      created_at: string;
    }[];
    if (rows.length === 0) return staticPages;

    const { data: lessons } = await supabase
      .from("lessons")
      .select("id, teacher_id, created_at")
      .eq("status", "published")
      .eq("is_restricted", false);

    const slugById = new Map(rows.map((t) => [t.id, t.slug]));

    return [
      ...staticPages,
      ...rows.map((t) => ({
        url: `${BASE}/teacher/${t.slug}`,
        lastModified: new Date(t.created_at),
        changeFrequency: "weekly" as const,
        priority: 0.9,
      })),
      ...((lessons ?? []) as { id: string; teacher_id: string; created_at: string }[])
        .filter((l) => slugById.has(l.teacher_id))
        .map((l) => ({
          url: `${BASE}/teacher/${slugById.get(l.teacher_id)}/lesson/${l.id}`,
          lastModified: new Date(l.created_at),
          changeFrequency: "monthly" as const,
          priority: 0.7,
        })),
    ];
  } catch {
    return staticPages;
  }
}
