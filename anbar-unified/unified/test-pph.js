// صور المشاريع في بطاقة المشروع (الموقف العام): 3 صور كحد أقصى، مصغّرة داخل البرنامج إلى 300 كيلوبايت أو أقل، تُحفظ ملفات وتُزامَن (pph)
const { _electron: electron } = require('playwright'); const fs = require('fs'), path = require('path'), os = require('os'), { execSync } = require('child_process');
const sleep = ms => new Promise(r => setTimeout(r, ms)); const R = []; const ok = (n, c, d = '') => R.push([c ? 'PASS' : 'FAIL', n, d]);
(async () => { const T = fs.mkdtempSync(path.join(os.tmpdir(), 'pph-')); const mk = n => { const d = path.join(T, n); fs.mkdirSync(d); return d; };
  // صور كبيرة (≈ 4000×3000 ضوضاء ملونة، عدة ميغابايت)
  const IMG = mk('img'); execSync(`python3 -I -c "
import os,sys
from PIL import Image
for i in range(4):
  im=Image.frombytes('RGB',(4000,3000),os.urandom(4000*3000*3)); im.save(os.path.join(sys.argv[1],'big%d.jpg'%i),quality=95)
" ${IMG}`);
  const big = fs.statSync(path.join(IMG, 'big0.jpg')).size;
  const RG = mk('r'); fs.writeFileSync(path.join(RG, 'registry.json'), JSON.stringify({ projects: [{ fileNo: '777', name: 'مشروع تجريبي للصور', contractor: 'شركة س', status: 'مستمر', orig: 1e9, total: 1e9 }], source: 'test', updated: '2026-11-23' }));
  const DD = mk('d');
  const app = await electron.launch({ executablePath: require('electron'), args: ['--no-sandbox', __dirname], env: { ...process.env, UNI_MULTI: mk('u'), UNI_DATA_DIR: DD, ANBAR_REG_DIR: RG, UNI_AC_PORT: '48526', UNI_NO_JSONSCAN: '1', UNI_NO_LINKREFRESH: '1' } });
  const pg = await app.firstWindow(); await pg.waitForLoadState('domcontentloaded'); await sleep(1500);
  await pg.evaluate(() => window.desktop.go('sit')); await sleep(1500);
  await pg.evaluate(() => { window.confirm = () => true; window.SitOpen('777'); }); await sleep(800);
  ok('project card has «📷 صور المشروع» with an add button', await pg.evaluate(() => /صور المشروع/.test(document.getElementById('drawer').textContent) && !!document.querySelector('#drawer input[data-pphadd]')));
  const add = async names => pg.evaluate(async ([dir, names]) => { const inp = document.querySelector('#drawer input[data-pphadd]'); if (!inp) return 'no input'; const dt = new DataTransfer();
    for (const n of names) { const b = await (await fetch('file://' + dir + '/' + n)).arrayBuffer(); dt.items.add(new File([b], n, { type: 'image/jpeg' })); }
    inp.files = dt.files; inp.dispatchEvent(new Event('change', { bubbles: true })); await new Promise(z => setTimeout(z, 6000)); return 'ok'; }, [IMG, names]);
  await add(['big0.jpg', 'big1.jpg']);
  let L = await pg.evaluate(() => (AnbarReg.getMeta('777').photos || ''));
  const files = () => { const root = path.join(DD, 'صور-المشاريع'); try { return fs.readdirSync(root).flatMap(d => fs.readdirSync(path.join(root, d)).map(n => ({ n, s: fs.statSync(path.join(root, d, n)).size }))); } catch (_) { return []; } };
  let F = files();
  ok(`two photos of ${Math.round(big / 1024)} KB each saved compressed to ≤ 300 KB`, L.split(';').length === 2 && F.length === 2 && F.every(f => f.s <= 300 * 1024), JSON.stringify(F.map(f => Math.round(f.s / 1024) + 'KB')));
  await add(['big2.jpg', 'big3.jpg']);
  L = await pg.evaluate(() => (AnbarReg.getMeta('777').photos || ''));
  ok('maximum 3 photos per project (the 4th is refused)', L.split(';').length === 3 && files().length === 3, L);
  ok('no add button when 3 photos exist; thumbnails shown', await pg.evaluate(() => !document.querySelector('#drawer input[data-pphadd]') && [...document.querySelectorAll('#drawer img[data-pph]')].filter(i => i.src.startsWith('data:image/jpeg')).length === 3));
  await pg.evaluate(async () => { document.querySelector('#drawer [data-pphdel]').click(); await new Promise(z => setTimeout(z, 800)); });
  L = await pg.evaluate(() => (AnbarReg.getMeta('777').photos || ''));
  ok('deleting a photo removes it from the project and its file', L.split(';').length === 2 && files().length === 2, L);
  const e = await app.evaluate(() => (global.__uniErrors || []).slice()); ok('no JavaScript errors', e.length === 0, e.join(' | ').slice(0, 300));
  await app.close();
  // المزامنة: ملفات الصور من حاسبة إلى أخرى (المذكورة في سجل الموقف فقط)
  const P = require('./photos'); const A = P({ dataDir: () => DD, regFile: () => path.join(RG, 'registry.json') });
  const DB2 = mk('d2'), RG2 = mk('r2'); fs.copyFileSync(path.join(RG, 'registry.json'), path.join(RG2, 'registry.json'));
  const B = P({ dataDir: () => DB2, regFile: () => path.join(RG2, 'registry.json') });
  const da = A.digest(), db = B.digest(); const need = Object.keys(da.ids).filter(k => !(k in db.ids));
  const n = B.apply(A.get(need)); const db2 = B.digest();
  ok('sync (pph): the other PC receives exactly the project photos', n === 2 && JSON.stringify(db2.ids) === JSON.stringify(da.ids), JSON.stringify({ n, a: Object.keys(da.ids).length, b: Object.keys(db2.ids).length }));
  // سجل الموقف: بيانات مشروع أحدث (تصحيح مالية من حاسبة القسم) لا تمحو صوراً أضافتها لجنة المتابعة، والعكس
  { const createSync = require('./sync.js'); const RF = path.join(mk('r3'), 'registry.json');
    const base = { projects: [{ fileNo: '9', name: 'م' }], meta: { '9': { photos: 'pabcdef1234.jpg', photosAt: 2000, x: 1 } }, metaAt: { '9': 2000 } };
    fs.writeFileSync(RF, JSON.stringify(base));
    const sy = createSync({ dataDir: () => mk('d3'), regFile: () => RF, writeReg: t => fs.writeFileSync(RF, t), readData: () => null, onState: () => {}, applied: () => {}, acAvailable: () => false, version: 't' });
    await sy._API.apply('reg', [{ id: 'M|9', u: 3000, v: { finPaid: 5, x: 2 } }]);
    let m = JSON.parse(fs.readFileSync(RF, 'utf8')).meta['9'];
    ok('newer project data from another PC keeps the committee photos', m.photos === 'pabcdef1234.jpg' && m.finPaid === 5, JSON.stringify(m));
    await sy._API.apply('reg', [{ id: 'M|9', u: 1000, v: { photos: 'pzzzzzz9999.jpg', photosAt: 5000 } }]);
    m = JSON.parse(fs.readFileSync(RF, 'utf8')).meta['9'];
    ok('newer photos arriving with older project data are taken (other data kept)', m.photos === 'pzzzzzz9999.jpg' && m.finPaid === 5, JSON.stringify(m)); }
  R.forEach(x => console.log(x[0], x[1], x[2] ? '— ' + String(x[2]).slice(0, 300) : '')); console.log(`${R.filter(x => x[0] === 'PASS').length}/${R.length}`); process.exit(R.every(x => x[0] === 'PASS') ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
