// خادم فضاء الأساتذة — متوسطة الشهيد بلعكرمي أعمر
// الإصدار 7 (فضاء الأساتذة أسرع بكثير، والإشعار يظهر فورًا على الهاتف مع نصه)
// الإصدار 6 (إشعارات على الهواتف بدون شركة خارجية، رسائل للأساتذة فقط)
// الإصدار 5 (عدد المشاهدات والزيارات، قراءة الجدول حسب أسماء الأعمدة، منع التكرار، نسخة احتياطية)
//
// طريقة التركيب (مرة واحدة):
//   1. الصق هذا الملف كاملًا في مشروع جديد على script.google.com
//   2. اختر الدالة setup واضغط «تشغيل»، ثم اسمح بالأذونات
//   3. انسخ «رمز المدير» من سجل التنفيذ
//   4. نشر ← عملية نشر جديدة ← تطبيق ويب ← التنفيذ باسم: أنا ← الوصول: أي شخص
//   5. ضع رابط تطبيق الويب في ملف config.js في الموقع
//
// التحديث إلى إصدار جديد (الرابط لا يتغير):
//   الصق الكود الجديد مكان القديم ← حفظ ← نشر ← إدارة عمليات النشر ← ✏️ ← الإصدار: إصدار جديد ← نشر
//   (لا تختر «عملية نشر جديدة»: فهي تعطي رابطًا جديدًا)
//   من الإصدار 5 إلى 6 أو 7: بعد الحفظ اختر الدالة enablePush واضغط «تشغيل» مرة واحدة، واسمح بالإذن الجديد
//   (الاتصال بخدمة خارجية: لإرسال الإشعارات إلى Google وApple)، ثم انشر إصدارًا جديدًا كما سبق
//   من الإصدار 6 إلى 7: لا أذونات جديدة. الصق ← حفظ ← نشر إصدار جديد فقط
//
// البيانات تُحفظ في جدول Google باسم «دروس الموقع» في حسابك،
// والملفات في مجلد «ملفات دروس الموقع» (مشارك للعرض فقط).
// قواعد الجدول: لا تغيّر أسماء الأعمدة في الصف الأول، ولا تحذف المجلد.
// يمكنك إضافة أعمدة لك أو ترتيب الصفوف: الخادم يقرأ الأعمدة بأسمائها.
// بعد أي تعديل يدوي، اضغط «تحديث الموقع» في تبويب «الأساتذة» عند المدير.

var SCHOOL = "متوسطة الشهيد بلعكرمي أعمر";
var TZ = "Africa/Algiers";
var MAX_FILE_MB = 20;
var MAX_FILES = 10;
var MAX_VIDEOS = 10;
var DAILY_UPLOAD_MB = 2000;  // حد الرفع اليومي لكل أستاذ (حماية من رمز مسروق؛ المساحة الكبيرة في Drive تسمح بالكثير)
var EXCERPT = 220;           // طول مقتطف الشرح في قائمة الدروس
var CACHE_TTL = 21600;       // 6 ساعات (الحد الأقصى في Google)
var CHUNK = 40000;           // حجم القطعة في الذاكرة المؤقتة (أقل من حد 100KB)
var LOCK_WAIT = 30000;       // أقصى انتظار عند نشر عدة أساتذة في اللحظة نفسها
var VERSION = 7;
var VIEW_SHARDS = 20;        // عدّادات المشاهدات المؤقتة (موزعة حتى لا تتزاحم)
var VIEW_FLUSH = 600;        // تُنقل إلى الجدول مرة كل 10 دقائق على الأكثر

var ALLOWED = {
  "application/pdf": "pdf",
  "image/jpeg": "image", "image/png": "image", "image/webp": "image",
  "application/msword": "word",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "word",
  "application/vnd.ms-powerpoint": "slides",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "slides",
  "audio/mpeg": "audio", "audio/mp4": "audio", "audio/x-m4a": "audio", "audio/aac": "audio", "audio/wav": "audio"
};
var SUBJECTS = ["ar", "math", "fr", "en", "sci", "phy", "hist", "isl", "civ", "amz", "art", "mus", "info"];
var TYPES = ["lesson", "ex", "devoir", "exam", "corr", "bem", "bemc"];  // درس، تمارين، فرض، اختبار، تصحيح، موضوع BEM، تصحيح BEM
var L_HEAD = ["id", "date", "year", "subject", "term", "title", "text", "files", "videos", "teacher", "teacherId", "status", "updated", "type", "unit", "views"];
var T_HEAD = ["id", "name", "subjects", "code", "role", "active"];
var N_HEAD = ["id", "date", "title", "text", "until", "author", "status", "pinned", "audience"];   // audience: فارغ = الجميع، teachers = الأساتذة فقط
var S_HEAD = ["id", "endpoint", "kind", "teacherId", "created", "fails", "keys"];   // الهواتف المشتركة في الإشعارات (بدون أسماء). keys: مفتاحا التشفير من الهاتف
var L_SHEET = "الدروس", T_SHEET = "الأساتذة", N_SHEET = "الإعلانات", S_SHEET = "الإشعارات";
var L_TEXT = ["title", "text", "unit"], T_TEXT = ["name", "code"], N_TEXT = ["title", "text", "until"], S_TEXT = ["id", "endpoint", "keys"];
var MAX_SUBS = 5000;          // أقصى عدد هواتف مشتركة (حد Google: 20000 اتصال خارجي في اليوم)
var PUSH_TTL = 172800;        // هاتف مغلق يستلم الإشعار إذا اشتغل خلال يومين
var PUSH_CONTACT = "https://aadl.tech";   // يُرسل مع كل إشعار (معيار VAPID) ليعرف مزوّد الإشعارات صاحب الإرسال
var PUSH_ENC_MS = 25000;       // وقت أقصى لتشفير نصوص الإشعارات؛ الهواتف الباقية تستلم إشارة فارغة وتسأل الخادم عن النص
var PUSH_HOSTS = /^(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.push\.apple\.com|[a-z0-9.-]+\.notify\.windows\.com)$/;

// ---------------- الإعداد ----------------

function setup() {
  var p = PropertiesService.getScriptProperties();
  var ss = null, ssId = p.getProperty("SS");
  if (ssId) { try { ss = SpreadsheetApp.openById(ssId); } catch (e) { ss = null; } }
  if (!ss) { ss = SpreadsheetApp.create("دروس الموقع - " + SCHOOL); p.setProperty("SS", ss.getId()); }
  SS_ = ss;

  var lsh = ss.getSheetByName(L_SHEET) || ss.insertSheet(L_SHEET);
  var tsh = ss.getSheetByName(T_SHEET) || ss.insertSheet(T_SHEET);
  var nsh = ss.getSheetByName(N_SHEET) || ss.insertSheet(N_SHEET), ssh = ss.getSheetByName(S_SHEET) || ss.insertSheet(S_SHEET);
  headers_(lsh, L_HEAD, L_TEXT); headers_(tsh, T_HEAD, T_TEXT); headers_(nsh, N_HEAD, N_TEXT); headers_(ssh, S_HEAD, S_TEXT);
  ss.getSheets().forEach(function (s) {
    var n = s.getName();
    if (n !== L_SHEET && n !== T_SHEET && n !== N_SHEET && n !== S_SHEET && s.getLastRow() === 0 && ss.getSheets().length > 4) ss.deleteSheet(s);
  });

  var folderId = p.getProperty("FOLDER"), folder = null;
  if (folderId) { try { folder = DriveApp.getFolderById(folderId); } catch (e) { folder = null; } }
  if (!folder) {
    folder = DriveApp.createFolder("ملفات دروس الموقع - " + SCHOOL);
    p.setProperty("FOLDER", folder.getId());
  }
  try { folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}

  var tt = table_(tsh, T_HEAD), admin = teachers_(tt).filter(function (t) { return t.role === "admin"; })[0];
  if (!admin) {
    admin = { id: newId_(), name: "مدير الموقع", subjects: "", code: newCode_(), role: "admin", active: true };
    insert_(tt, admin);
  }
  TF_ = null; teachersFresh_();
  snapshot_(rebuild_({ freshNews: true }));
  try { vapid_(true); } catch (e) {}
  Logger.log("✅ تم الإعداد.");
  Logger.log("🔑 رمز المدير: " + admin.code);
  Logger.log("📄 جدول البيانات: " + ss.getUrl());
  return admin.code;
}

// تنظيف: يحذف (إلى سلة المهملات) الملفات المرفوعة قبل أكثر من يومين ولم تُستعمل في أي درس.
// شغّلها يدويًا من المحرر مرة كل بضعة أشهر.
function cleanup() {
  var used = {};
  lessons_().forEach(function (l) { if (l.status === "published") l.files.forEach(function (f) { used[f.id] = 1; }); });
  var it = folder_().getFiles(), old = Date.now() - 2 * 864e5, n = 0, checked = 0;
  while (it.hasNext() && checked < 2000) {
    var f = it.next(); checked++;
    if (String(f.getName()).charAt(0) === "_") continue;   // ملفات الخادم (مثل النسخة السريعة)
    if (!used[f.getId()] && f.getDateCreated().getTime() < old) { try { f.setTrashed(true); n++; } catch (e) {} }
  }
  Logger.log("🧹 تم فحص " + checked + " ملف، ونُقل " + n + " ملف غير مستعمل إلى سلة المهملات.");
}

