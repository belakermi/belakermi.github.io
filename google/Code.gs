// خادم فضاء الأساتذة — متوسطة الشهيد بلعكرمي أعمر
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
var DAILY_UPLOAD_MB = 300;   // حد الرفع اليومي لكل أستاذ، لحماية مساحة Drive
var EXCERPT = 220;           // طول مقتطف الشرح في قائمة الدروس
var CACHE_TTL = 21600;       // 6 ساعات (الحد الأقصى في Google)
var CHUNK = 40000;           // حجم القطعة في الذاكرة المؤقتة (أقل من حد 100KB)
var LOCK_WAIT = 30000;       // أقصى انتظار عند نشر عدة أساتذة في اللحظة نفسها
var VERSION = 5;
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
var N_HEAD = ["id", "date", "title", "text", "until", "author", "status", "pinned"];
var L_SHEET = "الدروس", T_SHEET = "الأساتذة", N_SHEET = "الإعلانات";
var L_TEXT = ["title", "text", "unit"], T_TEXT = ["name", "code"], N_TEXT = ["title", "text", "until"];

// ---------------- الإعداد ----------------

function setup() {
  var p = PropertiesService.getScriptProperties();
  var ss = null, ssId = p.getProperty("SS");
  if (ssId) { try { ss = SpreadsheetApp.openById(ssId); } catch (e) { ss = null; } }
  if (!ss) { ss = SpreadsheetApp.create("دروس الموقع - " + SCHOOL); p.setProperty("SS", ss.getId()); }

  var lsh = ss.getSheetByName(L_SHEET) || ss.insertSheet(L_SHEET);
  var tsh = ss.getSheetByName(T_SHEET) || ss.insertSheet(T_SHEET);
  var nsh = ss.getSheetByName(N_SHEET) || ss.insertSheet(N_SHEET);
  headers_(lsh, L_HEAD, L_TEXT); headers_(tsh, T_HEAD, T_TEXT); headers_(nsh, N_HEAD, N_TEXT);
  ss.getSheets().forEach(function (s) {
    var n = s.getName();
    if (n !== L_SHEET && n !== T_SHEET && n !== N_SHEET && s.getLastRow() === 0 && ss.getSheets().length > 3) ss.deleteSheet(s);
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
  snapshot_(rebuild_());
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
  var p = (e && e.parameter) || {};
  try {
    if (p.api === "lessons" || p.api === "lesson") {
      // المشاهدات تصل مع طلبات القراءة العادية (بدون طلب إضافي للخادم): seen = دروس فتحها التلميذ، visit = أول زيارة له اليوم
      // vn: رقم يرسله الهاتف ويعود كما هو، فلا يظن الهاتف أن ردًا قديمًا محفوظًا أكّد وصول مشاهداته
      var vs = { seen: 0, visit: 0 }, vn = String(p.vn || "").replace(/[^a-z0-9]/g, "").slice(0, 12);
      if (p.seen || p.visit) { try { vs = views_(String(p.seen || ""), p.visit === "1"); } catch (e) {} }
      if (p.api === "lessons") { var pub = publicList_(); return json_({ ok: true, v: VERSION, lessons: pub.list, news: pub.news, seen: vs.seen, visit: vs.visit, vn: vn }); }
      var l = publicLesson_(String(p.id || ""));
      return json_(l ? { ok: true, v: VERSION, lesson: l, seen: vs.seen, visit: vs.visit, vn: vn } : { ok: false, v: VERSION, error: "NOT_FOUND", seen: vs.seen, visit: vs.visit, vn: vn });
    }
  } catch (err) { return json_({ ok: false, error: errCode_(err) }); }
  return HtmlService.createHtmlOutput('<p dir="rtl" style="font:16px sans-serif">خادم دروس ' + SCHOOL + ' يعمل ✓</p>');
}

function doPost(e) {
  try {
    var req = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    var who = auth_(req.code), out;
    switch (req.action) {
      case "login": out = { name: who.name, role: who.role, subjects: who.subjects, v: VERSION }; break;
      case "upload": out = { file: upload_(who, req.file) }; break;
      case "save": out = save_(who, req.lesson); break;   // { id } أو { id, dup: true } إذا وصلت المحاولة نفسها مرة ثانية
      case "mine": out = { lessons: mine_(who) }; break;
      case "delete": del_(who, req.id); out = {}; break;
      case "teachers": admin_(who); out = { teachers: teachers_().map(publicTeacher_), storage: storage_(), visits: visits_() }; break;
      case "addTeacher": admin_(who); out = { teacher: publicTeacher_(addTeacher_(req.name, req.subjects)) }; break;
      case "removeTeacher": admin_(who); removeTeacher_(req.id); out = {}; break;
      case "resetCode": admin_(who); out = { code: resetCode_(req.id) }; break;
      case "news": admin_(who); out = { news: newsAll_() }; break;
      case "newsSave": admin_(who); out = { id: newsSave_(who, req.item) }; break;
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

function auth_(code) {
  code = String(code || "").trim().toUpperCase();
  if (code.length < 6) throw new Error("AUTH");
  var t = teachers_().filter(function (x) { return x.code === code && x.active; })[0];
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

function addTeacher_(name, subjects) {
  name = clean_(name, 60);
  if (name.length < 2) throw new Error("BAD_INPUT");
  subjects = String(subjects || "").split(",").filter(function (s) { return SUBJECTS.indexOf(s) >= 0; }).join(",");
  var lock = lock_();
  try {
    var sh = sheet_(T_SHEET); headers_(sh, T_HEAD, T_TEXT);
    var tt = table_(sh, T_HEAD);
    var t = { id: newId_(), name: name, subjects: subjects, code: uniqueCode_(teachers_(tt)), role: "teacher", active: true };
    insert_(tt, t);
    return t;
  } finally { lock.releaseLock(); }
}

function removeTeacher_(id) {
  var lock = lock_();
  try {
    var tt = table_(T_SHEET, T_HEAD), t = teachers_(tt).filter(function (x) { return x.id === String(id); })[0];
    if (!t) throw new Error("NOT_FOUND");
    if (t.role === "admin") throw new Error("FORBIDDEN");
    setCell_(tt, t._r, "active", false);
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
function storage_() {
  try { return { used: DriveApp.getStorageUsed(), limit: DriveApp.getStorageLimit() }; } catch (e) { return null; }
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

function mine_(who) {
  var buf = viewBuffer_().lessons;   // المشاهدات التي لم تُنقل إلى الجدول بعد
  return lessons_().filter(function (l) { return l.status === "published" && (who.role === "admin" || l.teacherId === who.id); })
    .map(function (l) { var o = view_(l, true); o.views = l.views + (buf[l.id] || 0); return o; }).sort(function (a, b) { return b.ts - a.ts; });
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
          if (changed) sh.getRange(2, cv, last - 1, 1).setValues(vals);
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
  var id = PropertiesService.getScriptProperties().getProperty("SS");
  if (!id) throw new Error("NOT_SETUP");
  var ss = SpreadsheetApp.openById(id), sh = ss.getSheetByName(N_SHEET);
  if (!sh) { sh = ss.insertSheet(N_SHEET); headers_(sh, N_HEAD, N_TEXT); }
  return sh;
}
function newsOf_(r) {
  return { id: String(r.id), ts: Number(r.date) || 0, date: day_(r.date), title: String(r.title), text: String(r.text || ""),
           until: dayOrEmpty_(r.until), author: String(r.author || ""), status: String(r.status),
           pinned: r.pinned === true || String(r.pinned).toUpperCase() === "TRUE", _r: r };
}
function newsRows_(t) { return (t || table_(newsSheet_(), N_HEAD)).rows.map(newsOf_); }
function newsView_(n) { return { id: n.id, date: n.date, title: n.title, text: n.text, until: n.until, pinned: n.pinned }; }
function newsAll_() {
  return newsRows_().filter(function (n) { return n.status === "published"; })
    .sort(function (a, b) { return (b.pinned - a.pinned) || (b.ts - a.ts); }).map(newsView_);
}
function activeNews_() {
  var today = day_(Date.now());
  return newsAll_().filter(function (n) { return !n.until || n.until >= today; }).slice(0, 10);
}
function newsSave_(who, it) {
  if (!it) throw new Error("BAD_INPUT");
  var title = clean_(it.title, 120), text = String(it.text || "").replace(/\r\n/g, "\n").slice(0, 2000).trim();
  var until = /^\d{4}-\d{2}-\d{2}$/.test(String(it.until || "")) ? String(it.until) : "", pinned = it.pinned === true;
  if (!title) throw new Error("BAD_INPUT");
  var id, built;
  var lock = lock_();
  try {
    var sh = newsSheet_(); headers_(sh, N_HEAD, N_TEXT);
    var t = table_(sh, N_HEAD), now = Date.now();
    if (it.id) {
      var old = newsRows_(t).filter(function (n) { return n.id === String(it.id) && n.status === "published"; })[0];
      if (!old) throw new Error("NOT_FOUND");
      update_(t, old._r, { title: title, text: text, until: until, status: "published", pinned: pinned });
      id = old.id;
    } else {
      id = newId_();
      insert_(t, { id: id, date: now, title: title, text: text, until: until, author: who.name, status: "published", pinned: pinned });
    }
    built = rebuild_({ freshNews: true });
  } finally { lock.releaseLock(); }
  snapshot_(built);
  return id;
}
function newsDelete_(id) {
  var built;
  var lock = lock_();
  try {
    var t = table_(newsSheet_(), N_HEAD), n = newsRows_(t).filter(function (x) { return x.id === String(id) && x.status === "published"; })[0];
    if (!n) throw new Error("NOT_FOUND");
    setCell_(t, n._r, "status", "deleted");
    built = rebuild_({ freshNews: true });
  } finally { lock.releaseLock(); }
  snapshot_(built);
}

// تحديث الموقع بعد تعديل الجدول يدويًا (زر عند المدير)
function refresh_() {
  var built;
  var lock = lock_();
  try { built = rebuild_({ freshNews: true }); } finally { lock.releaseLock(); }
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
  var list = [], texts = {};
  (o.lessons || lessons_()).forEach(function (l) {
    if (l.status !== "published") return;
    var v = view_(l, false);
    if (v.text.length > EXCERPT) { texts[v.id] = v.text; v.text = v.text.slice(0, EXCERPT); v.more = 1; }
    list.push(v);
  });
  list.sort(function (a, b) { return b.ts - a.ts; });
  var news = null;
  if (!o.freshNews) { var ns = cacheGet_("news"); if (ns) try { news = JSON.parse(ns); } catch (e) { news = null; } }
  if (!news) news = activeNews_();
  if (!o.noCache) {
    try {
      cachePut_("news", JSON.stringify(news));
      cachePut_("texts", JSON.stringify(texts));
      cachePut_("list", JSON.stringify(list));
      CacheService.getScriptCache().put("built", String(Date.now()), CACHE_TTL);
    } catch (e) {}
  }
  return { list: list, texts: texts, news: news };
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
}
function cacheGet_(key) {
  var c = CacheService.getScriptCache(), ptr = c.get(key + ":ptr");
  if (!ptr) return null;
  var pv = ptr.split(":"), keys = [];
  for (var i = 0; i < Number(pv[1]); i++) keys.push(key + ":" + pv[0] + ":" + i);
  var got = c.getAll(keys), s = "";
  for (var k = 0; k < keys.length; k++) { if (got[keys[k]] == null) return null; s += got[keys[k]]; }
  return s;
}

// ---------------- أدوات ----------------

function sheet_(name) {
  var id = PropertiesService.getScriptProperties().getProperty("SS");
  if (!id) throw new Error("NOT_SETUP");
  var sh = SpreadsheetApp.openById(id).getSheetByName(name);
  if (!sh) throw new Error("NOT_SETUP");
  return sh;
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
