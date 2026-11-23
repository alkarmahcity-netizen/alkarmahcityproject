/* global openOv, closeOv */
/* نسخة الاطلاع (viewer.js في البرنامج):
   - في نسخة الاطلاع: لا يظهر إلا الرئيسية ومركز المتابعة والموقف العام ومشاريع التخطيط، وتُخفى كل أزرار الحفظ والاستيراد والتصدير والإعدادات؛
     وشارة «آخر تحديث» مع ربط الرمز أول مرة.
   - في البرنامج الكامل (حاسبة القسم): نافذة «👁 نسخة الاطلاع» من قائمة أدوات — تفعيل النشر على Google Drive، رمز الربط، الإيقاف. */
(function () {
  const D = window.desktop; if (!D || !D.vw) return;
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const tm = t => { if (!t) return '—'; const d = new Date(t); return d.toLocaleDateString('en-GB') + ' ' + d.toLocaleTimeString('en-GB').slice(0, 5); };
  const kb = b => b > 1048576 ? (b / 1048576).toFixed(1) + ' ميغابايت' : Math.max(1, Math.round((b || 0) / 1024)) + ' كيلوبايت';
  const fl = (m, bad) => { if (window.flash) window.flash(m, bad); };
  const mkOv = (id, html) => { let o = $(id); if (!o) { o = document.createElement('div'); o.className = 'ov'; o.id = id; o.hidden = true; document.body.appendChild(o); } o.innerHTML = html; return o; };
  const open = id => { if (typeof openOv === 'function') openOv(id); else $(id).hidden = false; };
  const close = id => { if (typeof closeOv === 'function') closeOv(id); else $(id).hidden = true; };
  const css = document.createElement('style');
  css.textContent = `.vw-box{border:1px dashed #9ab;border-radius:8px;padding:8px 10px;margin:8px 0;line-height:1.9}.vw-ok{color:#1f6b3a;font-weight:700}.vw-bad{color:#b42318;font-weight:700}.vw-warn{color:#a15c00;font-weight:700}
  .vw-code{display:flex;gap:6px;align-items:stretch}.vw-code textarea{flex:1;direction:ltr;font-family:Consolas,monospace;font-size:13px;padding:6px 8px;border:1.5px solid #1f5f36;border-radius:8px;resize:none;word-break:break-all}
  #vwChip{font-weight:700;white-space:nowrap}#vwChip.bad{color:#b42318;border-color:#f3b4ae}
  .vw-badge{display:inline-block;background:#c9a227;color:#fff;border-radius:6px;padding:0 8px;font-size:12px;margin-inline-start:8px;vertical-align:middle}`;
  document.head.appendChild(css);

  /* ---------------- نسخة الاطلاع ---------------- */
  if (D.viewer) {
    const OK = ['home', 'sit', 'cc', 'pl'];
    document.body.classList.add('viewer');
    const lock = document.createElement('style');
    /* ما يخفى: تبويبات الأنظمة وكل زر يفتح غيرها، وأدوات الشريط (مزامنة/نسخ/كلمات سر/بريد...)، وأزرار الاستيراد والتعديل والتصدير في الصفحات */
    lock.textContent = `body.viewer [data-go]:not(${OK.map(i => `[data-go="${i}"]`).join(',')}){display:none!important}
    body.viewer .bar .tools>*:not(#vwChip){display:none!important}
    body.viewer .vw-hide,body.viewer .vwsys,body.viewer .pph.add,body.viewer [data-pphdel],body.viewer [data-pphcam],body.viewer [data-open],body.viewer [data-aesave],body.viewer #drawer .issbox,body.viewer #drawer .issok{display:none!important}`;
    document.head.appendChild(lock);
    /* عناصر التعديل داخل الصفحات (تُعلَّم بـ vw-hide كلما رُسمت الصفحة) */
    const EDIT = /(استيراد|استرجاع|نسخة احتياطية|تعديل|حذف|إضافة|اضافة|📷|📥|📤|تصدير|حفظ|ربط|اختيار ملف|مطابقة|تنظيف|مقارنة|تقييم|قالب|إعدادات|كلمة السر|Excel|إكسل|اكسل|Google Earth)/;
    const KEEP = /(طباعة|🖨|بحث|عرض|إغلاق|✕|تكبير|ملء الشاشة|تحديث)/;
    const mark = root => { (root || document).querySelectorAll('button, .btn, input[type=file]').forEach(b => {
      if (b.classList.contains('vw-hide') || b.closest('.ov') || b.closest('.bar')) return; const t = b.textContent || '';
      if (b.type === 'file' || ((EDIT.test(t) || EDIT.test(b.title || '')) && !KEEP.test(t))) b.classList.add('vw-hide'); });
      const ae = document.getElementById('aeIn'); if (ae) ae.disabled = true; };
    new MutationObserver(() => { clearTimeout(mark.t); mark.t = setTimeout(() => mark(), 60); }).observe(document.body, { childList: true, subtree: true });
    mark();
    /* شارة التحديث في الشريط */
    const tools = document.querySelector('.bar .tools');
    const chip = document.createElement('button'); chip.className = 'btn'; chip.id = 'vwChip'; chip.type = 'button'; chip.textContent = '👁 …';
    if (tools) tools.appendChild(chip); else document.querySelector('.bar').appendChild(chip);
    async function paint() { const s = await D.vw.status() || {}; chip.classList.toggle('bad', !!s.err || !s.linked);
      chip.textContent = !s.linked ? '👁 نسخة الاطلاع — لم تُربط بعد' : s.at ? '👁 نسخة الاطلاع — آخر تحديث: ' + tm(s.at) + (s.err ? ' ⚠' : '') : '👁 بانتظار أول تحديث…';
      chip.title = s.err ? 'آخر محاولة: ' + s.err : 'يتحدث تلقائياً كل 5 دقائق من حاسبة القسم'; return s; }
    function dlg(s, msg) {
      const o = mkOv('vwOv', `<div class="dlg" style="width:min(560px,100%)"><h3>👁 نسخة الاطلاع</h3>
        <p>تعرض هذه النسخة <b>الموقف المركز والموقف العام ومشاريع التخطيط وصور المشاريع</b> كما في حاسبة قسم الشؤون الهندسية، للاطلاع فقط. تتحدث تلقائياً عند التشغيل وكل 5 دقائق (تحتاج الإنترنت).</p>
        <div class="vw-box">${!s.linked ? '<span class="vw-warn">لم تُربط بعد</span>' : `<span class="vw-ok">مربوطة</span> — بيانات حاسبة القسم بتاريخ: <b>${tm(s.at)}</b><br><small>آخر فحص: ${tm(s.checked)}</small>`}${s.err ? `<br><span class="vw-bad">⚠ ${esc(s.err)}</span>` : ''}</div>
        <label class="ml">${s.linked ? 'تغيير رمز الربط (من قسم الشؤون الهندسية)' : 'رمز الربط (يُرسله قسم الشؤون الهندسية)'}<div class="vw-code"><textarea id="vwCode" rows="2" placeholder="AV1.…" spellcheck="false"></textarea></div></label>
        <div class="err" id="vwE">${esc(msg || '')}</div>
        <div class="row"><button class="btn" id="vwNo">إغلاق</button>${s.linked ? '<button class="btn" id="vwNow">🔄 تحديث الآن</button>' : ''}<button class="btn pri" id="vwOk">ربط</button></div></div>`);
      open('vwOv');
      o.onclick = async e => { const b = e.target.closest('button'); if (e.target === o) return close('vwOv'); if (!b) return;
        if (b.id === 'vwNo') return close('vwOv');
        if (b.id === 'vwNow') { b.disabled = true; b.textContent = '⏳ جارٍ التحديث…'; const r = await D.vw.refresh(); const s2 = await paint(); dlg(s2, r && r.error ? r.error : ''); if (r && r.ok) fl(r.changed ? 'وصلت بيانات جديدة من حاسبة القسم' : 'البيانات محدّثة'); return; }
        if (b.id === 'vwOk') { const c = ($('vwCode').value || '').trim(); if (!c) { $('vwE').textContent = 'الصق رمز الربط أولاً'; return; }
          b.disabled = true; b.textContent = '⏳ جارٍ الربط…'; const r = await D.vw.link(c) || {};
          if (r.error) { b.disabled = false; b.textContent = 'ربط'; $('vwE').textContent = r.error; return; }
          await paint(); close('vwOv'); fl('تم الربط — بيانات حاسبة القسم بتاريخ ' + tm(r.at)); if (D.go) D.go('sit'); } };
    }
    chip.onclick = async () => dlg(await paint());
    if (D.onSyncData) D.onSyncData(() => { paint(); });
    setInterval(paint, 60000);
    paint().then(s => { if (!s.linked) dlg(s); });
    return;
  }

  /* ---------------- البرنامج الكامل: النشر ---------------- */
  async function pubShow(msg) {
    const s = await D.vw.pubStatus(true) || {};
    const st = !s.connected ? '<span class="vw-bad">البرنامج غير مربوط ببريد القسم في Google Drive</span> — اربطه أولاً من زر ⚙ «ربط بريد القسم (Google Drive)» بجانب زر الإصدار والرفع في المخاطبات أو أحد الأنظمة، ثم عُد إلى هنا.'
      : !s.on ? '<span class="vw-warn">غير مفعّلة</span>'
      : s.busy ? '<span class="vw-warn">⏳ النشر جارٍ…</span>'
      : s.err ? `<span class="vw-bad">⚠ آخر محاولة فشلت: ${esc(s.err)}</span><br><small>آخر نشر ناجح: ${tm(s.at)}</small>`
      : `<span class="vw-ok">✔ مفعّلة</span> — آخر نشر: <b>${tm(s.at)}</b> (${kb(s.size)}، صور: ${s.photos})<br><small>تتحدث تلقائياً كل 10 دقائق إن تغيّر الموقف أو التخطيط أو الصور، من هذه الحاسبة فقط</small>`;
    const o = mkOv('vwPubOv', `<div class="dlg" style="width:min(640px,100%)"><h3>👁 نسخة الاطلاع (المحافظ والنائب والمعاون)</h3>
      <p>نسخة مستقلة من البرنامج تعرض <b>الموقف المركز والموقف العام ومشاريع التخطيط وصور المشاريع فقط</b>، للاطلاع دون تعديل. لا تحوي أوامر التغيير ولا السلف ولا المدد ولا المحاضر، ولا ترسل شيئاً.</p>
      <p class="hint">تنشر هذه الحاسبة ملفاً <b>مشفّراً</b> على Google Drive القسم (${esc(s.email || 'بريد القسم')})، وتقرؤه نسخة الاطلاع برمز الربط. الرابط وحده لا يكفي لقراءة الملف دون الرمز.</p>
      <div class="vw-box">${st}</div>
      ${s.code ? `<label class="ml">رمز الربط — يُرسل إلى مكاتبهم بطريقة خاصة ويُلصق مرة واحدة في نسخة الاطلاع<div class="vw-code"><textarea id="vwPubCode" rows="2" readonly>${esc(s.code)}</textarea><button class="btn" id="vwCopy" type="button">📋 نسخ</button></div></label>` : ''}
      <div class="err" id="vwPubE">${esc(msg || '')}</div>
      <div class="row"><button class="btn" id="vwPubNo">إغلاق</button>${s.on ? '<button class="btn" id="vwPubStop" style="color:#b42318">⛔ إيقاف نسخة الاطلاع</button>' : ''}${s.connected ? `<button class="btn pri" id="vwPubGo">${s.on ? '⬆ نشر الآن' : '✔ تفعيل ونشر'}</button>` : ''}</div></div>`);
    open('vwPubOv');
    o.onclick = async e => { const b = e.target.closest('button'); if (e.target === o) return close('vwPubOv'); if (!b) return;
      if (b.id === 'vwPubNo') return close('vwPubOv');
      if (b.id === 'vwCopy') { const t = $('vwPubCode'); t.select(); try { await navigator.clipboard.writeText(t.value); } catch (_) { document.execCommand('copy'); } fl('نُسخ رمز الربط'); return; }
      if (b.id === 'vwPubGo') { b.disabled = true; b.textContent = '⏳ جارٍ النشر…'; const r = await D.vw.publish() || {}; if (r.ok) fl('نُشرت نسخة الاطلاع'); return pubShow(r.error || ''); }
      if (b.id === 'vwPubStop') { if (!confirm('إيقاف نسخة الاطلاع؟\nتُحذف ملفاتها من Google Drive فتتوقف كل نسخ الاطلاع عن التحديث، ويلزم رمز جديد إن فُعّلت لاحقاً.')) return;
        b.disabled = true; const r = await D.vw.stop() || {}; fl(r.failed ? 'أُوقفت، وتعذّر حذف ' + r.failed + ' ملف من Drive' : 'أُوقفت نسخة الاطلاع'); return pubShow(''); } };
  }
  if (D.onCmd) D.onCmd(c => { if (c === 'viewer') pubShow(''); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') for (const id of ['vwOv', 'vwPubOv']) if ($(id) && !$(id).hidden) { close(id); break; } });
})();
