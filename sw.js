/* عامل الخدمة: يجعل الموقع يعمل كتطبيق سريع، ويحفظ ما فتحه التلميذ للعمل بدون إنترنت.
   - الصفحات (HTML): تُعرض فورًا من النسخة المحفوظة في الهاتف، وتُحدَّث في الخلفية؛ إن تغيّرت تعيد الصفحة فتح نفسها
     مرة واحدة إن فُتحت للتو ولم يلمسها المستخدم، وإلا يظهر التحديث في الزيارة التالية.
   - الكود والتنسيق والخطوط (عناوينها تحمل رقم الإصدار ?v=): من الهاتف مباشرة، ولا تُطلب من الشبكة إلا مرة واحدة لكل إصدار.
   - ملفات PDF والصور الموجودة في الموقع: تُعرض فورًا من الهاتف، وتُحدَّث في الخلفية إن تغيّرت على الموقع.
   - config.js: من الهاتف فورًا ويُحدَّث في الخلفية. lessons.csv: من الشبكة أولًا (2.5 ثانية على الأكثر)، ثم من النسخة المحفوظة.
   - قائمة الدروس وصفحات الدروس من الخادم: من الشبكة أولًا، ومن آخر نسخة محفوظة بدون إنترنت.
   ملاحظة: ملفات Google Drive لا يمكن حفظها هنا؛ يحمّلها التلميذ بزر «تحميل». */
/* لا تغيّر الاسم V: تغييره يمسح ما حفظه التلاميذ للعمل بدون إنترنت. تحديث هذا الملف يكفي لتحديث الصفحات. */
var V = "doros-v3";
/* عند تغيير رقم ?v= في الصفحات، غيّره هنا أيضًا (وإلا يُحمَّل الملف الجديد من الشبكة عند أول طلب فقط) */
var SHELL = ["./", "index.html", "lesson.html", "bem.html", "viewer.html", "teacher.html", "guide.html",
  "style.css?v=9", "common.js?v=11", "imgpdf.js?v=4", "config.js", "lessons.csv",
  "fonts/plex-ar-400.woff2", "fonts/plex-ar-600.woff2", "fonts/plex-la-400.woff2", "fonts/plex-la-600.woff2", "fonts/kufi-ar-700.woff2", "fonts/kufi-la-700.woff2",
  "icons/app-192.png", "icons/badge-96.png", "icons/favicon.svg", "icons/favicon-32.png", "manifest.webmanifest"];
/* صورة المتوسطة في الصفحة الرئيسية: الهاتف يختار نسخة واحدة حسب شاشته، فنحفظ التي حمّلها فقط (بدون أي تحميل إضافي)
   لتظهر الصورة حتى لو فُتح التطبيق بدون إنترنت بعد أول زيارة */
var IF_LOADED = ["img/school-600.webp", "img/school-900.webp", "img/school-hero.jpg"];

