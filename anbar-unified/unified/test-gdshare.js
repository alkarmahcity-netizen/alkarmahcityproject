// مشاركة ربط Google Drive من حاسبة القسم إلى حاسبات اللجان عبر المزامنة (يفعّلها المدير): مزامنة حقيقية + خادم Google وهمي
const fs = require('fs'), path = require('path'), os = require('os'), http = require('http');
const R = []; const ok = (n, c, d = '') => R.push([c ? 'PASS' : 'FAIL', n, d]);
const GPORT = 48661;
process.env.UNI_GD_API = `http://127.0.0.1:${GPORT}`; process.env.UNI_GD_TOKEN = `http://127.0.0.1:${GPORT}/token`;
const createSync = require('./sync'), createDrive = require('./gdrive');
const T = path.join(os.tmpdir(), 'uni-gdshare'); fs.rmSync(T, { recursive: true, force: true });
const P = s => 'p:' + Buffer.from(s).toString('base64');
function node(name, gcfg, share) {
  const dir = path.join(T, name); fs.mkdirSync(path.join(dir, 'ملفات-الأرشيف'), { recursive: true }); const f = id => path.join(dir, id + '.json');
  if (gcfg) fs.writeFileSync(path.join(dir, 'gdrive-config.json'), JSON.stringify(gcfg));
  const gd = createDrive({ file: () => path.join(dir, 'gdrive-config.json'), net: null, openExternal: () => {} });
  const st = { share: !!share, took: 0 };
  const ctx = { dataDir: () => dir, version: '2.18.6', readData: id => { try { return fs.readFileSync(f(id), 'utf8'); } catch (_) { return null; } },
    writeData: (id, t) => fs.writeFileSync(f(id), t), stamp: () => '', regFile: () => f('reg'), writeReg: t => fs.writeFileSync(f('reg'), t), acAvailable: () => false, acEval: async () => '{}', applied: () => {},
    archDir: () => path.join(dir, 'ملفات-الأرشيف'), archCred: () => null, onState: () => {}, onSynced: () => {},
    gdOffer: quick => { if (!st.share || !gd.status().connected) return quick ? false : null; return quick ? true : gd.shareOut(); },
    gdWant: () => !gd.status().connected, gdTake: o => { const r = gd.shareIn(o); if (r) st.took++; return r; } };
  return { gd, st, s: createSync(ctx) };
}
(async () => {
  const gsrv = http.createServer((q, s) => { let b = ''; q.on('data', c => b += c); q.on('end', () => { const p = new URLSearchParams(b);
    if (q.url === '/token') { if (p.get('client_secret') !== 'GOCSPX-right') { s.writeHead(401); return s.end(JSON.stringify({ error: 'invalid_client', error_description: 'The provided client secret is invalid.' })); } s.writeHead(200, { 'Content-Type': 'application/json' }); return s.end(JSON.stringify({ access_token: 'AT1', expires_in: 3600 })); }
    s.writeHead(404); s.end('{}'); }); });
  await new Promise(r => gsrv.listen(GPORT, '127.0.0.1', r));
  const good = { cid: P('x.apps.googleusercontent.com'), cs: P('GOCSPX-right'), rt: P('RT-dept'), email: 'eng@anbar.iq' };
  const A = node('dept', good, false), B = node('karma', { cid: P('x.apps.googleusercontent.com'), cs: P('GOCSPX-wrong') }, false), C = node('other', { cid: P('y.apps.googleusercontent.com'), cs: P('GOCSPX-c'), rt: P('RT-c'), email: 'c@anbar.iq' }, false);
  const PORT = 48662; A.s.init(); A.s.setConfig({ mode: 'server', port: PORT, key: 'k-gd', name: 'القسم' });
  for (const [n, X] of [['B', B], ['C', C]]) { X.s.init(); X.s.setConfig({ mode: 'client', server: '127.0.0.1:' + PORT, key: 'k-gd', name: n }); }
  await new Promise(r => setTimeout(r, 600));
  await B.s.syncNow();
  ok('sharing OFF (default): the committee PC is not linked by sync', !B.gd.status().connected && B.st.took === 0);
  A.st.share = true; B.s.__resetGd && B.s.__resetGd();
  // يُعاد التحقق كل 10 دقائق: نبدأ عقدة جديدة لنفس الحاسبة (كإعادة تشغيل البرنامج)
  B.s.stop && B.s.stop(); const B2 = node('karma', null, false); B2.s.init(); B2.s.setConfig({ mode: 'client', server: '127.0.0.1:' + PORT, key: 'k-gd', name: 'B' }); await new Promise(r => setTimeout(r, 300));
  await B2.s.syncNow(); const sb = B2.gd.status(), ex = await B2.gd.exportSetup();
  ok('sharing ON: an unlinked committee PC (wrong secret) gets the department link and works — no code, no login', sb.connected && sb.email === 'eng@anbar.iq' && ex.ok, JSON.stringify([sb, ex.error || 'ok']));
  await C.s.syncNow(); const sc = C.gd.status();
  ok('a PC already linked keeps its own link (not replaced)', sc.connected && sc.email === 'c@anbar.iq' && C.st.took === 0, JSON.stringify(sc));
  const raw = await new Promise(res => { const rq = http.request({ hostname: '127.0.0.1', port: PORT, path: '/sync/gd', method: 'POST', headers: { 'Content-Type': 'application/json', 'x-sync-key': 'k-gd' } }, r => { let b = ''; r.on('data', c => b += c); r.on('end', () => res(b)); }); rq.end('{}'); });
  ok('on the network the shared link is encrypted (secret / token not readable)', raw.includes('"ct"') && !raw.includes('GOCSPX') && !raw.includes('RT-dept') && !raw.includes('googleusercontent'), raw.slice(0, 120));
  const bad = await new Promise(res => { const rq = http.request({ hostname: '127.0.0.1', port: PORT, path: '/sync/gd', method: 'POST', headers: { 'Content-Type': 'application/json', 'x-sync-key': 'wrong' } }, r => res(r.statusCode)); rq.end('{}'); });
  ok('without the department sync key: refused', bad === 403, bad);
  for (const X of [A, B2, C]) X.s.stop && X.s.stop(); gsrv.close();
  R.forEach(x => console.log(x[0], x[1], x[2] ? '— ' + x[2] : '')); console.log(`${R.filter(x => x[0] === 'PASS').length}/${R.length}`); process.exit(R.every(x => x[0] === 'PASS') ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
