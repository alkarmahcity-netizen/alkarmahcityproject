'use strict';
/* مشاريع التخطيط: ملف Excel المشترك بين القسم الهندسي ولجنة تحديث الخطة.
   - القراءة: الورقة الرئيسية (المشروع التخطيطي بصف ترميز الباب/القسم/…/التسلسل، وتحته مكوّناته: كل مكوّن = مشروع/عقد عندنا)،
     وورقة «منافذ حدودية + إعادة استقرار» (كل صف مكوّن). الأعمدة تُعرف بعناوينها لا بمواقعها.
   - التصدير: نسخة من الملف نفسه بأوراقه ومعادلاته وروابطه وتنسيقه؛ تُحدَّث خلايا مكوّناتنا فقط من بيانات اللجان،
     ولا تُمس خلية فيها معادلة (روابط ملفات اللجان)، وتُلوَّن الخلايا المحدَّثة، وتُضاف ورقة «التغييرات» (القديم ← الجديد). */
const X = require('./xlmerge');
const { readBook, sheetInfo, cellText, zip, RN } = X;

const T = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
const toEn = s => String(s == null ? '' : s).replace(/[٠-٩]/g, d => d.charCodeAt(0) - 1632).replace(/[۰-۹]/g, d => d.charCodeAt(0) - 1776);
const num = v => { const t = toEn(v).replace(/[,٬\s]/g, '').replace(/٫/g, '.').replace(/%$/, ''); if (!t || !/^-?\d+(\.\d+)?(e[-+]?\d+)?$/i.test(t)) return null; const n = +t; return isFinite(n) ? n : null; };
const pad = n => String(n).padStart(2, '0');
function isoOf(v) {   /* تاريخ Excel (رقم تسلسلي) أو نص يوم/شهر/سنة أو سنة-شهر-يوم ← yyyy-mm-dd */
  const t = toEn(T(v)); if (!t || /^0+(:0+)*$/.test(t) || t === '0') return '';
  const n = num(t); if (n != null) { if (n > 20000 && n < 80000) { const d = new Date(Math.round((n - 25569) * 864e5)); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; } if (n >= 1990 && n <= 2100) return String(Math.round(n)); return ''; }
  let m = t.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/); if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
  m = t.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/); if (m) return `${m[3]}-${pad(m[2])}-${pad(m[1])}`;
  return '';
}
const dmyTxt = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || '')); return m ? `${+m[3]}/${+m[2]}/${m[1]}` : String(iso || ''); };   /* يوم/شهر/سنة */
const serialOf = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ''); if (!m) return null; return Math.round(Date.UTC(+m[1], +m[2] - 1, +m[3]) / 864e5 + 25569); };
/* توحيد أسماء التمويل (أخطاء الكتابة فقط، كما وافق المستخدم) */
function fundNorm(s) {
  let t = T(s); if (!t || t === '0') return '';
  t = t.replace(/منافذ\s+حدوي[هة]?(?!\S)/g, 'منافذ حدودية').replace(/منافذ\s+حدوديه/g, 'منافذ حدودية').replace(/^ا?عادة\s+ا?ستقرار/, 'إعادة استقرار').replace(/^اعادة\s+الاستقرار/, 'إعادة استقرار')
    .replace(/تنمية\s+(ال)?[اأ]قاليم/g, 'تنمية أقاليم').replace(/\s*\+\s*/g, ' - ').replace(/بترو\s*دولار/g, 'بترودولار').replace(/\s*-\s*/g, ' - ').replace(/\s*\/\s*/g, '/');
  return fundCanon(t);
}
/* نفس قواعد توحيد التمويل في shared/anbar-registry.js (fundCanon) — بأسماء الموقف العام المعتمدة */
const FUND_RULES = [[/^تنميهاقاليمجدوله$/, 'تنمية الأقاليم جدول هـ'], [/^تنميهاقاليمو?امنغذائي$/, 'تنمية أقاليم - أمن غذائي'], [/^تنميهاقاليم$/, 'تنمية الأقاليم'],
  [/^اعاده(ال)?استقرار$/, 'إعادة استقرار'], [/^(تشغيلي)?(ال)?منافذ(ال)?حدود?يه$/, 'تشغيلي /المنافذ الحدودية'], [/^منافذ(\d{4})$/, 'منافذ $1'],
  [/^(ا?ستراتيجيه)?التخفيفمنالفقر$/, 'التخفيف من الفقر'], [/^بترودولار$/, 'بترودولار'], [/^بترودولارو?امنغذائي$/, 'بترودولار - أمن غذائي'],
  [/^(ال)?امن(ال)?غذائي$/, 'الأمن الغذائي'], [/^(استثماريه|البرنامجالحكومي)(ال)?جامعاتالمستحدثه$/, 'استثمارية/الجامعات المستحدثة']];
