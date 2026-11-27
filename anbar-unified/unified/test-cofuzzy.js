// ملفات أوامر التغيير المستوردة من النظام القديم (بلا رقم عقد) تُربط ببطاقة المشروع رغم اختلاف حرف في الاسم — دون ربط خاطئ
const { _electron: electron } = require('playwright'); const fs = require('fs'), path = require('path'), os = require('os');
const sleep = ms => new Promise(r => setTimeout(r, ms)); const R = []; const ok = (n, c, d = '') => R.push([c ? 'PASS' : 'FAIL', n, d]);
(async () => { const T = fs.mkdtempSync(path.join(os.tmpdir(), 'cofz-')); const mk = n => { const d = path.join(T, n); fs.mkdirSync(d); return d; };
  const DD = mk('d'), RG = mk('r'); fs.writeFileSync(path.join(DD, 'auth.json'), JSON.stringify({ co: null }));
  const NAME = 'اكمال الممرات الخدمية مع الجزرات لمدخل قضاء هيت بداء من مدخل سيطرة المعلمين باتجاه مدخل سيطرة المعهد المقطع الغربي';
  fs.writeFileSync(path.join(RG, 'registry.json'), JSON.stringify({ app: 'anbar-projects-shared', version: 1, updated: 'u1', projects: [
    { fileNo: '1322', name: NAME, contractor: 'شركة بناء الرافدين', contractNo: '41', year: '2023', district: 'هيت' },
    { fileNo: '1400', name: 'اكمال الممرات الخدمية لمدخل قضاء حديثة', contractor: 'شركة اخرى', contractNo: '7', year: '2024', district: 'حديثة' },
    { fileNo: '1500', name: 'تأهيل مدرسة الفرات في الرمادي', contractor: 'شركة س', contractNo: '9', year: '2024' },
    { fileNo: '1501', name: 'تأهيل مدرسة الفرات في الرمادي الثانية', contractor: 'شركة ص', contractNo: '10', year: '2024' }], links: {}, meta: {} }));
  const app = await electron.launch({ executablePath: require('electron'), args: ['--no-sandbox', __dirname], env: { ...process.env, UNI_MULTI: mk('u'), UNI_DATA_DIR: DD, ANBAR_REG_DIR: RG, UNI_AC_PORT: '48591', UNI_NO_JSONSCAN: '1', UNI_NO_LINKREFRESH: '1', UNI_NO_INTRO: '1' } });
  const pg = await app.firstWindow(); await sleep(1500); await pg.evaluate(() => window.desktop.go('co')); await sleep(3000);
  const V = c => app.evaluate(async (_, c) => global.__uni.views.co.webContents.executeJavaScript(c), c);
  await V(`(()=>{const mkR=(name,co,cno,amt)=>{const r=newRecord();r.legacy=true;Object.assign(r.project,{fileNo:'',name,contractor:co,contractNo:cno,value:2000000000,duration:365});const o=newOrder();o.add=amt;r.orders=[o];return r;};
    DB.records=[mkR(${JSON.stringify(NAME.replace('بداء', 'بدا'))},'شركة بناء الرافدين','',150000000),   // الحالة في الصورة: «بدا» بدل «بداء» وبلا رقم عقد
      mkR('تأهيل مدرسة الفرات في الرمادي الثالثة','شركة ع','',90000000)];   // اسم قريب من مشروعين: لا يُربط
    persist();return 1})()`); await sleep(1500);
  const reg = JSON.parse(fs.readFileSync(path.join(RG, 'registry.json'), 'utf8')), L = reg.links || {};
  ok('archive change-order file (no contract number, «بدا» vs «بداء») is linked to project 1322', L['1322'] && L['1322'].co && L['1322'].co.orders === 1 && L['1322'].co.changeCost === 150000000, JSON.stringify(L['1322'] || {}).slice(0, 200));
  ok('no wrong link to the similar project in another district', !(L['1400'] && L['1400'].co));
  ok('an ambiguous name (close to two projects) is not linked', !(L['1500'] && L['1500'].co) && !(L['1501'] && L['1501'].co), JSON.stringify(Object.keys(L)));
  const fn = await V(`DB.records[0].project.fileNo`); ok('the file number is written into the change-order file (later matches are direct)', fn === '1322', fn);
  await pg.evaluate(() => window.desktop.go('sit')); await sleep(1500); await pg.evaluate(() => window.SitOpen('1322')); await sleep(1200);
  const t = await pg.evaluate(() => document.getElementById('drawer').textContent.replace(/\s+/g, ' '));
  ok('the project card no longer says «لا ملف» for change orders', /أوامر التغيير/.test(t) && !/أوامر التغيير ?لا ملف/.test(t), (t.match(/أوامر التغيير.{0,60}/g) || []).join(' | ').slice(0, 300));
  const e = await app.evaluate(() => (global.__uniErrors || []).slice()); ok('no JavaScript errors', e.length === 0, e.join(' | ').slice(0, 300));
  await app.close(); R.forEach(x => console.log(x[0], x[1], x[2] ? '— ' + String(x[2]).slice(0, 300) : '')); console.log(`${R.filter(x => x[0] === 'PASS').length}/${R.length}`); process.exit(R.every(x => x[0] === 'PASS') ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
