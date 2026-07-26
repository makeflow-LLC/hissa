import Link from "next/link";

/**
 * لوحة تُصيَّر على الخادم عند فشل قراءة البيانات من Supabase
 * (مفاتيح ناقصة أو شبكة محجوبة أو مشروع متوقف). نعرضها بدل رمي
 * الخطأ حتى يرى المستخدم رسالة عربية واضحة في أول تحميل للصفحة.
 */
export default function ConnectionNotice({ detail }: { detail?: string }) {
  return (
    <section className="locked-panel">
      <span className="locked-icon" aria-hidden="true">
        🔌
      </span>
      <h2 className="locked-title">تعذّر الاتصال بقاعدة البيانات</h2>
      <p className="locked-text">
        لم نتمكّن من قراءة البيانات من Supabase. تأكد من وجود ملف{" "}
        <code dir="ltr">.env.local</code> في جذر المشروع ويحتوي{" "}
        <code dir="ltr">NEXT_PUBLIC_SUPABASE_URL</code> و{" "}
        <code dir="ltr">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>، وأن مشروع Supabase
        يعمل، ثم حدّث الصفحة.
      </p>
      {detail && (
        <p className="locked-hint" dir="ltr">
          {detail}
        </p>
      )}
      <Link href="/" className="btn btn-outline">
        تحديث الصفحة
      </Link>
    </section>
  );
}
