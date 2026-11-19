'use strict';
/* «🔍 مقارنة ملف التخطيط العام بالملف المعدَّل» (تبويب مشاريع التخطيط):
   الأول «ملف التخطيط العام» (ورقة خطة المحافظة: المشروع التخطيطي ومكوّناته + ورقة منافذ حدودية وإعادة استقرار)،
   والثاني «ملف التخطيط المعدَّل» (ملف التخصيصات بعد تحديثه من الموقف: ورقة Projects).
   يُطابَق كل مكوّن في العام بصفّه في المعدَّل (رقم العقد + الاسم + الشركة)، وتُقارن الحقول المشتركة، ويُخرج ملف واحد:
   نسخة من الملف العام (أوراقه ومعادلاته وتنسيقه كما هي) تُصحَّح فيها الخلايا المختلفة من المعدَّل، مع ورقة «التغييرات» وورقة «تدقيق المقارنة»
   (المطابق، والمكوّنات غير الموجودة في أحد الملفين، والمشكوك فيه). لا تُكتب قيمة فارغة ولا يُغيَّر حقل فيه معادلة. */
const X = require('./xlmerge');
const P = require('./planning');
const PP = require('./planprogress');
const { readBook, sheetInfo, cellText, RN } = X;
const T = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
const toEn = s => String(s == null ? '' : s).replace(/[٠-٩]/g, d => d.charCodeAt(0) - 1632);
const num = v => { const x = PP.numOf(v); return x ? x.n : null; };

/* حقول المقارنة: مفتاح الملف العام ← عنوان العمود في المعدَّل */
const SRC = [
  ['contractNo', /^رقم العقد$/, 'رقم العقد', 'text'], ['contractDate', /^تاريخ العقد$/, 'تاريخ العقد', 'date'], ['start', /^تاريخ المباشره$/, 'تاريخ المباشرة', 'date'],
  ['end', /^تاريخ الانجاز$/, 'تاريخ الإنجاز', 'date'], ['company', /^اسم الشركه$/, 'اسم الشركة', 'text'], ['dur', /^مده التنفيذ$|^مده العقد/, 'مدة التنفيذ', 'num'],
  ['ext', /^المدد الاضافيه$|^المده المضافه$/, 'المدة المضافة', 'num'], ['contract', /^الكلفه الكليه \(مبلغ العقد\)$|^مبلغ العقد$/, 'مبلغ العقد', 'num'],
  ['contractAfter', /^مبلغ العقد بعد التغيير$/, 'مبلغ العقد بعد التغيير', 'num'], ['coSumH', /^مجموع اوامر التغيير$|^مبلغ اوامر التغيير$/, 'مجموع أوامر التغيير', 'num'],
  ['planPct', /^نسبه الانجاز المخطط/, 'نسبة الإنجاز المخطط', 'pct'], ['tech', /^نسبه الانجا[زر] الفني$/, 'نسبة الإنجاز الفني (الفعلي)', 'pct'], ['coords', /^الاحداثيات$/, 'الإحداثيات', 'text']];
const KEYS = SRC.map(x => x[0]);

