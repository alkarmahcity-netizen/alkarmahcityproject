'use strict';
// تحويل جدول أوامر التغيير القديم (Access: Table1) إلى ملفات البرنامج — الإصدار 2. تستعمله أداة سطر الأوامر (change-orders/tools/import_old_access.js)
// واستيراد ملف Access/Excel المباشر في البرنامج الموحد؛ القواعد نفسها في الحالتين. التفاصيل في رأس أداة سطر الأوامر.
const path = require('path'), fs = require('fs');
const C = require(fs.existsSync(path.join(__dirname, 'old-access-common.js')) ? path.join(__dirname, 'old-access-common.js') : path.join(__dirname, '..', 'shared', 'old-access-common.js'));
function convertCO(rows) {
  const { T, TL, N, has, nk, iso, numDate, similar, DSU, mode, lastOf, RN } = C;
  const rep = [], warn = (k, s) => rep.push([k, s]);
  const ORD = ['اول', 'ثاني', 'ثالث', 'رابع', 'خامس', 'سادس', 'سابع', 'ثامن', 'تاسع', 'عاشر'];
  const ordOf = o => { const t = RN(T(o.orno)).replace(/^ال/, ''); const k = ORD.findIndex(x => t === x); if (k >= 0) return k + 1;
    const m = T(o.chorderno).match(/(\d+)/); if (m && +m[1] >= 1 && +m[1] < 20) return +m[1]; return 0; };
  const slots = o => { let n = 0; for (let k = 1; k <= 6; k++) if (N(o['del' + k]) || N(o['add' + k]) || N(o['up' + k]) || N(o['dur' + k])) n = k; return n; };
  const nOrders = o => Math.max(slots(o), ordOf(o), 1);
  const isFixRow = o => /تصحيح/.test(T(o.chorderno));
  const z = v => { const t = T(v); return t === '0' ? '' : t; };
  /* ---------- الصفوف ---------- */
  const nameOk = v => { const t = T(v); return t.length >= 12 && /\s/.test(t) && nk(t).replace(/[0-9]/g, '').length >= 8; };
  const R = rows.map(o => ({ o, id: N(o.ID), name: nameOk(o.PRO) ? T(o.PRO) : '', k: nameOk(o.PRO) ? nk(o.PRO) : '', co: nk(o.COM), cost: N(o.contcost), amt: [1, 2, 3, 4, 5, 6].some(k => N(o['del' + k]) || N(o['add' + k]) || N(o['up' + k])) }));
  /* صفوف التجربة: بلا اسم صحيح ومبلغ عقد صغير (أقل من مليون) */
  const test = R.filter(r => !r.name && r.cost < 1e6); test.forEach(r => warn('صف تجربة أو فارغ (لم يُنقل)', `ID ${r.id}: «${T(r.o.PRO)}» — مبلغ العقد ${r.cost}`));
  const U = R.filter(r => !(!r.name && r.cost < 1e6)), D = DSU(U.length);
  const coSim = (a, b) => !!a && !!b && similar(a, b, 0.6);
  /* 1) الاسم نفسه + (مبلغ العقد نفسه أو الشركة نفسها/المشابهة) */
  const byName = new Map(); U.forEach((r, i) => { if (r.k) { if (!byName.has(r.k)) byName.set(r.k, []); byName.get(r.k).push(i); } });
  /* مبلغا عقد يختلفان بخطأ طباعي واحد (رقم مختلف أو زائد أو ناقص) */
  const lev1 = (a, b) => { a = String(a); b = String(b); if (a === b) return true; if (Math.abs(a.length - b.length) > 1) return false; let i = 0; while (i < a.length && a[i] === b[i]) i++; return a.slice(i + 1) === b.slice(i + 1) || a.slice(i) === b.slice(i + 1) || a.slice(i + 1) === b.slice(i); };
  const slot1 = o => [N(o.del1), N(o.add1), N(o.up1)].join('/');
  const sameContract = (a, b) => !a.cost || !b.cost || a.cost === b.cost || lev1(a.cost, b.cost) || (slot1(a.o) !== '0/0/0' && slot1(a.o) === slot1(b.o));
  for (const L of byName.values()) for (let x = 0; x < L.length; x++) for (let y = x + 1; y < L.length; y++) { const a = U[L[x]], b = U[L[y]]; if (sameContract(a, b) && (coSim(a.co, b.co) || !a.co || !b.co || a.cost === b.cost)) D.union(L[x], L[y]); }
  /* 2) مبلغ العقد نفسه (مليون فأكثر) + اسم مشابه */
  const byCost = new Map(); U.forEach((r, i) => { if (r.cost >= 1e6) { if (!byCost.has(r.cost)) byCost.set(r.cost, []); byCost.get(r.cost).push(i); } });
  for (const L of byCost.values()) for (let x = 0; x < L.length; x++) for (let y = x + 1; y < L.length; y++) { const a = U[L[x]], b = U[L[y]]; if (a.k && b.k && similar(a.k, b.k, 0.6)) D.union(L[x], L[y]); }
  /* 3) الصف بلا اسم: يُلحق بالمشروع الوحيد الذي له مبلغ العقد نفسه، أو (إن تعدد) بالذي تطابق مبالغ أمره الأول مبالغه */
  U.forEach((r, i) => { if (r.k || r.cost < 1e6) return; const cand = new Map(); (byCost.get(r.cost) || []).forEach(j => { if (U[j].k) { const g = D.find(j); if (!cand.has(g)) cand.set(g, []); cand.get(g).push(j); } });
    if (cand.size === 1) { D.union(i, [...cand.keys()][0]); return; }
    const hit = [...cand.entries()].filter(([, js]) => js.some(j => slot1(U[j].o) === slot1(r.o) && slot1(r.o) !== '0/0/0'));
    if (hit.length === 1) D.union(i, hit[0][0]); });
  const groups = new Map(); U.forEach((r, i) => { const g = D.find(i); if (!groups.has(g)) groups.set(g, []); groups.get(g).push(r); });
  /* ---------- السجلات ---------- */
  const records = []; let nameless = 0, slotOk = 0, slotDiff = 0, totOk = 0, totBad = 0, fixes = 0;
  for (const G0 of groups.values()) {
    const named = G0.filter(r => r.name);
    if (!named.length) { nameless += G0.length; G0.forEach(r => warn('أمر تغيير بلا اسم مشروع ولا مشروع بمبلغ العقد نفسه (لم يُنقل)', `ID ${r.id}: ${T(r.o.chorderno) || 'بلا رقم أمر'} — مبلغ العقد ${r.cost.toLocaleString('en-US')} — الشركة ${T(r.o.COM) || '—'}`)); continue; }
    const G = G0.slice().sort((a, b) => a.id - b.id), real = G.filter(r => r.cost >= 1e6), base = real.length ? real : G;
    /* الصف الأحدث بأكبر عدد أوامر: خاناته تحمل مبالغ كل الأوامر كما استقرت */
    const last = base.reduce((a, b) => (nOrders(b.o) > nOrders(a.o) || (nOrders(b.o) === nOrders(a.o) && b.id > a.id) ? b : a)).o;
    const n = Math.max(...base.map(r => nOrders(r.o)));
    const byOrd = {}; G.forEach(r => { const k = ordOf(r.o) || (slots(r.o) || 1); byOrd[k] = r.o; });
    const useDur = [1, 2, 3, 4, 5, 6].some(k => N(last['dur' + k]));
    const orders = [];
    for (let k = 1; k <= n; k++) {
      const src = byOrd[k] || null, fix = !!(src && isFixRow(src)); if (fix) fixes++;
      /* تحقق: مبالغ الأمر في صفّه (df/af/uf) = خانته في الصف الأحدث */
      if (src && (has(src.df) || has(src.af) || has(src.uf)) && ordOf(src) === k) { if (N(src.df) === N(last['del' + k]) && N(src.af) === N(last['add' + k]) && N(src.uf) === N(last['up' + k])) slotOk++; else { slotDiff++; warn('مبالغ أمر عُدّلت في محضر لاحق (أُخذت القيمة الأحدث)', `${T(last.PRO)} — الأمر ${k}: في محضره ${N(src.df)}/${N(src.af)}/${N(src.uf)} ← الأحدث ${N(last['del' + k])}/${N(last['add' + k])}/${N(last['up' + k])} (حذف/إضافة/استحداث)`); } }
      /* خانة الأمر فارغة في الصف الأحدث وفيها مبالغ في صف آخر: تؤخذ من آخر صف فيه مبالغ لهذا الأمر (ويُذكر في التقرير) */
      let SL = last; if (!N(last['del' + k]) && !N(last['add' + k]) && !N(last['up' + k])) { const alt = base.slice().reverse().find(r => N(r.o['del' + k]) || N(r.o['add' + k]) || N(r.o['up' + k])); if (alt) { SL = alt.o; warn('مبالغ أمر غير موجودة في المحضر الأحدث فأُخذت من محضر سابق (راجعها)', `${T(last.PRO)} — الأمر ${k}: من الصف ${N(alt.o.ID)} (${N(alt.o['del' + k])}/${N(alt.o['add' + k])}/${N(alt.o['up' + k])})`); } }
      orders.push({ annexNo: '', annexDate: '', date: src ? iso(src.LJND) : '', del: N(SL['del' + k]), add: N(SL['add' + k]), nw: N(SL['up' + k]),
        extraDays: useDur ? N(last['dur' + k]) : (src ? N(src.addduration) : 0),
        reason: src ? [TL(src.othertext), TL(src.st1), TL(src.cancel), TL(src.ash)].filter(Boolean).join('\n') : '',
        reNo: src ? z(src.engbokno) : '', reDate: src ? iso(src.engbokdate) : '', decNo: '', decDate: '', link: '', formNo: src && N(src.ID) > 0 ? String(N(src.ID)) : '', benNo: '', benDate: '',
        isFix: fix, fixNo: '', fixDate: '', fixReason: fix ? T(src.chorderno).replace(/[()]/g, '').trim() : '',
        legacy: src ? { id: N(src.ID), entered: iso(src.todydate), title: T(src.chorderno) } : { id: null, note: 'لا يوجد محضر لهذا الأمر في الجدول القديم (مبالغه من خانات المحضر الأحدث)' } });
    }
    const dec = numDate(lastOf(G.map(r => T(r.o.D))));
    const ben = T(last.be).split(/\s*\/\s*/)[0].replace(/\.+.*$/, '').trim(), fol = (T(last.MON).match(/لجنة متابعة\s+(?:مشاريع\s+)?(?:قضاء\s+)?(.+?)\s*(?:\/|$)/) || [])[1] || '';
    const committee = [['رئيس اللجنة', last.enghead]].concat([1, 2, 3, 4, 5, 6, 7, 8].map(i => ['عضواً', last['eng' + i]])).map(x => ({ role: x[0], name: T(x[1]) })).filter(x => x.name.length > 4);
    const lastDate = lastOf(orders.map(o => o.date)) || iso(last.todydate), year = +lastDate.slice(0, 4) || 0;
    const value = N(last.contcost), after = value + orders.reduce((s, o) => s + o.add + o.nw - o.del, 0);
    if (has(last.totalcostf) && N(last.totalcostf)) { if (Math.abs(after - N(last.totalcostf)) < 2) totOk++; else { totBad++; warn('مبلغ العقد بعد الأوامر ≠ «الكلفة الكلية» المحفوظة في الجدول القديم', `${T(last.PRO)}: ${after.toLocaleString('en-US')} ≠ ${N(last.totalcostf).toLocaleString('en-US')}`); } }
    { const cs = [...new Set(G.map(r => r.cost).filter(c => c >= 1e6))]; if (cs.length > 1) warn('مبلغ العقد مكتوب بأكثر من قيمة في المحاضر القديمة (أُخذ الأحدث — تأكد منه)', `${T(last.PRO)}: ${cs.map(c => c.toLocaleString('en-US')).join(' / ')} ← ${value.toLocaleString('en-US')}`); }
    if (value < 1e6) warn('مبلغ العقد في الجدول القديم غير معقول (يحتاج تصحيحاً يدوياً)', `${T(last.PRO)}: ${value}`);
    const names = [...new Set(named.map(r => r.name))];
    if (names.length > 1) warn('اسم المشروع مكتوب بأكثر من صيغة (جُمعت أوامره في ملف واحد)', names.join(' | '));
    const rec = { id: 'old' + G[0].id, v: 2, status: 'done', updated: Date.parse(lastDate || '2020-01-01') || 0, ctype: /تجهيز|تجهبز/.test(T(last.PRO)) ? 'supply' : 'works',
      regime: year && year < 2025 ? '2014' : '2025', docNo: z(last.LJN), docDate: iso(last.LJND),
      project: { fileNo: '', name: mode(named.map(r => r.name)), contractNo: '', contractDate: '', contractor: mode(G.map(r => T(r.o.COM))), value, duration: N(last.dur), startDate: '', location: '', beneficiary: ben, supervisor: '',
        fund: mode(G.map(r => T(r.o.sv))), supervision: 0, approved: N(last.cerftamont) > 0 ? N(last.cerftamont) : 0, followDist: fol, prevDays: 0 },
      followText: TL(last.M).replace(/^0$/, ''), decision: { orderNo: dec.no, orderDate: dec.date, meetDate: '' }, orders, printOrder: orders.length - 1,
      legacy: { source: 'برنامج أوامر التغيير القديم (Table1)', ids: G.map(r => r.id), names, committeeOrder: T(last.D), totalAfter: N(last.totalcostf), notes: [TL(last.de), TL(last.MON)].filter(Boolean) } };
    if (committee.length) rec.committee = committee;
    records.push(rec);
  }
  records.sort((a, b) => b.updated - a.updated);
  const inRec = records.reduce((s, r) => s + r.legacy.ids.length, 0);
  const data = { app: 'anbar-change-orders', version: 2, saved: new Date().toISOString(), source: 'old-access-v2', records };
  const S = { rows: rows.length, lastId: rows.reduce((m, o) => Math.max(m, N(o.ID)), 0), records: records.length, orders: records.reduce((s, r) => s + r.orders.length, 0), rowsInRecords: inRec, testRowsSkipped: test.length, namelessUnmatched: nameless, accounted: inRec + test.length + nameless,
    orderSlotsMatchTheirRow: slotOk, orderSlotsChangedLater: slotDiff, totalsMatch: totOk, totalsDiffer: totBad, corrections: fixes, multiNameProjects: records.filter(r => r.legacy.names.length > 1).length,
    withFollowText: records.filter(r => r.followText).length };
  const report = ['تقرير تدقيق تحويل بيانات أوامر التغيير القديمة', JSON.stringify(S, null, 1),
    ...Object.entries(rep.reduce((m, [k, s]) => ((m[k] = m[k] || []).push(s), m), {})).flatMap(([k, L]) => ['', `== ${k} (${L.length}) ==`, ...L])].join('\n');
  return { data, stats: S, report };
}
module.exports = { convertCO };
