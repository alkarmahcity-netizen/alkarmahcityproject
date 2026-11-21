// الخطوط المضمَّنة (build/fonts — محلية لا تُرفع للمستودع): تُحمَّل في كل الأنظمة، وتظهر في قوائم الخطوط، وتُطبع في PDF.
const { _electron: electron } = require('playwright'); const fs = require('fs'), path = require('path'), os = require('os'), { execSync } = require('child_process');
if (!fs.existsSync(path.join(__dirname, 'build', 'fonts', 'dima-thuluth.ttf'))) { console.log('SKIP: build/fonts not present'); process.exit(0); }
const sleep = ms => new Promise(r => setTimeout(r, ms)); const R = []; const ok = (n, c, d = '') => R.push([c ? 'PASS' : 'FAIL', n, d]);
const FAM = require('./shell/fonts-css').FONTS.map(f => f.family);
(async () => { const T = fs.mkdtempSync(path.join(os.tmpdir(), 'fonts-')); const mk = n => { const d = path.join(T, n); fs.mkdirSync(d); return d; };
  const DD = mk('d'); fs.writeFileSync(path.join(DD, 'auth.json'), JSON.stringify({ ad: null, co: null, du: null, in: null, fv: null }));
  const app = await electron.launch({ executablePath: require('electron'), args: ['--no-sandbox', __dirname], env: { ...process.env, UNI_MULTI: mk('u'), UNI_DATA_DIR: DD, ANBAR_REG_DIR: mk('r'), UNI_AC_PORT: '48513', UNI_NO_JSONSCAN: '1', UNI_NO_LINKREFRESH: '1' } });
  const pg = await app.firstWindow(); await pg.waitForLoadState('domcontentloaded'); await sleep(2000);
  const V = (id, c) => app.evaluate(async (_, [id, c]) => global.__uni.views[id].webContents.executeJavaScript(c), [id, c]);
  const loadAll = `Promise.all(${JSON.stringify(FAM)}.map(f=>document.fonts.load("20px '"+f+"'","أبجد").then(a=>a.length>0).catch(()=>false)))`;
  for (const id of ['lt', 'co', 'du', 'ad', 'in', 'fu', 'fv']) {
    await pg.evaluate(id => window.desktop.go(id), id); await sleep(2200);
    const r = await V(id, loadAll); ok(`${id}: all ${FAM.length} bundled fonts load`, r.every(Boolean), JSON.stringify(r));
    const html = await V(id, `document.documentElement.outerHTML`); const miss = ['DecoType Thuluth II', 'Dima Thuluth', 'AH Manal Black', 'Panorama Naskh Long'].filter(n => !html.includes(n) && !/'Dima Thuluth'/.test(html));
    const inList = await V(id, `(()=>{const s=[typeof PO_FONTS!=='undefined'?Object.keys(PO_FONTS):[],typeof FONTS!=='undefined'?Object.keys(FONTS):[],typeof MPO_FONTS!=='undefined'?MPO_FONTS:[],[...document.querySelectorAll('#s_font option')].map(o=>o.textContent)].flat();return ['DecoType Thuluth II','DecoType Thuluth III','Dima Thuluth','Palestine','AH Manal Black','SF Arabic Black','Panorama Naskh Long','PT Bold Heading'].filter(n=>!s.includes(n))})()`);
    ok(`${id}: the new fonts are in the system's font list`, inList.length === 0, 'missing: ' + inList.join(', '));
  }
  // الطباعة إلى PDF بخط مضمَّن: صفحة بنص بخط «Dima Thuluth» و«AH Manal Black» داخل نافذة المخاطبات
  await pg.evaluate(() => window.desktop.go('lt')); await sleep(1500);
  await V('lt', `(()=>{const d=document.createElement('div');d.id='__ft';d.style.cssText="font-family:'Dima Thuluth';font-size:40px";d.textContent='بسم الله الرحمن الرحيم';const e=document.createElement('div');e.style.cssText="font-family:'AH Manal Black';font-size:30px";e.textContent='قسم الشؤون الهندسية';d.append(e);document.body.prepend(d);return document.fonts.ready.then(()=>1)})()`);
  await sleep(500);
  const pdf = await app.evaluate(async () => (await global.__uni.views.lt.webContents.printToPDF({ printBackground: true })).toString('base64'));
  const f = path.join(T, 'f.pdf'); fs.writeFileSync(f, Buffer.from(pdf, 'base64')); const pf = execSync(`pdffonts ${f}`).toString();
  ok('PDF embeds the bundled fonts (Dima Thuluth, Manal Black)', /Dima/i.test(pf) && /Manal/i.test(pf), pf.split('\n').slice(2).map(l => l.split(/\s+/)[0]).join(' '));
  const e = await app.evaluate(() => (global.__uniErrors || []).slice()); ok('no JavaScript errors', e.length === 0, e.join(' | ').slice(0, 300));
  await app.close();
  R.forEach(x => console.log(x[0], x[1], x[2] ? '— ' + String(x[2]).slice(0, 300) : '')); console.log(`${R.filter(x => x[0] === 'PASS').length}/${R.length}`); process.exit(R.every(x => x[0] === 'PASS') ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
