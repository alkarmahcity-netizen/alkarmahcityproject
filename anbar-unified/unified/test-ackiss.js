// اختبار «✔ تحققتُ — تجاهل هذا الفرق» في بطاقة المشروع (الموقف العام):
//  • الفرق يُخفى لهذا المشروع ويُنقل إلى «✔ فروقات تحققتَ منها» مع «إلغاء»، ولا يُعدّ خللاً.
//  • يعود تلقائياً إن تغيّر أي رقم فيه (الموقف أو النظام)، و«إلغاء» يعيده.
const { _electron: electron } = require('playwright');
const fs = require('fs'), path = require('path'), os = require('os');
const T = path.join(os.tmpdir(), 'uni-ackiss'); fs.rmSync(T, { recursive: true, force: true });
const mk = n => { const d = path.join(T, n); fs.mkdirSync(d, { recursive: true }); return d; }; const sleep = ms => new Promise(r => setTimeout(r, ms));
const R = []; const ok = (n, c, d = '') => R.push([c ? 'PASS' : 'FAIL', n, d]);
(async () => {
  const RG = mk('r'); fs.writeFileSync(path.join(RG, 'registry.json'), JSON.stringify({ projects: [
    { fileNo: '1527', name: 'تأهيل طريق المرحلة الرابعة', contractor: 'عراق الشواهق', status: 'متوقف', orig: 2000000000, changeCost: 107130000, total: 2107130000 }], source: 'test', updated: '2026-11-19' }));
  const app = await electron.launch({ executablePath: require('electron'), args: ['--no-sandbox', __dirname], env: { ...process.env, UNI_MULTI: mk('u'), UNI_DATA_DIR: mk('d'), ANBAR_REG_DIR: RG, UNI_AC_PORT: '48445', UNI_NO_JSONSCAN: '1', UNI_NO_LINKREFRESH: '1' } });
  const pg = await app.firstWindow(); await pg.waitForLoadState('domcontentloaded'); await sleep(1500);
  await pg.evaluate(() => window.desktop.go('sit')); await sleep(1000);
  const setCo = async (cc, n2) => pg.evaluate(([cc, n2]) => window.AnbarReg.setLink('co', '1527', { changeCost: cc, orders: 2, items: [{ no: 1, net: 107160000, decNo: '5' }, { no: 2, net: n2, decNo: '9' }] }), [cc, n2]);
  await setCo(101885000, -5275000);
  const txt = async () => { await pg.evaluate(() => window.SitOpen('1527')); await sleep(400); return pg.evaluate(() => document.getElementById('drawer').textContent.replace(/\s+/g, ' ')); };
  let t = await txt();
  ok('the difference shows with «✔ تحققتُ — تجاهل هذا الفرق»', /خلل بين الموقف والأنظمة \(1\)/.test(t) && /تحققتُ — تجاهل هذا الفرق/.test(t), t.slice(0, 300));
  await pg.evaluate(() => { window.confirm = () => true; document.querySelector('[data-ack="1527"]').click(); }); await sleep(600);
  t = await pg.evaluate(() => document.getElementById('drawer').textContent.replace(/\s+/g, ' '));
  ok('after confirming: no longer an issue — listed under «✔ فروقات تحققتَ منها (1)» with «إلغاء»', !/خلل بين الموقف والأنظمة/.test(t) && /فروقات تحققتَ منها — لا تُعدّ خللاً \(1\)/.test(t) && /إلغاء/.test(t) && /الموقف مطابق/.test(t), t.slice(0, 400));
  ok('kept with the project data (synced between PCs)', !!(await pg.evaluate(() => window.AnbarReg.getMeta('1527').ackIss)));
  await setCo(101900000, -5260000);
  t = await txt();
  ok('if a number changes (the order amount in the system), the difference comes back automatically', /خلل بين الموقف والأنظمة \(1\)/.test(t) && !/فروقات تحققتَ منها/.test(t), t.slice(0, 300));
  await setCo(101885000, -5275000); t = await txt();
  ok('back to the checked numbers → hidden again', !/خلل بين الموقف والأنظمة/.test(t));
  await pg.evaluate(() => document.querySelector('[data-unack="1527"]').click()); await sleep(600);
  t = await pg.evaluate(() => document.getElementById('drawer').textContent.replace(/\s+/g, ' '));
  ok('«إلغاء» shows it as an issue again', /خلل بين الموقف والأنظمة \(1\)/.test(t) && !/فروقات تحققتَ منها/.test(t));
  const e = await app.evaluate(() => (global.__uniErrors || []).slice()); ok('no JavaScript errors', e.length === 0, e.join(' | ').slice(0, 400));
  await app.close();
  R.forEach(x => console.log(x[0], x[1], x[2] ? '— ' + String(x[2]).slice(0, 500) : '')); console.log(`${R.filter(x => x[0] === 'PASS').length}/${R.length}`); process.exit(R.every(x => x[0] === 'PASS') ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
