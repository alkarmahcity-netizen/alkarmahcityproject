'use strict';
// تحويل جدول السلف القديم (tblProjects) إلى ملفات البرنامج — الإصدار 3. تستعمله أداة سطر الأوامر (advances/tools/import_old_access.js)
// واستيراد ملف Access المباشر في البرنامج الموحد؛ القواعد نفسها في الحالتين. التفاصيل في رأس أداة سطر الأوامر.
// المدخل: صفوف {اسم العمود: النص}، كما يقرؤها readRows من Excel أو accessread.js من ملف Access.
const path = require('path'), fs = require('fs');
const C = require(fs.existsSync(path.join(__dirname, 'old-access-common.js')) ? path.join(__dirname, 'old-access-common.js') : path.join(__dirname, '..', 'shared', 'old-access-common.js'));
/* تصدير الجدول بعناوين عربية (تسميات الحقول في Access، كما في tblProjects_3.xlsx): تُردّ إلى أسماء الحقول الأصلية */
const CAPTIONS = { 'الرقم التسلسلي': 'ID', 'اسم المشروع': 'projectname', 'الشركة المنفذة': 'companyname', 'جهة التخصيص': 'inv', 'تاريخ المباشرة التعاقدي': 'contactualstartdate',
  'تاريخ المباشرة الفعلي': 'actualstartdate', 'كلفة المشروع التعاقدي': 'projectcost', 'كلفة المشروع بعد اوامر التغير': 'finalprojectcost', 'مدة المشروع التعاقدية': 'projectduration',
  'المدد الاضافية الممنوحة': 'Additionaldurations', 'تاريخ الانجاز بعد منح المدة': 'actualcompletiondate', 'التراكمي': 'Cumulative', 'السابقة': 'Previous', 'الصافي': 'net2',
  'رقم السلفة': 'Advancenumber', 'نسبة الانجاز': 'Completionratio', 'المهندس المقيم': 'ResidentEngineer', 'المهندس المشرف': 'Supervising engineer1', 'رقم العقد': 'ContractNumbre',
  'لسنة': 'ContractSubYear', 'بتاريخ': 'ContractDate', 'ملحق العقد رقم': 'ContractSupNumber', 'حسب الامر الاداري المرقم': 'booknumber3', 'التوصيات': 'note', 'المهندس': 'eng5',
  'توصيات جاهزه': 'note1', 'المدد التأخيرية': 'Ld', 'فترة التوقف من': 'StopDate', 'الى': 'DirectDate', 'في': 'bookdate', 'تاريح الانجاز التعاقدي': 'contactlualenddate',
  'تاريخ الانجاز التعاقدي': 'contactlualenddate', 'المدة الكلية للانجاز المشروع': 'Ed', 'تاريخ بداية حساب المدة': 'st', 'تاريخ الترويج': 'Daydate', 'مدة التوقف': 'stopduration',
  'مدة الانجاز': 'Completionduration', 'فترة التوقف الثانية من': 'stopdate1', 'نسبة الانجاز الفعلي': 'ratioac', 'التوقف الاول': 'S1', 'التوقف الثاني': 'S2', 'التوقف الثالث': 'S3',
  'فترة التوقف الثالثة من': 'stopdate3', 'المدة الكلية للمشروع': 'Td', 'صافي المدة': 'Nd', 'رقم الاستمارة': 'Engineer' };
