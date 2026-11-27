// المشاريع المتلكئة حسب الضوابط (تعليمات 1/2025 وضوابطها، وضوابط 2/2014): انحراف > 20% مع (المصروف = المرفوع) أو (المرفوع صفر)، والاستثناءات
const { _electron: electron } = require('playwright'); const fs = require('fs'), path = require('path'), os = require('os');
const sleep = ms => new Promise(r => setTimeout(r, ms)); const R = []; const ok = (n, c, d = '') => R.push([c ? 'PASS' : 'FAIL', n, d]);
(async () => { const T = fs.mkdtempSync(path.join(os.tmpdir(), 'tlk-')); const mk = n => { const d = path.join(T, n); fs.mkdirSync(d); return d; };
  const DD = mk('d'), RG = mk('r');
  const ago = d => new Date(Date.now() - d * 864e5).toISOString().slice(0, 10);
  const P = (fileNo, name, planPct, actualPct, advRaised, advPaid, status, more) => Object.assign({ fileNo, name, contractor: 'شركة مثال', contractNo: fileNo, year: '2024', planPct, actualPct, advRaised, advPaid, status: status || 'مستمر' }, more || {});
  fs.writeFileSync(path.join(RG, 'registry.json'), JSON.stringify({ app: 'anbar-projects-shared', version: 1, projects: [
    P('1', 'مشروع بلا سلفة متأخر', 60, 30, 0, 0),                       // متلكئ: المرفوع صفر
    P('2', 'مشروع صرف كل المرفوع', 70, 45, 500000000, 500000000),         // متلكئ: المصروف = المرفوع
    P('3', 'مشروع مستحقاته غير مصروفة', 70, 45, 500000000, 300000000),   // لا: تأخر صرف المستحقات
    P('4', 'مشروع لم يسلم موقعه', 60, 30, 0, 0, 'متوقف', { notes: 'عدم تسليم الموقع للشركة' }),   // لا: عدم تسليم الموقع
    P('5', 'مشروع انحرافه قليل', 50, 35, 0, 0),                          // لا: 15%
    P('6', 'مشروع منجز', 100, 70, 0, 0, 'منجز'),                         // لا: منجز
    P('7', 'مشروع بانتظار أمر تغيير', 80, 40, 0, 0, 'مستمر', { legal: 'بانتظار اصدار امر تغيير' }),   // لا: تأخر أمر تغيير
    // الشرط الثاني: فعلي 90% فأكثر، مخطط 100%، مضى أكثر من 30 يوماً على الموعد، المرفوع = المصروف
    P('8', 'مشروع شارف على الإنجاز ومتأخر', 100, 92, 300000000, 300000000, 'مستمر', { planEnd: ago(60) }),          // متلكئ
    P('9', 'مشروع شارف وتأخر 10 أيام', 100, 92, 300000000, 300000000, 'مستمر', { planEnd: ago(10) }),               // لا: 30 يوماً أو أقل
    P('10', 'مشروع شارف ومستحقاته غير مصروفة', 100, 92, 300000000, 200000000, 'مستمر', { planEnd: ago(60) }),        // لا: المرفوع ≠ المصروف
    P('11', 'مشروع شارف والتأخير من جهة التعاقد', 100, 92, 300000000, 300000000, 'مستمر', { planEnd: ago(60), notes: 'التأخير بسبب جهة التعاقد' }),   // لا
    P('12', 'مشروع فعلي 85 متأخر', 100, 85, 300000000, 300000000, 'مستمر', { planEnd: ago(60) })                   // لا: أقل من 90% والانحراف 15%
  ], links: {}, meta: {} }));
  const app = await electron.launch({ executablePath: require('electron'), args: ['--no-sandbox', __dirname], env: { ...process.env, UNI_MULTI: mk('u'), UNI_DATA_DIR: DD, ANBAR_REG_DIR: RG, UNI_AC_PORT: '48593', UNI_NO_JSONSCAN: '1', UNI_NO_LINKREFRESH: '1', UNI_NO_INTRO: '1' } });
  const pg = await app.firstWindow(); await sleep(1500); await pg.evaluate(() => window.desktop.go('sit')); await sleep(2000);
  const st = await pg.evaluate(() => ({ chips: [...document.querySelectorAll('#tbl tr[data-fn]')].filter(tr => tr.querySelector('.chip.tlk')).map(tr => tr.dataset.fn).sort(), kpi: (document.querySelector('[data-kfx=tlk] b') || {}).textContent }));
  ok('marked «متلكئ **»: 1 (no advance), 2 (paid = raised) and 8 (92%, planned 100%, 60 days past the date, paid = raised)', JSON.stringify(st.chips) === '["1","2","8"]', JSON.stringify(st));
  ok('summary card counts 3 stalled projects', st.kpi === '3', st.kpi);
  await pg.evaluate(() => document.querySelector('[data-kfx=tlk]').click()); await sleep(800);
  const fl = await pg.evaluate(() => [...document.querySelectorAll('#tbl tr[data-fn]')].map(tr => tr.dataset.fn).sort());
  ok('clicking it filters the list to the stalled projects', JSON.stringify(fl) === '["1","2","8"]', JSON.stringify(fl));
  const c8 = await pg.evaluate(async () => { window.SitOpen('8'); await new Promise(r => setTimeout(r, 600)); const a = (document.querySelector('#drawer .tlkbox') || {}).textContent || ''; window.SitOpen('10'); await new Promise(r => setTimeout(r, 600)); const b = (document.querySelector('#drawer .tlkno') || {}).textContent || ''; window.SitOpen('11'); await new Promise(r => setTimeout(r, 600)); const c = (document.querySelector('#drawer .tlkno') || {}).textContent || ''; window.SitOpen('9'); await new Promise(r => setTimeout(r, 600)); const d = !!document.querySelector('#drawer .tlkbox,#drawer .tlkno'); return [a, b, c, d]; });
  ok('second rule in the card: «الإنجاز الفعلي 92% والمخطط 100% ومضى 60 يوماً … أكثر من 30 يوماً، والمصروف يساوي المرفوع»', /الإنجاز الفعلي 92% والمخطط 100% ومضى 60 يوماً/.test(c8[0]) && /أكثر من 30 يوماً/.test(c8[0]) && /المصروف يساوي المرفوع/.test(c8[0]) && /يجب إكمال الإجراءات القانونية/.test(c8[0]), c8[0].slice(0, 300));
  ok('second rule not applied: dues unpaid → «تأخر صرف المستحقات»; delay caused by the contracting party → «سبب يعود لجهة التعاقد»; only 10 days late → nothing', /تأخر صرف المستحقات/.test(c8[1]) && /سبب يعود لجهة التعاقد/.test(c8[2]) && c8[3] === false, JSON.stringify(c8.slice(1)).slice(0, 300));
  await pg.evaluate(() => window.SitOpen('2')); await sleep(1000);
  const b2 = await pg.evaluate(() => (document.querySelector('#drawer .tlkbox') || {}).textContent || '');
  ok('card: «متلكئ **», the rule and «يجب إكمال الإجراءات القانونية بحق الشركة»', /متلكئ \*\*/.test(b2) && /يجب إكمال الإجراءات القانونية بحق الشركة/.test(b2) && /المصروف يساوي المرفوع/.test(b2) && /رقم \(1\) لسنة 2025/.test(b2) && /رقم \(2\) لسنة 2014/.test(b2), b2.slice(0, 300));
  const n3 = await pg.evaluate(async () => { window.SitOpen('3'); await new Promise(r => setTimeout(r, 600)); const a = (document.querySelector('#drawer .tlkno') || {}).textContent || ''; window.SitOpen('4'); await new Promise(r => setTimeout(r, 600)); const b = (document.querySelector('#drawer .tlkno') || {}).textContent || ''; window.SitOpen('7'); await new Promise(r => setTimeout(r, 600)); const c = (document.querySelector('#drawer .tlkno') || {}).textContent || ''; return [a, b, c]; });
  ok('not stalled — delayed dues (raised but unpaid), site not handed over, change order delayed — with the reason shown', /تأخر صرف المستحقات/.test(n3[0]) && /عدم تسليم الموقع/.test(n3[1]) && /تأخر إصدار أمر تغيير/.test(n3[2]), JSON.stringify(n3).slice(0, 300));
  await pg.evaluate(() => { window.confirm = () => true; window.SitOpen('1'); }); await sleep(800);
  await pg.evaluate(() => document.querySelector('#drawer [data-tlkex="occ"]').click()); await sleep(1200);
  const a1 = await pg.evaluate(() => ({ box: !!document.querySelector('#drawer .tlkbox'), no: (document.querySelector('#drawer .tlkno') || {}).textContent || '', kpi: (document.querySelector('[data-kfx=tlk] b') || {}).textContent }));
  ok('the department can record an exclusion (site occupied by another party) → no longer stalled', !a1.box && /إشغال الموقع من جهة أخرى/.test(a1.no) && /باختيار القسم/.test(a1.no) && a1.kpi === '2', JSON.stringify(a1));
  await pg.evaluate(() => document.querySelector('#drawer [data-tlkex="-"]').click()); await sleep(1200);
  ok('«إلغاء» restores the stalled mark', await pg.evaluate(() => !!document.querySelector('#drawer .tlkbox')));
  const e = await app.evaluate(() => (global.__uniErrors || []).slice()); ok('no JavaScript errors', e.length === 0, e.join(' | ').slice(0, 300));
  await app.close(); R.forEach(x => console.log(x[0], x[1], x[2] ? '— ' + String(x[2]).slice(0, 300) : '')); console.log(`${R.filter(x => x[0] === 'PASS').length}/${R.length}`); process.exit(R.every(x => x[0] === 'PASS') ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
