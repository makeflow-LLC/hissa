"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setGroupLessonAccess } from "@/app/actions/teacher-students";

/**
 * منح المجموعة كلّها وصولاً إلى درس خاص، أو سحبه عنها.
 *
 * الدرس «الخاص» يُخفى تماماً عمّن لا منحة له — عنوانه أيضاً. فهذا هو
 * «الدرس الخصوصي للمجموعة»: لا نوع جديد من الدروس، بل منحة جماعية على
 * نفس المسار الذي تفرضه سياسة `lessons` أصلاً.
 */
export default function GroupLessonAccess({
  groupId,
  memberCount,
  lessons,
}: {
  groupId: string;
  memberCount: number;
  lessons: { id: string; title: string; grantedCount: number }[];
}) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  if (lessons.length === 0) {
    return (
      <p className="drafts-empty">
        لا دروس خاصّة لديك بعد. عَلِّم درساً بـ«خاص» من صفحة تحريره، ثم امنحه
        لهذه المجموعة من هنا.
      </p>
    );
  }

  function run(lessonId: string, grant: boolean) {
    setMsg("");
    setErr("");
    startTransition(async () => {
      const res = await setGroupLessonAccess(groupId, lessonId, grant);
      if (res.ok) setMsg(res.message ?? "");
      else setErr(res.message ?? "تعذّر تنفيذ الأمر.");
      router.refresh();
    });
  }

  return (
    <div className="group-access">
      <ul className="access-list">
        {lessons.map((l) => {
          const all = memberCount > 0 && l.grantedCount === memberCount;
          return (
            <li key={l.id} className="access-row">
              <span className="access-title">🔒 {l.title}</span>
              <span className="group-meta">
                {l.grantedCount} من {memberCount} عضواً لهم وصول
              </span>
              <span className="card-actions">
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  disabled={busy || memberCount === 0 || all}
                  onClick={() => run(l.id, true)}
                >
                  {all ? "✓ للمجموعة كلّها" : "منح المجموعة"}
                </button>
                <button
                  type="button"
                  className="btn btn-outline btn-sm btn-danger"
                  disabled={busy || l.grantedCount === 0}
                  onClick={() => run(l.id, false)}
                >
                  سحب
                </button>
              </span>
            </li>
          );
        })}
      </ul>
      {msg && <p className="form-ok">{msg}</p>}
      {err && <p className="form-error">{err}</p>}
    </div>
  );
}