/* الملف المعدَّل: الورقة التي فيها أكثر هذه الحقول (Projects)، وصفوف المكوّنات فقط (فيها شركة أو رقم عقد) */
function readModified(buf, label) {
  const book = readBook(buf, label); let best = null;
  for (const sh of book.sheets) {
    if (/^التغييرات|^تدقيق/.test(sh.name)) continue;
    let I; try { I = sheetInfo(book, sh); } catch (_) { continue; } if (!I || I.hr == null) continue;
    const ks = Object.keys(I.head).map(Number).sort((a, b) => a - b), cols = {};
    const nameC = ks.find(c => /^اسم المشروع$/.test(RN(I.head[c]))); if (!nameC) continue;
    for (const [k, re] of SRC) { const c = ks.find(c => re.test(RN(I.head[c])) && !Object.values(cols).includes(c)); if (c) cols[k] = c; }
    const score = Object.keys(cols).length + (I.data.length > 500 ? 3 : 0);
    if (!best || score > best.score) best = { sh, I, cols, nameC, score };
  }
  if (!best) throw new Error('لم يُعثر في الملف المعدَّل على ورقة فيها «اسم المشروع» وحقول المكوّنات (رقم العقد، مبلغ العقد، نسب الإنجاز…)');
  const { I, cols, nameC, sh } = best; const scale = {};
  for (const k of ['planPct', 'tech']) if (cols[k]) { let n = 0, f = 0; for (const r of I.data) { const v = num(cellOf(book, I, r, cols[k])); if (v != null && v > 0) { n++; if (v <= 1.0001) f++; } } scale[k] = n && f >= n * 0.8 ? 'frac' : 'pct'; }
  const rows = [];
  for (const r of I.data) {
    const name = T(cellOf(book, I, r, nameC)); if (!name || /^(ال)?مجموع/.test(RN(name))) continue;
    const rec = { row: r, name }; for (const k of KEYS) if (cols[k]) { const t = T(cellOf(book, I, r, cols[k])); if (t) rec[k] = t; }
    if (!rec.company && !rec.contractNo) continue;   /* مشروع تخطيطي لا مكوّن */
    for (const k of ['planPct', 'tech']) if (rec[k] != null) { const v = num(rec[k]); rec[k] = v == null ? null : scale[k] === 'frac' && v <= 1.5 ? Math.round(v * 10000) / 100 : v; }
    rows.push(rec);
  }
  return { sheet: sh.name, rows, cols: Object.keys(cols), colIdx: cols, head: Object.fromEntries(Object.entries(cols).map(([k, c]) => [k, I.head[c]])), scale };
}
function cellOf(book, I, r, c) { const row = I.rows.get(r); const cell = row && row.cells.find(x => x.c === c); return cell ? cellText(book, cell) : ''; }

const isoOf = P.isoOf;
const normNo = v => PP.noKey(v);
const same = (type, a, b, key) => {
  if (a == null || a === '') return b == null || b === '';
  if (key === 'company') return PP.coOk(a, b) !== false;   /* الشركة نفسها مكتوبة بصيغة أطول/أقصر */
  if (key === 'contractNo') { const x = normNo(a), y = normNo(b); return x || y ? x === y : RN(T(a)) === RN(T(b)); }
  if (type === 'num') { const x = num(a), y = num(b); return x != null && y != null ? Math.abs(x - y) < 0.5 : T(a) === T(b); }
  if (type === 'pct') { const x = num(a), y = num(b); return x != null && y != null && Math.abs(x - y) < 0.05; }
  if (type === 'date') { const x = isoOf(a), y = isoOf(b); return !!x && x === y; }
  if (type === 'text') return RN(T(a)).replace(/\s+/g, '') === RN(T(b)).replace(/\s+/g, '');
  return T(a) === T(b);
};
const coordNums = t => (toEn(t).match(/-?\d+(\.\d+)?/g) || []).map(Number).filter(v => v > 20 && v < 60).sort((a, b) => a - b);

