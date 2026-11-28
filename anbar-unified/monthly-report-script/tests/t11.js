// حفظ التقرير في هاتف المقيم للشهر القادم: كل الحقول وصورة الختم تعود بعد إغلاق الصفحة وفتحها؛ التوقيع والصور والشهر لا تُحفظ؛ «مسح المحفوظ» يفرّغ
const { chromium, devices } = require('playwright'); const fs = require('fs');
const B = __dirname, L = process.env.LIBS; const R = []; const ok = (n, c, d = '') => R.push([c ? 'PASS' : 'FAIL', n, d]);
(async () => { const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['iPhone 13'] }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e))); p.on('dialog', d => d.accept());
  for (const pg of [p]) { await pg.route(/cdnjs\.cloudflare\.com.*html2canvas/, r => r.fulfill({ body: fs.readFileSync(L + '/html2canvas-1.4.1/package/dist/html2canvas.min.js'), contentType: 'application/javascript' }));
    await pg.route(/cdnjs\.cloudflare\.com.*jspdf/, r => r.fulfill({ body: fs.readFileSync(L + '/jspdf-2.5.1/package/dist/jspdf.umd.min.js'), contentType: 'application/javascript' }));
    await pg.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ body: '', contentType: 'text/css' })); }
  await p.goto('file://' + B + '/index.html'); await p.waitForTimeout(600);
  ok('first time: no «saved report» note', await p.evaluate(() => document.getElementById('savedNote').hidden));
  const fill = { project: 'مشروع الحفظ في الهاتف', company: 'شركة الحفظ', contractNo: '12 لسنة 2025', cost: '900000000', coCount: '1', coAmount: '50000000', plannedPct: '40', actualPct: '35', workers: '22', machines: '4',
    done: 'أعمال الحفر والردم', next: 'أعمال الصب', issues: 'لا يوجد', tests: 'فحص الخرسانة ناجح', safeNotes: 'ملاحظة سلامة', recs: 'توصية الشهر' };
  for (const [k, v] of Object.entries(fill)) await p.fill(`[name="${k}"]`, v);
  await p.selectOption('[name="district"]', 'الرمادي'); await p.click('text=مستمر'); await p.click('text=ملتزمة جزئياً');
  await p.setInputFiles('#stIn', B + '/stamp.jpg'); await p.waitForTimeout(1500);
  await p.reload(); await p.waitForTimeout(800);   // كأن المقيم يفتح الرابط الشهر القادم
  const back = await p.evaluate(() => { const F = document.getElementById('f'), v = k => { const e = F.elements[k]; return e ? e.value : ''; }; return { vals: Object.fromEntries(['project', 'company', 'contractNo', 'cost', 'coCount', 'coAmount', 'plannedPct', 'actualPct', 'workers', 'machines', 'done', 'next', 'issues', 'tests', 'safeNotes', 'recs', 'district', 'status', 'safeStatus'].map(k => [k, v(k)])), stamp: (document.getElementById('stImg') || {}).src || '', note: document.getElementById('savedNote').textContent, month: v('month') }; });
  const miss = Object.entries(fill).filter(([k, x]) => back.vals[k] !== x).map(([k]) => k);
  ok('after closing and reopening: every field is back (project, %, works, issues, tests, safety, recommendations, change orders)', !miss.length && back.vals.district === 'الرمادي' && back.vals.status === 'مستمر' && back.vals.safeStatus === 'ملتزمة جزئياً', miss.join(',') + ' ' + JSON.stringify([back.vals.district, back.vals.status, back.vals.safeStatus]));
  ok('the stamp photo is kept too', /^data:image\//.test(back.stamp));
  ok('a note tells the resident the previous report was loaded and to change only what changed', /حُمّلت بيانات تقريرك السابق/.test(back.note) && /النسب والمبالغ/.test(back.note), back.note.slice(0, 160));
  ok('report month is set to the current month (not copied)', /^\d{4}-\d{2}$/.test(back.month) && back.month === new Date().toISOString().slice(0, 7), back.month);
  ok('signature is not kept (must sign each month)', await p.evaluate(() => !window.__MR_FORM.check().every(x => x !== 'التوقيع')));
  await p.click('#clrSaved'); await p.waitForTimeout(800);
  const cl = await p.evaluate(() => ({ pr: document.querySelector('[name="project"]').value, note: document.getElementById('savedNote').hidden, st: (document.getElementById('stImg') || {}).style.display }));
  ok('«مسح المحفوظ والبدء من جديد» empties the form and the stamp', cl.pr === '' && cl.note && cl.st === 'none', JSON.stringify(cl));
  ok('no page errors', errs.length === 0, errs.join('|'));
  await b.close(); R.forEach(x => console.log(x[0], x[1], x[2] ? '— ' + x[2] : '')); process.exit(R.every(x => x[0] === 'PASS') ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