function fromBrowserCache(c, u) {
  try { return c.add(new Request(u, { cache: "only-if-cached", mode: "same-origin" })).catch(function () {}); }
  catch (err) { return Promise.resolve(); }   /* متصفح لا يعرف only-if-cached: لا شيء */
}

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(V).then(function (c) {
    /* cache:"no-cache": سؤال صغير للموقع عن كل ملف (If-None-Match). ما لم يتغير لا يُحمَّل مرة ثانية،
       وما تغيّر يُؤخذ جديدًا (لا نسخة قديمة من ذاكرة المتصفح، التي يحتفظ بها GitHub Pages 10 دقائق) */
    return Promise.all(SHELL.map(function (u) { return c.add(new Request(u, { cache: "no-cache" })).catch(function () {}); })
      .concat(IF_LOADED.map(function (u) { return fromBrowserCache(c, u); })));
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

/* سؤال الموقع مع تحقق صغير: يتخطى ذاكرة المتصفح (10 دقائق)، وما لم يتغير يأتي جوابه 304 بدون تحميل */
function fresh(url) { return fetch(url, { cache: "no-cache", credentials: "same-origin" }); }

/* أخبر الصفحات المفتوحة أن نسخة أحدث حُفظت (الصفحة التي فُتحت للتو تعيد فتح نفسها، انظر common.js).
   نُرسل مرتين: الصفحة الجديدة قد لا تكون جاهزة لاستقبال الرسالة في المرة الأولى */
function announce(u) {
  function send() { return self.clients.matchAll({ type: "window" }).then(function (cs) { cs.forEach(function (c) { c.postMessage({ t: "fresh", u: u }); }); }); }
  return send().then(function () { return timeout(1500); }).then(send);
}

/* تحديث النسخة المحفوظة في الخلفية، وإعلان الصفحات إن تغيّرت فعلًا */
function revalidate(c, key, old, u) {
  return fresh(key).then(function (res) {
    if (!res || !res.ok || res.type !== "basic" || res.redirected) return;
    return Promise.all([old.text(), res.clone().text()]).then(function (t) {
      return c.put(key, res).then(function () { if (t[0] !== t[1]) return announce(u); });
    });
  });
}

/* الصفحات: النسخة المحفوظة فورًا + تحديث في الخلفية (والصفحة تُبلَّغ إن تغيّرت). أول زيارة (لا نسخة): من الشبكة، وبدون إنترنت الصفحة الرئيسية */
function pageSWR(e, req) {
  var key = pageKey(req);
  return caches.open(V).then(function (c) {
    return c.match(key).then(function (m) {
      if (m) { e.waitUntil(revalidate(c, key, m.clone(), key).catch(function () {})); return m; }
      return fetch(req).then(function (res) { return keep(c, key, res); })
        .catch(function () { return c.match(new URL("./", self.registration.scope).href).then(function (x) { return x || Response.error(); }); });
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

/* config.js: يُقرأ قبل ظهور الصفحة، فيُعطى من الهاتف فورًا ويُحدَّث في الخلفية؛ إن تغيّر (رابط الخادم، تاريخ الشهادة…)
   تُبلَّغ كل الصفحات المفتوحة، فتعيد فتح نفسها إن فُتحت للتو */
function quickSWR(e, req) {
  var key = pageKey(req);
  return caches.open(V).then(function (c) {
    return c.match(key).then(function (m) {
      if (m) { e.waitUntil(revalidate(c, key, m.clone(), "*").catch(function () {})); return m; }
      return fetch(req).then(function (res) { return keep(c, key, res); });
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

/* ---- الإشعارات ----
   خادم الإصدار 7: النص يصل مشفّرًا داخل الإشارة (المتصفح يفك تشفيره)، فنعرضه فورًا بدون أي طلب.
   الإصدار 6 (أو هاتف اشترك قبل 7): الإشارة فارغة؛ نسأل الخادم عن النص (برقم اشتراك هذا الهاتف) ثم نعرضه.
   تأخير عشوائي صغير قبل السؤال حتى لا تسأل كل الهواتف في اللحظة نفسها، ومحاولتان إضافيتان عند الزحام */
function pushInfo() {
  return caches.open("dpush").then(function (c) { return c.match("/__push"); }).then(function (r) { return r ? r.json() : null; }).catch(function () { return null; });
}
function pushMessage(inf) {
  if (!inf || !inf.api) return Promise.resolve(null);
  function ask(n) {
    return timeout(!n ? Math.random() * 600 : n === 1 ? 1500 + Math.random() * 3000 : 4000 + Math.random() * 6000).then(function () {
      return fetch(inf.api + "?api=pushmsg&s=" + encodeURIComponent(inf.s || "") + "&t=" + Date.now());
    }).then(function (r) { return r.json(); }).then(function (j) { return j && j.ok ? j.msg : null; })
      .catch(function () { return n < 2 ? ask(n + 1) : null; });
  }
  return ask(0);
}
function pushData(e) {
  try { var m = e.data ? e.data.json() : null; return m && typeof m.title === "string" && m.title ? m : null; } catch (x) { return null; }
}
self.addEventListener("push", function (e) {
  var inside = pushData(e);
  e.waitUntil((inside ? Promise.resolve(inside) : pushInfo().then(pushMessage)).then(function (m) {
    m = m || {};
    return self.registration.showNotification(m.title || "إعلان جديد من المؤسسة", {
      body: m.text || "افتح الموقع لقراءته.", icon: "icons/app-192.png", badge: "icons/badge-96.png",
      tag: "doros-msg", renotify: true, lang: "ar", dir: "rtl", data: { url: /^(\.\/|teacher\.html)$/.test(m.url || "") ? m.url : "./" }
    });
  }));
});
/* الضغط على الإشعار: يفتح الموقع (أو فضاء الأساتذة). from=push تجعل الصفحة تجلب الإعلانات الجديدة فورًا
   (بدل نسخة الهاتف التي عمرها أقل من دقيقة). إن كان الموقع مفتوحًا ننقله إلى الصفحة بدل فتح نافذة ثانية */
self.addEventListener("notificationclick", function (e) {
  e.notification.close();
  var u = new URL((e.notification.data && e.notification.data.url) || "./", self.registration.scope);
  u.searchParams.set("from", "push");
  e.waitUntil(self.clients.matchAll({ type: "window" }).then(function (cs) {
    var c = cs.filter(function (x) { return "navigate" in x; })[0];
    if (c) return c.navigate(u.href).then(function (w) { return (w || c).focus(); }).catch(function () { return self.clients.openWindow(u.href); });
    return self.clients.openWindow ? self.clients.openWindow(u.href) : null;
  }));
});
/* المتصفح جدّد عنوان الإشعارات لهذا الهاتف: نشترك من جديد ونخبر الخادم (الرقم نفسه، فلا يُحسب الهاتف مرتين) */
self.addEventListener("pushsubscriptionchange", function (e) {
  e.waitUntil(pushInfo().then(function (inf) {
    if (!inf || !inf.key || !inf.api) return;
    var s = String(inf.key).replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "=";
    var raw = atob(s), key = new Uint8Array(raw.length); for (var i = 0; i < raw.length; i++) key[i] = raw.charCodeAt(i);
    return self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }).then(function (sub) {
      var k = null; try { k = sub.toJSON().keys; } catch (x) {}
      return fetch(inf.api, { method: "POST", body: JSON.stringify({ action: "pushSub", endpoint: sub.endpoint, id: inf.s, keys: k }) });
    });
  }).catch(function () {}));
});
