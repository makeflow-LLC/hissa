import sanitizeHtml from "sanitize-html";
import { SUPABASE_URL } from "@/lib/supabase/config";

/**
 * تعقيم محتوى الدرس القادم من المعلّم قبل تخزينه وعرضه.
 *
 * التسجيل كمعلّم مفتوح للجميع، فمحتوى الدرس مُدخَل غير موثوق يُعرض على
 * متصفّحات الطلاب. بدون تعقيم يستطيع معلّم خبيث حقن <script> أو
 * onerror= أو رابط javascript: ويسرق جلسات طلابه. لذلك نسمح بقائمة
 * بيضاء ضيّقة فقط، ونعقّم عند الحفظ **وعند العرض** معاً حتى لا يعتمد
 * الأمان على صحّة ما هو مخزّن أصلاً.
 */

/** نستخرج مضيف Supabase لقصر الصور على مساحة تخزين المشروع */
function supabaseHost(): string | null {
  try {
    return new URL(SUPABASE_URL).hostname;
  } catch {
    return null;
  }
}

const ALLOWED_STYLES = {
  "*": {
    color: [/^#(0x)?[0-9a-f]+$/i, /^rgb\(\s*\d{1,3},\s*\d{1,3},\s*\d{1,3}\s*\)$/],
    "font-size": [/^\d+(\.\d+)?(px|rem|em|%)$/],
    "text-align": [/^(left|right|center|justify)$/],
    "background-color": [
      /^#(0x)?[0-9a-f]+$/i,
      /^rgb\(\s*\d{1,3},\s*\d{1,3},\s*\d{1,3}\s*\)$/,
    ],
  },
};

export function sanitizeLessonHtml(dirty: string): string {
  const host = supabaseHost();
  return sanitizeHtml(dirty ?? "", {
    allowedTags: [
      "p", "br", "strong", "b", "em", "i", "u", "s", "mark", "span",
      "h2", "h3", "h4",
      "ul", "ol", "li",
      "blockquote", "code", "pre", "hr",
      "table", "thead", "tbody", "tfoot", "tr", "th", "td", "colgroup", "col",
      "img", "a", "figure", "figcaption",
    ],
    allowedAttributes: {
      "*": ["style", "dir"],
      a: ["href", "target", "rel"],
      img: ["src", "alt", "width", "height"],
      td: ["colspan", "rowspan"],
      th: ["colspan", "rowspan"],
      col: ["span"],
    },
    // روابط آمنة فقط — يمنع javascript: وdata: في <a>
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: { img: ["http", "https"] },
    allowedStyles: ALLOWED_STYLES,
    // الصور من مساحة تخزين المشروع فقط (يمنع تتبّع الطلاب عبر صور خارجية)
    allowedIframeHostnames: [],
    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: { ...attribs, target: "_blank", rel: "noopener noreferrer nofollow" },
      }),
    },
    exclusiveFilter: (frame) => {
      if (frame.tag !== "img") return false;
      const src = frame.attribs?.src ?? "";
      if (!host) return false;
      try {
        return new URL(src).hostname !== host;
      } catch {
        return true; // مسار غير صالح ⇒ احذف الصورة
      }
    },
  });
}

/** يزيل الوسوم كلياً — للعناوين والحقول النصية القصيرة */
export function stripTags(dirty: string): string {
  return sanitizeHtml(dirty ?? "", { allowedTags: [], allowedAttributes: {} }).trim();
}
