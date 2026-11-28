// المهندسون: البحث يتجاهل فروق الكتابة (أ/ا، ة/ه، ى/ي، التشكيل)، ومقاطعة استمارة الأسماء مع المشاريع تتعرّف على الأسماء مع الألقاب (ر.م.، م.م.، رئيس مهندسين…) والاسم الثنائي
const { _electron: electron } = require('playwright'); const fs = require('fs'), path = require('path'), os = require('os');
const sleep = ms => new Promise(r => setTimeout(r, ms)); const R = []; const ok = (n, c, d = '') => R.push([c ? 'PASS' : 'FAIL', n, d]);
(async () => { const T = fs.mkdtempSync(path.join(os.tmpdir(), 'engs-')); const mk = n => { const d = path.join(T, n); fs.mkdirSync(d); return d; };
  const DD = mk('d'), RG = mk('r');
  const P = (fileNo, name, district, resident, office, staff) => ({ fileNo, name, contractor: 'شركة', contractNo: fileNo, year: '2025', status: 'مستمر', district, resident, residentOffice: office, staff });
  const roster = [{ name: 'ر.م. أحمد علي حسين', dept: 'بلدية هيت', title: 'رئيس مهندسين' }, { name: 'م.م. عمر خالد جاسم', dept: 'بلدية القائم', title: 'مهندس' }, { name: 'رئيس مهندسين اقدم سعد محمود صالح', dept: 'مديرية الطرق', title: 'رئيس مهندسين اقدم' }, { name: 'فاطمة حسن', dept: 'بلدية هيت', title: 'مهندسة' }];
  fs.writeFileSync(path.join(RG, 'registry.json'), JSON.stringify({ app: 'anbar-projects-shared', version: 1, roster, rosterAt: 1, rosterSrc: 'استمارة اختبار', projects: [
    P('1', 'مشروع مدرسة في هيت', 'هيت', 'احمد علي حسين', 'بلدية هيت', [{ name: 'سعد محمود صالح', dept: 'مديرية الطرق', role: 'مهندس مشرف' }]),
    P('2', 'مشروع في القائم', 'القائم', 'عمر خالد', 'بلدية القائم', []),
    P('3', 'مشروع مستشفى في هيت', 'هيت', 'فاطمه حسن', 'بلدية هيت', [])], links: {}, meta: {} }));
  const app = await electron.launch({ executablePath: require('electron'), args: ['--no-sandbox', __dirname], env: { ...process.env, UNI_MULTI: mk('u'), UNI_DATA_DIR: DD, ANBAR_REG_DIR: RG, UNI_AC_PORT: '48601', UNI_NO_JSONSCAN: '1', UNI_NO_LINKREFRESH: '1', UNI_NO_INTRO: '1' } });
  const pg = await app.firstWindow(); await sleep(1500); await pg.evaluate(() => window.desktop.go('sit')); await sleep(1200);
  await pg.evaluate(() => document.querySelector('.st[data-st="eng"]').click()); await sleep(1000);
  const search = async q => { await pg.evaluate(q => { const s = document.getElementById('eq'); s.value = q; s.dispatchEvent(new Event('input', { bubbles: true })); }, q); await sleep(500); return pg.evaluate(() => ({ names: (window.__engList || []).map(e => e.name), all: (document.querySelector('#depts .dchip[data-d=""] small') || {}).textContent })); };
  let r = await search('أحمد'); ok('search «أحمد» finds «احمد علي حسين» (hamza ignored)', r.names.some(n => /احمد/.test(n)), JSON.stringify(r));
  r = await search('فاطمة'); ok('search «فاطمة» finds «فاطمه حسن» (ة/ه)', r.names.some(n => /فاطم/.test(n)), JSON.stringify(r));
  r = await search('مدرسه'); ok('search by project name works with ة/ه', r.names.length >= 1, JSON.stringify(r));
  r = await search(''); ok('empty search: all engineers, department chips not zero', r.names.length >= 4 && r.all !== '(0)', JSON.stringify(r));
  const ro = await pg.evaluate(() => { const t = document.getElementById('rosterBox').textContent.replace(/\s+/g, ' '); const n = id => { const e = document.querySelector('#rosterBox [data-rf="' + id + '"] b'); return e ? +e.textContent : -1; }; return { res: n('res'), sup: n('sup'), both: n('both'), none: n('none'), out: n('out') }; });
  ok('names list ↔ projects: titles (ر.م.، م.م.، رئيس مهندسين اقدم) and ة/ه are matched — 3 residents/supervisors recognised', ro.res + ro.sup + ro.both >= 3 && ro.none <= 1, JSON.stringify(ro));
  ok('two-part name in the situation («عمر خالد») matched to the unique «عمر خالد جاسم»; nobody left unmatched', ro.out === 0 && ro.sup === 1, JSON.stringify(ro));
  const e = await app.evaluate(() => (global.__uniErrors || []).slice()); ok('no JavaScript errors', e.length === 0, e.join(' | ').slice(0, 300));
  await app.close(); R.forEach(x => console.log(x[0], x[1], x[2] ? '— ' + String(x[2]).slice(0, 300) : '')); console.log(`${R.filter(x => x[0] === 'PASS').length}/${R.length}`); process.exit(R.every(x => x[0] === 'PASS') ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
