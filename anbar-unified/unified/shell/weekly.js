/* تقرير العمل الأسبوعي (Excel): ما أُنجز في الفترة من كل الأنظمة —
   السلف (المبالغ المرفوعة والاستقطاعات والصافي)، أوامر التغيير، محاضر الاستلام، الأوامر الإدارية (المدد والتوقف والمخاطبات)،
   والكتب والمطالعات (المخاطبات ومطالعات أوامر التغيير).
   تاريخ كل عمل هو تاريخ مستنده (تاريخ السلفة، تاريخ الأمر، تاريخ الصدور...)، وإن لم يُكتب فتاريخ آخر تعديل على السجل. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=v=>{const n=parseFloat(String(v==null?'':v).replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[^\d.\-]/g,''));return isFinite(n)?n:0;};
const DAYS=['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
const ymd=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const dmy=d=>d?String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0')+'/'+d.getFullYear():'';
/* قراءة التاريخ بأشكاله: 2026-11-07، 7/11/2026، 2026/11/7، رقم Excel */
function pd(v){if(v==null||v==='')return null;if(v instanceof Date)return isNaN(v)?null:v;
  if(typeof v==='number'||/^\d{5}(\.\d+)?$/.test(String(v).trim())){const n=+v;if(n>20000&&n<80000){const d=new Date(Math.round((n-25569)*864e5));return new Date(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate());}if(n>1e11)return new Date(n);return null;}
  const s=String(v).trim().replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d));let m=s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/);if(m)return new Date(+m[1],+m[2]-1,+m[3]);
  m=s.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})/);if(m)return new Date(+m[3],+m[2]-1,+m[1]);const t=Date.parse(s);return isNaN(t)?null:new Date(t);}
