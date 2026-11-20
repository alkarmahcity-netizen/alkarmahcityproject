// دليل الاستخدام (زر 📘 / F1):
//  أ) البرنامج مُحزَّم (app.asar) والدليل بداخله: يُنسخ إلى مجلد المستخدم ويُفتح، ولا يُكرَّر فتح النافذة.
//  ب) نسخة بلا ملف الدليل (مثل البناء من المستودع العام): تُعرض «اختيار ملف الدليل…»، فيُنسخ إلى مجلد البيانات ويُفتح،
//     وفي المرة التالية يُفتح مباشرة دون سؤال.
// الاستعمال: ASAR=<app.asar فيه الدليل> ASAR_NOMAN=<app.asar بلا الدليل> PDF=<ملف PDF> xvfb-run -a node test-manual.js
const { _electron: electron } = require('playwright'); const fs = require('fs'), path = require('path'), os = require('os');
const sleep = ms => new Promise(r => setTimeout(r, ms)); const R = []; const ok = (n, c, d = '') => R.push([c ? 'PASS' : 'FAIL', n, d]);
const run = async (appPath, tag, fn) => { const T = fs.mkdtempSync(path.join(os.tmpdir(), 'man-')); const mk = n => { const d = path.join(T, n); fs.mkdirSync(d); return d; };
  const DD = mk('d'); const app = await electron.launch({ executablePath: require('electron'), args: ['--no-sandbox', appPath], env: { ...process.env, UNI_MULTI: mk('u'), UNI_DATA_DIR: DD, ANBAR_REG_DIR: mk('r'), UNI_AC_PORT: '48512', UNI_NO_JSONSCAN: '1', UNI_NO_LINKREFRESH: '1' } });
  const pg = await app.firstWindow(); await pg.waitForLoadState('domcontentloaded'); await sleep(2500);
  try { await fn(app, pg, DD); } finally { await app.close(); } };
const info = app => app.evaluate(() => { const w = global.__uni.manualWin(); return w ? { url: decodeURIComponent(w.webContents.getURL()), title: w.getTitle() } : null; });
(async () => {
  await run(process.env.ASAR, 'asar', async (app, pg) => {
    ok('the 📘 button is shown', await pg.evaluate(() => !!document.getElementById('bManual') && document.getElementById('bManual').offsetParent !== null));
    await pg.evaluate(() => document.getElementById('bManual').click()); await sleep(3500);
    const i = await info(app);
    ok('packed program: the manual inside the program opens (copied out of app.asar)', i && /manual\/user-guide-[\d.]+\.pdf$/.test(i.url) && !/\.asar/.test(i.url), i && i.url);
    ok('window title «دليل الاستخدام»', i && /دليل الاستخدام/.test(i.title));
    await pg.evaluate(() => document.getElementById('bManual').click()); await sleep(700);
    ok('clicking again does not open a second window', await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().filter(w => /دليل الاستخدام/.test(w.getTitle())).length) === 1);
    await app.evaluate(() => { global.__uni.manualWin().close(); return 1; }); await sleep(500);
    ok('the program keeps working after closing the manual', await pg.evaluate(() => !!document.getElementById('tiles')));
  });
  await run(process.env.ASAR_NOMAN, 'noman', async (app, pg, DD) => {
    await app.evaluate(({ dialog }, pdf) => { global.__asked = []; dialog.showMessageBox = async (_w, o) => { global.__asked.push(o.message); return { response: 0 }; }; dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [pdf] }); return 1; }, process.env.PDF);
    await pg.evaluate(() => document.getElementById('bManual').click()); await sleep(3500);
    const asked = await app.evaluate(() => global.__asked); const i = await info(app);
    ok('no manual file: the user is asked to choose the manual file (no dead-end message)', asked.length === 1 && /غير موجود/.test(asked[0]), JSON.stringify(asked));
    ok('…the chosen file is copied to the data folder and opens', fs.existsSync(path.join(DD, 'دليل-الاستخدام.pdf')) && i && /دليل-الاستخدام\.pdf$/.test(i.url), i && i.url);
    await app.evaluate(() => { global.__uni.manualWin().close(); global.__asked = []; return 1; }); await sleep(500);
    await pg.evaluate(() => document.getElementById('bManual').click()); await sleep(2500);
    ok('next time it opens directly without asking', (await app.evaluate(() => global.__asked)).length === 0 && !!(await info(app)));
  });
  R.forEach(x => console.log(x[0], x[1], x[2] ? '— ' + String(x[2]).slice(0, 300) : '')); console.log(`${R.filter(x => x[0] === 'PASS').length}/${R.length}`); process.exit(R.every(x => x[0] === 'PASS') ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
