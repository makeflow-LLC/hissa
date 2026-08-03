"use client";

import { useActionState } from "react";
import { setTeacherCredits, type AdminState } from "@/app/actions/admin";
import type { AdminTeacherRow } from "@/lib/data/queries";

const initial: AdminState = { ok: false };

/**
 * صفّ معلّم في لوحة الإدارة — نموذجٌ مستقلّ لكل صفّ.
 *
 * نموذجٌ واحد يلفّ الجدول كلّه كان سيجعل حفظ صفٍّ يرسل كل الصفوف، ورسالةَ
 * النجاح تظهر في مكانٍ لا يخصّ ما عُدِّل.
 */
export default function AdminCreditRow({ t }: { t: AdminTeacherRow }) {
  const [state, save, saving] = useActionState(setTeacherCredits, initial);

  return (
    <tr>
      <td>
        <strong>{t.name}</strong>
        <span className="admin-sub">{t.subject}</span>
      </td>
      <td className="admin-email">{t.email || "—"}</td>
      <td className="admin-num">{t.usedCredits}</td>
      <td>
        <form action={save} className="admin-credit-form">
          <input type="hidden" name="teacherId" value={t.id} />
          <input
            type="number"
            name="credits"
            className="search-input admin-credit-input"
            defaultValue={t.credits}
            min={0}
            max={100000}
            aria-label={`رصيد ${t.name}`}
          />
          <button type="submit" className="btn btn-outline btn-sm" disabled={saving}>
            {saving ? "…" : "حفظ"}
          </button>
        </form>
        {state.message && (
          <span className={state.ok ? "form-ok" : "form-error"}>{state.message}</span>
        )}
      </td>
    </tr>
  );
}
