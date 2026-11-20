// اختبار صلاحية أرشيف القسم في حذف الملفات المرسلة إلى اللجان (مزامنة حقيقية بين «حاسبة القسم» و«حاسبة لجنة» في عملية واحدة):
//  • ملف حُذف من كتاب في حاسبة القسم يُحذف من حاسبة اللجنة، ولا تعيده المزامنة إلى القسم.
//  • ملف أُضيف بالاسم نفسه بعد حذفه يُرسل من جديد.
//  • كتاب حُذف من الأرشيف تُحذف ملفاته من حاسبة اللجنة.
const fs = require('fs'), path = require('path'), os = require('os');
const createSync = require('./sync');
const T = path.join(os.tmpdir(), 'uni-arfdel'); fs.rmSync(T, { recursive: true, force: true });
const R = []; const ok = (n, c, d = '') => R.push([c ? 'PASS' : 'FAIL', n, d]);
function node(name) {
  const dir = path.join(T, name), arch = path.join(dir, 'ملفات-الأرشيف'); fs.mkdirSync(arch, { recursive: true });
  const f = id => path.join(dir, id + '.json');
  const ctx = { dataDir: () => dir, version: '1.74.0',
    readData: id => { try { return fs.readFileSync(f(id), 'utf8'); } catch (_) { return null; } },
    writeData: (id, t) => fs.writeFileSync(f(id), t), stamp: id => { try { const s = fs.statSync(f(id)); return s.mtimeMs + ':' + s.size; } catch (_) { return ''; } },
    regFile: () => f('reg'), writeReg: t => fs.writeFileSync(f('reg'), t), acAvailable: () => false, acEval: async () => '{}', applied: () => {},
    archDir: () => arch, archCred: () => null, onState: () => {}, onSynced: () => {} };
  return { dir, arch, ctx, s: createSync(ctx),
    ar: () => { try { return JSON.parse(fs.readFileSync(f('ar'), 'utf8')).records; } catch (_) { return []; } },
    setAr: recs => fs.writeFileSync(f('ar'), JSON.stringify({ records: recs })),
    has: (rec, n) => fs.existsSync(path.join(arch, rec, n)),
    put: (rec, n, txt) => { fs.mkdirSync(path.join(arch, rec), { recursive: true }); fs.writeFileSync(path.join(arch, rec, n), txt); } };
}
(async () => {
  const A = node('dept'), B = node('karma'), PORT = 48471;
  const t0 = Date.now() - 60000;
  A.setAr([{ id: 'd1', serial: '1', subject: 'كتاب إلى لجنة الكرمة', updated: t0, dist: { karma: { at: t0 } }, files: [{ name: 'a.pdf', size: 3, at: t0 }, { name: 'b.pdf', size: 3, at: t0 }] }]);
  A.put('d1', 'a.pdf', 'AAA'); A.put('d1', 'b.pdf', 'BBB');
  A.s.init(); A.s.setConfig({ mode: 'server', port: PORT, key: 'k-arf', name: 'القسم' });
  B.s.init(); B.s.setConfig({ mode: 'client', server: '127.0.0.1:' + PORT, key: 'k-arf', name: 'الكرمة' });
  await new Promise(r => setTimeout(r, 600));
  const sync = async () => { await B.s.syncNow(); await B.s.syncNow(); };
  await sync();
  ok('the letter and both files reach the committee PC', B.ar().some(r => r.id === 'd1') && B.has('d1', 'a.pdf') && B.has('d1', 'b.pdf'));
  // حاسبة القسم تحذف b.pdf
  const now = Date.now(); const r = A.ar()[0]; r.files = r.files.filter(f => f.name !== 'b.pdf'); r.filesDel = { 'b.pdf': now }; r.updated = now; A.setAr([r]); fs.unlinkSync(path.join(A.arch, 'd1', 'b.pdf'));
  await sync();
  const rb = B.ar().find(x => x.id === 'd1') || {};
  ok('a file deleted by the department archive is deleted from the committee PC', !B.has('d1', 'b.pdf') && B.has('d1', 'a.pdf') && (rb.files || []).map(f => f.name).join() === 'a.pdf', JSON.stringify(rb.files));
  ok('…and sync does NOT bring it back to the department', !A.has('d1', 'b.pdf') && (A.ar()[0].files || []).map(f => f.name).join() === 'a.pdf', JSON.stringify(A.ar()[0].files));
  await sync();
  ok('after more syncs it stays deleted on both PCs', !A.has('d1', 'b.pdf') && !B.has('d1', 'b.pdf'));
  // إعادة إضافة ملف بالاسم نفسه
  const r2 = A.ar()[0], t2 = Date.now() + 5; r2.files.push({ name: 'b.pdf', size: 4, at: t2 }); delete r2.filesDel['b.pdf']; r2.updated = t2; A.setAr([r2]); A.put('d1', 'b.pdf', 'BBB2');
  await sync();
  ok('a file re-added later with the same name is sent again', B.has('d1', 'b.pdf') && fs.readFileSync(path.join(B.arch, 'd1', 'b.pdf'), 'utf8') === 'BBB2');
  // حذف الكتاب كله
  A.setAr([]); A.s.tomb('ar', 'd1', Date.now()); fs.rmSync(path.join(A.arch, 'd1'), { recursive: true, force: true });
  await sync();
  ok('a letter deleted from the archive: removed on the committee PC together with its files folder', !B.ar().some(x => x.id === 'd1') && !fs.existsSync(path.join(B.arch, 'd1')), JSON.stringify(B.ar().map(x => x.id)));
  ok('…and its files do not come back to the department', !fs.existsSync(path.join(A.arch, 'd1')) || !fs.readdirSync(path.join(A.arch, 'd1')).length);
  // كل المجموعات تتزامن، ومنها «تقرير زيارة مشاريع التنفيذ أمانة» (fv) — في 1.73.0 كان خادم المزامنة لا يعرف مسارها فتتوقف الجولة
  fs.writeFileSync(path.join(A.dir, 'fv.json'), JSON.stringify({ records: [{ id: 'fv1', updated: Date.now(), d: { f_project: 'مدرسة' } }] }));
  fs.writeFileSync(path.join(A.dir, 'wf.json'), JSON.stringify({ records: [{ id: 'cfg:x', kind: 'cfg', val: '1', updated: Date.now() }] }));
  await sync();
  const fvB = (() => { try { return JSON.parse(fs.readFileSync(path.join(B.dir, 'fv.json'), 'utf8')).records; } catch (_) { return []; } })();
  const wfB = (() => { try { return JSON.parse(fs.readFileSync(path.join(B.dir, 'wf.json'), 'utf8')).records; } catch (_) { return []; } })();
  ok('field-visit reports (fv) sync between PCs, and the sets after it (workflow board) still sync', fvB.some(r => r.id === 'fv1') && wfB.some(r => r.id === 'cfg:x'), JSON.stringify(B.s.state().error));
  ok('sync round finishes without error', B.s.state().ok === true, B.s.state().error);
  A.s.stop(); B.s.stop();
  R.forEach(x => console.log(x[0], x[1], x[2] ? '— ' + String(x[2]).slice(0, 400) : '')); console.log(`${R.filter(x => x[0] === 'PASS').length}/${R.length}`); process.exit(R.every(x => x[0] === 'PASS') ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
