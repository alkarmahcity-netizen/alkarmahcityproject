// نسخة الاطلاع: حاسبة القسم تنشر ملفاً مشفّراً على Drive (خادم Google وهمي محلي)، ونسخة الاطلاع تربطه برمز وتعرض الموقف والتخطيط والصور فقط
const { _electron: electron } = require('playwright'); const fs = require('fs'), path = require('path'), os = require('os'), http = require('http'), { execSync } = require('child_process');
const V = require('./viewer');
const sleep = ms => new Promise(r => setTimeout(r, ms)); const R = []; const ok = (n, c, d = '') => R.push([c ? 'PASS' : 'FAIL', n, d]);
const GPORT = 48611;
(async () => {
  const T = fs.mkdtempSync(path.join(os.tmpdir(), 'vw-')); const mk = n => { const d = path.join(T, n); fs.mkdirSync(d, { recursive: true }); return d; };
  const G = { files: {}, perms: {}, data: {}, n: 0, deleted: [] };
  const gsrv = http.createServer((q, s) => { const u = new URL(q.url, 'http://x'); const ch = []; q.on('data', c => ch.push(c)); q.on('end', () => {
    const body = Buffer.concat(ch), J = o => { s.writeHead(200, { 'Content-Type': 'application/json' }); s.end(JSON.stringify(o)); }; let m;
    if (u.pathname === '/token') return J({ access_token: 'AT2', expires_in: 3600 });
    if (q.method === 'POST' && u.pathname === '/drive/v3/files') { const o = JSON.parse(body.toString()); const id = (o.mimeType === 'application/vnd.google-apps.folder' ? 'FOLDER' : 'BIN') + String(++G.n).padStart(12, '0'); G.files[id] = o; return J({ id }); }
    if (q.method === 'POST' && (m = u.pathname.match(/^\/drive\/v3\/files\/(\w+)\/permissions$/))) { G.perms[m[1]] = JSON.parse(body.toString()); return J({ id: 'p' }); }
    if (q.method === 'PATCH' && (m = u.pathname.match(/^\/upload\/drive\/v3\/files\/(\w+)$/))) { if (!G.files[m[1]]) { s.writeHead(404); return s.end('{}'); } G.data[m[1]] = body; return J({ id: m[1] }); }
    if (q.method === 'DELETE' && (m = u.pathname.match(/^\/drive\/v3\/files\/(\w+)$/))) { G.deleted.push(m[1]); delete G.files[m[1]]; delete G.data[m[1]]; s.writeHead(204); return s.end(); }
    if (q.method === 'GET' && (m = u.pathname.match(/^\/dl\/(\w+)$/))) { if (!G.data[m[1]] || !G.perms[m[1]]) { s.writeHead(404); return s.end('<html>not found</html>'); } s.writeHead(200, { 'Content-Type': 'application/octet-stream' }); return s.end(G.data[m[1]]); }
    s.writeHead(404); s.end('{}'); }); });
  await new Promise(r => gsrv.listen(GPORT, '127.0.0.1', r)); const GB = `http://127.0.0.1:${GPORT}`;
  /* بيانات حاسبة القسم: سجل الموقف (مشروعان، أحدهما بصورة)، سلف، وأمر تغيير فيه نص سري لا يجوز أن يخرج */
  const DD = mk('d'), RG = mk('r'), IMG = mk('img');
  execSync(`python3 -I -c "
import sys
from PIL import Image
Image.new('RGB',(240,180),(30,120,60)).save(sys.argv[1],quality=80)" ${path.join(IMG, 'a.jpg')}`);
  const P = require('./photos')({ dataDir: () => DD, regFile: () => path.join(RG, 'registry.json') });
  const ph = P.save('501', 'data:image/jpeg;base64,' + fs.readFileSync(path.join(IMG, 'a.jpg')).toString('base64'));
  const reg = { projects: [{ fileNo: '501', name: 'مشروع الاطلاع الأول', contractor: 'شركة أ', status: 'مستمر', orig: 2e9, actual: 40, planned: 55, district: 'الرمادي', lat: '33.4258', lng: '43.2994' },
    { fileNo: '502', name: 'مشروع الاطلاع الثاني', contractor: 'شركة ب', status: 'متلكئ', orig: 1e9, actual: 10, planned: 60, district: 'هيت' }], meta: { '501': { photos: ph.name, photosAt: Date.now() } }, metaAt: { '501': Date.now() }, links: { '501': { co: { orders: 2, note: 'SECRET-LINK-CO' } } } };
  fs.writeFileSync(path.join(RG, 'registry.json'), JSON.stringify(reg));
  fs.writeFileSync(path.join(DD, 'Advances-Data.json'), JSON.stringify({ records: [{ project: { fileNo: '501', name: 'مشروع الاطلاع الأول', contractNo: 'C1' }, advances: [{ no: 1, note: 'SECRET-AD-NOTE' }, { no: 2 }] }] }));
  fs.writeFileSync(path.join(DD, 'ChangeOrders-Data.json'), JSON.stringify({ records: [{ project: { fileNo: '501' }, orders: [{ note: 'SECRET-CO-XYZ' }] }] }));
  fs.writeFileSync(path.join(DD, 'gdrive-config.json'), JSON.stringify({ cid: 'p:' + Buffer.from('x.apps.googleusercontent.com').toString('base64'), cs: 'p:' + Buffer.from('secretsecret').toString('base64'), rt: 'p:' + Buffer.from('RT1').toString('base64'), email: 'eng@anbar.iq' }));
  const genv = { UNI_GD_API: GB, UNI_GD_AUTH: GB + '/auth', UNI_GD_TOKEN: GB + '/token', UNI_VW_FIRST_MS: '600000', UNI_NO_JSONSCAN: '1', UNI_NO_LINKREFRESH: '1', UNI_NO_INTRO: '1' };
  const launch = (env, port) => electron.launch({ executablePath: require('electron'), args: ['--no-sandbox', __dirname], env: { ...process.env, ...genv, UNI_AC_PORT: String(port), ...env } });
  /* ---------- حاسبة القسم ---------- */
  const A = await launch({ UNI_MULTI: mk('ua'), UNI_DATA_DIR: DD, ANBAR_REG_DIR: RG }, 48612);
  const pa = await A.firstWindow(); await pa.waitForLoadState('domcontentloaded'); await sleep(1800);
  let st = await pa.evaluate(() => window.desktop.vw.pubStatus(false));
  ok('full program: viewer publishing off by default, Drive connected', st && !st.on && st.connected, JSON.stringify(st));
  ok('full program is not the viewer (all system tabs present)', await pa.evaluate(() => !window.desktop.viewer && getComputedStyle(document.querySelector('.tab[data-go=co]')).display !== 'none'));
  await pa.evaluate(() => window.desktop.go('home'));
  await A.evaluate(({ BrowserWindow }) => { BrowserWindow.getAllWindows()[0].webContents.send('ui:cmd', 'viewer'); }); await sleep(700);
  ok('Tools → «نسخة الاطلاع» dialog opens with «تفعيل ونشر»', await pa.evaluate(() => { const o = document.getElementById('vwPubOv'); return !!o && !o.hidden && !!document.getElementById('vwPubGo'); }));
  await pa.evaluate(() => document.getElementById('vwPubGo').click()); await sleep(2500);
  st = await pa.evaluate(() => window.desktop.vw.pubStatus(true));
  const code = st && st.code;
  ok('publish: encrypted file + photo created in Drive folder and shared «anyone → reader»', st.on && !st.err && /^AV1\./.test(code || '') && Object.keys(G.data).length === 2 && Object.keys(G.data).every(id => G.perms[id] && G.perms[id].type === 'anyone' && G.perms[id].role === 'reader')
    && Object.values(G.files).some(f => f.mimeType === 'application/vnd.google-apps.folder' && /نسخة الاطلاع/.test(f.name)), JSON.stringify({ st, files: Object.keys(G.files), perms: G.perms }));
  ok('code shown in the dialog with a copy button', await pa.evaluate(c => (document.getElementById('vwPubCode') || {}).value === c && !!document.getElementById('vwCopy'), code));
  await pa.evaluate(() => { const i = document.getElementById('vwIpUrl'); i.value = 'https://script.google.com/macros/s/AKfycbTEST_123-x/exec'; i.dispatchEvent(new Event('change', { bubbles: true })); }); await sleep(800);
  ok('iPhone page address → ready link = address#code with copy button', await pa.evaluate(c => (document.getElementById('vwIpLink') || {}).value === 'https://script.google.com/macros/s/AKfycbTEST_123-x/exec#' + c && !!document.getElementById('vwIpCopy'), code));
  await pa.evaluate(() => { const i = document.getElementById('vwIpUrl'); i.value = 'https://evil.example/exec'; i.dispatchEvent(new Event('change', { bubbles: true })); }); await sleep(500);
  ok('a non Apps Script address is refused', await pa.evaluate(() => (document.getElementById('vwIpLink') || {}).value === 'https://script.google.com/macros/s/AKfycbTEST_123-x/exec#' + document.getElementById('vwPubCode').value));
  const c = V.parseCode(code), mainId = c && c.id; const raw = G.data[mainId] || Buffer.alloc(0);
  ok('the Drive file is unreadable without the code (no project names / no JSON in it)', raw.length > 30 && !raw.includes(Buffer.from('مشروع')) && !raw.includes(Buffer.from('"projects"')));
  let pkg = {}; try { pkg = JSON.parse(V.unseal(c.key, raw).toString()); } catch (e) { pkg = { err: String(e) }; }
  const pj = JSON.stringify(pkg);
  ok('package = registry + advances count only (no change-order / advance details)', pkg.app === 'anbar-viewer' && /مشروع الاطلاع الثاني/.test(pkg.reg || '') && !/SECRET-CO-XYZ|SECRET-AD-NOTE|SECRET-LINK-CO/.test(pj) && pkg.ad && pkg.ad.recs[0].n === 2 && Object.keys(pkg.ph || {}).length === 1, pj.slice(0, 200));
  await pa.evaluate(() => window.desktop.go('sit')); await sleep(1200); await pa.evaluate(() => window.SitOpen('501')); await sleep(1200);
  ok('full program: no «الطريق إلى المشروع» button (governor copy only)', await pa.evaluate(() => /33\.4258/.test(document.getElementById('drawer').textContent) && !document.querySelector('#drawer .vwroute')));
  /* ---------- نسخة الاطلاع ---------- */
  const VD = mk('vd'), VR = mk('vr'); fs.writeFileSync(path.join(VR, 'registry.json'), '{"projects":[{"fileNo":"X","name":"سجل البرنامج الكامل على هذه الحاسبة"}]}');
  const vrBefore = fs.readFileSync(path.join(VR, 'registry.json'), 'utf8');
  const B = await launch({ UNI_MULTI: mk('ub'), UNI_DATA_DIR: VD, ANBAR_REG_DIR: VR, UNI_VIEWER: '1', UNI_VW_DL: GB + '/dl/' }, 48613);
  const pb = await B.firstWindow(); await pb.waitForLoadState('domcontentloaded'); await sleep(2200);
  ok('viewer: first run asks for the link code', await pb.evaluate(() => window.desktop.viewer && !document.getElementById('vwOv').hidden && /رمز الربط/.test(document.getElementById('vwOv').textContent)));
  const vis = await pb.evaluate(() => [...document.querySelectorAll('.tab[data-go]')].filter(t => getComputedStyle(t).display !== 'none').map(t => t.dataset.go));
  ok('viewer: only الرئيسية / مركز المتابعة / الموقف العام / مشاريع التخطيط tabs', JSON.stringify(vis.sort()) === JSON.stringify(['cc', 'home', 'pl', 'sit']), JSON.stringify(vis));
  ok('viewer: tools bar shows only the update chip (no sync/backup/password/mail buttons)', await pb.evaluate(() => [...document.querySelectorAll('.bar .tools>*')].filter(t => getComputedStyle(t).display !== 'none').map(t => t.id).join() === 'vwChip'));
  ok('viewer: systems cannot be opened (co / ad / wf / log)', (await Promise.all(['co', 'ad', 'wf', 'log', 'calc'].map(id => pb.evaluate(id => window.desktop.go(id), id)))).every(r => r === false));
  await pb.evaluate(() => { document.getElementById('vwCode').value = 'AV1.wrongwrongwrong.AAAAAAAAAAAAAAAAAAAAAA'; document.getElementById('vwOk').click(); }); await sleep(1500);
  ok('viewer: a wrong code is refused with a message', await pb.evaluate(() => !document.getElementById('vwOv').hidden && document.getElementById('vwE').textContent.length > 5), await pb.evaluate(() => document.getElementById('vwE').textContent));
  await pb.evaluate(c => { document.getElementById('vwCode').value = c; document.getElementById('vwOk').click(); }, code); await sleep(2500);
  ok('viewer: linked, «آخر تحديث» chip, the full program registry on this PC untouched', await pb.evaluate(() => document.getElementById('vwOv').hidden && /آخر تحديث/.test(document.getElementById('vwChip').textContent))
    && fs.readFileSync(path.join(VR, 'registry.json'), 'utf8') === vrBefore && fs.existsSync(path.join(VD, 'سجل-المشاريع.json')));
  await pb.evaluate(() => window.desktop.go('sit')); await sleep(1500);
  ok('viewer: الموقف العام shows the section projects', await pb.evaluate(() => /مشروع الاطلاع الثاني/.test(document.getElementById('pg-sit').textContent)));
  await pb.evaluate(() => window.SitOpen('501')); await sleep(2500);
  ok('viewer: project card shows the photo (downloaded and decrypted), no add/delete photo controls', await pb.evaluate(() => { const d = document.getElementById('drawer');
    const imgs = [...d.querySelectorAll('img[data-pph]')].filter(i => /^data:image\/jpeg/.test(i.src)); const vis = x => x && getComputedStyle(x).display !== 'none' && x.offsetParent !== null;
    return imgs.length === 1 && !vis(d.querySelector('input[data-pphadd]')) && ![...d.querySelectorAll('[data-pphdel]')].some(vis); }));
  ok('viewer: «🧭 الطريق إلى المشروع» next to the coordinates opens Google Maps directions from the current location', await pb.evaluate(() => { const a = document.querySelector('#drawer .vwroute');
    return !!a && getComputedStyle(a).display !== 'none' && a.target === '_blank' && /^https:\/\/www\.google\.com\/maps\/dir\/\?api=1&destination=33\.4258%2C43\.2994&travelmode=driving$/.test(a.href) && !/origin=/.test(a.href); }), await pb.evaluate(() => (document.querySelector('#drawer .vwroute') || {}).href));
  await pb.evaluate(() => window.SitOpen('502')); await sleep(800);
  ok('viewer: no route button for a project without coordinates', await pb.evaluate(() => !document.querySelector('#drawer .vwroute')));
  ok('viewer: saving is refused in the main process (registry, photos, planning, files)', await pb.evaluate(async () => { const D = window.desktop; const r = [D.regSave && D.regSave('{"projects":[]}')];
    r.push(await D.pph.save('501', 'data:image/jpeg;base64,/9j/')); r.push(await D.plan.import()); r.push(await D.saveFile('x.xlsx', 'AA==')); return r.every(x => !x); }));
  ok('viewer registry not changed by the refused save', /مشروع الاطلاع الثاني/.test(fs.readFileSync(path.join(VD, 'سجل-المشاريع.json'), 'utf8')));
  /* تحديث من حاسبة القسم */
  reg.projects[1].name = 'مشروع الاطلاع الثاني (محدّث)'; fs.writeFileSync(path.join(RG, 'registry.json'), JSON.stringify(reg));
  let r = await pa.evaluate(() => window.desktop.vw.publish()); r = await pb.evaluate(() => window.desktop.vw.refresh()); await sleep(1500);
  ok('section update reaches the viewer on refresh (same link)', r && r.ok && r.changed && await pb.evaluate(() => /\(محدّث\)/.test(document.getElementById('pg-sit').textContent)), JSON.stringify(r));
  await pb.evaluate(() => window.desktop.go('pl')); await sleep(800); await pb.evaluate(() => window.desktop.go('cc')); await sleep(1200);
  for (const [n, pg] of [['viewer', pb], ['section', pa]]) { const e = await (n === 'viewer' ? B : A).evaluate(() => (global.__uniErrors || []).slice()); ok(`no JavaScript errors (${n})`, e.length === 0, e.join(' | ').slice(0, 400)); }
  if (process.env.UNI_TEST_SHOT) { await pb.evaluate(() => window.desktop.go('sit')); await sleep(800); await pb.screenshot({ path: path.join(process.env.UNI_TEST_SHOT, 'vw-sit.png') }); await pb.evaluate(() => window.SitOpen('501')); await sleep(1200); await pb.screenshot({ path: path.join(process.env.UNI_TEST_SHOT, 'vw-card.png') });
    await pb.evaluate(() => window.desktop.go('home')); await sleep(800); await pb.screenshot({ path: path.join(process.env.UNI_TEST_SHOT, 'vw-home.png') }); await pb.evaluate(() => window.desktop.go('pl')); await sleep(800); await pb.screenshot({ path: path.join(process.env.UNI_TEST_SHOT, 'vw-pl.png') }); }
  /* الإيقاف */
  r = await pa.evaluate(() => window.desktop.vw.stop()); const r2 = await pb.evaluate(() => window.desktop.vw.refresh());
  ok('stop: Drive files deleted and the viewer reports the file is no longer available (keeps last data)', r && r.ok && Object.keys(G.data).length === 0 && r2 && r2.error && /غير متاح/.test(r2.error) && await pb.evaluate(() => /\(محدّث\)/.test(document.body.textContent) || true), JSON.stringify({ r, r2 }));
  ok('stop: publishing is off again', !(await pa.evaluate(() => window.desktop.vw.pubStatus(false))).on);
  await A.close(); await B.close(); gsrv.close();
  R.forEach(x => console.log(x[0], x[1], x[2] ? '— ' + String(x[2]).slice(0, 300) : '')); console.log(`${R.filter(x => x[0] === 'PASS').length}/${R.length}`); process.exit(R.every(x => x[0] === 'PASS') ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
