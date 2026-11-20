// اختبار «☁ إصدار ورفع إلى Drive» في الاستلام (خادم Google وهمي محلي: تسجيل الدخول، المجلد، حجز الملف، المشاركة، الرفع):
//  • الربط ببريد القسم مرة واحدة (Client ID/secret ← تسجيل الدخول) ويُحفظ مشفّراً.
//  • الإصدار: رابط Drive يُحجز ويوضع في رمز QR قبل إنشاء PDF، ثم يُرفع PDF على الرابط نفسه — فالرمز يفتح الملف المطبوع نفسه.
//  • إعادة الإصدار بعد تعديل: الرابط نفسه (لا ملف جديد) ويُستبدل المحتوى؛ ولا تنبيه «نسخة قديمة».
// الاستعمال: UNI_TEST_AC_PAGES=<مجلد صفحات الاستلام> UNI_TEST_AC_PW=<كلمة سر الاستلام> xvfb-run -a node test-acgd.js
const { _electron: electron } = require('playwright');
const fs = require('fs'), path = require('path'), os = require('os'), http = require('http');
const PG = process.env.UNI_TEST_AC_PAGES; if (!PG || !fs.existsSync(path.join(PG, 'preliminary.html'))) { console.log('SKIP: UNI_TEST_AC_PAGES not set'); process.exit(0); }
const T = path.join(os.tmpdir(), 'uni-acgd'); fs.rmSync(T, { recursive: true, force: true });
const mk = n => { const d = path.join(T, n); fs.mkdirSync(d, { recursive: true }); return d; }; const sleep = ms => new Promise(r => setTimeout(r, ms));
const R = []; const ok = (n, c, d = '') => R.push([c ? 'PASS' : 'FAIL', n, d]);
const PORT = 48475, GPORT = 48476;
(async () => {
  const srv = http.createServer((q, s) => { const u = q.url.split('?')[0]; if (u === '/__version') { s.end('test'); return; }
    const f = path.join(PG, u === '/' ? 'index.html' : path.basename(u)); if (fs.existsSync(f)) { s.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); s.end(fs.readFileSync(f)); } else { s.writeHead(404); s.end(); } });
  await new Promise(r => srv.listen(PORT, '127.0.0.1', r));
  /* Google وهمي */
  const G = { files: {}, perms: {}, uploads: [], tokens: 0, n: 0 };
  const gsrv = http.createServer((q, s) => { const u = new URL(q.url, 'http://x'); const ch = []; q.on('data', c => ch.push(c)); q.on('end', () => {
    const body = Buffer.concat(ch), J = o => { s.writeHead(200, { 'Content-Type': 'application/json' }); s.end(JSON.stringify(o)); };
    if (u.pathname === '/auth') { s.end('ok'); const red = u.searchParams.get('redirect_uri'), st = u.searchParams.get('state'); setTimeout(() => http.get(red + '?code=CODE123&state=' + st, r => r.resume()), 100); return; }
    if (u.pathname === '/token') { const p = new URLSearchParams(body.toString()); G.tokens++;
      if (p.get('grant_type') === 'authorization_code' && p.get('code') === 'CODE123' && p.get('code_verifier')) return J({ access_token: 'AT1', refresh_token: 'RT1', expires_in: 3600, id_token: 'x.' + Buffer.from(JSON.stringify({ email: 'eng@anbar.iq' })).toString('base64url') + '.y' });
      if (p.get('grant_type') === 'refresh_token' && p.get('refresh_token') === 'RT1') return J({ access_token: 'AT2', expires_in: 3600 });
      s.writeHead(400); return s.end('{"error":"invalid_grant"}'); }
    if (!/^Bearer AT[12]$/.test(q.headers.authorization || '')) { s.writeHead(401); return s.end('{}'); }
    let m;
    if (q.method === 'POST' && u.pathname === '/drive/v3/files') { const o = JSON.parse(body.toString()); const id = (o.mimeType === 'application/pdf' ? 'FILE' : 'FOLDER') + String(++G.n).padStart(12, '0'); G.files[id] = o; return J({ id }); }
    if (q.method === 'POST' && (m = u.pathname.match(/^\/drive\/v3\/files\/(\w+)\/permissions$/))) { G.perms[m[1]] = JSON.parse(body.toString()); return J({ id: 'p1' }); }
    if (q.method === 'PATCH' && (m = u.pathname.match(/^\/upload\/drive\/v3\/files\/(\w+)$/))) { G.uploads.push({ id: m[1], size: body.length, pdf: body.slice(0, 4).toString() }); return J({ id: m[1], size: body.length }); }
    if (q.method === 'PATCH' && (m = u.pathname.match(/^\/drive\/v3\/files\/(\w+)$/))) return J({ id: m[1] });
    s.writeHead(404); s.end('{}'); }); });
  await new Promise(r => gsrv.listen(GPORT, '127.0.0.1', r));
  const GB = `http://127.0.0.1:${GPORT}`;
  const DD = mk('d'); if (!process.env.UNI_TEST_AC_PW) fs.writeFileSync(path.join(DD, 'auth.json'), JSON.stringify({ ac: null }));   // قفل الاستلام مُعطّل في مجلد بيانات الاختبار المؤقت فقط
  const app = await electron.launch({ executablePath: require('electron'), args: ['--no-sandbox', __dirname], env: { ...process.env, UNI_MULTI: mk('u'), UNI_DATA_DIR: DD, ANBAR_REG_DIR: mk('r'), UNI_AC_PORT: String(PORT), UNI_NO_JSONSCAN: '1', UNI_NO_LINKREFRESH: '1', UNI_GD_API: GB, UNI_GD_AUTH: GB + '/auth', UNI_GD_TOKEN: GB + '/token' } });
  const pg = await app.firstWindow(); await pg.waitForLoadState('domcontentloaded'); await sleep(1500);
  if (process.env.UNI_TEST_AC_PW) await pg.evaluate(pw => window.desktop.unlock('ac', pw), process.env.UNI_TEST_AC_PW);
  await pg.evaluate(() => window.desktop.go('ac')); await sleep(2500);
  const ac = c => app.evaluate(async (_, c) => global.__uni.views.ac.webContents.executeJavaScript(c), c);
  await app.evaluate(async (_, p) => { await global.__uni.views.ac.webContents.loadURL(`http://127.0.0.1:${p}/preliminary.html`); }, PORT); await sleep(2500);
  ok('the certificate page has «☁ إصدار ورفع إلى Drive» and «⚙» next to «حفظ PDF»', await ac(`!!document.getElementById('btnGd')&&!!document.getElementById('btnGdSet')`));
  // الإصدار قبل الربط ← نافذة الربط
  await ac(`document.getElementById('btnGd').click()`); await sleep(800);
  ok('issuing before connecting opens the connection window', /ربط الإصدار ببريد القسم/.test(await ac(`(document.getElementById('gdOv')||{}).textContent||''`)));
  await ac(`(()=>{document.getElementById('gdId').value='123-abc.apps.googleusercontent.com';document.getElementById('gdSec').value='GOCSPX-testsecret';document.getElementById('gdSave').click();return 1})()`); await sleep(600);
  await ac(`document.getElementById('gdGo').click()`); await sleep(2500);
  const st = await ac(`window.desktop.gdStatus().then(s=>JSON.stringify(s))`);
  ok('signing in with the department email connects (eng@anbar.iq)', /"connected":true/.test(st) && /eng@anbar\.iq/.test(st), st);
  const cfg = fs.readFileSync(path.join(T, 'd', 'gdrive-config.json'), 'utf8');
  ok('the app secret and the sign-in token are not stored as plain text', !/GOCSPX-testsecret|RT1/.test(cfg), cfg.slice(0, 200));
  await ac(`(()=>{const o=document.getElementById('gdOv');if(o)o.remove();return 1})()`);
  // شهادة وإصدارها
  await ac(`(()=>{const s=(id,v)=>{const e=document.getElementById(id);e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}))};s('pName','مدرسة الكرمة الابتدائية');s('fileNo','1527');document.getElementById('btnSave').click();return 1})()`); await sleep(800);
  await ac(`window.AcqCheck.gdIssue().then(()=>1)`); await sleep(1500);
  const fid = Object.keys(G.files).find(k => /^FILE/.test(k));
  const url = await ac(`document.getElementById('pdfUrl').value`);
  ok('issuing reserves ONE file in Drive (in the certificates folder) and shares it «anyone with the link → viewer»', fid && G.files[fid].parents && /^FOLDER/.test(G.files[fid].parents[0]) && G.perms[fid] && G.perms[fid].type === 'anyone' && G.perms[fid].role === 'reader', JSON.stringify({ files: G.files, perms: G.perms }));
  ok('the QR link field gets that file link before the PDF is made', url === `https://drive.google.com/file/d/${fid}/view`, url);
  ok('the certificate PDF is uploaded to that same file', G.uploads.length === 1 && G.uploads[0].id === fid && G.uploads[0].pdf === '%PDF' && G.uploads[0].size > 20000, JSON.stringify(G.uploads));
  ok('the saved certificate keeps the link (QR opens the printed file)', await ac(`(()=>{const r=JSON.parse(localStorage.getItem(KEY)||'{}');const k=document.getElementById('serial').value;return r[k]&&r[k].pdfUrl===${JSON.stringify(url)}})()`));
  ok('no «old version» warning after issuing', JSON.parse(await ac(`JSON.stringify(window.AcqCheck.problems())`)).length === 0);
  // تعديل ثم إعادة إصدار
  await ac(`(()=>{const e=document.getElementById('pName');e.value='مدرسة الكرمة الابتدائية — معدّلة';e.dispatchEvent(new Event('input',{bubbles:true}));return 1})()`); await sleep(400);
  ok('after editing (before re-issue) the warning appears', JSON.parse(await ac(`JSON.stringify(window.AcqCheck.problems())`)).some(x => /نسخة قديمة/.test(x)));
  await ac(`window.AcqCheck.gdIssue().then(()=>1)`); await sleep(1500);
  ok('re-issuing uses the SAME link (no new file) and replaces the PDF — the printed QR keeps opening the latest version', Object.keys(G.files).filter(k => /^FILE/.test(k)).length === 1 && G.uploads.length === 2 && G.uploads[1].id === fid && JSON.parse(await ac(`JSON.stringify(window.AcqCheck.problems())`)).length === 0, JSON.stringify(G.uploads));
  const e = (await app.evaluate(() => (global.__uniErrors || []).slice())).filter(x => !/\[ac\]/.test(x)); ok('no JavaScript errors in the program', e.length === 0, e.join(' | ').slice(0, 400));
  await app.close(); srv.close(); gsrv.close();
  R.forEach(x => console.log(x[0], x[1], x[2] ? '— ' + String(x[2]).slice(0, 500) : '')); console.log(`${R.filter(x => x[0] === 'PASS').length}/${R.length}`); process.exit(R.every(x => x[0] === 'PASS') ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
