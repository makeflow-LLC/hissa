import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser, getMyTeacher } from "@/lib/data/queries";
import TeacherProfileForm from "@/components/TeacherProfileForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "إعداد ملف المعلّم" };

export default async function TeacherOnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?role=teacher&next=/teacher/onboarding");

  const existing = await getMyTeacher();

  return (
    <main className="container container-narrow">
      <nav className="breadcrumb">
        <Link href="/" className="back-link">
          → الصفحة الرئيسية
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