const at=ms=>{const n=+ms;return n>1e11?new Date(n):null;};
const day0=d=>new Date(d.getFullYear(),d.getMonth(),d.getDate());
/* ---------- جمع الأعمال من كل نظام ---------- */
function collect(D,from,to,locked){const inR=d=>d&&d>=from&&d<=to;const pick=(...c)=>{for(const x of c){const d=pd(x);if(d)return {d,est:false};}return null;};
  const when=(docs,upd)=>{const p=pick(...docs);if(p)return p;const u=at(upd);return u?{d:day0(u),est:true}:null;};
  const R={ad:[],co:[],ac:[],ord:[],lt:[],locked:locked||[]};const lk=id=>R.locked.includes(id);
  /* السلف: كل سلفة بتاريخها؛ الصافي = التراكمي − السابق، والمستحق = الصافي − الاستقطاعات */
  if(!lk('ad'))(D.ad.records||[]).filter(r=>r&&!r.demo).forEach(r=>{const P=r.project||{},cost=num(P.costAfter)||num(P.cost);let prev=num(P.prevAdv);
    (r.advances||[]).forEach((a,i)=>{const cum=num(a.cumulative),pv=a.previous!==''&&a.previous!=null?num(a.previous):prev;prev=cum;const w=when([a.date],r.updated);if(!w||!inR(w.d)||!cum)return;
      const net=cum-pv,ded=num(a.ded);R.ad.push({d:w.d,est:w.est,fileNo:P.fileNo,name:P.name,contractor:P.contractor,no:String(a.no||'').trim()||String(i+1),serial:a.serial,cost,cum,prev:pv,net,ded,pay:net-ded,act:a.actual!==''?num(a.actual):null,fin:cost?cum/cost*100:null,status:r.status});});});
  /* أوامر التغيير: كل أمر بتاريخه */
  if(!lk('co'))(D.co.records||[]).filter(r=>r&&!r.demo).forEach(r=>{const P=r.project||{},dc=r.decision||{};
    (r.orders||[]).forEach((o,i)=>{const w=when([o.decDate,o.date,dc.orderDate,r.docDate],r.updated);if(!w||!inR(w.d))return;const add=num(o.add),del=num(o.del),nw=num(o.nw);if(!add&&!del&&!nw&&!num(o.extraDays))return;
      R.co.push({d:w.d,est:w.est,fileNo:P.fileNo,name:P.name,contractor:P.contractor,no:i+1,value:num(P.value),add,del,nw,net:add+nw-del,days:num(o.extraDays),decNo:o.decNo||dc.orderNo||'',reason:o.reason||'',status:r.status});});});
  /* محاضر الاستلام بأنواعها */
  const AC={pac:'استلام أولي',pap:'استلام أولي جزئي',fac:'استلام نهائي',fpa:'استلام نهائي جزئي'};
  if(!lk('ac'))Object.entries(AC).forEach(([k,lb])=>{let o={};try{o=JSON.parse((D.ac||{})[k]||'{}')||{};}catch(_){}
    Object.values(o).forEach(x=>{if(!x||typeof x!=='object')return;const w=when([x.outDate,x.visitDate,x.prelimDate,x.orderDate],x.savedAt?Date.parse(x.savedAt):0);if(!w||!inR(w.d))return;
      R.ac.push({d:w.d,est:w.est,type:lb,serial:x.serial,fileNo:x.fileNo,name:x.pName,contractor:x.contractor,cost:num(x.cost2)||num(x.cost1),outNo:x.outNo,orderNo:x.orderNo,orderDate:x.orderDate,visit:x.visitDate});});});
  /* الأوامر الإدارية: المدد الإضافية والتوقف والإعفاء (نظام المدد) + الأوامر الإدارية المكتوبة في المخاطبات */
  const KN={ext:'منح مدة إضافية',stop:'منح فترة توقف',partial:'توقف جزئي',fine:'إعفاء من الغرامات',custom:'قرار خاص'},CS={stop:'أمر توقف',resume:'أمر استئناف',res:'أمر استئناف'};
  if(!lk('du'))(D.du.recs||[]).filter(r=>r&&!r.demo&&r.data).forEach(r=>{const S=r.data,P=S.p||{};
    (S.exts||[]).forEach(e=>{if(e.active===false)return;const w=when([e.axDate,e.z&&e.z.date,e.date],r.updated);if(!w||!inR(w.d))return;
      R.ord.push({d:w.d,est:w.est,src:'المدد والتوقف',kind:KN[e.kind||'ext']||'قرار',no:e.axNo||'',fileNo:P.fileNo,subject:P.name,days:num(e.granted)||num(e.z&&e.z.days)||'',note:e.z&&e.z.decision==='reject'?'رفض':e.z&&e.z.decision==='partial'?'منح جزئي':''});});
    (S.cases||[]).forEach(c=>{const w=when([c.ordDate,c.memoDate,c.reDate],r.updated);if(!w||!inR(w.d))return;
      R.ord.push({d:w.d,est:w.est,src:'المدد والتوقف',kind:CS[c.type]||'أمر',no:c.ordNo||'',fileNo:P.fileNo,subject:P.name,days:'',note:c.causeText||''});});});
  const LT={letter:'كتاب رسمي',memo:'مطالعة',order:'أمر إداري'};
  if(!lk('lt'))(D.lt.records||[]).filter(r=>r&&!r.tpl&&!r.demo).forEach(r=>{const w=when([r.date,r.sign&&r.sign.date,r.entry&&r.entry.date],r.updated);if(!w||!inR(w.d))return;
    const to=(r.tos&&r.tos.length?r.tos.map(t=>t&&(t.t||t.to||t)).filter(Boolean).join('، '):r.to)||'';
    if(r.type==='order')R.ord.push({d:w.d,est:w.est,src:'المخاطبات',kind:'أمر إداري',no:r.no||'',fileNo:'',subject:r.subject||'',days:'',note:''});
    else R.lt.push({d:w.d,est:w.est,src:'المخاطبات',kind:LT[r.type]||'كتاب',no:r.no||'',subject:r.subject||'',to:String(to),status:r.status==='final'||r.status==='done'?'منجز':r.status==='draft'?'مسودة':(r.status||'')});});
  if(!lk('fu'))(D.fu.records||[]).filter(r=>r&&!r.demo).forEach(r=>{const h=r.head||{},P=r.project||{};const w=when([h.date],r.updated);if(!w||!inR(w.d))return;
    R.lt.push({d:w.d,est:w.est,src:'مطالعات أوامر التغيير',kind:'مطالعة أمر تغيير',no:h.no||'',subject:(P.name||'')+(r.co&&r.co.no?' — أمر التغيير '+r.co.no:''),to:'السيد نائب المحافظ للشؤون الفنية',status:r.status==='draft'?'مسودة':'منجز',
      amt:num(r.add&&r.add.amount)+num(r.nw&&r.nw.amount)-num(r.del&&r.del.amount)});});
  for(const k of ['ad','co','ac','ord','lt'])R[k].sort((a,b)=>a.d-b.d);
  return R;}
