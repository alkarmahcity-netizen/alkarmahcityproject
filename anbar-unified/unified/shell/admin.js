/* global openOv, closeOv */
/* أدوات حاسبة القسم: «النسخ الاحتياطي الخارجي» و«حالة الحاسبات المتصلة» — نافذتان مستقلتان لا تمسّان الأنظمة */
(function () {
  const D = window.desktop; if (!D || !D.xbGet) return;
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const tm = t => { if (!t) return '—'; const d = new Date(t); return d.toLocaleDateString('en-GB') + ' ' + d.toLocaleTimeString('en-GB').slice(0, 5); };
  const ago = t => { if (!t) return 'لم يتصل بعد'; const s = Math.round((Date.now() - t) / 1000); if (s < 90) return 'الآن'; const m = Math.round(s / 60); if (m < 60) return 'قبل ' + m + ' دقيقة'; const h = Math.round(m / 60); if (h < 36) return 'قبل ' + h + ' ساعة'; return 'قبل ' + Math.round(h / 24) + ' يوم'; };
  const mb = b => b > 1048576 ? (b / 1048576).toFixed(1) + ' ميغابايت' : b > 1024 ? Math.round(b / 1024) + ' كيلوبايت' : (b || 0) + ' بايت';
  const fl = (m, bad) => { if (window.flash) window.flash(m, bad); };
  const css = document.createElement('style');
  css.textContent = `.adm-t{width:100%;border-collapse:collapse;font-size:14px;margin:8px 0}.adm-t th,.adm-t td{border-bottom:1px solid var(--line,#ddd);padding:6px 8px;text-align:start;vertical-align:top}.adm-t th{background:rgba(31,107,58,.08)}
  .adm-ok{color:#1f6b3a;font-weight:700}.adm-warn{color:#a15c00;font-weight:700}.adm-bad{color:#b42318;font-weight:700}.adm-box{border:1px dashed #9ab;border-radius:8px;padding:8px 10px;margin:8px 0;line-height:1.8}
  #xbBanner{position:fixed;z-index:50;left:50%;transform:translateX(-50%);top:62px;background:#fdecea;color:#7a1f1f;border:1.5px solid #b42318;border-radius:10px;padding:8px 14px;font-weight:700;box-shadow:0 6px 18px rgba(0,0,0,.15);display:flex;gap:10px;align-items:center;max-width:92vw}
  #xbBanner button{font:inherit;font-weight:700;border-radius:8px;border:1px solid #b42318;background:#fff;color:#b42318;padding:4px 10px;cursor:pointer}`;
  document.head.appendChild(css);
  const mkOv = (id, html) => { let o = $(id); if (!o) { o = document.createElement('div'); o.className = 'ov'; o.id = id; o.hidden = true; document.body.appendChild(o); } o.innerHTML = html; return o; };
  const open = id => { if (typeof openOv === 'function') openOv(id); else $(id).hidden = false; };
  const close = id => { if (typeof closeOv === 'function') closeOv(id); else $(id).hidden = true; };
  document.addEventListener('keydown', e => { if (e.key === 'Escape') for (const id of ['xbOv', 'pzOv']) if ($(id) && !$(id).hidden) { close(id); break; } });

  /* ---------- النسخ الاحتياطي الخارجي ---------- */
  function xbHtml(st) {
    const status = !st.dest ? '<span class="adm-warn">⚠ لم يُضبط بعد — اختر فلاشة أو قرصاً ثانياً أو مجلد شبكة</span>'
      : st.running ? '<span class="adm-warn">⏳ النسخ جارٍ الآن…</span>'
      : st.lastErr ? `<span class="adm-bad">✗ آخر محاولة فشلت: ${esc(st.lastErr)}</span>`
      : st.stale ? `<span class="adm-bad">⚠ لم تُعمل نسخة منذ ${st.ageDays == null ? 'البداية' : st.ageDays + ' يوم'}</span>`
      : `<span class="adm-ok">✔ آخر نسخة ناجحة: ${tm(st.lastOk)} (${ago(st.lastOk)})</span>`;
    return `<div class="dlg" style="width:min(620px,100%)"><h3>💾 النسخ الاحتياطي الخارجي</h3>
      <p>يحفظ البرنامج <b>كل يوم</b> نسخة من مجلد البيانات كله (كل الأنظمة والأرشيف ومرفقاته) في مكان خارج الحاسبة: فلاشة، أو قرص ثانٍ، أو مجلد على حاسبة أخرى في الشبكة. إن تعطلت الحاسبة يبقى عمل القسم محفوظاً. يُنسخ الجديد والمعدّل فقط، فالنسخة اليومية سريعة، ويعمل في الخلفية دون أن يبطئ العمل.</p>
      <label class="ml">مكان النسخة<div style="display:flex;gap:6px"><input id="xbDest" value="${esc(st.dest)}" readonly style="direction:ltr;flex:1" placeholder="لم يُختر"><button class="btn" id="xbPick" type="button">📂 اختيار…</button></div></label>
      <label class="ml">الاحتفاظ بالنسخ اليومية (أيام)<input id="xbKeep" inputmode="numeric" value="${esc(st.keepDays)}" style="width:90px;text-align:center"></label>
      <div class="adm-box">${status}${st.dest && st.lastOk ? `<br><small>عدد الملفات: ${st.files} — نُسخ في آخر مرة: ${st.copied} ملف (${mb(st.bytes)})</small>` : ''}${st.folder ? `<br><small style="direction:ltr;display:inline-block">${esc(st.folder)}</small>` : ''}</div>
      <p class="hint">المجلد: «نسخة-نظام-الشؤون-الهندسية» ← اسم هذه الحاسبة ← «الأحدث» (صورة كاملة لمجلد البيانات) و«يومي» (ملفات البيانات لكل يوم). للاسترجاع: انسخ محتوى «الأحدث» إلى مجلد البيانات، أو استوردها من «📥 استيراد ملفات JSON». إن لم تُعمل النسخة يومين يظهر تنبيه أحمر أعلى البرنامج.</p>
      <div class="row"><button class="btn" id="xbNo">إغلاق</button>${st.dest ? '<button class="btn" id="xbOpen">📁 فتح مجلد النسخة</button>' : ''}<button class="btn pri" id="xbRun"${st.dest ? '' : ' disabled'}>💾 نسخ الآن</button></div></div>`;
  }
  function xbShow() {
    const o = mkOv('xbOv', xbHtml(D.xbGet())); open('xbOv');
    o.onclick = async e => {
      const b = e.target.closest('button'); if (e.target === o) return close('xbOv'); if (!b) return;
      if (b.id === 'xbNo') return close('xbOv');
      if (b.id === 'xbPick') { const d = await D.xbPick(); if (d) { await D.xbSet({ dest: d, keepDays: +$('xbKeep').value || 30 }); o.innerHTML = xbHtml(D.xbGet()); fl('اختير مكان النسخة الاحتياطية — اضغط «نسخ الآن» للنسخة الأولى'); } return; }
      if (b.id === 'xbOpen') return D.xbOpen();
      if (b.id === 'xbRun') { await D.xbSet({ keepDays: +$('xbKeep').value || 30 }); b.disabled = true; o.innerHTML = xbHtml(Object.assign(D.xbGet(), { running: true }));
        const r = await D.xbRun(); o.innerHTML = xbHtml(D.xbGet()); fl(r && r.ok ? `✔ تمت النسخة الاحتياطية: ${r.copied} ملف جديد أو معدّل من ${r.files}` : '✗ ' + ((r && r.msg) || 'تعذّرت النسخة'), !(r && r.ok)); banner(D.xbGet()); }
    };
    o.onchange = e => { if (e.target.id === 'xbKeep') D.xbSet({ keepDays: +e.target.value || 30 }); };
  }
  /* تنبيه أعلى البرنامج: لم تُعمل النسخة منذ يومين، أو لم يُضبط النسخ على حاسبة القسم أو الحاسبة المستقلة */
  let bannerOff = 0;
  function banner(st) {
    let msg = '';
    if (st.quiet) { const b0 = $('xbBanner'); if (b0) b0.remove(); return; }   // تشغيل الاختبارات الآلية
    if (st.dest && st.stale && !st.running) msg = `⚠ لم تُعمل النسخة الاحتياطية الخارجية منذ ${st.ageDays == null ? 'ضبطها' : st.ageDays + ' يوم'}${st.lastErr ? ' — ' + st.lastErr : ''}`;
    else if (!st.dest) { let mode = ''; try { mode = ((D.syncGet && D.syncGet()) || {}).mode || 'off'; } catch (_) {} if (mode !== 'client') msg = '⚠ النسخ الاحتياطي الخارجي غير مضبوط — عمل القسم على هذه الحاسبة وحدها'; }
    let b = $('xbBanner');
    if (!msg || Date.now() < bannerOff) { if (b) b.remove(); return; }
    if (!b) { b = document.createElement('div'); b.id = 'xbBanner'; document.body.appendChild(b); }
    b.innerHTML = `<span>${esc(msg)}</span><button data-xb="set">${st.dest ? 'نسخ الآن' : 'ضبط النسخ'}</button><button data-xb="later" title="إخفاء ساعة">لاحقاً</button>`;
    b.onclick = async e => { const k = e.target.dataset && e.target.dataset.xb; if (!k) return; if (k === 'later') { bannerOff = Date.now() + 3600000; b.remove(); return; }
      if (st.dest) { b.remove(); const r = await D.xbRun(); fl(r && r.ok ? '✔ تمت النسخة الاحتياطية' : '✗ ' + ((r && r.msg) || 'تعذّرت النسخة'), !(r && r.ok)); banner(D.xbGet()); } else xbShow(); };
  }
  D.onXb(st => { banner(st); if ($('xbOv') && !$('xbOv').hidden && !st.running) $('xbOv').innerHTML = xbHtml(st); });
  setTimeout(() => banner(D.xbGet()), 4000); setInterval(() => banner(D.xbGet()), 600000);

  /* ---------- حالة الحاسبات المتصلة ---------- */
  function pzHtml() {
    const P = D.syncPeers() || { self: {}, list: [] }, me = P.self || {}, L = P.list || [];
    const cmp = v => String(v || '').split('.').map(n => +n || 0), newer = (a, b) => { const x = cmp(a), y = cmp(b); for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); return false; };
    const st = t => !t ? '<span class="adm-bad">●</span> لم يتصل' : Date.now() - t < 3 * 60000 ? '<span class="adm-ok">●</span> متصلة الآن' : Date.now() - t < 24 * 3600000 ? '<span class="adm-warn">●</span> اتصلت اليوم' : '<span class="adm-bad">●</span> منقطعة';
    const verCell = v => !v ? '<span class="adm-warn">قديم (قبل 1.53.0)</span>' : v === me.ver ? `<span class="adm-ok">${esc(v)}</span>` : newer(me.ver, v) ? `<span class="adm-bad">${esc(v)} — أقدم، حدّثها</span>` : `<span class="adm-warn">${esc(v)} — أحدث من هذه الحاسبة</span>`;
    const modeT = { server: '🏢 حاسبة القسم (الخادم)', client: '💻 حاسبة لجنة', off: 'المزامنة معطّلة (مستقلة)' }[me.mode] || '—';
    let body = '';
    if (me.mode === 'server') {
      body = L.length ? `<table class="adm-t"><thead><tr><th>الحاسبة</th><th>العنوان</th><th>الإصدار</th><th>آخر اتصال</th><th>الحالة</th></tr></thead><tbody>${L.map(p => `<tr><td><b>${esc(p.name || '(بلا اسم)')}</b></td><td style="direction:ltr;text-align:right">${esc(p.ip || '')}</td><td>${verCell(p.ver)}</td><td>${tm(p.last)}<br><small>${ago(p.last)}</small></td><td>${st(p.last)}</td></tr>`).join('')}</tbody></table>`
        : '<div class="adm-box">لم تتصل بهذه الحاسبة أي حاسبة لجنة بعد. تظهر هنا كل حاسبة بعد أول مزامنة لها.</div>';
      const old = L.filter(p => !p.ver || newer(me.ver, p.ver)).length, off = L.filter(p => !p.last || Date.now() - p.last > 24 * 3600000).length;
      body += `<div class="adm-box" id="pzOffer">🔄 التحديث عبر الشبكة: …</div>`;
      body += `<div class="adm-box">${L.length} حاسبة لجنة — ${old ? `<span class="adm-bad">${old} على إصدار أقدم</span>` : '<span class="adm-ok">كلها على هذا الإصدار أو أحدث</span>'} — ${off ? `<span class="adm-bad">${off} منقطعة منذ أكثر من يوم</span>` : '<span class="adm-ok">لا حاسبة منقطعة</span>'}</div>`;
    } else if (me.mode === 'client') {
      body = `<div class="adm-box">هذه حاسبة لجنة. حالة كل الحاسبات تُرى على <b>حاسبة القسم</b>.<br>
        آخر مزامنة ناجحة: <b>${tm(me.last)}</b> (${ago(me.last)}) — ${me.ok ? '<span class="adm-ok">متصلة</span>' : `<span class="adm-bad">غير متصلة${me.error ? ': ' + esc(me.error) : ''}</span>`}<br>
        حاسبة القسم: <b>${esc(me.serverName || '—')}</b> — إصدارها: ${me.serverVer ? (me.serverVer === me.ver ? `<span class="adm-ok">${esc(me.serverVer)} (مثل هذه الحاسبة)</span>` : `<span class="adm-bad">${esc(me.serverVer)} — يختلف عن هذه الحاسبة (${esc(me.ver)})</span>`) : '<span class="adm-warn">قديم (قبل 1.53.0) أو لم يُعرف بعد</span>'}</div>`;
    } else body = '<div class="adm-box">المزامنة معطّلة على هذه الحاسبة. اضبطها من 🔄 لتظهر الحاسبات المتصلة.</div>';
    return `<div class="dlg" style="width:min(760px,100%)"><h3>🖥 حالة الحاسبات المتصلة</h3>
      <p>هذه الحاسبة: <b>${esc(me.name || '')}</b> — ${modeT} — الإصدار <b>${esc(me.ver || '')}</b></p>${body}
      <p class="hint">● أخضر: اتصلت خلال 3 دقائق — ● برتقالي: اتصلت اليوم — ● أحمر: منقطعة منذ أكثر من يوم. يُستحسن أن تكون كل الحاسبات على الإصدار نفسه.</p>
      <div class="row"><button class="btn" id="pzNo">إغلاق</button><button class="btn pri" id="pzRe">↻ تحديث</button></div></div>`;
  }
  let pzT = null;
  async function pzOffer() { const el = $('pzOffer'); if (!el || !D.updOffer) return; const o = await D.updOffer();
    el.innerHTML = o ? `🔄 <b>التحديث عبر الشبكة:</b> هذه الحاسبة تعرض الإصدار <b>${esc(o.ver)}</b> (${mb(o.size)}) على حاسبات اللجان؛ كل حاسبة أقدم يظهر فيها «يتوفر تحديث» بعد مزامنتها.` : '🔄 <b>التحديث عبر الشبكة:</b> غير متاح في هذا التشغيل (يعمل حين يُشغَّل البرنامج من ملفه المستقل .exe).'; }
  function pzShow() { const o = mkOv('pzOv', pzHtml()); open('pzOv'); pzOffer(); clearInterval(pzT); pzT = setInterval(() => { if (o.hidden) return clearInterval(pzT); o.innerHTML = pzHtml(); pzOffer(); }, 20000);
    o.onclick = e => { const b = e.target.closest('button'); if (e.target === o || (b && b.id === 'pzNo')) { clearInterval(pzT); return close('pzOv'); } if (b && b.id === 'pzRe') { o.innerHTML = pzHtml(); pzOffer(); } }; }
  /* ---------- التحديث من حاسبة القسم (حاسبة لجنة) ---------- */
  function updBar(st) {
    let b = $('updBar');
    const show = st && (st.avail || st.phase || st.error);
    if (!show) { if (b) b.remove(); return; }
    if (!b) { b = document.createElement('div'); b.id = 'updBar'; b.style.cssText = 'position:fixed;z-index:51;left:50%;transform:translateX(-50%);bottom:34px;background:#e8f3ec;color:#14532d;border:1.5px solid #1f6b3a;border-radius:10px;padding:8px 14px;font-weight:700;box-shadow:0 6px 18px rgba(0,0,0,.15);display:flex;gap:10px;align-items:center;max-width:92vw'; document.body.appendChild(b); }
    const pct = st.size ? Math.min(100, Math.round(st.got / st.size * 100)) : 0, v = st.avail ? st.avail.ver : (st.ready && st.ready.ver) || '';
    const btn = 'font:inherit;font-weight:700;border-radius:8px;border:1px solid #1f6b3a;background:#fff;color:#1f6b3a;padding:4px 10px;cursor:pointer';
    b.innerHTML = st.phase === 'download' ? `<span>⏳ تنزيل الإصدار ${esc(v)} من حاسبة القسم… ${pct}%</span>`
      : st.phase === 'ready' ? `<span>✔ نُزّل الإصدار ${esc(v)} وتُحقق من سلامته. يُغلق البرنامج ويُفتح بالإصدار الجديد خلال ثوانٍ — البيانات لا تتغير.</span><button data-upd="apply" style="${btn};background:#1f6b3a;color:#fff">إعادة التشغيل الآن</button><button data-upd="later" style="${btn}">لاحقاً</button>`
      : st.error && !st.avail ? `<span style="color:#b42318">✗ ${esc(st.error)}</span><button data-upd="hide" style="${btn}">إخفاء</button>`
      : `<span>🔔 يتوفر الإصدار ${esc(v)} من حاسبة القسم (هذه الحاسبة ${esc(st.cur)})${st.error ? ' — <span style="color:#b42318">' + esc(st.error) + '</span>' : ''}</span><button data-upd="fetch" style="${btn};background:#1f6b3a;color:#fff">تحديث الآن</button><button data-upd="hide" style="${btn}">لاحقاً</button>`;
    b.onclick = async e => { const k = e.target.dataset && e.target.dataset.upd; if (!k) return;
      if (k === 'hide' || k === 'later') { b.remove(); return; }
      if (k === 'fetch') { const r = await D.updFetch(); if (!r.ok) fl('✗ ' + r.msg, true); return; }
      if (k === 'apply') { const r = await D.updApply(); if (r && r.dry) fl('تشغيل تجريبي: سكربت الاستبدال جاهز'); else if (!(r && r.ok)) fl('✗ ' + ((r && r.msg) || 'تعذّر التحديث'), true); }
    };
  }
  if (D.onUpd) { D.onUpd(updBar); setTimeout(() => updBar(D.updGet()), 6000); }
  if (D.onCmd) D.onCmd(c => { if (c === 'xbackup') xbShow(); else if (c === 'peers') pzShow(); });
  window.AnbarAdmin = { xbShow, pzShow, banner: () => banner(D.xbGet()), updBar: () => updBar(D.updGet()) };
})();
