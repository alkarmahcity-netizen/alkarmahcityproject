// النصوص العربية في PDF التقرير تبقى موصولة حتى لو فرض المتصفح تباعداً بين الحروف
const { chromium, devices } = require('playwright'); const fs = require('fs');
const B = __dirname, L = process.env.LIBS; const R = []; const ok = (n, c, d = '') => R.push([c ? 'PASS' : 'FAIL', n, d]);
(async () => { const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['Galaxy S9+'] }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.route(/cdnjs\.cloudflare\.com.*html2canvas/, r => r.fulfill({ body: fs.readFileSync(L + '/html2canvas-1.4.1/package/dist/html2canvas.min.js'), contentType: 'application/javascript' }));
  await p.route(/cdnjs\.cloudflare\.com.*jspdf/, r => r.fulfill({ body: fs.readFileSync(L + '/jspdf-2.5.1/package/dist/jspdf.umd.min.js'), contentType: 'application/javascript' }));
  await p.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ body: '', contentType: 'text/css' }));
  await p.addInitScript(() => { const st = document.createElement('style'); st.textContent = '#rep .tx .txr{letter-spacing:.5px!important}'; document.addEventListener('DOMContentLoaded', () => document.head.append(st)); });
  await p.goto('file://' + B + '/index.html'); await p.waitForTimeout(800);
  const T = 'أعمال التسويه واعمال مد خطوط الماء واعمال مد خطوط المجاري وأعمال الحفر‏ والردم بالتراب وأعمال الفرش بالحصى الخابط والرص والانجاز وفق المواصفات الفنية المعتمدة';
  await p.fill('[name="project"]', 'اكمال الممرات الخدمية مع الجزرات لمدخل قضاء هيت بداء من مدخل سيطرة المعلمين باتجاه مدخل سيطرة المعهد المقطع الغربي'); await p.fill('[name="office"]', 'م. أحمد خليل، م. عمر فاضل (مشرفون)'); await p.fill('[name="reportDate"]', '2026-11-28'); await p.fill('[name="done"]', T + '\nسطر ثان: أعمال الصب'); await p.fill('[name="next"]', 'أعمال المنهوليات وأعمال الارصفه');
  const r = await p.evaluate(async () => { const x = await window.__MR_FORM.makePdf(); const imgs = [...document.querySelectorAll('#rep .txr img')]; return { imgs: imgs.length, h: imgs.map(i => i.style.height), done: !!x.doc, pdf: x.doc.output('datauristring') }; });
  fs.writeFileSync(B + '/t10.pdf', Buffer.from(r.pdf.split(',')[1], 'base64')); delete r.pdf; ok('free-text boxes are drawn natively (images in the PDF)', r.imgs >= 2 && r.done, JSON.stringify(r));
  await p.evaluate(() => { const r = document.getElementById('rep'); r.style.left = '0'; r.style.position = 'absolute'; r.style.zIndex = 99; });
  const el = await p.$('#rep'); await el.screenshot({ path: B + '/t10.png' });
  ok('no page errors', errs.length === 0, errs.join('|'));
  await b.close(); R.forEach(x => console.log(x[0], x[1], x[2] ? '— ' + x[2] : '')); process.exit(R.every(x => x[0] === 'PASS') ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
