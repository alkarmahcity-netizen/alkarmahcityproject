/* global openOv, closeOv */
/* «🔍 مقارنة ملفين وإخراج ملف مصحَّح» (تبويب مشاريع التخطيط):
   الأول ملف التخطيط العام، والثاني ملف التخطيط المعدَّل. نافذة مراجعة: الحقول المختلفة (مع عددها، وتُختار للتصحيح)،
   جدول الفروقات، والمكوّنات «للتأكيد» و«في العام فقط» و«في المعدَّل فقط»؛ ثم ملف واحد + «تدقيق المقارنة».
   الملف الناتج (الافتراضي): الملف المعدَّل نفسه — تُملأ خلاياه الفارغة من الملف العام، والقيم المختلفة لا تُغيَّر إلا إن اختيرت.
   أو: الملف العام مصحَّحاً من المعدَّل (الطريقة السابقة). */
(function () {
  const D = window.desktop; if (!D || !D.plan || !D.plan.cmpOpen) return;
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fl = (m, bad) => { if (window.flash) window.flash(m, bad); };
  const css = document.createElement('style');
  css.textContent = `#cmpOv .dlg{width:min(1180px,100%);max-height:92vh;display:flex;flex-direction:column}#cmpOv .dlg>*{flex:none}#cmpOv .cw{overflow:auto;flex:1 1 auto;min-height:160px;border:1px solid var(--line,#ddd);border-radius:10px;margin:6px 0}
  #cmpOv table{width:100%;border-collapse:collapse;font-size:13px}#cmpOv th,#cmpOv td{border-bottom:1px solid var(--line,#e3e3e3);padding:4px 7px;text-align:start;vertical-align:top}#cmpOv th{position:sticky;top:0;background:#eef5f0;z-index:1}
  #cmpOv .cbar{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;margin:4px 0}#cmpOv .cbar label{display:flex;flex-direction:row;gap:5px;align-items:center;white-space:nowrap;margin:0}
  #cmpOv .sm{color:#667;font-size:12px}#cmpOv .ch{color:#1f6b3a;font-weight:700}#cmpOv .old{color:#9a3412}#cmpOv .tabs2 button{margin-inline-end:6px}#cmpOv .tabs2 button.on{background:#bfead6;font-weight:700}`;
  document.head.appendChild(css);
  /* حقول تُصحَّح افتراضياً: كل الحقول عدا هوية المكوّن (رقم العقد، الشركة) — فروقها تُذكر في ورقة التدقيق */
  const OFF = new Set(['contractNo', 'company']);
  let st = null;
  const ov = () => { let o = $('cmpOv'); if (!o) { o = document.createElement('div'); o.className = 'ov'; o.id = 'cmpOv'; o.hidden = true; document.body.appendChild(o); } return o; };
  const close = () => { if (typeof closeOv === 'function') closeOv('cmpOv'); else ov().hidden = true; };
  async function open() {
    fl('اختر الملف الأول (ملف التخطيط العام) ثم الثاني (الملف المعدَّل)… المقارنة تستغرق ثوانيَ للملفات الكبيرة');
    let P = []; try { P = (window.AnbarReg && AnbarReg.state().projects || []).map(p => ({ fileNo: p.fileNo, name: p.name, contractor: p.contractor, contractNo: p.contractNo, start: p.start, dur: p.dur, extra: p.extra, orig: p.orig, total: p.total, changeCost: p.changeCost, planPct: p.planPct, actualPct: p.actualPct, lat: p.lat, lng: p.lng })); } catch (_) {}
    const r = await D.plan.cmpOpen(P); if (!r) return; if (r.error) { fl(r.error, true); return; }
    st = r; st.r0 = r; st.on = {}; st.tab = 'diff'; st.ff = ''; st.base = 'mod'; st.fill = {}; st.dOn = {};
    (r.rdiffs || []).forEach(d => { if (!(d.field in st.fill)) { st.fill[d.field] = true; st.dOn[d.field] = false; } });
    /* الاختيار باسم الحقل (الحقل نفسه قد يكون بمفتاحين: «الفني» في ورقة الخطة و«الفعلي» في ورقة المنافذ) */
    r.diffs.forEach(d => { if (!(d.field in st.on)) st.on[d.field] = !OFF.has(d.key); });
    draw(); if (typeof openOv === 'function') openOv('cmpOv'); else ov().hidden = false;
  }
  function drawMod() {
    const r = st, rd = r.rdiffs || [], byF = {}; rd.forEach(d => { const b = byF[d.field] = byF[d.field] || { fill: 0, diff: 0 }; b[d.kind]++; });
    const nFill = rd.filter(d => d.kind === 'fill' && st.fill[d.field]).length, nDiff = rd.filter(d => d.kind === 'diff' && st.dOn[d.field]).length;
    const list = st.tab === 'diff' ? rd.filter(d => !st.ff || d.field === st.ff) : [];
    const act = d => d.kind === 'fill' ? (st.fill[d.field] ? '✔ تُملأ' : '<span class="sm">لا</span>') : (st.dOn[d.field] ? '✔ تُغيَّر' : '<span class="sm">تبقى — تُذكر في التدقيق</span>');
    const body = st.tab === 'diff' ? `<table><thead><tr><th>الصف في المعدَّل</th><th>المكوّن</th><th>الحقل</th><th>في الملف المعدَّل</th><th>في الملف العام</th><th>النوع</th><th>الإجراء</th></tr></thead><tbody>${list.slice(0, 600).map(d => `<tr><td>${d.row}</td><td>${esc(d.name)}</td><td>${esc(d.field)}</td><td class="old">${esc(d.old || '— فارغ')}</td><td class="ch">${esc(d.neu)}</td><td class="sm">${d.kind === 'fill' ? 'خلية فارغة' : 'قيمة مختلفة'}</td><td>${act(d)}</td></tr>`).join('') || '<tr><td colspan="7">لا شيء</td></tr>'}</tbody></table>${list.length > 600 ? `<p class="sm">يُعرض أول 600 من ${list.length} — كلها في ورقتي «التغييرات» و«تدقيق المقارنة» في الملف الناتج.</p>` : ''}` : tables();
    return `<div class="cbar"><b>المطابقة:</b><span>مطابَق <b>${r.matched}</b></span><span>للتأكيد <b>${r.unsure.length}</b></span><span>في العام فقط <b>${r.onlyGen.length}</b></span><span>في المعدَّل فقط <b>${r.onlyMod.length}</b></span><span>تُملأ <b id="cmpSel">${nFill}</b> خلية فارغة${nDiff ? ` + تُغيَّر <b>${nDiff}</b> قيمة` : ''}</span></div>
      <div class="cw" style="flex:none;max-height:190px"><table><thead><tr><th>الحقل</th><th>خلايا فارغة في المعدَّل (تُملأ من العام)</th><th>قيم مختلفة (تبقى قيمة المعدَّل افتراضياً)</th></tr></thead><tbody>${Object.entries(byF).map(([f, v]) => `<tr><td><a href="#" data-ff="${esc(f)}">${esc(f)}</a></td><td>${v.fill ? `<label><input type="checkbox" data-fl="${esc(f)}" ${st.fill[f] ? 'checked' : ''}> تُملأ (${v.fill})</label>` : '<span class="sm">—</span>'}</td><td>${v.diff ? `<label><input type="checkbox" data-dd="${esc(f)}" ${st.dOn[f] ? 'checked' : ''}> تُغيَّر إلى قيمة العام (${v.diff})</label>` : '<span class="sm">—</span>'}</td></tr>`).join('') || '<tr><td colspan="3">لا فروقات</td></tr>'}</tbody></table></div>
      <div class="cbar tabs2"><button class="btn${st.tab === 'diff' ? ' on' : ''}" data-tb="diff">التعبئة والفروقات${st.ff ? ' — ' + esc(st.ff) : ''}</button><button class="btn${st.tab === 'unsure' ? ' on' : ''}" data-tb="unsure">للتأكيد (${r.unsure.length})</button><button class="btn${st.tab === 'gen' ? ' on' : ''}" data-tb="gen">في العام فقط (${r.onlyGen.length})</button><button class="btn${st.tab === 'mod' ? ' on' : ''}" data-tb="mod">في المعدَّل فقط (${r.onlyMod.length})</button>${st.ff ? '<a href="#" data-ff="" class="sm">عرض كل الحقول</a>' : ''}<label style="margin-inline-start:auto"><input type="checkbox" id="cmpHi" ${st.hi === false ? '' : 'checked'}> تلوين الخلايا المعدَّلة</label></div>
      <div class="cw">${body}</div>
      <p class="sm" style="margin:2px 0">الملف الناتج هو <b>الملف المعدَّل نفسه</b> (أوراقه وأعمدته ومعادلاته كما هي). القيمة الموجودة فيه لا يُكتب فوقها إلا إذا اخترت «تُغيَّر» لذلك الحقل — لأن قيم الملف المعدَّل أحدث غالباً. الإحداثيات الموجودة لا تُغيَّر أبداً. كل قيمة مختلفة لم تُغيَّر تُذكر في ورقة «تدقيق المقارنة» مع قيمة الملف العام.</p>`;
  }
  function tables() {
    const r = st;
    return st.tab === 'unsure' ? `<table><thead><tr><th>في الملف العام</th><th>في الملف المعدَّل</th><th>السبب</th></tr></thead><tbody>${r.unsure.slice(0, 400).map(u => `<tr><td>${esc(u.c.name)}<div class="sm">${esc(u.c.company)} — ${esc(u.c.sheet)} / ${u.c.row}</div></td><td>${esc(u.r.name)}<div class="sm">${esc(u.r.company)} — صف ${u.r.row}</div></td><td>${esc(u.why)} (${u.s}%)</td></tr>`).join('')}</tbody></table>`
      : st.tab === 'gen' ? `<table><thead><tr><th>المكوّن</th><th>الشركة</th><th>الورقة / الصف</th></tr></thead><tbody>${r.onlyGen.slice(0, 600).map(c => `<tr><td>${esc(c.name)}</td><td>${esc(c.company)}</td><td>${esc(c.sheet)} / ${c.row}</td></tr>`).join('')}</tbody></table>`
      : `<table><thead><tr><th>المكوّن</th><th>الشركة</th><th>الصف في المعدَّل</th></tr></thead><tbody>${r.onlyMod.map(c => `<tr><td>${esc(c.name)}</td><td>${esc(c.company)}</td><td>${c.row}</td></tr>`).join('')}</tbody></table>`;
  }
  function draw() {
    const r = st, byKey = {}; r.diffs.forEach(d => { (byKey[d.field] = byKey[d.field] || { label: d.field, n: 0 }).n++; });
    const sel = r.diffs.filter(d => st.on[d.field]).length;
    const list = st.tab === 'diff' ? r.diffs.filter(d => !st.ff || d.field === st.ff) : [];
    const body = st.tab === 'diff' ? `<table><thead><tr><th>الورقة / الصف</th><th>المكوّن (في الملف العام)</th><th>الحقل</th><th>في الملف العام</th><th>القيمة الصحيحة</th><th>المصدر</th><th>يُصحَّح</th></tr></thead><tbody>${list.slice(0, 600).map(d => `<tr><td>${esc(d.sheet)}<div class="sm">صف ${d.row}</div></td><td>${esc(d.name)}</td><td>${esc(d.field)}</td><td class="old">${esc(d.old || '—')}</td><td class="ch">${esc(d.neu)}</td><td class="sm">${esc(d.src || 'الملف المعدَّل')}${d.fileNo ? ' — اضبارة ' + esc(d.fileNo) : ''}</td><td>${st.on[d.field] ? '✔' : '<span class="sm">لا</span>'}</td></tr>`).join('') || '<tr><td colspan="7">لا فروقات</td></tr>'}</tbody></table>${list.length > 600 ? `<p class="sm">يُعرض أول 600 من ${list.length} — كلها في ورقة «التغييرات» في الملف الناتج.</p>` : ''}`
      : tables();
    const baseBar = `<div class="cbar" style="background:#eef7f1;border-radius:10px;padding:6px 10px"><b>الملف الناتج:</b><label><input type="radio" name="cmpBase" value="mod" ${st.base === 'mod' ? 'checked' : ''}> <b>الملف المعدَّل</b> — نفس ملف «${esc(r.modFile)}» تُملأ خلاياه الفارغة من العام</label><label><input type="radio" name="cmpBase" value="gen" ${st.base === 'gen' ? 'checked' : ''}> الملف العام «${esc(r.genFile)}» مصحَّحاً من المعدَّل</label></div>`;
    if (st.base === 'mod') {
      ov().innerHTML = `<div class="dlg"><h3>🔍 مقارنة ملف التخطيط العام بالملف المعدَّل</h3>
      <p class="sm" style="margin:0">الأول (العام): <b>${esc(r.genFile)}</b> — ${r.comps} مكوّناً. الثاني (المعدَّل): <b>${esc(r.modFile)}</b> — ورقة «${esc(r.modSheet)}»، ${r.modRows} صف مكوّن.</p>
      ${baseBar}${drawMod()}
      <div class="cbar"><button class="btn pri" id="cmpGo">💾 إخراج الملف المعدَّل المحدَّث</button><button class="btn" id="cmpX">إغلاق</button></div></div>`;
      return;
    }
    ov().innerHTML = `<div class="dlg"><h3>🔍 مقارنة ملف التخطيط العام بالملف المعدَّل</h3>
      <p class="sm" style="margin:0">الأول (العام): <b>${esc(r.genFile)}</b> — ${r.comps} مكوّناً (منها ${r.s2} في «منافذ حدودية + إعادة استقرار»). الثاني (المعدَّل): <b>${esc(r.modFile)}</b> — ورقة «${esc(r.modSheet)}»، ${r.modRows} صف مكوّن.
      الناتج <b>ملف واحد</b>: نسخة من الملف العام (أوراقه ومعادلاته وتنسيقه كما هي) تُصحَّح فيها الحقول المختارة من المعدَّل، مع ورقة «التغييرات» وورقة «تدقيق المقارنة». لا تُكتب قيمة فارغة، ولا تُغيَّر خلية فيها معادلة، والمشكوك في مطابقته لا يُصحَّح. <b>المكوّن الذي لا يقابله صف في المعدَّل</b> (ومنه مكوّنات إعادة الاستقرار والمنافذ) يُطابَق ويُصحَّح من <b>الموقف العام</b> (${r.statusN} مشروعاً)${r.statusN ? '' : ' — <span style="color:#b42318">الموقف العام فارغ: استورده لتشمل المطابقة هذه المكوّنات</span>'}.</p>
      ${baseBar}
      <div class="cbar"><b>المطابقة:</b><span>مطابَق <b>${r.matched}</b>${r.fromStatus ? ` (منها <b>${r.fromStatus}</b> بالموقف العام)` : ''}</span><span>للتأكيد <b>${r.unsure.length}</b></span><span>في العام فقط <b>${r.onlyGen.length}</b></span><span>في المعدَّل فقط <b>${r.onlyMod.length}</b></span><span>فروقات <b>${r.diffs.length}</b> (يُصحَّح <b id="cmpSel">${sel}</b>)</span></div>
      <div class="cbar"><b>الحقول المصحَّحة:</b>${Object.entries(byKey).map(([k, v]) => `<label title="عرض فروقات هذا الحقل فقط بالضغط على العدد"><input type="checkbox" data-ck="${esc(k)}" ${st.on[k] ? 'checked' : ''}> ${esc(v.label)} <a href="#" data-ff="${esc(k)}" class="sm">(${v.n})</a></label>`).join('')}<label><input type="checkbox" id="cmpHi" ${st.hi === false ? '' : 'checked'}> تلوين الخلايا المصحَّحة</label></div>
      <div class="cbar tabs2"><button class="btn${st.tab === 'diff' ? ' on' : ''}" data-tb="diff">الفروقات${st.ff ? ' — ' + esc((byKey[st.ff] || {}).label || '') : ''}</button><button class="btn${st.tab === 'unsure' ? ' on' : ''}" data-tb="unsure">للتأكيد (${r.unsure.length})</button><button class="btn${st.tab === 'gen' ? ' on' : ''}" data-tb="gen">في العام فقط (${r.onlyGen.length})</button><button class="btn${st.tab === 'mod' ? ' on' : ''}" data-tb="mod">في المعدَّل فقط (${r.onlyMod.length})</button>${st.ff ? '<a href="#" data-ff="" class="sm">عرض كل الحقول</a>' : ''}</div>
      <div class="cw">${body}</div>
      <p class="sm" style="margin:2px 0">رقم العقد واسم الشركة غير مختارين افتراضياً (هوية المكوّن): فروقهما تُذكر في «تدقيق المقارنة» — اخترهما إن أردت تصحيحهما.</p>
      <div class="cbar"><button class="btn pri" id="cmpGo">💾 إخراج الملف المصحَّح</button><button class="btn" id="cmpX">إغلاق</button></div></div>`;
  }
  document.addEventListener('change', e => {
    if (!st || !e.target.closest('#cmpOv')) return; const t = e.target;
    if (t.name === 'cmpBase') { st.base = t.value; st.tab = 'diff'; st.ff = ''; draw(); }
    else if (t.dataset.fl != null) { st.fill[t.dataset.fl] = t.checked; draw(); }
    else if (t.dataset.dd != null) { st.dOn[t.dataset.dd] = t.checked; draw(); }
    else if (t.dataset.ck != null) { st.on[t.dataset.ck] = t.checked; draw(); }
    else if (t.id === 'cmpHi') st.hi = t.checked;
  });
  document.addEventListener('click', async e => {
    if (e.target.closest('#plCmp')) { open(); return; }
    if (!st || !e.target.closest('#cmpOv')) return;
    const ff = e.target.closest('[data-ff]'); if (ff) { e.preventDefault(); st.ff = ff.dataset.ff; st.tab = 'diff'; draw(); return; }
    const tb = e.target.closest('[data-tb]'); if (tb) { st.tab = tb.dataset.tb; draw(); return; }
    if (e.target.closest('#cmpX')) { close(); return; }
    if (e.target.closest('#cmpGo')) {
      const mod = st.base === 'mod', rd = st.r0.rdiffs || [], b = $('cmpGo'), lbl = b.textContent;
      const keys = mod ? [...new Set(rd.filter(d => d.kind === 'fill' && st.fill[d.field]).map(d => d.key))] : [...new Set(st.r0.diffs.filter(d => st.on[d.field]).map(d => d.key))];
      const diffKeys = mod ? [...new Set(rd.filter(d => d.kind === 'diff' && st.dOn[d.field]).map(d => d.key))] : [];
      b.disabled = true; b.textContent = '⏳ جارٍ الإخراج…';
      const r = await D.plan.cmpSave({ base: mod ? 'mod' : 'gen', keys, diffKeys, highlight: st.hi !== false }); b.disabled = false; b.textContent = lbl;
      if (!r) return; if (r.error) { fl(r.error, true); return; }
      close(); fl(`✔ حُفظ الملف المصحَّح: ${r.cells} خلية صُحّحت، و${r.audit} سطراً في «تدقيق المقارنة» — ${r.file}`);
    }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('cmpOv') && !$('cmpOv').hidden) close(); });
  window.PlanCmp = { open };
})();