// نسخة احتياطية من الجدول (الدروس، الأساتذة، الإعلانات) في Drive الخاص بك، خارج مجلد الملفات العام
function backup() {
  var id = PropertiesService.getScriptProperties().getProperty("SS");
  if (!id) throw new Error("NOT_SETUP");
  var copy = DriveApp.getFileById(id).makeCopy("نسخة احتياطية - دروس الموقع - " + Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd HH:mm"));
  Logger.log("💾 نسخة احتياطية: " + copy.getUrl());
  return copy.getUrl();
}

// ---------------- نقاط الوصول ----------------

function doGet(e) {
  TF_ = null; SS_ = null;
  var p = (e && e.parameter) || {};
  try {
    if (p.api === "lessons" || p.api === "lesson") {
      // المشاهدات تصل مع طلبات القراءة العادية (بدون طلب إضافي للخادم): seen = دروس فتحها التلميذ، visit = أول زيارة له اليوم
      // vn: رقم يرسله الهاتف ويعود كما هو، فلا يظن الهاتف أن ردًا قديمًا محفوظًا أكّد وصول مشاهداته
      var vs = { seen: 0, visit: 0 }, vn = String(p.vn || "").replace(/[^a-z0-9]/g, "").slice(0, 12);
      if (p.seen || p.visit) { try { vs = views_(String(p.seen || ""), p.visit === "1"); } catch (e) {} }
      if (p.api === "lessons") { var pub = publicList_(), pk = null; try { pk = vapid_(false); } catch (e) {}
        return json_({ ok: true, v: VERSION, lessons: pub.list, news: pub.news, push: pk ? pk.pub : "", seen: vs.seen, visit: vs.visit, vn: vn }); }
      var l = publicLesson_(String(p.id || ""));
      return json_(l ? { ok: true, v: VERSION, lesson: l, seen: vs.seen, visit: vs.visit, vn: vn } : { ok: false, v: VERSION, error: "NOT_FOUND", seen: vs.seen, visit: vs.visit, vn: vn });
    }
    // الهاتف استيقظ بإشعار: ما نص الرسالة؟ (s = رقم اشتراك الهاتف، يحدد هل هو هاتف أستاذ)
    if (p.api === "pushmsg") return json_({ ok: true, v: VERSION, msg: pushMsg_(String(p.s || "").slice(0, 40)) });
  } catch (err) { return json_({ ok: false, error: errCode_(err) }); }
  return HtmlService.createHtmlOutput('<p dir="rtl" style="font:16px sans-serif">خادم دروس ' + SCHOOL + ' يعمل ✓</p>');
}

function doPost(e) {
  TF_ = null; SS_ = null;
  try {
    var req = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    // الاشتراك في الإشعارات لا يحتاج رمزًا (التلاميذ والأولياء)؛ مع رمز أستاذ يصبح اشتراك أستاذ
    if (req.action === "pushSub") { var sub = pushSub_(req); sub.ok = true; return json_(sub); }
    if (req.action === "pushUnsub") { pushUnsub_(req); return json_({ ok: true }); }
    // العمليات التي تغيّر شيئًا تتأكد من الرمز في الجدول نفسه؛ القراءة تتأكد منه في الذاكرة المؤقتة (أسرع بكثير)
    var strict = /^(save|delete|teachers|addTeacher|removeTeacher|resetCode|newsSave|newsDelete|refresh|backup)$/.test(String(req.action));
    var who = auth_(req.code, strict), out;
    switch (req.action) {
      case "login": var lk = null; try { lk = vapid_(false); } catch (x) {} out = { name: who.name, role: who.role, subjects: who.subjects, v: VERSION, push: lk ? lk.pub : "" };
        if (req.boot) boot_(who, out);   // كل ما تحتاجه صفحة الأستاذ عند فتحها، في طلب واحد
        break;
      case "teacherNews": out = { news: activeNews_("teachers") }; break;
      case "pushTest": out = { push: pushSend_("all", "تجربة الإشعارات ✓", "الإشعارات تعمل على هذا الهاتف.", String(req.s || "")) }; break;
      case "upload": out = { file: upload_(who, req.file) }; break;
      case "save": out = save_(who, req.lesson); break;   // { id } أو { id, dup: true } إذا وصلت المحاولة نفسها مرة ثانية
      case "mine": out = { lessons: mine_(who) }; break;
      case "delete": del_(who, req.id); out = {}; break;
      case "teachers": admin_(who); out = { teachers: teachersFresh_().map(publicTeacher_), storage: storage_(), visits: visits_(), push: pushCounts_() }; break;
      case "addTeacher": admin_(who); out = { teacher: publicTeacher_(addTeacher_(req.name, req.subjects)) }; break;
      case "removeTeacher": admin_(who); removeTeacher_(req.id); out = {}; break;
      case "resetCode": admin_(who); out = { code: resetCode_(req.id) }; break;
      case "news": admin_(who); out = { news: newsAll_() }; break;
      case "newsSave": admin_(who); var ns = newsSave_(who, req.item); out = { id: ns.id };
        // الإعلان يُحفظ أولًا؛ إن تعذّر الإشعار يبقى الإعلان منشورًا ويُخبَر المدير بالسبب.
        // الإشعار يُرسل قبل حفظ النسخة السريعة في Drive، فيصل إلى الهواتف أسرع
        if (req.item && req.item.push === true) { try { out.push = pushSend_(req.item.audience, req.item.title, req.item.text); } catch (x) { out.pushError = errCode_(x); } }
        snapshot_(ns.built);
        break;
      case "newsDelete": admin_(who); newsDelete_(req.id); out = {}; break;
      case "refresh": admin_(who); out = refresh_(); break;
      case "backup": admin_(who); out = { url: backup() }; break;
      default: throw new Error("BAD_ACTION");
    }
    out.ok = true;
    return json_(out);
  } catch (err) {
    return json_({ ok: false, error: errCode_(err) });
  }
}

// ---------------- الجدول: القراءة والكتابة حسب أسماء الأعمدة ----------------

function table_(sheetOrName, head) {
  var sh = typeof sheetOrName === "string" ? sheet_(sheetOrName) : sheetOrName;
  var v = sh.getDataRange().getValues();
  var hdr = (v[0] || []).map(function (x) { return String(x).trim(); });
  var map = {};
  head.forEach(function (n) { map[n] = hdr.indexOf(n); });
  var rows = [];
  for (var i = 1; i < v.length; i++) {
    var r = v[i], o = { _row: i + 1 };
    head.forEach(function (n) { o[n] = map[n] >= 0 ? r[map[n]] : ""; });
    if (o.id !== "" && o.id != null) rows.push(o);
  }
  return { sh: sh, map: map, width: Math.max(hdr.length, 1), rows: rows };
}
function cell_(v) { return typeof v === "string" ? safe_(v) : v; }
function insert_(t, obj) {
  var a = [];
  for (var i = 0; i < t.width; i++) a.push("");
  for (var k in obj) if (t.map[k] >= 0) a[t.map[k]] = cell_(obj[k]);
  t.sh.appendRow(a);
}
// يكتب أعمدة الخادم فقط (في مجموعات متجاورة)، فلا تُمسّ الأعمدة التي أضافها المدير لنفسه
function update_(t, r, obj) {
  var cols = [];
  for (var k in obj) if (t.map[k] >= 0) cols.push(t.map[k]);
  cols.sort(function (a, b) { return a - b; });
  for (var i = 0; i < cols.length;) {
    var j = i, vals = [];
    while (j + 1 < cols.length && cols[j + 1] === cols[j] + 1) j++;
    for (var c = i; c <= j; c++) for (var key in obj) if (t.map[key] === cols[c]) vals.push(cell_(obj[key]));
    t.sh.getRange(r._row, cols[i] + 1, 1, vals.length).setValues([vals]);
    i = j + 1;
  }
}
function setCell_(t, r, name, val) { if (t.map[name] >= 0) t.sh.getRange(r._row, t.map[name] + 1).setValue(cell_(val)); }

// يضيف الأعمدة الناقصة في آخر الجدول (بدون لمس الموجود)، ويثبّت ويحمي صف العناوين
function headers_(sh, head, textCols) {
  var last = Math.max(sh.getLastColumn(), 1);
  var hdr = sh.getRange(1, 1, 1, last).getValues()[0].map(function (x) { return String(x).trim(); });
  var changed = false;
  if (hdr.every(function (x) { return !x; })) { sh.getRange(1, 1, 1, head.length).setValues([head]); hdr = head.slice(); changed = true; }
  else head.forEach(function (n) { if (hdr.indexOf(n) < 0) { hdr.push(n); sh.getRange(1, hdr.length).setValue(n); changed = true; } });
  if (changed) (textCols || []).forEach(function (n) { var c = hdr.indexOf(n); if (c >= 0) sh.getRange(1, c + 1, sh.getMaxRows(), 1).setNumberFormat("@"); });
  guard_(sh);
}
// مرة واحدة لكل ورقة: تجميد صف العناوين (لا يتحرك عند الترتيب) وتحذير عند محاولة تعديله
function guard_(sh) {
  var p = PropertiesService.getScriptProperties(), key = "guard:" + sh.getName();
  if (p.getProperty(key)) return;
  try {
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, sh.getMaxColumns()).protect().setDescription("عناوين الأعمدة: لا تغيّر أسماءها").setWarningOnly(true);
    p.setProperty(key, "1");
  } catch (e) {}
}

// ---------------- الأساتذة ----------------

// strict = نتأكد من الجدول نفسه (للعمليات التي تغيّر شيئًا). غير ذلك: من الذاكرة المؤقتة، وإن لم يوجد الرمز فيها
// (رمز جديد أُضيف يدويًا في الجدول مثلًا) نقرأ الجدول مرة، إلا إذا قُرئ قبل أقل من دقيقة
function auth_(code, strict) {
  code = String(code || "").trim().toUpperCase();
  if (code.length < 6) throw new Error("AUTH");
  function find(all) { return all.filter(function (x) { return x.code === code && x.active; })[0]; }
  var all = strict ? teachersFresh_() : teachersFast_(), t = find(all);
  if (!t && !all.fresh && !CacheService.getScriptCache().get("tfresh")) t = find(teachersFresh_());
  if (!t) throw new Error("AUTH");
  return t;
}
function admin_(who) { if (who.role !== "admin") throw new Error("FORBIDDEN"); }

function teacherOf_(r) {
  return { id: String(r.id), name: String(r.name), subjects: String(r.subjects || ""), code: String(r.code).trim().toUpperCase(),
           role: r.role === "admin" ? "admin" : "teacher", active: r.active !== false && String(r.active).toUpperCase() !== "FALSE", _r: r };
}
function teachers_(t) { return (t || table_(T_SHEET, T_HEAD)).rows.map(teacherOf_); }
function publicTeacher_(t) { return { id: t.id, name: t.name, subjects: t.subjects, code: t.code, role: t.role, active: t.active }; }

// قائمة الأساتذة للتحقق السريع من الرمز، بدون فتح الجدول (فتحه يأخذ 3 إلى 5 ثوانٍ):
// في الذاكرة المؤقتة، ونسخة في خصائص المشروع تبقى بعد انتهاء صلاحية الذاكرة. تتجدد عند كل تغيير من الموقع،
// وعند كل نشر أو حذف (يُقرأ فيهما الجدول على أي حال)، وعند «تحديث الموقع».
var TF_ = null;   // القائمة كما قُرئت من الجدول في هذا الطلب
function tpack_(all) { return JSON.stringify(all.map(function (t) { return [t.id, t.name, t.subjects, t.code, t.role === "admin" ? 1 : 0, t.active ? 1 : 0]; })); }
function tunpack_(s) { return JSON.parse(s).map(function (a) { return { id: String(a[0]), name: String(a[1]), subjects: String(a[2] || ""), code: String(a[3]), role: a[4] ? "admin" : "teacher", active: !!a[5] }; }); }
function teachersKeep_(all) {
  var s = tpack_(all), c = CacheService.getScriptCache();
  c.put("tfresh", "1", 60);
  if (c.get("teachers") === s) return;
  c.put("teachers", s, CACHE_TTL);
  try { propsPut_("TEACHERS", s); } catch (e) {}
}
function teachersFresh_() {
  if (TF_) return TF_;
  var lock = LockService.getScriptLock(), mine = lock.tryLock(0);   // نحفظ النسخة فقط ونحن نملك القفل: لا تسبق نسخةٌ قديمة تغييرًا يجري الآن
  try { TF_ = teachers_(); if (mine) teachersKeep_(TF_); } finally { if (mine) lock.releaseLock(); }
  TF_.fresh = true;
  return TF_;
}
function teachersFast_() {
  var c = CacheService.getScriptCache(), s = c.get("teachers");
  if (!s) { s = propsGet_("TEACHERS"); if (s) c.put("teachers", s, CACHE_TTL); }
  if (s) { try { return tunpack_(s); } catch (e) {} }
  return teachersFresh_();
}
// بعد تغيير من الموقع (والقفل محجوز): القائمة الجديدة مباشرة
function teachersSet_(all) { TF_ = all; TF_.fresh = true; teachersKeep_(all); }

