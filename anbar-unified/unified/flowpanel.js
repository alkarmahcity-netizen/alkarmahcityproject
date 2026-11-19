/* global view, R, S */
/* شريط «لوحة سير المعاملات» داخل السلف وأوامر التغيير والمدد (البرنامج الموحد فقط).
   يُحقن من البرنامج في صفحة النظام، ويضع تحت شريط المحرر: تاريخ استلام الذمة، والمرحلة، وسبب الإرجاع.
   لا يكتب شيئاً في ملف النظام: القيم تُحفظ في ملف اللوحة (Workflow-Data.json) وتُزامَن معها في الاتجاهين. */
(function (SYS) {
  'use strict';
  if (window.__wfPanel || !window.desktop || !window.desktop.flowGet) return;
  window.__wfPanel = 1;
  const ST = [['rcv', 'استلام'], ['aud', 'تدقيق'], ['rev', 'مراجعة'], ['prt', 'طباعة وتوقيع'], ['done', 'منجزة'], ['ret', 'مُعادة']];
  const SN = Object.fromEntries(ST);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  // المعاملة الحالية في كل نظام = آخر سلفة / آخر أمر / آخر مدة في الملف المفتوح (كما في اللوحة)
  const KEY = {
    ad: () => { try { if (view !== 'edit') return null; const r = R(); if (!r) return null; const a0 = document.querySelector('#main .ed-bar'); const L = r.advances || []; if (!L.length) return { anchor: a0, none: 'أضف سلفة ليظهر الملف على لوحة سير المعاملات' }; const i = L.length - 1, a = L[i] || {}; return { key: `ad:${r.id}:${a.id || i}`, label: 'السلفة رقم ' + (a.no || i + 1), anchor: a0 }; } catch (_) { return null; } },
    co: () => { try { const bar = document.getElementById('edBar'); if (!bar || !bar.offsetParent) return null; const r = R(); if (!r) return null; const n = Math.max(1, (r.orders || []).length); return { key: `co:${r.id}:${n}`, label: 'أمر التغيير رقم ' + n, anchor: bar }; } catch (_) { return null; } },
    du: () => { try { const p = document.getElementById('proj'), a0 = document.getElementById('curFile'); if (!p || p.hidden || !a0 || typeof S === 'undefined' || !S || !S.rid) return null; const L = S.exts || []; if (!L.length) return (S.cases || []).length ? { key: `du:${S.rid}:f`, label: 'التوقف والاستئناف (قبل المدة الإضافية)', anchor: a0 } : { anchor: a0, none: 'أضف توقفاً أو مدة إضافية ليظهر الملف على لوحة سير المعاملات' }; const i = L.length - 1, e = L[i] || {}; return { key: `du:${S.rid}:${e.id || i}`, label: 'المدة رقم ' + (e.no || i + 1), anchor: a0 }; } catch (_) { return null; } }
  }[SYS];
  if (!KEY) return;
  const css = document.createElement('style');
  css.textContent = `.wfp{display:flex;flex-wrap:wrap;align-items:center;gap:6px 12px;margin:6px 0;padding:6px 10px;border:1px solid #c9d6e3;border-inline-start:4px solid #334155;border-radius:10px;background:#f6f8fb;font-size:13px;color:#1e293b}
  .wfp b{font-size:13px}.wfp label{display:inline-flex;align-items:center;gap:5px;margin:0;font-weight:400;white-space:nowrap}
  .wfp input,.wfp select{font:inherit;font-size:13px;padding:2px 6px;border:1px solid #c9d6e3;border-radius:6px;background:#fff;width:auto;min-width:0;height:auto;margin:0}
  .wfp input[data-wf=why]{min-width:220px}.wfp .wfi{color:#64748b;font-size:12px}.wfp .wfi.late{color:#b42318;font-weight:700}.wfp .wfi.err{color:#b42318}
  .wfp [hidden]{display:none!important}.wfp label{width:auto!important}
  @media print{.wfp{display:none!important}}`;
  document.head.appendChild(css);
  let cur = null, last = '', pend = false, busy = false;
  function build(k) {
    const el = document.createElement('div'); el.id = 'wfPanel'; el.className = 'wfp no-print';
    el.innerHTML = `<b>📋 لوحة سير المعاملات</b><span data-wf="lbl"></span>
      <label>تاريخ استلام الذمة <input type="date" data-wf="recv"></label>
      <label>المرحلة <select data-wf="st">${ST.map(s => `<option value="${s[0]}">${s[1]}</option>`).join('')}</select></label>
      <label data-wf="whyl" hidden>سبب الإرجاع <input data-wf="why" placeholder="يظهر على البطاقة في اللوحة"></label>
      <span class="wfi" data-wf="info"></span>`;
    k.anchor.insertAdjacentElement('afterend', el);
    const $ = n => el.querySelector(`[data-wf="${n}"]`);
    /* نظام المدد يحوّل حقل التاريخ إلى «يوم/شهر/سنة» + زر تقويم ويُرسل input لا change — يُستمع للحدثين، ولا يُرسل التاريخ نفسه مرتين */
    let sent = null; const recvSave = () => { const v = $('recv').value; if (!cur || !cur.key || !v || v === sent) return; sent = v; put({ recv: v }); };
    $('recv').addEventListener('change', recvSave); $('recv').addEventListener('input', recvSave);
    el._resetSent = v => { sent = v; };
    $('st').addEventListener('change', () => {
      if (!cur || !cur.key) return;
      if ($('st').value === 'ret') { $('whyl').hidden = false; $('why').focus(); info('اكتب سبب الإرجاع ثم Enter'); return; }
      $('whyl').hidden = true; put({ st: $('st').value, recv: $('recv').value });
    });
    const why = () => { if (cur && cur.key && $('st').value === 'ret' && $('why').value.trim()) put({ st: 'ret', why: $('why').value.trim(), recv: $('recv').value }); };
    $('why').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); why(); } });
    $('why').addEventListener('change', why);
    return el;
  }
  const P = () => document.getElementById('wfPanel');
  const q = n => P() && P().querySelector(`[data-wf="${n}"]`);
  function info(t, cls) { const i = q('info'); if (i) { i.textContent = t; i.className = 'wfi' + (cls ? ' ' + cls : ''); } }
  async function put(patch) {
    if (busy) return; busy = true;
    try { const r = await window.desktop.flowSet(cur.key, patch); if (r && r.error) info(r.error, 'err'); else { if (patch.why && document.activeElement === q('why')) document.activeElement.blur(); show(r && r.card); } } catch (_) { info('تعذّر الحفظ في اللوحة', 'err'); }
    busy = false;
  }
  /* الحقل المرئي البديل (يوم/شهر/سنة) وزر التقويم في نظام المدد */
  const dmy = v => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || ''); return m ? `${+m[3]}/${+m[2]}/${m[1]}` : ''; };
  /* نظام المدد يحوّل الحقل بعد بنائه (MutationObserver) — يُعاد التطبيق بعد لحظة */
  function twin(dis) { twin0(dis); setTimeout(() => twin0(dis), 60); setTimeout(() => twin0(dis), 400); }
  function twin0(dis) { const h = q('recv'), w = h && h.parentNode; if (!w || !w.classList || !w.classList.contains('dmy')) return; const t = w.querySelector('input[type=text]'), b = w.querySelector('button');
    if (t) { t.disabled = dis; if (document.activeElement !== t) { t.value = dmy(h.value); t.classList.remove('bad'); } } if (b) b.disabled = dis; }
  function show(c) {
    const el = P(); if (!el || !cur) return;
    const fa = document.activeElement, setv = (n, v) => { const x = q(n); if (x !== fa) x.value = v; };   // لا يُغيَّر الحقل الذي يُكتب فيه الآن
    q('lbl').textContent = cur.label ? '— ' + cur.label : '';
    for (const n of ['recv', 'st']) q(n).disabled = !cur.key;
    if (!cur.key) { q('whyl').hidden = true; twin(true); info(cur.none || ''); return; }
    if (!c) { setv('recv', today()); if (P()._resetSent) P()._resetSent(null); twin(false); setv('st', 'rcv'); q('whyl').hidden = true; info('غير مضافة إلى اللوحة بعد — تُضاف عند تحديد التاريخ أو المرحلة'); return; }
    { setv('recv', c.recv || ''); if (P()._resetSent) P()._resetSent(c.recv || null); twin(false); const h = (c.hist || [])[c.hist.length - 1] || {}; if (!(fa === q('why') && q('st').value === 'ret' && c.st !== 'ret')) { setv('st', c.st); q('whyl').hidden = c.st !== 'ret'; setv('why', c.st === 'ret' ? (h.why || '') : ''); } }
    const h = (c.hist || [])[c.hist.length - 1] || {}, since = c.since || h.at || c.updated, d = Math.floor((Date.now() - since) / 864e5), late = !['done', 'ret'].includes(c.st) && d > (c.late || 5);
    info(`في «${SN[c.st]}» ${d < 1 ? 'منذ اليوم' : 'منذ ' + d + ' يوماً'}${h.by ? ' — آخر نقل: ' + h.by : ''}`, late ? 'late' : '');
  }
  async function refresh() { if (!cur || !cur.key) return show(null); const k = cur.key; let c = null; try { c = await window.desktop.flowGet(k); } catch (_) {} if (cur && cur.key === k) show(c); }
  function tick() {
    pend = false;
    const k = KEY(), el = P();
    if (!k || !k.anchor) { if (el) el.remove(); last = ''; cur = null; return; }
    if (!el || el.previousElementSibling !== k.anchor) { if (el) el.remove(); build(k); last = ''; }
    cur = k; const id = k.key || ('none:' + (k.none || ''));
    if (id !== last) { last = id; refresh(); }
  }
  new MutationObserver(() => { if (!pend) { pend = true; requestAnimationFrame(tick); } }).observe(document.body, { childList: true, subtree: true });
  if (window.desktop.onFlow) window.desktop.onFlow(() => refresh());
  tick();
})('__SYS__');
