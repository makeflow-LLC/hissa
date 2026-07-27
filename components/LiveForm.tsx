"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { saveLive, type ContentFormState } from "@/app/actions/teacher-content";

const EMOJIS = ["🔴", "🎥", "🗓️", "📡", "💬", "🎙️", "✨", "🎓"];

export interface LiveFormInitial {
  id: string;
  title: string;
  description: string;
  schedule: string;
  duration: string;
  seats_left: number;
  emoji: string;
  status: string;
  is_paid: boolean;
  price: number;
  currency: string;
}

const initialState: ContentFormState = { ok: false };

export default function LiveForm({
  initial,
}: {
  initial: LiveFormInitial | null;
}) {
  const router = useRouter();
  const isEdit = Boolean(initial);
  const [state, formAction, pending] = useActionState(saveLive, initialState);

  const [emoji, setEmoji] = useState(initial?.emoji ?? "🔴");
  const [isPaid, setIsPaid] = useState(initial?.is_paid ?? false);

  useEffect(() => {
    if (state.ok) router.push("/teacher/me/content");
  }, [state, router]);

  return (
    <form action={formAction} className="lesson-form">
      {isEdit && <input type="hidden" name="sessionId" value={initial!.id} />}
      <input type="hidden" name="emoji" value={emoji} />

      <label className="form-field">
        <span className="form-label">عنوان الحصة *</span>
        <input
          type="text"
          name="title"
          className="search-input"
          defaultValue={initial?.title ?? ""}
          placeholder="مثال: مراجعة نهائية — الوحدة الأولى"
          required
        />
      </label>

      <label className="form-field">
        <span className="form-label">وصف مختصر</span>
        <textarea
          name="description"
          className="search-input form-textarea"
          rows={2}
          defaultValue={initial?.description ?? ""}
          placeholder="ماذا ستغطّي الحصة؟"
        />
      </label>

      <div className="form-grid">
        <label className="form-field">
          <span className="form-label">الموعد</span>
          <input
            type="text"
            name="schedule"
            className="search-input"
            defaultValue={initial?.schedule ?? ""}
            placeholder="مثال: الخميس ٨ مساءً"
          />
        </label>

        <label className="form-field">
          <span className="form-label">المدّة</span>
          <input
            type="text"
            name="duration"
            className="search-input"
            defaultValue={initial?.duration ?? ""}
            placeholder="مثال: ٦٠ دقيقة"
          />
        </label>
      </div>

      <div className="form-grid">
        <label className="form-field">
          <span className="form-label">المقاعد المتاحة</span>
          <input
            type="number"
            name="seats_left"
            className="search-input"
            min={0}
            max={9999}
            defaultValue={initial?.seats_left ?? 20}
          />
        </label>

        <div className="form-field">
          <span className="form-label">أيقونة الحصة</span>
          <div className="emoji-picker" role="group" aria-label="اختر أيقونة">
            {EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                className={`emoji-option ${emoji === e ? "emoji-option-active" : ""}`}
                onClick={() => setEmoji(e)}
                aria-pressed={emoji === e}
              >
                {e}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* التسعير */}
      <div className="form-field">
        <label className="toggle-field">
          <input
            type="checkbox"
            name="is_paid"
            checked={isPaid}
            onChange={(e) => setIsPaid(e.target.checked)}
          />
          <span>
            <span className="form-label">حصة مدفوعة 💳</span>
            <span className="form-hint">
              أنت من يحدّد السعر ويحصّله مباشرةً من الطالب عبر واتساب — لا تمرّ أي
              مدفوعات عبر المنصة.
            </span>
          </span>
        </label>
      </div>

      {isPaid && (
        <div className="form-grid">
          <label className="form-field">
            <span className="form-label">السعر</span>
            <input
              type="number"
              name="price"
              className="search-input"
              min={0}
              step="0.5"
              defaultValue={initial?.price ?? 0}
            />
          </label>
          <label className="form-field">
            <span className="form-label">العملة</span>
            <select
              name="currency"
              className="filter-select"
              defaultValue={initial?.currency ?? "EGP"}
            >
              <option value="EGP">جنيه مصري (EGP)</option>
              <option value="SAR">ريال سعودي (SAR)</option>
              <option value="AED">درهم إماراتي (AED)</option>
              <option value="USD">دولار (USD)</option>
            </select>
          </label>
        </div>
      )}

      <label className="form-field">
        <span className="form-label">الحالة</span>
        <select
          name="status"
          className="filter-select"
          defaultValue={initial?.status ?? "published"}
        >
          <option value="published">منشورة — يراها الطلاب</option>
          <option value="draft">مسودّة — مخفيّة</option>
        </select>
      </label>

      {state.message && !state.ok && <p className="form-error">{state.message}</p>}

      <div className="form-actions">
        <button type="submit" className="btn btn-primary btn-lg" disabled={pending}>
          {pending ? "جارٍ الحفظ…" : isEdit ? "حفظ التعديلات" : "نشر الحصة"}
        </button>
        <button
          type="button"
          className="btn btn-outline"
          onClick={() => router.push("/teacher/me/content")}
        >
          إلغاء
        </button>
      </div>
    </form>
  );
}
