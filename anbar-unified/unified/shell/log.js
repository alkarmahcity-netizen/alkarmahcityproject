/* سجل التعديلات: من عدّل ماذا ومتى في السلف وأوامر التغيير والمدد والاستلام، مع صورة الكاميرا (للقراءة والتصدير فقط) */
/* global XLW, openOv, closeOv, flash */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const OP={add:'إضافة',edit:'تعديل',del:'حذف',login:'دخول',pwreset:'استرجاع كلمة سر',restore:'استرجاع نسخة احتياطية',import:'استيراد',finview:'إظهار المبالغ',flow:'سير المعاملات',numunlock:'فتح العدد والتاريخ'};
const two=n=>String(n).padStart(2,'0');
const dt=t=>{const d=new Date(t);return `${d.getFullYear()}/${two(d.getMonth()+1)}/${two(d.getDate())} ${two(d.getHours())}:${two(d.getMinutes())}`;};
const tm=t=>{const d=new Date(t);return `${two(d.getHours())}:${two(d.getMinutes())}`;};
let all=[],shown=[];
const photos={};
/* ---------- اسم المعدِّل ---------- */
function whoChip(){const n=window.desktop.who();const b=$('bWho');if(b){b.textContent='👤 '+(n||'—');b.title=n?`المعدِّل الحالي: ${n} — اضغط لتغيير الاسم`:'لم يُكتب اسم المعدِّل بعد — اضغط لكتابته';b.classList.toggle('nowho',!n);}}
function namesList(){const dl=$('whoNames');if(dl)dl.innerHTML=window.desktop.auditNames().map(n=>`<option value="${esc(n)}">`).join('');}
window.__whoChip=whoChip;window.__whoNames=namesList;
function askWho(reason){namesList();$('whoIn').value=window.desktop.who()||'';$('whoE').textContent='';$('whoWhy').textContent=reason||'';
  openOv('whoOv');setTimeout(()=>$('whoIn').focus(),50);}
function closeWho(){closeOv('whoOv');}
async function saveWho(){const v=$('whoIn').value.trim();if(v.length<3){$('whoE').textContent='اكتب اسمك الثلاثي';return;}await window.desktop.setWho(v);window.desktop.auditLogin('');closeWho();whoChip();window.flash&&flash('المعدِّل الآن: '+v);}
$('bWho').onclick=()=>askWho('');
$('whoOk').onclick=saveWho;$('whoNo').onclick=closeWho;
$('whoIn').addEventListener('keydown',e=>{if(e.key==='Enter')saveWho();if(e.key==='Escape')closeWho();});
let askedAt=0;window.desktop.onAuditAsk(()=>{whoChip();if(Date.now()-askedAt<120000)return;askedAt=Date.now();if(window.flash)flash('⚠ حُفظ تعديل ولم يُكتب اسم المعدِّل — اضغط 👤 في الأعلى واكتب اسمك ليُنسب التعديل إليك',true);});
window.desktop.onAuditNew(i=>{whoChip();if(i.op==='login'){if(window.flash)flash(`📷 سُجّل دخول ${i.editor||''} إلى ${i.sys}${i.photo?' مع صورة التوثيق':i.err?' — بلا صورة: '+i.err:''}`);if(!$('pg-log').hidden)load();return;}if(window.flash)flash(`📝 سُجّل ${i.n>1?i.n+' تعديلات':'التعديل'} في ${i.sys}${i.label?' — '+i.label:''} باسم ${i.editor||'(بلا اسم)'}${i.photo?' — 📷 التُقطت صورة التوثيق':i.err?' — بلا صورة: '+i.err:''}`);if(!$('pg-log').hidden)load();});
whoChip();
/* ---------- صفحة السجل ---------- */
const perOK=(t,k)=>{if(!k)return true;const n=new Date(),d0=new Date(n.getFullYear(),n.getMonth(),n.getDate()).getTime();return t>=d0-({d:0,w:6,m:29,y:364}[k]||0)*864e5;};
function filt(){const q=($('lgQ').value||'').trim().toLowerCase(),sy=$('lgSys').value,ed=$('lgEd').value,pr=$('lgPer').value,op=$('lgOp').value;
  return all.filter(e=>(!sy||e.sys===sy)&&(!ed||e.editor===ed)&&(!op||e.op===op)&&perOK(e.last,pr)&&(!q||[e.label,e.fileNo,e.editor,e.winUser,e.pc,e.device,e.sub,e.sysName].join(' ').toLowerCase().includes(q)));}
