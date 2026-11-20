'use strict';
/* لوحة سير المعاملات: مرحلة كل معاملة (سلفة / أمر تغيير / مدة) من الاستلام إلى الإنجاز أو الإرجاع.
   - لا تغيّر ملفات الأنظمة ولا بنية سجلاتها: المراحل في ملف مستقل Workflow-Data.json (يُزامَن بين الحاسبات كبقية الأنظمة).
   - المعاملة = آخر سلفة في ملف المشروع بلجنة السلف، أو آخر أمر في ملف أوامر التغيير، أو آخر مدة في ملف المدد.
   - تُضاف تلقائياً عند إنشائها على هذه الحاسبة (لا عند وصولها بالمزامنة، فالحاسبة التي أنشأتها تضيفها وتصل بطاقتها مع المزامنة).
   - المعاملات الموجودة قبل تشغيل اللوحة لا تُضاف وحدها (تُضاف يدوياً من «إضافة معاملة»).
   - تغيير «الحالة» داخل السلف أو أوامر التغيير إلى «قيد المراجعة» ينقل البطاقة إلى «مراجعة»، و«مكتمل» إلى «منجزة». */
const fs = require('fs');
const path = require('path');

const STAGES = ['rcv', 'aud', 'rev', 'prt', 'done', 'ret'];
const STAGE_NAMES = { rcv: 'استلام', aud: 'تدقيق', rev: 'مراجعة', prt: 'طباعة وتوقيع', done: 'منجزة', ret: 'مُعادة' };
const SYS = ['ad', 'co', 'du', 'ac'];
const SYS_NAMES = { ad: 'سلفة', co: 'أمر تغيير', du: 'مدة', ac: 'شهادة استلام' };
/* متى تُعدّ المعاملة متأخرة: أيام منذ استلامها (تاريخ استلام الذمة) ما لم تُنجز — السلف والمدد 15، أوامر التغيير والاستلام 30 (الاستلام: حتى إصدار الشهادة) */
const LATE_BY = { ad: 15, du: 15, co: 30, ac: 30 };
/* الاستلام (شهادات): الأنواع الأربعة في نظام الاستلام */
const AC_T = { pac: 'استلام أولي', pap: 'استلام أولي جزئي', fac: 'استلام نهائي', fpa: 'استلام نهائي جزئي' };
const num = v => { const n = +String(v == null ? '' : v).replace(/[^\d.\-]/g, ''); return isFinite(n) ? n : 0; };
const str = v => String(v == null ? '' : v).trim();
const ymd = (t = Date.now()) => { const d = new Date(t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const okDate = v => /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) && !isNaN(Date.parse(v));
const dayMs = v => { const [y, m, d] = String(v).split('-').map(Number); return new Date(y, m - 1, d).getTime(); };   // منتصف ليل اليوم بالتوقيت المحلي

/* المعاملة الحالية لكل ملف في نظام: المفتاح ومعلومات العرض */
function extract(ds, o) {
  const out = new Map();
  if (ds === 'ad') for (const r of (o && o.records) || []) {
    if (!r || !r.id || r.demo || /^oldadv/.test(String(r.id))) continue;
    const L = Array.isArray(r.advances) ? r.advances : []; if (!L.length) continue;
    const i = L.length - 1, a = L[i] || {}, p = r.project || {};
    const key = `ad:${r.id}:${a.id || i}`;
    out.set(key, { key, sys: 'ad', rec: r.id, fn: str(p.fileNo), pj: str(p.name), co: str(p.contractor), eng: str(p.resident || p.supervisor),
      no: str(a.no) || String(i + 1), form: str(a.serial), amt: num(a.cumulative), amtL: 'التراكمي', status: r.status || '' });
  }
  if (ds === 'co') for (const r of (o && o.records) || []) {
    if (!r || !r.id || r.demo) continue;
    const L = Array.isArray(r.orders) ? r.orders : []; const n = Math.max(1, L.length), x = L[n - 1] || {}, p = r.project || {};
    const key = `co:${r.id}:${n}`;
    out.set(key, { key, sys: 'co', rec: r.id, fn: str(p.fileNo), pj: str(p.name), co: str(p.contractor), eng: str(p.supervisor),
      no: String(n), form: str(x.formNo), amt: num(x.add) + num(x.nw) - num(x.del), amtL: 'صافي الأمر', status: r.status || '' });
  }
  if (ds === 'du') for (const r of (o && o.recs) || []) {
    if (!r || !r.id || r.demo) continue;
    const d = r.data || {}, L = Array.isArray(d.exts) ? d.exts : [];
    if (!L.length) {   /* ملف فيه توقف أو استئناف ولم تُضف مدة إضافية بعد: معاملة «التوقف والاستئناف» (تُضاف إلى اللوحة يدوياً فقط) */
      const C = Array.isArray(d.cases) ? d.cases : []; if (!C.length) continue; const p = d.p || {};
      const key = `du:${r.id}:f`;
      out.set(key, { key, sys: 'du', rec: r.id, fn: str(p.fileNo), pj: str(p.name), co: str(p.contractor), eng: str(p.re), no: 'توقف/استئناف', form: '', days: 0, amtL: 'المدة', status: '', manual: 1 });
      continue;
    }
    const i = L.length - 1, e = L[i] || {}, p = d.p || {};
    const key = `du:${r.id}:${e.id || i}`;
    out.set(key, { key, sys: 'du', rec: r.id, fn: str(p.fileNo), pj: str(p.name), co: str(p.contractor), eng: str(p.re),
      no: str(e.no) || String(i + 1), form: str(e.formNo), days: num(e.granted || e.requested), amtL: 'المدة', status: '' });
  }
  /* الاستلام: لقطة سجلات الشهادات (يرسلها نظام الاستلام إلى البرنامج عند كل تغيير): المعاملة = الشهادة، و«مكتمل» = صدرت (عدد وتاريخ الإصدار) */
  if (ds === 'ac') for (const x of (o && o.recs) || []) {
    if (!x || !x.serial || !AC_T[x.t]) continue;
    const rid = x.t + '-' + String(x.serial).replace(/:/g, '-'), key = `ac:${rid}:1`;
    out.set(key, { key, sys: 'ac', rec: rid, fn: str(x.fileNo), pj: str(x.pName), co: str(x.contractor), eng: str(x.resEng),
      no: AC_T[x.t] + ' ' + str(x.serial), form: str(x.outNo), amtL: '', status: str(x.outNo) && str(x.outDate) ? 'done' : '' });
  }
  return out;
}

/* قراءة ملف النظام وتحليله في خيط عامل منفصل: ملف السلف مع الأرشيف القديم ~8 م.ب يأخذ 0.1–0.2 ثانية،
   فلا يُنفَّذ في العملية الرئيسية حتى لا يؤخر الحفظ والكتابة. إن تعذّر الخيط العامل يُنفَّذ كالمعتاد. */
let W = null, wSeq = 0; const wWait = new Map();
function worker() {
  if (W) return W;
  try {
    const { Worker } = require('worker_threads');
    const code = `const { parentPort } = require('worker_threads'); const fs = require('fs');
      const num=${num.toString()}; const str=${str.toString()}; const AC_T=${JSON.stringify(AC_T)};
      ${extract.toString()}
      parentPort.on('message', m => { let r = null; for (const f of m.files) { try { const o = JSON.parse(fs.readFileSync(f, 'utf8')); r = [...extract(m.ds, o || {}).values()]; break; } catch (_) {} }
        parentPort.postMessage({ id: m.id, r: r || [] }); });`;
    W = new Worker(code, { eval: true });
    W.on('message', m => { const f = wWait.get(m.id); if (f) { wWait.delete(m.id); f(m.r); } });
    W.on('error', () => { for (const f of wWait.values()) f(null); wWait.clear(); W = null; });
    W.unref();
  } catch (_) { W = null; }
  return W;
}
module.exports = function createFlow(ctx) {
  // ctx: dataDir(), readData(ds) → نص، stamp(ds)، write(text) لكتابة ملف اللوحة، changed() بعد كل كتابة
  const seenFile = () => path.join(ctx.dataDir(), 'Workflow-Seen.json');
  const C = {};   // ذاكرة المعاملات الحالية لكل نظام حسب بصمة الملف
  function items(ds) {
    const st = ctx.stamp(ds);
    if (C[ds] && st && C[ds].st === st) return C[ds].m;
    let o = {}; try { o = JSON.parse(ctx.readData(ds) || '{}') || {}; } catch (_) {}
    const m = extract(ds, o); C[ds] = { st, m }; return m;
  }
  // نسخة غير متزامنة (الخيط العامل) — تُستعمل في كل المسارات الدورية
  function itemsAsync(ds) {
    const st = ctx.stamp(ds);
    if (C[ds] && st && C[ds].st === st) return Promise.resolve(C[ds].m);
    const w = ctx.file ? worker() : null; if (!w) return Promise.resolve(items(ds));
    return new Promise(res => { const id = ++wSeq;
      wWait.set(id, r => { if (r == null) return res(items(ds)); const m = new Map(r.map(it => [it.key, it])); if (st) C[ds] = { st, m }; res(m); });
      try { const f = ctx.file(ds); w.postMessage({ id, ds, files: [f, f + '.bak'] }); } catch (_) { wWait.delete(id); res(items(ds)); } });
  }
  function load() { try { const o = JSON.parse(ctx.readData('wf') || '{}'); if (Array.isArray(o.records)) return o; } catch (_) {} return { app: 'anbar-workflow', v: 1, records: [] }; }
  function save(o) { ctx.write(JSON.stringify(o)); ctx.changed(); }
  let seen = null;
  function loadSeen() {
    if (seen) return seen;
    try { seen = JSON.parse(fs.readFileSync(seenFile(), 'utf8')); } catch (_) { seen = null; }
    if (!seen || !seen.keys) {   // أول تشغيل للوحة على هذه الحاسبة: كل المعاملات الموجودة «معروفة» فلا تُضاف وحدها
      seen = { at: Date.now(), keys: {}, st: {} };
      for (const ds of SYS) for (const [k, it] of items(ds)) { seen.keys[k] = 1; seen.st[ds + ':' + it.rec] = it.status; }
      saveSeen();
    }
    return seen;
  }
  function saveSeen() { try { const f = seenFile(), t = f + '.tmp'; fs.writeFileSync(t, JSON.stringify(seen)); fs.renameSync(t, f); } catch (_) {} }

  /* بعد حفظ نظام (local=true) أو وصول بياناته بالمزامنة (local=false) */
  async function reconcile(ds, local, who) {
    if (!SYS.includes(ds)) return 0;
    const M = await itemsAsync(ds), S = loadSeen(), now = Date.now(); who = who || { name: '', dev: '' };
    let o = null, n = 0, seenCh = false;
    const wf = () => (o = o || load());
    const card = k => wf().records.find(r => r && r.id === k);
    for (const [k, it] of M) {
      const sk = ds + ':' + it.rec;
      if (!S.keys[k]) {
        S.keys[k] = 1; seenCh = true;
        if (local && !it.manual && !card(k)) { wf().records.push({ id: k, sys: ds, rec: it.rec, st: 'rcv', recv: ymd(now), created: now, updated: now, hist: [{ s: 'rcv', at: now, by: who.name, dev: who.dev, auto: 1 }] }); n++; }
        if (S.st[sk] !== it.status) { S.st[sk] = it.status; seenCh = true; }
        continue;
      }
      if (S.st[sk] !== it.status) {
        const prev = S.st[sk]; S.st[sk] = it.status; seenCh = true;
        if (!local || prev === undefined) continue;
        const c = card(k); if (!c) continue;
        const to = it.status === 'review' ? 'rev' : it.status === 'done' ? 'done' : '';
        if (to && c.st !== to && (to === 'done' || ['rcv', 'aud', 'ret'].includes(c.st))) {
          c.st = to; c.updated = now; c.hist.push({ s: to, at: now, by: who.name, dev: who.dev, auto: 1, why: to === 'rev' ? 'الحالة في النظام: قيد المراجعة' : ds === 'ac' ? 'صدرت الشهادة (عدد وتاريخ الإصدار)' : 'الحالة في النظام: مكتمل' }); n++;
        }
      }
    }
    if (seenCh) saveSeen();
    if (n) save(o);
    return n;
  }

  function info(k) { const ds = String(k).slice(0, 2); return SYS.includes(ds) ? items(ds).get(k) : null; }
  async function board(opt) {
    for (const ds of SYS) await itemsAsync(ds);
    const o = load(), out = [];
    for (const c of o.records) {
      if (!c || !c.id || !STAGES.includes(c.st)) continue;
      const it = info(c.id); if (!it) continue;   // حُذف الملف أو أُضيفت بعده معاملة أحدث
      const x = { ...it, st: c.st, recv: okDate(c.recv) ? c.recv : '', created: c.created, updated: c.updated, hist: c.hist || [], since: (c.hist && c.hist.length ? c.hist[c.hist.length - 1].at : c.updated) };
      if (x.recv) { const r = dayMs(x.recv); x.created = r; if (c.st === 'rcv') x.since = Math.min(x.since, r); }   // تاريخ استلام الذمة = موعد ورود المعاملة
      if (!opt.amounts) { delete x.amt; }
      out.push(x);
    }
    return out;
  }
  // معاملات حالية غير موجودة على اللوحة (للإضافة اليدوية)
  async function candidates(q) {
    for (const ds of SYS) await itemsAsync(ds);
    const on = new Set(load().records.map(r => r && r.id)), Q = str(q), out = [];
    for (const ds of SYS) for (const [k, it] of items(ds)) {
      if (on.has(k)) continue;
      if (Q && !(it.fn === Q || (it.pj + ' ' + it.co).includes(Q))) continue;
      out.push({ key: k, sys: ds, fn: it.fn, pj: it.pj, co: it.co, no: it.no });
      if (out.length >= 60) return out;
    }
    return out;
  }
  function move(k, to, why, who) {
    if (!STAGES.includes(to)) return { error: 'مرحلة غير معروفة' };
    if (to === 'ret' && !str(why)) return { error: 'اكتب سبب الإرجاع' };
    const o = load(); const c = o.records.find(r => r && r.id === k); if (!c) return { error: 'المعاملة غير موجودة على اللوحة' };
    if (c.st === to) return { ok: true };
    const now = Math.max(Date.now(), (+c.updated || 0) + 1);
    c.st = to; c.updated = now; (c.hist = c.hist || []).push({ s: to, at: now, by: who.name, dev: who.dev, ...(str(why) ? { why: str(why) } : {}) });
    save(o); return { ok: true };
  }
  function add(k, who) {
    const it = info(k); if (!it) return { error: 'المعاملة غير موجودة' };
    const o = load(); if (o.records.some(r => r && r.id === k)) return { ok: true };
    const now = Date.now(); o.records.push({ id: k, sys: it.sys, rec: it.rec, st: 'rcv', recv: ymd(now), created: now, updated: now, hist: [{ s: 'rcv', at: now, by: who.name, dev: who.dev, manual: 1 }] });
    save(o); return { ok: true };
  }
  /* من داخل النظام (شريط اللوحة): قراءة البطاقة، وتعديل تاريخ استلام الذمة والمرحلة وسبب الإرجاع (تُنشأ البطاقة إن لم تكن) */
  function get(k, late) {
    const c = load().records.find(r => r && r.id === k); if (!c) return null;
    const h = c.hist || [], x = { ...c, recv: okDate(c.recv) ? c.recv : '', since: h.length ? h[h.length - 1].at : c.updated, late };
    if (x.recv && c.st === 'rcv') x.since = Math.min(x.since, dayMs(x.recv));
    return x;
  }
  function set(k, p, who) {
    const m = /^(ad|co|du|ac):([^:]+):(.+)$/.exec(String(k)); if (!m) return { error: 'معاملة غير معروفة' };
    p = p || {}; const why = str(p.why);
    if (p.st !== undefined && !STAGES.includes(p.st)) return { error: 'مرحلة غير معروفة' };
    if (p.st === 'ret' && !why) return { error: 'اكتب سبب الإرجاع' };
    if (p.recv !== undefined && p.recv !== '' && !okDate(p.recv)) return { error: 'تاريخ غير صحيح' };
    const o = load(); let c = o.records.find(r => r && r.id === k), ch = false, moved = '';
    const now = Math.max(Date.now(), c ? (+c.updated || 0) + 1 : 0);
    if (!c) { c = { id: k, sys: m[1], rec: m[2], st: 'rcv', recv: ymd(now), created: now, updated: now, hist: [{ s: 'rcv', at: now, by: who.name, dev: who.dev, manual: 1 }] }; o.records.push(c); ch = true; }
    if (p.recv !== undefined && p.recv !== (c.recv || '')) { c.recv = p.recv; ch = true; }
    if (p.st && p.st !== c.st) { c.st = p.st; (c.hist = c.hist || []).push({ s: p.st, at: now, by: who.name, dev: who.dev, ...(why ? { why } : {}) }); moved = p.st; ch = true; }
    else if (p.st === 'ret' && c.st === 'ret') { const h = c.hist[c.hist.length - 1]; if (h && h.why !== why) { h.why = why; ch = true; } }
    if (ch) { c.updated = now; save(o); }
    return { ok: true, moved, card: get(k) };
  }
  /* التبليغات: يكتبها مدير القسم (بكلمة سر المدير، تُتحقق في البرنامج) فتظهر بملء الشاشة على كل الحاسبات وشاشات اللوحة حتى انتهاء مدتها أو إخفائها.
     تُحفظ في ملف اللوحة نفسه (معرّفها ann:…) فتصل بالمزامنة؛ والإخفاء علامة لا حذف، حتى يصل إلى كل الحاسبات. */
  const isAnn = r => r && /^ann:/.test(String(r.id));
  const LEVELS = ['info', 'imp', 'urg'];
  function anns(all) {
    const now = Date.now();
    return load().records.filter(r => isAnn(r) && (all || (!r.hidden && +r.until > now && +r.from <= now + 60000)))
      .sort((a, b) => b.from - a.from).slice(0, all ? 30 : 10)
      .map(r => ({ id: r.id, text: r.text, level: r.level, from: r.from, until: r.until, by: r.by, hidden: !!r.hidden, hiddenAt: r.hiddenAt || 0, att: r.att && r.att.n ? { type: r.att.type, name: r.att.name, n: r.att.n, pdf: !!r.att.pdf, total: r.att.total || r.att.n } : null }));
  }
  function annPublish(p, who) {
    const text = String(p && p.text || '').replace(/\r/g, '').trim().slice(0, 2000), now = Date.now(), until = Math.round(+(p && p.until));
    const att = p && p.att && +p.att.n > 0 ? { type: p.att.type === 'pdf' ? 'pdf' : 'img', name: String(p.att.name || '').slice(0, 160), n: Math.min(12, +p.att.n), pdf: !!p.att.pdf, total: Math.max(+p.att.total || 0, +p.att.n) } : null;   /* مرفق: صورة أو PDF */
    if (!text && !att) return { error: 'اكتب نص التبليغ أو أرفق ملفاً (PDF أو صورة)' };
    if (!(until > now + 30000) || until > now + 31 * 864e5) return { error: 'مدة العرض غير صحيحة' };
    const o = load(), id = 'ann:' + now.toString(36) + Math.random().toString(36).slice(2, 6);
    o.records.push({ id, kind: 'ann', text, ...(att ? { att } : {}), level: LEVELS.includes(p.level) ? p.level : 'info', from: now, until, by: who.name, dev: who.dev, created: now, updated: now });
    save(o); return { ok: true, id };
  }
  function annHide(id, who) {
    const o = load(), c = o.records.find(r => isAnn(r) && r.id === id); if (!c) return { error: 'التبليغ غير موجود' };
    if (c.hidden) return { ok: true };
    const now = Math.max(Date.now(), (+c.updated || 0) + 1);
    c.hidden = true; c.hiddenAt = now; c.hiddenBy = who.name; c.updated = now; save(o); return { ok: true };
  }
  /* إعدادات مشتركة بين الحاسبات (مثل مفتاح خرائط Google): سجل «cfg:<اسم>» في بيانات اللوحة المُزامَنة — لا مرحلة له فلا يظهر بطاقةً ولا تبليغاً */
  function cfgGet(name) { const c = load().records.find(r => r && r.id === 'cfg:' + name); return c ? { val: c.val || '', by: c.by || '', at: +c.updated || 0 } : null; }
  function cfgSet(name, val, who) { const o = load(), id = 'cfg:' + name, now = Date.now(); let c = o.records.find(r => r && r.id === id);
    if (c && (c.val || '') === val) return { ok: true, same: true };
    if (!c) { c = { id, kind: 'cfg', created: now }; o.records.push(c); } Object.assign(c, { val, by: who.name, dev: who.dev, updated: now }); save(o); return { ok: true, at: now }; }
  function remove(k) { const o = load(), L = o.records.filter(r => !(r && r.id === k)); if (L.length === o.records.length) return false; o.records = L; save(o); return true; }
  /* كل معاملات النظام الحالية «معروفة» (لا تُضاف وحدها) — أول لقطة من نظام الاستلام على هذه الحاسبة */
  function seenAll(ds) { const S = loadSeen(); C[ds] = null; for (const [k, it] of items(ds)) { S.keys[k] = 1; S.st[ds + ':' + it.rec] = it.status; } saveSeen(); }
  return { reconcile, board, candidates, move, add, remove, get, set, anns, annPublish, annHide, items, cfgGet, cfgSet, seenAll, init: () => loadSeen() };
};
module.exports.STAGES = STAGES;
module.exports.STAGE_NAMES = STAGE_NAMES;
module.exports.SYS_NAMES = SYS_NAMES;
module.exports.LATE_BY = LATE_BY;
module.exports.AC_T = AC_T;
module.exports.extract = extract;
