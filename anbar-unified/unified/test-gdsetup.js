// «رمز إعداد Drive»: حاسبة مربوطة تصدر رمزاً (معرّف التطبيق وسرّه مشفّرين)، وحاسبة سرّها خاطئ (invalid_client) تلصقه فتُصلَح ثم تسجّل الدخول
const { _electron: electron } = require('playwright'); const fs = require('fs'), path = require('path'), os = require('os'), http = require('http');
const sleep = ms => new Promise(r => setTimeout(r, ms)); const R = []; const ok = (n, c, d = '') => R.push([c ? 'PASS' : 'FAIL', n, d]);
const GPORT = 48651;
(async () => {
  const T = fs.mkdtempSync(path.join(os.tmpdir(), 'gds-')); const mk = n => { const d = path.join(T, n); fs.mkdirSync(d, { recursive: true }); return d; };
  const G = { auths: 0 };
  const gsrv = http.createServer((q, s) => { const u = new URL(q.url, 'http://x'); const ch = []; q.on('data', c => ch.push(c)); q.on('end', () => {
    const body = Buffer.concat(ch), J = o => { s.writeHead(200, { 'Content-Type': 'application/json' }); s.end(JSON.stringify(o)); };
    if (u.pathname === '/auth') { G.auths++; s.end('ok'); setTimeout(() => http.get(u.searchParams.get('redirect_uri') + '?code=C1&state=' + u.searchParams.get('state'), r => r.resume()), 100); return; }
    if (u.pathname === '/token') { const p = new URLSearchParams(body.toString()); if (p.get('client_secret') !== 'GOCSPX-right-secret') { s.writeHead(401, { 'Content-Type': 'application/json' }); return s.end(JSON.stringify({ error: 'invalid_client', error_description: 'The provided client secret is invalid.' })); }
      if (p.get('grant_type') === 'authorization_code') return J({ access_token: 'AT1', refresh_token: 'RT9', expires_in: 3600, id_token: 'x.' + Buffer.from(JSON.stringify({ email: 'eng@anbar.iq' })).toString('base64url') + '.y' });
      return J({ access_token: 'AT1', expires_in: 3600 }); }
    s.writeHead(404); s.end('{}'); }); });
  await new Promise(r => gsrv.listen(GPORT, '127.0.0.1', r)); const GB = `http://127.0.0.1:${GPORT}`;
  const P = s => 'p:' + Buffer.from(s).toString('base64');
  const DA = mk('da'), DB = mk('db');
  fs.writeFileSync(path.join(DA, 'gdrive-config.json'), JSON.stringify({ cid: P('x.apps.googleusercontent.com'), cs: P('GOCSPX-right-secret'), rt: P('RT1'), email: 'eng@anbar.iq' }));
  fs.writeFileSync(path.join(DB, 'gdrive-config.json'), JSON.stringify({ cid: P('x.apps.googleusercontent.com'), cs: P('GOCSPX-wrong-typed') }));
  for (const d of [DA, DB]) fs.writeFileSync(path.join(d, 'auth.json'), JSON.stringify({ du: null }));
  const genv = { UNI_GD_API: GB, UNI_GD_AUTH: GB + '/auth', UNI_GD_TOKEN: GB + '/token', UNI_GD_NODE: '1', UNI_VW_FIRST_MS: '600000', UNI_ZC_FIRST_MS: '600000', UNI_NO_JSONSCAN: '1', UNI_NO_LINKREFRESH: '1', UNI_NO_INTRO: '1' };
  const launch = (env, port) => electron.launch({ executablePath: require('electron'), args: ['--no-sandbox', __dirname], env: { ...process.env, ...genv, UNI_AC_PORT: String(port), ...env } });
  const open = async (D, port) => { const A = await launch({ UNI_MULTI: mk('u' + port), UNI_DATA_DIR: D, ANBAR_REG_DIR: mk('r' + port) }, port); const p = await A.firstWindow(); await p.waitForLoadState('domcontentloaded'); await sleep(1500); await p.evaluate(() => window.desktop.go('du')); await sleep(2500);
    return { A, V: c => A.evaluate(async (_, c) => global.__uni.views.du.webContents.executeJavaScript(c), c) }; };
  const a = await open(DA, 48652);
  const ui = await a.V(`(async()=>{GdIssue.dlg();await new Promise(r=>setTimeout(r,500));return JSON.stringify({exp:!!document.getElementById('gdExp'),imp:!!document.getElementById('gdImp')})})()`).then(JSON.parse);
  ok('Drive dialog: «📋 رمز إعداد Drive» on a connected PC, and a paste box for the setup code', ui.exp && ui.imp, JSON.stringify(ui));
  const ex = await a.V(`window.desktop.gdExport()`);
  ok('connected PC: exports a GD1 code (checked working first; secret not readable in it)', ex && ex.ok && /^GD1\./.test(ex.code) && !ex.code.includes('right-secret') && !ex.code.includes('googleusercontent'), JSON.stringify(ex));
  await a.A.close();
  const b = await open(DB, 48653);
  const bad = await b.V(`window.desktop.gdConnect()`);
  ok('PC with a wrong secret: login fails with «client secret is invalid» (the reported problem)', bad && /client secret is invalid/.test(bad.error || ''), JSON.stringify(bad));
  const im = await b.V(`window.desktop.gdImport(${JSON.stringify(ex.code)})`); const st = await b.V(`window.desktop.gdStatus()`);
  ok('pasting the setup code fixes the app ID/secret', im && im.ok && st.configured && !st.connected, JSON.stringify([im, st]));
  const lg = await b.V(`window.desktop.gdConnect()`); const st2 = await b.V(`window.desktop.gdStatus()`);
  ok('then «تسجيل الدخول ببريد القسم» works', lg && lg.ok && st2.connected && st2.email === 'eng@anbar.iq', JSON.stringify([lg, st2]));
  const junk = await b.V(`window.desktop.gdImport('GD1.abc')`); ok('a broken code is refused with a clear message', junk && /غير صحيح|تالف/.test(junk.error || ''), JSON.stringify(junk));
  const e = await b.A.evaluate(() => (global.__uniErrors || []).slice()); ok('no JavaScript errors', e.length === 0, e.join(' | ').slice(0, 300));
  await b.A.close(); gsrv.close();
  R.forEach(x => console.log(x[0], x[1], x[2] ? '— ' + String(x[2]).slice(0, 300) : '')); console.log(`${R.filter(x => x[0] === 'PASS').length}/${R.length}`); process.exit(R.every(x => x[0] === 'PASS') ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
