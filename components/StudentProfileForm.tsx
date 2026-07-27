"use client";

import { useActionState, useState } from "react";
import {
  saveStudentProfile,
  type StudentProfileState,
} from "@/app/actions/student-profile";
import type { StudentProfile } from "@/lib/data/types";

const GRADES = [
  "الصف الأول الابتدائي",
  "الصف الثاني الابتدائي",
  "الصف الثالث الابتدائي",
  "الصف الرابع الابتدائي",
  "الصف الخامس الابتدائي",
  "الصف السادس الابتدائي",
  "الصف الأول الإعدادي",
  "الصف الثاني الإعدادي",
  "الصف الثالث الإعدادي",
  "الصف الأول الثانوي",
  "الصف الثاني الثانوي",
  "الصف الثالث الثانوي",
  "أخرى",
];

/** تصغير الصورة إلى مربع 256px كـ data URL */
function resizeAvatar(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const size = 256;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("no ctx"));
        return;
      }
      const side = Math.min(img.width, img.height);
      ctx.drawImage(
        img,
        (img.width - side) / 2,
        (img.height - side) / 2,
        side,
        side,
        0,
        0,
        size,
        size
      );
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("bad image"));
    };
    img.src = url;
  });
}

const initialState: StudentProfileState = { ok: false };

export default function StudentProfileForm({
  initial,
}: {
  initial: StudentProfile | null;
}) {
  const [state, formAction, pending] = useActionState(
    saveStudentProfile,
    initialState
  );
  const [avatar, setAvatar] = useState(initial?.avatar_url ?? "");
  const [avatarErr, setAvatarErr] = useState("");

  async function onPickAvatar(file: File | undefined) {
    if (!file) return;
    setAvatarErr("");
    try {
      setAvatar(await resizeAvatar(file));
    } catch {
      setAvatarErr("تعذّر قراءة الصورة — جرّب صورة أخرى.");
    }
  }

  return (
    <form action={formAction} className="lesson-form">
      <input type="hidden" name="avatar" value={avatar} />

      <div className="form-field">
        <span className="form-label">صورتك الشخصية (اختياري)</span>
        <div className="avatar-edit">
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatar} alt="صورتك" className="avatar-preview" />
          ) : (
            <span className="teacher-avatar avatar-preview-fallback">🎓</span>
          )}
          <div className="avatar-edit-actions">
            <label className="upload-box">
              <input
                type="file"
                accept="image/*"
                className="upload-input"
                onChange={(e) => onPickAvatar(e.target.files?.[0])}
              />
              🖼️ {avatar ? "تغيير الصورة" : "رفع صورة"}
            </label>
            {avatar && (
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setAvatar("")}
              >
                إزالة
              </button>
            )}
          </div>
        </div>
        {avatarErr && <p className="form-error">{avatarErr}</p>}
      </div>

      <label className="form-field">
        <span className="form-label">الاسم الكامل *</span>
        <input
          type="text"
          name="full_name"
          className="search-input"
          defaultValue={initial?.full_name ?? ""}
          placeholder="مثال: محمد أحمد"
          required
        />
      </label>

      <div className="form-grid">
        <label className="form-field">
          <span className="form-label">الصف الدراسي *</span>
          <select
            name="grade"
            className="filter-select"
            defaultValue={initial?.grade ?? ""}
            required
          >
            <option value="" disabled>
              اختر صفّك…
            </option>
            {GRADES.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </label>

        <label className="form-field">
          <span className="form-label">العمر</span>
          <input
            type="number"
            name="age"
            className="search-input"
            min={4}
            max={100}
            defaultValue={initial?.age ?? ""}
            placeholder="مثال: ١٥"
          />
        </label>
      </div>

      <div className="form-grid">
        <label className="form-field">
          <span className="form-label">المدرسة</span>
          <input
            type="text"
            name="school"
            className="search-input"
            defaultValue={initial?.school ?? ""}
            placeholder="اسم مدرستك (اختياري)"
          />
        </label>

        <label className="form-field">
          <span className="form-label">المدينة</span>
          <input
            type="text"
            name="city"
            className="search-input"
            defaultValue={initial?.city ?? ""}
            placeholder="مثال: القاهرة"
          />
        </label>
      </div>

      <fieldset className="form-fieldset">
        <legend className="form-label">أرقام التواصل — كلها اختيارية</legend>
        <p className="form-hint">
          تظهر لمعلّميك الذين تتابعهم فقط، ليتواصلوا معك عند الحاجة. يمكنك تركها
          فارغة تماماً.
        </p>
        <div className="form-grid">
          <label className="form-field">
            <span className="form-label">هاتفك</span>
            <input
              type="tel"
              name="phone"
              dir="ltr"
              className="search-input"
              defaultValue={initial?.phone ?? ""}
              placeholder="+201001234567"
            />
          </label>
          <label className="form-field">
            <span className="form-label">واتساب</span>
            <input
              type="tel"
              name="whatsapp"
              dir="ltr"
              className="search-input"
              defaultValue={initial?.whatsapp ?? ""}
              placeholder="+201001234567"
            />
          </label>
        </div>
        <label className="form-field">
          <span className="form-label">هاتف ولي الأمر</span>
          <input
            type="tel"
            name="guardian_phone"
            dir="ltr"
            className="search-input"
            defaultValue={initial?.guardian_phone ?? ""}
            placeholder="+201001234567"
          />
        </label>
      </fieldset>

      {state.message && (
        <p className={state.ok ? "form-success" : "form-error"}>{state.message}</p>
      )}

      <div className="form-actions">
        <button type="submit" className="btn btn-primary btn-lg" disabled={pending}>
          {pending ? "جارٍ الحفظ…" : "حفظ بياناتي"}
        </button>
      </div>
    </form>
  );
}
