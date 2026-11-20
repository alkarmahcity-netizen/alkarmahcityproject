// اختبار «النسخة الاحتياطية بملف واحد» و«↺ استرجاع نسخة احتياطية»: النسخة اليومية ملف ZIP واحد لكل الأنظمة، الاسترجاع لنظام مختار
// بكلمة سر المدير (كلمة اختبار في مجلد بيانات مؤقت فقط)، نسخة «قبل الاسترجاع»، النسخة الكاملة مع مرفقات الأرشيف، النسخة الخارجية، والنسخ القديمة.
const { _electron: electron } = require('playwright');
const fs = require('fs'), path = require('path'), os = require('os'), crypto = require('crypto');
const T = path.join(os.tmpdir(), 'uni-backup'); fs.rmSync(T, { recursive: true, force: true });
const mk = n => { const d = path.join(T, n); fs.mkdirSync(d, { recursive: true }); return d; }; const sleep = ms => new Promise(r => setTimeout(r, ms));
const R = []; const ok = (n, c, d = '') => R.push([c ? 'PASS' : 'FAIL', n, d]);
const { readZip } = require('./backupset.js')({ dataDir: () => '', file: () => null, regFile: () => '', archDir: () => '', planDir: () => '', extDirs: () => [], device: () => '', write: () => {} })._zip;
(async () => {
  const DD = mk('d'), OUT = mk('out'), EXT = mk('ext'), PW = 'test-only-master';
  fs.writeFileSync(path.join(DD, 'auth.json'), JSON.stringify({ master: crypto.createHash('sha256').update(`AnbarEng.v1:master:${PW}`).digest('hex') }));
  const L1 = { id: 'L1', v: 1, type: 'letter', status: 'draft', subject: 'كتاب قبل النسخة', body: 'نص', to: 'جهة', updated: 1700000000000, cc: [], tables: [], tos: [], signers: [], sign: {}, memo: {}, entry: {} };
  fs.writeFileSync(path.join(DD, 'Letters-Data.json'), JSON.stringify({ app: 'anbar-letters', version: 1, records: [L1], settings: {} }));
  fs.writeFileSync(path.join(DD, 'ChangeOrders-Data.json'), JSON.stringify({ app: 'anbar-change-orders', version: 2, records: [], settings: {} }));
  fs.mkdirSync(path.join(DD, 'ملفات-الأرشيف', 'A1'), { recursive: true }); fs.writeFileSync(path.join(DD, 'ملفات-الأرشيف', 'A1', 'كتاب.pdf'), Buffer.from('%PDF-1.4 test attachment'));
  fs.mkdirSync(path.join(DD, 'backups'), { recursive: true }); fs.writeFileSync(path.join(DD, 'backups', 'Letters-Data_2026-10-01.json'), JSON.stringify({ app: 'anbar-letters', records: [L1, Object.assign({}, L1, { id: 'L0', subject: 'كتاب من نسخة قديمة' })] }));
  const app = await electron.launch({ executablePath: require('electron'), args: ['--no-sandbox', __dirname], env: { ...process.env, UNI_MULTI: mk('u'), UNI_DATA_DIR: DD, ANBAR_REG_DIR: mk('r'), UNI_AC_PORT: '48505', UNI_NO_JSONSCAN: '1', UNI_NO_LINKREFRESH: '1', UNI_BK_FIRST_MS: '1500', UNI_TEST_SAVE_DIR: OUT, UNI_TEST_PICK_DIR: EXT } });
  const pg = await app.firstWindow(); await pg.waitForLoadState('domcontentloaded'); await sleep(4000);
  const zips = () => fs.readdirSync(path.join(DD, 'backups')).filter(n => n.endsWith('.zip'));
  const z0 = zips().filter(n => n.startsWith('نسخة-الشؤون-الهندسية_'));
  ok('the daily backup is ONE file (zip) for all systems', z0.length === 1, zips().join(','));
  const Z = readZip(fs.readFileSync(path.join(DD, 'backups', z0[0]))), man = JSON.parse(Z['manifest.json'].toString());
  ok('…containing every system with data (letters, change orders) and no passwords', !!Z['data/lt.json'] && !!Z['data/co.json'] && !Object.keys(Z).some(n => /auth/.test(n)) && man.sys.lt && man.sys.lt.n === 1, Object.keys(Z).join(','));
  ok('the daily file does not carry the archive attachments (they stay in the full copy / external mirror)', !Object.keys(Z).some(n => n.startsWith('archive-files/')));
  // تعديل بعد النسخة: كتاب ثانٍ
  await pg.evaluate(() => window.desktop.go('lt')); await sleep(2500);
  const lt = c => app.evaluate(async (_, c) => global.__uni.views.lt.webContents.executeJavaScript(c), c);
  await lt(`(()=>{window.confirm=()=>true;document.querySelector('[data-act=new][data-t=letter]').click();const r=R();r.subject='كتاب بعد النسخة';touch();persist();return 1})()`); await sleep(1500);
  const nNow = JSON.parse(fs.readFileSync(path.join(DD, 'Letters-Data.json'), 'utf8')).records.length;
  ok('after the backup a second letter exists (2 records now)', nNow === 2, String(nNow));
  await pg.evaluate(() => window.desktop.go('home')); await sleep(800);
  // نافذة الاسترجاع
  await pg.evaluate(() => window.AnbarAdmin.rbShow()); await sleep(1000);
  const rows = await pg.evaluate(() => [...document.querySelectorAll('#rbOv [data-rb]')].map(r => r.textContent.replace(/\s+/g, ' ')));
  ok('«↺ استرجاع نسخة احتياطية» lists today\'s file and the old-format day', rows.length >= 2 && rows.some(r => /هذه الحاسبة/.test(r)) && rows.some(r => /قديمة/.test(r)), rows.join(' || '));
  await pg.evaluate(() => { const r = [...document.querySelectorAll('#rbOv [data-rb]')].find(x => !/قديمة/.test(x.textContent)); r.querySelector('td:nth-child(2)').click(); }); await sleep(1200);
  const det = await pg.evaluate(() => [...document.querySelectorAll('#rbOv tbody tr')].map(r => r.textContent.replace(/\s+/g, ' ')).filter(t => /المخاطبات/.test(t)).join(''));
  ok('selecting it shows each system with its records in the backup vs now (المخاطبات 1 vs 2)', /المخاطبات.*1.*2/.test(det), det);
  if (process.env.UNI_TEST_SHOT) { const b = await pg.screenshot(); fs.writeFileSync(process.env.UNI_TEST_SHOT, b); }
  // كلمة سر خاطئة
  await pg.evaluate(() => { window.confirm = () => true; document.querySelectorAll('#rbOv [data-rbs]').forEach(c => { c.checked = c.dataset.rbs === 'lt'; }); document.getElementById('rbPw').value = 'wrong'; document.getElementById('rbGo').click(); }); await sleep(1200);
  ok('restore with a wrong admin password is refused', JSON.parse(fs.readFileSync(path.join(DD, 'Letters-Data.json'), 'utf8')).records.length === 2);
  const key = await pg.evaluate(async () => (await window.desktop.bkList()).find(x => !x.legacy && !x.safe).key);
  const r1 = await pg.evaluate(async ([k, pw]) => { await window.desktop.bkList(); return window.desktop.bkRestore(k, ['lt'], pw); }, [key, PW]);
  await sleep(3500);
  const after = JSON.parse(fs.readFileSync(path.join(DD, 'Letters-Data.json'), 'utf8')).records;
  ok('restoring «المخاطبات» only brings the letters back to the backup (1 record) — other systems untouched', r1.ok && after.length === 1 && after[0].subject === 'كتاب قبل النسخة' && fs.existsSync(path.join(DD, 'ChangeOrders-Data.json')), JSON.stringify(r1));
  const safe = zips().filter(n => n.startsWith('قبل-الاسترجاع_'));
  ok('a «قبل الاسترجاع» copy of the previous state was saved first (has the 2 letters) — the restore can be undone', safe.length === 1 && JSON.parse(readZip(fs.readFileSync(path.join(DD, 'backups', safe[0])))['data/lt.json'].toString()).records.length === 2);
  await pg.waitForLoadState('domcontentloaded'); await sleep(2000);
  await pg.evaluate(() => window.desktop.go('lt')); await sleep(2500);
  ok('the letters program shows the restored data after reload', (await lt(`DB.records.filter(r=>!r.tpl).map(r=>r.subject).join('|')`)) === 'كتاب قبل النسخة');
  // نسخة قديمة (ملف لكل نظام)
  const legacy = await pg.evaluate(async () => (await window.desktop.bkList()).find(x => x.legacy));
  const r2 = await pg.evaluate(async ([k, pw]) => window.desktop.bkRestore(k, ['lt'], pw), [legacy.key, PW]); await sleep(3500);
  ok('an old-format daily backup (one file per system) restores the same way', r2.ok && JSON.parse(fs.readFileSync(path.join(DD, 'Letters-Data.json'), 'utf8')).records.some(r => r.subject === 'كتاب من نسخة قديمة'), JSON.stringify(r2));
  // النسخة الكاملة اليدوية
  await pg.waitForLoadState('domcontentloaded'); await sleep(1500);
  const sv = await pg.evaluate(() => window.desktop.bkSave(true));
  const ZF = sv.ok ? readZip(fs.readFileSync(sv.file)) : {};
  ok('«💾 حفظ نسخة كاملة» writes ONE file with all systems AND the archive attachments', sv.ok && fs.readdirSync(OUT).length === 1 && !!ZF['data/lt.json'] && !!ZF['archive-files/A1/كتاب.pdf'], JSON.stringify(sv));
  // النسخة الخارجية
  await pg.evaluate(async d => { await window.desktop.xbSet({ dest: d, keepDays: 30 }); return window.desktop.xbRun(); }, EXT); await sleep(1500);
  const xdir = path.join(EXT, 'نسخة-نظام-الشؤون-الهندسية'); const dev = fs.readdirSync(xdir)[0]; const yd = fs.readdirSync(path.join(xdir, dev, 'يومي'));
  ok('the external backup\'s daily copy is ONE zip file (not a folder of files)', yd.length === 1 && /^نسخة-الشؤون-الهندسية_\d{4}-\d{2}-\d{2}\.zip$/.test(yd[0]), yd.join(','));
  ok('…and it appears in the restore list as «النسخة الخارجية»', (await pg.evaluate(async () => (await window.desktop.bkList()).some(x => x.where === 'النسخة الخارجية'))));
  const e = (await app.evaluate(() => (global.__uniErrors || []).slice())); ok('no JavaScript errors', e.length === 0, e.join(' | ').slice(0, 400));
  await app.close();
  R.forEach(x => console.log(x[0], x[1], x[2] ? '— ' + String(x[2]).slice(0, 400) : '')); console.log(`${R.filter(x => x[0] === 'PASS').length}/${R.length}`); process.exit(R.every(x => x[0] === 'PASS') ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
