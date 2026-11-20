// اختبار «تقرير زيارة مشاريع التنفيذ أمانة» (برنامج FieldVisitReport مدمجاً في الموحد):
//  • تبويب في الشريط العلوي، والصفحة الأصلية تعمل (المعاينة تتحدث من الحقول).
//  • الحفظ التلقائي في ملف بيانات النظام (FieldVisit-Data.json) ويبقى بعد إعادة الفتح.
//  • لوحة المعلومات: العدد والتوصيات ومتوسط الإنجاز والجودة، والبحث، وفتح تقرير، وتقرير جديد، والحذف.
const { _electron: electron } = require('playwright');
const fs = require('fs'), path = require('path'), os = require('os');
const T = path.join(os.tmpdir(), 'uni-fv'); fs.rmSync(T, { recursive: true, force: true });
const mk = n => { const d = path.join(T, n); fs.mkdirSync(d, { recursive: true }); return d; }; const sleep = ms => new Promise(r => setTimeout(r, ms));
const R = []; const ok = (n, c, d = '') => R.push([c ? 'PASS' : 'FAIL', n, d]);
(async () => {
  const DD = mk('d'), env = { ...process.env, UNI_MULTI: mk('u'), UNI_DATA_DIR: DD, ANBAR_REG_DIR: mk('r'), UNI_AC_PORT: '48453', UNI_NO_JSONSCAN: '1', UNI_NO_LINKREFRESH: '1' };
  let app = await electron.launch({ executablePath: require('electron'), args: ['--no-sandbox', __dirname], env });
  let pg = await app.firstWindow(); await pg.waitForLoadState('domcontentloaded'); await sleep(1500);
  ok('the top bar has the tab «تقرير زيارة مشاريع التنفيذ أمانة»', await pg.evaluate(() => !!document.querySelector('.tab[data-go="fv"]') && /تقرير زيارة مشاريع التنفيذ أمانة/.test(document.querySelector('.tab[data-go="fv"]').textContent)));
  await pg.evaluate(() => window.desktop.go('fv')); await sleep(2500);
  const fv = c => app.evaluate(async (_, c) => global.__uni.views.fv.webContents.executeJavaScript(c), c);
  ok('the original report page loads inside the program with the reports bar', await fv(`!!document.getElementById('sheet')&&!!document.getElementById('fvBar')&&/لوحة التقارير/.test(document.getElementById('fvBar').textContent)`));
  const typ = (id, v) => fv(`(()=>{const e=document.getElementById('${id}');e.value=${JSON.stringify(v)};e.dispatchEvent(new Event('input',{bubbles:true}));return 1})()`);
  const radio = (g, v) => fv(`(()=>{const e=document.querySelector('input[name="${g}"][value="${v}"]');e.checked=true;e.dispatchEvent(new Event('change',{bubbles:true}));return 1})()`);
  await typ('f_project', 'تأهيل مدرسة الكرمة الابتدائية'); await typ('f_followup', 'الكرمة'); await typ('f_progress', '65'); await radio('quality', 'جيد'); await radio('rec', 'قبول');
  await sleep(1500);
  ok('the preview updates from the fields (original page behaviour)', /تأهيل مدرسة الكرمة الابتدائية/.test(await fv(`document.querySelector('.title').textContent`)));
  const file = path.join(DD, 'FieldVisit-Data.json');
  const j1 = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
  ok('auto-saved to the system data file FieldVisit-Data.json (synced like the other systems)', j1 && j1.records.length === 1 && j1.records[0].d.f_project === 'تأهيل مدرسة الكرمة الابتدائية' && j1.records[0].d.g_rec === 'قبول', JSON.stringify(j1).slice(0, 300));
  // تقرير ثانٍ
  await fv(`document.querySelector('#fvBar [data-fv=new]').click()`); await sleep(300);
  ok('«＋ تقرير جديد» clears the form', (await fv(`document.getElementById('f_project').value`)) === '');
  await typ('f_project', 'إنشاء مجسر هيت'); await typ('f_followup', 'هيت'); await typ('f_progress', '35'); await radio('quality', 'مقبول'); await radio('rec', 'رفض'); await sleep(1500);
  await fv(`document.querySelector('#fvBar [data-fv=dash]').click()`); await sleep(300);
  const d = await fv(`document.getElementById('fvDash').textContent.replace(/\\s+/g,' ')`);
  ok('dashboard: 2 reports, 1 accept, 1 reject, average progress 50%, by quality and committee', /2\s*تقرير محفوظ/.test(d) && /1\s*توصية بالقبول/.test(d) && /1\s*توصية بالرفض/.test(d) && /50%\s*متوسط نسبة الإنجاز/.test(d) && /الكرمة/.test(d) && /هيت/.test(d), d.slice(0, 500));
  await fv(`(()=>{const q=document.getElementById('fvQ');q.value='هيت';q.dispatchEvent(new Event('input',{bubbles:true}));return 1})()`); await sleep(200);
  const rows = await fv(`document.querySelectorAll('#fvDash tr.r').length`);
  ok('search filters the list', rows === 1, String(rows));
  await fv(`(()=>{const q=document.getElementById('fvQ');q.value='';q.dispatchEvent(new Event('input',{bubbles:true}));return 1})()`); await sleep(200);
  await fv(`[...document.querySelectorAll('#fvDash tr.r')].find(r=>/الكرمة/.test(r.textContent)).click()`); await sleep(500);
  ok('opening a report from the dashboard restores all its fields (project, progress, quality, recommendation)', JSON.parse(await fv(`JSON.stringify([document.getElementById('f_project').value,document.getElementById('f_progress').value,(document.querySelector('input[name=quality]:checked')||{}).value,(document.querySelector('input[name=rec]:checked')||{}).value])`)).join('|') === 'تأهيل مدرسة الكرمة الابتدائية|65|جيد|قبول');
  await app.close();
  // إعادة الفتح: التقارير باقية
  app = await electron.launch({ executablePath: require('electron'), args: ['--no-sandbox', __dirname], env });
  pg = await app.firstWindow(); await pg.waitForLoadState('domcontentloaded'); await sleep(1500);
  await pg.evaluate(() => window.desktop.go('fv')); await sleep(2500);
  ok('after restarting the program the reports are still there (dashboard shows 2)', /2\s*تقرير محفوظ/.test(await fv(`document.getElementById('fvDash').textContent.replace(/\\s+/g,' ')`)));
  await fv(`(()=>{window.confirm=()=>true;[...document.querySelectorAll('#fvDash tr.r')].find(r=>/هيت/.test(r.textContent)).querySelector('[data-del]').click();return 1})()`); await sleep(800);
  const j2 = JSON.parse(fs.readFileSync(file, 'utf8'));
  ok('delete removes the report from the file', j2.records.length === 1 && !j2.records.some(r => /هيت/.test(r.d.f_project)), String(j2.records.length));
  ok('the reports bar and dashboard are hidden when printing', await fv(`[...document.styleSheets].some(ss=>{try{return [...ss.cssRules].some(r=>/print/.test(r.cssText)&&/#fvBar/.test(r.cssText))}catch(_){return false}})`));
  const e = await app.evaluate(() => (global.__uniErrors || []).slice()); ok('no JavaScript errors', e.length === 0, e.join(' | ').slice(0, 400));
  await app.close();
  R.forEach(x => console.log(x[0], x[1], x[2] ? '— ' + String(x[2]).slice(0, 500) : '')); console.log(`${R.filter(x => x[0] === 'PASS').length}/${R.length}`); process.exit(R.every(x => x[0] === 'PASS') ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
