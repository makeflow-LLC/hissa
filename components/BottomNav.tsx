import { getCurrentUser, getMyTeacher } from "@/lib/data/queries";
import BottomNavBar, { type NavItem } from "@/components/BottomNavBar";

/**
 * يختار عناصر الشريط السفلي حسب دور صاحب الجلسة.
 *
 * مكوّن خادم يقرأ الجلسة مباشرة كـ `NavbarActions`، فلا وميض بين حالة
 * الزائر والمسجّل. ثلاثة إلى أربعة عناصر كحدّ أقصى: الشريط الذي يزيد
 * يصير قائمة لا اختصاراً.
 */
export default async function BottomNav() {
  const user = await getCurrentUser();

  if (!user) {
    const items: NavItem[] = [
      { href: "/", label: "المعلّمون", icon: "🔎" },
      { href: "/login", label: "دخول الطلاب", icon: "🎓" },
      { href: "/login?role=teacher", label: "دخول المعلّمين", icon: "👩‍🏫" },
    ];
    return <BottomNavBar items={items} />;
  }

  const teacher = await getMyTeacher();

  if (teacher) {
    const items: NavItem[] = [
      { href: "/teacher/me", label: "لوحتي", icon: "🏠" },
      { href: "/teacher/me/content", label: "المحتوى", icon: "🎬" },
      { href: "/teacher/me/students", label: "طلابي", icon: "👥" },
      // معاينة الصفحة العامة تُفتح من اللوحة؛ الاختبارات وجهة يومية أولى بالشريط
      { href: "/teacher/me/exams", label: "الاختبارات", icon: "📝" },
    ];
    return <BottomNavBar items={items} />;
  }

  const items: NavItem[] = [
    { href: "/", label: "المعلّمون", icon: "🔎" },
    { href: "/dashboard", label: "لوحتي", icon: "🏠" },
    { href: "/dashboard/profile", label: "بياناتي", icon: "👤" },
  ];
  return <BottomNavBar items={items} />;
}
