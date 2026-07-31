"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { requestJoin, cancelJoin, toggleFollow } from "@/app/actions/student";
import type { FollowStatus } from "@/lib/data/types";

interface Props {
  teacherId: string;
  teacherSlug: string;
  teacherName: string;
  status: FollowStatus;
  /** سبب الرفض إن كتبه المعلّم */
  decisionNote: string;
  /** شروط الانضمام التي كتبها المعلّم مسبقاً في لوحته */
  joinInstructions: string;
  /** معلّم آخر انضمّ إليه الطالب في المادة نفسها */
  clashTeacher: string;
  isAuthed: boolean;
}

type Result = { ok: boolean; message?: string };

export default function JoinTeacherPanel({
  teacherId,
  teacherSlug,
  teacherName,
  status,
  decisionNote,
  joinInstructions,
  clashTeacher,
  isAuthed,
}: Props) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [showTerms, setShowTerms] = useState(false);
  const [error, setError] = useState("");

  const isFollowing = status !== "none";
  const isJoined = status === "approved";
  const isPending = status === "pending";

  if (!isAuthed) {
    const go = () =>
      router.push(`/login?next=${encodeURIComponent(`/teacher/${teacherSlug}`)}`);
    return (
      <div className="join-actions">
        <button type="button" className="btn btn-outline" onClick={go}>
          ＋ متابعة
        </button>
        <button type="button" className="btn btn-primary" onClick={go}>
          🎓 انضم إلى الصف
        </button>
      </div>
    );
  }

  function run(fn: () => Promise<Result>) {
    setError("");
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.message ?? "تعذّر تنفيذ الطلب.");
      else setShowTerms(false);
      router.refresh();
    });
  }

  return (
    <div className="join-block">
      <div className="join-actions">
        {/* المتابعة: فورية، بلا موافقة، وتبقى متاحة بعد الانضمام */}
        <button
          type="button"
          className={`btn ${isFollowing ? "btn-following" : "btn-outline"}`}
          disabled={busy}
          onClick={() => run(() => toggleFollow(teacherId, teacherSlug, isFollowing))}
        >
          {isFollowing ? "✓ تتابعه" : "＋ متابعة"}
        </button>

        {/* الانضمام: خطوة منفصلة يبتّها المعلّم */}
        {isJoined ? (
          <button
            type="button"
            className="btn btn-outline"
            disabled={busy}
            onClick={() => run(() => cancelJoin(teacherId, teacherSlug))}
          >
            مغادرة الصف
          </button>
        ) : isPending ? (
          <button
            type="button"
            className="btn btn-outline"
            disabled={busy}
            onClick={() => run(() => cancelJoin(teacherId, teacherSlug))}
          >
            سحب الطلب
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || Boolean(clashTeacher)}
            onClick={() => setShowTerms(true)}
          >
            🎓 انضم إلى الصف
          </button>
        )}
      </div>

      {isJoined && (
        <p className="join-state join-state-ok">
          ✓ أنت منضمّ إلى صفّ {teacherName} — تصلك رسائله ومحتواه الخاص.
        </p>
      )}
      {isPending && (
        <p className="join-state join-state-wait">
          ⏳ طلب انضمامك قيد المراجعة عند {teacherName}.
        </p>
      )}
      {status === "rejected" && (
        <p className="join-state join-state-no">
          لم يُقبل طلب انضمامك.
          {decisionNote ? ` سبب المعلّم: ${decisionNote}` : ""} وما زلت تتابعه.
        </p>
      )}

      {clashTeacher && !isJoined && !isPending && (
        <p className="join-blocked">
          أنت منضمّ إلى <strong>{clashTeacher}</strong> في المادة نفسها، والانضمام
          محدود بمعلّم واحد لكل مادة. غادر صفّه أولاً إن أردت الانتقال —{" "}
          <strong>أما المتابعة فغير مقيّدة</strong>، تابع من شئت.
        </p>
      )}

      {showTerms && !isJoined && !isPending && (
        <div className="join-terms-panel">
          <h4>شروط الانضمام إلى صفّ {teacherName}</h4>
          {joinInstructions ? (
            <p className="join-terms-text">{joinInstructions}</p>
          ) : (
            <p className="join-terms-text join-terms-empty">
              لم يكتب المعلّم شروطاً خاصة. سيراجع طلبك ويردّ عليك.
            </p>
          )}
          <p className="join-terms-hint">
            بإرسال الطلب أنت توافق على ما سبق. يصل الطلب إلى المعلّم ليقبله أو
            يرفضه، ولن ترى محتواه الخاص قبل القبول.
          </p>
          <div className="join-actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy}
              onClick={() => run(() => requestJoin(teacherId, teacherSlug))}
            >
              {busy ? "…جارٍ الإرسال" : "موافق، أرسل الطلب"}
            </button>
            <button
              type="button"
              className="btn btn-outline"
              disabled={busy}
              onClick={() => setShowTerms(false)}
            >
              إلغاء
            </button>
          </div>
        </div>
      )}

      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
