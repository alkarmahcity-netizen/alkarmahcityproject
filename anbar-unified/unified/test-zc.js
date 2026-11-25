// اللجنة المركزية للمصادقة: إحالة من المدد (وأوامر التغيير) عند تجاوز 25% → قرار مقرر المركزية في تبويبها → يعود الى المدد لإصدار الأمر الإداري
const { _electron: electron } = require('playwright'); const fs = require('fs'), path = require('path'), os = require('os');
const sleep = ms => new Promise(r => setTimeout(r, ms)); const R = []; const ok = (n, c, d = '') => R.push([c ? 'PASS' : 'FAIL', n, d]);
(async () => { const T = fs.mkdtempSync(path.join(os.tmpdir(), 'zc-')); const mk = n => { const d = path.join(T, n); fs.mkdirSync(d); return d; };
  const DD = mk('d'); fs.writeFileSync(path.join(DD, 'auth.json'), JSON.stringify({ du: null, co: null }));
  /* ملف مدد قديم فيه قرار مركزية مسجّل سابقاً (يُنقل الى التبويب الجديد كسجل «صدر القرار») */
  const app = await electron.launch({ executablePath: require('electron'), args: ['--no-sandbox', __dirname], env: { ...process.env, UNI_MULTI: mk('u'), UNI_DATA_DIR: DD, ANBAR_REG_DIR: mk('r'), UNI_AC_PORT: '48519', UNI_NO_JSONSCAN: '1', UNI_NO_LINKREFRESH: '1', UNI_NO_INTRO: '1' } });
  const pg = await app.firstWindow(); await pg.waitForLoadState('domcontentloaded'); await sleep(1500);
  const go = await pg.evaluate(() => window.desktop.go('zc'));
  ok('the central committee tab is password-protected (admin password until its own is set)', go === false);
  const tab = await pg.evaluate(() => !!document.querySelector('[data-go="zc"]')); ok('shell has the «اللجنة المركزية» tab', tab);
  await pg.evaluate(() => window.desktop.go('du')); await sleep(2500);
  const V = c => app.evaluate(async (_, c) => global.__uni.views.du.webContents.executeJavaScript(c), c);
  const Z = c => app.evaluate(async (_, c) => global.__uni.views.zc ? global.__uni.views.zc.webContents.executeJavaScript(c) : null, c);
  await V(`window.confirm=()=>true;1`);
  // ملف 1: مدة 100 يوم، طلب 30 يوماً (30%) → إحالة
  await V(`(()=>{const d=blank();Object.assign(d.p,{fileNo:'9001',name:'مشروع تأهيل مدرسة الاختبار',contractor:'شركة الاختبار',dur:'100',prior:'0',regime:'2014'});const e=newExt(1);e.granted='30';e.requested='30';e.reasons=[{t:'الأمطار',d:'30'}];d.exts=[e];openRecord(d,true);selExt(0);writeDB();return 1})()`);
  // ملف 2 (قديم): فيه قرار مركزية مكتوب سابقاً في برنامج المدد
  await V(`(()=>{const keep=S;const d=blank();Object.assign(d.p,{fileNo:'9002',name:'مشروع قديم',contractor:'شركة ب',dur:'100',prior:'0',regime:'2014'});const e=newExt(1);e.granted='40';e.z.formNo='77';e.z.date='2026-05-01';e.z.days='35';d.exts=[e];d.rid=newRid();DB.recs.push({id:d.rid,created:Date.now(),updated:Date.now(),data:d});writeDB();return 1})()`);
  // ملف 3: ضمن الحد (10%) → لا إحالة
  await V(`(()=>{const d=blank();Object.assign(d.p,{fileNo:'9003',name:'مشروع ضمن الحد',dur:'100',prior:'0'});const e=newExt(1);e.granted='10';d.exts=[e];d.rid=newRid();DB.recs.push({id:d.rid,created:Date.now(),updated:Date.now(),data:d});writeDB();return 1})()`);
  await V(`window.__zcRefer(DB.recs)`); await sleep(6000);
  const q0 = await app.evaluate(() => !!global.__uni.views.zc); const inbox = fs.existsSync(path.join(DD, 'zc-inbox.json')) ? JSON.parse(fs.readFileSync(path.join(DD, 'zc-inbox.json'), 'utf8')) : {};
  ok('while the central tab is closed, referrals wait in its inbox (its page is not started in the background)', !q0 && Object.values(inbox).filter(x => x.need).length === 2, Object.keys(inbox).length + ' ' + q0);
  await app.evaluate(() => { global.__uni.unlocked.add('zc'); global.__uni.ensureView('zc'); return 1; }); await sleep(5000);   // كأن كلمة السر أُدخلت
  ok('opening the tab reads the inbox (and empties it)', !fs.existsSync(path.join(DD, 'zc-inbox.json')));
  const zs = () => Z(`JSON.stringify(DB.recs.filter(r=>r.zc).map(r=>({id:r.id,name:r.data.p.name,st:r.zc.status,w:!!r.zc.withdrawn,mig:!!r.zc.migrated,days:r.zc.days,pct:r.zc.pct,z:(r.data.exts.find(e=>e.id===r.zc.extId)||{}).z})))`).then(x => JSON.parse(x || '[]'));
  let L = await zs();
  const r1 = L.find(x => x.name === 'مشروع تأهيل مدرسة الاختبار'), r2 = L.find(x => x.name === 'مشروع قديم');
  ok('a request over 25% (30 of 100 days) is referred to the central committee tab, pending', r1 && r1.st === 'pending' && r1.pct === 30, JSON.stringify(L));
  ok('migration: an old durations file with a central decision moves into the tab as «decided»', r2 && r2.st === 'decided' && r2.mig && r2.z && r2.z.formNo === '77', JSON.stringify(r2));
  ok('a request within 25% is not referred', !L.some(x => x.name === 'مشروع ضمن الحد'));
  const zui = await Z(`JSON.stringify({brand:document.querySelector('header.top .brand b').textContent,mode:document.body.classList.contains('zcmode'),panel:(document.getElementById('zcPanel')||{}).textContent||'',newHidden:getComputedStyle(document.getElementById('bNew')).display==='none',ps:document.getElementById('printSel').value,go:!!document.getElementById('zcGo')})`).then(JSON.parse);
  ok('central tab: own title, referrals list, «إصدار القرار» button, other tools hidden, prints the central decision', /اللجنة المركزية للمصادقة/.test(zui.brand) && zui.mode && /بانتظار القرار/.test(zui.panel) && zui.newHidden && zui.ps === 'z' && zui.go, JSON.stringify(zui));
  // في المدد: قرار المركزية للقراءة فقط
  const lock = await V(`(()=>{const i=DB.recs.findIndex(r=>r.data.p.fileNo==='9001');openRecord(DB.recs[i].data);selExt(0);const b=document.getElementById('centralSec');const f=[...b.querySelectorAll('input,textarea,select')];return JSON.stringify({n:f.length,dis:f.every(x=>x.disabled),note:(b.querySelector('.zcnote')||{}).textContent||''})})()`).then(JSON.parse);
  ok('durations: the central decision is read-only, with a note and an «open in central committee» button', lock.n > 0 && lock.dis && /بانتظار قرار اللجنة المركزية/.test(lock.note), JSON.stringify(lock));
  // مقرر المركزية يكتب القرار (25 يوماً بدل 30) ويصدره
  await Z(`(()=>{const r=DB.recs.find(r=>r.zc&&r.data.p.fileNo==='9001');window.__zcOpen(r.id);const e=S.exts[S.cur];e.z.formNo='501';e.z.date='2026-11-20';e.z.decision='partial';e.z.days='25';S.z.issuer='قسم العقود الاختبار';window.confirm=()=>true;upd();save();return 1})()`); await sleep(800);
  await Z(`document.getElementById('zcGo').click();1`); await sleep(4000);
  L = await zs(); const d1 = L.find(x => x.name === 'مشروع تأهيل مدرسة الاختبار');
  ok('central tab: after «إصدار» the referral is marked «صدر القرار»', d1 && d1.st === 'decided', JSON.stringify(d1));
  const back = await V(`(()=>{const r=DB.recs.find(r=>r.data.p.fileNo==='9001');openRecord(r.data);selExt(0);const e=S.exts[0];const pd=document.querySelector('#out .page.pd');const c=chain().out[0];return JSON.stringify({z:e.z,iss:S.z.issuer,final:c.final,pd:pd?pd.textContent.replace(/\\s+/g,' '):'',note:(document.querySelector('#centralSec .zcnote')||{}).textContent||''})})()`).then(JSON.parse);
  ok('decision returns to durations: number, date, days and the committee settings (issuer)', back.z.fromZc && back.z.formNo === '501' && back.z.days === '25' && back.iss === 'قسم العقود الاختبار', JSON.stringify(back.z));
  ok('durations: the administrative order uses the central committee days (25)', back.final === 25 && /صدر قرار اللجنة المركزية/.test(back.note), JSON.stringify({ final: back.final, note: back.note }));
  // سحب الإحالة إن عُدّل الطلب الى ضمن الحد (ملف بلا قرار)
  await V(`(()=>{const d=blank();Object.assign(d.p,{fileNo:'9004',name:'مشروع يُسحب',dur:'100',prior:'0'});const e=newExt(1);e.granted='40';d.exts=[e];openRecord(d,true);selExt(0);writeDB();return 1})()`); await sleep(5000);
  await V(`(()=>{S.exts[0].granted='10';upd();writeDB();return 1})()`); await sleep(5000);
  L = await zs(); const w = L.find(x => x.name === 'مشروع يُسحب');
  ok('a referral is withdrawn when the request drops back within 25%', w && w.w, JSON.stringify(w));
  // نسبة واحدة: مدد أوامر التغيير + مدد لجنة المدد
  const comb = await V(`(()=>{const o=AnbarReg.links;AnbarReg.links=fn=>String(fn)==='9005'?{co:{items:[{no:1,days:20},{no:2,days:0}]}}:o(fn);const d=blank();Object.assign(d.p,{fileNo:'9005',name:'مشروع مشترك',dur:'100',prior:'0'});const e=newExt(1);e.granted='10';d.exts=[e];openRecord(d,true);selExt(0);const L=AnbarReg.links('9005').co;const c=chain().out[0];const a={pct:c.pct,need:c.need,co:coInfo().days,L:!!L};S.p.coIn=false;const b=chain().out[0];S.p.coIn=true;return JSON.stringify({a,off:{pct:b.pct,need:b.need},hint:document.getElementById('coInHint').textContent})})()`).then(JSON.parse);
  ok('one 25% count: 20 change-order days + 10 committee days = 30% → referred', comb.a.co === 20 && comb.a.pct === 30 && comb.a.need, JSON.stringify(comb));
  ok('the change-order days can be excluded (if already in «previously granted»)', comb.off.pct === 10 && !comb.off.need && /أوامر التغيير: 20/.test(comb.hint), JSON.stringify(comb.off) + comb.hint);
  // أوامر التغيير ← المدد
  const fc = await V(`JSON.stringify(window.__duFromCo({fileNo:'9005',name:'مشروع مشترك',coNo:1,days:20,decNo:'1234',decDate:'2026-10-05'}))`).then(JSON.parse);
  const fc2 = await V(`(()=>{window.__duFromCo({fileNo:'9005',coNo:1,days:22});const r=DB.recs.find(r=>r.data.p.fileNo==='9005');const L=r.data.exts.filter(e=>e.coNo==='1');openRecord(r.data);const c=chain();return JSON.stringify({n:L.length,g:L[0]&&L[0].granted,why:L[0]&&L[0].reasons[0].t,co:coInfo().days,pct:c.out[c.out.length-1].pct})})()`).then(JSON.parse);
  ok('change order → durations: adds a request for the change order to the same project file', fc.ok && !fc.created && fc2.n === 1 && /لتنفيذ أمر التغيير رقم \( 1 \) ذي العدد \( 1234 \) في 05\/10\/2026/.test(fc2.why), JSON.stringify([fc, fc2]));
  ok('no double count: once referred as a request, that change order\'s days leave the change-order share; repeat updates it', fc2.g === '22' && fc2.co === 0 && Math.round(fc2.pct) === 32, JSON.stringify(fc2));
  const fc3 = await V(`JSON.stringify(window.__duFromCo({fileNo:'9100',name:'مشروع جديد من أمر تغيير',contractor:'شركة ج',dur:'200',coNo:2,days:15}))`).then(JSON.parse);
  ok('change order for a project with no durations file → a new file is created', fc3.ok && fc3.created, JSON.stringify(fc3));
  ok('change order → durations reports whether it went on to the central committee (cumulative %)', fc.need === true && fc.pct >= 30 && fc3.need === false && fc3.pct === 7.5, JSON.stringify([fc, fc3]));
  // رقم العقد هو المرجع: ملف بلا رقم اضبارة مطابق، يُعرف برقم العقد (بأرقام عربية ومسافات)
  const cn = await V(`(()=>{const d=blank();Object.assign(d.p,{fileNo:'',cNo:'45/2026',name:'مشروع برقم العقد',dur:'100',prior:'0'});d.exts=[];d.rid=newRid();DB.recs.push({id:d.rid,created:Date.now(),updated:Date.now(),data:d});writeDB();
    const a=window.__duFromCo({fileNo:'9999',contractNo:'٤٥ / ٢٠٢٦',name:'اسم مختلف',coNo:3,days:12});const r=DB.recs.find(x=>x.id===a.rid);
    const b=window.__duFromCo({fileNo:'',contractNo:'',name:'بلا رقم',coNo:1,days:5});return JSON.stringify({a,name:r&&r.data.p.name,n:r&&r.data.exts.length,b})})()`).then(JSON.parse);
  ok('contract number is the reference: «٤٥ / ٢٠٢٦» finds the file with contract 45/2026 (even with a different file number and name)', cn.a.ok && !cn.a.created && cn.name === 'مشروع برقم العقد' && cn.n === 1, JSON.stringify(cn));
  ok('no contract number and no file number → refused with a clear message', cn.b && /رقم العقد/.test(cn.b.error || ''), JSON.stringify(cn.b));
  const cl = await V(`(()=>{const o=AnbarReg.state;AnbarReg.state=()=>({links:{'X1':{co:{cNo:'45/2026',items:[{no:7,days:18}]}}}});const r=DB.recs.find(x=>x.data.p.cNo==='45/2026');openRecord(r.data);const c=coInfo().days;AnbarReg.state=o;return c})()`);
  ok('change-order days are found by contract number in the change-orders summary', cl === 18, cl);
  // زر الإحالة في أوامر التغيير
  await pg.evaluate(() => window.desktop.go('co')); await sleep(3000);
  const C = c => app.evaluate(async (_, c) => global.__uni.views.co.webContents.executeJavaScript(c), c);
  const cob = await C(`typeof window.desktop.duFromCo`); ok('change orders: «إحالة المدة الى برنامج المدد» is available (desktop.duFromCo)', cob === 'function');
  // الإحالة لا تُقبل إلا من البرنامج المعني
  const bad = await C(`window.desktop.zcRefer([{key:'x',need:true}])`); ok('referrals are only accepted from the durations program', bad && bad.error, JSON.stringify(bad));
  const e = await app.evaluate(() => (global.__uniErrors || []).slice()); ok('no JavaScript errors', e.length === 0, e.join(' | ').slice(0, 300));
  await app.close();
  R.forEach(x => console.log(x[0], x[1], x[2] ? '— ' + String(x[2]).slice(0, 400) : '')); console.log(`${R.filter(x => x[0] === 'PASS').length}/${R.length}`); process.exit(R.every(x => x[0] === 'PASS') ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
