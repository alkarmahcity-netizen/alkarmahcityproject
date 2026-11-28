// المهندسون المقيمون والمشرفون (الموقف العام): البحث وقوائم الدوائر والأقضية أعلى الصفحة قبل الأسماء، وقائمة «كل الأقضية» تصفّي حسب قضاء مشاريع المهندس
const { _electron: electron } = require('playwright'); const fs = require('fs'), path = require('path'), os = require('os');
const sleep = ms => new Promise(r => setTimeout(r, ms)); const R = []; const ok = (n, c, d = '') => R.push([c ? 'PASS' : 'FAIL', n, d]);
(async () => { const T = fs.mkdtempSync(path.join(os.tmpdir(), 'engt-')); const mk = n => { const d = path.join(T, n); fs.mkdirSync(d); return d; };
  const DD = mk('d'), RG = mk('r');
  const P = (fileNo, name, district, resident, office) => ({ fileNo, name, contractor: 'شركة', contractNo: fileNo, year: '2025', status: 'مستمر', district, resident, residentOffice: office, phone: '07801234567' });
  fs.writeFileSync(path.join(RG, 'registry.json'), JSON.stringify({ app: 'anbar-projects-shared', version: 1, projects: [P('1', 'مشروع في هيت', 'هيت', 'احمد علي حسين', 'بلدية هيت'), P('2', 'مشروع في القائم', 'القائم', 'عمر خالد جاسم', 'بلدية القائم'), P('3', 'مشروع آخر في هيت', 'هيت', 'سعد محمود صالح', 'بلدية هيت')], links: {}, meta: {} }));
  const app = await electron.launch({ executablePath: require('electron'), args: ['--no-sandbox', __dirname], env: { ...process.env, UNI_MULTI: mk('u'), UNI_DATA_DIR: DD, ANBAR_REG_DIR: RG, UNI_AC_PORT: '48599', UNI_NO_JSONSCAN: '1', UNI_NO_LINKREFRESH: '1', UNI_NO_INTRO: '1' } });
  const pg = await app.firstWindow(); await sleep(1500); await pg.evaluate(() => window.desktop.go('sit')); await sleep(1200);
  await pg.evaluate(() => document.querySelector('.st[data-st="eng"]').click()); await sleep(1000);
  const o = await pg.evaluate(() => { const y = id => { const e = document.getElementById(id); return e ? e.getBoundingClientRect().top : -1; }; return { eq: y('eq'), depts: y('depts'), roster: y('rosterBox'), engs: y('engs'), kpis: y('ekpis'), dist: [...document.querySelectorAll('#edist option')].map(o => o.textContent) }; });
  ok('search and the departments list are above the KPIs, the roster box and the engineers list', o.eq < o.kpis && o.depts < o.kpis && o.depts < o.engs && o.eq < o.roster && o.eq < o.engs && o.depts >= o.eq, JSON.stringify(o));
  ok('districts list («كل الأقضية») built from the engineers\' projects', JSON.stringify(o.dist) === '["كل الأقضية","القائم","هيت"]', JSON.stringify(o.dist));
  await pg.evaluate(() => { const s = document.getElementById('edist'); s.value = 'هيت'; s.dispatchEvent(new Event('input', { bubbles: true })); }); await sleep(600);
  const n = await pg.evaluate(() => (window.__engList || []).map(e => e.name).sort());
  ok('choosing «هيت» shows only engineers with projects in Hit', JSON.stringify(n) === JSON.stringify(['احمد علي حسين', 'سعد محمود صالح']), JSON.stringify(n));
  const e = await app.evaluate(() => (global.__uniErrors || []).slice()); ok('no JavaScript errors', e.length === 0, e.join(' | ').slice(0, 300));
  await app.close(); R.forEach(x => console.log(x[0], x[1], x[2] ? '— ' + String(x[2]).slice(0, 300) : '')); console.log(`${R.filter(x => x[0] === 'PASS').length}/${R.length}`); process.exit(R.every(x => x[0] === 'PASS') ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
