"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="container container-narrow">
          <p className="empty-state">جارٍ التحميل…</p>
        </main>
      }
    >
      <LoginCard />
    </Suspense>
  );
}

function LoginCard() {
  const params = useSearchParams();
  const isTeacher = params.get("role") === "teacher";
  const next = params.get("next") ?? (isTeacher ? "/teacher/onboarding" : "/dashboard");
  const urlError = params.get("error");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const callbackUrl = () =>
    `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  async function signInWithGoogle() {
    setBusy(true);
    setError("");
    const supabase = createClient();

    // skipBrowserRedirect: نبني الرابط أولاً بدل مغادرة الصفحة فوراً،
    // حتى نتحقق أن المزوّد مفعّل ولا يرى الطالب استجابة JSON خاماً
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callbackUrl(), skipBrowserRedirect: true },
    });

    if (error || !data?.url) {
      setError("تعذّر بدء الدخول بحساب جوجل. حدّث الصفحة وحاول مرّة أخرى.");
      setBusy(false);
      return;
    }

    try {
      // المزوّد المعطّل يعيد 400؛ التحويل الناجح يعيد استجابة مبهمة (status 0)
      const probe = await fetch(data.url, { redirect: "manual" });
      if (probe.status === 400) {
        setError(
          "الدخول بحساب جوجل غير مفعّل بعد على المنصة. تواصل مع الدعم — لا توجد طريقة دخول بديلة حالياً."
        );
        setBusy(false);
        return;
      }
    } catch {
      /* حجب CORS يمنع الفحص — نكمل التحويل كالمعتاد */
    }

    window.location.href = data.url;
  }

  return (
    <main className="container container-narrow">
      <div className="login-card">
        {/* الشعار الكامل بالكلمة — هنا وحده، فبقية الصفحات تحمل الأيقونة
            بجوار الاسم المكتوب فلا يتكرّر */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-full.svg" alt="منصة حصة" className="login-logo" width={132} height={148} />
        <h1 className="login-title">
          {isTeacher ? "دخول المعلّمين" : "دخول الطلاب"}
        </h1>
        <p className="login-subtitle">
          {isTeacher
            ? "بوابة واحدة للدخول والتسجيل: إن كان لك حساب ستفتح لوحتك مباشرة، وإن كنت جديداً سننشئ ملفك بعد الدخول."
            : "الوصول مجاني تماماً للطالب. سجّل الدخول لتشاهد كل الدروس، وتحمّل المرفقات، ويُحفظ تقدّمك."}
        </p>

        {/* تبديل واضح بين البوابتين — لا يضيع أحد في البوابة الخطأ */}
        <p className="login-switch">
          {isTeacher ? (
            <>
              لست معلّماً؟{" "}
              <Link href="/login" className="back-link">
                🎓 دخول الطلاب
              </Link>
            </>
          ) : (
            <>
              أنت معلّم؟{" "}
              <Link href="/login?role=teacher" className="back-link">
                👩‍🏫 دخول المعلّمين
              </Link>
            </>
          )}
        </p>

        {isTeacher && (
          <p className="login-note">
            ⚠️ حساب المعلّم وحساب الطالب منفصلان — استخدم بريداً مختلفاً لكل دور.
          </p>
        )}

        {(error || urlError) && <p className="form-error">{error || urlError}</p>}

        <button
          type="button"
          className="btn btn-google btn-block"
          onClick={signInWithGoogle}
          disabled={busy}
        >
          {busy ? "جارٍ التحويل…" : "الدخول بحساب جوجل"}
        </button>

        <p className="login-hint">
          🔒 الدخول بحساب جوجل وحده — بلا كلمات مرور تُنسى ولا روابط بريد قد
          تفتح في متصفّح آخر فتفشل.
        </p>

        <p className="login-alt">
          {isTeacher ? (
            <>
              طالب؟{" "}
              <Link href="/login" className="back-link">
                دخول الطلاب من هنا
              </Link>
            </>
          ) : (
            <>
              معلّم؟{" "}
              <Link href="/teacher/join" className="back-link">
                انضم كمعلّم من هنا
              </Link>
            </>
          )}
        </p>
      </div>
    </main>
  );
}
