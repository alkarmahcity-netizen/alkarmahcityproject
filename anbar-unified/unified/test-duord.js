// المدد: بنود القرار في الأمر الإداري (بعد «تقرر ما يلي») قابلة للتعديل من اللجنة — بالضغط عليها في المعاينة، وإضافة/حذف بند، واسترجاع التلقائي
const { _electron: electron } = require('playwright'); const fs = require('fs'), path = require('path'), os = require('os');
const sleep = ms => new Promise(r => setTimeout(r, ms)); const R = []; const ok = (n, c, d = '') => R.push([c ? 'PASS' : 'FAIL', n, d]);
(async () => { const T = fs.mkdtempSync(path.join(os.tmpdir(), 'duord-')); const mk = n => { const d = path.join(T, n); fs.mkdirSync(d); return d; };
  const DD = mk('d'); fs.writeFileSync(path.join(DD, 'auth.json'), JSON.stringify({ du: null }));
  const launch = () => electron.launch({ executablePath: require('electron'), args: ['--no-sandbox', __dirname], env: { ...process.env, UNI_MULTI: path.join(T, 'u'), UNI_DATA_DIR: DD, ANBAR_REG_DIR: path.join(T, 'r'), UNI_AC_PORT: '48522', UNI_NO_JSONSCAN: '1', UNI_NO_LINKREFRESH: '1', UNI_NO_INTRO: '1' } });
  let app = await launch(); let pg = await app.firstWindow(); await pg.waitForLoadState('domcontentloaded'); await sleep(1500);
  await pg.evaluate(() => window.desktop.go('du')); await sleep(2500);
  let V = c => app.evaluate(async (_, c) => global.__uni.views.du.webContents.executeJavaScript(c), c);
  await V(`window.confirm=()=>true;document.getElementById('bDemo').click();1`); await sleep(2500);
  await V(`(()=>{selExt(0);const ps=document.getElementById('printSel');ps.value='o';upd();return 1})()`); await sleep(1500);
  const items = () => V(`JSON.stringify([...document.querySelectorAll('#out .pd #ordBox .lt')].map(x=>x.textContent.trim()))`).then(JSON.parse);
  const auto = await items();
  ok('order items are editable on the page (automatic text by default)', auto.length >= 2 && /منح الشركة مدة إضافية/.test(auto[0]) && await V(`document.querySelector('#ordBox .lt').isContentEditable&&!document.querySelector('#ordBox').classList.contains('custom')`), JSON.stringify(auto));
  ok('«قرار الأمر الإداري» controls in the order section', await V(`!!document.getElementById('ordHint')&&!!document.getElementById('ordReset')&&[...document.querySelectorAll('#ordSec button')].some(b=>/إضافة بند/.test(b.textContent))`));
  // تعديل البند الأول بالكتابة في المعاينة
  await V(`(()=>{const x=document.querySelector('#ordBox .lt');x.focus();x.innerHTML='منح الشركة مدة إضافية قدرها ( <b>٣٠</b> ) يوماً فقط بعد التعديل من اللجنة.';x.dispatchEvent(new Event('input'));x.blur();return 1})()`); await sleep(1500);
  let it = await items();
  ok('editing an item keeps it (custom) after re-render', /بعد التعديل من اللجنة/.test(it[0]) && it.length === auto.length && await V(`document.querySelector('#ordBox').classList.contains('custom')&&!!S.exts[0].ordItems`), JSON.stringify(it));
  await V(`(()=>{S.exts[0].granted='99';upd();return 1})()`); await sleep(1500); it = await items();
  ok('changing the request fields does not overwrite the edited items', /بعد التعديل من اللجنة/.test(it[0]));
  await V(`[...document.querySelectorAll('#ordSec button')].find(b=>/إضافة بند/.test(b.textContent)).click();1`); await sleep(1500);
  await V(`(()=>{const L=document.querySelectorAll('#ordBox .lt');const x=L[L.length-1];x.textContent='تلتزم الشركة بتقديم جدول تقدم عمل محدث خلال 15 يوماً.';x.dispatchEvent(new Event('input'));x.blur();return 1})()`); await sleep(1500); it = await items();
  ok('«+ إضافة بند» adds a numbered item at the end', it.length === auto.length + 1 && /جدول تقدم عمل/.test(it[it.length - 1]) && await V(`document.querySelectorAll('#ordBox .lno')[${auto.length}].textContent.trim()==='${['١','٢','٣','٤','٥','٦'][auto.length]} -'`), JSON.stringify(it));
  // يبقى بعد إعادة التشغيل
  await sleep(1500); await app.close();
  app = await launch(); pg = await app.firstWindow(); await pg.waitForLoadState('domcontentloaded'); await sleep(1500);
  await pg.evaluate(() => window.desktop.go('du')); await sleep(3000);
  V = c => app.evaluate(async (_, c) => global.__uni.views.du.webContents.executeJavaScript(c), c);
  await V(`(()=>{selExt(0);const ps=document.getElementById('printSel');ps.value='o';upd();return 1})()`); await sleep(1500); it = await items();
  ok('edited items are saved with the file (after restart)', /بعد التعديل من اللجنة/.test(it[0]) && /جدول تقدم عمل/.test(it[it.length - 1]), JSON.stringify(it));
  await V(`[...document.querySelectorAll('#ordSec button')].find(b=>/حذف آخر بند/.test(b.textContent)).click();1`); await sleep(1500); it = await items();
  ok('«حذف آخر بند» removes the last item', it.length === auto.length && !/جدول تقدم عمل/.test(it.join()));
  await V(`document.getElementById('ordReset').click();1`); await sleep(1500); it = await items();
  ok('«استرجاع البنود التلقائية» restores the automatic items (with the new days)', !/بعد التعديل/.test(it.join()) && /٩٩/.test(it[0]) && !S_ord_custom(await V(`!!S.exts[0].ordItems`)), JSON.stringify(it));
  function S_ord_custom(x) { return x; }
  // أمر الإعفاء أيضاً
  await V(`(()=>{const e=newExt(9);e.kind='fine';e.granted='20';S.exts.push(e);selExt(S.exts.length-1);const ps=document.getElementById('printSel');ps.value='o';upd();return 1})()`); await sleep(1500);
  await V(`(()=>{const x=document.querySelector('#ordBox .lt');x.focus();x.textContent='اعفاء الشركة من الغرامات عن الفترة المعدّلة يدوياً.';x.dispatchEvent(new Event('input'));x.blur();return 1})()`); await sleep(1500); it = await items();
  ok('exemption order items are editable too', /المعدّلة يدوياً/.test(it[0]) && /امر اداري/.test(await V(`document.querySelector('#out .pd').textContent`)), JSON.stringify(it));
  const e = await app.evaluate(() => (global.__uniErrors || []).slice()); ok('no JavaScript errors', e.length === 0, e.join(' | ').slice(0, 300));
  await app.close();
  R.forEach(x => console.log(x[0], x[1], x[2] ? '— ' + String(x[2]).slice(0, 300) : '')); console.log(`${R.filter(x => x[0] === 'PASS').length}/${R.length}`); process.exit(R.every(x => x[0] === 'PASS') ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
