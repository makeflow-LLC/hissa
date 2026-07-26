"use client";

/**
 * شبكة أمان أخيرة: تُستخدم عندما يفشل التخطيط الجذري نفسه،
 * وهي الحالة الوحيدة التي لا يستطيع app/error.tsx التعامل معها.
 */
export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="ar" dir="rtl">
      <body
        style={{
          fontFamily: '"Segoe UI", Tahoma, Arial, sans-serif',
          display: "grid",
          placeItems: "center",
          minHeight: "100vh",
          margin: 0,
          background: "#f8fafc",
          color: "#1e293b",
          textAlign: "center",
          padding: "1.5rem",
        }}
      >
        <div style={{ maxWidth: "28rem" }}>
          <p style={{ fontSize: "3rem", margin: 0 }}>⚠️</p>
          <h1 style={{ fontSize: "1.4rem", fontWeight: 800 }}>حدث خطأ غير متوقع</h1>
          <p style={{ color: "#64748b", lineHeight: 1.7 }}>
            تعذّر تحميل الصفحة. تأكد من إعداد مفاتيح Supabase في ملف{" "}
            <code dir="ltr">.env.local</code> ثم أعد المحاولة.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              font: "inherit",
              fontWeight: 700,
              background: "#4f46e5",
              color: "#fff",
              border: "none",
              borderRadius: 10,
              padding: "0.65rem 1.5rem",
              cursor: "pointer",
            }}
          >
            إعادة المحاولة
          </button>
        </div>
      </body>
    </html>
  );
}