/* مشاريع الموقف العام بصيغة صفوف الملف المعدَّل (النسب 0–100) */
function statusRows(projects) {
  return (projects || []).filter(p => p && String(p.name || '').trim()).map((p, i) => ({ row: 'موقف ' + (p.fileNo || ''), fileNo: String(p.fileNo || ''), src: 'status', name: T(p.name), company: T(p.contractor), contractNo: T(p.contractNo),
    start: p.start || '', end: p.planEnd ? '' : '', dur: p.dur, ext: p.extra, contract: p.orig, contractAfter: p.total || (num(p.orig) ? num(p.orig) + (num(p.changeCost) || 0) : null), coSumH: num(p.changeCost) || null,
    planPct: num(p.planPct), tech: num(p.actualPct), ...(() => { const a = num(p.lat), b = num(p.lng), ok = a != null && b != null && a > 20 && a < 60 && b > 20 && b < 60; return { coords: ok ? `${a}, ${b}` : '' }; })() }));
}
function compare(genBuf, genLabel, modBuf, modLabel, projects) {
  const G = P.parse(genBuf, genLabel); if (G.clean) throw new Error('الملف الأول هو «الملف المنظَّم» — اختر ملف التخطيط العام الأصلي');
  const M = readModified(modBuf, modLabel);
  /* فهارس المعدَّل */
  const byNo = new Map(), byName = new Map(), W = s => [...new Set(PP.K(s).split(' ').filter(w => w.length >= 3))], idx = new Map();
  M.rows.forEach((r, i) => { r.kn = PP.KN(r.name); const no = normNo(r.contractNo); if (no) { if (!byNo.has(no)) byNo.set(no, []); byNo.get(no).push(i); } if (!byName.has(r.kn)) byName.set(r.kn, []); byName.get(r.kn).push(i); W(r.name).forEach(w => { if (!idx.has(w)) idx.set(w, []); idx.get(w).push(i); }); });
  const used = new Set(), out = { matched: [], unsure: [], onlyGen: [], onlyMod: [], diffs: [], kept: [], rdiffs: [], rups: [] };
  for (const c of G.comps) {
    const kn = PP.KN(c.name), no = normNo(c.contractNo); let best = null;
    const cand = new Set([...(byName.get(kn) || []), ...(no ? byNo.get(no) || [] : [])]);
    { const cnt = new Map(); for (const w of W(c.name)) for (const i of (idx.get(w) || [])) cnt.set(i, (cnt.get(i) || 0) + 1); for (const [i, n] of cnt) if (n >= 2) cand.add(i); }
    for (const i of cand) { if (used.has(i)) continue; const r = M.rows[i]; const s = r.kn === kn ? 1 : PP.dice(kn, r.kn); const noEq = !!(no && normNo(r.contractNo) === no); const co = PP.coOk(c.company, r.company);
      const score = s + (noEq ? 0.5 : 0) + (co === true ? 0.2 : co === false ? -0.3 : 0); if (s >= 0.6 && (!best || score > best.score)) best = { i, r, s, noEq, co, score }; }
    if (!best) { out.onlyGen.push(c); continue; }
    const clash = best.s < 1 && PP.placeClash(c.name, best.r.name);
    const sure = !clash && ((best.s >= 0.9 && best.co !== false) || (best.noEq && best.s >= 0.7 && best.co !== false));
    if (!sure) { out.unsure.push({ c, r: best.r, s: Math.round(best.s * 100), why: clash ? 'القضاء مختلف' : best.co === false ? 'الشركة مختلفة' : 'الاسم متقارب لا مطابق' }); continue; }
    used.add(best.i); out.matched.push({ c, r: best.r });
    applyDiffs(c, best.r, 'الملف المعدَّل');
    revDiffs(c, best.r);
  }
  /* الاتجاه المعاكس (الناتج = الملف المعدَّل): قيم الملف العام لصف المعدَّل — «تعبئة» للخلية الفارغة، و«فرق» للقيمة المختلفة */
  function revDiffs(c, r) {
    const set = {}, cols = M.colIdx;
    for (const [k, , label, type] of SRC) {
      if (!cols[k]) continue; let gk = k; if (c.kind === 's2') { if (k === 'tech') gk = 'actPct'; if (k === 'coSumH' || k === 'coords') continue; }
      const gv = c[gk]; if (gv == null || gv === '') continue; const mv = r[k];
      if ((c.fx || []).includes(gk)) continue;
      if (type === 'num' || type === 'pct') { const n = num(gv); if (n == null || n === 0) continue; }
      const val = type === 'date' ? isoOf(gv) : type === 'num' || type === 'pct' ? num(gv) : String(gv); if (val == null || val === '') continue;
      if (mv == null || mv === '') { set[k] = val; out.rdiffs.push({ sheet: M.sheet, row: r.row, name: r.name, field: label, key: k, old: '', neu: String(gv), kind: 'fill' }); continue; }
      if (k === 'coords') continue;   /* إحداثيات موجودة لا يُكتب فوقها */
      if (same(type, mv, gv, k)) continue;
      out.rdiffs.push({ sheet: M.sheet, row: r.row, name: r.name, field: label, key: k, old: String(mv), neu: String(gv), kind: 'diff', val });
    }
    if (Object.keys(set).length) out.rups.push({ sheet: M.sheet, row: r.row, label: r.name + ' — من الملف العام', set });
  }
  function applyDiffs(c, row, srcLabel) {
    const sheet = G.sheets[c.sheet], set = {}; const best = { r: row };
    for (const [k, , label, type] of SRC) {
      let gk = k, nv = best.r[k];
      if (c.kind === 's2') { if (k === 'tech') gk = 'actPct'; if (k === 'coSumH') continue; }
      if (k === 'coords' && c.kind === 's2') continue;
      if (nv == null || nv === '' || !sheet.cols[gk]) continue;
      if ((c.fx || []).includes(gk)) continue;   /* خلية معادلة */
      const ov = c[gk];
      /* صفر من الموقف العام = حقل غير مملوء غالباً: لا يُكتب */
      if (row.src === 'status' && (type === 'num' || type === 'pct') && num(nv) === 0) continue;
      /* الإحداثيات: تُملأ الفارغة فقط؛ الموجودة لا يُكتب فوقها (الفرق يُذكر في «تدقيق المقارنة») */
      if (k === 'coords') { const a = coordNums(ov), b = coordNums(nv); if (b.length < 2) continue; if (a.length >= 2 && Math.abs(a[0] - b[0]) < 1e-4 && Math.abs(a[1] - b[1]) < 1e-4) continue;
        if (ov) { out.kept.push({ sheet: c.sheet, row: c.row, name: c.name, field: label, old: String(ov), neu: String(nv), src: srcLabel }); continue; } }
      if (same(type, ov, nv, k)) continue;
      const val = type === 'date' ? isoOf(nv) : type === 'num' || type === 'pct' ? num(nv) : String(nv);
      if (val == null || val === '') continue;
      set[gk] = val; out.diffs.push({ sheet: c.sheet, row: c.row, fileNo: row.fileNo || '', name: c.name, field: label, key: gk, old: ov == null ? '' : String(ov), neu: String(nv), src: srcLabel });
    }
    /* ورقة المنافذ وإعادة الاستقرار: الإحداثيات في عمودين (N و E) — تُملأ الفارغة فقط */
    if (c.kind === 's2' && row.coords) { const n = coordNums(row.coords); if (n.length >= 2) for (const [gk, v, lab] of [['lat', n[0], 'الإحداثيات N'], ['lng', n[1], 'الإحداثيات E']]) if (sheet.cols[gk] && !c[gk] && !(c.fx || []).includes(gk)) { set[gk] = v; out.diffs.push({ sheet: c.sheet, row: c.row, fileNo: row.fileNo || '', name: c.name, field: lab, key: gk, old: '', neu: String(v), src: srcLabel }); } }
    if (Object.keys(set).length) (out.ups = out.ups || []).push({ sheet: c.sheet, row: c.row, label: c.name + (row.src === 'status' ? ` — من الموقف العام (اضبارة ${row.fileNo || '؟'})` : ' — من الملف المعدَّل'), set });
  }
  out.onlyMod = M.rows.filter((r, i) => !used.has(i) && !out.unsure.some(u => u.r === r));
  /* المكوّنات التي لا يقابلها صف في المعدَّل (ومنها مكوّنات إعادة الاستقرار والمنافذ الحدودية): تُطابَق بالموقف العام */
  const S = statusRows(projects); out.fromStatus = 0; out.statusN = S.length;
  if (S.length && out.onlyGen.length) {
    const sNo = new Map(), sName = new Map(), sIdx = new Map(), sUsed = new Set();
    S.forEach((r, i) => { r.kn = PP.KN(r.name); const no = normNo(r.contractNo); if (no) { if (!sNo.has(no)) sNo.set(no, []); sNo.get(no).push(i); } if (!sName.has(r.kn)) sName.set(r.kn, []); sName.get(r.kn).push(i); W(r.name).forEach(w => { if (!sIdx.has(w)) sIdx.set(w, []); sIdx.get(w).push(i); }); });
    const still = [];
    for (const c of out.onlyGen) {
      const kn = PP.KN(c.name), no = normNo(c.contractNo); let best = null;
      const cand = new Set([...(sName.get(kn) || []), ...(no ? sNo.get(no) || [] : [])]);
      { const cnt = new Map(); for (const w of W(c.name)) for (const i of (sIdx.get(w) || [])) cnt.set(i, (cnt.get(i) || 0) + 1); for (const [i, n] of cnt) if (n >= 2) cand.add(i); }
      for (const i of cand) { if (sUsed.has(i)) continue; const r = S[i]; const sc = r.kn === kn ? 1 : PP.dice(kn, r.kn); const noEq = !!(no && normNo(r.contractNo) === no); const co = PP.coOk(c.company, r.company);
        const score = sc + (noEq ? 0.5 : 0) + (co === true ? 0.2 : co === false ? -0.3 : 0); if (sc >= 0.6 && (!best || score > best.score)) best = { i, r, s: sc, noEq, co, score }; }
      if (!best) { still.push(c); continue; }
      const clash = best.s < 1 && PP.placeClash(c.name, best.r.name);
      const sure = !clash && ((best.s >= 0.9 && best.co !== false) || (best.noEq && best.s >= 0.7 && best.co !== false));
      if (!sure) { out.unsure.push({ c, r: best.r, s: Math.round(best.s * 100), why: (clash ? 'القضاء مختلف' : best.co === false ? 'الشركة مختلفة' : 'الاسم متقارب لا مطابق') + ' — مع الموقف العام' }); continue; }
      sUsed.add(best.i); out.matched.push({ c, r: best.r, src: 'status' }); out.fromStatus++;
      applyDiffs(c, best.r, 'الموقف العام');
    }
    out.onlyGen = still;
  }
  out.ups = out.ups || []; out.diffs.forEach(d => { d.src = d.src || 'الملف المعدَّل'; });
  out.G = G; out.M = { sheet: M.sheet, cols: M.cols, n: M.rows.length, colIdx: M.colIdx, head: M.head, scale: M.scale };
  return out;
}

