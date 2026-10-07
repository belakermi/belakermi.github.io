/* عامل الخدمة: يجعل الموقع يعمل كتطبيق سريع، ويحفظ ما فتحه التلميذ للعمل بدون إنترنت.
   - الصفحات (HTML): تُعرض فورًا من النسخة المحفوظة في الهاتف، وتُحدَّث في الخلفية؛ التحديث يظهر في الزيارة التالية.
   - الكود والتنسيق والخطوط (عناوينها تحمل رقم الإصدار ?v=): من الهاتف مباشرة، ولا تُطلب من الشبكة إلا مرة واحدة لكل إصدار.
   - ملفات PDF والصور الموجودة في الموقع: تُعرض فورًا من الهاتف، وتُحدَّث في الخلفية إن تغيّرت على الموقع.
   - config.js: من الهاتف فورًا ويُحدَّث في الخلفية. lessons.csv: من الشبكة أولًا (2.5 ثانية على الأكثر)، ثم من النسخة المحفوظة.
   - قائمة الدروس وصفحات الدروس من الخادم: من الشبكة أولًا، ومن آخر نسخة محفوظة بدون إنترنت.
   ملاحظة: ملفات Google Drive لا يمكن حفظها هنا؛ يحمّلها التلميذ بزر «تحميل». */
/* لا تغيّر الاسم V: تغييره يمسح ما حفظه التلاميذ للعمل بدون إنترنت. تحديث هذا الملف يكفي لتحديث الصفحات. */
var V = "doros-v3";
/* عند تغيير رقم ?v= في الصفحات، غيّره هنا أيضًا (وإلا يُحمَّل الملف الجديد من الشبكة عند أول طلب فقط) */
var SHELL = ["./", "index.html", "lesson.html", "bem.html", "viewer.html", "teacher.html", "guide.html",
  "style.css?v=7", "common.js?v=6", "imgpdf.js?v=4", "config.js", "lessons.csv",
  "fonts/plex-ar-400.woff2", "fonts/plex-ar-600.woff2", "fonts/plex-la-400.woff2", "fonts/plex-la-600.woff2", "fonts/kufi-ar-700.woff2", "fonts/kufi-la-700.woff2",
  "icons/app-192.png", "icons/favicon.svg", "icons/favicon-32.png", "manifest.webmanifest"];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(V).then(function (c) {
    /* بدون cache:"reload": ما حمّلته الصفحة للتو يُؤخذ من ذاكرة المتصفح، فلا يُحمَّل مرتين */
    return Promise.all(SHELL.map(function (u) { return c.add(new Request(u)).catch(function () {}); }));
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
function keep(c, key, res) { if (res && res.ok && res.type === "basic") c.put(key, res.clone()); return res; }

/* الصفحات: النسخة المحفوظة فورًا + تحديث في الخلفية. أول زيارة (لا نسخة): من الشبكة، وبدون إنترنت الصفحة الرئيسية */
function pageSWR(e, req) {
  var key = pageKey(req);
  return caches.open(V).then(function (c) {
    return c.match(key).then(function (m) {
      var net = fetch(req).then(function (res) { return keep(c, key, res); });
      if (m) { e.waitUntil(net.catch(function () {})); return m; }
      return net.catch(function () { return c.match(new URL("./", self.registration.scope).href).then(function (x) { return x || Response.error(); }); });
    });
  });
}

/* ملفات بإصدار في عنوانها (?v=) والخطوط والأيقونات: لا تتغير، فتُقرأ من الهاتف مباشرة.
   عند حفظ إصدار جديد نحذف الإصدارات القديمة من الملف نفسه */
function versioned(req) {
  var key = req.url;
  return caches.open(V).then(function (c) {
    return c.match(key).then(function (m) {
      return m || fetch(req).then(function (res) {
        if (res && res.ok && res.type === "basic") {
          var path = new URL(key).pathname;
          c.keys().then(function (ks) { ks.forEach(function (k) { var u = new URL(k.url); if (u.pathname === path && k.url !== key) c.delete(k); }); });
          c.put(key, res.clone());
        }
        return res;
      });
    });
  });
}

/* config.js: يُقرأ قبل ظهور الصفحة، فيُعطى من الهاتف فورًا ويُحدَّث في الخلفية (تغيير رابط الخادم يصل في الزيارة التالية) */
function quickSWR(e, req) {
  var key = pageKey(req);
  return caches.open(V).then(function (c) {
    return c.match(key).then(function (m) {
      var net = fetch(req).then(function (res) { return keep(c, key, res); });
      if (m) { e.waitUntil(net.catch(function () {})); return m; }
      return net;
    });
  });
}

/* lessons.csv والباقي: من الشبكة أولًا، والنسخة المحفوظة إذا تأخرت الشبكة 2.5 ثانية أو انقطعت */
function networkFirst(req) {
  var key = pageKey(req);
  return caches.open(V).then(function (c) {
    var net = fetch(req).then(function (res) { return keep(c, key, res); });
    return Promise.race([net.catch(function () { return null; }), timeout(2500)]).then(function (res) {
      if (res) return res;
      return c.match(key).then(function (m) { return m || net.catch(function () { return c.match(key).then(function (x) { return x || Response.error(); }); }); });
    });
  });
}

/* PDF والصور في الموقع: النسخة المحفوظة فورًا، ثم سؤال الموقع في الخلفية (طلب تحقق صغير) وتحديثها إن تغيّرت */
function staleRevalidate(e, req) {
  var key = req.url;
  return caches.open(V).then(function (c) {
    return c.match(key).then(function (m) {
      var net = fetch(key, { cache: "no-cache", credentials: "same-origin" }).then(function (res) { return keep(c, key, res); });
      if (m) { e.waitUntil(net.catch(function () {})); return m; }
      return net;
    });
  });
}

/* مكتبات خارجية بإصدار ثابت (pdf.js، رمز QR) */
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
    var p = url.pathname;
    if (/\/$|\.html$/.test(p) || (req.mode === "navigate" && !/\.[a-z0-9]+$/i.test(p))) { e.respondWith(pageSWR(e, req)); return; }
    if (/[?&]v=/.test(url.search) || /\/(fonts|icons)\//.test(p)) { e.respondWith(versioned(req)); return; }
    if (/\/config\.js$/.test(p)) { e.respondWith(quickSWR(e, req)); return; }
    if (/\.(pdf|jpe?g|png|webp|svg)$/i.test(p)) { e.respondWith(staleRevalidate(e, req)); return; }
    e.respondWith(networkFirst(req));
    return;
  }
  if (/[?&]api=lessons?(&|$)/.test(url.search)) { e.respondWith(apiFirst(req)); return; }
  if (url.hostname === "cdnjs.cloudflare.com") { e.respondWith(cacheFirst(req)); return; }
});
