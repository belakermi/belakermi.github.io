/* عامل الخدمة: يجعل الموقع يعمل كتطبيق، ويحفظ ما فتحه التلميذ للعمل بدون إنترنت.
   - الصفحات والكود: من الشبكة أولًا (حتى تصل التحديثات فورًا)، ومن النسخة المحفوظة عند انقطاع الإنترنت
     أو إذا تأخرت الشبكة أكثر من 4 ثوانٍ.
   - ملفات PDF والصور الموجودة في الموقع: تُعرض فورًا من الهاتف، وتُحدَّث في الخلفية إن تغيّرت على الموقع.
   - قائمة الدروس وصفحات الدروس من الخادم: من الشبكة أولًا، ومن آخر نسخة محفوظة بدون إنترنت.
   ملاحظة: ملفات Google Drive لا يمكن حفظها هنا؛ يحمّلها التلميذ بزر «تحميل». */
/* لا تغيّر الاسم V: تغييره يمسح ما حفظه التلاميذ للعمل بدون إنترنت. تحديث هذا الملف يكفي لتحديث الصفحات. */
var V = "doros-v3";
var SHELL = ["./", "index.html", "lesson.html", "bem.html", "viewer.html", "teacher.html", "guide.html",
  "style.css", "common.js", "config.js", "imgpdf.js", "lessons.csv", "img/school.jpg",
  "icons/app-192.png", "icons/favicon.svg", "icons/favicon-32.png", "manifest.webmanifest"];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(V).then(function (c) {
    return Promise.all(SHELL.map(function (u) { return c.add(new Request(u, { cache: "reload" })).catch(function () {}); }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== V && k.indexOf("doros-") === 0; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function pageKey(req) { var u = new URL(req.url); return u.origin + u.pathname; }
function apiKey(url) { var u = new URL(url); ["t", "seen", "visit", "vn"].forEach(function (k) { u.searchParams.delete(k); }); return "https://doros-api.local/?" + u.searchParams.toString(); }
function timeout(ms) { return new Promise(function (ok) { setTimeout(function () { ok(null); }, ms); }); }

/* صفحات وكود الموقع */
function networkFirst(req, nav) {
  var key = pageKey(req);
  var net = fetch(req).then(function (res) {
    if (res && res.ok && res.type === "basic") { var copy = res.clone(); caches.open(V).then(function (c) { c.put(key, copy); }); }
    return res;
  });
  var fallback = function () {
    return caches.open(V).then(function (c) {
      return c.match(key).then(function (m) { return m || (nav ? c.match(new URL("./", self.registration.scope).href) : null); });
    });
  };
  /* شبكة بطيئة: بعد 4 ثوانٍ نعرض النسخة المحفوظة إن وُجدت، والشبكة تكمل تحديثها في الخلفية */
  return Promise.race([net.catch(function () { return null; }), timeout(4000)]).then(function (res) {
    if (res) return res;
    return fallback().then(function (m) { return m || net.catch(function () { return fallback().then(function (x) { return x || Response.error(); }); }); });
  });
}

/* PDF والصور في الموقع: النسخة المحفوظة فورًا، ثم سؤال الموقع في الخلفية (طلب تحقق صغير) وتحديثها إن تغيّرت */
function staleRevalidate(e, req) {
  var key = req.url;
  return caches.open(V).then(function (c) {
    return c.match(key).then(function (m) {
      var net = fetch(key, { cache: "no-cache", credentials: "same-origin" }).then(function (res) {
        if (res && res.ok && res.type === "basic") c.put(key, res.clone());
        return res;
      });
      if (m) { e.waitUntil(net.catch(function () {})); return m; }
      return net;
    });
  });
}

/* ملفات لا تتغير أبدًا: الخطوط والمكتبات (عناوينها تحمل رقم الإصدار) */
function cacheFirst(req) {
  return caches.open(V).then(function (c) {
    return c.match(req).then(function (m) {
      return m || fetch(req).then(function (res) { if (res && res.ok) c.put(req, res.clone()); return res; });
    });
  });
}

/* بيانات الدروس من خادم Google */
function apiFirst(req) {
  var key = apiKey(req.url);
  return fetch(req).then(function (res) {
    if (res && res.ok) {
      res.clone().text().then(function (t) {
        if (/^\s*\{/.test(t) && /"ok":true/.test(t)) caches.open(V).then(function (c) { c.put(key, new Response(t, { headers: { "content-type": "application/json" } })); });
      });
    }
    return res;
  }).catch(function () {
    return caches.open(V).then(function (c) { return c.match(key); }).then(function (m) { return m || Response.error(); });
  });
}

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  if (url.origin === self.location.origin) {
    if (/\.(pdf|jpe?g|png|webp|svg)$/i.test(url.pathname)) { e.respondWith(staleRevalidate(e, req)); return; }
    e.respondWith(networkFirst(req, req.mode === "navigate"));
    return;
  }
  if (/[?&]api=lessons?(&|$)/.test(url.search)) { e.respondWith(apiFirst(req)); return; }
  if (url.hostname === "fonts.gstatic.com" || url.hostname === "cdnjs.cloudflare.com") { e.respondWith(cacheFirst(req)); return; }
});
