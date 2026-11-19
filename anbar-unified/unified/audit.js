'use strict';
/* سجل التعديلات (التوثيق): كل إضافة أو تعديل أو حذف لسجل في لجنة تدقيق السلف أو أوامر التغيير أو المدد والتوقف أو الاستلام
   يُسجَّل باسم المعدِّل (الاسم المكتوب عند فتح النظام) ومستخدم ويندوز واسم الحاسبة والوقت، مع صورة من كاميرا الحاسبة.
   - التعديلات المتتالية على السجل نفسه من الشخص نفسه خلال 10 دقائق تُجمع في قيد واحد (عدد مرات الحفظ ووقت آخر حفظ)،
     فلا تتكرر القيود والصور مع كل حرف يُكتب (الأنظمة تحفظ تلقائياً مع كل تعديل).
   - الصورة تُلتقط عند بداية كل قيد جديد (وتُعاد صورة آخر دقيقة إن وُجدت)، وتُحفظ ملفاً في مجلد البيانات: audit/photos.
   - السجل للقراءة فقط: لا يوجد في البرنامج ما يحذف قيداً أو صورة. */
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const SYS = { co: 'أوامر التغيير', du: 'المدد والتوقف', ad: 'لجنة تدقيق السلف', ac: 'الاستلام' };
const NOTE_SYS = { pl: 'مشاريع التخطيط', sit: 'الموقف العام', lt: 'المخاطبات', wf: 'سير المعاملات' };   // أسماء القيود التي بلا تعديل بيانات
const AC_KIND = { pac: 'استلام أولي', pap: 'استلام أولي جزئي', fac: 'استلام نهائي', fpa: 'استلام نهائي جزئي' };
const GROUP_MS = 10 * 60 * 1000, PHOTO_REUSE_MS = 60 * 1000, MAX_ENTRIES = 20000;
// حقول لا تُعدّ تعديلاً (وقت الحفظ، واختيار الصفحة المعروضة للطباعة، والحالة المؤقتة للواجهة)
const IGN = /^(updated|created|printIdx|printAll|printOrder|cur|lastBackup|view|tab|sel|v2)$/;
const strip = v => { try { return JSON.stringify(v, (k, x) => (IGN.test(k) ? undefined : x)); } catch (_) { return ''; } };
const s = v => (v == null ? '' : String(v)).trim();
const labelOf = r => r ? s((r.project && r.project.name) || (r.data && r.data.p && r.data.p.name) || (r.p && r.p.name) || r.pName || r.name) : '';
const fileOf = r => r ? s((r.project && r.project.fileNo) || (r.data && r.data.p && r.data.p.fileNo) || (r.p && r.p.fileNo) || r.fileNo) : '';

/* سجلات كل نظام: {معرّف: {h بصمة المحتوى، label اسم المشروع، fileNo}} */
function recMap(sys, text) {
  const m = new Map(); let d;
  try { d = typeof text === 'string' ? JSON.parse(text) : text; } catch (_) { return null; }
  if (!d || typeof d !== 'object') return m;
  if (sys === 'ac') {   // الاستلام: {pac: '{"5001": {...}}', ...}
    for (const k of Object.keys(d)) { let o = d[k]; try { if (typeof o === 'string') o = JSON.parse(o || '{}'); } catch (_) { o = null; }
      if (o && typeof o === 'object') for (const [ser, r] of Object.entries(o)) m.set(k + ':' + ser, { h: strip(r), label: labelOf(r), fileNo: fileOf(r), sub: (AC_KIND[k] || k) + ' — ' + ser }); }
    return m;
  }
  const L = Array.isArray(d.records) ? d.records : Array.isArray(d.recs) ? d.recs : [];
  L.forEach((r, i) => { if (!r || typeof r !== 'object') return; m.set(String(r.id || r.rid || i), { h: strip(r), label: labelOf(r), fileNo: fileOf(r) }); });
  return m;
}
function diff(sys, oldT, newT) {
  const a = recMap(sys, oldT), b = recMap(sys, newT);
  if (!a || !b) return [];
  const out = [];
  for (const [id, x] of b) { const o = a.get(id); if (!o) out.push({ rid: id, op: 'add', ...x }); else if (o.h !== x.h) out.push({ rid: id, op: 'edit', ...x }); }
  for (const [id, o] of a) if (!b.has(id)) out.push({ rid: id, op: 'del', ...o });
  return out;
}

