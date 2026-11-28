// «موقف الخطة التشغيلية»: ملء نواقص ملف التخطيط من الموقف العام وشهادات الاستلام ونظام المدد، النسب والحالة دائماً، الفروقات تُسجَّل ولا تُستبدل،
// ومشاريع المنافذ وإعادة الاستقرار من الموقف غير الموجودة في الملف تُضاف صفوفاً — دون تكرار.
// الاستعمال: UNI_TEST_OPPLAN_FILE=<ملف خطة المحافظة> xvfb-run -a node test-opplan.js   (ملف حقيقي — لا يُرفع للمستودع)
const { _electron: electron } = require('playwright'); const fs = require('fs'), path = require('path'), os = require('os'); const { execFileSync } = require('child_process');
const F = process.env.UNI_TEST_OPPLAN_FILE; if (!F || !fs.existsSync(F)) { console.log('SKIP: UNI_TEST_OPPLAN_FILE not set'); process.exit(0); }
const sleep = ms => new Promise(r => setTimeout(r, ms)); const R = []; const ok = (n, c, d = '') => R.push([c ? 'PASS' : 'FAIL', n, d]);
(async () => { const T = fs.mkdtempSync(path.join(os.tmpdir(), 'opp-')); const mk = n => { const d = path.join(T, n); fs.mkdirSync(d); return d; };
  const P = require('./planning'); const m = P.parse(fs.readFileSync(F), path.basename(F)); const s2 = Object.keys(m.sheets).find(n => m.sheets[n].kind === 's2');
  const A = m.comps.find(c => c.sheet === s2 && c.company && c.contractNo && c.name.length > 15 && !c.ext);          // برقم عقد وبلا مدة إضافية
  const B = m.comps.find(c => c.sheet === s2 && c.company && !c.contractNo && c.name.length > 15 && c !== A);          // بلا رقم عقد
  const C = m.comps.find(c => c.kind === 'main' && c.company && c.contractNo && !c.start && !c.resident && c.name.length > 15);   // يُملأ من شهادة الاستلام
  const SD = mk('save'), DD = mk('d'), RG = mk('r'); fs.writeFileSync(path.join(DD, 'auth.json'), JSON.stringify({ pl: null }));
  const proj = [
    { fileNo: '7001', name: A.name, contractor: A.company, contractNo: A.contractNo, status: 'متوقف', planPct: 70, actualPct: 52, fund: 'منافذ حدودية', district: 'الرمادي' },
    { fileNo: '7002', name: B.name, contractor: B.company, contractNo: '', status: 'مستمر', planPct: 60, actualPct: 41, fund: 'اعادة استقرار', resident: 'سعد خلف عواد' },
    { fileNo: '7003', name: C.name, contractor: C.company, contractNo: C.contractNo, status: 'مستمر', planPct: 100, actualPct: 97, fund: 'تنمية أقاليم' },
    { fileNo: '7004', name: 'مشروع منافذ حدودية من الموقف فقط (اختبار)', contractor: 'شركة اختبار المنافذ', contractNo: '8801', status: 'مستمر', planPct: 30, actualPct: 25, fund: 'منافذ حدودية', district: 'القائم', orig: 750000000 }];
  fs.writeFileSync(path.join(RG, 'registry.json'), JSON.stringify({ app: 'anbar-projects-shared', version: 1, projects: proj, links: { '7001': { du: { status: 'stop', ext: 45, stp: 30, curEnd: '2027-02-01', last: 'توقف' } } }, meta: {} }));
  fs.writeFileSync(path.join(DD, 'Acceptance-Records.json'), JSON.stringify({ pac: JSON.stringify({ 'ا/2026/9': { serial: 'ا/2026/9', fileNo: '7003', pName: C.name, cNo: C.contractNo, contractor: C.company, resEng: 'م. ليث حامد سالم', d2: '2025-02-10', d4: '2026-09-30', d5: '2026-10-20', outNo: '450', outDate: '2026-10-25' } }) }));
  const app = await electron.launch({ executablePath: require('electron'), args: ['--no-sandbox', __dirname], env: { ...process.env, UNI_MULTI: mk('u'), UNI_DATA_DIR: DD, ANBAR_REG_DIR: RG, UNI_AC_PORT: '48595', UNI_NO_JSONSCAN: '1', UNI_NO_LINKREFRESH: '1', UNI_NO_INTRO: '1', UNI_TEST_PLAN_FILE: F, UNI_TEST_SAVE_DIR: SD } });
  const pg = await app.firstWindow(); await sleep(1500); await pg.evaluate(() => window.desktop.go('pl')); await sleep(800);
  const imp = await pg.evaluate(() => window.desktop.plan.import()); ok('plan file imported', imp && !imp.error, JSON.stringify(imp).slice(0, 150));
  await pg.evaluate(() => window.PlanLink.load()); await sleep(800);
  const d = await pg.evaluate(async () => { const ac = await window.desktop.acRecs(); const x = window.PlanLink.opData(ac); return { n: x.updates.length, fns: x.updates.map(u => u.fn).sort(), app: x.appends.map(a => a.fn), acN: x.acN, acL: x.acLinked, c: x.updates.find(u => u.fn === '7003'), a: x.updates.find(u => u.fn === '7001') }; });
  ok('the three situation projects are matched to their rows (no duplicates), the situation-only border project is appended', JSON.stringify(d.fns) === '["7001","7002","7003"]' && JSON.stringify(d.app) === '["7004"]', JSON.stringify(d).slice(0, 300));
  ok('acceptance certificate is used for the main-sheet row (start, completion, resident; status «منجز» from the initial acceptance)', d.c && d.c.set.start === '2025-02-10' && d.c.set.end === '2026-09-30' && d.c.set.resident === 'ليث حامد سالم' && d.c.set.status === 'منجز' && /الاستلام الأولي/.test(d.c.src.status), JSON.stringify(d.c && { set: d.c.set, src: d.c.src }).slice(0, 400));
  ok('durations system supplies the approved extension days', d.a && d.a.set.ext === 45 && d.a.src.ext === 'المدد والتوقف', JSON.stringify(d.a && d.a.set));
  await pg.evaluate(() => { const b = document.querySelector('[data-plsec="s2"]'); b.click(); }); await sleep(800);
  const sv = await pg.evaluate(() => { const rows = [...document.querySelectorAll('#plTree tbody tr')].map(tr => tr.textContent.replace(/\s+/g, ' ')); return { n: rows.length, sit: rows.filter(t => /الموقف فقط/.test(t)).length, both: rows.filter(t => /ملف \+ موقف/.test(t)).length, has7004: rows.filter(t => /اضبارة 7004/.test(t)).length, kpi: (document.querySelector('#plTree .kpis') || {}).textContent }; });
  ok('section «المنافذ وإعادة الاستقرار»: file rows + situation projects, each once (7001/7002 linked, 7004 «الموقف فقط»)', sv.sit === 1 && sv.has7004 === 1 && sv.both === 2 && sv.n > 100, JSON.stringify(sv).slice(0, 300));
  const r = await pg.evaluate(async () => { const ac = await window.desktop.acRecs(); const x = window.PlanLink.opData(ac); return window.desktop.plan.export(x.updates, { op: 'op', appends: x.appends, dash: false }); });
  ok('file saved as «موقف الخطة التشغيلية-…xlsx»', r && r.ok && /موقف الخطة التشغيلية-\d{4}-\d{2}-\d{2}\.xlsx$/.test(r.file) && fs.existsSync(r.file), JSON.stringify(r).slice(0, 200));
  const py = execFileSync('python3', ['-I', '-c', `
import openpyxl,json,sys
wb=openpyxl.load_workbook(sys.argv[1],read_only=True)
s2=[n for n in wb.sheetnames if 'منافذ' in n][0];ws=wb[s2];rows={}
for i,r in enumerate(ws.iter_rows(min_row=1,max_row=600,values_only=True),start=1): rows[i]=[str(v) if v is not None else '' for v in r]
d=[list(map(str,r)) for r in wb['فروقات للتدقيق'].iter_rows(values_only=True)]
ch=[n for n in wb.sheetnames if n.startswith('التغييرات')]
print(json.dumps({'sheets':wb.sheetnames,'A':rows.get(int(sys.argv[2])),'B':rows.get(int(sys.argv[3])),'new':[r for r in rows.values() if 'من الموقف فقط' in ' '.join(r)],'diffs':d[:6],'nd':len(d)-1,'ch':ch}, ensure_ascii=False))`, r.file, String(A.row), String(B.row)]).toString();
  const X = JSON.parse(py), col = k => m.sheets[s2].cols[k] - 1;
  ok('row A (has contract): actual % and status written always (52%, متوقف — «العمل متوقف» بصيغة الملف تبقى); extension 45 filled', X.A && Math.abs(+X.A[col('actPct')] - 0.52) < 1e-6 && /متوقف/.test(X.A[col('status')]) && +X.A[col('ext')] === 45, JSON.stringify(X.A && [X.A[col('actPct')], X.A[col('status')], X.A[col('ext')]]));
  ok('row B (no contract): situation resident filled where empty; existing values left', X.B && (B.resident ? X.B[col('resident')] === String(B.resident) : X.B[col('resident')] === 'سعد خلف عواد'), JSON.stringify(X.B && X.B[col('resident')]));
  ok('the situation-only border project appears once as a new row', X.new.length === 1 && X.new[0].includes('شركة اختبار المنافذ') && X.new[0].includes('8801'), JSON.stringify(X.new).slice(0, 200));
  ok('sheets «فروقات للتدقيق» and «التغييرات» are added; original sheets kept', X.sheets.includes('فروقات للتدقيق') && X.ch.length === 1 && X.sheets.includes(s2), JSON.stringify(X.sheets));
  ok('differences are listed with the program value and its source (not written)', X.nd >= 1 && X.diffs[0][4] !== undefined, JSON.stringify(X.diffs).slice(0, 300));
  const e = await app.evaluate(() => (global.__uniErrors || []).slice()); ok('no JavaScript errors', e.length === 0, e.join(' | ').slice(0, 300));
  await app.close(); R.forEach(x => console.log(x[0], x[1], x[2] ? '— ' + String(x[2]).slice(0, 400) : '')); console.log(`${R.filter(x => x[0] === 'PASS').length}/${R.length}`); process.exit(R.every(x => x[0] === 'PASS') ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
