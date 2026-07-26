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
      <section className="hero-header">
        <h1 className="site-title">منصة حصة</h1>
        <p className="site-subtitle">
          اكتشف أفضل المعلّمين واحجز حصصك بسهولة في كل المواد والمراحل
        </p>
        {!user && teachers && (
          <div className="hero-cta">
            <p className="hero-cta-text">
              🎁 الوصول مجاني تماماً للطالب — سجّل الدخول لتشاهد كل الدروس وتحمّل
              المرفقات وتسجّل في الحصص.
            </p>
            <Link href="/login" className="btn btn-primary btn-lg">
              سجّل الدخول مجاناً
            </Link>
          </div>
        )}
      </section>

      {teachers ? (
        <TeacherDirectory teachers={teachers} />
      ) : (
        <ConnectionNotice detail={error} />
      )}
    </main>
  );
}
