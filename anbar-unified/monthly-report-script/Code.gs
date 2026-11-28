/**
 * نظام التقرير الشهري للمهندس المقيم - محافظة الأنبار
 *
 * رابط عام واحد (.../exec) يُرسل إلى جميع المقيمين: يفتحه المقيم من هاتفه، يملأ التقرير، يوقّع ويصوّر الختم، ثم يرسله.
 * تبويب «التقارير الشهرية الدورية» (لوحة المعلومات) للقسم الهندسي: .../exec?page=reports ويحميه رمز القسم.
 * برنامج الشؤون الهندسية يجلب السجل وملفات PDF بطلب POST (doPost) بالرمز نفسه.
 *
 * عند الإرسال (submitReport):
 *  1) يُحفظ PDF + JSON + صورتا التوقيع والختم في Drive (مجلد المشروع ثم الشهر).
 *  2) يُسجَّل المشروع في ملف سجل التقارير MonthlyReports-Data.json (اسم المشروع والشركة والقضاء ورابط الملف).
 *  3) يصل PDF إلى بريد القسم الهندسي من حساب مالك السكربت.
 *  4) صور الموقع (حتى 4، كل صورة 300 كيلوبايت كحد أقصى) تُحفظ ملفات مستقلة في مجلد الشهر، فتظهر في بطاقة المشروع
 *     في «الموقف العام» ببرنامج الشؤون الهندسية.
 */

const CONFIG = {
  // بريد القسم الهندسي الذي يستلم التقارير ويُمنح صلاحية الاطلاع على الملفات
  DEPT_EMAIL: 'ضع-بريد-القسم-هنا',

  // رمز الدخول إلى لوحة التقارير الشهرية الدورية. غيّره إلى رمز من اختيارك.
  DASH_CODE: 'ضع-رمز-لوحة-القسم-هنا',

  // معرّف مجلد Drive الرئيسي (اختياري). اتركه فارغاً ليُحفظ في جذر Drive.
  ROOT_FOLDER_ID: '',

  // أكبر حجم مقبول لملف PDF المرسل (بالميغابايت)
  MAX_PDF_MB: 20
};

const DATA_FILE = 'MonthlyReports-Data.json';

/* ---------- تقديم الصفحات ---------- */
function doGet(e) {
  const page = e && e.parameter && e.parameter.page;
  return HtmlService.createHtmlOutputFromFile(page === 'reports' ? 'dashboard' : 'index')
    .setTitle(page === 'reports' ? 'التقارير الشهرية الدورية' : 'التقرير الشهري')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/* ---------- واجهة برنامج الشؤون الهندسية (طلب POST برمز القسم) ----------
   يستدعيها تبويب «التقارير الشهرية لدوائر المقيم» في البرنامج: action = list (سجلات التقارير) أو pdf (ملف التقرير بصيغة base64). */
function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);
    checkCode_(d.code);
    if (d.action === 'list') {
      const r = listReports(d.code);
      return json_({ ok: true, records: r.records, saved: r.saved });
    }
    if (d.action === 'pdf') {
      const known = loadData_(rootFolder_()).records.some(function (r) { return r.pdfId === d.id; });
      if (!known) throw new Error('الملف غير مسجّل في سجل التقارير');
      const f = DriveApp.getFileById(d.id);
      return json_({ ok: true, name: f.getName(), b64: Utilities.base64Encode(f.getBlob().getBytes()) });
    }
    if (d.action === 'photo') {
      const knownPh = loadData_(rootFolder_()).records.some(function (r) { return (r.photoIds || []).indexOf(d.id) >= 0; });
      if (!knownPh) throw new Error('الصورة غير مسجّلة في سجل التقارير');
      const ph = DriveApp.getFileById(d.id);
      return json_({ ok: true, name: ph.getName(), b64: Utilities.base64Encode(ph.getBlob().getBytes()) });
    }
    throw new Error('طلب غير معروف');
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  }
}
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

