"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { saveTeacherProfile, type TeacherFormState } from "@/app/actions/teacher";
import type { MyTeacher } from "@/lib/data/types";

const STAGES = ["ابتدائي", "إعدادي", "ثانوي"] as const;
const SUBJECTS = [
  "رياضيات",
  "لغة عربية",
  "لغة إنجليزية",
  "علوم",
  "فيزياء",
  "كيمياء",
  "أحياء",
  "دراسات اجتماعية",
  "تاريخ",
  "جغرافيا",
  "دين",
  "حاسوب",
  "أخرى",
];

/** تصغير الصورة إلى مربع 256px كـ data URL يتّسع له عمود قاعدة البيانات */
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

const initialState: TeacherFormState = { ok: false };

export default function TeacherProfileForm({
  initial,
}: {
  initial: MyTeacher | null;
}) {
  const router = useRouter();
  const isEdit = Boolean(initial);
  const [state, formAction, pending] = useActionState(
    saveTeacherProfile,
    initialState
  );

  const [avatar, setAvatar] = useState<string>(initial?.avatar_url ?? "");
  const [avatarErr, setAvatarErr] = useState("");
  const gradient = initial?.gradient ?? "linear-gradient(135deg, #6366f1, #8b5cf6)";
  const initials = initial?.initials ?? "م";

  // بعد النجاح ننتقل للوحة المعلّم
  useEffect(() => {
    if (state.ok && state.slug) router.push("/teacher/me");
  }, [state, router]);

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
        <span className="form-label">الصورة الشخصية</span>
        <div className="avatar-edit">
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatar} alt="صورتك" className="avatar-preview" />
          ) : (
            <span
              className="teacher-avatar avatar-preview-fallback"
              style={{ background: gradient }}
            >
              {initials}
            </span>
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
        <span className="form-label">الاسم كما يظهر للطلاب *</span>
        <input
          type="text"
          name="name"
          className="search-input"
          defaultValue={initial?.name ?? ""}
          placeholder="مثال: أ. أحمد الشريف"
          required
        />
      </label>

      <div className="form-grid">
        <label className="form-field">
          <span className="form-label">المادة *</span>
          <select
            name="subject"
            className="filter-select"
            defaultValue={initial?.subject ?? ""}
            required
          >
            <option value="" disabled>
              اختر المادة…
            </option>
            {SUBJECTS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>

        <label className="form-field">
          <span className="form-label">سنوات الخبرة</span>
          <input
            type="number"
            name="experience_years"
            className="search-input"
            min={0}
            max={60}
            defaultValue={initial?.experience_years ?? 0}
          />
        </label>
      </div>

      <label className="form-field">
        <span className="form-label">المؤهل العلمي</span>
        <input
          type="text"
          name="qualification"
          className="search-input"
          defaultValue={initial?.qualification ?? ""}
          placeholder="مثال: بكالوريوس رياضيات — كلية العلوم"
        />
      </label>

      <label className="form-field">
        <span className="form-label">شروط الانضمام إلى صفّك</span>
        <textarea
          name="join_instructions"
          rows={3}
          maxLength={800}
          defaultValue={initial?.join_instructions ?? ""}
          placeholder="تُعرض للطالب قبل أن يرسل طلبه — مثلاً: مواعيد الحصص، ما يحتاجه معه، أو كيف يتواصل معك."
        />
        <span className="form-hint">
          يقرؤها الطالب عند طلب الانضمام. الطلبات تصلك للموافقة قبل أن يرى محتواك الخاص.
        </span>
      </label>

      <div className="form-field">
        <span className="form-label">الصفوف / المراحل التي تدرّسها *</span>
        <div className="stages-picker" role="group" aria-label="المراحل الدراسية">
          {STAGES.map((s) => {
            const checked = initial?.stages?.includes(s) ?? false;
            return (
              <label key={s} className="stage-option">
                <input type="checkbox" name={`stage_${s}`} defaultChecked={checked} />
                {s}
              </label>
            );
          })}
        </div>
      </div>

      <label className="form-field">
        <span className="form-label">نبذة عنك</span>
        <textarea
          name="bio"
          className="search-input form-textarea"
          rows={4}
          defaultValue={initial?.bio ?? ""}
          placeholder="عرّف بنفسك وأسلوبك في التدريس وما يميّزك…"
        />
      </label>

      <div className="form-field">
        <span className="form-label">وسيلة التواصل (اختيارية)</span>
        <div className="form-row">
          <label className="form-field">
            <span className="form-label">رقم واتساب</span>
            <input
              type="tel"
              name="whatsapp"
              dir="ltr"
              defaultValue={initial?.whatsapp ?? ""}
              placeholder="+201001234567"
            />
          </label>
          <label className="form-field">
            <span className="form-label">رقم للاتصال</span>
            <input
              type="tel"
              name="phone"
              dir="ltr"
              defaultValue={initial?.phone ?? ""}
              placeholder="+201001234567"
            />
          </label>
        </div>
        <label className="check-line">
          <input
            type="checkbox"
            name="contact_public"
            defaultChecked={initial?.contact_public ?? true}
          />
          <span>أظهر رقمي في صندوق الحجز ليسألني الطالب قبل أن يحجز</span>
        </label>
        <span className="form-hint">
          يظهر <strong>للطلاب المسجّلين دخولاً وحدهم</strong>، لا للزوّار ولا
          لمن يجمع الأرقام آلياً. وأعضاء مجموعاتك يرونه على كل حال.
        </span>
      </div>

      {!isEdit && (
        <label className="form-field">
          <span className="form-label">معرّف الرابط (اختياري)</span>
          <input
            type="text"
            name="slug"
            dir="ltr"
            className="search-input"
            placeholder="ahmed-math"
            pattern="[a-zA-Z0-9\-]{3,40}"
          />
          <span className="form-hint">
            أحرف إنجليزية وأرقام وشرطات فقط — يصبح رابطك: hissa.sbs/teacher/…
            (نولّده تلقائياً إن تركته فارغاً).
          </span>
        </label>
      )}

      {state.message && !state.ok && <p className="form-error">{state.message}</p>}

      <div className="form-actions">
        <button type="submit" className="btn btn-primary btn-lg" disabled={pending}>
          {pending ? "جارٍ الحفظ…" : isEdit ? "حفظ التعديلات" : "إنشاء بروفايلي"}
        </button>
      </div>
    </form>
  );
}
