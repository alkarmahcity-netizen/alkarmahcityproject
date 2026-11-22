/* نسخة لوحة سير المعاملات لمتصفحات الشاشات القديمة (التلفاز): الشيفرة محوّلة إلى ES2015 + سدّ لدوال حديثة غير موجودة فيها. تُولَّد من flow.js بـ node tools/flow-legacy.js — لا تُعدَّل يدوياً */
(function(){var E=window.Element&&Element.prototype;if(E&&!E.matches)E.matches=E.msMatchesSelector||E.webkitMatchesSelector;
if(E&&!E.closest)E.closest=function(s){var el=this;while(el&&el.nodeType===1){if(el.matches(s))return el;el=el.parentElement||el.parentNode;}return null;};
if(window.NodeList&&!NodeList.prototype.forEach)NodeList.prototype.forEach=Array.prototype.forEach;
if(!Array.prototype.includes)Array.prototype.includes=function(x){return this.indexOf(x)>=0;};
if(!String.prototype.includes)String.prototype.includes=function(x,i){return this.indexOf(x,i||0)>=0;};
if(!Object.entries)Object.entries=function(o){return Object.keys(o).map(function(k){return [k,o[k]];});};
if(!Object.values)Object.values=function(o){return Object.keys(o).map(function(k){return o[k];});};
if(!Object.fromEntries)Object.fromEntries=function(L){var o={};Array.prototype.forEach.call(L,function(p){o[p[0]]=p[1];});return o;};
if(window.Promise&&!Promise.prototype.finally)Promise.prototype.finally=function(f){return this.then(function(v){f();return v;},function(e){f();throw e;});};
if(!window.fetch&&window.XMLHttpRequest&&window.Promise)window.fetch=function(u){return new Promise(function(res,rej){var x=new XMLHttpRequest();x.open('GET',u);x.onload=function(){var t=x.responseText;res({ok:x.status>=200&&x.status<300,status:x.status,json:function(){return Promise.resolve(JSON.parse(t));},text:function(){return Promise.resolve(t);}});};x.onerror=function(){rej(new Error('net'));};x.send();});};
})();
/* src-sha1: ecc29ee6a4572b8c985f944eae1cb7d130e951e4 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
/* لوحة سير المعاملات: السلف · أوامر التغيير · المدد · الاستلام — مرحلة كل معاملة واسم الشركة ومدة بقائها.
   ملف واحد يعمل في ثلاثة أماكن: تبويب «سير المعاملات» في البرنامج (مع النقل بين المراحل)، ونافذة الشاشة الثانية، وشاشة القاعة عبر المتصفح (للعرض فقط). */
