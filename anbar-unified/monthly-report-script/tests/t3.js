const { chromium, webkit, devices } = require('playwright'); const fs = require('fs'), http = require('http');
const B = __dirname, L = process.env.LIBS;
(async () => {
  const lib = { '/h2c.js': fs.readFileSync(L + '/html2canvas-1.4.1/package/dist/html2canvas.min.js'), '/jspdf.js': fs.readFileSync(L + '/jspdf-2.5.1/package/dist/jspdf.umd.min.js') };
  const form = fs.readFileSync(B + '/index.html', 'utf8').replace(/https:\/\/cdnjs[^"]*html2canvas[^"]*/, '/h2c.js').replace(/https:\/\/cdnjs[^"]*jspdf[^"]*/, '/jspdf.js').replace(/<link[^>]*fonts.googleapis[^>]*>/g, '');
  const srv = http.createServer((q, s) => { if (lib[q.url]) { s.writeHead(200, { 'Content-Type': 'application/javascript' }); return s.end(lib[q.url]); }
    if (q.url.startsWith('/form')) { s.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return s.end(form); }
    const sb = q.url.includes('nosame') ? 'allow-scripts allow-forms allow-modals allow-popups' : 'allow-scripts allow-forms allow-modals allow-popups allow-same-origin';
    s.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); s.end(`<!doctype html><iframe id=f sandbox="${sb}" src="/form" style="width:390px;height:800px"></iframe>`); });
  await new Promise(r => srv.listen(48771, r));
  for (const [bn, br, dev] of [['chromium', chromium, devices['Pixel 7']], ['webkit', webkit, devices['iPhone 13']]]) for (const mode of ['same', 'nosame']) {
    let b; try { b = await br.launch(); } catch (e) { console.log(bn, 'n/a'); break; }
    const p = await (await b.newContext({ ...dev })).newPage(); await p.goto('http://127.0.0.1:48771/' + mode); await p.waitForTimeout(1200);
    const fr = p.frames().find(f => f.url().includes('/form'));
    for (const img of ['big.jpg', 'noisy.jpg']) { await fr.setInputFiles('#stIn', B + '/' + img);
      try { await fr.waitForFunction(() => /كيلوبايت|تعذّر/.test(document.getElementById('msg').textContent), null, { timeout: 60000 }); } catch (_) {}
      console.log(bn, mode, img, '→', (await fr.textContent('#msg')).slice(0, 160)); }
    await b.close(); }
  srv.close();
})().catch(e => { console.error(e); process.exit(1); });
