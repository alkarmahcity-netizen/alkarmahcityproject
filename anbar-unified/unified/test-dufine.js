// المدد: الإعفاء من الغرامات التأخيرية — إذا تجاوزت مدته (مع المدد الإضافية والإعفاءات السابقة) 25% من مدة العقد يُحال الى اللجنة المركزية وتُطبع صفحة قرارها
const { _electron: electron } = require('playwright'); const fs = require('fs'), path = require('path'), os = require('os');
const sleep = ms => new Promise(r => setTimeout(r, ms)); const R = []; const ok = (n, c, d = '') => R.push([c ? 'PASS' : 'FAIL', n, d]);
(async () => { const T = fs.mkdtempSync(path.join(os.tmpdir(), 'dufine-')); const mk = n => { const d = path.join(T, n); fs.mkdirSync(d); return d; };
  const DD = mk('d'); fs.writeFileSync(path.join(DD, 'auth.json'), JSON.stringify({ du: null }));
  const app = await electron.launch({ executablePath: require('electron'), args: ['--no-sandbox', __dirname], env: { ...process.env, UNI_MULTI: mk('u'), UNI_DATA_DIR: DD, ANBAR_REG_DIR: mk('r'), UNI_AC_PORT: '48518', UNI_NO_JSONSCAN: '1', UNI_NO_LINKREFRESH: '1', UNI_NO_INTRO: '1' } });
  const pg = await app.firstWindow(); await pg.waitForLoadState('domcontentloaded'); await sleep(1500);
  await pg.evaluate(() => window.desktop.go('du')); await sleep(2500);
  const V = c => app.evaluate(async (_, c) => global.__uni.views.du.webContents.executeJavaScript(c), c);
  await V(`window.confirm=()=>true;document.getElementById('bDemo').click();1`); await sleep(2500);
  const st = () => V(`(()=>{const c=calc();const pz=document.querySelector('#out .page.pz'),pd=document.querySelector('#out .page.pd');return JSON.stringify({need:c.needCentral,pct:+c.pct.toFixed(2),cum:c.cum,lvl:c.lvl,msg:c.msg,pz:!!pz,pzT:pz?pz.textContent.replace(/\\s+/g,' '):'',pdT:pd?pd.textContent.replace(/\\s+/g,' '):'',status:document.getElementById('status').textContent})})()`).then(JSON.parse);
  // كما في الصورة: مدة العقد 100 يوم، طلب واحد «إعفاء من الغرامات» 241 يوماً
  await V(`(()=>{S.p.dur='100';S.p.prior='0';S.p.regime='2025';const e=newExt(1);e.kind='fine';e.granted='241';e.from='2026-01-22';e.to='2026-09-19';S.exts=[e];selExt(0);return 1})()`); await sleep(1800);
  let s = await st();
  ok('fine exemption 241 days on a 100-day contract (241%) → referred to the central committee', s.need && s.lvl === 'warn' && /اللجنة المركزية/.test(s.msg), JSON.stringify({ need: s.need, pct: s.pct, lvl: s.lvl, msg: s.msg }));
  ok('the central committee page is printed for the fine exemption, with fine wording', s.pz && /محضر قرار اللجنة المركزية/.test(s.pzT) && /أسباب طلب الإعفاء من الغرامات التأخيرية/.test(s.pzT) && /إعفاء الشركة أعلاه من الغرامات التأخيرية/.test(s.pzT) && !/مدة إضافية قدرها/.test(s.pzT), s.pzT.slice(0, 300));
  ok('no «exceeds the limits» stamp for a fine exemption (no 30% cap)', !/يتجاوز الحدود المسموحة/.test(await V(`document.getElementById('out').textContent`)));
  ok('administrative order cites the central (approval) committee decision', /لجنة المصادقة/.test(s.pdT) && /اعفاء الشركة أعلاه من الغرامات التأخيرية/.test(s.pdT), s.pdT.slice(0, 300));
  await V(`(()=>{const e=S.exts[0];e.reNo='38';e.reDate='2026-09-24';e.fineCause='عدم صرف المستحقات المالية الخاصة بالسلفة رقم (1)';e.date='2026-11-24';S.z.orders=[{no:'6990',date:'2026-03-15'}];upd();return 1})()`); await sleep(1500); s = await st();
  ok('exemption order in the official format: «امر اداري», «بناءً على ما جاء بكتاب دائرة المهندس المقيم … والمتضمن طلب اعفاء الشركة», central (6990) + committee + cabinet decisions, «تقرر ما يلي»', /امر اداري/.test(s.pdT) && /بناءً على ما جاء بكتاب دائرة المهندس المقيم ذي العدد \( ٣٨ \)/.test(s.pdT) && /والمتضمن طلب اعفاء الشركة من الغرامات التأخيرية لمشروع/.test(s.pdT) && /قرار لجنة المصادقة المشكلة بموجب الامر الاداري المرقم \( ٦٩٩٠ \)/.test(s.pdT) && /مطالعة لجنة المدد الاضافية/.test(s.pdT) && /قراري مجلس الوزراء/.test(s.pdT) && /تقرر ما يلي/.test(s.pdT) && !/م \/ \(/.test(s.pdT), s.pdT.slice(0, 600));
  ok('exemption order items: exemption with period and reason «على ان لا تترتب أي التزامات مالية», and the resident engineer responsibility', /اعفاء الشركة أعلاه من الغرامات التأخيرية المترتبة على الفترة البالغ مقدارها \( ٢٤١ \) يوم/.test(s.pdT) && /بسبب عدم صرف المستحقات المالية الخاصة بالسلفة/.test(s.pdT) && /على ان لا تترتب أي التزامات مالية لصالح الشركة/.test(s.pdT) && /تتحمل دائرة المهندس المقيم المسؤولية القانونية/.test(s.pdT), s.pdT.slice(500, 1100));
  ok('central page endorsement table uses exemption wording (not «مدة إضافية»)', /إعفاء الشركة من الغرامات التأخيرية \( ٢٤١ \) يوم/.test(s.pzT) && /تأييد طلب الإعفاء من الغرامات التأخيرية/.test(s.pzT) && !/منح الشركة مدة إضافية/.test(s.pzT) && /عدم صرف المستحقات المالية/.test(s.pzT));
  await V(`(()=>{S.exts[0].z.decision='reject';upd();return 1})()`); await sleep(1500); s = await st();
  ok('central committee rejects → order says the exemption is not granted', /عدم إعفاء الشركة من الغرامات التأخيرية لعدم مصادقة لجنة المصادقة/.test(s.pdT), s.pdT.slice(0, 200));
  // ضمن الحد: 20 يوماً من 100 → لا إحالة
  await V(`(()=>{S.exts[0].z.decision='';S.exts[0].granted='20';upd();return 1})()`); await sleep(1500); s = await st();
  ok('fine exemption within 25% (20 of 100 days) → no central committee page', !s.need && !s.pz, JSON.stringify({ need: s.need, pct: s.pct }));
  // مدد إضافية سابقة 15 + إعفاء 15 = 30% → إحالة
  await V(`(()=>{const a=newExt(1);a.granted='15';const b=newExt(2);b.kind='fine';b.granted='15';S.exts=[a,b];selExt(1);return 1})()`); await sleep(1500); s = await st();
  ok('previous extensions count: 15 extra + 15 exemption = 30% → referred', s.need && s.pct === 30 && s.pz, JSON.stringify({ need: s.need, pct: s.pct }));
  // المدد الإضافية كما كانت: الإعفاء لا يُضاف الى نسبة المدد الإضافية
  await V(`(()=>{const a=newExt(1);a.kind='fine';a.granted='40';const b=newExt(2);b.granted='20';S.exts=[a,b];selExt(1);return 1})()`); await sleep(1500); s = await st();
  ok('extensions unchanged: a 20-day extension after a 40-day exemption is 20% (not referred)', !s.need && s.pct === 20, JSON.stringify({ need: s.need, pct: s.pct }));
  await V(`(()=>{S.exts[1].granted='30';upd();return 1})()`); await sleep(1500); s = await st();
  ok('extensions unchanged: 30-day extension = 30% → referred as before', s.need && s.pct === 30 && s.pz && /مدة إضافية/.test(s.pzT));
  const e = await app.evaluate(() => (global.__uniErrors || []).slice()); ok('no JavaScript errors', e.length === 0, e.join(' | ').slice(0, 300));
  await app.close();
  R.forEach(x => console.log(x[0], x[1], x[2] ? '— ' + String(x[2]).slice(0, 300) : '')); console.log(`${R.filter(x => x[0] === 'PASS').length}/${R.length}`); process.exit(R.every(x => x[0] === 'PASS') ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
