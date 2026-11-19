'use strict';
/* «ملف التخطيط المنظَّم»: ملف Excel جديد مبني من قراءة البرنامج لملف التخطيط (الأصل لا يُمس):
   - المشروع التخطيطي ثم مكوّناته تحته، والأعمدة في مجموعات منطقية (التعريف، العقد، المالية، المدد، الإنجاز، الكادر والموقع، أخرى).
   - قيم موحّدة: الحالة من قائمة ثابتة، النسب مئوية، المبالغ أرقام، أسماء الأقضية والتمويل مصحّحة.
   - «الاستحداث والمكونات المقسمة» عمود مستقل (استحداث 2023، مكون مقسم، مكون مدمج) بدل خلطها بالحالة.
   - نسبة إنجاز المشروع = معدل نسب إنجاز مكوّناته، وحالته من حالات مكوّناته.
   - ورقة «ملاحظات جودة البيانات» (كل خلل برقم صفه في الأصل) و«دليل التوحيد» (كل قيمة أصلية وما وُحّدت إليه). */
const XLW = require('./shell/xlwriter.js');
const { unzip, zip } = require('./xlmerge');
const CREDIT = 'إعداد قسم الشؤون الهندسية — ديوان محافظة الانبار';
const T = s => String(s == null ? '' : s).replace(/[‌-‏]/g, '').replace(/\s+/g, ' ').trim();
const isNum = v => typeof v === 'number' && isFinite(v);
const STATUSES = ['منجز', 'مستمر', 'متلكئ', 'متوقف', 'فسخ عقد', 'سحب عمل', 'لم يباشر', 'غير محدد'];

/* الحالة ← {st, kind, extra}: kind = استحداث/مقسم/مدمج، extra = نص أطول من الحالة (إجراءات) */
function statusNorm(raw) {
  const t = T(raw); if (!t || /^0+(\.0+)?$/.test(t) || t === '-') return { st: '', kind: '', extra: '' };
  if (/استحداث|مقسم|مدمج/.test(t)) return { st: '', kind: t.replace(/^المكون\s*/, 'مكون ').replace(/^مكون\s+/, 'مكوّن '), extra: '' };
  let st = '';
  if (/فسخ/.test(t)) st = 'فسخ عقد';
  else if (/سحب العمل|سحب عمل/.test(t)) st = 'سحب عمل';
  else if (/متلكئ|متلكء/.test(t)) st = 'متلكئ';
  else if (/متوقف|توقف/.test(t)) st = 'متوقف';
  else if (/لم (ي|ت)?باشر|غير مباشر/.test(t)) st = 'لم يباشر';
  else if (/مستمر|قيد التنفيذ/.test(t)) st = 'مستمر';
  else if (/منجز|انجز|أنجز|مكتمل|مستلم/.test(t)) st = 'منجز';
  return { st: st || 'غير محدد', kind: '', extra: st && t.replace(/^العمل\s+/, '') !== st ? t : (st ? '' : t) };
}
const DIST = { 'عنة': 'عنه', 'راوة': 'راوه', 'القائم ': 'القائم', 'حديثه': 'حديثة', 'هيث': 'هيت', 'الرماي': 'الرمادي', 'الفلوجه': 'الفلوجة', 'الخالديه': 'الخالدية', 'العاميرية': 'العامرية', 'العامريه': 'العامرية', 'البغدادى': 'البغدادي' };
const distNorm = v => { const t = T(v); return DIST[t] || t; };
const pctNorm = v => { if (isNum(v)) return v; const t = T(v).replace(/%$/, ''); if (!t) return null; const n = +t; if (!isFinite(n)) return null; return n <= 1.5 && /\./.test(t) ? Math.round(n * 1000) / 10 : n; };
const physNorm = v => { if (v == null || v === '') return null; if (isNum(v)) return v <= 1.5 ? Math.round(v * 1000) / 10 : v; const t = T(v); const pc = /%$/.test(t); const n = +t.replace(/%$/, ''); if (!isFinite(n)) return null; return !pc && n <= 1.5 ? Math.round(n * 1000) / 10 : n; };
const dateTxt = v => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v || '')); return m ? `${+m[3]}/${+m[2]}/${m[1]}` : T(v); };
const avg = a => { const L = a.filter(isNum); return L.length ? Math.round(L.reduce((s, x) => s + x, 0) / L.length * 10) / 10 : null; };

