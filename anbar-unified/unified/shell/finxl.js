/* تصحيح السلف (المرفوعة والمصروفة) من ملف Excel يُصدره برنامج الشؤون المالية:
   - تُعرف الأعمدة بعناوينها: اسم المشروع، الشركة، رقم الاضبارة، رقم العقد، السلف المرفوعة، السلف المصروفة،
     مبلغ السلفة (المبالغ غير المصروفة) / سلف بانتظار الصرف. المرفوعة = عمود «السلف المرفوعة»، وإلا المصروفة + غير المصروفة.
     «مجموع المصروف الكلي» (كل الصرف) لا يُعدّ سلفاً.
   - مطابقة مشاريع الموقف: رقم الاضبارة، ثم رقم العقد مع الشركة أو الاسم، ثم الاسم (والشركة).
   - معاينة لكل تغيير قبل الاعتماد؛ والاعتماد يُحفظ مع بيانات المشاريع في السجل المشترك (يُزامَن) فيظهر في الموقف العام
     وتقاريره وتصدير المواقف بنموذج اللجان، ولا يمسّ ملفات اللجان نفسها. «إزالة التصحيح» تعيد قيم المواقف. */
(function(){
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=v=>{if(typeof v==='number')return isFinite(v)?v:null;const t=String(v==null?'':v).replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[,٬\s]/g,'').replace(/٫/g,'.');if(!t||!/^-?\d+(\.\d+)?$/.test(t))return null;return +t;};
const money=v=>v==null||v===''?'—':Math.round(+v).toLocaleString('en-US');
const T=s=>String(s==null?'':s).replace(/[ً-ْـ]/g,'').replace(/[إأآٱ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/ؤ/g,'و').replace(/ئ/g,'ي')
  .replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d)).toLowerCase().replace(/[^ء-ي0-9a-z]+/g,' ').trim();
const STOP=new Set(['مشروع','شركه','للمقاولات','المقاولات','العامه','المحدوده','والتجاره','التجاره','العراقيه','في','من','الى','على','مع','و','ال']);
const toks=s=>new Set(T(s).split(' ').map(w=>w.replace(/^ال(?=..)/,'')).filter(w=>w.length>1&&!STOP.has(w)));
const jac=(A,B)=>{if(!A.size||!B.size)return 0;let n=0;A.forEach(x=>{if(B.has(x))n++;});return n/(A.size+B.size-n);};
const dig=s=>String(s==null?'':s).replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/\D/g,'').replace(/^0+/,'');
const KEYS=['finRaised','finPaid','finSrc','finAt','finV'];
const HEAD=[['fileNo',/^رقم الاضبار|^الاضبار/],['name',/^اسم المشروع|^المشروع$/],['co',/الشركه|المقاول/],['cno',/^رقم العقد/],
  ['raised',/^(مجموع )?السلف المرفوعه/],['paidAdv',/^(مجموع )?السلف المصروفه/],['pending',/مبلغ السلفه|بانتظار الصرف|غير المصروفه|الغير مصروفه|غير مصروفه/]];
/* «مجموع المصروف الكلي» و«المصروف» هما كل ما صُرف للمشروع (دفعات مباشرة وغيرها) وليسا السلف: لا يُقرآن هنا أبداً */
const FINV=2;   /* إصدار طريقة القراءة: تصحيحات الإصدار الأول (التي قرأت المصروف الكلي سلفاً) لا تُطبَّق */

/* قراءة الملف: كل ورقة فيها عمود «اسم المشروع» وعمود مبالغ */
function parse(sheets){const items=[];const used=[];
  (sheets||[]).forEach(sh=>{const R=sh.rows||[];let hi=-1,M=null;
    for(let i=0;i<Math.min(R.length,20);i++){const r=R[i]||[];const m={};for(let j=0;j<r.length;j++){const t=T(r[j]);if(!t)continue;for(const [k,re] of HEAD)if(m[k]==null&&re.test(t)){m[k]=j;break;}}
      if(m.name!=null&&(m.raised!=null||m.paidAdv!=null)){hi=i;M=m;break;}}
    if(hi<0)return;used.push(sh.name);
    for(let i=hi+1;i<R.length;i++){const r=R[i]||[];const g=k=>M[k]==null?'':r[M[k]];const nm=String(g('name')==null?'':g('name')).replace(/\s+/g,' ').trim();
      if(!nm||/^(ال)?مجموع|^الاجمالي|^المجموع الكلي/.test(T(nm)))continue;
      const paid=M.paidAdv!=null?num(g('paidAdv')):null,pend=num(g('pending'));let raised=M.raised!=null?num(g('raised')):null;   /* خلية فارغة = لا قيمة (لا تُكتب فوق قيمة اللجنة) */
      if(raised==null&&paid!=null&&pend!=null)raised=paid+pend;
      if(raised==null&&paid==null)continue;
      items.push({sheet:sh.name,row:i+1,name:nm,co:String(g('co')||'').trim(),fileNo:String(g('fileNo')==null?'':g('fileNo')).trim(),cno:String(g('cno')==null?'':g('cno')).trim(),raised,paid});}});
  return {items,sheets:used};}

