'use strict';
// مزامنة الشبكة المحلية بين أجهزة اللجان.
// جهاز واحد يعمل «خادماً» (يحتفظ بنسخته ويستقبل الباقين)، والبقية «عملاء» يتبادلون معه التعديلات كل ~50 ثانية وعند الحفظ.
// وحدة المزامنة = السجل (ملف مشروع) بمعرّفه ووقت آخر تعديل؛ الأحدث يغلب، والحذف يُنقل كشاهد حذف.
// يشمل: أوامر التغيير (co) · المدد والتوقف (du) · لجنة السلف (ad) · التأمينات (in) · المخاطبات (lt) · مطالعات أوامر التغيير (fu) · سجل الموقف (reg) · محاضر الاستلام (ac).
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const dgram = require('dgram');

const JSON_KEYS = { co: 'records', ad: 'records', du: 'recs', in: 'records', lt: 'records', fu: 'records', dm: 'records', cm: 'records', ar: 'records', wf: 'records', pl: 'records', wfa: 'records' };
const ALL = ['co', 'du', 'ad', 'in', 'lt', 'fu', 'dm', 'cm', 'ar', 'arf', 'reg', 'ac', 'wf', 'pl', 'wfa'];   // wf: لوحة سير المعاملات
const AC_TYPES = { pac: ['pac_records_v1', 'pac_counter_v1'], pap: ['pap_records_v1', 'pap_counter_v1'], fac: ['fac_records_v1', 'fac_counter_v1'], fpa: ['fpa_records_v1', 'fpa_counter_v1'] };
const DEFAULT_PORT = +process.env.UNI_SYNC_PORT || 47900;   // للاختبار فقط: منفذ بديل إن كان 47900 مشغولاً في بيئة الاختبار
const DISC_PORT = +process.env.UNI_DISC_PORT || 47901;   // الاكتشاف التلقائي (UDP): حاسبة القسم تجيب من يسأل عنها برمز القسم

