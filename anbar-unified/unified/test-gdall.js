// اختبار «☁ إصدار ورفع إلى Drive» في المخاطبات والسلف والمدد وتقارير الزيارة (خادم Google وهمي محلي):
//  ربط واحد لكل الأنظمة، مجلد لكل نظام، الرابط في حقل رمز QR للمستند قبل PDF، ثم PDF يُرفع على الرابط نفسه، وإعادة الإصدار على الرابط نفسه.
// كلمات سر الأنظمة من البيئة فقط: UNI_TEST_AD_PW، UNI_TEST_DU_PW
const { _electron: electron } = require('playwright');
const fs = require('fs'), path = require('path'), os = require('os'), http = require('http');
const T = path.join(os.tmpdir(), 'uni-gdall'); fs.rmSync(T, { recursive: true, force: true });
const mk = n => { const d = path.join(T, n); fs.mkdirSync(d, { recursive: true }); return d; }; const sleep = ms => new Promise(r => setTimeout(r, ms));
const R = []; const ok = (n, c, d = '') => R.push([c ? 'PASS' : 'FAIL', n, d]);
const GPORT = 48478;
(async () => {
  const G = { files: {}, perms: {}, uploads: [], n: 0 };
  const gsrv = http.createServer((q, s) => { const u = new URL(q.url, 'http://x'); const ch = []; q.on('data', c => ch.push(c)); q.on('end', () => {
    const body = Buffer.concat(ch), J = o => { s.writeHead(200, { 'Content-Type': 'application/json' }); s.end(JSON.stringify(o)); };
    if (u.pathname === '/auth') { s.end('ok'); setTimeout(() => http.get(u.searchParams.get('redirect_uri') + '?code=C1&state=' + u.searchParams.get('state'), r => r.resume()), 100); return; }
    if (u.pathname === '/token') { const p = new URLSearchParams(body.toString());
      if (p.get('grant_type') === 'authorization_code') return J({ access_token: 'AT1', refresh_token: 'RT1', expires_in: 3600, id_token: 'x.' + Buffer.from(JSON.stringify({ email: 'eng@anbar.iq' })).toString('base64url') + '.y' });
      return J({ access_token: 'AT2', expires_in: 3600 }); }
    let m;
    if (q.method === 'POST' && u.pathname === '/drive/v3/files') { const o = JSON.parse(body.toString()); const id = (o.mimeType === 'application/pdf' ? 'FILE' : 'FOLDER') + String(++G.n).padStart(12, '0'); G.files[id] = o; return J({ id }); }
    if (q.method === 'POST' && (m = u.pathname.match(/^\/drive\/v3\/files\/(\w+)\/permissions$/))) { G.perms[m[1]] = 1; return J({ id: 'p' }); }
    if (q.method === 'PATCH' && (m = u.pathname.match(/^\/upload\/drive\/v3\/files\/(\w+)$/))) { G.uploads.push({ id: m[1], size: body.length, pdf: body.slice(0, 4).toString() }); if (process.env.UNI_TEST_GD_OUT) fs.writeFileSync(path.join(process.env.UNI_TEST_GD_OUT, m[1] + '.pdf'), body); return J({ id: m[1] }); }
    if (q.method === 'PATCH') return J({});
    s.writeHead(404); s.end('{}'); }); });
  await new Promise(r => gsrv.listen(GPORT, '127.0.0.1', r)); const GB = `http://127.0.0.1:${GPORT}`;
  const DD = mk('d'); if (!process.env.UNI_TEST_AD_PW) fs.writeFileSync(path.join(DD, 'auth.json'), JSON.stringify({ ad: null, co: null, du: null }));   // قفل الأنظمة مُعطّل في مجلد بيانات الاختبار المؤقت فقط
  const app = await electron.launch({ executablePath: require('electron'), args: ['--no-sandbox', __dirname], env: { ...process.env, UNI_MULTI: mk('u'), UNI_DATA_DIR: DD, ANBAR_REG_DIR: mk('r'), UNI_AC_PORT: '48479', UNI_NO_JSONSCAN: '1', UNI_NO_LINKREFRESH: '1', UNI_GD_API: GB, UNI_GD_AUTH: GB + '/auth', UNI_GD_TOKEN: GB + '/token' } });
  const pg = await app.firstWindow(); await pg.waitForLoadState('domcontentloaded'); await sleep(1500);
  for (const [s, k] of [['ad', 'UNI_TEST_AD_PW'], ['du', 'UNI_TEST_DU_PW']]) if (process.env[k]) await pg.evaluate(([s, pw]) => window.desktop.unlock(s, pw), [s, process.env[k]]);
  const V = id => c => app.evaluate(async (_, [id, c]) => global.__uni.views[id].webContents.executeJavaScript(c), [id, c]);
  const go = async id => { await pg.evaluate(id => window.desktop.go(id), id); await sleep(2500); };
  const has = id => app.evaluate((_, id) => !!(global.__uni.views[id] && global.__uni.views[id].webContents), id);
  const fileOf = url => (/file\/d\/(\w+)\//.exec(url || '') || [])[1];
  // المخاطبات: الربط مرة واحدة ثم إصدار كتاب
  await go('lt'); const lt = V('lt');
  await lt(`(()=>{window.confirm=()=>true;document.querySelector('[data-act=new][data-t=letter]').click();const r=R();r.subject='طلب تزويد';r.to='مديرية الطرق';touch();renderForm();renderPreview(true);return 1})()`); await sleep(1200);
  ok('letters editor shows «☁ إصدار ورفع إلى Drive» and «⚙»', await lt(`!!document.getElementById('btnGdIssue')&&!!document.getElementById('btnGdSet')`));
  await lt(`window.desktop.gdSetApp('9-x.apps.googleusercontent.com','GOCSPX-secret12').then(()=>window.desktop.gdConnect('eng@anbar.iq')).then(r=>JSON.stringify(r))`);
  ok('one connection to the department email', /"connected":true/.test(await lt(`window.desktop.gdStatus().then(s=>JSON.stringify(s))`)));
  await lt(`window.GdIssue.issue().then(()=>1)`); await sleep(500);
  const ltUrl = await lt(`R().drive`), ltId = fileOf(ltUrl);
  ok('letters: the link is put in the letter\'s QR field and its PDF uploaded to that file (folder «المخاطبات والمطالعات»)', ltId && G.uploads.some(u => u.id === ltId && u.pdf === '%PDF') && /المخاطبات/.test(G.files[G.files[ltId].parents[0]].name), ltUrl + ' ' + JSON.stringify(G.uploads));
  await lt(`(()=>{const r=R();r.subject='طلب تزويد — معدّل';touch();return 1})()`); await lt(`window.GdIssue.issue().then(()=>1)`); await sleep(500);
  ok('letters: re-issue keeps the same link and replaces the PDF', (await lt(`R().drive`)) === ltUrl && G.uploads.filter(u => u.id === ltId).length === 2);
  // السلف
  await go('ad'); const ad = V('ad');
  if (await has('ad') && await ad(`!!document.querySelector('[data-act=demo]')`)) {
    await ad(`(()=>{document.querySelector('[data-act=demo]').click();return 1})()`); await sleep(1500);
    await ad(`window.GdIssue.issue().then(()=>1)`); await sleep(500);
    const adUrl = await ad(`(()=>{const r=R();return r.advances[r.printIdx].driveUrl||''})()`), adId = fileOf(adUrl);
    ok('advances: the advance\'s QR link is set and its form PDF uploaded (folder «لجنة تدقيق السلف»)', adId && G.uploads.some(u => u.id === adId) && /السلف/.test(G.files[G.files[adId].parents[0]].name), adUrl);
  } else ok('advances: open (password from UNI_TEST_AD_PW)', false, 'locked');
  // أوامر التغيير
  await go('co'); const co = V('co');
  if (await has('co') && await co(`!!document.querySelector('[data-act=demo]')`)) {
    await co(`(()=>{window.confirm=()=>true;document.querySelector('[data-act=demo]').click();return 1})()`); await sleep(1800);
    ok('change orders: the button is next to «تحميل رمز QR»', await co(`!!document.querySelector('#edBar #btnGdIssue')`));
    await co(`window.GdIssue.issue().then(()=>1)`); await sleep(800);
    const coUrl = await co(`(()=>{const r=R();return r.orders[r.printOrder].link||''})()`), coId = fileOf(coUrl);
    ok('change orders: the order\'s QR link field gets the link and the PDF is uploaded (folder «لجنة أوامر التغيير»)', coId && G.uploads.some(u => u.id === coId && u.pdf === '%PDF') && /أوامر التغيير/.test(G.files[G.files[coId].parents[0]].name), coUrl + ' ' + await co(`(document.querySelector('.flash,#flash,.toast')||{}).textContent||''`));
    ok('change orders: the printed QR now carries the link', (await co(`(()=>{const r=R();return qrInfo(r,r.printOrder,calc(r).rows[r.printOrder]).text})()`)) === coUrl);
  } else ok('change orders: open', false, 'locked');
  // المدد
  await go('du'); const du = V('du');
  if (await has('du') && await du(`!!document.getElementById('bDemo')`)) {
    await du(`(()=>{document.getElementById('bDemo').click();return 1})()`); await sleep(2000);
    await du(`window.GdIssue.issue().then(()=>1)`); await sleep(500);
    const it = JSON.parse(await du(`JSON.stringify((S.sel.t==='ext'?S.exts[S.cur]:S.cases[S.cc])||{})`)), duId = fileOf(it.qr);
    ok('durations: the decision\'s QR link field (qr) gets the link and the PDF is uploaded (folder «المدد والتوقف»)', duId && G.uploads.some(u => u.id === duId) && /المدد/.test(G.files[G.files[duId].parents[0]].name), it.qr);
    ok('durations: the printed QR now carries the link', (await du(`(()=>{const c=calc();return qrText(c,false)})()`)) === it.qr);
  } else ok('durations: open (password from UNI_TEST_DU_PW)', false, 'locked');
  // تقارير الزيارة
  await go('fv'); const fv = V('fv');
  await fv(`(()=>{const e=document.getElementById('f_project');e.value='مدرسة هيت';e.dispatchEvent(new Event('input',{bubbles:true}));return 1})()`); await sleep(1200);
  ok('field-visit report: the button is in the reports bar', await fv(`!!document.querySelector('#fvBar #btnGdIssue')`));
  await fv(`window.GdIssue.issue().then(()=>1)`); await sleep(800);
  const fvUrl = await fv(`document.getElementById('f_pdfLink').value`), fvId = fileOf(fvUrl);
  ok('field-visit report: link in the QR field, PDF uploaded, saved with the report (folder «تقارير زيارة…»)', fvId && G.uploads.some(u => u.id === fvId) && /تقارير زيارة/.test(G.files[G.files[fvId].parents[0]].name) && (await fv(`(FieldVisit.cur()||{d:{}}).d.f_pdfLink`)) === fvUrl, fvUrl);
  ok('every uploaded file was shared «anyone with the link»', Object.keys(G.files).filter(k => /^FILE/.test(k)).every(k => G.perms[k]));
  const e = (await app.evaluate(() => (global.__uniErrors || []).slice())); ok('no JavaScript errors', e.length === 0, e.join(' | ').slice(0, 400));
  await app.close(); gsrv.close();
  R.forEach(x => console.log(x[0], x[1], x[2] ? '— ' + String(x[2]).slice(0, 400) : '')); console.log(`${R.filter(x => x[0] === 'PASS').length}/${R.length}`); process.exit(R.every(x => x[0] === 'PASS') ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
