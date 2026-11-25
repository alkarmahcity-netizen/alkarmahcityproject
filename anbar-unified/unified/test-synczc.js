// المزامنة مع بيانات «اللجنة المركزية» (zc): الخادم يقبلها (كان يرد «nf» فتظهر كل الحاسبات «غير متصل: zc: nf»)،
// ومجموعة لا يعرفها خادم بإصدار آخر لا توقف حالة المزامنة
const fs = require('fs'), path = require('path'), os = require('os'), http = require('http');
const createSync = require('./sync');
const T = path.join(os.tmpdir(), 'uni-synczc'); fs.rmSync(T, { recursive: true, force: true });
const R = []; const ok = (n, c, d = '') => R.push([c ? 'PASS' : 'FAIL', n, d]);
function node(name) {
  const dir = path.join(T, name); fs.mkdirSync(path.join(dir, 'ملفات-الأرشيف'), { recursive: true }); const f = id => path.join(dir, id + '.json');
  const ctx = { dataDir: () => dir, version: '2.18.5', readData: id => { try { return fs.readFileSync(f(id), 'utf8'); } catch (_) { return null; } },
    writeData: (id, t) => fs.writeFileSync(f(id), t), stamp: id => { try { const s = fs.statSync(f(id)); return s.mtimeMs + ':' + s.size; } catch (_) { return ''; } },
    regFile: () => f('reg'), writeReg: t => fs.writeFileSync(f('reg'), t), acAvailable: () => false, acEval: async () => '{}', applied: () => {},
    archDir: () => path.join(dir, 'ملفات-الأرشيف'), archCred: () => null, onState: () => {}, onSynced: () => {} };
  return { f, s: createSync(ctx) };
}
(async () => {
  const A = node('dept'), B = node('karma'), PORT = 48491, t0 = Date.now() - 60000;
  fs.writeFileSync(A.f('zc'), JSON.stringify({ recs: [{ id: 'r1|e1', created: t0, updated: t0, data: { p: { name: 'مشروع مركزي' } }, zc: { status: 'pending' } }] }));
  fs.writeFileSync(A.f('du'), JSON.stringify({ recs: [{ id: 'd1', created: t0, updated: t0, data: { p: { name: 'مشروع مدد' } } }] }));
  A.s.init(); A.s.setConfig({ mode: 'server', port: PORT, key: 'k-zc', name: 'القسم' });
  B.s.init(); B.s.setConfig({ mode: 'client', server: '127.0.0.1:' + PORT, key: 'k-zc', name: 'الكرمة' });
  await new Promise(r => setTimeout(r, 600));
  await B.s.syncNow(); await B.s.syncNow();
  const st = B.s.state(); const zc = JSON.parse(fs.readFileSync(B.f('zc'), 'utf8') || '{}');
  ok('server accepts the central-committee set: committee PC shows connected (no «zc: nf»)', st.ok && !st.error, JSON.stringify({ ok: st.ok, error: st.error }));
  ok('central-committee referrals and durations reach the committee PC', (zc.recs || []).some(r => r.id === 'r1|e1') && /مشروع مدد/.test(fs.readFileSync(B.f('du'), 'utf8')));
  A.s.stop && A.s.stop(); B.s.stop && B.s.stop();
  /* خادم بإصدار آخر يعلن مجموعة لكنه يرد «nf» عليها (الخلل في 2.17–2.18.4): لا تظهر الحاسبة «غير متصل» وتُزامن الباقي */
  const P2 = 48492; const srv = http.createServer((q, s) => { let b = ''; q.on('data', c => b += c); q.on('end', () => { const J = (c, o) => { s.writeHead(c, { 'Content-Type': 'application/json' }); s.end(JSON.stringify(o)); };
    if (q.url === '/sync/ping') return J(200, { ok: true, time: Date.now(), name: 'قديم', sets: ['co', 'du', 'zc'] });
    if (/^\/sync\/zc\//.test(q.url)) return J(404, { error: 'nf' });
    if (/\/digest$/.test(q.url)) return J(200, { items: [], tomb: {}, want: [] }); return J(200, { ok: true }); }); });
  await new Promise(r => srv.listen(P2, '127.0.0.1', r));
  const C = node('c2'); C.s.init(); C.s.setConfig({ mode: 'client', server: '127.0.0.1:' + P2, key: 'k-zc', name: 'لجنة' });
  await new Promise(r => setTimeout(r, 300)); await C.s.syncNow(); const st2 = C.s.state();
  ok('a server that does not serve one set (other version) does not make the PC show «not connected»', st2.ok && !st2.error, JSON.stringify({ ok: st2.ok, error: st2.error }));
  C.s.stop && C.s.stop(); srv.close();
  R.forEach(x => console.log(x[0], x[1], x[2] ? '— ' + x[2] : '')); console.log(`${R.filter(x => x[0] === 'PASS').length}/${R.length}`); process.exit(R.every(x => x[0] === 'PASS') ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
