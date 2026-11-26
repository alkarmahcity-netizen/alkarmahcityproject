'use strict';
// نظام الشؤون الهندسية الموحد - محافظة الأنبار
// نافذة واحدة: لوحة رئيسية (الموقف الشهري) + أربعة أنظمة في تبويبات:
// أوامر التغيير (co) · المدد والتوقف (du) · لجنة تدقيق السلف (ad) · إطلاق التأمينات (in) · شهادات الاستلام (ac).
// كل نظام يحتفظ ببياناته في ملف مستقل، ويتشاركون سجل الموقف في ملف واحد.
const { app, BrowserWindow, BrowserView, ipcMain, dialog, shell, Menu, session, nativeTheme, safeStorage, protocol } = require('electron');
/* صور مرفقات التبليغات (anbar-ann://f/<معرّف التبليغ>/<رقم الصفحة>.jpg) في نوافذ البرنامج */
try { protocol.registerSchemesAsPrivileged([{ scheme: 'anbar-ann', privileges: { standard: true, secure: true, supportFetchAPI: true } }, { scheme: 'anbar-font', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }]); } catch (_) {}
const path = require('path');
const fs = require('fs');
const http = require('http');
const crypto = require('crypto');
const createSync = require('./sync');
const createAudit = require('./audit');
const createImporter = require('./jsonimport');
const createFlow = require('./workflow');
const { spawn } = require('child_process');

const TOP = 52;                       // ارتفاع شريط التبويبات
const FOOT = 28;                      // ارتفاع التذييل («إعداد المهندس سيف»)
/* نسخة الاطلاع (viewer.js): ملف تشغيل مستقل («anbarViewer» في package.json عند البناء) — الموقف المركز والموقف العام ومشاريع التخطيط وصور المشاريع للعرض فقط.
   لا أنظمة فيها ولا كلمات سر تفتحها، وكل قنوات الحفظ والاستيراد والنسخ والمزامنة تُرفض فيها. البرنامج الكامل لا يتأثر (VIEWER = false) */
const VIEWER = !!process.env.UNI_VIEWER || (() => { try { return !!require('./package.json').anbarViewer; } catch (_) { return false; } })();
/* نسخة اللجنة المركزية للمصادقة (zcremote.js): ملف تشغيل مستقل («anbarZc» في package.json عند البناء) — نافذة واحدة فيها تبويب اللجنة المركزية فقط،
   بكلمة سر خاصة بها، تتبادل الإحالات والقرارات مع حاسبة القسم عبر Google Drive ببريد القسم. البرنامج الكامل لا يتأثر (ZCAPP = false) */
const ZCAPP = !VIEWER && (!!process.env.UNI_ZCAPP || (() => { try { return !!require('./package.json').anbarZc; } catch (_) { return false; } })());
if (VIEWER) {
  const VWB = /^(reg:save|data:(save|saveSync|tomb|load|peek|openFolder)|report:data|pph:(save|del)|pl:(import|cmpOpen|cmpSave|clean|export)|pp:save|fin:unlock|finx:(use|choose|link|search)|xl:merge|comtpl:(choose|reset|save)|eng:rate|file:save|mapkey:set|earth:(write|pro|save)|jsonimp:|ad:(purgeLegacy|accessImport)|co:accessImport|auth:(change|reset|master)|mgr:numUnlock|bk:|xb:(set|run|pick)|upd:(fetch|apply)|sync:(set|now|discover|mode)|mr:|arch:|wf:(move|add|remove|unlock|annPublish|annHide|set|web)|gd:|mail:|guide:(add|docx|del)|audit:openDir|ac:)/;
  const h0 = ipcMain.handle.bind(ipcMain), o0 = ipcMain.on.bind(ipcMain);
  ipcMain.handle = (ch, fn) => h0(ch, VWB.test(ch) ? () => null : fn);
  ipcMain.on = (ch, fn) => o0(ch, VWB.test(ch) ? (e => { e.returnValue = null; }) : fn);
}
const PAGES = new Set(VIEWER ? ['home', 'sit', 'cc', 'pl'] : ['home', 'sit', 'cc', 'log', 'wf', 'pl', 'calc', 'guide']);   // guide: الدليل الاسترشادي (مفتوح)   // calc: حاسبة المدد (مفتوحة بلا كلمة سر)  // صفحات من الواجهة الرئيسية بلا نافذة نظام
const AC_PORT = +process.env.UNI_AC_PORT || 47831;
const MAX_BACKUPS = 15;
const APPS = {
  co: { title: 'أوامر التغيير', file: 'app/co.html', data: 'ChangeOrders-Data.json' },
  du: { title: 'المدد والتوقف', file: 'app/du.html', data: 'Durations-Data.json' },
  ad: { title: 'لجنة تدقيق السلف', file: 'app/ad.html', data: 'Advances-Data.json' },
  in: { title: 'إطلاق التأمينات', file: 'app/in.html', data: 'Insurance-Data.json' },
  ac: { title: 'الاستلام', url: `http://127.0.0.1:${AC_PORT}/`, data: 'AcceptanceFlow-Snapshot.json' },   // data: لقطة سجلات الشهادات للوحة سير المعاملات فقط (بيانات الاستلام نفسها في نظامه)
  lt: { title: 'المخاطبات والمطالعات', file: 'app/lt.html', data: 'Letters-Data.json' },
  fu: { title: 'مطالعات أوامر التغيير', file: 'app/fu.html', data: 'FollowUp-Data.json' },
  ar: { title: 'الأرشيف والتوزيع', file: 'app/ar.html', data: 'Archive-Data.json' },
  /* تقرير زيارة مشاريع التنفيذ أمانة (برنامج FieldVisitReport مدمجاً): التقارير تُحفظ وتُزامن، مع لوحة معلومات */
  fv: { title: 'تقرير زيارة مشاريع التنفيذ أمانة', file: 'app/fv.html', data: 'FieldVisit-Data.json' },
  /* التقارير الشهرية لدوائر المقيم: يملؤها المقيمون على هواتفهم (تطبيق Google Apps Script) ويصل منها اسم المشروع والشركة والقضاء وملف PDF؛
     تُجلب الى هنا وتُربط برقم الاضبارة من الموقف العام (رقم العقد ثم اسم المشروع). تُحفظ وتُزامن مع لوحة معلومات */
  mr: { title: 'التقارير الشهرية لدوائر المقيم', file: 'app/mr.html', data: 'MonthlyReports-Data.json' },
  /* اللجنة المركزية للمصادقة: برنامج المدد نفسه بوضع «المركزية» (?zc=1) بملف بيانات وكلمة سر مستقلين — تصله إحالات المدد (تجاوز 25%)
     ومقررها يصدر قرار المركزية ويعيده الى برنامج المدد لإصدار الأمر الإداري */
  zc: { title: 'اللجنة المركزية للمصادقة', file: 'app/du.html', query: { zc: '1' }, data: 'CentralCommittee-Data.json' },
  /* مطالعات اللجنة داخل المدد وداخل أوامر التغيير: محرر مطالعة المخاطبات نفسه (app/lt.html بوضع اللجنة) بملف بيانات مستقل،
     ويُفتح بكلمة سر اللجنة الأم (parent) لا بكلمة سر مستقلة */
  dm: { title: 'مطالعات لجنة المدد', file: 'app/lt.html', query: { ltm: 'dm' }, data: 'DurationsMemos-Data.json', parent: 'du' },
  cm: { title: 'مطالعات لجنة أوامر التغيير', file: 'app/lt.html', query: { ltm: 'cm' }, data: 'ChangeOrderMemos-Data.json', parent: 'co' }
};
const AUTHID = id => (APPS[id] && APPS[id].parent) || id;   // مطالعات اللجنة تتبع قفل اللجنة الأم
let win = null, dataDir = null, current = 'home', acProc = null, acStarting = Promise.resolve();
/* حقول التاريخ في كل الأنظمة تُعرض يوم/شهر/سنة (لغة واجهة المتصفح الداخلي en-GB بدل إعداد ويندوز الأمريكي شهر/يوم/سنة) */
app.commandLine.appendSwitch('lang', 'en-GB');
if (process.env.UNI_FAKE_CAM) { app.commandLine.appendSwitch('use-fake-device-for-media-stream'); app.commandLine.appendSwitch('use-fake-ui-for-media-stream'); }
/* سجل التعديلات: اسم المعدِّل + صورة من كاميرا الحاسبة (تُلتقط في الواجهة الرئيسية ثم تُطفأ الكاميرا فوراً) */
const CAPTURE_JS = `(async()=>{let s=null;try{s=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:640},height:{ideal:480}},audio:false});const v=document.createElement('video');v.muted=true;v.playsInline=true;v.srcObject=s;await v.play();await new Promise(r=>setTimeout(r,900));const c=document.createElement('canvas');c.width=v.videoWidth||640;c.height=v.videoHeight||480;c.getContext('2d').drawImage(v,0,0,c.width,c.height);return c.toDataURL('image/jpeg',0.72);}catch(e){return 'ERR:'+((e&&e.name)==='NotFoundError'?'لا توجد كاميرا في هذه الحاسبة':(e&&e.name)==='NotAllowedError'?'رُفض الوصول إلى الكاميرا':(e&&e.name)==='NotReadableError'?'الكاميرا مشغولة ببرنامج آخر':'تعذّر تشغيل الكاميرا');}finally{if(s)s.getTracks().forEach(t=>t.stop());}})()`;
const audit = createAudit({
  dir: () => dataDir,
  capture: async () => (win && !win.isDestroyed() ? win.webContents.executeJavaScript(CAPTURE_JS, true) : null),
  device: () => { try { return (sync && sync.getConfig && (sync.getConfig() || {}).name) || ''; } catch (_) { return ''; } },
  notify: info => { try { if (win && !win.isDestroyed()) win.webContents.send('audit:new', info); } catch (_) {} },
  ask: () => { try { if (win && !win.isDestroyed()) win.webContents.send('audit:ask'); } catch (_) {} }
});
const AUDITED = new Set(['co', 'du', 'ad']);
const auditSave = (id, oldText, text) => { if (AUDITED.has(id)) audit.record(id, oldText, text).catch(() => {}); };
let sync = null;
const AC_TOKEN = crypto.randomBytes(16).toString('hex');
const views = {};
// أخطاء الجافا سكريبت في كل النوافذ تُجمع هنا (تقرؤها الاختبارات، وتُكتب في ملف سجل لتسهيل التشخيص)
const uniErrors = (global.__uniErrors = []);
function logError(src, msg) {
  const line = `${new Date().toISOString()} [${src}] ${msg}`;
  uniErrors.push(line); if (uniErrors.length > 200) uniErrors.shift();
  try { if (dataDir) fs.appendFileSync(path.join(dataDir, 'errors.log'), line + '\n'); } catch (_) {}
}
function watch(wc, name) {
  wc.on('console-message', (_e, level, message, line, sourceId) => { if (level >= 3) logError(name, `${message} (${String(sourceId).split('/').pop()}:${line})`); });
  wc.on('preload-error', (_e, p, err) => logError(name, 'preload: ' + (err && err.message || err)));
  wc.on('render-process-gone', (_e, d) => logError(name, 'render-process-gone: ' + d.reason));
}

/* ---------------- المجلدات والملفات ---------------- */
function writable(dir) {
  try { fs.mkdirSync(dir, { recursive: true }); const t = path.join(dir, '.w' + process.pid); fs.writeFileSync(t, '1'); fs.unlinkSync(t); return true; }
  catch (_) { return false; }
}
const DATA_NAME = VIEWER ? 'بيانات-نسخة-الاطلاع' : ZCAPP ? 'بيانات-اللجنة-المركزية' : 'بيانات-النظام-الموحد';
function resolveDataDir() {
  const cands = [];
  if (process.env.UNI_DATA_DIR) cands.push(process.env.UNI_DATA_DIR);
  if (process.env.PORTABLE_EXECUTABLE_DIR) cands.push(path.join(process.env.PORTABLE_EXECUTABLE_DIR, DATA_NAME));
  if (app.isPackaged) cands.push(path.join(path.dirname(app.getPath('exe')), DATA_NAME));
  cands.push(path.join(app.getPath('userData'), 'data'));
  for (const d of cands) if (writable(d)) return d;
  return app.getPath('userData');
}
const EXTRA_DATA = { wf: 'Workflow-Data.json', pl: 'Planning-Data.json', wfa: 'Workflow-Attachments.json' };   // wfa: مرفقات التبليغات (صور / PDF)   // pl: مشاريع التخطيط (ملف لجنة تحديث الخطة)   // ملفات بيانات بلا نافذة نظام (لوحة سير المعاملات)
const dataFile = id => path.join(dataDir, APPS[id] ? APPS[id].data : EXTRA_DATA[id]);
function atomicWrite(file, text) {
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, text, 'utf8');
  try { if (fs.existsSync(file)) fs.copyFileSync(file, file + '.bak'); } catch (_) {}
  fs.renameSync(tmp, file);
}
/* النسخة اليومية الداخلية: ملف واحد لكل الأنظمة في اليوم («backups/نسخة-الشؤون-الهندسية_<التاريخ>.zip»، آخر 15 يوماً) — backupset.js.
   تُعمل بعد التشغيل بدقيقة (لا تؤخر فتح البرنامج)، وتُحدَّث كل ساعتين إن تغيّرت البيانات، فتحمل آخر عمل اليوم */
let bs = null, bsLast = 0;
const ACR_FILE = () => path.join(dataDir, 'Acceptance-Records.json');   // نسخة من سجلات شهادات الاستلام (تُخزَّن في نافذة الاستلام نفسها)
const bsEnsure = () => { if (!bs) bs = require('./backupset')({ dataDir: () => dataDir, version: APP_VER(), keep: MAX_BACKUPS, device: () => deviceName(),
  file: ds => ds === 'acr' ? ACR_FILE() : (APPS[ds] || EXTRA_DATA[ds]) ? dataFile(ds) : null, regFile: () => regFile(), archDir: () => archDir(), photoDir: () => path.join(dataDir, 'صور-المشاريع'), planDir: () => path.join(dataDir, 'planning'),
  extDirs: () => { try { const st = xbEnsure().state(); const d = st.folder ? path.join(st.folder, 'يومي') : ''; return d && fs.existsSync(d) ? [d] : []; } catch (_) { return []; } },
  write: (f, t) => atomicWrite(f, t) }); return bs; };
function dailyBackup() {
  const run = force => bsEnsure().daily(force).then(() => { bsLast = Date.now(); }).catch(e => logError('backup', String(e && e.message || e)));
  setTimeout(() => run(false), +process.env.UNI_BK_FIRST_MS || 60000);
  setInterval(() => { try { const z = path.join(dataDir, 'backups', bsEnsure().PREFIX + new Date().toISOString().slice(0, 10) + '.zip'); const zt = fs.existsSync(z) ? fs.statSync(z).mtimeMs : 0;
    const changed = Object.keys(APPS).concat(Object.keys(EXTRA_DATA)).some(id => { try { return fs.statSync(dataFile(id)).mtimeMs > zt; } catch (_) { return false; } }); if (changed) run(true); } catch (_) {} }, 2 * 3600 * 1000);
}
// أول تشغيل: إن وُجد ملف بيانات قديم للنظام المستقل بجانب البرنامج أو في «المستندات» يُنسخ إلى مجلد البيانات الموحد
function legacyCandidates(id) {
  const dirs = [];
  for (const d of [process.env.PORTABLE_EXECUTABLE_DIR, app.isPackaged && path.dirname(app.getPath('exe'))].filter(Boolean)) dirs.push(d, path.dirname(d));
  const out = [];
  if (id === 'co') dirs.forEach(d => out.push(path.join(d, 'بيانات-أوامر-التغيير', 'ChangeOrders-Data.json')));
  if (id === 'du') {
    dirs.forEach(d => out.push(path.join(d, 'بيانات-نظام-المدد', 'Durations-Data.json')));
    try { out.push(path.join(app.getPath('documents'), 'بيانات نظام المدد والتوقف', 'Durations-Data.json')); } catch (_) {}
  }
  if (id === 'ad') dirs.forEach(d => out.push(path.join(d, 'بيانات-لجنة-السلف', 'Advances-Data.json')));
  // برنامجا المخاطبات ومطالعة المتابعة المستقلان: بجانب البرنامج، أو في بيانات المستخدم في ويندوز
  const appData = (() => { try { return app.getPath('appData'); } catch (_) { return ''; } })();
  if (id === 'lt') { dirs.forEach(d => out.push(path.join(d, 'بيانات-المخاطبات', 'Letters-Data.json'))); if (appData) for (const n of ['المخاطبات والمطالعات', 'anbar-letters', 'AnbarLetters']) out.push(path.join(appData, n, 'data', 'Letters-Data.json')); }
  if (id === 'fu') { dirs.forEach(d => out.push(path.join(d, 'بيانات-مطالعة-المتابعة', 'FollowUp-Data.json'))); if (appData) for (const n of ['مطالعة لجنة المتابعة', 'anbar-followup', 'AnbarFollowUp']) out.push(path.join(appData, n, 'data', 'FollowUp-Data.json')); }
  return out;
}
function readData(id) {
  const f = dataFile(id);
  for (const p of [f, f + '.bak']) {
    try { if (fs.existsSync(p)) { const t = fs.readFileSync(p, 'utf8'); JSON.parse(t); return t; } } catch (_) {}
  }
  for (const p of legacyCandidates(id)) {
    try { if (fs.existsSync(p)) { const t = fs.readFileSync(p, 'utf8'); JSON.parse(t); atomicWrite(f, t); return t; } } catch (_) {}
  }
  return null;
}
// سجل المشاريع المشترك (الموقف الشهري): %LOCALAPPDATA%\AnbarProjects\registry.json (نفس ملف الأنظمة المستقلة)
function regFile() {
  if (VIEWER) return path.join(dataDir, 'سجل-المشاريع.json');   // نسخة الاطلاع: سجلها الخاص (لا تمس سجل البرنامج الكامل إن كان على الحاسبة نفسها)
  const dir = process.env.ANBAR_REG_DIR || path.join(process.env.LOCALAPPDATA || path.join(require('os').homedir(), '.local', 'share'), 'AnbarProjects');
  return path.join(dir, 'registry.json');
}


/* ---------------- كلمات السر (لكل نظام كلمة) ---------------- */
// تُحفظ بصيغة هاش مملّح لا كنص صريح. (القيم الافتراضية لا تُكتب هنا — غيّرها من «🔑 تغيير كلمة السر».)
const SALT = 'AnbarEng.v1';
const hashPw = (id, pw) => crypto.createHash('sha256').update(`${SALT}:${id}:${pw}`).digest('hex');
const DEFAULT_AUTH = { ad: 'bed5a885897e6e256caa8f1299440d68fb40a89b35b20fbc2bd2f3862f96d6b2', co: '73fb5acec9790b71012b681239de71abd1e719887e3a027a8ff459765a4d3f0f', du: 'a5f1c4b02c38ebe0e7a6f882d3bc0e3b022ca533e1b4798060588a246193ccfe', ac: '8b2085222a21b0af1e1bc0bb83cedcf16f1731fb70c3148fa42683946d7130a0', in: '835bc809ffde5cc8c27a6ccb092de71b8ad2c424429f4d7335c0ff69d3576d54' };
const IDLE_LOCK_MS = +process.env.UNI_IDLE_LOCK_MS || 20 * 60 * 1000;   // قفل تلقائي بعد 20 دقيقة بلا نشاط (UNI_IDLE_LOCK_MS للاختبار فقط)
const unlocked = new Set();
let lastActivity = Date.now(), failed = {}, authCache = null;
const authFile = () => path.join(dataDir, 'auth.json');
function authTable() {
  if (authCache) return authCache;
  let o = { ...DEFAULT_AUTH };
  try { const j = JSON.parse(fs.readFileSync(authFile(), 'utf8')); for (const k of Object.keys(j)) { if (k === 'master') continue; if (j[k] === null) delete o[k]; else if (typeof j[k] === 'string') o[k] = j[k]; } } catch (_) {}
  return (authCache = o);
}
const needsAuth = id => AUTHID(id) === 'zc' || !!authTable()[AUTHID(id)];   // zc: محمي دائماً (كلمة سر المدير حتى تُعيَّن له كلمة خاصة)
const isOpen = id => !needsAuth(id) || unlocked.has(AUTHID(id));
function saveAuthOverride(id, hash) {
  let j = {}; try { j = JSON.parse(fs.readFileSync(authFile(), 'utf8')); } catch (_) {}
  j[id] = hash; atomicWrite(authFile(), JSON.stringify(j)); authCache = null;
}
function checkPw(id, pw) {
  id = AUTHID(id);
  if (!needsAuth(id)) return true;
  const f = failed[id] || { n: 0, until: 0 };
  if (Date.now() < f.until) return 'wait';
  if (id === 'zc' && !authTable().zc) { const m = checkMaster(pw); if (m === true) { unlocked.add(id); return true; } return m; }
  const ok = hashPw(id, String(pw == null ? '' : pw)) === authTable()[id];
  if (ok) { failed[id] = { n: 0, until: 0 }; unlocked.add(id); return true; }
  f.n++; if (f.n >= 5) { f.until = Date.now() + 30000; f.n = 0; } failed[id] = f; return false;
}
function lockAll() { unlocked.clear(); audit.clearWho(); finOpen = false; numOpen = false; try { if (views.lt) views.lt.webContents.executeJavaScript('window.__numRelock&&window.__numRelock()').catch(() => {}); } catch (_) {} try { sendFin(); } catch (_) {} if (!PAGES.has(current) && needsAuth(current)) go('home'); else sendState(); }
function sendState() { if (win && !win.isDestroyed()) win.webContents.send('nav:state', { current, locked: Object.keys(APPS).filter(i => !APPS[i].parent && needsAuth(i) && !unlocked.has(i)) }); }
const touchActivity = () => { lastActivity = Date.now(); };
setInterval(() => { if (unlocked.size && Date.now() - lastActivity > IDLE_LOCK_MS) lockAll(); }, Math.min(30000, Math.max(500, IDLE_LOCK_MS / 4)));
ipcMain.handle('auth:check', (_e, id, pw) => { if (!APPS[id]) return false; const r = checkPw(id, pw); sendState(); return r; });
ipcMain.handle('auth:lock', () => { lockAll(); return true; });
ipcMain.on('ui:activity', () => touchActivity());
ipcMain.handle('auth:change', (_e, id, oldPw, newPw) => {
  id = AUTHID(id);
  if (!APPS[id]) return 'bad';
  const r = needsAuth(id) ? checkPw(id, oldPw) : true;
  if (r === 'wait') return 'wait';
  if (r !== true) return 'wrong';
  saveAuthOverride(id, newPw ? hashPw(id, String(newPw)) : null);
  if (!newPw) unlocked.delete(id); sendState(); return 'ok';
});
/* كلمة سر المدير: تسترجع كلمة سر أي نظام (تعيدها إلى الافتراضية أو إلى كلمة جديدة) دون الرجوع إلى من وضعها.
   الافتراضية تُغيَّر — تُغيَّر من «🔑 تغيير كلمة السر» ← «كلمة سر المدير». تُحفظ هاشاً مملّحاً في auth.json مثل غيرها */
const DEFAULT_MASTER = '9b38cf30da09fdd2faa15f1ffe2c7def5f63b2c6cf74b9eb37ca90e2f1d38ebc';
function masterHash() { try { const j = JSON.parse(fs.readFileSync(authFile(), 'utf8')); if (typeof j.master === 'string') return j.master; } catch (_) {} return DEFAULT_MASTER; }
function checkMaster(pw) { const f = failed.master || { n: 0, until: 0 }; if (Date.now() < f.until) return 'wait';
  if (hashPw('master', String(pw == null ? '' : pw)) === masterHash()) { failed.master = { n: 0, until: 0 }; return true; }
  f.n++; if (f.n >= 5) { f.until = Date.now() + 60000; f.n = 0; } failed.master = f; return false; }
function resetAuth(id) { let j = {}; try { j = JSON.parse(fs.readFileSync(authFile(), 'utf8')); } catch (_) {} delete j[id]; atomicWrite(authFile(), JSON.stringify(j)); authCache = null; }
ipcMain.handle('auth:reset', (_e, id, masterPw, newPw) => {
  id = AUTHID(id);
  if (!APPS[id]) return 'bad'; const r = checkMaster(masterPw); if (r !== true) return r === 'wait' ? 'wait' : 'wrong';
  if (newPw) saveAuthOverride(id, hashPw(id, String(newPw))); else resetAuth(id);
  unlocked.delete(id); audit.note(id, 'pwreset', newPw ? 'استرجاع كلمة السر بكلمة سر المدير (كلمة جديدة)' : 'استرجاع كلمة السر بكلمة سر المدير (أُعيدت الافتراضية)').catch(() => {});
  sendState(); return 'ok'; });
ipcMain.handle('auth:master', (_e, oldPw, newPw) => { const r = checkMaster(oldPw); if (r !== true) return r === 'wait' ? 'wait' : 'wrong'; if (!newPw || String(newPw).length < 6) return 'short';
  let j = {}; try { j = JSON.parse(fs.readFileSync(authFile(), 'utf8')); } catch (_) {} j.master = hashPw('master', String(newPw)); atomicWrite(authFile(), JSON.stringify(j)); authCache = null; return 'ok'; });
/* المبالغ المالية في الموقف العام (كلفة العقود، أوامر التغيير، السلف المرفوعة والمصروفة والمتبقي): مخفية حتى تُكتب كلمة سر المدير،
   وتُغلق مع «قفل الكل» والقفل التلقائي. على حاسبة مدير القسم يمكن جعلها ظاهرة دائماً (يتطلب كلمة سر المدير لتفعيله وإلغائه) */
