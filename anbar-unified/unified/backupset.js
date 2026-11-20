'use strict';
/* النسخة الاحتياطية بملف واحد لكل الأنظمة («نسخة-الشؤون-الهندسية_<التاريخ>.zip») واسترجاعها:
   - يضم ملف ZIP واحد: بيانات كل الأنظمة (JSON)، ولوحة سير المعاملات ومرفقاتها، ومشاريع التخطيط وملفها، وسجل الموقف العام،
     وسجلات شهادات الاستلام؛ ومرفقات الأرشيف في «النسخة الكاملة» اليدوية (لا اليومية — حجمها كبير وتبقى في النسخة الخارجية «الأحدث»).
   - كلمات السر وإعدادات الحاسبة لا تدخل النسخة.
   - الاسترجاع: تُختار النسخة (يومية داخلية، أو خارجية، أو ملف) والأنظمة المطلوبة؛ وقبل أي استرجاع تُحفظ تلقائياً نسخة
     «قبل-الاسترجاع» من الحالة الحالية فيمكن التراجع. السجلات تُستبدل بما في النسخة للأنظمة المختارة فقط.
   - تُقرأ أيضاً النسخ اليومية القديمة (ملف لكل نظام في اليوم) لتُسترجع بالطريقة نفسها. */
const fs = require('fs'), fsp = fs.promises, path = require('path'), zlib = require('zlib');

/* ---------- ZIP بلا مكتبات ---------- */
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = b => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function dosTime(d) { return { t: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), d: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate() }; }
const deflateP = (b) => new Promise((res, rej) => zlib.deflateRaw(b, { level: 6 }, (e, r) => e ? rej(e) : res(r)));   // الضغط في الخلفية (لا يجمّد البرنامج)
async function makeZip(entries) {
  const parts = [], cen = []; let off = 0; const now = dosTime(new Date());
  for (const e of entries) {
    const name = Buffer.from(e.name.replace(/\\/g, '/'), 'utf8'), raw = Buffer.isBuffer(e.data) ? e.data : Buffer.from(String(e.data), 'utf8');
    const def = await deflateP(raw), store = def.length >= raw.length, body = store ? raw : def, crc = crc32(raw);
    const h = Buffer.alloc(30); h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x0800, 6); h.writeUInt16LE(store ? 0 : 8, 8); h.writeUInt16LE(now.t, 10); h.writeUInt16LE(now.d, 12);
    h.writeUInt32LE(crc, 14); h.writeUInt32LE(body.length, 18); h.writeUInt32LE(raw.length, 22); h.writeUInt16LE(name.length, 26); h.writeUInt16LE(0, 28);
    parts.push(h, name, body);
    const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8); c.writeUInt16LE(store ? 0 : 8, 10); c.writeUInt16LE(now.t, 12); c.writeUInt16LE(now.d, 14);
    c.writeUInt32LE(crc, 16); c.writeUInt32LE(body.length, 20); c.writeUInt32LE(raw.length, 24); c.writeUInt16LE(name.length, 28); c.writeUInt32LE(off, 42);
    cen.push(c, name); off += 30 + name.length + body.length;
  }
  const cd = Buffer.concat(cen), end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(off, 16);
  return Buffer.concat([...parts, cd, end]);
}
function readZip(buf) {
  let e = -1; for (let i = buf.length - 22; i >= Math.max(0, buf.length - 70000); i--) if (buf.readUInt32LE(i) === 0x06054b50) { e = i; break; }
  if (e < 0) throw new Error('الملف ليس نسخة احتياطية صالحة (ZIP)');
  const n = buf.readUInt16LE(e + 10); let p = buf.readUInt32LE(e + 16); const out = {};
  for (let k = 0; k < n; k++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break;
    const meth = buf.readUInt16LE(p + 10), csz = buf.readUInt32LE(p + 20), nl = buf.readUInt16LE(p + 28), xl = buf.readUInt16LE(p + 30), cl = buf.readUInt16LE(p + 32), off = buf.readUInt32LE(p + 42);
    const name = buf.slice(p + 46, p + 46 + nl).toString('utf8'); p += 46 + nl + xl + cl;
    const lnl = buf.readUInt16LE(off + 26), lxl = buf.readUInt16LE(off + 28), data = buf.slice(off + 30 + lnl + lxl, off + 30 + lnl + lxl + csz);
    out[name] = meth === 0 ? data : zlib.inflateRawSync(data);
  }
  return out;
}