/* ---------- استلام التقرير ---------- */
function submitReport(d) {
  if (!d || typeof d.pdf !== 'string' || d.pdf.indexOf('data:application/pdf') !== 0) {
    throw new Error('ملف PDF غير صالح');
  }
  if (d.pdf.length > CONFIG.MAX_PDF_MB * 1024 * 1024 * 1.4) throw new Error('حجم الملف كبير جداً');
  const m = d.meta || {};

  // مفتاح ربط المشروع: رقم العقد وسنته، وإن تعذّر فاسم المشروع بعد توحيد كتابته (كما يفعل نظام الشؤون الهندسية)
  const ckey = contractKey_(m.contractNo);
  const pkey = ckey ? 'c:' + ckey : 'n:' + normName_(d.project);
  const known = findProject_(rootFolder_(), pkey);       // مشروع سبق إرساله: نستعمل اسمه المسجّل لتبقى ملفاته في مجلد واحد
  const projName = known ? known.project : String(d.project || '');

  const resident = safeName_(d.resident || 'مقيم');
  const project = safeName_(projName || 'تقارير بدون مشروع');
  const month = safeName_(d.month || 'بدون شهر');

  const root = rootFolder_();
  const folder = sub_(sub_(root, project), month);
  const base = safeName_(d.fileBase || 'تقرير') + ' - ' + resident;

  const pdfFile = folder.createFile(
    Utilities.newBlob(Utilities.base64Decode(d.pdf.split(',')[1]), 'application/pdf', base + '.pdf'));
  if (d.json) folder.createFile(base + '.json', String(d.json), 'application/json');
  ['signature', 'stamp'].forEach(function (k) {
    if (typeof d[k] === 'string' && d[k].indexOf('data:image/') === 0) {
      folder.createFile(Utilities.newBlob(Utilities.base64Decode(d[k].split(',')[1]), 'image/png', base + '-' + k + '.png'));
    }
  });
  // صور الموقع: ملفات JPEG مستقلة (حتى 4) لبطاقة المشروع في البرنامج
  const photoIds = [];
  (Array.isArray(d.photos) ? d.photos : []).slice(0, 4).forEach(function (p, i) {
    if (typeof p !== 'string' || p.indexOf('data:image/jpeg;base64,') !== 0 || p.length > 450 * 1024) return;
    const f = folder.createFile(Utilities.newBlob(Utilities.base64Decode(p.split(',')[1]), 'image/jpeg', base + '-صورة' + (i + 1) + '.jpg'));
    photoIds.push(f.getId());
  });
  try { pdfFile.addViewer(CONFIG.DEPT_EMAIL); folder.addViewer(CONFIG.DEPT_EMAIL); } catch (err) { /* البريد ليس حساب Google */ }

  // تسجيل التقرير في سجل التقارير الشهرية الدورية
  upsertRecord_(root, {
    id: 'mr-' + md5_(pkey + '|' + String(d.month || '')),
    projectKey: pkey,
    project: projName, company: String(m.company || ''), district: String(m.district || ''),
    fileNo: '', contractNo: String(m.contractNo || ''),
    resident: String(d.resident || ''), month: String(d.month || ''), reportDate: String(m.reportDate || ''),
    actualPct: String(m.actualPct || ''), plannedPct: String(m.plannedPct || ''),
    status: String(m.status || ''), safeStatus: String(m.safeStatus || ''),
    cost: String(m.cost || ''), coCount: String(m.coCount || ''), coAmount: String(m.coAmount || ''), coTotal: String(m.coTotal || ''),   // أوامر التغيير كما كتبها المقيم
    pdfId: pdfFile.getId(), pdfUrl: pdfFile.getUrl(), folderUrl: folder.getUrl(),
    photoIds: photoIds
  });

  MailApp.sendEmail({
    to: CONFIG.DEPT_EMAIL,
    subject: 'التقرير الشهري - ' + project + ' - ' + month,
    htmlBody:
      '<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;line-height:1.9">' +
      '<p>السيد مسؤول القسم الهندسي المحترم،</p>' +
      '<p>ورد التقرير الشهري لمشروع:<br><b>' + esc_(d.project || '') + '</b><br>' +
      'الشركة المنفذة: <b>' + esc_(m.company || '') + '</b> — القضاء: <b>' + esc_(m.district || '') + '</b><br>' +
      'المهندس المقيم: <b>' + esc_(d.resident || '') + '</b><br>عن شهر ' + esc_(d.month || '') + '.</p>' +
      '<p>ملف PDF مرفق بهذه الرسالة، ومحفوظ في Drive: <a href="' + pdfFile.getUrl() + '">فتح الملف</a><br>' +
      'مجلد الشهر: <a href="' + folder.getUrl() + '">فتح المجلد</a></p></div>',
    attachments: [pdfFile.getBlob()]
  });

  return { ok: true, url: pdfFile.getUrl(), folder: folder.getUrl() };
}

/* ---------- لوحة التقارير الشهرية الدورية ---------- */
function listReports(code) {
  checkCode_(code);
  const data = loadData_(rootFolder_());
  return { records: data.records || [], saved: data.saved || '' };
}

