import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getAccountRole, getCurrentUser, getMyTeacher } from "@/lib/data/queries";
import TeacherProfileForm from "@/components/TeacherProfileForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "إعداد ملف المعلّم" };

export default async function TeacherOnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?role=teacher&next=/teacher/onboarding");

  // حساب طالب نشِط لا يفتح بروفايل معلّم على البريد نفسه — نفس قاعدة /teacher/join
  if ((await getAccountRole()) === "student") redirect("/teacher/join");

  const existing = await getMyTeacher();

  return (
    <main className="container container-narrow">
      <nav className="breadcrumb">
        <Link href={existing ? "/teacher/me" : "/"} className="back-link">
          → {existing ? "لوحة المعلّم" : "الصفحة الرئيسية"}
        </Link>
      </nav>

      <h1 className="dashboard-title">
        {existing ? "تعديل ملفك الشخصي" : "أنشئ ملفك كمعلّم"}
      </h1>
      <p className="dashboard-subtitle form-page-subtitle">
        {existing
          ? "حدّث بياناتك — تظهر التعديلات في بروفايلك العام مباشرة."
          : "املأ بياناتك لينشأ بروفايلك العام على المنصة ويظهر في دليل المعلّمين."}
      </p>

      <TeacherProfileForm initial={existing} />
    </main>
  );
}
