// المدد: قرار اللجنة — ترويسة ٤ سم، رمز QR يميناً (قابل للتغيير)، خط القرار أكبر (١١٢% افتراضياً)
const { _electron: electron } = require('playwright'); const fs = require('fs'), path = require('path'), os = require('os');
const sleep = ms => new Promise(r => setTimeout(r, ms)); const R = []; const ok = (n, c, d = '') => R.push([c ? 'PASS' : 'FAIL', n, d]);
(async () => { const T = fs.mkdtempSync(path.join(os.tmpdir(), 'ducom-')); const mk = n => { const d = path.join(T, n); fs.mkdirSync(d); return d; };
  const DD = mk('d'); fs.writeFileSync(path.join(DD, 'auth.json'), JSON.stringify({ du: null }));
  const app = await electron.launch({ executablePath: require('electron'), args: ['--no-sandbox', __dirname], env: { ...process.env, UNI_MULTI: mk('u'), UNI_DATA_DIR: DD, ANBAR_REG_DIR: mk('r'), UNI_AC_PORT: '48517', UNI_NO_INTRO: '1', UNI_NO_JSONSCAN: '1', UNI_NO_LINKREFRESH: '1' } });
  const pg = await app.firstWindow(); await pg.waitForLoadState('domcontentloaded'); await sleep(1500);
  await pg.evaluate(() => window.desktop.go('du')); await sleep(2500);
  const V = c => app.evaluate(async (_, c) => global.__uni.views.du.webContents.executeJavaScript(c), c);
  await V(`window.confirm=()=>true;document.getElementById('bDemo').click();1`); await sleep(2500);
  await V(`(()=>{const ps=document.getElementById('printSel');ps.value='c';ps.dispatchEvent(new Event('change'));return 1})()`); await sleep(1500);
  const m = () => V(`(()=>{const p=document.querySelector('#out .page[data-p=c]');const mm=p.getBoundingClientRect().width/210;const im=p.querySelector('.hd.lhd img.lh').getBoundingClientRect();
    const q=p.querySelector('.fmeta .qrd').getBoundingClientRect(),t=p.querySelector('.fmeta>div:not(.qrd)').getBoundingClientRect(),pr=p.getBoundingClientRect();
    const ti=p.querySelector('.ft .t').getBoundingClientRect(),id=p.querySelector('.idms');return {gap:+((ti.top-im.bottom)/mm).toFixed(1),idmsL:id?+((id.getBoundingClientRect().left-pr.left)/mm).toFixed(1):null,hdmm:+(im.height/mm).toFixed(1),qrRight:+((pr.right-q.right)/mm).toFixed(1),qrLeft:+((q.left-pr.left)/mm).toFixed(1),txtRight:+((pr.right-t.right)/mm).toFixed(1),k:+p.style.getPropertyValue('--k'),fp:parseFloat(getComputedStyle(p.querySelector('.fp')).fontSize),
      over:p.querySelector('.bottom').getBoundingClientRect().bottom>p.querySelector('.gbar').getBoundingClientRect().top-6}})()`);
  const a = await m();
  ok('header is 4 cm high', Math.abs(a.hdmm - 40) < 0.6, JSON.stringify(a));
  ok('QR at the left edge by default, committee text at the right', a.qrLeft < 20 && a.txtRight < 20, JSON.stringify(a));
  ok('1.5 cm between the header and the decision title', Math.abs(a.gap - 15) < 0.8, JSON.stringify(a));
  ok('IDMS beside the QR, not on top of it', a.idmsL == null || a.idmsL > a.qrLeft + 17, JSON.stringify(a));
  await V(`(()=>{S.s.fit=false;upd();return 1})()`); await sleep(1000); const a2 = await m();
  ok('decision text enlarged to 112% (auto-fit off)', Math.abs(a2.k - 1.12) < 0.001, JSON.stringify(a2));
  await V(`(()=>{S.s.fit=true;const e=S.cases[S.cur]||{};upd();return 1})()`); await sleep(1000);
  ok('auto-fit still keeps the decision on one page', !(await m()).over);
  await V(`(()=>{const s=document.getElementById('s_qrPos');s.value='r';s.dispatchEvent(new Event('change'));return 1})()`); await sleep(1000);
  const b = await m(); ok('setting «يمين» moves the QR to the right', b.qrRight < 20, JSON.stringify(b));
  await V(`(()=>{const s=document.getElementById('s_qrPos');s.value='l';s.dispatchEvent(new Event('change'));const f=document.getElementById('s_cfs');f.value=100;f.dispatchEvent(new Event('input'));return 1})()`); await sleep(1000);
  await V(`(()=>{S.s.fit=false;upd();return 1})()`); await sleep(1000);
  const c = await m(); ok('font setting 100% returns the old size', Math.abs(c.k - 1) < 0.001 && c.fp < a2.fp, JSON.stringify(c));
  await V(`(()=>{S.s.fit=true;upd();return 1})()`); await sleep(800);
  await V(`(()=>{const f=document.getElementById('s_cfs');f.value=112;f.dispatchEvent(new Event('input'));return 1})()`); await sleep(1000);
  if (process.env.PDF_OUT) { const buf = await app.evaluate(async () => global.__uni.views.du.webContents.printToPDF({ pageSize: 'A4', printBackground: true })); fs.writeFileSync(process.env.PDF_OUT, buf); }
  const e = await app.evaluate(() => (global.__uniErrors || []).slice()); ok('no JavaScript errors', e.length === 0, e.join(' | ').slice(0, 300));
  await app.close();
  R.forEach(x => console.log(x[0], x[1], x[2] ? '— ' + String(x[2]).slice(0, 300) : '')); console.log(`${R.filter(x => x[0] === 'PASS').length}/${R.length}`); process.exit(R.every(x => x[0] === 'PASS') ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
