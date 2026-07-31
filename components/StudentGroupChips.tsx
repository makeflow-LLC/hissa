"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setGroupMembership } from "@/app/actions/teacher-groups";
import type { StudentGroup } from "@/lib/data/types";

/**
 * توزيع الطالب على مجموعات المعلّم بضغطة واحدة.
 * الطالب قد يكون في أكثر من مجموعة (مجموعة يوم + مجموعة مستوى مثلاً).
 */
export default function StudentGroupChips({
  studentId,
  groups,
  memberOf,
}: {
  studentId: string;
  groups: StudentGroup[];
  memberOf: string[];
}) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState("");

  if (groups.length === 0) return null;

  function toggle(groupId: string, member: boolean) {
    setError("");
    startTransition(async () => {
      const res = await setGroupMembership(groupId, studentId, member);
      if (!res.ok) setError(res.message ?? "تعذّر التحديث.");
      router.refresh();
    });
  }

  return (
    <div className="group-chips">
      <span className="group-chips-label">المجموعات:</span>
      {groups.map((g) => {
        const isMember = memberOf.includes(g.id);
        return (
          <button
            key={g.id}
            type="button"
            className={`chip ${isMember ? "chip-on" : ""}`}
            disabled={busy}
            aria-pressed={isMember}
            onClick={() => toggle(g.id, !isMember)}
          >
            {isMember ? "✓ " : "＋ "}
            {g.name}
          </button>
        );
      })}
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
