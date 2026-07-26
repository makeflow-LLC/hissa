"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { teachers } from "@/lib/teachers";
import { useTeacherAuth, DEMO_PASSWORD } from "@/lib/useTeacherAuth";

export default function LoginPage() {
  const { teacher, loaded, login } = useTeacherAuth();
  const router = useRouter();
  const [slug, setSlug] = useState(teachers[0].slug);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (loaded && teacher) router.replace("/teacher-dashboard");
  }, [loaded, teacher, router]);

  const selected = teachers.find((t) => t.slug === slug) ?? teachers[0];

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (login(slug, password)) {
      router.push("/teacher-dashboard");
    } else {
      setError("كلمة المرور غير صحيحة — جرّب كلمة المرور التجريبية الموضحة بالأسفل.");
    }
  }

  return (
    <main className="container container-narrow">
      <div className="login-card">
        <div className="login-avatar" style={{ background: selected.gradient }}>
          {selected.initials}
        </div>
        <h1 className="login-title">دخول المعلّمين</h1>
        <p className="login-subtitle">
          ادخل إلى لوحة التحكم لمتابعة طلابك وتصميم حصصك الجديدة
        </p>

        <form onSubmit={handleSubmit} className="login-form">
          <label className="form-field">
            <span className="form-label">اختر حسابك</span>
            <select
              className="filter-select"
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value);
                setError("");
              }}
            >
              {teachers.map((t) => (
                <option key={t.slug} value={t.slug}>
                  {t.name} — {t.subject} ({t.stage})
                </option>
              ))}
            </select>
          </label>

          <label className="form-field">
            <span className="form-label">كلمة المرور</span>
            <input
              type="password"
              className="search-input"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError("");
              }}
              placeholder="••••••"
              autoComplete="current-password"
              required
            />
          </label>

          {error && <p className="form-error">{error}</p>}

          <button type="submit" className="btn btn-primary btn-block">
            تسجيل الدخول
          </button>
        </form>

        <p className="login-hint">
          🔑 نسخة تجريبية بدون باكند — كلمة المرور لأي حساب:{" "}
          <code dir="ltr">{DEMO_PASSWORD}</code>
        </p>
      </div>
    </main>
  );
}