const canon = o => { const x = {}; for (const k of Object.keys(o)) { const t = String(k).trim(); x[CAPTIONS[t] || t] = o[k]; } return x; };
function convertAdvances(rows) {
  rows = rows.map(canon);
  const { T, TL, N, has, nk, iso, numDate, similar, DSU, mode, lastOf, RN } = C;
  const rep = [], warn = (k, s) => rep.push([k, s]);
  /* ---------- أرقام السلف: «الثالثة»، «ثالثه»، «الثالثة عشر»، «الثالثة والعشرون»، «21» → رقم؛ «النهائية»، «واقع حال» تبقى اسماً ---------- */
  const UN = ['اول', 'ثاني', 'ثالث', 'رابع', 'خامس', 'سادس', 'سابع', 'ثامن', 'تاسع', 'عاشر'], UNI = ['احد', 'ثاني', 'ثالث', 'رابع', 'خامس', 'سادس', 'سابع', 'ثامن', 'تاسع'];
  function ordNo(label) {
    const t = RN(label).replace(/[ةه]/g, '').replace(/ى/g, 'ي').replace(/^ال/, '').replace(/\s+و?ال/g, ' و').replace(/\s+/g, ' ').trim(); if (/^\d+$/.test(t)) return +t;
    if (/^عشرون|^عشرين/.test(t)) return 20; if (/^واحد وعشر/.test(t)) return 21;
    let m = t.match(/^(\S+)\s+و?عشر(?:ون|ين)$/); if (m) { const k = UNI.findIndex(x => m[1].startsWith(x)); if (k >= 0) return 21 + k; }
    m = t.match(/^(\S+)\s+و?عشر$/); if (m) { const k = [/^حادي|^احد/, ...UNI.slice(1).map(x => new RegExp('^' + x))].findIndex(re => re.test(m[1])); if (k >= 0) return 11 + k; }
    const k = UN.findIndex(x => t === x || t === x + 'ي' || (t.startsWith(x) && t.length <= x.length + 1)); return k >= 0 ? k + 1 : 0;
  }
  /* ---------- الصفوف ---------- */
  const realName = v => nk(v).replace(/[0-9]/g, '').length >= 6;   // «0» «=» «+» وأمثالها ليست اسماً
  /* فك رقم الاستمارة من عمود Engineer: حرف واحد رمزه هو الرقم، أو ترميز Excel _xNNNN_ للأرقام الصغيرة */
  /* رقم الاستمارة = ID («الرقم التسلسلي»): هو الحقل المعروض رقماً للاستمارة في نموذج Access القديم (frmProjects، مربع النص المرتبط بـ ID).
     (كان يُفك من عمود Engineer، وهو حقل مرفقات يتبع ID ثم ينقص عنه واحداً من 6738 — فكانت أرقام الاستمارات الأحدث أقل بواحد) */
  function serialOf(o) { const id = N(o.ID); return id > 0 ? String(id) : ''; }
  function engineerCode(o) { const e = o.Engineer == null ? '' : String(o.Engineer), m = /^_x([0-9a-fA-F]{4})_$/.exec(e); const n = m ? parseInt(m[1], 16) : ([...e].length === 1 ? e.codePointAt(0) : 0); return n > 0 && n < 200000 ? String(n) : ''; }
  const R = rows.map(o => ({ o, id: N(o.ID), name: realName(o.projectname) ? T(o.projectname) : '', k: realName(o.projectname) ? nk(o.projectname) : '', cno: T(o.ContractNumbre).replace(/\D/g, ''), cy: (T(o.ContractYear).match(/\d{4}/) || [''])[0],
    co: nk(o.companyname), cost: N(o.projectcost), cum: N(o.Cumulative) }));
  const MIN_CUM = 1000;   // أقل من ذلك = استمارة فارغة أو مسودة أو إدخال تجريبي
  const useful = r => r.cum >= MIN_CUM;
  const skipped = R.filter(r => !useful(r)); skipped.forEach(r => warn('استمارة فارغة أو مسودة (لم تُنقل)', `ID ${r.id} — استمارة ${serialOf(r.o) || '—'}: ${r.name || '(بلا اسم)'} — التراكمي ${r.cum.toLocaleString('en-US')}`));
  const U = R.filter(useful), D = DSU(U.length);
  /* 1) الاسم نفسه + عقد متوافق (الرقم والسنة متساويان أو أحدهما فارغ) */
  const byName = new Map(); U.forEach((r, i) => { if (r.k.length >= 6) { if (!byName.has(r.k)) byName.set(r.k, []); byName.get(r.k).push(i); } });
  const cOK = (a, b) => (!a.cno || !b.cno || a.cno === b.cno) && (!a.cy || !b.cy || a.cy === b.cy);
  for (const L of byName.values()) for (let x = 0; x < L.length; x++) for (let y = x + 1; y < L.length; y++) { const a = U[L[x]], b = U[L[y]]; if (cOK(a, b) && (!(a.cno && b.cno) || a.cno === b.cno)) D.union(L[x], L[y]); }
  /* 2) رقم العقد وسنته نفسها + (اسم مشابه، أو الكلفة نفسها، أو أحدهما بلا اسم مع الشركة أو الكلفة نفسها) */
  const noCY = !rows.some(o => o.ContractYear != null && o.ContractYear !== '');   // سنة العقد غير مصدّرة (تصدير بعناوين عربية): يُستعمل رقم العقد مع الشركة
  const byC = new Map(); U.forEach((r, i) => { const cy2 = r.cy || (noCY && r.co ? 'co:' + r.co : ''); if (r.cno && cy2) { const k = r.cno + '/' + cy2; if (!byC.has(k)) byC.set(k, []); byC.get(k).push(i); } });
  for (const L of byC.values()) for (let x = 0; x < L.length; x++) for (let y = x + 1; y < L.length; y++) {
    const a = U[L[x]], b = U[L[y]], sameCost = a.cost > 0 && a.cost === b.cost, sameCo = a.co && a.co === b.co;
    if ((a.k && b.k && similar(a.k, b.k)) || (sameCost && sameCo && (!a.k || !b.k || similar(a.k, b.k, 0.45))) || ((!a.k || !b.k) && (sameCo || sameCost))) D.union(L[x], L[y]);
  }
  const groups = new Map(); U.forEach((r, i) => { const g = D.find(i); if (!groups.has(g)) groups.set(g, []); groups.get(g).push(r); });
  /* ---------- السجلات ---------- */
  /* أعضاء اللجنة في الجدول القديم بترتيب الاستمارة (الأول مدخل البيانات كما في الاستمارة الحالية) */
  const COMM = [['Engineer1', 'مدخل البيانات'], ['Engineer2', 'عضواً'], ['Engineer3', 'عضواً'], ['eng5', 'عضواً'], ['ممثل شعبة المتابعة', 'ممثل شعبة المتابعة']];
  const recId = rs => 'oldadv3-' + Math.min(...rs.map(r => r.id));
  const records = []; let dupDrop = 0, chainOk = 0, chainBad = 0, finOk = 0, finBad = 0, nameless = 0;
  const recText = (note1, note) => { const n0 = TL(note); if (/^توصي/.test(RN(n0))) return n0; const t = TL(note1); if (!t) return ''; return /^توصي/.test(RN(t)) ? t : 'توصي اللجنة بترويج السلفة وحسب ' + t; };
  const basisOf = rec => { const m = T(rec).match(/وحسب\s+(?:ما\s+جاء\s+في\s+)?(دفتر[^.\n]*|ذرعة[^.\n]*|عقد[^.\n]*)/); return m ? m[1].replace(/[.،,\s]+$/, '').trim() : ''; };
  for (const G0 of groups.values()) {
    const named = G0.filter(r => r.name); if (!named.length) { nameless += G0.length; G0.forEach(r => warn('سلفة بلا اسم مشروع ولا مشروع مطابق (لم تُنقل)', `ID ${r.id}: عقد ${r.cno || '—'}/${r.cy || '—'} — التراكمي ${r.cum.toLocaleString('en-US')}`)); continue; }
    /* السلفة نفسها مُدخلة مرتين (التراكمي والسابق والرقم نفسها): يبقى آخر إدخال */
    const seen = new Map(); G0.slice().sort((a, b) => a.id - b.id).forEach(r => { const k = [r.cum, N(r.o.Previous), nk(r.o.Advancenumber)].join('|'); if (seen.has(k)) dupDrop++; seen.set(k, r); });
    /* الترتيب بالتراكمي: قيس على السلسلة (السابقة = تراكمي ما قبلها) فكان الأكثر اتساقاً: 4807 من 6558 مقابل 4713 بالتاريخ و4757 برقم السلفة */
    const G = [...seen.values()].sort((a, b) => a.cum - b.cum || (ordNo(a.o.Advancenumber) || 99) - (ordNo(b.o.Advancenumber) || 99) || a.id - b.id);
    const v = f => G.map(r => T(r.o[f])), last = G[G.length - 1].o;
    const name = mode(named.map(r => r.name)) || named[named.length - 1].name;
    /* التوقفات والملاحق من كل الصفوف */
    const stops = [];
    for (const [a, b, c, d] of [['StopDate', 'DirectDate', 'booknumber', 'bookdate'], ['stopdate1', 'DirectDate1', 'booknumber1', 'bookdate1'], ['stopdate3', 'DirectDate3', 'booknumber3', 'bookdate3']])
      G.forEach(r => { const st = { from: iso(r.o[a]), to: iso(r.o[b]), no: T(r.o[c]), date: iso(r.o[d]) }; if ((st.from || st.to || st.no) && !stops.some(x => x.from === st.from && x.to === st.to && x.no === st.no)) stops.push(st); });
    const annexes = []; G.forEach(r => { const a = { no: T(r.o.ContractSupNumber), year: T(r.o.ContractSubYear), date: iso(r.o.ContractSubDate), subject: '' }; if ((a.no || a.date) && !annexes.some(x => x.no === a.no && x.year === a.year && x.date === a.date)) annexes.push(a); });
    const recom = lastOf(v('recom')), ordm = recom ? numDate(recom) : { no: '', date: '' };
    const advances = G.map(r => { const o = r.o, lb = T(o.Advancenumber), n = ordNo(lb), rec = recText(o.note1, o.note), extra = /^توصي/.test(RN(TL(o.note))) ? '' : TL(o.note);
      return { id: 'a3-' + r.id, serial: serialOf(o) || String(r.id), date: iso(o.Daydate), cumulative: r.cum, previous: has(o.Previous) ? N(o.Previous) : '', plan: has(o['نسبة الانجاز المخطط']) ? String(N(o['نسبة الانجاز المخطط'])) : '', actual: has(o.ratioac) ? String(N(o.ratioac)) : '',
        /* الملاحظات (خصم، مدة تأخيرية، كتاب لاحق) تُطبع سطراً بعد التوصية كما في الاستمارة القديمة — البرنامج لا يطبع حقل الملاحظات وحده */
        rec: [rec, extra].filter(Boolean).join('\n'), basis: basisOf(rec), note: [extra, has(o.case) ? 'الحالة: ' + T(o.case).replace(/[()]/g, '').trim() : ''].filter(Boolean).join('\n'), driveUrl: '', label: lb, no: n ? String(n) : (lb || '—'), ded: 0, dedNote: '',
        legacy: { id: r.id, form: serialOf(o), eng: engineerCode(o), net: N(o.net2), finPct: has(o.Completionratio) ? N(o.Completionratio) : null, order: T(o.recom), committee: COMM.map(([f]) => T(o[f])).filter(x => x.length > 4) } }; });
    /* تحقق السلسلة: السابقة = تراكمي سلفة قبلها في الملف نفسه (أو صفر للأولى) */
    advances.forEach((a, i) => { if (a.previous === '' ) return; const ok = a.previous === 0 || advances.slice(0, i).some(b => Math.abs(b.cumulative - a.previous) < 2); if (ok) chainOk++; else chainBad++; });
    const lr = G[G.length - 1].o, comm = [];
    COMM.forEach(([f, role]) => { const nm = T(lr[f]); if (nm.length > 4 && !comm.some(x => x.name === nm)) comm.push({ role, name: nm, hon: 'المهندس' }); });
    if (comm.length) comm.push({ role: 'رئيس اللجنة', name: '', hon: 'المهندس' });   // رئيس اللجنة غير محفوظ في الجدول القديم: سطر توقيع فارغ
    const cost = N(lastOf(v('projectcost'))), costAfter = N(lastOf(v('finalprojectcost')));
    const rec = { id: recId(G), v: 1, status: 'done', updated: Date.parse(lastOf(advances.map(a => a.date)) || '2018-01-01') || 0,
      project: { fileNo: '', name, contractor: mode(v('companyname')), fund: mode(v('inv')), contractNo: mode(G.map(r => r.cno)), contractYear: mode(G.map(r => r.cy)),
        startContract: iso(lastOf(v('contactualstartdate'))), startActual: iso(lastOf(v('actualstartdate'))), finishActual: iso(lastOf(v('actualcompletiondate'))),
        duration: N(lastOf(v('projectduration'))) ? String(N(lastOf(v('projectduration')))) : '', extraDays: N(lastOf(v('Additionaldurations'))), delayDays: 0, cost, costAfter,
        resident: lastOf(v('ResidentEngineer')), supervisor: [lastOf(v('Supervisingengineer')), lastOf(v('Supervising engineer1'))].filter(Boolean).join('، '),
        annexNo: '', annexYear: '', annexDate: '', annexes, prevAdv: 0, stops },
      order: { no: ordm.no, date: ordm.date }, advances, printIdx: advances.length - 1,
      legacy: { source: 'أرشيف لجنة تدقيق السلف القديم (tblProjects)', ids: G.map(r => r.id), names: [...new Set(named.map(r => r.name))] } };
    if (comm.length) rec.committee = comm;
    /* تحقق نسبة الإنجاز المالي: التراكمي ÷ الكلفة بعد الأوامر = النسبة المحفوظة في الجدول القديم (Completionratio) */
    advances.forEach(a => { if (a.legacy.finPct == null || !(costAfter || cost)) return; const p = a.cumulative / (costAfter || cost) * 100; if (Math.abs(p - a.legacy.finPct) <= 1.01 || Math.abs(Math.floor(p) - a.legacy.finPct) <= 1) finOk++; else finBad++; });
    { const m = {}; advances.forEach(a => { if (/^\d+$/.test(a.no)) (m[a.no] = m[a.no] || []).push(a); }); Object.entries(m).forEach(([n, L]) => { if (new Set(L.map(a => a.cumulative)).size > 1) warn('رقم السلفة نفسه بمبلغين مختلفين في الجدول القديم (يحتاج مراجعة)', `${name} [عقد ${rec.project.contractNo}/${rec.project.contractYear}] — السلفة ${n}: ${L.map(a => a.cumulative.toLocaleString('en-US') + ' (ID ' + a.legacy.id + ')').join(' و ')}`); }); }
    if (rec.legacy.names.length > 1) warn('اسم المشروع مكتوب بأكثر من صيغة (جُمعت سلفه في ملف واحد)', `${name} ← ${rec.legacy.names.filter(x => x !== name).join(' | ')}`);
    records.push(rec);
  }
  records.sort((a, b) => b.updated - a.updated);
  /* ---------- تحقق نهائي: كل صف قديم إما في ملف أو مذكور في التقرير ---------- */
  const inRec = new Set(records.flatMap(r => r.advances.map(a => a.legacy.id)));
  const netBad = records.flatMap(r => r.advances.filter(a => a.legacy.net && Math.abs(a.cumulative - (a.previous === '' ? 0 : a.previous) - a.legacy.net) >= 2).map(a => r.project.name + ' — ' + a.label));
  const lastId = rows.reduce((m, o) => Math.max(m, N(o.ID)), 0), lastForm = rows.reduce((m, o) => Math.max(m, +serialOf(o) || 0), 0);
  const data = { app: 'anbar-advances', version: 1, saved: new Date().toISOString(), source: 'old-access-v4', records };
  const S = { rows: rows.length, lastId, lastForm, records: records.length, advances: inRec.size, skippedEmptyOrDraft: skipped.length, namelessUnmatched: nameless, duplicatesRemoved: dupDrop,
    accounted: inRec.size + skipped.length + nameless + dupDrop, previousChainOk: chainOk, previousChainBreak: chainBad, finPctOk: finOk, finPctDiffer: finBad, netDiffer: netBad.length,
    multiNameProjects: records.filter(r => r.legacy.names.length > 1).length, finalAdvances: records.reduce((s, r) => s + r.advances.filter(a => /نهائي/.test(a.label)).length, 0),
    withRec: records.reduce((s, r) => s + r.advances.filter(a => a.rec).length, 0), withBasis: records.reduce((s, r) => s + r.advances.filter(a => a.basis).length, 0) };
  const report = ['تقرير تدقيق تحويل أرشيف لجنة تدقيق السلف القديم', JSON.stringify(S, null, 1), ...netBad.map(x => 'الصافي ≠ التراكمي − السابقة: ' + x),
    ...Object.entries(rep.reduce((m, [k, s]) => ((m[k] = m[k] || []).push(s), m), {})).flatMap(([k, L]) => ['', `== ${k} (${L.length}) ==`, ...L])].join('\n');
  return { data, stats: S, report };
}
module.exports = { convertAdvances };
