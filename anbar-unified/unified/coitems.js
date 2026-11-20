/* «📥 فقرات أمر التغيير» في مطالعات لجنة أوامر التغيير (يُحقن من البرنامج في صفحة المطالعات cm):
   يُستدعى المشروع من بيانات أوامر التغيير باسمه أو باسم الشركة أو رقم الاضبارة، ثم يُختار الأمر فتُدرج فقراته (الكميات والأسعار والمبالغ
   كما اعتمدتها اللجنة، والمحذوفة من اللجنة بملاحظتها) جدولاً في المطالعة، مع سطور الحذف والإضافة والاستحداث في المتن اختيارياً.
   الجدول يحمل مصدره؛ فإن عدّلت اللجنة الفقرات في أوامر التغيير يظهر «↻ تحديث فقرات أمر التغيير» ويُحدَّث الجدول نفسه.
   للقراءة من أوامر التغيير فقط — لا يكتب في بياناتها. */
(function () {
  'use strict';
  if (window.__coItems || !window.desktop || !window.desktop.peek) return; window.__coItems = 1;
  const D = window.desktop, $ = id => document.getElementById(id);
  const esc = x => String(x == null ? '' : x).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const N = s => String(s == null ? '' : s).replace(/[ً-ْـ]/g, '').replace(/[آأإ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/\s+/g, ' ').trim().toLowerCase();
  const num = v => { if (typeof v === 'number') return v; const t = String(v == null ? '' : v).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[,٬\s]/g, ''); const m = t.match(/-?\d+(\.\d+)?/); return m ? +m[0] : null; };
  const fmt = n => n == null || n === '' ? '' : (+n).toLocaleString('en-US', { maximumFractionDigits: 3 });
  const T = { del: 'حذف', add: 'إضافة', new: 'استحداث' };
  let C = null;
  const coData = () => { try { if (!C || Date.now() - C.t > 1500) { const t = D.peek('co'); C = { t: Date.now(), L: (t && JSON.parse(t).records) || [] }; } } catch (_) { C = { t: Date.now(), L: [] }; } return C.L; };
  const oname = (o, n) => (o && o.isFix && o.isFix !== '0' && o.isFix !== 'false' ? 'تصحيح ' : '') + 'أمر التغيير رقم ' + n;
  /* القيم كما اعتمدتها اللجنة (نفس قواعد أوامر التغيير) */
  const q = x => x.st === 'cut' ? 0 : (num(x.q) || 0);
  const amt = x => { if (x.st === 'cut') return 0; if (x.st !== 'fix' && x.amt0 != null) return +x.amt0; const pr = x.pr != null && x.pr !== '' ? +x.pr : null; if (pr > 0) return Math.round(q(x) * pr); const q0 = num(x.q0); if (x.amt0 != null && q0 > 0) return Math.round(+x.amt0 * q(x) / q0); return x.amt0 != null ? +x.amt0 : 0; };
  const sig = items => { let h = 0; const s = JSON.stringify((items || []).map(x => [x.type, x.desc, x.q, x.pr, x.st, x.cnote, x.amt0])); for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return String(h); };
  const ordered = items => ['del', 'add', 'new'].flatMap(t => (items || []).filter(x => x.type === t));
  function table(rec, oi) {
    const o = rec.orders[oi], items = ordered(o.items), rows = [], tot = { del: 0, add: 0, new: 0 };
    items.forEach((x, i) => { const a = amt(x); tot[x.type] += a;
      rows.push([String(i + 1), String(x.desc || x.sum || ''), String(x.unit || ''), x.type === 'new' ? '—' : fmt(num(x.orig)), x.st === 'cut' ? 'محذوفة من اللجنة' : T[x.type], x.st === 'cut' ? '—' : fmt(q(x)), x.pr != null && x.st !== 'cut' ? fmt(x.pr) : '', x.st === 'cut' ? '—' : fmt(a),
        [x.st === 'fix' ? `صُحّحت من اللجنة${num(x.q0) !== num(x.q) ? ` (الكمية في الكشف ${fmt(num(x.q0))})` : ''}${x.pr0 != null && x.pr0 !== x.pr ? ` (السعر في الكشف ${fmt(x.pr0)})` : ''}` : '', x.cnote || ''].filter(Boolean).join(' — ')]); });
    const sumRow = (l, v) => ['', l, '', '', '', '', '', fmt(v), ''];
    if (tot.del) rows.push(sumRow('مجموع الأعمال المحذوفة', tot.del)); if (tot.add) rows.push(sumRow('مجموع الأعمال المضافة', tot.add)); if (tot.new) rows.push(sumRow('مجموع الأعمال المستحدثة', tot.new));
    rows.push(sumRow('صافي أمر التغيير', tot.add + tot.new - tot.del));
    return { cols: ['ت', 'الفقرة', 'الوحدة', 'الكمية الأصلية', 'التغيير', 'الكمية', 'سعر المفرد (دينار)', 'المبلغ (دينار)', 'ملاحظة اللجنة'], rows, serial: false, shade: 'D9D9D9', fit: 'full', src: rec.id + ':' + oi, sig: sig(o.items), tot };
  }
  const line = x => { const u = x.unit ? ' ' + x.unit : '', s = String(x.sum || x.desc || '').trim(), qq = fmt(q(x)), og = fmt(num(x.orig));
    if (x.type === 'del') return `${s} ${x.full || !qq ? 'حذف كلي' : `حذف ${qq}${u}${og ? ` من أصل ${og}${u}` : ''}`}`; if (x.type === 'add') return `${s} إضافة ${qq}${u}${og ? ` من أصل ${og}${u}` : ''}`; return `${s} استحداث ${qq}${u}`; };
  function textLines(o) { const L = []; [['del', 'الحذف'], ['add', 'الإضافة'], ['new', 'الاستحداثات']].forEach(([t, l]) => { const X = (o.items || []).filter(x => x.type === t && x.st !== 'cut'); if (X.length) L.push(`{#C00000*:${l}:} ${X.map(line).join(' – ')}.`); });
    const cut = (o.items || []).filter(x => x.st === 'cut'); if (cut.length) L.push(`{#C00000*:فقرات حذفتها اللجنة:} ${cut.map(x => `${x.sum || x.desc}${x.cnote ? ' (' + x.cnote + ')' : ''}`).join(' – ')}.`); return L; }
  const memo = () => (typeof view !== 'undefined' && view === 'edit' && typeof R === 'function') ? R() : null;
  const srcOf = r => (r && r.tables || []).map((t, i) => ({ t, i })).filter(z => z.t && z.t.src);
  function find(src) { const [rid, oi] = String(src).split(':'); const rec = coData().find(x => x && x.id === rid); const o = rec && rec.orders && rec.orders[+oi]; return o ? { rec, oi: +oi, o } : null; }
  function stale(r) { return srcOf(r).filter(z => { const f = find(z.t.src); return f && sig(f.o.items) !== z.t.sig; }); }
  /* إدراج أو تحديث */
  function insert(rec, oi, withText) {
    const r = memo(); if (!r) return; r.tables = r.tables || []; const tb = table(rec, oi), o = rec.orders[oi];
    const ex = r.tables.findIndex(t => t && t.src === tb.src);
    if (ex >= 0) { r.tables[ex] = Object.assign({}, r.tables[ex], { cols: tb.cols, rows: tb.rows, sig: tb.sig }); }
    else {
      const idx = r.tables.length; r.tables.push({ id: typeof uid === 'function' ? uid() : 't' + Date.now(), cols: tb.cols, rows: tb.rows, serial: false, shade: tb.shade, fit: 'full', src: tb.src, sig: tb.sig });
      const P = rec.project || {}, head = `فقرات ${oname(o, oi + 1)} — مشروع (${P.name || ''})${P.contractor ? ' — ' + P.contractor : ''}:`;
      const add = [head].concat(withText ? textLines(o) : [], [`[[جدول ${idx + 1}]]`]).join('\n');
      r.body = String(r.body || '').replace(/\s*$/, '') + (r.body ? '\n' : '') + add + '\n';
      if (!String(r.fileNo || '').trim() && P.fileNo) r.fileNo = String(P.fileNo);
      if (!r.ltEv) r.ltEv = 'order:' + oi;
    }
    if (typeof touch === 'function') touch(); try { renderForm(); } catch (_) {} try { renderTables(); } catch (_) {} try { renderPreview(true); } catch (_) {}
    try { (window.flash || alert)(ex >= 0 ? '✔ حُدّث جدول الفقرات من أوامر التغيير' : `✔ أُدرجت ${(o.items || []).length} فقرة من ${oname(o, oi + 1)}`); } catch (_) {}
    ensure(true);
  }
  function update() { const r = memo(); if (!r) return; stale(r).forEach(z => { const f = find(z.t.src); if (f) insert(f.rec, f.oi, false); }); }
  /* نافذة الاستدعاء: البحث باسم المشروع أو الشركة أو رقم الاضبارة */
  function dlg() {
    C = null; const L = coData(), r = memo(); let ov = $('ciOv'); if (ov) ov.remove(); ov = document.createElement('div'); ov.id = 'ciOv';
    ov.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(15,23,42,.45);display:flex;align-items:center;justify-content:center;font:14px Tahoma,Arial,sans-serif;direction:rtl';
    ov.innerHTML = `<div style="background:#fff;color:#1e293b;border-radius:12px;padding:16px 18px;width:min(760px,95vw);max-height:88vh;display:flex;flex-direction:column;gap:8px">
      <h3 style="margin:0;color:#1f3a5f">📥 فقرات أمر التغيير — من نظام أوامر التغيير</h3>
      <input id="ciQ" type="search" placeholder="ابحث باسم المشروع أو اسم الشركة أو رقم الاضبارة…" style="font:inherit;padding:7px 10px;border:1px solid #cbd5e1;border-radius:8px" value="${esc(r && r.fileNo || '')}">
      <label style="font-size:13px"><input id="ciTxt" type="checkbox" checked> وأضف سطور الحذف والإضافة والاستحداث في المتن (كما في مطالعة الموافقة الأصولية)</label>
      <div id="ciL" style="overflow:auto;flex:1;border:1px solid #e2e8f0;border-radius:8px"></div>
      <div style="display:flex;justify-content:space-between;align-items:center"><small style="color:#64748b">تُدرج الكميات والأسعار كما اعتمدتها اللجنة في «📋 فقرات الأمر» بنظام أوامر التغيير.</small><button id="ciX" type="button">إغلاق</button></div></div>`;
    document.body.appendChild(ov);
    const draw = () => { const qv = N($('ciQ').value), hit = L.filter(x => x && x.project && (!qv || [x.project.name, x.project.contractor, x.project.fileNo, x.project.contractNo].some(v => N(v).includes(qv))));
      $('ciL').innerHTML = hit.slice(0, 60).map(x => { const P = x.project; return `<div style="padding:8px 10px;border-bottom:1px solid #eef2f7"><b>${esc(P.name || 'مشروع بلا اسم')}</b> <small style="color:#64748b">${esc(P.contractor || '')}${P.fileNo ? ' — اضبارة ' + esc(P.fileNo) : ''}</small>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:5px">${(x.orders || []).map((o, i) => { const n = (o.items || []).length; return `<button type="button" data-ci="${esc(x.id)}" data-oi="${i}" ${n ? '' : 'disabled title="لا فقرات محفوظة لهذا الأمر — افتح «🔍 مراجعة ملف أمر التغيير» في نظام أوامر التغيير واختر ملفه"'} style="padding:4px 10px;border-radius:8px;border:1px solid ${n ? '#2563a8' : '#cbd5e1'};background:${n ? '#eff6ff' : '#f8fafc'};color:${n ? '#1e3a8a' : '#94a3b8'};cursor:${n ? 'pointer' : 'default'}">${esc(oname(o, i + 1))} — ${n ? n + ' فقرة' : 'بلا فقرات'}</button>`; }).join('')}</div></div>`; }).join('') || '<div style="padding:14px;color:#64748b">لا مشاريع مطابقة في نظام أوامر التغيير.</div>'; };
    draw(); $('ciQ').addEventListener('input', draw); $('ciQ').focus();
    ov.addEventListener('click', e => { if (e.target === ov || e.target.id === 'ciX') { ov.remove(); return; } const b = e.target.closest('[data-ci]'); if (!b || b.disabled) return;
      const rec = L.find(x => x.id === b.dataset.ci); if (!rec) return; const wt = $('ciTxt').checked; ov.remove(); insert(rec, +b.dataset.oi, wt); });
  }
  /* الزر في شريط المحرر، وتنبيه التحديث إن تغيّرت الفقرات في أوامر التغيير */
  let lastChk = 0, st = [];
  function ensure(force) {
    try {
      const r = memo(), a = r ? document.querySelector('[data-act=savetpl]') : null; let b = $('btnCoItems');
      if (!a) { if (b) b.remove(); const u = $('btnCoUpd'); if (u) u.remove(); return; }
      if (!b || !b.isConnected) { b = document.createElement('button'); b.id = 'btnCoItems'; b.type = 'button'; b.className = a.className || 'btn sm'; b.textContent = '📥 فقرات أمر التغيير';
        b.title = 'استدعاء فقرات أمر التغيير (الكميات والأسعار والمبالغ) من نظام أوامر التغيير باسم المشروع أو الشركة'; b.addEventListener('click', e => { e.preventDefault(); dlg(); }); a.insertAdjacentElement('beforebegin', b); }
      if (force || Date.now() - lastChk > 2000) { lastChk = Date.now(); C = force ? null : C; st = stale(r); }
      let u = $('btnCoUpd');
      if (st.length) { if (!u || !u.isConnected) { u = document.createElement('button'); u.id = 'btnCoUpd'; u.type = 'button'; u.className = b.className; u.style.cssText = 'background:#fff4e5;color:#8a4b00;border-color:#f5c26b';
          u.textContent = '↻ تحديث فقرات أمر التغيير'; u.title = 'عدّلت اللجنة فقرات الأمر في نظام أوامر التغيير بعد إدراجها هنا — اضغط لتحديث الجدول'; u.addEventListener('click', e => { e.preventDefault(); update(); }); b.insertAdjacentElement('afterend', u); } }
      else if (u) u.remove();
    } catch (_) {}
  }
  let pend = false; new MutationObserver(() => { if (!pend) { pend = true; requestAnimationFrame(() => { pend = false; ensure(); }); } }).observe(document.body, { childList: true, subtree: true });
  window.addEventListener('focus', () => { C = null; ensure(true); });
  ensure();
  window.CoItems = { dlg, insert: (rid, oi, wt) => { C = null; const rec = coData().find(x => x.id === rid); if (rec) insert(rec, oi, wt); }, update, stale: () => stale(memo()).length, table };
})();