const fundKey = v => RN(v).replace(/[ً-ْـ]/g, '').replace(/[إأآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/[\s.،,\-–_/\\()+]+/g, '').replace(/الاقاليم/g, 'اقاليم');
function fundCanon(v) { const raw = T(v); if (!raw || raw === '0') return ''; const k = fundKey(raw); for (const [re, to] of FUND_RULES) { const m = k.match(re); if (m) return to.replace('$1', m[1] || ''); } return raw; }

/* أعمدة الورقة الرئيسية (بالعنوان؛ «n» = رقم ظهور العنوان المكرر) */
const MAIN = [['seq', /^ت/], ['bab', /^الباب$/], ['qism', /^القسم$/], ['inv', /^نوع الاستثمار$/], ['fasl', /^فصل$/], ['madda', /^ماده$/], ['naw', /^نوع$/], ['tasl', /^تسلسل$/],
  ['contractNo', /^رقم العقد/], ['contractDate', /^تاريخ العقد/], ['start', /^تاريخ المباشره/], ['end', /^تاريخ الانجاز$/], ['status', /^حاله المشروع$/], ['plan', /^اسم الخطه$/],
  ['name', /^اسم المشروع$/], ['ministry', /^الجهه المستفيده/], ['platform', /^منصه انجاز/], ['coords', /^الاحداثيات/], ['resident', /^المهندس المقيم/], ['phone', /^رقم الهاتف/],
  ['directorate', /^الجهه المستفيده/, 2], ['company', /^اسم الشركه/], ['dur', /^مده التنفيذ/], ['ext', /^المده المضافه/], ['referral', /^مبلغ الاحاله/], ['contract', /^مبلغ العقد$/],
  ['contractAfter', /^مبلغ العقد بعد التغيير/], ['coSumH', /^مجموع اوامر التغيير/], ['coSum', /^س$/], ['coCount', /^عدد اوامر التغيير/], ['cost', /^الكلفه التخمينيه/], ['approved', /^الكلفه المصادقه$/],
  ['advRaised', /^السلف المرفوعه/], ['advPaid', /^السلف المصروفه/], ['planPct', /^نسبه الانجاز المخطط/], ['tech', /^نسبه الانجار الفني$/], ['actPct', /^نسبه الانجار الفني للجان/],
  ['spent', /^مجموع المصروف الكلي/], ['supSpent', /^مجموع مصروف الاشراف/], ['spentAll', /^المصروف الكلي \+ الاشراف/], ['commit', /^الالتزامات الواجبه/], ['remain', /^المبلغ المتبقي/],
  ['district', /^القضاء/], ['phys', /^موقف المادي للجان/], ['status2', /^حاله المشروع$/, 2], ['sector', /^القطاع/], ['updated', /^تاريخ اخر تحديث/], ['actions', /^الاجراءات المتخذه/]];
/* ورقة منافذ حدودية + إعادة استقرار */
const S2 = [['seq', /^ت$/], ['fund', /^نوع التمويل/], ['contractNo', /^رقم العقد/], ['contractDate', /^تاريخ العقد/], ['district', /^القضاء/], ['name', /^اسم المشروع/], ['company', /^اسم الشركه/],
  ['dur', /^مده العقد/], ['ext', /^المده الاضافيه/], ['contract', /^مبلغ العقد$/], ['contractAfter', /^مبلغ العقد بعد اوامر/], ['advPromo', /^السلف المروجه/], ['spent', /^المصروف$/],
  ['advRaised', /^السلف المرفوعه/], ['advPaid', /^السلف المصروفه/], ['resident', /^المهندس المقيم/], ['phone', /^رقم الهاتف/], ['start', /^تاريخ المباشره/], ['end', /^تاريخ الانجاز/],
  ['planPct', /^نسبه الانجاز المخطط/], ['actPct', /^نسبه الانجاز الفعلي/], ['phys', /^موقف المادي/], ['directorate', /^الجهه المستفيده/], ['notes', /^ملاحظات/], ['lat', /^الاحداثيات N/i], ['lng', /^الاحداثيات E/i], ['status', /^حاله المشروع/]];
const DATES = new Set(['contractDate', 'start', 'end', 'updated']);
const NUMS = new Set(['dur', 'ext', 'referral', 'contract', 'contractAfter', 'coSum', 'coCount', 'cost', 'advRaised', 'advPaid', 'planPct', 'tech', 'actPct', 'spent', 'supSpent', 'spentAll', 'commit', 'remain', 'advPromo']);
const PCTS = ['planPct', 'actPct', 'tech'];
/* ملف التخصيصات (ورقة Projects): عناوين بديلة — تُستعمل فقط للحقل الذي لم يُعثر على عنوانه الأصلي (فلا يتغير شيء في ملف الخطة العام) */
const MAIN_ALT = [['ext', /^المدد الاضافيه/], ['contract', /^الكلفه الكليه \(مبلغ العقد\)/], ['cost', /^الكلفه المقره$/], ['spent', /^المصروف التراكمي للعقد$/],
  ['finPct', /^نسبه الانجار المالي|^نسبه الانجاز المالي/], ['alloc', /^التخصيص الكلي 2026/]];
NUMS.add('finPct'); NUMS.add('alloc'); NUMS.add('approved');
/* أوراق السنوات السابقة (Pro2024، كانون اول 2024، الخلاصة…) لا تُقرأ إن وُجدت ورقة حالية */
const oldSheet = n => { const y = (String(n).match(/20\d\d/g) || []).map(Number), cur = new Date().getFullYear(); return /كانون|الخلاصه|الخلاصة|^pro\s*20/i.test(RN(String(n))) && y.length > 0 || y.length > 0 && y.every(v => v < cur - 1); };
function colsOf(head, spec) {
  const seen = {}, cols = {}; const ks = Object.keys(head).map(Number).sort((a, b) => a - b);
  for (const [key, re, nth] of spec) { let k = 0; for (const c of ks) { if (re.test(RN(head[c]))) { k++; if (k === (nth || 1)) { if (!seen[c]) { cols[key] = c; seen[c] = key; } break; } } } }
  return cols;
}
function kindOf(I) { const h = Object.values(I.head || {}).map(RN); if (h.some(x => /^الباب$/.test(x)) && h.some(x => /^اسم المشروع$/.test(x))) return 'main'; if (h.some(x => /^نوع التمويل/.test(x)) && h.some(x => /^اسم المشروع/.test(x))) return 's2'; return ''; }

/* «ملف التخطيط المنظَّم» (يُصدره البرنامج): ورقتا «المشاريع والمكوّنات» و«المنافذ وإعادة الاستقرار» — المشروع ثم مكوّناته،
   والأعمدة بعناوين معروفة، و«صف الأصل» رقم صف المكوّن في ملف التخطيط الأصلي (فيبقى تصدير الملف الأصلي المحدَّث ممكناً). */
const CLEAN_SHEETS = { main: '__main__', s2: '__s2__' };
function parseClean(book, label) {
  const C = require('./planning-clean');
  const out = { file: label || '', sheets: {}, projects: [], comps: [], clean: true };
  const val = (I, r, c) => { const row = I.rows.get(r); const cell = row && row.cells.find(x => x.c === c); return cell ? T(cellText(book, cell)) : ''; };
  let found = 0;
  for (const sh of book.sheets) {
    const I = sheetInfo(book, sh); if (I.hr == null) continue;
    const hd = Object.entries(I.head).map(([c, h]) => [+c, RN(h)]);
    const hasCol = re => hd.some(([, h]) => re.test(h));
    if (!hasCol(/^المستوي$/)) continue;
    const kind = hasCol(/^رمز المشروع$/) ? 'main' : 's2', groups = kind === 'main' ? C.GROUPS_MAIN : C.GROUPS_S2;
    const cols = {}; for (const [, list] of groups) for (const [k, h] of list) { const c = hd.find(([, x]) => x === RN(h)); if (c && cols[k] == null) cols[k] = c[0]; }
    if (!cols.name || !cols.level) continue; found++;
    const sn = CLEAN_SHEETS[kind];
    out.sheets[sn] = { kind, cols: {}, scale: {}, head: {}, clean: true, src: sh.name };
    const num0 = v => { const n = num(v); return n == null ? (v === '' ? undefined : v) : n; };
    let proj = null, gi = 0;
    for (const r of [...I.rows.keys()].filter(r => r > I.hr).sort((a, b) => a - b)) {
      const g = k => cols[k] ? val(I, r, cols[k]) : '';
      const lvl = g('level'), name0 = g('name'); if (!name0 || !lvl) continue;
      const name = name0.replace(/\s*\(\d+ مكوّن\)\s*$/, '');
      if (/^(مشروع|مجموعه|مجموعة)$/.test(lvl)) {
        if (kind === 'main') { proj = { key: 'P' + (num(g('row')) || ('c' + r)), row: num(g('row')) || 0, code: g('code'), name, ministry: g('ministry'), plan: fundNorm(g('fund')), cost: num0(g('cost')), contractAfter: num0(g('contractAfter')), spent: num0(g('spent')), tech: num0(g('tech')), actPct: num0(g('actPct')), coSum: num0(g('coSum')), comps: [] }; }
        else { const fund = fundNorm(g('fund') || name) || 'غير محدد'; proj = { key: 'F:' + fund, row: 0, code: '', name: fund + ' — المنافذ وإعادة الاستقرار', ministry: '', plan: fund, virtual: true, comps: [] }; gi++; }
        out.projects.push(proj); continue;
      }
      if (!proj) continue;
      const row = num(g('row')) || 0;
      const rec = { sheet: sn, kind, row, name, key: (kind === 'main' ? 'M' : 'S') + (row || ('c' + r)), proj: proj.key };
      for (const [, list] of groups) for (const [k] of list) {
        if (['seq', 'code', 'level', 'name', 'row', 'st', 'nov', 'stRaw'].includes(k)) continue; const v = g(k); if (v === '') continue;
        rec[k] = DATES.has(k) ? isoOf(v) : NUMS.has(k) || k === 'phys' ? num0(v) : v;
      }
      const st = g('st'); rec.status = st && st !== 'غير محدد' ? st : (g('nov') || ''); if (g('stRaw')) rec.stRaw = g('stRaw'); if (g('nov')) rec.nov = g('nov');
      rec.fund = fundNorm(rec.fund || proj.plan) || proj.plan; if (kind === 'main') { rec.plan = rec.fund; rec.ministry = rec.ministry || proj.ministry; }
      proj.comps.push(rec.key); out.comps.push(rec);
    }
  }
  if (!found || !out.comps.length) return null;
  return out;
}
function parse(buf, label) {
  const book = readBook(buf, label);
  { const c = parseClean(book, label); if (c) return c; }
  const out = { file: label || '', sheets: {}, projects: [], comps: [] };
  const val = (I, r, c) => { if (!c) return { t: '', f: false }; const row = I.rows.get(r); const cell = row && row.cells.find(x => x.c === c); return { t: cell ? T(cellText(book, cell)) : '', f: !!(cell && cell.f) }; };
  /* المرشّحات: لكل نوع تُختار الورقة التي فيها أكثر المكوّنات (ملف التخصيصات فيه عدة أوراق بالصيغة نفسها، والأولى AnnualAllocation بلا مكوّنات) */
  const cands = [];
  for (const sh of book.sheets) { let I; try { I = sheetInfo(book, sh); } catch (_) { continue; } if (!I || I.hr == null) continue; const kind = kindOf(I); if (kind) cands.push({ sh, I, kind }); }
  const pick = {};
  for (const kind of ['main', 's2']) {
    const L = cands.filter(x => x.kind === kind); if (!L.length) continue;
    const cur = L.filter(x => !oldSheet(x.sh.name)), use = cur.length ? cur : L;
    if (use.length === 1) { pick[kind] = use[0]; continue; }
    const score = x => { const cols = colsOf(x.I.head, kind === 'main' ? MAIN : S2); if (!cols.name) return -1; let n = 0; for (const r of x.I.data) { const row = x.I.rows.get(r); if (!row) continue; if (row.cells.some(c => (c.c === cols.company || c.c === cols.contractNo) && T(cellText(book, c)))) n++; } return n; };
    pick[kind] = use.map(x => ({ x, n: score(x) })).sort((a, b) => b.n - a.n)[0].x;
  }
  for (const { sh, I, kind } of [pick.main, pick.s2].filter(Boolean)) {
    const spec = kind === 'main' ? MAIN : S2, cols = colsOf(I.head, spec);
    if (kind === 'main') { const alt = colsOf(I.head, MAIN_ALT), used = new Set(Object.values(cols)); for (const [k, c] of Object.entries(alt)) if (cols[k] == null && !used.has(c)) cols[k] = c; }
    if (!cols.name) continue;
    /* ملف التخصيصات: صف المكوّن يحمل ترميز المشروع أيضاً؛ فالمكوّن = صف فيه شركة أو رقم عقد، والمشروع التخطيطي = صف بلا شركة ولا رقم عقد */
    let alloc = false;
    if (kind === 'main') { let coded = 0, both = 0; for (const r of I.data) { const g = k => cols[k] ? val(I, r, cols[k]).t : ''; const cd = ['bab', 'qism', 'tasl'].some(k => { const v = T(g(k)); return v && v !== '0'; }); if (!cd || !g('name')) continue; coded++; if (g('company') || g('contractNo')) both++; } alloc = coded > 20 && both / coded > 0.3; }
    /* مقياس النسب في كل عمود: كسر (1 = 100%) أم مئوي */
    const scale = {};
    for (const k of PCTS) if (cols[k]) { let mx = 0, n = 0; for (const r of I.data) { const v = num(val(I, r, cols[k]).t); if (v != null) { n++; if (v <= 1.5) mx++; } } scale[k] = n ? (mx / n >= 0.9 ? 'frac' : 'pct') : ''; }
    /* عمود نسبة فارغ: بصيغة عمود النسبة الآخر في الورقة، وإلا كسر (1 = 100%) كما في ملفات الخطة */
    for (const k of PCTS) if (cols[k] && !scale[k]) scale[k] = PCTS.map(x => scale[x]).find(Boolean) || 'frac';
    out.sheets[sh.name] = { kind, cols, scale, alloc, head: Object.fromEntries(Object.entries(cols).map(([k, c]) => [k, I.head[c]])) };
    if (alloc) out.alloc = sh.name;
    let proj = null;
    const rowsSorted = [...I.rows.keys()].filter(r => r > I.hr).sort((a, b) => a - b);
    for (const r of rowsSorted) {
      const g = k => val(I, r, cols[k]).t, name = g('name');
      if (!name) continue;
      /* جداول الإحصاء أسفل الورقة: تُستثنى */
      if (/^(ال)?مجموع|^مطابقه المجموع/.test(RN(name))) continue;
      if (/^(عدد (المشاريع|المكونات|الشركات)|حاله المشروع|ت)$/.test(RN(name)) || /^(ت|\d{3,4})$/.test(g('plan') || '') && kind === 'main' && !g('contractNo') && !g('company')) { if (kind === 'main' && /^عدد /.test(RN(name))) break; continue; }
      const rec = { sheet: sh.name, kind, row: r, name };
      for (const [k] of spec) { if (k === 'name' || !cols[k]) continue; const v = val(I, r, cols[k]); if (!v.t) continue; rec[k] = DATES.has(k) ? isoOf(v.t) : NUMS.has(k) ? (num(v.t) != null ? num(v.t) : v.t) : v.t; if (v.f) (rec.fx = rec.fx || []).push(k); }
      for (const k of PCTS) if (typeof rec[k] === 'number' && scale[k] === 'frac' && rec[k] <= 1.5) rec[k] = Math.round(rec[k] * 10000) / 100;
      if (kind === 'main') {
        const code = ['bab', 'qism', 'inv', 'fasl', 'madda', 'naw', 'tasl'].map(k => T(val(I, r, cols[k]).t));
        if (alloc ? !rec.company && !rec.contractNo : code.some(x => x && x !== '0')) {   /* صف المشروع التخطيطي */
          proj = { key: 'P' + r, row: r, code: code.join('-'), name, ministry: rec.ministry || '', plan: fundNorm(rec.plan), cost: rec.cost, contractAfter: rec.contractAfter, spent: rec.spent, spentAll: rec.spentAll, tech: rec.tech, actPct: rec.actPct, coSum: rec.coSum, alloc: rec.alloc, finPct: rec.finPct, approved: rec.approved, comps: [] };
          out.projects.push(proj); continue;
        }
        if (!proj) continue;
        rec.key = 'M' + r; rec.proj = proj.key; rec.fund = fundNorm(rec.plan) || proj.plan; rec.ministry = proj.ministry; proj.comps.push(rec.key);
      } else {
        rec.key = 'S' + r; rec.fund = fundNorm(rec.fund);
        const pk = 'F:' + (rec.fund || 'غير محدد'); let p = out.projects.find(x => x.key === pk);
        if (!p) { p = { key: pk, row: 0, code: '', name: (rec.fund || 'غير محدد') + ' — ' + sh.name, ministry: '', plan: rec.fund, virtual: true, comps: [] }; out.projects.push(p); }
        rec.proj = pk; p.comps.push(rec.key);
        if (rec.lat || rec.lng) rec.coords = [rec.lat, rec.lng].filter(Boolean).join(' ');
      }
      out.comps.push(rec);
    }
  }
  if (!out.comps.length) throw new Error('لم يُعثر في الملف على ورقة «خطة المحافظة» (الباب، القسم، اسم المشروع…) ولا ورقة «منافذ حدودية + إعادة استقرار».');
  return out;
}

/* ---------- التصدير: تحديث خلايا مكوّناتنا في نسخة من الملف الأصلي ---------- */
const enc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const colL = n => { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
const colN = L => { let n = 0; for (const ch of L) n = n * 26 + ch.charCodeAt(0) - 64; return n; };
const attrsOf = s => { const o = {}; String(s || '').replace(/([\w:]+)="([^"]*)"/g, (_, k, v) => { o[k] = v; }); return o; };
const attrStr = o => Object.entries(o).map(([k, v]) => ` ${k}="${v}"`).join('');

/* updates: [{sheet, row, label, set:{key: value}}] — القيم بصيغة النموذج (التواريخ yyyy-mm-dd، النسب مئوية) */
function exportBook(buf, model, updates, opts = {}) {
  const book = readBook(buf, 'plan'); const z = book.z;
  const now = opts.now || new Date(), stamp = `${now.getFullYear()}/${pad(now.getMonth() + 1)}/${pad(now.getDate())}`;
  /* نمط التلوين: نسخة من نمط الخلية بخلفية صفراء فاتحة */
  let styles = z.has('xl/styles.xml') ? z.get('xl/styles.xml').toString('utf8') : '';
  let fillId = null; const hiCache = new Map(); let xfList = null, xfCount = 0;
  const prepStyles = () => {
    if (fillId != null || !styles) return;
    const fm = /<fills\b([^>]*)>([\s\S]*?)<\/fills>/.exec(styles); if (!fm) return;
    const n = (fm[2].match(/<fill\b/g) || []).length; fillId = n;
    styles = styles.replace(fm[0], () => `<fills${fm[1].replace(/count="\d+"/, `count="${n + 1}"`)}>${fm[2]}<fill><patternFill patternType="solid"><fgColor rgb="FFFFF2B3"/><bgColor indexed="64"/></patternFill></fill></fills>`);
    const xm = /<cellXfs\b([^>]*)>([\s\S]*?)<\/cellXfs>/.exec(styles); xfList = xm ? (xm[2].match(/<xf\b[^>]*?(?:\/>|>[\s\S]*?<\/xf>)/g) || []) : []; xfCount = xfList.length;
  };
  const hiStyle = s => {
    if (!styles) return s; prepStyles(); if (fillId == null) return s; const k = String(s || 0); if (hiCache.has(k)) return hiCache.get(k);
    const base = xfList[+k] || xfList[0] || '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>';
    const nx = base.replace(/\sfillId="\d+"/, '').replace(/\sapplyFill="\d"/, '').replace(/^<xf\b/, `<xf fillId="${fillId}" applyFill="1"`);
    xfList.push(nx); const id = String(xfList.length - 1); hiCache.set(k, id); return id;
  };
  const changes = []; const bySheet = {};
  for (const u of updates) (bySheet[u.sheet] = bySheet[u.sheet] || []).push(u);
  for (const sh of book.sheets) {
    const list = bySheet[sh.name]; const meta = model.sheets[sh.name]; if (!list || !meta || !z.has(sh.path)) continue;
    let xml = z.get(sh.path).toString('utf8');
    const sd = /<sheetData\b[^>]*>([\s\S]*?)<\/sheetData>/.exec(xml); if (!sd) continue;
    /* تقطيع الصفوف مرة واحدة */
    const parts = []; const idx = new Map(); let last = 0;
    sd[1].replace(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g, (m, a, inner, off) => { if (off > last) parts.push(sd[1].slice(last, off)); const r = +attrsOf(a).r; idx.set(r, parts.length); parts.push({ r, a, inner: inner || '' }); last = off + m.length; return m; });
    if (last < sd[1].length) parts.push(sd[1].slice(last));
    for (const u of list) {
      const pi = idx.get(u.row); if (pi == null) continue; const row = parts[pi];
      for (const [key, value] of Object.entries(u.set)) {
        const c = meta.cols[key]; if (!c || value == null || value === '') continue;
        const ref = colL(c) + u.row;
        const cm = new RegExp(`<c\\b([^>]*?\\br="${ref}"[^>]*?)(?:\\/>|>([\\s\\S]*?)<\\/c>)`).exec(row.inner);
        const ca = cm ? attrsOf(cm[1]) : { r: ref }; const ci = cm ? (cm[2] || '') : '';
        if (/<f\b/.test(ci)) { changes.push({ sheet: sh.name, ref, row: u.row, label: u.label, field: meta.head[key] || key, old: '', neu: '', note: 'خلية معادلة (رابط) — لم تُغيَّر' }); continue; }
        const oldText = cm ? T(cellText(book, { a: ca, v: (/<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/.exec(ci) || [])[1] != null ? X.RN ? (/<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/.exec(ci) || [])[1] : null : null, is: (/<is>([\s\S]*?)<\/is>/.exec(ci) || [])[1] || null })) : '';
        const oldNum = ca.t === 's' || ca.t === 'inlineStr' || ca.t === 'str' ? null : num(oldText);
        let xmlVal, shown;
        if (DATES.has(key)) {
          const iso = String(value); const n = serialOf(iso);
          if (n != null && (oldNum != null || !oldText)) { xmlVal = { n }; shown = dmyTxt(iso); } else { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso); shown = m ? `${+m[3]}/${+m[2]}/${m[1]}` : iso; xmlVal = { s: shown }; }
          if (isoOf(oldText) === iso) continue;
        } else if (PCTS.includes(key)) {
          const p = +value; if (!isFinite(p)) continue; const v = meta.scale[key] === 'frac' ? Math.round(p * 100) / 10000 : p;
          const oldP = oldNum == null ? null : (meta.scale[key] === 'frac' && oldNum <= 1.5 ? oldNum * 100 : oldNum); if (oldP != null && Math.abs(oldP - p) < 0.05) continue; if (p === 0 && oldP) continue;
          xmlVal = { n: v }; shown = p + '%';
        } else if (typeof value === 'number') {
          if (oldNum != null && Math.abs(oldNum - value) < 0.5) continue;
          if (value === 0 && oldText && oldNum !== 0) continue;   /* لا يُمسح رقم موجود بصفر من الموقف (قد يكون الحقل فارغاً عندنا) */
          xmlVal = { n: value }; shown = value.toLocaleString('en-US');
        } else {
          const s = T(value), a = RN(s).replace(/\s+/g, ''), b = RN(oldText).replace(/\s+/g, '');
          if (a === b || (a && b && (b.includes(a) || a.includes(b)))) continue;   /* الاسم نفسه مختصراً أو مفصلاً: يبقى كما في ملف التخطيط */
          xmlVal = { s }; shown = s;
        }
        const na = Object.assign({}, ca); delete na.t; na.r = ref; if (opts.highlight !== false) na.s = hiStyle(ca.s || 0);
        const cellXml = xmlVal.n != null ? `<c${attrStr(na)}><v>${xmlVal.n}</v></c>` : `<c${attrStr(Object.assign(na, { t: 'inlineStr' }))}><is><t xml:space="preserve">${enc(xmlVal.s)}</t></is></c>`;
        if (cm) row.inner = row.inner.replace(cm[0], () => cellXml);
        else { /* إدراج بترتيب الأعمدة */
          let placed = false; row.inner = row.inner.replace(/<c\b[^>]*?\br="([A-Z]+)\d+"/g, (m, L) => { if (!placed && colN(L) > c) { placed = true; return cellXml + m; } return m; });
          if (!placed) row.inner += cellXml;
        }
        const oldShown = !oldText ? '' : DATES.has(key) ? (dmyTxt(isoOf(oldText)) || oldText) : PCTS.includes(key) && oldNum != null ? (Math.round((meta.scale[key] === 'frac' && oldNum <= 1.5 ? oldNum * 100 : oldNum) * 100) / 100) + '%' : oldNum != null ? oldNum.toLocaleString('en-US') : oldText;
        changes.push({ sheet: sh.name, ref, row: u.row, label: u.label, field: meta.head[key] || key, old: oldShown, neu: shown, note: '' });
      }
      parts[pi] = row;
    }
    const newSd = parts.map(p => typeof p === 'string' ? p : `<row${p.a}>${p.inner}</row>`).join('');
    xml = xml.replace(sd[0], () => sd[0].replace(sd[1], () => newSd));
    z.set(sh.path, Buffer.from(xml, 'utf8'));
  }
  if (xfList && styles) {
    styles = styles.replace(/<cellXfs\b([^>]*)>([\s\S]*?)<\/cellXfs>/, (m, a) => `<cellXfs${a.replace(/count="\d+"/, `count="${xfList.length}"`)}>${xfList.join('')}</cellXfs>`);
    z.set('xl/styles.xml', Buffer.from(styles, 'utf8'));
  }
  /* ورقة «التغييرات» */
  addSheet(z, sheetNameFree(book, 'التغييرات ' + stamp.split('/').reverse().join('-')), [['الورقة', 'الخلية', 'المشروع (المكوّن)', 'الحقل', 'القيمة السابقة', 'القيمة الجديدة', 'ملاحظة']].concat(changes.map(c => [c.sheet, c.ref, c.label, c.field, c.old, c.neu, c.note])));
  /* لوحتا المعلومات (الخطة / المنافذ وإعادة الاستقرار) + توقيع القسم والقفل */
  let dash = null; if (opts.dash !== false) { try { dash = require('./planning-dash').addDash(z, book, model, updates, { lockPw: opts.lockPw, stamp: stamp.split('/').reverse().map(x => String(+x)).join('/') }); } catch (e) { dash = { error: String(e && e.message || e) }; } }
  /* إعادة حساب المعادلات عند الفتح */
  let wb = z.get('xl/workbook.xml').toString('utf8');
  wb = /<calcPr\b/.test(wb) ? wb.replace(/<calcPr\b([^>]*?)\/?>/, (m, a) => `<calcPr${a.replace(/\sfullCalcOnLoad="\w+"/, '')} fullCalcOnLoad="1"/>`) : wb.replace('</workbook>', () => '<calcPr fullCalcOnLoad="1"/></workbook>');
  z.set('xl/workbook.xml', Buffer.from(wb, 'utf8'));
  if (!opts.keepDates) X.dmyDates(z);   /* التواريخ في الملف المُصدَّر يوم/شهر/سنة (keepDates: «تحديث نسب الإنجاز» لا يغيّر شيئاً غير النسب) */
  xmlGuard(z);
  return { buf: zip(z), changes, dash };
}
/* فحص أخير قبل الحفظ: كل أجزاء XML في المصنف سليمة البنية (لا «<» داخل قيمة سمة، وأعداد عناصر التنسيقات مطابقة)؛
   وإن وُجد خلل يتوقف التصدير برسالة بدل ملف يُصلحه Excel */
function xmlGuard(z) {
  const bad = []; const stx = z.has('xl/styles.xml') ? z.get('xl/styles.xml').toString('utf8') : '';
  const cxm = /<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/.exec(stx), nXf = cxm ? (cxm[1].match(/<xf\b/g) || []).length : 0;
  const dxm = /<dxfs\b[^>]*>([\s\S]*?)<\/dxfs>/.exec(stx), nDxf = dxm ? (dxm[1].match(/<dxf\b/g) || []).length : (/<dxfs\b[^>]*\/>/.test(stx) ? 0 : null);
  for (const k of z.keys()) {
    if (!/\.(xml|rels)$/.test(k)) continue; const x = z.get(k).toString('utf8');
    if (/<[A-Za-z][^<>]*="[^"]*</.test(x.replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, ''))) bad.push(k + ': قيمة سمة فيها «<»');   /* داخل الوسوم فقط: نص معادلة مثل IF(A1="",…) ليس سمة */
    const open = (x.match(/<sheetData\b(?![^>]*\/>)/g) || []).length, close = (x.match(/<\/sheetData>/g) || []).length; if (open !== close) bad.push(k + ': sheetData');
    if (/^xl\/worksheets\/sheet\d+\.xml$/.test(k) && nXf) { let mx = -1; x.replace(/<c\b[^>]*?\ss="(\d+)"/g, (m, i) => { if (+i > mx) mx = +i; return m; }); x.replace(/<(?:row|col)\b[^>]*?\ss(?:tyle)?="(\d+)"/g, (m, i) => { if (+i > mx) mx = +i; return m; }); if (mx >= nXf) bad.push(`${k}: تنسيق خلية غير موجود (${mx})`);
      if (nDxf != null) { let md = -1; x.replace(/dxfId="(\d+)"/g, (m, i) => { if (+i > md) md = +i; return m; }); if (md >= nDxf) bad.push(`${k}: تنسيق شرطي غير موجود`); } }
    if (k === 'xl/styles.xml') for (const [t, i] of [['numFmts', 'numFmt'], ['fonts', 'font'], ['fills', 'fill'], ['borders', 'border'], ['cellXfs', 'xf'], ['cellStyleXfs', 'xf']]) {
      const all = x.match(new RegExp(`<${t}\\b`, 'g')) || []; if (all.length > 1) bad.push(`${k}: ${t} مكرر`);
      const m = new RegExp(`<${t}\\b[^>]*count="(\\d+)"[^>]*>([\\s\\S]*?)</${t}>`).exec(x); if (m && +m[1] !== (m[2].match(new RegExp(`<${i}\\b`, 'g')) || []).length) bad.push(`${k}: عدد ${t}`);
    }
  }
  if (bad.length) throw new Error('تعذّر إنتاج ملف سليم (لم يُحفظ شيء): ' + bad.slice(0, 3).join('؛ '));
}
function sheetNameFree(book, n) { const names = new Set(book.sheets.map(s => s.name)); let k = n.slice(0, 31), i = 2; while (names.has(k)) k = (n.slice(0, 27) + ' ' + i++); return k; }
function addSheet(z, name, rows) {
  const files = [...z.keys()].filter(k => /^xl\/worksheets\/sheet\d+\.xml$/.test(k)).map(k => +k.match(/(\d+)\.xml$/)[1]);
  const n = (files.length ? Math.max(...files) : 0) + 1, path = `xl/worksheets/sheet${n}.xml`;
  const cell = (v, r, c) => `<c r="${colL(c)}${r}" t="inlineStr"><is><t xml:space="preserve">${enc(v == null ? '' : v)}</t></is></c>`;
  const sd = rows.map((row, i) => `<row r="${i + 1}">${row.map((v, j) => cell(v, i + 1, j + 1)).join('')}</row>`).join('');
  z.set(path, Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetViews><sheetView rightToLeft="1" workbookViewId="0"/></sheetViews><cols><col min="1" max="2" width="14" customWidth="1"/><col min="3" max="3" width="60" customWidth="1"/><col min="4" max="4" width="28" customWidth="1"/><col min="5" max="6" width="26" customWidth="1"/><col min="7" max="7" width="34" customWidth="1"/></cols><sheetData>${sd}</sheetData></worksheet>`, 'utf8'));
  let rels = z.get('xl/_rels/workbook.xml.rels').toString('utf8'); const rid = 'rIdPlan' + n;
  rels = rels.replace('</Relationships>', () => `<Relationship Id="${rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${n}.xml"/></Relationships>`);
  z.set('xl/_rels/workbook.xml.rels', Buffer.from(rels, 'utf8'));
  let wb = z.get('xl/workbook.xml').toString('utf8'); const ids = []; wb.replace(/<sheet\b[^>]*sheetId="(\d+)"/g, (_, i) => { ids.push(+i); return _; });
  wb = wb.replace('</sheets>', () => `<sheet xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" name="${enc(name)}" sheetId="${Math.max(0, ...ids) + 1}" r:id="${rid}"/></sheets>`);
  z.set('xl/workbook.xml', Buffer.from(wb, 'utf8'));
  let ct = z.get('[Content_Types].xml').toString('utf8');
  if (!ct.includes(`/xl/worksheets/sheet${n}.xml`)) ct = ct.replace('</Types>', () => `<Override PartName="/xl/worksheets/sheet${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`);
  z.set('[Content_Types].xml', Buffer.from(ct, 'utf8'));
}
module.exports = { parse, exportBook, isoOf, fundNorm, fundCanon, num, xmlGuard, CLEAN_SHEETS, addSheet, sheetNameFree };