/* ---------- بناء ملف Excel ---------- */
function build(R,from,to,meta){const X=XLW.S,C=XLW.colL,today=new Date(),per=`من ${DAYS[from.getDay()]} ${dmy(from)} إلى ${DAYS[to.getDay()]} ${dmy(to)}`,foot='تقرير العمل الأسبوعي — '+dmy(today);
  const sheets=[],T=(v,s)=>({v:v==null?'':v,s:s==null?X.txt:s}),N=v=>({v:Math.round(num(v)),s:X.int}),Pc=v=>v==null?T(''):{v:Math.round(v*10)/10,s:X.pct},Dt=r=>T(dmy(r.d)+(r.est?' *':'')),Dy=r=>T(DAYS[r.d.getDay()]);
  const head=(title,nc)=>{const e=n=>Array.from({length:n-1},()=>({s:X.title}));return {rows:[[{v:'محافظة الأنبار — قسم الشؤون الهندسية',s:X.title},...e(nc)],[{v:title,s:X.org}],[{v:'الفترة '+per+(meta&&meta.who?' — '+meta.who:''),s:X.sub}],[]],merges:[`A1:${C(nc-1)}1`,`A2:${C(nc-1)}2`,`A3:${C(nc-1)}3`]};};
  /* ورقة جدول عامة */
  const table=(name,title,cols,list,rowFn,totFn,tab,lockId)=>{const nc=cols.length,h=head(title,nc),rows=h.rows;rows.push(cols.map(c=>({v:c[0],s:X.head})));const hr=rows.length;
    if(R.locked.includes(lockId)){rows.push([{v:'النظام مقفل بكلمة سر — افتحه ثم أعد إنشاء التقرير لإدراج أعماله',s:X.txt}]);h.merges.push(`A${rows.length}:${C(nc-1)}${rows.length}`);}
    else if(!list.length){rows.push([{v:'لا توجد أعمال في هذه الفترة',s:X.txt}]);h.merges.push(`A${rows.length}:${C(nc-1)}${rows.length}`);}
    else{list.forEach((r,i)=>rows.push(rowFn(r,i)));if(totFn){const t=totFn(hr+1,rows.length);rows.push(t);}}
    sheets.push({name,cols:cols.map(c=>c[1]),rows,merges:h.merges,freeze:hr,titles:hr,filter:list.length?`A${hr}:${C(nc-1)}${hr}`:null,heights:{1:30,2:26,[hr]:32},footer:foot,tab,zoom:95});return hr;};
  const sumF=(c,a,b,v,st)=>({f:`SUM(${C(c)}${a}:${C(c)}${b})`,v:Math.round(v),s:st||X.gtI});
  const G=n=>Array.from({length:n},()=>({s:X.gtT}));
  /* 1) الملخص */
  { const nc=6,h=head('تقرير العمل الأسبوعي',nc),rows=h.rows,merges=h.merges,S=k=>R[k].reduce((a,r)=>a+r,0);
    const sum=(k,f)=>R[k].reduce((a,r)=>a+num(r[f]),0),cnt=(k,f,v)=>R[k].filter(r=>r[f]===v).length;
    const sec=t=>{rows.push([{v:t,s:X.grp},...Array.from({length:nc-1},()=>({s:X.grp}))]);merges.push(`A${rows.length}:${C(nc-1)}${rows.length}`);};
    const kv=(label,val,st,note)=>{rows.push([{v:label,s:X.txt},{s:X.txt},{s:X.txt},typeof val==='number'?{v:Math.round(val*10)/10,s:st||X.int}:{v:val,s:X.txt},{v:note||'',s:X.txt},{s:X.txt}]);merges.push(`A${rows.length}:C${rows.length}`,`E${rows.length}:F${rows.length}`);};
    const lockN=id=>R.locked.includes(id)?'النظام مقفل — غير مُدرج':'';
    sec('السلف — المصروف المالي المرفوع');kv('عدد السلف المرفوعة',R.ad.length,X.int,lockN('ad'));kv('مجموع صافي السلف المرفوعة (د.ع)',sum('ad','net'));kv('مجموع الاستقطاعات (د.ع)',sum('ad','ded'));kv('صافي المبلغ المستحق للصرف (د.ع)',sum('ad','pay'));kv('عدد المشاريع',new Set(R.ad.map(r=>r.fileNo||r.name)).size);
    sec('أوامر التغيير');kv('عدد أوامر التغيير',R.co.length,X.int,lockN('co'));kv('الأعمال الإضافية (د.ع)',sum('co','add'));kv('الأعمال المستحدثة (د.ع)',sum('co','nw'));kv('الأعمال المحذوفة (د.ع)',sum('co','del'));kv('صافي التغيير على كلف العقود (د.ع)',sum('co','net'));kv('المدد الإضافية المرتبطة (يوم)',sum('co','days'));
    sec('محاضر الاستلام');kv('عدد المحاضر',R.ac.length,X.int,lockN('ac'));['استلام أولي','استلام أولي جزئي','استلام نهائي','استلام نهائي جزئي'].forEach(t=>{const n=cnt('ac','type',t);if(n)kv('— '+t,n);});kv('كلفة المشاريع المستلمة (د.ع)',sum('ac','cost'));
    sec('الأوامر الإدارية');kv('عدد الأوامر الإدارية',R.ord.length,X.int,[lockN('du'),lockN('lt')].filter(Boolean).join('، '));[...new Set(R.ord.map(r=>r.kind))].forEach(k=>kv('— '+k,cnt('ord','kind',k)));kv('مجموع المدد الممنوحة (يوم)',sum('ord','days'));
    sec('الكتب والمطالعات');kv('كتب رسمية',cnt('lt','kind','كتاب رسمي'),X.int,lockN('lt'));kv('مطالعات',cnt('lt','kind','مطالعة'));kv('مطالعات أوامر التغيير',cnt('lt','kind','مطالعة أمر تغيير'),X.int,lockN('fu'));
    rows.push([]);
    /* حسب أيام الأسبوع */
    sec('توزيع الأعمال على أيام الفترة');rows.push(['اليوم','السلف','أوامر التغيير','محاضر الاستلام','الأوامر الإدارية','الكتب والمطالعات'].map(v=>({v,s:X.head})));const r0=rows.length+1;
    for(let d=new Date(from);d<=to;d=new Date(d.getFullYear(),d.getMonth(),d.getDate()+1)){const k=ymd(d),c=a=>R[a].filter(r=>ymd(r.d)===k).length;rows.push([{v:DAYS[d.getDay()]+' '+dmy(d),s:X.txt},{v:c('ad'),s:X.int},{v:c('co'),s:X.int},{v:c('ac'),s:X.int},{v:c('ord'),s:X.int},{v:c('lt'),s:X.int}]);}
    const r1=rows.length;rows.push([{v:'المجموع',s:X.gtT},...[1,2,3,4,5].map(c=>sumF(c,r0,r1,[R.ad,R.co,R.ac,R.ord,R.lt][c-1].length))]);
    rows.push([]);rows.push([{v:'* التاريخ المؤشر بنجمة هو تاريخ آخر تعديل على السجل لأن تاريخ المستند غير مكتوب.',s:X.sub}]);merges.push(`A${rows.length}:F${rows.length}`);
    rows.push([]);rows.push([{v:'المُعِدّ',s:X.kpiL},{s:X.kpiL},{s:X.kpiL},{v:'مدير قسم الشؤون الهندسية',s:X.kpiL},{s:X.kpiL},{s:X.kpiL}]);merges.push(`A${rows.length}:C${rows.length}`,`D${rows.length}:F${rows.length}`);
    rows.push([{v:'الاسم والتوقيع:',s:X.txt},{s:X.txt},{s:X.txt},{v:(meta&&meta.manager)||'الاسم والتوقيع:',s:X.txt},{s:X.txt},{s:X.txt}]);merges.push(`A${rows.length}:C${rows.length}`,`D${rows.length}:F${rows.length}`);
    sheets.push({name:'الملخص',cols:[22,10,10,26,18,12],rows,merges,heights:{1:30,2:26,[rows.length]:36},footer:foot,tab:'FF1F5F36',portrait:true,fitH:true,bars:[{ref:`B${r0}:F${r1}`,color:'FF5B9BD5',max:Math.max(1,...[R.ad,R.co,R.ac,R.ord,R.lt].map(x=>x.length))}]});}
  /* 2) السلف */
  table('السلف','السلف المرفوعة — المصروف المالي',[['التاريخ',12],['اليوم',10],['الاضبارة',10],['اسم المشروع',44],['الشركة المنفذة',22],['رقم السلفة',9],['التسلسل',9],['كلفة المشروع',16],['السلف التراكمية',16],['السلف السابقة',16],['صافي السلفة',16],['الاستقطاعات',14],['المستحق للصرف',16],['الإنجاز الفعلي %',10],['الإنجاز المالي %',10]],R.ad,
    r=>[Dt(r),Dy(r),T(r.fileNo),T(r.name,X.wrap),T(r.contractor,X.wrap),T(r.no),T(r.serial),N(r.cost),N(r.cum),N(r.prev),N(r.net),N(r.ded),N(r.pay),Pc(r.act),Pc(r.fin)],
    (a,b)=>[{v:'المجموع — '+R.ad.length+' سلفة',s:X.gtT},...G(6),{v:'',s:X.gtT},{s:X.gtT},{s:X.gtT},sumF(10,a,b,R.ad.reduce((s,r)=>s+r.net,0)),sumF(11,a,b,R.ad.reduce((s,r)=>s+r.ded,0)),sumF(12,a,b,R.ad.reduce((s,r)=>s+r.pay,0)),{s:X.gtT},{s:X.gtT}],'FFC9A227','ad');
  /* 3) أوامر التغيير */
  table('أوامر التغيير','أوامر التغيير',[['التاريخ',12],['اليوم',10],['الاضبارة',10],['اسم المشروع',44],['الشركة المنفذة',22],['رقم الأمر',8],['مبلغ العقد',16],['الأعمال الإضافية',16],['الأعمال المستحدثة',16],['الأعمال المحذوفة',16],['صافي التغيير',16],['المدة الإضافية (يوم)',10],['رقم القرار',12],['السبب',30]],R.co,
    r=>[Dt(r),Dy(r),T(r.fileNo),T(r.name,X.wrap),T(r.contractor,X.wrap),T(r.no),N(r.value),N(r.add),N(r.nw),N(r.del),N(r.net),N(r.days),T(r.decNo),T(r.reason,X.wrap)],
    (a,b)=>[{v:'المجموع — '+R.co.length+' أمر',s:X.gtT},...G(5),{s:X.gtT},sumF(7,a,b,R.co.reduce((s,r)=>s+r.add,0)),sumF(8,a,b,R.co.reduce((s,r)=>s+r.nw,0)),sumF(9,a,b,R.co.reduce((s,r)=>s+r.del,0)),sumF(10,a,b,R.co.reduce((s,r)=>s+r.net,0)),sumF(11,a,b,R.co.reduce((s,r)=>s+r.days,0)),{s:X.gtT},{s:X.gtT}],'FF2E7D4F','co');
  /* 4) محاضر الاستلام */
  table('محاضر الاستلام','محاضر الاستلام',[['التاريخ',12],['اليوم',10],['نوع المحضر',16],['التسلسل',13],['الاضبارة',10],['اسم المشروع',44],['الشركة المنفذة',22],['الكلفة (د.ع)',16],['رقم الصادر',10],['أمر تشكيل اللجنة',12],['تاريخ الأمر',12],['تاريخ الكشف',12]],R.ac,
    r=>[Dt(r),Dy(r),T(r.type),T(r.serial),T(r.fileNo),T(r.name,X.wrap),T(r.contractor,X.wrap),N(r.cost),T(r.outNo),T(r.orderNo),T(r.orderDate),T(r.visit)],
    (a,b)=>[{v:'المجموع — '+R.ac.length+' محضر',s:X.gtT},...G(6),sumF(7,a,b,R.ac.reduce((s,r)=>s+r.cost,0)),...G(4)],'FF5B9BD5','ac');
  /* 5) الأوامر الإدارية */
  table('الأوامر الإدارية','الأوامر الإدارية',[['التاريخ',12],['اليوم',10],['النوع',18],['رقم الأمر',10],['الاضبارة',10],['المشروع / الموضوع',50],['المدة (يوم)',10],['ملاحظة',24],['المصدر',16]],R.ord,
    r=>[Dt(r),Dy(r),T(r.kind),T(r.no),T(r.fileNo),T(r.subject,X.wrap),r.days===''?T(''):N(r.days),T(r.note,X.wrap),T(r.src)],
    (a,b)=>[{v:'المجموع — '+R.ord.length+' أمر',s:X.gtT},...G(5),sumF(6,a,b,R.ord.reduce((s,r)=>s+num(r.days),0)),...G(2)],'FF8E6BB0','du');
  /* 6) الكتب والمطالعات */
  table('الكتب والمطالعات','الكتب الرسمية والمطالعات',[['التاريخ',12],['اليوم',10],['النوع',16],['العدد',10],['الموضوع',56],['إلى',30],['الحالة',10],['المصدر',18]],R.lt,
    r=>[Dt(r),Dy(r),T(r.kind),T(r.no),T(r.subject,X.wrap),T(r.to,X.wrap),T(r.status),T(r.src)],null,'FFB08A2E','lt');
  return XLW.book(sheets,{title:'تقرير العمل الأسبوعي',author:'قسم الشؤون الهندسية — محافظة الأنبار'});}
