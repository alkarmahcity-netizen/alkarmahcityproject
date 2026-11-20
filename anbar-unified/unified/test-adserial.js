// عداد رقم استمارة السلف لا يتأثر بالمحضر: فتح ملف، عرض المحضر، الطباعة، PDF، إضافة سلفة جديدة، ثم إعادة فتح البرنامج.
// يطبع الأرقام لتُقارن بين إصدارين (APPDIR).
const { _electron: electron } = require('playwright');
const fs = require('fs'), path = require('path'), os = require('os');
const APP = process.env.APPDIR || __dirname;
const T = path.join(os.tmpdir(), 'uni-adser-' + path.basename(APP)); fs.rmSync(T, { recursive: true, force: true });
const mk = n => { const d = path.join(T, n); fs.mkdirSync(d, { recursive: true }); return d; }; const sleep = ms => new Promise(r => setTimeout(r, ms));
const DD = mk('d'), U = mk('u'), RG = mk('r'), SV = mk('s'); fs.writeFileSync(path.join(DD, 'auth.json'), JSON.stringify({ ad: null }));
const launch = () => electron.launch({ executablePath: require('/home/user/anbar-unified/unified/node_modules/electron'), args: ['--no-sandbox', APP], env: { ...process.env, UNI_MULTI: U, UNI_DATA_DIR: DD, ANBAR_REG_DIR: RG, UNI_AC_PORT: '48453', UNI_NO_JSONSCAN: '1', UNI_NO_LINKREFRESH: '1', UNI_TEST_SAVE_DIR: SV } });
(async () => { const out = [];
  let app = await launch(); let pg = await app.firstWindow(); await pg.waitForLoadState('domcontentloaded'); await sleep(1500);
  await pg.evaluate(() => window.desktop.go('ad')); await sleep(2500);
  let V = c => app.evaluate(async (_, c) => global.__uni.views.ad.webContents.executeJavaScript(c), c);
  const snap = async tag => out.push(tag + ': ' + await V(`JSON.stringify({last:DB.settings.lastSerial||0,ser:DB.records.map(r=>r.advances.map(a=>a.serial))})`));
  await V(`window.confirm=()=>true;window.print=()=>{};1`);
  await V(`DB.settings.lastSerial=5040;persist();1`); await snap('start');
  await V(`document.querySelector('[data-act=demo]').click();1`); await sleep(1500); await snap('demo opened');
  await V(`doPrint();1`); await sleep(800); await snap('after print');
  await V(`doPDF();1`); await sleep(2500); await snap('after pdf');
  await V(`document.querySelector('[data-act=addadv]')?document.querySelector('[data-act=addadv]').click():0;1`); await sleep(800); await snap('after new advance');
  await V(`document.querySelector('[data-act=new]')?0:renderHome();1`); await sleep(300);
  await V(`renderHome();document.querySelector('[data-act=new]').click();1`); await sleep(1200); await snap('after new project');
  await app.close(); await sleep(500);
  app = await launch(); pg = await app.firstWindow(); await pg.waitForLoadState('domcontentloaded'); await sleep(1500);
  await pg.evaluate(() => window.desktop.go('ad')); await sleep(2500); V = c => app.evaluate(async (_, c) => global.__uni.views.ad.webContents.executeJavaScript(c), c);
  await snap('after restart'); await app.close();
  console.log(out.join('\n'));
})().catch(e => { console.error(e); process.exit(1); });
