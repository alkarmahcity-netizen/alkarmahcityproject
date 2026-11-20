// اختبار واجهة الأرشيف: زر «🗑 حذف» لكل مرفق يظهر لأرشيف القسم فقط، ويحذف الملف ويسجّل حذفه في الكتاب (filesDel) ليُحذف من حاسبات اللجان
const { _electron: electron } = require('playwright');
const fs = require('fs'), path = require('path'), os = require('os');
const T = path.join(os.tmpdir(), 'uni-arui'); fs.rmSync(T, { recursive: true, force: true });
const mk = n => { const d = path.join(T, n); fs.mkdirSync(d, { recursive: true }); return d; }; const sleep = ms => new Promise(r => setTimeout(r, ms));
const R = []; const ok = (n, c, d = '') => R.push([c ? 'PASS' : 'FAIL', n, d]);
(async () => {
  const app = await electron.launch({ executablePath: require('electron'), args: ['--no-sandbox', __dirname], env: { ...process.env, UNI_MULTI: mk('u'), UNI_DATA_DIR: mk('d'), ANBAR_REG_DIR: mk('r'), UNI_AC_PORT: '48473', UNI_NO_JSONSCAN: '1', UNI_NO_LINKREFRESH: '1' } });
  const pg = await app.firstWindow(); await pg.waitForLoadState('domcontentloaded'); await sleep(1500);
  await pg.evaluate(() => window.desktop.go('ar')); await sleep(2500);
  const ar = c => app.evaluate(async (_, c) => global.__uni.views.ar.webContents.executeJavaScript(c), c);
  await ar(`(()=>{ARCH.DB().records.push({id:'tst1',serial:'9',subject:'كتاب تجريبي',kind:'كتاب',dir:'وارد',updated:Date.now()-5000,dist:{karma:{at:Date.now()-5000}},files:[{name:'a.pdf',size:3},{name:'b.pdf',size:3}]});return 1})()`);
  const view = async role => { await ar(`(()=>{ARCH.role(${JSON.stringify(role)});ARCH.openDoc('tst1');return 1})()`); await sleep(300); return ar(`document.querySelectorAll('#dlg [data-fdel]').length`); };
  ok('a committee box does NOT see the delete button for attachments', (await view('karma')) === 0);
  ok('the department archive sees «🗑 حذف» next to each attachment', (await view('dept')) === 2);
  await ar(`(()=>{window.confirm=()=>true;document.querySelector('#dlg [data-fdel][data-f="b.pdf"]').click();return 1})()`); await sleep(500);
  const r = JSON.parse(await ar(`JSON.stringify(ARCH.DB().records.find(x=>x.id==='tst1'))`));
  ok('deleting removes the file from the letter and records the deletion (synced to committees)', r.files.map(f => f.name).join() === 'a.pdf' && r.filesDel && r.filesDel['b.pdf'] > 0, JSON.stringify(r));
  const e = await app.evaluate(() => (global.__uniErrors || []).slice()); ok('no JavaScript errors', e.length === 0, e.join(' | ').slice(0, 400));
  await app.close();
  R.forEach(x => console.log(x[0], x[1], x[2] ? '— ' + String(x[2]).slice(0, 400) : '')); console.log(`${R.filter(x => x[0] === 'PASS').length}/${R.length}`); process.exit(R.every(x => x[0] === 'PASS') ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
