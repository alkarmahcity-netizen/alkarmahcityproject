// استيراد أرشيف أوامر التغيير القديم (Table1 — Excel أو Access) وأرقام الاستمارات:
//  • كل أمر مستورد رقم استمارته = رقمه التسلسلي (ID) في الملف، والعداد = آخر رقم في الملف (+1 للقادمة).
//  • مشروع أُدخل في البرنامج وموجود في الملف: يُربط بالملف (لا يُكرَّر)، ويأخذ أمره رقم الملف، وتُضاف أوامره الناقصة فقط.
//  • إعادة الاستيراد: الأمر الذي تغيّر رقمه يرجع إلى رقم الملف بعد الموافقة، ولا يُضاف شيء مكرر.
//  • العداد لا ينزل أبداً بملف أقدم.
// الاستعمال: CO_XLSX=<Table1.xlsx> xvfb-run -a node test-coimport.js
const { _electron: electron } = require('playwright'); const fs = require('fs'), path = require('path'), os = require('os');
const X = process.env.CO_XLSX; if (!X || !fs.existsSync(X)) { console.log('SKIP: CO_XLSX not set'); process.exit(0); }
const sleep = ms => new Promise(r => setTimeout(r, ms)); const R = []; const ok = (n, c, d = '') => R.push([c ? 'PASS' : 'FAIL', n, d]);
(async () => { const T = fs.mkdtempSync(path.join(os.tmpdir(), 'coimp-')); const mk = n => { const d = path.join(T, n); fs.mkdirSync(d); return d; };
  const DD = mk('d'); fs.writeFileSync(path.join(DD, 'auth.json'), JSON.stringify({ co: null }));
  const app = await electron.launch({ executablePath: require('electron'), args: ['--no-sandbox', __dirname], env: { ...process.env, UNI_MULTI: mk('u'), UNI_DATA_DIR: DD, ANBAR_REG_DIR: mk('r'), UNI_AC_PORT: '48515', UNI_NO_JSONSCAN: '1', UNI_NO_LINKREFRESH: '1', UNI_TEST_ACCESS_FILE: X } });
  const pg = await app.firstWindow(); await pg.waitForLoadState('domcontentloaded'); await sleep(1500);
  await pg.evaluate(() => window.desktop.go('co')); await sleep(2500);
  const V = c => app.evaluate(async (_, c) => global.__uni.views.co.webContents.executeJavaScript(c), c);
  const imp = async (ans = true) => V(`(async()=>{window.__m=[];window.confirm=t=>{window.__m.push(t);return ${ans}};window.alert=t=>{window.__m.push('ALERT '+t)};window.flash=()=>{};await importAccess();await new Promise(r=>setTimeout(r,300));return window.__m})()`);
  const st = () => V(`(()=>{const L=DB.records.flatMap(r=>r.orders.map(o=>({r,o})));const nm=t=>String(t||'').replace(/[أإآ]/g,'ا');
    const fl=DB.records.filter(r=>nm(r.project.name).includes('الممر الثاني لجسر الفلوجة الحديدي'));
    return {recs:DB.records.length,ords:L.length,bad:L.filter(x=>x.o.legacy&&+x.o.legacy.id>0&&String(x.o.formNo)!==String(x.o.legacy.id)).length,next:nextForm(),
      fl:fl.map(r=>({n:r.orders.length,f:r.orders.map(o=>o.formNo),xids:(r.xids||[]).length,legacy:!!r.legacy}))}})()`);
  // مشروع أُدخل في البرنامج قبل الاستيراد: أمره الرابع في الملف (0 / 0 / 218,500,000 — رقمه في الملف 613) برقم استمارة يدوي 55
  await V(`(()=>{const r=newRecord();r.project.name='إنشاء الممر الثاني لجسر الفلوجة الحديدي';r.orders[0]=Object.assign(newOrder(),{formNo:'55',del:0,add:0,nw:218500000,date:'2023-11-16'});DB.records.push(r);persist();return 1})()`);
  let m = await imp(); let s = await st();
  ok('import: message shows the counter from the file (last 2386 → next 2387) and the link', /آخر رقم تسلسلي في الملف 2386/.test(m[0]) && /2387/.test(m[0]) && /ربط 1 مشروع/.test(m[0]), m[0].slice(-600));
  ok('import: 1,132 projects and 1,861 change orders (the manual project linked, not duplicated)', s.recs === 1132 && s.ords === 1861, JSON.stringify({ recs: s.recs, ords: s.ords }));
  ok('every imported order: form number = its serial (ID) in the file', s.bad === 0, 'bad=' + s.bad);
  ok('the manual project: one file, 5 orders, its order got the file number 613 (was 55), file IDs kept in xids not legacy', s.fl.length === 1 && s.fl[0].n === 5 && s.fl[0].f.includes('613') && !s.fl[0].f.includes('55') && s.fl[0].xids > 0 && !s.fl[0].legacy, JSON.stringify(s.fl));
  ok('the manual project\'s orders follow the file\'s numbers in date order', JSON.stringify(s.fl[0].f) === JSON.stringify(['198', '464', '', '613', '2344']), JSON.stringify(s.fl[0].f));
  ok('counter: next form 2387', s.next === '2387', s.next);
  // تغيير رقم أمر مستورد ثم إعادة الاستيراد
  await V(`(()=>{const r=DB.records.find(r=>r.orders.length>2&&r.legacy&&r.orders[1].legacy&&+r.orders[1].legacy.id>0);window.__r=r.id;r.orders[1].formNo='7';persist();return 1})()`);
  m = await imp(); s = await st();
  ok('re-import: lists the order whose number differs (7 ← file number) and adds nothing', /يصبح رقم 1 أمر/.test(m[0]) && /7 ← /.test(m[0]) && /لا توجد أوامر جديدة/.test(m[0]), m[0].slice(-500));
  ok('…after approval the number is back to the file number, nothing duplicated', s.bad === 0 && s.recs === 1132 && s.ords === 1861, JSON.stringify({ bad: s.bad, recs: s.recs, ords: s.ords }));
  // رفض التصحيح لا يغيّر شيئاً
  await V(`(()=>{const r=DB.records.find(r=>r.id===window.__r);r.orders[1].formNo='8';persist();return 1})()`);
  m = await imp(false); s = await st();
  ok('refusing the correction changes nothing', s.bad === 1, 'bad=' + s.bad);
  await V(`(()=>{const r=DB.records.find(r=>r.id===window.__r);r.orders[1].formNo=String(r.orders[1].legacy.id);persist();return 1})()`);
  // العداد الحالي أعلى من الملف (ملف قديم): لا ينزل
  await V(`(()=>{DB.settings.lastForm=2500;persist();return 1})()`);
  m = await imp(); s = await st();
  ok('older file than the counter: the counter is NOT lowered (next stays 2501)', s.next === '2501' && /فيبقى كما هو/.test(m[0]), s.next + ' | ' + (m[0] || '').slice(-200));
  const e = await app.evaluate(() => (global.__uniErrors || []).slice()); ok('no JavaScript errors', e.length === 0, e.join(' | ').slice(0, 300));
  await app.close();
  R.forEach(x => console.log(x[0], x[1], x[2] ? '— ' + String(x[2]).slice(0, 400) : '')); console.log(`${R.filter(x => x[0] === 'PASS').length}/${R.length}`); process.exit(R.every(x => x[0] === 'PASS') ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
