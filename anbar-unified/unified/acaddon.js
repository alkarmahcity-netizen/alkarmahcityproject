/* إضافة البرنامج الموحد داخل نظام الاستلام (يُحقن في صفحاته دون تعديل ملف الاستلام التنفيذي):
   1) لقطة سجلات الشهادات الأربع للوحة سير المعاملات (المعاملة = الشهادة؛ تُعدّ «منجزة» عند صدورها بعدد وتاريخ).
   2) عند إصدار الشهادة (طباعة / PDF): تنبيه مدخل البيانات إن كان ما يفتحه رمز QR قد يختلف عن المطبوع:
      - الرمز يفتح رابط ملف PDF رُبط والبيانات بشكل آخر (تغيّر «رمز التحقق» بعد ربط الرابط) ← سيفتح نسخة قديمة.
      - الرابط نفسه مستعمل لشهادة أخرى، أو اسم الملف في الرابط لرقم شهادة آخر.
      - بلا رابط: الرمز يحمل بيانات المحضر نصاً من الحقول نفسها (مطابق للمطبوع). */
(function () {
  'use strict';
  if (window.__acAddon) return; window.__acAddon = 1;
  const D = window.desktop || {};
  const TYPES = { pac: 'pac_records_v1', pap: 'pap_records_v1', fac: 'fac_records_v1', fpa: 'fpa_records_v1' };
  const recsOf = k => { try { return JSON.parse(localStorage.getItem(k) || '{}') || {}; } catch (_) { return {}; } };
  /* ---------- 1) اللقطة ---------- */
  function snap() {
    const recs = [];
    for (const [t, k] of Object.entries(TYPES)) for (const [serial, r] of Object.entries(recsOf(k))) {
      if (!r) continue;
      recs.push({ t, serial: String(r.serial || serial), pName: String(r.pName || ''), fileNo: String(r.fileNo || ''), contractor: String(r.contractor || ''),
        resEng: String(r.resEng || ''), cNo: String(r.cNo || ''), outNo: String(r.outNo || ''), outDate: String(r.outDate || '') });
    }
    return { recs };
  }
  let last = '';
  function push() { try { const s = snap(), j = JSON.stringify(s); if (j === last) return; last = j; if (D.acFlowSnap) D.acFlowSnap(s); } catch (_) {} }
  push(); setInterval(push, 4000);
  window.addEventListener('beforeunload', push);

  /* ---------- 2) رمز QR مقابل المطبوع ---------- */
  const T = (() => { try { return typeof KEY !== 'undefined' ? Object.keys(TYPES).find(t => TYPES[t] === KEY) : null; } catch (_) { return null; } })();   // KEY: مفتاح سجلات الصفحة
  if (!T || typeof collect !== 'function') return;
  const $ = id => document.getElementById(id);
  const BK = 'acq_qrbind_v1';
  const binds = () => { try { return JSON.parse(localStorage.getItem(BK) || '{}') || {}; } catch (_) { return {}; } };
  const putBind = (k, v) => { try { const b = binds(); if (v) b[k] = v; else delete b[k]; localStorage.setItem(BK, JSON.stringify(b)); } catch (_) {} };
  function qrUrlOf(o) {
    const base = (($('baseUrl') || {}).value || '').trim();
    let u = ''; try { u = cleanUrl(o.pdfUrl); } catch (_) { u = String(o.pdfUrl || '').trim(); }
    return u || (base && o.serial ? base.replace(/\/?$/, '/') + encodeURIComponent(o.serial) + '.pdf' : '');
  }
  const ver = () => String(window.__ver || '');
  /* الرابط الآن مربوط بأي بيانات؟ يُربط عند كتابة/لصق الرابط (أو أول مرة يُرى) بالبيانات الحالية */
  function bindNow(force) {
    const o = collect(); if (!o.serial) return; const u = qrUrlOf(o), k = T + ':' + o.serial, b = binds()[k];
    if (!u) { if (b) putBind(k, null); return; }
    if (force || !b || b.url !== u) putBind(k, { url: u, ver: ver(), at: Date.now() });
  }
  function problems() {
    const o = collect(), out = []; if (!o.serial) return out;
    const u = qrUrlOf(o); if (!u) return out;   // بلا رابط: الرمز نص من الحقول نفسها
    const b = binds()[T + ':' + o.serial];
    if (b && b.url === u && b.ver && ver() && b.ver !== ver())
      out.push(`رمز QR يفتح ملف PDF رُبط حين كانت بيانات الشهادة مختلفة (رمز التحقق عند الربط ${b.ver}، والمطبوع الآن ${ver()}): من يمسح الرمز سيرى نسخة قديمة تختلف عن هذه الورقة. اطبع/احفظ PDF الجديد وارفعه، ثم ضع رابطه الجديد.`);
    for (const [t, k] of Object.entries(TYPES)) for (const [s, r] of Object.entries(recsOf(k))) {
      if (!r || (t === T && String(r.serial || s) === String(o.serial))) continue;
      let ru = ''; try { ru = cleanUrl(r.pdfUrl); } catch (_) { ru = String(r.pdfUrl || '').trim(); }
      if (ru && ru === u) out.push(`رابط QR نفسه مستعمل في شهادة أخرى (رقم ${r.serial || s}${r.pName ? ' — ' + String(r.pName).slice(0, 40) : ''}): الرمز سيفتح تلك الشهادة لا هذه.`);
      else if (t === T && String(r.serial || s).length >= 3 && decodeURIComponent(u).includes(String(r.serial || s)) && !decodeURIComponent(u).includes(String(o.serial)))
        out.push(`اسم الملف في رابط QR يحمل رقم شهادة أخرى (${r.serial || s}) لا رقم هذه الشهادة (${o.serial}).`);
    }
    return [...new Set(out)];
  }
  /* سطر حالة دائم تحت حالة رمز QR في الصفحة */
  function paint() {
    const st = $('qrStatus'); if (!st) return; let el = $('acqChk');
    if (!el) { el = document.createElement('div'); el.id = 'acqChk'; el.style.cssText = 'margin-top:6px;padding:6px 10px;border-radius:8px;font-size:13px;line-height:1.7'; st.insertAdjacentElement('afterend', el); }
    const P = problems(), o = collect(), u = qrUrlOf(o);
    if (P.length) { el.style.background = '#fdecea'; el.style.color = '#8b1a1a'; el.innerHTML = '⚠ <b>رمز QR قد لا يطابق المطبوع:</b><br>' + P.map(x => '• ' + x.replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]))).join('<br>'); }
    else { el.style.background = '#e8f5e9'; el.style.color = '#1b5e20'; el.textContent = u ? '✔ بيانات المطبوع مطابقة لما رُبط به رابط رمز QR' : '✔ رمز QR يحمل بيانات الشهادة المطبوعة نفسها'; }
  }
  document.addEventListener('input', e => { if (e.target && (e.target.id === 'pdfUrl' || e.target.id === 'baseUrl')) setTimeout(() => { bindNow(true); paint(); }, 0); else setTimeout(paint, 0); }, true);
  document.addEventListener('change', () => setTimeout(paint, 0), true);
  document.addEventListener('click', e => {
    const b = e.target && e.target.closest && e.target.closest('#btnPrint,#btnPdf,#btnLoad,#btnNew,#btnSave');
    if (!b) return;
    if (b.id === 'btnLoad' || b.id === 'btnNew' || b.id === 'btnSave') { setTimeout(() => { bindNow(false); paint(); push(); }, 50); return; }
    /* الإصدار (طباعة / PDF): تنبيه قبل أن يطبع */
    const P = problems();
    if (P.length && !confirm('⚠ تنبيه قبل إصدار الشهادة — رمز QR قد لا يطابق المطبوع:\n\n• ' + P.join('\n• ') + '\n\n«موافق» = أصدرها هكذا   ·   «إلغاء» = لا تُصدر الآن (صحّح الرابط أولاً)')) { e.preventDefault(); e.stopImmediatePropagation(); return; }
    setTimeout(push, 500);
  }, true);
  setTimeout(() => { bindNow(false); paint(); }, 300);

  /* ---------- 3) «☁ إصدار ورفع إلى Drive» (بريد القسم): رابط ثابت يُحجز قبل الطباعة ← رمز QR ← PDF ← يُرفع على الرابط نفسه ---------- */
  const TNAME = { pac: 'محضر الاستلام الأولي', pap: 'الاستلام الأولي الجزئي', fac: 'الاستلام النهائي', fpa: 'الاستلام النهائي الجزئي' };
  const GK = 'acq_gd_v1', gmap = () => { try { return JSON.parse(localStorage.getItem(GK) || '{}') || {}; } catch (_) { return {}; } };
  const gput = (k, v) => { try { const m = gmap(); m[k] = v; localStorage.setItem(GK, JSON.stringify(m)); } catch (_) {} };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const say = (m, bad) => { try { if (typeof toast === 'function') { toast(m); return; } } catch (_) {} if (bad) alert(m); };
  const escH = x => String(x == null ? '' : x).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let gdBusy = false;
  async function gdIssue() {
    if (gdBusy || !D.gdStatus) return; const st = await D.gdStatus(); if (!st || !st.connected) { gdDlg(); return; }
    gdBusy = true; const btn = $('btnGd'), lbl = btn ? btn.textContent : '';
    const step = t => { if (btn) btn.textContent = '⏳ ' + t; };
    try {
      if (!collect().serial) { $('btnSave').click(); await sleep(400); }
      const o = collect(); if (!o.serial) { alert('احفظ الشهادة أولاً'); return; }
      const P = problems().filter(x => !/نسخة قديمة/.test(x)); if (P.length && !confirm('⚠ ' + P.join('\n⚠ ') + '\n\nمتابعة الإصدار؟')) return;
      const k = T + ':' + o.serial, name = `${TNAME[T]} ${o.serial}${o.pName ? ' — ' + String(o.pName).slice(0, 60) : ''}.pdf`.replace(/[\\/:*?"<>|]+/g, ' ');
      let id = gmap()[k];
      if (!id) { step('حجز رابط الملف في Drive…'); const r = await D.gdReserve(name); if (!r || r.error) { alert('تعذّر الحجز في Google Drive:\n' + ((r && r.error) || '')); return; } id = r.id; gput(k, id); if (!r.shared) alert('⚠ ' + r.shareError); }
      const url = `https://drive.google.com/file/d/${id}/view`, f = $('pdfUrl');
      if (f && f.value !== url) { f.value = url; f.dispatchEvent(new Event('input', { bubbles: true })); f.dispatchEvent(new Event('change', { bubbles: true })); }
      try { render(); } catch (_) {}
      await sleep(150); bindNow(true); $('btnSave').click(); await sleep(500);
      step('إنشاء PDF ورفعه…'); const u = await D.gdUpload(id, name);
      if (!u || u.error) { alert('تعذّر رفع PDF الشهادة:\n' + ((u && u.error) || '')); return; }
      paint(); push(); say(`✔ صدرت الشهادة ورُفعت إلى Google Drive (${u.kb} ك.ب) — رمز QR يفتحها عند الجميع`);
      window.__gdLast = { id, url, kb: u.kb };
    } finally { gdBusy = false; if (btn) btn.textContent = lbl; }
  }
  async function gdDlg() {
    let ov = $('gdOv'); if (ov) ov.remove(); ov = document.createElement('div'); ov.id = 'gdOv';
    ov.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(15,23,42,.45);display:flex;align-items:center;justify-content:center;font:14px Tahoma,Arial,sans-serif;direction:rtl';
    const st = (D.gdStatus && await D.gdStatus()) || {};
    ov.innerHTML = `<div style="background:#fff;border-radius:12px;padding:18px 20px;width:min(620px,94vw);max-height:90vh;overflow:auto;line-height:1.8">
      <h3 style="margin:0 0 8px;color:#1f3a5f">☁ ربط الإصدار ببريد القسم (Google Drive)</h3>
      <div id="gdSt" style="padding:6px 10px;border-radius:8px;background:${st.connected ? '#e8f5e9;color:#1b5e20' : '#fff4e5;color:#8a4b00'}">${st.connected ? '✔ مربوط بـ <b dir="ltr">' + escH(st.email || 'حساب Google') + '</b> — «☁ إصدار ورفع إلى Drive» جاهز' : st.configured ? 'أُدخل معرّف التطبيق — بقي «تسجيل الدخول ببريد القسم»' : 'غير مربوط بعد'}</div>
      <details ${st.configured ? '' : 'open'} style="margin:8px 0"><summary style="cursor:pointer;font-weight:700">١) معرّف التطبيق من Google Cloud (مرة واحدة)</summary>
        <ol style="margin:6px 0;padding-inline-start:22px;font-size:13px;color:#334">
          <li>ادخل <b dir="ltr">console.cloud.google.com</b> ببريد القسم ← أنشئ مشروعاً (مثلاً: شهادات الاستلام).</li>
          <li>APIs &amp; Services ← Library ← <b>Google Drive API</b> ← Enable.</li>
          <li>OAuth consent screen ← نوع المستخدم <b>Internal</b> (إن ظهر) ← اسم التطبيق وبريد القسم ← حفظ.</li>
          <li>Credentials ← Create credentials ← <b>OAuth client ID</b> ← النوع <b>Desktop app</b> ← انسخ <b>Client ID</b> و<b>Client secret</b> إلى الحقلين أدناه.</li></ol>
        <label style="display:block">Client ID<input id="gdId" dir="ltr" style="width:100%;font:inherit;padding:5px" placeholder="....apps.googleusercontent.com"></label>
        <label style="display:block">Client secret<input id="gdSec" type="password" dir="ltr" style="width:100%;font:inherit;padding:5px" autocomplete="off"></label>
        <button id="gdSave" style="margin-top:6px">حفظ معرّف التطبيق</button> <small style="color:#667">يُحفظ مشفّراً على هذه الحاسبة فقط.</small></details>
      <div style="margin:8px 0"><b>٢)</b> <button id="gdGo" ${st.configured ? '' : 'disabled'} style="background:#1f3a5f;color:#fff;border:0;border-radius:8px;padding:6px 14px">تسجيل الدخول ببريد القسم</button>
        <small style="color:#667">يفتح المتصفح: اختر بريد القسم ووافق — البرنامج يرى ملفات الشهادات التي يرفعها هو فقط.</small></div>
      <div id="gdMsg" style="color:#8b1a1a;min-height:1.4em"></div>
      <div style="display:flex;gap:8px;justify-content:flex-start;margin-top:6px">${st.connected ? '<button id="gdOff" style="color:#b42318">فصل البريد</button>' : ''}<span style="flex:1"></span><button id="gdX">إغلاق</button></div></div>`;
    document.body.appendChild(ov);
    const msg = t => { $('gdMsg').textContent = t || ''; };
    ov.addEventListener('click', async e => { const t = e.target;
      if (t === ov || t.id === 'gdX') { ov.remove(); return; }
      if (t.id === 'gdSave') { const r = await D.gdSetApp($('gdId').value, $('gdSec').value); if (r && r.error) msg(r.error); else gdDlg(); return; }
      if (t.id === 'gdGo') { t.disabled = true; t.textContent = '⏳ أكمل تسجيل الدخول في المتصفح…'; const r = await D.gdConnect('eng@anbar.iq'); if (r && r.error) { msg(r.error); t.disabled = false; t.textContent = 'تسجيل الدخول ببريد القسم'; } else gdDlg(); return; }
      if (t.id === 'gdOff') { if (confirm('فصل بريد القسم عن هذه الحاسبة؟ (الملفات المرفوعة تبقى في Drive)')) { await D.gdDisconnect(); gdDlg(); } }
    });
  }
  /* الزرّان بجانب «💾 حفظ PDF» */
  { const pdfB = $('btnPdf'); if (pdfB && D.gdStatus && !$('btnGd')) {
      const b = document.createElement('button'); b.id = 'btnGd'; b.className = 'primary'; b.type = 'button'; b.textContent = '☁ إصدار ورفع إلى Drive';
      b.title = 'يحجز رابطاً في Google Drive لبريد القسم، ويضعه في رمز QR، وينشئ PDF الشهادة ويرفعه على الرابط نفسه — فيفتح الرمز الملف المطبوع نفسه عند الجميع';
      const g = document.createElement('button'); g.id = 'btnGdSet'; g.type = 'button'; g.textContent = '⚙'; g.title = 'ربط بريد القسم (Google Drive)';
      pdfB.insertAdjacentElement('afterend', g); pdfB.insertAdjacentElement('afterend', b);
      b.addEventListener('click', e => { e.preventDefault(); gdIssue(); }); g.addEventListener('click', e => { e.preventDefault(); gdDlg(); }); } }
  window.AcqCheck = { problems, paint, bindNow, snap, gdIssue, gdDlg };
  /* ---------- 4) تصحيحان في الطباعة ----------
     • الترويسة: كانت تبدأ من حافة الورقة العليا (0 ملم) فتقصّ الطابعة أعلى «بسم الله الرحمن الرحيم» — تُنزَّل 1.5 ملم
       (على صفحة العرض وصفحة القياس معاً، فيبقى توزيع الصفحات صحيحاً).
     • «توصيات اللجنة»: قيمتها الافتراضية القديمة «accept» (من نسخة كانت الخانة فيها قائمة اختيار) كانت تُطبع بالإنجليزية
       في الاستلام الأولي والأولي الجزئي إن لم تكتب اللجنة توصيتها — تُعامل فارغة (تُطبع نقاطاً للكتابة) في العرض والحفظ والطباعة. */
  try {
    if (document.getElementById('sheet') && !document.getElementById('acHdFix')) {
      const st = document.createElement('style'); st.id = 'acHdFix'; st.textContent = '.hd{margin-top:-8.5mm!important}'; (document.head || document.documentElement).appendChild(st);
      try { if (typeof window.render === 'function') window.render(); } catch (_) {}
    }
    const isAcc = v => /^\s*accept\s*$/i.test(String(v == null ? '' : v));
    if (typeof window.collect === 'function' && !window.collect.__accFix) {
      const c0 = window.collect, c1 = function () { const o = c0.apply(this, arguments); if (o && isAcc(o.rec)) o.rec = ''; return o; }; c1.__accFix = 1; window.collect = c1;
    }
    const clr = () => { const r = document.getElementById('rec'); if (r && isAcc(r.value)) { r.value = ''; try { if (typeof window.render === 'function') window.render(); } catch (_) {} } };
    clr(); setInterval(clr, 800);
  } catch (_) {}
})();
