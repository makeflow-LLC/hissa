"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTeacherAuth } from "@/lib/useTeacherAuth";

export default function NavbarActions() {
  const { teacher, loaded, logout } = useTeacherAuth();
  const router = useRouter();

  if (!loaded) return <span className="navbar-actions" />;

  if (!teacher) {
    return (
      <span className="navbar-actions">
        <Link href="/login" className="btn btn-outline btn-sm">
          دخول المعلّمين
        </Link>
      </span>
    );
  }

  return (
    <span className="navbar-actions">
      <Link href="/dashboard" className="btn btn-primary btn-sm">
        لوحة التحكم
      </Link>
      <button
        type="button"
        className="btn btn-outline btn-sm"
        onClick={() => {
          logout();
          router.push("/");
        }}
      >
        خروج
      </button>
    </span>
  );
}
