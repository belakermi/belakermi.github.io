/* صور ← ملف PDF، وضغط الصور، داخل متصفح الأستاذ (بدون أي مكتبة خارجية)
   - كل صورة تُصغَّر إلى 1800 بكسل كحد أقصى وتُحفظ JPEG بجودة 0.72
   - الصور تُجمع في ملف PDF واحد، صفحة لكل صورة، بمقاس A4 */
var IMGPDF = (function () {
  var MAX = 1800, Q = 0.72;

  function viaImg(file) {
    return new Promise(function (ok, bad) {
      var u = URL.createObjectURL(file), im = new Image();
      im.onload = function () { ok(im); }; im.onerror = function () { bad(new Error("IMAGE")); }; im.src = u;
    });
  }
  function load(file) {
    if (window.createImageBitmap) return createImageBitmap(file, { imageOrientation: "from-image" }).catch(function () { return viaImg(file); });
    return viaImg(file);
  }
  /* صورة ← JPEG مصغّر: {blob, bytes, w, h} */
  function toJpeg(file, max, q) {
    max = max || MAX; q = q || Q;
    return load(file).then(function (img) {
      var w = img.width, h = img.height, s = Math.min(1, max / Math.max(w, h));
      w = Math.max(1, Math.round(w * s)); h = Math.max(1, Math.round(h * s));
      var c = document.createElement("canvas"); c.width = w; c.height = h;
      var x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, w, h); x.drawImage(img, 0, 0, w, h);
      if (img.close) try { img.close(); } catch (e) {}
      return new Promise(function (ok) { c.toBlob(ok, "image/jpeg", q); }).then(function (blob) {
        return blob.arrayBuffer().then(function (ab) { return { blob: blob, bytes: new Uint8Array(ab), w: w, h: h }; });
      });
    });
  }
  /* ضغط صورة واحدة إن كانت كبيرة (أكثر من 1.2 م.ب)، وإلا تبقى كما هي */
  function shrink(file) {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size <= 1.2 * 1048576) return Promise.resolve(file);
    return toJpeg(file).then(function (r) {
      if (r.blob.size >= file.size) return file;
      return new File([r.blob], file.name.replace(/\.[a-z0-9]+$/i, "") + ".jpg", { type: "image/jpeg" });
    }, function () { return file; });
  }
  /* بناء ملف PDF من صفحات JPEG */
  function build(pages) {
    var enc = new TextEncoder(), parts = [], len = 0, offs = [];
    function add(x) { var b = typeof x === "string" ? enc.encode(x) : x; parts.push(b); len += b.length; }
    function obj(id, fn) { offs[id] = len; add(id + " 0 obj\n"); fn(); add("\nendobj\n"); }
    add("%PDF-1.4\n"); add(new Uint8Array([0x25, 0xE2, 0xE3, 0xCF, 0xD3, 0x0A]));
    var n = pages.length, kids = [];
    for (var i = 0; i < n; i++) kids.push((3 + i * 3) + " 0 R");
    obj(1, function () { add("<< /Type /Catalog /Pages 2 0 R >>"); });
    obj(2, function () { add("<< /Type /Pages /Kids [" + kids.join(" ") + "] /Count " + n + " >>"); });
    pages.forEach(function (p, i) {
      var pid = 3 + i * 3, cid = pid + 1, iid = pid + 2, land = p.w > p.h;
      var W = land ? 841.89 : 595.28, H = land ? 595.28 : 841.89, m = 14;
      var sc = Math.min((W - 2 * m) / p.w, (H - 2 * m) / p.h), dw = p.w * sc, dh = p.h * sc, x = (W - dw) / 2, y = (H - dh) / 2;
      var cs = "q " + dw.toFixed(2) + " 0 0 " + dh.toFixed(2) + " " + x.toFixed(2) + " " + y.toFixed(2) + " cm /Im0 Do Q";
      obj(pid, function () { add("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " + W + " " + H + "] /Resources << /XObject << /Im0 " + iid + " 0 R >> >> /Contents " + cid + " 0 R >>"); });
      obj(cid, function () { add("<< /Length " + cs.length + " >>\nstream\n" + cs + "\nendstream"); });
      obj(iid, function () {
        add("<< /Type /XObject /Subtype /Image /Width " + p.w + " /Height " + p.h + " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length " + p.bytes.length + " >>\nstream\n");
        add(p.bytes); add("\nendstream");
      });
    });
    var last = 2 + n * 3, xref = len;
    add("xref\n0 " + (last + 1) + "\n0000000000 65535 f \n");
    for (var k = 1; k <= last; k++) add(String(offs[k]).padStart(10, "0") + " 00000 n \n");
    add("trailer\n<< /Size " + (last + 1) + " /Root 1 0 R >>\nstartxref\n" + xref + "\n%%EOF\n");
    return new Blob(parts, { type: "application/pdf" });
  }
  /* صور ← File PDF، مع onStep(i, n) للتقدّم */
  function photosToPdf(files, name, onStep) {
    var pages = [], chain = Promise.resolve();
    files.forEach(function (f, i) {
      chain = chain.then(function () { if (onStep) onStep(i + 1, files.length); return toJpeg(f); }).then(function (p) { pages.push(p); });
    });
    return chain.then(function () {
      var blob = build(pages);
      return new File([blob], (name || "صفحات الدرس").replace(/[\\\/:*?"<>|]+/g, " ").trim().slice(0, 80) + ".pdf", { type: "application/pdf" });
    });
  }
  return { toJpeg: toJpeg, shrink: shrink, build: build, photosToPdf: photosToPdf };
})();