function opts(sel,list,first){const v=sel.value;sel.innerHTML=`<option value="">${first}</option>`+list.map(x=>`<option value="${esc(x[0])}">${esc(x[1])}</option>`).join('');sel.value=list.some(x=>x[0]===v)?v:'';}
function render(){shown=filt();
  const eds=[...new Set(all.map(e=>e.editor||''))];opts($('lgEd'),eds.map(e=>[e,e||'(بلا اسم)']),'كل المعدِّلين');
  const byEd={};shown.forEach(e=>{const k=e.editor||'(بلا اسم)';byEd[k]=(byEd[k]||0)+1;});
  $('lgKpi').innerHTML=`<div class="kpi"><span>قيود التعديل المعروضة</span><b>${shown.length}</b><small>من ${all.length}</small></div>`+
    ['ad','co','du','ac'].map(k=>`<div class="kpi"><span>${({ad:'لجنة تدقيق السلف',co:'أوامر التغيير',du:'المدد والتوقف',ac:'الاستلام'})[k]}</span><b>${shown.filter(e=>e.sys===k).length}</b></div>`).join('')+
    `<div class="kpi"><span>المعدِّلون</span><b>${Object.keys(byEd).length}</b><small>${Object.entries(byEd).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([k,n])=>esc(k)+' '+n).join(' — ')}</small></div>`;
  $('lgTbl').innerHTML=shown.length?`<table class="lgt"><thead><tr><th>الوقت</th><th>النظام</th><th>المشروع</th><th>العملية</th><th>المعدِّل</th><th>الحاسبة / مستخدم ويندوز</th><th>الصورة</th></tr></thead><tbody>${shown.slice(0,600).map(e=>`<tr>
      <td class="n">${dt(e.first)}${e.last-e.first>60000?`<div class="co">حتى ${tm(e.last)}</div>`:''}</td>
      <td>${esc(e.sysName)}${e.sub?`<div class="co">${esc(e.sub)}</div>`:''}</td>
      <td>${e.fileNo?`<b class="n">${esc(e.fileNo)}</b> — `:''}${esc(e.label||'(بلا اسم مشروع)')}</td>
      <td><span class="lgop ${e.op}">${OP[e.op]||e.op}</span>${e.n>1?`<div class="co">${e.n} مرة حفظ</div>`:''}</td>
      <td><b>${esc(e.editor||'(بلا اسم)')}</b></td>
      <td class="co">${esc(e.device||e.pc)}${e.winUser?`<br>${esc(e.winUser)}`:''}</td>
      <td>${phCell(e)}</td></tr>`).join('')}</tbody></table>${shown.length>600?`<p class="hint">يُعرض أحدث 600 قيد — استعمل التصفية أو التصدير لرؤية الباقي.</p>`:''}`:'<div class="empty"><p>لا توجد تعديلات مسجّلة بعد. كل إضافة أو تعديل أو حذف في السلف أو أوامر التغيير أو المدد أو الاستلام تظهر هنا باسم المعدِّل وصورته.</p></div>';
  lazy();}
