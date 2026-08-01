"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  saveExamTemplate,
  deleteExamTemplate,
  type ExamActionState,
} from "@/app/actions/exams";
import InfoTip from "@/components/InfoTip";
import {
  BUILTIN_TEMPLATES,
  templatePoints,
  type ExamTemplate,
  type TemplateQuestion,
} from "@/lib/examTemplates";

const initial: ExamActionState = { ok: false };

/**
 * قوالب الاختبار: جاهزة من المنصة، ومحفوظة من المعلّم نفسه.
 *
 * القالب يُطبَّق **في المحرّر لا في قاعدة البيانات**: يملأ الأسئلة أمام
 * المعلّم ليعدّلها ثم يحفظ. لو كتبناه في الجدول مباشرةً لضاع ما كتبه قبل
 * أن يقرّر أن القالب لا يناسبه.
 */
export default function TemplatePicker({
  myTemplates,
  currentPayload,
  hasQuestions,
  onApply,
}: {
  myTemplates: ExamTemplate[];
  /** أسئلة المحرّر الحالية — لحفظها قالباً */
  currentPayload: string;
  /** هل في المحرّر سؤال مكتوب؟ الاستبدال يمحوه، فنستأذن */
  hasQuestions: boolean;
  onApply: (questions: TemplateQuestion[], mode: "replace" | "append") => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [busy, startTransition] = useTransition();
  const [state, action, pending] = useActionState(saveExamTemplate, initial);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (state.ok) {
      setSaving(false);
      setName("");
      router.refresh();
    }
  }, [state, router]);

  const all: ExamTemplate[] = [
    ...myTemplates.map((t) => ({ ...t, builtin: false })),
    ...BUILTIN_TEMPLATES,
  ];

  function apply(t: ExamTemplate, mode: "replace" | "append") {
    if (
      mode === "replace" &&
      hasQuestions &&
      !window.confirm(
        `سيستبدل القالب «${t.name}» كل الأسئلة المكتوبة الآن. متأكّد؟`
      )
    )
      return;
    onApply(t.questions, mode);
    setOpen(false);
  }

  return (
    <div className="template-picker">
      <div className="card-actions">
        <button
          type="button"
          className="btn btn-outline btn-sm"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          📄 قوالب جاهزة
        </button>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => setSaving((v) => !v)}
        >
          💾 احفظ هذه الأسئلة قالباً
        </button>
        <InfoTip>
          القالب يحفظ <strong>بنية</strong> الاختبار: عدد الأسئلة وأنواعها
          وعلامة كلٍّ منها. تختاره فتجد الهيكل جاهزاً ولا يبقى عليك إلا كتابة
          الأسئلة. قوالب المنصة تبدأ بأسئلة فارغة عمداً — المادة والمرحلة
          تختلفان، والذي يضيع وقتك حقاً هو ضبط النوع والعلامة لكل سؤال.
        </InfoTip>
      </div>

      {saving && (
        <form action={action} className="template-save">
          <input type="hidden" name="questions" value={currentPayload} />
          <input
            type="text"
            name="name"
            className="search-input"
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="اسم القالب (مثال: نموذج اختبار الوحدة)"
            required
          />
          <button
            type="submit"
            className="btn btn-primary btn-sm"
            disabled={pending || !name.trim()}
          >
            {pending ? "…" : "حفظ القالب"}
          </button>
          {state.message && (
            <p className={state.ok ? "form-ok" : "form-error"}>{state.message}</p>
          )}
        </form>
      )}

      {open && (
        <ul className="template-list">
          {all.map((t) => (
            <li key={t.id} className="template-row">
              <div className="template-info">
                <strong className="template-name">
                  {t.builtin ? "📘 " : "⭐ "}
                  {t.name}
                </strong>
                <span className="group-meta">
                  {t.description ||
                    `${t.questions.length} سؤالاً · ${templatePoints(t)} علامة`}
                </span>
              </div>
              <div className="card-actions">
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => apply(t, "replace")}
                >
                  استخدام
                </button>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => apply(t, "append")}
                >
                  إضافة للموجود
                </button>
                {!t.builtin && (
                  <button
                    type="button"
                    className="btn btn-outline btn-sm btn-danger"
                    disabled={busy}
                    onClick={() => {
                      if (!window.confirm(`حذف قالب «${t.name}»؟`)) return;
                      setErr("");
                      startTransition(async () => {
                        const res = await deleteExamTemplate(t.id);
                        if (!res.ok) setErr(res.message ?? "تعذّر الحذف.");
                        router.refresh();
                      });
                    }}
                  >
                    🗑
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {err && <p className="form-error">{err}</p>}
    </div>
  );
}
