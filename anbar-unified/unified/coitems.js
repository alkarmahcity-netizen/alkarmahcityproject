/* «📥 فقرات أمر التغيير» في مطالعات لجنة أوامر التغيير (يُحقن من البرنامج في صفحة المطالعات cm):
   يُستدعى المشروع من بيانات أوامر التغيير باسمه أو باسم الشركة أو رقم الاضبارة، ثم يُختار الأمر فتُدرج فقراته جدولاً وحده في المطالعة:
   الفقرة والكميات الأصلية والمحذوفة والمضافة (ضمن 20% وأكثر) والمستحدثة كما اعتمدتها اللجنة — بلا أسعار ولا كتابة في المتن.
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
  const sig = items => { let h = 0; const s = JSON.stringify((items || []).map(x => [x.type, x.desc, x.unit, x.orig, x.q, x.st])); for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return String(h); };
  const ordered = items => ['del', 'add', 'new'].flatMap(t => (items || []).filter(x => x.type === t));
  /* الكمية المضافة: ضمن 20% من الأصلية وما زاد عليها (كما في أوامر التغيير) */
  const split = x => { const qq = q(x), og = num(x.orig); if (x.type !== 'add' || !(og > 0)) return { w: qq, a: 0 }; const lim = +(og * 0.2).toFixed(3), w = Math.min(qq, lim); return { w, a: +Math.max(0, qq - lim).toFixed(3) }; };
  /* جدول الفقرات في المطالعة: الفقرة والكميات فقط (بلا أسعار ولا مبالغ)؛ الفقرات التي حذفتها اللجنة لا تُدرج */
  function table(rec, oi) {
    const o = rec.orders[oi], items = ordered(o.items).filter(x => x.st !== 'cut' && q(x) > 0), rows = [];
    items.forEach((x, i) => { const sp = split(x);
      rows.push([String(i + 1), String(x.desc || x.sum || ''), String(x.unit || ''), x.type === 'new' ? '—' : fmt(num(x.orig)),
        x.type === 'del' ? fmt(q(x)) : '', x.type === 'add' ? fmt(sp.w) : '', x.type === 'add' && sp.a > 0 ? fmt(sp.a) : '', x.type === 'new' ? fmt(q(x)) : '']); });
    return { cols: ['ت', 'الفقرة', 'الوحدة', 'الكمية الأصلية', 'الكمية المحذوفة', 'الكمية المضافة ضمن 20%', 'الكمية المضافة أكثر من 20%', 'الكمية المستحدثة'], rows, serial: false, shade: 'D9D9D9', fit: 'full', src: rec.id + ':' + oi, sig: sig(o.items) };
  }
  const memo = () => (typeof view !== 'undefined' && view === 'edit' && typeof R === 'function') ? R() : null;
  const srcOf = r => (r && r.tables || []).map((t, i) => ({ t, i })).filter(z => z.t && z.t.src);
  function find(src) { const [rid, oi] = String(src).split(':'); const rec = coData().find(x => x && x.id === rid); const o = rec && rec.orders && rec.orders[+oi]; return o ? { rec, oi: +oi, o } : null; }
  function stale(r) { return srcOf(r).filter(z => { const f = find(z.t.src); return f && sig(f.o.items) !== z.t.sig; }); }
  /* إدراج أو تحديث */
  function insert(rec, oi) {
    const r = memo(); if (!r) return; r.tables = r.tables || []; const tb = table(rec, oi), o = rec.orders[oi];
    const ex = r.tables.findIndex(t => t && t.src === tb.src);
    if (ex >= 0) { r.tables[ex] = Object.assign({}, r.tables[ex], { cols: tb.cols, rows: tb.rows, sig: tb.sig }); }
    else {
      const idx = r.tables.length; r.tables.push({ id: typeof uid === 'function' ? uid() : 't' + Date.now(), cols: tb.cols, rows: tb.rows, serial: false, shade: tb.shade, fit: 'full', src: tb.src, sig: tb.sig });
      const P = rec.project || {}, add = `[[جدول ${idx + 1}]]`;   // الجدول وحده — بلا كتابة في المتن
      r.body = String(r.body || '').replace(/\s*$/, '') + (r.body ? '\n' : '') + add + '\n';
      if (!String(r.fileNo || '').trim() && P.fileNo) r.fileNo = String(P.fileNo);
      if (!r.ltEv) r.ltEv = 'order:' + oi;
    }
    if (typeof touch === 'function') touch(); try { renderForm(); } catch (_) {} try { renderTables(); } catch (_) {} try { renderPreview(true); } catch (_) {}
    try { (window.flash || alert)(ex >= 0 ? '✔ حُدّث جدول الفقرات من أوامر التغيير' : `✔ أُدرجت ${(o.items || []).length} فقرة من ${oname(o, oi + 1)}`); } catch (_) {}
    ensure(true);
  }
  function update() { const r = memo(); if (!r) return; stale(r).forEach(z => { const f = find(z.t.src); if (f) insert(f.rec, f.oi); }); }
  /* نافذة الاستدعاء: البحث باسم المشروع أو الشركة أو رقم الاضبارة */
  function dlg() {
    C = null; const L = coData(), r = memo(); let ov = $('ciOv'); if (ov) ov.remove(); ov = document.createElement('div'); ov.id = 'ciOv';
    ov.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(15,23,42,.45);display:flex;align-items:center;justify-content:center;font:14px Tahoma,Arial,sans-serif;direction:rtl';
    ov.innerHTML = `<div style="background:#fff;color:#1e293b;border-radius:12px;padding:16px 18px;width:min(760px,95vw);max-height:88vh;display:flex;flex-direction:column;gap:8px">
      <h3 style="margin:0;color:#1f3a5f">📥 فقرات أمر التغيير — من نظام أوامر التغيير</h3>
      <input id="ciQ" type="search" placeholder="ابحث باسم المشروع أو اسم الشركة أو رقم الاضبارة…" style="font:inherit;padding:7px 10px;border:1px solid #cbd5e1;border-radius:8px" value="${esc(r && r.fileNo || '')}">
      <div id="ciL" style="overflow:auto;flex:1;border:1px solid #e2e8f0;border-radius:8px"></div>
      <div style="display:flex;justify-content:space-between;align-items:center"><small style="color:#64748b">يُدرج جدول الفقرات وكمياتها (الأصلية والمحذوفة والمضافة والمستحدثة) كما اعتمدتها اللجنة — بلا أسعار ولا كتابة في المتن.</small><button id="ciX" type="button">إغلاق</button></div></div>`;
    document.body.appendChild(ov);
    const draw = () => { const qv = N($('ciQ').value), hit = L.filter(x => x && x.project && (!qv || [x.project.name, x.project.contractor, x.project.fileNo, x.project.contractNo].some(v => N(v).includes(qv))));
      $('ciL').innerHTML = hit.slice(0, 60).map(x => { const P = x.project; return `<div style="padding:8px 10px;border-bottom:1px solid #eef2f7"><b>${esc(P.name || 'مشروع بلا اسم')}</b> <small style="color:#64748b">${esc(P.contractor || '')}${P.fileNo ? ' — اضبارة ' + esc(P.fileNo) : ''}</small>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:5px">${(x.orders || []).map((o, i) => { const n = (o.items || []).length; return `<button type="button" data-ci="${esc(x.id)}" data-oi="${i}" ${n ? '' : 'disabled title="لا فقرات محفوظة لهذا الأمر — افتح «🔍 مراجعة ملف أمر التغيير» في نظام أوامر التغيير واختر ملفه"'} style="padding:4px 10px;border-radius:8px;border:1px solid ${n ? '#2563a8' : '#cbd5e1'};background:${n ? '#eff6ff' : '#f8fafc'};color:${n ? '#1e3a8a' : '#94a3b8'};cursor:${n ? 'pointer' : 'default'}">${esc(oname(o, i + 1))} — ${n ? n + ' فقرة' : 'بلا فقرات'}</button>`; }).join('')}</div></div>`; }).join('') || '<div style="padding:14px;color:#64748b">لا مشاريع مطابقة في نظام أوامر التغيير.</div>'; };
    draw(); $('ciQ').addEventListener('input', draw); $('ciQ').focus();
    ov.addEventListener('click', e => { if (e.target === ov || e.target.id === 'ciX') { ov.remove(); return; } const b = e.target.closest('[data-ci]'); if (!b || b.disabled) return;
      const rec = L.find(x => x.id === b.dataset.ci); if (!rec) return; ov.remove(); insert(rec, +b.dataset.oi); });
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
  window.CoItems = { dlg, insert: (rid, oi) => { C = null; const rec = coData().find(x => x.id === rid); if (rec) insert(rec, oi); }, update, stale: () => stale(memo()).length, table };
})();
