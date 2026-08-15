import Link from "next/link";
import NotificationBell from "@/components/NotificationBell";
import {
  getCurrentUser,
  getMyTeacher,
  getStudentName,
  getTeacherNotifications,
  isAdmin,
} from "@/lib/data/queries";

/**
 * أزرار الشريط العلوي — مكوّن خادم يقرأ جلسة Supabase مباشرة،
 * فلا وميض بين حالة الزائر والمسجّل عند التحميل.
 *
 * الزائر يرى مدخلين واضحين: دخول الطلاب ودخول المعلّمين. الرابط النصي
 * «انضم كمعلّم» كان يربك المعلّم القديم لأنه يوحي بالتسجيل الجديد وحده،
 * بينما الدخول والتسجيل هنا عملية واحدة (جوجل أو رابط البريد).
 */
export default async function NavbarActions() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <span className="navbar-actions">
        <Link href="/login" className="btn btn-primary btn-sm">
          🎓 دخول الطلاب
        </Link>
        <Link href="/login?role=teacher" className="btn btn-outline btn-sm">
          👩‍🏫 دخول المعلّمين
        </Link>
      </span>
    );
  }

  // المستخدم قد يكون معلّماً (له بروفايل) أو طالباً
  const teacher = await getMyTeacher();

  /**
   * مدخل الإدارة يظهر لأهله وحدهم. وهو إخفاءٌ لا حماية — الحماية في
   * القاعدة: دوالّ الإدارة كلّها ترفض من ليس في `admins`، والصفحة نفسها
   * تعيد غير الإداريّ إلى الرئيسة.
   */
  const admin = await isAdmin();
  const adminLink = admin ? (
    <Link href="/admin" className="navbar-link">
      🛡️ الإدارة
    </Link>
  ) : null;

  if (teacher) {
    // ما ينتظر قرار المعلّم — يُقرأ هنا لأن الشريط في التخطيط الجذري،
    // فالجرس يظهر في كل صفحة لا في لوحته وحدها
    const notifs = await getTeacherNotifications();
    return (
      <span className="navbar-actions">
        <NotificationBell items={notifs} />
        <Link href="/teacher/me" className="btn btn-primary btn-sm">
          لوحة المعلّم
        </Link>
        <Link href="/teacher/me/content" className="navbar-link">
          المحتوى
        </Link>
        <Link href="/teacher/me/students" className="navbar-link">
          طلابي
        </Link>
        {adminLink}
        <span
          className="navbar-user navbar-user-teacher"
          title={user.email ?? undefined}
        >
          👩‍🏫 {teacher.name}
        </span>
        <form action="/auth/signout" method="post">
          <button type="submit" className="btn btn-outline btn-sm">
            خروج
          </button>
        </form>
      </span>
    );
  }

  const name = await getStudentName();

  return (
    <span className="navbar-actions">
      <Link href="/" className="navbar-link">
        دليل المعلّمين
      </Link>
      {adminLink}
      <Link href="/dashboard" className="btn btn-primary btn-sm">
        لوحتي
      </Link>
      <span className="navbar-user" title={user.email ?? undefined}>
        🎓 {name}
      </span>
      <form action="/auth/signout" method="post">
        <button type="submit" className="btn btn-outline btn-sm">
          خروج
        </button>
      </form>
    </span>
  );
}
