"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "hissa-install-dismissed";

/**
 * شريط «ثبّت التطبيق» — معظم المستخدمين يفتحون المنصة من الجوال.
 *
 * أندرويد/كروم يطلق beforeinstallprompt فنعرض زراً حقيقياً. آيفون لا
 * يدعمه إطلاقاً، فنعرض إرشاداً لخطوات «إضافة إلى الشاشة الرئيسية».
 * يختفي الشريط تماماً إذا كان التطبيق مثبّتاً أصلاً أو أغلقه المستخدم.
 */
export default function InstallApp() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    // مثبّت بالفعل ⇒ لا نعرض شيئاً
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // آيفون يستخدم خاصية غير قياسية
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) return;
    if (localStorage.getItem(DISMISS_KEY) === "1") return;

    const ua = window.navigator.userAgent;
    const isIos = /iPad|iPhone|iPod/.test(ua);
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);

    if (isIos && isSafari) {
      setShowIosHint(true);
      setHidden(false);
      return;
    }

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setHidden(false);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", () => setHidden(true));
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setHidden(true);
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === "accepted") setHidden(true);
    setDeferred(null);
  }

  if (hidden) return null;

  return (
    <div className="install-bar" role="region" aria-label="تثبيت التطبيق">
      <span className="install-icon" aria-hidden="true">
        📲
      </span>
      <div className="install-text">
        <strong>ثبّت منصة حصة على جوالك</strong>
        {showIosHint ? (
          <span>
            اضغط زر المشاركة <span aria-hidden="true">⬆️</span> ثم «إضافة إلى
            الشاشة الرئيسية».
          </span>
        ) : (
          <span>افتحها كتطبيق من شاشتك مباشرة، بلا متجر ولا مساحة تُذكر.</span>
        )}
      </div>
      {!showIosHint && (
        <button type="button" className="btn btn-primary btn-sm" onClick={install}>
          تثبيت
        </button>
      )}
      <button
        type="button"
        className="install-close"
        onClick={dismiss}
        aria-label="إخفاء"
      >
        ✕
      </button>
    </div>
  );
}
