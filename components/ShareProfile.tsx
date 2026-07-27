"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";

/**
 * لوحة مشاركة بروفايل المعلم: رابطه الخاص + رمز QR قابل للتحميل +
 * أزرار نسخ ومشاركة. الرابط يُبنى من origin الحالي فيكون صحيحاً على
 * أي دومين (localhost أو Vercel أو دومين مخصص لاحقاً).
 */
export default function ShareProfile({
  slug,
  teacherName,
}: {
  slug: string;
  teacherName: string;
}) {
  const [url, setUrl] = useState("");
  const [qr, setQr] = useState("");
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const full = `${window.location.origin}/teacher/${slug}`;
    setUrl(full);

    // QR بدقة عالية للطباعة، بألوان المنصة
    QRCode.toDataURL(full, {
      width: 512,
      margin: 2,
      color: { dark: "#4f46e5", light: "#ffffff" },
    })
      .then(setQr)
      .catch(() => setQr(""));

    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, full, {
        width: 176,
        margin: 1,
        color: { dark: "#4f46e5", light: "#ffffff" },
      }).catch(() => {});
    }
  }, [slug]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      /* المتصفح منع النسخ — الرابط ظاهر للنسخ اليدوي */
    }
  }

  const shareText = `تابع دروس ${teacherName} على منصة حصة:`;
  const waHref = `https://wa.me/?text=${encodeURIComponent(`${shareText} ${url}`)}`;
  const telegramHref = `https://t.me/share/url?url=${encodeURIComponent(
    url
  )}&text=${encodeURIComponent(shareText)}`;

  return (
    <section className="dashboard-section">
      <h2 className="section-title">🔗 رابط بروفايلك للمشاركة</h2>
      <div className="share-card">
        <div className="share-qr">
          <canvas ref={canvasRef} className="share-qr-canvas" aria-label="رمز QR لبروفايلك" />
          {qr && (
            <a href={qr} download={`hissa-${slug}-qr.png`} className="btn btn-outline btn-sm">
              ⬇ تحميل الرمز
            </a>
          )}
        </div>

        <div className="share-body">
          <p className="share-hint">
            شارك هذا الرابط أو الرمز مع طلابك — يفتح بروفايلك مباشرة ليتصفّحوا
            دروسك ويسجّلوا في حصصك.
          </p>

          <div className="share-url-row">
            <input
              type="text"
              className="search-input share-url"
              value={url}
              readOnly
              dir="ltr"
              onFocus={(e) => e.currentTarget.select()}
              aria-label="رابط البروفايل"
            />
            <button type="button" className="btn btn-primary" onClick={copyLink}>
              {copied ? "✓ نُسخ" : "نسخ الرابط"}
            </button>
          </div>

          <div className="share-actions">
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-whatsapp"
            >
              💬 واتساب
            </a>
            <a
              href={telegramHref}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline"
            >
              ✈️ تيليجرام
            </a>
            <a
              href={`/teacher/${slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline"
            >
              👁 معاينة البروفايل
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
