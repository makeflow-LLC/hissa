/**
 * إعدادات الاتصال بـ Supabase.
 *
 * القيمتان هنا «عامّتان» بطبيعتهما: تُرسلان لمتصفح كل زائر مع أي صفحة،
 * والحماية الحقيقية في سياسات RLS وصلاحيات الأعمدة داخل القاعدة —
 * لذلك وضعهما في الكود آمن ويجعل المشروع يعمل بلا ملف ‎.env.local.
 *
 * متغيرات البيئة (إن وُجدت) تتقدم على هذه الافتراضات، فيمكن توجيه
 * المشروع لبيئة أخرى (مشروع تجريبي مثلاً) دون تعديل الكود.
 *
 * ⚠️ المفتاح السري (service_role) مختلف تماماً: لا يوضع هنا أبداً
 * ولا في أي متغير يبدأ بـ NEXT_PUBLIC_ — مكانه ‎.env.local فقط
 * ويُستخدم حصراً في سكربت npm run seed.
 */
export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://mexpmtuqhvnphgeqqjuf.supabase.co";

export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "sb_publishable_BJaDJ7LWT6l6MxxpUY6M7A_8vkG3_p-";
