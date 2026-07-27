"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  saveLesson,
  type ContentFormState,
} from "@/app/actions/teacher-content";

const EMOJIS = ["📚", "✏️", "🧮", "🔬", "🧪", "🌍", "📖", "💡", "🎯", "🧠", "📝", "🔤"];

export interface LessonFormInitial {
  id: string;
  unit_id: string | null;
  title: string;
  description: string;
  duration: string;
  emoji: string;
  video_url: string | null;
  status: string;
  is_free_preview: boolean;
  sections: { heading: string; paragraphs: string[] }[];
  quiz: { prompt: string; options: string[]; correct_index: number }[];
}

interface SectionUI {
  heading: string;
  body: string;
}
interface QuizUI {
  prompt: string;
  options: string[];
  correct_index: number;
}

const initialState: ContentFormState = { ok: false };

export default function LessonForm({
  units,
  initial,
}: {
  units: { id: string; title: string }[];
  initial: LessonFormInitial | null;
}) {
  const router = useRouter();
  const isEdit = Boolean(initial);
  const [state, formAction, pending] = useActionState(saveLesson, initialState);

  const [emoji, setEmoji] = useState(initial?.emoji ?? "📚");
  const [sections, setSections] = useState<SectionUI[]>(
    initial?.sections?.length
      ? initial.sections.map((s) => ({
          heading: s.heading,
          body: s.paragraphs.join("\n\n"),
        }))
      : [{ heading: "", body: "" }]
  );
  const [quiz, setQuiz] = useState<QuizUI[]>(
    initial?.quiz?.map((q) => ({
      prompt: q.prompt,
      options: [...q.options, "", "", "", ""].slice(0, 4),
      correct_index: q.correct_index,
    })) ?? []
  );

  useEffect(() => {
    if (state.ok) router.push("/teacher/me/content");
  }, [state, router]);

  const sectionsJson = useMemo(
    () =>
      JSON.stringify(
        sections
          .map((s) => ({
            heading: s.heading.trim(),
            paragraphs: s.body
              .split(/\n{2,}/)
              .map((p) => p.trim())
              .filter(Boolean),
          }))
          .filter((s) => s.heading || s.paragraphs.length > 0)
      ),
    [sections]
  );

  const quizJson = useMemo(
    () =>
      JSON.stringify(
        quiz
          .map((q) => ({
            prompt: q.prompt.trim(),
            options: q.options.map((o) => o.trim()).filter(Boolean),
            correct_index: q.correct_index,
          }))
          .filter((q) => q.prompt && q.options.length >= 2)
      ),
    [quiz]
  );

  return (
    <form action={formAction} className="lesson-form">
      {isEdit && <input type="hidden" name="lessonId" value={initial!.id} />}
      <input type="hidden" name="emoji" value={emoji} />
      <input type="hidden" name="sections" value={sectionsJson} />
      <input type="hidden" name="quiz" value={quizJson} />

      <label className="form-field">
        <span className="form-label">عنوان الدرس *</span>
        <input
          type="text"
          name="title"
          className="search-input"
          defaultValue={initial?.title ?? ""}
          placeholder="مثال: مقدمة في الكسور"
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
          placeholder="جملة أو اثنتان تشرح ما سيتعلّمه الطالب"
        />
      </label>

      <div className="form-grid">
        <label className="form-field">
          <span className="form-label">الوحدة</span>
          <select
            name="unit_id"
            className="filter-select"
            defaultValue={initial?.unit_id ?? ""}
          >
            <option value="">— بلا وحدة —</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.title}
              </option>
            ))}
          </select>
        </label>

        <label className="form-field">
          <span className="form-label">المدّة</span>
          <input
            type="text"
            name="duration"
            className="search-input"
            defaultValue={initial?.duration ?? ""}
            placeholder="مثال: ١٢ دقيقة"
          />
        </label>
      </div>

      <div className="form-field">
        <span className="form-label">أيقونة الدرس</span>
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

      <label className="form-field">
        <span className="form-label">رابط الفيديو</span>
        <input
          type="url"
          name="video_url"
          dir="ltr"
          className="search-input"
          defaultValue={initial?.video_url ?? ""}
          placeholder="https://www.youtube.com/watch?v=…  أو رابط MP4"
        />
        <span className="form-hint">
          يدعم يوتيوب (مضمّن داخل الصفحة) أو رابط فيديو MP4 مباشر.
        </span>
      </label>

      {/* أقسام الشرح */}
      <div className="form-field">
        <span className="form-label">الشرح المكتوب</span>
        <div className="repeater">
          {sections.map((s, i) => (
            <div key={i} className="repeater-item">
              <div className="repeater-head">
                <input
                  type="text"
                  className="search-input"
                  value={s.heading}
                  onChange={(e) =>
                    setSections((prev) =>
                      prev.map((x, j) =>
                        j === i ? { ...x, heading: e.target.value } : x
                      )
                    )
                  }
                  placeholder={`عنوان القسم ${i + 1}`}
                />
                {sections.length > 1 && (
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() =>
                      setSections((prev) => prev.filter((_, j) => j !== i))
                    }
                    aria-label="حذف القسم"
                  >
                    ✕
                  </button>
                )}
              </div>
              <textarea
                className="search-input form-textarea"
                rows={3}
                value={s.body}
                onChange={(e) =>
                  setSections((prev) =>
                    prev.map((x, j) => (j === i ? { ...x, body: e.target.value } : x))
                  )
                }
                placeholder="نص الشرح… افصل بين الفقرات بسطر فارغ."
              />
            </div>
          ))}
        </div>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() =>
            setSections((prev) => [...prev, { heading: "", body: "" }])
          }
        >
          ➕ إضافة قسم
        </button>
      </div>

      {/* أسئلة الاختبار */}
      <div className="form-field">
        <span className="form-label">أسئلة اختبار (اختياري)</span>
        <div className="repeater">
          {quiz.map((q, i) => (
            <div key={i} className="repeater-item">
              <div className="repeater-head">
                <input
                  type="text"
                  className="search-input"
                  value={q.prompt}
                  onChange={(e) =>
                    setQuiz((prev) =>
                      prev.map((x, j) =>
                        j === i ? { ...x, prompt: e.target.value } : x
                      )
                    )
                  }
                  placeholder={`نص السؤال ${i + 1}`}
                />
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => setQuiz((prev) => prev.filter((_, j) => j !== i))}
                  aria-label="حذف السؤال"
                >
                  ✕
                </button>
              </div>
              <div className="quiz-options">
                {q.options.map((opt, oi) => (
                  <label key={oi} className="quiz-option-edit">
                    <input
                      type="radio"
                      name={`correct_${i}`}
                      checked={q.correct_index === oi}
                      onChange={() =>
                        setQuiz((prev) =>
                          prev.map((x, j) =>
                            j === i ? { ...x, correct_index: oi } : x
                          )
                        )
                      }
                      aria-label={`الخيار ${oi + 1} صحيح`}
                    />
                    <input
                      type="text"
                      className="search-input"
                      value={opt}
                      onChange={(e) =>
                        setQuiz((prev) =>
                          prev.map((x, j) =>
                            j === i
                              ? {
                                  ...x,
                                  options: x.options.map((o, k) =>
                                    k === oi ? e.target.value : o
                                  ),
                                }
                              : x
                          )
                        )
                      }
                      placeholder={`الخيار ${oi + 1}`}
                    />
                  </label>
                ))}
              </div>
              <span className="form-hint">علّم الدائرة بجانب الإجابة الصحيحة.</span>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() =>
            setQuiz((prev) => [
              ...prev,
              { prompt: "", options: ["", "", "", ""], correct_index: 0 },
            ])
          }
        >
          ➕ إضافة سؤال
        </button>
      </div>

      <div className="form-grid">
        <label className="form-field">
          <span className="form-label">الحالة</span>
          <select
            name="status"
            className="filter-select"
            defaultValue={initial?.status ?? "published"}
          >
            <option value="published">منشور — يراه الطلاب</option>
            <option value="draft">مسودّة — مخفيّة</option>
          </select>
        </label>

        <label className="form-field toggle-field">
          <input
            type="checkbox"
            name="is_free_preview"
            defaultChecked={initial?.is_free_preview ?? false}
          />
          <span>
            <span className="form-label">عيّنة مجانية للزوّار 🎁</span>
            <span className="form-hint">
              درس واحد فقط لكل معلّم يظهر كاملاً لغير المسجّلين.
            </span>
          </span>
        </label>
      </div>

      {state.message && !state.ok && <p className="form-error">{state.message}</p>}

      <div className="form-actions">
        <button type="submit" className="btn btn-primary btn-lg" disabled={pending}>
          {pending ? "جارٍ الحفظ…" : isEdit ? "حفظ التعديلات" : "نشر الدرس"}
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
