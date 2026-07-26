"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Teacher } from "@/lib/teachers";
import { useTeacherAuth } from "@/lib/useTeacherAuth";
import { useLessonDrafts } from "@/lib/useLessonDrafts";

const EMOJI_CHOICES = ["📚", "🎬", "🧪", "📐", "✏️", "🌍", "💡", "🎯", "🧠", "⚡"];

export default function NewLessonPage() {
  const { teacher, loaded } = useTeacherAuth();
  const router = useRouter();

  useEffect(() => {
    if (loaded && !teacher) router.replace("/login");
  }, [loaded, teacher, router]);

  if (!loaded || !teacher) {
    return (
      <main className="container">
        <p className="empty-state">جارٍ التحميل…</p>
      </main>
    );
  }

  return <NewLessonForm teacher={teacher} />;
}

function NewLessonForm({ teacher }: { teacher: Teacher }) {
  const router = useRouter();
  const { addDraft } = useLessonDrafts(teacher.slug);

  const [kind, setKind] = useState<"recorded" | "live">("recorded");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [unitTitle, setUnitTitle] = useState(teacher.units[0]?.title ?? "");
  const [duration, setDuration] = useState("٤٥ دقيقة");
  const [emoji, setEmoji] = useState(EMOJI_CHOICES[0]);
  const [detail, setDetail] = useState("");
  const [saved, setSaved] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    addDraft({
      kind,
      title: title.trim(),
      description: description.trim(),
      unitTitle: kind === "recorded" ? unitTitle : "حصة مباشرة",
      duration,
      emoji,
      detail: detail.trim(),
    });
    setSaved(true);
  }

  if (saved) {
    return (
      <main className="container container-narrow">
        <div className="login-card">
          <span className="save-success-icon" aria-hidden="true">
            🎉
          </span>
          <h1 className="login-title">تم حفظ الحصة بنجاح!</h1>
          <p className="login-subtitle">
            حُفظت «{title}» كمسودة في لوحة التحكم، وستظهر لطلابك فور ربط المنصة
            بالباكند.
          </p>
          <div className="save-success-actions">
            <Link href="/dashboard" className="btn btn-primary">
              العودة للوحة التحكم
            </Link>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => {
                setSaved(false);
                setTitle("");
                setDescription("");
                setDetail("");
              }}
            >
              ＋ تصميم حصة أخرى
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="container container-narrow">
      <nav className="breadcrumb">
        <Link href="/dashboard" className="back-link">
          → لوحة التحكم
        </Link>
      </nav>

      <h1 className="dashboard-title">تصميم حصة جديدة</h1>
      <p className="dashboard-subtitle form-page-subtitle">
        صمّم درساً مسجّلاً يُضاف لمنهجك أو حصة مباشرة يحجزها طلابك.
      </p>

      <form onSubmit={handleSubmit} className="lesson-form">
        <div className="kind-toggle" role="radiogroup" aria-label="نوع الحصة">
          <button
            type="button"
            role="radio"
            aria-checked={kind === "recorded"}
            className={`kind-option ${kind === "recorded" ? "kind-option-active" : ""}`}
            onClick={() => setKind("recorded")}
          >
            🎬 درس مسجّل
            <span className="kind-hint">فيديو يشاهده الطالب في أي وقت</span>
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={kind === "live"}
            className={`kind-option ${kind === "live" ? "kind-option-active" : ""}`}
            onClick={() => setKind("live")}
          >
            🔴 حصة مباشرة
            <span className="kind-hint">جلسة بموعد محدد يحجزها الطالب</span>
          </button>
        </div>

        <label className="form-field">
          <span className="form-label">عنوان الحصة *</span>
          <input
            type="text"
            className="search-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={kind === "recorded" ? "مثال: قواعد الاشتقاق" : "مثال: مراجعة ليلة الامتحان"}
            required
          />
        </label>

        <label className="form-field">
          <span className="form-label">وصف قصير *</span>
          <input
            type="text"
            className="search-input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="جملة تشوّق الطالب لمحتوى الحصة"
            required
          />
        </label>

        <div className="form-grid">
          {kind === "recorded" && (
            <label className="form-field">
              <span className="form-label">الوحدة</span>
              <select
                className="filter-select"
                value={unitTitle}
                onChange={(e) => setUnitTitle(e.target.value)}
              >
                {teacher.units.map((u) => (
                  <option key={u.id} value={u.title}>
                    {u.title}
                  </option>
                ))}
                <option value="وحدة جديدة">＋ وحدة جديدة</option>
              </select>
            </label>
          )}

          <label className="form-field">
            <span className="form-label">المدة</span>
            <select
              className="filter-select"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            >
              {["٣٠ دقيقة", "٤٥ دقيقة", "٦٠ دقيقة", "٧٥ دقيقة", "٩٠ دقيقة", "١٢٠ دقيقة"].map(
                (d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                )
              )}
            </select>
          </label>

          <div className="form-field">
            <span className="form-label">أيقونة الحصة</span>
            <div className="emoji-picker" role="radiogroup" aria-label="اختر أيقونة">
              {EMOJI_CHOICES.map((e) => (
                <button
                  key={e}
                  type="button"
                  role="radio"
                  aria-checked={emoji === e}
                  className={`emoji-option ${emoji === e ? "emoji-option-active" : ""}`}
                  onClick={() => setEmoji(e)}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
        </div>

        <label className="form-field">
          <span className="form-label">
            {kind === "recorded" ? "نص الشرح (مسودة أولية)" : "موعد الحصة *"}
          </span>
          {kind === "recorded" ? (
            <textarea
              className="search-input form-textarea"
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              rows={5}
              placeholder="اكتب النقاط الرئيسية لشرح الدرس — يمكنك استكمالها لاحقاً"
            />
          ) : (
            <input
              type="text"
              className="search-input"
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              placeholder="مثال: السبت ١٥ أغسطس — ٧:٠٠ مساءً"
              required
            />
          )}
        </label>

        <div className="form-actions">
          <button type="submit" className="btn btn-primary btn-lg">
            حفظ الحصة
          </button>
          <Link href="/dashboard" className="btn btn-outline">
            إلغاء
          </Link>
        </div>
      </form>
    </main>
  );
}
