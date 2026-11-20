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
  window.AcqCheck = { problems, paint, bindNow, snap };
})();