(function () {
    'use strict';
    const STAGES = [['rcv', 'استلام'], ['aud', 'تدقيق'], ['rev', 'مراجعة'], ['prt', 'طباعة وتوقيع'], ['done', 'منجزة'], ['ret', 'مُعادة']];
    const SN = Object.fromEntries(STAGES);
    const TYPES = { ad: 'سلفة', co: 'أمر تغيير', du: 'مدة', ac: 'شهادة' };
    const SYSN = { ad: 'لجنة تدقيق السلف', co: 'أوامر التغيير', du: 'المدد والتوقف', ac: 'الاستلام' };
    const DAY = 864e5, DONE_DAYS = 14;
    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const fmtN = n => Math.round(+n || 0).toLocaleString('en-US');
    const CSS = `
.fb,.fbv{--fb-card:#fff;--fb-ink:#1e293b;--fb-mut:#64748b;--fb-line:#e2e8f0;--fb-col:rgba(255,255,255,.6);--fb-ad:#2563eb;--fb-co:#d97706;--fb-du:#059669;--fb-ac:#7c3aed;--fb-late:#dc2626;--fb-ok:#16a34a;--fb-ret:#9333ea;color:var(--fb-ink)}
.fb{display:flex;flex-direction:column;gap:10px;min-height:0}
.fb.dark,.fbv.dark{--fb-card:#131c2e;--fb-ink:#e5e7eb;--fb-mut:#94a3b8;--fb-line:#243047;--fb-col:rgba(255,255,255,.04)}
.fb *{box-sizing:border-box}
.fb-h{display:flex;align-items:center;gap:14px;flex-wrap:wrap}
.fb-h h1{margin:0;font-size:22px}.fb-h .fb-sub{color:var(--fb-mut);font-size:13px}
.fb-h img{height:46px}
.fb-clk{margin-inline-start:auto;text-align:left;font-variant-numeric:tabular-nums}.fb-clk b{display:block;font-size:24px}.fb-clk span{color:var(--fb-mut);font-size:12px}
.fb-k{display:grid;grid-template-columns:repeat(5,1fr);gap:10px}
.fb-k div{background:var(--fb-card);border:1px solid var(--fb-line);border-radius:12px;padding:8px 12px}
.fb-k small{color:var(--fb-mut);font-size:12px}.fb-k b{display:block;font-size:26px;font-variant-numeric:tabular-nums}
.fb-k .l b{color:var(--fb-late)}.fb-k .o b{color:var(--fb-ok)}.fb-k .r b{color:var(--fb-ret)}
.fb-bar{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.fb-bar button,.fb-bar input,.fb-bar select{font:inherit;font-size:13px;border:1px solid var(--fb-line);background:var(--fb-card);color:var(--fb-ink);border-radius:8px;padding:5px 11px;cursor:pointer}
.fb-bar button.on{background:var(--fb-ink);color:var(--fb-card)}.fb-bar input{cursor:text;min-width:220px}.fb-bar .sp{flex:1}
.fb-bar .pri{background:#2f6b34;color:#fff;border-color:#2f6b34}
.fb-lg{display:flex;gap:10px;font-size:12px;color:var(--fb-mut)}.fb-lg i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-inline-end:4px;vertical-align:-1px}
.fb-b{display:grid;grid-template-columns:repeat(6,minmax(190px,1fr));gap:8px;overflow-x:auto;min-height:0;flex:1}
.fb-c{background:var(--fb-col);border:1px solid var(--fb-line);border-radius:14px;display:flex;flex-direction:column;min-height:240px;min-width:0}
.fb-c h3{margin:0;padding:9px 12px;font-size:15px;display:flex;justify-content:space-between;border-bottom:1px solid var(--fb-line)}
.fb-c h3 em{font-style:normal;background:var(--fb-line);border-radius:99px;padding:0 9px;font-size:13px}
.fb-c h3 .fb-pg{margin-inline-start:auto;margin-inline-end:8px;font-size:12px;font-weight:400;color:var(--fb-mut)}
.fb-c.done h3{color:var(--fb-ok)}.fb-c.ret h3{color:var(--fb-ret)}
.fb-l{padding:7px;display:flex;flex-direction:column;gap:7px;overflow-y:auto;max-height:var(--fb-lh,calc(100vh - 330px));flex:1;min-height:0}
.fb-e{color:var(--fb-mut);font-size:13px;text-align:center;padding:14px}
.fb-x{background:var(--fb-card);border:1px solid var(--fb-line);border-inline-start:5px solid var(--t);border-radius:10px;padding:7px 9px;cursor:pointer;transition:transform .15s,box-shadow .15s}
.fb-x:hover{transform:translateY(-2px);box-shadow:0 6px 16px rgba(0,0,0,.08)}
.fb-x.ad{--t:var(--fb-ad)}.fb-x.co{--t:var(--fb-co)}.fb-x.du{--t:var(--fb-du)}.fb-x.ac{--t:var(--fb-ac)}
.fb-x .t{display:flex;justify-content:space-between;gap:6px;font-size:12px;color:var(--fb-mut)}.fb-x .ty{color:var(--t);font-weight:700}
.fb-x .cn{font-weight:700;font-size:15px;margin:3px 0 1px}
.fb-x .pj{font-size:12.5px;color:var(--fb-mut);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fb-x .f{display:flex;justify-content:space-between;align-items:center;gap:6px;margin-top:5px;font-size:12px}
.fb-x .f>span:first-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fb-d{border-radius:99px;padding:1px 8px;background:var(--fb-line);white-space:nowrap;flex-shrink:0}
.fb-x.late .fb-d{background:var(--fb-late);color:#fff}.fb-x.late{box-shadow:0 0 0 1px rgba(220,38,38,.35)}
.fb-x .why{font-size:12px;color:var(--fb-ret);margin-top:3px}
.fb-x.new{animation:fbflash 1.8s}@keyframes fbflash{0%{box-shadow:0 0 0 4px rgba(37,99,235,.6)}100%{box-shadow:none}}
.fb-tk{background:var(--fb-ink);color:var(--fb-card);font-size:13px;padding:6px 14px;border-radius:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fb-tk span{padding-inline-end:40px}
.fb-ov{position:fixed;inset:0;background:rgba(15,23,42,.45);display:flex;align-items:center;justify-content:center;padding:16px;z-index:50}
.fb-dl{background:var(--fb-card,#fff);color:var(--fb-ink,#1e293b);border-radius:14px;width:min(560px,100%);padding:16px 18px;max-height:90vh;overflow:auto}
.fb-dl h2{margin:0 0 4px;font-size:19px}.fb-dl .m{color:var(--fb-mut);font-size:13px;margin-bottom:10px}
.fb-dl table{width:100%;border-collapse:collapse;font-size:13px}.fb-dl td,.fb-dl th{border-bottom:1px solid var(--fb-line);padding:6px 4px;text-align:right;vertical-align:top}
.fb-st{display:flex;gap:4px;margin:8px 0 12px}.fb-st i{flex:1;height:7px;border-radius:9px;background:var(--fb-line)}.fb-st i.on{background:var(--fb-ok)}
.fb-dl .a{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-top:12px}
.fb-dl button,.fb-dl input,.fb-dl select,.fb-dl textarea{font:inherit;font-size:14px;border:1px solid var(--fb-line);background:var(--fb-card);color:var(--fb-ink);border-radius:8px;padding:6px 12px}
.fb-dl button{cursor:pointer}.fb-dl .pri{background:var(--fb-ok);color:#fff;border-color:var(--fb-ok)}.fb-dl .rt{color:var(--fb-ret);border-color:var(--fb-ret)}.fb-dl .dg{color:#b42318}
.fb-dl textarea,.fb-dl input[type=text],.fb-dl input[type=password],.fb-dl input:not([type]){width:100%}
.fb-dl .er{color:#b42318;font-size:13px;min-height:18px;margin-top:6px}
.fb-dl .ln{font-size:12px;color:var(--fb-mut)}
.fb-cl{list-style:none;margin:8px 0 0;padding:0;max-height:50vh;overflow:auto}.fb-cl li{display:flex;justify-content:space-between;gap:8px;align-items:center;border-bottom:1px solid var(--fb-line);padding:6px 2px;font-size:13px}
.fb.big .fb-x .cn{font-size:18px}.fb.big .fb-x .pj,.fb.big .fb-x .t,.fb.big .fb-x .f{font-size:14px}.fb.big .fb-c h3{font-size:18px}.fb.big .fb-k b{font-size:32px}
.fb-annov{position:fixed;inset:0;z-index:60;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;padding:4vh 6vw;text-align:center;color:#fff;background:var(--ab,#0f2a4a)}
.fb-annov.imp{--ab:#7a4b00}.fb-annov.urg{--ab:#7f1d1d}.fb-annov.info{--ab:#0f2a4a}
.fb-annov .ah{display:flex;align-items:center;gap:14px;font-size:clamp(18px,2.2vw,30px);font-weight:700;opacity:.95}.fb-annov .ah img{height:clamp(48px,7vh,90px)}
.fb-annov .al{display:inline-block;background:rgba(255,255,255,.18);border-radius:99px;padding:3px 16px;font-size:clamp(14px,1.5vw,20px)}
.fb-annov .at{font-size:clamp(28px,4.4vw,72px);font-weight:700;line-height:1.5;white-space:pre-wrap;max-width:92vw;max-height:56vh;overflow:auto}
.fb-annov .at.sm{font-size:clamp(18px,2.4vw,36px);max-height:14vh}.fb-annov .aimgw{display:flex;flex-direction:column;align-items:center;gap:8px;max-width:94vw}.fb-annov .aimg{max-height:60vh;max-width:92vw;object-fit:contain;border-radius:10px;background:#fff;box-shadow:0 8px 30px rgba(0,0,0,.45)}.fb-annov .apn{display:flex;align-items:center;gap:12px;font-size:clamp(14px,1.4vw,20px)}.fb-annov .apn button,.fb-annov .apdf{font-size:16px;padding:4px 16px;background:rgba(255,255,255,.15);color:#fff;border:1px solid rgba(255,255,255,.6)}.fb-annov .aimgw small{opacity:.8}
.fb-annov .af{font-size:clamp(13px,1.3vw,18px);opacity:.85}.fb-annov button{font:inherit;font-size:20px;padding:10px 36px;border-radius:12px;border:2px solid #fff;background:#fff;color:#0f2a4a;font-weight:700;cursor:pointer}
.fb-anb{display:flex;flex-direction:column;gap:6px}.fb-anb>div{display:flex;align-items:center;gap:10px;flex-wrap:wrap;border-radius:10px;padding:8px 12px;color:#fff;background:#0f2a4a}
.fb-anb>div.imp{background:#7a4b00}.fb-anb>div.urg{background:#7f1d1d}.fb-anb .t{flex:1;min-width:200px;font-weight:700;white-space:pre-wrap}.fb-anb small{opacity:.85}
.fb-anb button{font:inherit;font-size:12.5px;border:1px solid rgba(255,255,255,.6);background:transparent;color:#fff;border-radius:7px;padding:3px 10px;cursor:pointer}
@media (max-width:900px){.fb-k{grid-template-columns:repeat(2,1fr)}.fb-b{grid-template-columns:repeat(6,82vw)}}
`;
    const ANN_LV = { info: 'تبليغ', imp: 'مهم', urg: 'عاجل' };
    const fmtHM = t => { try {
        const d = new Date(t), now = new Date();
        const sameDay = d.toDateString() === now.toDateString();
        return (sameDay ? '' : d.toLocaleDateString('ar-IQ', { day: 'numeric', month: 'numeric' }) + ' ') + d.toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' });
    }
    catch (_) {
        return '';
    } };
    const leftTxt = t => { const m = Math.max(0, Math.round((t - Date.now()) / 60000)); return m < 60 ? m + ' دقيقة' : m < 1440 ? Math.floor(m / 60) + ' ساعة' + (m % 60 ? ' و' + (m % 60) + ' دقيقة' : '') : Math.round(m / 1440) + ' يوم'; };
    /* مرفق التبليغ (صورة أو صفحات PDF): الصفحة الأولى، مع التنقل بين الصفحات (وتتقلّب وحدها على شاشات العرض)، وفتح PDF الأصلي في البرنامج */
    const annSrc = (a, i, o) => o.pages ? o.pages[i] : (o.imgBase || 'anbar-ann://f/') + encodeURIComponent(a.id) + '/' + i + '.jpg';
    function annAtt(a, o) {
        const t = a.att;
        if (!t || !t.n)
            return '';
        if (o.pages)
            window.__annPrevPages = o.pages;
        return `<div class="aimgw" data-annpages="${t.n}" data-pg="0" data-annsrc="${esc(o.pages ? 'prev' : (o.imgBase || 'anbar-ann://f/') + encodeURIComponent(a.id) + '/')}"><img class="aimg" src="${esc(annSrc(a, 0, o))}" alt="${esc(t.name || 'مرفق التبليغ')}">
    ${t.n > 1 ? `<div class="apn"><button data-annpg="-1" aria-label="الصفحة السابقة">▶ السابقة</button><span>1 / ${t.n}</span><button data-annpg="1" aria-label="الصفحة التالية">التالية ◀</button></div>` : ''}
    ${t.total > t.n ? `<small>تُعرض أول ${t.n} صفحة من ${t.total}${t.pdf ? ' — الملف كاملاً من «فتح ملف PDF الأصلي»' : ''}</small>` : ''}
    ${t.pdf && o.pdfOpen ? `<button class="apdf" data-annpdf="${esc(a.id)}">📄 فتح ملف PDF الأصلي</button>` : ''}</div>`;
    }
    /* تجهيز المرفق في البرنامج قبل النشر: الصورة تُصغَّر إلى 2000 بكسل (JPEG)، وPDF تُرسم صفحاته (حتى 12) صوراً بـ pdf.js المضمَّن ويُحفظ الأصل (حتى 12 م.ب) */
    const ANN_MAXP = 12;
    function loadPdfJs() {
        if (window.pdfjsLib)
            return Promise.resolve(window.pdfjsLib);
        return new Promise((res, rej) => {
            const s = document.createElement('script');
            s.src = 'vendor/pdfjs/pdf.min.js';
            s.onload = () => { try {
                window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdfjs/pdf.worker.min.js';
                res(window.pdfjsLib);
            }
            catch (e) {
                rej(e);
            } };
            s.onerror = () => rej(new Error('تعذّر تحميل قارئ PDF'));
            document.head.appendChild(s);
        });
    }
    function toJpeg(cv) { let q = 0.86, u = cv.toDataURL('image/jpeg', q); while (u.length * 0.75 > 2.6 * 1024 * 1024 && q > 0.45) {
        q -= 0.12;
        u = cv.toDataURL('image/jpeg', q);
    } return u; }
    function annFile(f, prog) {
        return __awaiter(this, void 0, void 0, function* () {
            const nm = f.name || 'مرفق', isPdf = /pdf$/i.test(f.type) || /\.pdf$/i.test(nm);
            if (!isPdf && !/^image\//.test(f.type))
                throw new Error('المرفق يجب أن يكون ملف PDF أو صورة (JPG / PNG)');
            if (f.size > 40 * 1024 * 1024)
                throw new Error('الملف أكبر من 40 م.ب');
            if (!isPdf) {
                const bm = yield createImageBitmap(f);
                const k = Math.min(1, 2000 / Math.max(bm.width, bm.height));
                const cv = document.createElement('canvas');
                cv.width = Math.round(bm.width * k);
                cv.height = Math.round(bm.height * k);
                const g = cv.getContext('2d');
                g.fillStyle = '#fff';
                g.fillRect(0, 0, cv.width, cv.height);
                g.drawImage(bm, 0, 0, cv.width, cv.height);
                return { type: 'img', name: nm, pages: [toJpeg(cv)], total: 1 };
            }
            const buf = yield f.arrayBuffer();
            const lib = yield loadPdfJs();
            const doc = yield lib.getDocument({ data: new Uint8Array(buf.slice(0)) }).promise;
            const N = doc.numPages, pages = [];
            for (let i = 1; i <= Math.min(N, ANN_MAXP); i++) {
                if (prog)
                    prog(`جارٍ تجهيز صفحات PDF… ${i} / ${Math.min(N, ANN_MAXP)}`);
                const pg = yield doc.getPage(i);
                const v0 = pg.getViewport({ scale: 1 });
                const v = pg.getViewport({ scale: Math.min(3, 1700 / Math.max(v0.width, v0.height)) });
                const cv = document.createElement('canvas');
                cv.width = Math.round(v.width);
                cv.height = Math.round(v.height);
                const g = cv.getContext('2d');
                g.fillStyle = '#fff';
                g.fillRect(0, 0, cv.width, cv.height);
                yield pg.render({ canvasContext: g, viewport: v }).promise;
                pages.push(toJpeg(cv));
            }
            let pdf = '';
            if (buf.byteLength <= 12 * 1024 * 1024) {
                let bin = '';
                const u8 = new Uint8Array(buf);
                for (let i = 0; i < u8.length; i += 32768)
                    bin += String.fromCharCode.apply(null, u8.subarray(i, i + 32768));
                pdf = btoa(bin);
            }
            return { type: 'pdf', name: nm, pages, pdf, total: N };
        });
    }
    function annPage(w, d) {
        if (!w)
            return;
        const n = +w.dataset.annpages || 1, pg = ((+w.dataset.pg || 0) + d + n) % n;
        w.dataset.pg = pg;
        const b = w.dataset.annsrc;
        const img = w.querySelector('.aimg');
        if (img)
            img.src = b === 'prev' ? (window.__annPrevPages || [])[pg] : b + pg + '.jpg';
        const sp = w.querySelector('.apn span');
        if (sp)
            sp.textContent = (pg + 1) + ' / ' + n;
    }
    if (!window.__annPgBound) {
        window.__annPgBound = 1;
        document.addEventListener('click', e => {
            const b = e.target.closest('[data-annpg]');
            if (b) {
                annPage(b.closest('.aimgw'), +b.dataset.annpg);
                return;
            }
            const p = e.target.closest('[data-annpdf]');
            if (p && window.desktop && window.desktop.wfAnnPdf)
                window.desktop.wfAnnPdf(p.dataset.annpdf).then(r => { if (r === 'missing')
                    alert('ملف PDF الأصلي لم يصل بعد إلى هذه الحاسبة (المزامنة)'); });
        });
    }
    /* شاشة التبليغ بملء الشاشة (تُستعمل في اللوحة وشاشاتها وفوق البرنامج في كل الحاسبات) */
    function annHtml(a, o) {
        o = o || {};
        return `<div class="fb-annov ${esc(a.level || 'info')}" role="alertdialog" aria-live="assertive" data-ann="${esc(a.id)}">
    <div class="ah">${o.logo ? `<img src="${esc(o.logo)}" alt="">` : ''}<span>📢 تبليغ من مدير قسم الشؤون الهندسية — إلى كافة اللجان</span></div>
    <span class="al">${esc(ANN_LV[a.level] || 'تبليغ')}</span>
    ${a.text ? `<div class="at${a.att && a.att.n ? ' sm' : ''}">${esc(a.text)}</div>` : ''}${annAtt(a, o)}
    <div class="af">صدر ${esc(fmtHM(a.from))}${a.by ? ' — ' + esc(a.by) : ''} · يبقى معروضاً حتى ${esc(fmtHM(a.until))}</div>
    ${o.button ? `<button data-annok>${esc(o.button)}</button>` : ''}</div>`;
    }
    const activeAnns = d => (d && Array.isArray(d.anns) ? d.anns : []).filter(a => !a.hidden && +a.until > Date.now());
    function injectCss() { if (document.getElementById('fbCss'))
        return; const s = document.createElement('style'); s.id = 'fbCss'; s.textContent = CSS; document.head.appendChild(s); }
    const dTxt = d => d < 1 ? 'اليوم' : d === 1 ? 'منذ يوم' : d === 2 ? 'منذ يومين' : d <= 10 ? 'منذ ' + d + ' أيام' : 'منذ ' + d + ' يوماً';
    const title = c => TYPES[c.sys] + (c.no ? ' ' + c.no : '');
    const amtTxt = c => c.sys === 'du' ? (c.days ? c.days + ' يوماً' : '') : (c.amt != null && c.amt !== 0 ? fmtN(c.amt) + ' د.ع' : '');
    const fmtT = t => { try {
        return new Date(t).toLocaleString('ar-IQ', { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    }
    catch (_) {
        return '';
    } };
    function mount(root, api, opt) {
        opt = opt || {};
        injectCss();
        let data = { cards: [], late: 5 }, F = 'all', Q = '', prevKeys = null, fresh = new Set(), clkT = null;
        const edit = !!opt.edit;
        root.classList.add('fb');
        if (opt.dark)
            root.classList.add('dark');
        if (opt.big)
            root.classList.add('big');
        root.innerHTML = `
    ${opt.header ? `<header class="fb-h">${opt.logo ? `<img src="${opt.logo}" alt="">` : ''}<div><h1>لوحة سير المعاملات — الشؤون الهندسية</h1><div class="fb-sub">السلف · أوامر التغيير · المدد · الاستلام — تتحدّث تلقائياً من حاسبات القسم</div></div><div class="fb-clk"><b data-fb="clk"></b><span data-fb="dt"></span></div></header>` : ''}
    <div class="fb-anb" data-fb="anb"></div>
    <section class="fb-k" data-fb="k"></section>
    <div class="fb-bar">
      <button data-f="all" class="on">الكل</button><button data-f="ad">السلف</button><button data-f="co">أوامر التغيير</button><button data-f="du">المدد</button><button data-f="ac">الاستلام</button><button data-f="late">المتأخرة فقط</button>
      <input data-fb="q" placeholder="بحث: اسم الشركة، المشروع، رقم الاضبارة…">
      <span class="sp"></span>
      <span class="fb-lg"><span><i style="background:var(--fb-ad)"></i>سلفة</span><span><i style="background:var(--fb-co)"></i>أمر تغيير</span><span><i style="background:var(--fb-du)"></i>مدة</span><span><i style="background:var(--fb-ac)"></i>شهادة استلام</span></span>
      ${edit ? `<span class="fb-lr" title="المعاملة تُعدّ متأخرة إذا مضى على استلامها (تاريخ استلام الذمة) أكثر من هذه المدة ولم تُنجز">⏱ متأخرة بعد: السلف والمدد 15 يوماً، أوامر التغيير 30، الاستلام 30 يوماً من الاستلام</span>
      <button class="pri" data-fb="ann" title="تبليغ من مدير القسم يظهر بملء الشاشة على كل الحاسبات وشاشات اللوحة لمدة تحددها (بكلمة سر المدير)" style="background:#0f2a4a;border-color:#0f2a4a">📢 تبليغ</button>
      <button class="pri" data-fb="add" title="إضافة معاملة موجودة في السلف أو أوامر التغيير أو المدد إلى اللوحة">＋ إضافة معاملة</button>
      <button data-fb="disp" title="فتح اللوحة بملء الشاشة على الشاشة الثانية الموصولة بهذه الحاسبة (للعرض فقط)">🖥 شاشة ثانية</button>
      <button data-fb="web" title="عرض اللوحة على تلفاز القاعة أو أي حاسبة في الشبكة الداخلية عبر المتصفح (للعرض فقط وبلا مبالغ)">📺 شاشة القاعة</button>` : ''}
      ${opt.toggles ? `<button data-fb="dark">داكن / فاتح</button><button data-fb="fs">ملء الشاشة</button>` : ''}
    </div>
    <main class="fb-b" data-fb="b"></main>
    <div class="fb-tk" data-fb="tk">—</div>`;
        const $ = k => root.querySelector(`[data-fb="${k}"]`);
        const since = c => c.since || c.updated || c.created || 0;
        const daysIn = c => Math.floor((Date.now() - since(c)) / DAY);
        /* التأخر: أيام منذ استلام المعاملة (تاريخ استلام الذمة) ما لم تُنجز — لكل نظام حدّه: السلف والمدد 15، أوامر التغيير والاستلام 30 */
        const recvAt = c => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(c.recv || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3]).getTime() : (c.created || since(c)); };
        const ageOf = c => Math.floor((Date.now() - recvAt(c)) / DAY);
        const limOf = c => (data.lateBy && data.lateBy[c.sys]) || data.late;
        const isLate = c => !['done', 'ret'].includes(c.st) && (data.lateBy ? ageOf(c) > limOf(c) : daysIn(c) > data.late);
        function show(c) {
            if (c.st === 'done' && Date.now() - since(c) > DONE_DAYS * DAY)
                return false;
            if (F === 'late' && !isLate(c))
                return false;
            if (F !== 'all' && F !== 'late' && c.sys !== F)
                return false;
            if (Q && !((c.co || '') + ' ' + (c.pj || '') + ' ' + (c.fn || '') + ' ' + title(c)).includes(Q))
                return false;
            return true;
        }
        function render() {
            const C = data.cards || [];
            const keepTop = {};
            if (!edit)
                root.querySelectorAll('[data-fb="b"] .fb-c').forEach(sc => { const l = sc.querySelector('.fb-l'); if (l)
                    keepTop[sc.dataset.st] = l.scrollTop; }); // شاشات العرض: لا يرجع العمود إلى أوله مع كل تحديث
            $('b').innerHTML = STAGES.map(([k, n]) => {
                const L = C.filter(c => c.st === k && show(c)).sort((a, b) => (isLate(b) - isLate(a)) || (k === 'done' ? since(b) - since(a) : since(a) - since(b)));
                return `<section class="fb-c ${k}" data-st="${k}"><h3>${n}${edit ? '' : '<small class="fb-pg"></small>'}<em>${L.length}</em></h3><div class="fb-l">${L.map(c => {
                    const last = (c.hist || [])[c.hist.length - 1] || {}, a = amtTxt(c);
                    return `<div class="fb-x ${c.sys}${isLate(c) ? ' late' : ''}${fresh.has(c.key) ? ' new' : ''}" data-k="${esc(c.key)}" tabindex="0">
          <div class="t"><span class="ty">${esc(title(c))}</span><span>${c.fn ? 'اضبارة ' + esc(c.fn) : '<i>بلا اضبارة</i>'}</span></div>
          <div class="cn">${esc(c.co || '— الشركة غير مكتوبة —')}</div>
          <div class="pj" title="${esc(c.pj)}">${esc(c.pj || '—')}</div>
          ${c.st === 'ret' && last.why ? `<div class="why">↩ ${esc(last.why)}</div>` : ''}
          <div class="f"><span>${esc(c.eng || '')}${a ? ` · ${esc(a)}` : ''}</span><span class="fb-d" title="${isLate(c) ? 'متأخرة: مضى على استلامها ' + ageOf(c) + ' يوماً (الحد ' + limOf(c) + ')' : 'في مرحلتها'}">${isLate(c) ? '⚠ ' + ageOf(c) + ' يوماً' : dTxt(daysIn(c))}</span></div></div>`;
                }).join('') || '<div class="fb-e">لا توجد معاملات</div>'}</div></section>`;
            }).join('');
            if (!edit) {
                root.querySelectorAll('[data-fb="b"] .fb-c').forEach(sc => { const l = sc.querySelector('.fb-l'); if (l && keepTop[sc.dataset.st] != null)
                    l.scrollTop = keepTop[sc.dataset.st]; });
                pgMarks();
            }
            const open = C.filter(c => !['done', 'ret'].includes(c.st)), d0 = new Date();
            d0.setHours(0, 0, 0, 0);
            $('k').innerHTML = `<div><small>معاملات قيد العمل</small><b>${open.length}</b></div><div><small>وردت اليوم</small><b>${C.filter(c => (c.created || 0) >= d0.getTime()).length}</b></div>
      <div class="l"><small>متأخرة (السلف والمدد بعد 15 يوماً، الأوامر والاستلام بعد 30 من الاستلام)</small><b>${C.filter(isLate).length}</b></div><div class="o"><small>أُنجزت هذا الأسبوع</small><b>${C.filter(c => c.st === 'done' && Date.now() - since(c) < 7 * DAY).length}</b></div>
      <div class="r"><small>مُعادة للاستكمال</small><b>${C.filter(c => c.st === 'ret').length}</b></div>`;
            const ev = [];
            C.forEach(c => (c.hist || []).forEach(h => ev.push({ c, h })));
            ev.sort((a, b) => b.h.at - a.h.at);
            $('tk').innerHTML = ev.length ? ev.slice(0, 6).map(({ c, h }) => `<span>${esc(fmtT(h.at))} — ${esc(title(c))} / ${esc(c.co || '')} / اضبارة ${esc(c.fn || '—')} ← ${esc(SN[h.s] || '')}${h.by ? ' (' + esc(h.by) + ')' : ''}</span>`).join('') : 'لا حركة بعد — تظهر هنا آخر التنقلات بين المراحل';
            const AA = activeAnns(data);
            if (edit)
                $('anb').innerHTML = AA.map(a => `<div class="${esc(a.level || 'info')}"><span>📢 ${esc(ANN_LV[a.level] || 'تبليغ')}</span><span class="t">${esc(a.text || '')}${a.att && a.att.n ? ` 📎 ${esc(a.att.type === 'pdf' ? 'PDF' : 'صورة')}: ${esc(a.att.name || '')}` : ''}</span><small>متبقٍّ ${esc(leftTxt(a.until))}</small><button data-annshow="${esc(a.id)}">عرض بملء الشاشة</button><button data-annhide="${esc(a.id)}">إخفاء</button></div>`).join('');
            else {
                $('anb').innerHTML = '';
                showAnnOverlay(AA);
            }
            if (edit && $('late'))
                $('late').value = String(data.late);
            if (edit && $('web'))
                $('web').classList.toggle('on', !!(data.web && data.web.on));
            if (opt.onRender)
                opt.onRender(data);
        }
        let annIdx = 0, annRot = null;
        function showAnnOverlay(AA) {
            const old = root.querySelector('.fb-annov');
            if (!AA.length) {
                if (old)
                    old.remove();
                clearInterval(annRot);
                annRot = null;
                return;
            }
            const a = AA[annIdx % AA.length], html = annHtml(a, { logo: opt.logo, imgBase: opt.imgBase });
            if (!old || old.dataset.ann !== a.id) {
                if (old)
                    old.remove();
                root.insertAdjacentHTML('beforeend', html);
            }
            if (AA.length > 1 && !annRot)
                annRot = setInterval(() => { annIdx++; render(); }, 15000);
            if (AA.length < 2 && annRot) {
                clearInterval(annRot);
                annRot = null;
            }
        }
        function refresh() {
            return __awaiter(this, void 0, void 0, function* () {
                let d;
                try {
                    d = yield api.board();
                }
                catch (_) {
                    return;
                }
                if (!d || !Array.isArray(d.cards))
                    return;
                const keys = new Set(d.cards.map(c => c.key + '|' + c.st));
                fresh = new Set(prevKeys ? d.cards.filter(c => !prevKeys.has(c.key + '|' + c.st)).map(c => c.key) : []);
                prevKeys = keys;
                data = d;
                render();
            });
        }
        function clock() { if (!$('clk'))
            return; const d = new Date(); $('clk').textContent = d.toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' }); $('dt').textContent = d.toLocaleDateString('ar-IQ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); }
        clock();
        clkT = setInterval(() => { clock(); }, 15000);
        setInterval(() => { if (!document.hidden && root.offsetParent !== null)
            render(); }, 60000);
        if (!edit)
            setInterval(() => { const w = root.querySelector(':scope > .fb-annov .aimgw'); if (w && +w.dataset.annpages > 1)
                annPage(w, 1); }, 12000); // صفحات المرفق تتقلّب على شاشات العرض
        setInterval(() => { const ov = root.querySelector(':scope > .fb-annov'); if (ov && !activeAnns(data).some(z => z.id === ov.dataset.ann))
            render(); }, 10000); // انتهاء مدة التبليغ على شاشات العرض   // عدّاد الأيام يتقدّم دون طلب بيانات
        /* شاشات العرض (الشاشة الثانية وتلفاز القاعة): العمود الذي لا تتسع له بطاقاته يتقلّب صفحةً صفحة كل 8 ثوانٍ ثم يعود إلى أوله،
           فتظهر كل المعاملات (مثلاً 50 شهادة استلام) لا الخمس الأولى فقط؛ وبجانب اسم المرحلة رقم الصفحة. يتوقف دقيقة إن مرّر أحد العمود بيده. */
        function pgMarks() {
            root.querySelectorAll('[data-fb="b"] .fb-c').forEach(sc => {
                const l = sc.querySelector('.fb-l'), m = sc.querySelector('.fb-pg');
                if (!l || !m)
                    return;
                const step = Math.max(1, l.clientHeight - 24), n = l.scrollHeight > l.clientHeight + 4 ? Math.ceil((l.scrollHeight - 4) / step) : 1, i = Math.min(n, Math.floor((l.scrollTop + 4) / step) + 1);
                m.textContent = n > 1 ? `صفحة ${i} من ${n}` : '';
            });
        }
        if (!edit) {
            let hold = 0;
            root.addEventListener('wheel', () => { hold = Date.now() + 60000; }, { passive: true });
            root.addEventListener('scroll', e => { if (e.target.classList && e.target.classList.contains('fb-l'))
                pgMarks(); }, true);
            setInterval(() => {
                if (document.hidden || Date.now() < hold || root.querySelector(':scope > .fb-annov'))
                    return;
                root.querySelectorAll('[data-fb="b"] .fb-l').forEach(l => {
                    if (l.scrollHeight <= l.clientHeight + 4)
                        return;
                    const atEnd = l.scrollTop + l.clientHeight >= l.scrollHeight - 4;
                    l.scrollTo({ top: atEnd ? 0 : l.scrollTop + Math.max(1, l.clientHeight - 24), behavior: 'smooth' });
                });
                setTimeout(pgMarks, 900);
            }, +(opt.pageMs || 8000));
            window.addEventListener('resize', () => setTimeout(pgMarks, 300));
        }
        root.addEventListener('click', e => {
            const f = e.target.closest('[data-f]');
            if (f && root.contains(f)) {
                F = f.dataset.f;
                root.querySelectorAll('[data-f]').forEach(b => b.classList.toggle('on', b === f));
                render();
                return;
            }
            const sh = e.target.closest('[data-annshow]');
            if (sh) {
                const a = activeAnns(data).find(z => z.id === sh.dataset.annshow);
                if (a) {
                    const D = dlg('');
                    D.ov.innerHTML = annHtml(a, { logo: opt.logo, imgBase: opt.imgBase, pdfOpen: true, button: 'إغلاق المعاينة' });
                    D.ov.querySelector('[data-annok]').onclick = D.close;
                }
                return;
            }
            const hd = e.target.closest('[data-annhide]');
            if (hd) {
                annHideDlg(hd.dataset.annhide);
                return;
            }
            const x = e.target.closest('.fb-x');
            if (x) {
                openCard(x.dataset.k);
                return;
            }
            const b = e.target.closest('[data-fb]');
            if (!b)
                return;
            const k = b.dataset.fb;
            if (k === 'add')
                addDlg();
            if (k === 'ann')
                annDlg();
            if (k === 'disp')
                api.display().then(r => { if (r && r.open && !r.second)
                    toast('لا توجد شاشة ثانية موصولة: فُتحت اللوحة في نافذة مستقلة يمكن سحبها إلى أي شاشة.'); });
            if (k === 'web')
                webDlg();
            if (k === 'dark')
                root.classList.toggle('dark');
            if (k === 'fs') {
                document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen().catch(() => { });
            }
        });
        root.addEventListener('keydown', e => { if (e.key === 'Enter') {
            const x = e.target.closest && e.target.closest('.fb-x');
            if (x)
                openCard(x.dataset.k);
        } });
        $('q').addEventListener('input', e => { Q = e.target.value.trim(); render(); });
        if (edit && $('late'))
            $('late').addEventListener('change', e => api.late(+e.target.value).then(refresh));
        /* ---------- النوافذ ---------- */
        function dlg(html) {
            const ov = document.createElement('div');
            ov.className = 'fb-ov';
            ov.innerHTML = `<div class="fb-dl fbv${root.classList.contains('dark') ? ' dark' : ''}">${html}</div>`;
            document.body.appendChild(ov);
            if (api.modal)
                api.modal(true);
            const close = () => { ov.remove(); if (api.modal)
                api.modal(false); };
            ov.addEventListener('click', e => { if (e.target === ov || e.target.closest('[data-x]'))
                close(); });
            ov.addEventListener('keydown', e => { if (e.key === 'Escape')
                close(); });
            return { ov, el: ov.firstElementChild, close };
        }
        function toast(m) { if (opt.toast)
            opt.toast(m);
        else {
            const d = dlg(`<p>${esc(m)}</p><div class="a"><button data-x>حسناً</button></div>`);
            d.el.querySelector('button').focus();
        } }
        /* عند الحاجة: كلمة سر النظام أو اسم المعدِّل، ثم إعادة المحاولة */
        function guarded(D, run, act) {
            return __awaiter(this, void 0, void 0, function* () {
                const r = yield run();
                if (!r || !r.error)
                    return r;
                const er = D.el.querySelector('.er');
                if (r.error === 'locked') {
                    const box = D.el.querySelector('.auth');
                    box.hidden = false;
                    box.innerHTML = `<p class="ln">${esc(act || 'النقل')} يحتاج فتح نظام «${esc(SYSN[r.sys] || r.sys)}» على هذه الحاسبة: اكتب كلمة سر «${esc(SYSN[r.sys] || r.sys)}» نفسها (التي يُفتح بها النظام) أو كلمة سر المدير.</p><input type="password" data-pw placeholder="كلمة سر «${esc(SYSN[r.sys] || r.sys)}» أو كلمة سر المدير" autocomplete="off"><div class="a"><button class="pri" data-ok>فتح ومتابعة</button></div><div class="er" data-pwer></div>`;
                    const pw = box.querySelector('[data-pw]');
                    pw.focus();
                    return new Promise(res => {
                        const go = () => __awaiter(this, void 0, void 0, function* () { const ok = yield api.unlock(r.sys, pw.value); if (ok === true) {
                            box.hidden = true;
                            res(guarded(D, run, act));
                        }
                        else {
                            const m = ok === 'wait' ? 'محاولات كثيرة خاطئة — انتظر 30 ثانية ثم أعد المحاولة' : `كلمة السر غير صحيحة — اكتب كلمة سر «${SYSN[r.sys] || r.sys}» على هذه الحاسبة (وتأكد من لغة لوحة المفاتيح) أو كلمة سر المدير`;
                            box.querySelector('[data-pwer]').textContent = m;
                            er.textContent = '';
                            pw.value = '';
                            pw.focus();
                        } });
                        box.querySelector('[data-ok]').onclick = go;
                        pw.onkeydown = e => { if (e.key === 'Enter')
                            go(); };
                    });
                }
                if (r.error === 'who') {
                    const box = D.el.querySelector('.auth');
                    box.hidden = false;
                    box.innerHTML = `<p class="ln">اكتب اسمك الثلاثي: يُسجَّل مع كل نقل في مسار المعاملة وفي سجل التعديلات.</p><input data-who autocomplete="off"><div class="a"><button class="pri" data-ok>حفظ ومتابعة</button></div>`;
                    const w = box.querySelector('[data-who]');
                    w.focus();
                    return new Promise(res => {
                        const go = () => __awaiter(this, void 0, void 0, function* () { if (!w.value.trim())
                            return; yield api.setWho(w.value.trim()); box.hidden = true; res(guarded(D, run, act)); });
                        box.querySelector('[data-ok]').onclick = go;
                        w.onkeydown = e => { if (e.key === 'Enter')
                            go(); };
                    });
                }
                er.textContent = r.error;
                return r;
            });
        }
        function openCard(k) {
            const c = (data.cards || []).find(x => x.key === k);
            if (!c)
                return;
            const si = STAGES.findIndex(s => s[0] === c.st), nxt = c.st === 'ret' ? 'aud' : si < 4 ? STAGES[si + 1][0] : '';
            const a = amtTxt(c);
            const D = dlg(`<h2>${esc(title(c))} — ${esc(c.co || '')}</h2>
      ${c.recv ? `<div class="m"><b>تاريخ استلام الذمة: ${esc(c.recv)}</b></div>` : ''}
      <div class="m">${esc(c.pj || '')}${c.fn ? ' · اضبارة ' + esc(c.fn) : ''}${c.form ? ' · استمارة ' + esc(c.form) : ''}${a ? ' · ' + esc((c.amtL ? c.amtL + ': ' : '') + a) : ''}${c.eng ? ' · ' + esc(c.eng) : ''}</div>
      <div class="fb-st">${STAGES.slice(0, 5).map((s, i) => `<i class="${c.st !== 'ret' && i <= si ? 'on' : ''}" title="${s[1]}"></i>`).join('')}</div>
      <table><tr><th>المرحلة</th><th>التاريخ</th><th>بواسطة</th></tr>${(c.hist || []).map(h => `<tr><td>${esc(SN[h.s] || h.s)}${h.auto ? ' <span class="ln">(تلقائي)</span>' : ''}${h.why ? `<div class="ln">${esc(h.why)}</div>` : ''}</td><td>${esc(fmtT(h.at))}</td><td>${esc(h.by || '')}${h.dev ? `<div class="ln">${esc(h.dev)}</div>` : ''}</td></tr>`).join('')}</table>
      ${edit ? `<div class="a">${nxt ? `<button class="pri" data-to="${nxt}">نقل إلى «${SN[nxt]}»</button>` : ''}
        <select data-sel><option value="">نقل إلى مرحلة أخرى…</option>${STAGES.filter(s => s[0] !== c.st && s[0] !== 'ret').map(s => `<option value="${s[0]}">${s[1]}</option>`).join('')}</select>
        ${c.st !== 'ret' && c.st !== 'done' ? '<button class="rt" data-ret>↩ إرجاع للاستكمال</button>' : ''}
        <button data-open>فتح في ${esc(SYSN[c.sys])}</button>
        <button class="dg" data-rm title="إزالة البطاقة من اللوحة فقط — لا تُحذف المعاملة من النظام">إزالة من اللوحة</button><button data-x>إغلاق</button></div>
        <div class="retbox" hidden><textarea rows="2" data-why placeholder="سبب الإرجاع (يظهر على البطاقة)"></textarea><div class="a"><button class="rt" data-retok>تأكيد الإرجاع</button></div></div>
        <div class="auth" hidden></div><div class="er"></div>
        <p class="ln">تغيير «الحالة» داخل السلف أو أوامر التغيير إلى «قيد المراجعة» أو «مكتمل» ينقل البطاقة تلقائياً.</p>` : '<div class="a"><button data-x>إغلاق</button></div>'}`);
            if (!edit)
                return;
            const mv = (to, why) => __awaiter(this, void 0, void 0, function* () { const r = yield guarded(D, () => api.move(k, to, why)); if (r && r.ok) {
                D.close();
                refresh();
            } });
            D.el.addEventListener('click', e => {
                const t = e.target;
                if (t.dataset.to)
                    mv(t.dataset.to);
                if (t.hasAttribute('data-ret')) {
                    D.el.querySelector('.retbox').hidden = false;
                    D.el.querySelector('[data-why]').focus();
                }
                if (t.hasAttribute('data-retok')) {
                    const w = D.el.querySelector('[data-why]').value.trim();
                    if (!w) {
                        D.el.querySelector('.er').textContent = 'اكتب سبب الإرجاع';
                        return;
                    }
                    mv('ret', w);
                }
                if (t.hasAttribute('data-open')) {
                    D.close();
                    api.go(c.sys, c.fn);
                }
                if (t.hasAttribute('data-rm')) {
                    if (!confirm('إزالة هذه البطاقة من لوحة سير المعاملات؟ (المعاملة نفسها تبقى في النظام)'))
                        return;
                    guarded(D, () => api.remove(k), 'إزالة البطاقة').then(r => { if (r && r.ok) {
                        D.close();
                        refresh();
                    } });
                }
            });
            D.el.querySelector('[data-sel]').addEventListener('change', e => { if (e.target.value)
                mv(e.target.value); });
            const p = D.el.querySelector('[data-to]') || D.el.querySelector('[data-x]');
            if (p)
                p.focus();
        }
        function addDlg() {
            const D = dlg(`<h2>＋ إضافة معاملة إلى اللوحة</h2><p class="ln">المعاملات الجديدة تُضاف وحدها عند إنشائها. من هنا تُضاف المعاملات التي كانت قبل تشغيل اللوحة: اكتب رقم الاضبارة أو جزءاً من اسم المشروع أو الشركة.</p>
      <input data-q placeholder="رقم الاضبارة، أو اسم المشروع أو الشركة"><ul class="fb-cl" data-l></ul><div class="auth" hidden></div><div class="er"></div><div class="a"><button data-x>إغلاق</button></div>`);
            const q = D.el.querySelector('[data-q]'), L = D.el.querySelector('[data-l]');
            let t = null;
            const load = () => __awaiter(this, void 0, void 0, function* () { const R = yield api.cands(q.value.trim()); L.innerHTML = R.length ? R.map(r => `<li><span><b>${esc(TYPES[r.sys])} ${esc(r.no || '')}</b> — ${esc(r.co || '')} — ${esc(r.pj || '')} ${r.fn ? '· اضبارة ' + esc(r.fn) : ''}</span><button data-add="${esc(r.key)}">إضافة</button></li>`).join('') : '<li>لا توجد معاملات غير مضافة بهذا البحث</li>'; });
            q.addEventListener('input', () => { clearTimeout(t); t = setTimeout(load, 250); });
            load();
            q.focus();
            L.addEventListener('click', (e) => __awaiter(this, void 0, void 0, function* () { const k = e.target.dataset.add; if (!k)
                return; const r = yield guarded(D, () => api.add(k)); if (r && r.ok) {
                e.target.closest('li').remove();
                refresh();
            } }));
        }
        function webDlg() {
            return __awaiter(this, void 0, void 0, function* () {
                const on = !!(data.web && data.web.on);
                const D = dlg(`<h2>📺 شاشة القاعة</h2><p>تعرض اللوحة على تلفاز القاعة أو أي حاسبة في الشبكة الداخلية نفسها: افتح المتصفح فيها واكتب العنوان أدناه. العرض للقراءة فقط، <b>بلا مبالغ</b>، ويتحدّث كل 20 ثانية. لا يعمل خارج شبكة الدائرة.</p>
      <div data-u class="ln"></div><div class="a"><button class="pri" data-on>${on ? 'إيقاف شاشة القاعة' : 'تشغيل شاشة القاعة'}</button><button data-x>إغلاق</button></div>`);
                const show = w => { D.el.querySelector('[data-u]').innerHTML = w && w.on ? 'العنوان: ' + (w.urls.length ? w.urls.map(u => `<b style="direction:ltr;display:inline-block">${esc(u)}</b>`).join(' أو ') : 'لا توجد شبكة') : 'متوقفة الآن.'; D.el.querySelector('[data-on]').textContent = w && w.on ? 'إيقاف شاشة القاعة' : 'تشغيل شاشة القاعة'; };
                show(data.web);
                D.el.querySelector('[data-on]').onclick = () => __awaiter(this, void 0, void 0, function* () { const w = yield api.web(!(data.web && data.web.on)); data.web = w; show(w); render(); });
            });
        }
        function annDlg() {
            const D = dlg(`<h2>📢 تبليغ إلى كافة اللجان</h2><p class="ln">يظهر بملء الشاشة على كل حاسبات القسم واللجان (مرة واحدة لكل حاسبة، وتُغلق بـ«اطّلعت»)، وعلى الشاشة الثانية وشاشة القاعة طوال المدة. يُكتب ويُخفى بكلمة سر مدير القسم.</p>
      <textarea rows="4" data-t placeholder="مثلاً: يُعمَّم على كافة اللجان تسليم مواقف المشاريع الشهرية قبل يوم الخميس"></textarea>
      <div class="a"><label class="ln">الأهمية <select data-lv><option value="info">تبليغ</option><option value="imp">مهم</option><option value="urg">عاجل</option></select></label>
        <label class="ln">مدة العرض <select data-du><option value="15">15 دقيقة</option><option value="30">30 دقيقة</option><option value="60" selected>ساعة</option><option value="120">ساعتان</option><option value="240">4 ساعات</option><option value="eod">حتى نهاية اليوم</option><option value="1440">يوم</option><option value="4320">3 أيام</option><option value="10080">أسبوع</option><option value="custom">حتى تاريخ ووقت…</option></select></label>
        <input type="datetime-local" data-dt hidden></div>
      <label class="ln">مرفق (اختياري): ملف PDF أو صورة — يُعرض بملء الشاشة مع النص أو بدونه <input type="file" data-f accept="application/pdf,image/jpeg,image/png,image/webp"></label><div class="ln" data-fi></div>
      <input type="password" data-pw placeholder="كلمة سر مدير القسم" autocomplete="off">
      <div class="er"></div><div class="a"><button class="pri" data-go>نشر التبليغ</button><button data-prev>معاينة</button><button data-x>إلغاء</button></div>`);
            const $d = n => D.el.querySelector(`[data-${n}]`);
            $d('du').onchange = () => { $d('dt').hidden = $d('du').value !== 'custom'; };
            const until = () => { const v = $d('du').value; if (v === 'custom')
                return Date.parse($d('dt').value) || 0; if (v === 'eod') {
                const d = new Date();
                d.setHours(23, 59, 0, 0);
                return d.getTime();
            } return Date.now() + (+v) * 60000; };
            let ATT = null, busy = false;
            $d('f').onchange = () => __awaiter(this, void 0, void 0, function* () {
                const f = $d('f').files && $d('f').files[0];
                ATT = null;
                const fi = $d('fi'), er = D.el.querySelector('.er');
                er.textContent = '';
                if (!f) {
                    fi.textContent = '';
                    return;
                }
                busy = true;
                fi.textContent = 'جارٍ تجهيز المرفق…';
                try {
                    ATT = yield annFile(f, m => { fi.textContent = m; });
                    fi.textContent = `📎 ${ATT.type === 'pdf' ? 'PDF' : 'صورة'}: ${f.name}${ATT.type === 'pdf' ? ` — ${ATT.total} صفحة${ATT.total > ATT.pages.length ? ` (تُعرض أول ${ATT.pages.length})` : ''}` : ''}`;
                }
                catch (e) {
                    ATT = null;
                    fi.textContent = '';
                    er.textContent = String(e && e.message || e);
                    $d('f').value = '';
                }
                finally {
                    busy = false;
                }
            });
            $d('prev').onclick = () => { const P = dlg(''); P.ov.innerHTML = annHtml({ id: 'prev', text: $d('t').value || (ATT ? '' : '(نص التبليغ)'), level: $d('lv').value, from: Date.now(), until: until(), by: '', att: ATT ? { type: ATT.type, name: ATT.name, n: ATT.pages.length, pdf: !!ATT.pdf, total: ATT.total } : null }, { logo: opt.logo, button: 'إغلاق المعاينة', pages: ATT ? ATT.pages : null }); P.ov.querySelector('[data-annok]').onclick = P.close; };
            $d('go').onclick = () => __awaiter(this, void 0, void 0, function* () {
                const er = D.el.querySelector('.er');
                if (busy) {
                    er.textContent = 'انتظر اكتمال تجهيز المرفق';
                    return;
                }
                if (!$d('t').value.trim() && !ATT) {
                    er.textContent = 'اكتب نص التبليغ أو أرفق ملفاً (PDF أو صورة)';
                    return;
                }
                if (!$d('pw').value) {
                    er.textContent = 'اكتب كلمة سر مدير القسم';
                    return;
                }
                const r = yield api.annPublish($d('pw').value, { text: $d('t').value, level: $d('lv').value, until: until(), att: ATT });
                if (r && r.ok) {
                    D.close();
                    toast('نُشر التبليغ: يظهر الآن على كل الحاسبات وشاشات اللوحة');
                    refresh();
                }
                else
                    er.textContent = (r && r.error) || 'تعذّر النشر';
            });
            $d('t').focus();
        }
        function annHideDlg(id) {
            const D = dlg(`<h2>إخفاء التبليغ</h2><p class="ln">يُخفى من كل الحاسبات وشاشات اللوحة.</p><input type="password" data-pw placeholder="كلمة سر مدير القسم" autocomplete="off"><div class="er"></div><div class="a"><button class="pri" data-go>إخفاء</button><button data-x>إلغاء</button></div>`);
            const pw = D.el.querySelector('[data-pw]');
            pw.focus();
            const go = () => __awaiter(this, void 0, void 0, function* () { const r = yield api.annHide(pw.value, id); if (r && r.ok) {
                D.close();
                refresh();
            }
            else
                D.el.querySelector('.er').textContent = (r && r.error) || 'تعذّر الإخفاء'; });
            D.el.querySelector('[data-go]').onclick = go;
            pw.onkeydown = e => { if (e.key === 'Enter')
                go(); };
        }
        if (api.onChange)
            api.onChange(() => refresh());
        refresh();
        return { refresh, render, get data() { return data; } };
    }
    window.FlowBoard = { mount, STAGES, TYPES, annHtml, injectCss };
})();