/* إخراج الملف الواحد: الملف العام مصحَّحاً (الحقول المختارة) + ورقة «تدقيق المقارنة» */
function build(genBuf, res, opts = {}, modBuf) {
  if (opts.base === 'mod') return buildMod(modBuf, res, opts);
  const keys = opts.keys ? new Set(opts.keys) : null;
  const ups = res.ups.map(u => Object.assign({}, u, { set: Object.fromEntries(Object.entries(u.set).filter(([k]) => !keys || keys.has(k))) })).filter(u => Object.keys(u.set).length);
  const r = P.exportBook(genBuf, res.G, ups, { dash: false, keepDates: true, highlight: opts.highlight !== false });
  const z = X.unzip(Buffer.from(r.buf));
  const n = r.changes.filter(c => !c.note).length;
  const rows = [['القسم', 'الورقة / الصف في الملف العام', 'المشروع في الملف العام (الشركة)', 'المشروع في الملف المعدَّل (الشركة)', 'ملاحظة']];
  rows.push(['ملخص', '', `مكوّنات الملف العام: ${res.G.comps.length}`, `صفوف المكوّنات في المعدَّل («${res.M.sheet}»): ${res.M.n}`, `مطابَق: ${res.matched.length} (منها ${res.fromStatus || 0} بالموقف العام) — صُحّحت ${n} خلية — للتأكيد: ${res.unsure.length} — في العام فقط: ${res.onlyGen.length} — في المعدَّل فقط: ${res.onlyMod.length}`]);
  if (keys) { const lab = {}; res.diffs.forEach(d => { lab[d.key] = d.field; }); rows.push(['الحقول المصحَّحة', '', [...new Set([...keys].map(k => lab[k]).filter(Boolean))].join('، '), '', 'الحقول الأخرى المختلفة لم تُغيَّر (مذكورة في «فروقات لم تُطبَّق»)']); }
  res.unsure.forEach(u => rows.push(['للتأكيد — لم يُصحَّح', `${u.c.sheet} / ${u.c.row}`, `${u.c.name} — ${u.c.company || ''}`, `${u.r.name} — ${u.r.company || ''} (صف ${u.r.row})`, `${u.why} (${u.s}%)`]));
  res.onlyGen.forEach(c => rows.push(['في الملف العام فقط', `${c.sheet} / ${c.row}`, `${c.name} — ${c.company || ''}`, '', 'لا يقابله صف في الملف المعدَّل ولا مشروع في الموقف العام']));
  res.kept.forEach(d => rows.push(['إحداثيات موجودة لم يُكتب فوقها', `${d.sheet} / ${d.row}`, `${d.name} — ${d.old}`, `${d.src}: ${d.neu}`, 'الإحداثيات الموجودة في الملف العام تبقى — تحقّق منها إن كان الفرق كبيراً']));
  if (res.fromStatus) rows.push(['مصحَّح من الموقف العام', '', `${res.fromStatus} مكوّناً لا يقابلها صف في الملف المعدَّل (منها مكوّنات إعادة الاستقرار والمنافذ الحدودية)`, '', 'المصدر مذكور لكل خلية في ورقة «التغييرات» (بجانب اسم المكوّن: من الملف المعدَّل / من الموقف العام والاضبارة)']);
  res.onlyMod.forEach(m => rows.push(['في الملف المعدَّل فقط', '', '', `${m.name} — ${m.company || ''} (صف ${m.row})`, 'غير موجود في الملف العام — يُضاف يدوياً إن كان مكوّناً جديداً']));
  if (keys) res.diffs.filter(d => !keys.has(d.key)).forEach(d => rows.push(['فروقات لم تُطبَّق', `${d.sheet} / ${d.row}`, `${d.name} — ${d.field}: ${d.old}`, `${d.field}: ${d.neu}`, 'الحقل غير مختار للتصحيح']));
  const book = { sheets: [] }; z.get('xl/workbook.xml').toString('utf8').replace(/<sheet\b[^>]*name="([^"]*)"/g, (m, nm) => { book.sheets.push({ name: nm }); return m; });
  P.addSheet(z, P.sheetNameFree(book, 'تدقيق المقارنة'), rows);
  P.xmlGuard(z);
  return { buf: X.zip(z), changes: r.changes, cells: n, audit: rows.length - 2 };
}
/* الناتج = الملف المعدَّل نفسه (أوراقه ومعادلاته وتنسيقه): تُملأ خلاياه الفارغة من الملف العام، والقيم المختلفة تُغيَّر فقط إن اختيرت (opts.diffKeys) */
function buildMod(modBuf, res, opts = {}) {
  const keys = opts.keys ? new Set(opts.keys) : null, dk = new Set(opts.diffKeys || []);
  const byRow = new Map(); const add = (row, k, v) => { if (!byRow.has(row)) byRow.set(row, { sheet: res.M.sheet, row, label: '', set: {} }); byRow.get(row).set[k] = v; };
  res.rdiffs.forEach(d => { if (d.kind === 'fill') { if (keys && !keys.has(d.key)) return; add(d.row, d.key, d.key && ['start', 'contractDate', 'end'].includes(d.key) ? isoOf(d.neu) : ['company', 'contractNo', 'coords'].includes(d.key) ? d.neu : num(d.neu)); } else if (dk.has(d.key)) add(d.row, d.key, d.val); });
  res.rdiffs.forEach(d => { const u = byRow.get(d.row); if (u && !u.label) u.label = d.name + ' — من الملف العام'; });
  const model = { sheets: { [res.M.sheet]: { cols: res.M.colIdx, head: res.M.head, scale: res.M.scale } } };
  const r = P.exportBook(modBuf, model, [...byRow.values()], { dash: false, keepDates: true, highlight: opts.highlight !== false });
  const z = X.unzip(Buffer.from(r.buf)); const n = r.changes.filter(c => !c.note).length;
  const rows = [['القسم', 'الصف في الملف المعدَّل', 'المشروع في الملف المعدَّل', 'من الملف العام', 'ملاحظة']];
  rows.push(['ملخص', `ورقة «${res.M.sheet}»`, `صفوف المكوّنات: ${res.M.n} — مطابَق مع الملف العام: ${res.matched.filter(m => !m.src).length}`, `مكوّنات الملف العام: ${res.G.comps.length}`, `مُلئت/صُحّحت ${n} خلية — قيم مختلفة لم تُغيَّر: ${res.rdiffs.filter(d => d.kind === 'diff' && !dk.has(d.key)).length} — في العام فقط: ${res.onlyGen.length + res.matched.filter(m => m.src).length}`]);
  res.rdiffs.filter(d => d.kind === 'diff' && !dk.has(d.key)).forEach(d => rows.push(['قيمة مختلفة — لم تُغيَّر', String(d.row), `${d.name} — ${d.field}: ${d.old}`, `${d.field}: ${d.neu}`, 'القيمة في الملف المعدَّل بقيت كما هي — غيّرها يدوياً إن كانت قيمة العام هي الصحيحة']));
  res.unsure.filter(u => !/الموقف العام/.test(u.why)).forEach(u => rows.push(['للتأكيد — لم يُملأ', String(u.r.row), `${u.r.name} — ${u.r.company || ''}`, `${u.c.name} — ${u.c.company || ''} (${u.c.sheet} / ${u.c.row})`, `${u.why} (${u.s}%)`]));
  const genOnly = res.onlyGen.concat(res.matched.filter(m => m.src).map(m => m.c));
  genOnly.forEach(c => rows.push(['في الملف العام فقط', '', '', `${c.name} — ${c.company || ''} — عقد ${c.contractNo || '—'} — مبلغ ${c.contract || '—'} — المخطط ${c.planPct != null ? c.planPct + '%' : '—'} — الفعلي ${c.tech != null ? c.tech + '%' : c.actPct != null ? c.actPct + '%' : '—'} (${c.sheet} / ${c.row})`, 'غير موجود في الملف المعدَّل — يُضاف إليه يدوياً إن كان مكوّناً حالياً']));
  res.onlyMod.forEach(m => rows.push(['في الملف المعدَّل فقط', String(m.row), `${m.name} — ${m.company || ''}`, '', 'لا يقابله مكوّن في الملف العام']));
  const book = { sheets: [] }; z.get('xl/workbook.xml').toString('utf8').replace(/<sheet\b[^>]*name="([^"]*)"/g, (m0, nm) => { book.sheets.push({ name: nm }); return m0; });
  P.addSheet(z, P.sheetNameFree(book, 'تدقيق المقارنة'), rows); P.xmlGuard(z);
  return { buf: X.zip(z), changes: r.changes, cells: n, audit: rows.length - 2 };
}
module.exports = { compare, build, readModified, SRC };
