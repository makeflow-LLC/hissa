"use client";

import { useEffect } from "react";

/** يسجّل عامل الخدمة بعد اكتمال التحميل حتى لا يزاحم أول رسم للصفحة */
export default function ServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // التسجيل ليس حرجاً — الموقع يعمل بدونه
      });
    };
    if (document.readyState === "complete") register();
    else {
      window.addEventListener("load", register);
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}