/* المطابقة بمشاريع الموقف */
function match(items){const S=AnbarReg.state();const X=items.map(it=>({it,nt:toks(it.name),ct:toks(it.co),cn:dig(it.cno),k:T(it.name)}));
  const out=new Map(),amb=[];const usedIt=new Set();
  S.projects.forEach(p=>{const fn=String(p.fileNo),nt=toks(p.name),ct=toks(p.contractor),cn=dig(p.contractNo),k=T(p.name);const cand=[];
    X.forEach(x=>{let s=0,how='';
      if(x.it.fileNo&&dig(x.it.fileNo)&&dig(x.it.fileNo)===dig(fn)){s=5;how='رقم الاضبارة';}
      else if(cn&&x.cn&&cn===x.cn&&(jac(ct,x.ct)>=0.3||jac(nt,x.nt)>=0.4)){s=4+jac(nt,x.nt);how='رقم العقد';}
      else if(k&&k===x.k&&(!ct.size||!x.ct.size||jac(ct,x.ct)>=0.3)){s=3;how='اسم المشروع';}
      else{const ns=jac(nt,x.nt);if(ns>=0.75&&(!ct.size||!x.ct.size||jac(ct,x.ct)>=0.3)){s=2+ns;how='الاسم (تشابه)';}}
      if(s)cand.push({x,s,how});});
    if(!cand.length)return;cand.sort((a,b)=>b.s-a.s);
    const top=cand.filter(c=>c.x.it.raised!=null||c.x.it.paid!=null);if(!top.length)return;
    if(top[1]&&top[1].s===top[0].s&&T(top[1].x.it.name)!==T(top[0].x.it.name)){amb.push(p);return;}
    const same=top.filter(c=>c.s===top[0].s);   /* عدة صفوف للمشروع نفسه (سلفة لكل صف): الأعلى تراكمياً */
    const raised=same.map(c=>c.x.it.raised).filter(v=>v!=null),paid=same.map(c=>c.x.it.paid).filter(v=>v!=null);
    same.forEach(c=>usedIt.add(c.x.it));
    out.set(fn,{p,how:top[0].how,s:top[0].s,rows:same.map(c=>c.x.it),raised:raised.length?Math.max(...raised):null,paid:paid.length?Math.max(...paid):null,src:top[0].x.it});});
  /* صف المالية الواحد لمشروع واحد فقط: كان الصف نفسه يُعطى لكل مشروع يطابقه (رقم عقد مكرر بين السنوات أو اللجان، أو اسم مشروع مكرر)
     فتظهر المبالغ نفسها على مشاريع مختلفة. الآن: الصف للمشروع الأعلى تطابقاً، وإن تساوى التطابق لا يُعطى لأي منها ويُعرض في المراجعة */
  const owners=new Map();out.forEach((v,fn)=>v.rows.forEach(it=>{(owners.get(it)||owners.set(it,[]).get(it)).push(fn);}));
  const conflict=[];owners.forEach(fns=>{if(fns.length<2)return;const L=fns.map(fn=>({fn,s:out.get(fn).s})).sort((a,b)=>b.s-a.s);
    const keep=L[0].s>L[1].s?L[0].fn:null;L.forEach(x=>{if(x.fn!==keep&&out.has(x.fn)){conflict.push(out.get(x.fn).p);out.delete(x.fn);}});});
  return {m:out,amb,conflict,unmatched:items.filter(it=>!usedIt.has(it))};}

