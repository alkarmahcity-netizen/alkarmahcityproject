// مشاركة رابط ورمز التقارير الشهرية من حاسبة القسم الى بقية الحاسبات عبر المزامنة (يفعّلها المدير) — مزامنة حقيقية
const fs = require('fs'), path = require('path'), os = require('os'), http = require('http');
const R = []; const ok = (n, c, d = '') => R.push([c ? 'PASS' : 'FAIL', n, d]);
const createSync = require('./sync');
const T = fs.mkdtempSync(path.join(os.tmpdir(), 'uni-mrshare-'));
const URL0 = 'https://script.google.com/macros/s/AKfyTEST_1/exec';
function node(name, pref) {
  const dir = path.join(T, name); fs.mkdirSync(path.join(dir, 'ملفات-الأرشيف'), { recursive: true }); const f = id => path.join(dir, id + '.json');
  const P = Object.assign({}, pref || {});   // كما في main.js (mrOffer / mrWant / mrTake)
  const ctx = { dataDir: () => dir, version: '2.19.7', readData: id => { try { return fs.readFileSync(f(id), 'utf8'); } catch (_) { return null; } },
    writeData: (id, t) => fs.writeFileSync(f(id), t), stamp: () => '', regFile: () => f('reg'), writeReg: t => fs.writeFileSync(f('reg'), t), acAvailable: () => false, acEval: async () => '{}', applied: () => {},
    archDir: () => path.join(dir, 'ملفات-الأرشيف'), archCred: () => null, onState: () => {}, onSynced: () => {},
    mrOffer: quick => { if (!P.mrShare || !P.mrUrl || !P.mrCode) return quick ? 0 : null; return quick ? (+P.mrShareAt || 1) : { url: P.mrUrl, code: P.mrCode, at: +P.mrShareAt || 1 }; },
    mrWant: at => !(P.mrUrl && P.mrCode) || (!!P.mrSharedAt && +P.mrSharedAt < +at),
    mrTake: o => { if (!o || !/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(String(o.url || '')) || !o.code) return false; P.mrUrl = o.url; P.mrCode = o.code; P.mrSharedAt = +o.at || Date.now(); return true; } };
  return { P, s: createSync(ctx) };
}
(async () => {
  const PORT = 48671, A = node('dept', { mrUrl: URL0, mrCode: 'CODE-1' });
  A.s.init(); A.s.setConfig({ mode: 'server', port: PORT, key: 'k-mr', name: 'القسم' });
  const mkC = (n, pref) => { const X = node(n, pref); X.s.init(); X.s.setConfig({ mode: 'client', server: '127.0.0.1:' + PORT, key: 'k-mr', name: n }); return X; };
  let B = mkC('b'); await new Promise(r => setTimeout(r, 500)); await B.s.syncNow();
  ok('sharing OFF (default): nothing is sent', !B.P.mrUrl && !B.P.mrCode);
  A.P.mrShare = true; A.P.mrShareAt = 1000; B.s.stop && B.s.stop(); B = mkC('b'); const C = mkC('c', { mrUrl: URL0, mrCode: 'MY-OWN' });
  await new Promise(r => setTimeout(r, 300)); await B.s.syncNow(); await C.s.syncNow();
  ok('sharing ON: a PC without the settings receives the link and the code', B.P.mrUrl === URL0 && B.P.mrCode === 'CODE-1', JSON.stringify(B.P));
  ok('a PC that set its own link and code keeps them', C.P.mrCode === 'MY-OWN' && !C.P.mrSharedAt);
  A.P.mrCode = 'CODE-2'; A.P.mrShareAt = 2000; B.s.stop && B.s.stop(); const B2 = node('b', B.P); B2.s.init(); B2.s.setConfig({ mode: 'client', server: '127.0.0.1:' + PORT, key: 'k-mr', name: 'b' });
  await new Promise(r => setTimeout(r, 300)); await B2.s.syncNow();
  ok('the department changes the code → PCs that got it by sharing receive the new code', B2.P.mrCode === 'CODE-2', JSON.stringify(B2.P));
  const raw = await new Promise(res => { const rq = http.request({ hostname: '127.0.0.1', port: PORT, path: '/sync/mrc', method: 'POST', headers: { 'Content-Type': 'application/json', 'x-sync-key': 'k-mr' } }, r => { let b = ''; r.on('data', c => b += c); r.on('end', () => res(b)); }); rq.end('{}'); });
  ok('on the wire the link and code are encrypted', !/CODE-2|script\.google/.test(raw) && /"ct"/.test(raw), raw.slice(0, 80));
  const bad = await new Promise(res => { const rq = http.request({ hostname: '127.0.0.1', port: PORT, path: '/sync/mrc', method: 'POST', headers: { 'Content-Type': 'application/json', 'x-sync-key': 'wrong' } }, r => res(r.statusCode)); rq.end('{}'); });
  ok('without the department sync key: refused', bad === 403, String(bad));
  for (const X of [A, B2, C]) try { X.s.stop && X.s.stop(); } catch (_) {}
  R.forEach(x => console.log(x[0], x[1], x[2] ? '— ' + x[2] : '')); console.log(`${R.filter(x => x[0] === 'PASS').length}/${R.length}`); process.exit(R.every(x => x[0] === 'PASS') ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