/** يربط جميع تقارير المشروع برقم الاضبارة في نظام الشؤون الهندسية (يُدخله القسم مرة واحدة). */
function setFileNo(code, projectKey, fileNo) {
  checkCode_(code);
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const root = rootFolder_(), data = loadData_(root), now = Date.now();
    data.records.forEach(function (r) {
      if (r.projectKey === projectKey) { r.fileNo = String(fileNo || '').trim(); r.updated = now; }
    });
    saveData_(root, data);
  } finally { lock.releaseLock(); }
  return { ok: true };
}

function checkCode_(code) {
  if (!code || String(code) !== String(CONFIG.DASH_CODE)) throw new Error('رمز الدخول غير صحيح');
}

/* ---------- سجل التقارير (JSON بصيغة النظام: app/version/records مع id و updated) ---------- */
function upsertRecord_(root, rec) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const data = loadData_(root), now = Date.now();
    const withFile = data.records.filter(function (r) { return r.projectKey === rec.projectKey && r.fileNo; })[0];
    if (withFile) rec.fileNo = withFile.fileNo;           // رقم الاضبارة الذي أدخله القسم يبقى لكل تقارير المشروع
    const i = data.records.findIndex(function (r) { return r.id === rec.id; });
    if (i >= 0) {
      rec.created = data.records[i].created || now;
      try { if (data.records[i].pdfId && data.records[i].pdfId !== rec.pdfId) DriveApp.getFileById(data.records[i].pdfId).setTrashed(true); } catch (e) { }
      (data.records[i].photoIds || []).forEach(function (id) { if ((rec.photoIds || []).indexOf(id) < 0) { try { DriveApp.getFileById(id).setTrashed(true); } catch (e) { } } });   // صور الإرسال السابق لنفس الشهر
      data.records[i] = rec;
    } else {
      rec.created = now;
      data.records.push(rec);
    }
    rec.updated = now;
    saveData_(root, data);
  } finally { lock.releaseLock(); }
}
function loadData_(root) {
  const it = root.getFilesByName(DATA_FILE);
  if (it.hasNext()) {
    try {
      const d = JSON.parse(it.next().getBlob().getDataAsString('UTF-8'));
      if (d && Array.isArray(d.records)) return d;
    } catch (e) { }
  }
  return { app: 'anbar-monthly-reports', version: 1, saved: '', records: [] };
}
function saveData_(root, data) {
  data.saved = new Date().toISOString();
  const s = JSON.stringify(data), it = root.getFilesByName(DATA_FILE);
  if (it.hasNext()) it.next().setContent(s); else root.createFile(DATA_FILE, s, 'application/json');
}

/* ---------- مفاتيح الربط ---------- */
/** يحوّل الأرقام العربية إلى لاتينية. */
function latin_(s) { return String(s || '').replace(/[٠-٩]/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(d); }).replace(/[۰-۹]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d); }); }

/** رقم العقد وسنته: «٩١ لسنة ٢٠٢٤ في ...» => «91/2024». فارغ إن تعذّر الاستخراج. */
function contractKey_(s) {
  const m = /(\d+)\s*(?:\/|\\|-|لسنة|لسنه|بتاريخ|ل)\s*(\d{4})/.exec(latin_(s));
  return m ? String(parseInt(m[1], 10)) + '/' + m[2] : '';
}

/** توحيد كتابة الاسم: أ/إ/آ=ا، ة=ه، ى=ي، حذف التشكيل والتطويل وعلامات الترقيم. */
function normName_(s) {
  return latin_(s).replace(/[ً-ٰٟـ]/g, '')
    .replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي')
    .replace(/[^ء-يa-zA-Z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function findProject_(root, pkey) {
  const recs = loadData_(root).records;
  for (var i = 0; i < recs.length; i++) if (recs[i].projectKey === pkey) return recs[i];
  return null;
}

/* ---------- أدوات داخلية ---------- */
function rootFolder_() { return CONFIG.ROOT_FOLDER_ID ? DriveApp.getFolderById(CONFIG.ROOT_FOLDER_ID) : DriveApp.getRootFolder(); }
function sub_(parent, name) {
  const it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}
function md5_(s) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, s, Utilities.Charset.UTF_8)
    .map(function (b) { return ('0' + (b & 255).toString(16)).slice(-2); }).join('');
}
function safeName_(s) { return String(s).replace(/[\\\/:*?"<>|\n\r]+/g, ' ').trim().slice(0, 80) || 'بدون اسم'; }
function esc_(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
