"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * حدود الخطأ العامة — تظهر عندما يفشل جلب البيانات من Supabase
 * (مفاتيح ناقصة، شبكة محجوبة، أو المشروع متوقف).
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="container container-narrow">
      <div className="login-card">
        <span className="save-success-icon" aria-hidden="true">
          ⚠️
        </span>
        <h1 className="login-title">تعذّر تحميل البيانات</h1>
        <p className="login-subtitle">
          لم نتمكّن من الاتصال بقاعدة البيانات. تأكد من وجود ملف{" "}
          <code dir="ltr">.env.local</code> بمفاتيح Supabase الصحيحة، وأن المشروع
          يعمل، ثم أعد المحاولة.
        </p>
        <div className="save-success-actions">
          <button type="button" className="btn btn-primary" onClick={reset}>
            إعادة المحاولة
          </button>
          <Link href="/" className="btn btn-outline">
            الصفحة الرئيسية
          </Link>
        </div>
      </div>
    </main>
  );
}
