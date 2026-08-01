import type { Availability } from "@/lib/data/types";

/**
 * حالات توفّر المعلّم بنصّها ولونها.
 *
 * في وحدة مستقلّة لا داخل المكوّن: تقرؤها صفحةُ خادم (بروفايل المعلّم
 * العام) ومكوّنُ عميل (زرّ الحالة) معاً.
 */
export const AVAILABILITY: Record<
  Availability,
  { label: string; icon: string; className: string }
> = {
  available: { label: "متاح للردّ", icon: "🟢", className: "avail-available" },
  busy: { label: "مشغول الآن", icon: "🟠", className: "avail-busy" },
  offline: { label: "خارج الخدمة", icon: "⚪", className: "avail-offline" },
};

export const AVAILABILITY_KEYS: Availability[] = ["available", "busy", "offline"];