/* المقارنة على ملفات كبيرة (أرشيف السلف ~8 م.ب) تستغرق مئات الملي ثواني؛ تُنفَّذ في خيط عامل منفصل حتى لا تتوقف الكتابة في البرنامج.
   إن تعذّر الخيط العامل تُنفَّذ كما كانت. */
let W = null, wSeq = 0; const wWait = new Map();
function worker() {
  if (W) return W;
  try {
    const { Worker } = require('worker_threads');
    const code = `const { parentPort } = require('worker_threads');const AC_KIND=${JSON.stringify(AC_KIND)};const IGN=${IGN.toString()};
      const strip=${strip.toString()};const s=${s.toString()};const labelOf=${labelOf.toString()};const fileOf=${fileOf.toString()};
      ${recMap.toString()}
      ${diff.toString()}
      parentPort.on('message', m => { let r = []; try { r = diff(m.sys, m.a, m.b); } catch (_) { r = null; } parentPort.postMessage({ id: m.id, r }); });`;
    W = new Worker(code, { eval: true });
    W.on('message', m => { const f = wWait.get(m.id); if (f) { wWait.delete(m.id); f(m.r); } });
    W.on('error', () => { for (const f of wWait.values()) f(null); wWait.clear(); W = null; });
    W.unref();
  } catch (_) { W = null; }
  return W;
}
function diffAsync(sys, a, b) {
  const w = worker(); if (!w) return Promise.resolve(diff(sys, a, b));
  return new Promise(res => { const id = ++wSeq; wWait.set(id, r => res(r == null ? diff(sys, a, b) : r)); try { w.postMessage({ id, sys, a, b }); } catch (_) { wWait.delete(id); res(diff(sys, a, b)); } });
}
module.exports = function createAudit(ctx) {
  // ctx: { dir: () => مجلد البيانات، capture: async () => dataURL|'ERR:..'|null، device: () => اسم الجهاز، notify: (قيد) => void، ask: () => void }
  let who = null, entries = null, lastPhoto = null;
  const root = () => path.join(ctx.dir(), 'audit');
  const logFile = () => path.join(root(), 'audit-log.json');
  function load() {
    if (entries) return entries;
    try { entries = JSON.parse(fs.readFileSync(logFile(), 'utf8')); if (!Array.isArray(entries)) entries = []; } catch (_) { entries = []; }
    return entries;
  }
  let saveT = null;
  function persist(now) {
    const w = () => { saveT = null; try { fs.mkdirSync(root(), { recursive: true }); const t = JSON.stringify(entries); const tmp = logFile() + '.tmp'; fs.writeFileSync(tmp, t); fs.renameSync(tmp, logFile()); } catch (_) {} };
    if (now) { clearTimeout(saveT); w(); } else if (!saveT) saveT = setTimeout(w, 400);
  }
  const winUser = () => { try { return os.userInfo().username; } catch (_) { return ''; } };
  async function photo() {
    if (lastPhoto && Date.now() - lastPhoto.at < PHOTO_REUSE_MS && lastPhoto.who === (who && who.name)) return { file: lastPhoto.file };
    let d = null; try { d = await ctx.capture(); } catch (_) { d = null; }
    if (!d || !/^data:image\/jpeg;base64,/.test(d)) return { err: d && String(d).startsWith('ERR:') ? String(d).slice(4) : 'تعذّر تشغيل الكاميرا' };
    const day = new Date().toISOString().slice(0, 7), rel = path.join('photos', day, crypto.randomBytes(8).toString('hex') + '.jpg');
    try { fs.mkdirSync(path.join(root(), 'photos', day), { recursive: true }); fs.writeFileSync(path.join(root(), rel), Buffer.from(d.split(',')[1], 'base64')); } catch (_) { return { err: 'تعذّر حفظ الصورة' }; }
    lastPhoto = { at: Date.now(), file: rel, who: who && who.name };
    return { file: rel };
  }
  /* تُستدعى بعد كل حفظ: تقارن النسخة السابقة بالجديدة وتسجّل ما تغيّر */
  async function record(sys, oldText, newText) {
    if (!SYS[sys] || oldText == null) return 0;   // أول حفظ بلا نسخة سابقة: أساس المقارنة لا تعديل
    const ch = await diffAsync(sys, oldText, newText);
    if (!ch.length) return 0;
    load(); const now = Date.now(), name = who ? who.name : '';
    if (!who && ctx.ask) ctx.ask();
    let fresh = [];
    for (const c of ch) {
      const e = entries.find(x => x.sys === sys && x.rid === c.rid && x.editor === name && now - x.last < GROUP_MS && !(x.op === 'del') && c.op !== 'del');
      if (e) { e.last = now; e.n++; if (c.op === 'add' && e.op !== 'add') e.op = 'add'; e.label = c.label || e.label; e.fileNo = c.fileNo || e.fileNo; continue; }
      const n = { id: crypto.randomBytes(6).toString('hex'), sys, sysName: SYS[sys], rid: c.rid, op: c.op, label: c.label, fileNo: c.fileNo, sub: c.sub || '',
        editor: name, winUser: winUser(), pc: os.hostname(), device: (ctx.device && ctx.device()) || '', first: now, last: now, n: 1, photo: '', photoErr: '' };
      entries.push(n); fresh.push(n);
    }
    if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES);
    persist();
    if (fresh.length) {
      const p = await photo();
      fresh.forEach(n => { if (p.file) n.photo = p.file; else n.photoErr = p.err || ''; });
      persist();
      if (ctx.notify) ctx.notify({ n: fresh.length, sys: SYS[sys], label: fresh[0].label, editor: name, photo: !!p.file, err: p.err || '' });
    }
    return ch.length;
  }
  function setWho(name) {
    name = s(name).replace(/\s+/g, ' ').slice(0, 80);
    if (!name) return false;
    who = { name, at: Date.now() };
    // القيود التي سُجّلت قبل كتابة الاسم (نظام بلا كلمة سر) تُنسب إلى هذا الاسم
    load(); let ch = 0; for (const e of entries) if (!e.editor && Date.now() - e.last < GROUP_MS) { e.editor = name; ch++; }
    if (ch) persist();
    return true;
  }
  /* قيد بلا تعديل بيانات: الدخول إلى نظام (مع صورة)، تغيير اسم المعدِّل، استرجاع كلمة السر */
  async function note(sys, op, label) {
    load(); const now = Date.now(), name = who ? who.name : '';
    const n = { id: crypto.randomBytes(6).toString('hex'), sys: sys || '', sysName: SYS[sys] || NOTE_SYS[sys] || (sys ? sys : 'البرنامج'), rid: '', op, label, fileNo: '', sub: '',
      editor: name, winUser: winUser(), pc: os.hostname(), device: (ctx.device && ctx.device()) || '', first: now, last: now, n: 1, photo: '', photoErr: '' };
    entries.push(n); if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES); persist();
    const p = await photo(); if (p.file) n.photo = p.file; else n.photoErr = p.err || ''; persist();
    if (ctx.notify) ctx.notify({ n: 1, sys: n.sysName, label, editor: name, photo: !!p.file, err: p.err || '', op });
    return n;
  }
  return {
    SYS, diff, record, setWho, note,
    who: () => (who ? who.name : ''),
    clearWho: () => { who = null; lastPhoto = null; },
    names: () => [...new Set(load().map(e => e.editor).filter(Boolean))].slice(-60).reverse(),
    list: () => load().slice().reverse(),
    photoData: rel => { try { const f = path.join(root(), path.normalize(String(rel)).replace(/^(\.\.[\\/])+/, '')); if (!f.startsWith(root())) return null; return 'data:image/jpeg;base64,' + fs.readFileSync(f).toString('base64'); } catch (_) { return null; } },
    dir: () => root(),
    flush: () => persist(true)
  };
};
