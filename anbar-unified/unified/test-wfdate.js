// الاستعمال: UNI_TEST_DU_PW=<كلمة سر المدد الافتراضية> xvfb-run -a node test-wfdate.js
// اختبار «📋 لوحة سير المعاملات» داخل نظام المدد: «تاريخ استلام الذمة»
//  نظام المدد يحوّل حقل التاريخ إلى «يوم/شهر/سنة» + زر تقويم (ويُرسل input لا change):
//  • كتابة التاريخ في الحقل المرئي تحفظه في اللوحة، ويظهر التاريخ المحفوظ في الحقل المرئي.
//  • ملف بلا توقف ولا مدة: الحقل المرئي وزر التقويم معطّلان أيضاً (لا يبدو أنه يعمل وهو لا يحفظ).
const { _electron: electron } = require('playwright');
const fs = require('fs'), path = require('path'), os = require('os');
const T = path.join(os.tmpdir(), 'uni-wfdate'); fs.rmSync(T, { recursive: true, force: true });
const mk = n => { const d = path.join(T, n); fs.mkdirSync(d, { recursive: true }); return d; }; const sleep = ms => new Promise(r => setTimeout(r, ms));
const R = []; const ok = (n, c, d = '') => R.push([c ? 'PASS' : 'FAIL', n, d]);
(async () => {
  const app = await electron.launch({ executablePath: require('electron'), args: ['--no-sandbox', __dirname], env: { ...process.env, UNI_MULTI: mk('u'), UNI_DATA_DIR: mk('d'), ANBAR_REG_DIR: mk('r'), UNI_AC_PORT: '48447', UNI_NO_JSONSCAN: '1', UNI_NO_LINKREFRESH: '1' } });
  const pg = await app.firstWindow(); await pg.waitForLoadState('domcontentloaded'); await sleep(1500);
  // كلمة سر النظام تُمرَّر من البيئة فقط (لا تُكتب في الملف): UNI_TEST_DU_PW
  if (process.env.UNI_TEST_DU_PW) await pg.evaluate(pw => window.desktop.unlock('du', pw), process.env.UNI_TEST_DU_PW);
  await app.evaluate(() => global.__uni.go('du')); await sleep(3000);
  const has = await app.evaluate(() => !!(global.__uni.views && global.__uni.views.du));
  if (!has) { console.log('SKIP: durations view not opened (locked)'); await app.close(); process.exit(0); }
  const du = c => app.evaluate(async (_, c) => global.__uni.views.du.webContents.executeJavaScript(c), c);
  // ملف بلا توقف ولا مدة
  await du(`(()=>{S.rid='r-test';S.exts=[];S.cases=[];setView('proj');setTimeout(()=>document.body.appendChild(document.createElement('i')),300);return 1})()`); await sleep(1200);
  const d0 = JSON.parse(await du(`(()=>{const p=document.getElementById('wfPanel');if(!p)return 'null';const w=p.querySelector('.dmy');return JSON.stringify({dmy:!!w,t:w&&w.querySelector('input[type=text]').disabled,b:w&&w.querySelector('button').disabled,info:p.textContent})})()`));
  ok('file without stops/extensions: the visible «يوم/شهر/سنة» field and calendar button are disabled, with the hint', d0 && d0.dmy && d0.t === true && d0.b === true && /أضف توقفاً أو مدة إضافية/.test(d0.info), JSON.stringify(d0));
  // ملف فيه مدة إضافية
  await du(`(()=>{S.exts=[{id:'e1',no:1}];document.body.appendChild(document.createElement('i'));return 1})()`); await sleep(1500);
  const d1 = JSON.parse(await du(`JSON.stringify((()=>{const w=document.querySelector('#wfPanel .dmy');return {t:w.querySelector('input[type=text]').disabled,v:w.querySelector('input[type=text]').value}})())`));
  ok('with an extension: the field is enabled and shows today as d/m/y', d1.t === false && /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(d1.v), JSON.stringify(d1));
  await du(`(()=>{const t=document.querySelector('#wfPanel .dmy input[type=text]');t.focus();t.value='5/11/2026';t.dispatchEvent(new Event('input',{bubbles:true}));t.blur();return 1})()`); await sleep(1500);
  const card = JSON.parse(await du(`window.desktop.flowGet('du:r-test:e1').then(c=>JSON.stringify(c))`));
  ok('typing «5/11/2026» in the visible field SAVES it to the workflow board (recv 2026-11-05)', card && card.recv === '2026-11-05', JSON.stringify(card));
  const v2 = await du(`document.querySelector('#wfPanel .dmy input[type=text]').value`);
  ok('…and the visible field shows the saved date 5/11/2026', v2 === '5/11/2026', v2);
  const e = await app.evaluate(() => (global.__uniErrors || []).slice()); ok('no JavaScript errors', e.length === 0, e.join(' | ').slice(0, 400));
  await app.close();
  R.forEach(x => console.log(x[0], x[1], x[2] ? '— ' + String(x[2]).slice(0, 500) : '')); console.log(`${R.filter(x => x[0] === 'PASS').length}/${R.length}`); process.exit(R.every(x => x[0] === 'PASS') ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
