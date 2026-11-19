/* global openOv, closeOv, AnbarReg */
/* «📊 نسب الإنجاز في ملف التخطيط» (الموقف العام): ملف تخصيصات المحافظة / مشاريع التخطيط.
   «نسبة الإنجاز الفني» في الملف = الفعلي عندنا، و«نسبة الإنجاز المخطط» = المخطط في الموقف.
   مراجعة قبل الحفظ: المطابق بالاسم والشركة محدَّد للتحديث، والمشكوك فيه غير محدَّد حتى يؤكَّد؛ ويُحفظ نسخة جديدة (الأصل لا يُمس). */
(function () {
  const D = window.desktop; if (!D || !D.ppOpen) return;
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fl = (m, bad) => { if (window.flash) window.flash(m, bad); };
  const money = v => v == null ? '—' : Math.round(v).toLocaleString('en-US');
  /* يحتاج تحديثاً بحسب ما اختير: النسب و/أو المبالغ */
  const chOf = x => (st.doPct !== false && (x.chAct || x.chPlan)) || (st.doAmt !== false && (x.chTot || x.chCo || x.chOrig || (x.more && x.more.length > 0)));
  const pc = v => v == null ? '—' : (Math.round(v * 100) / 100) + '%';
  const css = document.createElement('style');
  css.textContent = `#ppOv .dlg{width:min(1180px,100%);max-height:92vh;display:flex;flex-direction:column}#ppOv .dlg>*{flex:none}#ppOv .ppw{overflow:auto;flex:1 1 auto;min-height:140px;border:1px solid var(--line,#ddd);border-radius:8px;margin:6px 0}
  #ppOv table{width:100%;border-collapse:collapse;font-size:13.5px}#ppOv th,#ppOv td{border-bottom:1px solid var(--line,#e3e3e3);padding:5px 7px;text-align:start;vertical-align:top}#ppOv th{position:sticky;top:0;background:#eef5f0;z-index:1}
  #ppOv .ch{color:#1f6b3a;font-weight:700}#ppOv .q{background:#fff8e6}#ppOv .why{color:#a15c00;font-weight:700}#ppOv .bad{color:#b42318;font-weight:700;font-size:12.5px;margin-top:3px}#ppOv .sm{color:#667;font-size:12px}#ppOv .ppbar{display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin:4px 0}
  #ppOv .ppbar label{display:flex;flex-direction:row;gap:5px;align-items:center;white-space:nowrap;margin:0}#ppOv .same{opacity:.55}`;
  document.head.appendChild(css);
  let st = null;
  const ov = () => { let o = $('ppOv'); if (!o) { o = document.createElement('div'); o.className = 'ov'; o.id = 'ppOv'; o.hidden = true; document.body.appendChild(o); } return o; };
  const close = () => { if (typeof closeOv === 'function') closeOv('ppOv'); else ov().hidden = true; };
  const projects = () => { try { return (AnbarReg.state().projects || []).map(p => ({ fileNo: p.fileNo, name: p.name, contractor: p.contractor, actualPct: p.actualPct, planPct: p.planPct, orig: p.orig, changeCost: p.changeCost, total: p.total, contractNo: p.contractNo, start: p.start, lat: p.lat, lng: p.lng, dur: p.dur, extra: p.extra, totalDays: p.totalDays })); } catch (_) { return []; } };

  async function open() {
    const P = projects(); if (!P.length) { fl('لا توجد مشاريع في الموقف العام — استورد الموقف أولاً', true); return; }
    fl('اختر ملف التخطيط… (القراءة تستغرق ثوانيَ للملف الكبير)');
    const r = await D.ppOpen(P); if (!r) return; if (r.error) { fl(r.error, true); return; }
    st = r; st.on = {}; st.sheetOn = {}; r.sheets.forEach(s => { st.sheetOn[s.name] = !s.old; });
    r.items.forEach((x, i) => { x.i = i; st.on[i] = x.sure && !!x.ch; });
    draw(); if (typeof openOv === 'function') openOv('ppOv'); else ov().hidden = false;
  }
  function draw() {
    const r = st, show = r.items.filter(x => st.sheetOn[x.sheet]);
    const ch = show.filter(chOf), same = show.filter(x => !chOf(x));
    const sel = ch.filter(x => st.on[x.i]).length, q = ch.filter(x => !x.sure).length;
    const cell = (o, n, c, f, z) => f ? `<span class="sm">${pc(o)} (معادلة — لا تُغيَّر)</span>` : z ? `${pc(o)} <span class="why">الموقف 0 — لا يُكتب</span>` : c ? `${pc(o)} ← <span class="ch">${pc(n)}</span>` : `<span class="sm">${pc(o)}</span>`;
    const amt = x => { const L = []; if (x.chTot) L.push(`بعد التغيير: ${money(x.oldTot)} ← <span class="ch">${money(x.newTot)}</span>`); if (x.chCo) L.push(`مجموع الأوامر: ${money(x.oldCo)} ← <span class="ch">${money(x.newCo)}</span>`); if (x.chOrig) L.push(`مبلغ العقد: ${money(x.oldOrig)} ← <span class="ch">${money(x.newOrig)}</span>`);
      (x.more || []).forEach(m => L.push(`${esc(m.label)}: ${esc(m.old || '—')} ← <span class="ch">${esc(m.show)}</span>${m.newCol ? ' <span class="sm">(عمود جديد)</span>' : ''}`));
      return (L.length ? L.join('<br>') : '<span class="sm">مطابقة</span>') + (x.flags && x.flags.length ? `<div class="bad">${x.flags.map(esc).join('<br>')}</div>` : ''); };
    const row = x => `<tr class="${x.sure ? '' : 'q'}${chOf(x) ? '' : ' same'}"><td>${chOf(x) ? `<input type="checkbox" data-pp="${x.i}" ${st.on[x.i] ? 'checked' : ''}>` : ''}</td>
      <td>${esc(x.sheet)}<div class="sm">صف ${x.row}</div></td><td><b>${esc(x.fileNo)}</b></td>
      <td>${esc(x.rname)}<div class="sm">${esc(x.rco || '—')}</div></td><td>${esc(x.pname)}<div class="sm">${esc(x.pco || '—')}</div></td>
      <td>${cell(x.oldAct, x.newAct, x.chAct, x.fAct, x.z0Act)}</td><td>${cell(x.oldPlan, x.newPlan, x.chPlan, x.fPlan, x.z0Plan)}</td><td>${amt(x)}</td>
      <td>${x.sure ? (x.link ? '<span class="sm">ربط محفوظ</span>' : x.via ? '✔ ' + esc(x.via) : '✔ الاسم' + (x.coOk ? ' والشركة' : '')) : `<span class="why">⚠ ${esc(x.why)} (${x.score}%) — حدّده إن كان المشروع نفسه</span>`}</td></tr>`;
    ov().innerHTML = `<div class="dlg"><h3>📊 نسب الإنجاز والمبالغ في ملف التخطيط — ${esc(r.file)}</h3>
      <p class="sm" style="margin:0">مطابقة <b>المكوّن</b> مع الموقف العام: مبلغ العقد، مبلغ أوامر التغيير، الكلفة الكلية بعد الأوامر، تاريخ المباشرة، نسبة الإنجاز المخطط، الفعلي («الفني»)، الإحداثيات، مدة العقد، المدد الإضافية، المدة الكلية — والحقل الذي لا عمود له يُضاف <b>عموداً جديداً</b> في آخر الورقة. صفوف المشاريع التخطيطية (بلا شركة ولا رقم عقد) لا تُمس. اختلاف مبلغ العقد أو رقمه بالأحمر، والمشروع للتأكيد. يُحفظ <b>نسخة جديدة</b> (الأصل والأوراق الأخرى والمعادلات كما هي)، مع ورقة «التغييرات».</p>
      <div class="ppbar"><b>الأوراق:</b>${r.sheets.map(s => `<label title="العمودان ${s.letters.act} (الفني) و${s.letters.plan} (المخطط)"><input type="checkbox" data-pps="${esc(s.name)}" ${st.sheetOn[s.name] ? 'checked' : ''}> ${esc(s.name)} <span class="sm">(${s.rows} صفاً — ${s.letters.act}/${s.letters.plan}${s.letters.tot ? '، ' + s.letters.tot : ''}${s.letters.coSum ? '، ' + s.letters.coSum : ''}${s.old ? ' — سنة سابقة' : ''})</span></label>`).join('')}</div>
      <div class="ppbar"><b>التحديث:</b><label><input type="checkbox" id="ppDoPct" ${st.doPct === false ? '' : 'checked'}> نسب الإنجاز (الفعلي والمخطط)</label><label><input type="checkbox" id="ppDoAmt" ${st.doAmt === false ? '' : 'checked'}> بقية بيانات المكوّن (مبلغ العقد، أوامر التغيير، الكلفة الكلية، تاريخ المباشرة، الإحداثيات، المدد)</label></div>
      <div class="ppbar"><span>مرتبط بالموقف: <b>${show.length}</b> — يحتاج تحديثاً: <b>${ch.length}</b> (محدَّد <b id="ppSel">${sel}</b>)${q ? ` — <span class="why">للتأكيد: ${q}</span>` : ''} — مطابق أصلاً: ${same.length}</span>
        <label><input type="checkbox" id="ppHi" ${st.hi === false ? '' : 'checked'}> تلوين الخلايا المحدَّثة بالأصفر</label><button type="button" class="btn" data-ppall="1">تحديد الكل</button><button type="button" class="btn" data-ppall="0">إلغاء التحديد</button></div>
      <div class="ppw"><table><thead><tr><th></th><th>الورقة</th><th>الاضبارة</th><th>في ملف التخطيط (الشركة)</th><th>في الموقف (الشركة)</th><th>الفعلي (الفني)</th><th>المخطط</th><th>المبالغ وبقية البيانات (من الموقف)</th><th>الربط</th></tr></thead>
      <tbody>${ch.map(row).join('') || '<tr><td colspan="9">لا شيء يحتاج تحديثاً في الأوراق المحددة</td></tr>'}${same.map(row).join('')}</tbody></table></div>
      <p class="sm" style="margin:2px 0">المشاريع غير الموجودة في ملف التخطيط لا تظهر هنا. المشروع الذي تؤكّده يُحفظ ربطه فيُعرف تلقائياً في المرة القادمة.</p>
      <div class="ppbar"><button type="button" class="btn pri" id="ppGo">💾 حفظ نسخة محدَّثة</button><button type="button" class="btn" id="ppX">إغلاق</button></div></div>`;
  }
  document.addEventListener('change', e => {
    if (!st || !e.target.closest('#ppOv')) return; const t = e.target;
    if (t.dataset.pp != null) { st.on[+t.dataset.pp] = t.checked; const n = st.items.filter(x => st.sheetOn[x.sheet] && chOf(x) && st.on[x.i]).length; $('ppSel').textContent = n; }
    else if (t.dataset.pps != null) { st.sheetOn[t.dataset.pps] = t.checked; draw(); }
    else if (t.id === 'ppHi') st.hi = t.checked;
    else if (t.id === 'ppDoPct' || t.id === 'ppDoAmt') { st[t.id === 'ppDoPct' ? 'doPct' : 'doAmt'] = t.checked; draw(); }
  });
  document.addEventListener('click', async e => {
    if (e.target.closest('#bPlanPct')) { open(); return; }
    if (!st || !e.target.closest('#ppOv')) return;
    const a = e.target.closest('[data-ppall]'); if (a) { st.items.forEach(x => { if (chOf(x)) st.on[x.i] = a.dataset.ppall === '1' && x.sure; }); draw(); return; }
    if (e.target.closest('#ppX')) { close(); return; }
    if (e.target.closest('#ppGo')) {
      const P = st.doPct !== false, A = st.doAmt !== false;
      const ups = st.items.filter(x => st.sheetOn[x.sheet] && chOf(x) && st.on[x.i]).map(x => ({ sheet: x.sheet, row: x.row, label: x.fileNo + ' — ' + x.rname, act: P && x.chAct ? x.newAct : null, plan: P && x.chPlan ? x.newPlan : null,
        tot: A && x.chTot ? x.newTot : null, coSum: A && x.chCo ? x.newCo : null, orig: A && x.chOrig ? x.newOrig : null, key: x.key, fileNo: x.fileNo,
        ...(A ? Object.fromEntries((x.more || []).map(m => [m.k, m.neu])) : {}) }));
      if (!ups.length) { fl('حدّد مشروعاً واحداً في الأقل', true); return; }
      const b = $('ppGo'); b.disabled = true; b.textContent = '⏳ جارٍ الحفظ…';
      const r = await D.ppSave(ups, { highlight: st.hi !== false }); b.disabled = false; b.textContent = '💾 حفظ نسخة محدَّثة';
      if (!r) return; if (r.error) { fl(r.error, true); return; }
      close(); fl(`✔ حُفظ: ${r.rows} مشروعاً (${r.changed} خلية)${r.skipped ? ' — ' + r.skipped + ' خلية معادلة لم تُغيَّر' : ''} في ${r.file}`);
    }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('ppOv') && !$('ppOv').hidden) close(); });
  window.PlanPct = { open };
})();
