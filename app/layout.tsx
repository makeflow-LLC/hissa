import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import NavbarActions from "@/components/NavbarActions";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://hissa.sbs"),
  title: {
    default: "منصة حصة",
    template: "%s | منصة حصة",
  },
  description:
    "منصة حصة — مدرستك الرقمية: دروس مسجّلة وحصص مباشرة مع أفضل المعلّمين، مجانية تماماً للطالب.",
  icons: { icon: "/logo.svg", apple: "/logo.svg" },
  openGraph: {
    title: "منصة حصة",
    description: "مدرستك الرقمية: دروس مسجّلة وحصص مباشرة، مجانية تماماً للطالب.",
    url: "https://hissa.sbs",
    siteName: "منصة حصة",
    locale: "ar",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const year = new Date().getFullYear();
  return (
    <html lang="ar" dir="rtl">
      <body>
        <header className="navbar">
          <div className="navbar-inner">
            <Link href="/" className="navbar-brand">
              {/* الشعار SVG — استبدله بملفك الأصلي في public/logo.svg */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.svg" alt="" className="navbar-logo" width={40} height={40} />
              منصة حصة
            </Link>
            <span className="navbar-tagline">مدرستك الرقمية</span>
            <Suspense fallback={<span className="navbar-actions" />}>
              <NavbarActions />
            </Suspense>
          </div>
        </header>
        {children}
        <footer className="footer">
          <p className="footer-brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="" className="footer-logo" width={28} height={28} />
            منصة حصة
          </p>
          <p className="footer-text">
            دروس مسجّلة وحصص مباشرة مع أفضل المعلّمين — مجانية تماماً للطالب.
          </p>
          <nav className="footer-links">
            <Link href="/privacy" className="footer-link">
              سياسة الخصوصية
            </Link>
            <span className="footer-sep">·</span>
            <Link href="/terms" className="footer-link">
              شروط الاستخدام
            </Link>
          </nav>
          <p className="footer-copy">© {year} منصة حصة — جميع الحقوق محفوظة.</p>
        </footer>
      </body>
    </html>
  );
}
