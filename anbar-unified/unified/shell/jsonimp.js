/* استيراد شامل لملفات JSON من الحاسبة: زر في الصفحة الرئيسية، ويفتح تلقائياً في أول تشغيل لإصدار جديد إن وُجدت سجلات غير موجودة في البرنامج */
/* global openOv, closeOv, flash */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const kb=n=>n>1048576?(n/1048576).toFixed(1)+' م.ب':Math.max(1,Math.round(n/1024))+' ك.ب';
const dt=t=>{const d=new Date(t);return d.getFullYear()+'/'+(d.getMonth()+1)+'/'+d.getDate();};
let list=[];
function ensure(){if($('jiOv'))return;const d=document.createElement('div');d.className='ov';d.id='jiOv';d.hidden=true;
  d.innerHTML=`<div class="dlg jidlg"><h3>📥 استيراد ملفات JSON من الحاسبة</h3>
   <p class="hint" style="margin-top:0">يبحث البرنامج في سطح المكتب والمستندات والتنزيلات ومجلد البرنامج ومجلدات البرامج القديمة عن ملفات الأنظمة (نسخ احتياطية، ملفات البرامج المستقلة، ملفات محفوظة)، ويعرف نوع كل ملف من محتواه، ثم يدمج السجلات في نظامها: <b>الجديد يُضاف، والموجود يُستبدل فقط إن كانت نسخة الملف أحدث، ولا يُحذف شيء</b>.</p>
   <div class="row" style="justify-content:flex-start;gap:6px;flex-wrap:wrap"><button class="btn" data-ji="scan">🔍 بحث في الأماكن المعتادة</button><button class="btn" data-ji="dir">📂 اختيار مجلد…</button><button class="btn" data-ji="files">📄 اختيار ملفات…</button><span class="hint" id="jiStat"></span></div>
   <div id="jiList" class="jilist"></div>
   <div class="row"><button class="btn" data-ji="close">إغلاق</button><button class="btn pri" data-ji="go">⬇ استيراد المحدد</button></div></div>`;
  document.body.appendChild(d);
  d.addEventListener('click',async e=>{const b=e.target.closest('[data-ji]');if(e.target===d){close();return;}if(!b)return;const k=b.dataset.ji;
    if(k==='close')close();else if(k==='scan')run(()=>window.desktop.jsonScan());else if(k==='dir')run(()=>window.desktop.jsonPick('dir'),true);else if(k==='files')run(()=>window.desktop.jsonPick('files'),true);
    else if(k==='go')go();});
  d.addEventListener('change',e=>{if(e.target.matches('[data-all]')){const ds=e.target.dataset.all;d.querySelectorAll(`[data-f][data-ds="${ds}"]:not(:disabled)`).forEach(x=>{x.checked=e.target.checked;});}upd();});}
