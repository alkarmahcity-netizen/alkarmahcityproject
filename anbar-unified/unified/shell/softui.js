/* «مظهر الواجهة: ناعم ثلاثي الأبعاد» (عرض ← مظهر الواجهة): بطاقات وأزرار بارزة بظلال ناعمة، ألوان باستيل لكل نظام،
   شريط تبويبات بيضوي، وأيقونات خطية موحّدة (مرسومة لهذا البرنامج، داخله، تعمل بلا إنترنت) بدل الرموز التعبيرية في الشريط العلوي وبطاقات الرئيسية.
   الشكل فقط: لا يغيّر منطق الأنظمة ولا بياناتها، ولا يمس نوافذ الأنظمة نفسها ولا «مركز المتابعة» ولا الوضع الداكن ولا الطباعة.
   بلا تمويه حي (backdrop-filter) حتى لا يثقل الحاسبات القديمة. يُطفأ فيعود الشكل السابق كما كان. */
(function () {
  'use strict';
  const D = window.desktop || {};
  const P = {
    co: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 15.5l5.5-5.5 2 2L11 17.5H9z"/>',
    du: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5"/><path d="M9.5 2.5h5"/><path d="M12 2.5V5"/>',
    ad: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/><circle cx="16" cy="14.5" r="1.6"/><path d="M7 3.5h10"/>',
    in: '<path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6z"/><path d="M8.8 12.2l2.3 2.3 4.3-4.6"/>',
    ac: '<path d="M3 21h18"/><path d="M5 21V10l7-5 7 5v11"/><path d="M9.5 21v-6h5v6"/><path d="M9 11h6"/>',
    lt: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 6.5l8.5 6.5 8.5-6.5"/>',
    fu: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M8.5 12.5h7M8.5 16h7M8.5 9h3"/>',
    ar: '<rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9"/><path d="M10 13h4"/>',
    wf: '<rect x="3" y="4" width="5" height="16" rx="1.2"/><rect x="9.5" y="4" width="5" height="11" rx="1.2"/><rect x="16" y="4" width="5" height="7" rx="1.2"/>',
    cc: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/><path d="M12 3.5V1.5M12 22.5v-2M3.5 12h-2M22.5 12h-2"/>',
    sit: '<path d="M4 20V4"/><path d="M4 20h16"/><rect x="7" y="11" width="3" height="6" rx=".6"/><rect x="12" y="7" width="3" height="10" rx=".6"/><rect x="17" y="13" width="3" height="4" rx=".6"/>',
    pl: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9M15 9v12"/>',
    guide: '<path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H20v15H5.5A1.5 1.5 0 0 0 4 19.5z"/><path d="M4 19.5A1.5 1.5 0 0 0 5.5 21H20v-3"/><path d="M9 7.5h7"/>',
    calc: '<rect x="5" y="2.5" width="14" height="19" rx="2"/><rect x="8" y="5.5" width="8" height="4" rx=".8"/><path d="M8.5 13h.01M12 13h.01M15.5 13h.01M8.5 17h.01M12 17h.01M15.5 17h.01"/>',
    log: '<path d="M3.5 12a8.5 8.5 0 1 0 2.5-6"/><path d="M3 4v4h4"/><path d="M12 8v4.5l3 2"/>',
    home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-5h4v5"/>',
    manual: '<path d="M12 6.5C10 5 7 4.5 3.5 5v13c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5V5C17 4.5 14 5 12 6.5z"/><path d="M12 6.5v13"/>',
    folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3M14.5 8.5l2 2"/>',
    sync: '<path d="M20 12a8 8 0 0 1-14 5.3M4 12a8 8 0 0 1 14-5.3"/><path d="M18 3v4h-4M6 21v-4h4"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 6.5l8.5 6.5 8.5-6.5"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7.5a4 4 0 0 1 8 0V11"/>'
  };
  P.dm = P.fu; P.cm = P.fu;
  const svg = (k, cls) => `<svg class="ui-i${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[k] || ''}</svg>`;
  const PAST = { co: ['#cdeedd', '#1f6b46'], du: ['#d4e3f4', '#2563a8'], ad: ['#f3e6c4', '#8a6516'], in: ['#c9ece6', '#0f766e'], ac: ['#f4d6d0', '#a33a2b'], lt: ['#d9def5', '#2f3f9e'], fu: ['#e6dbf7', '#6b3fc0'], ar: ['#f6dcc6', '#a4520f'], wf: ['#dfe5ea', '#3b4f61'], cc: ['#d3eef2', '#0e7490'], sit: ['#d8ecd4', '#2f6b34'], pl: ['#e2e8d0', '#55661f'], guide: ['#dfe3f2', '#33407a'], calc: ['#e9e1d3', '#6b5326'] };
  const S = 'html[data-ui="soft"]:not([data-theme="dark"])';
  const N = `${S} .page:not(#pg-cc)`;   /* مركز المتابعة له مظهره الداكن الخاص */
  const css = `
  @media not print {
  ${S}{background:#ebe8e1!important;background-image:none!important}
  ${S} body,${S} .page:not(#pg-cc){background:#ebe8e1!important}
  ${S} .bar{background:#efece6!important;border-bottom:0!important;box-shadow:0 6px 16px rgba(80,70,50,.08)}
  ${S} .bar .brand{border-inline-end:0!important}
  ${S} .tabs{background:#e2ded6;border-radius:999px;padding:4px 5px;margin:7px 4px;box-shadow:inset 3px 3px 7px #cdc8bf,inset -3px -3px 7px #fff;gap:2px!important}
  ${S} .tab{border:0!important;border-radius:999px;margin:0!important;padding:0 12px!important;color:#56625b!important;display:inline-flex;align-items:center;gap:6px}
  ${S} .tab .ui-i{width:16px;height:16px;flex:none}
  ${S} .tab.on{background:#bfead6!important;color:#1d4d3b!important;box-shadow:3px 3px 8px #c8c3ba,-3px -3px 8px #fff,inset 0 1px 0 rgba(255,255,255,.8)}
  ${S} .bar .btn{background:#efece6!important;border:0!important;border-radius:999px!important;color:#3d4a43!important;box-shadow:3px 3px 7px #cfcac1,-3px -3px 7px #fff!important;display:inline-flex;align-items:center;gap:4px}
  ${S} .bar .btn .ui-i{width:17px;height:17px}
  ${S} .hero h1{color:#2c3833}${S} .hero .sub{color:#7a817c}
  ${S} .hero .lg{filter:drop-shadow(6px 8px 10px rgba(80,70,50,.18))}
  ${S} .tile{background:#f0ede7!important;border:0!important;border-radius:26px!important;box-shadow:10px 10px 22px #d2cdc3,-10px -10px 22px #fff!important}
  ${S} .tile:hover{transform:translateY(-2px);box-shadow:12px 12px 26px #cdc8be,-10px -10px 22px #fff!important}
  ${S} .tile::before{display:none}
  ${S} .tile .ic{width:62px;height:62px;border-radius:20px;box-shadow:5px 6px 12px #d0cbc2,-5px -5px 11px #fff,inset 0 2px 0 rgba(255,255,255,.7)}
  ${S} .tile .ic .ui-i{width:30px;height:30px}
  ${S} .tile h3{color:#2c3833}
  ${S} .tile .ct{display:inline-block;margin-top:10px;background:#e6e2da;border-radius:999px;padding:4px 14px;color:#3f6e5b!important;box-shadow:inset 2px 2px 5px #d0cbc2,inset -2px -2px 5px #fff}
  ${S} .tile .lock{color:#9a948a}${S} .tile .lock .ui-i{width:15px;height:15px}
  ${Object.entries(PAST).map(([k, [b, c]]) => `${S} .tile[data-go="${k}"] .ic{background:${b};color:${c}}`).join('')}
  ${N} .btn{background:#efece6;border:0;border-radius:999px;box-shadow:3px 3px 7px #cfcac1,-3px -3px 7px #fff}
  ${N} .btn:active{box-shadow:inset 2px 2px 5px #cfcac1,inset -2px -2px 5px #fff}
  ${N} .btn.pri{background:#bfead6;color:#1d4d3b;box-shadow:3px 3px 8px #c8c3ba,-3px -3px 8px #fff,inset 0 1px 0 rgba(255,255,255,.8)}
  ${N} .kpi,${N} .card,${N} .rbox,${N} .dept,${N} .comsel{background:#f0ede7;border-color:transparent;border-radius:18px;box-shadow:6px 6px 14px #d4cfc5,-6px -6px 14px #fff}
  ${N} .tw{background:#f3f1ec;border:0;border-radius:18px;box-shadow:6px 6px 14px #d4cfc5,-6px -6px 14px #fff}
  ${N} .empty{background:#f0ede7;border-color:#d8d3c9}
  ${N} input:not([type=checkbox]):not([type=radio]):not([type=range]),${N} select{background:#e9e5dd;border:0;border-radius:12px;box-shadow:inset 2px 2px 5px #d0cbc2,inset -2px -2px 5px #fff}
  ${N} .dchip{background:#efece6;border:0;box-shadow:2px 2px 5px #d0cbc2,-2px -2px 5px #fff}
  ${S} .ov{background:rgba(70,62,48,.35)}
  ${S} .ov .btn{background:#efece6;border:0;border-radius:999px;box-shadow:3px 3px 7px #cfcac1,-3px -3px 7px #fff}${S} .ov .btn.pri{background:#2f6b34;color:#fff}
  ${S} .ov input:not([type=checkbox]):not([type=radio]):not([type=range]),${S} .ov select{background:#e9e5dd;border:0;border-radius:12px;box-shadow:inset 2px 2px 5px #d0cbc2,inset -2px -2px 5px #fff}
  ${S} .ov .dlg{background:#f0ede7;border-radius:22px;box-shadow:14px 14px 34px rgba(60,52,40,.28),-6px -6px 16px rgba(255,255,255,.5)}
  ${S} .drawer{background:#f0ede7}
  ${S} .foot{background:#efece6!important;border-top:0!important}
  }`;
  const st = document.createElement('style'); st.id = 'softUiCss'; st.textContent = css; document.head.appendChild(st);

  /* الرموز التعبيرية ← أيقونات (تُحفظ النصوص الأصلية فتعود عند الإطفاء) */
  const AR = /[؀-ۿ]/;
  const label = t => { const i = t.search(AR); return i < 0 ? t.trim() : t.slice(i).trim(); };
  const on = () => document.documentElement.getAttribute('data-ui') === 'soft';
  let busy = false;
  function swapTab(b) {
    if (b.querySelector('.ui-i')) return; const t = b.textContent; b.dataset.uiOrig = t;
    b.innerHTML = svg(/🔒/.test(t) ? 'lock' : (b.dataset.go || 'home')) + `<span>${label(t).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))}</span>`;
  }
  function swapTiles() { document.querySelectorAll('#tiles .tile').forEach(t => { const ic = t.querySelector('.ic'); if (ic && !ic.querySelector('.ui-i')) { ic.dataset.uiOrig = ic.textContent; ic.innerHTML = svg(t.dataset.go); } const l = t.querySelector('.lock'); if (l && !l.querySelector('.ui-i')) { l.dataset.uiOrig = l.textContent; l.innerHTML = svg('lock'); } }); }
  const BTN = [['bManual', 'manual'], ['bFolder', 'folder'], ['bPw', 'key'], ['bLock', 'lock'], ['bMail', 'mail']];
  function swapBtns() {
    BTN.forEach(([id, k]) => { const b = document.getElementById(id); if (b && !b.querySelector('.ui-i')) { b.dataset.uiOrig = b.innerHTML; b.innerHTML = svg(k); } });
    const sy = document.getElementById('bSync'); if (sy && !sy.querySelector('.ui-i')) { sy.dataset.uiOrig = sy.innerHTML; const n = [...sy.childNodes].find(x => x.nodeType === 3 && /\S/.test(x.textContent)); if (n) n.replaceWith(document.createRange().createContextualFragment(svg('sync'))); }
    const w = document.getElementById('bWho'); if (w && !w.querySelector('.ui-i') && /👤/.test(w.textContent)) { w.dataset.uiOrig = '1'; w.innerHTML = svg('user') + `<span>${label(w.textContent.replace('👤', '')) || '—'}</span>`; }
  }
  function apply() { if (!on() || busy) return; busy = true; try { document.querySelectorAll('#tabs .tab').forEach(swapTab); swapTiles(); swapBtns(); } finally { busy = false; } }
  function restore() {
    busy = true;
    try {
      document.querySelectorAll('#tabs .tab').forEach(b => { if (b.dataset.uiOrig != null && b.querySelector('.ui-i')) { b.textContent = b.dataset.uiOrig; delete b.dataset.uiOrig; } });
      document.querySelectorAll('#tiles [data-ui-orig]').forEach(x => { x.textContent = x.dataset.uiOrig; delete x.dataset.uiOrig; });
      BTN.concat([['bSync']]).forEach(([id]) => { const b = document.getElementById(id); if (b && b.dataset.uiOrig != null) { b.innerHTML = b.dataset.uiOrig; delete b.dataset.uiOrig; } });
      const w = document.getElementById('bWho'); if (w && w.dataset.uiOrig) { const t = (w.querySelector('span') || w).textContent; w.textContent = '👤 ' + t; delete w.dataset.uiOrig; }
    } finally { busy = false; }
  }
  const mo = new MutationObserver(() => { if (on() && !busy) apply(); });
  ['tabs', 'tiles', 'bWho', 'bSync'].forEach(id => { const el = document.getElementById(id); if (el) mo.observe(el, { childList: true, subtree: true, characterData: true }); });
  function set(mode) { if (mode === 'soft') { document.documentElement.setAttribute('data-ui', 'soft'); apply(); } else { document.documentElement.removeAttribute('data-ui'); restore(); } }
  let mode = 'soft'; try { mode = D.uiTheme ? D.uiTheme() : 'soft'; } catch (_) {}
  set(mode);

  /* ---------- أيقونات ملوّنة ثلاثية الأبعاد في «الموقف العام» (مرسومة لهذا البرنامج: تدرج + لمعة + ظل) ---------- */
  const GR = { y: ['#ffe58f', '#f2b10a'], b: ['#8cc4ff', '#2b6fd6'], g: ['#8fe39d', '#2e9e48'], r: ['#ff9a8a', '#d93a2b'], o: ['#ffc98a', '#ef7a17'], p: ['#cdb0ff', '#7b4ce0'], br: ['#d3a173', '#7a4a26'], w: ['#ffffff', '#d9dde3'], k: ['#6b7787', '#2f3a48'], t: ['#8fe0d6', '#14998a'] };
  if (!document.getElementById('i3defs')) { const d = document.createElement('div'); d.innerHTML = `<svg id="i3defs" width="0" height="0" style="position:absolute" aria-hidden="true"><defs>${Object.entries(GR).map(([k, [a, b]]) => `<linearGradient id="i3${k}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`).join('')}<radialGradient id="i3hl" cx=".35" cy=".25" r=".6"><stop offset="0" stop-color="#fff" stop-opacity=".75"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs></svg>`; document.body.appendChild(d.firstChild); }
  const f = k => `fill="url(#i3${k})"`, HL = (x, y, rx, ry) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="url(#i3hl)"/>`;
  const I3 = {
    building: `<path d="M4 21V8.5L12 4l8 4.5V21z" ${f('b')}/><path d="M2.5 21.5h19" stroke="#2f3a48" stroke-width="1.6" stroke-linecap="round"/><rect x="7" y="10" width="3" height="3" rx=".6" fill="#fff"/><rect x="14" y="10" width="3" height="3" rx=".6" fill="#fff"/><rect x="10.3" y="15" width="3.4" height="6" rx=".7" ${f('y')}/>${HL(9, 8, 5, 2.5)}`,
    docEdit: `<path d="M6 2.5h8.5L19 7v13a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 20V4A1.5 1.5 0 0 1 6 2.5z" ${f('b')}/><path d="M14.5 2.5V7H19" fill="#cfe4ff"/><path d="M8 11h7M8 14h5" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/><path d="M12.5 20.5l1-3.5 6.5-6.5 2.5 2.5-6.5 6.5z" ${f('y')} stroke="#a36a00" stroke-width=".6"/>${HL(9, 6, 4, 2.5)}`,
    money: `<rect x="2" y="6" width="20" height="12.5" rx="2.2" ${f('g')}/><rect x="4" y="8" width="16" height="8.5" rx="1.4" fill="none" stroke="#d9ffe0" stroke-width=".9" opacity=".8"/><circle cx="12" cy="12.25" r="3" fill="#d9ffe0"/><path d="M13.4 10.6c-.3-.6-.9-.9-1.5-.9-.9 0-1.5.5-1.5 1.1 0 1.4 3.1.8 3.1 2.4 0 .7-.7 1.2-1.6 1.2-.7 0-1.3-.3-1.6-.9M12 9v.7M12 14.4v.7" stroke="#1f7a34" stroke-width=".9" fill="none" stroke-linecap="round"/>${HL(9, 8, 6, 2)}`,
    coins: `<ellipse cx="12" cy="17" rx="7.5" ry="2.8" ${f('y')}/><rect x="4.5" y="12.5" width="15" height="4.5" ${f('y')}/><ellipse cx="12" cy="12.5" rx="7.5" ry="2.8" fill="#ffe9a8"/><rect x="4.5" y="7.5" width="15" height="5" ${f('y')}/><ellipse cx="12" cy="7.5" rx="7.5" ry="2.8" fill="#fff2c4" stroke="#e0a400" stroke-width=".6"/><path d="M4.5 12.5v4.5M19.5 12.5v4.5" stroke="#c98c00" stroke-width=".6"/>${HL(10, 6.8, 4, 1.3)}`,
    wallet: `<rect x="2.5" y="6" width="19" height="14" rx="3" ${f('br')}/><path d="M4 6l11-3 1.5 3" ${f('br')} opacity=".85"/><rect x="14" y="10.5" width="7.5" height="5" rx="2.3" fill="#5a3418"/><circle cx="17" cy="13" r="1.3" ${f('y')}/>${HL(8, 8.5, 5, 2)}`,
    clock: `<circle cx="12" cy="12" r="9.5" ${f('k')}/><circle cx="12" cy="12" r="7.6" ${f('w')}/><path d="M12 7.5V12l3 2" stroke="#2f3a48" stroke-width="1.7" stroke-linecap="round" fill="none"/><circle cx="12" cy="12" r="1" fill="#d93a2b"/>${HL(9.5, 8, 4.5, 2.5)}`,
    clipboard: `<rect x="4" y="4" width="16" height="18" rx="2.3" ${f('o')}/><rect x="6.5" y="6.5" width="11" height="13.5" rx="1" fill="#fff"/><rect x="8.5" y="2.5" width="7" height="3.5" rx="1.2" ${f('k')}/><path d="M9 13.5l2.2 2.2 4-4.6" stroke="#2e9e48" stroke-width="1.9" fill="none" stroke-linecap="round" stroke-linejoin="round"/>${HL(9, 6, 4, 1.5)}`,
    shield: `<path d="M12 2.5l8 3.2v5.6c0 5-3.4 9.1-8 10.7-4.6-1.6-8-5.7-8-10.7V5.7z" ${f('b')}/><path d="M8.3 12.2l2.6 2.6 4.8-5.2" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>${HL(10, 7, 4.5, 2.5)}`,
    chart: `<rect x="2.5" y="3" width="19" height="18" rx="3" ${f('w')}/><rect x="6" y="12" width="3" height="6" rx=".8" ${f('b')}/><rect x="10.5" y="7" width="3" height="11" rx=".8" ${f('g')}/><rect x="15" y="10" width="3" height="8" rx=".8" ${f('o')}/>${HL(9, 6, 6, 2)}`,
    download: `<rect x="3" y="16" width="18" height="5" rx="1.6" ${f('k')}/><path d="M9.5 3h5v7h3.5L12 16 6 10h3.5z" ${f('g')}/>${HL(11, 6, 2.5, 2.5)}`,
    upload: `<rect x="3" y="16" width="18" height="5" rx="1.6" ${f('k')}/><path d="M9.5 15h5V9h3.5L12 3 6 9h3.5z" ${f('b')}/>${HL(11, 8, 2.5, 2.5)}`,
    calendar: `<rect x="3" y="4.5" width="18" height="17" rx="2.5" ${f('w')}/><path d="M3 7a2.5 2.5 0 0 1 2.5-2.5h13A2.5 2.5 0 0 1 21 7v2.5H3z" ${f('r')}/><rect x="7" y="2.5" width="2" height="4.5" rx="1" ${f('k')}/><rect x="15" y="2.5" width="2" height="4.5" rx="1" ${f('k')}/>${[0, 1, 2].map(r => [0, 1, 2, 3].map(c => `<rect x="${6 + c * 3.3}" y="${12 + r * 3}" width="1.9" height="1.7" rx=".4" fill="#9aa4b1"/>`).join('')).join('')}`,
    sheet: `<path d="M6 2.5h8.5L19 7v13a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 20V4A1.5 1.5 0 0 1 6 2.5z" ${f('g')}/><path d="M14.5 2.5V7H19" fill="#c9f2d1"/><rect x="7.5" y="10" width="9" height="8" rx=".8" fill="#fff"/><path d="M7.5 12.7h9M7.5 15.3h9M10.5 10v8M13.5 10v8" stroke="#2e9e48" stroke-width=".7"/>${HL(9, 6, 4, 2)}`,
    file: `<path d="M6 2.5h8.5L19 7v13a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 20V4A1.5 1.5 0 0 1 6 2.5z" ${f('w')} stroke="#c4cad3" stroke-width=".6"/><path d="M14.5 2.5V7H19" fill="#e8ecf1"/><path d="M8 11h8M8 14h8M8 17h5" stroke="#8a95a3" stroke-width="1.3" stroke-linecap="round"/>`,
    puzzle: `<path d="M4 8h4a2 2 0 1 1 4 0h4v4a2 2 0 1 1 0 4v4h-4a2 2 0 1 0-4 0H4v-4a2 2 0 1 0 0-4z" ${f('p')}/>${HL(8, 10, 3.5, 2)}`,
    pin: `<path d="M12 22s-7-6.4-7-12a7 7 0 0 1 14 0c0 5.6-7 12-7 12z" ${f('r')}/><circle cx="12" cy="10" r="2.7" fill="#fff"/>${HL(10, 6.5, 3.5, 2)}`,
    user: `<circle cx="12" cy="8" r="4.5" ${f('b')}/><path d="M3.5 21a8.5 8.5 0 0 1 17 0z" ${f('b')}/>${HL(10.5, 6, 2.5, 1.6)}${HL(10, 15.5, 4, 1.6)}`,
    lock: `<rect x="4.5" y="10" width="15" height="11.5" rx="2.4" ${f('y')}/><path d="M8 10V7.5a4 4 0 0 1 8 0V10" fill="none" stroke="url(#i3k)" stroke-width="2.2"/><circle cx="12" cy="15" r="1.6" fill="#5a3a00"/><rect x="11.3" y="15.5" width="1.4" height="3" rx=".6" fill="#5a3a00"/>${HL(9.5, 12, 4, 1.5)}`,
    link: `<rect x="2.5" y="8" width="11" height="8" rx="4" fill="none" stroke="url(#i3t)" stroke-width="2.6"/><rect x="10.5" y="8" width="11" height="8" rx="4" fill="none" stroke="url(#i3b)" stroke-width="2.6"/>`
  };
  const i3 = (k, cls) => `<svg class="i3${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" aria-hidden="true">${I3[k] || ''}</svg>`;
  const KPI3 = [[/مشروع في الموقف/, 'building'], [/أوامر التغيير \(بالنظام\)/, 'docEdit'], [/أوامر التغيير/, 'docEdit'], [/كلفة العقود/, 'money'], [/الانجاز|الإنجاز/, 'chart'], [/السلف المرفوعة/, 'coins'], [/السلف المصروفة/, 'wallet'], [/المتبقي/, 'clock'], [/سلف لجنة/, 'clipboard'], [/محاضر الاستلام/, 'shield']];
  const BTN3 = [[/تصدير بنموذج/, 'download'], [/^النموذج/, 'file'], [/ربط المالية/, 'money'], [/تقرير العمل الأسبوعي/, 'calendar'], [/تقارير Excel/, 'sheet'], [/تصدير CSV/, 'file'], [/دمج مواقف/, 'puzzle'], [/نسب الإنجاز في ملف التخطيط/, 'chart'], [/^استيراد/, 'upload'], [/لوحة المشاريع/, 'chart'], [/الخريطة/, 'pin'], [/المهندسون/, 'user']];
  const pick = (L, t) => { for (const [re, k] of L) if (re.test(t)) return k; return ''; };
  function deco() {
    if (!on()) return; const pgS = document.getElementById('pg-sit'); if (!pgS) return;
    pgS.querySelectorAll('.kpi:not([data-i3])').forEach(k => { k.setAttribute('data-i3', '1'); const t = (k.querySelector('span') || k).textContent, ic = pick(KPI3, t); if (ic) k.insertAdjacentHTML('afterbegin', i3(ic, 'i3k')); });
    pgS.querySelectorAll('.kpi.finhid b:not([data-i3])').forEach(b => { if (!/🔒/.test(b.textContent) || b.querySelector('.i3')) return; b.setAttribute('data-i3', '1'); b.dataset.i3orig = b.innerHTML; b.innerHTML = b.innerHTML.replace('🔒', i3('lock', 'i3l')); });
    pgS.querySelectorAll('button.btn:not([data-i3]),button.ar-btn:not([data-i3]),button.st:not([data-i3])').forEach(b => { b.setAttribute('data-i3', '1'); const t = label(b.textContent), ic = pick(BTN3, t); if (!ic) return;
      b.dataset.i3orig = b.innerHTML; const n = [...b.childNodes].find(x => x.nodeType === 3 && /\S/.test(x.textContent)); if (n) n.textContent = n.textContent.replace(/^[^؀-ۿA-Za-z0-9(«]+/, ''); b.insertAdjacentHTML('afterbegin', i3(ic)); });
  }
  function undeco() { document.querySelectorAll('#pg-sit .i3').forEach(x => x.remove()); document.querySelectorAll('#pg-sit [data-i3orig]').forEach(b => { b.innerHTML = b.dataset.i3orig; delete b.dataset.i3orig; }); document.querySelectorAll('#pg-sit [data-i3]').forEach(x => x.removeAttribute('data-i3')); }
  const st3 = document.createElement('style'); st3.textContent = `${S} #pg-sit .i3{width:19px;height:19px;flex:none;vertical-align:-4px;margin-inline-end:6px;filter:drop-shadow(0 1.5px 1.2px rgba(40,30,10,.28))}
  ${S} #pg-sit .kpi{position:relative}${S} #pg-sit .kpi .i3k{position:absolute;top:10px;inset-inline-end:12px;width:34px;height:34px;margin:0;filter:drop-shadow(0 3px 3px rgba(40,30,10,.25))}
  ${S} #pg-sit .kpi>span:first-of-type{padding-inline-end:40px}${S} #pg-sit .i3.i3l{width:17px;height:17px;margin:0 2px;vertical-align:-3px}
  @media print{#pg-sit .i3{display:none!important}}`; document.head.appendChild(st3);
  let decoT = 0; const pgSit = document.getElementById('pg-sit');
  if (pgSit) new MutationObserver(() => { if (!on() || decoT) return; decoT = requestAnimationFrame(() => { decoT = 0; try { deco(); } catch (_) {} }); }).observe(pgSit, { childList: true, subtree: true });
  const set0 = set;
  window.SoftUi = { set: m => { set0(m); if (m === 'soft') deco(); else undeco(); }, apply, svg, i3, deco };
  if (on()) deco();

})();
