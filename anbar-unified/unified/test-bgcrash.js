// توقف واجهة نظام وهي في الخلفية: تُعاد بصمت بلا رسالة؛ وفي تبويبها المفتوح: تظهر الرسالة كما كانت
const { _electron: electron } = require('playwright'); const fs = require('fs'), path = require('path'), os = require('os');
const sleep = ms => new Promise(r => setTimeout(r, ms)); const R = []; const ok = (n, c, d = '') => R.push([c ? 'PASS' : 'FAIL', n, d]);
(async () => { const T = fs.mkdtempSync(path.join(os.tmpdir(), 'bgc-')); const mk = n => { const d = path.join(T, n); fs.mkdirSync(d); return d; };
  const DD = mk('d'); fs.writeFileSync(path.join(DD, 'auth.json'), JSON.stringify({ du: null }));
  const app = await electron.launch({ executablePath: require('electron'), args: ['--no-sandbox', __dirname], env: { ...process.env, UNI_MULTI: mk('u'), UNI_DATA_DIR: DD, ANBAR_REG_DIR: mk('r'), UNI_AC_PORT: '48541', UNI_NO_JSONSCAN: '1', UNI_NO_LINKREFRESH: '1', UNI_NO_INTRO: '1' } });
  const pg = await app.firstWindow(); await pg.waitForLoadState('domcontentloaded'); await sleep(1500);
  await app.evaluate(({ dialog }) => { global.__dlg = 0; dialog.showMessageBox = () => { global.__dlg++; return Promise.resolve({ response: 0 }); }; });
  await pg.evaluate(() => window.desktop.go('du')); await sleep(2500);
  await pg.evaluate(() => window.desktop.go('home')); await sleep(800);
  await app.evaluate(() => { global.__uni.views.du.webContents.forcefullyCrashRenderer(); }); await sleep(5000);
  const a = await app.evaluate(() => ({ dlg: global.__dlg, alive: !global.__uni.views.du.webContents.isCrashed(), url: global.__uni.views.du.webContents.getURL() }));
  ok('background crash: no message, the view is reloaded silently', a.dlg === 0 && a.alive && /du\.html/.test(a.url), JSON.stringify(a));
  const ready = await app.evaluate(async () => global.__uni.views.du.webContents.executeJavaScript('typeof DB==="object"&&Array.isArray(DB.recs)'));
  ok('the reloaded view works', ready === true);
  for (let i = 0; i < 2; i++) { await app.evaluate(() => { global.__uni.views.du.webContents.forcefullyCrashRenderer(); }); await sleep(5000); }
  const loop = await app.evaluate(() => ({ dlg: global.__dlg, gone: !global.__uni.views.du }));
  ok('repeated background crashes (3 in 10 min): the view is closed instead of reloading forever', loop.gone && loop.dlg === 0, JSON.stringify(loop));
  await pg.evaluate(() => window.desktop.go('du')); await sleep(2500);
  ok('the closed view reopens normally with its tab', await app.evaluate(async () => !!global.__uni.views.du && await global.__uni.views.du.webContents.executeJavaScript('typeof DB==="object"')));
  await pg.evaluate(() => window.desktop.go('du')); await sleep(1500);
  await app.evaluate(() => { global.__uni.views.du.webContents.forcefullyCrashRenderer(); }); await sleep(3000);
  const b = await app.evaluate(() => ({ dlg: global.__dlg }));
  ok('crash in the open tab: the message is shown as before', b.dlg === 1, JSON.stringify(b));
  const log = fs.readFileSync(path.join(DD, 'errors.log'), 'utf8'); ok('the reason is written to errors.log', /background view render-process-gone/.test(log));
  await app.close();
  R.forEach(x => console.log(x[0], x[1], x[2] ? '— ' + x[2] : '')); console.log(`${R.filter(x => x[0] === 'PASS').length}/${R.length}`); process.exit(R.every(x => x[0] === 'PASS') ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
