// اختبار «تاريخ الإنجاز الفعلي» في الموقف العام:
//  • عمود «تاريخ الإنجاز الفعلي» في ملف موقف اللجنة يُقرأ (actualEnd) ويظهر في بطاقة المشروع «(من ملف الموقف)» مع التأخر عن المخطط.
//  • المشروع المنجز بلا تاريخ: تذكير «لم يُدخل تاريخ الإنجاز الفعلي»، وحقل تاريخ + «💾 حفظ» في بطاقة المشروع؛ يُحفظ ويظهر d/m/y.
//  • المشروع غير المنجز: لا حقل إدخال.
const { _electron: electron } = require('playwright');
const fs = require('fs'), path = require('path'), os = require('os');
const T = path.join(os.tmpdir(), 'uni-actualend'); fs.rmSync(T, { recursive: true, force: true });
const mk = n => { const d = path.join(T, n); fs.mkdirSync(d, { recursive: true }); return d; }; const sleep = ms => new Promise(r => setTimeout(r, ms));
const R = []; const ok = (n, c, d = '') => R.push([c ? 'PASS' : 'FAIL', n, d]);
(async () => {
  const RG = mk('r'); fs.writeFileSync(path.join(RG, 'registry.json'), JSON.stringify({ projects: [
    { fileNo: '701', name: 'مدرسة منجزة بلا تاريخ', contractor: 'شركة أ', status: 'منجز', planEnd: '2026-01-10', actualPct: 100 },
    { fileNo: '702', name: 'طريق منجز بتاريخ من الملف', contractor: 'شركة ب', status: 'منجز', planEnd: '2026-02-01', actualEnd: '2026-03-03', actualPct: 100 },
    { fileNo: '703', name: 'مشروع مستمر', contractor: 'شركة ج', status: 'مستمر', planEnd: '2026-12-01', actualPct: 40 }], source: 'test', updated: '2026-11-19' }));
  const app = await electron.launch({ executablePath: require('electron'), args: ['--no-sandbox', __dirname], env: { ...process.env, UNI_MULTI: mk('u'), UNI_DATA_DIR: mk('d'), ANBAR_REG_DIR: RG, UNI_AC_PORT: '48443', UNI_NO_JSONSCAN: '1', UNI_NO_LINKREFRESH: '1' } });
  const pg = await app.firstWindow(); await pg.waitForLoadState('domcontentloaded'); await sleep(1500);
  ok('the status-file column «تاريخ الإنجاز الفعلي» is recognised (also «تاريخ الانجاز الفعلي»)', await pg.evaluate(() => window.AnbarReg.fieldOf('تاريخ الإنجاز الفعلي') === 'actualEnd' && window.AnbarReg.fieldOf('تاريخ الانجاز الفعلي') === 'actualEnd' && window.AnbarReg.fieldOf('تاريخ الإنجاز المخطط') === 'planEnd'));
  await pg.evaluate(() => window.desktop.go('sit')); await sleep(1200);
  const dr = async fn => { await pg.evaluate(f => window.SitOpen(f), fn); await sleep(400); return pg.evaluate(() => document.getElementById('drawer').textContent.replace(/\s+/g, ' ')); };
  const t2 = await dr('702');
  ok('from the status file: shown d/m/y «3/3/2026 (متأخر 30 يوماً عن المخطط) (من ملف الموقف)», no input', /تاريخ الإنجاز الفعلي\s*3\/3\/2026/.test(t2) && /متأخر 30 يوماً/.test(t2) && /من ملف الموقف/.test(t2) && !(await pg.evaluate(() => !!document.getElementById('aeIn'))), t2.slice(t2.indexOf('الكلفة والمدة'), t2.indexOf('الكلفة والمدة') + 400));
  const t1 = await dr('701');
  ok('completed without a date: reminder «لم يُدخل تاريخ الإنجاز الفعلي» and a date field with «💾 حفظ»', /لم يُدخل «تاريخ الإنجاز الفعلي»/.test(t1) && await pg.evaluate(() => !!document.getElementById('aeIn') && !!document.querySelector('[data-aesave="701"]')), t1.slice(0, 300));
  await pg.evaluate(() => { const i = document.getElementById('aeIn'); i.value = '2026-01-05'; document.querySelector('[data-aesave="701"]').click(); }); await sleep(600);
  const t1b = await pg.evaluate(() => document.getElementById('drawer').textContent.replace(/\s+/g, ' '));
  const meta = await pg.evaluate(() => window.AnbarReg.getMeta('701'));
  ok('saved: kept with the project (synced), shown «5/1/2026 (قبل المخطط بـ 5 يوماً)», reminder gone', meta.actualEnd === '2026-01-05' && /5\/1\/2026/.test(t1b) && /قبل المخطط بـ 5 يوماً/.test(t1b) && !/لم يُدخل «تاريخ الإنجاز الفعلي»/.test(t1b), JSON.stringify(meta));
  await pg.evaluate(() => { const i = document.getElementById('aeIn'); i.value = '2099-01-01'; document.querySelector('[data-aesave="701"]').click(); }); await sleep(400);
  ok('a future date is refused', (await pg.evaluate(() => window.AnbarReg.getMeta('701').actualEnd)) === '2026-01-05');
  const t3 = await dr('703');
  ok('an ongoing project has no actual-completion field', !/تاريخ الإنجاز الفعلي/.test(t3) && !(await pg.evaluate(() => !!document.getElementById('aeIn'))));
  const e = await app.evaluate(() => (global.__uniErrors || []).slice()); ok('no JavaScript errors', e.length === 0, e.join(' | ').slice(0, 400));
  await app.close();
  R.forEach(x => console.log(x[0], x[1], x[2] ? '— ' + String(x[2]).slice(0, 500) : '')); console.log(`${R.filter(x => x[0] === 'PASS').length}/${R.length}`); process.exit(R.every(x => x[0] === 'PASS') ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
