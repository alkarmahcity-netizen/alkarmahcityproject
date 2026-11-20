// اختبار «مشاريع التخطيط» مع ملف التخصيصات (ورقة Projects) و«حيّ مع الموقف العام»:
//  • الاستيراد يختار ورقة Projects (لا AnnualAllocation ولا أوراق السنوات السابقة) ويقرأ حقولها.
//  • المكوّن المرتبط باضبارة في الموقف العام تُعرض قيمه من الموقف (الفعلي، المخطط، الحالة، المبالغ) بعلامة «↻ من الموقف».
//  • عند تحديث الموقف العام تتحدث الصفحة تلقائياً دون إعادة استيراد.
// الاستعمال: UNI_TEST_ALLOC_FILE=<ملف التخصيصات> xvfb-run -a node test-planalloc.js
const { _electron: electron } = require('playwright');
const fs = require('fs'), path = require('path'), os = require('os');
const F = process.env.UNI_TEST_ALLOC_FILE; if (!F || !fs.existsSync(F)) { console.log('SKIP: UNI_TEST_ALLOC_FILE not set'); process.exit(0); }
const T = path.join(os.tmpdir(), 'uni-planalloc'); fs.rmSync(T, { recursive: true, force: true });
const mk = n => { const d = path.join(T, n); fs.mkdirSync(d, { recursive: true }); return d; }; const sleep = ms => new Promise(r => setTimeout(r, ms));
const R = []; const ok = (n, c, d = '') => R.push([c ? 'PASS' : 'FAIL', n, d]);
(async () => {
  const P = require('./planning.js'), m = P.parse(fs.readFileSync(F), 'x');
  ok('parser picks the «Projects» sheet (not AnnualAllocation / old-year sheets) with its planning projects and components', Object.keys(m.sheets).includes('Projects') && m.projects.length > 100 && m.comps.length > 1000, Object.keys(m.sheets).join(',') + ' ' + m.projects.length + '/' + m.comps.length);
  const c0 = m.comps.find(c => c.contractNo && c.company && /\S{3,}/.test(c.name) && c.actPct != null && c.actPct < 90 && c.approved > 0);
  ok('«الكلفة المصادقة» is read as its own field (approved), separate from the estimated cost', m.comps.filter(c => c.approved > 0).length > 500 && Object.values(m.sheets)[0].head.approved === 'الكلفة المصادقة', String(m.comps.filter(c => c.approved > 0).length));
  const RG = mk('r'); fs.writeFileSync(path.join(RG, 'registry.json'), JSON.stringify({ projects: [
    { fileNo: '9001', name: c0.name, contractor: c0.company, contractNo: c0.contractNo, actualPct: 77, planPct: 81, status: 'متلكئ', orig: 1000000, total: 1250000, changeCost: 250000, dur: 365 },
    { fileNo: '9002', name: 'مشروع غير موجود في التخطيط إطلاقاً', contractor: 'شركة س', contractNo: '999999' }], source: 'test', updated: '2026-11-19' }));
  const DD = mk('d'); fs.writeFileSync(path.join(DD, 'auth.json'), JSON.stringify({ co: null }));   // قفل أوامر التغيير مُعطّل في مجلد بيانات الاختبار المؤقت فقط
  const app = await electron.launch({ executablePath: require('electron'), args: ['--no-sandbox', __dirname], env: { ...process.env, UNI_MULTI: mk('u'), UNI_DATA_DIR: DD, ANBAR_REG_DIR: RG, UNI_AC_PORT: '48441', UNI_NO_JSONSCAN: '1', UNI_NO_LINKREFRESH: '1', UNI_TEST_PLAN_FILE: F } });
  const pg = await app.firstWindow(); await pg.waitForLoadState('domcontentloaded'); await sleep(1500);
  await pg.evaluate(() => window.desktop.go('pl')); await sleep(800);
  const imp = await pg.evaluate(() => window.desktop.plan.import());
  ok('importing the allocations file into «مشاريع التخطيط» works', imp && imp.ok && imp.comps === m.comps.length, JSON.stringify(imp));
  await pg.evaluate(() => window.PlanLink.load().then(() => window.PlanLink.render())); await sleep(800);
  const v1 = await pg.evaluate(k => { const c = window.PlanLink.view().comps.find(x => x.key === k); return c && { a: c.actPct, p: c.planPct, st: c.status, ca: c.contractAfter, live: c._live, fn: c._fn }; }, c0.key);
  ok('the linked component shows the GENERAL STATUS values (actual 77, planned 81, status متلكئ, amount after change 1,250,000) marked as live', v1 && v1.a === 77 && v1.p === 81 && v1.st === 'متلكئ' && v1.ca === 1250000 && v1.fn === '9001' && v1.live.includes('actPct'), JSON.stringify(v1) + ' file actPct=' + c0.actPct);
  const st = await pg.evaluate(() => document.getElementById('plState').textContent);
  ok('the page says the linked components follow the general status', /مرتبطاً بالموقف العام/.test(st), st);
  await pg.evaluate(() => { const c = document.getElementById('plOurs'); c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); c.dispatchEvent(new Event('input', { bubbles: true })); }); await sleep(600);
  const t1 = await pg.evaluate(() => document.getElementById('plTree').textContent);
  ok('in the tree the component carries «↻ من الموقف» and 77%', /↻ من الموقف/.test(t1) && /77%/.test(t1), t1.slice(0, 300));
  // تحديث الموقف العام: الفعلي 77 ← 88 — تتحدث الصفحة تلقائياً
  await pg.evaluate(() => { const p = window.AnbarReg.state().projects.find(x => String(x.fileNo) === '9001'); p.actualPct = 88; });
  await sleep(9000);
  const t2 = await pg.evaluate(() => document.getElementById('plTree').textContent);
  ok('after the general status changes (77 → 88) the planning page updates by itself, without re-importing', /88%/.test(t2) && !/77%/.test(t2), t2.slice(0, 300));
  await pg.evaluate(() => { window.desktop.go('sit'); }); await sleep(1000); await pg.evaluate(() => window.SitOpen('9001')); await sleep(500);
  const dt = await pg.evaluate(() => document.getElementById('drawer').textContent.replace(/\s+/g, ' '));
  const apTxt = Math.round(c0.approved).toLocaleString('en-US');
  ok('general status → project info shows «الكلفة المصادقة» from the planning file', dt.includes('الكلفة المصادقة' + apTxt) && /من ملف التخطيط/.test(dt), dt.slice(dt.indexOf('الكلفة والمدة'), dt.indexOf('الكلفة والمدة') + 250) + ' expected ' + apTxt);
  await pg.evaluate(() => window.desktop.go('pl')); await sleep(600);
  const ex = await pg.evaluate(() => window.PlanLink.updates().find(u => u.fn === '9001'));
  ok('«⬇ تصدير ملف التخطيط المحدَّث» uses the same live values (actual 88)', ex && ex.set.actPct === 88, JSON.stringify(ex && ex.set));
  // الكلفة المصادقة في صفحة التخطيط (عمود ومؤشر) وفي أوامر التغيير
  await pg.evaluate(() => { const c = document.getElementById('plOurs'); c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); }); await sleep(400);
  const th = await pg.evaluate(() => [...document.querySelectorAll('#plTree th')].map(x => x.textContent));
  const kp = await pg.evaluate(() => document.getElementById('plKpis').textContent);
  const tr = await pg.evaluate(() => document.getElementById('plTree').textContent);
  ok('planning page: «الكلفة المصادقة» column with the component value (or 🔒 while amounts are hidden), and a KPI total', th.includes('الكلفة المصادقة') && (tr.includes(apTxt) || /🔒/.test(tr)) && /الكلفة المصادقة/.test(kp), th.join('|') + ' ' + kp.slice(0, 200));
  await sleep(8500);
  await pg.evaluate(() => window.desktop.go('co')); await sleep(2500);
  const co = c => app.evaluate(async (_, c) => global.__uni.views.co.webContents.executeJavaScript(c), c);
  await co(`(()=>{window.confirm=()=>true;document.querySelector('[data-act=new]').click();return 1})()`); await sleep(1200);
  await co(`(()=>{const r=R();r.project.fileNo='9001';r.project.approved=1000;touch();renderForm();return 1})()`); await sleep(500);
  const h1 = await co(`(document.getElementById('apHint')||{}).textContent||''`);
  ok('change orders: next to «المبلغ المصادق عليه» the planning approved cost is shown with the difference', h1.includes(apTxt) && /ملف التخطيط/.test(h1) && /تختلف/.test(h1), h1);
  await co(`(()=>{document.querySelector('#apHint [data-act=apUse]').click();return 1})()`); await sleep(500);
  ok('«اعتمادها» puts it in the field and it shows as matching', (await co(`R().project.approved`)) === Math.round(c0.approved) || (await co(`R().project.approved`)) === c0.approved, String(await co(`R().project.approved`)));
  ok('…and shows ✓ مطابقة', /مطابقة/.test(await co(`(document.getElementById('apHint')||{}).textContent||''`)));
  const e = await app.evaluate(() => (global.__uniErrors || []).slice()); ok('no JavaScript errors', e.length === 0, e.join(' | ').slice(0, 400));
  await app.close();
  R.forEach(x => console.log(x[0], x[1], x[2] ? '— ' + String(x[2]).slice(0, 500) : '')); console.log(`${R.filter(x => x[0] === 'PASS').length}/${R.length}`); process.exit(R.every(x => x[0] === 'PASS') ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
