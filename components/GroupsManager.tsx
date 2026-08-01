"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import {
  createGroup,
  renameGroup,
  deleteGroup,
  type GroupsActionState,
} from "@/app/actions/teacher-groups";
import type { StudentGroup } from "@/lib/data/types";

const initial: GroupsActionState = { ok: false };

function AddGroupForm() {
  const [state, action, pending] = useActionState(createGroup, initial);
  return (
    <form action={action} className="group-form">
      <input
        type="text"
        name="name"
        placeholder="اسم المجموعة (مثلاً: مجموعة السبت)"
        maxLength={80}
        required
      />
      <input
        type="text"
        name="description"
        placeholder="وصف مختصر (اختياري)"
        maxLength={300}
      />
      <button type="submit" className="btn btn-primary btn-sm" disabled={pending}>
        {pending ? "…" : "➕ إنشاء"}
      </button>
      {state.message && (
        <span className={state.ok ? "form-ok" : "form-error"}>{state.message}</span>
      )}
    </form>
  );
}

function GroupRow({ group }: { group: StudentGroup }) {
  const [editing, setEditing] = useState(false);
  const [renameState, renameAction, renaming] = useActionState(renameGroup, initial);
  const [, deleteAction, deleting] = useActionState(deleteGroup, initial);

  if (editing) {
    return (
      <li className="group-row">
        <form action={renameAction} className="group-form">
          <input type="hidden" name="groupId" value={group.id} />
          <input
            type="text"
            name="name"
            defaultValue={group.name}
            maxLength={80}
            required
          />
          <input
            type="text"
            name="description"
            defaultValue={group.description}
            placeholder="وصف مختصر"
            maxLength={300}
          />
          <button type="submit" className="btn btn-primary btn-sm" disabled={renaming}>
            حفظ
          </button>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => setEditing(false)}
          >
            إلغاء
          </button>
          {renameState.message && !renameState.ok && (
            <span className="form-error">{renameState.message}</span>
          )}
        </form>
      </li>
    );
  }

  return (
    <li className="group-row">
      {/* اسم المجموعة هو المدخل إلى لوحتها — لا زرّ إضافي بجانبه */}
      <Link href={`/teacher/me/groups/${group.id}`} className="group-info group-info-link">
        <strong className="group-name">{group.name}</strong>
        <span className="group-meta">
          {group.memberCount} طالباً
          {group.schedule && <> · 🕒 {group.schedule}</>}
          {group.description && <> · {group.description}</>}
        </span>
      </Link>
      <div className="form-row">
        <Link
          href={`/teacher/me/groups/${group.id}`}
          className="btn btn-primary btn-sm"
        >
          لوحة المجموعة ←
        </Link>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => setEditing(true)}
        >
          تعديل سريع
        </button>
        <form action={deleteAction}>
          <input type="hidden" name="groupId" value={group.id} />
          <button
            type="submit"
            className="btn btn-outline btn-sm btn-danger"
            disabled={deleting}
          >
            حذف
          </button>
        </form>
      </div>
    </li>
  );
}

export default function GroupsManager({ groups }: { groups: StudentGroup[] }) {
  return (
    <div className="groups-manager">
      <AddGroupForm />
      {groups.length === 0 ? (
        <p className="drafts-empty">
          لا مجموعات بعد. أنشئ مجموعة ثم وزّع طلابك عليها من بطاقاتهم بالأسفل.
        </p>
      ) : (
        <ul className="groups-list">
          {groups.map((g) => (
            <GroupRow key={g.id} group={g} />
          ))}
        </ul>
      )}
    </div>
  );
}
