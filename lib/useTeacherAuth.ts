"use client";

import { useCallback, useEffect, useState } from "react";
import { getTeacherBySlug, type Teacher } from "@/lib/teachers";

const SESSION_KEY = "hissa-teacher-session";
const AUTH_EVENT = "hissa-auth-change";

/** كلمة المرور الموحدة لكل الحسابات التجريبية — لا يوجد باكند بعد */
export const DEMO_PASSWORD = "123456";

function readSession(): Teacher | null {
  try {
    const slug = localStorage.getItem(SESSION_KEY);
    return slug ? getTeacherBySlug(slug) ?? null : null;
  } catch {
    return null;
  }
}

/**
 * جلسة معلم تجريبية في localStorage.
 * `loaded` تصبح true بعد قراءة الجلسة على العميل (لتجنب اختلاف الـ hydration).
 * تتزامن كل النسخ (الشريط العلوي والصفحات) عبر حدث `hissa-auth-change`
 * لأن الـ layout لا يُعاد تركيبه أثناء التنقل بين الصفحات.
 */
export function useTeacherAuth() {
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const sync = () => setTeacher(readSession());
    sync();
    setLoaded(true);
    window.addEventListener(AUTH_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(AUTH_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const login = useCallback((slug: string, password: string): boolean => {
    if (password !== DEMO_PASSWORD || !getTeacherBySlug(slug)) return false;
    try {
      localStorage.setItem(SESSION_KEY, slug);
    } catch {
      /* التخزين غير متاح — تبقى الجلسة في الذاكرة فقط */
    }
    setTeacher(getTeacherBySlug(slug) ?? null);
    window.dispatchEvent(new Event(AUTH_EVENT));
    return true;
  }, []);

  const logout = useCallback(() => {
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch {
      /* لا شيء */
    }
    setTeacher(null);
    window.dispatchEvent(new Event(AUTH_EVENT));
  }, []);

  return { teacher, loaded, login, logout };
}
