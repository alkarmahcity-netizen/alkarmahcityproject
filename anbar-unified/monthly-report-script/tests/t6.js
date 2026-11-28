// صور الموقع: كل صورة ≤ 300 كيلوبايت بعد الضغط داخل النموذج
const { chromium, devices } = require('playwright'); const fs = require('fs');
const B = __dirname, L = process.env.LIBS; const R = []; const ok = (n, c, d = '') => R.push([c ? 'PASS' : 'FAIL', n, d]);
(async () => { const b = await chromium.launch(); const p = await (await b.newContext({ ...devices['Galaxy S9+'] })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.route(/cdnjs\.cloudflare\.com.*html2canvas/, r => r.fulfill({ body: fs.readFileSync(L + '/html2canvas-1.4.1/package/dist/html2canvas.min.js'), contentType: 'application/javascript' }));
  await p.route(/cdnjs\.cloudflare\.com.*jspdf/, r => r.fulfill({ body: fs.readFileSync(L + '/jspdf-2.5.1/package/dist/jspdf.umd.min.js'), contentType: 'application/javascript' }));
  await p.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ body: '', contentType: 'text/css' }));
  await p.goto('file://' + B + '/index.html'); await p.waitForTimeout(800);
  await p.setInputFiles('#phIn', [B + '/big.jpg', B + '/noisy.jpg', B + '/stamp.jpg']); await p.waitForTimeout(5000);
  const r = await p.evaluate(() => ({ kb: [...document.querySelectorAll('#photos img')].map(i => { const d = i.src, k = d.indexOf(','); return Math.round((d.length - k - 1) * 3 / 4 / 1024); }), msg: document.getElementById('msg').textContent }));
  console.log('sizes in:', ['big.jpg', 'noisy.jpg', 'stamp.jpg'].map(f => Math.round(fs.statSync(B + '/' + f).size / 1024) + 'KB').join(' '));
  ok('3 photos added, each ≤ 300 KB', r.kb.length === 3 && r.kb.every(k => k <= 300), JSON.stringify(r));
  ok('no page errors', errs.length === 0, errs.join('|'));
  await b.close(); R.forEach(x => console.log(x[0], x[1], x[2] ? '— ' + x[2] : '')); process.exit(R.every(x => x[0] === 'PASS') ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
