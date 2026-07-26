import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import NavbarActions from "@/components/NavbarActions";
import "./globals.css";

export const metadata: Metadata = {
  title: "منصة حصة",
  description: "منصة حصة — مدرستك الرقمية: دروس مسجّلة وحصص مباشرة مع أفضل المعلّمين",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <body>
        <header className="navbar">
          <div className="navbar-inner">
            <Link href="/" className="navbar-brand">
              <span className="navbar-logo" aria-hidden="true">
                🎓
              </span>
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
          <p className="footer-brand">🎓 منصة حصة</p>
          <p className="footer-text">
            دروس مسجّلة وحصص مباشرة مع أفضل المعلّمين — مجانية تماماً للطالب.
          </p>
        </footer>
      </body>
    </html>
  );
}