function close(){closeOv('jiOv');}
function upd(){const n=[...document.querySelectorAll('#jiList [data-f]:checked')].length;const b=document.querySelector('#jiOv [data-ji=go]');if(b){b.disabled=!n;b.textContent=n?`⬇ استيراد المحدد (${n} ملف)`:'⬇ استيراد المحدد';}}
function render(){const g={};list.forEach(x=>{const k=x.ds||'skip';(g[k]=g[k]||[]).push(x);});const order=['ad','co','du','in','lt','fu','skip'];
  const useful=list.filter(x=>x.fresh||x.newer).length;
  $('jiStat').textContent=list.length?`وُجد ${list.length} ملفاً — ${useful} فيه سجلات غير موجودة في البرنامج أو أحدث`:'لم يُعثر على ملفات أنظمة';
  $('jiList').innerHTML=order.filter(k=>g[k]).map(k=>{const L=g[k],nm=k==='skip'?'ملفات لا تُستورد':L[0].sys,fr=L.reduce((a,x)=>a+x.fresh,0),nw=L.reduce((a,x)=>a+x.newer,0);
    return `<div class="jig"><h4>${k!=='skip'?`<label><input type="checkbox" data-all="${k}" ${fr+nw?'checked':''}> `:''}${esc(nm)}${k!=='skip'?'</label>':''} <small>${L.length} ملف${k!=='skip'?` — جديد ${fr}، أحدث ${nw}`:''}</small></h4>
      <table class="jit"><thead><tr><th></th><th>الملف</th><th>المكان</th><th>التاريخ</th><th>السجلات</th><th>جديد</th><th>أحدث</th><th>موجود</th><th>محذوف عمداً</th></tr></thead><tbody>${L.map(x=>`<tr${x.skip?' class="sk"':''}>
        <td>${x.skip?'':`<input type="checkbox" data-f="${esc(x.file)}" data-ds="${k}" ${x.fresh||x.newer?'checked':''} ${x.fresh||x.newer?'':'disabled'}>`}</td>
        <td title="${esc(x.file)}"><b>${esc(x.name)}</b> <small>${kb(x.size)}</small>${x.skip?`<div class="hint">${esc(x.skip)}</div>`:''}</td><td class="jid" title="${esc(x.dir)}">${esc(x.dir)}</td><td>${dt(x.mtime)}</td>
        <td>${x.total||''}</td><td>${x.fresh?`<b style="color:#1f6b3a">${x.fresh}</b>`:'—'}</td><td>${x.newer?`<b style="color:#1d4ed8">${x.newer}</b>`:'—'}</td><td>${x.same||'—'}</td><td>${x.deleted||'—'}</td></tr>`).join('')}</tbody></table></div>`;}).join('')||'<div class="empty"><p>لا ملفات. اختر مجلداً آخر (فلاشة مثلاً) أو ملفات بعينها.</p></div>';
  upd();}
async function run(fn,merge){$('jiStat').textContent='جارٍ البحث…';const r=await fn();if(!r){$('jiStat').textContent='';return;}if(r.error){$('jiStat').textContent='تعذّر البحث: '+r.error;return;}
  if(merge){const have=new Set(list.map(x=>x.file));list=list.concat(r.filter(x=>!have.has(x.file)));}else list=r;render();}
async function go(){const files=[...document.querySelectorAll('#jiList [data-f]:checked')].map(x=>x.dataset.f);if(!files.length)return;
  const r=await window.desktop.jsonApply(files);if(r.error){flash('تعذّر الاستيراد: '+r.error,true);return;}
  const msg=Object.values(r).map(x=>`${x.sys}: أُضيف ${x.added}${x.replaced?`، حُدّث ${x.replaced}`:''}`).join(' — ');flash('✔ تم الاستيراد — '+(msg||'لا جديد'));
  run(()=>window.desktop.jsonScan());}
function open(L){ensure();openOv('jiOv');if(L){list=L;render();}else run(()=>window.desktop.jsonScan());}
window.__jsonImport={open,list:()=>list};
if(window.desktop&&window.desktop.onJsonFound)window.desktop.onJsonFound(L=>open(L));
/* زر في الصفحة الرئيسية */
const info=$('homeInfo');if(info&&window.desktop&&window.desktop.jsonScan){const b=document.createElement('div');b.style.cssText='margin-top:10px;text-align:center';b.innerHTML='<button class="btn" id="bJsonImp" title="البحث في الحاسبة عن ملفات الأنظمة واستيرادها">📥 استيراد ملفات JSON من الحاسبة (نسخ احتياطية وبرامج قديمة)</button><button class="btn" id="bRestoreBk" title="استرجاع نسخة احتياطية (ملف واحد لكل الأنظمة)" style="margin-inline-start:6px">↺ استرجاع نسخة احتياطية</button>';info.after(b);$('bJsonImp').onclick=()=>open();const rb=$('bRestoreBk');if(rb)rb.onclick=()=>{if(window.AnbarAdmin&&window.AnbarAdmin.rbShow)window.AnbarAdmin.rbShow();};}
})();
