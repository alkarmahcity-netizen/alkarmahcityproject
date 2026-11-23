// لجنة تدقيق السلف: المدد (الجمع 42+589+31، فترة التوقف، المدة الكلية، تاريخ الانجاز المخطط، المدة التأخيرية)، والأمر الإداري الثابت للجنة، وتخطيط الاستمارة
const { _electron: electron } = require('playwright'); const fs = require('fs'), path = require('path'), os = require('os');
const sleep = ms => new Promise(r => setTimeout(r, ms)); const R = []; const ok = (n, c, d = '') => R.push([c ? 'PASS' : 'FAIL', n, d]);
(async () => { const T = fs.mkdtempSync(path.join(os.tmpdir(), 'addur-')); const mk = n => { const d = path.join(T, n); fs.mkdirSync(d); return d; };
  const DD = mk('d'); fs.writeFileSync(path.join(DD, 'auth.json'), JSON.stringify({ ad: null }));
  const app = await electron.launch({ executablePath: require('electron'), args: ['--no-sandbox', __dirname], env: { ...process.env, UNI_MULTI: mk('u'), UNI_DATA_DIR: DD, ANBAR_REG_DIR: mk('r'), UNI_AC_PORT: '48524', UNI_NO_JSONSCAN: '1', UNI_NO_LINKREFRESH: '1' } });
  const pg = await app.firstWindow(); await pg.waitForLoadState('domcontentloaded'); await sleep(1500);
  await pg.evaluate(() => window.desktop.go('ad')); await sleep(2500);
  const V = c => app.evaluate(async (_, c) => global.__uni.views.ad.webContents.executeJavaScript(c), c);
  await V(`window.confirm=()=>true;document.querySelector('[data-act=new]').click();1`); await sleep(1500);
  const o0 = await V(`JSON.stringify(R().order)`);
  ok('a new file gets the fixed committee order 18243 / 2026-07-22', /18243/.test(o0) && /2026-07-22/.test(o0), o0);
  const typ = async (path, val) => V(`(()=>{const el=document.querySelector('#form input[data-b="${path}"]');el.value=${JSON.stringify(val)};el.dispatchEvent(new Event('input',{bubbles:true}));return 1})()`);
  await typ('project.startContract', '2024-08-19'); await typ('project.duration', '169'); await typ('project.extraExpr', '42+589+31'); await typ('project.stopExpr', '20+10'); await typ('project.finishActual', '2026-11-01'); await sleep(600);
  const P = JSON.parse(await V(`JSON.stringify(R().project)`));
  // 169+662+30 = 861 يوماً من 2024-08-19 ← 2026-12-28 ؛ الانجاز الفعلي 2026-11-01 قبلها ← لا تأخير
  ok('«42+589+31» is summed: extra days 662 (number kept for other systems), text kept as typed', P.extraDays === 662 && P.extraExpr === '42+589+31', JSON.stringify({ e: P.extraDays, x: P.extraExpr }));
  ok('stop period field: 20+10 = 30', P.stopDays === 30, String(P.stopDays));
  const info = await V(`document.getElementById('durInfo').textContent.replace(/\\s+/g,' ')`);
  ok('total = 169 + 662 + 30 = 861 days, planned completion 28/12/2026, delay 0', /861/.test(info) && /28\/12\/2026/.test(info) && /0 يوم/.test(info), info);
  await typ('project.finishActual', '2027-01-10'); await sleep(500);
  const P2 = JSON.parse(await V(`JSON.stringify(R().project)`));
  ok('actual completion 10/1/2027 → delay 13 days, saved in the delay field', P2.delayDays === 13, String(P2.delayDays));
  await V(`renderPreview(true);1`); await sleep(1200);
  const pr = await V(`(()=>{const p=document.querySelector('#pages .pg');const en=x=>x.replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d));const t=en(p.innerText).replace(/\\s+/g,' ');const pc=p.querySelector('.pcts');const kv=p.querySelector('.kv b');return {t,pcH:pc.getBoundingClientRect().height/(96/25.4)/(parseFloat(getComputedStyle(document.getElementById('pages')).transform.split(',')[3])||1),kvFs:parseFloat(getComputedStyle(kv).fontSize),dec:en(p.querySelector('.dec').innerText)}})()`);
  ok('print: extra 662, stop 30, total 861, planned & actual completion, delay 13', /المدة الاضافية الممنوحة\s*662 يوم/.test(pr.t) && /فترة التوقف\s*30 يوم/.test(pr.t) && /المدة الكلية\s*861 يوم/.test(pr.t) && /المدة التأخيرية\s*13 يوم/.test(pr.t), pr.t.slice(0, 600));
  ok('print: completion strip about half height (≈10 mm)', pr.pcH > 8 && pr.pcH < 12, String(pr.pcH));
  ok('print: decision text uses the committee order 18243 في 2026/7/22', /18243/.test(pr.dec), pr.dec.slice(0, 160));
  // ملف قديم بلا أمر: يأخذ الأمر الثابت في العرض
  const old = await V(`(()=>{const r=R();r.order={no:'',date:''};return defRec(r,0)})()`);
  ok('an old file with no order shows the fixed order', /18243/.test(old), old.slice(0, 120));
  const e = await app.evaluate(() => (global.__uniErrors || []).slice()); ok('no JavaScript errors', e.length === 0, e.join(' | ').slice(0, 300));
  await app.close();
  R.forEach(x => console.log(x[0], x[1], x[2] ? '— ' + String(x[2]).slice(0, 300) : '')); console.log(`${R.filter(x => x[0] === 'PASS').length}/${R.length}`); process.exit(R.every(x => x[0] === 'PASS') ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
