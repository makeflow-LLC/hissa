"use client";

import { useRef, useState, useTransition } from "react";
import { aiFormat, aiQuiz, aiSummarize, aiSummarizePdf } from "@/app/actions/ai";
import { createClient } from "@/lib/supabase/client";

export interface AiQuizQuestion {
  prompt: string;
  options: string[];
  correct_index: number;
}

type Mode = "summary" | "quiz" | null;

/** حدّ الحاوية نفسها — نرفضه هنا كي لا ينتظر المعلّم رفعاً سيفشل */
const MAX_PDF_BYTES = 20 * 1024 * 1024;

interface PickedPdf {
  name: string;
  path: string;
  size: string;
}

function humanSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} ك.ب`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} م.ب`;
}

/**
 * مساعد الذكاء الاصطناعي داخل نموذج الدرس.
 *
 * مبدأ ثابت: النموذج **يقترح ولا ينشر**. كل نتيجة تُدرَج في المحرّر
 * ليراجعها المعلّم ويعدّلها قبل الحفظ — فخطأ علمي منشور باسمه يضرّه.
 */
export default function AiAssistPanel({
  lessonId,
  enabled,
  getDraft,
  onSummary,
  onQuiz,
}: {
  /** فارغ لدرس لم يُحفظ بعد — الأدوات تعمل على المكتوب في المحرّر */
  lessonId: string;
  /** يُعطَّل فقط حين لا يكون مفتاح النموذج مضبوطاً */
  enabled: boolean;
  /** يقرأ ما في المحرّر لحظة الضغط، لا ما هو محفوظ في قاعدة البيانات */
  getDraft: () => { html: string; title: string };
  onSummary: (html: string) => void;
  onQuiz: (questions: AiQuizQuestion[]) => void;
}) {
  const [mode, setMode] = useState<Mode>(null);
  const [note, setNote] = useState("");
  const [count, setCount] = useState(5);
  const [busy, startBusy] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [pdf, setPdf] = useState<PickedPdf | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!enabled) {
    return (
      <div className="ai-panel ai-panel-off">
        <span className="ai-badge">✨ مساعد الذكاء الاصطناعي</span>
        <p className="form-hint">
          مفتاح النموذج غير مضبوط على الخادم، فالأدوات معطّلة.
        </p>
      </div>
    );
  }

  /**
   * رفع الملفّ إلى مجلد المعلّم في الحاوية — نفس مسار المرفقات وسياستها.
   * لا يصل الإجراءَ الخادميّ إلا **مسارُه**، فجسم الطلب يبقى صغيراً مهما
   * كبر الملفّ.
   */
  async function pickPdf(file: File | undefined) {
    if (!file) return;
    setMsg(null);
    if (!/\.pdf$/i.test(file.name) && file.type !== "application/pdf") {
      setMsg({ ok: false, text: "اختر ملفّ PDF." });
      return;
    }
    if (file.size > MAX_PDF_BYTES) {
      setMsg({ ok: false, text: "الملفّ أكبر من ٢٠ ميجابايت." });
      return;
    }
    setUploading(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("انتهت الجلسة — سجّل الدخول مجدداً.");

      const path = `${user.id}/${crypto.randomUUID()}.pdf`;
      const { error } = await supabase.storage
        .from("lesson-media")
        .upload(path, file, { contentType: "application/pdf" });
      if (error) throw new Error(error.message);

      setPdf({ name: file.name, path, size: humanSize(file.size) });
    } catch (e) {
      setMsg({
        ok: false,
        text: e instanceof Error ? e.message : "تعذّر رفع الملفّ.",
      });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  /** حذف النسخة المؤقّتة — الملفّ خدم غرضه ولا داعي لبقائه في الحاوية */
  async function dropPdf(path: string) {
    try {
      await createClient().storage.from("lesson-media").remove([path]);
    } catch {
      // فشل الحذف لا يعني فشل التلخيص، فلا نزعج المعلّم به
    }
  }

  function run(kind: "summary" | "quiz") {
    setMsg(null);
    startBusy(async () => {
      // نلتقط ما في المحرّر الآن — لا يلزم حفظ الدرس قبل الاستفادة
      const draft = getDraft();
      const res =
        kind === "summary"
          ? pdf
            ? await aiSummarizePdf(lessonId, pdf.path, note, draft)
            : await aiSummarize(lessonId, note, draft)
          : await aiQuiz(lessonId, count, note, draft);

      if (pdf) {
        await dropPdf(pdf.path);
        setPdf(null);
      }

      if (!res.ok) {
        setMsg({ ok: false, text: res.message ?? "تعذّر التنفيذ." });
        return;
      }
      if (typeof res.remaining === "number") setRemaining(res.remaining);

      if (kind === "summary" && res.html) {
        onSummary(res.html);
        setMsg({
          ok: true,
          text: res.pages
            ? `قرأ النموذج ${res.pages} صفحة وأضاف الملخّص كقسم جديد — راجعه وعدّله.`
            : "أُضيف الملخّص كقسم جديد — راجعه وعدّله.",
        });
      } else if (kind === "quiz" && res.quiz) {
        onQuiz(res.quiz);
        setMsg({
          ok: true,
          text: `أُضيفت ${res.quiz.length} أسئلة — راجع الإجابات الصحيحة قبل الحفظ.`,
        });
      }
      setMode(null);
      setNote("");
    });
  }

  return (
    <div className="ai-panel">
      <div className="ai-panel-head">
        <span className="ai-badge">✨ مساعد الذكاء الاصطناعي</span>
        {remaining !== null && (
          <span className="ai-remaining">بقي لك {remaining} توليدة هذا الشهر</span>
        )}
      </div>

      <p className="form-hint">
        يقترح ولا ينشر — كل نتيجة تُدرَج في المحرّر لتراجعها وتعدّلها قبل الحفظ.
        يراعي المادة والمرحلة الدراسية المسجّلة في ملفك.
      </p>

      <div className="ai-actions">
        <button
          type="button"
          className={`btn btn-outline btn-sm ${mode === "summary" ? "btn-active" : ""}`}
          onClick={() => setMode(mode === "summary" ? null : "summary")}
          disabled={busy}
        >
          📝 لخّص الدرس
        </button>
        <button
          type="button"
          className={`btn btn-outline btn-sm ${mode === "quiz" ? "btn-active" : ""}`}
          onClick={() => setMode(mode === "quiz" ? null : "quiz")}
          disabled={busy}
        >
          ❓ اقترح أسئلة
        </button>
      </div>

      {mode && (
        <div className="ai-form">
          {/*
            مصدر التلخيص: ما في المحرّر، أو ملفّ PDF للدرس.
            المعلّم كثيراً ما يملك الدرس ملفّاً جاهزاً ولا يريد نسخه في
            المحرّر أولاً لمجرّد أن يُلخَّص.
          */}
          {mode === "summary" && (
            <div className="form-field">
              <span className="form-label">
                📄 لخّص من ملفّ PDF (اختياري)
              </span>
              {pdf ? (
                <div className="ai-pdf-picked">
                  <span aria-hidden="true">📕</span>
                  <span className="ai-pdf-name">{pdf.name}</span>
                  <span className="group-meta">{pdf.size}</span>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    disabled={busy}
                    onClick={() => {
                      dropPdf(pdf.path);
                      setPdf(null);
                    }}
                  >
                    إزالة
                  </button>
                </div>
              ) : (
                <label className="upload-box attach-upload">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="application/pdf,.pdf"
                    className="upload-input"
                    disabled={uploading || busy}
                    onChange={(e) => pickPdf(e.target.files?.[0])}
                  />
                  {uploading ? "⏳ جارٍ الرفع…" : "📄 ارفع ملفّ الدرس (PDF)"}
                </label>
              )}
              <span className="form-hint">
                يقرأ النموذج صفحات الملفّ بنفسه — حتى المصوَّرة ضوئياً —
                ثم يلخّصه. وإن تركته فارغاً لُخِّص ما في المحرّر. حتى ٣٠
                صفحة، ويُحذف الملفّ بعد التلخيص.
              </span>
            </div>
          )}

          {mode === "quiz" && (
            <label className="form-field">
              <span className="form-label">عدد الأسئلة</span>
              <select
                className="filter-select"
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
              >
                {[3, 5, 7, 10].map((n) => (
                  <option key={n} value={n}>
                    {n} أسئلة
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="form-field">
            <span className="form-label">🎯 توصياتك للنموذج (اختياري)</span>
            <textarea
              className="search-input form-textarea"
              rows={2}
              maxLength={500}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                mode === "summary"
                  ? "مثال: ركّز على القوانين وأضف جدول مقارنة، وتجنّب الأمثلة الطويلة."
                  : "مثال: اجعل سؤالين تطبيقيين على حساب المساحة، وتجنّب أسئلة التعريف."
              }
            />
            <span className="form-hint">
              وجّه النموذج بما تريده بالضبط — سيلتزم بتوصياتك.
            </span>
          </label>

          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => run(mode)}
            disabled={busy || uploading}
          >
            {busy
              ? "⏳ جارٍ التوليد… (قد يستغرق نصف دقيقة)"
              : mode === "summary" && pdf
                ? "✨ لخّص من الملفّ"
                : "✨ ولّد الآن"}
          </button>
        </div>
      )}

      {msg && (
        <p className={msg.ok ? "form-success" : "form-error"}>{msg.text}</p>
      )}
    </div>
  );
}

/** زر تحسين تنسيق قسم واحد — يعيد النص منسّقاً بالمعنى نفسه */
export function AiFormatButton({
  lessonId,
  html,
  title,
  enabled,
  onResult,
}: {
  lessonId: string;
  html: string;
  /** عنوان الدرس كما هو في النموذج الآن — يوجّه صياغة النموذج */
  title?: string;
  enabled: boolean;
  onResult: (html: string) => void;
}) {
  const [busy, startBusy] = useTransition();
  const [err, setErr] = useState("");

  if (!enabled) return null;

  return (
    <>
      <button
        type="button"
        className="btn btn-outline btn-sm ai-format-btn"
        disabled={busy}
        onClick={() => {
          setErr("");
          startBusy(async () => {
            const res = await aiFormat(lessonId, html, "", { title });
            if (res.ok && res.html) onResult(res.html);
            else setErr(res.message ?? "تعذّر التنسيق.");
          });
        }}
        title="إعادة تنسيق هذا القسم دون تغيير معناه"
      >
        {busy ? "⏳ جارٍ التنسيق…" : "✨ حسّن التنسيق"}
      </button>
      {err && <p className="form-error">{err}</p>}
    </>
  );
}
