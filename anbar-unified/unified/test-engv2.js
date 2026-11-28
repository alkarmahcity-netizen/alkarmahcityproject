// المهندسون: الدوائر موحّدة كما في الجهة المستفيدة بالموقف، قائمتا الدوائر والأقضية منسدلتان، والبحث باسم يعطي بطاقة تفاصيل دوائره ومشاريعه فوراً (قبل مربع الاستمارة)
const { _electron: electron } = require('playwright'); const fs = require('fs'), path = require('path'), os = require('os');
const sleep = ms => new Promise(r => setTimeout(r, ms)); const R = []; const ok = (n, c, d = '') => R.push([c ? 'PASS' : 'FAIL', n, d]);
(async () => { const T = fs.mkdtempSync(path.join(os.tmpdir(), 'engv2-')); const mk = n => { const d = path.join(T, n); fs.mkdirSync(d); return d; };
  const DD = mk('d'), RG = mk('r');
  const P = (fileNo, name, district, sector, resident, office, staff) => ({ fileNo, name, contractor: 'شركة', contractNo: fileNo, year: '2025', status: 'مستمر', district, sector, resident, residentOffice: office, staff: staff || [] });
  fs.writeFileSync(path.join(RG, 'registry.json'), JSON.stringify({ app: 'anbar-projects-shared', version: 1, roster: [{ name: 'م. سيف خالد عبد الرزاق', dept: 'ديوان المحافظة', title: 'رئيس مهندسين' }], rosterAt: 1, rosterSrc: 'استمارة', projects: [
    P('1', 'مدرسة الفرات', 'هيت', 'مديرية تربية الانبار', 'ليث حامد سالم', 'تربية الانبار', [{ name: 'سيف خالد عبدالرزاق', dept: 'ديوان محافظة الانبار', role: 'مهندس مشرف' }]),
    P('2', 'مدرسة النور', 'الرمادي', 'مديرية تربية الانبار', 'علي حسن محمد', 'تربية', [{ name: 'سيف خالد عبدالرزاق', dept: 'ديوان المحافظة', role: 'مهندس مشرف' }]),
    P('3', 'طريق القائم', 'القائم', 'مديرية الطرق والجسور', 'عمر سعد جاسم', 'طرق وجسور الانبار', [])], links: {}, meta: {} }));
  const app = await electron.launch({ executablePath: require('electron'), args: ['--no-sandbox', __dirname], env: { ...process.env, UNI_MULTI: mk('u'), UNI_DATA_DIR: DD, ANBAR_REG_DIR: RG, UNI_AC_PORT: '48603', UNI_NO_JSONSCAN: '1', UNI_NO_LINKREFRESH: '1', UNI_NO_INTRO: '1' } });
  const pg = await app.firstWindow(); await sleep(1500); await pg.evaluate(() => window.desktop.go('sit')); await sleep(1200);
  await pg.evaluate(() => document.querySelector('.st[data-st="eng"]').click()); await sleep(1000);
  const dd = await pg.evaluate(() => [...document.querySelectorAll('#edept option')].map(o => o.textContent));
  ok('departments dropdown is unified (تربية الانبار = تربية = مديرية تربية الانبار؛ ديوان محافظة الانبار = ديوان المحافظة؛ طرق وجسور الانبار = مديرية الطرق والجسور), alphabetical', dd.filter(x => /تربي/.test(x)).length === 1 && dd.some(x => /^مديرية تربية الانبار \(/.test(x)) && dd.filter(x => /ديوان/.test(x)).length === 1 && dd.filter(x => /طرق/.test(x)).length === 1 && dd.some(x => /^مديرية الطرق والجسور/.test(x)), JSON.stringify(dd));
  const groups = await pg.evaluate(() => [...document.querySelectorAll('#engs .dept h3')].map(h => h.firstChild.textContent));
  ok('engineers grouped by the unified department names (no duplicates)', new Set(groups).size === groups.length && groups.filter(g => /تربي/.test(g)).length === 1, JSON.stringify(groups));
  await pg.evaluate(() => { const s = document.getElementById('edept'); s.value = [...s.options].find(o => /تربية/.test(o.textContent)).value; s.dispatchEvent(new Event('input', { bubbles: true })); }); await sleep(500);
  const ed = await pg.evaluate(() => (window.__engList || []).map(e => e.name).sort());
  ok('choosing «مديرية تربية الانبار» lists its residents and the supervisor working on its projects', JSON.stringify(ed) === JSON.stringify(['سيف خالد عبدالرزاق', 'علي حسن محمد', 'ليث حامد سالم'].sort()), JSON.stringify(ed));
  await pg.evaluate(() => { const s = document.getElementById('edept'); s.value = ''; s.dispatchEvent(new Event('input', { bubbles: true })); const q = document.getElementById('eq'); q.value = 'سيف خالد'; q.dispatchEvent(new Event('input', { bubbles: true })); }); await sleep(600);
  const c = await pg.evaluate(() => { const card = document.querySelector('#engs .ecard'), r = document.getElementById('rosterBox').getBoundingClientRect().top; return { t: card ? card.textContent.replace(/\s+/g, ' ') : '', above: card ? card.getBoundingClientRect().top < r : false, n: document.querySelectorAll('#engs .ecard').length }; });
  ok('search «سيف خالد»: a details card right under the counters (above the names-list box)', c.n === 1 && c.above, JSON.stringify({ n: c.n, above: c.above }));
  ok('the card shows his unified department, the departments of his projects and his entry in the names list', /الدائرة ديوان/.test(c.t) && /دوائر مشاريعه/.test(c.t) && /مديرية تربية الانبار/.test(c.t) && /في استمارة القسم رئيس مهندسين/.test(c.t), c.t.slice(0, 400));
  const e = await app.evaluate(() => (global.__uniErrors || []).slice()); ok('no JavaScript errors', e.length === 0, e.join(' | ').slice(0, 300));
  await app.close(); R.forEach(x => console.log(x[0], x[1], x[2] ? '— ' + String(x[2]).slice(0, 400) : '')); console.log(`${R.filter(x => x[0] === 'PASS').length}/${R.length}`); process.exit(R.every(x => x[0] === 'PASS') ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
