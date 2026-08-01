"use client";

import { useActionState } from "react";
import { saveGroupDetails, type GroupsActionState } from "@/app/actions/teacher-groups";
import InfoTip from "@/components/InfoTip";
import type { StudentGroup } from "@/lib/data/types";

const initial: GroupsActionState = { ok: false };

/** بيانات المجموعة كصفّ: هدفها وموعدها ورابط مجموعتها على واتساب */
export default function GroupDetailsForm({ group }: { group: StudentGroup }) {
  const [state, action, pending] = useActionState(saveGroupDetails, initial);

  return (
    <form action={action} className="group-details-form">
      <input type="hidden" name="groupId" value={group.id} />

      <div className="form-row">
        <label className="form-field">
          <span className="form-label">اسم المجموعة *</span>
          <input
            type="text"
            name="name"
            className="search-input"
            defaultValue={group.name}
            maxLength={80}
            required
          />
        </label>
        <label className="form-field">
          <span className="form-label">
            موعد اللقاء
            <InfoTip>
              نصّ حرّ يقرؤه طلابك، مثل «السبت والثلاثاء ٦ مساءً». المنصة لا
              تحجز موعداً ولا ترسل تذكيراً — هو للتفاهم بينكم.
            </InfoTip>
          </span>
          <input
            type="text"
            name="schedule"
            className="search-input"
            defaultValue={group.schedule}
            maxLength={120}
            placeholder="مثال: السبت والثلاثاء ٦ مساءً"
          />
        </label>
      </div>

      <label className="form-field">
        <span className="form-label">وصف مختصر</span>
        <input
          type="text"
          name="description"
          className="search-input"
          defaultValue={group.description}
          maxLength={300}
          placeholder="لمن هذه المجموعة؟"
        />
      </label>

      <label className="form-field">
        <span className="form-label">
          هدف هذا الفصل
          <InfoTip>
            جملة تذكّرك وتذكّر طلابك بما تسعون إليه، مثل «إتقان المعادلات
            الخطية قبل الاختبار النهائي».
          </InfoTip>
        </span>
        <input
          type="text"
          name="goal"
          className="search-input"
          defaultValue={group.goal}
          maxLength={300}
          placeholder="مثال: إتقان الوحدتين الأولى والثانية قبل نهاية الفصل"
        />
      </label>

      <label className="form-field">
        <span className="form-label">
          رابط مجموعة واتساب
          <InfoTip>
            من واتساب: افتح المجموعة ← معلومات المجموعة ← «دعوة عبر رابط» ←
            نسخ. لا يظهر إلا لأعضاء هذه المجموعة، لا للزوّار ولا لبقية طلابك.
          </InfoTip>
        </span>
        <input
          type="url"
          name="whatsappLink"
          className="search-input"
          defaultValue={group.whatsapp_link}
          maxLength={300}
          placeholder="https://chat.whatsapp.com/…"
        />
      </label>

      <div className="card-actions">
        <button type="submit" className="btn btn-primary btn-sm" disabled={pending}>
          {pending ? "…جارٍ الحفظ" : "💾 حفظ بيانات المجموعة"}
        </button>
      </div>

      {state.message && (
        <p className={state.ok ? "form-ok" : "form-error"}>{state.message}</p>
      )}
    </form>
  );
}
