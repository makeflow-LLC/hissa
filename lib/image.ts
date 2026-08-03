/**
 * تصغير صورة في المتصفّح قبل رفعها.
 *
 * جمهور المنصة على الجوال وعلى شبكات ضعيفة: صورةٌ من كاميرا الهاتف تبلغ
 * عدّة ميجابايت، ورفعها كما هي يُبطئ المعلّم عند الإدخال ويُبطئ الطالب
 * عند اللعب. التصغير هنا لا على الخادم لأنه يوفّر زمن الرفع نفسه.
 */
export function shrinkImage(file: File, maxWidth = 1280, quality = 0.85): Promise<Blob> {
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
        quality
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("bad image"));
    };
    img.src = url;
  });
}
