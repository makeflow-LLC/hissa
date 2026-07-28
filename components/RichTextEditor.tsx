"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { TextStyleKit } from "@tiptap/extension-text-style";
import { TableKit } from "@tiptap/extension-table";
import { Image } from "@tiptap/extension-image";
import { TextAlign } from "@tiptap/extension-text-align";
import { createClient } from "@/lib/supabase/client";

/** ألوان جاهزة — تكفي لتمييز الكلمات دون إغراق المعلّم بمنتقي ألوان */
const COLORS = [
  { label: "أسود", value: "" },
  { label: "أحمر", value: "#dc2626" },
  { label: "أزرق", value: "#2563eb" },
  { label: "أخضر", value: "#16a34a" },
  { label: "برتقالي", value: "#ea580c" },
  { label: "بنفسجي", value: "#7c3aed" },
];

const FONT_SIZES = [
  { label: "عادي", value: "" },
  { label: "صغير", value: "0.875rem" },
  { label: "كبير", value: "1.25rem" },
  { label: "كبير جداً", value: "1.5rem" },
];

/** يصغّر الصورة قبل الرفع حتى لا تُثقل صفحة الدرس على الجوال */
function shrinkImage(file: File, maxWidth = 1280): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      URL.revokeObjectURL(url);
      if (!ctx) {
        reject(new Error("no ctx"));
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("no blob"))),
        "image/jpeg",
        0.85
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("bad image"));
    };
    img.src = url;
  });
}