/* الأعمدة: [مفتاح, عنوان, نوع, عرض] — النوع: t نص، i رقم، p نسبة، d تاريخ */
const GROUPS_MAIN = [
  ['التعريف', [['seq', 'ت', 'i', 6], ['code', 'رمز المشروع', 't', 16], ['level', 'المستوى', 't', 9], ['name', 'المشروع / المكوّن', 't', 50], ['fund', 'اسم الخطة (التمويل)', 't', 20], ['ministry', 'الوزارة / الجهة المستفيدة', 't', 22], ['directorate', 'الدائرة المستفيدة', 't', 24], ['district', 'القضاء', 't', 12], ['sector', 'القطاع', 't', 14]]],
  ['العقد', [['contractNo', 'رقم العقد', 't', 12], ['contractDate', 'تاريخ العقد', 'd', 12], ['company', 'الشركة المنفذة', 't', 24], ['referral', 'مبلغ الإحالة', 'i', 16], ['contract', 'مبلغ العقد', 'i', 16], ['contractAfter', 'مبلغ العقد بعد أوامر التغيير', 'i', 17], ['coSum', 'مبلغ أوامر التغيير', 'i', 15], ['coCount', 'عدد أوامر التغيير', 'i', 9], ['cost', 'الكلفة التخمينية', 'i', 16]]],
  ['المالية', [['advRaised', 'السلف المرفوعة', 'i', 15], ['advPaid', 'السلف المصروفة', 'i', 15], ['spent', 'المصروف الكلي', 'i', 16], ['supSpent', 'مصروف الإشراف والمراقبة', 'i', 14], ['commit', 'الالتزامات الواجبة الدفع', 'i', 15], ['remain', 'المبلغ المتبقي للإنجاز', 'i', 15]]],
  ['المدد والتواريخ', [['start', 'تاريخ المباشرة', 'd', 12], ['dur', 'مدة التنفيذ (يوم)', 'i', 9], ['ext', 'المدة المضافة (يوم)', 'i', 9], ['end', 'تاريخ الإنجاز', 'd', 12]]],
  ['الإنجاز', [['st', 'حالة المشروع', 't', 13], ['nov', 'الاستحداث والمكونات المقسمة', 't', 15], ['planPct', 'نسبة الإنجاز المخطط', 'p', 10], ['tech', 'نسبة الإنجاز الفني', 'p', 10], ['actPct', 'نسبة الإنجاز الفعلي (اللجان)', 'p', 11], ['phys', 'الموقف المادي', 'p', 10]]],
  ['الكادر والموقع', [['resident', 'المهندس المقيم', 't', 20], ['phone', 'رقم الهاتف', 't', 13], ['coords', 'الإحداثيات', 't', 18], ['platform', 'منصة إنجاز', 't', 12]]],
  ['أخرى', [['updated', 'تاريخ آخر تحديث', 'd', 12], ['actions', 'الإجراءات المتخذة', 't', 30], ['stRaw', 'نص الحالة في الأصل', 't', 24], ['row', 'صف الأصل', 'i', 7]]]
];
const GROUPS_S2 = [
  ['التعريف', [['seq', 'ت', 'i', 6], ['level', 'المستوى', 't', 9], ['name', 'المشروع', 't', 50], ['fund', 'نوع التمويل', 't', 18], ['directorate', 'الجهة المستفيدة', 't', 24], ['district', 'القضاء', 't', 12]]],
  ['العقد', [['contractNo', 'رقم العقد', 't', 12], ['contractDate', 'تاريخ العقد', 'd', 12], ['company', 'الشركة المنفذة', 't', 24], ['contract', 'مبلغ العقد', 'i', 16], ['contractAfter', 'مبلغ العقد بعد أوامر التغيير', 'i', 17]]],
  ['المالية', [['advPromo', 'السلف المروّجة', 'i', 15], ['advRaised', 'السلف المرفوعة', 'i', 15], ['advPaid', 'السلف المصروفة', 'i', 15], ['spent', 'المصروف', 'i', 16]]],
  ['المدد والتواريخ', [['start', 'تاريخ المباشرة', 'd', 12], ['dur', 'مدة العقد (يوم)', 'i', 9], ['ext', 'المدة الإضافية (يوم)', 'i', 9], ['end', 'تاريخ الإنجاز', 'd', 12]]],
  ['الإنجاز', [['st', 'حالة المشروع', 't', 13], ['nov', 'الاستحداث والمكونات المقسمة', 't', 15], ['planPct', 'نسبة الإنجاز المخطط', 'p', 10], ['actPct', 'نسبة الإنجاز الفعلي', 'p', 10], ['phys', 'الموقف المادي', 'p', 10]]],
  ['الكادر والموقع', [['resident', 'المهندس المقيم', 't', 20], ['phone', 'رقم الهاتف', 't', 13], ['coords', 'الإحداثيات', 't', 18]]],
  ['أخرى', [['notes', 'الملاحظات', 't', 30], ['stRaw', 'نص الحالة في الأصل', 't', 24], ['row', 'صف الأصل', 'i', 7]]]
];
const MONEY = ['referral', 'contract', 'contractAfter', 'coSum', 'coCount', 'cost', 'advPromo', 'advRaised', 'advPaid', 'spent', 'supSpent', 'commit', 'remain', 'dur', 'ext'];

