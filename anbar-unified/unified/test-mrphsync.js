// صور التقرير الشهري في بطاقة المشروع تصل الحاسبات الأخرى بالمزامنة (مخزن صور المشاريع) — دون رابط السكربت ورمزه فيها
const fs = require('fs'), path = require('path'), os = require('os');
const R = []; const ok = (n, c, d = '') => R.push([c ? 'PASS' : 'FAIL', n, d]);
const createSync = require('./sync'), PH = require('./photos');
const T = fs.mkdtempSync(path.join(os.tmpdir(), 'uni-mrph-'));
const J = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=', 'base64');
function node(name, reg) {
  const dir = path.join(T, name); fs.mkdirSync(path.join(dir, 'ملفات-الأرشيف'), { recursive: true }); const f = id => path.join(dir, id + '.json');
  if (reg) fs.writeFileSync(f('reg'), JSON.stringify(reg));
  const ctx = { dataDir: () => dir, version: '2.19.8', readData: id => { try { return fs.readFileSync(f(id), 'utf8'); } catch (_) { return null; } },
    writeData: (id, t) => fs.writeFileSync(f(id), t), stamp: () => '', regFile: () => f('reg'), writeReg: t => fs.writeFileSync(f('reg'), t), acAvailable: () => false, acEval: async () => '{}', applied: () => {},
    archDir: () => path.join(dir, 'ملفات-الأرشيف'), archCred: () => null, onState: () => {}, onSynced: () => {} };
  return { dir, f, s: createSync(ctx) };
}
(async () => {
  const proj = [{ fileNo: '900', name: 'مدرسة (مثال)', contractNo: '91', year: '2024' }];
  const A = node('dept', { app: 'anbar-projects-shared', version: 1, projects: proj, projectsAt: 5, links: {}, meta: { '900': { mrPh: 'pabc12345.jpg;pdef67890.jpg', mrPhKey: 'a2|1', mrPhMonth: '2026-10' } }, metaAt: { '900': Date.now() } });
  const d9 = path.join(A.dir, 'صور-المشاريع', PH.dirOf('900')); fs.mkdirSync(d9, { recursive: true }); fs.writeFileSync(path.join(d9, 'pabc12345.jpg'), J); fs.writeFileSync(path.join(d9, 'pdef67890.jpg'), J);
  const B = node('pc2', { app: 'anbar-projects-shared', version: 1, projects: proj, projectsAt: 5, links: {}, meta: {}, metaAt: {} });
  const PORT = 48681; A.s.init(); A.s.setConfig({ mode: 'server', port: PORT, key: 'k-ph', name: 'القسم' });
  B.s.init(); B.s.setConfig({ mode: 'client', server: '127.0.0.1:' + PORT, key: 'k-ph', name: 'b' }); await new Promise(r => setTimeout(r, 500));
  await B.s.syncNow(); await B.s.syncNow();
  const rb = JSON.parse(fs.readFileSync(B.f('reg'), 'utf8')), mb = (rb.meta || {})['900'] || {};
  ok('the card\'s report-photo list reaches the other PC', mb.mrPh === 'pabc12345.jpg;pdef67890.jpg' && mb.mrPhMonth === '2026-10', JSON.stringify(mb));
  const db = path.join(B.dir, 'صور-المشاريع', PH.dirOf('900'));
  ok('the photo files themselves reach the other PC', ['pabc12345.jpg', 'pdef67890.jpg'].every(n => fs.existsSync(path.join(db, n))));
  const P2 = PH({ dataDir: () => B.dir, regFile: () => B.f('reg') });
  ok('the other PC reads them for the card', !!P2.read('900', 'pabc12345.jpg'));
  for (const X of [A, B]) try { X.s.stop && X.s.stop(); } catch (_) {}
  R.forEach(x => console.log(x[0], x[1], x[2] ? '— ' + x[2] : '')); console.log(`${R.filter(x => x[0] === 'PASS').length}/${R.length}`); process.exit(R.every(x => x[0] === 'PASS') ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
