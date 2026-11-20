// اختبار الاستلام في لوحة سير المعاملات + تنبيه رمز QR عند إصدار الشهادة.
// ملف الاستلام التنفيذي (Go) لا يعمل على لينكس: تُخدَّم صفحاته المستخرجة منه (UNI_TEST_AC_PAGES: مجلد فيه index.html و preliminary.html) على منفذ الاستلام.
// الاستعمال: UNI_TEST_AC_PAGES=<مجلد> UNI_TEST_AC_PW=<كلمة سر الاستلام> xvfb-run -a node test-acflow.js   (كلمة السر من البيئة فقط)
const { _electron: electron } = require('playwright');
const fs = require('fs'), path = require('path'), os = require('os'), http = require('http');
const PG = process.env.UNI_TEST_AC_PAGES; if (!PG || !fs.existsSync(path.join(PG, 'preliminary.html'))) { console.log('SKIP: UNI_TEST_AC_PAGES not set'); process.exit(0); }
const T = path.join(os.tmpdir(), 'uni-acflow'); fs.rmSync(T, { recursive: true, force: true });
const mk = n => { const d = path.join(T, n); fs.mkdirSync(d, { recursive: true }); return d; }; const sleep = ms => new Promise(r => setTimeout(r, ms));
const R = []; const ok = (n, c, d = '') => R.push([c ? 'PASS' : 'FAIL', n, d]);
const PORT = 48461;
(async () => {
  const srv = http.createServer((q, s) => { const u = q.url.split('?')[0]; if (u === '/__version') { s.end('test'); return; }
    const f = path.join(PG, u === '/' ? 'index.html' : path.basename(u)); if (fs.existsSync(f)) { s.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); s.end(fs.readFileSync(f)); } else { s.writeHead(404); s.end(); } });
  await new Promise(r => srv.listen(PORT, '127.0.0.1', r));
  const DD = mk('d');
  const app = await electron.launch({ executablePath: require('electron'), args: ['--no-sandbox', __dirname], env: { ...process.env, UNI_MULTI: mk('u'), UNI_DATA_DIR: DD, ANBAR_REG_DIR: mk('r'), UNI_AC_PORT: String(PORT), UNI_NO_JSONSCAN: '1', UNI_NO_LINKREFRESH: '1', UNI_FLOW_DELAY: '200' } });
  const pg = await app.firstWindow(); await pg.waitForLoadState('domcontentloaded'); await sleep(1500);
  if (process.env.UNI_TEST_AC_PW) await pg.evaluate(pw => window.desktop.unlock('ac', pw), process.env.UNI_TEST_AC_PW);
  await pg.evaluate(() => window.desktop.go('ac')); await sleep(2500);
  const ac = c => app.evaluate(async (_, c) => global.__uni.views.ac.webContents.executeJavaScript(c), c);
  await app.evaluate(async (_, p) => { const v = global.__uni.views.ac.webContents; await v.loadURL(`http://127.0.0.1:${p}/preliminary.html`); }, PORT); await sleep(2500);
  ok('the program add-on is injected into the acceptance certificate page (snapshot + QR check) with the workflow bar', await ac(`!!window.AcqCheck && !!document.getElementById('wfPanel')`));
  const stages = await ac(`[...document.querySelectorAll('#wfPanel select[data-wf=st] option')].map(o=>o.textContent).join('|')`);
  ok('acceptance stages: استلام المعاملة ← المراجعة ← التدقيق ← التوقيع ← الإنجاز', /^استلام المعاملة\|المراجعة\|التدقيق\|التوقيع\|الإنجاز/.test(stages), stages);
  // شهادة جديدة
  await ac(`(()=>{const s=(id,v)=>{const e=document.getElementById(id);e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}))};s('pName','مدرسة الكرمة الابتدائية');s('fileNo','1527');s('contractor','شركة النور');document.getElementById('btnSave').click();return 1})()`);
  await sleep(6000);
  const serial = await ac(`document.getElementById('serial').value`);
  const b1 = await pg.evaluate(() => window.desktop.wfBoard());
  const c1 = (b1.cards || []).find(c => c.sys === 'ac');
  ok('saving a new certificate adds it to the workflow board automatically (stage «استلام»)', c1 && c1.st === 'rcv' && c1.fn === '1527' && /مدرسة الكرمة/.test(c1.pj), JSON.stringify(c1 || (b1.cards || []).map(c => c.key)));
  ok('the board knows the lateness limits: advances 15, durations 15, change orders 30, acceptance 30 days', b1.lateBy && b1.lateBy.ad === 15 && b1.lateBy.du === 15 && b1.lateBy.co === 30 && b1.lateBy.ac === 30, JSON.stringify(b1.lateBy));
  // المرحلة من شريط اللوحة داخل الاستلام
  await ac(`(()=>{const s=document.querySelector('#wfPanel select[data-wf=st]');s.value='rev';s.dispatchEvent(new Event('change',{bubbles:true}));return 1})()`); await sleep(800);
  const c2 = ((await pg.evaluate(() => window.desktop.wfBoard())).cards || []).find(c => c.sys === 'ac');
  ok('moving it to «المراجعة» from inside the acceptance page updates the board', c2 && c2.st === 'rev', c2 && c2.st);
  // متأخرة: استلام قبل 40 يوماً
  const key = c2.key, old = new Date(Date.now() - 40 * 864e5).toISOString().slice(0, 10);
  await ac(`window.desktop.flowSet(${JSON.stringify(key)},{recv:${JSON.stringify(old)}}).then(()=>1)`); await sleep(800);
  await pg.evaluate(() => window.desktop.go('wf')); await sleep(2000);
  const lateTxt = await pg.evaluate(k => { const x = document.querySelector(`.fb-x[data-k="${k}"]`); return x ? x.className + ' | ' + x.textContent.replace(/\s+/g, ' ') : 'none'; }, key);
  ok('received 40 days ago and not issued → shown LATE on the board (limit 30 for acceptance)', /\blate\b/.test(lateTxt) && /⚠ 40 يوماً/.test(lateTxt), lateTxt);
  // تنبيه رمز QR
  await pg.evaluate(() => window.desktop.go('ac')); await sleep(1200);
  await ac(`(()=>{const e=document.getElementById('pdfUrl');e.value='https://drive.google.com/file/d/AAAAAAAAAAAAAAAAAAAAAAAAAAA/view';e.dispatchEvent(new Event('input',{bubbles:true}));return 1})()`); await sleep(600);
  const p0 = JSON.parse(await ac(`JSON.stringify(window.AcqCheck.problems())`));
  ok('QR link pasted for the current data: no warning (green line «مطابقة»)', p0.length === 0 && /✔/.test(await ac(`(document.getElementById('acqChk')||{}).textContent||''`)), JSON.stringify(p0));
  await ac(`(()=>{const e=document.getElementById('pName');e.value='مدرسة الكرمة الابتدائية — بناية ثانية';e.dispatchEvent(new Event('input',{bubbles:true}));return 1})()`); await sleep(600);
  const p1 = JSON.parse(await ac(`JSON.stringify(window.AcqCheck.problems())`));
  ok('data changed AFTER the QR link was set → warning: the QR opens an old version that differs from the printed certificate', p1.length === 1 && /نسخة قديمة/.test(p1[0]) && /⚠/.test(await ac(`document.getElementById('acqChk').textContent`)), JSON.stringify(p1));
  const printed = await ac(`(()=>{window.__pr=0;window.print=()=>{window.__pr++};window.confirm=()=>false;document.getElementById('btnPrint').click();return new Promise(r=>setTimeout(()=>r(window.__pr),400))})()`);
  ok('issuing (print) asks first; choosing «إلغاء» stops the printing', printed === 0, String(printed));
  // إصدار الشهادة (عدد وتاريخ) ← «منجزة»
  await ac(`(()=>{const s=(id,v)=>{const e=document.getElementById(id);e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}))};s('outNo','4512');s('outDate','2026-11-20');document.getElementById('btnSave').click();return 1})()`);
  await sleep(6000);
  const c3 = ((await pg.evaluate(() => window.desktop.wfBoard())).cards || []).find(c => c.key === key);
  ok('when the certificate is issued (number and date) its card moves to «منجزة» by itself', c3 && c3.st === 'done', c3 && c3.st);
  const e = (await app.evaluate(() => (global.__uniErrors || []).slice())).filter(x => !/\[ac\]/.test(x)); ok('no JavaScript errors in the program', e.length === 0, e.join(' | ').slice(0, 400));
  await app.close(); srv.close();
  R.forEach(x => console.log(x[0], x[1], x[2] ? '— ' + String(x[2]).slice(0, 500) : '')); console.log(`${R.filter(x => x[0] === 'PASS').length}/${R.length}`); process.exit(R.every(x => x[0] === 'PASS') ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
