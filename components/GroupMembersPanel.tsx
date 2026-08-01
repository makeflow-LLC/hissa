"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { setGroupMembership } from "@/app/actions/teacher-groups";
import { sendMessage } from "@/app/actions/teacher-students";
import InfoTip from "@/components/InfoTip";
import type { GroupMember } from "@/lib/data/types";

/**
 * أعضاء المجموعة: تقدّم كلٍّ منهم وعلاماته، ومراسلته وحده، وإخراجه.
 *
 * صفّ واحد لكل طالب بكل ما يحتاجه المعلّم عنه: كان عليه أن يتنقّل بين
 * صفحة الطلاب وصفحة الاختبارات وبطاقات التقييم ليجمع الصورة نفسها.
 */
export default function GroupMembersPanel({
  groupId,
  members,
  candidates,
}: {
  groupId: string;
  members: GroupMember[];
  candidates: { studentId: string; name: string; grade: string }[];
}) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [openMsg, setOpenMsg] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [adding, setAdding] = useState("");

  function run(fn: () => Promise<{ ok: boolean; message?: string }>, after?: () => void) {
    setMsg("");
    setErr("");
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        setMsg(res.message ?? "");
        after?.();
      } else setErr(res.message ?? "تعذّر تنفيذ الأمر.");
      router.refresh();
    });
  }

  function sendPrivate(studentId: string) {
    const body = draft.trim();
    if (!body) return;
    const fd = new FormData();
    fd.set("studentId", studentId);
    fd.set("body", body);
    run(
      () => sendMessage({ ok: false }, fd),
      () => {
        setDraft("");
        setOpenMsg(null);
      }
    );
  }

  return (
    <div className="group-members">
      {msg && <p className="form-ok">{msg}</p>}
      {err && <p className="form-error">{err}</p>}

      {members.length === 0 ? (
        <p className="drafts-empty">
          لا أعضاء بعد. أضِف من طلابك المنضمّين من القائمة بالأسفل.
        </p>
      ) : (
        <ul className="member-list">
          {members.map((m) => (
            <li key={m.studentId} className="member-card">
              <div className="member-head">
                {m.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.avatarUrl} alt="" className="member-avatar" />
                ) : (
                  <span className="member-avatar member-avatar-fallback" aria-hidden="true">
                    {m.name.slice(0, 2)}
                  </span>
                )}
                {/* الاسم مدخلٌ إلى ملفّ الطالب الكامل، لا نصّاً جامداً */}
                <Link
                  href={`/teacher/me/students/${m.studentId}`}
                  className="member-id member-id-link"
                >
                  <strong className="member-name">{m.name}</strong>
                  <span className="group-meta">{m.grade || "بلا صفّ مسجّل"}</span>
                </Link>
                {m.awaitingReply && (
                  <span className="pill pill-low">✉️ ينتظر ردّك</span>
                )}
              </div>

              {/*
                التقدّم وحده هنا. الدرجات تخصّ الطالب، ومكانها ملفّه لا
                لوحةٌ تُفتح أمام كل من يمرّ بالشاشة.
              */}
              <div className="member-stats">
                <span className="member-stat">
                  📘 {m.completedLessons} من {m.totalLessons} درساً
                  <span className="member-bar" aria-hidden="true">
                    <span style={{ width: `${m.progressPct}%` }} />
                  </span>
                </span>
                <span className="member-stat">
                  📝 {m.examsTaken > 0 ? `قدّم ${m.examsTaken} اختباراً` : "لم يقدّم اختباراً بعد"}
                </span>
              </div>

              <div className="card-actions">
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => {
                    setOpenMsg(openMsg === m.studentId ? null : m.studentId);
                    setDraft("");
                  }}
                >
                  ✉️ رسالة خاصّة
                </button>
                <Link
                  href={`/teacher/me/students/${m.studentId}`}
                  className="btn btn-outline btn-sm"
                >
                  📋 ملفّه الكامل
                </Link>
                <button
                  type="button"
                  className="btn btn-outline btn-sm btn-danger"
                  disabled={busy}
                  onClick={() => {
                    if (!window.confirm(`إخراج ${m.name} من المجموعة؟`)) return;
                    run(() => setGroupMembership(groupId, m.studentId, false));
                  }}
                >
                  إخراج
                </button>
              </div>

              {openMsg === m.studentId && (
                <div className="member-msg">
                  <textarea
                    className="search-input"
                    rows={2}
                    maxLength={1000}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder={`رسالة إلى ${m.name} وحده…`}
                    aria-label={`رسالة خاصة إلى ${m.name}`}
                  />
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={busy || !draft.trim()}
                    onClick={() => sendPrivate(m.studentId)}
                  >
                    {busy ? "…جارٍ الإرسال" : "إرسال"}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="member-add">
        <span className="form-label">
          ضمّ طالباً إلى المجموعة
          <InfoTip>
            تظهر هنا أسماء من قَبِلتَ انضمامهم إليك ولم يدخلوا هذه المجموعة
            بعد. الطالب قد يكون في أكثر من مجموعة.
          </InfoTip>
        </span>
        {candidates.length === 0 ? (
          <p className="drafts-empty">كل طلابك المنضمّين أعضاء في هذه المجموعة.</p>
        ) : (
          <div className="form-row">
            <select
              value={adding}
              onChange={(e) => setAdding(e.target.value)}
              aria-label="اختر طالباً"
            >
              <option value="">— اختر طالباً —</option>
              {candidates.map((c) => (
                <option key={c.studentId} value={c.studentId}>
                  {c.name}
                  {c.grade ? ` — ${c.grade}` : ""}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={busy || !adding}
              onClick={() =>
                run(
                  () => setGroupMembership(groupId, adding, true),
                  () => setAdding("")
                )
              }
            >
              ➕ ضمّ
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