function ToolbarButton({
  onClick,
  active,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={`rte-btn ${active ? "rte-btn-active" : ""}`}
      onMouseDown={(e) => e.preventDefault()} // لا نفقد تحديد النص
      onClick={onClick}
      title={title}
      aria-label={title}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState("");

  const insertImage = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      setUploadErr("");
      setUploading(true);
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error("انتهت الجلسة — سجّل الدخول مجدداً.");

        const blob = await shrinkImage(file);
        // المسار يبدأ بمعرّف المستخدم لتطابق سياسة التخزين
        const path = `${user.id}/${crypto.randomUUID()}.jpg`;
        const { error } = await supabase.storage
          .from("lesson-media")
          .upload(path, blob, { contentType: "image/jpeg", upsert: false });
        if (error) throw new Error(error.message);

        const {
          data: { publicUrl },
        } = supabase.storage.from("lesson-media").getPublicUrl(path);
        editor.chain().focus().setImage({ src: publicUrl }).run();
      } catch (e) {
        setUploadErr(e instanceof Error ? e.message : "تعذّر رفع الصورة.");
      } finally {
        setUploading(false);
        if (fileRef.current) fileRef.current.value = "";
      }
    },
    [editor]
  );

  return (
    <div className="rte-toolbar">
      <div className="rte-group">
        <ToolbarButton
          title="عريض"
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <strong>ب</strong>
        </ToolbarButton>
        <ToolbarButton
          title="مائل"
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <em>م</em>
        </ToolbarButton>
        <ToolbarButton
          title="تسطير"
          active={editor.isActive("underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <u>س</u>
        </ToolbarButton>
      </div>

      <div className="rte-group">
        <ToolbarButton
          title="عنوان فرعي"
          active={editor.isActive("heading", { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          عنوان
        </ToolbarButton>
        <select
          className="rte-select"
          aria-label="حجم الخط"
          title="حجم الخط"
          value={(editor.getAttributes("textStyle").fontSize as string) ?? ""}
          onChange={(e) => {
            const v = e.target.value;
            if (v) editor.chain().focus().setFontSize(v).run();
            else editor.chain().focus().unsetFontSize().run();
          }}
        >
          {FONT_SIZES.map((f) => (
            <option key={f.label} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
        <select
          className="rte-select"
          aria-label="لون النص"
          title="لون النص"
          value={(editor.getAttributes("textStyle").color as string) ?? ""}
          onChange={(e) => {
            const v = e.target.value;
            if (v) editor.chain().focus().setColor(v).run();
            else editor.chain().focus().unsetColor().run();
          }}
        >
          {COLORS.map((c) => (
            <option key={c.label} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <div className="rte-group">
        <ToolbarButton
          title="نقاط"
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          ⦁ نقاط
        </ToolbarButton>
        <ToolbarButton
          title="ترقيم"
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          ١. ترقيم
        </ToolbarButton>
      </div>

      <div className="rte-group">
        <ToolbarButton
          title="محاذاة لليمين"
          active={editor.isActive({ textAlign: "right" })}
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
        >
          ➡
        </ToolbarButton>
        <ToolbarButton
          title="توسيط"
          active={editor.isActive({ textAlign: "center" })}
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
        >
          ↔
        </ToolbarButton>
        <ToolbarButton
          title="محاذاة لليسار"
          active={editor.isActive({ textAlign: "left" })}
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
        >
          ⬅
        </ToolbarButton>
      </div>

      <div className="rte-group">
        <ToolbarButton
          title="إدراج جدول ٣×٣"
          onClick={() =>
            editor
              .chain()
              .focus()
              .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
              .run()
          }
        >
          ▦ جدول
        </ToolbarButton>
        {editor.isActive("table") && (
          <>
            <ToolbarButton
              title="إضافة عمود"
              onClick={() => editor.chain().focus().addColumnAfter().run()}
            >
              +عمود
            </ToolbarButton>
            <ToolbarButton
              title="إضافة صف"
              onClick={() => editor.chain().focus().addRowAfter().run()}
            >
              +صف
            </ToolbarButton>
            <ToolbarButton
              title="حذف عمود"
              onClick={() => editor.chain().focus().deleteColumn().run()}
            >
              −عمود
            </ToolbarButton>
            <ToolbarButton
              title="حذف صف"
              onClick={() => editor.chain().focus().deleteRow().run()}
            >
              −صف
            </ToolbarButton>
            <ToolbarButton
              title="حذف الجدول"
              onClick={() => editor.chain().focus().deleteTable().run()}
            >
              🗑 جدول
            </ToolbarButton>
          </>
        )}
      </div>

      <div className="rte-group">
        <label className="rte-btn rte-btn-upload" title="إدراج صورة">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="upload-input"
            disabled={uploading}
            onChange={(e) => insertImage(e.target.files?.[0])}
          />
          {uploading ? "⏳ جارٍ الرفع…" : "🖼️ صورة"}
        </label>
        <ToolbarButton
          title="خط فاصل"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
        >
          ―
        </ToolbarButton>
        <ToolbarButton
          title="إزالة التنسيق"
          onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
        >
          ✧ تنظيف
        </ToolbarButton>
      </div>

      {uploadErr && <p className="form-error rte-error">{uploadErr}</p>}
    </div>
  );
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}) {
  const lastEmitted = useRef<string | null>(null);

  const editor = useEditor({
    // نمنع التصيير على الخادم: TipTap يحتاج DOM
    immediatelyRender: false,
    extensions: [
      StarterKit,
      TextStyleKit,
      TableKit.configure({ table: { resizable: false } }),
      Image.configure({ inline: false, allowBase64: false }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
    ],
    content: value || "",
    editorProps: {
      attributes: {
        class: "rte-content",
        dir: "rtl",
        ...(placeholder ? { "data-placeholder": placeholder } : {}),
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      // نتذكّر ما أرسلناه للأب حتى لا نعيد كتابته على المحرّر ونقفز بالمؤشّر
      lastEmitted.current = html;
      onChange(html);
    },
  });

  /**
   * مزامنة المحتوى القادم من الأب.
   *
   * كان هنا حارس «يُزامن مرّة واحدة فقط»، وهو خطأ: عند حذف قسم أو
   * إعادة ترتيبه تُعاد استخدام نسخة المحرّر نفسها بمحتوى قسم آخر، فيظلّ
   * عارضاً النصّ القديم بينما الحالة تحمل نصّاً مختلفاً — ثم يُحفظ الخطأ.
   * والآن نزامن كلّما اختلفت القيمة عمّا يعرضه المحرّر، ونتجاهل ما صدر
   * عنه هو للتوّ حتى لا نقاطع الكتابة.
   */
  useEffect(() => {
    if (!editor) return;
    if (value === lastEmitted.current) return;
    if (value === editor.getHTML()) return;
    editor.commands.setContent(value || "", { emitUpdate: false });
    lastEmitted.current = value;
  }, [editor, value]);

  if (!editor) return <div className="rte-loading">…جارٍ تحميل المحرّر</div>;

  return (
    <div className="rte">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}