function build(model, opts = {}) {
  const S = XLW.S, stamp = opts.stamp || (() => { const d = new Date(); return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`; })();   /* يوم/شهر/سنة */
  const issues = [], map = new Map();
  const note = (sheet, c, field, msg, val) => issues.push([sheet, c.row || '', c.name || '', field, msg, val == null ? '' : String(val)]);
  const mapped = (field, from, to) => { if (T(from) === T(to)) return; const k = field + '\u0001' + T(from) + '\u0001' + T(to); map.set(k, (map.get(k) || 0) + 1); };
  const sheetLabel = k => k === 'main' ? 'خطة المحافظة' : 'المنافذ وإعادة الاستقرار';
  /* تنظيف مكوّن */
  const clean = c => {
    const o = Object.assign({}, c), sl = sheetLabel(c.kind);
    const a = statusNorm(c.status), b = c.kind === 'main' ? statusNorm(c.status2) : { st: '', kind: '', extra: '' };
    o.stRaw = [T(c.status), c.kind === 'main' && T(c.status2) && T(c.status2) !== T(c.status) ? T(c.status2) : ''].filter(Boolean).join(' ‖ ');
    o.st = a.st || b.st || 'غير محدد'; o.nov = a.kind || b.kind;
    if (a.extra && !o.actions) o.actions = a.extra;
    if (T(c.status)) mapped('حالة المشروع', c.status, a.kind ? '(الاستحداث والمكونات المقسمة) ' + a.kind : a.st || 'غير محدد');
    if (o.st === 'غير محدد') note(sl, c, 'حالة المشروع', /^0+$/.test(T(c.status) || T(c.status2)) ? 'الحالة مكتوبة «0»' : o.nov ? `في خانة الحالة «${o.nov}» وليست حالة` : 'الحالة فارغة', o.stRaw);
    if (a.st && b.st && a.st !== b.st) note(sl, c, 'حالة المشروع', 'عمودا الحالة في الجدول مختلفان', `${T(c.status)} / ${T(c.status2)}`);
    const d0 = T(c.district); o.district = distNorm(d0); if (d0) mapped('القضاء', d0, o.district); if (!o.district) note(sl, c, 'القضاء', 'القضاء فارغ', '');
    if (c.kind === 'main' && T(c.plan) && T(c.plan) !== c.fund) mapped('اسم الخطة (التمويل)', c.plan, c.fund);
    o.fund = require('./planning').fundNorm(c.fund);   /* توحيد التمويل بأسماء الموقف العام */
    if (!o.fund) { o.fund = 'غير محدد'; note(sl, c, 'التمويل', 'التمويل فارغ', ''); }
    for (const k of MONEY) if (c[k] != null && !isNum(c[k])) { const n = +String(c[k]).replace(/[,٬\s]/g, ''); note(sl, c, k, isFinite(n) && T(c[k]) ? 'رقم مكتوب كنص' : 'قيمة غير رقمية في عمود رقمي', c[k]); o[k] = isFinite(n) && T(c[k]) ? n : null; }
    for (const k of ['planPct', 'tech', 'actPct']) if (c[k] != null) { o[k] = pctNorm(c[k]); if (o[k] != null && o[k] > 100) note(sl, c, k, 'نسبة أكبر من 100%', c[k]); }
    o.phys = physNorm(c.phys);
    const act = [o.actPct, o.tech].some(isNum) ? Math.max(...[o.actPct, o.tech].filter(isNum)) : null;   /* أعلى النسبتين (الفني / اللجان) */
    if (o.st === 'منجز' && act != null && act < 95) note(sl, c, 'نسبة الإنجاز', `الحالة «منجز» ونسبة الإنجاز ${act}%`, act);
    if ((o.st === 'مستمر' || o.st === 'متلكئ') && act === 100) note(sl, c, 'نسبة الإنجاز', `الحالة «${o.st}» ونسبة الإنجاز 100%`, act);
    if (!isNum(o.contract) && !isNum(o.contractAfter) && (T(c.contractNo) || T(c.company))) note(sl, c, 'مبلغ العقد', 'مبلغ العقد فارغ مع وجود عقد/شركة', '');
    if (!c.start && ['منجز', 'مستمر', 'متلكئ', 'متوقف'].includes(o.st)) note(sl, c, 'تاريخ المباشرة', `تاريخ المباشرة فارغ والحالة «${o.st}»`, '');
    const cap = isNum(o.contractAfter) ? o.contractAfter : o.contract; if (isNum(cap) && cap > 0 && isNum(o.spent) && o.spent > cap * 1.0001) note(sl, c, 'المصروف', 'المصروف أكبر من مبلغ العقد', o.spent);
    if (c.phone && !/^0?7\d{9}$/.test(String(c.phone).replace(/\D/g, ''))) note(sl, c, 'رقم الهاتف', 'رقم هاتف غير صالح', c.phone);
    for (const k of ['contractDate', 'start', 'end', 'updated']) o[k] = c[k] ? dateTxt(c[k]) : '';
    return o;
  };
  const comps = model.comps.map(clean), byKey = new Map(comps.map(c => [c.key, c]));
  /* حالة المشروع ونسبته من مكوّناته */
  const projOf = p => {
    const L = (p.comps || []).map(k => byKey.get(k)).filter(Boolean);
    const sum = k => { const v = L.map(c => c[k]).filter(isNum); return v.length ? v.reduce((s, x) => s + x, 0) : null; };
    const done = L.filter(c => c.st === 'منجز').length;
    const st = !L.length ? 'غير محدد' : done === L.length ? 'منجز' : L.every(c => c.st === L[0].st) ? L[0].st : `${done} من ${L.length} منجز`;
    const o = { level: 'مشروع', code: p.code, name: p.name, fund: require('./planning').fundNorm(p.plan) || (L[0] && L[0].fund) || '', ministry: p.ministry, st, nov: [...new Set(L.map(c => c.nov).filter(Boolean))].join('، '), row: p.row || '' };
    for (const k of MONEY) if (k !== 'dur' && k !== 'ext') o[k] = sum(k);
    if (isNum(p.cost)) o.cost = p.cost;
    for (const k of ['planPct', 'tech', 'actPct', 'phys']) o[k] = avg(L.map(c => c[k]));
    const ds = [...new Set(L.map(c => c.district).filter(Boolean))]; o.district = ds.length === 1 ? ds[0] : ds.length ? 'متعدد' : '';
    const dr = [...new Set(L.map(c => c.directorate).filter(Boolean))]; o.directorate = dr.length === 1 ? dr[0] : '';
    o.n = L.length; return { o, L };
  };
  /* ورقة جدول */
  const tableSheet = (title, name, groups, projects, tab) => {
    const cols = groups.flatMap(g => g[1]); const W = cols.length, L = XLW.colL(W - 1);
    const rows = [[{ v: title, s: S.title }], [{ v: CREDIT, s: S.sub }], [{ v: `نسبة إنجاز المشروع = معدل نسب إنجاز مكوّناته · الحالة من قائمة موحّدة · «نص الحالة في الأصل» و«صف الأصل» للرجوع إلى ملف التخطيط · تاريخ الإصدار ${stamp}`, s: S.wrap }]];
    const merges = [`A1:${L}1`, `A2:${L}2`, `A3:${L}3`];
    const gr = []; let c0 = 0; groups.forEach(([g, cs]) => { gr[c0] = { v: g, s: S.grp }; for (let i = 1; i < cs.length; i++) gr[c0 + i] = { v: '', s: S.grp }; if (cs.length > 1) merges.push(`${XLW.colL(c0)}4:${XLW.colL(c0 + cs.length - 1)}4`); c0 += cs.length; });
    rows.push(gr); rows.push(cols.map(c => ({ v: c[1], s: S.head })));
    const cell = (o, [k, , t], proj) => { const v = o[k];
      if (t === 'i') return isNum(v) ? { v, s: proj ? S.stI : S.int } : { v: '', s: proj ? S.stT : S.txt };
      if (t === 'p') return isNum(v) ? { v, s: proj ? S.stP : S.pct } : { v: '', s: proj ? S.stT : S.txt };
      return { v: v == null ? '' : String(v), s: proj ? S.stT : S.txt }; };
    let seq = 0;
    projects.forEach(p => { const { o, L: comps } = projOf(p); if (!comps.length) return;
      seq++; o.seq = seq; o.level = p.virtual ? 'مجموعة' : 'مشروع'; o.name = (p.virtual ? p.plan || o.fund : o.name) + (comps.length > 1 || p.virtual ? `  (${comps.length} مكوّن)` : '');
      rows.push(cols.map(c => cell(o, c, true)));
      comps.forEach((c, i) => { const r = Object.assign({}, c, { seq: `${seq}.${i + 1}`, level: 'مكوّن', code: '' }); rows.push(cols.map(cc => cc[0] === 'seq' ? { v: r.seq, s: S.txt } : cell(r, cc, false))); });
    });
    const pctCols = cols.map((c, i) => c[2] === 'p' ? XLW.colL(i) : null).filter(Boolean);
    return { name, tab, cols: cols.map(c => c[3]), rows, merges, freeze: 5, filter: `A5:${L}${rows.length}`, titles: '5', footer: CREDIT, zoom: 85, heights: { 1: 30, 3: 30, 5: 42 }, bars: pctCols.map(cl => ({ ref: `${cl}6:${cl}${rows.length}`, max: 100, color: 'FF63BE7B' })) };
  };
  const mainP = model.projects.filter(p => !p.virtual), s2P = model.projects.filter(p => p.virtual);
  const sheets = [];
  /* الملخص */
  const all = comps, X1 = S;
  const sumOf = (L, k) => L.reduce((s, c) => s + (isNum(c[k]) ? c[k] : 0), 0);
  const capOf = c => isNum(c.contractAfter) ? c.contractAfter : isNum(c.contract) ? c.contract : 0;
  const sm = [[{ v: 'ملف التخطيط المنظَّم — الملخص', s: X1.title }], [{ v: CREDIT, s: X1.sub }], [{ v: `مبني من ملف «${model.file || 'التخطيط'}» · تاريخ الإصدار ${stamp}`, s: X1.wrap }], []];
  const kp = [['المشاريع التخطيطية (الخطة)', mainP.filter(p => p.comps && p.comps.length).length], ['مكوّنات الخطة', comps.filter(c => c.kind === 'main').length], ['مشاريع المنافذ وإعادة الاستقرار', comps.filter(c => c.kind !== 'main').length], ['مبلغ العقود بعد أوامر التغيير', all.reduce((s, c) => s + capOf(c), 0)], ['المصروف', sumOf(all, 'spent')], ['السلف المصروفة', sumOf(all, 'advPaid')], ['معدل الإنجاز الفعلي %', avg(all.map(c => isNum(c.actPct) ? c.actPct : c.tech))], ['ملاحظات جودة البيانات', issues.length]];
  sm.push([{ v: 'المؤشر', s: X1.head }, { v: 'القيمة', s: X1.head }]); kp.forEach(([l, v]) => sm.push([{ v: l, s: X1.kpiL }, { v: v == null ? '' : v, s: /معدل/.test(l) ? X1.kpiP : X1.kpiV }]));
  const bars = [];
  const brk = (title, keyFn) => { sm.push([]); sm.push([{ v: title, s: X1.head }, { v: 'العدد', s: X1.head }, { v: 'مبلغ العقود', s: X1.head }, { v: 'المصروف', s: X1.head }, { v: 'معدل الإنجاز الفعلي', s: X1.head }]);
    const g = new Map(); all.forEach(c => { const k = keyFn(c) || 'غير محدد'; (g.get(k) || g.set(k, []).get(k)).push(c); });
    const r0 = sm.length + 1; [...g.entries()].sort((a, b) => b[1].length - a[1].length).forEach(([k, L]) => sm.push([{ v: k, s: X1.txt }, { v: L.length, s: X1.int }, { v: L.reduce((s, c) => s + capOf(c), 0), s: X1.int }, { v: sumOf(L, 'spent'), s: X1.int }, { v: avg(L.map(c => isNum(c.actPct) ? c.actPct : c.tech)) ?? '', s: X1.pct }]));
    bars.push({ ref: `B${r0}:B${sm.length}`, max: Math.max(...[...g.values()].map(L => L.length)), color: 'FF5B9BD5' }, { ref: `E${r0}:E${sm.length}`, max: 100, color: 'FF63BE7B' }); };
  brk('حسب الجدول', c => sheetLabel(c.kind));
  brk('حسب حالة المشروع', c => c.st);
  brk('حسب الاستحداث والمكونات المقسمة', c => c.nov || 'مكوّن اعتيادي');
  brk('حسب التمويل', c => c.fund);
  brk('حسب القضاء', c => c.district);
  brk('حسب الجهة المستفيدة', c => c.directorate);
  sheets.push({ name: 'الملخص', tab: 'FF1F6F50', cols: [40, 22, 22, 22, 16], rows: sm, merges: ['A1:E1', 'A2:E2', 'A3:E3'], bars, footer: CREDIT, portrait: true });
  if (comps.some(c => c.kind === 'main')) sheets.push(tableSheet('خطة محافظة الانبار — المشاريع ومكوّناتها', 'المشاريع والمكوّنات', GROUPS_MAIN, mainP, 'FF2F5D8A'));
  if (comps.some(c => c.kind !== 'main')) sheets.push(tableSheet('المنافذ الحدودية وإعادة الاستقرار', 'المنافذ وإعادة الاستقرار', GROUPS_S2, s2P, 'FF2F5D8A'));
  /* ملاحظات الجودة */
  const FL = { contract: 'مبلغ العقد', contractAfter: 'مبلغ العقد بعد التغيير', spent: 'المصروف', advPaid: 'السلف المصروفة', advRaised: 'السلف المرفوعة', planPct: 'نسبة الإنجاز المخطط', actPct: 'نسبة الإنجاز الفعلي', tech: 'نسبة الإنجاز الفني', dur: 'المدة', ext: 'المدة المضافة', cost: 'الكلفة التخمينية', referral: 'مبلغ الإحالة', coSum: 'أوامر التغيير', coCount: 'عدد أوامر التغيير', advPromo: 'السلف المروّجة', supSpent: 'مصروف الإشراف', commit: 'الالتزامات', remain: 'المتبقي' };
  const qr = [[{ v: 'ملاحظات جودة البيانات في ملف التخطيط', s: S.title }], [{ v: CREDIT, s: S.sub }], [{ v: `${issues.length} ملاحظة — كل ملاحظة برقم صفها في ملف التخطيط الأصلي ليُصحَّح هناك`, s: S.wrap }],
    ['ت', 'الجدول', 'صف الأصل', 'المشروع / المكوّن', 'الحقل', 'الملاحظة', 'القيمة في الأصل'].map(h => ({ v: h, s: S.head }))];
  issues.forEach((x, i) => qr.push([{ v: i + 1, s: S.int }, { v: x[0], s: S.txt }, { v: x[1], s: S.int }, { v: x[2], s: S.txt }, { v: FL[x[3]] || x[3], s: S.txt }, { v: x[4], s: S.txt }, { v: x[5], s: S.txt }]));
  const typ = new Map(); issues.forEach(x => typ.set(x[4].replace(/\d+(\.\d+)?%/, 'ن%').replace(/«[^»]*»/g, '«…»'), (typ.get(x[4].replace(/\d+(\.\d+)?%/, 'ن%').replace(/«[^»]*»/g, '«…»')) || 0) + 1));
  sheets.push({ name: 'ملاحظات جودة البيانات', tab: 'FFC00000', cols: [6, 18, 9, 50, 18, 36, 30], rows: qr, merges: ['A1:G1', 'A2:G2', 'A3:G3'], freeze: 4, filter: `A4:G${qr.length}`, titles: '4', footer: CREDIT });
  /* دليل التوحيد */
  const mr = [[{ v: 'دليل التوحيد: القيمة في الأصل ← القيمة الموحّدة', s: S.title }], [{ v: CREDIT, s: S.sub }], ['الحقل', 'القيمة في الأصل', 'القيمة الموحّدة', 'عدد المرات'].map(h => ({ v: h, s: S.head }))];
  [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], 'ar') || b[1] - a[1]).forEach(([k, n]) => { const [f, a, b] = k.split('\u0001'); mr.push([{ v: f, s: S.txt }, { v: a, s: S.txt }, { v: b, s: S.txt }, { v: n, s: S.int }]); });
  sheets.push({ name: 'دليل التوحيد', tab: 'FF7F7F7F', cols: [22, 50, 34, 10], rows: mr, merges: ['A1:D1', 'A2:D2'], freeze: 3, filter: `A3:D${mr.length}`, titles: '3', footer: CREDIT });
  let buf = XLW.book(sheets, { title: 'ملف التخطيط المنظَّم', author: 'قسم الشؤون الهندسية — ديوان محافظة الانبار' });
  /* القفل بكلمة سر المدير: قراءة وتصفية فقط */
  if (opts.lockPw) {
    const prot = require('./planning-dash')._pwHash(opts.lockPw), z = unzip(Buffer.from(buf));
    for (const k of [...z.keys()].filter(k => /^xl\/worksheets\/sheet\d+\.xml$/.test(k))) { const x = z.get(k).toString('utf8'); z.set(k, Buffer.from(x.replace('</sheetData>', () => `</sheetData><sheetProtection ${prot} sheet="1" objects="1" scenarios="1" formatColumns="0" formatRows="0" autoFilter="0" sort="0"/>`), 'utf8')); }
    buf = zip(z);
  }
  return { buf, stats: { issues: issues.length, comps: comps.length, mapped: map.size, types: Object.fromEntries(typ) } };
}
module.exports = { build, statusNorm, distNorm, STATUSES, CREDIT, GROUPS_MAIN, GROUPS_S2 };
