// اختبار «🔍 مراجعة ملف أمر التغيير» (Excel) و«الكلفة المصادقة» في أوامر التغيير:
//  حساب الفقرات (الكمية × السعر)، المجاميع مقابل مبالغ الأمر في النظام، والمطالعة المرتبطة بالأمر (الفقرات وكمياتها والمبالغ)، وحفظ المراجعة Excel.
const { _electron: electron } = require('playwright');
const fs = require('fs'), path = require('path'), os = require('os');
const XLW = require('./shell/xlwriter.js');
const T = path.join(os.tmpdir(), 'uni-coreview'); fs.rmSync(T, { recursive: true, force: true });
const mk = n => { const d = path.join(T, n); fs.mkdirSync(d, { recursive: true }); return d; }; const sleep = ms => new Promise(r => setTimeout(r, ms));
const R = []; const ok = (n, c, d = '') => R.push([c ? 'PASS' : 'FAIL', n, d]);
(async () => {
  const c = v => v == null ? null : { v };
  const rows = [['جدول أمر التغيير رقم (1)'], ['اسم المشروع : مدرسة الاختبار'], [],
    ['ت', 'تفاصيل الفقرة', 'الوحدة', 'الكمية الأصلية', 'الكمية بعد التغيير', 'الكمية المحذوفة', 'الكمية المضافة', 'سعر المفرد', 'المبلغ'],
    [1, 'حفريات الأسس بالطرق الميكانيكية', 'م3', 100, 80, 20, null, 10000, 200000],
    [2, 'صب خرسانة مسلحة للسقوف', 'م3', 50, 70, null, 20, 150000, 3000000],
    [3, 'تجهيز ونصب مقرنص حجري', 'م.ط', 0, 10, null, null, 50000, 600000]].map(r => r.map(c));
  const X = path.join(T, 'co-order.xlsx'); fs.mkdirSync(T, { recursive: true }); fs.writeFileSync(X, XLW.book([{ name: 'أمر التغيير', rows }]));
  const DD = mk('d'); fs.writeFileSync(path.join(DD, 'auth.json'), JSON.stringify({ co: null, cm: null }));   // قفل أوامر التغيير مُعطّل في مجلد بيانات الاختبار المؤقت فقط
  fs.writeFileSync(path.join(DD, 'ChangeOrderMemos-Data.json'), JSON.stringify({ records: [{ id: 'm1', type: 'memo', fileNo: '7001', ltEv: 'order:0', subject: 'مطالعة الموافقة الأصولية', no: '55', date: '2026-11-18',
    body: 'الحذف: حفريات الأسس بالطرق الميكانيكية حذف 20 م3 من أصل 100 م3. الإضافة: صب خرسانة مسلحة للسقوف إضافة 25 م3. المبلغ المطلوب (3,300,000) دينار والمبلغ (4,750,000)' }] }));
  const app = await electron.launch({ executablePath: require('electron'), args: ['--no-sandbox', __dirname], env: { ...process.env, UNI_MULTI: mk('u'), UNI_DATA_DIR: DD, ANBAR_REG_DIR: mk('r'), UNI_AC_PORT: '48491', UNI_NO_JSONSCAN: '1', UNI_NO_LINKREFRESH: '1' } });
  const pg = await app.firstWindow(); await pg.waitForLoadState('domcontentloaded'); await sleep(1500);
  await pg.evaluate(() => window.desktop.go('co')); await sleep(2500);
  const co = s => app.evaluate(async (_, s) => global.__uni.views.co.webContents.executeJavaScript(s), s);
  await co(`(()=>{window.confirm=()=>true;document.querySelector('[data-act=new]').click();return 1})()`); await sleep(1200);
  await co(`(()=>{const r=R();r.project.fileNo='7001';r.project.name='مدرسة الاختبار';const o=r.orders[0];o.del=200000;o.add=3000000;o.nw=500000;touch();renderBar();renderCoMemos();renderForm();return 1})()`); await sleep(500);
  ok('the change-order editor has «🔍 مراجعة ملف أمر التغيير»', await co(`!!document.querySelector('[data-rvgo]')`));
  const b64 = fs.readFileSync(X).toString('base64');
  const res = JSON.parse(await co(`(async()=>{const b=Uint8Array.from(atob('${b64}'),c=>c.charCodeAt(0));const f=new File([b],'co-order.xlsx');const r=await CoReview.load(f);
    return JSON.stringify({rows:r.rows.map(x=>({d:x.x.desc,t:x.x.type,q:x.x.q,iss:x.iss})),tot:r.tot,memos:r.memos.map(m=>({s:m.s,it:m.it.map(i=>({d:i.x.desc,st:i.st,found:i.found})),am:m.am,strange:m.strange})),bad:r.bad});})()`));
  ok('the Excel file is read: 3 items classified delete / add / new', res.rows.length === 3 && res.rows.map(x => x.t).join() === 'del,add,new', JSON.stringify(res.rows));
  ok('item arithmetic: the new item 10 × 50,000 ≠ 600,000 is flagged; the other two are correct', res.rows[2].iss.some(x => /الكمية × السعر/.test(x)) && !res.rows[0].iss.length && !res.rows[1].iss.length, JSON.stringify(res.rows.map(x => x.iss)));
  const tt = Object.fromEntries(res.tot.map(t => [t.l, t]));
  ok('totals vs the system: deleted and added match, new works (600,000 in file vs 500,000) and the net do not', tt['الأعمال المحذوفة'].ok && tt['الأعمال المضافة'].ok && !tt['الأعمال المستحدثة'].ok && !tt['صافي أمر التغيير'].ok, JSON.stringify(res.tot));
  const m = res.memos[0] || { it: [], am: [] }, st = Object.fromEntries(m.it.map(i => [i.d, i.st]));
  ok('the approval memo of this order is checked: item 1 ✓, item 2 different quantity (25 vs 20), item 3 not mentioned', st['حفريات الأسس بالطرق الميكانيكية'] === 'ok' && st['صب خرسانة مسلحة للسقوف'] === 'diff' && st['تجهيز ونصب مقرنص حجري'] === 'miss', JSON.stringify(m.it));
  ok('memo amounts: the system net 3,300,000 is found; 4,750,000 is reported as matching nothing', m.am.some(a => /النظام/.test(a.l) && a.ok) && m.strange.includes(4750000), JSON.stringify(m));
  const txt = await co(`document.getElementById('rvOv').textContent`);
  if (process.env.UNI_TEST_SHOT) { console.log('VIS', await co(`(()=>{const o=document.getElementById('rvOv');const cs=getComputedStyle(o);const e=document.elementFromPoint(innerWidth/2,innerHeight/2);return cs.display+' '+cs.zIndex+' '+(e&&e.closest('#rvOv')?'top':'under:'+(e&&e.className))+' chip:'+!!document.querySelector('[data-rvshow]')})()`)); await sleep(1500); const b = await app.evaluate(async () => { const im = await global.__uni.views.co.webContents.capturePage(); return im.toPNG().toString('base64'); }); fs.writeFileSync(process.env.UNI_TEST_SHOT, Buffer.from(b, 'base64')); }
  ok('the review window shows the totals, items and memo sections', /المجاميع/.test(txt) && /الفقرات/.test(txt) && /المطالعات/.test(txt) && /ملاحظة تحتاج تدقيقاً/.test(txt), txt.slice(0, 200));
  ok('the last review is kept with the order and shown as a chip', /📋 فقرات الأمر \(3\)/.test(await co(`document.getElementById('coMemos').textContent`)) && (await co(`R().orders[0].review.bad`)) === res.bad);
  await co(`(()=>{window.__xl=null;window.saveFile=(n,b)=>{b.arrayBuffer().then(x=>{const u=new Uint8Array(x);window.__xl={n,len:u.length,pk:String.fromCharCode(u[0],u[1])};});return Promise.resolve(true);};document.querySelector('[data-rvx=xl]').click();return 1})()`);
  await sleep(800); const xl = JSON.parse(await co(`JSON.stringify(window.__xl)`) || 'null');
  ok('«⬇ حفظ المراجعة (Excel)» produces an .xlsx file', xl && /\.xlsx$/.test(xl.n) && xl.pk === 'PK' && xl.len > 2000, JSON.stringify(xl));
  // صلاحية اللجنة: تصحيح الفقرة وتعديل كميتها وسعرها وحذفها
  await co(`(()=>{CoReview.open();CoReview.edit(2,'st','fix');return 1})()`); await sleep(300);
  let t2 = JSON.parse(await co(`JSON.stringify(CoReview.last().tot)`));
  ok('committee marks item 3 corrected → amount = 10 × 50,000 = 500,000 and the new-works total now matches the system', t2.find(t => t.l === 'الأعمال المستحدثة').c === 500000 && t2.find(t => t.l === 'الأعمال المستحدثة').ok, JSON.stringify(t2));
  await co(`(()=>{CoReview.edit(1,'q','25');CoReview.edit(1,'cnote','حسب الذرعة الموقعية');CoReview.edit(0,'st','cut');CoReview.edit(0,'cnote','لا مسوغ للحذف');return 1})()`); await sleep(300);
  const it = JSON.parse(await co(`JSON.stringify(R().orders[0].items.map(x=>({st:x.st,q:x.q,q0:x.q0,pr:x.pr,cn:x.cnote})))`));
  ok('editing a quantity marks the item «مصحّحة»; the file values are kept; «محذوفة من اللجنة» works; saved with the order', it[1].st === 'fix' && it[1].q === '25' && it[1].q0 === '20' && it[1].cn === 'حسب الذرعة الموقعية' && it[0].st === 'cut' && it[2].st === 'fix', JSON.stringify(it));
  t2 = JSON.parse(await co(`JSON.stringify(CoReview.last().tot)`));
  ok('committee totals: deleted 0, added 25 × 150,000 = 3,750,000, new 500,000, net 4,250,000 (system not yet changed)', t2.find(t => t.l === 'الأعمال المضافة').c === 3750000 && (t2.find(t => t.l === 'الأعمال المحذوفة') || { c: 0 }).c === 0 && t2.find(t => t.net).c === 4250000 && !t2.find(t => t.net).ok, JSON.stringify(t2));
  if (process.env.UNI_TEST_SHOT) { await sleep(800); const b = await app.evaluate(async (_, v) => { const im = await global.__uni.views[v].webContents.capturePage(); return im.toPNG().toString('base64'); }, 'co'); fs.writeFileSync(process.env.UNI_TEST_SHOT.replace('.png', '-edit.png'), Buffer.from(b, 'base64')); }
  await co(`(()=>{window.confirm=()=>true;document.querySelector('[data-rvx=apply]').click();return 1})()`); await sleep(500);
  const o1 = JSON.parse(await co(`JSON.stringify((({del,add,nw})=>({del,add,nw}))(R().orders[0]))`));
  ok('«↧ اعتماد المجاميع» puts the committee totals in the order amounts (after confirmation)', o1.del === 0 && o1.add === 3750000 && o1.nw === 500000 && JSON.parse(await co(`JSON.stringify(CoReview.last().tot.every(t=>t.ok))`)), JSON.stringify(o1));
  await co(`(()=>{document.querySelector('[data-rvx=no]').click();return 1})()`); await sleep(1200);
  const rid = await co(`R().id`);
  // مطالعات أوامر التغيير: استدعاء الفقرات باسم الشركة/المشروع
  await pg.evaluate(() => window.desktop.go('cm')); await sleep(2500);
  const cm = s => app.evaluate(async (_, s) => global.__uni.views.cm.webContents.executeJavaScript(s), s);
  await cm(`(()=>{window.confirm=()=>true;document.querySelector('[data-act=new][data-t=memo]').click();return 1})()`); await sleep(1500);
  ok('the memo editor has «📥 فقرات أمر التغيير»', await cm(`!!document.getElementById('btnCoItems')`));
  await cm(`(()=>{document.getElementById('btnCoItems').click();const q=document.getElementById('ciQ');q.value='الاختبار';q.dispatchEvent(new Event('input'));return 1})()`); await sleep(400);
  const lst = await cm(`document.getElementById('ciL').textContent`);
  ok('searching by project name finds the project and its order with 3 items', /مدرسة الاختبار/.test(lst) && /3 فقرة/.test(lst), lst.slice(0, 200));
  await cm(`(()=>{document.querySelector('#ciL [data-ci]').click();return 1})()`); await sleep(800);
  const mr = JSON.parse(await cm(`JSON.stringify((r=>({body:r.body,fn:r.fileNo,ev:r.ltEv,t:r.tables.map(t=>({src:t.src,rows:t.rows}))}))(R()))`));
  const tb = (mr.t.find(t => t.src) || { rows: [] }).rows, flat = JSON.stringify(tb);
  ok('the memo gets a table of the items with the committee values (25 at 150,000 = 3,750,000; 500,000) and the deleted item noted', /3,750,000/.test(flat) && /500,000/.test(flat) && /محذوفة من اللجنة/.test(flat) && /حسب الذرعة الموقعية/.test(flat) && /4,250,000/.test(flat), flat.slice(0, 600));
  ok('…plus the delete/add/new lines in the text, linked to the project file and the order', /\[\[جدول 1\]\]/.test(mr.body) && /صب خرسانة مسلحة للسقوف إضافة 25/.test(mr.body) && mr.fn === '7001' && mr.ev === 'order:0', mr.body.slice(0, 400));
  await sleep(1500);
  // تعديل جديد في أوامر التغيير ← تنبيه التحديث في المطالعة
  await pg.evaluate(() => window.desktop.go('co')); await sleep(1500);
  await co(`(()=>{CoReview.open();CoReview.edit(1,'pr','160000');document.querySelector('[data-rvx=no]').click();return 1})()`); await sleep(1500);
  await pg.evaluate(() => window.desktop.go('cm')); await sleep(2000);
  await cm(`(()=>{window.dispatchEvent(new Event('focus'));return 1})()`); await sleep(800);
  ok('after the committee edits again in change orders, the memo shows «↻ تحديث فقرات أمر التغيير»', await cm(`!!document.getElementById('btnCoUpd')`));
  await cm(`(()=>{document.getElementById('btnCoUpd').click();return 1})()`); await sleep(800);
  const flat2 = await cm(`JSON.stringify(R().tables.find(t=>t.src).rows)`);
  await cm(`(()=>{const s=document.getElementById('pages')||document.querySelector('.prev-col');if(s)s.scrollIntoView();return 1})()`);
  if (process.env.UNI_TEST_SHOT) { await sleep(800); const b = await app.evaluate(async (_, v) => { const im = await global.__uni.views[v].webContents.capturePage(); return im.toPNG().toString('base64'); }, 'cm'); fs.writeFileSync(process.env.UNI_TEST_SHOT.replace('.png', '-memo.png'), Buffer.from(b, 'base64')); }
  ok('updating refreshes the same table (25 × 160,000 = 4,000,000) without duplicating it', /4,000,000/.test(flat2) && (await cm(`R().tables.filter(t=>t.src).length`)) === 1 && !(await cm(`!!document.getElementById('btnCoUpd')`)), flat2.slice(0, 300));
  const e = await app.evaluate(() => (global.__uniErrors || []).slice()); ok('no JavaScript errors', e.length === 0, e.join(' | ').slice(0, 400));
  await app.close();
  R.forEach(x => console.log(x[0], x[1], x[2] ? '— ' + String(x[2]).slice(0, 600) : '')); console.log(`${R.filter(x => x[0] === 'PASS').length}/${R.length}`); process.exit(R.every(x => x[0] === 'PASS') ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
