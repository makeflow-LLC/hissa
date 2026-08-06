"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import InfoTip from "@/components/InfoTip";
import { saveAssignment, type AssignmentState } from "@/app/actions/assignments";
import type { StudentGroup } from "@/lib/data/types";

const initial: AssignmentState = { ok: false };

/**
 * موعد التسليم يُرسَل **لحظةً مطلقة يحسبها المتصفّح**.
 *
 * `datetime-local` يعطي «2026-08-10T20:00» بلا منطقة زمنية، فيفهمه كل
 * طرف بتوقيته: الخادم بـUTC والمعلّم بتوقيت غزة. فيُخزَّن موعدٌ يخالف ما
 * قصده ويُعرض عليه محرَّفاً، وكل حفظٍ يزيحه من جديد. نفس درس نافذة
 * الاختبارات.
 */
function toIso(local: string): string {
  if (!local) return "";
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

export default function AssignmentForm({
  groups,
  lessons,
  assignment,
}: {
  groups: StudentGroup[];
  lessons: { id: string; title: string }[];
  assignment?: {
    id: string;
    title: string;
    body: string;
    dueAt: string | null;
    groupId: string | null;
    lessonId: string | null;
  };
}) {
  const router = useRouter();
  const [state, save, saving] = useActionState(saveAssignment, initial);
  const [due, setDue] = useState(() => {
    if (!assignment?.dueAt) return "";
    const d = new Date(assignment.dueAt);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });

  useEffect(() => {
    if (state.ok && state.assignmentId && !assignment)
      router.push(`/teacher/me/assignments/${state.assignmentId}`);
  }, [state, assignment, router]);

  return (
    <form action={save} className="exam-form">
      {assignment && <input type="hidden" name="assignmentId" value={assignment.id} />}
      {/* الحقل المخفيّ يحمل اللحظة المطلقة؛ والظاهر للمعلّم بتوقيته */}
      <input type="hidden" name="dueAt" value={toIso(due)} />

      <label className="form-field">
        <span className="form-label">عنوان الواجب *</span>
        <input
          type="text"
          name="title"
          className="search-input"
          defaultValue={assignment?.title ?? ""}
          placeholder="مثال: حلّ تمارين الصفحة ٤٢"
          maxLength={200}
          required
        />
      </label>

      <label className="form-field">
        <span className="form-label">تفاصيل الواجب</span>
        <textarea
          name="body"
          rows={4}
          defaultValue={assignment?.body ?? ""}
          placeholder="ما المطلوب بالضبط؟ وكيف يُسلَّم؟"
          maxLength={4000}
        />
      </label>

      <div className="form-row">
        <label className="form-field">
          <span className="form-label">
            موعد التسليم
            <InfoTip>
              اتركه فارغاً لواجبٍ بلا موعد. والتسليم بعد الموعد يُقبل ويُعلَّم
              «متأخّر» — منعُه يعاقب الطالب الذي تأخّر ثم عمل.
            </InfoTip>
          </span>
          <input
            type="datetime-local"
            value={due}
            onChange={(e) => setDue(e.target.value)}
          />
        </label>

        <label className="form-field">
          <span className="form-label">لمن؟</span>
          <select name="groupId" defaultValue={assignment?.groupId ?? ""}>
            <option value="">كل طلابي المنضمّين</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name} ({g.memberCount} طالباً)
              </option>
            ))}
          </select>
        </label>

        <label className="form-field">
          <span className="form-label">مرتبط بدرس (اختياري)</span>
          <select name="lessonId" defaultValue={assignment?.lessonId ?? ""}>
            <option value="">— بلا درس —</option>
            {lessons.map((l) => (
              <option key={l.id} value={l.id}>
                {l.title}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="card-actions">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? "…يُحفظ" : assignment ? "💾 حفظ" : "➕ أنشئ الواجب"}
        </button>
      </div>
      {state.message && (
        <p className={state.ok ? "form-ok" : "form-error"}>{state.message}</p>
      )}
      {!assignment && (
        <p className="form-hint">
          💡 يُحفظ مسودّةً — لا يراه أحد حتى تنشره من صفحته.
        </p>
      )}
    </form>
  );
}