let finOpen = false;
/* المخاطبات: حقلا العدد والتاريخ مقفلان، ويُفتحان بكلمة سر مدير القسم حتى «قفل الكل» أو القفل التلقائي */
let numOpen = false;
ipcMain.on('mgr:numState', e => { e.returnValue = numOpen; });
ipcMain.handle('mgr:numUnlock', (e, pw) => { if (!views.lt || e.sender !== views.lt.webContents) return 'bad'; const r = checkMaster(pw); if (r !== true) return r === 'wait' ? 'wait' : 'wrong';
  numOpen = true; audit.note('lt', 'numunlock', 'فتح حقلي العدد والتاريخ في المخاطبات بكلمة سر المدير').catch(() => {}); return 'ok'; });
const prefsFile = () => path.join(dataDir, 'prefs.json');
const prefs = () => { try { return JSON.parse(fs.readFileSync(prefsFile(), 'utf8')) || {}; } catch (_) { return {}; } };
const finVisible = () => VIEWER || finOpen || !!prefs().finAlways;   // نسخة الاطلاع: المبالغ ظاهرة (لا كلمة سر مدير فيها)
const sendFin = () => { try { if (win && !win.isDestroyed()) win.webContents.send('fin:state', { visible: finVisible(), always: !!prefs().finAlways }); } catch (_) {} };
ipcMain.on('fin:state', e => { e.returnValue = { visible: finVisible(), always: !!prefs().finAlways }; });
ipcMain.handle('fin:unlock', (_e, pw, always) => { const r = checkMaster(pw); if (r !== true) return r === 'wait' ? 'wait' : 'wrong';
  if (always != null) { const p = prefs(); p.finAlways = !!always; atomicWrite(prefsFile(), JSON.stringify(p)); } finOpen = true;
  audit.note('', 'finview', always === true ? 'إظهار المبالغ المالية دائماً على هذه الحاسبة' : always === false ? 'إلغاء إظهار المبالغ المالية دائماً' : 'إظهار المبالغ المالية بكلمة سر المدير').catch(() => {}); sendFin(); return 'ok'; });
ipcMain.handle('fin:hide', () => { finOpen = false; sendFin(); return true; });
/* تقييم المهندسين المقيمين والمشرفين (1–5): على حاسبة مدير القسم فقط — يُقرأ ويُعدَّل حين تكون المبالغ ظاهرة (كلمة سر المدير أو «دائماً على هذه الحاسبة»)،
   ويُحفظ في ملف محلي لا يُزامَن (لا يصل إلى حاسبات اللجان)، ولا يُكتب في سجل التعديلات. أقل من 3 = «لا يكلّف». */
const ratingsFile = () => path.join(dataDir, 'engineer-ratings.json');
const ratingsRead = () => { try { const o = JSON.parse(fs.readFileSync(ratingsFile(), 'utf8')); return o && typeof o === 'object' && o.r ? o.r : {}; } catch (_) { return {}; } };
ipcMain.on('eng:ratings', e => { e.returnValue = finVisible() ? ratingsRead() : null; });
ipcMain.handle('eng:rate', (_e, key, name, val) => {
  if (!finVisible()) return 'locked'; key = String(key || '').slice(0, 200); if (!key) return 'bad'; const v = Math.round(+val);
  const R = ratingsRead(); if (!(v >= 1 && v <= 5)) delete R[key]; else R[key] = { v, name: String(name || '').slice(0, 200), at: new Date().toISOString().slice(0, 10) };
  fs.mkdirSync(dataDir, { recursive: true }); atomicWrite(ratingsFile(), JSON.stringify({ app: 'anbar-eng-ratings', version: 1, r: R })); return 'ok';
});
/* ---------------- استيراد شامل لملفات JSON من الحاسبة ---------------- */
const importer = createImporter({
  dataDir: () => dataDir, readData: id => readData(id), writeData: (id, t) => { atomicWrite(dataFile(id), t); if (sync) sync.changed(); }, applied: ds => appliedHook(ds),
  isTomb: (ds, id) => { try { return !!(sync && sync.isTomb && sync.isTomb(ds, id)); } catch (_) { return false; } },
  dirs: () => { const L = [], add = (dir, depth) => { if (dir) L.push({ dir, depth }); }, gp = n => { try { return app.getPath(n); } catch (_) { return ''; } };
    add(gp('desktop'), 3); add(gp('documents'), 3); add(gp('downloads'), 2);
    for (const d of [process.env.PORTABLE_EXECUTABLE_DIR, app.isPackaged && path.dirname(app.getPath('exe'))].filter(Boolean)) { add(d, 2); add(path.dirname(d), 1); }
    for (const id of ['co', 'du', 'ad', 'lt', 'fu']) for (const f of legacyCandidates(id)) add(path.dirname(f), 0);
    return L; }
});
ipcMain.handle('jsonimp:scan', (_e, dirs) => { try { return importer.scan(dirs); } catch (e) { return { error: String(e && e.message || e) }; } });
ipcMain.handle('jsonimp:pick', async (_e, kind) => { const r = await dialog.showOpenDialog(win, kind === 'files' ? { title: 'اختر ملفات JSON', properties: ['openFile', 'multiSelections'], filters: [{ name: 'JSON', extensions: ['json'] }] } : { title: 'اختر مجلداً للبحث فيه عن ملفات JSON', properties: ['openDirectory'] });
  if (r.canceled || !r.filePaths.length) return null; return importer.scan(r.filePaths.map(dir => ({ dir, depth: 6 }))); });
ipcMain.handle('jsonimp:apply', (_e, files) => { if (!Array.isArray(files)) return {}; files = files.filter(f => typeof f === 'string').slice(0, 5000); try { const res = importer.apply(files); for (const ds of Object.keys(res)) audit.note(ds, 'import', `استيراد ملفات JSON: أُضيف ${res[ds].added} وحُدّث ${res[ds].replaced}`).catch(() => {}); return res; } catch (e) { return { error: String(e && e.message || e) }; } });
/* أول تشغيل لإصدار جديد: بحث تلقائي في الخلفية، وإن وُجدت سجلات غير موجودة في البرنامج تُعرض نافذة الاستيراد (مرة لكل إصدار) */
function autoJsonScan() {
  if ((process.env.UNI_MULTI && !process.env.UNI_FORCE_JSONSCAN) || process.env.UNI_NO_JSONSCAN || prefs().jsonScanVer === app.getVersion()) return;
  setTimeout(() => { let L = []; try { L = importer.scan(); } catch (_) {} const p = prefs(); p.jsonScanVer = app.getVersion(); try { atomicWrite(prefsFile(), JSON.stringify(p)); } catch (_) {}
    if (L.some(x => x.fresh || x.newer) && win && !win.isDestroyed()) win.webContents.send('jsonimp:found', L); }, +process.env.UNI_JSONSCAN_DELAY || 4000);
}
ipcMain.handle('audit:login', (_e, sys) => audit.note(String(sys || ''), 'login', sys ? 'دخول إلى النظام' : 'تغيير اسم المعدِّل').then(() => true).catch(() => false));
ipcMain.on('auth:info', e => { e.returnValue = Object.keys(APPS).filter(id => !APPS[id].parent).map(id => ({ id, title: APPS[id].title, locked: needsAuth(id), open: isOpen(id) })); });

/* ---------------- سجل التعديلات ---------------- */
ipcMain.handle('audit:setWho', (_e, name) => audit.setWho(name));
/* ملاحظة في سجل التعديلات من الواجهة (لعمليات محددة فقط) */
ipcMain.handle('audit:note', (_e, sys, op, label) => { if (!/^(sit|pl)$/.test(String(sys)) || !/^[a-z]{2,12}$/.test(String(op))) return false; return audit.note(String(sys), String(op), String(label || '').slice(0, 400)).then(() => true).catch(() => false); });
ipcMain.on('audit:who', e => { e.returnValue = audit.who(); });
ipcMain.on('audit:names', e => { e.returnValue = audit.names(); });
ipcMain.handle('audit:list', () => audit.list());
ipcMain.handle('audit:photo', (_e, rel) => audit.photoData(rel));
ipcMain.handle('audit:openDir', () => { fs.mkdirSync(audit.dir(), { recursive: true }); shell.openPath(audit.dir()); return true; });
// الاستلام يحفظ في صفحاته (localStorage): تُقرأ سجلاته كل بضع ثوانٍ ما دام مفتوحاً (وبعد مغادرته بقليل) وتُقارن بالقراءة السابقة
const AC_KEYS_JS = "JSON.stringify({pac:localStorage.getItem('pac_records_v1'),pap:localStorage.getItem('pap_records_v1'),fac:localStorage.getItem('fac_records_v1'),fpa:localStorage.getItem('fpa_records_v1')})";
let acSnap = null, acLeft = 0, acBusy = false;
setInterval(async () => {
  if (current === 'ac') acLeft = Date.now();
  if (acBusy || !views.ac || Date.now() - acLeft > 30000) return;
  acBusy = true;
  try { const t = await views.ac.webContents.executeJavaScript(AC_KEYS_JS, true); if (acSnap != null && t !== acSnap) await audit.record('ac', acSnap, t); acSnap = t; } catch (_) {} finally { acBusy = false; }
}, +process.env.UNI_AC_POLL_MS || 4000);

/* ---------------- IPC ---------------- */
const okId = id => ['co', 'du', 'ad', 'in', 'lt', 'fu', 'ar', 'dm', 'cm', 'fv', 'mr', 'zc'].includes(id);
ipcMain.on('data:load', (e, id) => { e.returnValue = okId(id) ? readData(id) : null; });
ipcMain.on('data:path', (e, id) => { e.returnValue = okId(id) ? dataFile(id) : ''; });
ipcMain.on('data:dir', e => { e.returnValue = dataDir; });
/* الحفظ التلقائي (بعد كل توقف قصير في الكتابة): كان كله متزامناً في العملية الرئيسية — قراءة الملف القديم وكتابة الجديد ونسخة .bak
   والتحقق والمقارنة لسجل التعديلات — فتتوقف الكتابة في كل الأنظمة نصف ثانية إلى ثوانٍ مع ملفات الأرشيف الكبيرة (السلف ~8 م.ب).
   الآن: كتابة غير متزامنة لا توقف الواجهة، والحفظات المتتالية للنظام نفسه تُدمج (يُكتب الأحدث فقط)، والمقارنة في خيط عامل (audit.js).
   كل كتابة لها رقم جيل؛ إن سبقها حفظ أحدث (ومنه الحفظ المتزامن عند الإغلاق) لا تحل محله. */
const looksJson = t => typeof t === 'string' && /^\s*[{[]/.test(t) && /[}\]]\s*$/.test(t);
const SAVEQ = {};
const saveGen = id => { const q = SAVEQ[id] = SAVEQ[id] || { gen: 0, busy: false, next: null }; return q; };
function saveAsync(id, text) {
  const q = saveGen(id); q.next = text; ++q.gen;
  if (q.busy) return new Promise(res => { (q.waiters = q.waiters || []).push(res); });
  q.busy = true;
  return (async () => {
    let ok = true;
    while (q.next != null) {
      const t = q.next, g = q.gen; q.next = null;
      try {
        const f = dataFile(id), tmp = f + '.tmpa';
        const old = AUDITED.has(id) ? await fs.promises.readFile(f, 'utf8').catch(() => null) : null;
        await fs.promises.writeFile(tmp, t, 'utf8');
        await fs.promises.copyFile(f, f + '.bak').catch(() => {});
        if (q.syncAfter && q.syncAfter >= g) {   // كتب حفظ الإغلاق المتزامن نسخة أحدث
          fs.promises.unlink(tmp).catch(() => {}); continue; }
        fs.renameSync(tmp, f);
        auditSave(id, old, t); if (sync) sync.changed(); flowSoon(id);
      } catch (_) { ok = false; }
    }
    q.busy = false; const W = q.waiters || []; q.waiters = []; W.forEach(r => r(ok));
    return ok;
  })();
}
/* بعد استرجاع نسخة احتياطية: صفحة النظام المفتوحة تحمل البيانات القديمة في ذاكرتها — يُتجاهل حفظها لثوانٍ حتى تُعاد بالبيانات المسترجعة */
const bkHold = {}; const held = id => (bkHold[id] || 0) > Date.now();
ipcMain.handle('data:save', (_e, id, text) => { try { if (!okId(id) || !looksJson(text)) return false; if (held(id)) return true; return saveAsync(id, text); } catch (_) { return false; } });
/* لجنة السلف: إزالة ملفات الأرشيف القديم المستوردة (معرّفاتها oldadv…) دفعة واحدة — شاهد حذف لكل ملف (يُحذف من كل الحاسبات بالمزامنة)،
   وقيد واحد في سجل التعديلات بدل قيد لكل ملف. الاستمارات المُدخلة في البرنامج لا تُمس. */
ipcMain.handle('ad:purgeLegacy', e => {
  try { if (!views.ad || e.sender !== views.ad.webContents) return { error: 'غير مسموح' };
    const o = JSON.parse(readData('ad') || '{}'), L = Array.isArray(o.records) ? o.records : [], isOld = r => r && /^oldadv/.test(String(r.id || ''));
    const gone = L.filter(isOld); if (!gone.length) return { removed: 0 };
    const q = saveGen('ad'); q.next = null; q.syncAfter = ++q.gen;   // لا تكتب فوقها حفظة أقدم معلّقة
    o.records = L.filter(r => !isOld(r)); atomicWrite(dataFile('ad'), JSON.stringify(o));
    const now = Date.now(); if (sync) { try { if (sync.tombMany) sync.tombMany('ad', gone.map(r => String(r.id)), now); else gone.forEach(r => sync.tomb('ad', String(r.id), now)); } catch (_) {} sync.changed(); }
    audit.note('ad', 'del', `إزالة سلف الأرشيف القديم المستورد: ${gone.length} ملف مشروع (${gone.reduce((a, r) => a + ((r.advances || []).length), 0)} سلفة)`).catch(() => {});
    return { removed: gone.length };
  } catch (err) { return { error: String(err && err.message || err) }; }
});
/* لجنة السلف: استيراد ملف Access مباشرة (accdb / mdb) — يُقرأ بمكتبة مدمجة ويُحوَّل بقواعد تحويل الأرشيف القديم نفسها (old-advances-convert.js)،
   ويُعاد للواجهة لتعرض الملخص وتدمج بلا تكرار. تقرير التدقيق يُحفظ في «تقارير-استيراد-Access» بمجلد البيانات. */
/* استيراد أرشيف البرامج القديمة (Access أو Excel مصدَّر منه) مباشرة: لجنة السلف (tblProjects) وأوامر التغيير (Table1) — يُقرأ بمكتبة مدمجة
   ويُحوَّل بقواعد تحويل الأرشيف نفسها (old-advances-convert / old-co-convert)، ويُعاد للواجهة لتعرض الملخص وتدمج بلا تكرار. */
const IMPORT_KINDS = {
  ad: { title: 'اختر ملف Access أو Excel للجنة السلف', what: 'جدول السلف', xlNeed: o => o.Cumulative != null || o['التراكمي'] != null, xlErr: 'ملف Excel هذا ليس جدول السلف القديم (لا يوجد فيه عمود التراكمي / Cumulative).',
    convert: rows => require('./old-advances-convert').convertAdvances(rows), source: 'أرشيف لجنة تدقيق السلف القديم', count: S => `${S.advances} سلفة في ${S.records} ملفاً` },
  co: { title: 'اختر ملف Access أو Excel لأوامر التغيير القديمة', what: 'جدول أوامر التغيير', xlNeed: o => o.PRO != null || o.contcost != null, xlErr: 'ملف Excel هذا ليس جدول أوامر التغيير القديم (لا يوجد فيه العمودان PRO و contcost).',
    convert: rows => require('./old-co-convert').convertCO(rows), source: 'برنامج أوامر التغيير القديم (Table1)', count: S => `${S.orders} أمر تغيير في ${S.records} ملفاً` } };
