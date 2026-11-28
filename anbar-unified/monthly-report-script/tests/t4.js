const { chromium } = require('playwright'); const fs = require('fs');
(async () => { const b = await chromium.launch(); const p = await b.newPage(); p.on('dialog', d => d.accept());
  await p.route(/cdnjs|fonts\./, r => r.fulfill({ body: '', contentType: 'application/javascript' }));
  await p.goto('file://' + __dirname + '/index.html'); await p.waitForTimeout(500);
  const v = await p.evaluate(() => !document.getElementById('notLink').hidden); await p.click('#bSend'); const m = await p.textContent('#msg');
  console.log(v && /افتح الرابط/.test(m) ? 'PASS opened as a file → red banner + send blocked with explanation' : 'FAIL ' + v + ' ' + m); await b.close(); })();
