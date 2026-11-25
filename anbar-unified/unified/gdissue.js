/* «☁ إصدار ورفع إلى Drive» في المخاطبات (والمطالعات) وأوامر التغيير والسلف والمدد وتقارير الزيارة (يُحقن من البرنامج في صفحة النظام؛ الاستلام له acaddon.js).
   رابط ثابت يُحجز في Google Drive لبريد القسم ← يوضع في حقل رابط رمز QR للمستند ← يُنشأ PDF المستند ← يُرفع على الرابط نفسه.
   فيفتح رمز QR المطبوع الملف المطبوع نفسه عند الجميع؛ وإعادة الإصدار بعد تعديل تستبدل المحتوى على الرابط نفسه. */
(function (SYS) {
  'use strict';
  if (window.__gdIssue || !window.desktop || !window.desktop.gdStatus) return; window.__gdIssue = 1;
  const D = window.desktop, $ = id => document.getElementById(id), sleep = ms => new Promise(r => setTimeout(r, ms));
  const esc = x => String(x == null ? '' : x).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const clean = s => String(s || '').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim();
  const idOf = u => { const m = /drive\.google\.com\/file\/d\/([A-Za-z0-9_-]{10,})/.exec(String(u || '')); return m ? m[1] : ''; };
  /* محوّل لكل نظام: هل المستند مفتوح، أين الزر، اسم الملف، الرابط الحالي، وضع الرابط (يحفظ ويعيد الرسم)، والتهيئة قبل PDF */
  const A = {
    lt: { ready: () => typeof view !== 'undefined' && view === 'edit' && typeof R === 'function' && !!R(),
      anchor: () => document.querySelector('[data-act=savetpl]'), where: 'afterend',
      name: () => clean(dlName(R(), 'pdf')), link: () => R().drive || '',
      set: u => { const r = R(); r.drive = u; touch(); try { renderForm(); } catch (_) {} renderPreview(true); }, wait: 1500 },
    ad: { ready: () => typeof view !== 'undefined' && view === 'edit' && typeof R === 'function' && !!R() && (R().advances || []).length > 0,
      anchor: () => document.querySelector('#main .ed-bar'), where: 'beforeend',
      check: () => (typeof issueOk === 'function' ? issueOk() : true),
      name: () => clean(baseName(R())) + '.pdf', link: () => { const r = R(), a = r.advances[r.printIdx] || {}; return a.driveUrl || ''; },
      set: u => { const r = R(), a = r.advances[r.printIdx]; if (!a) return; a.driveUrl = u; persist(); doRender(); }, wait: 600 },
    du: { item: () => { if (typeof S === 'undefined' || !S || !S.rid || !S.sel) return null; return S.sel.t === 'ext' ? S.exts[S.cur] : S.cases[S.cc]; },
      ready() { const p = $('proj'); return !!(p && !p.hidden && this.item()); },
      anchor: () => $('bPrint'), where: 'afterend',
      name() { const it = this.item() || {}, p = (S && S.p) || {}, sel = ($('printSel') || {}).value || '';
        const t = S.sel.t === 'ext' ? 'قرار لجنة المدد ' + (it.no || '') : (it.type === 'stop' ? 'توقف' : 'استئناف');
        return clean(`${t} — ${p.name || 'مشروع'}${sel && sel !== 'all' ? ' (' + (($('printSel').selectedOptions[0] || {}).textContent || sel) + ')' : ''}`).slice(0, 120) + '.pdf'; },
      link() { return (this.item() || {}).qr || ''; },
      set(u) { const it = this.item(); if (!it) return; it.qr = u; upd(); const f = document.querySelector('input[data-k=qr]'); if (f && f.value !== u) f.value = u; }, wait: 1200 },
    co: { ready: () => typeof view !== 'undefined' && view === 'edit' && typeof R === 'function' && !!R() && (R().orders || []).length > 0,
      anchor: () => document.querySelector('#edBar [data-act=qrdl]'), where: 'afterend',
      check: () => (typeof canIssue === 'function' ? canIssue() : true),
      name: () => { const r = R(), i = Math.min(r.printOrder | 0, r.orders.length - 1); return clean(baseName(r)).slice(0, 110) + ' — أمر ' + (i + 1) + '.pdf'; },
      link: () => { const r = R(), i = Math.min(r.printOrder | 0, r.orders.length - 1); return (r.orders[i] || {}).link || ''; },
      set: u => { const r = R(), o = r.orders[Math.min(r.printOrder | 0, r.orders.length - 1)]; if (!o) return; o.link = u; touch(); try { persist(); } catch (_) {} try { renderForm(); } catch (_) {} try { renderPreview(true); } catch (_) {} try { doRender(); } catch (_) {} }, wait: 1200 },
    fv: { ready: () => !!window.FieldVisit && !!$('f_project'), anchor: () => document.querySelector('#fvBar [data-fv=save]'), where: 'afterend',
      name: () => clean('تقرير زيارة — ' + ((($('f_project') || {}).value) || 'مشروع')).slice(0, 120) + '.pdf', link: () => (($('f_pdfLink') || {}).value) || '',
      set: u => { const f = $('f_pdfLink'); f.value = u; f.dispatchEvent(new Event('input', { bubbles: true })); try { render(); } catch (_) {} try { FieldVisit.save(); } catch (_) {} },
      before: () => { try { fitOnePage(); } catch (_) {} }, wait: 600 }
  };
  /* اللجنة المركزية للمصادقة: قرارها وحده (صفحة المركزية) برابط خاص به e.z.qr — يعود مع القرار الى برنامج المدد فيفتح رمزه القرار نفسه */
  A.zc = { item: () => (typeof S !== 'undefined' && S && S.rid && S.exts ? S.exts[S.cur] : null),
    ready() { const p = $('proj'); return !!(p && !p.hidden && this.item() && $('centralSec')); },
    anchor: () => $('bPrint'), where: 'afterend',
    name() { const p = (S && S.p) || {}, z = (this.item() || {}).z || {}; return clean(`قرار اللجنة المركزية${z.formNo ? ' ' + z.formNo : ''} — ${p.name || 'مشروع'}`).slice(0, 120) + '.pdf'; },
    link() { const e = this.item(); return (e && e.z && e.z.qr) || ''; },
    set(u) { const e = this.item(); if (!e) return; e.z = e.z || {}; e.z.qr = u; const ps = $('printSel'); if (ps) ps.value = 'z'; upd(); try { save(); } catch (_) {} },
    before: () => { const ps = $('printSel'); if (ps && ps.value !== 'z') { ps.value = 'z'; upd(); } }, wait: 1200 };
  A.dm = A.lt; A.cm = A.lt;
  const ad = A[SYS]; if (!ad) return;
  const say = (m, bad) => { try { if (typeof window.flash === 'function') { window.flash(m, bad); return; } if (typeof toast === 'function') { toast(m); return; } } catch (_) {} if (bad) alert(m); };
  let busy = false;
  async function issue() {
    if (busy) return; if (!ad.ready()) { say('افتح المستند أولاً', true); return; }
    const st = await D.gdStatus(); if (!st || !st.connected) { dlg(); return; }
    if (ad.check && !ad.check()) return;
    busy = true; const b = $('btnGdIssue'), lbl = b ? b.textContent : ''; const step = t => { if (b) b.textContent = '⏳ ' + t; };
    try {
      const name = ad.name(); let id = idOf(ad.link());
      if (id && !(await D.gdOwns(id))) id = '';   // رابط وُضع يدوياً (ليس من البرنامج): يُحجز رابط جديد
      if (!id) { step('حجز رابط الملف في Drive…'); const r = await D.gdReserve(name); if (!r || r.error) { alert('تعذّر الحجز في Google Drive:\n' + ((r && r.error) || '')); return; } id = r.id; if (!r.shared) alert('⚠ ' + r.shareError); }
      const url = `https://drive.google.com/file/d/${id}/view`;
      if (ad.link() !== url) ad.set(url);
      if (ad.before) ad.before(); await sleep(ad.wait || 800);
      step('إنشاء PDF ورفعه…'); const u = await D.gdUpload(id, name);
      if (!u || u.error) { alert('تعذّر رفع PDF:\n' + ((u && u.error) || '')); return; }
      say(`✔ صدر المستند ورُفع إلى Google Drive (${u.kb} ك.ب) — رمز QR يفتحه عند الجميع`);
      window.__gdLast = { id, url, kb: u.kb, name };
    } finally { busy = false; if (b) b.textContent = lbl; }
  }
  async function dlg() {
    let ov = $('gdOv'); if (ov) ov.remove(); ov = document.createElement('div'); ov.id = 'gdOv';
    ov.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(15,23,42,.45);display:flex;align-items:center;justify-content:center;font:14px Tahoma,Arial,sans-serif;direction:rtl';
    const st = (await D.gdStatus()) || {}; let sh = null; try { sh = D.gdShareState ? await D.gdShareState() : null; } catch (_) {}
    ov.innerHTML = `<div style="background:#fff;color:#1e293b;border-radius:12px;padding:18px 20px;width:min(620px,94vw);max-height:90vh;overflow:auto;line-height:1.8;text-align:right">
      <h3 style="margin:0 0 8px;color:#1f3a5f">☁ ربط الإصدار ببريد القسم (Google Drive)</h3>
      <div style="padding:6px 10px;border-radius:8px;background:${st.connected ? '#e8f5e9;color:#1b5e20' : '#fff4e5;color:#8a4b00'}">${st.connected ? '✔ مربوط بـ <b dir="ltr">' + esc(st.email || 'حساب Google') + '</b> — الربط واحد لكل الأنظمة على هذه الحاسبة' : st.configured ? 'أُدخل معرّف التطبيق — بقي «تسجيل الدخول ببريد القسم»' : 'غير مربوط بعد'}</div>
      <div style="margin:8px 0;padding:8px 10px;border:1px dashed #9db3c9;border-radius:8px;background:#f5f9ff"><b>الأسهل:</b> الصق <b>«رمز إعداد Drive»</b> من حاسبة مربوطة (حاسبة القسم ← هذه النافذة ← «📋 رمز إعداد Drive») — بدل الخطوة ١:
        <input id="gdImp" dir="ltr" style="width:100%;font:inherit;padding:5px;margin-top:4px" placeholder="GD1.…"><button id="gdImpGo" type="button" style="margin-top:4px">تطبيق الرمز</button></div>
      <details ${st.configured ? '' : 'open'} style="margin:8px 0"><summary style="cursor:pointer;font-weight:700">١) معرّف التطبيق من Google Cloud (مرة واحدة)</summary>
        <ol style="margin:6px 0;padding-inline-start:22px;font-size:13px">
          <li>ادخل <b dir="ltr">console.cloud.google.com</b> ببريد القسم ← أنشئ مشروعاً.</li>
          <li>APIs &amp; Services ← Library ← <b>Google Drive API</b> ← Enable.</li>
          <li>OAuth consent screen ← <b>Internal</b> (إن ظهر) ← اسم التطبيق وبريد القسم ← حفظ.</li>
          <li>Credentials ← Create credentials ← <b>OAuth client ID</b> ← <b>Desktop app</b> ← انسخ <b>Client ID</b> و<b>Client secret</b> هنا.</li></ol>
        <label style="display:block">Client ID<input id="gdId" dir="ltr" style="width:100%;font:inherit;padding:5px" placeholder="....apps.googleusercontent.com"></label>
        <label style="display:block">Client secret<input id="gdSec" type="password" dir="ltr" style="width:100%;font:inherit;padding:5px" autocomplete="off"></label>
        <button id="gdSave" type="button" style="margin-top:6px">حفظ معرّف التطبيق</button> <small style="color:#667">يُحفظ مشفّراً على هذه الحاسبة فقط.</small></details>
      <div style="margin:8px 0"><b>٢)</b> <button id="gdGo" type="button" ${st.configured ? '' : 'disabled'} style="background:#1f3a5f;color:#fff;border:0;border-radius:8px;padding:6px 14px">تسجيل الدخول ببريد القسم</button>
        <small style="color:#667">يفتح المتصفح: اختر بريد القسم ووافق — يرى البرنامج الملفات التي يرفعها هو فقط.</small></div>
      <div id="gdMsg" style="color:#8b1a1a;min-height:1.4em"></div>
      <div style="display:flex;gap:8px;margin-top:6px">${st.connected ? '<button id="gdExp" type="button">📋 رمز إعداد Drive لحاسبة أخرى</button>' : ''}${st.connected && sh && sh.server ? `<button id="gdShare" type="button" data-on="${sh.on ? 1 : 0}" title="حاسبات اللجان غير المربوطة تأخذ هذا الربط تلقائياً عبر المزامنة (بلا رمز ولا تسجيل دخول)">${sh.on ? '🔗 مشاركة الربط مع حاسبات اللجان: مفعّلة — إيقاف' : '🔗 مشاركة الربط مع حاسبات اللجان (المزامنة)'}</button>` : ''}${st.connected ? '<button id="gdOff" type="button" style="color:#b42318">فصل البريد</button>' : ''}<span style="flex:1"></span><button id="gdX" type="button">إغلاق</button></div></div>`;
    document.body.appendChild(ov);
    const msg = t => { $('gdMsg').textContent = t || ''; };
    ov.addEventListener('click', async e => { const t = e.target;
      if (t === ov || t.id === 'gdX') { ov.remove(); return; }
      if (t.id === 'gdSave') { const r = await D.gdSetApp($('gdId').value, $('gdSec').value); if (r && r.error) msg(r.error); else dlg(); return; }
      if (t.id === 'gdGo') { t.disabled = true; t.textContent = '⏳ أكمل تسجيل الدخول في المتصفح…'; const r = await D.gdConnect('eng@anbar.iq'); if (r && r.error) { msg(r.error); t.disabled = false; t.textContent = 'تسجيل الدخول ببريد القسم'; } else dlg(); return; }
      if (t.id === 'gdImpGo') { const r = await D.gdImport($('gdImp').value); if (r && r.error) msg(r.error); else { await dlg(); const m2 = document.getElementById('gdMsg'); if (m2) { m2.style.color = '#1b5e20'; m2.textContent = '✔ طُبّق معرّف التطبيق الصحيح — اضغط «تسجيل الدخول ببريد القسم»'; } } return; }
      if (t.id === 'gdExp') { t.disabled = true; const r = await D.gdExport(); t.disabled = false; if (!r || r.error) { msg((r && r.error) || 'تعذّر'); return; }
        msg(''); const box = document.createElement('div'); box.style.cssText = 'margin-top:6px'; box.innerHTML = '<small>انسخه وألصقه في الحاسبة الأخرى (لا تنشره — يحمل معرّف تطبيق القسم وسرّه مشفّرين):</small><input readonly dir="ltr" style="width:100%;font:inherit;padding:5px">'; box.querySelector('input').value = r.code; t.after(box); box.querySelector('input').select(); try { await navigator.clipboard.writeText(r.code); } catch (_) {} return; }
      if (t.id === 'gdShare') { const on = t.dataset.on !== '1'; if (on && !confirm('مشاركة ربط Google Drive مع حاسبات اللجان عبر المزامنة؟\nكل حاسبة لجنة غير مربوطة ستُربط تلقائياً ببريد القسم (ملفات البرنامج فقط في Drive، لا البريد).')) return;
        const pw = prompt('كلمة سر المدير:'); if (pw == null) return; const r = await D.gdShare(on, pw); if (r && r.error) { msg(r.error); return; } dlg(); return; }
      if (t.id === 'gdOff') { if (confirm('فصل بريد القسم عن هذه الحاسبة؟ (الملفات المرفوعة تبقى في Drive)')) { await D.gdDisconnect(); dlg(); } }
    });
  }
  /* الزرّان: يُعادان كلما أعاد النظام رسم شريطه */
  function ensure() {
    try {
      const a = ad.ready() ? ad.anchor() : null, b = $('btnGdIssue');
      if (!a) { if (b) b.parentElement && b.parentElement.removeChild(b), $('btnGdSet') && $('btnGdSet').remove(); return; }
      if (b && b.isConnected && (ad.where === 'beforeend' ? b.parentElement === a : b.previousElementSibling === a || (a.nextElementSibling === b))) return;
      if (b) b.remove(); const g0 = $('btnGdSet'); if (g0) g0.remove();
      const cls = (a.tagName === 'BUTTON' ? a.className : 'btn sm') || 'btn sm';
      const nb = document.createElement('button'); nb.id = 'btnGdIssue'; nb.type = 'button'; nb.className = cls; nb.textContent = '☁ إصدار ورفع إلى Drive';
      nb.title = 'يحجز رابطاً في Google Drive لبريد القسم ويضعه في رمز QR، وينشئ PDF المستند ويرفعه على الرابط نفسه — فيفتح الرمز الملف المطبوع نفسه عند الجميع';
      const g = document.createElement('button'); g.id = 'btnGdSet'; g.type = 'button'; g.className = cls; g.textContent = '⚙'; g.title = 'ربط بريد القسم (Google Drive)';
      nb.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); issue(); }); g.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); dlg(); });
      if (ad.where === 'beforeend') { a.appendChild(nb); a.appendChild(g); } else { a.insertAdjacentElement('afterend', g); a.insertAdjacentElement('afterend', nb); }
    } catch (_) {}
  }
  let pend = false; new MutationObserver(() => { if (!pend) { pend = true; requestAnimationFrame(() => { pend = false; ensure(); }); } }).observe(document.body, { childList: true, subtree: true });
  ensure();
  window.GdIssue = { issue, dlg, ensure, ready: () => ad.ready(), link: () => ad.link() };
})('__SYS__');