function addTeacher_(name, subjects) {
  name = clean_(name, 60);
  if (name.length < 2) throw new Error("BAD_INPUT");
  subjects = String(subjects || "").split(",").filter(function (s) { return SUBJECTS.indexOf(s) >= 0; }).join(",");
  var lock = lock_();
  try {
    var sh = sheet_(T_SHEET); headers_(sh, T_HEAD, T_TEXT);
    var tt = table_(sh, T_HEAD);
    var all = teachers_(tt), t = { id: newId_(), name: name, subjects: subjects, code: uniqueCode_(all), role: "teacher", active: true };
    insert_(tt, t);
    all.push(t); teachersSet_(all);
    return t;
  } finally { lock.releaseLock(); }
}

function removeTeacher_(id) {
  var lock = lock_();
  try {
    var tt = table_(T_SHEET, T_HEAD), all = teachers_(tt), t = all.filter(function (x) { return x.id === String(id); })[0];
    if (!t) throw new Error("NOT_FOUND");
    if (t.role === "admin") throw new Error("FORBIDDEN");
    setCell_(tt, t._r, "active", false);
    t.active = false; teachersSet_(all);
    try { pushDropTeacher_(t.id); } catch (e) {}
  } finally { lock.releaseLock(); }
}

// رمز جديد لأستاذ (مثلًا إذا ضاع هاتفه). الرمز القديم يتوقف فورًا.
function resetCode_(id) {
  var lock = lock_();
  try {
    var tt = table_(T_SHEET, T_HEAD), all = teachers_(tt), t = all.filter(function (x) { return x.id === String(id); })[0];
    if (!t || !t.active) throw new Error("NOT_FOUND");
    if (t.role === "admin") throw new Error("FORBIDDEN");
    var code = uniqueCode_(all);
    setCell_(tt, t._r, "code", code);
    t.code = code; teachersSet_(all);
    return code;
  } finally { lock.releaseLock(); }
}

// ---------------- الملفات ----------------

function upload_(who, f) {
  if (!f || !f.data || !f.type) throw new Error("BAD_INPUT");
  var kind = ALLOWED[f.type];
  if (!kind) throw new Error("FILE_TYPE");
  var bytes = Utilities.base64Decode(f.data);
  if (bytes.length > MAX_FILE_MB * 1024 * 1024) throw new Error("FILE_SIZE");
  if (who.role !== "admin") quota_(who, bytes.length);
  var name = clean_(f.name, 120) || ("ملف." + kind);
  if (name.charAt(0) === "_") name = name.slice(1) || "ملف";
  var file = folder_().createFile(Utilities.newBlob(bytes, f.type, name));
  try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}
  try { file.setDescription("u:" + who.id + " · " + who.name); } catch (e) {}
  return { id: file.getId(), name: name, type: f.type, kind: kind, size: bytes.length };
}

// حد الرفع اليومي لكل أستاذ
function quota_(who, n) {
  var p = PropertiesService.getScriptProperties(), key = "q:" + who.id, today = day_(Date.now());
  var q; try { q = JSON.parse(p.getProperty(key) || "{}"); } catch (e) { q = {}; }
  if (q.d !== today) q = { d: today, b: 0 };
  if (q.b + n > DAILY_UPLOAD_MB * 1024 * 1024) throw new Error("QUOTA");
  q.b += n;
  p.setProperty(key, JSON.stringify(q));
}

function ownFile_(id) {
  try {
    var file = DriveApp.getFileById(String(id)), it = file.getParents(), fid = folder_().getId();
    while (it.hasNext()) if (it.next().getId() === fid) return file;
  } catch (e) {}
  return null;
}
function uploader_(file) {
  var m = String(file.getDescription() || "").match(/^u:([a-z0-9]+)/);
  return m ? m[1] : "";
}
// مساحة Drive (للمدير): تُحفظ ساعة في الذاكرة المؤقتة، فسؤال Drive بطيء
function storage_() {
  var c = CacheService.getScriptCache(), v = c.get("storage");
  if (v) { try { return JSON.parse(v); } catch (e) {} }
  try { var o = { used: DriveApp.getStorageUsed(), limit: DriveApp.getStorageLimit() }; c.put("storage", JSON.stringify(o), 3600); return o; } catch (e) { return null; }
}

// ---------------- الدروس ----------------

function lessonOf_(r) {
  return {
    id: String(r.id), ts: Number(r.date) || 0, date: day_(r.date), year: Number(r.year), subject: String(r.subject), term: Number(r.term) || 0,
    title: String(r.title), text: String(r.text || ""), files: parse_(r.files), videos: parse_(r.videos),
    teacher: String(r.teacher || ""), teacherId: String(r.teacherId || ""), status: String(r.status), _r: r,
    type: TYPES.indexOf(String(r.type)) >= 0 ? String(r.type) : "lesson", unit: String(r.unit || ""), views: Number(r.views) || 0
  };
}
function lessons_(t) { return (t || table_(L_SHEET, L_HEAD)).rows.map(lessonOf_); }

function save_(who, L) {
  if (!L) throw new Error("BAD_INPUT");
  var year = parseInt(L.year, 10), term = parseInt(L.term, 10) || 0;
  var subject = String(L.subject || ""), title = clean_(L.title, 140), text = String(L.text || "").replace(/\r\n/g, "\n").slice(0, 6000).trim();
  var type = TYPES.indexOf(String(L.type)) >= 0 ? String(L.type) : "lesson", unit = clean_(L.unit, 60);
  if (type === "bem" || type === "bemc") year = 4;   // شهادة التعليم المتوسط تخص الرابعة متوسط
  if (!(year >= 1 && year <= 4) || SUBJECTS.indexOf(subject) < 0 || term < 0 || term > 3 || !title) throw new Error("BAD_INPUT");
  var videos = (Array.isArray(L.videos) ? L.videos : []).map(function (v) { return String(v || "").trim(); })
    .filter(function (v) { return /^https:\/\/\S+$/i.test(v) && v.length < 500; }).slice(0, MAX_VIDEOS);
  var wanted = (Array.isArray(L.files) ? L.files : []).slice(0, MAX_FILES);
  if (!text && !wanted.length && !videos.length) throw new Error("EMPTY");

  // منع التكرار: نفس محاولة النشر (رقمها من الموقع) لا تُسجَّل مرتين، حتى لو انقطع الاتصال وأعاد الأستاذ الضغط
  var rid = /^[A-Za-z0-9_-]{8,40}$/.test(String(L.rid || "")) ? "rid:" + L.rid : "", cache = CacheService.getScriptCache();
  if (rid) { var dup = cache.get(rid); if (dup) return { id: dup, dup: true }; }

  // التحقق من الملفات قبل القفل (عمليات Drive بطيئة، ولا نريد أن ينتظر الأساتذة الآخرون)
  var pre = L.id ? lessons_().filter(function (x) { return x.id === String(L.id) && x.status === "published"; })[0] : null;
  if (L.id && !pre) throw new Error("NOT_FOUND");
  if (pre && who.role !== "admin" && pre.teacherId !== who.id) throw new Error("FORBIDDEN");
  var had = pre ? pre.files.map(function (f) { return f.id; }) : [];
  var files = wanted.map(function (f) {
    var file = f && ownFile_(f.id);
    if (!file) throw new Error("BAD_FILE");
    var fid = String(f.id);
    if (who.role !== "admin" && had.indexOf(fid) < 0 && uploader_(file) !== who.id) throw new Error("BAD_FILE");
    return { id: fid, name: clean_(f.name, 120), type: String(f.type || ""), kind: ALLOWED[f.type] || "file", size: Number(f.size) || 0 };
  });

  var id, all, removed = [], built;
  var lock = lock_();
  try {
    if (rid) { var dup2 = cache.get(rid); if (dup2) return { id: dup2, dup: true }; }
    var sh = sheet_(L_SHEET); headers_(sh, L_HEAD, L_TEXT);
    var t = table_(sh, L_HEAD), now = Date.now();
    all = lessons_(t);
    var rec = { year: year, subject: subject, term: term, title: title, text: text, files: JSON.stringify(files),
                videos: JSON.stringify(videos), status: "published", updated: now, type: type, unit: unit };
    if (L.id) {
      var old = all.filter(function (x) { return x.id === String(L.id) && x.status === "published"; })[0];
      if (!old) throw new Error("NOT_FOUND");
      if (who.role !== "admin" && old.teacherId !== who.id) throw new Error("FORBIDDEN");
      var keep = files.map(function (f) { return f.id; });
      removed = old.files.filter(function (f) { return keep.indexOf(f.id) < 0; });
      update_(t, old._r, rec);
      id = old.id;
      all = all.map(function (x) { return x.id === id ? merge_(x, rec) : x; });
    } else {
      id = newId_();
      rec.id = id; rec.date = now; rec.teacher = who.name; rec.teacherId = who.id;
      insert_(t, rec);
      all.push(lessonOf_(rec));
    }
    if (rid) cache.put(rid, id, CACHE_TTL);
    built = rebuild_({ lessons: all });
  } finally { lock.releaseLock(); }
  if (removed.length) trashUnused_(removed, all, "");
  snapshot_(built);
  return { id: id };
}
function merge_(l, rec) {
  var o = {}; for (var k in l) o[k] = l[k];
  o.year = rec.year; o.subject = rec.subject; o.term = rec.term; o.title = rec.title; o.text = rec.text;
  o.files = parse_(rec.files); o.videos = parse_(rec.videos); o.status = "published"; o.type = rec.type; o.unit = rec.unit;
  return o;
}

function del_(who, id) {
  var l, all, built;
  var lock = lock_();
  try {
    var t = table_(L_SHEET, L_HEAD);
    all = lessons_(t); l = all.filter(function (x) { return x.id === String(id) && x.status === "published"; })[0];
    if (!l) throw new Error("NOT_FOUND");
    if (who.role !== "admin" && l.teacherId !== who.id) throw new Error("FORBIDDEN");
    setCell_(t, l._r, "status", "deleted");
    all = all.map(function (x) { if (x.id !== l.id) return x; var o = {}; for (var k in x) o[k] = x[k]; o.status = "deleted"; return o; });
    built = rebuild_({ lessons: all });
  } finally { lock.releaseLock(); }
  trashUnused_(l.files, all, l.id);
  snapshot_(built);
}