module.exports = function createSync(ctx) {
  const state = { mode: 'off', ok: null, last: 0, error: '', skew: 0, peers: 0, applied: 0 };
  let cfg = { mode: 'off', port: DEFAULT_PORT, key: '', server: '', name: '', secret: '' };
  const lastRev = {}, lastSig = {};
  let server = null, timer = null, busy = false, kick = null, udp = null, found = null;
  const cfgFile = () => path.join(ctx.dataDir(), 'sync-config.json');
  const tombFile = () => path.join(ctx.dataDir(), 'sync-tombs.json');
  let tombs = {};

  /* ---------- الإعدادات وشواهد الحذف ---------- */
  function loadCfg() { try { cfg = { ...cfg, ...JSON.parse(fs.readFileSync(cfgFile(), 'utf8')) }; } catch (_) {} try { tombs = JSON.parse(fs.readFileSync(tombFile(), 'utf8')) || {}; } catch (_) { tombs = {}; } }
  function saveTombs() { try { fs.writeFileSync(tombFile(), JSON.stringify(tombs)); } catch (_) {} }
  function tombMany(ds, ids, at) { tombs[ds] = tombs[ds] || {}; let n = 0; for (const id of ids) if (!(tombs[ds][id] >= at)) { tombs[ds][id] = at; n++; } if (n) saveTombs(); return n; }   // دفعة واحدة (حفظ الملف مرة)
  function tomb(ds, id, at) { (tombs[ds] = tombs[ds] || {}); if (!(tombs[ds][id] >= at)) { tombs[ds][id] = at; saveTombs(); } }
  const readJSON = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (_) { return null; } };
  const same = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };

  /* ---------- ملفات JSON (co / ad / du) ---------- */
  /* ملخص كل ملف (معرّف السجل ووقت تعديله) يُحفظ ولا يُعاد حسابه إلا إن تغيّر الملف (وقت التعديل والحجم):
     كانت كل دورة مزامنة (كل 20 ثانية، ولكل حاسبة تطلب من حاسبة القسم) تقرأ وتحلل كل الملفات كاملةً فتتوقف الكتابة لحظات */
  const DIG = {};
  function jsonDigest(ds) {
    const st = ctx.stamp ? ctx.stamp(ds) : '';
    if (st && DIG[ds] && DIG[ds].st === st) return { ids: DIG[ds].ids, tomb: tombs[ds] || {} };
    const j = ctx.readData(ds); const o = j ? safe(j) : {}; const arr = Array.isArray(o[JSON_KEYS[ds]]) ? o[JSON_KEYS[ds]] : [];
    const ids = {}; arr.forEach(r => { if (r && r.id && !r.demo) ids[r.id] = +r.updated || 0; });
    if (st) DIG[ds] = { st, ids };
    return { ids, tomb: tombs[ds] || {} };
  }
  const safe = t => { try { return JSON.parse(t) || {}; } catch (_) { return {}; } };
  function jsonGet(ds, wanted) {
    const o = safe(ctx.readData(ds) || '{}'); const arr = Array.isArray(o[JSON_KEYS[ds]]) ? o[JSON_KEYS[ds]] : [];
    const set = new Set(wanted); return arr.filter(r => r && set.has(r.id)).map(r => ({ id: r.id, u: +r.updated || 0, v: r }));
  }
  function mergeArch(a, b) {
    const newer = (+b.updated || 0) >= (+a.updated || 0) ? b : a, older = newer === a ? b : a;
    const m = { ...newer, dist: { ...(older.dist || {}) }, files: [] };
    for (const [k, d] of Object.entries(newer.dist || {})) { const o = m.dist[k]; m.dist[k] = !o ? d : { ...o, ...d, recvAt: d.recvAt || o.recvAt, recvBy: d.recvBy || o.recvBy }; }
    for (const [k, o] of Object.entries(older.dist || {})) if (!(newer.dist || {})[k] && (+newer.updated || 0) > (+o.at || 0) && !(o.recvAt) && (newer.distRemoved || []).includes(k)) delete m.dist[k];
    const seen = new Set(); for (const f of [...(newer.files || []), ...(older.files || [])]) if (f && !seen.has(f.name)) { seen.add(f.name); m.files.push(f); }
    const same = JSON.stringify({ d: a.dist || {}, f: (a.files || []).map(f => f.name).sort(), x: { ...a, dist: 0, files: 0, updated: 0 } }) === JSON.stringify({ d: m.dist, f: m.files.map(f => f.name).sort(), x: { ...m, dist: 0, files: 0, updated: 0 } });
    if (same) return null;
    const ab = JSON.stringify(m.dist) !== JSON.stringify(b.dist || {}) || m.files.length !== (b.files || []).length;
    m.updated = Math.max(+a.updated || 0, +b.updated || 0) + (ab ? 1 : 0);   // إن اختلف الدمج عن النسخة الواصلة يُرفع وقت التعديل فتعود النسخة المدمجة للطرف الآخر
    return m;
  }
  function jsonApply(ds, items, tin) {
    const text = ctx.readData(ds); const o = text ? safe(text) : {}; const key = JSON_KEYS[ds];
    const arr = Array.isArray(o[key]) ? o[key] : []; const map = new Map(arr.map(r => [r && r.id, r])); let changed = 0;
    const T = (tombs[ds] = tombs[ds] || {});
    for (const [id, at] of Object.entries(tin || {})) {
      if (!(T[id] >= at)) T[id] = at;
      const cur = map.get(id); if (cur && (+cur.updated || 0) <= at) { map.delete(id); changed++; }
    }
    for (const it of items || []) {
      const r = it.v; if (!r || !r.id) continue;
      if (ds === 'in' && !(r.project && r.order)) continue;   // جهاز بإصدار أقدم لا يعرف «in» قد يرد بسجلات نظام آخر if ((T[r.id] || 0) >= (+r.updated || 0)) continue;
      const cur = map.get(r.id);
      if (ds === 'ar' && cur && !r.type && !cur.type) {   // الأرشيف: دمج التوزيع والاستلام والمرفقات من الجهازين بدل أن يغلب أحدهما الآخر
        const m = mergeArch(cur, r); if (m) { map.set(r.id, m); changed++; } continue;
      }
      if (!cur || (+r.updated || 0) > (+cur.updated || 0)) { map.set(r.id, r); changed++; }
    }
    if (changed || (tin && Object.keys(tin).length)) { saveTombs(); }
    if (changed) { o[key] = [...map.values()].filter(Boolean); ctx.writeData(ds, JSON.stringify(o)); delete DIG[ds]; }
    return changed;
  }

  /* ---------- سجل الموقف المشترك (reg) ---------- */
  const readReg = () => { const j = readJSON(ctx.regFile()); return j && Array.isArray(j.projects) ? j : { app: 'anbar-projects-shared', version: 1, updated: '', source: '', projects: [], links: {}, meta: {} }; };
  /* موقف متراكم: جزء لكل لجنة (C|اللجنة)، والموقف الكامل يُبنى منها بالخوارزمية نفسها في anbar-registry.js */
  const RNr = x => String(x == null ? '' : x).replace(/[ً-ْـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/\s+/g, ' ').trim();
  function combineParts(parts) {
    const keys = Object.keys(parts || {}).filter(k => parts[k] && !parts[k].removed && Array.isArray(parts[k].projects)).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    const dkk = p => RNr(p.district).replace(/^(قضاء|ناحيه|ناحية)\s+/, '').replace(/^ال/, '').replace(/\s+/g, '');
    const same = (a, b) => { if (RNr(a.name) === RNr(b.name)) return true; const x = dkk(a), y = dkk(b); return !x || !y || x === y; };
    /* مثل anbar-registry.js: يبقى المشروع من الموقف الأحدث تحميلاً في البرنامج */
    const rk = k => [+parts[k].at || 0];
    const better = (a, b) => { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] > b[i]; return false; };
    const groups = {}, kept = []; keys.forEach(k => { const R = rk(k); parts[k].projects.forEach(p => { const base = String(p.fileNoDup || p.fileNo), G = groups[base] = groups[base] || []; let e = null;
      if (!p.noFileNo) e = G.find(x => same(x.p, p)) || null;
      if (e) { if (better(R, e.r)) { e.p = p; e.k = k; e.r = R; } } else { e = { p, k, r: R, base }; G.push(e); kept.push(e); } }); });
    const out = [], used = {}; kept.forEach(e => { const q = Object.assign({}, e.p); q.committee = q.committee || e.k; let fn = e.base, n = 2; if (!e.p.noFileNo) { while (used[fn]) { fn = e.base + '/' + n; n++; } } q.fileNo = fn; if (fn !== e.base) q.fileNoDup = e.base; else delete q.fileNoDup; used[fn] = 1; out.push(q); });
    return out;
  }
  function regDigest() {
    const s = readReg(), parts = s.parts && Object.keys(s.parts).length ? s.parts : null, ids = parts ? { E: +s.engineersAt || 0 } : { P: +s.projectsAt || 0, E: +s.engineersAt || 0 };
    if (+s.rosterAt) ids.R = +s.rosterAt;
    if (parts) for (const [c, v] of Object.entries(parts)) ids['C|' + c] = +(v && v.at) || 0;
    for (const [fn, L] of Object.entries(s.links || {})) for (const [sys, d] of Object.entries(L || {})) ids[`L|${fn}|${sys}`] = Date.parse(d && d.at) || 0;
    for (const fn of Object.keys(s.meta || {})) ids[`M|${fn}`] = +((s.metaAt || {})[fn]) || 0;
    return { ids, tomb: {} };
  }
  function regGet(wanted) {
    const s = readReg(), out = [];
    for (const id of wanted) {
      if (id === 'P') out.push({ id, u: +s.projectsAt || 0, v: { projects: s.projects, source: s.source } });
      else if (id === 'R') out.push({ id, u: +s.rosterAt || 0, v: { roster: s.roster || [], src: s.rosterSrc || '' } });
      else if (id === 'E') out.push({ id, u: +s.engineersAt || 0, v: { engineers: s.engineers || [] } });
      else if (id.startsWith('C|')) { const c = id.slice(2), v = s.parts && s.parts[c]; if (v) out.push({ id, u: +v.at || 0, v }); }
      else if (id.startsWith('L|')) { const [, fn, sys] = id.split('|'); const d = s.links && s.links[fn] && s.links[fn][sys]; if (d) out.push({ id, u: Date.parse(d.at) || 0, v: d }); }
      else if (id.startsWith('M|')) { const fn = id.slice(2); if (s.meta && s.meta[fn]) out.push({ id, u: +((s.metaAt || {})[fn]) || 0, v: s.meta[fn] }); }
    }
    return out;
  }
  function regApply(items) {
    const s = readReg(); s.links = s.links || {}; s.meta = s.meta || {}; s.metaAt = s.metaAt || {}; let changed = 0, partsChanged = false;
    for (const it of items || []) {
      if (it.id.startsWith('C|')) { const c = it.id.slice(2); s.parts = s.parts || {}; const cur = s.parts[c]; if (it.v && (!cur || (+cur.at || 0) < (it.u || 0))) { s.parts[c] = it.v; partsChanged = true; changed++; } continue; }
      if (it.id === 'P' && s.parts && Object.keys(s.parts).length) continue;   // جهاز بإصدار قديم: لا يستبدل الموقف المتراكم
      if (it.id === 'P') { if ((it.u || 0) > (+s.projectsAt || 0) && it.v && Array.isArray(it.v.projects)) { s.projects = it.v.projects; s.source = it.v.source || ''; s.projectsAt = it.u; changed++; } }
      else if (it.id === 'R') { if ((it.u || 0) > (+s.rosterAt || 0) && it.v && Array.isArray(it.v.roster)) { s.roster = it.v.roster; s.rosterSrc = it.v.src || ''; s.rosterAt = it.u; changed++; } }
      else if (it.id === 'E') { if ((it.u || 0) > (+s.engineersAt || 0) && it.v && Array.isArray(it.v.engineers)) { const seen = new Set(it.v.engineers.map(e => RNr(e.name))); s.engineers = it.v.engineers.concat((s.engineers || []).filter(e => !seen.has(RNr(e.name)))); s.engineersAt = it.u; changed++; } }
      else if (it.id.startsWith('L|')) { const [, fn, sys] = it.id.split('|'); const cur = s.links[fn] && s.links[fn][sys]; if (!cur || (Date.parse(cur.at) || 0) < (it.u || 0)) { (s.links[fn] = s.links[fn] || {})[sys] = it.v; changed++; } }
      else if (it.id.startsWith('M|')) { const fn = it.id.slice(2); if ((it.u || 0) > (+s.metaAt[fn] || 0)) { s.meta[fn] = it.v; s.metaAt[fn] = it.u; changed++; } }
    }
    if (partsChanged) { s.projects = combineParts(s.parts); s.projectsAt = Math.max(+s.projectsAt || 0, ...Object.values(s.parts).map(v => +(v && v.at) || 0)); }
    if (changed) { s.updated = new Date().toISOString(); ctx.writeReg(JSON.stringify(s)); }
    return changed;
  }

  /* ---------- محاضر الاستلام (ac): localStorage داخل نافذة النظام ---------- */
  const AC_DIGEST = `(()=>{const T=${JSON.stringify(AC_TYPES)};const now=Date.now(),out={ids:{},tomb:{}};window.__syncApplying=true;
    try{for(const t in T){let o={};try{o=JSON.parse(localStorage.getItem(T[t][0])||'{}')||{}}catch(e){}let ch=false;
      for(const k in o){if(!o[k].__u){o[k].__u=now;ch=true}if(!o[k].__id){o[k].__id=Math.random().toString(36).slice(2)+now.toString(36);ch=true}out.ids[t+'|'+k]=o[k].__u}
      if(ch)localStorage.setItem(T[t][0],JSON.stringify(o));out.ids['C|'+t]=parseInt(localStorage.getItem(T[t][1])||'0',10)||0}
      try{out.tomb=JSON.parse(localStorage.getItem('anbar_tombs_v1')||'{}')||{}}catch(e){}}finally{window.__syncApplying=false}return out})()`;
  const acGetCode = ids => `(()=>{const T=${JSON.stringify(AC_TYPES)};const w=${JSON.stringify(ids)},out=[];
    for(const id of w){const [t,k]=[id.split('|')[0],id.slice(id.indexOf('|')+1)];if(t==='C'){out.push({id,u:parseInt(localStorage.getItem(T[k][1])||'0',10)||0,v:parseInt(localStorage.getItem(T[k][1])||'0',10)||0});continue}
      let o={};try{o=JSON.parse(localStorage.getItem(T[t][0])||'{}')||{}}catch(e){}if(o[k])out.push({id,u:o[k].__u||0,v:o[k]})}return out})()`;
  const acApplyCode = (items, tin) => `(()=>{const T=${JSON.stringify(AC_TYPES)};const items=${JSON.stringify(items)},tin=${JSON.stringify(tin || {})};let changed=0;window.__syncApplying=true;
    try{const recs={},get=t=>recs[t]||(recs[t]=(()=>{try{return JSON.parse(localStorage.getItem(T[t][0])||'{}')||{}}catch(e){return {}}})());
      let TB={};try{TB=JSON.parse(localStorage.getItem('anbar_tombs_v1')||'{}')||{}}catch(e){}
      for(const id in tin){if(!(TB[id]>=tin[id]))TB[id]=tin[id];const t=id.split('|')[0],k=id.slice(id.indexOf('|')+1);const o=get(t);if(o[k]&&(o[k].__u||0)<=tin[id]){delete o[k];changed++}}
      for(const it of items){const t=it.id.split('|')[0],k=it.id.slice(it.id.indexOf('|')+1);
        if(t==='C'){const cur=parseInt(localStorage.getItem(T[k][1])||'0',10)||0;if(it.v>cur){localStorage.setItem(T[k][1],String(it.v));changed++}continue}
        if((TB[it.id]||0)>=(it.u||0))continue;const o=get(t),cur=o[k];
        if(!cur){o[k]=it.v;changed++}
        else if(cur.__id&&it.v.__id&&cur.__id!==it.v.__id){ // رقم محضر واحد أُصدر في جهازين: الأحدث يبقى والآخر يُحفظ بلاحقة -م
          const newer=(it.u||0)>(cur.__u||0)?it.v:cur,older=newer===cur?it.v:cur;let n=1,nk=k+'-م';while(o[nk]){n++;nk=k+'-م'+n}o[k]=newer;o[nk]=Object.assign({},older,{serial:older.serial?older.serial+'-م'+(n>1?n:''):older.serial});changed++}
        else if((it.u||0)>(cur.__u||0)){o[k]=it.v;changed++}}
      for(const t in recs)localStorage.setItem(T[t][0],JSON.stringify(recs[t]));localStorage.setItem('anbar_tombs_v1',JSON.stringify(TB))}finally{window.__syncApplying=false}return changed})()`;
  const acDigest = () => ctx.acEval(AC_DIGEST);
  const acGet = ids => ctx.acEval(acGetCode(ids));
  const acApply = (items, tin) => ctx.acEval(acApplyCode(items, tin));

  /* ---------- واجهة موحدة للمجموعات ---------- */
  /* ---------- مرفقات الأرشيف (arf): ملفات في مجلد «ملفات-الأرشيف/<معرّف الكتاب>/» تُنقل كما هي ---------- */
  /* حتى 100 م.ب للملف. الملف الأكبر من 8 م.ب يُنقل أجزاءً (8 م.ب لكل جزء) في ملف مؤقت «.part-<الحجم>-<الاسم>» ثم يُعاد تسميته عند اكتماله؛
     كل طرف يرسل في ملخصه ما وصله من الأجزاء (have) فيكمل الآخر من حيث توقف — حتى بعد انقطاع الشبكة أو إغلاق البرنامج.
     الأجزاء تُرسل متتالية في دورة المزامنة نفسها، فلا يتوقف البرنامج نصف ثانية لنقل ملف كبير دفعة واحدة. */
  const ARF_MAX = 100 * 1024 * 1024, ARF_CHUNK = 8 * 1024 * 1024, ARF_BATCH = 20 * 1024 * 1024;
  const PART = /^\.part-(\d+)-(.+)$/;
  const okKey = k => /^[A-Za-z0-9_-]{1,40}\/[^\\/:*?"<>|]{1,180}$/.test(k) && !k.includes('..');
  function arfDigest() {
    const ids = {}, have = {}, root = ctx.archDir ? ctx.archDir() : null; if (!root) return { ids, tomb: {}, have };
    try { for (const rec of fs.readdirSync(root)) { const d = path.join(root, rec); if (!fs.statSync(d).isDirectory()) continue;
      for (const f of fs.readdirSync(d)) { const st = fs.statSync(path.join(d, f)); if (!st.isFile()) continue;
        const pm = PART.exec(f); if (pm) { const k = rec + '/' + pm[2]; if (okKey(k) && st.size < +pm[1]) have[k] = [+pm[1], st.size]; continue; }
        const k = rec + '/' + f; if (st.size <= ARF_MAX && okKey(k)) ids[k] = st.size; } } } catch (_) {}
    return { ids, tomb: {}, have };
  }
  function arfGet(wanted, peer) {
    const out = []; let total = 0; const root = ctx.archDir(), parts = !!(peer && peer.have), H = parts ? peer.have : {};   // طرف بإصدار أقدم (لا يرسل have) لا يفهم الأجزاء: يأخذ حتى 15 م.ب كاملة كما كان
    for (const k of wanted) { if (!okKey(k)) continue;
      try { const f = path.join(root, k), size = fs.statSync(f).size; if (size > ARF_MAX) continue;
        if (!parts && size > 15 * 1024 * 1024) continue;
        if (size <= ARF_CHUNK || !parts) { if (out.length && total + size > ARF_BATCH) break; const b = fs.readFileSync(f); total += b.length; out.push({ id: k, u: b.length, v: b.toString('base64') }); continue; }
        const h = H[k], off = Array.isArray(h) && +h[0] === size && +h[1] > 0 && +h[1] < size ? +h[1] : 0, len = Math.min(ARF_CHUNK, size - off);
        if (out.length && total + len > ARF_BATCH) break;
        const b = Buffer.alloc(len), fd = fs.openSync(f, 'r'); try { fs.readSync(fd, b, 0, len, off); } finally { fs.closeSync(fd); }
        total += len; out.push({ id: k, u: size, off, part: 1, v: b.toString('base64') });
      } catch (_) {} }
    return out;
  }
  function arfApply(items) {
    let n = 0; const root = ctx.archDir();
    for (const it of items || []) { const k = it.id; if (!okKey(k) || typeof it.v !== 'string') continue;
      try { const b = Buffer.from(it.v, 'base64'), f = path.join(root, k);
        if (it.part) {   // جزء من ملف كبير
          const u = +it.u, off = +it.off || 0; if (!(u > 0 && u <= ARF_MAX) || off + b.length > u) continue;
          let done = false; try { done = fs.statSync(f).size === u; } catch (_) {} if (done) continue;
          const pf = path.join(path.dirname(f), '.part-' + u + '-' + path.basename(f)); fs.mkdirSync(path.dirname(f), { recursive: true });
          let cur = 0; try { cur = fs.statSync(pf).size; } catch (_) {}
          if (off === 0) fs.writeFileSync(pf, b); else if (off === cur) fs.appendFileSync(pf, b); else continue;   // جزء خارج الترتيب: يُطلب من جديد بالملخص
          if (off + b.length === u) { fs.renameSync(pf, f); n++; }
          continue;
        }
        let same = false; try { same = fs.statSync(f).size === b.length; } catch (_) {}
        if (!same) { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, b); n++; } } catch (_) {} }
    return n;
  }
  const API = {
    digest: async ds => (JSON_KEYS[ds] ? jsonDigest(ds) : ds === 'arf' ? arfDigest() : ds === 'reg' ? regDigest() : acDigest()),
    get: async (ds, ids, peer) => (JSON_KEYS[ds] ? jsonGet(ds, ids) : ds === 'arf' ? arfGet(ids, peer) : ds === 'reg' ? regGet(ids) : acGet(ids)),
    apply: async (ds, items, tin) => (JSON_KEYS[ds] ? jsonApply(ds, items, tin) : ds === 'arf' ? arfApply(items) : ds === 'reg' ? regApply(items) : acApply(items, tin))
  };
  // ما ينقصه الطرف الآخر: عناصر أحدث عندي أو غير موجودة عنده (ما لم يكن لديه شاهد حذف أحدث)، وشواهد الحذف الأحدث
  function diff(mine, theirs) {
    const give = [], need = [], tombGive = {};
    for (const [id, u] of Object.entries(mine.ids)) { const t = theirs.ids[id]; const tb = theirs.tomb[id] || 0; if ((t === undefined || u > t) && tb < u) give.push(id); }
    for (const [id, u] of Object.entries(theirs.ids)) { const m = mine.ids[id]; const tb = mine.tomb[id] || 0; if ((m === undefined || u > m) && tb < u) need.push(id); }
    for (const [id, at] of Object.entries(mine.tomb)) if (!(theirs.tomb[id] >= at)) tombGive[id] = at;
    return { give, need, tombGive };
  }

  /* ---------- صلاحيات الأرشيف: كل لجنة تستلم صندوقها فقط ----------
     العميل يرسل صندوقه (box) وبصمة كلمة سره (tok)؛ الخادم يقارنها بسجل auth_<box> في ملف الأرشيف.
     القسم (dept) بكلمة سر صحيحة يرى كل شيء، وقبل أن يضع القسم كلمة سره يبقى الأرشيف مفتوحاً للجميع (مرحلة الإعداد). */
  function arScope(body) {
    const box = String((body && body.box) || ''), tok = String((body && body.tok) || '');
    const recs = (safe(ctx.readData('ar') || '{}').records || []).filter(Boolean);
    const authOf = b => recs.find(r => r.type === 'auth' && r.box === b && !r.removed);
    if (!authOf('dept')) return null;
    const a = authOf(box), valid = !!(a && tok && a.hash && same(tok, a.hash));
    if (valid && box === 'dept') return null;
    const vis = new Set(recs.filter(r => r.type === 'box' || r.type === 'auth').map(r => r.id));
    if (valid) recs.forEach(r => { if (!r.type && r.dist && r.dist[box]) vis.add(r.id); });
    // أول كلمة سر لصندوق ليس له كلمة بعد: يُقبل سجلها من الجهاز الذي يطالب بالصندوق
    const canSetAuth = box && box !== 'dept' && (!a || valid);
    return { vis, box, valid, allowIn: id => vis.has(id) || (canSetAuth && id === 'auth_' + box) };
  }
  const recOf = (ds, id) => (ds === 'arf' ? String(id).split('/')[0] : id);
  function scopeDigest(ds, mine, sc) {
    const ids = {}; for (const [k, v] of Object.entries(mine.ids)) if (sc.vis.has(recOf(ds, k))) ids[k] = v;
    return { ids, tomb: {} };
  }

  /* ---------- الخادم ---------- */
  /* حالة الحاسبات المتصلة (على حاسبة القسم): اسم كل حاسبة لجنة وعنوانها وإصدارها وآخر اتصال — تُحفظ في sync-peers.json */
  const peersFile = () => path.join(ctx.dataDir(), 'sync-peers.json');
  let PEERS = null, peersSaveT = null;
  const peersLoad = () => { if (!PEERS) { try { PEERS = JSON.parse(fs.readFileSync(peersFile(), 'utf8')) || {}; } catch (_) { PEERS = {}; } } return PEERS; };
  function notePeer(req) {
    try {
      const P = peersLoad(), ip = String((req.socket && req.socket.remoteAddress) || '').replace(/^::ffff:/, '');
      let name = ''; try { name = decodeURIComponent(String(req.headers['x-sync-name'] || '')); } catch (_) {}
      const ver = String(req.headers['x-sync-ver'] || ''), k = (name || ip).slice(0, 80), now = Date.now();
      const p = P[k] || (P[k] = { first: now }); p.name = name; p.ip = ip; p.ver = ver; p.last = now; p.n = (p.n || 0) + 1;
      if (!peersSaveT) peersSaveT = setTimeout(() => { peersSaveT = null; try { fs.writeFileSync(peersFile(), JSON.stringify(PEERS)); } catch (_) {} }, 30000);
    } catch (_) {}
  }
  function startServer() {
    stopServer();
    server = http.createServer(async (req, res) => {
      const send = (code, obj) => { const b = Buffer.from(JSON.stringify(obj)); res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': b.length }); res.end(b); };
      try {
        if (!cfg.key || !same(req.headers['x-sync-key'] || '', cfg.key)) return send(403, { error: 'key' });
        { const um = req.method === 'GET' && String(req.url || '').match(/^\/sync\/update\/(info|file)$/);   // التحديث من حاسبة القسم
          if (um) { if (cfg.mode === 'server' && ctx.updater) return ctx.updater.serve(um[1], res); return send(404, { error: 'none' }); } }
        notePeer(req);
        const m = req.url.match(/^\/sync\/(ping|(co|du|ad|in|lt|fu|dm|cm|ar|arf|reg|ac|wf|pl|wfa)\/(digest|push))$/);
        if (!m) return send(404, { error: 'nf' });
        if (m[1] === 'ping') return send(200, { ok: true, time: Date.now(), name: cfg.name || os.hostname(), sets: ALL, ver: String(ctx.version || '') });
        const ds = m[2], act = m[3];
        const chunks = []; let size = 0;
        for await (const c of req) { size += c.length; if (size > 80 * 1024 * 1024) return send(413, { error: 'big' }); chunks.push(c); }
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
        const sc = (ds === 'ar' || ds === 'arf') ? arScope(body) : null;
        if (sc) { body.tomb = {}; }   // لجنة لا تحذف من الأرشيف
        if (act === 'digest') {
          let mine = await API.digest(ds); let myHave = mine.have || null; if (sc) { mine = scopeDigest(ds, mine, sc); if (myHave) myHave = Object.fromEntries(Object.entries(myHave).filter(([k]) => sc.allowIn(recOf(ds, k)))); }
          const theirs = { ids: body.ids || {}, tomb: body.tomb || {} };
          const d = diff(mine, theirs); if (sc) d.need = d.need.filter(id => sc.allowIn(recOf(ds, id)));
          if (Object.keys(theirs.tomb).length) { const n = await API.apply(ds, [], theirs.tomb); if (n) ctx.applied(ds); }
          const items = d.give.length ? await API.get(ds, d.give, body.have ? { have: body.have } : null) : [];
          return send(200, myHave ? { items, tomb: d.tombGive, want: d.need, have: myHave } : { items, tomb: d.tombGive, want: d.need });
        }
        const inItems = sc ? (body.items || []).filter(it => it && sc.allowIn(recOf(ds, it.id))) : (body.items || []);
        const n = await API.apply(ds, inItems, body.tomb || {}); if (n) ctx.applied(ds);
        return send(200, { ok: true, applied: n });
      } catch (e) { return send(500, { error: String(e && e.message || e) }); }
    });
    /* حاسبة انقطعت شبكتها في منتصف الإرسال لا تُبقي اتصالها معلّقاً على حاسبة القسم إلى الأبد */
    try { server.requestTimeout = 180000; server.headersTimeout = 30000; } catch (_) {}
    server.on('error', e => { state.ok = false; state.error = 'تعذّر تشغيل الخادم: ' + (e.code === 'EADDRINUSE' ? 'المنفذ مشغول' : e.message); push(); });
    server.listen(cfg.port || DEFAULT_PORT, '0.0.0.0', () => { state.ok = true; state.error = ''; push(); });
  }
  function stopServer() { if (server) { try { server.close(); } catch (_) {} server = null; } }

  /* ---------- العميل ---------- */
  // عنوان الخادم: «192.168.1.10:47900» (شبكة محلية) أو «https://اسم.workers.dev» (سحابة)
  /* العنوان اليدوي الصالح فقط: IPv4 (192.168.1.10 أو 192.168.1.10:47900) أو اسم حاسبة أو رابط https للسحابة.
     رقم وحده («47900» — رقم المنفذ لا العنوان) أو عنوان غير صالح يُهمل ويُكمل الاكتشاف التلقائي (كان يُقرأ «0.0.187.28») */
  function manualServer() {
    const t = String(cfg.server || '').trim(); if (!t) return '';
    if (/^https?:\/\//i.test(t)) { try { const u = new URL(t); return u.hostname && !/^[\d.]+$/.test(u.hostname) || /^(\d{1,3}\.){3}\d{1,3}$/.test(u.hostname) ? t : ''; } catch (_) { return ''; } }
    const m = t.match(/^([^:\s\/]+)(?::(\d{1,5}))?$/); if (!m) return '';
    const h = m[1]; if (/^\d+$/.test(h)) return '';
    if (/^[\d.]+$/.test(h)) { const q = h.split('.'); if (q.length !== 4 || q.some(x => x === '' || +x > 255) || +q[0] === 0) return ''; }
    return t;
  }
  function parseServer() {
    let t = manualServer() || found || ''; if (!t) return null;
    if (!/^https?:\/\//i.test(t)) t = 'http://' + t;
    try { const u = new URL(t); const tls = u.protocol === 'https:'; return { tls, hostname: u.hostname, port: +u.port || (tls ? 443 : DEFAULT_PORT), base: u.pathname.replace(/\/+$/, '') }; } catch (_) { return null; }
  }
  const isCloud = () => { const u = parseServer(); return !!(u && u.tls); };
  /* تشفير القيم من طرف العميل (AES-256-GCM) قبل رفعها؛ الوسيط السحابي لا يرى المحتوى */
  let encKey = null;
  const keyOf = () => { if (!cfg.secret) return null; if (!encKey || encKey.s !== cfg.secret) encKey = { s: cfg.secret, k: crypto.scryptSync(String(cfg.secret), 'anbar-sync-v1', 32) }; return encKey.k; };
  const enc = v => {
    const k = keyOf(); if (!k) return v;
    const iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', k, iv), ct = Buffer.concat([c.update(JSON.stringify(v === undefined ? null : v), 'utf8'), c.final()]);
    return { __enc: 1, iv: iv.toString('base64'), ct: ct.toString('base64'), tag: c.getAuthTag().toString('base64') };
  };
  const dec = v => {
    if (!v || v.__enc !== 1) return v;
    const k = keyOf(); if (!k) throw new Error('البيانات على السحابة مشفّرة: أدخل كلمة سر التشفير نفسها');
    try { const d = crypto.createDecipheriv('aes-256-gcm', k, Buffer.from(v.iv, 'base64')); d.setAuthTag(Buffer.from(v.tag, 'base64')); return JSON.parse(Buffer.concat([d.update(Buffer.from(v.ct, 'base64')), d.final()]).toString('utf8')); }
    catch (_) { throw new Error('كلمة سر التشفير غير صحيحة'); }
  };
  function call(pathname, bodyObj) {
    return new Promise((resolve, reject) => {
      const u = parseServer(); if (!u) return reject(new Error('أدخل عنوان الخادم'));
      const b = Buffer.from(JSON.stringify(bodyObj || {}));
      const req = (u.tls ? https : http).request({ hostname: u.hostname, port: u.port, path: u.base + pathname, method: 'POST', timeout: u.tls ? 30000 : 12000, headers: { 'Content-Type': 'application/json', 'Content-Length': b.length, 'x-sync-key': cfg.key, 'x-sync-name': encodeURIComponent(cfg.name || os.hostname()), 'x-sync-ver': String(ctx.version || '') } }, r => {
        const ch = []; r.on('data', c => ch.push(c)); r.on('end', () => { let j = {}; try { j = JSON.parse(Buffer.concat(ch).toString('utf8')); } catch (_) {} if (r.statusCode === 403) return reject(new Error('مفتاح المزامنة غير صحيح')); if (r.statusCode >= 300) return reject(new Error(j.error || ('خطأ ' + r.statusCode))); resolve(j); });
      });
      req.on('timeout', () => req.destroy(new Error('انتهت مهلة الاتصال بالخادم')));
      /* حد أقصى كلي للطلب (لا مهلة السكون فقط): شبكة ضعيفة متقطعة تُرسل بايتات متفرقة كانت تُبقي المزامنة معلّقة بلا نهاية فتتوقف كل الدورات اللاحقة */
      const hard = setTimeout(() => req.destroy(new Error('الاتصال بطيء جداً أو متقطع — ستُعاد المحاولة تلقائياً')), +process.env.UNI_SYNC_HARD_MS || 180000);
      req.on('close', () => clearTimeout(hard));
      const NET = { ECONNRESET: 1, ECONNABORTED: 1, EPIPE: 1, ETIMEDOUT: 1, ENETUNREACH: 1, ENETDOWN: 1, EHOSTDOWN: 1 };
      req.on('error', e => reject(new Error(e.code === 'ECONNREFUSED' || e.code === 'EHOSTUNREACH' || e.code === 'ENOTFOUND' || e.code === 'EAI_AGAIN' ? (u.tls ? 'تعذّر الوصول إلى الخدمة السحابية. تحقق من اتصال الانترنت ومن العنوان.' : 'تعذّر الوصول إلى الخادم. تأكد من العنوان وأن الخادم يعمل وأن الجهازين على نفس الشبكة.') : NET[e.code] || /socket hang up/i.test(e.message || '') ? 'انقطع الاتصال أثناء المزامنة (الشبكة أو الانترنت) — ستُعاد المحاولة تلقائياً' : (e.message || String(e)))));
      req.end(b);
    });
  }
  /* ---------- الاكتشاف التلقائي ---------- */
  const discTag = k => crypto.createHash('sha256').update('anbar-disc-v1:' + String(k == null ? cfg.key || '' : k)).digest('hex').slice(0, 20);
  function bcasts() {
    const out = new Set(['255.255.255.255', '127.0.0.1']);
    for (const list of Object.values(os.networkInterfaces())) for (const a of list || []) {
      if (a.family !== 'IPv4' || a.internal || !a.netmask) continue;
      const ip = a.address.split('.').map(Number), m = a.netmask.split('.').map(Number); out.add(ip.map((x, i) => (x & m[i]) | (~m[i] & 255)).join('.'));
    }
    return [...out];
  }
  function startBeacon() {
    stopBeacon(); if (!cfg.key) return;
    try {
      udp = dgram.createSocket({ type: 'udp4', reuseAddr: true });
      udp.on('message', (msg, r) => { const t = String(msg); if (t === 'ANBAR?' + discTag()) { const b = Buffer.from(JSON.stringify({ t: 'ANBAR!', tag: discTag(), port: cfg.port || DEFAULT_PORT, name: cfg.name || os.hostname() })); try { udp.send(b, r.port, r.address); } catch (_) {} } });
      udp.on('error', () => {}); udp.bind(DISC_PORT, '0.0.0.0');
    } catch (_) {}
  }
  function stopBeacon() { if (udp) { try { udp.close(); } catch (_) {} udp = null; } }
  /* بديل الاكتشاف: إن لم يصل البث (جدار حماية، أو شبكة مقسّمة) تُسأل كل عناوين الشبكة المحلية (/24) مباشرة على منفذ المزامنة برمز القسم */
  function scanLan(key, port, ms = 700) {
    const K = key; if (!K) return Promise.resolve([]);
    const mine = new Set(), bases = new Set();
    for (const list of Object.values(os.networkInterfaces())) for (const a of list || []) { if (a.family !== 'IPv4' || a.internal) continue; mine.add(a.address); bases.add(a.address.split('.').slice(0, 3).join('.')); }
    const targets = []; for (const b of bases) for (let i = 1; i < 255; i++) { targets.push(b + '.' + i); }
    const hits = []; let k = 0;
    const one = ip => new Promise(res => { const rq = http.request({ hostname: ip, port, path: '/sync/ping', method: 'GET', headers: { 'x-sync-key': K }, timeout: ms }, r => { let b = ''; r.on('data', c => { b += c; }); r.on('end', () => { try { const j = JSON.parse(b); if (r.statusCode === 200 && j.ok) hits.push({ address: ip, port, name: j.name || '' }); } catch (_) {} res(); }); });
      rq.on('timeout', () => { rq.destroy(); res(); }); rq.on('error', () => res()); rq.end(); });
    const worker = async () => { while (k < targets.length) await one(targets[k++]); };
    return Promise.all(Array.from({ length: 64 }, worker)).then(() => hits);
  }
  async function discover(ms, key) { const L = await discoverUdp(ms, key); if (L.length) return L; return scanLan(key == null ? cfg.key : key, cfg.port || DEFAULT_PORT); }
  function discoverUdp(ms = 1800, key) {
    return new Promise(resolve => {
      const K = key == null ? cfg.key : key; if (!K) return resolve([]);
      const sock = dgram.createSocket({ type: 'udp4', reuseAddr: true }), got = new Map();
      sock.on('message', (msg, r) => { try { const j = JSON.parse(String(msg)); if (j.t === 'ANBAR!' && j.tag === discTag(K)) got.set(r.address + ':' + j.port, { address: r.address, port: j.port, name: j.name }); } catch (_) {} });
      sock.on('error', () => {});
      sock.bind(0, () => { try { sock.setBroadcast(true); } catch (_) {} const m = Buffer.from('ANBAR?' + discTag(K)); for (const a of bcasts()) { try { sock.send(m, DISC_PORT, a); } catch (_) {} } });
      setTimeout(() => { try { sock.close(); } catch (_) {} const L = [...got.values()]; const lan = L.filter(x => x.address !== '127.0.0.1'); resolve(lan.length ? lan : L); }, ms);
    });
  }
  const isAuto = () => !manualServer();
  async function ensureFound(force) {
    if (!isAuto()) return true;
    if (found && !force) return true;
    const L = await discover(); if (!L.length) { found = null; state.found = ''; return false; }
    found = L[0].address + ':' + L[0].port; state.found = found; state.foundName = L[0].name || ''; return true;
  }
  let running = null;
  function syncOnce() { if (busy) return running; if (cfg.mode !== 'client') return Promise.resolve(); running = doSync(); return running; }
  async function doSync() {
    busy = true; let applied = 0;
    try {
      if (!(await ensureFound(false))) throw new Error('لم يُعثر على حاسبة القسم في الشبكة — تأكد أنها مشغّلة وأن رمز القسم نفسه');
      let ping; const t0 = Date.now();
      try { ping = await call('/sync/ping', {}); } catch (e) { if (!isAuto() || /مفتاح/.test(e.message)) throw e; if (!(await ensureFound(true))) throw new Error('لم يُعثر على حاسبة القسم في الشبكة — تأكد أنها مشغّلة وأن رمز القسم نفسه'); ping = await call('/sync/ping', {}); } state.skew = Math.round((ping.time - Date.now() + (Date.now() - t0) / 2) / 1000); state.peers = 1; state.serverVer = String(ping.ver || ''); state.serverName = String(ping.name || '');
      for (const ds of ALL) {
        if (ds === 'ac' && !ctx.acAvailable()) continue;
        if (['in', 'lt', 'fu', 'dm', 'cm', 'ar', 'arf', 'wf', 'pl', 'wfa'].includes(ds) && !(ping.sets || []).includes(ds)) continue;   // خادم أقدم لا يعرف هذه المجموعة   // خادم أو سحابة بإصدار أقدم لا يعرف «إطلاق التأمينات»
        const rv = ping.revs ? (ping.revs[ds] || 0) : undefined;
        // مرفقات الأرشيف: تتكرر الجولة ما دام هناك ما يُنقل (أجزاء ملف كبير أو دفعات متتالية)، حتى 40 جولة
        for (let round = 0; round < (ds === 'arf' ? 40 : 1); round++) {
          const mine = await API.digest(ds), sig = JSON.stringify(mine);
          if (round === 0 && rv !== undefined && lastRev[ds] === rv && lastSig[ds] === sig) break;   // لا تغيير محلياً ولا على السحابة: لا حاجة للمقارنة
          const cred = (ds === 'ar' || ds === 'arf') && ctx.archCred ? (ctx.archCred() || {}) : null;
          const r = await call(`/sync/${ds}/digest`, cred ? { ...mine, box: cred.box, tok: cred.tok } : mine);
          let n = 0, sent = 0;
          if ((r.items && r.items.length) || (r.tomb && Object.keys(r.tomb).length)) n += await API.apply(ds, (r.items || []).map(it => ({ ...it, v: dec(it.v) })), r.tomb || {});
          if (r.want && r.want.length) { const items = (await API.get(ds, r.want, r.have ? { have: r.have } : null)).map(it => ({ ...it, v: enc(it.v) })); sent = items.length; if (sent) await call(`/sync/${ds}/push`, cred ? { items, tomb: {}, box: cred.box, tok: cred.tok } : { items, tomb: {} }); }
          if (n) { applied += n; ctx.applied(ds); }
          if (!((r.items && r.items.length) || sent)) break;
        }
        if (rv !== undefined) { lastRev[ds] = rv; lastSig[ds] = JSON.stringify(await API.digest(ds)); }
      }
      state.ok = true; state.error = ''; state.last = Date.now(); state.applied += applied;
      try { const u = parseServer(); if (ctx.onSynced && u && !u.tls) ctx.onSynced({ base: `http://${u.hostname}:${u.port}${u.base || ''}`, key: cfg.key, serverVer: state.serverVer || '' }); } catch (_) {}
    } catch (e) { state.ok = false; state.error = e.message || String(e); for (const k of Object.keys(lastRev)) delete lastRev[k]; }
    busy = false; push();
  }
  const push = () => ctx.onState({ ...state, cloud: isCloud(), mode: cfg.mode, addresses: addresses(), port: cfg.port || DEFAULT_PORT, name: cfg.name, auto: isAuto() });
  function addresses() {
    const out = []; const ni = os.networkInterfaces();
    for (const k of Object.keys(ni)) for (const a of ni[k] || []) if (a.family === 'IPv4' && !a.internal) out.push(a.address);
    return out;
  }

  /* ---------- التشغيل ---------- */
  function apply() {
    stopServer(); if (timer) { clearInterval(timer); timer = null; }
    state.mode = cfg.mode; state.ok = null; state.error = '';
    stopBeacon();
    if (cfg.mode === 'server') { if (!cfg.key) { state.ok = false; state.error = 'عيّن رمز القسم أولاً'; } else { startServer(); startBeacon(); } }
    else if (cfg.mode === 'client') { timer = setInterval(syncOnce, 50000); /* كل 50 ثانية، وبعد كل حفظ بثلاث ثوانٍ لتصل التعديلات سريعاً */ setTimeout(syncOnce, 800); }
    push();
  }
  return {
    init() { loadCfg(); apply(); },
    getConfig: () => ({ ...cfg, addresses: addresses(), defaultPort: DEFAULT_PORT }),
    setConfig(c) {
      cfg = { ...cfg, mode: ['off', 'server', 'client'].includes(c.mode) ? c.mode : 'off', port: +c.port || DEFAULT_PORT, key: String(c.key || ''), server: String(c.server || '').trim(), name: String(c.name || ''), secret: String(c.secret || '') };
      try { fs.writeFileSync(cfgFile(), JSON.stringify(cfg)); } catch (_) {}
      found = null; state.found = ''; apply(); return true;
    },
    tomb, tombMany, async syncNow() { clearTimeout(kick); if (busy && running) { try { await running; } catch (_) {} } return syncOnce(); },
    // يُستدعى بعد أي حفظ محلي: مزامنة قريبة
    changed() { if (cfg.mode !== 'client') return; clearTimeout(kick); kick = setTimeout(syncOnce, 3000); },
    state: () => ({ ...state, mode: cfg.mode, addresses: addresses(), port: cfg.port || DEFAULT_PORT, name: cfg.name, auto: isAuto() }),
    stop() { stopServer(); stopBeacon(); if (timer) clearInterval(timer); },
    discover: key => discover(1800, key),
    isTomb: (ds, id) => !!(tombs[ds] && tombs[ds][id]),
    scanLan: key => scanLan(key, cfg.port || DEFAULT_PORT),
    peers: () => ({ self: { name: cfg.name || os.hostname(), mode: cfg.mode, ver: String(ctx.version || ''), last: state.last, ok: state.ok, error: state.error, serverVer: state.serverVer || '', serverName: state.serverName || state.foundName || '' },
      list: Object.values(peersLoad()).map(p => ({ ...p })).sort((a, b) => (b.last || 0) - (a.last || 0)) }),
    _API: API
  };
};
