// اختبار ملخص سلف في الموقف بلا ملف مقابل في لجنة التدقيق على هذه الحاسبة:
//  • يظهر «⚠ لا يوجد في لجنة تدقيق السلف على هذه الحاسبة ملف سلف لهذا المشروع» مع «إزالة هذا الملخص».
//  • الإزالة (بتأكيد) تحذف الملخص، فيختفي فرق السلف من البطاقة.
const { _electron: electron } = require('playwright');
const fs = require('fs'), path = require('path'), os = require('os');
const T = path.join(os.tmpdir(), 'uni-adorphan'); fs.rmSync(T, { recursive: true, force: true });
const mk = n => { const d = path.join(T, n); fs.mkdirSync(d, { recursive: true }); return d; }; const sleep = ms => new Promise(r => setTimeout(r, ms));
const R = []; const ok = (n, c, d = '') => R.push([c ? 'PASS' : 'FAIL', n, d]);
(async () => {
  const RG = mk('r'); fs.writeFileSync(path.join(RG, 'registry.json'), JSON.stringify({ projects: [
    { fileNo: '571', name: 'صيانة جسر ناظم الشلالة / قضاء الكرمة', contractor: 'طور سيناء', status: 'مستمر', orig: 400800000, total: 400800000 }], source: 'test', updated: '2026-11-19' }));
  const app = await electron.launch({ executablePath: require('electron'), args: ['--no-sandbox', __dirname], env: { ...process.env, UNI_MULTI: mk('u'), UNI_DATA_DIR: mk('d'), ANBAR_REG_DIR: RG, UNI_AC_PORT: '48451', UNI_NO_JSONSCAN: '1', UNI_NO_LINKREFRESH: '1' } });
  const pg = await app.firstWindow(); await pg.waitForLoadState('domcontentloaded'); await sleep(1500);
  await pg.evaluate(() => window.desktop.go('sit')); await sleep(1000);
  await pg.evaluate(() => window.AnbarReg.setLink('ad', '571', { count: 1, cumulative: 200000000, at: '2026-10-20T10:00:00Z', items: [{ no: 1, cum: 200000000, net: 200000000, date: '2026-10-20', form: '150' }] }));
  const txt = async () => { await pg.evaluate(() => window.SitOpen('571')); await sleep(400); return pg.evaluate(() => document.getElementById('drawer').textContent.replace(/\s+/g, ' ')); };
  let t = await txt();
  ok('an advance summary with NO advance file on this PC says so clearly, with the date, and offers «إزالة هذا الملخص»', /لا يوجد في لجنة تدقيق السلف على هذه الحاسبة ملف سلف لهذا المشروع/.test(t) && /200,000,000/.test(t) && /20\/10\/2026/.test(t) && await pg.evaluate(() => !!document.querySelector('[data-adrm="571"]')), t.slice(0, 500));
  ok('…the advance difference is shown (status 0 ≠ 200,000,000)', /السلف المرفوعة في الموقف/.test(t));
  await pg.evaluate(() => { window.confirm = () => true; document.querySelector('[data-adrm="571"]').click(); }); await sleep(600);
  t = await pg.evaluate(() => document.getElementById('drawer').textContent.replace(/\s+/g, ' '));
  const gone = await pg.evaluate(() => !window.AnbarReg.links('571').ad);
  ok('after removing: the summary is gone and so is the advance difference', gone && !/السلف المرفوعة في الموقف/.test(t) && !/لا يوجد في لجنة تدقيق السلف على هذه الحاسبة/.test(t), t.slice(0, 300));
  // كما حدث فعلاً: الملخص كتبه البرنامج على حاسبة أخرى، فيعود بالمزامنة بعد إزالته — يُحاكى بإعادته إلى ملف الموقف المشترك بالوقت نفسه
  const regF = path.join(RG, 'registry.json');
  const inject = at => { const j = JSON.parse(fs.readFileSync(regF, 'utf8')); j.links = j.links || {}; j.links['571'] = Object.assign({}, j.links['571'], { ad: { count: 1, cumulative: 200000000, at, src: 'other-pc', items: [{ no: 1, cum: 200000000, net: 200000000, date: '2026-10-20' }] } }); fs.writeFileSync(regF, JSON.stringify(j)); };
  inject('2026-10-20T10:00:00.000Z'); await pg.evaluate(() => window.AnbarReg.invalidate()); await sleep(300);
  ok('the removed summary written by ANOTHER PC does not come back through sync (same summary)', await pg.evaluate(() => !window.AnbarReg.links('571').ad), JSON.stringify(await pg.evaluate(() => window.AnbarReg.links('571'))));
  inject('2026-11-25T10:00:00.000Z'); await pg.evaluate(() => window.AnbarReg.invalidate()); await sleep(300);
  ok('…but a NEWER summary (a real new advance) does come back', await pg.evaluate(() => !!window.AnbarReg.links('571').ad));
  t = await txt();
  ok('the warning says it was written on another PC / by another user', /كتبه البرنامج على حاسبة أخرى أو باسم مستخدم آخر/.test(t), t.slice(0, 400));
  const e = await app.evaluate(() => (global.__uniErrors || []).slice()); ok('no JavaScript errors', e.length === 0, e.join(' | ').slice(0, 400));
  await app.close();
  R.forEach(x => console.log(x[0], x[1], x[2] ? '— ' + String(x[2]).slice(0, 500) : '')); console.log(`${R.filter(x => x[0] === 'PASS').length}/${R.length}`); process.exit(R.every(x => x[0] === 'PASS') ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
