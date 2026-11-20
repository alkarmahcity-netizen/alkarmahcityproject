/* «📎 كشف كميات السلفة» و«📊 مقارنة كميات السلف» في برنامج تدقيق السلف (يُحقن من البرنامج في صفحة السلف ad):
   • لكل سلفة يُحمَّل كشفها (Excel أو Word): الفقرات وكمياتها (العقد / السابقة / الحالية / التراكمية) وسعر المفرد والمبالغ — يُحفظ مع السلفة (a.qx).
   • التدقيق عرضياً لكل فقرة: الكمية × السعر = المبلغ، والسابقة + الحالية = التراكمية، والتراكمية لا تتجاوز كمية العقد.
   • المجموع: مجموع مبالغ الكشف مقابل المبلغ التراكمي للسلفة وصافيها في البرنامج.
   • بين السلف: الكميات تُجمع تراكمياً من السلف السابقة؛ والكمية السابقة في الكشف = تراكمي السلفة التي قبلها؛
     وإن نزلت الكمية التراكمية لفقرة عن السلفة السابقة (مثل الترابية 100 م3 في السلفة 2 ثم 90 م3 في السلفة 3) تُؤشَّر للجنة:
     «طلب تفسير» أو «مقبول بعد التفسير» أو «مرفوض» مع ملاحظة (r.qxDec).
   للتدقيق والتنبيه فقط — لا يغيّر مبالغ السلف ولا الاستمارة المطبوعة. */
