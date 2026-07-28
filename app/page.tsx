import Link from "next/link";
import TeacherDirectory from "@/components/TeacherDirectory";
import ConnectionNotice from "@/components/ConnectionNotice";
import { getCurrentUser, getTeacherCards } from "@/lib/data/queries";
import type { TeacherCard } from "@/lib/data/types";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getCurrentUser();

  let teachers: TeacherCard[] | null = null;
  let error: string | undefined;
  try {
    teachers = await getTeacherCards();
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  return (
    <main className="container">
      {/* الاسم والغرض — يطابق اسم شاشة موافقة جوجل ويشرح وظيفة التطبيق */}
      <section className="hero-header">
        <h1 className="site-title">منصة حصة</h1>
        <p className="site-subtitle">
          منصة حصة منصة تعليمية عربية تربط الطلاب بالمعلّمين: تصفّح دليل
          المعلّمين، وشاهد دروسهم المسجّلة، وتابع تقدّمك — والوصول
          مجاني تماماً للطالب.
        </p>
        <p className="site-subtitle-en" lang="en" dir="ltr">
          Hissa (منصة حصة) is an Arabic online learning platform that connects
          students with teachers to browse recorded lessons and track their progress.
        </p>
        {!user && teachers && (
          <div className="hero-cta">
            <p className="hero-cta-text">
              🎁 الوصول مجاني تماماً للطالب — سجّل الدخول لتشاهد كل الدروس وتحمّل
              المرفقات وتحفظ تقدّمك.
            </p>
            <Link href="/login" className="btn btn-primary btn-lg">
              سجّل الدخول مجاناً
            </Link>
          </div>
        )}
      </section>

      {/* كيف تعمل المنصة — لتوضيح الغرض لمراجع جوجل وللزائر */}
      <section className="about-section" aria-label="ما هي منصة حصة">
        <h2 className="about-title">كيف تعمل منصة حصة؟</h2>
        <div className="about-grid">
          <article className="about-card">
            <span className="about-icon" aria-hidden="true">
              🔎
            </span>
            <h3 className="about-card-title">تصفّح المعلّمين</h3>
            <p className="about-card-text">
              ابحث في دليل المعلّمين وفلتر حسب المرحلة والمادة، وشاهد عناوين
              الدروس ونبذة كل معلّم مجاناً.
            </p>
          </article>
          <article className="about-card">
            <span className="about-icon" aria-hidden="true">
              🔑
            </span>
            <h3 className="about-card-title">سجّل الدخول مجاناً</h3>
            <p className="about-card-text">
              أنشئ حسابك بضغطة عبر جوجل أو رابط بريدك. نستخدم دخولك فقط لإنشاء
              حسابك وحفظ تقدّمك — بلا أي رسوم.
            </p>
          </article>
          <article className="about-card">
            <span className="about-icon" aria-hidden="true">
              🎓
            </span>
            <h3 className="about-card-title">تعلّم وتابع تقدّمك</h3>
            <p className="about-card-text">
              شاهد كل الدروس المسجّلة، حمّل المرفقات، ويُحفظ تقدّمك في منهج كل
              معلّم.
            </p>
          </article>
        </div>
      </section>

      <section aria-label="دليل المعلّمين">
        <h2 className="about-title">دليل المعلّمين</h2>
        {teachers ? (
          <TeacherDirectory teachers={teachers} />
        ) : (
          <ConnectionNotice detail={error} />
        )}
      </section>

      {/* دعوة المعلّمين للانضمام */}
      <section className="teacher-cta">
        <div className="teacher-cta-inner">
          <div>
            <h2 className="teacher-cta-title">هل أنت معلّم؟</h2>
            <p className="teacher-cta-text">
              أنشئ حسابك مجاناً، افتح ملفك الشخصي، وابدأ بالوصول إلى طلابك بدروسك
              ومنهجك المنظّم في وحدات.
            </p>
          </div>
          <Link href="/teacher/join" className="btn btn-primary btn-lg">
            انضم كمعلّم
          </Link>
        </div>
      </section>
    </main>
  );
}
