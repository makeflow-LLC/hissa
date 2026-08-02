/** @type {import('next').NextConfig} */
const nextConfig = {
  /**
   * `unpdf` تحزم pdf.js وعاملَه (worker) وتحمّل ملفات وقت التشغيل.
   * تركها للمُحزِّم يكسر الاستيراد على الخادم، فنتركها خارجه ليحمّلها
   * Node مباشرةً — وهي لا تُستورَد إلا داخل إجراء خادميّ عند رفع ملفّ.
   */
  serverExternalPackages: ["unpdf"],
};

export default nextConfig;
