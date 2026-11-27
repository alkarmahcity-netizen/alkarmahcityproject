// المشاريع المتلكئة حسب الضوابط (تعليمات 1/2025 وضوابطها، وضوابط 2/2014): انحراف > 20% مع (المصروف = المرفوع) أو (المرفوع صفر)، والاستثناءات
const { _electron: electron } = require('playwright'); const fs = require('fs'), path = require('path'), os = require('os');
const sleep = ms => new Promise(r => setTimeout(r, ms)); const R = []; const ok = (n, c, d = '') => R.push([c ? 'PASS' : 'FAIL', n, d]);
(async () => { const T = fs.mkdtempSync(path.join(os.tmpdir(), 'tlk-')); const mk = n => { const d = path.join(T, n); fs.mkdirSync(d); return d; };
  const DD = mk('d'), RG = mk('r');
  const P = (fileNo, name, planPct, actualPct, advRaised, advPaid, status, more) => Object.assign({ fileNo, name, contractor: 'شركة مثال', contractNo: fileNo, year: '2024', planPct, actualPct, advRaised, advPaid, status: status || 'مستمر' }, more || {});
  fs.writeFileSync(path.join(RG, 'registry.json'), JSON.stringify({ app: 'anbar-projects-shared', version: 1, projects: [
    P('1', 'مشروع بلا سلفة متأخر', 60, 30, 0, 0),                       // متلكئ: المرفوع صفر
    P('2', 'مشروع صرف كل المرفوع', 70, 45, 500000000, 500000000),         // متلكئ: المصروف = المرفوع
    P('3', 'مشروع مستحقاته غير مصروفة', 70, 45, 500000000, 300000000),   // لا: تأخر صرف المستحقات
    P('4', 'مشروع لم يسلم موقعه', 60, 30, 0, 0, 'متوقف', { notes: 'عدم تسليم الموقع للشركة' }),   // لا: عدم تسليم الموقع
    P('5', 'مشروع انحرافه قليل', 50, 35, 0, 0),                          // لا: 15%
    P('6', 'مشروع منجز', 100, 70, 0, 0, 'منجز'),                         // لا: منجز
    P('7', 'مشروع بانتظار أمر تغيير', 80, 40, 0, 0, 'مستمر', { legal: 'بانتظار اصدار امر تغيير' })   // لا: تأخر أمر تغيير
  ], links: {}, meta: {} }));
  const app = await electron.launch({ executablePath: require('electron'), args: ['--no-sandbox', __dirname], env: { ...process.env, UNI_MULTI: mk('u'), UNI_DATA_DIR: DD, ANBAR_REG_DIR: RG, UNI_AC_PORT: '48593', UNI_NO_JSONSCAN: '1', UNI_NO_LINKREFRESH: '1', UNI_NO_INTRO: '1' } });
  const pg = await app.firstWindow(); await sleep(1500); await pg.evaluate(() => window.desktop.go('sit')); await sleep(2000);
  const st = await pg.evaluate(() => ({ chips: [...document.querySelectorAll('#tbl tr[data-fn]')].filter(tr => tr.querySelector('.chip.tlk')).map(tr => tr.dataset.fn).sort(), kpi: (document.querySelector('[data-kfx=tlk] b') || {}).textContent }));
  ok('only projects 1 (no advance raised) and 2 (paid = raised) are marked «متلكئ **»', JSON.stringify(st.chips) === '["1","2"]', JSON.stringify(st));
  ok('summary card counts 2 stalled projects', st.kpi === '2', st.kpi);
  await pg.evaluate(() => document.querySelector('[data-kfx=tlk]').click()); await sleep(800);
  const fl = await pg.evaluate(() => [...document.querySelectorAll('#tbl tr[data-fn]')].map(tr => tr.dataset.fn).sort());
  ok('clicking it filters the list to the stalled projects', JSON.stringify(fl) === '["1","2"]', JSON.stringify(fl));
  await pg.evaluate(() => window.SitOpen('2')); await sleep(1000);
  const b2 = await pg.evaluate(() => (document.querySelector('#drawer .tlkbox') || {}).textContent || '');
  ok('card: «متلكئ **», the rule and «يجب إكمال الإجراءات القانونية بحق الشركة»', /متلكئ \*\*/.test(b2) && /يجب إكمال الإجراءات القانونية بحق الشركة/.test(b2) && /المصروف يساوي المرفوع/.test(b2) && /رقم \(1\) لسنة 2025/.test(b2) && /رقم \(2\) لسنة 2014/.test(b2), b2.slice(0, 300));
  const n3 = await pg.evaluate(async () => { window.SitOpen('3'); await new Promise(r => setTimeout(r, 600)); const a = (document.querySelector('#drawer .tlkno') || {}).textContent || ''; window.SitOpen('4'); await new Promise(r => setTimeout(r, 600)); const b = (document.querySelector('#drawer .tlkno') || {}).textContent || ''; window.SitOpen('7'); await new Promise(r => setTimeout(r, 600)); const c = (document.querySelector('#drawer .tlkno') || {}).textContent || ''; return [a, b, c]; });
  ok('not stalled — delayed dues (raised but unpaid), site not handed over, change order delayed — with the reason shown', /تأخر صرف المستحقات/.test(n3[0]) && /عدم تسليم الموقع/.test(n3[1]) && /تأخر إصدار أمر تغيير/.test(n3[2]), JSON.stringify(n3).slice(0, 300));
  await pg.evaluate(() => { window.confirm = () => true; window.SitOpen('1'); }); await sleep(800);
  await pg.evaluate(() => document.querySelector('#drawer [data-tlkex="occ"]').click()); await sleep(1200);
  const a1 = await pg.evaluate(() => ({ box: !!document.querySelector('#drawer .tlkbox'), no: (document.querySelector('#drawer .tlkno') || {}).textContent || '', kpi: (document.querySelector('[data-kfx=tlk] b') || {}).textContent }));
  ok('the department can record an exclusion (site occupied by another party) → no longer stalled', !a1.box && /إشغال الموقع من جهة أخرى/.test(a1.no) && /باختيار القسم/.test(a1.no) && a1.kpi === '1', JSON.stringify(a1));
  await pg.evaluate(() => document.querySelector('#drawer [data-tlkex="-"]').click()); await sleep(1200);
  ok('«إلغاء» restores the stalled mark', await pg.evaluate(() => !!document.querySelector('#drawer .tlkbox')));
  const e = await app.evaluate(() => (global.__uniErrors || []).slice()); ok('no JavaScript errors', e.length === 0, e.join(' | ').slice(0, 300));
  await app.close(); R.forEach(x => console.log(x[0], x[1], x[2] ? '— ' + String(x[2]).slice(0, 300) : '')); console.log(`${R.filter(x => x[0] === 'PASS').length}/${R.length}`); process.exit(R.every(x => x[0] === 'PASS') ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