/* التطبيق على عرض الموقف (يُستدعى من الموقف العام بعد تطبيق التخطيط) */
function apply(p){try{const m=AnbarReg.getMeta(p.fileNo)||{};if((m.finRaised==null&&m.finPaid==null)||!(+m.finV>=FINV))return p;
  /* صفر في ملف المالية لا يمحو مبلغاً سجّلته اللجنة في موقفها (المالية لم تسجّل الصرف بعد، أو صفّها ناقص): يبقى مبلغ اللجنة ويُذكر ذلك */
  const v=Object.assign({},p),pos=x=>+x>0,keepR=+m.finRaised===0&&pos(p.advRaised),keepP=+m.finPaid===0&&pos(p.advPaid);
  const fixR=m.finRaised!=null&&m.finRaised!==''&&!keepR,fixP=m.finPaid!=null&&m.finPaid!==''&&!keepP;if(fixR)v.advRaised=+m.finRaised;if(fixP)v.advPaid=+m.finPaid;
  if(!fixR&&!fixP)return p;v._finXl={src:m.finSrc||'',at:m.finAt||'',origRaised:p.advRaised,origPaid:p.advPaid,fixR,fixP,keepR,keepP};return v;}catch(_){return p;}}
const count=()=>{try{const M=AnbarReg.state().meta||{};return Object.values(M).filter(m=>m&&(m.finRaised!=null||m.finPaid!=null)&&+m.finV>=FINV).length;}catch(_){return 0;}};

/* معاينة ثم اعتماد */
function preview(file,P){const R=match(P.items);const rows=[...R.m.values()].map(x=>({fn:x.p.fileNo,name:x.p.name,how:x.how,r0:x.p.advRaised,p0:x.p.advPaid,r1:+x.raised===0&&+x.p.advRaised>0?null:x.raised,p1:+x.paid===0&&+x.p.advPaid>0?null:x.paid}))
    .map(x=>Object.assign(x,{ch:(x.r1!=null&&Math.round(+x.r1)!==Math.round(+(x.r0||0)))||(x.p1!=null&&Math.round(+x.p1)!==Math.round(+(x.p0||0)))}));
  const ch=rows.filter(x=>x.ch);
  const ov=document.createElement('div');ov.className='ov';ov.id='finXlOv';
  ov.innerHTML=`<div class="dlg" style="max-width:980px;width:96vw"><h3>📥 تصحيح السلف من ملف المالية</h3>
   <p>الملف: <b>${esc(file.name)}</b> — الأوراق المقروءة: ${esc(P.sheets.join('، ')||'—')} — ${P.items.length} صفاً بمبالغ.</p>
   <p>طابق <b>${rows.length}</b> مشروعاً من الموقف، منها <b>${ch.length}</b> تتغير سلفها${R.amb.length?`، و${R.amb.length} بأكثر من مقابل محتمل (لم تُغيَّر)`:''}${R.conflict.length?`، و<b>${R.conflict.length}</b> لم تُعطَ صفاً لأن الصف نفسه يطابق مشروعاً آخر أقوى (لا تُكرَّر المبالغ على مشاريع مختلفة)`:''}${R.unmatched.length?`، و${R.unmatched.length} صفاً في ملف المالية بلا مقابل في الموقف`:''}.</p>
   <div style="max-height:52vh;overflow:auto"><table class="tbl"><thead><tr><th>الاضبارة</th><th>المشروع</th><th>المطابقة</th><th>المرفوعة: الموقف ← المالية</th><th>المصروفة: الموقف ← المالية</th></tr></thead><tbody>
   ${ch.map(x=>`<tr><td>${esc(x.fn)}</td><td>${esc(x.name)}</td><td>${esc(x.how)}</td><td class="n">${money(x.r0)} ← <b>${money(x.r1==null?x.r0:x.r1)}</b></td><td class="n">${money(x.p0)} ← <b>${money(x.p1==null?x.p0:x.p1)}</b></td></tr>`).join('')||'<tr><td colspan="5">لا تغيير: سلف الموقف مطابقة لملف المالية.</td></tr>'}</tbody></table>
   ${R.unmatched.length?`<details><summary>صفوف ملف المالية بلا مقابل (${R.unmatched.length})</summary><p class="co">${R.unmatched.slice(0,200).map(it=>esc(it.name)).join(' · ')}</p></details>`:''}</div>
   ${R.conflict.length?`<details><summary>مشاريع لم تُصحَّح لتعارض الصف مع مشروع آخر (${R.conflict.length})</summary><p class="co">${R.conflict.slice(0,200).map(p=>esc((p.fileNo||'')+' — '+(p.name||''))).join(' · ')}</p></details>`:''}
   <p class="co">الاعتماد يحل محل أي تصحيح سابق من ملف مالية (يُزال عن المشاريع التي لم تعد مطابقة)، ويصحح السلف في الموقف العام وتقاريره وتصدير المواقف بنموذج اللجان (ويُزامَن)، ولا يغيّر ملفات اللجان نفسها؛ ويمكن إزالته من «💰 ربط المالية».</p>
   <div class="row" style="display:flex;gap:8px;justify-content:flex-end"><button class="btn" data-fxl="no">إلغاء</button><button class="btn pri" data-fxl="ok"${rows.length?'':' disabled'}>اعتماد التصحيح (${rows.length})</button></div></div>`;
  document.body.appendChild(ov);
  return new Promise(res=>ov.addEventListener('click',e=>{const b=e.target.closest('[data-fxl]');if(!b)return;ov.remove();
    if(b.dataset.fxl!=='ok')return res(0);
    const at=new Date().toISOString().slice(0,10);
    const list=[...R.m.values()].map(x=>{const d={finSrc:file.name,finAt:at,finV:FINV};if(x.raised!=null)d.finRaised=Math.round(x.raised);if(x.paid!=null)d.finPaid=Math.round(x.paid);return {fileNo:String(x.p.fileNo),data:d};});
    AnbarReg.dropMetaKeys(KEYS);   /* التصحيح الجديد يحل محل السابق كاملاً: لا تبقى مبالغ مطابقة خاطئة قديمة */
    AnbarReg.setMetas(list);try{window.desktop&&window.desktop.auditNote&&window.desktop.auditNote('sit','finxl',`تصحيح السلف من ملف المالية «${file.name}»: ${list.length} مشروعاً (${ch.length} تغيّرت)`);}catch(_){}
    res(list.length);}));}
