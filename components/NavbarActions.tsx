import Link from "next/link";
import { getCurrentUser, getStudentName } from "@/lib/data/queries";

/**
 * أزرار الشريط العلوي — مكوّن خادم يقرأ جلسة Supabase مباشرة،
 * فلا وميض بين حالة الزائر والطالب عند التحميل.
 */
export default async function NavbarActions() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <span className="navbar-actions">
        <Link href="/login" className="btn btn-primary btn-sm">
          دخول الطلاب
        </Link>
        <Link href="/teacher-login" className="navbar-link">
          للمعلّمين
        </Link>
      </span>
    );
  }

  const name = await getStudentName();

  return (
    <span className="navbar-actions">
      <Link href="/dashboard" className="btn btn-primary btn-sm">
        لوحتي
      </Link>
      <span className="navbar-user" title={user.email ?? undefined}>
        {name}
      </span>
      <form action="/auth/signout" method="post">
        <button type="submit" className="btn btn-outline btn-sm">
          خروج
        </button>
      </form>
    </span>
  );
}
