"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setAvailability } from "@/app/actions/teacher";
import InfoTip from "@/components/InfoTip";
import { AVAILABILITY, AVAILABILITY_KEYS } from "@/lib/availability";
import type { Availability } from "@/lib/data/types";


/**
 * حالة المعلّم كما يضبطها بنفسه، وتظهر لطلابه على صفحته وفي مراسلاتهم.
 *
 * حالة يدوية لا محسوبة من آخر دخول: «متصل قبل ٣ دقائق» يقول متى فتح
 * الصفحة لا متى ينوي الردّ، ويكشف عادات المعلّم على من لا يعنيه ذلك.
 */
export default function AvailabilityToggle({
  status,
  note,
}: {
  status: Availability;
  note: string;
}) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [current, setCurrent] = useState<Availability>(status);
  const [draft, setDraft] = useState(note);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  function save(next: Availability, nextNote: string) {
    setErr("");
    setMsg("");
    setCurrent(next);
    startTransition(async () => {
      const res = await setAvailability(next, nextNote);
      if (res.ok) setMsg(res.message ?? "");
      else {
        setErr(res.message ?? "تعذّر حفظ الحالة.");
        setCurrent(status);
      }
      router.refresh();
    });
  }

  return (
    <div className="availability-box">
      <div className="section-head-row">
        <h2 className="section-title">
          {AVAILABILITY[current].icon} حالتك
          <InfoTip>
            يراها طلابك على صفحتك وفي مراسلاتهم معك، فيعرفون متى يتوقّعون
            ردّك بدل انتظارٍ لا يدرون مداه. تغيّرها متى شئت.
          </InfoTip>
        </h2>
      </div>

      <div className="availability-options" role="group" aria-label="حالة التوفّر">
        {AVAILABILITY_KEYS.map((k) => (
          <button
            key={k}
            type="button"
            className={`avail-chip ${AVAILABILITY[k].className} ${
              current === k ? "avail-chip-on" : ""
            }`}
            aria-pressed={current === k}
            disabled={busy}
            onClick={() => save(k, draft)}
          >
            {AVAILABILITY[k].icon} {AVAILABILITY[k].label}
          </button>
        ))}
      </div>

      <label className="form-field">
        <span className="form-label">
          سطر يوضّح حالتك (اختياري)
          <InfoTip>
            مثل «أردّ بعد صلاة العشاء» أو «في إجازة حتى الأحد». اتركه فارغاً
            إن لم تحتج توضيحاً.
          </InfoTip>
        </span>
        <div className="form-row">
          <input
            type="text"
            className="search-input"
            maxLength={120}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="مثال: أردّ على الرسائل بعد المغرب"
          />
          <button
            type="button"
            className="btn btn-outline btn-sm"
            disabled={busy}
            onClick={() => save(current, draft)}
          >
            حفظ
          </button>
        </div>
      </label>

      {msg && <p className="form-ok">{msg}</p>}
      {err && <p className="form-error">{err}</p>}
    </div>
  );
}
