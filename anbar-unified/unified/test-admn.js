// محضر لجنة التدقيق إلزامي مع القرار في لجنة تدقيق السلف:
//  • لا يوجد خيار إخفاء المحضر؛ المحضر يُعرض ويُطبع دائماً بعد استمارة السلفة.
//  • قسم المحضر يعدّد النواقص للمدقق، وعلى زر القسم «غير مكتمل (n)»، وفي قائمة المشاريع «محضر لجنة التدقيق غير مكتمل».
//  • الطباعة وحفظ PDF مع محضر ناقص تطلب تأكيداً يعدّد النواقص؛ الرفض يوقف الطباعة.
//  • بعد الإكمال: «✓ مكتمل» ولا يُطلب تأكيد.
const { _electron: electron } = require('playwright');
const fs = require('fs'), path = require('path'), os = require('os');
const T = path.join(os.tmpdir(), 'uni-admn'); fs.rmSync(T, { recursive: true, force: true });
const mk = n => { const d = path.join(T, n); fs.mkdirSync(d, { recursive: true }); return d; }; const sleep = ms => new Promise(r => setTimeout(r, ms));
const R = []; const ok = (n, c, d = '') => R.push([c ? 'PASS' : 'FAIL', n, d]);
(async () => {
  const DD = mk('d'); fs.writeFileSync(path.join(DD, 'auth.json'), JSON.stringify({ ad: null }));
  const app = await electron.launch({ executablePath: require('electron'), args: ['--no-sandbox', __dirname], env: { ...process.env, UNI_MULTI: mk('u'), UNI_DATA_DIR: DD, ANBAR_REG_DIR: mk('r'), UNI_AC_PORT: '48452', UNI_NO_JSONSCAN: '1', UNI_NO_LINKREFRESH: '1' } });
  const pg = await app.firstWindow(); await pg.waitForLoadState('domcontentloaded'); await sleep(1500);
  await pg.evaluate(() => window.desktop.go('ad')); await sleep(2500);
  const V = c => app.evaluate(async (_, c) => global.__uni.views.ad.webContents.executeJavaScript(c), c);
  await V(`document.querySelector('[data-act=demo]').click();1`); await sleep(1500);
  let s = await V(`(()=>({cb:!!document.querySelector('[data-mn=on]'),sec:!!document.getElementById('mnSec'),open:document.getElementById('mnSec').open,badge:document.getElementById('mnBadge').textContent,warn:document.getElementById('mnWarn').textContent,pages:document.querySelectorAll('#pages .mnpg').length}))()`);
  ok('no option to hide the minutes (checkbox removed)', !s.cb);
  ok('minutes section is shown and open, titled mandatory', s.sec && s.open && await V(`document.querySelector('#mnSec>summary').textContent.includes('إلزامي')`));
  ok('the minutes page is in the preview with the decision', s.pages >= 1, 'pages=' + s.pages);
  ok('badge says incomplete', /غير مكتمل/.test(s.badge), s.badge);
  ok('warning lists what the auditor must complete', /الدائرة التي رفعت السلفة/.test(s.warn) && /كتاب الشركة/.test(s.warn) && /يوجد \/ لا يوجد/.test(s.warn), s.warn);
  let asked = await V(`(()=>{let m='';window.confirm=t=>{m=t;return false};const p=window.print;let printed=false;window.print=()=>{printed=true};doPrint();return new Promise(r=>setTimeout(()=>{window.print=p;r({m,printed})},400))})()`);
  ok('print with incomplete minutes asks, listing the missing items', /محضر لجنة التدقيق غير مكتمل/.test(asked.m) && /كتاب الشركة/.test(asked.m), asked.m.slice(0, 200));
  ok('…and refusing stops the printing', !asked.printed);
  await V(`(()=>{const r=R();r.minutes.dept='دائرة المهندس المقيم';r.minutes.letterNo='55';r.minutes.letterDate='2024-08-01';r.minutes.docs=MIN_DOCS.map(()=>({v:'y',note:''}));r.minutes.members=[{title:'رئيس اللجنة',name:'أ'},{title:'عضو',name:'ب'},{title:'مدقق السلفة',name:'ج'}];touch();renderForm();renderPreview(true);return 1})()`); await sleep(600);
  s = await V(`(()=>({badge:document.getElementById('mnBadge').textContent,warn:document.getElementById('mnWarn').textContent}))()`);
  ok('after completing: badge «مكتمل»', /مكتمل/.test(s.badge) && !/غير/.test(s.badge), s.badge);
  asked = await V(`(()=>{let m='';window.confirm=t=>{m=t;return false};const p=window.print;let printed=false;window.print=()=>{printed=true};doPrint();return new Promise(r=>setTimeout(()=>{window.print=p;r({m,printed})},500))})()`);
  ok('complete minutes print without asking', !asked.m && asked.printed, JSON.stringify(asked));
  await V(`(()=>{R().minutes.letterNo='';touch();return 1})()`); await V(`renderHome();1`); await sleep(400);
  ok('projects list flags an incomplete minutes', await V(`document.getElementById('hlist').textContent.includes('محضر لجنة التدقيق غير مكتمل')`));
  const e = await app.evaluate(() => (global.__uniErrors || []).slice()); ok('no JavaScript errors', e.length === 0, e.join(' | ').slice(0, 400));
  await app.close();
  R.forEach(x => console.log(x[0], x[1], x[2] ? '— ' + String(x[2]).slice(0, 300) : '')); console.log(`${R.filter(x => x[0] === 'PASS').length}/${R.length}`); process.exit(R.every(x => x[0] === 'PASS') ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
