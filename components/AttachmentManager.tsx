"use client";

import { useActionState, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  addAttachment,
  type ContentFormState,
} from "@/app/actions/teacher-content";
import { createClient } from "@/lib/supabase/client";
import type { AttachmentRow } from "@/lib/data/types";

const initialState: ContentFormState = { ok: false };

/** نوع المرفق من امتداد الملف — لاختيار الأيقونة والتصنيف */
function kindOf(file: File): string {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return "pdf";
  if (["doc", "docx", "rtf", "txt"].includes(ext)) return "doc";
  if (["ppt", "pptx"].includes(ext)) return "slides";
  if (["xls", "xlsx", "csv"].includes(ext)) return "sheet";
  if (["png", "jpg", "jpeg", "webp", "gif"].includes(ext)) return "image";
  return "other";
}

function iconOf(kind: string): string {
  return (
    { pdf: "📕", worksheet: "📄", doc: "📝", slides: "📊", sheet: "📈", image: "🖼️" }[
      kind
    ] ?? "📎"
  );
}

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} ب`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} ك.ب`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} م.ب`;
}

const MAX_BYTES = 20 * 1024 * 1024;

/**
 * مرفقات الدرس: رفع الملف مباشرةً من المتصفح إلى حاوية lesson-media
 * داخل مجلد المستخدم، ثم تسجيل بياناته بإجراء خادم يتحقّق من ملكية
 * الدرس. المرفقات تظهر للطلاب المسجّلين فقط (سياسة RLS من 0004).
 */
export default function AttachmentManager({
  lessonId,
  initial,
}: {
  lessonId: string;
  initial: AttachmentRow[];
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(addAttachment, initialState);
  const fileRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState("");
  const [pending, setPending] = useState<{
    name: string;
    path: string;
    size: string;
    kind: string;
  } | null>(null);

  async function onPick(file: File | undefined) {
    if (!file) return;
    setUploadErr("");
    if (file.size > MAX_BYTES) {
      setUploadErr("الملف أكبر من ٢٠ ميجابايت.");
      return;
    }
    setUploading(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("انتهت الجلسة — سجّل الدخول مجدداً.");

      const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
      // المسار يبدأ بمعرّف المستخدم ليطابق سياسة التخزين
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("lesson-media")
        .upload(path, file, { contentType: file.type || undefined });
      if (error) throw new Error(error.message);

      const {
        data: { publicUrl },
      } = supabase.storage.from("lesson-media").getPublicUrl(path);

      setPending({
        name: file.name,
        path: publicUrl,
        size: humanSize(file.size),
        kind: kindOf(file),
      });
    } catch (e) {
      setUploadErr(e instanceof Error ? e.message : "تعذّر رفع الملف.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function removeAttachment(id: string) {
    const supabase = createClient();
    await supabase.from("lesson_attachments").delete().eq("id", id);
    router.refresh();
  }

  return (
    <div className="form-field">
      <span className="form-label">📎 مرفقات الدرس</span>
      <span className="form-hint">
        ملفات يحمّلها الطلاب المسجّلون — أوراق عمل، ملخّصات، واجبات. حتى ٢٠
        ميجابايت للملف.
      </span>

      {initial.length > 0 && (
        <ul className="attach-manage-list">
          {initial.map((a) => (
            <li key={a.id} className="attach-manage-row">
              <span aria-hidden="true">{iconOf(a.kind)}</span>
              <span className="attach-manage-name">{a.name}</span>
              {a.size && <span className="attach-manage-size">{a.size}</span>}
              <button
                type="button"
                className="btn btn-outline btn-sm btn-danger"
                onClick={() => removeAttachment(a.id)}
                aria-label={`حذف ${a.name}`}
              >
                🗑
              </button>
            </li>
          ))}
        </ul>
      )}

      {pending ? (
        <form ref={formRef} action={formAction} className="attach-pending">
          <input type="hidden" name="lessonId" value={lessonId} />
          <input type="hidden" name="file_path" value={pending.path} />
          <input type="hidden" name="size" value={pending.size} />
          <input type="hidden" name="kind" value={pending.kind} />
          <span aria-hidden="true">{iconOf(pending.kind)}</span>
          <input
            type="text"
            name="name"
            className="search-input"
            defaultValue={pending.name}
            aria-label="اسم المرفق كما يراه الطالب"
            required
          />
          <button
            type="submit"
            className="btn btn-primary btn-sm"
            onClick={() => setTimeout(() => setPending(null), 100)}
          >
            إضافة
          </button>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => setPending(null)}
          >
            إلغاء
          </button>
        </form>
      ) : (
        <label className="upload-box attach-upload">
          <input
            ref={fileRef}
            type="file"
            className="upload-input"
            disabled={uploading}
            onChange={(e) => onPick(e.target.files?.[0])}
          />
          {uploading ? "⏳ جارٍ الرفع…" : "📎 رفع مرفق"}
        </label>
      )}

      {uploadErr && <p className="form-error">{uploadErr}</p>}
      {state.message && (
        <p className={state.ok ? "form-success" : "form-error"}>{state.message}</p>
      )}
    </div>
  );
}
