/*
 * عامل الخدمة — الحد الأدنى الآمن لتطبيق قابل للتثبيت.
 *
 * مهم: لا نخزّن صفحات HTML إطلاقاً. صفحات المنصة تعتمد على حالة الدخول
 * (زائر / طالب / معلّم)، وتخزينها قد يعرض صفحة طالب لحساب آخر على
 * الجهاز نفسه أو يُظهر محتوى بعد تسجيل الخروج. لذلك نمرّ بالشبكة دائماً
 * للتنقّل، ونخزّن فقط الأصول الثابتة التي لا تحمل بيانات مستخدم.
 */

const CACHE = "hissa-static-v1";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) =>
      c.addAll([OFFLINE_URL, "/icon-192.png", "/icon-512.png", "/logo.svg"])
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // التنقّل: الشبكة أولاً دائماً؛ صفحة «لا اتصال» عند الفشل فقط
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }

  // الأصول الثابتة فقط (بلا بيانات مستخدم): من الذاكرة ثم الشبكة
  const isStatic =
    url.pathname.startsWith("/_next/static/") ||
    /\.(png|svg|jpg|jpeg|webp|woff2?|css|js)$/.test(url.pathname);
  if (!isStatic) return;

  event.respondWith(
    caches.match(request).then(
      (hit) =>
        hit ||
        fetch(request).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
          }
          return res;
        })
    )
  );
});
