"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Stage, Teacher } from "@/lib/teachers";
import { STAGES } from "@/lib/teachers";
import { useTeacherAuth } from "@/lib/useTeacherAuth";
import { useTeacherProfile } from "@/lib/useTeacherProfile";

/** تصغير الصورة المرفوعة إلى مربع 256px وإرجاعها كـ data URL يتسع له localStorage */
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
        reject(new Error("canvas unavailable"));
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

export default function ProfileSettingsPage() {
  const { teacher, loaded } = useTeacherAuth();
  const router = useRouter();

  useEffect(() => {
    if (loaded && !teacher) router.replace("/teacher-login");
  }, [loaded, teacher, router]);

  if (!loaded || !teacher) {
    return (
      <main className="container">
        <p className="empty-state">جارٍ التحميل…</p>
      </main>
    );
  }

  return <ProfileForm teacher={teacher} />;
}

function ProfileForm({ teacher }: { teacher: Teacher }) {
  const { overrides, loaded, save } = useTeacherProfile(teacher.slug);

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [stages, setStages] = useState<Stage[]>([teacher.stage]);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState("");
  const [savedMsg, setSavedMsg] = useState(false);

  // تعبئة النموذج من المحفوظ بعد تحميله (مرة واحدة لكل تحميل صفحة)
  useEffect(() => {
    if (!loaded) return;
    setDisplayName(overrides.displayName ?? teacher.name);
    setBio(overrides.bio ?? teacher.bio);
    setWhatsapp(overrides.whatsapp ?? "");
    setStages(
      overrides.stages && overrides.stages.length > 0
        ? overrides.stages
        : [teacher.stage]
    );
    setAvatar(overrides.avatar ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  function toggleStage(stage: Stage) {
    setStages((prev) => {
      const next = prev.includes(stage)
        ? prev.filter((s) => s !== stage)
        : [...prev, stage];
      // مرحلة واحدة على الأقل
      return next.length > 0 ? next : prev;
    });
  }

  async function handleAvatar(file: File | undefined) {
    if (!file) return;
    setAvatarError("");
    try {
      setAvatar(await resizeAvatar(file));
    } catch {
      setAvatarError("تعذّر قراءة الصورة — جرّب ملف صورة آخر.");
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    save({
      displayName: displayName.trim() || undefined,
      bio: bio.trim() || undefined,
      whatsapp: whatsapp.trim() || undefined,
      stages,
      avatar: avatar ?? undefined,
    });
    setSavedMsg(true);
    window.setTimeout(() => setSavedMsg(false), 4000);
  }

  return (
    <main className="container container-narrow">
      <nav className="breadcrumb">
        <Link href="/teacher-dashboard" className="back-link">
          → لوحة التحكم
        </Link>
      </nav>

      <h1 className="dashboard-title">الملف الشخصي</h1>
      <p className="dashboard-subtitle form-page-subtitle">
        عدّل صورتك واسمك ونبذتك والمراحل التي تدرّسها — يظهر كل ذلك للطلاب في
        بروفايلك مباشرة.
      </p>

      <form onSubmit={handleSubmit} className="lesson-form">
        <div className="form-field">
          <span className="form-label">الصورة / اللوغو</span>
          <div className="avatar-edit">
            {avatar ? (
              // الصورة data URL محلية — next/image لا يضيف شيئاً هنا
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatar} alt="صورة المعلم" className="avatar-preview" />
            ) : (
              <span
                className="teacher-avatar avatar-preview-fallback"
                style={{ background: teacher.gradient }}
              >
                {teacher.initials}
              </span>
            )}
            <div className="avatar-edit-actions">
              <label className="upload-box">
                <input
                  type="file"
                  accept="image/*"
                  className="upload-input"
                  onChange={(e) => handleAvatar(e.target.files?.[0])}
                />
                🖼️ {avatar ? "تغيير الصورة" : "رفع صورة أو لوغو"}
              </label>
              {avatar && (
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => setAvatar(null)}
                >
                  إزالة الصورة
                </button>
              )}
            </div>
          </div>
          {avatarError && <p className="form-error">{avatarError}</p>}
        </div>

        <label className="form-field">
          <span className="form-label">اسم المدرس *</span>
          <input
            type="text"
            className="search-input"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
          />
        </label>

        <label className="form-field">
          <span className="form-label">نبذة عنك *</span>
          <textarea
            className="search-input form-textarea"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={4}
            required
          />
        </label>

        <label className="form-field">
          <span className="form-label">رقم واتساب (اختياري)</span>
          <input
            type="tel"
            dir="ltr"
            className="search-input"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            placeholder="+201001234567"
          />
          <span className="form-hint">
            عند إدخاله يظهر زر «تواصل واتساب» في بروفايلك.
          </span>
        </label>

        <div className="form-field">
          <span className="form-label">المراحل الدراسية التي تدرّسها *</span>
          <div className="stages-picker" role="group" aria-label="المراحل الدراسية">
            {STAGES.map((s) => (
              <label
                key={s}
                className={`stage-option ${stages.includes(s) ? "stage-option-active" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={stages.includes(s)}
                  onChange={() => toggleStage(s)}
                />
                {s}
              </label>
            ))}
          </div>
        </div>

        {savedMsg && (
          <p className="form-success">✓ حُفظت التعديلات — بروفايلك محدّث الآن.</p>
        )}

        <div className="form-actions">
          <button type="submit" className="btn btn-primary btn-lg">
            حفظ التعديلات
          </button>
          <Link href={`/teacher/${teacher.slug}`} className="btn btn-outline">
            عرض بروفايلي
          </Link>
        </div>
      </form>
    </main>
  );
}
