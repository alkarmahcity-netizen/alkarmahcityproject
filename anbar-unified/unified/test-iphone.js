// صفحة الاطلاع لـ iPhone (iphone/index.html + Code.gs): تفك ملف نسخة الاطلاع المشفّر داخل الهاتف وتعرض الموقف والأقضية والتخطيط والصور وزر الطريق
const { chromium, devices } = require('playwright'); const fs = require('fs'), path = require('path'), http = require('http'), vm = require('vm'), crypto = require('crypto');
const V = require('./viewer');
const sleep = ms => new Promise(r => setTimeout(r, ms)); const R = []; const ok = (n, c, d = '') => R.push([c ? 'PASS' : 'FAIL', n, d]);
(async () => {
  const key = crypto.randomBytes(16), b64u = b => b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const jpg = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/yQALCAABAAEBAREA/8wABgAQEAX/2gAIAQEAAD8A0s8g/9k=', 'base64');
  const reg = { projects: [
    { fileNo: '501', name: 'مشروع الهاتف الأول', contractor: 'شركة أ', status: 'مستمر', orig: 2e9, total: 2.2e9, changeCost: 2e8, actualPct: 40, planPct: 55, district: 'الرمادي', lat: '33.4258', lng: '43.2994', advRaised: 5e8, advPaid: 3e8, start: '2025-03-01', resident: 'مهندس مقيم', phone: '07700000000', supervisor: 'م. سامر المشرف', staff: [{ name: 'علي الكادر', role: 'مهندس متابعة', dept: 'دائرة الطرق' }] },
    { fileNo: '502', name: 'مشروع الهاتف الثاني', contractor: 'شركة ب', status: 'متوقف', orig: 1e9, actualPct: 10, planPct: 60, district: 'هيت', lat: '334145', lng: '424930' },
    { fileNo: '503', name: 'مشروع بلا إحداثيات', contractor: 'شركة ج', status: 'منجز', orig: 5e8, actualPct: 100, planPct: 100, district: 'الرمادي' }],
    meta: { '501': { photos: 'pabc12345.jpg' } }, engineers: [{ name: 'سامر المشرف', role: 'مهندس مشرف', dept: 'قسم الشؤون الهندسية', phone: '07801111111' }, { name: 'بلا مشاريع', role: 'مهندس' }] };
  const pl = { app: 'anbar-planning', version: 1, records: [{ id: 'plan', model: { file: 'خطة.xlsx', projects: [{ key: 'P1', name: 'مشروع خطة تجريبي', plan: 'تنمية الأقاليم', cost: 3e9, spent: 1e9, actPct: 33, comps: ['M1'] }], comps: [{ key: 'M1', name: 'مكوّن الطريق', status: 'قيد التنفيذ', district: 'هيت' }] } }] };
  const FILES = { MAINFILE00001: V.seal(key, Buffer.from(JSON.stringify({ app: 'anbar-viewer', v: 1, at: Date.parse('2026-11-23T12:00:00Z'), reg: JSON.stringify(reg), pl: JSON.stringify(pl), ad: null, ph: { 'x/pabc12345.jpg': { id: 'PHOTO0000001', h: 'a', fn: '501' } } }))), PHOTO0000001: V.seal(key, jpg) };
  const code = 'AV1.MAINFILE00001.' + b64u(key);
  require('child_process').execSync('node ' + JSON.stringify(path.join(__dirname, 'tools', 'iphone-pack.js')));   // الملف المحزوم هو الذي يُلصق في Apps Script
  const html = fs.readFileSync(path.join(__dirname, 'iphone', 'build', 'index.html'), 'utf8');
  let hits = 0;
  const srv = http.createServer((q, s) => { const u = new URL(q.url, 'http://x'); let m;
    if (u.pathname === '/') { s.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return s.end(html); }
    if ((m = u.pathname.match(/^\/dl\/(\w+)$/))) { hits++; if (!FILES[m[1]]) { s.writeHead(404); return s.end(); } s.writeHead(200); return s.end(FILES[m[1]]); }
    s.writeHead(404); s.end(); });
  await new Promise(r => srv.listen(48660, '127.0.0.1', r)); const B = 'http://127.0.0.1:48660/';
  const br = await chromium.launch(); const ctx = await br.newContext({ ...devices['iPhone 13'], deviceScaleFactor: process.env.UNI_TEST_SHOT ? 2 : 1 });
  await ctx.addInitScript(() => { window.VW_DEV_DL = '/dl/'; });
  await ctx.route(/cdnjs\.cloudflare\.com\/.*leaflet\.min\.(js|css)$/, r => { const js = /\.js$/.test(r.request().url()); const f = path.join(__dirname, 'shell', 'vendor', js ? 'leaflet.js' : 'leaflet.css');
    return fs.existsSync(f) ? r.fulfill({ status: 200, contentType: js ? 'application/javascript' : 'text/css', body: fs.readFileSync(f) }) : r.fulfill({ status: 200, contentType: 'text/css', body: '' }); });
  await ctx.route(/tile\.openstreetmap\.org/, r => r.fulfill({ status: 404, body: '' }));
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(String(e)));
  await pg.goto(B + '#' + code); await sleep(1500);
  ok('opens with the code in the link: projects list + summary', await pg.evaluate(() => document.querySelectorAll('.it[data-fn]').length === 3 && /عدد المشاريع/.test(document.body.textContent) && /آخر تحديث من حاسبة القسم/.test(document.getElementById('upd').textContent)));
  ok('summary figures (3 projects, stopped 1, avg actual 50%)', await pg.evaluate(() => { const t = document.querySelector('.kp').textContent; return /متوقف 1/.test(t) && /50%/.test(t); }), await pg.evaluate(() => document.querySelector('.kp').textContent.slice(0, 200)));
  await pg.fill('#fq', 'الثاني'); await sleep(500);
  ok('search filters the list', await pg.evaluate(() => document.querySelectorAll('.it[data-fn]').length === 1));
  await pg.fill('#fq', ''); await sleep(400);
  await pg.click('.it[data-fn="501"]'); await sleep(1200);
  if (process.env.UNI_TEST_SHOT) await pg.screenshot({ path: path.join(process.env.UNI_TEST_SHOT, 'ip-card.png') });
  const href = await pg.evaluate(() => (document.getElementById('route') || {}).href || '');
  ok('project card: «🧭 الطريق إلى المشروع» → Google Maps directions from current location (driving), plus Apple Maps', /^https:\/\/www\.google\.com\/maps\/dir\/\?api=1&destination=33\.4258%2C43\.2994&travelmode=driving$/.test(href) && await pg.evaluate(() => /maps\.apple\.com\/\?daddr=33\.4258%2C43\.2994&dirflg=d/.test(document.getElementById('route2').href) && document.getElementById('route').target === '_blank'), href);
  ok('project card: photo downloaded and decrypted on the phone', await pg.evaluate(() => [...document.querySelectorAll('#sh .ph img')].some(i => /^blob:/.test(i.src))));
  ok('project card: figures and phone link', await pg.evaluate(() => { const t = document.getElementById('sh').textContent; return /2,200,000,000/.test(t) && /200,000,000/.test(t) && /1\/3\/2025/.test(t) && !!document.querySelector('#sh a[href^="tel:07700000000"]'); }));
  await pg.click('#shX'); await pg.click('.it[data-fn="502"]'); await sleep(500);
  ok('packed DMS coordinates (334145 / 424930) converted for the route', /destination=33\.69583\d*%2C42\.825/.test(await pg.evaluate(() => (document.getElementById('route') || {}).href || '')), await pg.evaluate(() => (document.getElementById('route') || {}).href || ''));
  await pg.click('#shX'); await pg.click('.it[data-fn="503"]'); await sleep(400);
  ok('no route button without coordinates', await pg.evaluate(() => !document.getElementById('route')));
  await pg.click('#shX');
  await pg.click('nav button[data-v="cc"]'); await sleep(500);
  if (process.env.UNI_TEST_SHOT) await pg.screenshot({ path: path.join(process.env.UNI_TEST_SHOT, 'ip-cc.png'), fullPage: true });
  ok('monitoring center: KPIs, district ranking, alerts (stopped), sectors', await pg.evaluate(() => { const t = document.getElementById('main').textContent;
    return document.querySelectorAll('.ccr[data-d]').length === 2 && /مركز متابعة/.test(t) && /هيت: 1 مشروع متوقف/.test(t) && /القطاعات/.test(t) && /الانحراف/.test(t); }), await pg.evaluate(() => document.getElementById('main').textContent.slice(0, 300)));
  await pg.click('.ccr[data-d="هيت"]'); await sleep(400);
  ok('tapping a district shows its projects', await pg.evaluate(() => document.querySelectorAll('.it[data-fn]').length === 1 && document.getElementById('fd').value === 'هيت'));
  await pg.click('nav button[data-v="map"]'); await sleep(1500);
  if (process.env.UNI_TEST_SHOT) await pg.screenshot({ path: path.join(process.env.UNI_TEST_SHOT, 'ip-map.png') });
  ok('map tab: interactive map with 2 project markers (1 without coordinates noted)', await pg.evaluate(() => document.querySelectorAll('#map .leaflet-interactive').length === 2 && /بلا إحداثيات/.test(document.body.textContent)), await pg.evaluate(() => document.querySelectorAll('#map .leaflet-interactive').length));
  await pg.evaluate(() => document.querySelector('#map .leaflet-interactive').dispatchEvent(new MouseEvent('click', { bubbles: true }))); await sleep(500);
  await pg.evaluate(() => { const b = document.querySelector('.leaflet-popup .pbtn'); if (b) b.click(); }); await sleep(800);
  ok('map marker → popup → project card opens', await pg.evaluate(() => !document.getElementById('sheet').hidden && !!document.getElementById('route')));
  await pg.click('#shX');
  await pg.click('nav button[data-v="eng"]'); await sleep(500);
  if (process.env.UNI_TEST_SHOT) { await pg.evaluate(() => document.querySelector('.eng').open = true); await sleep(200); await pg.screenshot({ path: path.join(process.env.UNI_TEST_SHOT, 'ip-eng.png') }); }
  ok('supervisors tab: engineers list merged (list + supervisor + staff + resident) with project counts and phone', await pg.evaluate(() => { const t = document.getElementById('main').textContent;
    const first = document.querySelector('.eng'); return /سامر المشرف/.test(first.textContent) && /1 مشروع/.test(first.textContent) && !!first.querySelector('a[href="tel:07801111111"]') && /علي الكادر/.test(t) && /مهندس مقيم/.test(t) && document.querySelectorAll('.eng').length === 4; }), await pg.evaluate(() => [...document.querySelectorAll('.eng .t')].map(x => x.textContent).join(' | ')));
  await pg.evaluate(() => { document.querySelector('.eng').open = true; document.querySelector('.eng .ep').click(); }); await sleep(600);
  ok('engineer → project card, card lists supervisors', await pg.evaluate(() => !document.getElementById('sheet').hidden && /علي الكادر/.test(document.getElementById('sh').textContent) && /م\. سامر المشرف/.test(document.getElementById('sh').textContent)));
  await pg.click('#shX');
  await pg.click('nav button[data-v="pl"]'); await sleep(400);
  ok('planning view with components', await pg.evaluate(() => /مشروع خطة تجريبي/.test(document.body.textContent) && /مكوّن الطريق/.test(document.body.textContent)));
  if (process.env.UNI_TEST_SHOT) { await pg.click('nav button[data-v="sit"]'); await sleep(300); await pg.evaluate(() => { document.getElementById('fd').value = ''; document.getElementById('fd').dispatchEvent(new Event('change')); }); await sleep(300); await pg.screenshot({ path: path.join(process.env.UNI_TEST_SHOT, 'ip-sit.png') }); }
  /* الزيارة التالية بلا رمز في الرابط: الرمز محفوظ في الهاتف، ويُعرض المخزَّن فوراً */
  const pg2 = await ctx.newPage(); pg2.on('pageerror', e => errs.push(String(e))); await pg2.goto(B); await sleep(1200);
  ok('next visit without the code in the link still works (saved on the phone)', await pg2.evaluate(() => document.querySelectorAll('.it[data-fn]').length === 3));
  delete FILES.MAINFILE00001; await pg2.click('#bRef'); await sleep(800);
  ok('if the section stops the viewer: warning shown, last data kept', await pg2.evaluate(() => /غير متاح/.test(document.getElementById('upd').textContent) && document.querySelectorAll('.it[data-fn]').length === 3));
  const ctx3 = await br.newContext({ ...devices['iPhone 13'] }); await ctx3.addInitScript(() => { window.VW_DEV_DL = '/dl/'; }); const p3 = await ctx3.newPage(); p3.on('pageerror', e => errs.push(String(e)));
  await p3.goto(B); await sleep(600);
  ok('first visit without a code asks for it', await p3.evaluate(() => !!document.getElementById('cIn')));
  await p3.fill('#cIn', 'AV1.WRONG000001.' + b64u(crypto.randomBytes(16))); await p3.click('#cOk'); await sleep(600);
  ok('wrong code refused with a message', await p3.evaluate(() => document.getElementById('cE').textContent.length > 5));
  if (process.env.UNI_TEST_SHOT) await p3.screenshot({ path: path.join(process.env.UNI_TEST_SHOT, 'ip-link.png') });
  ok('no JavaScript errors in the page', errs.length === 0, errs.join(' | '));
  /* Code.gs: يقبل ملف نسخة الاطلاع فقط ويرفض أي ملف آخر */
  const gs = fs.readFileSync(path.join(__dirname, 'iphone', 'Code.gs'), 'utf8'); const resp = { MAINOK0000001: [200, [65, 86, 49].concat(Array(40).fill(7))], OTHER00000001: [200, [37, 80, 68, 70]], GONE000000001: [404, []] };
  const sb = { UrlFetchApp: { fetch: u => { const id = decodeURIComponent(u.split('id=')[1]); const r = resp[id] || [404, []]; return { getResponseCode: () => r[0], getBlob: () => ({ getBytes: () => r[1] }) }; } }, Utilities: { base64Encode: b => Buffer.from(b).toString('base64') }, HtmlService: {} };
  vm.createContext(sb); vm.runInContext(gs, sb); const call = id => { try { return sb.vwGet(id); } catch (e) { return 'ERR:' + e.message; } };
  ok('Code.gs: returns the viewer file, refuses other files / bad ids / removed files', call('MAINOK0000001') === Buffer.from([65, 86, 49].concat(Array(40).fill(7))).toString('base64') && /^ERR:/.test(call('OTHER00000001')) && /^ERR:/.test(call('../x')) && /^ERR:.*غير متاح/.test(call('GONE000000001')));
  await br.close(); srv.close();
  R.forEach(x => console.log(x[0], x[1], x[2] ? '— ' + String(x[2]).slice(0, 300) : '')); console.log(`${R.filter(x => x[0] === 'PASS').length}/${R.length}`); process.exit(R.every(x => x[0] === 'PASS') ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
