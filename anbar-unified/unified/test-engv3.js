// توحيد الدوائر على مستوى المديرية: بلديات الأقضية = مديرية بلديات الانبار، الفرع (القضاء / المركز) بجانب الاسم، القائممقاميات حسب القضاء،
// وأسماء الاستمارة بلا مشاريع تُضاف إلى القاعدة بدائرتها القطاعية
const { _electron: electron } = require('playwright'); const fs = require('fs'), path = require('path'), os = require('os');
const sleep = ms => new Promise(r => setTimeout(r, ms)); const R = []; const ok = (n, c, d = '') => R.push([c ? 'PASS' : 'FAIL', n, d]);
(async () => { const T = fs.mkdtempSync(path.join(os.tmpdir(), 'engv3-')); const mk = n => { const d = path.join(T, n); fs.mkdirSync(d); return d; };
  const DD = mk('d'), RG = mk('r');
  const P = (fileNo, sector, resident, office) => ({ fileNo, name: 'مشروع ' + fileNo, contractor: 'شركة', contractNo: fileNo, year: '2025', status: 'مستمر', district: 'هيت', sector, resident, residentOffice: office, staff: [] });
  fs.writeFileSync(path.join(RG, 'registry.json'), JSON.stringify({ app: 'anbar-projects-shared', version: 1,
    roster: [{ name: 'م. زيد كريم عباس', dept: 'مجاري مركز الكرمة', title: 'مهندس' }], rosterAt: 1, rosterSrc: 'استمارة',
    projects: [P('1', 'بلدية هيت', 'احمد علي حسين', 'بلدية هيت'), P('2', 'بلدية الرمادي', 'عمر خالد جاسم', 'مديرية بلدية الرمادي'), P('3', 'مديرية بلديات الانبار', 'سعد محمود صالح', 'مديرية بلديات الانبار'),
      P('4', 'مديرية مجاري الانبار', 'ليث حامد سالم', 'مجاري مركز الفلوجة'), P('5', 'قائممقامية هيت', 'رياض خلف عواد', 'قائممقامية هيت'), P('6', 'مديرية تربية الانبار', 'علي حسن محمد', 'تربية هيت')], links: {}, meta: {} }));
  const app = await electron.launch({ executablePath: require('electron'), args: ['--no-sandbox', __dirname], env: { ...process.env, UNI_MULTI: mk('u'), UNI_DATA_DIR: DD, ANBAR_REG_DIR: RG, UNI_AC_PORT: '48607', UNI_NO_JSONSCAN: '1', UNI_NO_LINKREFRESH: '1', UNI_NO_INTRO: '1' } });
  const pg = await app.firstWindow(); await sleep(1500); await pg.evaluate(() => window.desktop.go('sit')); await sleep(1200);
  await pg.evaluate(() => document.querySelector('.st[data-st="eng"]').click()); await sleep(1200);
  const dd = await pg.evaluate(() => [...document.querySelectorAll('#edept option')].map(o => o.textContent));
  ok('municipalities of all districts = one «مديرية بلديات الانبار» (3 engineers)', dd.filter(x => /بلدي/.test(x)).length === 1 && dd.some(x => x === 'مديرية بلديات الانبار (3)'), JSON.stringify(dd));
  ok('«قائممقامية هيت» stays by district; «تربية هيت» → «مديرية تربية الانبار»; sewers one directorate', dd.some(x => /^قائممقامية هيت/.test(x)) && dd.filter(x => /تربي/.test(x)).length === 1 && dd.some(x => /^مديرية تربية الانبار/.test(x)) && dd.filter(x => /مجاري/.test(x)).length === 1, JSON.stringify(dd));
  const g = await pg.evaluate(() => [...document.querySelectorAll('#engs .dept')].map(d => ({ h: d.querySelector('h3').firstChild.textContent, rows: [...d.querySelectorAll('tbody tr td:first-child')].map(td => td.textContent.replace(/\s+/g, ' ').trim()) })));
  const bl = g.find(x => x.h === 'مديرية بلديات الانبار') || { rows: [] }, mj = g.find(x => /مجاري/.test(x.h)) || { rows: [] };
  ok('the branch is shown next to the name (هيت، الرمادي)', bl.rows.some(r => /احمد علي حسين هيت/.test(r)) && bl.rows.some(r => /عمر خالد جاسم الرمادي/.test(r)), JSON.stringify(bl.rows));
  ok('a names-list person without projects is added under the sewers directorate with his centre («مركز الكرمة») and «(من الاستمارة)»', mj.rows.some(r => /زيد كريم عباس/.test(r) && /مركز الكرمة/.test(r) && /من الاستمارة/.test(r)) && mj.rows.some(r => /ليث حامد سالم مركز الفلوجة/.test(r)), JSON.stringify(mj));
  const e = await app.evaluate(() => (global.__uniErrors || []).slice()); ok('no JavaScript errors', e.length === 0, e.join(' | ').slice(0, 300));
  await app.close(); R.forEach(x => console.log(x[0], x[1], x[2] ? '— ' + String(x[2]).slice(0, 400) : '')); console.log(`${R.filter(x => x[0] === 'PASS').length}/${R.length}`); process.exit(R.every(x => x[0] === 'PASS') ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