/* الأنظمة كما تظهر للمستخدم: كل نظام = ملفات بياناته */
const GROUPS = [
  { id: 'co', t: 'أوامر التغيير', ds: ['co'] }, { id: 'cm', t: 'مطالعات لجنة أوامر التغيير', ds: ['cm'] }, { id: 'fu', t: 'مطالعات أوامر التغيير (القديمة)', ds: ['fu'] },
  { id: 'du', t: 'المدد والتوقف', ds: ['du'] }, { id: 'dm', t: 'مطالعات لجنة المدد', ds: ['dm'] }, { id: 'ad', t: 'لجنة تدقيق السلف', ds: ['ad'] },
  { id: 'in', t: 'إطلاق التأمينات', ds: ['in'] }, { id: 'lt', t: 'المخاطبات والمطالعات', ds: ['lt'] }, { id: 'ar', t: 'الأرشيف والتوزيع (ومرفقاته إن وُجدت في النسخة)', ds: ['ar'], files: 'arf' },
  { id: 'fv', t: 'تقارير زيارة مشاريع التنفيذ', ds: ['fv'] }, { id: 'ac', t: 'شهادات الاستلام', ds: ['acr'] },
  { id: 'wf', t: 'لوحة سير المعاملات ومرفقاتها', ds: ['wf', 'wfa'] }, { id: 'pl', t: 'مشاريع التخطيط', ds: ['pl'], files: 'plan' }, { id: 'reg', t: 'الموقف العام (سجل المشاريع)', ds: ['reg'] }];
const countOf = text => { try { const o = JSON.parse(text); if (Array.isArray(o)) return o.length; for (const k of ['records', 'recs', 'projects', 'items', 'cards']) if (Array.isArray(o[k])) return o[k].length; if (o && typeof o === 'object') { const v = Object.values(o).filter(x => typeof x === 'string'); if (v.length) return v.reduce((a, s) => { try { return a + Object.keys(JSON.parse(s || '{}')).length; } catch (_) { return a; } }, 0); } return null; } catch (_) { return null; } };
const PREFIX = 'نسخة-الشؤون-الهندسية_', SAFE = 'قبل-الاسترجاع_';