/* صور القيد: الأولى ثم صور الاستمرار في التعديل (صورة لكل حفظ بعد دقيقة من آخر صورة) — تُعرض أحدث 4 */
function phCell(e){const L=[e.photo?{file:e.photo,at:e.first}:null,...(e.photos||[])].filter(Boolean);if(!L.length)return `<span class="co">${esc(e.photoErr||'—')}</span>`;
  const sh=L.length>4?[L[0],...L.slice(-3)]:L;return `<div class="lgphs">${sh.map(x=>`<img class="lgph" data-ph="${esc(x.file)}" alt="صورة المعدِّل" title="${esc(dt(x.at))} — اضغط للتكبير">`).join('')}</div>${L.length>1?`<div class="co">${L.length} صور${L.length>4?' (تُعرض 4)':''}</div>`:''}`;}
async function lazy(){for(const im of document.querySelectorAll('#lgTbl img[data-ph]:not([src])')){const k=im.dataset.ph;if(!photos[k])photos[k]=await window.desktop.auditPhoto(k);if(photos[k])im.src=photos[k];}}
async function load(){all=await window.desktop.auditList();render();}
['lgQ','lgSys','lgEd','lgPer','lgOp'].forEach(id=>$(id).addEventListener(id==='lgQ'?'input':'change',render));
$('lgTbl').addEventListener('click',e=>{const im=e.target.closest('img[data-ph]');if(!im||!im.src)return;const o=$('lgBig');o.querySelector('img').src=im.src;o.hidden=false;});
$('lgBig').onclick=()=>{$('lgBig').hidden=true;};
$('lgDir').onclick=()=>window.desktop.auditDir();
$('lgXl').onclick=async()=>{if(!window.XLW){flash('التصدير غير متاح',true);return;}const X=XLW.S,T=v=>({v:v==null?'':String(v),s:X.txt}),C=['ت','الوقت (البداية)','آخر حفظ','النظام','نوع السجل','رقم الاضبارة','المشروع','العملية','مرات الحفظ','المعدِّل','الحاسبة','مستخدم ويندوز','ملف الصورة'];
  const rows=[[{v:'محافظة الأنبار — قسم الشؤون الهندسية',s:X.title},...C.slice(1).map(()=>({s:X.title}))],[{v:'سجل التعديلات في أنظمة السلف وأوامر التغيير والمدد والاستلام',s:X.org}],[{v:`${shown.length} قيداً — صُدّر ${dt(Date.now())}`,s:X.sub}],C.map(h=>({v:h,s:X.head}))];
  shown.forEach((e,i)=>rows.push([{v:i+1,s:X.int},T(dt(e.first)),T(dt(e.last)),T(e.sysName),T(e.sub),T(e.fileNo),T(e.label),T(OP[e.op]||e.op),{v:e.n,s:X.int},T(e.editor||'(بلا اسم)'),T(e.device||e.pc),T(e.winUser),T([e.photo,...(e.photos||[]).map(x=>x.file)].filter(Boolean).join(' ، ')||e.photoErr)]));
  const L=XLW.colL(C.length-1);const buf=XLW.book([{name:'سجل التعديلات',cols:[6,17,17,18,18,11,44,9,9,24,20,16,34],rows,merges:[`A1:${L}1`,`A2:${L}2`,`A3:${L}3`],freeze:4,titles:4,filter:`A4:${L}4`,heights:{1:30,2:26,4:28},zoom:90}],{title:'سجل التعديلات',author:'قسم الشؤون الهندسية — محافظة الأنبار'});
  const r=await window.desktop.saveFile(`سجل-التعديلات_${new Date().toISOString().slice(0,10)}.xlsx`,buf);if(r==='ok')flash('تم حفظ سجل التعديلات');else if(r==='error')flash('تعذّر الحفظ',true);};
const prev=window.onNav;window.onNav=function(s){try{if(prev)prev.apply(this,arguments);}finally{$('pg-log').hidden=s.current!=='log';if(s.current==='log')load();whoChip();}};
window.__auditLog={load,render,shown:()=>shown,all:()=>all};
})();
