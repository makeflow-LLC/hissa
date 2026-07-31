"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface NavItem {
  href: string;
  label: string;
  icon: string;
  /** يُعدّ نشطاً أيضاً حين يكون المسار الحالي فرعاً منه */
  match?: string;
}

/**
 * شريط تنقّل سفلي — ثابت أسفل الشاشة على الجوال.
 *
 * كان الرجوع رابطاً نصّياً صغيراً أعلى الصفحة يختفي بمجرّد التمرير، فيجد
 * الطالب نفسه في عمق الدرس بلا مخرج إلا زر المتصفّح. الشريط السفلي يبقى
 * ظاهراً دائماً وفي متناول الإبهام — وهو المعيار في تطبيقات الجوال.
 *
 * يظهر على الجوال فقط: على الحاسوب الشريط العلوي كافٍ ومرئي دائماً.
 */
export default function BottomNavBar({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  if (items.length === 0) return null;

  return (
    <nav className="bottom-nav" aria-label="التنقّل السريع">
      {items.map((it) => {
        const base = it.match ?? it.href;
        const active =
          pathname === it.href ||
          (base !== "/" && pathname.startsWith(base));
        return (
          <Link
            key={it.href}
            href={it.href}
            className={`bottom-nav-item ${active ? "bottom-nav-active" : ""}`}
            aria-current={active ? "page" : undefined}
          >
            <span className="bottom-nav-icon" aria-hidden="true">
              {it.icon}
            </span>
            <span className="bottom-nav-label">{it.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
