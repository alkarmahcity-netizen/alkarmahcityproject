'use strict';
/* Google Drive لبريد القسم (إصدار شهادات الاستلام مع رفع PDF تلقائياً ورمز QR يفتحه عند الجميع):
   - تسجيل الدخول مرة واحدة من المتصفح (OAuth للتطبيقات المكتبية: عنوان محلي 127.0.0.1 + PKCE)، بالنطاق drive.file فقط
     (يرى البرنامج الملفات التي أنشأها هو فقط، لا باقي ملفات البريد).
   - معرّف التطبيق وسرّه (من Google Cloud) ورمز التحديث تُحفظ مشفّرة على هذه الحاسبة (safeStorage) — لا تُكتب في أي ملف نصاً.
   - reserve: ملف PDF فارغ في مجلد «شهادات الاستلام» يُشارَك «أي شخص لديه الرابط ← عارض» ← رابطه ثابت قبل الطباعة (فيُطبع في رمز QR).
   - upload: محتوى PDF على المعرّف نفسه (الإصدار الأول، وكل إعادة إصدار بعد تعديل) — الرمز المطبوع يفتح دائماً آخر نسخة. */
const http = require('http'), https = require('https'), crypto = require('crypto'), fs = require('fs');
const SCOPE = 'https://www.googleapis.com/auth/drive.file openid email';
const FOLDER = 'شهادات الاستلام — قسم الشؤون الهندسية';
module.exports = function createDrive(ctx) {
  // ctx: file() مسار ملف الإعدادات، safeStorage، openExternal(url)، log(msg)
  const API = process.env.UNI_GD_API || 'https://www.googleapis.com';
  const AUTH = process.env.UNI_GD_AUTH || 'https://accounts.google.com/o/oauth2/v2/auth';
  const TOKEN = process.env.UNI_GD_TOKEN || 'https://oauth2.googleapis.com/token';
  const enc = s => { try { if (ctx.safeStorage && ctx.safeStorage.isEncryptionAvailable()) return 'e:' + ctx.safeStorage.encryptString(String(s)).toString('base64'); } catch (_) {} return 'p:' + Buffer.from(String(s)).toString('base64'); };
  const dec = s => { s = String(s || ''); try { if (s.startsWith('e:')) return ctx.safeStorage.decryptString(Buffer.from(s.slice(2), 'base64')); if (s.startsWith('p:')) return Buffer.from(s.slice(2), 'base64').toString(); } catch (_) {} return ''; };
  const load = () => { try { return JSON.parse(fs.readFileSync(ctx.file(), 'utf8')) || {}; } catch (_) { return {}; } };
  const save = c => { const f = ctx.file(), t = f + '.tmp'; fs.writeFileSync(t, JSON.stringify(c)); fs.renameSync(t, f); };
  let access = null;   // { token, until }
  /* الاتصال بـ Google: عبر شبكة Chromium داخل البرنامج (ctx.net = net من Electron) — تأخذ إعدادات الإنترنت والـ Proxy في Windows
     كالمتصفح، بدل اتصال Node المباشر الذي قد ينتهي بـ ETIMEDOUT في شبكات الدوائر. ومحاولة ثانية تلقائية عند انقطاع مؤقت */
  const TRANSIENT = /ETIMEDOUT|ECONNRESET|ECONNREFUSED|ENETUNREACH|EHOSTUNREACH|EAI_AGAIN|ENOTFOUND|ERR_TIMED_OUT|ERR_CONNECTION|ERR_NETWORK|ERR_INTERNET_DISCONNECTED|ERR_NAME_NOT_RESOLVED|ERR_PROXY|انتهت مهلة/;
  async function req(method, url, opt = {}) {
    let last;
    for (let i = 0; i < 2; i++) {
      try { return ctx.net ? await reqNet(method, url, opt) : await reqNode(method, url, opt); }
      catch (e) { last = e; if (!TRANSIENT.test(String(e && (e.code || '') + ' ' + (e.message || e)))) break; await new Promise(r => setTimeout(r, 1500)); }
    }
    const m = String(last && (last.message || last) || '');
    throw TRANSIENT.test(m + ' ' + (last && last.code || '')) ? new Error('تعذّر الاتصال بـ Google — تحقق من الإنترنت في هذه الحاسبة ثم أعد المحاولة (' + m.slice(0, 80) + ')') : last;
  }
  function reqNet(method, url, { headers = {}, body = null } = {}) {
    return new Promise((res, rej) => {
      const b = body == null ? null : Buffer.isBuffer(body) ? body : Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
      const h = { ...headers }; if (b && !h['Content-Type']) h['Content-Type'] = 'application/json; charset=utf-8';
      let done = false; const fin = (f, v) => { if (!done) { done = true; clearTimeout(t); f(v); } };
      const r = ctx.net.request({ method, url, redirect: 'follow', useSessionCookies: false });
      Object.entries(h).forEach(([k, v]) => { if (!/^content-length$/i.test(k)) r.setHeader(k, String(v)); });
      const t = setTimeout(() => { try { r.abort(); } catch (_) {} fin(rej, new Error('انتهت مهلة الاتصال بـ Google')); }, 90000);
      r.on('response', x => { const ch = []; x.on('data', c => ch.push(c)); x.on('end', () => { const raw = Buffer.concat(ch), tx = raw.toString('utf8'); let j = null; try { j = JSON.parse(tx); } catch (_) {} fin(res, { status: x.statusCode, json: j, text: tx, raw }); }); x.on('error', e => fin(rej, e)); });
      r.on('error', e => fin(rej, e));
      if (b) r.write(b); r.end();
    });
  }
  function reqNode(method, url, { headers = {}, body = null } = {}) {
    return new Promise((res, rej) => {
      const u = new URL(url), mod = u.protocol === 'http:' ? http : https;
      const b = body == null ? null : Buffer.isBuffer(body) ? body : Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
      const h = { ...headers }; if (b) h['Content-Length'] = b.length; if (b && !h['Content-Type']) h['Content-Type'] = 'application/json; charset=utf-8';
      const r = mod.request(u, { method, headers: h, timeout: 60000 }, x => { const ch = []; x.on('data', c => ch.push(c)); x.on('end', () => { const raw = Buffer.concat(ch), t = raw.toString('utf8'); let j = null; try { j = JSON.parse(t); } catch (_) {} res({ raw, status: x.statusCode, json: j, text: t }); }); });
      r.on('timeout', () => r.destroy(new Error('انتهت مهلة الاتصال بـ Google'))); r.on('error', rej); if (b) r.write(b); r.end();
    });
  }
  const form = o => Object.entries(o).map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v)).join('&');
  const gerr = (r, what) => { const m = (r.json && (r.json.error_description || (r.json.error && (r.json.error.message || r.json.error)))) || r.text || ''; return new Error(`${what} (${r.status}): ${String(m).slice(0, 200)}`); };
  function status() { const c = load(); return { configured: !!(c.cid && c.cs), connected: !!c.rt, email: c.email || '', folder: !!c.folder }; }
  function setApp(clientId, clientSecret) {
    clientId = String(clientId || '').trim(); clientSecret = String(clientSecret || '').trim();
    if (!/\.apps\.googleusercontent\.com$/.test(clientId)) return { error: 'معرّف التطبيق (Client ID) يجب أن ينتهي بـ .apps.googleusercontent.com' };
    if (clientSecret.length < 10) return { error: 'سرّ التطبيق (Client secret) غير صحيح' };
    const c = load(); if (dec(c.cid) !== clientId) { delete c.rt; delete c.email; delete c.folder; } c.cid = enc(clientId); c.cs = enc(clientSecret); save(c); access = null; return { ok: true };
  }
  /* لنسخة اللجنة المركزية فقط (zcremote.js): معرّف التطبيق وسرّه يُنقلان مشفّرين داخل رمز الربط — لا يُعرضان */
  function appCreds() { const c = load(); const cid = dec(c.cid), cs = dec(c.cs); return cid && cs ? { cid, cs } : null; }
  /* «رمز إعداد Drive»: ينقل معرّف التطبيق وسرّه الصحيحين من حاسبة مربوطة إلى حاسبة أخرى (مشفّرين) — بدل نسخ السرّ يدوياً من Google Cloud.
     لا يُصدَر إلا بعد التأكد من أن السرّ يعمل فعلاً (تجديد التفويض الآن) */
  const b64u = b => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''), ub64 = s => Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  async function exportSetup() {
    const cr = appCreds(); if (!cr || !load().rt) return { error: 'هذه الحاسبة غير مربوطة ببريد القسم — أصدر الرمز من حاسبة مربوطة (يعمل فيها «☁ إصدار ورفع إلى Drive»)' };
    access = null; try { await token(); } catch (e) { return { error: 'الربط في هذه الحاسبة لا يعمل الآن: ' + String(e.message || e) }; }
    const key = crypto.randomBytes(16), iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-128-gcm', key, iv);
    const ct = Buffer.concat([c.update(Buffer.from(JSON.stringify(cr))), c.final()]);
    return { ok: true, code: 'GD1.' + b64u(key) + '.' + b64u(Buffer.concat([iv, c.getAuthTag(), ct])) };
  }
  function importSetup(code) {
    const m = /^GD1\.([A-Za-z0-9_-]{22})\.([A-Za-z0-9_-]{40,})$/.exec(String(code || '').replace(/\s+/g, '')); if (!m) return { error: 'رمز إعداد Drive غير صحيح — يبدأ بـ GD1. ويُنسخ كاملاً من الحاسبة المربوطة' };
    let cr; try { const key = ub64(m[1]), b = ub64(m[2]), d = crypto.createDecipheriv('aes-128-gcm', key, b.slice(0, 12)); d.setAuthTag(b.slice(12, 28)); cr = JSON.parse(Buffer.concat([d.update(b.slice(28)), d.final()]).toString('utf8')); }
    catch (_) { return { error: 'رمز إعداد Drive تالف أو ناقص — انسخه كاملاً من جديد' }; }
    const c = load(); if (dec(c.cid) === cr.cid && dec(c.cs) !== cr.cs) { delete c.rt; save(c); }   // السرّ القديم الخاطئ: يُعاد تسجيل الدخول
    return setApp(cr.cid, cr.cs);
  }
  /* مشاركة الربط كاملاً عبر مزامنة القسم (يفعّلها مدير القسم): المعرّف والسرّ ورمز التحديث — يُتحقق أنه يعمل قبل الإرسال */
  async function shareOut() { const cr = appCreds(), c = load(), rt = dec(c.rt); if (!cr || !rt) return null; try { await token(); } catch (_) { return null; } return { cid: cr.cid, cs: cr.cs, rt, email: c.email || '' }; }
  function shareIn(o) { if (!o || !o.cid || !o.cs || !o.rt) return false; if (load().rt) return false;   // حاسبة مربوطة: لا يُستبدل ربطها
    const r = setApp(o.cid, o.cs); if (r && r.error) return false; const c = load(); c.rt = enc(o.rt); c.email = o.email || ''; c.shared = Date.now(); save(c); access = null; return true; }
  function disconnect() { const c = load(); delete c.rt; delete c.email; delete c.folder; delete c.folders; save(c); access = null; return { ok: true }; }
  /* تسجيل الدخول: المتصفح ← Google ← يعود إلى عنوان محلي مؤقت في هذه الحاسبة برمز التفويض */
  function connect(hint) {
    const c = load(), cid = dec(c.cid), cs = dec(c.cs); if (!cid || !cs) return Promise.resolve({ error: 'أدخل معرّف التطبيق وسرّه أولاً' });
    const verifier = crypto.randomBytes(48).toString('base64url'), challenge = crypto.createHash('sha256').update(verifier).digest('base64url'), st = crypto.randomBytes(16).toString('hex');
    return new Promise(resolve => {
      let done = false; const fin = (r, srv) => { if (done) return; done = true; try { srv.close(); } catch (_) {} resolve(r); };
      const srv = http.createServer(async (q, s) => {
        const u = new URL(q.url, 'http://127.0.0.1'); if (u.pathname !== '/') { s.writeHead(404); s.end(); return; }
        const code = u.searchParams.get('code'), er = u.searchParams.get('error');
        const page = (ok, msg) => { s.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); s.end(`<!doctype html><meta charset="utf-8"><body style="font:18px Tahoma;direction:rtl;text-align:center;padding:50px;color:${ok ? '#1b5e20' : '#8b1a1a'}">${ok ? '✔' : '✖'} ${msg}<br><small style="color:#555">يمكنك إغلاق هذه الصفحة والعودة إلى البرنامج.</small></body>`); };
        if (er || !code || u.searchParams.get('state') !== st) { page(false, 'لم يكتمل تسجيل الدخول'); fin({ error: 'لم يكتمل تسجيل الدخول: ' + (er || 'لا رمز') }, srv); return; }
        try {
          const redirect = `http://127.0.0.1:${srv.address().port}/`;
          const r = await req('POST', TOKEN, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form({ code, client_id: cid, client_secret: cs, redirect_uri: redirect, grant_type: 'authorization_code', code_verifier: verifier }) });
          if (r.status !== 200 || !r.json || !r.json.refresh_token) throw gerr(r, 'تعذّر الحصول على التفويض');
          let email = ''; try { email = JSON.parse(Buffer.from(String(r.json.id_token || '').split('.')[1] || '', 'base64url').toString()).email || ''; } catch (_) {}
          const c2 = load(); c2.rt = enc(r.json.refresh_token); c2.email = email; delete c2.folder; delete c2.folders; save(c2);
          access = { token: r.json.access_token, until: Date.now() + (r.json.expires_in || 3000) * 1000 - 60000 };
          page(true, 'رُبط البرنامج بـ ' + (email || 'حساب Google')); fin({ ok: true, email }, srv);
        } catch (e) { const m = String(e.message || e); page(false, 'تعذّر إكمال الربط<br><small style="color:#8b1a1a">' + m.replace(/[&<>"]/g, x => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[x])) + (/invalid_client|Unauthorized|client_secret/i.test(m) ? '<br>سرّ التطبيق (Client secret) لا يطابق معرّفه — انسخهما من حاسبة القسم (رمز الربط ZC2 يحملهما)' : '') + '</small>'); fin({ error: m }, srv); }
      });
      srv.listen(0, '127.0.0.1', () => {
        const redirect = `http://127.0.0.1:${srv.address().port}/`;
        const url = AUTH + '?' + form({ client_id: cid, redirect_uri: redirect, response_type: 'code', scope: SCOPE, code_challenge: challenge, code_challenge_method: 'S256', access_type: 'offline', prompt: 'consent', state: st, ...(hint ? { login_hint: hint } : {}) });
        ctx.openExternal(url);
      });
      setTimeout(() => fin({ error: 'انتهت مهلة تسجيل الدخول (5 دقائق) — أعد المحاولة' }, srv), +process.env.UNI_GD_LOGIN_MS || 300000);
    });
  }
  async function token() {
    if (access && access.until > Date.now()) return access.token;
    const c = load(), rt = dec(c.rt); if (!rt) throw new Error('البرنامج غير مربوط ببريد القسم — اضغط «تسجيل الدخول ببريد القسم»');
    const r = await req('POST', TOKEN, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form({ client_id: dec(c.cid), client_secret: dec(c.cs), refresh_token: rt, grant_type: 'refresh_token' }) });
    if (r.status !== 200 || !r.json || !r.json.access_token) { if (r.json && r.json.error === 'invalid_grant') { const c2 = load(); delete c2.rt; save(c2); throw new Error('انتهى تفويض بريد القسم أو أُلغي — سجّل الدخول من جديد'); } throw gerr(r, 'تعذّر تجديد التفويض'); }
    access = { token: r.json.access_token, until: Date.now() + (r.json.expires_in || 3000) * 1000 - 60000 }; return access.token;
  }
  const auth = async () => ({ Authorization: 'Bearer ' + await token() });
  /* مجلد لكل نظام (شهادات الاستلام، المخاطبات، المدد، السلف، تقارير الزيارة) — يُنشأ مرة ويُحفظ معرّفه */
  async function folder(name) {
    name = String(name || FOLDER); const c = load(); if (name === FOLDER && c.folder) return c.folder; if (c.folders && c.folders[name]) return c.folders[name];
    const r = await req('POST', API + '/drive/v3/files?fields=id', { headers: await auth(), body: { name, mimeType: 'application/vnd.google-apps.folder' } });
    if (r.status !== 200 || !r.json || !r.json.id) throw gerr(r, 'تعذّر إنشاء مجلد «' + name + '» في Drive');
    const c2 = load(); if (name === FOLDER) c2.folder = r.json.id; else c2.folders = Object.assign({}, c2.folders, { [name]: r.json.id }); save(c2); return r.json.id;
  }
  /* الملفات التي أنشأها البرنامج (نطاق drive.file لا يسمح بتعديل غيرها): إعادة الإصدار على الرابط نفسه لهذه فقط */
  const owns = id => { const c = load(); return !!(c.ids && c.ids.includes(String(id))); };
  /* حجز ملف PDF ورابطه قبل الطباعة، ومشاركته «أي شخص لديه الرابط ← عارض» */
  async function reserve(name, folderName) {
    const parent = await folder(folderName);
    const r = await req('POST', API + '/drive/v3/files?fields=id', { headers: await auth(), body: { name: String(name || 'شهادة.pdf').slice(0, 150), mimeType: 'application/pdf', parents: [parent] } });
    if (r.status !== 200 || !r.json || !r.json.id) throw gerr(r, 'تعذّر إنشاء ملف الشهادة في Drive');
    const id = r.json.id; { const c = load(); c.ids = [String(id)].concat((c.ids || []).filter(x => x !== String(id))).slice(0, 20000); save(c); }
    const p = await req('POST', API + `/drive/v3/files/${id}/permissions?fields=id`, { headers: await auth(), body: { role: 'reader', type: 'anyone' } });
    const shared = p.status === 200;
    return { id, url: `https://drive.google.com/file/d/${id}/view`, shared, shareError: shared ? '' : 'لم تُفتح مشاركة الملف لأي شخص لديه الرابط — قد تمنعها إعدادات Google Workspace للمحافظة؛ فيفتح الرمز لحسابات المحافظة فقط' };
  }
  async function upload(id, buf, name) {
    if (!/^[A-Za-z0-9_-]{10,}$/.test(String(id))) throw new Error('معرّف ملف Drive غير صحيح');
    const r = await req('PATCH', API + `/upload/drive/v3/files/${id}?uploadType=media&fields=id,size`, { headers: { ...(await auth()), 'Content-Type': 'application/pdf' }, body: buf });
    if (r.status === 404) throw new Error('ملف الشهادة غير موجود في Drive (حُذف؟) — أصدرها من جديد فيُحجز ملف جديد');
    if (r.status !== 200) throw gerr(r, 'تعذّر رفع PDF الشهادة');
    if (name) { try { await req('PATCH', API + `/drive/v3/files/${id}?fields=id`, { headers: await auth(), body: { name: String(name).slice(0, 150) } }); } catch (_) {} }
    return { ok: true, id, url: `https://drive.google.com/file/d/${id}/view` };
  }
  /* نسخة الاطلاع (viewer.js): ملفات ثنائية مشفّرة في مجلدها، تُشارَك «لمن لديه الرابط ← عارض»، وتُحذف عند إيقاف النسخة */
  async function reserveBin(name, folderName, priv) {
    const parent = await folder(folderName);
    const r = await req('POST', API + '/drive/v3/files?fields=id', { headers: await auth(), body: { name: String(name || 'ملف.bin').slice(0, 150), mimeType: 'application/octet-stream', parents: [parent] } });
    if (r.status !== 200 || !r.json || !r.json.id) throw gerr(r, 'تعذّر إنشاء ملف في Drive');
    const id = r.json.id; { const c = load(); c.ids = [String(id)].concat((c.ids || []).filter(x => x !== String(id))).slice(0, 20000); save(c); }
    if (priv) return { id, shared: false };   // خاص ببريد القسم (لا مشاركة): ملفات تبادل اللجنة المركزية
    const p = await req('POST', API + `/drive/v3/files/${id}/permissions?fields=id`, { headers: await auth(), body: { role: 'reader', type: 'anyone' } });
    return { id, shared: p.status === 200 };
  }
  async function uploadBin(id, buf) {
    if (!/^[A-Za-z0-9_-]{10,}$/.test(String(id))) throw new Error('معرّف ملف Drive غير صحيح');
    const r = await req('PATCH', API + `/upload/drive/v3/files/${id}?uploadType=media&fields=id,size`, { headers: { ...(await auth()), 'Content-Type': 'application/octet-stream' }, body: buf });
    if (r.status === 404) throw new Error('ملف نسخة الاطلاع غير موجود في Drive (حُذف؟) — أوقف النسخة ثم انشرها من جديد');
    if (r.status !== 200) throw gerr(r, 'تعذّر رفع ملف نسخة الاطلاع');
    return { ok: true, id };
  }
  /* قراءة ملف أنشأه البرنامج بحساب بريد القسم (ملفات اللجنة المركزية الخاصة — بلا رابط عام) */
  async function getBin(id) {
    if (!/^[A-Za-z0-9_-]{10,}$/.test(String(id))) throw new Error('معرّف ملف Drive غير صحيح');
    const r = await req('GET', API + `/drive/v3/files/${id}?alt=media`, { headers: await auth() });
    if (r.status === 404) throw new Error('ملف التبادل غير موجود في Drive (أُوقف الربط من حاسبة القسم؟)');
    if (r.status !== 200) throw gerr(r, 'تعذّر قراءة الملف من Drive');
    return r.raw || Buffer.from(r.text || '', 'utf8');
  }
  async function trash(id) {
    if (!/^[A-Za-z0-9_-]{10,}$/.test(String(id))) return false;
    const r = await req('DELETE', API + `/drive/v3/files/${id}`, { headers: await auth() });
    if (r.status !== 204 && r.status !== 200 && r.status !== 404) throw gerr(r, 'تعذّر حذف الملف من Drive');
    return true;
  }
  return { status, setApp, appCreds, exportSetup, importSetup, shareOut, shareIn, connect, disconnect, reserve, upload, owns, reserveBin, uploadBin, getBin, trash };
};
