/**
 * يعمل مرة واحدة عند إقلاع خادم Next.
 *
 * `fetch` في Node لا يحترم متغيرات الوكيل (HTTPS_PROXY) تلقائياً بعكس
 * curl، فأي بيئة تفرض وكيلاً للخروج — شبكة شركة، أو بيئة معاينة سحابية —
 * تجعل كل استدعاءات Supabase من الخادم تفشل بينما يبدو كل شيء سليماً.
 *
 * نضبط هنا موزّعاً يقرأ إعدادات الوكيل من البيئة. لا أثر له إطلاقاً
 * عندما لا يوجد وكيل (الحالة الشائعة: جهازك أو Vercel).
 */
export async function register() {
  // بيئة الحافة (middleware) لا تملك undici ولا تحتاجها
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const proxy =
    process.env.HTTPS_PROXY ||
    process.env.https_proxy ||
    process.env.HTTP_PROXY ||
    process.env.http_proxy;
  if (!proxy) return;

  try {
    // webpackIgnore يمنع حزم undici في البناء ويتركه استيراداً وقت التشغيل
    const undici = (await import(
      /* webpackIgnore: true */ "undici"
    )) as typeof import("undici");
    undici.setGlobalDispatcher(new undici.EnvHttpProxyAgent());
    console.log(`[hissa] طلبات الخادم تمرّ عبر الوكيل: ${proxy}`);
  } catch (e) {
    console.warn("[hissa] تعذّر إعداد وكيل الشبكة:", e);
  }
}