async function accessImport(kind, e) {
  const K = IMPORT_KINDS[kind];
  try { if (!K || !views[kind] || e.sender !== views[kind].webContents) return { error: 'غير مسموح' };
    let file = process.env.UNI_TEST_ACCESS_FILE || '';
    if (!file) { const r = await dialog.showOpenDialog(win, { title: K.title, properties: ['openFile'], filters: [{ name: 'Access أو Excel مصدَّر من ' + K.what, extensions: ['accdb', 'mdb', 'xlsx', 'xlsm'] }] }); if (r.canceled || !r.filePaths.length) return null; file = r.filePaths[0]; }
    const st = fs.statSync(file); if (st.size > 1024 * 1024 * 1024) return { error: 'الملف أكبر من 1 غيغابايت' };
    const { readAccess } = require('./accessread');
    let a;
    if (/\.xls[xm]$/i.test(file)) {   // الجدول مصدَّراً من Access إلى Excel (بأسماء الحقول، أو بعناوينها العربية للسلف)
      let rows = []; try { rows = require('./old-access-common').readRows(fs.readFileSync(file)); } catch (_) { return { error: 'تعذّر قراءة ملف Excel' }; }
      if (!rows.some(K.xlNeed)) return { error: K.xlErr };
      a = { table: 'Excel: ' + path.basename(file), rows };
    } else { a = readAccess(fs.readFileSync(file), { kind }); if (a.error) return a; }
    const c = K.convert(a.rows), now = Date.now();
    c.data.records.forEach((r, i) => { r.updated = now + i; r.legacy = { ...(r.legacy || {}), source: K.source + ' — استيراد ملف: ' + path.basename(file), accessFile: path.basename(file) }; });   // استيراد مقصود: أحدث من أي شاهد حذف سابق
    const dir = path.join(dataDir, 'تقارير-استيراد-Access'); fs.mkdirSync(dir, { recursive: true });
    const rep = path.join(dir, path.basename(file).replace(/\.[^.]+$/, '') + '-تقرير-التدقيق-' + new Date().toISOString().slice(0, 10) + '.txt'); fs.writeFileSync(rep, c.report);
    audit.note(kind, 'import', `قراءة ملف «${path.basename(file)}»: ${c.stats.rows} صفاً، ${K.count(c.stats)}`).catch(() => {});
    return { file: path.basename(file), table: a.table, stats: c.stats, records: c.data.records, report: rep };
  } catch (err) { return { error: 'تعذّر استيراد الملف: ' + String(err && err.message || err) }; }
}
ipcMain.handle('ad:accessImport', e => accessImport('ad', e));
/* الربط مع برنامج الشؤون المالية (قراءة فقط): البيانات، واختيار الملف، والربط اليدوي للمشاريع (يُحفظ على هذه الحاسبة) */
const finLink = require('./finlink')({ app, prefs });
ipcMain.handle('finx:get', () => { try { const r = finLink.read(); return Object.assign({}, r, { links: prefs().financeLinks || {} }); } catch (e) { return { ok: false, error: String(e && e.message || e), links: {} }; } });
/* بحث تلقائي عن ملف المالية إن لم يُعثر عليه، ومتابعة تغيّره (المزامنة معه تلقائياً: كل تعديل في برنامج المالية يظهر خلال ثوانٍ) */
let finSearching = null, finWatched = '';
const finNotify = () => { try { if (win && !win.isDestroyed()) win.webContents.send('sync:data', { ds: 'fin' }); } catch (_) {} };
function finWatch() { const f = finLink.locate(); if (!f || f === finWatched) return; try { if (finWatched) fs.unwatchFile(finWatched); } catch (_) {} finWatched = f; fs.watchFile(f, { interval: 5000 }, (a, b) => { if (a.mtimeMs !== b.mtimeMs) finNotify(); }); }
function finSearch(manual) {
  if (finSearching) return finSearching;
  finSearching = finLink.search((n, d) => { try { if (manual && win && !win.isDestroyed()) win.webContents.send('finx:progress', { n, d }); } catch (_) {} }).then(r => {
    const p = prefs(); p.finSearchAt = Date.now(); if (r.found[0]) { p.financeFile = r.found[0]; audit.note('sit', 'finfile', 'عُثر تلقائياً على ملف بيانات برنامج الشؤون المالية: ' + r.found[0]).catch(() => {}); }
    atomicWrite(prefsFile(), JSON.stringify(p)); finWatch(); if (r.found[0]) finNotify(); return r;
  }).finally(() => { finSearching = null; });
  return finSearching;
}
app.whenReady().then(() => setTimeout(() => { try { if (finLink.locate()) finWatch(); else if (!process.env.UNI_MULTI || process.env.UNI_FIN_SEARCH_ROOT) { const p = prefs(); if (!p.finSearchAt || Date.now() - p.finSearchAt > 864e5 || process.env.UNI_FIN_SEARCH_ROOT) finSearch(false); } } catch (_) {} }, +(process.env.UNI_FIN_SEARCH_DELAY || 20000)));
ipcMain.handle('finx:search', async () => { const r = await finSearch(true); return { found: r.found, dirs: r.dirs, file: finLink.locate() }; });
/* تصدير الموقف بنموذج اللجان: يُملأ ملف النموذج نفسه (templates/committee-template.xlsm، أو نموذج يختاره المستخدم) */
const comTplPath = () => { try { const p = prefs().committeeTemplate; if (p && fs.existsSync(p)) return p; } catch (_) {} return path.join(__dirname, 'templates', 'committee-template.xlsm'); };
ipcMain.handle('comtpl:info', () => { try { const f = comTplPath(); return Object.assign(require('./comtemplate').info(fs.readFileSync(f)), { file: path.basename(f), custom: f !== path.join(__dirname, 'templates', 'committee-template.xlsm') }); } catch (e) { return { error: String(e.message || e) }; } });
ipcMain.handle('comtpl:choose', async () => {
  const f = process.env.UNI_TEST_TPL_PICK || ((await dialog.showOpenDialog(win, { title: 'اختر ملف نموذج موقف اللجان (Excel)', filters: [{ name: 'Excel', extensions: ['xlsm', 'xlsx'] }], properties: ['openFile'] })).filePaths || [])[0];
  if (!f) return null; try { require('./comtemplate').info(fs.readFileSync(f)); } catch (e) { return { error: String(e.message || e) }; }
  const dst = path.join(dataDir, 'committee-template' + path.extname(f).toLowerCase()); fs.copyFileSync(f, dst);
  const p = prefs(); p.committeeTemplate = dst; atomicWrite(prefsFile(), JSON.stringify(p)); audit.note('sit', 'comtpl', 'اعتماد نموذج موقف اللجان: ' + path.basename(f)).catch(() => {}); return { ok: true, file: path.basename(f) };
});
ipcMain.handle('comtpl:reset', () => { try { const p = prefs(); delete p.committeeTemplate; atomicWrite(prefsFile(), JSON.stringify(p)); return true; } catch (e) { return { error: 'تعذّر الحفظ — تحقق من صلاحية الكتابة في مجلد بيانات البرنامج (' + String(e && e.message || e).slice(0, 120) + ')' }; } });
ipcMain.handle('comtpl:save', async (_e, books) => {
  try {
    const C = require('./comtemplate'), tpl = fs.readFileSync(comTplPath()), ext = path.extname(comTplPath()).toLowerCase() === '.xlsx' ? '.xlsx' : '.xlsm';
    const list = (Array.isArray(books) ? books : []).filter(b => b && b.data);
    if (!list.length) return { error: 'لا مشاريع للتصدير' };
    const nm = b => String(b.name || 'موقف').replace(/[\\/:*?"<>|]+/g, '-').replace(/\.(xlsx|xlsm)$/i, '') + ext;
    let dir = '', single = '';
    if (list.length === 1) { single = await askPath(nm(list[0])); if (!single) return null; }
    else { dir = process.env.UNI_TEST_SAVE_DIR || ((await dialog.showOpenDialog(win, { title: `اختر مجلداً لحفظ مواقف اللجان (${list.length} ملفاً)`, properties: ['openDirectory', 'createDirectory'] })).filePaths || [])[0]; if (!dir) return null; }
    const files = [];
    for (const b of list) { const out = single || path.join(dir, nm(b)); fs.writeFileSync(out, Buffer.from(C.fill(tpl, b.data))); files.push(out); }
    audit.note('sit', 'comexport', `تصدير الموقف بنموذج اللجان: ${files.length} ملف (${list.reduce((s, b) => s + ((b.data.rows || []).length), 0)} مشروعاً)`).catch(() => {});
    return { ok: true, files };
  } catch (e) { return { error: String(e.message || e) }; }
});
/* Google Earth: ملف KML حيّ لـ Google Earth Pro في مجلد البيانات، ونافذة Google Earth (الويب)، وحفظ KML */
const earthDir = () => path.join(dataDir, 'google-earth');
const earthItems = a => (Array.isArray(a) ? a : []).filter(i => i && isFinite(+i.lat) && isFinite(+i.lng)).slice(0, 20000);
ipcMain.handle('earth:status', () => { const E = require('./earth'); return { pro: !!E.proExe(), dir: earthDir(), linked: fs.existsSync(path.join(earthDir(), 'Google Earth - مشاريع الانبار (ربط مباشر).kml')) }; });
ipcMain.handle('earth:write', (_e, items) => { try { return Object.assign({ ok: true }, require('./earth').write(earthDir(), earthItems(items))); } catch (e) { return { error: String(e.message || e) }; } });
ipcMain.handle('earth:pro', async (_e, items, focus) => {
  try {
    const E = require('./earth'); const w = E.write(earthDir(), earthItems(items)); let target = w.link;
    if (focus && isFinite(+focus.lat) && isFinite(+focus.lng)) { target = path.join(earthDir(), 'اذهب-إلى-المشروع.kml'); fs.writeFileSync(target, E.kml([focus], focus.name || 'مشروع').replace('<range>3000</range>', '<range>1500</range>'), 'utf8'); }
    audit.note('sit', 'earth', 'فتح مشاريع الموقف في Google Earth Pro' + (focus ? ': ' + (focus.name || '') : ' (ربط مباشر)')).catch(() => {});
    if (process.env.UNI_TEST_EARTH_NOOPEN) return { ok: true, app: 'test', target, data: w.data };
    const exe = E.proExe();
    if (exe) { require('child_process').spawn(exe, [target], { detached: true, stdio: 'ignore' }).unref(); return { ok: true, app: 'pro', target }; }
    const r = await shell.openPath(target); return r ? { ok: false, app: 'none', target, error: r } : { ok: true, app: 'assoc', target };
  } catch (e) { return { error: String(e.message || e) }; }
});
let earthWin = null;
ipcMain.handle('earth:web', (_e, lat, lng, name) => {
  const ok = isFinite(+lat) && isFinite(+lng); const url = ok ? `https://earth.google.com/web/search/${(+lat).toFixed(6)},${(+lng).toFixed(6)}` : 'https://earth.google.com/web/@33.4,42.6,500a,450000d,35y,0h,0t,0r';
  if (process.env.UNI_TEST_EARTH_NOOPEN) return { ok: true, url };
  if (!earthWin || earthWin.isDestroyed()) {
    earthWin = new BrowserWindow({ width: 1280, height: 820, parent: win || undefined, title: 'Google Earth — مشاريع محافظة الانبار', autoHideMenuBar: true, webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true } });
    earthWin.webContents.setWindowOpenHandler(({ url: u }) => { if (/^https:\/\//.test(u)) shell.openExternal(u); return { action: 'deny' }; });
    earthWin.on('closed', () => { earthWin = null; });
  }
  earthWin.loadURL(url); earthWin.setTitle('Google Earth — ' + (name || 'مشاريع محافظة الانبار')); earthWin.show(); earthWin.focus();
  return { ok: true, url };
});
ipcMain.handle('earth:save', async (_e, items, name) => {
  try { const out = await askPath(String(name || 'مشاريع-الانبار') .replace(/[\\/:*?"<>|]+/g, '-') + '.kml'); if (!out) return null; fs.writeFileSync(out, require('./earth').kml(earthItems(items), 'مشاريع محافظة الانبار'), 'utf8'); return { ok: true, file: out }; }
  catch (e) { return { error: String(e.message || e) }; }
});
ipcMain.handle('earth:dir', () => { fs.mkdirSync(earthDir(), { recursive: true }); shell.openPath(earthDir()); return true; });
/* ملف «الموقف الشامل» (Excel) اختير من نافذة «استيراد ملف Excel من المالية»: يُربط مصدراً للمالية بمساره (بعد التحقق من أنه ملف Excel موجود) */
ipcMain.handle('finx:use', (_e, f) => { f = String(f || ''); if (!/\.(xlsx|xlsm|json)$/i.test(f) || !fs.existsSync(f)) return null; const p = prefs(); p.financeFile = f; atomicWrite(prefsFile(), JSON.stringify(p)); audit.note('sit', 'finfile', 'ربط ملف المالية: ' + f).catch(() => {}); try { finWatch(); } catch (_) {} return f; });
ipcMain.handle('finx:choose', async () => {
  let f = process.env.UNI_TEST_FIN_PICK || '';
  if (!f) { const r = await dialog.showOpenDialog(win, { title: 'اختر ملف بيانات برنامج الشؤون المالية (anbar-data.json أو نسخة احتياطية منه) أو ملف Excel «الموقف الشامل» الذي يُصدره', filters: [{ name: 'بيانات المالية (JSON أو Excel)', extensions: ['json', 'xlsx', 'xlsm'] }], properties: ['openFile'] }); if (r.canceled || !r.filePaths[0]) return null; f = r.filePaths[0]; }
  const p = prefs(); p.financeFile = f; atomicWrite(prefsFile(), JSON.stringify(p)); audit.note('sit', 'finfile', 'ربط ملف بيانات برنامج الشؤون المالية: ' + f).catch(() => {}); finWatch(); return f; });
/* مشاريع التخطيط: استيراد ملف لجنة تحديث الخطة، وتصديره محدَّثاً لمكوّناتنا (في عامل خلفي؛ الأصل يُحفظ في مجلد البيانات للتصدير) */
const { Worker } = require('worker_threads');
function planWork(msg) { return new Promise((res, rej) => { const w = new Worker(path.join(__dirname, 'planning-worker.js')); w.once('message', m => { w.terminate(); m.ok ? res(m) : rej(new Error(m.error)); }); w.once('error', e => { w.terminate(); rej(e); }); w.postMessage(msg); }); }
const planSrc = () => path.join(dataDir, 'planning', 'plan-source.xlsx');
const planNote = () => { try { if (win && !win.isDestroyed()) win.webContents.send('sync:data', { ds: 'pl' }); } catch (_) {} };
ipcMain.handle('pl:get', () => { try { const t = readData('pl'); const o = t ? JSON.parse(t) : null; const r = o && Array.isArray(o.records) ? o.records.find(x => x && x.id === 'plan') : null; return r ? Object.assign({}, r, { hasSource: fs.existsSync(planSrc()) }) : null; } catch (_) { return null; } });
ipcMain.handle('pl:import', async () => {
  let f = process.env.UNI_TEST_PLAN_FILE || '';
  if (!f) { const r = await dialog.showOpenDialog(win, { title: 'اختر ملف خطة المحافظة (Excel لجنة تحديث الخطة) أو «الملف المنظَّم»', filters: [{ name: 'Excel', extensions: ['xlsx', 'xlsm'] }], properties: ['openFile'] }); if (r.canceled || !r.filePaths[0]) return null; f = r.filePaths[0]; }
  let buf; try { buf = fs.readFileSync(f); } catch (e) { return { error: 'تعذّر فتح الملف: ' + e.message }; }
  let m; try { m = await planWork({ op: 'parse', buf, label: path.basename(f) }); } catch (e) { return { error: String(e.message || e) }; }
  const rec = { id: 'plan', updated: Date.now(), file: path.basename(f), importedAt: new Date().toISOString(), by: audit.who() || '', model: m.model };
  atomicWrite(dataFile('pl'), JSON.stringify({ app: 'anbar-planning', version: 1, records: [rec] }));
  /* الملف المنظَّم لا يحل محل الملف الأصلي المحفوظ (يلزم الأصل لتصدير «ملف التخطيط المحدَّث») */
  try { fs.mkdirSync(path.dirname(planSrc()), { recursive: true }); fs.writeFileSync(m.model.clean ? path.join(path.dirname(planSrc()), 'plan-clean.xlsx') : planSrc(), buf); } catch (_) {}
  if (sync) sync.changed(); planNote();
  audit.note('pl', 'import', `استيراد ملف التخطيط «${path.basename(f)}»: ${m.model.projects.length} مشروعاً تخطيطياً، ${m.model.comps.length} مكوّناً`).catch(() => {});
  return { ok: true, file: rec.file, projects: m.model.projects.length, comps: m.model.comps.length, clean: !!m.model.clean, hasOriginal: fs.existsSync(planSrc()) };
});
/* «🔍 مقارنة ملفين وإخراج ملف مصحَّح»: الملف العام (الأول) + الملف المعدَّل (الثاني) ← الملف العام مصحَّحاً + «تدقيق المقارنة» (في عامل خلفي) */
let cmpState = null;
ipcMain.handle('pl:cmpOpen', async (_e, projects) => {
  const pick = async (title, env) => { if (process.env[env]) return process.env[env]; const r = await dialog.showOpenDialog(win, { title, filters: [{ name: 'Excel', extensions: ['xlsx', 'xlsm'] }], properties: ['openFile'] }); return r.canceled || !r.filePaths[0] ? null : r.filePaths[0]; };
  const g = await pick('١ — اختر ملف التخطيط العام (خطة المحافظة: المشاريع ومكوّناتها)', 'UNI_TEST_CMP_GEN'); if (!g) return null;
  const m = await pick('٢ — اختر ملف التخطيط المعدَّل (المحدَّث — ورقة Projects)', 'UNI_TEST_CMP_MOD'); if (!m) return null;
  let gen, mod; try { gen = fs.readFileSync(g); mod = fs.readFileSync(m); } catch (e) { return { error: 'تعذّر فتح الملف: ' + e.message }; }
  let r; try { r = await planWork({ op: 'cmp', gen, genLabel: path.basename(g), mod, modLabel: path.basename(m), projects: Array.isArray(projects) ? projects : [] }); } catch (e) { return { error: String(e.message || e) }; }
  cmpState = { gen, mod, genFile: path.basename(g), modFile: path.basename(m), res: r.res };
  const R = r.res, pick2 = c => ({ sheet: c.sheet, row: c.row, name: c.name, company: c.company || '' });
  return { ok: true, genFile: cmpState.genFile, modFile: cmpState.modFile, comps: R.G.comps.length, s2: R.G.comps.filter(c => c.kind === 's2').length, modRows: R.M.n, modSheet: R.M.sheet, matched: R.matched.length, fromStatus: R.fromStatus || 0, statusN: R.statusN || 0,
    diffs: R.diffs, unsure: R.unsure.map(u => ({ c: pick2(u.c), r: { name: u.r.name, company: u.r.company || '', row: u.r.row }, why: u.why, s: u.s })), onlyGen: R.onlyGen.map(pick2), onlyMod: R.onlyMod.map(x => ({ name: x.name, company: x.company || '', row: x.row })), rdiffs: (R.rdiffs || []).map(d => ({ sheet: d.sheet, row: d.row, name: d.name, field: d.field, key: d.key, old: d.old, neu: d.neu, kind: d.kind })) };
});
ipcMain.handle('pl:cmpSave', async (_e, o) => {
  if (!cmpState) return { error: 'اختر الملفين أولاً' };
  /* الافتراضي: الناتج = الملف المعدَّل (o.base==='gen' للملف العام) */
  const base = o && o.base === 'gen' ? 'gen' : 'mod';
  let r; try { r = await planWork({ op: 'cmpBuild', gen: cmpState.gen, mod: cmpState.mod, res: cmpState.res, opts: { base, keys: Array.isArray(o && o.keys) ? o.keys : null, diffKeys: Array.isArray(o && o.diffKeys) ? o.diffKeys : [], highlight: !(o && o.highlight === false) } }); } catch (e) { return { error: String(e.message || e) }; }
  const src = base === 'mod' ? cmpState.modFile : cmpState.genFile, ext = base === 'mod' && /\.xlsm$/i.test(src) ? '.xlsm' : '.xlsx';
  const name = src.replace(/\.(xlsx|xlsm)$/i, '') + '-مصحح-' + new Date().toISOString().slice(0, 10) + ext;
  let out = process.env.UNI_TEST_SAVE_DIR ? path.join(process.env.UNI_TEST_SAVE_DIR, name) : '';
  if (!out) { const d = await dialog.showSaveDialog(win, { title: 'حفظ ملف التخطيط المصحَّح', defaultPath: path.join(app.getPath('documents'), name), filters: [{ name: 'Excel', extensions: [ext.slice(1)] }] }); if (d.canceled || !d.filePath) return null; out = d.filePath; }
  try { fs.writeFileSync(out, Buffer.from(r.buf)); } catch (e) { return { error: 'تعذّر حفظ الملف: ' + e.message }; }
  audit.note('pl', 'compare', `(الناتج: ${base === 'mod' ? 'الملف المعدَّل' : 'الملف العام'}) مقارنة «${cmpState.genFile}» بـ«${cmpState.modFile}»: صُحّحت ${r.cells} خلية، ${r.audit} سطر في «تدقيق المقارنة»`).catch(() => {});
  return { ok: true, file: out, cells: r.cells, audit: r.audit };
});
/* «ملف التخطيط المنظَّم»: ملف جديد مرتّب وموحّد مع ملاحظات جودة البيانات (لا يحتاج الملف الأصلي) */
ipcMain.handle('pl:clean', async (_e, eo) => {
  const lockPw = eo && eo.pw ? String(eo.pw) : ''; if (lockPw) { const r0 = checkMaster(lockPw); if (r0 !== true) return { error: r0 === 'wait' ? 'محاولات كثيرة — انتظر دقيقة' : 'كلمة سر المدير غير صحيحة' }; }
  const t = readData('pl'); const o = t ? JSON.parse(t) : null; const rec = o && (o.records || []).find(x => x && x.id === 'plan'); if (!rec) return { error: 'استورد ملف التخطيط أولاً' };
  let res; try { res = await planWork({ op: 'clean', model: rec.model, opts: { lockPw } }); } catch (e) { return { error: String(e.message || e) }; }
  const name = String(rec.file || 'خطة.xlsx').replace(/\.(xlsx|xlsm)$/i, '') + '-منظم-' + new Date().toISOString().slice(0, 10) + '.xlsx';
  let out = process.env.UNI_TEST_SAVE_DIR ? path.join(process.env.UNI_TEST_SAVE_DIR, name) : '';
  if (!out) { const r = await dialog.showSaveDialog(win, { title: 'حفظ ملف التخطيط المنظَّم', defaultPath: path.join(app.getPath('documents'), name), filters: [{ name: 'Excel', extensions: ['xlsx'] }] }); if (r.canceled || !r.filePath) return null; out = r.filePath; }
  fs.writeFileSync(out, Buffer.from(res.buf));
  audit.note('pl', 'clean', `تصدير ملف التخطيط المنظَّم: ${res.stats.comps} مكوّناً، ${res.stats.issues} ملاحظة جودة${lockPw ? ' (مقفل)' : ''}`).catch(() => {});
  return { ok: true, file: out, stats: res.stats, locked: !!lockPw };
});
ipcMain.handle('pl:export', async (_e, updates, eo) => {
  /* قفل لوحتي المعلومات وعناوين الجداول بكلمة سر المدير (تُتحقق هنا ولا تُحفظ) */
  const lockPw = eo && eo.pw ? String(eo.pw) : ''; if (lockPw) { const r0 = checkMaster(lockPw); if (r0 !== true) return { error: r0 === 'wait' ? 'محاولات كثيرة — انتظر دقيقة' : 'كلمة سر المدير غير صحيحة' }; }
  const t = readData('pl'); const o = t ? JSON.parse(t) : null; const rec = o && (o.records || []).find(x => x && x.id === 'plan'); if (!rec) return { error: 'استورد ملف التخطيط أولاً' };
  let src = planSrc();
  if (!fs.existsSync(src)) { const r = process.env.UNI_TEST_PLAN_FILE ? { canceled: false, filePaths: [process.env.UNI_TEST_PLAN_FILE] } : await dialog.showOpenDialog(win, { title: rec.model && rec.model.clean ? 'اختر ملف التخطيط الأصلي (ملف لجنة تحديث الخطة الذي صُدِّر منه «الملف المنظَّم»)' : `اختر ملف التخطيط الأصلي «${rec.file}» (لم يُحفظ على هذه الحاسبة)`, filters: [{ name: 'Excel', extensions: ['xlsx', 'xlsm'] }], properties: ['openFile'] }); if (r.canceled || !r.filePaths[0]) return null; src = r.filePaths[0]; if (rec.model && rec.model.clean) try { fs.mkdirSync(path.dirname(planSrc()), { recursive: true }); fs.copyFileSync(src, planSrc()); } catch (_) {} }
  let model = rec.model, ups = Array.isArray(updates) ? updates : [];
  if (model.clean) {   /* البيانات من «الملف المنظَّم»: التحديث يُكتب في الملف الأصلي بأرقام صفوفه («صف الأصل») */
    let om; try { om = (await planWork({ op: 'parse', buf: fs.readFileSync(src), label: path.basename(src) })).model; } catch (e) { return { error: 'تعذّرت قراءة ملف التخطيط الأصلي: ' + String(e.message || e) }; }
    if (om.clean) { try { fs.unlinkSync(planSrc()); } catch (_) {} return { error: 'الملف المختار هو «الملف المنظَّم» نفسه — اختر ملف التخطيط الأصلي (ملف لجنة تحديث الخطة) لتصدير نسخة محدَّثة منه' }; }
    const byKind = {}; Object.entries(om.sheets).forEach(([n, m2]) => { if (!byKind[m2.kind]) byKind[m2.kind] = n; });
    ups = ups.map(u => Object.assign({}, u, { sheet: u.sheet === '__main__' ? byKind.main : u.sheet === '__s2__' ? byKind.s2 : u.sheet })).filter(u => u.sheet && u.row);
    model = om;
  }
  let res; try { res = await planWork({ op: 'export', buf: fs.readFileSync(src), model, updates: ups, opts: { lockPw, dash: !(eo && eo.dash === false) } }); } catch (e) { return { error: String(e.message || e) }; }
  const name = String(rec.file || 'خطة.xlsx').replace(/\.(xlsx|xlsm)$/i, '') + '-محدثة-' + new Date().toISOString().slice(0, 10) + '.xlsx';
  let out = process.env.UNI_TEST_SAVE_DIR ? path.join(process.env.UNI_TEST_SAVE_DIR, name) : '';
  if (!out) { const r = await dialog.showSaveDialog(win, { title: 'حفظ ملف التخطيط المحدَّث', defaultPath: path.join(app.getPath('documents'), name), filters: [{ name: 'Excel', extensions: ['xlsx'] }] }); if (r.canceled || !r.filePath) return null; out = r.filePath; }
  fs.writeFileSync(out, Buffer.from(res.buf));
  const n = res.changes.filter(c => !c.note).length, fx = res.changes.filter(c => c.note).length;
  audit.note('pl', 'export', `تصدير ملف التخطيط المحدَّث: ${n} خلية حُدّثت${fx ? '، ' + fx + ' خلية معادلة لم تُمس' : ''}${res.dash && res.dash.added && res.dash.added.length ? '، مع ' + res.dash.added.join(' و') + (res.dash.locked ? ' (مقفلة)' : '') : ''}`).catch(() => {});
  return { ok: true, file: out, changed: n, skipped: fx, rows: new Set(res.changes.filter(c => !c.note).map(c => c.sheet + c.row)).size, dash: res.dash || null };
});
/* «📊 تحديث نسب الإنجاز في ملف التخطيط»: ملف تخصيصات المحافظة — يُقرأ ويُربط بمشاريع الموقف في عامل خلفي، ويُحفظ نسخة جديدة تتغير فيها خلايا النسب فقط (الأصل لا يُمس) */
let ppState = null;
ipcMain.handle('pp:open', async (_e, projects) => {
  let f = process.env.UNI_TEST_PP_FILE || '';
  if (!f) { const r = await dialog.showOpenDialog(win, { title: 'اختر ملف التخطيط (Excel) لتحديث نسب الإنجاز الفعلي والمخطط فيه', filters: [{ name: 'Excel', extensions: ['xlsx', 'xlsm'] }], properties: ['openFile'] }); if (r.canceled || !r.filePaths[0]) return null; f = r.filePaths[0]; }
  let buf; try { buf = fs.readFileSync(f); } catch (e) { return { error: 'تعذّر فتح الملف: ' + e.message }; }
  let m; try { m = await planWork({ op: 'ppParse', buf, label: path.basename(f), projects: Array.isArray(projects) ? projects : [], links: prefs().planPctLinks || {} }); } catch (e) { return { error: 'تعذّرت قراءة الملف: ' + String(e.message || e) }; }
  if (!m.model.sheets.length) return { error: 'لم يُعثر في الملف على ورقة فيها «اسم المشروع» و«نسبة الإنجاز الفني» و«نسبة الإنجاز المخطط»' };
  ppState = { buf, model: m.model, file: path.basename(f), ext: path.extname(f) || '.xlsx' };
  return { ok: true, file: ppState.file, sheets: m.model.sheets.map(s => ({ name: s.name, rows: s.rows.length, letters: s.letters, head: s.head, old: s.old })), items: m.items };
});
ipcMain.handle('pp:save', async (_e, updates, eo) => {
  if (!ppState) return { error: 'اختر ملف التخطيط أولاً' };
  const ups = Array.isArray(updates) ? updates : []; if (!ups.length) return { error: 'لم يُحدَّد مشروع للتحديث' };
  let res; try { res = await planWork({ op: 'ppExport', buf: ppState.buf, model: ppState.model, updates: ups, opts: { highlight: !(eo && eo.highlight === false) } }); } catch (e) { return { error: String(e.message || e) }; }
  const name = ppState.file.replace(/\.(xlsx|xlsm)$/i, '') + '-نسب-الانجاز-' + new Date().toISOString().slice(0, 10) + '.xlsx';
  let out = process.env.UNI_TEST_SAVE_DIR ? path.join(process.env.UNI_TEST_SAVE_DIR, name) : '';
  if (!out) { const r = await dialog.showSaveDialog(win, { title: 'حفظ نسخة ملف التخطيط بنسب الإنجاز المحدَّثة', defaultPath: path.join(app.getPath('documents'), name), filters: [{ name: 'Excel', extensions: ['xlsx'] }] }); if (r.canceled || !r.filePath) return null; out = r.filePath; }
  try { fs.writeFileSync(out, Buffer.from(res.buf)); } catch (e) { return { error: 'تعذّر حفظ الملف: ' + e.message }; }
  /* تذكّر الربط المؤكَّد (اسم المشروع في الملف ← رقم الاضبارة) للمرات القادمة */
  try { const p = prefs(), L = p.planPctLinks || {}; ups.forEach(u => { if (u.key && u.fileNo) L[u.key] = String(u.fileNo); }); p.planPctLinks = L; atomicWrite(prefsFile(), JSON.stringify(p)); } catch (_) {}
  const n = res.changes.filter(c => !c.note).length, fx = res.changes.filter(c => c.note).length;
  audit.note('sit', 'planpct', `تحديث نسب الإنجاز في ملف التخطيط «${ppState.file}»: ${n} خلية في ${new Set(res.changes.filter(c => !c.note).map(c => c.sheet + c.row)).size} صفاً${fx ? '، ' + fx + ' خلية معادلة لم تُغيَّر' : ''}`).catch(() => {});
  return { ok: true, file: out, changed: n, skipped: fx, rows: new Set(res.changes.filter(c => !c.note).map(c => c.sheet + c.row)).size };
});
ipcMain.handle('finx:link', (_e, fileNo, fid) => { fileNo = String(fileNo || ''); if (!fileNo) return false; const p = prefs(), L = p.financeLinks || {};
  if (fid === undefined) delete L[fileNo]; else L[fileNo] = fid === null ? '' : String(fid); p.financeLinks = L; atomicWrite(prefsFile(), JSON.stringify(p));
  audit.note('sit', 'finlink', `ربط الاضبارة ${fileNo} ${fid ? 'بمشروع المالية ' + fid : fid === null ? ': لا يوجد مقابل في المالية' : ': إعادة الربط التلقائي'}`).catch(() => {}); return true; });
ipcMain.handle('co:accessImport', e => accessImport('co', e));
ipcMain.on('data:saveSync', (e, id, text) => { try { if (!okId(id)) throw 0; if (held(id)) { e.returnValue = true; return; } if (e.sender && e.sender.__bgLinks) { e.returnValue = true; return; }   /* نسخة الخلفية لملخص الموقف تُغلق بلا حفظ */ JSON.parse(text); { const q = saveGen(id); q.next = null; q.syncAfter = ++q.gen; }   // حفظ الإغلاق هو الأحدث: لا تكتب فوقه كتابة غير متزامنة قديمة
  const old = AUDITED.has(id) ? readData(id) : null; atomicWrite(dataFile(id), text); auditSave(id, old, text); if (sync) sync.changed(); flowSoon(id); e.returnValue = true; } catch (_) { e.returnValue = false; } });
// قراءة فقط لملف نظام آخر (يستعملها «إطلاق التأمينات» لسحب بيانات المشروع من لجنة السلف)
ipcMain.on('data:peek', (e, id) => { e.returnValue = okId(id) ? readData(id) : null; });
// شهادات الاستلام النهائي (الكلي والجزئي) من نظام الاستلام
/* تقرير العمل الأسبوعي: بيانات كل الأنظمة (ملفات JSON + محاضر الاستلام من نافذة الاستلام) */
ipcMain.handle('report:data', async () => {
  const out = {}; for (const id of ['co', 'du', 'ad', 'in', 'lt', 'fu']) { try { out[id] = JSON.parse(readData(id) || '{}'); } catch (_) { out[id] = {}; } }
  try { out.ac = acAvailable() ? JSON.parse(await acEval("JSON.stringify({pac:localStorage.getItem('pac_records_v1'),pap:localStorage.getItem('pap_records_v1'),fac:localStorage.getItem('fac_records_v1'),fpa:localStorage.getItem('fpa_records_v1')})")) : {}; } catch (_) { out.ac = {}; }
  return out;
});
ipcMain.handle('ac:final', async () => { try { return await acEval("JSON.stringify({fac:localStorage.getItem('fac_records_v1'),fpa:localStorage.getItem('fpa_records_v1')})"); } catch (_) { return '{}'; } });
// دليل الاستخدام (كتالوج PDF) — يُعرض داخل البرنامج بعارض PDF المدمج.
// يُبحث عن الملف في: الموارد بجانب البرنامج (manual)، ثم داخل البرنامج نفسه (asar)، ثم مجلد البيانات (دليل-الاستخدام.pdf)، ثم بجانب ملف البرنامج.
// الملف المأخوذ من داخل البرنامج يُنسخ أولاً إلى مجلد المستخدم (عارض PDF لا يقرأ من داخل asar).
// إن لم يوجد في أي مكان: يُعرض اختيار الملف يدوياً (الملف الذي أرسله المسؤول) ويُحفظ نسخة في مجلد البيانات فيعمل بعدها دائماً.
let manualWin = null;
const MANUAL_NAME = 'دليل-الاستخدام.pdf';
const isPdf = f => { try { const fd = fs.openSync(f, 'r'), b = Buffer.alloc(5); fs.readSync(fd, b, 0, 5, 0); fs.closeSync(fd); return b.toString() === '%PDF-'; } catch (_) { return false; } };
function manualPath() {
  const cands = [];
  if (process.resourcesPath) cands.push(path.join(process.resourcesPath, 'manual', 'user-guide.pdf'));
  cands.push(path.join(__dirname, 'build', 'manual', 'user-guide.pdf'));
  if (dataDir) cands.push(path.join(dataDir, MANUAL_NAME));
  for (const d of [process.env.PORTABLE_EXECUTABLE_DIR, app.isPackaged && path.dirname(app.getPath('exe'))].filter(Boolean)) cands.push(path.join(d, MANUAL_NAME));
  for (const f of cands) {
    if (!f || !fs.existsSync(f)) continue;
    if (/\.asar[\\/]/.test(f)) {   // من داخل البرنامج: نسخة خارجية مرة واحدة لكل إصدار
      try { const out = path.join(app.getPath('userData'), 'manual', 'user-guide-' + APP_VER() + '.pdf');
        if (!fs.existsSync(out) || fs.statSync(out).size !== fs.statSync(f).size) { fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, fs.readFileSync(f)); }
        if (isPdf(out)) return out; } catch (_) { continue; }
    } else if (isPdf(f)) return f;
  }
  return null;
}
async function locateManual() {
  const r = await dialog.showMessageBox(win, { type: 'warning', title: 'دليل الاستخدام', buttons: ['اختيار ملف الدليل…', 'إلغاء'], defaultId: 0, cancelId: 1,
    message: 'ملف دليل الاستخدام غير موجود على هذه الحاسبة.', detail: 'اختر ملف الدليل (PDF) الذي أرسله المسؤول، فيُحفظ نسخة في مجلد بيانات البرنامج ويفتح بعدها دائماً من زر 📘.' });
  if (r.response !== 0) return null;
  const p = await dialog.showOpenDialog(win, { title: 'اختر ملف دليل الاستخدام', properties: ['openFile'], filters: [{ name: 'PDF', extensions: ['pdf'] }] });
  if (p.canceled || !p.filePaths[0]) return null;
  if (!isPdf(p.filePaths[0])) { dialog.showMessageBox(win, { type: 'error', title: 'دليل الاستخدام', message: 'الملف المختار ليس ملف PDF.' }); return null; }
  const out = path.join(dataDir, MANUAL_NAME);
  try { fs.copyFileSync(p.filePaths[0], out); return out; } catch (_) { return p.filePaths[0]; }
}
async function openManual() {
  if (manualWin && !manualWin.isDestroyed()) { if (manualWin.isMinimized()) manualWin.restore(); manualWin.focus(); return true; }
  const f = manualPath() || await locateManual();
  if (!f) return false;
  manualWin = new BrowserWindow({ width: 1100, height: 850, title: 'دليل الاستخدام — نظام الشؤون الهندسية الموحد', icon: path.join(__dirname, 'build', 'icon.png'), autoHideMenuBar: true, webPreferences: { plugins: true, contextIsolation: true, sandbox: true, nodeIntegration: false } });
  manualWin.setMenuBarVisibility(false);
  manualWin.on('page-title-updated', e => e.preventDefault());
  manualWin.loadURL(require('url').pathToFileURL(f).href);
  manualWin.on('closed', () => { manualWin = null; });
  return true;
}
ipcMain.handle('manual:open', () => openManual());
ipcMain.handle('data:openFolder', () => { shell.openPath(dataDir); return true; });
let regVer = 0;   // يزيد مع كل حفظ للموقف (من الواجهة أو من المزامنة)
/* الكلفة المصادقة من ملف التخطيط لكل اضبارة مرتبطة (تحسبها صفحة التخطيط في الواجهة، وتقرؤها أوامر التغيير للعرض والمقارنة فقط) */
let plAp = {};
ipcMain.on('pl:apSet', (e, m) => { if (win && e.sender === win.webContents && m && typeof m === 'object') plAp = m; });
ipcMain.on('pl:apGet', (e, fn) => { e.returnValue = (fn != null && plAp[String(fn)]) || null; });
ipcMain.on('reg:stamp', e => { try { const st = fs.statSync(regFile()); e.returnValue = st.mtimeMs + '|' + st.size + '|' + regVer; } catch (_) { e.returnValue = 'none|' + regVer; } });
ipcMain.on('reg:load', e => {
  for (const f of [regFile(), regFile() + '.bak']) {
    try { if (fs.existsSync(f)) { const t = fs.readFileSync(f, 'utf8'); JSON.parse(t); e.returnValue = t; return; } } catch (_) {}
  }
  e.returnValue = null;
});
ipcMain.on('reg:save', (e, text) => {
  try { JSON.parse(text); fs.mkdirSync(path.dirname(regFile()), { recursive: true }); atomicWrite(regFile(), text); regVer++; if (sync) sync.changed(); e.returnValue = true; }
  catch (_) { e.returnValue = false; }
});
function filtersFor(name) {
  const ext = (path.extname(name).slice(1) || '').toLowerCase();
  const map = { json: 'ملف بيانات JSON', pdf: 'ملف PDF', png: 'صورة PNG', kml: 'ملف Google Earth (KML)' };
  return ext ? [{ name: map[ext] || ext.toUpperCase(), extensions: [ext] }] : [];
}
async function askPath(name) {
  if (process.env.UNI_TEST_SAVE_DIR) return path.join(process.env.UNI_TEST_SAVE_DIR, name);
  const r = await dialog.showSaveDialog(win, { defaultPath: path.join(app.getPath('documents'), name), filters: filtersFor(name) });
  return r.canceled || !r.filePath ? null : r.filePath;
}
/* دمج مواقف الأقضية: موقف واحد بصيغة Excel (بلا حذف أعمدة ولا تغيير معادلات) + كشف المهندسين المقيمين والمشرفين */
ipcMain.handle('xl:merge', async () => {
  try {
    let files = process.env.UNI_TEST_MERGE_FILES ? process.env.UNI_TEST_MERGE_FILES.split(path.delimiter) : null;
    if (!files) {
      const r = await dialog.showOpenDialog(win, { title: 'اختر مواقف الأقضية (الملف الأول هو الأساس)', properties: ['openFile', 'multiSelections'], filters: [{ name: 'Excel', extensions: ['xlsx', 'xlsm'] }] });
      if (r.canceled || !r.filePaths.length) return { ok: false, cancel: true };
      files = r.filePaths;
    }
    if (files.length < 2) return { ok: false, msg: 'اختر ملفين في الأقل (موقفي قضاءين أو أكثر).' };
    const X = require('./xlmerge');
    const list = files.map(f => ({ name: path.basename(f), buf: fs.readFileSync(f) }));
    const m = X.merge(list), e = X.engineersBook(list), day = new Date().toISOString().slice(0, 10), ext = /\.xlsm$/i.test(files[0]) ? 'xlsm' : 'xlsx';
    const p1 = await askPath(`الموقف-المدمج-${day}.${ext}`); if (p1) fs.writeFileSync(p1, m.buf);
    const p2 = await askPath(`المهندسون-المقيمون-والمشرفون-${day}.xlsx`); if (p2) fs.writeFileSync(p2, e.buf);
    return { ok: true, report: m.report, stats: e.stats, saved: [p1, p2], name: path.basename(p1 || `الموقف-المدمج.${ext}`), merged: new Uint8Array(m.buf) };
  } catch (err) { return { ok: false, msg: String(err && err.message || err) }; }
});
ipcMain.handle('file:save', async (_e, name, data) => {
  try { const p = await askPath(name); if (!p) return 'cancel'; fs.writeFileSync(p, typeof data === 'string' ? data : Buffer.from(data)); return 'ok'; }
  catch (_) { return 'error'; }
});
/* صور المشاريع (بطاقة المشروع في الموقف العام): 3 صور لكل مشروع، تُصغَّر في الواجهة إلى 300 كيلوبايت (photos.js) */
let _phs = null; const PHS = () => _phs || (_phs = require('./photos')({ dataDir: () => dataDir, regFile: () => regFile() }));
ipcMain.handle('pph:save', (_e, fn, d) => { try { const r = PHS().save(fn, d); if (r.ok) audit.note('sit', 'photo', `إضافة صورة لمشروع الاضبارة ${fn} (${r.kb} ك.ب)`).catch(() => {}); return r; } catch (e) { return { error: String(e && e.message || e) }; } });
ipcMain.handle('pph:read', (_e, fn, name) => (VIEWER ? vwReader().photo(fn, name) : PHS().read(fn, name)));
ipcMain.handle('pph:del', (_e, fn, name) => { const ok = PHS().del(fn, name); if (ok) audit.note('sit', 'photo', `حذف صورة من مشروع الاضبارة ${fn}`).catch(() => {}); return ok; });
/* مرفقات الأرشيف: «ملفات-الأرشيف/<معرّف الكتاب>/<اسم الملف>» في مجلد البيانات (تُنقل بالمزامنة كمجموعة arf) */
const archDir = () => path.join(dataDir, 'ملفات-الأرشيف');
const okRec = r => /^[A-Za-z0-9_-]{1,40}$/.test(String(r || ''));
const cleanName = n => path.basename(String(n || 'ملف')).replace(/[\\/:*?"<>|]+/g, '_').slice(0, 160) || 'ملف';
function archPut(rec, name, buf) {
  const d = path.join(archDir(), rec); fs.mkdirSync(d, { recursive: true });
  let nm = cleanName(name), i = 1; const ext = path.extname(nm), base = nm.slice(0, nm.length - ext.length);
  while (fs.existsSync(path.join(d, nm))) nm = `${base} (${++i})${ext}`;
  fs.writeFileSync(path.join(d, nm), buf); if (sync) sync.changed(); return { name: nm, size: buf.length };
}
ipcMain.handle('arch:pick', async (_e, rec) => {
  if (!okRec(rec)) return [];
  const r = await dialog.showOpenDialog(win, { title: 'اختر ملفات الكتاب (PDF أو صور أو Word)', properties: ['openFile', 'multiSelections'], filters: [{ name: 'المستندات', extensions: ['pdf', 'jpg', 'jpeg', 'png', 'docx', 'doc', 'xlsx', 'xls'] }, { name: 'كل الملفات', extensions: ['*'] }] });
  if (r.canceled) return [];
  const out = []; for (const f of r.filePaths) { try { const st = fs.statSync(f); if (st.size > 100 * 1024 * 1024) { out.push({ name: path.basename(f), error: 'أكبر من 100 ميغابايت' }); continue; } out.push(archPut(rec, path.basename(f), fs.readFileSync(f))); } catch (e) { out.push({ name: path.basename(f), error: String(e.message || e) }); } }
  return out;
});
/* إرسال مجلد اضبارة كامل من حاسبة الأرشيف: يُختار المجلد من نافذة ويندوز، وتُقرأ ملفاته (والمجلدات الفرعية حتى 4 مستويات، حتى 500 ملف)،
   ثم تُنسخ إلى الأرشيف ملفاً ملفاً. الواجهة لا ترسل مسارات: ترسل رقم الملف من القائمة التي اختارها المستخدم فقط. */
const ARCH_EXT = /\.(pdf|jpe?g|png|tiff?|bmp|docx?|xlsx?|pptx?|txt|dwg|dxf|zip|rar)$/i;
let pickedDir = null;
ipcMain.handle('arch:pickDir', async () => {
  const r = process.env.UNI_TEST_PICKDIR ? { canceled: false, filePaths: [process.env.UNI_TEST_PICKDIR] } : await dialog.showOpenDialog(win, { title: 'اختر مجلد الاضبارة (كل ملفاته تُرسل إلى صندوق اللجنة)', properties: ['openDirectory'] });
  if (r.canceled || !r.filePaths.length) return null;
  const root = r.filePaths[0], files = [];
  (function walk(d, depth) { let ents = []; try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch (_) { return; }
    ents.sort((a, b) => a.name.localeCompare(b.name, 'ar', { numeric: true }));
    for (const e of ents) { if (files.length >= 500) return; const f = path.join(d, e.name);
      if (e.isDirectory()) { if (depth > 0 && !e.name.startsWith('.')) walk(f, depth - 1); continue; }
      if (!ARCH_EXT.test(e.name) || e.name.startsWith('~$')) continue;
      let size = 0; try { size = fs.statSync(f).size; } catch (_) { continue; }
      files.push({ key: files.length, name: e.name, rel: path.relative(root, f), size, big: size > 100 * 1024 * 1024 }); } })(root, 4);
  pickedDir = { root, files: files.map(x => path.join(root, x.rel)) };
  return { name: path.basename(root), count: files.length, files, more: files.length >= 500 };
});
ipcMain.handle('arch:importPicked', (_e, rec, key) => {
  if (!okRec(rec) || !pickedDir) return { error: 'لم يُختر مجلد' }; const f = pickedDir.files[+key]; if (!f) return { error: 'ملف غير معروف' };
  try { const st = fs.statSync(f); if (st.size > 100 * 1024 * 1024) return { name: path.basename(f), error: 'أكبر من 100 ميغابايت' }; return archPut(rec, path.basename(f), fs.readFileSync(f)); } catch (e) { return { name: path.basename(f), error: String(e.message || e) }; }
});
ipcMain.handle('arch:put', (_e, rec, name, data) => { if (!okRec(rec)) return null; const b = Buffer.from(data); if (b.length > 100 * 1024 * 1024) return { name, error: 'أكبر من 100 ميغابايت' }; return archPut(rec, name, b); });
ipcMain.handle('arch:open', async (_e, rec, name) => { if (!okRec(rec)) return 'bad'; const f = path.join(archDir(), rec, cleanName(name)); if (!fs.existsSync(f)) return 'missing'; const err = await shell.openPath(f); return err ? err : 'ok'; });
ipcMain.handle('arch:show', (_e, rec, name) => { if (!okRec(rec)) return false; const f = path.join(archDir(), rec, cleanName(name)); if (fs.existsSync(f)) shell.showItemInFolder(f); else shell.openPath(archDir()); return true; });
ipcMain.handle('arch:del', (_e, rec, name) => { if (!okRec(rec)) return false; try { fs.unlinkSync(path.join(archDir(), rec, cleanName(name))); return true; } catch (_) { return false; } });
ipcMain.on('arch:has', (e, rec, name) => { e.returnValue = okRec(rec) && fs.existsSync(path.join(archDir(), rec, cleanName(name))); });
ipcMain.on('sync:mode', e => { try { e.returnValue = sync ? (sync.getConfig() || {}).mode || 'off' : 'off'; } catch (_) { e.returnValue = 'off'; } });
/* لجنة تسجّل الدخول على جهاز عميل: تُحذف من هذا الجهاز مرفقات الكتب التي ليست في صندوقها */
ipcMain.handle('arch:purge', (_e, keep) => { const K = new Set((keep || []).map(String)); let n = 0; try { for (const d of fs.readdirSync(archDir())) if (okRec(d) && !K.has(d)) { fs.rmSync(path.join(archDir(), d), { recursive: true, force: true }); n++; } } catch (_) {} return n; });
ipcMain.on('device:name', e => { let n = ''; try { n = (sync && sync.getConfig && (sync.getConfig() || {}).name) || ''; } catch (_) {} e.returnValue = n || require('os').hostname(); });
/* ---------- النسخة الاحتياطية بملف واحد واسترجاعها ---------- */
let bkList = [];
ipcMain.handle('bk:list', async () => { try { bkList = await bsEnsure().list(); return bkList.map((x, i) => ({ key: i, where: x.where, at: x.at, size: x.size, safe: !!x.safe, legacy: x.kind === 'legacy', attachments: x.attachments, sys: x.sys, device: x.device || '', name: x.file ? path.basename(x.file) : '' })); } catch (e) { return { error: String(e && e.message || e) }; } });
ipcMain.handle('bk:pick', async () => { const f = process.env.UNI_TEST_BK_FILE || ((await dialog.showOpenDialog(win, { title: 'اختر ملف النسخة الاحتياطية', filters: [{ name: 'نسخة احتياطية', extensions: ['zip'] }], properties: ['openFile'] })).filePaths || [])[0];
  if (!f) return null; bkList.push({ kind: 'zip', file: f, where: 'ملف مختار', at: '', size: 0, sys: {} }); return bkList.length - 1; });
ipcMain.handle('bk:inspect', async (_e, key) => { const it = bkList[+key]; if (!it) return { error: 'النسخة غير موجودة' }; try { return await bsEnsure().inspect(it); } catch (e) { return { error: String(e && e.message || e) }; } });
ipcMain.handle('bk:save', async (_e, withFiles) => { try { const name = bsEnsure().PREFIX + new Date().toISOString().slice(0, 10) + (withFiles ? '-كاملة' : '') + '.zip'; const f = await askPath(name); if (!f) return { cancel: true };
  const r = await bsEnsure().writeTo(f, { attachments: !!withFiles }); return { ok: true, file: r.file, size: r.size }; } catch (e) { return { error: String(e && e.message || e) }; } });
ipcMain.handle('bk:restore', async (_e, key, ids, pw) => { const it = bkList[+key]; if (!it) return { error: 'النسخة غير موجودة' };
  const m = checkMaster(pw); if (m !== true) return { error: m === 'wait' ? 'محاولات كثيرة — انتظر دقيقة' : 'كلمة سر المدير غير صحيحة' };
  { const until = Date.now() + 15000; for (const g of bsEnsure().GROUPS) if ((ids || []).includes(g.id)) for (const ds of g.ds) bkHold[ds] = until; }
  try { const r = await bsEnsure().restore(it, (ids || []).map(String), { after: async (g, o) => {
      if (g.id === 'ac' && o.data.acr) { try { const d = JSON.parse(o.data.acr); await acEval(`(()=>{const d=${JSON.stringify(d)};for(const k of ['pac','pap','fac','fpa']){if(typeof d[k]==='string')localStorage.setItem(k+'_records_v1',d[k]);else localStorage.removeItem(k+'_records_v1');}return 1})()`); } catch (e) { logError('bk:ac', String(e && e.message || e)); } } } });
    audit.note('home', 'restore', `استرجاع نسخة احتياطية (${it.file ? path.basename(it.file) : it.at}) للأنظمة: ${r.done.join('، ')}`).catch(() => {});
    if (sync) try { sync.changed(); } catch (_) {}
    setTimeout(() => { for (const id of Object.keys(views)) { try { const wc = views[id].webContents; if (bkHold[id]) wc.once('did-finish-load', () => setTimeout(() => { delete bkHold[id]; }, 1500)); wc.reload(); } catch (_) {} } try { flowNotify(); } catch (_) {} try { if (win && !win.isDestroyed()) win.webContents.reload(); } catch (_) {} }, 400);
    return Object.assign({ ok: true }, r); } catch (e) { return { error: String(e && e.message || e) }; } });
/* سجلات شهادات الاستلام: نسخة في مجلد البيانات (تدخل النسخ الاحتياطية) كلما تغيّرت في نافذة الاستلام */
ipcMain.handle('ac:recs', (e, d) => { try { if (!views.ac || e.sender !== views.ac.webContents || !d || typeof d !== 'object') return false; const o = {}; for (const k of ['pac', 'pap', 'fac', 'fpa']) o[k] = typeof d[k] === 'string' ? d[k] : null;
  const t = JSON.stringify(o); let old = ''; try { old = fs.readFileSync(ACR_FILE(), 'utf8'); } catch (_) {} if (old !== t) atomicWrite(ACR_FILE(), t); return true; } catch (_) { return false; } });
/* ---------- النسخ الاحتياطي الخارجي (فلاشة / قرص ثانٍ / مجلد شبكة) ---------- */
const deviceName = () => { let n = ''; try { n = (sync && sync.getConfig && (sync.getConfig() || {}).name) || ''; } catch (_) {} return n || require('os').hostname(); };
let xb = null;
const xbEnsure = () => { if (!xb) xb = require('./extbackup')({ dataDir: () => dataDir, device: deviceName, version: APP_VER(), bundle: f => bsEnsure().writeTo(f, { attachments: false }),
  getCfg: () => prefs().extBackup || {}, setCfg: c => { try { const p = prefs(); p.extBackup = c; atomicWrite(prefsFile(), JSON.stringify(p)); } catch (_) {} },
  onState: st => { try { if (win && !win.isDestroyed()) win.webContents.send('xb:state', st); } catch (_) {} } }); return xb; };
ipcMain.on('xb:get', e => { e.returnValue = xbEnsure().state(); });
ipcMain.handle('xb:set', (_e, c) => xbEnsure().set(c || {}));
ipcMain.handle('xb:run', () => xbEnsure().run());
ipcMain.handle('xb:pick', async () => { if (process.env.UNI_TEST_PICK_DIR) return process.env.UNI_TEST_PICK_DIR; const r = await dialog.showOpenDialog(win, { title: 'اختر مكان النسخة الاحتياطية (فلاشة أو قرص ثانٍ أو مجلد شبكة)', properties: ['openDirectory', 'createDirectory'] }); return r.canceled || !r.filePaths[0] ? '' : r.filePaths[0]; });
ipcMain.handle('xb:open', () => { const st = xbEnsure().state(); if (st.folder && fs.existsSync(st.folder)) shell.openPath(st.folder); else if (st.dest) shell.openPath(st.dest); return true; });
/* ---------- التحديث من حاسبة القسم عبر الشبكة (updater.js) ---------- */
const APP_VER = () => process.env.UNI_FAKE_VER || app.getVersion();
let upd = null;
const updEnsure = () => { if (!upd) upd = require('./updater')({ version: APP_VER(), platform: process.platform,
  exePath: () => process.env.UNI_UPDATE_EXE || process.env.PORTABLE_EXECUTABLE_FILE || null,
  quit: () => app.quit(), log: m => { try { audit.note('home', 'update', m).catch(() => {}); } catch (_) {} } }); return upd; };
const sendUpd = () => { try { if (win && !win.isDestroyed()) win.webContents.send('upd:state', updEnsure().state()); } catch (_) {} };
ipcMain.on('upd:get', e => { e.returnValue = updEnsure().state(); });
ipcMain.handle('upd:fetch', () => updEnsure().fetchUpdate(sendUpd));
ipcMain.handle('upd:apply', () => updEnsure().apply());
ipcMain.handle('upd:offer', async () => { try { return await updEnsure().offer(); } catch (_) { return null; } });
/* ---------- حالة الحاسبات المتصلة بحاسبة القسم ---------- */
ipcMain.on('sync:peers', e => { e.returnValue = sync && sync.peers ? sync.peers() : { self: {}, list: [] }; });
/* ---------- الأرشيف: حفظ اضبارة كاملة في مجلد على الحاسبة باسم «اضبارة <رقم>» ---------- */
ipcMain.handle('arch:exportFn', async (_e, title, items) => {
  const clean = t => String(t || '').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '_').replace(/\s+/g, ' ').trim();
  let base = process.env.UNI_TEST_PICK_DIR || '';
  if (!base) { const r = await dialog.showOpenDialog(win, { title: 'اختر المكان الذي تُحفظ فيه الاضبارة', properties: ['openDirectory', 'createDirectory'] }); if (r.canceled || !r.filePaths[0]) return { ok: false, canceled: true }; base = r.filePaths[0]; }
  const dir = path.join(base, clean(title).slice(0, 120) || 'اضبارة'); fs.mkdirSync(dir, { recursive: true });
  let n = 0; const missing = [], used = new Set();
  for (const it of items || []) {
    if (!it || !okRec(it.rec)) continue;
    const src = path.join(archDir(), it.rec, cleanName(it.name));
    if (!fs.existsSync(src)) { missing.push(String(it.out || it.name)); continue; }
    let out = clean(it.out || it.name).slice(0, 150) || 'ملف', k = 2; const ext = path.extname(out), stem = out.slice(0, out.length - ext.length);
    while (used.has(out.toLowerCase())) out = `${stem} (${k++})${ext}`; used.add(out.toLowerCase());
    try { await fs.promises.copyFile(src, path.join(dir, out)); n++; } catch (_) { missing.push(out); }
  }
  try { audit.note('ar', 'export', `حفظ ${clean(title)} على الحاسبة (${n} ملف) في: ${dir}`).catch(() => {}); } catch (_) {}
  if (!process.env.UNI_TEST_PICK_DIR) shell.openPath(dir);
  return { ok: true, dir, n, missing };
});
ipcMain.handle('file:open', async (_e, p) => { const err = await shell.openPath(String(p || '')); return err ? { ok: false, msg: err } : { ok: true }; });
ipcMain.handle('file:show', (_e, p) => { shell.showItemInFolder(String(p || '')); return true; });

/* ---------------- التقارير الشهرية لدوائر المقيم (mr) ----------------
   تُجلب من تطبيق Google Apps Script (رابط .../exec + رمز لوحة القسم) بطلب POST. الطلب يمر عبر السكربت لا عبر صلاحية البرنامج في Drive (drive.file)،
   فيرى تقارير ملفاتها أنشأها السكربت. ملفات PDF تُنزَّل الى «تقارير-المقيمين» في مجلد البيانات فتُفتح دون إنترنت. */
const mrFromView = e => !!views.mr && e.sender === views.mr.webContents;
const mrSafe = s => String(s || '').replace(/[\\/:*?"<>|\r\n]+/g, ' ').trim().slice(0, 60) || 'بلا-اسم';
const mrPath = r => path.join(dataDir, 'تقارير-المقيمين', mrSafe(r.project), mrSafe(r.month) + '-' + mrSafe(r.resident) + '.pdf');
function mrCall(body) {
  return new Promise((resolve, reject) => {
    const p = prefs(), url = String(p.mrUrl || '').trim(), code = String(p.mrCode || '');
    if (!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(url)) return reject(new Error('أدخل رابط تطبيق Apps Script الصحيح (ينتهي بـ /exec)'));
    if (!code) return reject(new Error('أدخل رمز لوحة القسم'));
    const req = require('electron').net.request({ method: 'POST', url, redirect: 'follow' });
    req.setHeader('Content-Type', 'text/plain;charset=utf-8');
    const timer = setTimeout(() => { try { req.abort(); } catch (_) {} reject(new Error('انتهت مهلة الاتصال')); }, 90000);
    req.on('response', res => {
      const chunks = []; res.on('data', c => chunks.push(c));
      res.on('end', () => { clearTimeout(timer);
        try { const j = JSON.parse(Buffer.concat(chunks).toString('utf8')); j && j.ok ? resolve(j) : reject(new Error((j && j.error) || 'رفض الخادم الطلب')); }
        catch (_) { reject(new Error('ردّ غير مفهوم من الخادم: تأكد من نشر السكربت بالوصول Anyone ومن آخر إصدار منه')); } });
    });
    req.on('error', err => { clearTimeout(timer); reject(new Error('تعذر الاتصال: ' + (err && err.message || err))); });
    req.write(JSON.stringify(Object.assign({ code }, body))); req.end();
  });
}
async function mrFetchPdf(r) {
  const f = mrPath(r); if (fs.existsSync(f)) return f;
  const j = await mrCall({ action: 'pdf', id: r.pdfId });
  fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, Buffer.from(String(j.b64 || ''), 'base64')); return f;
}
ipcMain.handle('mr:cfg', (e, set) => { if (!mrFromView(e)) return null; const p = prefs();
  if (set && typeof set === 'object') { if (typeof set.url === 'string') p.mrUrl = set.url.trim(); if (typeof set.code === 'string' && set.code) p.mrCode = set.code; atomicWrite(prefsFile(), JSON.stringify(p)); }
  return { url: p.mrUrl || '', hasCode: !!p.mrCode }; });
ipcMain.handle('mr:pull', async e => { if (!mrFromView(e)) return { error: 'غير مسموح' };
  try { const j = await mrCall({ action: 'list' }), records = Array.isArray(j.records) ? j.records : [], files = {}; let got = 0, failed = 0;
    for (const r of records) { if (!r || !r.id || !r.pdfId) continue; const f = mrPath(r); if (fs.existsSync(f)) { files[r.id] = f; continue; }
      if (got >= 40) continue; try { files[r.id] = await mrFetchPdf(r); got++; } catch (_) { failed++; } }   // أول جلب كبير يُنزَّل على دفعات (40 ملفاً)
    return { ok: true, records, saved: j.saved || '', files, downloaded: got, failed }; }
  catch (err) { return { error: err.message }; } });
ipcMain.handle('mr:pdf', async (e, r) => { if (!mrFromView(e) || !r || !r.pdfId) return { error: 'غير مسموح' };
  try { return { ok: true, path: await mrFetchPdf(r) }; } catch (err) { return { error: err.message }; } });
ipcMain.handle('mr:local', (e, list) => { if (!mrFromView(e) || !Array.isArray(list)) return {}; const o = {};
  list.forEach(r => { try { if (r && r.id && fs.existsSync(mrPath(r))) o[r.id] = mrPath(r); } catch (_) {} }); return o; });
ipcMain.on('spell:langs', e => { try { e.returnValue = session.defaultSession.getSpellCheckerLanguages(); } catch (_) { e.returnValue = []; } });
let printN = 0;
// الطباعة: نافذة الطباعة لا تظهر بثبات من داخل تبويبات البرنامج (BrowserView)، لذلك تُنسخ الصفحة الجاهزة للطباعة
// إلى نافذة طباعة مخفية مستقلة وتُطبع منها. إن فشل ذلك تُطبع من التبويب نفسه، وإن فشل أيضاً تُحفظ PDF وتُفتح للطباعة.
const PRINT_SNAP = `(()=>{const d=document.documentElement.cloneNode(true);d.querySelectorAll('script,noscript').forEach(s=>s.remove());
  const src=document.querySelectorAll('input,textarea,select'),dst=d.querySelectorAll('input,textarea,select');
  src.forEach((el,i)=>{const c=dst[i];if(!c)return;if(el.tagName==='TEXTAREA')c.textContent=el.value;else if(el.tagName==='SELECT'){[...c.options].forEach((o,k)=>{if(k===el.selectedIndex)o.setAttribute('selected','');else o.removeAttribute('selected');});}else if(el.type==='checkbox'||el.type==='radio'){if(el.checked)c.setAttribute('checked','');else c.removeAttribute('checked');}else c.setAttribute('value',el.value);});
  document.querySelectorAll('canvas').forEach((cv,i)=>{const c=d.querySelectorAll('canvas')[i];try{if(c){const im=document.createElement('img');im.src=cv.toDataURL();im.style.cssText=cv.style.cssText;im.className=cv.className;im.width=cv.width;im.height=cv.height;c.replaceWith(im);}}catch(_){}});
  const h=d.querySelector('head');if(h){const b=document.createElement('base');b.href=location.href;h.insertBefore(b,h.firstChild);}
  return '<!doctype html>'+d.outerHTML;})()`;
/* الخطوط المحفوظة داخل البرنامج (مثل PT Bold Heading للتوقيع) تُحمَّل في الصفحة بـ FontFace ولا تنتقل مع نسخة الطباعة،
   فتُضاف إلى نسخة الطباعة صراحةً حتى يُطبع الخط نفسه الظاهر على الشاشة */
function fontFaces(html) { let L = []; try { L = fontStore && fontStore.savedFonts ? fontStore.savedFonts() : []; } catch (_) { L = []; }
  const used = new Set((Array.isArray(html) ? html : []).map(x => String(x).toLowerCase())), low = typeof html === 'string' ? html.toLowerCase() : '';
  L = L.filter(f => f && f.family && f.buf && (used.size ? used.has(String(f.family).toLowerCase()) : low.includes(String(f.family).toLowerCase())));   // الخطوط المستعملة فعلاً في عناصر الصفحة فقط (لا كل الخطوط المذكورة في قوائم الإعدادات)
  if (!L.length) return { css: '', fams: [] };
  const q = s => String(s).replace(/['"\\<>]/g, '');
  const mime = f => /\.otf$/i.test(f.file || '') ? 'font/otf' : 'font/ttf';
  // الخط مضمَّن في نسخة الطباعة نفسها (data:) لا مسار على القرص: لا تمنعه المسارات العربية أو OneDrive أو قيود الملفات المحلية
  const css = '<style id="anbar-print-fonts">' + L.map(f => `@font-face{font-family:'${q(f.family)}';src:url(data:${mime(f)};base64,${Buffer.from(f.buf).toString('base64')});font-weight:${+f.weight || 400};font-style:${f.italic ? 'italic' : 'normal'}}`).join('') + '</style>';
  return { css, fams: [...new Set(L.map(f => q(f.family)))] };
}
async function printViaWindow(sender, toPdf) {
  let html = await sender.executeJavaScript(PRINT_SNAP, true);
  const usedF = await sender.executeJavaScript(`(()=>{const S=new Set();for(const el of document.querySelectorAll('body *')){const f=getComputedStyle(el).fontFamily;if(f)f.split(',').forEach(x=>S.add(x.trim().replace(/^["']|["']$/g,'')));}return [...S]})()`, true).catch(() => null);
  const ff = fontFaces(usedF && usedF.length ? usedF : html);
  if (ff.css) html = html.replace(/<head([^>]*)>/i, m => m + ff.css);
  const tmp = path.join(app.getPath('temp'), 'anbar-print-' + Date.now() + '.html');
  fs.writeFileSync(tmp, html, 'utf8');
  const w = new BrowserWindow({ show: false, width: 900, height: 1200, skipTaskbar: true, webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, javascript: true, backgroundThrottling: false } });
  try {
    await w.loadFile(tmp);
    // كل خطوط الصفحة (المضمّنة في الصفحة وخطوط البرنامج) تُحمَّل كاملةً قبل الطباعة، لا عند الحاجة، حتى لا يُطبع خط بديل
    await w.webContents.executeJavaScript('(async()=>{try{const L=[];document.fonts.forEach(f=>{if(f.status!=="loaded")L.push(f.load().catch(()=>0));});await Promise.race([Promise.all(L),new Promise(r=>setTimeout(r,10000))]);}catch(_){}return 1})()', true).catch(() => {});
    await w.webContents.executeJavaScript('(document.fonts&&document.fonts.ready?document.fonts.ready:Promise.resolve()).then(()=>Promise.all([...document.images].map(i=>i.complete?1:new Promise(r=>{i.onload=i.onerror=r;})))).then(()=>1)', true).catch(() => {});
    if (ff.fams.length) {   // تحميل خطوط البرنامج صراحةً قبل الطباعة، والتأكد منها؛ إن تعذّر أحدها تُطبع الصفحة من التبويب نفسه (فيه الخطوط)
      const okF = await w.webContents.executeJavaScript(`(async()=>{const F=${JSON.stringify(ff.fams)},T='المهندس قاسم محمد رشيد';const all=Promise.all(F.flatMap(f=>['400','700'].map(wt=>document.fonts.load(wt+' 20px "'+f+'"',T).catch(()=>0))));await Promise.race([all,new Promise(r=>setTimeout(r,8000))]);await document.fonts.ready;return F.every(f=>document.fonts.check('20px "'+f+'"',T));})()`, true).catch(() => false);
      if (!okF && !toPdf) return 'error:fonts';
    }
    if (toPdf) return await w.webContents.printToPDF({ printBackground: true, preferCSSPageSize: true, pageSize: 'A4', margins: { top: 0, bottom: 0, left: 0, right: 0 } });
    return await new Promise(res => w.webContents.print({ silent: false, printBackground: true, margins: { marginType: 'none' } }, (ok, why) => res(ok ? 'ok' : (/cancel/i.test(why || '') ? 'cancel' : 'error:' + (why || '')))));
  } finally { // تبقى نافذة الطباعة حيّة دقيقتين: إغلاقها مبكراً يلغي مهمة الطباعة قبل وصولها إلى الطابعة
    setTimeout(() => { try { w.destroy(); } catch (_) {} try { fs.unlinkSync(tmp); } catch (_) {} }, 120000); }
}
const printCfgFile = () => path.join(dataDir, 'print.json');
let printViaPdfOnce = false;
function printPdfAlways() { try { return !!JSON.parse(fs.readFileSync(printCfgFile(), 'utf8')).pdf; } catch (_) { return false; } }
function setPrintPdfAlways(v) { try { fs.writeFileSync(printCfgFile(), JSON.stringify({ pdf: !!v })); } catch (_) {} }
async function printAsPdf(sender) {
  const buf = await sender.printToPDF({ printBackground: true, preferCSSPageSize: true, pageSize: 'A4', margins: { top: 0, bottom: 0, left: 0, right: 0 } });
  const p = path.join(app.getPath('temp'), 'طباعة-' + Date.now() + '.pdf');
  fs.writeFileSync(p, buf); const err = await shell.openPath(p);
  if (err) dialog.showMessageBox(win, { type: 'warning', title: 'الطباعة', message: 'تم حفظ الملف لكن تعذّر فتحه: ' + p });
  return 'ok';
}
ipcMain.handle('print:do', async (e) => {
  if (mailCapture) { const res = mailCapture; mailCapture = null;
    try { const buf = await printViaWindow(e.sender, true); let t = ''; try { t = await e.sender.executeJavaScript('document.title'); } catch (_) {}
      const id = Object.keys(views).find(k => views[k] && views[k].webContents === e.sender); const base = (APPS[id] ? APPS[id].title : 'مستند');
      res({ buf, name: (t && !/^(نظام|index)/.test(t) ? t : base + ' ' + new Date().toISOString().slice(0, 10)).replace(/[\\/:*?"<>|]+/g, '_').slice(0, 120) }); return 'ok'; }
    catch (_) { res(null); return 'error'; } }
  try {
    if ((printViaPdfOnce || printPdfAlways()) && !process.env.UNI_TEST_SAVE_DIR) { printViaPdfOnce = false; return await printAsPdf(e.sender); }
    if (process.env.UNI_TEST_SAVE_DIR) {
      const buf = await printViaWindow(e.sender, true); // نفس مسار الطباعة الحقيقي (نسخة الصفحة في نافذة الطباعة) لكن إلى PDF
      fs.writeFileSync(path.join(process.env.UNI_TEST_SAVE_DIR, `print-${++printN}.pdf`), buf);
      if (process.env.UNI_TEST_PRINT_REF) fs.writeFileSync(path.join(process.env.UNI_TEST_PRINT_REF, `ref-${printN}.pdf`), await e.sender.printToPDF({ printBackground: true, preferCSSPageSize: true, pageSize: 'A4', margins: { top: 0, bottom: 0, left: 0, right: 0 } }));
      return 'ok';
    }
    let r = 'error';
    try { r = await printViaWindow(e.sender); } catch (_) { r = 'error'; }
    if (r === 'ok' || r === 'cancel') return r;
    try { r = await new Promise(res => e.sender.print({ silent: false, printBackground: true, margins: { marginType: 'none' } }, (ok, why) => res(ok ? 'ok' : (/cancel/i.test(why || '') ? 'cancel' : 'error')))); } catch (_) { r = 'error'; }
    if (r === 'ok' || r === 'cancel') return r;
    // آخر حل: PDF يُفتح في قارئ PDF للطباعة منه
    await printAsPdf(e.sender);
    dialog.showMessageBox(win, { type: 'info', title: 'الطباعة', message: 'تعذّر فتح نافذة الطباعة مباشرة، فتم فتح الملف بصيغة PDF — اطبعه من القارئ (Ctrl+P).' });
    return 'ok';
  } catch (_) { return 'error'; }
});
/* طباعة/PDF لصفحة HTML يولّدها الموقف (تقرير مشروع أو أكثر): نافذة مخفية ثم نافذة الطباعة، أو حفظ PDF */
let repPrintN = 0;
ipcMain.handle('report:print', async (_e, html, mode, name) => {
  const tmp = path.join(app.getPath('temp'), 'anbar-report-' + Date.now() + '.html');
  const w = new BrowserWindow({ show: false, width: 900, height: 1200, skipTaskbar: true, webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, javascript: false, backgroundThrottling: false } });
  try {
    let logo = ''; try { logo = 'data:image/png;base64,' + fs.readFileSync(path.join(__dirname, 'shell', 'logo.png')).toString('base64'); } catch (_) {}
    fs.writeFileSync(tmp, String(html || '').replace(/__LOGO__/g, logo), 'utf8'); await w.loadFile(tmp);
    await new Promise(r => setTimeout(r, 300));
    const pdf = () => w.webContents.printToPDF({ printBackground: true, preferCSSPageSize: true, pageSize: 'A4', margins: { top: 0, bottom: 0, left: 0, right: 0 } });
    if (process.env.UNI_TEST_SAVE_DIR) { fs.writeFileSync(path.join(process.env.UNI_TEST_SAVE_DIR, `report-${++repPrintN}.pdf`), await pdf()); return 'ok'; }
    if (mode === 'pdf') { const p = await askPath(String(name || 'تقرير-مشروع').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 120) + '.pdf'); if (!p) return 'cancel'; fs.writeFileSync(p, await pdf()); shell.openPath(p); return 'ok'; }
    const r = await new Promise(res => w.webContents.print({ silent: false, printBackground: true, margins: { marginType: 'none' } }, (ok, why) => res(ok ? 'ok' : (/cancel/i.test(why || '') ? 'cancel' : 'error'))));
    if (r !== 'error') return r;
    const p = path.join(app.getPath('temp'), 'تقرير-' + Date.now() + '.pdf'); fs.writeFileSync(p, await pdf()); shell.openPath(p); return 'ok';
  } catch (_) { return 'error'; }
  finally { setTimeout(() => { try { w.destroy(); } catch (_) {} try { fs.unlinkSync(tmp); } catch (_) {} }, 120000); }
});
ipcMain.handle('pdf:save', async (e, name) => {
  try {
    const p = await askPath(name); if (!p) return 'cancel';
    const buf = await e.sender.printToPDF({ printBackground: true, preferCSSPageSize: true, pageSize: 'A4', margins: { top: 0, bottom: 0, left: 0, right: 0 } });
    fs.writeFileSync(p, buf);
    if (!process.env.UNI_TEST_SAVE_DIR) shell.openPath(p);
    return 'ok';
  } catch (_) { return 'error'; }
});
ipcMain.on('data:tomb', (_e, id, rid) => { if (okId(id) && sync && rid) { sync.tomb(id, String(rid), Date.now()); sync.changed(); } });
ipcMain.on('sync:get', e => { e.returnValue = sync ? sync.getConfig() : null; });
ipcMain.handle('sync:set', (_e, c) => (sync ? sync.setConfig(c) : false));
ipcMain.handle('sync:now', () => (sync ? sync.syncNow() : false));
ipcMain.handle('sync:discover', (_e, key) => (sync ? sync.discover(key) : []));
// نوافذ الحوار (كلمة السر، المزامنة...) تُرسم داخل الصفحة الرئيسية، فيجب إخفاء نافذة النظام المفتوح أثناء ظهورها وإلا اختفت خلفه وغطّت الشريط العلوي
let modalOpen = false;
/* ملء الشاشة لمركز المتابعة: النافذة كلها، ويُخفى الشريط العلوي والتذييل في الواجهة */
ipcMain.handle('ui:fullscreen', (_e, on) => { if (!win) return false; win.setFullScreen(on == null ? !win.isFullScreen() : !!on); return win.isFullScreen(); });
const uiCmd = c => { if (win && !win.isDestroyed()) win.webContents.send('ui:cmd', c); };
ipcMain.on('ui:modal', (_e, open) => {
  modalOpen = !!open; if (!win) return;
  if (modalOpen) win.setBrowserView(null);
  else if (!PAGES.has(current) && views[current]) { win.setBrowserView(views[current]); layout(); }
});
ipcMain.handle('nav:go', (_e, id, fileNo) => go(id, fileNo));

/* ---------------- نظام الاستلام (خادم Go محلي) ---------------- */
function acExe() {
  if (process.env.ANBAR_AC_EXE) return process.env.ANBAR_AC_EXE;
  if (app.isPackaged) return path.join(process.resourcesPath, 'acceptance', 'AcceptanceCertificates.exe');
  return path.join(__dirname, 'build', 'acceptance', process.platform === 'win32' ? 'AcceptanceCertificates.exe' : 'AcceptanceCertificates');
}
/* خادم استلام عالق من تشغيل سابق انتهى بشكل غير طبيعي (إصدار قديم بلا مراقبة الأنبوب): يحجز المنفذ برمز جلسة قديم فتظهر صفحة الاستلام فارغة.
   قبل التشغيل: من يستمع على منفذ الاستلام؟ إن كان برنامج الاستلام نفسه (بالاسم) يُوقف. المنفذ ثابت لأن سجلات الاستلام محفوظة في تخزين الصفحة المرتبط به */
/* يُوقَف فقط إن رفض رمز جلسة هذا التشغيل (403): خادم مدمج من جلسة سابقة. برنامج الاستلام المستقل (بلا رمز) يقبل الطلب فلا يُمس */
function staleAcceptance() {
  return new Promise(res => { const r = http.get(`http://127.0.0.1:${AC_PORT}/acq-reg.js?t=${AC_TOKEN}`, x => { x.resume(); res(x.statusCode === 403); }); r.on('error', () => res(false)); r.setTimeout(1500, () => { r.destroy(); res(false); }); });
}
function freeStaleAcceptance(exe) {
  try {
    const cp = require('child_process'), name = path.basename(exe).toLowerCase(), port = String(AC_PORT);
    if (process.platform === 'win32') {
      const out = cp.execFileSync('netstat', ['-ano', '-p', 'TCP'], { encoding: 'utf8', windowsHide: true, timeout: 4000 });
      const pids = [...new Set(out.split(/\r?\n/).filter(l => new RegExp(`127\\.0\\.0\\.1:${port}\\s`).test(l) || new RegExp(`0\\.0\\.0\\.0:${port}\\s`).test(l)).map(l => l.trim().split(/\s+/).pop()).filter(x => /^\d+$/.test(x) && x !== '0' && x !== String(process.pid)))];
      for (const pid of pids) {
        const t = cp.execFileSync('tasklist', ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH'], { encoding: 'utf8', windowsHide: true, timeout: 4000 }).toLowerCase();
        if (t.includes(name)) { cp.execFileSync('taskkill', ['/F', '/PID', pid], { windowsHide: true, timeout: 4000 }); logError('acceptance', 'أُوقف خادم استلام عالق من تشغيل سابق (PID ' + pid + ')'); }
      }
    } else {
      const out = cp.execFileSync('sh', ['-c', `(ss -ltnpH 'sport = :${port}' 2>/dev/null | grep -o 'pid=[0-9]*' | cut -d= -f2; lsof -t -iTCP:${port} -sTCP:LISTEN 2>/dev/null) || true`], { encoding: 'utf8', timeout: 4000 });
      for (const m of new Set(out.split(/\s+/).filter(x => /^\d+$/.test(x)))) { const pid = +m; let cmd = ''; try { cmd = fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8').toLowerCase(); } catch (_) {}
        if (pid !== process.pid && cmd.includes(name)) { try { process.kill(pid); logError('acceptance', 'أُوقف خادم استلام عالق (PID ' + pid + ')'); } catch (_) {} } }
    }
  } catch (_) {}
}
async function startAcceptance() {
  try {
    const exe = acExe();
    if (!fs.existsSync(exe)) return;
    if (await staleAcceptance()) { freeStaleAcceptance(exe); await new Promise(r => setTimeout(r, 500)); }
    acProc = spawn(exe, [], { env: { ...process.env, ANBAR_EMBEDDED: '1', ANBAR_TOKEN: AC_TOKEN, ANBAR_PORT: String(AC_PORT), ANBAR_STDIN_WATCH: '1' }, stdio: ['pipe', 'ignore', 'ignore'], windowsHide: true });
    try { acProc.stdin.on('error', () => {}); } catch (_) {}
    acProc.on('error', () => { acProc = null; });
    acProc.on('exit', () => { acProc = null; });
  } catch (_) {}
}
function stopAcceptance() {
  try { http.get(`http://127.0.0.1:${AC_PORT}/__quit`, r => r.resume()).on('error', () => {}); } catch (_) {}
  try { if (acProc) acProc.kill(); } catch (_) {}
}
function waitAcceptance(tries = 40) {
  return acStarting.catch(() => {}).then(() => new Promise(resolve => {
    const t = () => http.get(`http://127.0.0.1:${AC_PORT}/__version`, r => { r.resume(); resolve(true); })
      .on('error', () => (--tries > 0 ? setTimeout(t, 250) : resolve(false)));
    t();
  }));
}

/* ---------------- التبويبات (BrowserView لكل نظام) ---------------- */
function external(wc) {
  wc.setWindowOpenHandler(({ url }) => { if (/^https?:/i.test(url) && !url.startsWith(`http://127.0.0.1:${AC_PORT}`)) shell.openExternal(url); return { action: url.startsWith(`http://127.0.0.1:${AC_PORT}`) ? 'allow' : 'deny' }; });
  wc.on('will-navigate', (e, url) => {
    if (url.startsWith('file:') || url.startsWith(`http://127.0.0.1:${AC_PORT}`)) return;
    e.preventDefault(); if (/^https?:/i.test(url)) shell.openExternal(url);
  });
}
function ensureView(id) {
  if (views[id]) return views[id];
  const a = APPS[id];
  const wp = { contextIsolation: true, nodeIntegration: false, sandbox: false, spellcheck: id === 'lt' || id === 'fu' || id === 'dm' || id === 'cm' };
  if (a.file) { wp.preload = path.join(__dirname, 'preload.js'); wp.additionalArguments = ['--app-id=' + id]; }
  else if (id === 'ac') wp.preload = path.join(__dirname, 'preload-ac.js');
  const v = new BrowserView({ webPreferences: wp });
  views[id] = v;
  external(v.webContents); watch(v.webContents, id);
  // window.print() لا تفتح نافذة الطباعة داخل BrowserView؛ تُحوَّل إلى طباعة البرنامج
  v.webContents.on('dom-ready', () => { v.webContents.executeJavaScript("if(window.desktop&&window.desktop.print){window.print=function(){return window.desktop.print();};}").catch(() => {}); });
  if (GLASS_IDS.has(id)) v.webContents.on('dom-ready', () => { v.webContents.__glassKey = null; applyGlass(v.webContents); });   // المظهر يُعاد بعد كل تحميل للصفحة
  if (['ad', 'co', 'du', 'ac'].includes(id)) v.webContents.on('did-finish-load', () => { const js = flowPanelJs(id); if (js) v.webContents.executeJavaScript(js).catch(e => logError('flowpanel-' + id, String(e && e.message || e))); });
  /* «📎 كشف كميات السلفة» و«📊 مقارنة كميات السلف» في تدقيق السلف (adqty.js) */
  if (id === 'ad') v.webContents.on('did-finish-load', () => { try { v.webContents.executeJavaScript(fs.readFileSync(path.join(__dirname, 'adqty.js'), 'utf8') + ';1').catch(e => logError('adqty', String(e && e.message || e))); } catch (_) {} });
  /* كاتب Excel المشترك لأوامر التغيير («⬇ حفظ المراجعة (Excel)») */
  if (id === 'co') v.webContents.on('did-finish-load', () => { try { v.webContents.executeJavaScript(fs.readFileSync(path.join(__dirname, 'shell', 'xlwriter.js'), 'utf8') + ';1').catch(e => logError('xlw-co', String(e && e.message || e))); } catch (_) {} });
  /* «☁ إصدار ورفع إلى Drive» في المخاطبات والمطالعات والسلف والمدد وتقارير الزيارة (gdissue.js) */
  if (['lt', 'dm', 'cm', 'co', 'ad', 'du', 'fv', 'zc'].includes(id)) v.webContents.on('did-finish-load', () => { try { const js = fs.readFileSync(path.join(__dirname, 'gdissue.js'), 'utf8').replace("'__SYS__'", JSON.stringify(id)); v.webContents.executeJavaScript(js).catch(e => logError('gdissue-' + id, String(e && e.message || e))); } catch (_) {} });
  /* نظام الاستلام: لقطة الشهادات للوحة + تنبيه رمز QR عند الإصدار (acaddon.js) — يُحقن في كل صفحة من صفحاته */
  if (id === 'ac') v.webContents.on('did-finish-load', () => { try { const js = fs.readFileSync(path.join(__dirname, 'acaddon.js'), 'utf8'); v.webContents.executeJavaScript(js).catch(e => logError('acaddon', String(e && e.message || e))); } catch (_) {} });
  v.webContents.on('before-input-event', touchActivity);
  v.webContents.on('render-process-gone', (_e, d) => {
    if (v.__unloading) return;
    /* توقفت وهي في الخلفية (المستخدم في تبويب آخر): تُعاد بصمت بلا رسالة — السبب يُكتب في errors.log */
    if (current !== id) { logError(id, 'background view reloaded after render-process-gone: ' + (d && d.reason || '')); setTimeout(() => { try { if (!v.webContents.isDestroyed()) v.webContents.reload(); } catch (_) {} }, 1500); return; }
    dialog.showMessageBox(win, { type: 'error', title: 'خطأ', message: 'توقفت واجهة «' + a.title + '» بشكل غير متوقع. بياناتك محفوظة في ملف البيانات، وسيُعاد تحميلها الآن.' }).then(() => v.webContents.reload());
  });
  if (a.file) v.webContents.loadFile(path.join(__dirname, a.file), a.query ? { query: a.query } : undefined);
  else waitAcceptance().then(ok => {
    if (ok) v.webContents.loadURL(a.url + '?t=' + AC_TOKEN);
    else v.webContents.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent('<body dir="rtl" style="font-family:Tahoma;padding:40px"><h2>تعذّر تشغيل نظام الاستلام</h2><p>لم يُعثر على ملف AcceptanceCertificates.exe المرفق أو المنفذ 47831 مشغول ببرنامج آخر.</p></body>'));
  });
  return v;
}
function layout() {
  if (!win) return;
  const b = win.getContentBounds(), v = views[current];
  if (v) v.setBounds({ x: 0, y: TOP, width: b.width, height: Math.max(0, b.height - TOP - FOOT) });
}
function loaded(v) {
  return new Promise(res => {
    const wc = v.webContents;
    if (!wc.isLoading() && wc.getURL()) return res();
    wc.once('did-finish-load', () => setTimeout(res, 150));
  });
}
async function go(id, fileNo) {
  if (!PAGES.has(id) && (VIEWER || !APPS[id])) return false;
  touchActivity();
  if (!PAGES.has(id) && !isOpen(id)) { win.webContents.send('auth:ask', { id, title: APPS[id].title, fileNo: fileNo || '' }); sendState(); return false; }
  if (current !== id && views[current]) viewLeft[current] = Date.now();
  current = id;
  if (PAGES.has(id)) { win.setBrowserView(null); if (id === 'sit' || id === 'cc') LINK_SYS.forEach(s => refreshLinksSoon(s, 300)); }
  else {
    const v = ensureView(id); v.webContents.__bgLinks = false;   /* فتحه المستخدم: يحفظ كالمعتاد */
    if (!modalOpen) win.setBrowserView(v);
    layout(); if (!modalOpen) v.webContents.focus();
    if (fileNo && id !== 'ac') {
      await loaded(v);
      try { await v.webContents.executeJavaScript(`window.__openProject&&window.__openProject(${JSON.stringify(String(fileNo))})`); } catch (_) {}
    }
  }
  sendState();
  return true;
}
/* ---------------- تفريغ الأنظمة غير المستعملة من الذاكرة ----------------
   كل نظام مفتوح يبقى صفحة كاملة في الذاكرة (150–250 م.ب). النظام الذي لم يُعرض منذ 15 دقيقة يُحفظ ثم يُفرَّغ،
   ويُعاد تحميله من ملف بياناته عند الرجوع إليه (أقل من ثانية). لا يشمل النظام المعروض، ولا الاستلام، ولا نظاماً يكتب الآن.
   الحفظ قبل التفريغ بالمسار نفسه الذي يحفظ به كل نظام عند إغلاق البرنامج (beforeunload ← حفظ متزامن). */
const UNLOAD_MS = +process.env.UNI_UNLOAD_MS || 15 * 60 * 1000;
const UNLOADABLE = new Set(['co', 'du', 'ad', 'in', 'lt', 'fu', 'ar', 'dm', 'cm', 'fv', 'mr', 'zc']);
const viewLeft = {};
const unloadOn = () => !prefs().unloadOff;
/* ---------------- ملخص الموقف من السلف وأوامر التغيير ----------------
   الموقف العام يقارن بملخص يكتبه نظام السلف ونظام أوامر التغيير (syncLinks) حين يكون النظام محمّلاً على هذه الحاسبة.
   كانت بيانات تصل بالمزامنة أو يُفرَّغ النظام من الذاكرة فيبقى الملخص قديماً ويظهر «خلل» يختفي بمجرد فتح النظام.
   الآن: عند تغيّر بيانات النظام وهو غير محمّل، وعند فتح «الموقف العام» والملخص أقدم من البيانات، يُحمَّل النظام في الخلفية
   (غير ظاهر ولا يطلب كلمة سر ولا يعرض شيئاً) فيُعاد حساب الملخص من بياناته الحالية، ثم يُفرَّغ. */
const LINK_SYS = ['co', 'ad'], linksAt = {}, linksBusy = {}, linksT = {};
const dataMtime = id => { try { return fs.statSync(dataFile(id)).mtimeMs; } catch (_) { return 0; } };
async function refreshLinks(id, force) {
  if (!LINK_SYS.includes(id) || linksBusy[id] || process.env.UNI_NO_LINKREFRESH) return false;
  const m = dataMtime(id); if (!m) return false;
  const live = views[id] && !views[id].__unloading;
  if (!live && !force && linksAt[id] && linksAt[id] >= m) return false;
  linksBusy[id] = true; let bg = false;
  try {
    if (!live) { bg = true; ensureView(id).webContents.__bgLinks = true; }
    const v = views[id];
    await Promise.race([loaded(v), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 30000))]);
    if (bg) await new Promise(r => setTimeout(r, 700));   /* تحميل البيانات وترحيلها أولاً */
    await v.webContents.executeJavaScript('(()=>{try{if(typeof syncLinks==="function")syncLinks();}catch(_){}return 1})()', true);
    if (bg && current !== id && views[id] === v) {   /* تفريغ بلا حفظ: لم يُعدَّل شيء فيه، وحفظ الإغلاق يغيّر وقت الملف فيُرسل بالمزامنة بلا داعٍ */
      v.__noSave = true; delete views[id]; delete viewLeft[id];
      try { if (win && !win.isDestroyed() && win.getBrowserView() === v) win.setBrowserView(null); } catch (_) {}
      try { if (typeof v.webContents.destroy === 'function') v.webContents.destroy(); else v.webContents.loadURL('about:blank'); } catch (_) {}
    }
    linksAt[id] = Math.max(Date.now(), dataMtime(id));
    try { if (win && !win.isDestroyed()) win.webContents.send('sync:data', { ds: 'reg' }); } catch (_) {}
    return true;
  } catch (e) { logError('links-' + id, String(e && e.message || e)); return false; }
  finally { linksBusy[id] = false; }
}
const refreshLinksSoon = (id, ms) => { clearTimeout(linksT[id]); linksT[id] = setTimeout(() => refreshLinks(id).catch(() => {}), ms == null ? 2500 : ms); };
async function unloadView(id) {
  const v = views[id]; if (!v || id === current || !UNLOADABLE.has(id) || v.__unloading) return false;
  const q = SAVEQ[id]; if (q && q.busy) return false;   // حفظ جارٍ: يُؤجَّل للدورة التالية
  const wc = v.webContents; if (wc.isDestroyed()) { delete views[id]; return true; }
  if (wc.isLoading()) return false;
  v.__unloading = true;
  try { await Promise.race([wc.executeJavaScript("window.dispatchEvent(new Event('beforeunload'));1", true), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 8000))]); }
  catch (_) { v.__unloading = false; return false; }   // لم يتأكد الحفظ: لا يُفرَّغ
  if (id === current) { v.__unloading = false; return false; }   // عاد إليه المستخدم أثناء الحفظ
  delete views[id]; delete viewLeft[id];
  try { if (win && !win.isDestroyed() && win.getBrowserView() === v) win.setBrowserView(null); } catch (_) {}
  try { if (typeof wc.destroy === 'function') wc.destroy(); else wc.loadURL('about:blank'); } catch (_) {}
  return true;
}
setInterval(() => { if (!unloadOn()) return; const now = Date.now();
  for (const id of Object.keys(views)) if (id !== current && UNLOADABLE.has(id) && now - (viewLeft[id] || now) > UNLOAD_MS) unloadView(id).catch(() => {}); },
  Math.min(60000, Math.max(1000, UNLOAD_MS / 3)));
/* ---------------- المزامنة بين الأجهزة ---------------- */
const acAvailable = () => { try { return fs.existsSync(acExe()); } catch (_) { return false; } };
async function acEval(code) {
  const v = ensureView('ac');
  await Promise.race([loaded(v), new Promise((_, rej) => setTimeout(() => rej(new Error('نظام الاستلام غير جاهز')), 20000))]);
  return v.webContents.executeJavaScript(code, true);
}
function appliedHook(ds) {
  try {
    if (['co', 'du', 'ad', 'in', 'lt', 'fu', 'ar', 'dm', 'cm', 'fv', 'mr', 'zc'].includes(ds) && views[ds]) views[ds].webContents.executeJavaScript('window.__syncReload&&window.__syncReload()').catch(() => {});
    if (LINK_SYS.includes(ds) && !views[ds]) refreshLinksSoon(ds);   /* بيانات وصلت والنظام غير محمّل: يُحدَّث ملخص الموقف في الخلفية */
    if (ds === 'ac' && views.ac && current !== 'ac') views.ac.webContents.reload();
    if (ds === 'arf' && views.ar) views.ar.webContents.executeJavaScript('window.__filesArrived&&window.__filesArrived()').catch(() => {});
    if (win && !win.isDestroyed()) win.webContents.send('sync:data', { ds });
    if (['ad', 'co', 'du'].includes(ds)) flow.reconcile(ds, false).catch(() => {}).then(flowNotify);
    if (ds === 'wf' || ds === 'wfa') flowNotify();
    if (ds === 'pl') planNote();
  } catch (_) {}
}
/* ---------------- لوحة سير المعاملات (السلف · أوامر التغيير · المدد) ---------------- */
const flow = createFlow({
  dataDir: () => dataDir, readData: id => readData(id), file: id => dataFile(id),
  stamp: id => { try { const st = fs.statSync(dataFile(id)); return st.mtimeMs + ':' + st.size; } catch (_) { return ''; } },
  write: t => atomicWrite(dataFile('wf'), t), changed: () => { if (sync) sync.changed(); flowNotify(); }
});
const flowWho = () => ({ name: audit.who() || '', dev: (() => { try { return (sync && sync.getConfig && (sync.getConfig() || {}).name) || require('os').hostname(); } catch (_) { return ''; } })() });
const FLOW_T = {};
// بعد الحفظ بقليل (لا يؤخر الحفظ نفسه، والحفظات المتتالية تُجمع في فحص واحد)
function flowSoon(id) { if (!['ad', 'co', 'du', 'ac'].includes(id)) return; clearTimeout(FLOW_T[id]); FLOW_T[id] = setTimeout(() => { flow.reconcile(id, true, flowWho()).catch(e => logError('flow', String(e && e.message || e))); }, +process.env.UNI_FLOW_DELAY || 2500); }
let flowWin = null, flowRev = 0;
function flowNotify() { flowRev++; annSoon(); for (const w of [win, flowWin, views.ad, views.co, views.du, views.ac]) { try { if (w && w.webContents && !w.webContents.isDestroyed()) w.webContents.send('wf:changed', flowRev); } catch (_) {} } }
const flowLate = () => { const n = +prefs().wfLate; return n >= 1 && n <= 60 ? n : 5; };
/* متى تُعدّ المعاملة متأخرة (أيام منذ استلامها ما لم تُنجز): لكل نظام — prefs.wfLateBy يغيّرها، وإلا القيم المعتمدة */
const flowLateBy = () => { const d = Object.assign({}, createFlow.LATE_BY); try { const p = prefs().wfLateBy || {}; for (const k of Object.keys(d)) { const n = Math.round(+p[k]); if (n >= 1 && n <= 120) d[k] = n; } } catch (_) {} return d; };
async function flowBoard(amounts) { return { cards: await flow.board({ amounts }), anns: flow.anns(), late: flowLate(), lateBy: flowLateBy(), rev: flowRev, now: Date.now() }; }
ipcMain.handle('wf:board', async () => { const b = await flowBoard(finVisible()); b.fin = finVisible(); b.who = audit.who() || ''; b.open = Object.fromEntries(['ad', 'co', 'du', 'ac'].map(i => [i, isOpen(i)])); b.web = flowWebInfo(); return b; });
const flowCan = sys => ['ad', 'co', 'du', 'ac'].includes(sys) && isOpen(sys);
ipcMain.handle('wf:move', (_e, key, to, why) => { const sys = String(key).slice(0, 2); if (!flowCan(sys)) return { error: 'locked', sys }; if (!audit.who()) return { error: 'who' };
  touchActivity(); const r = flow.move(String(key), String(to), why, flowWho()); if (r.ok) audit.note(sys, 'flow', `لوحة سير المعاملات: ${key} ← ${createFlow.STAGE_NAMES[to] || to}${why ? ' (' + String(why).slice(0, 120) + ')' : ''}`).catch(() => {}); return r; });
ipcMain.handle('wf:add', (_e, key) => { const sys = String(key).slice(0, 2); if (!flowCan(sys)) return { error: 'locked', sys }; if (!audit.who()) return { error: 'who' }; return flow.add(String(key), flowWho()); });
ipcMain.handle('wf:remove', (_e, key) => { const sys = String(key).slice(0, 2); if (!flowCan(sys)) return { error: 'locked', sys };
  const ok = flow.remove(String(key)); if (ok && sync) { try { sync.tomb('wf', String(key), Date.now()); } catch (_) {} } return { ok }; });
/* فتح نظام من لوحة سير المعاملات (نقل / إزالة بطاقة): كلمة سر النظام أو كلمة سر المدير.
   يُقبل الرقم المكتوب بلوحة مفاتيح عربية (٢٠١٠) والمسافات الزائدة في أوله وآخره — دون زيادة عدد المحاولات المحسوبة. */
ipcMain.handle('wf:unlock', (_e, sys, pw) => {
  sys = String(sys || ''); if (!['ad', 'co', 'du', 'ac'].includes(sys)) return false;
  const raw = String(pw == null ? '' : pw), west = raw.replace(/[٠-٩]/g, d => d.charCodeAt(0) - 1632).replace(/[۰-۹]/g, d => d.charCodeAt(0) - 1776);
  const id = AUTHID(sys), cand = [...new Set([raw, raw.trim(), west, west.trim()])];
  const hit = needsAuth(id) ? cand.find(v => hashPw(id, v) === authTable()[id]) : raw;
  if (hit != null) { const r = checkPw(sys, hit); sendState(); return r; }
  const mh = masterHash(); const mHit = cand.find(v => hashPw('master', v) === mh);
  if (mHit != null) { const r = checkMaster(mHit); if (r === true) { unlocked.add(id); audit.note(sys, 'flow', 'فتح النظام من لوحة سير المعاملات بكلمة سر المدير').catch(() => {}); sendState(); } return r; }
  const r = checkPw(sys, raw); sendState(); return r;
});
ipcMain.handle('wf:cands', (_e, q) => flow.candidates(q));
ipcMain.handle('wf:late', (_e, n) => { n = Math.round(+n); if (!(n >= 1 && n <= 60)) return flowLate(); try { const p = prefs(); p.wfLate = n; atomicWrite(prefsFile(), JSON.stringify(p)); } catch (e) { logError('wf:late', String(e && e.message || e)); return flowLate(); } flowNotify(); return n; });
/* عرض اللوحة على شاشة ثانية: نافذة مستقلة للقراءة فقط بملء الشاشة على الشاشة غير الرئيسية (أو بنافذة عادية إن لم توجد شاشة ثانية) */
ipcMain.handle('wf:display', () => {
  if (flowWin && !flowWin.isDestroyed()) { flowWin.close(); return { open: false }; }
  const { screen } = require('electron'); const all = screen.getAllDisplays(), pri = screen.getPrimaryDisplay(), d = all.find(x => x.id !== pri.id);
  const B = d ? d.bounds : { x: undefined, y: undefined, width: 1280, height: 760 };
  flowWin = new BrowserWindow({ x: B.x, y: B.y, width: B.width, height: B.height, fullscreen: !!d, show: false, autoHideMenuBar: true, title: 'لوحة سير المعاملات', backgroundColor: '#0b1220',
    icon: path.join(__dirname, 'build', 'icon.png'), webPreferences: { preload: path.join(__dirname, 'flow-preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  flowWin.setMenuBarVisibility(false); external(flowWin.webContents); watch(flowWin.webContents, 'flow-display');
  flowWin.once('ready-to-show', () => flowWin.show()); flowWin.on('closed', () => { flowWin = null; });
  flowWin.loadFile(path.join(__dirname, 'shell', 'flow-display.html'));
  return { open: true, second: !!d };
});
ipcMain.handle('wfd:board', () => flowBoard(finVisible()));
/* التبليغات: النشر والإخفاء بكلمة سر مدير القسم فقط (يُتحقق منها هنا لا في الواجهة) */
const annWho = () => ({ name: audit.who() || 'مدير قسم الشؤون الهندسية', dev: flowWho().dev });
ipcMain.handle('wf:annPublish', (_e, pw, p) => { const r0 = checkMaster(pw); if (r0 !== true) return { error: r0 === 'wait' ? 'محاولات كثيرة — انتظر دقيقة' : 'كلمة سر المدير غير صحيحة' };
  p = p || {}; let att = null;
  if (p.att && Array.isArray(p.att.pages) && p.att.pages.length) {   /* صفحات JPEG (من الصورة أو صفحات PDF) + PDF الأصلي اختيارياً */
    const pages = p.att.pages.slice(0, WFA_PAGES).map(x => String(x || '').replace(/^data:image\/jpeg;base64,/, ''));
    if (pages.some(x => !/^[A-Za-z0-9+/=]+$/.test(x) || x.length * 0.75 > WFA_PAGE)) return { error: 'صورة المرفق كبيرة أو غير صالحة' };
    const pdf = p.att.pdf ? String(p.att.pdf).replace(/^data:application\/pdf;base64,/, '') : ''; if (pdf && (pdf.length * 0.75 > WFA_PDF || !/^[A-Za-z0-9+/=]+$/.test(pdf))) return { error: 'ملف PDF أكبر من 12 م.ب' };
    att = { type: p.att.type === 'pdf' ? 'pdf' : 'img', name: String(p.att.name || '').slice(0, 160), n: pages.length, pdf: !!pdf, total: +p.att.total || pages.length };
    p.__att = { pages, pdf };
  }
  touchActivity(); const r = flow.annPublish(Object.assign({}, p, { att }), annWho());
  if (r.ok && p.__att) { const now = Date.now(); wfaSave(p.__att.pages.map((d, i) => ({ id: 'annf:' + r.id + ':' + i, ann: r.id, kind: 'page', data: d, updated: now })).concat(p.__att.pdf ? [{ id: 'annf:' + r.id + ':pdf', ann: r.id, kind: 'pdf', data: p.__att.pdf, updated: now }] : [])); }
  if (r.ok) { annSeenAdd(r.id); audit.note('', 'flow', 'تبليغ إلى كافة اللجان: ' + (String(p.text || '').replace(/\s+/g, ' ').slice(0, 140) || '') + (att ? ` [مرفق ${att.type === 'pdf' ? 'PDF' : 'صورة'}: ${att.name}]` : '')).catch(() => {}); }
  return r; });
ipcMain.handle('wf:annHide', (_e, pw, id) => { const r0 = checkMaster(pw); if (r0 !== true) return { error: r0 === 'wait' ? 'محاولات كثيرة — انتظر دقيقة' : 'كلمة سر المدير غير صحيحة' };
  const r = flow.annHide(String(id), annWho()); if (r.ok) audit.note('', 'flow', 'إخفاء تبليغ').catch(() => {}); return r; });
ipcMain.handle('wf:annList', () => flow.anns(true));
/* مفتاح خرائط Google مشترك: يُدخَل في أي حاسبة ويصل إلى بقية الحاسبات بالمزامنة (الشبكة المحلية والسحابة) */
/* فهرس ملفات لجنة تدقيق السلف على هذه الحاسبة (الاضبارة واسم المشروع ورقم العقد وعدد السلف) — للتحقق من ملخص السلف في الموقف */
let adIdxCache = { st: '', v: null };
ipcMain.on('ad:index', e => { if (VIEWER) { e.returnValue = vwReader().adIndex(); return; } try { let st = ''; try { const x = fs.statSync(dataFile('ad')); st = x.mtimeMs + ':' + x.size; } catch (_) {}
  if (st !== adIdxCache.st) { const o = JSON.parse(readData('ad') || '{}'), recs = [];
    (Array.isArray(o.records) ? o.records : []).forEach(r => { const P = r && r.project; if (!P) return; recs.push({ fn: String(P.fileNo || ''), name: String(P.name || ''), cno: String(P.contractNo || ''), n: Array.isArray(r.advances) ? r.advances.length : 0, legacy: !!r.legacy }); });
    adIdxCache = { st, v: { mt: st ? +st.split(':')[0] : 0, recs } }; }
  e.returnValue = adIdxCache.v; } catch (_) { e.returnValue = null; } });
/* 📘 الدليل الاسترشادي: نصوص المستندات المرفقة بالبرنامج (guide/guide-data.json) + ما يضيفه المستخدم على هذه الحاسبة (guide-user.json) */
const guideUserFile = () => path.join(dataDir, 'guide-user.json');
const guideUser = () => { try { const o = JSON.parse(fs.readFileSync(guideUserFile(), 'utf8')); return o && Array.isArray(o.docs) ? o : { docs: [], chunks: [] }; } catch (_) { return { docs: [], chunks: [] }; } };
ipcMain.handle('guide:data', () => { let base = ''; try { base = fs.readFileSync(path.join(__dirname, 'guide', 'guide-data.json'), 'utf8'); } catch (_) {} let user = ''; try { user = fs.readFileSync(guideUserFile(), 'utf8'); } catch (_) {} return { base, user }; });
ipcMain.handle('guide:add', (_e, p) => { try { const d = p && p.doc, C = Array.isArray(p && p.chunks) ? p.chunks : []; if (!d || !d.id || !d.title || !C.length) return { error: 'لا نص في المستند' };
  const o = guideUser(); o.docs = o.docs.filter(x => x.id !== d.id).concat([{ id: String(d.id).slice(0, 40), title: String(d.title).slice(0, 200), short: String(d.short || d.title).slice(0, 60), src: String(d.src || '').slice(0, 300), pages: +d.pages || 0 }]);
  o.chunks = (o.chunks || []).filter(c => c.d !== d.id).concat(C.slice(0, 20000).map(c => ({ d: d.id, p: +c.p || 1, c: '', a: '', t: String(c.t || '').slice(0, 2000) })));
  fs.mkdirSync(dataDir, { recursive: true }); atomicWrite(guideUserFile(), JSON.stringify(o)); return { ok: true }; } catch (e) { return { error: String(e && e.message || e) }; } });
/* نص ملف Word (docx) للدليل: الفقرات من word/document.xml */
ipcMain.handle('guide:docx', (_e, buf) => { try { const z = require('./xlmerge').unzip(Buffer.from(buf)); const x = z.get('word/document.xml'); if (!x) return { error: 'ليس ملف Word (docx) صالحاً' };
  const ent = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
  const text = String(x).split(/<\/w:p>/).map(p => ent((p.match(/<w:t[^>]*>[^<]*<\/w:t>|<w:tab\/>|<w:br\/>/g) || []).map(t => /^<w:t/.test(t) ? t.replace(/<[^>]+>/g, '') : ' ').join(''))).join('\n');
  return { text }; } catch (e) { return { error: String(e && e.message || e) }; } });
ipcMain.handle('guide:del', (_e, id) => { try { id = String(id || ''); const o = guideUser(); o.docs = o.docs.filter(x => x.id !== id); o.chunks = (o.chunks || []).filter(c => c.d !== id); atomicWrite(guideUserFile(), JSON.stringify(o)); return { ok: true }; } catch (e) { return { error: 'تعذّر الحفظ — تحقق من صلاحية الكتابة في مجلد بيانات البرنامج (' + String(e && e.message || e).slice(0, 120) + ')' }; } });
ipcMain.handle('mapkey:get', () => { try { return flow.cfgGet('gmaps'); } catch (_) { return null; } });
ipcMain.handle('mapkey:set', (_e, key) => { key = String(key || '').trim(); if (key && !/^[A-Za-z0-9_\-]{20,80}$/.test(key)) return { error: 'صيغة المفتاح غير صحيحة' };
  try { return flow.cfgSet('gmaps', key, annWho()); } catch (e) { return { error: String(e && e.message || e) }; } });
/* مرفقات التبليغات (صورة أو PDF): صفحات JPEG + ملف PDF الأصلي، سجلات منفصلة في Workflow-Attachments.json (تُزامَن كبقية البيانات،
   ولا تُقرأ إلا عند عرض التبليغ، فلا تبطئ اللوحة). التبليغ المنتهي منذ 3 أيام أو المخفي تُفرَّغ مرفقاته (ليصغر الملف). */
const WFA_PAGE = 3 * 1024 * 1024, WFA_PDF = 12 * 1024 * 1024, WFA_PAGES = 12;
let wfaCache = { st: '', recs: new Map() };
function wfaRecs() { let st = ''; try { const x = fs.statSync(dataFile('wfa')); st = x.mtimeMs + ':' + x.size; } catch (_) {} if (st !== wfaCache.st) { const m = new Map(); try { (JSON.parse(readData('wfa') || '{}').records || []).forEach(r => { if (r && r.id) m.set(r.id, r); }); } catch (_) {} wfaCache = { st, recs: m }; } return wfaCache.recs; }
function wfaSave(add) { let o = {}; try { o = JSON.parse(readData('wfa') || '{}'); } catch (_) {} if (!Array.isArray(o.records)) o.records = []; const idx = new Map(o.records.map((r, i) => [r && r.id, i]));
  for (const r of add) { if (idx.has(r.id)) o.records[idx.get(r.id)] = r; else o.records.push(r); } o.app = 'anbar-wf-attach'; o.version = 1; atomicWrite(dataFile('wfa'), JSON.stringify(o)); if (sync) sync.changed(); }
const wfaOne = (id, k) => { const r = wfaRecs().get('annf:' + id + ':' + k); return r && r.data ? Buffer.from(r.data, 'base64') : null; };
function wfaPrune() { try { const now = Date.now(), keep = new Set(flow.anns(true).filter(a => !a.hidden && +a.until > now - 3 * 864e5).map(a => a.id)); const ch = [];
  for (const r of wfaRecs().values()) if (r.data && !keep.has(r.ann) && /^ann:/.test(r.ann || '')) ch.push(Object.assign({}, r, { data: '', pruned: 1, updated: Math.max(now, (+r.updated || 0) + 1) }));
  if (ch.length) wfaSave(ch); } catch (_) {} }
ipcMain.handle('wf:annPdf', async (_e, id) => { const b = wfaOne(String(id), 'pdf'); if (!b) return 'missing'; const a = flow.anns(true).find(x => x.id === id);
  const f = path.join(app.getPath('temp'), 'تبليغ-' + String((a && a.att && a.att.name) || 'ملف').replace(/[\\/:*?"<>|]+/g, '_').replace(/\.pdf$/i, '') + '.pdf'); fs.writeFileSync(f, b);
  if (process.env.UNI_TEST_SAVE_DIR) return 'ok'; const r = await shell.openPath(f); return r ? 'error' : 'ok'; });
/* الخطوط المضمَّنة (build/fonts داخل ملف البرنامج): تُخدَّم من anbar-font:// وتُعرَّف بـ @font-face في كل صفحات البرنامج عند تحميلها.
   لا تُحمَّل إلا عند استعمال الخط فعلاً، فلا تُبطئ فتح الأنظمة. */
const FONT_DIR = path.join(__dirname, 'build', 'fonts'), fontsCss = require('./shell/fonts-css');
let FONT_CSS = null;
const fontCss = () => { if (FONT_CSS == null) { try { FONT_CSS = fontsCss.css(f => fs.existsSync(path.join(FONT_DIR, f))); } catch (_) { FONT_CSS = ''; } } return FONT_CSS; };
app.whenReady().then(() => { try { protocol.registerBufferProtocol('anbar-font', (req, cb) => { try { const n = path.basename(decodeURIComponent(new URL(req.url).pathname)); const f = path.join(FONT_DIR, n);
  if (!/^[a-z0-9.-]+\.(ttf|otf)$/.test(n) || !fs.existsSync(f)) return cb({ statusCode: 404, data: Buffer.alloc(0) });
  cb({ mimeType: /\.otf$/.test(n) ? 'font/otf' : 'font/ttf', data: fs.readFileSync(f), headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'max-age=31536000' } }); } catch (_) { cb({ statusCode: 404, data: Buffer.alloc(0) }); } }); } catch (_) {} });
app.on('web-contents-created', (_e, wc) => { wc.on('dom-ready', () => { try { const u = wc.getURL(); if (/^https?:/i.test(u) && !/^https?:\/\/(127\.0\.0\.1|localhost)[:/]/i.test(u)) return; const c = fontCss(); if (c) wc.insertCSS(c).catch(() => {}); } catch (_) {} }); });
app.whenReady().then(() => { try { protocol.registerBufferProtocol('anbar-ann', (req, cb) => { try { const u = new URL(req.url); const m = /^\/([^/]+)\/(\d+)\.jpg$/.exec(decodeURIComponent(u.pathname)); const b = m && wfaOne(m[1], m[2]);
  cb(b ? { mimeType: 'image/jpeg', data: b, headers: { 'Cache-Control': 'max-age=3600' } } : { statusCode: 404, mimeType: 'text/plain', data: Buffer.from('') }); } catch (_) { cb({ statusCode: 400, mimeType: 'text/plain', data: Buffer.from('') }); } }); } catch (_) {} setTimeout(wfaPrune, 15000); });
/* على كل حاسبة: التبليغ الجديد يظهر بملء الشاشة فوق البرنامج (حتى داخل الأنظمة) مرة واحدة، ويُغلق بـ«اطّلعت» أو بانتهاء مدته أو إخفائه */
const annSeenList = () => { const L = prefs().annSeen; return Array.isArray(L) ? L : []; };
function annSeenAdd(id) { try { const p = prefs(), L = Array.isArray(p.annSeen) ? p.annSeen : []; if (!L.includes(id)) { L.push(id); p.annSeen = L.slice(-200); atomicWrite(prefsFile(), JSON.stringify(p)); } } catch (_) {} }
ipcMain.handle('wf:annSeen', (_e, id) => { annSeenAdd(String(id)); annSoon(); return true; });
let annT = null;
function annSoon() { clearTimeout(annT); annT = setTimeout(annCheck, 300); }
function annCheck() {
  try { if (!win || win.isDestroyed() || !dataDir) return;
    const A = flow.anns(), seen = new Set(annSeenList()), show = A.find(a => !seen.has(a.id)) || null;
    win.webContents.send('wf:annState', { active: A.map(a => a.id), show });
  } catch (_) {}
}
setInterval(annCheck, 30000);
/* شريط اللوحة داخل السلف وأوامر التغيير والمدد: كل نظام يقرأ ويعدّل معاملاته فقط (والنظام مفتوح بكلمة سره ما دامت صفحته معروضة) */
const flowFrom = (e, key) => { const sys = String(key || '').slice(0, 2); return ['ad', 'co', 'du', 'ac'].includes(sys) && views[sys] && e.sender === views[sys].webContents && isOpen(sys) ? sys : ''; };
ipcMain.handle('wf:get', (e, key) => { const sys = flowFrom(e, key); if (!sys) return null; const c = flow.get(String(key), flowLateBy()[sys] || flowLate()); if (c) c.lateAge = 1; return c; });
ipcMain.handle('wf:set', (e, key, patch) => { const sys = flowFrom(e, key); if (!sys) return { error: 'غير مسموح' }; touchActivity();
  const r = flow.set(String(key), patch && typeof patch === 'object' ? { st: patch.st, why: patch.why, recv: patch.recv } : {}, flowWho());
  if (r.ok && r.card) { r.card.late = flowLateBy()[sys] || flowLate(); r.card.lateAge = 1; }
  if (r.moved) audit.note(sys, 'flow', `لوحة سير المعاملات: ${key} ← ${createFlow.STAGE_NAMES[r.moved] || r.moved}${patch.why ? ' (' + String(patch.why).slice(0, 120) + ')' : ''}`).catch(() => {});
  return r; });
/* نظام الاستلام: لقطة سجلات الشهادات (من الطبقة المحقونة في صفحاته) ← ملف اللقطة، ثم مزامنة اللوحة (إضافة الشهادة الجديدة، و«منجزة» عند إصدارها).
   أول لقطة على هذه الحاسبة: الشهادات الموجودة تُعدّ «معروفة» فلا تُضاف كلها إلى اللوحة دفعة واحدة */
ipcMain.handle('ac:flowSnap', async (e, snap) => { try {
  if (!views.ac || e.sender !== views.ac.webContents || !snap || !Array.isArray(snap.recs)) return false;
  const f = dataFile('ac'), first = !fs.existsSync(f); const t = JSON.stringify({ at: Date.now(), recs: snap.recs.slice(0, 5000) });
  let old = ''; try { old = fs.readFileSync(f, 'utf8'); } catch (_) {} if (old && JSON.parse(old).recs && JSON.stringify(JSON.parse(old).recs) === JSON.stringify(snap.recs.slice(0, 5000))) return true;
  atomicWrite(f, t); if (first) { flow.seenAll('ac'); return true; }
  flowSoon('ac'); return true; } catch (err) { logError('ac:flowSnap', String(err && err.message || err)); return false; } });
/* Google Drive لبريد القسم: إصدار شهادة الاستلام مع رفع PDF تلقائياً، ورمز QR يفتح الملف نفسه عند الجميع (gdrive.js) */
let gd = null; const gdEnsure = () => (gd = gd || require('./gdrive')({ file: () => path.join(dataDir, 'gdrive-config.json'), safeStorage, net: process.env.UNI_GD_NODE ? null : require('electron').net, openExternal: u => { if (process.env.UNI_GD_AUTH && /^http:\/\/127\.0\.0\.1:/.test(u)) require('http').get(u, r => r.resume()).on('error', () => {}); /* اختبار: خادم Google وهمي محلي */ else shell.openExternal(u); }, log: m => logError('gdrive', m) }));
/* ---------------- اللجنة المركزية للمصادقة: الإحالات بين الأنظمة ----------------
   تُنفَّذ داخل واجهة النظام الهدف (تُحمَّل في الخلفية إن لم تكن مفتوحة) فيحفظ بطريقته المعتادة ولا يُكتب ملفه من خارجه */
async function viewCall(id, fn, payload) {
  if (VIEWER || !APPS[id]) return { error: 'غير متاح' };
  const v = ensureView(id); await loaded(v);
  for (let i = 0; i < 20; i++) { const ok = await v.webContents.executeJavaScript(`typeof window.${fn}==='function'`).catch(() => false); if (ok) break; await new Promise(r => setTimeout(r, 250)); }
  return v.webContents.executeJavaScript(`Promise.resolve(typeof window.${fn}==='function'?window.${fn}(${JSON.stringify(payload)}):{error:'nofn'})`).catch(e => ({ error: String(e && e.message || e) }));
}
const fromView = (e, id) => !!(views[id] && e.sender === views[id].webContents);
/* واجهة اللجنة المركزية: التبويب في البرنامج الكامل، أو نافذة نسخة اللجنة (بعد كلمة سرها) */
const fromZc = e => (ZCAPP ? !!(win && e.sender === win.webContents && unlocked.has('zc')) : fromView(e, 'zc') && isOpen('zc'));
let zcD = null, zcC = null;
const zcDept = () => (zcD = zcD || require('./zcremote').createDept({ file: () => path.join(dataDir, 'zc-remote.json'), gd: gdEnsure, safeStorage, log: m => logError('zc-remote', m),
  apply: p => viewCall('du', '__zcApply', p).then(r => { if (r && r.ok) audit.note('du', 'central', `قرار اللجنة المركزية (نسخة اللجنة عبر Drive) للمشروع ${p && p.name || ''}: ${p && p.z && p.z.decision === 'reject' ? 'عدم المصادقة' : (p && p.z && p.z.days) || ''}`).catch(() => {}); return r; }),
  referAll: () => viewCall('du', '__zcReferAll', null) }));
async function zcCall(fn, payload) { if (!win || win.isDestroyed()) return { error: 'غير متاح' }; const wc = win.webContents;
  for (let i = 0; i < 40; i++) { const ok = await wc.executeJavaScript(`typeof window.${fn}==='function'`).catch(() => false); if (ok) break; await new Promise(r => setTimeout(r, 250)); }
  return wc.executeJavaScript(`Promise.resolve(typeof window.${fn}==='function'?window.${fn}(${JSON.stringify(payload)}):{error:'nofn'})`).catch(e => ({ error: String(e && e.message || e) })); }
const zcClient = () => (zcC = zcC || require('./zcremote').createClient({ dir: () => dataDir, gd: gdEnsure, safeStorage, log: m => logError('zc-client', m), deliver: list => (unlocked.has('zc') ? zcCall('__zcIn', list) : null) }));
/* المدد ← المركزية (إحالة/تحديث/سحب): إن لم يكن تبويب المركزية مفتوحاً تُحفظ في صندوق وارد (zc-inbox.json) يقرؤه عند فتحه — لا تُشغَّل صفحته في الخلفية */
const zcInbox = () => path.join(dataDir, 'zc-inbox.json');
const zcInboxRead = () => { try { const o = JSON.parse(fs.readFileSync(zcInbox(), 'utf8')); return o && typeof o === 'object' && !Array.isArray(o) ? o : {}; } catch (_) { return {}; } };
ipcMain.handle('zc:refer', (e, list) => { if (!fromView(e, 'du')) return { error: 'غير مسموح' };
  try { zcDept().queue(list); } catch (err) { logError('zc-remote', String(err && err.message || err)); }   // نسخة اللجنة على حاسبة أخرى (إن رُبطت)
  if (views.zc) return viewCall('zc', '__zcIn', list);
  const q = zcInboxRead(); (Array.isArray(list) ? list : []).forEach(x => { if (x && x.key) q[x.key] = x; }); atomicWrite(zcInbox(), JSON.stringify(q)); return { ok: true, queued: true }; });
/* فتح تبويب المركزية: يطلب من برنامج المدد (على هذه الحاسبة، ومنه ما وصل بالمزامنة) إعادة إرسال كل ما يتجاوز 25% — فلا تفوت إحالة أُرسلت من حاسبة أخرى */
ipcMain.handle('zc:pull', async e => { if (!fromZc(e)) return { error: 'غير مسموح' }; if (ZCAPP) return zcClient().pull(); return viewCall('du', '__zcReferAll', null); });
/* الربط بين حاسبة القسم ونسخة اللجنة المركزية (عبر Drive). في البرنامج الكامل: إنشاء الرمز وإيقافه. في نسخة اللجنة: إدخال الرمز */
ipcMain.handle('zcr:status', (e, withCode) => (!fromZc(e) ? null : ZCAPP ? zcClient().status() : zcDept().status(!!withCode)));
ipcMain.handle('zcr:link', async (e, code) => { if (!fromZc(e)) return { error: 'غير مسموح' };
  const r = ZCAPP ? await zcClient().link(code) : await zcDept().link(); if (r && r.ok) audit.note(ZCAPP ? '' : 'du', 'central', ZCAPP ? 'ربط نسخة اللجنة المركزية بحاسبة القسم' : 'إنشاء رمز ربط نسخة اللجنة المركزية (عبر Google Drive)').catch(() => {}); return r; });
ipcMain.handle('zcr:sync', async e => { if (!fromZc(e)) return { error: 'غير مسموح' }; if (ZCAPP) return zcClient().pull(); const a = await zcDept().push(true); const b = await zcDept().pull(); return a && a.error ? a : b; });
ipcMain.handle('zcr:stop', async e => { if (!fromZc(e)) return { error: 'غير مسموح' }; if (ZCAPP) return zcClient().unlink(); const r = await zcDept().stop(); audit.note('du', 'central', 'إيقاف ربط نسخة اللجنة المركزية وحذف ملفي التبادل من Drive').catch(() => {}); return r; });
ipcMain.handle('zcr:pw', (e, oldPw, newPw) => { if (!ZCAPP || !fromZc(e)) return 'bad'; if (!newPw || String(newPw).length < 4) return 'short'; const r = checkPw('zc', oldPw); if (r !== true) return r === 'wait' ? 'wait' : 'wrong'; saveAuthOverride('zc', hashPw('zc', String(newPw))); return 'ok'; });
/* نافذة القفل في نسخة اللجنة */
ipcMain.on('zcl:state', e => { e.returnValue = ZCAPP ? { first: !authTable().zc } : null; });
ipcMain.handle('zcl:unlock', (e, pw) => { if (!ZCAPP || !win || e.sender !== win.webContents) return false; const r = checkPw('zc', pw); if (r === true) zcOpenMain(); return r; });
ipcMain.handle('zcl:first', (e, pw) => { if (!ZCAPP || !win || e.sender !== win.webContents || authTable().zc) return 'bad'; if (!pw || String(pw).length < 4) return 'short'; saveAuthOverride('zc', hashPw('zc', String(pw))); unlocked.add('zc'); zcOpenMain(); return 'ok'; });
ipcMain.handle('zcl:reset', (e, masterPw, pw) => { if (!ZCAPP || !win || e.sender !== win.webContents) return 'bad'; const r = checkMaster(masterPw); if (r !== true) return r === 'wait' ? 'wait' : 'wrong'; if (!pw || String(pw).length < 4) return 'short'; saveAuthOverride('zc', hashPw('zc', String(pw))); unlocked.add('zc'); zcOpenMain(); return 'ok'; });
function zcOpenMain() { if (!win || win.isDestroyed()) return; touchActivity(); win.loadFile(path.join(__dirname, 'app', 'du.html'), { query: { zc: '1', remote: '1' } }); }
function zcLockScreen() { if (!win || win.isDestroyed()) return; win.loadFile(path.join(__dirname, 'shell', 'zclock.html')); }
function zcAppStart() {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'ملف', submenu: [ { label: 'طباعة', accelerator: 'CmdOrCtrl+P', click: () => win && win.webContents.executeJavaScript("document.querySelector('[data-act=print]')?document.querySelector('[data-act=print]').click():window.print()").catch(() => {}) },
      { label: 'قفل', accelerator: 'CmdOrCtrl+L', click: () => { unlocked.delete('zc'); zcLockScreen(); } }, { label: 'فتح مجلد البيانات', click: () => shell.openPath(dataDir) }, { type: 'separator' }, { label: 'خروج', role: 'quit' } ] },
    { label: 'تحرير', submenu: [ { label: 'تراجع', role: 'undo' }, { label: 'إعادة', role: 'redo' }, { type: 'separator' }, { label: 'قص', role: 'cut' }, { label: 'نسخ', role: 'copy' }, { label: 'لصق', role: 'paste' }, { label: 'تحديد الكل', role: 'selectAll' } ] },
    { label: 'عرض', submenu: [ { label: 'تكبير', accelerator: 'CmdOrCtrl+=', click: () => win && win.webContents.setZoomLevel(win.webContents.getZoomLevel() + 0.5) }, { label: 'تصغير', accelerator: 'CmdOrCtrl+-', click: () => win && win.webContents.setZoomLevel(win.webContents.getZoomLevel() - 0.5) }, { label: 'الحجم الطبيعي', accelerator: 'CmdOrCtrl+0', click: () => win && win.webContents.setZoomLevel(0) } ] } ]));
  win = new BrowserWindow({ width: 1440, height: 920, minWidth: 980, minHeight: 640, show: false, title: 'اللجنة المركزية للمصادقة — محافظة الأنبار', icon: path.join(__dirname, 'build', 'icon.png'), backgroundColor: '#eef2ee',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), additionalArguments: ['--app-id=zc'], contextIsolation: true, nodeIntegration: false, sandbox: false, spellcheck: false } });
  win.webContents.on('dom-ready', () => { win.webContents.__glassKey = null; applyGlass(win.webContents); win.webContents.executeJavaScript("if(window.desktop&&window.desktop.print){window.print=function(){return window.desktop.print();};}").catch(() => {}); });
  external(win.webContents); watch(win.webContents, 'zc'); win.webContents.on('before-input-event', touchActivity);
  /* «☁ إصدار ورفع إلى Drive» لقرار اللجنة (رمز QR = رابط القرار نفسه، كما في المدد وأوامر التغيير) */
  win.webContents.on('did-finish-load', () => { if (!/du\.html/.test(win.webContents.getURL())) return; try { const js = fs.readFileSync(path.join(__dirname, 'gdissue.js'), 'utf8').replace("'__SYS__'", JSON.stringify('zc')); win.webContents.executeJavaScript(js).catch(e => logError('gdissue-zc', String(e && e.message || e))); } catch (_) {} });
  win.once('ready-to-show', () => { win.maximize(); win.show(); });
  zcLockScreen();
  setInterval(() => { if (!unlocked.has('zc') && win && !win.isDestroyed() && /du\.html/.test(win.webContents.getURL())) zcLockScreen(); }, 3000);   // القفل التلقائي بعد عدم النشاط
  zcClient().start();
  global.__uni = { ZCAPP, get win() { return win; }, zcClient, unlocked };
}
ipcMain.handle('zc:inbox', e => { if (ZCAPP || !fromView(e, 'zc')) return []; const q = zcInboxRead(); try { fs.unlinkSync(zcInbox()); } catch (_) {} return Object.values(q); });
ipcMain.handle('zc:decide', async (e, p) => { if (!fromZc(e)) return { error: 'غير مسموح' };
  if (ZCAPP) return zcClient().decide(p);                                  // المركزية ← المدد (قرار المركزية)
  const r = await viewCall('du', '__zcApply', p); if (r && r.ok) audit.note('du', 'central', `قرار اللجنة المركزية للمشروع ${p && p.name || ''}: ${p && p.z && p.z.decision === 'reject' ? 'عدم المصادقة' : (p && p.z && p.z.days) || ''}`).catch(() => {}); return r; });
ipcMain.handle('du:fromCo', (e, p) => (fromView(e, 'co') ? viewCall('du', '__duFromCo', p) : { error: 'غير مسموح' }));          // أوامر التغيير ← المدد (طلب مدة)
ipcMain.handle('zc:open', async (e, key) => { if (!fromView(e, 'du')) return false; await go('zc'); if (isOpen('zc')) viewCall('zc', '__zcOpen', key); return true; });

/* ---------------- نسخة الاطلاع (viewer.js) ---------------- */
/* حاسبة القسم: نشر ملف الاطلاع المشفّر على Drive القسم وتحديثه تلقائياً (كل 10 دقائق إن تغيّر الموقف أو التخطيط أو الصور) */
function adIndexNow() { try { const o = JSON.parse(readData('ad') || '{}'), recs = [];
  (Array.isArray(o.records) ? o.records : []).forEach(r => { const P = r && r.project; if (!P) return; recs.push({ fn: String(P.fileNo || ''), name: String(P.name || ''), cno: String(P.contractNo || ''), n: Array.isArray(r.advances) ? r.advances.length : 0, legacy: !!r.legacy }); });
  let mt = 0; try { mt = fs.statSync(dataFile('ad')).mtimeMs; } catch (_) {} return { mt, recs }; } catch (_) { return null; } }
let _vwPub = null, _vwRd = null;
const vwPub = () => _vwPub || (_vwPub = require('./viewer').createPublisher({ file: () => path.join(dataDir, 'viewer-publish.json'), gd: () => gdEnsure(), safeStorage,
  /* سجل الموقف دون «links» (ملخصات الأنظمة: أوامر التغيير والسلف والمدد لكل مشروع) — لا تخرج إلى نسخة الاطلاع */
  readReg: () => { try { const o = JSON.parse(fs.readFileSync(regFile(), 'utf8')); o.links = {}; return JSON.stringify(o); } catch (_) { return null; } }, readPlan: () => readData('pl'), adIndex: adIndexNow,
  photoRefs: () => PHS().refs(), photoRoot: () => path.join(dataDir, 'صور-المشاريع'), log: m => logError('viewer', m) }));
function netGet(url) {
  return new Promise((res, rej) => { const { net } = require('electron'); let done = false; const fin = (f, v) => { if (!done) { done = true; clearTimeout(t); f(v); } };
    const rq = net.request({ url, redirect: 'follow' }); const t = setTimeout(() => { try { rq.abort(); } catch (_) {} fin(rej, new Error('انتهت مهلة الاتصال بـ Google Drive — تحقق من الإنترنت')); }, 90000);
    rq.on('response', r => { if (r.statusCode !== 200) { fin(rej, new Error(r.statusCode === 404 || r.statusCode === 403 ? 'الملف غير متاح في Google Drive (أُوقفت نسخة الاطلاع من حاسبة القسم؟)' : 'Google Drive: خطأ ' + r.statusCode)); return; }
      const ch = []; let n = 0; r.on('data', c => { n += c.length; if (n > 80 * 1048576) { try { rq.abort(); } catch (_) {} fin(rej, new Error('الملف أكبر من المتوقع')); } else ch.push(c); }); r.on('end', () => fin(res, Buffer.concat(ch))); r.on('error', e => fin(rej, e)); });
    rq.on('error', e => fin(rej, new Error('تعذّر الاتصال بـ Google Drive — تحقق من الإنترنت'))); rq.end(); });
}
/* نسخة الاطلاع: تقرأ الملف فقط (عند التشغيل ثم كل 5 دقائق) */
const vwReader = () => _vwRd || (_vwRd = require('./viewer').createReader({ dir: () => dataDir, get: netGet, safeStorage, log: m => logError('viewer', m),
  writeReg: t => { JSON.parse(t); atomicWrite(regFile(), t); regVer++; }, writePlan: t => { JSON.parse(t); atomicWrite(dataFile('pl'), t); },
  notify: ds => { try { if (win && !win.isDestroyed()) win.webContents.send('sync:data', { ds }); } catch (_) {} } }));
const fromShell = e => !!(win && e.sender === win.webContents);
ipcMain.on('vw:is', e => { e.returnValue = VIEWER; });
ipcMain.handle('vw:pubStatus', (e, withCode) => (!VIEWER && fromShell(e) ? vwPub().status(!!withCode) : null));
ipcMain.handle('vw:publish', async e => { if (VIEWER || !fromShell(e)) return null; const first = !vwPub().status().on; const r = await vwPub().publish(true); if (r && r.ok && first) audit.note('sit', 'viewer', 'تفعيل نسخة الاطلاع على Google Drive').catch(() => {}); return r; });
ipcMain.handle('vw:stop', async e => { if (VIEWER || !fromShell(e)) return null; const r = await vwPub().stop(); audit.note('sit', 'viewer', 'إيقاف نسخة الاطلاع وحذف ملفاتها من Google Drive').catch(() => {}); return r; });
ipcMain.handle('vw:status', e => (VIEWER && fromShell(e) ? vwReader().status() : null));
ipcMain.handle('vw:link', (e, code) => (VIEWER && fromShell(e) ? vwReader().link(code) : null));
ipcMain.handle('vw:refresh', e => (VIEWER && fromShell(e) ? vwReader().refresh() : null));
function viewerStart() {
  const zoom = d => () => { const w = win.webContents; w.setZoomLevel(d === 0 ? 0 : w.getZoomLevel() + d); };
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'ملف', submenu: [ { label: 'طباعة', accelerator: 'CmdOrCtrl+P', click: () => win.webContents.executeJavaScript("document.querySelector('[data-act=print]')?document.querySelector('[data-act=print]').click():window.print()").catch(() => {}) }, { type: 'separator' }, { label: 'خروج', role: 'quit' } ] },
    { label: 'تحرير', submenu: [ { label: 'نسخ', role: 'copy' }, { label: 'لصق', role: 'paste' }, { label: 'تحديد الكل', role: 'selectAll' } ] },
    { label: 'عرض', submenu: [ { label: 'تكبير', accelerator: 'CmdOrCtrl+=', click: zoom(0.5) }, { label: 'تصغير', accelerator: 'CmdOrCtrl+-', click: zoom(-0.5) }, { label: 'الحجم الأصلي', accelerator: 'CmdOrCtrl+0', click: zoom(0) }, { type: 'separator' }, { label: 'ملء الشاشة', role: 'togglefullscreen' } ] }
  ]));
  createWindow();
  win.on('enter-full-screen', () => win.webContents.send('ui:fs', true)); win.on('leave-full-screen', () => win.webContents.send('ui:fs', false));
  vwReader().start();
  global.__uni = { VIEWER, go, views, APPS, get win() { return win; }, vwReader };
}

/* الأنظمة التي تُصدر مستنداتها مع رفع PDF إلى Drive (مجلد لكل نظام) */
const GD_SYS = { ac: 'شهادات الاستلام — قسم الشؤون الهندسية', lt: 'المخاطبات والمطالعات — قسم الشؤون الهندسية', dm: 'مطالعات لجنة المدد — قسم الشؤون الهندسية', cm: 'مطالعات لجنة أوامر التغيير — قسم الشؤون الهندسية',
  co: 'لجنة أوامر التغيير — قسم الشؤون الهندسية', du: 'المدد والتوقف — قسم الشؤون الهندسية', ad: 'لجنة تدقيق السلف — قسم الشؤون الهندسية', fv: 'تقارير زيارة مشاريع التنفيذ أمانة — قسم الشؤون الهندسية', zc: 'قرارات اللجنة المركزية للمصادقة — قسم الشؤون الهندسية' };
const gdSys = e => (ZCAPP ? (win && e.sender === win.webContents && unlocked.has('zc') ? 'zc' : '') : Object.keys(GD_SYS).find(id => views[id] && e.sender === views[id].webContents && isOpen(id)) || '');
const gdFrom = e => !!gdSys(e) || (win && e.sender === win.webContents && (!ZCAPP || unlocked.has('zc'))) || (!ZCAPP && !!views.zc && e.sender === views.zc.webContents && isOpen('zc'));
ipcMain.handle('gd:status', e => (gdFrom(e) ? gdEnsure().status() : null));
ipcMain.handle('gd:setApp', (e, id, sec) => (gdFrom(e) ? gdEnsure().setApp(id, sec) : { error: 'غير مسموح' }));
ipcMain.handle('gd:connect', async (e, hint) => { if (!gdFrom(e)) return { error: 'غير مسموح' }; const r = await gdEnsure().connect(hint); if (r.ok) audit.note('ac', 'gdrive', 'ربط البرنامج بـ Google Drive: ' + (r.email || '')).catch(() => {}); return r; });
ipcMain.handle('gd:disconnect', e => (gdFrom(e) ? gdEnsure().disconnect() : { error: 'غير مسموح' }));
ipcMain.handle('gd:shareState', e => (gdFrom(e) ? { on: !!prefs().gdShare, server: !!(sync && sync.state && sync.state().mode === 'server') } : null));
ipcMain.handle('gd:share', (e, on, masterPw) => { if (!gdFrom(e)) return { error: 'غير مسموح' }; const r = checkMaster(masterPw); if (r !== true) return { error: r === 'wait' ? 'محاولات كثيرة — انتظر دقيقة' : 'كلمة سر المدير غير صحيحة' };
  if (on && !(sync && sync.state && sync.state().mode === 'server')) return { error: 'المشاركة تُفعَّل من حاسبة القسم (خادم المزامنة) فقط' };
  if (on && !gdEnsure().status().connected) return { error: 'هذه الحاسبة غير مربوطة ببريد القسم' };
  const p = prefs(); p.gdShare = !!on; atomicWrite(prefsFile(), JSON.stringify(p)); audit.note('', 'gdrive', on ? 'تفعيل مشاركة ربط Google Drive مع حاسبات اللجان عبر المزامنة' : 'إيقاف مشاركة ربط Google Drive مع حاسبات اللجان').catch(() => {}); return { ok: true, on: !!on }; });
ipcMain.handle('gd:exportSetup', e => (gdFrom(e) ? gdEnsure().exportSetup() : { error: 'غير مسموح' }));
ipcMain.handle('gd:importSetup', (e, code) => (gdFrom(e) ? gdEnsure().importSetup(code) : { error: 'غير مسموح' }));
ipcMain.handle('gd:reserve', async (e, name) => { const sys = gdSys(e); if (!sys) return { error: 'غير مسموح' }; try { return await gdEnsure().reserve(name, GD_SYS[sys]); } catch (err) { return { error: String(err.message || err) }; } });
ipcMain.handle('gd:owns', (e, id) => (gdSys(e) ? gdEnsure().owns(id) : false));
ipcMain.handle('gd:upload', async (e, id, name) => { const sys = gdSys(e); if (!sys) return { error: 'غير مسموح' };
  try { const buf = await e.sender.printToPDF({ printBackground: true, preferCSSPageSize: true, pageSize: 'A4', margins: { top: 0, bottom: 0, left: 0, right: 0 } });
    const r = await gdEnsure().upload(id, buf, name); audit.note(sys, 'gdrive', `رفع «${name || id}» إلى Drive (${Math.round(buf.length / 1024)} ك.ب)`).catch(() => {}); return { ...r, kb: Math.round(buf.length / 1024) }; }
  catch (err) { return { error: String(err.message || err) }; } });
let FLOWPANEL_JS = null;
const flowPanelJs = id => { if (FLOWPANEL_JS == null) { try { FLOWPANEL_JS = fs.readFileSync(path.join(__dirname, 'flowpanel.js'), 'utf8'); } catch (_) { FLOWPANEL_JS = ''; } } return FLOWPANEL_JS.replace("'__SYS__'", JSON.stringify(id)); };
/* شاشة القاعة (تلفاز أو أي حاسبة): صفحة للقراءة فقط على الشبكة الداخلية، بلا مبالغ. معطّلة حتى تُفعَّل من اللوحة */
const FLOW_PORT = +process.env.UNI_WF_PORT || 47910;
let flowSrv = null;
function flowWebInfo() { const on = !!flowSrv, addrs = []; try { const ni = require('os').networkInterfaces(); for (const k of Object.keys(ni)) for (const a of ni[k] || []) if (a.family === 'IPv4' && !a.internal) addrs.push(`http://${a.address}:${FLOW_PORT}/`); } catch (_) {} return { on, urls: addrs, port: FLOW_PORT }; }
function flowWebStart() {
  if (flowSrv) return;
  const files = { '/': ['flow-display.html', 'text/html; charset=utf-8'], '/flow.js': [fs.existsSync(path.join(__dirname, 'shell', 'flow-legacy.js')) ? 'flow-legacy.js' : 'flow.js', 'text/javascript; charset=utf-8'], '/logo.png': ['logo.png', 'image/png'] };
  flowSrv = http.createServer((req, res) => {
    try {
      const u = String(req.url || '/').split('?')[0];
      if (req.method !== 'GET') { res.writeHead(405); return res.end(); }
      if (u === '/data') { return flowBoard(false).then(d => { const b = Buffer.from(JSON.stringify(d)); res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Length': b.length }); res.end(b); }).catch(() => { res.writeHead(500); res.end(); }); }
      { const m = /^\/ann\/([^/]+)\/(\d+)\.jpg$/.exec(decodeURIComponent(u)); if (m) { const b = wfaOne(m[1], m[2]); if (!b) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Cache-Control': 'max-age=3600', 'Content-Length': b.length }); return res.end(b); } }
      const f = files[u]; if (!f) { res.writeHead(404); return res.end(); }
      const b = fs.readFileSync(path.join(__dirname, 'shell', f[0])); res.writeHead(200, { 'Content-Type': f[1], 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(b);
    } catch (_) { try { res.writeHead(500); res.end(); } catch (__) {} }
  });
  const socks = new Set(); flowSrv.on('connection', k => { socks.add(k); k.on('close', () => socks.delete(k)); }); flowSrv.__socks = socks;
  flowSrv.on('error', e => { logError('flow-web', String(e && e.message || e)); flowSrv = null; flowNotify(); });
  flowSrv.listen(FLOW_PORT, '0.0.0.0', () => flowNotify());
}
function flowWebStop() { if (flowSrv) { try { flowSrv.close(); for (const k of flowSrv.__socks || []) k.destroy(); } catch (_) {} flowSrv = null; } }
ipcMain.handle('wf:web', (_e, on) => { try { const p = prefs(); p.wfWeb = !!on; atomicWrite(prefsFile(), JSON.stringify(p)); } catch (e) { logError('wf:web', String(e && e.message || e)); } if (on) flowWebStart(); else flowWebStop(); return new Promise(r => setTimeout(() => r(flowWebInfo()), 300)); });
function startSync() {
  /* تحديث منزّل لم يُثبَّت (أو بقايا تنزيل) بجانب ملف البرنامج */
  setTimeout(() => { updEnsure().recover().then(r => { if (r) sendUpd(); }).catch(() => {}); }, 3000);
  sync = createSync({ version: APP_VER(), updater: updEnsure(), onSynced: o => { updEnsure().check(o.base, o.key, o.serverVer).then(sendUpd).catch(() => {}); },
    dataDir: () => dataDir, readData: id => readData(id), regFile,
    stamp: id => { try { const st = fs.statSync(dataFile(id)); return st.mtimeMs + ':' + st.size; } catch (_) { return ''; } },
    writeData: (id, t) => atomicWrite(dataFile(id), t),
    writeReg: t => { fs.mkdirSync(path.dirname(regFile()), { recursive: true }); atomicWrite(regFile(), t); regVer++; },
    acEval, acAvailable, applied: appliedHook, archDir: () => archDir(),
    archCred: () => { try { const s = (JSON.parse(readData('ar') || '{}').settings || {}).dev; return s && s.box ? { box: String(s.box), tok: String(s.tok || '') } : null; } catch (_) { return null; } },
    onState: st => { if (win && !win.isDestroyed()) win.webContents.send('sync:state', st); },
    /* ربط Drive المشترك: حاسبة القسم تعرضه (إن فعّله المدير)، وحاسبة اللجنة غير المربوطة تأخذه */
    gdOffer: quick => { if (!prefs().gdShare) return quick ? false : null; try { if (!gdEnsure().status().connected) return quick ? false : null; } catch (_) { return quick ? false : null; } return quick ? true : gdEnsure().shareOut(); },
    gdWant: () => { try { return !gdEnsure().status().connected; } catch (_) { return false; } },
    gdTake: o => { const ok = gdEnsure().shareIn(o); if (ok) audit.note('', 'gdrive', 'ربط Google Drive وصل من حاسبة القسم عبر المزامنة: ' + (o.email || '')).catch(() => {}); return ok; },
    log: m => logError('sync', m)
  });
  sync.init();
}
const curWC = () => (views[current] ? views[current].webContents : win.webContents);

/* خزانة الخطوط المشتركة لكل الأنظمة داخل البرنامج الموحد: مجلد «خطوط» في مجلد البيانات */
const fontStore = require('./fontstore')({ ipcMain, dialog, app, dir: () => dataDir, win: () => win });
const mailer = require('./mailer')({ ipcMain, safeStorage, dir: () => dataDir });
/* إرسال الصفحة الحالية بالبريد: يُنفَّذ زر الطباعة في النظام المفتوح، فتلتقط «print:do» الصفحة الجاهزة PDF بدل طباعتها */
let mailCapture = null, mailPdf = null;
ipcMain.handle('mail:capture', async () => {
  if (PAGES.has(current) || !views[current]) return { ok: false, msg: 'افتح أحد الأنظمة (السلف، أوامر التغيير، المدد، التأمينات، الاستلام) واعرض المستند المطلوب أولاً.' };
  const wc = views[current].webContents; mailPdf = null;
  const done = new Promise(res => { mailCapture = res; setTimeout(() => { if (mailCapture === res) { mailCapture = null; res(null); } }, 25000); });
  wc.executeJavaScript("document.querySelector('[data-act=print]')?document.querySelector('[data-act=print]').click():window.print()").catch(() => {});
  const r = await done; if (!r) return { ok: false, msg: 'لم يُجهَّز المستند (قد يكون فيه نقص يمنع الطباعة، أو أُلغي).' };
  mailPdf = r; return { ok: true, name: r.name, app: APPS[current] ? APPS[current].title : '', size: r.buf.length };
});
ipcMain.handle('mail:send', async (_e, m) => { if (!mailPdf) return { ok: false, msg: 'لا يوجد مستند مجهّز للإرسال.' }; const r = await mailer.send(mailPdf.buf, m); return r; });

/* «مظهر الواجهة» (عرض ← مظهر الواجهة): «ناعم ثلاثي الأبعاد» (افتراضي) أو «السابق» — للواجهة الموحدة فقط (shell/softui.js) */
const uiTheme = () => { const t = prefs().uiTheme; return t === 'classic' ? 'classic' : 'soft'; };
ipcMain.on('ui:theme', e => { e.returnValue = uiTheme(); });
function setUiTheme(t) { try { const p = prefs(); p.uiTheme = t; atomicWrite(prefsFile(), JSON.stringify(p)); } catch (_) {} try { if (win && !win.isDestroyed()) win.webContents.executeJavaScript(`window.SoftUi&&SoftUi.set(${JSON.stringify(t)})`).catch(() => {}); } catch (_) {} }
/* المظهر الزجاجي الخفيف (shell/glass.css) بدل الخلفية الصفراء: للواجهة والأنظمة ذات الخلفية الصفراء فقط (لا الاستلام ولا الأرشيف) */
const GLASS_IDS = new Set(['co', 'du', 'ad', 'in', 'lt', 'fu', 'dm', 'cm', 'zc']);
let GLASS_CSS = null; const glassOn = () => !prefs().glassOff;
function applyGlass(wc, force) { try { if (!wc || wc.isDestroyed()) return;
  if (GLASS_CSS == null) { try { GLASS_CSS = fs.readFileSync(path.join(__dirname, 'shell', 'glass.css'), 'utf8'); } catch (_) { GLASS_CSS = ''; } }
  const on = force != null ? force : glassOn();
  if (on && GLASS_CSS && !wc.__glassKey) wc.insertCSS(GLASS_CSS).then(k => { wc.__glassKey = k; }).catch(() => {});
  if (!on && wc.__glassKey) { const k = wc.__glassKey; wc.__glassKey = null; wc.removeInsertedCSS(k).catch(() => {}); } } catch (_) {} }
function setGlass(on) { try { const p = prefs(); p.glassOff = !on; atomicWrite(prefsFile(), JSON.stringify(p)); } catch (_) {}
  if (win && !win.isDestroyed()) applyGlass(win.webContents, on); for (const id of Object.keys(views)) if (GLASS_IDS.has(id) && views[id]) applyGlass(views[id].webContents, on); }
const showIntro = () => { if (process.env.UNI_FORCE_INTRO) return true; if (process.env.UNI_MULTI || process.env.UNI_NO_INTRO) return false; try { return !prefs().introOff && fs.existsSync(path.join(__dirname, 'shell', 'intro', 'intro.mp4')); } catch (_) { return false; } };
function createWindow() {
  win = new BrowserWindow({
    width: 1440, height: 920, minWidth: 980, minHeight: 640, show: false,
    title: VIEWER ? 'نسخة الاطلاع — نظام الشؤون الهندسية الموحد - محافظة الأنبار' : 'نظام الشؤون الهندسية الموحد - محافظة الأنبار',
    icon: path.join(__dirname, 'build', 'icon.png'),
    backgroundColor: '#eef2ee',
    webPreferences: { preload: path.join(__dirname, 'shell-preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: false, spellcheck: false }
  });
  win.webContents.on('dom-ready', () => { win.webContents.__glassKey = null; applyGlass(win.webContents); });
  win.loadFile(path.join(__dirname, 'shell', 'index.html'));
  /* فيديو البداية: يُعرض قبل الواجهة (تُحمَّل الواجهة خلفه)، ثم تظهر الواجهة عند انتهائه أو تخطيه؛ ويُلغى من خياره في الفيديو */
  let ready = false, introOver = !showIntro();
  const reveal = () => { if (ready && introOver && win && !win.isDestroyed() && !win.isVisible()) { win.maximize(); win.show(); } };
  win.once('ready-to-show', () => { ready = true; reveal(); if (VIEWER) return; autoJsonScan(); setTimeout(annCheck, 2500); });
  if (!introOver) {
    // بحجم الشاشة كاملة (الشاشة التي فيها مؤشر الفأرة)
    let B = { x: undefined, y: undefined, width: 1120, height: 630 }; try { const { screen } = require('electron'); B = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).bounds; } catch (_) {}
    const iw = new BrowserWindow({ x: B.x, y: B.y, width: B.width, height: B.height, fullscreen: true, frame: false, resizable: false, show: false, backgroundColor: '#000000', skipTaskbar: false, title: 'نظام الشؤون الهندسية الموحد',
      icon: path.join(__dirname, 'build', 'icon.png'), webPreferences: { preload: path.join(__dirname, 'intro-preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true, autoplayPolicy: 'no-user-gesture-required' } });
    global.__introWin = iw;
    const finish = off => { if (introOver) return; introOver = true; if (off) { try { const p = prefs(); p.introOff = true; atomicWrite(prefsFile(), JSON.stringify(p)); } catch (_) {} }
      try { if (!iw.isDestroyed()) iw.close(); } catch (_) {} reveal(); };
    ipcMain.once('intro:done', (_e, off) => finish(off));
    iw.on('closed', () => finish(false));
    setTimeout(() => finish(false), 15000);   // احتياط: لا يتأخر البرنامج أكثر من 15 ثانية مهما حدث
    iw.once('ready-to-show', () => iw.show());
    iw.loadFile(path.join(__dirname, 'shell', 'intro', 'intro.html')).catch(() => finish(false));
  }
  for (const ev of ['resize', 'maximize', 'unmaximize', 'enter-full-screen', 'leave-full-screen']) win.on(ev, () => { layout(); setTimeout(layout, 60); });
  external(win.webContents); watch(win.webContents, 'shell');
  win.webContents.on('before-input-event', touchActivity);
  win.on('closed', () => { try { if (flowWin && !flowWin.isDestroyed()) flowWin.close(); } catch (_) {} });
}
process.on('uncaughtException', err => { logError('main', String(err && err.stack || err)); try { dialog.showErrorBox('خطأ غير متوقع', String(err && err.stack || err)); } catch (_) {} });

if (process.env.UNI_MULTI) { app.setPath('userData', process.env.UNI_MULTI); }
if (!process.env.UNI_MULTI && !app.requestSingleInstanceLock()) { app.quit(); }
else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
  app.whenReady().then(() => {
    nativeTheme.themeSource = 'light';   // الواجهة بخلفية برتقالية مصفرّة ثابتة (لا تتبدل بوضع الويندوز الداكن)
    dataDir = resolveDataDir();
    if (VIEWER) { viewerStart(); return; }
    if (ZCAPP) { try { dailyBackup(); } catch (_) {} zcAppStart(); return; }
    dailyBackup();
    try { xbEnsure().start(); } catch (_) {}
    acStarting = startAcceptance();
    // أي تنزيل (تصدير JSON وغيره من صفحات الاستلام) يمر بنافذة حفظ واضحة باسم الملف المقترح
    session.defaultSession.on('will-download', (_e, item) => {
      const nm = (item.getFilename() || 'ملف').replace(/[\\/:*?"<>|]+/g, '_');
      if (process.env.UNI_TEST_SAVE_DIR) { item.setSavePath(path.join(process.env.UNI_TEST_SAVE_DIR, nm)); return; }
      item.setSaveDialogOptions({ defaultPath: path.join(app.getPath('documents'), nm), filters: filtersFor(nm) });
    });
    try { session.defaultSession.setSpellCheckerLanguages(['ar']); } catch (_) { try { session.defaultSession.setSpellCheckerLanguages(['ar-SA']); } catch (__) {} }   // التدقيق الإملائي العربي (المخاطبات)
    session.defaultSession.setPermissionRequestHandler((_wc, perm, cb) => cb(perm === 'media'));
    session.defaultSession.setPermissionCheckHandler((_wc, perm) => perm === 'media');
    const zoom = d => () => { const w = curWC(); w.setZoomLevel(d === 0 ? 0 : w.getZoomLevel() + d); };
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      { label: 'ملف', submenu: [
        { label: 'فتح مجلد البيانات', click: () => shell.openPath(dataDir) },
        { label: 'طباعة', accelerator: 'CmdOrCtrl+P', click: () => curWC().executeJavaScript("document.querySelector('[data-act=print]')?document.querySelector('[data-act=print]').click():window.print()").catch(() => {}) },
        { label: 'طباعة عبر PDF (تُفتح في قارئ PDF وتُطبع منه)', accelerator: 'CmdOrCtrl+Shift+P', click: () => { printViaPdfOnce = true; curWC().executeJavaScript("document.querySelector('[data-act=print]')?document.querySelector('[data-act=print]').click():window.print()").catch(() => { printViaPdfOnce = false; }); setTimeout(() => { printViaPdfOnce = false; }, 90000); } },
        { label: 'الطباعة دائماً عبر PDF', type: 'checkbox', checked: printPdfAlways(), click: it => setPrintPdfAlways(it.checked) },
        { type: 'separator' }, { label: 'خروج', role: 'quit' } ] },
      { label: 'تحرير', submenu: [ { label: 'تراجع', role: 'undo' }, { label: 'إعادة', role: 'redo' }, { type: 'separator' }, { label: 'قص', role: 'cut' }, { label: 'نسخ', role: 'copy' }, { label: 'لصق', role: 'paste' }, { label: 'تحديد الكل', role: 'selectAll' } ] },
      { label: 'أدوات', submenu: [
        { label: 'دليل الاستخدام', accelerator: 'F1', click: () => openManual() },
        { type: 'separator' },
        { label: 'إرسال المستند الحالي بالبريد', accelerator: 'CmdOrCtrl+M', click: () => uiCmd('mail') },
        { label: 'المزامنة بين أجهزة اللجان', click: () => uiCmd('sync') },
        { label: 'حالة الحاسبات المتصلة بحاسبة القسم', click: () => uiCmd('peers') },
        { label: 'النسخ الاحتياطي الخارجي (فلاشة / قرص ثانٍ)', click: () => uiCmd('xbackup') },
        { label: '↺ استرجاع نسخة احتياطية', click: () => uiCmd('restore') },
        { label: '💾 حفظ نسخة احتياطية كاملة (ملف واحد)', click: () => uiCmd('bksave') },
        { label: '👁 نسخة الاطلاع (المحافظ والنائب والمعاون)…', click: () => uiCmd('viewer') },
        { type: 'separator' },
        { label: 'قفل كل الأنظمة', accelerator: 'CmdOrCtrl+L', click: () => uiCmd('lock') },
        { label: 'تغيير كلمات السر', click: () => uiCmd('pw') },
        { label: 'فتح مجلد البيانات', click: () => uiCmd('folder') },
        { type: 'separator' },
        { label: 'مركز المتابعة بملء الشاشة', accelerator: 'F11', click: () => uiCmd('ccfull') } ] },
      { label: 'عرض', submenu: [ { label: 'فيديو البداية عند التشغيل', type: 'checkbox', checked: !prefs().introOff, click: mi => { try { const p = prefs(); p.introOff = !mi.checked; atomicWrite(prefsFile(), JSON.stringify(p)); } catch (_) {} } }, { label: 'مظهر الواجهة', submenu: [ { label: 'ناعم ثلاثي الأبعاد (أيقونات موحّدة)', type: 'radio', checked: uiTheme() === 'soft', click: () => setUiTheme('soft') }, { label: 'السابق', type: 'radio', checked: uiTheme() === 'classic', click: () => setUiTheme('classic') } ] }, { label: 'المظهر الزجاجي (بدل الخلفية الصفراء)', type: 'checkbox', checked: glassOn(), click: mi => setGlass(mi.checked) }, { label: 'تفريغ الأنظمة غير المستعملة من الذاكرة بعد 15 دقيقة (للحاسبات القديمة)', type: 'checkbox', checked: unloadOn(), click: mi => { try { const p = prefs(); p.unloadOff = !mi.checked; atomicWrite(prefsFile(), JSON.stringify(p)); } catch (_) {} } }, { type: 'separator' }, { label: 'إعادة تحميل', accelerator: 'CmdOrCtrl+R', click: () => curWC().reload() }, { label: 'تكبير', accelerator: 'CmdOrCtrl+=', click: zoom(0.5) }, { label: 'تصغير', accelerator: 'CmdOrCtrl+-', click: zoom(-0.5) }, { label: 'الحجم الطبيعي', accelerator: 'CmdOrCtrl+0', click: zoom(0) }, { type: 'separator' }, { label: 'ملء الشاشة', role: 'togglefullscreen' } ] }
    ]));
    createWindow();
    win.on('enter-full-screen', () => win.webContents.send('ui:fs', true)); win.on('leave-full-screen', () => win.webContents.send('ui:fs', false));
    startSync();
    try { flow.init(); } catch (e) { logError('flow', String(e && e.message || e)); }
    if (prefs().wfWeb) flowWebStart();
    try { vwPub().start(); } catch (e) { logError('viewer', String(e && e.message || e)); }
    try { zcDept().start(); } catch (e) { logError('zc-remote', String(e && e.message || e)); }
    global.__uni = { fontCss, ensureView, zcDept, unlocked, manualWin: () => manualWin, openManual, manualPath, sync: () => sync, go, views, flow, unloadView, refreshLinks, linksAt, get viewLeft() { return viewLeft; }, get flowWin() { return flowWin; }, get win() { return win; }, APPS, layout, get current() { return current; } };
  });
  app.on('before-quit', () => { try { if (sync) sync.stop(); } catch (_) {} flowWebStop(); stopAcceptance(); });
  app.on('window-all-closed', () => app.quit());
}
