// اختبار «مشاريع التنفيذ أمانة» (am) ومخاطباته (aml) داخل البرنامج الموحد:
//  • تبويب في الشريط العلوي، والصفحة تعمل داخل البرنامج (window.desktop) وتحفظ في AmanaProjects-Data.json.
//  • تدقيق السلف: الوصولات والفحوصات تُحفظ داخل السلفة، ورقم الاستمارة تلقائي.
//  • «فتح في المخاطبات»: أمر إداري جديد في AmanaLetters-Data.json بترويسة الشعبة.
//  التشغيل: xvfb-run -a node test-am.js
const { _electron: electron } = require('playwright');
const fs = require('fs'), path = require('path'), os = require('os');
const T = path.join(os.tmpdir(), 'uni-am'); fs.rmSync(T, { recursive: true, force: true });
const mk = n => { const d = path.join(T, n); fs.mkdirSync(d, { recursive: true }); return d; }; const sleep = ms => new Promise(r => setTimeout(r, ms));
const R = []; const ok = (n, c, d = '') => R.push([c ? 'PASS' : 'FAIL', n, d]);
(async () => {
  const DD = mk('d'), env = { ...process.env, UNI_MULTI: mk('u'), UNI_DATA_DIR: DD, ANBAR_REG_DIR: mk('r'), UNI_AC_PORT: '48454', UNI_NO_JSONSCAN: '1', UNI_NO_LINKREFRESH: '1' };
  let app = await electron.launch({ executablePath: require('electron'), args: ['--no-sandbox', __dirname], env });
  let pg = await app.firstWindow(); await pg.waitForLoadState('domcontentloaded'); await sleep(1500);
  ok('top bar has the tab «مشاريع التنفيذ أمانة»', await pg.evaluate(() => !!document.querySelector('.tab[data-go="am"]')));
  ok('home has the tile', await pg.evaluate(() => /مشاريع التنفيذ أمانة/.test(document.getElementById('tiles').textContent)));
  await pg.evaluate(() => window.desktop.go('am')); await sleep(2500);
  const am = c => app.evaluate(async (_, c) => global.__uni.views.am.webContents.executeJavaScript(c), c);
  ok('page loads inside the program with window.desktop', await am(`!!window.desktop&&!!document.getElementById('tabs')&&typeof XLW==='object'&&!!window.ANBAR_GEO`));
  await am(`(()=>{DB.records.push({id:'p1',type:'p',kind:'p',year:2026,orderNo:'12696',orderDate:'2026-03-08',name:'تعريض واكساء طريق البو شاووش',district:'الكرمة',sector:'',beneficiary:'مديرية طرق وجسور الانبار',amount:244495000,
    exec:['م.أ أ أ','م.ب ب ب','السيد ج ج ج'],recv:['م.د د د','م.هـ هـ هـ','م.و و و'],advances:[{id:'a1',no:'1',date:'2026-03-10',raised:50000000,paid:50000000}],progress:40,status:'run',lat:'33.40',lng:'43.90',notes:'',updated:Date.now()});persist(true);render();return 1})()`);
  await sleep(800);
  const file = path.join(DD, 'AmanaProjects-Data.json');
  const j1 = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
  ok('saved to AmanaProjects-Data.json', j1 && j1.records.some(r => r.id === 'p1'));
  // تدقيق السلف
  await am(`(()=>{TAB='aud';AUD.pid='p1';AUD.aid='a1';render();audAct('start');audAct('addR');const r=audFind().a.audit.receipts[0];Object.assign(r,{no:'7',date:'2026-03-12',vendor:'معمل',item:'إسمنت',qty:'100',price:90000,amount:9000000,dec:'acc'});
    audAct('addT');Object.assign(audFind().a.audit.tests[0],{name:'فحص الإسمنت',result:'pass'});touch(audFind().p);persist(true);render();return 1})()`);
  await sleep(800);
  const j2 = JSON.parse(fs.readFileSync(file, 'utf8')), a = j2.records.find(r => r.id === 'p1').advances[0];
  ok('audit saved inside the advance with an automatic serial', a.audit && a.audit.serial === 1 && a.audit.receipts.length === 1 && a.audit.tests.length === 1, JSON.stringify(a.audit && a.audit.serial));
  ok('audit form renders (accepted amount in words)', /تسعة ملايين/.test(await am(`audHtml(audFind().p,audFind().a)`)));
  // المخاطبات: أمر إداري الى محرر المخاطبات بوضع aml
  await am(`(()=>{TAB='let';LET.pid='p1';LET.kind='order';render();letAct('lt');return 1})()`); await sleep(3500);
  const lt = c => app.evaluate(async (_, c) => global.__uni.views.aml.webContents.executeJavaScript(c), c);
  ok('«مخاطبات مشاريع التنفيذ أمانة» opened', /مخاطبات مشاريع التنفيذ أمانة/.test(await lt('document.title')));
  ok('letters page uses the division letterhead', await lt(`IMG_LHT.length>300000&&!!document.querySelector('img.lht')`));
  await sleep(3500);
  const lf = path.join(DD, 'AmanaLetters-Data.json'), jl = fs.existsSync(lf) ? JSON.parse(fs.readFileSync(lf, 'utf8')) : null;
  const o = jl && jl.records.find(r => r.type === 'order');
  ok('order saved in AmanaLetters-Data.json with number, tables and cc', o && o.no === '12696' && o.tables.length === 2 && o.cc.some(c => c.on && /الشؤون المالية/.test(c.t)), o ? o.no : 'none');
  await app.close();
  console.log(R.map(r => r.join('  ')).join('\n')); const f = R.filter(r => r[0] === 'FAIL').length; console.log(f ? `${f} FAILED` : 'ALL PASS'); process.exit(f ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