module.exports = function createBackupSet(ctx) {
  // ctx: dataDir(), file(ds) → مسار ملف البيانات، regFile(), archDir(), planDir(), extDirs() → مجلدات «يومي» الخارجية، device(), version, keep (عدد النسخ اليومية)
  const bdir = () => path.join(ctx.dataDir(), 'backups');
  async function walk(dir, rel, out) { let ents = []; try { ents = await fsp.readdir(dir, { withFileTypes: true }); } catch (_) { return out; }
    for (const e of ents) { if (/\.(tmp|part)$/i.test(e.name) || e.name.startsWith('.part')) continue; const r = rel ? rel + '/' + e.name : e.name;
      if (e.isDirectory()) await walk(path.join(dir, e.name), r, out); else if (e.isFile()) out.push(r); } return out; }
  /* بناء النسخة: {attachments} لمرفقات الأرشيف */
  async function build(opt = {}) {
    const entries = [], man = { app: 'anbar-unified-backup', version: 1, prog: ctx.version, at: new Date().toISOString(), device: ctx.device(), attachments: !!opt.attachments, sys: {} };
    const add = (name, data) => entries.push({ name, data });
    for (const g of GROUPS) {
      let n = 0, have = false;
      for (const ds of g.ds) { const f = ds === 'reg' ? ctx.regFile() : ctx.file(ds); if (!f || !fs.existsSync(f)) continue;
        const t = await fsp.readFile(f, 'utf8'); try { JSON.parse(t); } catch (_) { continue; } add('data/' + ds + '.json', t); have = true; const c = countOf(t); if (c != null) n += c; }
      if (g.files === 'plan') { const d = ctx.planDir(); for (const r of await walk(d, '', [])) { add('planning/' + r, await fsp.readFile(path.join(d, r))); have = true; } }
      if (g.files === 'arf' && opt.attachments) { const d = ctx.archDir(); let k = 0; for (const r of await walk(d, '', [])) { add('archive-files/' + r, await fsp.readFile(path.join(d, r))); k++; } man.arfCount = k; }
      if (have) man.sys[g.id] = { t: g.t, n };
    }
    add('manifest.json', JSON.stringify(man, null, 1));
    return { buf: await makeZip(entries), man };
  }
  async function writeTo(file, opt) { const { buf, man } = await build(opt); await fsp.mkdir(path.dirname(file), { recursive: true }); const tmp = file + '.part'; await fsp.writeFile(tmp, buf); await fsp.rename(tmp, file); return { file, size: buf.length, man }; }
  const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  /* النسخة اليومية الداخلية: ملف واحد لليوم (يُحدَّث عند إغلاق البرنامج ليحمل آخر عمل اليوم) */
  async function daily(force) {
    const f = path.join(bdir(), PREFIX + today() + '.zip');
    if (!force && fs.existsSync(f)) return { file: f, skipped: true };
    const r = await writeTo(f, { attachments: false });
    const all = (await fsp.readdir(bdir())).filter(n => n.startsWith(PREFIX) && n.endsWith('.zip')).sort();
    while (all.length > (ctx.keep || 15)) await fsp.unlink(path.join(bdir(), all.shift())).catch(() => {});
    return r;
  }
  /* قائمة النسخ: ملفات ZIP (داخلية وخارجية) + النسخ القديمة (ملف لكل نظام) مجمّعة حسب اليوم */
  function legacyName(n) { const m = /^(.+)_(\d{4}-\d{2}-\d{2})\.json$/.exec(n); return m ? { base: m[1] + '.json', day: m[2] } : null; }
  async function list() {
    const out = [];
    const zips = async (dir, where) => { let L = []; try { L = await fsp.readdir(dir); } catch (_) { return; }
      for (const n of L) if (/\.zip$/i.test(n) && (n.startsWith(PREFIX) || n.startsWith(SAFE))) { const p = path.join(dir, n); const st = await fsp.stat(p).catch(() => null); if (!st) continue;
        let man = null; try { const z = readZip(await fsp.readFile(p)); man = JSON.parse(z['manifest.json'].toString('utf8')); } catch (_) {}
        out.push({ kind: 'zip', file: p, where, safe: n.startsWith(SAFE), at: man ? man.at : new Date(st.mtimeMs).toISOString(), size: st.size, sys: man ? man.sys : {}, attachments: !!(man && man.attachments), device: man ? man.device : '' }); } };
    await zips(bdir(), 'هذه الحاسبة');
    for (const d of ctx.extDirs()) await zips(d, 'النسخة الخارجية');
    /* القديمة: ملف لكل نظام في اليوم (داخلياً) أو مجلد لليوم (خارجياً) */
    const byDay = {}; try { for (const n of await fsp.readdir(bdir())) { const x = legacyName(n); if (x) (byDay[x.day] = byDay[x.day] || { where: 'هذه الحاسبة (نسخ قديمة)', files: {} }).files[x.base] = path.join(bdir(), n); } } catch (_) {}
    for (const d of ctx.extDirs()) { let L = []; try { L = await fsp.readdir(d); } catch (_) {} for (const day of L) { if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue; let F = []; try { F = await fsp.readdir(path.join(d, day)); } catch (_) {}
      const k = 'x' + day; byDay[k] = { where: 'النسخة الخارجية (نسخ قديمة)', day, files: {} }; for (const n of F) if (/\.json$/i.test(n)) byDay[k].files[n] = path.join(d, day, n); } }
    for (const [k, v] of Object.entries(byDay)) { const day = v.day || k; const sys = {}; for (const g of GROUPS) for (const ds of g.ds) { const fn = ds === 'reg' ? 'registry.json' : path.basename(ctx.file(ds) || ''); if (fn && v.files[fn]) sys[g.id] = { t: g.t, n: null }; }
      if (Object.keys(sys).length) out.push({ kind: 'legacy', files: v.files, where: v.where, at: day + 'T23:59:00', size: 0, sys, attachments: false }); }
    out.sort((a, b) => String(b.at).localeCompare(String(a.at)));
    return out;
  }
  /* محتوى نسخة → {ds: نص، planning: {rel: Buffer}، arf: {rel: Buffer}، man} */
  async function open(item) {
    if (item.kind === 'legacy') { const o = { data: {}, planning: {}, arf: {}, man: { sys: item.sys } };
      for (const g of GROUPS) for (const ds of g.ds) { const fn = ds === 'reg' ? 'registry.json' : path.basename(ctx.file(ds) || ''); if (fn && item.files[fn]) o.data[ds] = await fsp.readFile(item.files[fn], 'utf8'); } return o; }
    const z = readZip(await fsp.readFile(item.file)), o = { data: {}, planning: {}, arf: {}, man: {} };
    for (const [n, b] of Object.entries(z)) { if (n === 'manifest.json') o.man = JSON.parse(b.toString('utf8')); else if (n.startsWith('data/')) o.data[n.slice(5).replace(/\.json$/, '')] = b.toString('utf8'); else if (n.startsWith('planning/')) o.planning[n.slice(9)] = b; else if (n.startsWith('archive-files/')) o.arf[n.slice(14)] = b; }
    return o;
  }
  /* تفاصيل نسخة للعرض: عدد السجلات لكل نظام في النسخة وفي البرنامج الآن */
  async function inspect(item) {
    const o = await open(item), rows = [];
    for (const g of GROUPS) { let inB = null, now = null, has = false;
      for (const ds of g.ds) { if (o.data[ds] != null) { has = true; const c = countOf(o.data[ds]); if (c != null) inB = (inB || 0) + c; }
        const f = ds === 'reg' ? ctx.regFile() : ctx.file(ds); try { const c = countOf(fs.readFileSync(f, 'utf8')); if (c != null) now = (now || 0) + c; } catch (_) {} }
      if (g.files === 'plan' && Object.keys(o.planning).length) has = true;
      rows.push({ id: g.id, t: g.t, has, inB, now, arf: g.files === 'arf' ? Object.keys(o.arf).length : undefined }); }
    return { rows, man: o.man };
  }
  /* الاسترجاع: نسخة «قبل-الاسترجاع» أولاً، ثم استبدال ملفات الأنظمة المختارة */
  async function restore(item, ids, hooks = {}) {
    const o = await open(item), sel = new Set(ids || []), done = [], skipped = [];
    const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
    const safety = await writeTo(path.join(bdir(), SAFE + stamp + '.zip'), { attachments: false });
    for (const g of GROUPS) { if (!sel.has(g.id)) continue; let any = false;
      for (const ds of g.ds) { const t = o.data[ds]; if (t == null) continue; try { JSON.parse(t); } catch (_) { skipped.push(g.t + ' (ملف تالف)'); continue; }
        const f = ds === 'reg' ? ctx.regFile() : ctx.file(ds); if (!f) continue; await fsp.mkdir(path.dirname(f), { recursive: true }); ctx.write(f, t); any = true; }
      if (g.files === 'plan') for (const [r, b] of Object.entries(o.planning)) { const p = path.join(ctx.planDir(), r); await fsp.mkdir(path.dirname(p), { recursive: true }); await fsp.writeFile(p, b); any = true; }
      if (g.files === 'arf') for (const [r, b] of Object.entries(o.arf)) { if (r.includes('..')) continue; const p = path.join(ctx.archDir(), r); await fsp.mkdir(path.dirname(p), { recursive: true }); await fsp.writeFile(p, b); any = true; }
      if (any) { done.push(g.id); if (hooks.after) await hooks.after(g, o); } else skipped.push(g.t + ' (ليس في النسخة)'); }
    return { done, skipped, safety: safety.file };
  }
  return { build, writeTo, daily, list, inspect, restore, GROUPS, PREFIX, _zip: { makeZip, readZip } };
};
