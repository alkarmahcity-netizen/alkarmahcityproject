/* صفحة الاطلاع على iPhone — قسم الشؤون الهندسية
   تُنشر «تطبيق ويب» من Google Apps Script بحساب بريد القسم (التنفيذ: أنا / الوصول: أي شخص).
   الصفحة تقرأ ملف نسخة الاطلاع المشفّر نفسه الذي تنشره حاسبة القسم على Google Drive (رابط «عارض»)، وتفك تشفيره
   داخل الهاتف فقط برمز الربط (AV1.…). هذا الخادم لا يرى الرمز ولا يفك شيئاً، ولا يقرأ إلا ملفات Drive العامة («لمن لديه الرابط»)
   التي تبدأ بعلامة ملف نسخة الاطلاع — فلا يصل أحد عبره إلى أي ملف آخر في بريد القسم. */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('صفحة كبار الشخصيات للاطلاع — محافظة الأنبار')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')
    .addMetaTag('apple-mobile-web-app-capable', 'yes');
}

/* يُرجع محتوى ملف عام من Drive (Base64) إن كان ملف نسخة الاطلاع (يبدأ بـ AV1) */
function vwGet(id) {
  id = String(id || '');
  if (!/^[A-Za-z0-9_-]{10,100}$/.test(id)) throw new Error('معرّف الملف غير صحيح');
  var r = UrlFetchApp.fetch('https://drive.google.com/uc?export=download&id=' + encodeURIComponent(id), { muteHttpExceptions: true, followRedirects: true });
  var code = r.getResponseCode();
  if (code === 404 || code === 403) throw new Error('الملف غير متاح في Google Drive (أُوقفت نسخة الاطلاع من حاسبة القسم؟)');
  if (code !== 200) throw new Error('Google Drive: خطأ ' + code);
  var b = r.getBlob().getBytes();
  if (b.length < 31 || b[0] !== 65 || b[1] !== 86 || b[2] !== 49) throw new Error('الملف غير متاح للعرض (أُوقفت نسخة الاطلاع من حاسبة القسم؟)');
  return Utilities.base64Encode(b);
}

/* فيديو المقدمة (ملف «intro» في المشروع: الفيديو نفسه في البرنامج مصغّراً، مكتوباً Base64). إن لم يوجد الملف تُفتح الصفحة بلا مقدمة */
function vwIntro() {
  try { return HtmlService.createHtmlOutputFromFile('intro').getContent().replace(/[^A-Za-z0-9+\/=]/g, ''); } catch (e) { return ''; }
}
