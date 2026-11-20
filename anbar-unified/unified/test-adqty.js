// اختبار «📎 كشف كميات السلفة» و«📊 مقارنة كميات السلف» في تدقيق السلف:
//  ثلاث سلف (كشفان Excel بعنوان من صفين وكشف Word): الحساب العرضي، المجاميع مقابل البرنامج، التراكم من السلف السابقة،
//  نزول الكمية التراكمية (150 ← 90) يُؤشَّر للجنة، وتجاوز كمية العقد، وقرار اللجنة.
const { _electron: electron } = require('playwright');
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');
const XLW = require('./shell/xlwriter.js');
const T = path.join(os.tmpdir(), 'uni-adqty'); fs.rmSync(T, { recursive: true, force: true });
const mk = n => { const d = path.join(T, n); fs.mkdirSync(d, { recursive: true }); return d; }; const sleep = ms => new Promise(r => setTimeout(r, ms));
const R = []; const ok = (n, c, d = '') => R.push([c ? 'PASS' : 'FAIL', n, d]);
(async () => {
  const c = v => v == null || v === '' ? null : { v };
  const H1 = ['ت', 'تفاصيل الفقرة', 'الوحدة', 'الكمية حسب العقد', 'سعر المفرد', 'الكميات', '', '', 'المبالغ', '', ''], H2 = ['', '', '', '', '', 'السابقة', 'الحالية', 'التراكمية', 'السابقة', 'الحالية', 'التراكمية'];
  const book = (rows, f) => fs.writeFileSync(f, XLW.book([{ name: 'كشف السلفة', rows: [['كشف السلفة'], [], H1, H2, ...rows].map(r => r.map(c)), merges: ['F3:H3', 'I3:K3'] }]));
  fs.mkdirSync(T, { recursive: true });
  const X1 = path.join(T, 'adv1.xlsx'), X2 = path.join(T, 'adv2.xlsx'), W3 = path.join(T, 'adv3.docx');
  book([[1, 'أعمال الحفريات الترابية', 'م3', 500, 5000, 0, 100, 100, 0, 500000, 500000], [2, 'صب خرسانة اعتيادية', 'م3', 200, 100000, 0, 20, 20, 0, 2000000, 2000000], ['', 'المجموع', '', '', '', '', '', '', 0, 2500000, 2500000]], X1);
  book([[1, 'أعمال الحفريات الترابية', 'م3', 500, 5000, 100, 50, 150, 500000, 250000, 750000], [2, 'صب خرسانة اعتيادية', 'م3', 200, 100000, 20, 30, 50, 2000000, 3000000, 5100000], ['', 'المجموع', '', '', '', '', '', '', 2500000, 3250000, 5850000]], X2);
  // Word: جدول بصف عنوان واحد
  const cell = t => `<w:tc><w:p><w:r><w:t>${t}</w:t></w:r></w:p></w:tc>`, row = a => `<w:tr>${a.map(cell).join('')}</w:tr>`;
  const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>كشف السلفة الثالثة</w:t></w:r></w:p><w:tbl>${row(['ت', 'الفقرة', 'الوحدة', 'الكمية التراكمية', 'سعر المفرد', 'المبلغ التراكمي'])}${row(['1', 'أعمال الحفريات الترابية', 'م3', '90', '5,000', '450,000'])}${row(['2', 'صب خرسانة اعتيادية', 'م3', '210', '100,000', '21,000,000'])}</w:tbl></w:body></w:document>`;
  const dd = path.join(T, 'docx'); fs.mkdirSync(path.join(dd, 'word'), { recursive: true }); fs.writeFileSync(path.join(dd, 'word', 'document.xml'), docXml);
  fs.writeFileSync(path.join(dd, '[Content_Types].xml'), '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>');
  cp.execSync(`cd "${dd}" && python3 -c "import zipfile;z=zipfile.ZipFile('${W3}','w',zipfile.ZIP_DEFLATED);z.write('[Content_Types].xml');z.write('word/document.xml');z.close()"`);
  const DD = mk('d'); fs.writeFileSync(path.join(DD, 'auth.json'), JSON.stringify({ ad: null }));   // قفل السلف مُعطّل في مجلد بيانات الاختبار المؤقت فقط
  const app = await electron.launch({ executablePath: require('electron'), args: ['--no-sandbox', __dirname], env: { ...process.env, UNI_MULTI: mk('u'), UNI_DATA_DIR: DD, ANBAR_REG_DIR: mk('r'), UNI_AC_PORT: '48493', UNI_NO_JSONSCAN: '1', UNI_NO_LINKREFRESH: '1' } });
  const pg = await app.firstWindow(); await pg.waitForLoadState('domcontentloaded'); await sleep(1500);
  await pg.evaluate(() => window.desktop.go('ad')); await sleep(2500);
  const ad = s => app.evaluate(async (_, s) => global.__uni.views.ad.webContents.executeJavaScript(s), s);
  await ad(`(()=>{window.confirm=()=>true;document.querySelector('[data-act=new]').click();return 1})()`); await sleep(1200);
  await ad(`(()=>{const r=R();r.project.name='مدرسة السلف';r.advances[0].cumulative=2500000;r.advances.push(Object.assign(newAdvance(),{cumulative:5750000}));r.advances.push(Object.assign(newAdvance(),{cumulative:21450000}));touch();renderForm();return 1})()`); await sleep(800);
  ok('every advance has «📎 كشف كميات السلفة» with «تحميل كشف السلفة (Excel أو Word)»', (await ad(`document.querySelectorAll('.aq-line [data-aqpick]').length`)) === 3);
  const up = async (i, f) => { const b = fs.readFileSync(f).toString('base64'); return ad(`(async()=>{const b=Uint8Array.from(atob('${b}'),c=>c.charCodeAt(0));const p=await AdQty.load(${i},new File([b],'${path.basename(f)}'));const o=document.getElementById('aqOv');if(o)o.remove();return JSON.stringify(p&&{n:p.items.length,cols:p.cols,tot:p.tot})})()`); };
  const p1 = JSON.parse(await up(0, X1));
  ok('Excel bill with a 2-row header (الكميات / المبالغ over السابقة · الحالية · التراكمية) is read: 2 items, all columns', p1 && p1.n === 2 && ['desc', 'unit', 'cq', 'pr', 'pq', 'q', 'cm', 'ap', 'ac', 'am'].every(k => p1.cols.includes(k)) && p1.tot.am === 2500000, JSON.stringify(p1));
  await up(1, X2); const p3 = JSON.parse(await up(2, W3));
  ok('Word bill (advance 3) is read', p3 && p3.n === 2, JSON.stringify(p3));
  const A = JSON.parse(await ad(`JSON.stringify(AdQty.audit().cols.map(c=>({open:c.open,iss:c.iss.map(z=>z.t+':'+z.desc),tot:c.tot,cum:Object.values(c.cell).map(z=>[z.it&&z.it.desc,z.cum,z.cur])})))`));
  ok('advance 1: rows and totals correct — no notes', A[0].open === 0 && A[0].tot.every(t => t.ok), JSON.stringify(A[0]));
  ok('advance 2: concrete 50 × 100,000 ≠ 5,100,000 flagged across the row', A[1].iss.includes('calc:صب خرسانة اعتيادية') && A[1].iss.length === 1, JSON.stringify(A[1].iss));
  ok('advance 2: the bill total 5,850,000 vs the program cumulative 5,750,000 is flagged; current 3,250,000 = net', A[1].tot.some(t => !t.ok && /5,850,000/.test(t.m) && /5,750,000/.test(t.m)) && A[1].tot.some(t => t.ok && /الحالية/.test(t.m)), JSON.stringify(A[1].tot));
  ok('advance 3: earthworks cumulative dropped 150 → 90 is flagged for the committee; concrete 210 exceeds the contract 200', A[2].iss.includes('drop:أعمال الحفريات الترابية') && A[2].iss.includes('over:صب خرسانة اعتيادية'), JSON.stringify(A[2]));
  ok('quantities accumulate: advance 3 current = 90 − 150 = −60 and 210 − 50 = 160 (from the previous advance)', JSON.stringify(A[2].cum).includes('["أعمال الحفريات الترابية",90,-60]') && JSON.stringify(A[2].cum).includes('["صب خرسانة اعتيادية",210,160]'), JSON.stringify(A[2].cum));
  await ad(`(()=>{AdQty.show(2);return 1})()`); await sleep(400);
  const tx = await ad(`document.getElementById('aqOv').textContent`);
  ok('the comparison window puts the advances side by side (السلفة 1 · 2 · 3) and shows the drop ⬇', /السلفة 1/.test(tx) && /السلفة 2/.test(tx) && /السلفة 3/.test(tx) && /⬇/.test(tx) && /نزلت من 150/.test(tx), tx.slice(0, 300));
  const o0 = await ad(`AdQty.audit().cols[2].open`);
  await ad(`(()=>{const s=document.querySelector('[data-aqd*="|drop"][data-f=st]');s.value='rej';s.dispatchEvent(new Event('change',{bubbles:true}));const n=document.querySelector('[data-aqd*="|drop"][data-f=note]');n.value='لا مسوغ لتخفيض الكمية';n.dispatchEvent(new Event('change',{bubbles:true}));return 1})()`); await sleep(500);
  const d = JSON.parse(await ad(`JSON.stringify(R().qxDec)`));
  ok('committee decision «مرفوض» with a note is saved and the drop no longer counts as open', Object.values(d).some(x => x.st === 'rej' && x.note === 'لا مسوغ لتخفيض الكمية') && (await ad(`AdQty.audit().cols[2].open`)) === o0 - 1, JSON.stringify(d));
  if (process.env.UNI_TEST_SHOT) { await sleep(500); const b = await app.evaluate(async () => (await global.__uni.views.ad.webContents.capturePage()).toPNG().toString('base64')); fs.writeFileSync(process.env.UNI_TEST_SHOT, Buffer.from(b, 'base64')); }
  ok('the advance line shows the open notes count', /ملاحظة/.test(await ad(`document.querySelector('#adv-2 .aq-line').textContent`)));
  await sleep(800);
  const saved = JSON.parse(await ad(`JSON.stringify(R().advances.map(a=>a.qx&&a.qx.items.length))`));
  ok('the bills are kept with each advance', saved.join() === '2,2,2');
  const e = await app.evaluate(() => (global.__uniErrors || []).slice()); ok('no JavaScript errors', e.length === 0, e.join(' | ').slice(0, 400));
  await app.close();
  R.forEach(x => console.log(x[0], x[1], x[2] ? '— ' + String(x[2]).slice(0, 700) : '')); console.log(`${R.filter(x => x[0] === 'PASS').length}/${R.length}`); process.exit(R.every(x => x[0] === 'PASS') ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
