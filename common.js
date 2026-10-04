/* أدوات مشتركة بين صفحات الموقع */
var D = (function () {
  var SUBJ = [
    {k:"ar",n:"اللغة العربية",g:"ع"},{k:"math",n:"الرياضيات",g:"ر"},{k:"fr",n:"اللغة الفرنسية",g:"Fr"},
    {k:"en",n:"اللغة الإنجليزية",g:"En"},{k:"sci",n:"العلوم الطبيعية",g:"ط"},{k:"phy",n:"العلوم الفيزيائية",g:"ف"},
    {k:"hist",n:"التاريخ والجغرافيا",g:"تج"},{k:"isl",n:"التربية الإسلامية",g:"إ"},{k:"civ",n:"التربية المدنية",g:"م"},
    {k:"amz",n:"اللغة الأمازيغية",g:"ⵣ"},{k:"art",n:"التربية التشكيلية",g:"ت"},{k:"mus",n:"التربية الموسيقية",g:"♪"},
    {k:"info",n:"المعلوماتية",g:"IT"}];
  var YEARS = [{n:1,name:"الأولى متوسط"},{n:2,name:"الثانية متوسط"},{n:3,name:"الثالثة متوسط"},{n:4,name:"الرابعة متوسط"}];
  var TERMS = ["الفصل الأول","الفصل الثاني","الفصل الثالث"];
  var KINDS = {pdf:"PDF",image:"صورة",word:"Word",slides:"عرض",audio:"صوت",file:"ملف"};
  /* نوع المحتوى (خادم الإصدار 3). الدروس القديمة بدون نوع = «درس» */
  var TYPES = [{k:"lesson",n:"درس"},{k:"ex",n:"تمارين"},{k:"devoir",n:"فرض"},{k:"exam",n:"اختبار"},{k:"corr",n:"تصحيح"},{k:"bem",n:"موضوع BEM"},{k:"bemc",n:"تصحيح BEM"}];
  var ERRORS = {
    AUTH: "الرمز غير صحيح أو موقوف. تأكد منه أو اطلبه من مدير الموقع.",
    FORBIDDEN: "هذا الإجراء خاص بصاحب الدرس أو بالمدير.",
    FILE_TYPE: "نوع الملف غير مقبول. المقبول: PDF، صور، Word، PowerPoint، ملفات صوتية.",
    FILE_SIZE: "الملف أكبر من 20 ميغابايت. قسّمه أو ضع الفيديو على YouTube.",
    BAD_FILE: "أحد الملفات لم يعد موجودًا. احذفه من القائمة وأعد رفعه.",
    EMPTY: "أضف شرحًا أو ملفًا أو رابط فيديو على الأقل.",
    BAD_INPUT: "تحقق من الحقول: السنة والمادة والعنوان مطلوبة.",
    NOT_FOUND: "هذا الدرس لم يعد موجودًا.",
    NOT_SETUP: "الخادم لم يُجهَّز بعد. على المدير تشغيل setup مرة واحدة.",
    QUOTA: "بلغت حد الرفع لهذا اليوم (300 م.ب). أكمل غدًا، أو ضع الفيديوهات على YouTube بدل رفعها.",
    NETWORK: "تعذّر الاتصال بالخادم. تحقق من الإنترنت ثم أعد المحاولة.",
    BUSY: "الخادم مشغول بنشر أساتذة آخرين في اللحظة نفسها. أعد المحاولة بعد لحظات.",
    ABORT: "أُلغي النشر. الملفات التي رُفعت محفوظة، واضغط «نشر» للإكمال.",
    BAD_ACTION: "هذه الميزة تحتاج تحديث كود الخادم إلى أحدث إصدار (صفحة الإعداد).",
    SERVER: "حدث خطأ في الخادم. أعد المحاولة بعد قليل."
  };

  function typeName(k) { for (var i = 0; i < TYPES.length; i++) if (TYPES[i].k === k) return TYPES[i].n; return "درس"; }
  function typeOf(l) { var t = l && l.type; for (var i = 0; i < TYPES.length; i++) if (TYPES[i].k === t) return t; return "lesson"; }
  /* الأرقام العربية المشرقية (٠-٩) والفارسية (۰-۹) ← 0-9 */
  function digits(s) { return String(s == null ? "" : s).replace(/[٠-٩]/g, function (c) { return "٠١٢٣٤٥٦٧٨٩".indexOf(c); }).replace(/[۰-۹]/g, function (c) { return "۰۱۲۳۴۵۶۷۸۹".indexOf(c); }); }
  /* توحيد الكتابة للبحث والمقارنة: أ إ آ ← ا، ة ← ه، ى ← ي، بدون تشكيل */
  function fold(s) { return digits(s).toLowerCase().replace(/[\u064B-\u0652\u0640]/g, "").replace(/[أإآٱ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي"); }
  var ORD = [["الحادي عشر", 11], ["الحاديه عشر", 11], ["الثاني عشر", 12], ["الثانيه عشر", 12], ["الاول", 1], ["الاولي", 1], ["الثاني", 2], ["الثانيه", 2],
    ["الثالث", 3], ["الثالثه", 3], ["الرابع", 4], ["الرابعه", 4], ["الخامس", 5], ["الخامسه", 5], ["السادس", 6], ["السادسه", 6], ["السابع", 7], ["السابعه", 7],
    ["الثامن", 8], ["الثامنه", 8], ["التاسع", 9], ["التاسعه", 9], ["العاشر", 10], ["العاشره", 10]];
  /* ترتيب المقاطع: أول رقم فيها («المقطع 2» قبل «المقطع 10»)، وإلا أول عدد ترتيبي («المقطع الثاني») */
  function unitKey(u) {
    var s = fold(u), m = s.match(/\d+/);
    if (m) return +m[0];
    var best = -1, val = 9999, len = 0;
    ORD.forEach(function (o) { var i = s.indexOf(o[0]); if (i >= 0 && (best < 0 || i < best || (i === best && o[0].length > len))) { best = i; val = o[1]; len = o[0].length; } });
    return val;
  }
  function today() { var d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function activeNews(list) { var t = today(); return (Array.isArray(list) ? list : []).filter(function (n) { return n && n.title && (!n.until || n.until >= t); }); }
  /* مشاركة رابط: قائمة المشاركة في الهاتف إن وُجدت، وإلا واتساب */
  function waLink(text, url) { return "https://wa.me/?text=" + encodeURIComponent(text + "\n" + url); }
  function share(text, url) {
    if (navigator.share) return navigator.share({ title: text, text: text, url: url }).then(function () { return "shared"; }, function () { return "cancel"; });
    window.open(waLink(text, url), "_blank", "noopener"); return Promise.resolve("wa");
  }
  function siteUrl(path) { return new URL(path || "./", location.href).href; }
  function subj(k) { for (var i = 0; i < SUBJ.length; i++) if (SUBJ[i].k === k) return SUBJ[i]; return null; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; }); }
  function fmt(d) { var p = String(d || "").split("-"); return p.length === 3 ? (+p[2]) + "/" + (+p[1]) + "/" + p[0] : ""; }
  function isNew(d) { if (!d) return false; var t = Date.parse(d); return t && (Date.now() - t) < 8 * 864e5 && t <= Date.now() + 864e5; }
  function size(n) { return n >= 1073741824 ? (n / 1073741824).toFixed(1) + " غ.ب" : n > 1048576 ? (n / 1048576).toFixed(1) + " م.ب" : Math.max(1, Math.round(n / 1024)) + " ك.ب"; }
  function errText(e) { return ERRORS[(e && e.code) || "SERVER"] || ERRORS.SERVER; }

  function ytId(u) {
    var m = String(u || "").match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
    return m ? m[1] : null;
  }
  function driveId(u) { var m = String(u || "").match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:.*&)?id=)([A-Za-z0-9_-]{20,})/); return m ? m[1] : null; }
  function filePreview(f) { return "https://drive.google.com/file/d/" + encodeURIComponent(f.id) + "/preview"; }
  function fileDownload(f) { return "https://drive.google.com/uc?export=download&id=" + encodeURIComponent(f.id); }
  function fileImage(f) { return "https://drive.google.com/thumbnail?id=" + encodeURIComponent(f.id) + "&sz=w1600"; }

  function apiOn() { return !!(window.SITE && SITE.apiUrl); }
  function call(payload, signal, body) {
    return fetch(SITE.apiUrl, { method: "POST", body: body || JSON.stringify(payload), signal: signal })
      .then(function (r) { return r.json().catch(function () { var e = new Error("BUSY"); e.code = "BUSY"; throw e; }); }, function (x) { var c = x && x.name === "AbortError" ? "ABORT" : "NETWORK", e = new Error(c); e.code = c; throw e; })
      .then(function (j) { if (!j || !j.ok) { var e = new Error((j && j.error) || "SERVER"); e.code = (j && j.error) || "SERVER"; throw e; } return j; });
  }
  /* رفع ملف. ملاحظة: لا نتتبّع نسبة التقدّم لأن ذلك يجعل المتصفح يرسل طلب فحص (preflight)
     يرفضه خادم Google، فيفشل الرفع. نستعمل طلبًا بسيطًا (text/plain) يقبله الخادم. */
  /* الجسم يُبنى قطعًا في Blob بدل JSON.stringify على نص كبير: نسخ أقل في ذاكرة الهواتف البسيطة */
  function upload(code, file, signal) {
    return new Promise(function (ok, bad) {
      var rd = new FileReader();
      rd.onerror = function () { var e = new Error("FILE"); e.code = "SERVER"; bad(e); };
      rd.onload = function () { var s = String(rd.result); ok(s.slice(s.indexOf(",") + 1)); };
      rd.readAsDataURL(file);
    }).then(function (b64) {
      var head = JSON.stringify({ action: "upload", code: code, file: { name: file.name, type: mime(file), data: "" } });
      var body = new Blob([head.slice(0, -3), b64, head.slice(-3)], { type: "text/plain;charset=UTF-8" });   /* نفس رأس الطلب النصي العادي: طلب بسيط بدون فحص مسبق */
      b64 = null;
      return call(null, signal, body);
    }).then(function (j) { return j.file; });
  }
  var EXT = { pdf:"application/pdf", jpg:"image/jpeg", jpeg:"image/jpeg", png:"image/png", webp:"image/webp",
    doc:"application/msword", docx:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ppt:"application/vnd.ms-powerpoint", pptx:"application/vnd.openxmlformats-officedocument.presentationml.presentation",
    mp3:"audio/mpeg", m4a:"audio/mp4", aac:"audio/aac", wav:"audio/wav" };
  function mime(f) { var e = String(f.name).split(".").pop().toLowerCase(); return EXT[e] || f.type || ""; }

  /* ---- القراءة: محاولات متكررة بفواصل عشوائية + نسخة محفوظة في الهاتف ----
     إذا كان الخادم مشغولًا (زحام)، نعيد المحاولة بعد ثوانٍ عشوائية حتى لا يعود الجميع في اللحظة نفسها،
     ونعرض آخر قائمة محفوظة في هاتف التلميذ خلال ذلك. */
  var CK = "doros-lessons-v1", lastNews = null;
  function news() { if (lastNews) return lastNews; var c = cached(); return c && Array.isArray(c.news) ? c.news : []; }
  function getUrl(q) { return SITE.apiUrl + (SITE.apiUrl.indexOf("?") >= 0 ? "&" : "?") + q + "&t=" + Date.now(); }
  function wait(ms) { return new Promise(function (ok) { setTimeout(ok, ms); }); }
  /* ---- عدد المشاهدات والزيارات (خادم الإصدار 5) ----
     الدرس الذي يفتحه التلميذ يُسجَّل في هاتفه (مرة واحدة في اليوم لكل درس)، ويُرسَل مع طلب القراءة التالي
     بدون أي طلب إضافي للخادم. هواتف الأساتذة لا تُحسب. */
  var VQ = "doros-views-v1", VS = "doros-seen-v1", VD = "doros-visit-v1";
  function lsGet(k, d) { try { var v = JSON.parse(localStorage.getItem(k) || "null"); return v == null ? d : v; } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function teacherDevice() { try { return !!(localStorage.getItem("doros-code") || sessionStorage.getItem("doros-code")); } catch (e) { return false; } }
  function markView(id) {
    id = String(id || ""); if (!/^[a-z0-9]{6,30}$/.test(id) || teacherDevice()) return;
    var t = today(), seen = lsGet(VS, {});
    if (seen[id] === t) return;
    for (var k in seen) if (seen[k] !== t) delete seen[k];
    seen[id] = t; lsSet(VS, seen);
    var q = lsGet(VQ, []); if (q.indexOf(id) < 0) q.push(id); lsSet(VQ, q.slice(-100));
  }
  function markVisit() {
    if (teacherDevice()) return;
    var v = lsGet(VD, {}); if (v.day === today()) return;
    lsSet(VD, { day: today(), pending: true });
  }
  function viewParams() {
    var q = lsGet(VQ, []).slice(0, 30), v = lsGet(VD, {}), o = { ids: q, visit: !!v.pending, s: "", n: "" };
    if (q.length) o.s += "&seen=" + q.join(",");
    if (o.visit) o.s += "&visit=1";
    if (o.s) { o.n = Math.random().toString(36).slice(2, 10); o.s += "&vn=" + o.n; }
    return o;
  }
  function viewAck(sent, j) {
    /* خادم قديم، أو رد قديم محفوظ في الهاتف (بدون إنترنت): نحتفظ بها حتى يؤكد الخادم نفسه وصولها */
    if (!j || !(j.v >= 5) || !sent.n || j.vn !== sent.n) return;
    if (sent.ids.length && j.seen != null) lsSet(VQ, lsGet(VQ, []).filter(function (x) { return sent.ids.indexOf(x) < 0; }));
    if (sent.visit && j.visit) { var v = lsGet(VD, {}); v.pending = false; lsSet(VD, v); }
  }

  function getJson(q, tries) {
    var n = 0;
    function attempt() {
      n++;
      var sent = viewParams();
      return fetch(getUrl(q + sent.s)).then(function (r) {
        return r.text().then(function (t) {
          var j; try { j = JSON.parse(t); } catch (e) { j = null; }
          if (!j) {
            /* صفحة «الخادم يعمل» = خادم قديم لا يعرف هذا الطلب. أي صفحة أخرى = زحام أو خطأ مؤقت عند Google */
            var old = /خادم دروس/.test(t), e = new Error(old ? "UNSUPPORTED" : "BUSY"); e.code = e.message; throw e;
          }
          if (!j.ok && j.error === "SERVER") { var x = new Error("BUSY"); x.code = "BUSY"; throw x; }
          viewAck(sent, j);
          return j;
        });
      }).catch(function (e) {
        if (e && e.code === "UNSUPPORTED") throw e;
        if (n >= tries) { var x = new Error("NETWORK"); x.code = "NETWORK"; throw x; }
        return wait((n === 1 ? 1200 : 3500) + Math.random() * 2500).then(attempt);
      });
    }
    return attempt();
  }
  function cached() {
    try { var c = JSON.parse(localStorage.getItem(CK) || "null"); return c && Array.isArray(c.lessons) ? c : null; } catch (e) { return null; }
  }
  /* نسخة حديثة (أقل من دقيقة) تُستعمل مباشرة بدون سؤال الخادم: التلميذ الذي يتنقل بين الصفحات
     لا يكرر الطلب، فتتضاعف قدرة الخادم عند الزحام */
  var FRESH = 60000;
  /* بعد النشر أو التعديل: نجبر الصفحات على طلب القائمة الجديدة */
  function invalidate() { try { var c = cached(); if (c) { c.at = 0; localStorage.setItem(CK, JSON.stringify(c)); } } catch (e) {} }
  function fresh() { var c = cached(); return c && c.at && Date.now() - c.at < FRESH ? c : null; }
  function lessons(force) {
    if (!apiOn()) return Promise.resolve([]);
    var f = !force && fresh();
    if (f) { lastNews = Array.isArray(f.news) ? f.news : []; return Promise.resolve(f.lessons); }
    return getJson("api=lessons", 3).then(function (j) {
      if (!j.ok) { var e = new Error(j.error || "SERVER"); e.code = j.error || "SERVER"; throw e; }
      lastNews = Array.isArray(j.news) ? j.news : null;
      try { localStorage.setItem(CK, JSON.stringify({ at: Date.now(), lessons: j.lessons, news: j.news || [], v: j.v || 1 })); } catch (e) {}
      return j.lessons;
    });
  }
  /* درس واحد بشرحه الكامل (خادم الإصدار 2). إن فشل الطلب لأي سبب — خادم قديم لا يعرفه
     (Google يرسل صفحته بدون إذن قراءة عبر المواقع فيبدو كخطأ شبكة)، أو زحام — نرجع إلى القائمة. */
  function lesson(id) {
    var f = fresh(), hit = f && f.lessons.filter(function (x) { return x.id === id; })[0];
    if (hit && !hit.more) return Promise.resolve(hit);   /* الدرس كامل في النسخة الحديثة */
    function fromList() { return lessons().then(function (L) { return L.filter(function (x) { return x.id === id; })[0] || null; }); }
    return getJson("api=lesson&id=" + encodeURIComponent(id), 1).then(function (j) {
      if (j.ok) return j.lesson;
      if (j.error === "NOT_FOUND" && j.v === undefined) return fromList();
      if (j.error === "NOT_FOUND") return null;
      return fromList();
    }, fromList);
  }

  /* متصفح داخل تطبيق (فيسبوك، ماسنجر، إنستغرام، تيك توك، سناب): التحميل وعرض الملفات فيه ضعيف */
  function inApp() { return /FBAN|FBAV|FB_IAB|FBIOS|Instagram|Messenger|Snapchat|musical_ly|BytedanceWebview|\bLine\//i.test(navigator.userAgent || ""); }
  function inAppNote(el) {
    if (!el || !inApp()) return;
    try { if (sessionStorage.getItem("doros-inapp")) return; } catch (e) {}
    var d = document.createElement("div"); d.className = "msg inapp"; d.setAttribute("role", "status");
    d.innerHTML = '<span>أنت تفتح الموقع داخل تطبيق (فيسبوك، ماسنجر…). إذا لم تُفتح الملفات أو لم تُحمَّل، اضغط ⋮ أو ••• في الأعلى ثم «فتح في المتصفح» (Chrome).</span><button type="button" aria-label="إغلاق">×</button>';
    d.querySelector("button").onclick = function () { d.parentNode && d.parentNode.removeChild(d); try { sessionStorage.setItem("doros-inapp", "1"); } catch (e) {} };
    el.insertBefore(d, el.firstChild);
  }
  /* بداية السنة الدراسية الحالية (1 أوت): ما نُشر قبلها يذهب إلى «الأرشيف» */
  function yearStart() { var d = new Date(), y = d.getFullYear(); return (d.getMonth() + 1 >= 8 ? y : y - 1) + "-08-01"; }

  /* تطبيق قابل للتثبيت: تسجيل عامل الخدمة (يحفظ الصفحات والدروس للعمل بدون إنترنت) */
  var installEvt = null, installCbs = [];
  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
    window.addEventListener("load", function () { navigator.serviceWorker.register("sw.js").catch(function () {}); });
  }
  window.addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); installEvt = e; installCbs.forEach(function (f) { f(); }); });
  function canInstall() { return !!installEvt; }
  function onInstallable(f) { installCbs.push(f); if (installEvt) f(); }
  function install() { if (!installEvt) return Promise.resolve(false); var e = installEvt; installEvt = null; e.prompt(); return e.userChoice.then(function (c) { return c && c.outcome === "accepted"; }); }
  function standalone() { return (window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true; }
  function isIOS() { return /iphone|ipad|ipod/i.test(navigator.userAgent); }

  return { SUBJ:SUBJ, YEARS:YEARS, TERMS:TERMS, KINDS:KINDS, TYPES:TYPES, subj:subj, esc:esc, fmt:fmt, isNew:isNew, size:size, errText:errText,
    typeName:typeName, typeOf:typeOf, unitKey:unitKey, digits:digits, fold:fold, today:today, activeNews:activeNews, waLink:waLink, share:share, siteUrl:siteUrl,
    ytId:ytId, driveId:driveId, filePreview:filePreview, fileDownload:fileDownload, fileImage:fileImage,
    apiOn:apiOn, call:call, upload:upload, mime:mime, lessons:lessons, lesson:lesson, cached:cached, news:news, invalidate:invalidate,
    inApp:inApp, inAppNote:inAppNote, yearStart:yearStart, markView:markView, markVisit:markVisit,
    canInstall:canInstall, onInstallable:onInstallable, install:install, standalone:standalone, isIOS:isIOS };
})();
