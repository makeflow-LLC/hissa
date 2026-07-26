"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Teacher } from "@/lib/teachers";
import { useTeacherAuth } from "@/lib/useTeacherAuth";
import {
  useLessonDrafts,
  type DraftMedia,
  type DraftMediaKind,
  type QuizQuestion,
} from "@/lib/useLessonDrafts";
import { saveMedia, formatSize } from "@/lib/mediaStore";

const EMOJI_CHOICES = ["📚", "🎬", "🧪", "📐", "✏️", "🌍", "💡", "🎯", "🧠", "⚡"];

interface QuestionDraft {
  key: number;
  prompt: string;
  options: string[];
  correctIndex: number;
}

const emptyQuestion = (key: number): QuestionDraft => ({
  key,
  prompt: "",
  options: ["", "", "", ""],
  correctIndex: 0,
});

export default function NewLessonPage() {
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

  return <NewLessonForm teacher={teacher} />;
}

function NewLessonForm({ teacher }: { teacher: Teacher }) {
  const { addDraft } = useLessonDrafts(teacher.slug);

  const [kind, setKind] = useState<"recorded" | "live">("recorded");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [unitTitle, setUnitTitle] = useState(teacher.units[0]?.title ?? "");
  const [duration, setDuration] = useState("٤٥ دقيقة");
  const [emoji, setEmoji] = useState(EMOJI_CHOICES[0]);
  const [detail, setDetail] = useState("");

  const [images, setImages] = useState<File[]>([]);
  const [video, setVideo] = useState<File | null>(null);
  const [files, setFiles] = useState<File[]>([]);

  const [questions, setQuestions] = useState<QuestionDraft[]>([]);
  const questionKey = useRef(0);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saved, setSaved] = useState(false);

  function updateQuestion(key: number, patch: Partial<QuestionDraft>) {
    setQuestions((qs) => qs.map((q) => (q.key === key ? { ...q, ...patch } : q)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError("");
    try {
      const media: DraftMedia[] = [];
      const uploads: { file: File; kind: DraftMediaKind }[] = [
        ...images.map((f) => ({ file: f, kind: "image" as const })),
        ...(video ? [{ file: video, kind: "video" as const }] : []),
        ...files.map((f) => ({ file: f, kind: "file" as const })),
      ];
      for (const { file, kind: mediaKind } of uploads) {
        const id = `media-${crypto.randomUUID()}`;
        await saveMedia(id, file);
        media.push({
          id,
          kind: mediaKind,
          name: file.name,
          mime: file.type,
          size: formatSize(file.size),
        });
      }

      const quiz: QuizQuestion[] = questions
        .map((q) => {
          const options = q.options.map((o) => o.trim()).filter(Boolean);
          return {
            id: `q-${q.key}`,
            prompt: q.prompt.trim(),
            options,
            correctIndex: Math.min(q.correctIndex, Math.max(options.length - 1, 0)),
          };
        })
        .filter((q) => q.prompt && q.options.length >= 2);

      addDraft({
        kind,
        title: title.trim(),
        description: description.trim(),
        unitTitle: kind === "recorded" ? unitTitle : "حصة مباشرة",
        duration,
        emoji,
        detail: detail.trim(),
        media,
        quiz,
      });
      setSaved(true);
    } catch {
      setSaveError("تعذّر حفظ الملفات المرفوعة — جرّب ملفات أصغر أو أعد المحاولة.");
    } finally {
      setSaving(false);
    }
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
            حُفظت «{title}» وأصبحت ظاهرة الآن في بروفايلك ضمن قسم{" "}
            {kind === "recorded" ? "«الدروس المسجّلة»" : "«الحصص المباشرة»"}.
          </p>
          <div className="save-success-actions">
            <Link href={`/teacher/${teacher.slug}`} className="btn btn-primary">
              عرضها في البروفايل
            </Link>
            <Link href="/teacher-dashboard" className="btn btn-outline">
              لوحة التحكم
            </Link>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => {
                setSaved(false);
                setTitle("");
                setDescription("");
                setDetail("");
                setImages([]);
                setVideo(null);
                setFiles([]);
                setQuestions([]);
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
        <Link href="/teacher-dashboard" className="back-link">
          → لوحة التحكم
        </Link>
      </nav>

      <h1 className="dashboard-title">تصميم حصة جديدة</h1>
      <p className="dashboard-subtitle form-page-subtitle">
        صمّم درساً مسجّلاً يُضاف لمنهجك أو حصة مباشرة يحجزها طلابك — ستظهر الحصة
        في بروفايلك فور الحفظ.
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

        {/* ===== المرفقات والوسائط ===== */}
        <fieldset className="form-section">
          <legend className="form-section-title">📎 الوسائط والمرفقات</legend>

          {kind === "recorded" && (
            <div className="form-field">
              <span className="form-label">فيديو الدرس</span>
              <label className="upload-box">
                <input
                  type="file"
                  accept="video/*"
                  className="upload-input"
                  onChange={(e) => setVideo(e.target.files?.[0] ?? null)}
                />
                🎞️ {video ? "استبدال الفيديو" : "اختر ملف فيديو"}
              </label>
              {video && (
                <ul className="upload-chips">
                  <li className="upload-chip">
                    <span className="upload-chip-name">{video.name}</span>
                    <span className="upload-chip-size">{formatSize(video.size)}</span>
                    <button
                      type="button"
                      className="upload-chip-remove"
                      onClick={() => setVideo(null)}
                      aria-label={`إزالة ${video.name}`}
                    >
                      ✕
                    </button>
                  </li>
                </ul>
              )}
            </div>
          )}

          <div className="form-field">
            <span className="form-label">صور ورسومات توضيحية</span>
            <label className="upload-box">
              <input
                type="file"
                accept="image/*"
                multiple
                className="upload-input"
                onChange={(e) => {
                  // نلتقط الملفات فوراً: تفريغ value يمسح FileList قبل أن
                  // تُنفَّذ دالة التحديث المؤجلة
                  const picked = Array.from(e.target.files ?? []);
                  setImages((prev) => [...prev, ...picked]);
                  e.target.value = "";
                }}
              />
              🖼️ أضف صوراً (يمكن اختيار أكثر من صورة)
            </label>
            {images.length > 0 && (
              <ul className="upload-chips">
                {images.map((f, i) => (
                  <li key={`${f.name}-${i}`} className="upload-chip">
                    <span className="upload-chip-name">{f.name}</span>
                    <span className="upload-chip-size">{formatSize(f.size)}</span>
                    <button
                      type="button"
                      className="upload-chip-remove"
                      onClick={() => setImages((prev) => prev.filter((_, j) => j !== i))}
                      aria-label={`إزالة ${f.name}`}
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="form-field">
            <span className="form-label">ملفات ومرفقات (PDF، أوراق عمل…)</span>
            <label className="upload-box">
              <input
                type="file"
                multiple
                className="upload-input"
                onChange={(e) => {
                  const picked = Array.from(e.target.files ?? []);
                  setFiles((prev) => [...prev, ...picked]);
                  e.target.value = "";
                }}
              />
              📄 أضف ملفات مرفقة
            </label>
            {files.length > 0 && (
              <ul className="upload-chips">
                {files.map((f, i) => (
                  <li key={`${f.name}-${i}`} className="upload-chip">
                    <span className="upload-chip-name">{f.name}</span>
                    <span className="upload-chip-size">{formatSize(f.size)}</span>
                    <button
                      type="button"
                      className="upload-chip-remove"
                      onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                      aria-label={`إزالة ${f.name}`}
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </fieldset>

        {/* ===== أسئلة الاختبار ===== */}
        <fieldset className="form-section">
          <legend className="form-section-title">❓ أسئلة الاختبار</legend>
          <p className="form-hint">
            أضف أسئلة اختيار من متعدد يحلها الطالب في نهاية الحصة (اختياري).
          </p>

          {questions.map((q, qi) => (
            <div key={q.key} className="question-card">
              <div className="question-head">
                <span className="question-number">السؤال {qi + 1}</span>
                <button
                  type="button"
                  className="upload-chip-remove"
                  onClick={() => setQuestions((qs) => qs.filter((x) => x.key !== q.key))}
                  aria-label={`حذف السؤال ${qi + 1}`}
                >
                  ✕
                </button>
              </div>
              <input
                type="text"
                className="search-input"
                value={q.prompt}
                onChange={(e) => updateQuestion(q.key, { prompt: e.target.value })}
                placeholder="نص السؤال"
              />
              <div className="question-options">
                {q.options.map((opt, oi) => (
                  <label key={oi} className="question-option">
                    <input
                      type="radio"
                      name={`correct-${q.key}`}
                      checked={q.correctIndex === oi}
                      onChange={() => updateQuestion(q.key, { correctIndex: oi })}
                      title="حدد الإجابة الصحيحة"
                    />
                    <input
                      type="text"
                      className="search-input"
                      value={opt}
                      onChange={(e) =>
                        updateQuestion(q.key, {
                          options: q.options.map((o, j) => (j === oi ? e.target.value : o)),
                        })
                      }
                      placeholder={`الخيار ${oi + 1}${oi < 2 ? " *" : " (اختياري)"}`}
                    />
                  </label>
                ))}
              </div>
              <p className="form-hint">حدد الدائرة بجانب الإجابة الصحيحة.</p>
            </div>
          ))}

          <button
            type="button"
            className="btn btn-outline"
            onClick={() =>
              setQuestions((qs) => [...qs, emptyQuestion(questionKey.current++)])
            }
          >
            ＋ أضف سؤالاً
          </button>
        </fieldset>

        {saveError && <p className="form-error">{saveError}</p>}

        <div className="form-actions">
          <button type="submit" className="btn btn-primary btn-lg" disabled={saving}>
            {saving ? "جارٍ الحفظ…" : "حفظ الحصة"}
          </button>
          <Link href="/teacher-dashboard" className="btn btn-outline">
            إلغاء
          </Link>
        </div>
      </form>
    </main>
  );
}