// لا يُحذف ملف ما دام درس آخر منشور يستعمله
function trashUnused_(files, all, exceptId) {
  var used = {};
  all.forEach(function (x) { if (x.status === "published" && x.id !== exceptId) x.files.forEach(function (f) { used[f.id] = 1; }); });
  files.forEach(function (f) { if (!used[f.id]) trash_(f.id); });
}

function view_(l, withOwner) {
  var o = { id: l.id, ts: l.ts, date: l.date, year: l.year, subject: l.subject, term: l.term, title: l.title, text: l.text,
            files: l.files, videos: l.videos, teacher: l.teacher, type: l.type, unit: l.unit };
  if (withOwner) o.teacherId = l.teacherId;
  return o;
}

// دروس الأستاذ (أو كل الدروس للمدير): من الذاكرة المؤقتة التي يبنيها rebuild_، بدون فتح الجدول.
// own = لكل درس: [رقم الأستاذ، المشاهدات المحفوظة في الجدول]، ونضيف المشاهدات التي لم تُنقل إلى الجدول بعد
function mine_(who) {
  var b = ownData_(), buf = viewBuffer_().lessons, out = [];
  b.list.forEach(function (v) {
    var o = b.own[v.id];
    if (!o || (who.role !== "admin" && o[0] !== who.id)) return;
    var x = {}; for (var k in v) x[k] = v[k];
    if (x.more) { x.text = b.texts[x.id]; delete x.more; }
    x.teacherId = o[0]; x.views = (Number(o[1]) || 0) + (buf[v.id] || 0);
    out.push(x);
  });
  return out;   // القائمة مرتبة أصلًا: الأحدث أولًا
}
// القائمة والشروح الكاملة وأصحاب الدروس، من نفس عملية البناء (وإلا نعيد البناء: لا نعرض شرحًا مقطوعًا للتعديل)
function ownData_() {
  try {
    var g = cacheGetMany_(["own", "list", "texts"]);
    if (g) {
      var o = JSON.parse(g.own.s);
      if (o.l === g.list.v && o.t === g.texts.v) {
        var b = { list: JSON.parse(g.list.s), texts: JSON.parse(g.texts.s), own: o.m };
        if (b.list.every(function (v) { return !v.more || typeof b.texts[v.id] === "string"; })) return b;
      }
    }
  } catch (e) {}
  var lock = LockService.getScriptLock();
  if (lock.tryLock(0)) { try { return rebuild_({}); } finally { lock.releaseLock(); } }
  return rebuild_({ noCache: true });
}
// الإصدار 7: كل ما تحتاجه صفحة الأستاذ عند فتحها (دروسه، رسائل الإدارة؛ وللمدير: الإعلانات والأساتذة والأرقام)
function boot_(who, out) {
  try { out.mine = mine_(who); } catch (e) {}
  try { out.tnews = activeNews_("teachers"); } catch (e) {}
  if (who.role !== "admin") return;
  try { out.news = newsAll_(); } catch (e) {}
  try { out.teachers = teachersFast_().map(publicTeacher_); } catch (e) {}
  out.storage = storage_();
  try { out.visits = visits_(); } catch (e) {}
  try { out.pushn = pushCounts_(); } catch (e) {}
}

// ---------------- عدد المشاهدات والزيارات ----------------
// كل هاتف تلميذ يُحسب مرة واحدة في اليوم لكل درس (والزيارة مرة واحدة في اليوم)، وهواتف الأساتذة لا تُحسب.
// العدّ يمرّ أولًا بذاكرة مؤقتة موزعة على 20 خانة (سريع، بدون قفل)، ثم يُنقل إلى عمود «views» في الجدول
// وإلى خاصية «visits» مرة كل 10 دقائق على الأكثر. الأرقام تقريبية (قد يضيع عدد قليل جدًا عند الزحام الشديد).

function views_(s, visit) {
  var ids = [], seen = {};
  String(s).split(",").forEach(function (x) { x = x.trim(); if (/^[a-z0-9]{6,30}$/.test(x) && !seen[x] && ids.length < 30) { seen[x] = 1; ids.push(x); } });
  if (!ids.length && !visit) return { seen: 0, visit: 0 };
  var c = CacheService.getScriptCache(), key = "vb:" + Math.floor(Math.random() * VIEW_SHARDS), m;
  try { m = JSON.parse(c.get(key) || "{}"); } catch (e) { m = {}; }
  ids.forEach(function (id) { m[id] = (m[id] || 0) + 1; });
  if (visit) { var d = "@" + day_(Date.now()); m[d] = (m[d] || 0) + 1; }
  c.put(key, JSON.stringify(m), CACHE_TTL);
  if (!c.get("vflush")) {
    var lock = LockService.getScriptLock();
    if (lock.tryLock(0)) { try { c.put("vflush", "1", VIEW_FLUSH); flushViews_(); } catch (e) {} finally { lock.releaseLock(); } }
  }
  return { seen: ids.length, visit: visit ? 1 : 0 };
}

function viewKeys_() { var k = []; for (var i = 0; i < VIEW_SHARDS; i++) k.push("vb:" + i); return k; }
function viewBuffer_() {
  var got = CacheService.getScriptCache().getAll(viewKeys_()), out = { lessons: {}, days: {}, any: false };
  for (var key in got) {
    var m; try { m = JSON.parse(got[key]); } catch (e) { continue; }
    for (var id in m) {
      out.any = true;
      if (id.charAt(0) === "@") out.days[id.slice(1)] = (out.days[id.slice(1)] || 0) + m[id];
      else out.lessons[id] = (out.lessons[id] || 0) + m[id];
    }
  }
  return out;
}

// يُستدعى والقفل محجوز
function flushViews_() {
  var c = CacheService.getScriptCache(), b = viewBuffer_();
  if (!b.any) return;
  c.removeAll(viewKeys_());
  try {
    if (Object.keys(b.lessons).length) {
      var sh = sheet_(L_SHEET); headers_(sh, L_HEAD, L_TEXT);
      var last = sh.getLastRow();
      if (last >= 2) {
        var hdr = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function (x) { return String(x).trim(); });
        var ci = hdr.indexOf("id") + 1, cv = hdr.indexOf("views") + 1;
        if (ci > 0 && cv > 0) {
          var ids = sh.getRange(2, ci, last - 1, 1).getValues(), vals = sh.getRange(2, cv, last - 1, 1).getValues(), changed = false;
          for (var r = 0; r < ids.length; r++) { var n = b.lessons[String(ids[r][0])]; if (n) { vals[r][0] = (Number(vals[r][0]) || 0) + n; changed = true; } }
          if (changed) { sh.getRange(2, cv, last - 1, 1).setValues(vals); ownAdd_(b.lessons); }
        }
      }
      b.lessons = {};
    }
    if (Object.keys(b.days).length) {
      var p = PropertiesService.getScriptProperties(), v;
      try { v = JSON.parse(p.getProperty("visits") || "{}"); } catch (e) { v = {}; }
      for (var d in b.days) v[d] = (v[d] || 0) + b.days[d];
      var ks = Object.keys(v).sort(); while (ks.length > 400) delete v[ks.shift()];
      p.setProperty("visits", JSON.stringify(v));
      b.days = {};
    }
  } catch (e) {
    // فشل النقل: نعيد ما لم يُحفظ إلى الذاكرة المؤقتة ليُنقل في المرة القادمة
    var back = {}, k;
    for (k in b.lessons) back[k] = b.lessons[k];
    for (k in b.days) back["@" + k] = b.days[k];
    if (Object.keys(back).length) c.put("vb:0", JSON.stringify(back), CACHE_TTL);
  }
}

// المشاهدات نُقلت إلى الجدول: نضيفها أيضًا إلى نسخة «own» في الذاكرة (يُستدعى والقفل محجوز)
function ownAdd_(add) {
  try {
    var s = cacheGet_("own"); if (!s) return;
    var o = JSON.parse(s);
    for (var id in add) if (o.m[id]) o.m[id][1] = (Number(o.m[id][1]) || 0) + add[id];
    cachePut_("own", JSON.stringify(o));
  } catch (e) {}
}

// للمدير: الزيارات اليومية (اليوم، آخر 7 أيام، آخر 30 يومًا، المجموع، وآخر 14 يومًا يومًا بيوم)
function visits_() {
  var v; try { v = JSON.parse(PropertiesService.getScriptProperties().getProperty("visits") || "{}"); } catch (e) { v = {}; }
  var buf = viewBuffer_().days, d;
  for (d in buf) v[d] = (v[d] || 0) + buf[d];
  var now = Date.now(), out = { today: 0, d7: 0, d30: 0, total: 0, days: [] };
  for (var i = 0; i < 30; i++) {
    var k = day_(now - i * 864e5), n = v[k] || 0;
    if (i === 0) out.today = n;
    if (i < 7) out.d7 += n;
    out.d30 += n;
    if (i < 14) out.days.unshift([k, n]);
  }
  for (d in v) out.total += v[d];
  return out;
}

// ---------------- لوحة الإعلانات (المدير فقط) ----------------