(function () {
  'use strict';
  if (window.__adQty) return; window.__adQty = 1;
  const $ = id => document.getElementById(id);
  const esc = x => String(x == null ? '' : x).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const DIG = s => String(s == null ? '' : s).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
  const N = s => DIG(s).replace(/[ً-ْـ]/g, '').replace(/[آأإ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/\s+/g, ' ').trim();
  const num = v => { if (typeof v === 'number') return isFinite(v) ? v : null; const t = DIG(v).replace(/٫/g, '.').replace(/[٬,\s]/g, ''); if (!/\d/.test(t)) return null; const m = t.match(/-?\d+(\.\d+)?/); return m ? +m[0] : null; };
  const isNum = c => { const t = String(c == null ? '' : c).trim(); return !!t && /^[\s\d٠-٩.,٬٫\-()]+$/.test(t) && /[\d٠-٩]/.test(t); };
  const f3 = n => n == null || n === '' ? '' : (+n).toLocaleString('en-US', { maximumFractionDigits: 3 });
  const f0 = n => n == null || n === '' ? '' : Math.round(+n).toLocaleString('en-US');
  const eq = (a, b, t) => a != null && b != null && Math.abs(a - b) <= Math.max(t == null ? 1 : t, Math.abs(b) * 0.0005);
  const eqQ = (a, b) => a != null && b != null && Math.abs(a - b) <= Math.max(0.001, Math.abs(b) * 0.0001);
  const say = (m, bad) => { try { if (typeof flash === 'function') return flash(m, bad); } catch (_) {} if (bad) alert(m); };
  const ord = i => { try { return advName(R().advances[i], i); } catch (_) { return String(i + 1); } };
  const ano = i => { try { return advNo(R().advances[i], i); } catch (_) { return String(i + 1); } };

  /* ---------- قراءة الكشف ---------- */
  function role(h0) {
    const h = N(h0).replace(/[()=×*+\-\/]/g, ' ').replace(/\s+/g, ' ').trim(); if (!h) return '';
    if (/%|نسبه/.test(h)) return '';
    if (/ملاحظ/.test(h)) return 'note';
    if (/سعر|مفرد/.test(h)) return 'pr';
    if (/مبلغ|المبالغ|الكلفه|كلفه|القيمه/.test(h)) return /سابق/.test(h) ? 'ap' : /حالي|هذه|الشهر|الفتره|الصافي/.test(h) ? 'ac' : 'am';
    if (/^ت$|^ت |تسلسل|^رقم|^م$/.test(h)) return 'no';
    if (/تفاصيل|وصف|البيان|الفقره|الفقرات|نوع العمل|الاعمال|البند/.test(h)) return 'desc';
    if (/وحده/.test(h)) return 'unit';
    if (/كميه|كميات|الكمي|المنجز|المنفذ|منفذ/.test(h)) return /العقد|المتعاقد|الكشف|المقرر|الاصلي|التخميني|الجدول/.test(h) ? 'cq' : /سابق/.test(h) ? 'pq' : /حالي|هذه|الشهر|الفتره/.test(h) ? 'q' : /تراكمي|الكلي|لغايه|لحد|المنجز|المنفذ|الاجمالي/.test(h) ? 'cm' : 'qty';
    return '';
  }
  function parseTables(tables) {
    let best = null;
    for (const T of tables) {
      const rows = (T.rows || []).map(r => Array.from(r || [], c => c == null ? '' : String(c)));
      for (let i = 0; i < Math.min(rows.length, 40); i++) {
        const r0 = rows[i], r1 = rows[i + 1] || [];
        if (r0.filter(c => c.trim()).length < 2 || r0.filter(isNum).length > 1) continue;
        /* عنوان بصف واحد أو بصفين (مجموعة مدموجة مثل «الكميات» فوق «السابقة | الحالية | التراكمية») — يُختار الأوفى */
        const canTwo = r1.some(c => String(c).trim()) && !r1.some(isNum) && !r1.some(c => c.length > 40);
        const build = two => { const W = Math.max(r0.length, two ? r1.length : 0), head = []; let up = '';
          for (let c = 0; c < W; c++) { const a = String(r0[c] || '').trim(), b = two ? String(r1[c] || '').trim() : ''; if (a) up = a; head.push(two ? (b ? ((a || up) + ' ' + b) : a).trim() : a); }
          const col = {}, qtyFree = [];
          head.forEach((h, c) => { const ro = role(h); if (!ro) return; if (ro === 'qty') { qtyFree.push(c); return; } if (!(ro in col)) col[ro] = c; });
          qtyFree.forEach(c => { if (!('cq' in col)) col.cq = c; else if (!('cm' in col)) col.cm = c; else if (!('q' in col)) col.q = c; });
          return col; };
        const c1 = build(false), c2 = canTwo ? build(true) : null, two = !!c2 && Object.keys(c2).length > Object.keys(c1).length, col = two ? c2 : c1;
        if (!('desc' in col) || !['cq', 'pq', 'q', 'cm'].some(k => k in col)) continue;
        const score = Object.keys(col).length; if (best && best.score >= score) continue;
        best = { score, col, data: rows.slice(i + (two ? 2 : 1)) };
      }
    }
    if (!best) return null;
    const { col, data } = best, g = (r, k) => k in col ? r[col[k]] : '', items = [], tot = {};
    for (const r of data) {
      const desc = String(g(r, 'desc') || '').replace(/\s+/g, ' ').trim(), nums = r.filter(isNum).length;
      if (/^(\(?\s*\d+\s*\)?\s*)+$/.test(r.filter(c => String(c).trim()).join(' ')) && nums >= 3 && !desc) continue;   // صف ترقيم الأعمدة
      if (/^(المجموع|مجموع|الاجمالي|الإجمالي|المجموع الكلي|الكلي)/.test(N(desc)) || (!desc && nums && /المجموع|مجموع|الاجمالي/.test(N(r.join(' '))))) {
        ['ap', 'ac', 'am'].forEach(k => { const v = num(g(r, k)); if (v != null) tot[k] = v; }); continue; }
      if (!desc || desc.length < 2 || !nums) continue;
      const it = { no: String(g(r, 'no') || '').trim(), desc, unit: String(g(r, 'unit') || '').trim() };
      ['cq', 'pr', 'pq', 'q', 'cm', 'ap', 'ac', 'am'].forEach(k => { it[k] = num(g(r, k)); });
      if ([it.pq, it.q, it.cm, it.ap, it.ac, it.am].every(v => v == null)) continue;   // عنوان مجموعة
      items.push(it);
    }
    return { items, tot, cols: Object.keys(col) };
  }
  /* Word: الجداول من word/document.xml بلا مكتبات */
  async function docxTables(buf) {
    const u = new Uint8Array(buf), dv = new DataView(buf); let e = -1;
    for (let i = u.length - 22; i >= Math.max(0, u.length - 70000); i--) if (dv.getUint32(i, true) === 0x06054b50) { e = i; break; }
    if (e < 0) throw new Error('ليس ملف Word (.docx) صالحاً'); const n = dv.getUint16(e + 10, true); let p = dv.getUint32(e + 16, true), xml = null;
    for (let k = 0; k < n; k++) { const meth = dv.getUint16(p + 10, true), csz = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true);
      const fn = new TextDecoder().decode(u.subarray(p + 46, p + 46 + nl)); p += 46 + nl + xl + cl; if (fn !== 'word/document.xml') continue;
      const lnl = dv.getUint16(off + 26, true), lxl = dv.getUint16(off + 28, true), data = u.subarray(off + 30 + lnl + lxl, off + 30 + lnl + lxl + csz);
      xml = meth === 0 ? new TextDecoder().decode(data) : await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text(); break; }
    if (!xml) throw new Error('الملف لا يحتوي على مستند Word');
    const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main', doc = new DOMParser().parseFromString(xml, 'application/xml');
    const txt = el => [...el.getElementsByTagNameNS(W, 'p')].map(q => [...q.getElementsByTagNameNS(W, 't')].map(t => t.textContent).join('')).join(' ').replace(/\s+/g, ' ').trim();
    return [...doc.getElementsByTagNameNS(W, 'tbl')].map(tb => ({ rows: [...tb.children].filter(x => x.localName === 'tr').map(tr => { const r = []; [...tr.children].filter(x => x.localName === 'tc').forEach(tc => { const t = txt(tc); let span = 1; const gs = tc.getElementsByTagNameNS(W, 'gridSpan')[0]; if (gs) span = +gs.getAttributeNS(W, 'val') || +gs.getAttribute('w:val') || 1; r.push(t); for (let i = 1; i < span; i++) r.push(''); }); return r; }) }));
  }
  async function readFile(fl) {
    if (/\.xls[xm]$/i.test(fl.name)) { const sh = await AnbarReg.readSheets(fl); return parseTables(sh.map(s => ({ rows: Array.from(s.rows || [], r => Array.from(r || [], c => c == null ? '' : String(c))) }))); }
    if (/\.docx$/i.test(fl.name)) return parseTables(await docxTables(await fl.arrayBuffer()));
    throw new Error('صيغة غير مدعومة — استعمل Excel (xlsx) أو Word (docx)');
  }

  /* ---------- التدقيق ---------- */
  const keyOf = it => N(it.desc).replace(/[^\p{L}\p{N} ]/gu, '').slice(0, 90) + '|' + N(it.unit);
  const decOf = (r, aid, k) => ((r.qxDec || {})[aid + '|' + k]) || null;
  function audit(r) {
    const c = calc(r), A = r.advances, cols = [], keys = new Map(), prevCum = {}, prevAdv = {};
    A.forEach((a, i) => {
      const qx = a.qx; if (!qx || !qx.items) { cols.push({ i, a, none: 1 }); return; }
      const x = c.rows[i] || {}, cell = {}, iss = [], rowsOut = [];
      let sAm = 0, sAc = 0, hasAm = false, hasAc = false;
      qx.items.forEach(it => {
        const k = keyOf(it); if (!keys.has(k)) keys.set(k, { k, desc: it.desc, unit: it.unit, cq: it.cq, pr: it.pr, no: it.no });
        const K = keys.get(k); if (K.cq == null && it.cq != null) K.cq = it.cq; if (K.pr == null && it.pr != null) K.pr = it.pr;
        const before = prevCum[k] != null ? prevCum[k] : null;
        const cum = it.cm != null ? it.cm : (it.q != null ? (before || 0) + it.q : (it.pq != null ? it.pq : null));
        const cur = it.q != null ? it.q : (it.cm != null && before != null ? +(it.cm - before).toFixed(3) : null);
        const f = [];
        if (it.pr > 0) {
          if (it.cm != null && it.am != null && !eq(it.cm * it.pr, it.am)) f.push({ t: 'calc', m: `الكمية التراكمية × السعر = ${f0(it.cm * it.pr)} والمبلغ ${f0(it.am)}` });
          if (it.q != null && it.ac != null && !eq(it.q * it.pr, it.ac)) f.push({ t: 'calc', m: `الكمية الحالية × السعر = ${f0(it.q * it.pr)} والمبلغ ${f0(it.ac)}` });
          if (it.pq != null && it.ap != null && !eq(it.pq * it.pr, it.ap)) f.push({ t: 'calc', m: `الكمية السابقة × السعر = ${f0(it.pq * it.pr)} والمبلغ ${f0(it.ap)}` });
        }
        if (it.pq != null && it.q != null && it.cm != null && !eqQ(it.pq + it.q, it.cm)) f.push({ t: 'calc', m: `السابقة ${f3(it.pq)} + الحالية ${f3(it.q)} = ${f3(it.pq + it.q)} والتراكمية ${f3(it.cm)}` });
        if (before != null && it.pq != null && !eqQ(it.pq, before)) f.push({ t: 'prev', m: `الكمية السابقة في الكشف ${f3(it.pq)} وتراكمي السلفة السابقة ${f3(before)}` });
        if (before != null && cum != null && cum < before - 0.0005) f.push({ t: 'drop', m: `الكمية التراكمية نزلت من ${f3(before)} (السلفة ${esc(ord(prevAdv[k]))}) إلى ${f3(cum)} — النقص ${f3(before - cum)}${it.unit ? ' ' + it.unit : ''}`, need: 1 });
        if (K.cq > 0 && cum != null && cum > K.cq * 1.0005) f.push({ t: 'over', m: `التراكمية ${f3(cum)} تتجاوز كمية العقد ${f3(K.cq)} — تحتاج أمر تغيير`, need: 1 });
        const am = it.am != null ? it.am : (it.pr > 0 && cum != null ? Math.round(cum * it.pr) : null), ac = it.ac != null ? it.ac : (it.pr > 0 && cur != null ? Math.round(cur * it.pr) : null);
        if (am != null) { sAm += am; hasAm = true; } if (ac != null) { sAc += ac; hasAc = true; }
        f.forEach(z => { z.dec = z.need ? decOf(r, a.id, k + '|' + z.t) : null; z.k = k; z.i = i; z.desc = it.desc; iss.push(z); });
        cell[k] = { cum, cur, before, f, it };
        if (cum != null) { prevCum[k] = cum; prevAdv[k] = i; }
      });
      Object.keys(prevCum).forEach(k => { if (!cell[k] && prevAdv[k] < i && prevCum[k] > 0) { const z = { t: 'gone', m: `الفقرة غير موجودة في كشف هذه السلفة وكان تراكميها ${f3(prevCum[k])} في السلفة ${esc(ord(prevAdv[k]))}`, need: 1, k, i, desc: keys.get(k).desc }; z.dec = decOf(r, a.id, k + '|gone'); iss.push(z); cell[k] = { gone: 1, f: [z] }; } });
      const tAm = qx.tot && qx.tot.am != null ? qx.tot.am : (hasAm ? sAm : null), tAc = qx.tot && qx.tot.ac != null ? qx.tot.ac : (hasAc ? sAc : null), tot = [];
      if (qx.tot && qx.tot.am != null && hasAm && !eq(sAm, qx.tot.am)) tot.push({ ok: 0, m: `مجموع مبالغ الفقرات ${f0(sAm)} ومجموع الكشف ${f0(qx.tot.am)}` });
      if (tAm != null && num(a.cumulative)) tot.push(eq(tAm, num(a.cumulative), 1000) ? { ok: 1, m: `المبلغ التراكمي في الكشف ${f0(tAm)} = التراكمي في البرنامج` } : { ok: 0, m: `المبلغ التراكمي في الكشف ${f0(tAm)} والتراكمي في البرنامج ${f0(a.cumulative)} (فرق ${f0(tAm - num(a.cumulative))})` });
      if (tAc != null && x.net) tot.push(eq(tAc, x.net, 1000) ? { ok: 1, m: `مبلغ السلفة الحالية في الكشف ${f0(tAc)} = الصافي في البرنامج` } : { ok: 0, m: `مبلغ السلفة الحالية في الكشف ${f0(tAc)} والصافي في البرنامج ${f0(x.net)} (فرق ${f0(tAc - x.net)})` });
      const open = iss.filter(z => !(z.need && z.dec && (z.dec.st === 'ok' || z.dec.st === 'rej'))).length + tot.filter(t => !t.ok).length;
      cols.push({ i, a, qx, cell, iss, tot, open });
    });
    return { cols, keys: [...keys.values()] };
  }
  const openOf = (r, i) => { try { const A = audit(r).cols[i]; return A && !A.none ? A.open : null; } catch (_) { return null; } };

  /* ---------- الواجهة ---------- */
  function pick(i) {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.xlsx,.xlsm,.docx';
    inp.onchange = async () => { const fl = inp.files && inp.files[0]; if (fl) await load(i, fl); }; inp.click();
  }
  async function load(i, fl) {
    const r = R(); if (!r || !r.advances[i]) return null;
    try {
      const p = await readFile(fl);
      if (!p || !p.items.length) { say(`لم تُقرأ فقرات من «${fl.name}»: تأكد أنه كشف السلفة (أعمدة الفقرة والكميات السابقة/الحالية/التراكمية وسعر المفرد والمبلغ).`, true); return null; }
      if (r.advances[i].qx && !confirm(`للسلفة ${ord(i)} كشف محمَّل (${r.advances[i].qx.file}) — استبداله بـ «${fl.name}»؟`)) return null;
      r.advances[i].qx = { file: fl.name, at: new Date().toISOString(), items: p.items, tot: p.tot, cols: p.cols };
      touch(); ensure(true); const o = openOf(r, i);
      say(`قُرئت ${p.items.length} فقرة من كشف السلفة ${ord(i)}${o ? ` — ${o} ملاحظة للتدقيق` : ' — لا ملاحظات'}`, !!o);
      if (o) show(i); return p;
    } catch (e) { say('تعذرت قراءة الكشف: ' + (e.message || e), true); return null; }
  }
  const DEC = { '': 'بانتظار قرار اللجنة', ask: 'طُلب التفسير', ok: 'مقبول بعد التفسير', rej: 'مرفوض' };
  function show(focus) {
    const r = R(); if (!r) return; const Au = audit(r), C = Au.cols.filter(x => !x.none);
    let ov = $('aqOv'); const sc = ov && ov.querySelector('.aq-box') ? ov.querySelector('.aq-box').scrollTop : 0; if (ov) ov.remove();
    ov = document.createElement('div'); ov.id = 'aqOv'; ov.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(15,23,42,.45);display:flex;align-items:center;justify-content:center;padding:12px;direction:rtl';
    const cellH = (c, k) => { const z = c.cell[k]; if (!z) return '<td></td><td></td>'; if (z.gone) return `<td colspan="2" style="background:#fdecea;color:#b42318">غير موجودة</td>`;
      const bad = z.f.some(f => !(f.need && f.dec && (f.dec.st === 'ok' || f.dec.st === 'rej'))), drop = z.f.some(f => f.t === 'drop');
      return `<td style="${drop ? 'background:#fdecea;color:#b42318;font-weight:700' : bad ? 'background:#fff4e5' : ''}" title="${esc(z.f.map(f => f.m).join(' / '))}">${f3(z.cum)}${drop ? ' ⬇' : ''}</td><td style="color:#475569">${z.cur != null ? f3(z.cur) : ''}</td>`; };
    const allIss = C.flatMap(c => c.iss.map(z => Object.assign({ aid: c.a.id }, z)));
    ov.innerHTML = `<div class="aq-box" style="background:#fff;color:#1e293b;border-radius:12px;padding:16px 18px;width:min(1400px,97vw);max-height:92vh;overflow:auto;font:13.5px Tahoma,Arial,sans-serif">
      <h3 style="margin:0 0 6px;color:#1f3a5f">📊 مقارنة كميات السلف — ${esc(r.project && r.project.name || '')}</h3>
      <p style="margin:0 0 8px;color:#475569">لكل سلفة: <b>التراكمية</b> ثم <b>الحالية</b> (تُجمع من السلف السابقة إن لم تُذكر في الكشف). الأحمر ⬇ = نزول الكمية التراكمية عن السلفة السابقة — يُطلب تفسيره أو يُرفض. للتدقيق فقط ولا يغيّر مبالغ السلف.</p>
      ${C.length ? '' : '<p style="color:#b42318">لم يُحمَّل كشف لأي سلفة بعد — اضغط «📎 تحميل كشف السلفة» في السلفة.</p>'}
      <div style="overflow:auto"><table class="aq-t" style="border-collapse:collapse;width:100%;font-size:12.5px"><thead>
        <tr><th rowspan="2">ت</th><th rowspan="2">الفقرة</th><th rowspan="2">الوحدة</th><th rowspan="2">كمية العقد</th><th rowspan="2">سعر المفرد</th>${C.map(c => `<th colspan="2" style="${c.i === focus ? 'background:#dbeafe' : ''}">السلفة ${esc(ano(c.i))} (${esc(ord(c.i))})<br><small>${esc(c.qx.file)}</small></th>`).join('')}</tr>
        <tr>${C.map(() => '<th>التراكمية</th><th>الحالية</th>').join('')}</tr></thead><tbody>
        ${Au.keys.map((K, n) => `<tr><td>${esc(K.no || n + 1)}</td><td style="text-align:right;min-width:18em">${esc(K.desc)}</td><td>${esc(K.unit)}</td><td>${f3(K.cq)}</td><td>${f0(K.pr)}</td>${C.map(c => cellH(c, K.k)).join('')}</tr>`).join('')}
      </tbody></table></div>
      <h4 style="margin:12px 0 4px">المجاميع والمبالغ</h4>
      ${C.map(c => `<div><b>السلفة ${esc(ord(c.i))}:</b> ${c.tot.length ? c.tot.map(t => `${t.ok ? '<span style="color:#15803d">✓</span>' : '<span style="color:#b42318">⚠</span>'} ${t.m}`).join(' &nbsp;—&nbsp; ') : '<span style="color:#64748b">لا مبالغ في الكشف للمقارنة</span>'}</div>`).join('')}
      <h4 style="margin:12px 0 4px">الملاحظات (${allIss.length})</h4>
      ${allIss.length ? `<table class="aq-t" style="border-collapse:collapse;width:100%;font-size:12.5px"><thead><tr><th>السلفة</th><th>الفقرة</th><th>الملاحظة</th><th>قرار اللجنة</th><th>ملاحظة اللجنة</th></tr></thead><tbody>
        ${allIss.map(z => { const k = z.aid + '|' + z.k + '|' + z.t, d = z.dec || {}; return `<tr style="${z.t === 'drop' ? 'background:#fdecea' : ''}"><td>${esc(ord(z.i))}</td><td style="text-align:right">${esc(z.desc)}</td><td style="text-align:right">${z.m}</td>
          <td>${z.need ? `<select data-aqd="${esc(k)}" data-f="st">${Object.entries(DEC).map(([v, l]) => `<option value="${v}" ${(d.st || '') === v ? 'selected' : ''}>${l}</option>`).join('')}</select>` : '<span style="color:#64748b">تصحيح الكشف</span>'}</td>
          <td>${z.need ? `<input data-aqd="${esc(k)}" data-f="note" value="${esc(d.note || '')}" placeholder="التفسير أو سبب الرفض" style="width:16em">` : ''}</td></tr>`; }).join('')}</tbody></table>` : '<p style="color:#15803d">✓ لا ملاحظات</p>'}
      <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">${r.advances.map((a, i) => `<button type="button" class="btn sm" data-aqpick="${i}">📎 ${a.qx ? 'استبدال' : 'تحميل'} كشف السلفة ${esc(ano(i))}</button>`).join('')}<span style="flex:1"></span><button type="button" class="btn sm" data-aqx="1">إغلاق</button></div></div>`;
    document.body.appendChild(ov); const bx = ov.querySelector('.aq-box'); if (bx) bx.scrollTop = sc;
    ov.querySelectorAll('.aq-t th,.aq-t td').forEach(e => { e.style.border = '1px solid #cbd5e1'; e.style.padding = '3px 6px'; e.style.textAlign = e.style.textAlign || 'center'; });
    ov.querySelectorAll('.aq-t th').forEach(e => { e.style.background = e.style.background || '#f1f5f9'; });
  }
  document.addEventListener('change', e => { const t = e.target; if (!t.dataset || t.dataset.aqd == null) return; const r = R(); if (!r) return; r.qxDec = r.qxDec || {};
    const d = r.qxDec[t.dataset.aqd] = Object.assign({}, r.qxDec[t.dataset.aqd] || {}, { [t.dataset.f]: t.value, at: new Date().toISOString() }); if (!d.st && !d.note) delete r.qxDec[t.dataset.aqd];
    touch(); if (t.dataset.f === 'st') show(); ensure(true); });
  document.addEventListener('click', e => {
    const p = e.target.closest('[data-aqpick]'); if (p) { e.preventDefault(); pick(+p.dataset.aqpick); return; }
    const s = e.target.closest('[data-aqshow]'); if (s) { e.preventDefault(); show(+s.dataset.aqshow); return; }
    if (e.target.closest('[data-aqx]') || e.target.id === 'aqOv') { const o = $('aqOv'); if (o) o.remove(); }
  });
  /* سطر «كشف كميات السلفة» تحت رأس كل سلفة في النموذج */
  let lastSig = '';
  function ensure(force) {
    try {
      if (typeof view === 'undefined' || view !== 'edit' || typeof R !== 'function' || !R()) return; const r = R();
      const sig = r.id + '|' + r.advances.map(a => a.id + ':' + (a.qx ? a.qx.at : '')).join(',') + '|' + JSON.stringify(r.qxDec || {}).length + '|' + r.advances.map(a => a.cumulative).join(',');
      r.advances.forEach((a, i) => {
        const box = $('adv-' + i); if (!box) return; let el = box.querySelector('.aq-line');
        if (el && !force && sig === lastSig) return;
        if (!el) { el = document.createElement('div'); el.className = 'aq-line'; el.style.cssText = 'margin:6px 0 2px;padding:5px 8px;border:1px dashed #94a3b8;border-radius:8px;font-size:12.5px;display:flex;gap:8px;align-items:center;flex-wrap:wrap'; const h = box.querySelector('.adv-h'); if (h) h.insertAdjacentElement('afterend', el); else box.prepend(el); }
        const o = a.qx ? openOf(r, i) : null;
        el.innerHTML = `<b>📎 كشف كميات السلفة ${esc(ano(i))}:</b> ${a.qx ? `<span>${esc(a.qx.file)} — ${a.qx.items.length} فقرة</span> ${o ? `<b style="color:#b42318">⚠ ${o} ملاحظة</b>` : '<b style="color:#15803d">✓ لا ملاحظات</b>'}` : '<span style="color:#64748b">لم يُحمَّل</span>'}
          <button type="button" class="btn sm" data-aqpick="${i}">${a.qx ? 'استبدال الكشف' : 'تحميل كشف السلفة (Excel أو Word)'}</button>${r.advances.some(x => x.qx) ? `<button type="button" class="btn sm" data-aqshow="${i}">📊 مقارنة كميات السلف</button>` : ''}`;
      });
      lastSig = sig;
    } catch (_) {}
  }
  let pend = false; new MutationObserver(() => { if (!pend) { pend = true; requestAnimationFrame(() => { pend = false; ensure(); }); } }).observe(document.body, { childList: true, subtree: true });
  ensure();
  window.AdQty = { load, show, audit: () => audit(R()), parse: parseTables, ensure };
})();