async function pick(){const inp=document.createElement('input');inp.type='file';inp.accept='.xlsx,.xlsm,.csv';
  const file=await new Promise(r=>{inp.onchange=()=>r(inp.files&&inp.files[0]);inp.click();});if(!file)return 0;return importFile(file);}
/* ملف «الموقف الشامل» من برنامج المالية (اسم المشروع + مجموع المصروف الكلي، بلا عمودي السلف المرفوعة والمصروفة): ليس تصحيحاً للسلف،
   بل مصدر بيانات المالية — يُربط بالموقف العام عبر «💰 ربط المالية» (المصروف، الإنجاز المالي، الكلفة المصادقة، مبلغ العقد) */
const isFullStatus=sheets=>(sheets||[]).some(sh=>(sh.rows||[]).slice(0,20).some(r=>{const t=(r||[]).map(T);return t.some(x=>/^اسم المشروع/.test(x))&&t.some(x=>/^مجموع المصروف الكلي$|^المصروف الكلي$/.test(x));}));
async function importFile(file){let P,SH;try{SH=await AnbarReg.readSheets(file);P=parse(SH);}catch(e){alert('تعذّرت قراءة الملف: '+(e.message||e));return 0;}
  if(!P.items.length&&isFullStatus(SH)&&window.desktop&&window.desktop.finx&&window.desktop.finx.use&&file.path){
    if(!confirm(`الملف «${file.name}» هو «الموقف الشامل» من برنامج الشؤون المالية (المصروف الكلي ونسبة الإنجاز المالي والكلفة المصادقة لكل مشروع)، وليس ملف تصحيح السلف.\n\nربطه بالموقف العام مصدراً لبيانات المالية؟ تظهر بياناته في بطاقة كل مشروع («💰 من برنامج الشؤون المالية») وفي لوحة المشاريع، ويُتابَع تغيّره تلقائياً.`))return 0;
    const f=await window.desktop.finx.use(file.path);if(!f){alert('تعذّر ربط الملف.');return 0;}
    try{if(window.FinLink){await window.FinLink.load(true);window.SitRender&&window.SitRender();window.FinLink.dlg();}}catch(_){}
    return 0;}
  if(!P.items.length){alert('لم يُعثر في الملف على جدول فيه «اسم المشروع» وعمود «السلف المرفوعة» أو «السلف المصروفة».\n\n«مجموع المصروف الكلي» هو كل ما صُرف للمشروع وليس السلف، فلا يُستعمل لتصحيح السلف.');return 0;}
  const n=await preview(file,P);if(n){if(window.flash)window.flash(`صُحّحت سلف ${n} مشروعاً من ملف المالية`);try{window.SitRender&&window.SitRender();}catch(_){}}return n;}
function clear(){const n=AnbarReg.dropMetaKeys(KEYS);try{window.SitRender&&window.SitRender();}catch(_){}if(window.flash)window.flash(n?`أُزيل تصحيح ملف المالية عن ${n} مشروعاً`:'لا تصحيح لإزالته');return n;}
window.FinXl={parse,match,apply,pick,importFile,preview,clear,count};
})();
