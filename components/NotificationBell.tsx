"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { NotifItem } from "@/lib/data/queries";

/**
 * جرس الإشعارات في الشريط العلوي.
 *
 * كانت الطلبات موزّعةً على ستّ صفحات، فمن لم يفتح الصفحة لم يعلم أن
 * أحداً ينتظره. والجرس يقلب المعادلة: العدد يأتي إلى المعلّم في كل
 * صفحة، لا هو يذهب يفتّش عنه.
 *
 * القائمة **قائمة روابط لا سجلّ إشعارات**: لا جدول «مقروء/غير مقروء»،
 * لأن الإشعار هنا ليس خبراً يُقرأ بل عملاً لم يُنجَز — وهو يختفي وحده
 * حين يُنجَز. جدولُ قراءةٍ كان سيضيف صفوفاً وحالةً تتعارض مع الحقيقة.
 */
export default function NotificationBell({ items }: { items: NotifItem[] }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const total = items.reduce((n, i) => n + i.count, 0);

  // الضغط خارج القائمة يغلقها، وكذلك Escape
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <div className="notif" ref={box}>
      <button
        type="button"
        className="notif-btn"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={total > 0 ? `الإشعارات — ${total} بانتظارك` : "الإشعارات"}
      >
        <span aria-hidden="true">🔔</span>
        {total > 0 && <span className="notif-badge">{total}</span>}
      </button>

      {open && (
        <div className="notif-panel" role="menu">
          <p className="notif-title">مركز الإشعارات</p>
          {items.length === 0 ? (
            <p className="notif-empty">لا شيء ينتظرك الآن. 🎉</p>
          ) : (
            <ul className="notif-list">
              {items.map((i) => (
                <li key={i.key}>
                  <Link href={i.href} className="notif-row" onClick={() => setOpen(false)}>
                    <span className="notif-icon" aria-hidden="true">
                      {i.icon}
                    </span>
                    <span className="notif-label">{i.label}</span>
                    <span className="notif-count">{i.count}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
