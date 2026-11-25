// نسخة اللجنة المركزية: حاسبة القسم ↔ حاسبة اللجنة (شبكة أخرى) عبر Google Drive ببريد القسم (خادم Google وهمي محلي)
const { _electron: electron } = require('playwright'); const fs = require('fs'), path = require('path'), os = require('os'), http = require('http'), crypto = require('crypto');
const sleep = ms => new Promise(r => setTimeout(r, ms)); const R = []; const ok = (n, c, d = '') => R.push([c ? 'PASS' : 'FAIL', n, d]);
const GPORT = 48631;
(async () => {
  const T = fs.mkdtempSync(path.join(os.tmpdir(), 'zcr-')); const mk = n => { const d = path.join(T, n); fs.mkdirSync(d, { recursive: true }); return d; };
  const G = { files: {}, perms: {}, data: {}, n: 0, deleted: [], gets: 0, authOk: true };
  const gsrv = http.createServer((q, s) => { const u = new URL(q.url, 'http://x'); const ch = []; q.on('data', c => ch.push(c)); q.on('end', () => {
    const body = Buffer.concat(ch), J = o => { s.writeHead(200, { 'Content-Type': 'application/json' }); s.end(JSON.stringify(o)); }; let m;
    if (u.pathname === '/auth') { G.authCid = u.searchParams.get('client_id'); s.end('ok'); setTimeout(() => http.get(u.searchParams.get('redirect_uri') + '?code=C1&state=' + u.searchParams.get('state'), r => r.resume()), 100); return; }
    if (u.pathname === '/token') { const p = new URLSearchParams(body.toString()); if (p.get('client_secret') !== 'secretsecret') { s.writeHead(401, { 'Content-Type': 'application/json' }); return s.end(JSON.stringify({ error: 'invalid_client', error_description: 'Unauthorized' })); }
      if (p.get('grant_type') === 'authorization_code') return J({ access_token: 'AT2', refresh_token: 'RT9', expires_in: 3600, id_token: 'x.' + Buffer.from(JSON.stringify({ email: 'eng@anbar.iq' })).toString('base64url') + '.y' });
      return J({ access_token: 'AT2', expires_in: 3600 }); }
    if (u.pathname.startsWith('/drive') || u.pathname.startsWith('/upload')) { if (q.headers.authorization !== 'Bearer AT2') { G.authOk = false; s.writeHead(401); return s.end('{}'); } }
    if (q.method === 'POST' && u.pathname === '/drive/v3/files') { const o = JSON.parse(body.toString()); const id = (o.mimeType === 'application/vnd.google-apps.folder' ? 'FOLDER' : 'BIN') + String(++G.n).padStart(12, '0'); G.files[id] = o; return J({ id }); }
    if (q.method === 'POST' && (m = u.pathname.match(/^\/drive\/v3\/files\/(\w+)\/permissions$/))) { G.perms[m[1]] = JSON.parse(body.toString()); return J({ id: 'p' }); }
    if (q.method === 'PATCH' && (m = u.pathname.match(/^\/upload\/drive\/v3\/files\/(\w+)$/))) { if (!G.files[m[1]]) { s.writeHead(404); return s.end('{}'); } G.data[m[1]] = body; return J({ id: m[1] }); }
    if (q.method === 'GET' && (m = u.pathname.match(/^\/drive\/v3\/files\/(\w+)$/)) && u.searchParams.get('alt') === 'media') { G.gets++; if (!G.files[m[1]]) { s.writeHead(404); return s.end('{}'); } s.writeHead(200, { 'Content-Type': 'application/octet-stream' }); return s.end(G.data[m[1]] || Buffer.alloc(0)); }
    if (q.method === 'DELETE' && (m = u.pathname.match(/^\/drive\/v3\/files\/(\w+)$/))) { G.deleted.push(m[1]); delete G.files[m[1]]; delete G.data[m[1]]; s.writeHead(204); return s.end(); }
    s.writeHead(404); s.end('{}'); }); });
  await new Promise(r => gsrv.listen(GPORT, '127.0.0.1', r)); const GB = `http://127.0.0.1:${GPORT}`;
  const gcfg = JSON.stringify({ cid: 'p:' + Buffer.from('x.apps.googleusercontent.com').toString('base64'), cs: 'p:' + Buffer.from('secretsecret').toString('base64'), rt: 'p:' + Buffer.from('RT1').toString('base64'), email: 'eng@anbar.iq' });
  const DA = mk('da'), DB = mk('db'); fs.writeFileSync(path.join(DA, 'gdrive-config.json'), gcfg);   // حاسبة اللجنة: بلا أي إعداد لـ Drive (يأتي مع الرمز)
  fs.writeFileSync(path.join(DA, 'auth.json'), JSON.stringify({ du: null, co: null }));
  const genv = { UNI_GD_API: GB, UNI_GD_AUTH: GB + '/auth', UNI_GD_TOKEN: GB + '/token', UNI_GD_NODE: '1', UNI_VW_FIRST_MS: '600000', UNI_ZC_FIRST_MS: '600000', UNI_ZC_PUSH_MS: '500', UNI_NO_JSONSCAN: '1', UNI_NO_LINKREFRESH: '1', UNI_NO_INTRO: '1' };
  const launch = (env, port) => electron.launch({ executablePath: require('electron'), args: ['--no-sandbox', __dirname], env: { ...process.env, ...genv, UNI_AC_PORT: String(port), ...env } });
  /* ---------- حاسبة القسم ---------- */
  const A = await launch({ UNI_MULTI: mk('ua'), UNI_DATA_DIR: DA, ANBAR_REG_DIR: mk('ra') }, 48632);
  const pa = await A.firstWindow(); await pa.waitForLoadState('domcontentloaded'); await sleep(1500);
  await pa.evaluate(() => window.desktop.go('du')); await sleep(2500);
  const VA = c => A.evaluate(async (_, c) => global.__uni.views.du.webContents.executeJavaScript(c), c);
  await VA(`(()=>{const d=blank();Object.assign(d.p,{fileNo:'7001',cNo:'45/2026',name:'مشروع اللجنة البعيدة',contractor:'شركة د',dur:'100',prior:'0',regime:'2014'});const e=newExt(1);e.granted='35';e.requested='35';e.reasons=[{t:'أعمال إضافية',d:'35'}];d.exts=[e];openRecord(d,true);selExt(0);writeDB();return 1})()`);
  let L = await A.evaluate(() => global.__uni.zcDept().link());
  ok('department: activating creates two PRIVATE Drive files (no «anyone» sharing) and a link code (ZC2, carries the app ID encrypted)', L && L.ok && /^ZC2\./.test(L.code) && !L.code.includes('secretsecret') && !L.code.includes('googleusercontent') && Object.keys(G.perms).length === 0 && Object.keys(G.files).filter(k => k.startsWith('BIN')).length === 2, JSON.stringify(L) + JSON.stringify(G.perms));
  const code = L.code; await sleep(2500);
  const inId = code.split('.')[1]; const raw = G.data[inId] || Buffer.alloc(0);
  ok('the referrals file on Drive is encrypted (no project names in clear text)', raw.length > 40 && !raw.toString('utf8').includes('اللجنة البعيدة') && !raw.toString('latin1').includes('7001'), raw.length);
  /* ---------- حاسبة اللجنة (نسخة anbarZc) ---------- */
  const B = await launch({ UNI_MULTI: mk('ub'), UNI_DATA_DIR: DB, ANBAR_REG_DIR: mk('rb'), UNI_ZCAPP: '1' }, 48633);
  const pb = await B.firstWindow(); await pb.waitForLoadState('domcontentloaded'); await sleep(1500);
  const lock = await pb.evaluate(() => ({ url: location.href, first: !document.getElementById('fFirst').hidden, tabs: document.querySelectorAll('.tab,[data-go]').length }));
  ok('committee edition opens on its own lock screen (first run: set a password), no other tabs', /zclock\.html/.test(lock.url) && lock.first && lock.tabs === 0, JSON.stringify(lock));
  const PW = process.env.ZC_TEST_PW || crypto.randomBytes(6).toString('hex');
  const notYet = await pb.evaluate(() => window.desktop.zcrStatus()); ok('locked: link channels refuse before the password', notYet === null);
  await pb.evaluate(pw => window.desktop.zclFirst(pw), PW); await sleep(3500);
  const W = c => pb.evaluate(c);
  const ui = await W(`({url:location.href,zc:document.body.classList.contains('zcmode')&&document.body.classList.contains('zcremote'),brand:document.querySelector('header.top .brand b').textContent,link:(document.getElementById('zcLink')||{}).textContent||''})`);
  ok('after the password: only the central committee page, with «الربط بحاسبة القسم» box', /du\.html\?zc=1&remote=1/.test(ui.url) && ui.zc && /اللجنة المركزية للمصادقة/.test(ui.brand) && /الربط بحاسبة القسم/.test(ui.link) && /غير مربوطة/.test(ui.link), JSON.stringify(ui).slice(0, 300));
  const bad = await W(`window.desktop.zcrLink('ZC1.abc')`); ok('a wrong code is refused with a clear message', bad && /رمز الربط غير صحيح/.test(bad.error), JSON.stringify(bad));
  const lk0 = await W(`window.desktop.zcrLink(${JSON.stringify(code)})`); const st0 = await W(`window.desktop.zcrStatus()`); const g0 = await W(`window.desktop.gdStatus()`);
  ok('committee (no Drive setup at all): pasting the code sets the app ID itself and asks only for the department e-mail login', lk0 && lk0.needLogin && st0.pendLogin && st0.pendV === 2 && g0.configured && !g0.connected, JSON.stringify([lk0, st0, g0]));
  await W(`window.linkBox&&1`); const ui2 = await W(`(async()=>{await new Promise(r=>setTimeout(r,300));document.querySelector('#zcLink details').open=true;return document.getElementById('zcLink').textContent})()`);
  const lg = await W(`window.desktop.gdConnect()`);
  ok('login with the department e-mail uses the department app ID (from the code)', lg && lg.ok && G.authCid === 'x.apps.googleusercontent.com', JSON.stringify(lg));
  const lk = await W(`window.desktop.zcrLink('')`); await sleep(2000);
  const got = await W(`JSON.stringify(DB.recs.filter(r=>r.zc).map(r=>({name:r.data.p.name,st:r.zc.status,days:r.zc.days,pct:r.zc.pct})))`).then(JSON.parse);
  ok('committee: linking with the code receives the referral (35 days, 35%) as pending', lk && lk.ok && got.length === 1 && got[0].name === 'مشروع اللجنة البعيدة' && got[0].st === 'pending' && got[0].pct === 35, JSON.stringify([lk, got]));
  ok('every Drive call used the department account token', G.authOk && G.gets > 0);
  // مقرر اللجنة: مصادقة جزئية 25 يوماً
  await W(`(()=>{const r=DB.recs.find(r=>r.zc);window.__zcOpen(r.id);const e=S.exts[S.cur];e.z.formNo='88';e.z.date='2026-11-24';e.z.decision='partial';e.z.days='25';S.z.issuer='قسم العقود (اللجنة)';window.confirm=()=>true;upd();save();return 1})()`); await sleep(600);
  await W(`document.getElementById('zcGo').click();1`); await sleep(3000);
  const dst = await W(`JSON.stringify({st:DB.recs.find(r=>r.zc).zc.status})`).then(JSON.parse);
  const outId = code.split('.')[2]; const rawOut = G.data[outId] || Buffer.alloc(0);
  const qz = await W(`(()=>{const r=DB.recs.find(r=>r.zc);const e=S.exts.find(x=>x.id===r.zc.extId);return JSON.stringify({qr:e.z.qr||'',lbl:(document.querySelector('#out .page.pz .qrd')||{}).textContent||'',svg:!!document.querySelector('#qrZ svg')})})()`).then(JSON.parse);
  const pdfId = (/file\/d\/([A-Za-z0-9_-]+)/.exec(qz.qr) || [])[1];
  ok('committee: «إصدار» first issues the decision PDF to Drive — the QR becomes its link (same format as durations / change orders)', !!pdfId && G.data[pdfId] && G.data[pdfId].slice(0, 4).toString() === '%PDF' && G.perms[pdfId] && G.perms[pdfId].type === 'anyone' && /رابط القرار/.test(qz.lbl) && qz.svg, JSON.stringify(qz));
  ok('committee: «إصدار» marks it decided and uploads the decisions file (encrypted)', dst.st === 'decided' && rawOut.length > 40 && !rawOut.toString('utf8').includes('قسم العقود'), JSON.stringify(dst) + rawOut.length);
  // حاسبة القسم تستلم القرار
  const pr = await A.evaluate(() => global.__uni.zcDept().pull()); await sleep(2500);
  const back = await VA(`(()=>{const r=DB.recs.find(r=>r.data.p.cNo==='45/2026');openRecord(r.data);selExt(0);const e=S.exts[0],c=chain().out[0];return JSON.stringify({z:e.z,iss:S.z.issuer,final:c.final})})()`).then(JSON.parse);
  ok('department: the decision arrives in the durations program (number 88, 25 days, committee settings)', pr && pr.ok && pr.n === 1 && back.z.fromZc && back.z.formNo === '88' && back.final === 25 && back.iss === 'قسم العقود (اللجنة)', JSON.stringify([pr, back]));
  const dq = await VA(`(()=>{const e=S.exts[0];upd();return JSON.stringify({qr:e.z.qr||'',lbl:(document.querySelector('#out .page.pz .qrd')||{}).textContent||''})})()`).then(JSON.parse);
  ok('department: the central decision page in durations carries the same QR link (the committee decision PDF)', dq.qr === qz.qr && /رابط القرار/.test(dq.lbl), JSON.stringify(dq));
  const pr2 = await A.evaluate(() => global.__uni.zcDept().pull()); ok('the same decision is not applied twice', pr2 && pr2.ok && pr2.n === 0, JSON.stringify(pr2));
  // تعديل الطلب في المدد → يُحدَّث عند اللجنة؛ ونزوله تحت 25% → يُسحب
  await VA(`(()=>{S.exts[0].granted='20';upd();writeDB();return 1})()`); await sleep(3500);
  await W(`window.desktop.zcrSync()`); await sleep(2000);
  const w = await W(`JSON.stringify(DB.recs.filter(r=>r.zc).map(r=>({st:r.zc.status,w:r.zc.withdrawn})))`).then(JSON.parse);
  ok('a request dropping under 25% reaches the committee as withdrawn (a decided one keeps its decision)', w.length === 1 && w[0].st === 'decided', JSON.stringify(w));
  const st = await W(`window.desktop.zcrStatus()`); ok('committee status: linked, received and sent times', st && st.linked && st.pulled && st.pushed && !st.err, JSON.stringify(st));
  // كلمة سر النسخة: القفل والدخول
  await B.evaluate(() => { global.__uni.unlocked.delete('zc'); return 1; }); await sleep(4000);
  const relock = await pb.evaluate(() => location.href); ok('locking returns to the lock screen', /zclock\.html/.test(relock), relock);
  const wrong = await pb.evaluate(() => window.desktop.zclUnlock('wrong-password')); ok('wrong password refused', wrong === false);
  const right = await pb.evaluate(pw => window.desktop.zclUnlock(pw), PW); await sleep(2500);
  ok('right password opens the committee page again with its data', right === true && await pb.evaluate(() => /du\.html/.test(location.href) && DB.recs.some(r => r.zc)));
  // إيقاف من حاسبة القسم
  const stp = await A.evaluate(() => global.__uni.zcDept().stop());
  ok('department: stopping deletes both Drive files', stp && stp.ok && G.deleted.includes(inId) && G.deleted.includes(outId));
  const e1 = await A.evaluate(() => (global.__uniErrors || []).slice()), e2 = await B.evaluate(() => (global.__uniErrors || []).slice());
  ok('no JavaScript errors (department + committee)', e1.length === 0 && e2.length === 0, e1.concat(e2).join(' | ').slice(0, 400));
  await A.close(); await B.close(); gsrv.close();
  R.forEach(x => console.log(x[0], x[1], x[2] ? '— ' + String(x[2]).slice(0, 400) : '')); console.log(`${R.filter(x => x[0] === 'PASS').length}/${R.length}`); process.exit(R.every(x => x[0] === 'PASS') ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
