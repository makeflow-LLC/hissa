import type { MetadataRoute } from "next";

/**
 * الدليل وصفحات المعلّمين والدروس مفتوحة للفهرسة — هي محتوى المنصة
 * العام وقناة نموّها. أمّا الصفحات الشخصية (لوحة الطالب، لوحة المعلّم،
 * الدخول) فلا معنى لفهرستها: محتواها يعتمد على الجلسة، وما يراه الزاحف
 * هو تحويل إلى صفحة الدخول.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard", "/teacher/me", "/login", "/auth/"],
    },
    sitemap: "https://hissa.sbs/sitemap.xml",
  };
}