/* ---------- الفترات الجاهزة (أسبوع العمل: الأحد – الخميس) ---------- */
function range(k){const t=day0(new Date()),sun=new Date(t.getFullYear(),t.getMonth(),t.getDate()-t.getDay());
  if(k==='this')return [sun,new Date(sun.getFullYear(),sun.getMonth(),sun.getDate()+4)];
  if(k==='last'){const s=new Date(sun.getFullYear(),sun.getMonth(),sun.getDate()-7);return [s,new Date(s.getFullYear(),s.getMonth(),s.getDate()+4)];}
  if(k==='7')return [new Date(t.getFullYear(),t.getMonth(),t.getDate()-6),t];
  if(k==='month')return [new Date(t.getFullYear(),t.getMonth(),1),t];return null;}
async function dlg(){if(!window.desktop||!window.desktop.reportData){alert('تقرير العمل الأسبوعي متاح في البرنامج على الحاسبة');return;}
  const d=document.createElement('div');d.className='ov';d.id='wkOv';const [a,b]=range('this');
  d.innerHTML=`<div class="dlg" style="width:min(560px,100%)"><h3>🗓 تقرير العمل الأسبوعي (Excel)</h3>
   <p class="hint" style="margin-top:0">يجمع ما أُنجز في الفترة من كل الأنظمة: <b>السلف</b> (المصروف المالي المرفوع والاستقطاعات والمستحق)، <b>أوامر التغيير</b>، <b>محاضر الاستلام</b>، <b>الأوامر الإدارية</b>، و<b>الكتب والمطالعات</b> — مع ملخص وتوزيع على الأيام وتوقيع المُعِدّ والمدير.</p>
   <div class="wkq">${[['this','الأسبوع الحالي'],['last','الأسبوع الماضي'],['7','آخر 7 أيام'],['month','الشهر الحالي']].map((x,i)=>`<button class="btn${i===0?' pri':''}" data-wk="${x[0]}">${x[1]}</button>`).join('')}</div>
   <div class="wkr"><label>من <input type="date" id="wkFrom" value="${ymd(a)}"></label><label>إلى <input type="date" id="wkTo" value="${ymd(b)}"></label></div>
   <label class="ml">المُعِدّ (يظهر في عنوان التقرير — اختياري)<input id="wkWho" placeholder="مثلاً: شعبة المتابعة" value="${esc(localStorage.getItem('wkWho')||'')}"></label>
   <div class="repn" id="wkN">…</div>
   <div class="row"><button class="btn" data-w="no">إلغاء</button><button class="btn pri" data-w="go">⬇ إنشاء التقرير</button></div></div>`;
  document.body.appendChild(d);d.hidden=false;let D=null;
  const locked=()=>{try{return (window.desktop.authInfo()||[]).filter(i=>i.open===false).map(i=>i.id).filter(i=>['co','du','ad','ac','lt','fu'].includes(i));}catch(_){return [];}};
  const NM={co:'أوامر التغيير',du:'المدد والتوقف',ad:'السلف',ac:'الاستلام',lt:'المخاطبات',fu:'مطالعات الأوامر'};
  const per=()=>{const f=pd($('wkFrom').value),t=pd($('wkTo').value);return f&&t?[f,new Date(t.getFullYear(),t.getMonth(),t.getDate(),23,59,59)]:null;};
  const upd=()=>{const p=per();if(!D||!p){$('wkN').textContent=D?'اختر الفترة':'جارٍ قراءة البيانات…';return;}const R=collect(D,p[0],p[1],locked());
    $('wkN').innerHTML=`في الفترة: <b>${R.ad.length}</b> سلفة · <b>${R.co.length}</b> أمر تغيير · <b>${R.ac.length}</b> محضر استلام · <b>${R.ord.length}</b> أمر إداري · <b>${R.lt.length}</b> كتاب ومطالعة${R.locked.length?`<div class="wkl"><span>🔒 أنظمة مقفلة لن تُدرج حتى تُفتح بكلمة سرها:</span>${R.locked.map(i=>`<label>${NM[i]||i} <input type="password" data-pw="${i}" inputmode="numeric" placeholder="كلمة السر"></label>`).join('')}<button class="btn" data-unl="1">🔓 فتح</button></div>`:''}`;};
  d.addEventListener('input',e=>{if(!e.target.closest('[data-pw]'))upd();});
  d.addEventListener('click',async e=>{const q=e.target.closest('[data-wk]');if(q){const r=range(q.dataset.wk);$('wkFrom').value=ymd(r[0]);$('wkTo').value=ymd(r[1]);d.querySelectorAll('[data-wk]').forEach(x=>x.classList.toggle('pri',x===q));upd();return;}
    if(e.target.closest('[data-unl]')){let bad=0;for(const x of d.querySelectorAll('[data-pw]')){if(!x.value)continue;const ok=await window.desktop.unlock(x.dataset.pw,x.value);if(ok!==true)bad++;}D=await window.desktop.reportData();upd();if(bad&&window.flash)window.flash('كلمة سر غير صحيحة',true);return;}
    const b=e.target.closest('[data-w]');if(e.target===d||(b&&b.dataset.w==='no')){d.remove();return;}if(!b||!D)return;const p=per();if(!p)return;
    const who=$('wkWho').value.trim();try{localStorage.setItem('wkWho',who);}catch(_){}
    const R=collect(D,p[0],p[1],locked()),buf=build(R,p[0],p[1],{who}),name=`تقرير-العمل-الأسبوعي_${ymd(p[0])}_${ymd(p[1])}.xlsx`;
    const r=await window.desktop.saveFile(name,buf);if(r==='ok'){d.remove();if(window.flash)window.flash('تم حفظ تقرير العمل الأسبوعي');}});
  D=await window.desktop.reportData();upd();}
window.WeeklyReport={collect,build,range,pd,open:dlg};
document.addEventListener('click',e=>{if(e.target.closest('[data-weekly]'))dlg();});
})();