function newsSheet_() {
  var ss = ss_(), sh = ss.getSheetByName(N_SHEET);
  if (!sh) { sh = ss.insertSheet(N_SHEET); headers_(sh, N_HEAD, N_TEXT); }
  return sh;
}
function newsOf_(r) {
  return { id: String(r.id), ts: Number(r.date) || 0, date: day_(r.date), title: String(r.title), text: String(r.text || ""),
           until: dayOrEmpty_(r.until), author: String(r.author || ""), status: String(r.status),
           pinned: r.pinned === true || String(r.pinned).toUpperCase() === "TRUE", audience: String(r.audience || "") === "teachers" ? "teachers" : "", _r: r };
}
function newsRows_(t) { return (t || table_(newsSheet_(), N_HEAD)).rows.map(newsOf_); }
function newsView_(n) { return { id: n.id, date: n.date, title: n.title, text: n.text, until: n.until, pinned: n.pinned, audience: n.audience }; }
// كل الإعلانات المنشورة. fresh = من الجدول؛ وإلا من الذاكرة المؤقتة (تُكتب فقط والقفل محجوز، حتى لا تسبق نسخةٌ قديمة تعديلًا)
function newsAll_(fresh) {
  if (!fresh) {
    var s = cacheGet_("newsall");
    if (s) { try { return JSON.parse(s); } catch (e) {} }
    var lock = LockService.getScriptLock();
    if (lock.tryLock(0)) { try { var a = newsAll_(true); cachePut_("newsall", JSON.stringify(a)); return a; } finally { lock.releaseLock(); } }
  }
  return newsRows_().filter(function (n) { return n.status === "published"; })
    .sort(function (a, b) { return (b.pinned - a.pinned) || (b.ts - a.ts); }).map(newsView_);
}
// الإعلانات الظاهرة: للموقع العام (بدون رسائل الأساتذة)، أو للأساتذة فقط داخل فضائهم
function activeNews_(aud, all) {
  var today = day_(Date.now());
  return (all || newsAll_()).filter(function (n) { return (!n.until || n.until >= today) && (aud === "teachers" ? n.audience === "teachers" : n.audience !== "teachers"); }).slice(0, 10);
}
// بعد تعديل الإعلانات (والقفل محجوز): نجدد ذاكرة الإعلانات فقط، والدروس من الذاكرة كما هي (أسرع)
function newsBuilt_() {
  var g = null;
  try { g = cacheGetMany_(["list", "texts"]); } catch (e) {}
  if (!g) return rebuild_({ freshNews: true });
  var all = newsAll_(true), news = activeNews_("", all);
  cachePut_("newsall", JSON.stringify(all)); cachePut_("news", JSON.stringify(news));
  return { list: JSON.parse(g.list.s), texts: JSON.parse(g.texts.s), news: news };
}
function newsSave_(who, it) {
  if (!it) throw new Error("BAD_INPUT");
  var title = clean_(it.title, 120), text = String(it.text || "").replace(/\r\n/g, "\n").slice(0, 2000).trim();
  var until = /^\d{4}-\d{2}-\d{2}$/.test(String(it.until || "")) ? String(it.until) : "", pinned = it.pinned === true, audience = it.audience === "teachers" ? "teachers" : "";
  if (!title) throw new Error("BAD_INPUT");
  var id, built;
  var lock = lock_();
  try {
    var sh = newsSheet_(); headers_(sh, N_HEAD, N_TEXT);
    var t = table_(sh, N_HEAD), now = Date.now();
    if (it.id) {
      var old = newsRows_(t).filter(function (n) { return n.id === String(it.id) && n.status === "published"; })[0];
      if (!old) throw new Error("NOT_FOUND");
      update_(t, old._r, { title: title, text: text, until: until, status: "published", pinned: pinned, audience: audience });
      id = old.id;
    } else {
      id = newId_();
      insert_(t, { id: id, date: now, title: title, text: text, until: until, author: who.name, status: "published", pinned: pinned, audience: audience });
    }
    built = newsBuilt_();
  } finally { lock.releaseLock(); }
  return { id: id, built: built };   // النسخة السريعة في Drive تُحفظ بعد إرسال الإشعار
}
function newsDelete_(id) {
  var built;
  var lock = lock_();
  try {
    var t = table_(newsSheet_(), N_HEAD), n = newsRows_(t).filter(function (x) { return x.id === String(id) && x.status === "published"; })[0];
    if (!n) throw new Error("NOT_FOUND");
    setCell_(t, n._r, "status", "deleted");
    built = newsBuilt_();
  } finally { lock.releaseLock(); }
  snapshot_(built);
}

// تحديث الموقع بعد تعديل الجدول يدويًا (زر عند المدير)
function refresh_() {
  var built;
  var lock = lock_();
  try { built = rebuild_({ freshNews: true }); TF_ = null; teachersSet_(teachers_()); CacheService.getScriptCache().remove("storage"); } finally { lock.releaseLock(); }
  snapshot_(built);
  return { lessons: built.list.length, news: built.news.length };
}

// ---------------- القراءة العامة (سريعة، من الذاكرة المؤقتة) ----------------
// كل زيارة تلميذ تُقرأ من الذاكرة المؤقتة ولا تلمس الجدول، مهما كثرت الدروس.
// القائمة تحمل مقتطفًا من الشرح فقط، والشرح الكامل يُطلب عند فتح الدرس.

function publicList_() {
  var hit = cacheGet_("list"), nhit = hit && cacheGet_("news");
  if (hit && nhit) { refreshIfOld_(); return { list: JSON.parse(hit), news: JSON.parse(nhit) }; }
  var b = miss_(); return { list: b.list, news: b.news };
}

function publicLesson_(id) {
  if (!id) return null;
  var listS = cacheGet_("list"), textS = listS && cacheGet_("texts"), b;
  if (listS && textS) b = { list: JSON.parse(listS), texts: JSON.parse(textS) };
  else b = miss_();
  var l = b.list.filter(function (x) { return x.id === id; })[0];
  if (!l) return null;
  l = JSON.parse(JSON.stringify(l));
  if (l.more) { l.text = b.texts[id] || l.text; delete l.more; }
  return l;
}

// الذاكرة فارغة (مثلًا صباحًا بعد ليلة هادئة): زائر واحد فقط يعيد البناء،
// والباقون يقرؤون النسخة السريعة المحفوظة في Drive بدل أن يقرأ الجميع الجدول معًا
function miss_() {
  var lock = LockService.getScriptLock();
  if (lock.tryLock(0)) {
    var b;
    try { b = rebuild_({ freshNews: true }); } finally { lock.releaseLock(); }
    snapshot_(b);
    return b;
  }
  return snapshotRead_() || rebuild_({ freshNews: true, noCache: true });
}

function rebuild_(o) {
  o = o || {};
  var list = [], texts = {}, own = {};
  (o.lessons || lessons_()).forEach(function (l) {
    if (l.status !== "published") return;
    var v = view_(l, false);
    own[v.id] = [l.teacherId, l.views];   // لفضاء الأساتذة فقط (لا يُرسل للتلاميذ)
    if (v.text.length > EXCERPT) { texts[v.id] = v.text; v.text = v.text.slice(0, EXCERPT); v.more = 1; }
    list.push(v);
  });
  list.sort(function (a, b) { return b.ts - a.ts; });
  var all = null;
  if (!o.freshNews) { var ns = cacheGet_("newsall"); if (ns) try { all = JSON.parse(ns); } catch (e) { all = null; } }
  if (!all) all = newsAll_(true);
  var news = activeNews_("", all);
  if (!o.noCache) {
    try {
      cachePut_("newsall", JSON.stringify(all));
      cachePut_("news", JSON.stringify(news));
      var tv = cachePut_("texts", JSON.stringify(texts));
      var lv = cachePut_("list", JSON.stringify(list));
      cachePut_("own", JSON.stringify({ l: lv, t: tv, m: own }));
      CacheService.getScriptCache().put("built", String(Date.now()), CACHE_TTL);
    } catch (e) {}
  }
  return { list: list, texts: texts, news: news, own: own };
}

// تجديد الذاكرة قبل انتهاء صلاحيتها (6 ساعات)، مرة واحدة فقط وبدون انتظار الآخرين
function refreshIfOld_() {
  var c = CacheService.getScriptCache(), built = Number(c.get("built") || 0);
  if (built && Date.now() - built < 5 * 3600e3) return;
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(0)) return;
  var b;
  try { b = rebuild_({ freshNews: true }); } catch (e) {} finally { lock.releaseLock(); }
  if (b) snapshot_(b);
}

// النسخة السريعة في Drive (بيانات عامة أصلًا: نفس ما يراه التلاميذ)
function snapshot_(b) {
  if (!b) return;
  try {
    var p = PropertiesService.getScriptProperties(), id = p.getProperty("SNAP"), s = JSON.stringify({ at: Date.now(), list: b.list, texts: b.texts, news: b.news }), f = null;
    if (id) { try { f = DriveApp.getFileById(id); if (f.isTrashed && f.isTrashed()) f = null; } catch (e) { f = null; } }
    if (f) f.setContent(s);
    else { f = folder_().createFile(Utilities.newBlob(s, "application/json", "_site-snapshot.json")); p.setProperty("SNAP", f.getId()); }
  } catch (e) {}
}
function snapshotRead_() {
  try {
    var id = PropertiesService.getScriptProperties().getProperty("SNAP");
    if (!id) return null;
    var o = JSON.parse(DriveApp.getFileById(id).getBlob().getDataAsString());
    return o && Array.isArray(o.list) ? { list: o.list, texts: o.texts || {}, news: o.news || [] } : null;
  } catch (e) { return null; }
}

// تخزين نص طويل في عدة قطع (حد Google: 100KB لكل مفتاح)
// يعيد رقم النسخة (ver)، ليُعرف أن قيمتين كُتبتا في عملية البناء نفسها
function cachePut_(key, s) {
  var c = CacheService.getScriptCache(), ver = newId_(), map = {}, n = 0;
  for (var i = 0; i < s.length; i += CHUNK) map[key + ":" + ver + ":" + (n++)] = s.slice(i, i + CHUNK);
  if (n === 0) map[key + ":" + ver + ":" + (n++)] = "";
  c.putAll(map, CACHE_TTL);
  var prev = c.get(key + ":ptr");
  c.put(key + ":ptr", ver + ":" + n, CACHE_TTL);
  if (prev) {
    var pv = prev.split(":"), old = [];
    for (var j = 0; j < Number(pv[1]); j++) old.push(key + ":" + pv[0] + ":" + j);
    try { c.removeAll(old); } catch (e) {}
  }
  return ver;
}
function cacheGet_(key) { var g = cacheGetMany_([key]); return g ? g[key].s : null; }
// عدة قيم في طلبين فقط للذاكرة: { key: { s: النص، v: رقم النسخة } }، أو null إن نقصت واحدة
function cacheGetMany_(names) {
  var c = CacheService.getScriptCache(), ptrs = c.getAll(names.map(function (k) { return k + ":ptr"; })), keys = [], parts = {};
  for (var i = 0; i < names.length; i++) {
    var ptr = ptrs[names[i] + ":ptr"];
    if (!ptr) return null;
    var pv = ptr.split(":"); parts[names[i]] = { v: pv[0], k: [] };
    for (var j = 0; j < Number(pv[1]); j++) { var key = names[i] + ":" + pv[0] + ":" + j; parts[names[i]].k.push(key); keys.push(key); }
  }
  var got = c.getAll(keys), out = {};
  for (var n in parts) {
    var s = "";
    for (var m = 0; m < parts[n].k.length; m++) { var x = got[parts[n].k[m]]; if (x == null) return null; s += x; }
    out[n] = { s: s, v: parts[n].v };
  }
  return out;
}

// ---------------- الإشعارات على الهواتف (بدون شركة خارجية) ----------------
// الهاتف يشترك من الموقع، ونحفظ «عنوان الإشعار» الذي يعطيه له المتصفح (رابط عند Google أو Apple أو Mozilla)
// في ورقة «الإشعارات». لا نحفظ أي اسم ولا رقم هاتف. عند الإرسال نرسل لكل عنوان إشارة موقّعة تحمل نص الإشعار
// مشفّرًا لذلك الهاتف وحده (الإصدار 7)، فيظهر فورًا. الهاتف الذي لا نملك مفتاحيه (اشترك قبل الإصدار 7) تصله إشارة
// فارغة، فيستيقظ ويسأل الخادم عن نص الإشعار (pushmsg) ثم يعرضه.

// مفاتيح VAPID: تُنشأ مرة واحدة. المفتاح الخاص في خصائص المشروع فقط، والعام يُرسل للهواتف
function vapid_(create) {
  var c = CacheService.getScriptCache(), cached = c.get("vapid:pub");
  if (cached && cached !== "-" && !create) return { pub: cached };
  if (cached === "-" && !create) return null;
  var p = PropertiesService.getScriptProperties(), d = p.getProperty("VAPID_D"), pub = p.getProperty("VAPID_PUB");
  if ((!d || !pub) && create) {
    var lock = lock_();
    try {
      d = p.getProperty("VAPID_D"); pub = p.getProperty("VAPID_PUB");
      if (!d || !pub) { var k = ecKeygen_(); d = k.d; pub = k.pub; p.setProperty("VAPID_D", d); p.setProperty("VAPID_PUB", pub); }
    } finally { lock.releaseLock(); }
  }
  c.put("vapid:pub", pub || "-", pub ? CACHE_TTL : 600);
  return pub ? { pub: pub, d: d } : null;
}

