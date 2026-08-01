"use client";

import { useActionState, useEffect, useRef } from "react";
import { sendMessage, deleteMessage } from "@/app/actions/teacher-students";
import type { StudentsActionState } from "@/app/actions/teacher-students";

const initial: StudentsActionState = { ok: false };

/** تعميم يصل أعضاء هذه المجموعة وحدهم، مع سجلّ ما أُرسل */
export default function GroupBroadcast({
  groupId,
  memberCount,
  announcements,
}: {
  groupId: string;
  memberCount: number;
  announcements: { id: string; body: string; created_at: string }[];
}) {
  const [state, action, pending] = useActionState(sendMessage, initial);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);

  return (
    <div className="group-broadcast">
      <form ref={ref} action={action} className="broadcast-form">
        <input type="hidden" name="groupId" value={groupId} />
        <textarea
          name="body"
          className="search-input"
          rows={3}
          maxLength={1000}
          placeholder={`تعميم يصل ${memberCount} طالباً في هذه المجموعة…`}
          aria-label="نص التعميم"
          required
        />
        <button
          type="submit"
          className="btn btn-primary btn-sm"
          disabled={pending || memberCount === 0}
        >
          {pending ? "…جارٍ الإرسال" : "📢 إرسال للمجموعة"}
        </button>
        {memberCount === 0 && (
          <p className="form-hint">أضِف أعضاء أولاً — التعميم بلا مستقبِل لا معنى له.</p>
        )}
        {state.message && (
          <p className={state.ok ? "form-ok" : "form-error"}>{state.message}</p>
        )}
      </form>

      {announcements.length > 0 && (
        <ul className="messages-list">
          {announcements.map((a) => (
            <li key={a.id} className="message-row">
              <div className="message-head">
                <span className="pill pill-free">📢 لهذه المجموعة</span>
                <span className="message-date">
                  {new Date(a.created_at).toLocaleDateString("ar-EG", {
                    day: "numeric",
                    month: "long",
                  })}
                </span>
                <form action={deleteMessage} className="message-del">
                  <input type="hidden" name="messageId" value={a.id} />
                  <button type="submit" className="btn btn-outline btn-sm btn-danger">
                    🗑
                  </button>
                </form>
              </div>
              <p className="message-body">{a.body}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
