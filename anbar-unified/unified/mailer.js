'use strict';
/* إرسال الصفحة الحالية (PDF) بالبريد الإلكتروني من بريد القسم (Eng@anbar.iq) عبر SMTP.
   كلمة المرور تُحفظ مشفّرة بتشفير ويندوز (safeStorage) في ملف mail.json داخل مجلد البيانات، ولا تُعرض أبداً.
   الاستعمال: require('./mailer')({ ipcMain, safeStorage, dir: () => مجلد البيانات }) */
const fs = require('fs'), path = require('path');
module.exports = function register(opt) {
  const { ipcMain, safeStorage } = opt;
  const file = () => path.join(opt.dir(), 'mail.json');
  const DEF = { host: 'mail.anbar.iq', port: 465, secure: 'ssl', user: 'Eng@anbar.iq', fromName: 'قسم الشؤون الهندسية - محافظة الأنبار', signature: 'مع التقدير\nقسم الشؤون الهندسية\nمحافظة الأنبار', contacts: [], log: [] };
  function load() { try { return Object.assign({}, DEF, JSON.parse(fs.readFileSync(file(), 'utf8'))); } catch (_) { return Object.assign({}, DEF); } }
  function save(c) { fs.writeFileSync(file(), JSON.stringify(c, null, 1)); }
  function getPass(c) {
    if (!c.pass) return '';
    try { return c.passEnc && safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(Buffer.from(c.pass, 'base64')) : Buffer.from(c.pass, 'base64').toString('utf8'); } catch (_) { return ''; }
  }
  function setPass(c, p) {
    if (safeStorage.isEncryptionAvailable()) { c.pass = safeStorage.encryptString(p).toString('base64'); c.passEnc = true; }
    else { c.pass = Buffer.from(p, 'utf8').toString('base64'); c.passEnc = false; }
  }
  const pub = c => ({ host: c.host, port: c.port, secure: c.secure, user: c.user, fromName: c.fromName, signature: c.signature, contacts: c.contacts || [], hasPass: !!c.pass, log: (c.log || []).slice(0, 30) });
  const transOpts = (c, pass) => ({
    host: c.host, port: +c.port || 465, secure: c.secure === 'ssl', requireTLS: c.secure === 'starttls', ignoreTLS: c.secure === 'none',
    auth: { user: c.user, pass }, connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 30000,
    tls: { rejectUnauthorized: c.strictTls === true ? true : false } // خوادم البريد الحكومية كثيراً ما تستعمل شهادة غير موقَّعة
  });
  function explain(e) {
    const m = String((e && (e.response || e.message)) || e || '');
    if (/EAUTH|535|authentication|Invalid login|Username and Password/i.test(m)) return 'اسم المستخدم أو كلمة المرور غير صحيحة (أو أن الخادم يتطلب تفعيل الدخول من البرامج).';
    if (/ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(m)) return 'لم يُعثر على خادم البريد بهذا الاسم — تأكد من اسم الخادم أو من اتصال الإنترنت.';
    if (/ETIMEDOUT|ECONNREFUSED|timeout|ECONNRESET/i.test(m)) return 'تعذّر الاتصال بخادم البريد على هذا المنفذ (قد يكون المنفذ أو نوع الأمان غير صحيح، أو أن الشبكة تحجبه).';
    if (/certificate|self signed|SSL|TLS|wrong version/i.test(m)) return 'مشكلة في الاتصال الآمن (SSL/TLS) — جرّب تغيير نوع الأمان أو المنفذ.';
    if (/size|552|too large/i.test(m)) return 'حجم الملف أكبر مما يسمح به خادم البريد.';
    return m.slice(0, 300) || 'خطأ غير معروف';
  }
  let nm = null; const NM = () => (nm || (nm = require('nodemailer')));
  async function verify(c, pass) { const t = NM().createTransport(transOpts(c, pass)); try { await t.verify(); return true; } finally { try { t.close(); } catch (_) {} } }

  ipcMain.handle('mail:get', () => pub(load()));
  ipcMain.handle('mail:set', (_e, n) => {
    const c = load();
    for (const k of ['host', 'secure', 'user', 'fromName', 'signature']) if (n[k] != null) c[k] = String(n[k]).trim();
    if (n.port != null) c.port = +n.port || 465;
    if (n.pass) setPass(c, String(n.pass));
    if (n.clearPass) { delete c.pass; delete c.passEnc; }
    if (Array.isArray(n.contacts)) c.contacts = n.contacts.filter(x => x && /@/.test(x.email || '')).slice(0, 300);
    save(c); return pub(c);
  });
  // اختبار الاتصال: يجرب الإعدادات الحالية، وإن فشلت يجرب الخوادم والمنافذ الشائعة لنطاق البريد ويحفظ أول ما ينجح
  ipcMain.handle('mail:test', async (_e, n) => {
    const c = Object.assign(load(), n || {}); const pass = (n && n.pass) || getPass(load());
    if (!c.user || !pass) return { ok: false, msg: 'أدخل البريد وكلمة المرور أولاً.' };
    try { await verify(c, pass); return { ok: true, msg: 'تم الاتصال بنجاح: ' + c.host + ':' + c.port }; } catch (e0) {
      const dom = String(c.user).split('@')[1] || ''; const hosts = [...new Set([c.host, 'mail.' + dom, 'smtp.' + dom, dom].filter(Boolean))];
      const combos = []; for (const h of hosts) for (const [p, s] of [[465, 'ssl'], [587, 'starttls'], [25, 'starttls']]) combos.push({ host: h, port: p, secure: s });
      for (const k of combos) { if (k.host === c.host && +k.port === +c.port && k.secure === c.secure) continue;
        try { await verify(Object.assign({}, c, k), pass); const s = load(); Object.assign(s, k); save(s); return { ok: true, found: k, msg: 'نجح الاتصال بعد تجربة إعدادات أخرى، وحُفظت: ' + k.host + ':' + k.port + ' (' + (k.secure === 'ssl' ? 'SSL' : 'STARTTLS') + ')' }; } catch (_) {}
      }
      return { ok: false, msg: explain(e0) };
    }
  });
  // الإرسال: pdf = Buffer الملف، m = { to, cc, subject, text, filename }
  async function send(pdf, m) {
    const c = load(), pass = getPass(c);
    if (!c.user || !pass) return { ok: false, msg: 'لم تُضبط إعدادات البريد بعد (البريد وكلمة المرور).', needSetup: true };
    const to = String(m.to || '').split(/[,;،\s]+/).filter(x => /@/.test(x)); if (!to.length) return { ok: false, msg: 'أدخل عنوان المرسل إليه.' };
    const cc = String(m.cc || '').split(/[,;،\s]+/).filter(x => /@/.test(x));
    const name = String(m.filename || 'مستند').replace(/[\\/:*?"<>|]+/g, '_').replace(/\.pdf$/i, '') + '.pdf';
    const t = NM().createTransport(transOpts(c, pass));
    try {
      await t.sendMail({ from: { name: c.fromName || c.user, address: c.user }, to, cc: cc.length ? cc : undefined, subject: String(m.subject || name), text: String(m.text || ''),
        attachments: [{ filename: name, content: pdf, contentType: 'application/pdf' }] });
      const s = load(); s.log = [{ at: new Date().toISOString(), to: to.join(', '), subject: String(m.subject || ''), file: name }].concat(s.log || []).slice(0, 200);
      for (const e of to.concat(cc)) if (!(s.contacts || []).some(x => x.email.toLowerCase() === e.toLowerCase())) (s.contacts = s.contacts || []).push({ name: '', email: e });
      save(s); return { ok: true, msg: 'تم الإرسال إلى ' + to.join('، ') };
    } catch (e) { return { ok: false, msg: explain(e) }; } finally { try { t.close(); } catch (_) {} }
  }
  return { send, load };
};
