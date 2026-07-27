import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser, getMyTeacher } from "@/lib/data/queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "انضم كمعلّم",
  description:
    "أنشئ حسابك كمعلّم على منصة حصة وافتح ملفك الشخصي: صورتك، مؤهلك، الصفوف التي تدرّسها، وسنوات خبرتك — وابدأ بنشر دروسك وحصصك.",
};

export default async function TeacherJoinPage() {
  const user = await getCurrentUser();
  // معلّم مسجّل بالفعل ⇒ لوحته؛ مستخدم بلا بروفايل معلّم ⇒ إنشاء البروفايل
  if (user) {
    const teacher = await getMyTeacher();
    redirect(teacher ? "/teacher/me" : "/teacher/onboarding");
  }

  return (
    <main className="container container-narrow">
      <section className="join-hero">
        <span className="join-emoji" aria-hidden="true">
          👩‍🏫
        </span>
        <h1 className="join-title">علّم على منصة حصة</h1>
        <p className="join-subtitle">
          أنشئ حسابك كمعلّم مجاناً، وافتح ملفك الشخصي، وابدأ بالوصول إلى طلابك
          بدروس مسجّلة وحصص مباشرة — أنت من يحدّد أسعار حصصك.
        </p>
        <Link href="/login?role=teacher" className="btn btn-primary btn-lg">
          أنشئ حساب معلّم مجاناً
        </Link>
        <p className="join-login-note">
          لديك حساب معلّم بالفعل؟{" "}
          <Link href="/login?role=teacher&next=/teacher/me" className="back-link">
            سجّل الدخول
          </Link>
        </p>
      </section>

      <section className="join-features">
        <article className="about-card">
          <span className="about-icon" aria-hidden="true">
            📇
          </span>
          <h3 className="about-card-title">ملف شخصي احترافي</h3>
          <p className="about-card-text">
            صورتك، مؤهلك العلمي، الصفوف التي تدرّسها، وسنوات خبرتك — كل ذلك في
            بروفايل أنيق يراه الطلاب.
          </p>
        </article>
        <article className="about-card">
          <span className="about-icon" aria-hidden="true">
            🎬
          </span>
          <h3 className="about-card-title">دروس وحصص</h3>
          <p className="about-card-text">
            انشر دروساً مسجّلة منظّمة في وحدات، وأنشئ حصصاً مباشرة يحجزها طلابك.
          </p>
        </article>
        <article className="about-card">
          <span className="about-icon" aria-hidden="true">
            🔗
          </span>
          <h3 className="about-card-title">رابط و QR للمشاركة</h3>
          <p className="about-card-text">
            لكل معلّم رابط خاص ورمز QR لمشاركة بروفايله مع طلابه بسهولة.
          </p>
        </article>
      </section>
    </main>
  );
}