// شغّلها مرة واحدة من المحرر بعد التحديث إلى الإصدار 6، واسمح بالإذن الجديد «الاتصال بخدمة خارجية»
function enablePush() {
  vapid_(true);
  headers_(subsSheet_(), S_HEAD, S_TEXT);
  UrlFetchApp.fetch("https://fcm.googleapis.com/", { muteHttpExceptions: true });
  Logger.log("✅ الإشعارات جاهزة. من الموقع: فعّل الإشعارات في هاتفك، ثم انشر إعلانًا واختر «أرسل إشعارًا».");
}

function subsSheet_() {
  var ss = ss_(), sh = ss.getSheetByName(S_SHEET);
  if (!sh) { sh = ss.insertSheet(S_SHEET); headers_(sh, S_HEAD, S_TEXT); }
  return sh;
}
function subOf_(r) {
  return { id: String(r.id), endpoint: String(r.endpoint || ""), kind: String(r.kind) === "teacher" ? "teacher" : "pupil",
           teacherId: String(r.teacherId || ""), fails: Number(r.fails) || 0, keys: String(r.keys || ""), _r: r };
}
function subs_(t) { return (t || table_(subsSheet_(), S_HEAD)).rows.map(subOf_).filter(function (s) { return s.endpoint; }); }
function pushHost_(url) { var m = /^https:\/\/([^\/:?#@]+)(\/|$)/i.exec(String(url || "")); return m ? m[1].toLowerCase() : ""; }
function subGone_(t, s) { update_(t, s._r, { id: "", endpoint: "", kind: "", teacherId: "", created: "", fails: "", keys: "" }); }
// مفتاحا التشفير كما يعطيهما المتصفح (p256dh: نقطة على المنحنى 65 بايت، auth: 16 بايت)، أو "" إن لم يكونا صالحين
function subKeys_(k) {
  if (!k || typeof k !== "object") return "";
  var p = String(k.p256dh || "").replace(/=+$/, ""), a = String(k.auth || "").replace(/=+$/, "");
  if (!/^[A-Za-z0-9_-]{80,100}$/.test(p) || !/^[A-Za-z0-9_-]{20,24}$/.test(a)) return "";
  try { if (!ecPoint_(unb64u_(p)) || unb64u_(a).length !== 16) return ""; } catch (e) { return ""; }
  return p + "." + a;
}

// قائمة أرقام اشتراكات الأساتذة (صغيرة)، في الذاكرة المؤقتة وخصائص المشروع: لا نقرأ الجدول عند كل إشعار
function tsubs_() {
  var c = CacheService.getScriptCache(), v = c.get("tsubs");
  if (v === null) { v = PropertiesService.getScriptProperties().getProperty("TSUBS") || "[]"; c.put("tsubs", v, CACHE_TTL); }
  try { return JSON.parse(v); } catch (e) { return []; }
}
function tsubsSave_(all) {
  var v = JSON.stringify(all.filter(function (s) { return s.kind === "teacher"; }).map(function (s) { return s.id; }));
  var n = JSON.stringify({ all: all.length, teachers: all.filter(function (s) { return s.kind === "teacher"; }).length, enc: all.filter(function (s) { return s.keys; }).length });
  PropertiesService.getScriptProperties().setProperties({ TSUBS: v, PUSHN: n });
  CacheService.getScriptCache().putAll({ tsubs: v, pushn: n }, CACHE_TTL);
}

// اشتراك هاتف (بدون رمز = تلميذ أو ولي؛ مع رمز أستاذ = أستاذ). الهاتف نفسه لا يُسجَّل مرتين
function pushSub_(req) {
  var endpoint = String(req.endpoint || "").trim();
  if (endpoint.length > 1000 || !PUSH_HOSTS.test(pushHost_(endpoint))) throw new Error("BAD_INPUT");
  var who = req.code ? auth_(req.code) : null, keys = subKeys_(req.keys), out;
  var lock = lock_();
  try {
    var sh = subsSheet_(); headers_(sh, S_HEAD, S_TEXT);   // عمود keys الجديد (الإصدار 7) في ورقة قديمة
    var t = table_(sh, S_HEAD), all = subs_(t);
    var old = all.filter(function (s) { return s.endpoint === endpoint; })[0];
    if (!old && /^[A-Za-z0-9_-]{16,40}$/.test(String(req.id || ""))) old = all.filter(function (s) { return s.id === String(req.id); })[0];   // عنوان جديد للهاتف نفسه
    var kind = who ? "teacher" : (old ? old.kind : "pupil"), tid = who ? who.id : (old ? old.teacherId : "");
    if (old) {
      var ch = { endpoint: endpoint, kind: kind, teacherId: tid, fails: 0 };
      if (keys || old.endpoint !== endpoint) ch.keys = keys;   // عنوان جديد بدون مفتاحين: المفتاحان القديمان لم يعودا صالحين
      update_(t, old._r, ch);
      old.endpoint = endpoint; old.kind = kind; if ("keys" in ch) old.keys = keys; out = { id: old.id, kind: kind, keys: !!old.keys };
    } else {
      if (all.length >= MAX_SUBS) throw new Error("FULL");
      var id = "s" + b64u_(rand32_()).slice(0, 23);   // يبدأ بحرف: لا يقرؤه الجدول كصيغة أو رقم
      insert_(t, { id: id, endpoint: endpoint, kind: kind, teacherId: tid, created: Date.now(), fails: 0, keys: keys });
      all.push({ id: id, kind: kind, keys: keys }); out = { id: id, kind: kind, keys: !!keys };
    }
    tsubsSave_(all);
  } finally { lock.releaseLock(); }
  return out;
}
function pushUnsub_(req) {
  var id = String(req.id || "");
  if (!/^[A-Za-z0-9_-]{16,40}$/.test(id)) return;
  var lock = lock_();
  try {
    var t = table_(subsSheet_(), S_HEAD), all = subs_(t), s = all.filter(function (x) { return x.id === id; })[0];
    if (!s) return;
    subGone_(t, s);
    tsubsSave_(all.filter(function (x) { return x.id !== id; }));
  } finally { lock.releaseLock(); }
}
// أستاذ أُوقف: هاتفه لا يستقبل رسائل الأساتذة بعد الآن
function pushDropTeacher_(teacherId) {
  var t = table_(subsSheet_(), S_HEAD), all = subs_(t), mine = all.filter(function (s) { return s.teacherId === teacherId; });
  mine.forEach(function (s) { subGone_(t, s); });
  if (mine.length) tsubsSave_(all.filter(function (s) { return s.teacherId !== teacherId; }));
}

// آخر رسالة لكل جمهور (الكل / الأساتذة)، وما يطلبه الهاتف عند وصول الإشارة
function pushLast_(aud) {
  var c = CacheService.getScriptCache(), k = "push:" + aud, v = c.get(k);
  if (v === null) { v = PropertiesService.getScriptProperties().getProperty("PUSH_" + aud) || ""; c.put(k, v, CACHE_TTL); }
  try { return v ? JSON.parse(v) : null; } catch (e) { return null; }
}
function pushMsg_(s) {
  var best = pushLast_("all"), test = s ? CacheService.getScriptCache().get("push:test:" + s) : null;
  function newer(m) { if (m && (!best || m.at > best.at)) best = m; }
  if (s && tsubs_().indexOf(s) >= 0) newer(pushLast_("teachers"));
  if (test) { try { newer(JSON.parse(test)); } catch (e) {} }
  return best;
}

// الإرسال: لكل هاتف مشترك من الجمهور المختار إشارة موقّعة، تحمل النص مشفّرًا إن كان عندنا مفتاحا الهاتف
function pushSend_(audience, title, text, onlyId) {
  audience = audience === "teachers" ? "teachers" : "all";
  var key = vapid_(true);
  var m = { id: newId_(), title: clean_(title, 120), text: clean_(text, 300), url: audience === "teachers" ? "teacher.html" : "./", at: Date.now() };
  var t = table_(subsSheet_(), S_HEAD), list = subs_(t).filter(function (s) {
    return onlyId ? s.id === onlyId : (audience === "all" || s.kind === "teacher");
  });
  if (onlyId) { if (!list.length) throw new Error("NOT_FOUND"); CacheService.getScriptCache().put("push:test:" + onlyId, JSON.stringify(m), 600); }
  else {
    var v = JSON.stringify(m);
    PropertiesService.getScriptProperties().setProperty("PUSH_" + audience, v); CacheService.getScriptCache().put("push:" + audience, v, CACHE_TTL);
  }
  // مفتاح مؤقت واحد لهذا الإرسال (لكل هاتف ملحه العشوائي ومفتاحه المشتق الخاص)؛ التشفير يتوقف بعد PUSH_ENC_MS
  var plain = utf8_(JSON.stringify(m)), t0 = Date.now(), eph = null, jwts = {}, enc = [];
  var reqs = list.map(function (s, i) {
    var aud = "https://" + pushHost_(s.endpoint);
    if (!jwts[aud]) jwts[aud] = jwt_(aud, key);
    var q = { url: s.endpoint, method: "post", headers: { Authorization: "vapid t=" + jwts[aud] + ", k=" + key.pub, TTL: String(PUSH_TTL), Urgency: "high" },
              muteHttpExceptions: true, followRedirects: false };
    enc[i] = false;
    if (s.keys && Date.now() - t0 < PUSH_ENC_MS) {
      try {
        if (!eph) eph = pushEphemeral_();
        var k = s.keys.split("."), body = pushEncrypt_(plain, k[0], k[1], eph);
        if (body) { q.headers["Content-Encoding"] = "aes128gcm"; q.contentType = "application/octet-stream"; q.payload = Utilities.newBlob(s8_(body), "application/octet-stream"); enc[i] = true; }
      } catch (e) {}
    }
    return q;
  });
  var codes = pushFetch_(reqs);
  // رفضَ مزوّدُ الإشعارات النص المشفّر (أو تعذّر إرساله): نعيد إشارة فارغة لذلك الهاتف، فيسأل الخادم عن النص
  var again = [];
  list.forEach(function (s, i) { if (enc[i] && (codes[i] === 0 || codes[i] === 400 || codes[i] === 413 || codes[i] === 415)) again.push(i); });
  if (again.length) {
    var rc = pushFetch_(again.map(function (i) { var q = reqs[i], h = {}; for (var x in q.headers) if (x !== "Content-Encoding") h[x] = q.headers[x];
      return { url: q.url, method: "post", headers: h, muteHttpExceptions: true, followRedirects: false }; }));
    again.forEach(function (i, j) { codes[i] = rc[j]; enc[i] = false; });
  }
  var sent = 0, removed = 0, failed = 0, instant = 0, changed = [];
  list.forEach(function (s, i) {
    var code = codes[i];
    if (code >= 200 && code < 300) { sent++; if (enc[i]) instant++; if (s.fails) changed.push([s, { fails: 0 }]); }
    else if (code === 404 || code === 410) { removed++; changed.push([s, null]); }
    else { failed++; changed.push(s.fails + 1 >= 5 ? [s, null] : [s, { fails: s.fails + 1 }]); }
  });
  if (changed.length) {
    var lock = lock_();
    try {
      var t2 = table_(subsSheet_(), S_HEAD), now = subs_(t2), byId = {};
      now.forEach(function (s) { byId[s.id] = s; });
      changed.forEach(function (c) { var s = byId[c[0].id]; if (!s || s.endpoint !== c[0].endpoint) return; if (c[1]) update_(t2, s._r, c[1]); else { subGone_(t2, s); delete byId[s.id]; } });
      tsubsSave_(Object.keys(byId).map(function (k) { return byId[k]; }));
    } finally { lock.releaseLock(); }
  }
  return { total: list.length, sent: sent, removed: removed, failed: failed, instant: instant };
}
// إرسال الطلبات 100 في كل دفعة؛ يعيد رمز الرد لكل طلب (0 = تعذّر الإرسال)
function pushFetch_(reqs) {
  var codes = [];
  for (var i = 0; i < reqs.length; i += 100) {
    var part = reqs.slice(i, i + 100), res;
    try { res = UrlFetchApp.fetchAll(part).map(function (r) { return r.getResponseCode(); }); }
    catch (e) {
      if (/permission|authori|إذن|صلاحي/i.test(String(e && e.message))) throw new Error("PUSH_AUTH");
      res = part.map(function (q) { try { return UrlFetchApp.fetch(q.url, q).getResponseCode(); } catch (x) { return 0; } });
    }
    codes = codes.concat(res);
  }
  return codes;
}
// رمز VAPID لكل مزوّد يُعاد استعماله حتى 6 ساعات (صالح 12 ساعة): التوقيع يأخذ وقتًا
function jwt_(aud, key) {
  var c = CacheService.getScriptCache(), k = "jwt:" + String(key.pub).slice(-16) + ":" + aud, v = c.get(k);
  if (v) return v;
  v = vapidJwt_(aud, key);
  try { c.put(k, v, CACHE_TTL - 120); } catch (e) {}
  return v;
}
// عدد الهواتف المشتركة (يُحفظ عند كل اشتراك أو إرسال، فلا نقرأ الجدول)
function pushCounts_() {
  var c = CacheService.getScriptCache(), v = c.get("pushn"), n = null;
  if (v === null) v = PropertiesService.getScriptProperties().getProperty("PUSHN");
  try { n = v ? JSON.parse(v) : null; } catch (e) { n = null; }
  if (!n) {   // أول مرة (قبل أي اشتراك في الإصدار 7): نعدّ من الجدول مرة واحدة ونحفظ العدد
    var lock = LockService.getScriptLock(), mine = lock.tryLock(0), all = [];
    try {
      try { all = subs_(); } catch (e) {}
      n = { all: all.length, teachers: all.filter(function (s) { return s.kind === "teacher"; }).length, enc: all.filter(function (s) { return s.keys; }).length };
      if (mine) { v = JSON.stringify(n); PropertiesService.getScriptProperties().setProperty("PUSHN", v); c.put("pushn", v, CACHE_TTL); }
    } finally { if (mine) lock.releaseLock(); }
  }
  return { all: n.all, teachers: n.teachers, enc: n.enc || 0, ready: !!vapid_(false) };
}

// ---------------- الإشعارات: التوقيع (ES256 على المنحنى P-256) ----------------
// مزوّدو الإشعارات (Google وApple وMozilla) يطلبون توقيعًا من الخادم مع كل إشعار (معيار VAPID).
// Google Apps Script لا يوفّر هذا التوقيع، فهو مكتوب هنا بالحساب على أعداد كبيرة (BigInt).
// الأرقام تُنشأ بـ BigInt("…") وليس 0n، حتى لا يتعطل باقي الخادم في محرك قديم لا يعرف BigInt.

var EC_ = null;
function ec_() {
  if (EC_) return EC_;
  var B = BigInt;
  EC_ = {
    p: B("0xffffffff00000001000000000000000000000000ffffffffffffffffffffffff"),
    n: B("0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551"),
    G: [B("0x6b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c296"), B("0x4fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5"), B(1)],
    b: B("0x5ac635d8aa3a93e7b3ebbd55769886bc651d06b0cc53b0f63bce3c3e27d2604b"),
    Z: B(0), O: B(1), T: B(2), H: B(3), F: B(4), E: B(8)
  };
  return EC_;
}
function ecMod_(a, m) { var r = a % m; return r < ec_().Z ? r + m : r; }
function ecInv_(a, m) {
  var E = ec_(), lm = E.O, hm = E.Z, low = ecMod_(a, m), high = m;
  while (low > E.O) { var q = high / low, nm = hm - lm * q, nw = high - low * q; hm = lm; lm = nm; high = low; low = nw; }
  return ecMod_(lm, m);
}
// نقاط بإحداثيات «جاكوبي» [X, Y, Z]؛ Z = 0 هي «النقطة في اللانهاية»
function ecDbl_(P) {
  var E = ec_(), p = E.p, X = P[0], Y = P[1], Z = P[2];
  if (Y === E.Z || Z === E.Z) return [E.O, E.O, E.Z];
  var d = Z * Z % p, g = Y * Y % p, be = X * g % p;
  var al = E.H * ecMod_(X - d, p) % p * ((X + d) % p) % p;
  var X3 = ecMod_(al * al - E.E * be, p);
  var Z3 = ecMod_((Y + Z) * (Y + Z) - g - d, p);
  var Y3 = ecMod_(al * ecMod_(E.F * be - X3, p) - E.E * (g * g % p), p);
  return [X3, Y3, Z3];
}
function ecAdd_(P, Q) {
  var E = ec_(), p = E.p;
  if (P[2] === E.Z) return Q;
  if (Q[2] === E.Z) return P;
  var z1 = P[2] * P[2] % p, z2 = Q[2] * Q[2] % p;
  var U1 = P[0] * z2 % p, U2 = Q[0] * z1 % p, S1 = P[1] * z2 % p * Q[2] % p, S2 = Q[1] * z1 % p * P[2] % p;
  if (U1 === U2) return S1 === S2 ? ecDbl_(P) : [E.O, E.O, E.Z];
  var Hh = ecMod_(U2 - U1, p), R = ecMod_(S2 - S1, p), H2 = Hh * Hh % p, H3 = H2 * Hh % p, U1H2 = U1 * H2 % p;
  var X3 = ecMod_(R * R - H3 - E.T * U1H2, p);
  var Y3 = ecMod_(R * ecMod_(U1H2 - X3, p) - S1 * H3, p);
  return [X3, Y3, Hh * P[2] % p * Q[2] % p];
}
function ecMul_(k, P) {
  var E = ec_(), R = [E.O, E.O, E.Z], bits = k.toString(2);
  for (var i = 0; i < bits.length; i++) { R = ecDbl_(R); if (bits.charAt(i) === "1") R = ecAdd_(R, P); }
  return R;
}
function ecAffine_(P) { var E = ec_(), zi = ecInv_(P[2], E.p), zi2 = zi * zi % E.p; return [P[0] * zi2 % E.p, P[1] * zi2 % E.p * zi % E.p]; }

// بايتات: Google يعطي بايتات بإشارة (‎-128..127)، والحساب هنا بـ 0..255
function u8_(a) { var o = []; for (var i = 0; i < a.length; i++) o.push(a[i] & 255); return o; }
function s8_(a) { var o = []; for (var i = 0; i < a.length; i++) o.push(a[i] > 127 ? a[i] - 256 : a[i]); return o; }
function hexOf_(u) { var s = ""; for (var i = 0; i < u.length; i++) s += (u[i] < 16 ? "0" : "") + u[i].toString(16); return s; }
function bigOf_(u) { return BigInt("0x" + (hexOf_(u) || "0")); }
function bytesOf_(x, len) { var h = x.toString(16), o = []; while (h.length < len * 2) h = "0" + h; for (var i = 0; i < len * 2; i += 2) o.push(parseInt(h.substr(i, 2), 16)); return o; }
function b64u_(u) { return Utilities.base64EncodeWebSafe(s8_(u)).replace(/=+$/, ""); }
function unb64u_(s) { s = String(s || ""); while (s.length % 4) s += "="; return u8_(Utilities.base64DecodeWebSafe(s)); }
function ascii_(s) { var o = []; for (var i = 0; i < s.length; i++) o.push(s.charCodeAt(i) & 255); return o; }
function sha256_(u) { return u8_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s8_(u))); }
function hmac256_(u, key) { return u8_(Utilities.computeHmacSha256Signature(s8_(u), s8_(key))); }
function rand32_() { return sha256_(ascii_(Utilities.getUuid() + Utilities.getUuid() + Utilities.getUuid() + Date.now())); }

// مفتاحان: خاص (يبقى في خصائص المشروع ولا يغادر الخادم) وعام (يرسله الموقع للهاتف عند الاشتراك)
function ecKeygen_() {
  var E = ec_(), d;
  do { d = bigOf_(rand32_()) % E.n; } while (d === E.Z);
  var Q = ecAffine_(ecMul_(d, E.G));
  return { d: b64u_(bytesOf_(d, 32)), pub: b64u_([4].concat(bytesOf_(Q[0], 32), bytesOf_(Q[1], 32))) };
}
// توقيع ECDSA (r||s، 64 بايت) لرسالة بايتات؛ رقم k عشوائي جديد لكل توقيع
function ecSign_(msg, dB64) {
  var E = ec_(), dU = unb64u_(dB64), d = bigOf_(dU), h = sha256_(msg), e = bigOf_(h);
  for (var i = 0; i < 16; i++) {
    var k = bigOf_(hmac256_(h.concat(rand32_()), dU)) % E.n;
    if (k === E.Z) continue;
    var r = ecAffine_(ecMul_(k, E.G))[0] % E.n;
    if (r === E.Z) continue;
    var s = ecInv_(k, E.n) * ((e + r * d) % E.n) % E.n;
    if (s === E.Z) continue;
    return bytesOf_(r, 32).concat(bytesOf_(s, 32));
  }
  throw new Error("SIGN");
}
// رمز VAPID (JWT موقّع) لمزوّد إشعارات واحد، صالح 12 ساعة
function vapidJwt_(aud, key) {
  var input = b64u_(ascii_('{"typ":"JWT","alg":"ES256"}')) + "." + b64u_(ascii_(JSON.stringify({ aud: aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: PUSH_CONTACT })));
  return input + "." + b64u_(ecSign_(ascii_(input), key.d));
}

// ---------------- الإشعارات: تشفير نص الرسالة (معيار RFC 8291، aes128gcm) ----------------
// النص يُرسل مشفّرًا داخل الإشعار نفسه، فيظهر على الهاتف فورًا دون أن يسأل الخادم.
// لا يستطيع قراءته إلا الهاتف المشترك (مفتاحاه p256dh وauth يعطيهما المتصفح عند الاشتراك).
// Google Apps Script لا يوفّر AES، فهو مكتوب هنا (AES-128 وGCM)، وكل شيء آخر من Utilities.

var AES_SBOX_ = null;
function aesTables_() {
  if (AES_SBOX_) return AES_SBOX_;
  var s = [], p = 1, q = 1;
  // توليد صندوق الاستبدال (S-box) حسابيًا بدل جدول من 256 رقمًا
  do {
    p = p ^ ((p << 1) & 255) ^ (p & 128 ? 0x1b : 0);
    q ^= q << 1; q ^= q << 2; q ^= q << 4; q &= 255; if (q & 128) q ^= 0x09;
    var x = q ^ ((q << 1) | (q >> 7)) ^ ((q << 2) | (q >> 6)) ^ ((q << 3) | (q >> 5)) ^ ((q << 4) | (q >> 4));
    s[p] = (x ^ 0x63) & 255;
  } while (p !== 1);
  s[0] = 0x63;
  AES_SBOX_ = s;
  return s;
}
function aesKey_(key) {   // 16 بايت ← 11 مفتاحًا فرعيًا (176 بايت)
  var S = aesTables_(), w = key.slice(0, 16), rcon = 1;
  for (var i = 16; i < 176; i += 4) {
    var t = w.slice(i - 4, i);
    if (i % 16 === 0) { t = [S[t[1]] ^ rcon, S[t[2]], S[t[3]], S[t[0]]]; rcon = (rcon << 1) ^ (rcon & 128 ? 0x11b : 0); }
    for (var j = 0; j < 4; j++) w.push(w[i - 16 + j] ^ t[j]);
  }
  return w;
}
function xt_(b) { return ((b << 1) ^ (b & 128 ? 0x1b : 0)) & 255; }
function aesBlock_(w, inp) {
  var S = aesTables_(), st = [], r, c, i;
  for (i = 0; i < 16; i++) st[i] = inp[i] ^ w[i];
  for (r = 1; r <= 10; r++) {
    var t = [];
    for (i = 0; i < 16; i++) t[i] = S[st[(i + 4 * (i % 4)) % 16]];   // SubBytes + ShiftRows (الأعمدة متتالية)
    if (r < 10) {
      for (c = 0; c < 4; c++) {
        var a0 = t[4 * c], a1 = t[4 * c + 1], a2 = t[4 * c + 2], a3 = t[4 * c + 3], all = a0 ^ a1 ^ a2 ^ a3;
        t[4 * c] = a0 ^ all ^ xt_(a0 ^ a1); t[4 * c + 1] = a1 ^ all ^ xt_(a1 ^ a2);
        t[4 * c + 2] = a2 ^ all ^ xt_(a2 ^ a3); t[4 * c + 3] = a3 ^ all ^ xt_(a3 ^ a0);
      }
    }
    for (i = 0; i < 16; i++) st[i] = t[i] ^ w[16 * r + i];
  }
  return st;
}
// الضرب في GF(2^128) لحساب بصمة GCM (GHASH)
function gmul_(x, y) {
  var B = BigInt, R = B("0xe1000000000000000000000000000000"), z = B(0), v = y, one = B(1);
  for (var i = 127; i >= 0; i--) {
    if ((x >> B(i)) & one) z ^= v;
    v = (v & one) ? (v >> one) ^ R : v >> one;
  }
  return z;
}
function gcmEncrypt_(key, iv, pt) {   // يعيد النص المشفّر + بصمة 16 بايت
  var w = aesKey_(key), H = bigOf_(aesBlock_(w, [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]));
  var j0 = iv.concat([0, 0, 0, 1]), ct = [], ctr = j0.slice();
  for (var i = 0; i < pt.length; i += 16) {
    for (var k = 15; k >= 12; k--) { ctr[k] = (ctr[k] + 1) & 255; if (ctr[k]) break; }
    var ks = aesBlock_(w, ctr);
    for (var j = 0; j < 16 && i + j < pt.length; j++) ct.push(pt[i + j] ^ ks[j]);
  }
  var y = BigInt(0);
  for (var b = 0; b < ct.length; b += 16) { var blk = ct.slice(b, b + 16); while (blk.length < 16) blk.push(0); y = gmul_(y ^ bigOf_(blk), H); }
  y = gmul_(y ^ BigInt(ct.length * 8), H);   // طول البيانات الإضافية 0، وطول النص بالبتات
  var s = bigOf_(aesBlock_(w, j0)) ^ y;
  return ct.concat(bytesOf_(s, 16));
}
function hkdf_(salt, ikm, info, len) { return hmac256_(info.concat([1]), hmac256_(ikm, salt)).slice(0, len); }
function utf8_(s) {
  var b; s = String(s);
  try { b = unescape(encodeURIComponent(s)); } catch (e) { b = unescape(encodeURIComponent(s.replace(/[\ud800-\udfff]/g, "\ufffd"))); }   // نصف رمز تعبيري قُطع عند الحد الأقصى للطول
  var o = []; for (var i = 0; i < b.length; i++) o.push(b.charCodeAt(i)); return o;
}
// مفتاح مؤقت لكل إرسال (يُستعمل لكل الهواتف في ذلك الإرسال)
function pushEphemeral_() {
  var E = ec_(), d;
  do { d = bigOf_(rand32_()) % E.n; } while (d === E.Z);
  var Q = ecAffine_(ecMul_(d, E.G));
  return { d: d, pub: [4].concat(bytesOf_(Q[0], 32), bytesOf_(Q[1], 32)) };
}
function ecPoint_(u) {   // 65 بايت ← نقطة على المنحنى، أو null إن لم تكن صالحة
  if (!u || u.length !== 65 || u[0] !== 4) return null;
  var E = ec_(), x = bigOf_(u.slice(1, 33)), y = bigOf_(u.slice(33)), p = E.p;
  if (x >= p || y >= p) return null;
  var lhs = y * y % p, rhs = ecMod_(x * x % p * x - E.H * x + E.b, p);
  return lhs === rhs ? [x, y, E.O] : null;
}
// تشفير رسالة لهاتف واحد: salt(16) || rs(4) || idlen(1) || مفتاحنا المؤقت(65) || النص المشفّر
function pushEncrypt_(plain, uaPubB64, authB64, eph) {
  var ua = unb64u_(uaPubB64), auth = unb64u_(authB64), P = ecPoint_(ua);
  if (!P || auth.length !== 16) return null;
  var shared = bytesOf_(ecAffine_(ecMul_(eph.d, P))[0], 32);
  var ikm = hkdf_(auth, shared, ascii_("WebPush: info").concat([0], ua, eph.pub), 32);
  var salt = rand32_().slice(0, 16);
  var cek = hkdf_(salt, ikm, ascii_("Content-Encoding: aes128gcm").concat([0]), 16);
  var nonce = hkdf_(salt, ikm, ascii_("Content-Encoding: nonce").concat([0]), 12);
  var body = gcmEncrypt_(cek, nonce, plain.concat([2]));
  return salt.concat([0, 0, 16, 0, 65], eph.pub, body);
}

// ---------------- أدوات ----------------

// فتح الجدول بطيء (ثوانٍ): مرة واحدة فقط في كل طلب
var SS_ = null;
function ss_() {
  if (SS_) return SS_;
  var id = PropertiesService.getScriptProperties().getProperty("SS");
  if (!id) throw new Error("NOT_SETUP");
  SS_ = SpreadsheetApp.openById(id);
  return SS_;
}
function sheet_(name) {
  var sh = ss_().getSheetByName(name);
  if (!sh) throw new Error("NOT_SETUP");
  return sh;
}
// نص طويل في عدة خصائص (حد Google: 9KB لكل خاصية)
function propsPut_(key, s) {
  var o = {}, n = 0;
  for (var i = 0; i < s.length; i += 2500) o[key + ":" + (n++)] = s.slice(i, i + 2500);
  o[key] = String(n);
  PropertiesService.getScriptProperties().setProperties(o);
}
function propsGet_(key) {
  var all = PropertiesService.getScriptProperties().getProperties(), n = Number(all[key] || 0), s = "";
  if (!n) return null;
  for (var i = 0; i < n; i++) { if (all[key + ":" + i] == null) return null; s += all[key + ":" + i]; }
  return s;
}
function folder_() {
  var id = PropertiesService.getScriptProperties().getProperty("FOLDER");
  if (!id) throw new Error("NOT_SETUP");
  return DriveApp.getFolderById(id);
}
function dayOrEmpty_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, TZ, "yyyy-MM-dd");
  v = String(v || ""); return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "";
}
function trash_(id) { var f = ownFile_(id); if (f) try { f.setTrashed(true); } catch (e) {} }
// انتظار دوري عند نشر عدة أساتذة معًا؛ إن طال الانتظار نعيد «BUSY» فيعيد الموقع المحاولة تلقائيًا
function lock_() { var l = LockService.getScriptLock(); try { l.waitLock(LOCK_WAIT); } catch (e) { throw new Error("BUSY"); } return l; }
function parse_(s) { try { var v = JSON.parse(s || "[]"); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
function day_(v) {
  var d = typeof v === "number" ? new Date(v) : (v instanceof Date ? v : new Date(Number(v) || 0));
  return Utilities.formatDate(d, TZ, "yyyy-MM-dd");
}
function clean_(s, n) { return String(s == null ? "" : s).replace(/[\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, n); }
function safe_(s) { s = String(s == null ? "" : s); return /^[=+\-@]/.test(s) ? "'" + s : s; }
function newId_() { return Date.now().toString(36) + Utilities.getUuid().replace(/-/g, "").slice(0, 6); }
// رمز من 8 أحرف (أكثر من 850 مليار احتمال)، من مولّد عشوائي آمن
function newCode_() {
  var a = "ABCDEFGHJKMNPQRSTUVWXYZ23456789", s = "", hex = "";
  while (s.length < 8) {
    if (hex.length < 2) { var u = Utilities.getUuid().replace(/-/g, ""); hex += u.slice(0, 12) + u.slice(13, 16) + u.slice(17); } // بدون خانات الإصدار الثابتة
    var b = parseInt(hex.slice(0, 2), 16); hex = hex.slice(2);
    if (b < 248) s += a.charAt(b % 31);
  }
  return s.slice(0, 4) + "-" + s.slice(4);
}
function uniqueCode_(all) {
  var used = all.map(function (t) { return t.code; }), code;
  do { code = newCode_(); } while (used.indexOf(code) >= 0);
  return code;
}
function errCode_(err) {
  var m = String((err && err.message) || err);
  return /^[A-Z_]+$/.test(m) ? m : "SERVER";
}
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

// ---- نهاية الكود ----
