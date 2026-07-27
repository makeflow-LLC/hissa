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

  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState<"google" | "email" | null>(null);
  const [error, setError] = useState("");

  const callbackUrl = () =>
    `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  async function signInWithGoogle() {
    setBusy("google");
    setError("");
    const supabase = createClient();

    // skipBrowserRedirect: نبني الرابط أولاً بدل مغادرة الصفحة فوراً،
    // حتى نتحقق أن المزوّد مفعّل ولا يرى الطالب استجابة JSON خاماً
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callbackUrl(), skipBrowserRedirect: true },
    });

    if (error || !data?.url) {
      setError("تعذّر بدء الدخول بجوجل. جرّب الرابط السحري بالبريد بالأسفل.");
      setBusy(null);
      return;
    }

    try {
      // المزوّد المعطّل يعيد 400؛ التحويل الناجح يعيد استجابة مبهمة (status 0)
      const probe = await fetch(data.url, { redirect: "manual" });
      if (probe.status === 400) {
        setError(
          "الدخول بجوجل غير مفعّل في المنصة بعد. استخدم الرابط السحري بالبريد بالأسفل — يعمل فوراً."
        );
        setBusy(null);
        return;
      }
    } catch {
      /* حجب CORS يمنع الفحص — نكمل التحويل كالمعتاد */
    }

    window.location.href = data.url;
  }

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setBusy("email");
    setError("");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: callbackUrl() },
    });
    setBusy(null);
    if (error) {
      setError("تعذّر إرسال الرابط — تأكد من صحة البريد وحاول مرة أخرى.");
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <main className="container container-narrow">
        <div className="login-card">
          <span className="save-success-icon" aria-hidden="true">
            📬
          </span>
          <h1 className="login-title">تحقّق من بريدك</h1>
          <p className="login-subtitle">
            أرسلنا رابط دخول إلى <strong dir="ltr">{email}</strong>. لا تحتاج كلمة
            مرور — فقط اضغط الرابط.
          </p>
          <p className="login-note">
            📱 <strong>مهم:</strong> افتح الرابط من <strong>نفس المتصفح</strong> الذي
            طلبته منه. إن فتحه تطبيق البريد في نافذته الخاصة ولم ينجح الدخول، انسخ
            الرابط والصقه في متصفحك.
          </p>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => setSent(false)}
          >
            إرسال لبريد آخر
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="container container-narrow">
      <div className="login-card">
        <span className="login-emoji" aria-hidden="true">
          {isTeacher ? "👩‍🏫" : "🎓"}
        </span>
        <h1 className="login-title">
          {isTeacher ? "دخول المعلّمين" : "دخول الطلاب"}
        </h1>
        <p className="login-subtitle">
          {isTeacher
            ? "بوابة واحدة للدخول والتسجيل: إن كان لك حساب ستفتح لوحتك مباشرة، وإن كنت جديداً سننشئ ملفك بعد الدخول."
            : "الوصول مجاني تماماً للطالب. سجّل الدخول لتشاهد كل الدروس، وتحمّل المرفقات، وتسجّل في الحصص، ويُحفظ تقدّمك."}
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
          disabled={busy !== null}
        >
          {busy === "google" ? "جارٍ التحويل…" : "الدخول بحساب جوجل"}
        </button>

        <div className="login-divider">
          <span>أو</span>
        </div>

        <form onSubmit={sendMagicLink} className="login-form">
          <label className="form-field">
            <span className="form-label">البريد الإلكتروني</span>
            <input
              type="email"
              dir="ltr"
              className="search-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </label>
          <button
            type="submit"
            className="btn btn-primary btn-block"
            disabled={busy !== null}
          >
            {busy === "email" ? "جارٍ الإرسال…" : "أرسل لي رابط دخول"}
          </button>
        </form>

        <p className="login-hint">
          🔒 بلا كلمات مرور: نرسل لك رابطاً سحرياً بالبريد. الدخول بالجوال
          (رسالة تحقّق) سيُضاف عند توفّر مزوّد رسائل.
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
