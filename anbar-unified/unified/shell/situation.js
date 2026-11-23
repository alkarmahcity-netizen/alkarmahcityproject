/* الموقف العام: لوحة المشاريع الاحترافية + قاعدة المهندسين المشرفين حسب الدائرة */
(function(){
const RN=AnbarReg.RN;
/* الأيام من تاريخ الإنجاز المخطط إلى اليوم: موجب = مضى على الموعد، سالب = متبقٍّ عليه، null = لا تاريخ */
const PE_RX=/^(\d{4})-(\d{1,2})-(\d{1,2})|^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/;
function planDays(p){const m=PE_RX.exec(String(p&&p.planEnd||'').trim());if(!m)return null;const y=+(m[1]||m[6]),mo=+(m[2]||m[5]),d=+(m[3]||m[4]);if(!(y>1990&&mo>=1&&mo<=12&&d>=1&&d<=31))return null;
  const t=new Date(),a=Date.UTC(t.getFullYear(),t.getMonth(),t.getDate()),b=Date.UTC(y,mo-1,d);return Math.round((a-b)/864e5);}
function planDaysTxt(p,short){const n=planDays(p);if(n==null)return '';if(n===0)return 'اليوم موعد الإنجاز المخطط';
  return n>0?(short?`مضى ${fmt(n)} يوم`:`مضى ${fmt(n)} يوماً على تاريخ الإنجاز المخطط`):(short?`متبقٍّ ${fmt(-n)} يوم`:`متبقٍّ ${fmt(-n)} يوماً على تاريخ الإنجاز المخطط`);}
/* كل التواريخ تُعرض يوم/شهر/سنة (المخزَّن yyyy-mm-dd أو تاريخ ووقت ISO) */
const DMY=v=>{const t=String(v==null?'':v).trim();const m=/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/.exec(t);return m?`${+m[3]}/${+m[2]}/${m[1]}`:t;};window.DMY=DMY;
const planDate=p=>{const v=String(p&&p.planEnd||'').trim();const m=/^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(v);return m?`${+m[3]}/${+m[2]}/${m[1]}`:v;};
const picked=new Set();try{(JSON.parse(localStorage.getItem('sitPicked')||'[]')||[]).forEach(x=>picked.add(String(x)));}catch(_){}
const num=v=>typeof v==='number'?(isFinite(v)?v:0):(parseFloat(String(v==null?'':v).replace(/[^\d.\-]/g,''))||0);
const pc=v=>Math.round(num(v)*10)/10;
const has=v=>v!==''&&v!=null;
const money=n=>fmt(n);
const compact=n=>{n=Math.round(+n||0);const a=Math.abs(n),s=n<0?'−':'';if(a>=1e9)return s+(a/1e9).toFixed(2).replace(/\.?0+$/,'')+' مليار';if(a>=1e6)return s+(a/1e6).toFixed(2).replace(/\.?0+$/,'')+' مليون';return fmt(n);};
const DU_L={stop:'متوقف',over:'انتهت المدة',pend:'بانتظار قرار',p25:'تجاوز 25%',run:'جارٍ',miss:'ناقص'};
function stKind(s){s=String(s||'').trim();if(/منجز/.test(s)&&!/غير منجز/.test(s))return 'ok';if(/استئناف|مستأنف|مستانف|استؤنف/.test(s))return 'blue';if(/متوقف|^توقف|سحب العمل|مسحوب/.test(s))return 'bad';if(/متلك/.test(s))return 'warn2';if(/متأخر|متاخر|خارج الخط/.test(s))return 'warn';if(/ضمن|مستمر|جار|قيد التنفيذ|قيد الانجاز|قيد الإنجاز/.test(s))return 'blue';return 'none';}
const ST_NAMES=[['ok','منجز'],['blue','مستمر (ضمن الخطة / قيد التنفيذ)'],['warn','متأخر عن الخطة / خارج الخطة'],['warn2','متلكئ'],['bad','متوقف'],['none','غير مصنّف (حالة فارغة أو أخرى)']];
const KCOL={ok:'#2f8a45',bad:'#c0392b',warn:'#d19a1a',warn2:'#c2570c',blue:'#2563a8',none:'#8a968f'};
let sub='proj',selDept='',openFn='',engF='';
const $q=id=>document.getElementById(id);

/* ---------- بيانات مشتقة ---------- */
/* تدقيق الموقف مقابل الأنظمة: كل خلل بين ما في الموقف الشهري وما سُجّل في لجنة السلف وأوامر التغيير والمدد والاستلام */
/* سبب الفرق بين الموقف والنظام، من تفاصيل كل أمر/سلفة: الموقف لم يُحدَّث بعد أمر أو سلفة، أو جمع المضافة والمستحدثة دون طرح المحذوفة */
function coWhy(v,co,tol,m){const it=co.items||[];if(!it.length)return '';let cum=0;const sums=it.map(x=>(cum+=num(x.net)));
  for(let k=0;k<sums.length-1;k++)if(Math.abs(sums[k]-v)<=tol)return ` — السبب: الموقف يطابق مجموع الأوامر حتى الأمر ${k+1} فقط، ولم يُحدَّث بعد ${it.slice(k+1).map(x=>`الأمر ${x.no} (صافيه ${num(x.net)>=0?'+':''}${m(x.net)})`).join(' و')}`;
  const gross=it.reduce((s,x)=>s+num(x.add)+num(x.nw),0);if(Math.abs(gross-v)<=tol)return ` — السبب: الموقف يجمع المضافة والمستحدثة (${m(gross)}) دون طرح المحذوفة (${m(it.reduce((s,x)=>s+num(x.del),0))})`;
  if(it.some(x=>Math.abs(num(x.net)-v)<=tol)&&it.length>1){const x=it.find(x=>Math.abs(num(x.net)-v)<=tol);return ` — السبب: الموقف فيه صافي الأمر ${x.no} وحده لا المجموع التراكمي للأوامر`;}
  return ` — الأوامر في النظام: ${it.map(x=>`(${x.no}) ${num(x.net)>=0?'+':''}${m(x.net)}`).join('، ')}`;}
/* للمشروع أكثر من ملف في أوامر التغيير (مستورد من البرنامج القديم + ملف جديد مثلاً): يُذكر كل ملف بأوامره وصافيه ليُحذف المكرر */
function coAlts(co,m){const A=(co&&co.alts)||[];if(!A.length)return '';return ` — ⚠ للمشروع ${A.length+1} ملفات في نظام أوامر التغيير: المقارَن ${co.orders} أمر بصافي ${m(co.changeCost)}، و${A.map(a=>`ملف ${a.legacy?'مستورد من البرنامج القديم':'آخر'}${a.formNo?' (استمارة '+a.formNo+')':''} فيه ${a.orders} أمر بصافي ${m(a.changeCost)}`).join('، و')} — احذف الملف المكرر من نظام أوامر التغيير`;}
/* تدقيق السلف: سبب الفرق بين «السلف المرفوعة» في الموقف والتراكمي في لجنة تدقيق السلف، محسوباً من كل سلفة — وإن لم يُعرف السبب تُذكر السلف كلها */
const dmyS=d=>{const x=String(d||'').match(/^(\d{4})-(\d{2})-(\d{2})/);return x?`${+x[3]}/${+x[2]}/${x[1]}`:'';};
function adWhy(v,ad,tol,m){const it=ad.items||[];if(!it.length)return '';const nm=x=>'السلفة '+(x.name||x.no),last=it[it.length-1];
  const k=it.findIndex(x=>Math.abs(num(x.cum)-v)<=tol);
  if(k>=0&&k<it.length-1)return ` — السبب: الموقف يطابق تراكمي ${nm(it[k])} ولم يُحدَّث بعد ${it.slice(k+1).map(x=>`${nm(x)} (صافيها ${m(x.net)})`).join(' و')}`;
  const sumNet=it.reduce((s,x)=>s+num(x.net),0);if(it.length>1&&Math.abs(sumNet-v)<=tol&&Math.abs(sumNet-num(ad.cumulative))>tol)return ` — السبب: الموقف يجمع صافي السلف (${m(sumNet)}) بدل التراكمي`;
  if(it.length>1&&Math.abs(num(last.net)-v)<=tol)return ` — السبب: الموقف فيه صافي ${nm(last)} وحدها (${m(last.net)}) لا التراكمي`;
  const F=(ad.files||[]).filter(f=>!f.used),f=F.find(f=>Math.abs(num(f.cumulative)-v)<=tol);
  if(f)return ` — السبب: الموقف يطابق ملفاً آخر للمشروع في لجنة السلف (${f.legacy?'مستورد من البرنامج القديم':'ملف آخر'}، ${f.count} سلفة، تراكمي ${m(f.cumulative)})`;
  const d=v-num(ad.cumulative),list=it.map(x=>`${nm(x)}: تراكمي ${m(x.cum)} (صافي ${m(x.net)})${x.date?' في '+dmyS(x.date):''}`).join('؛ ');
  if(d>tol)return ` — الموقف أكبر من آخر سلفة مدققة في النظام بـ ${m(d)}: قد تكون رُفعت سلفة لم تُدخل بعد في لجنة تدقيق السلف. السلف في النظام: ${list}`;
  return ` — الموقف أقل من آخر سلفة مدققة بـ ${m(-d)}: لم يُحدَّث الموقف بعد آخر سلفة، أو أُدخل فيه مبلغ آخر. السلف في النظام: ${list}`;}
/* للمشروع أكثر من ملف في لجنة تدقيق السلف: يُذكر كل ملف بعدد سلفه وآخر تراكمي */
function adFiles(ad,m){const F=(ad&&ad.files)||[];if(F.length<2)return '';return ` — ⚠ للمشروع ${F.length} ملفات في لجنة تدقيق السلف: ${F.map(f=>`${f.legacy?'مستورد':'ملف'} فيه ${f.count} سلفة آخر تراكمي ${m(f.cumulative)}${ad.rid&&f.used?' (المقارَن)':''}`).join('، ')}`;}
/* «قيد الإنجاز — ليس خللاً»: الموقف يطابق المجموع حتى أمر/سلفة سابقة، وما بعدها لم يصدر بعد بدليل — أمر تغيير بلا عدد أمر إداري،
   أو سلفة في ملف «قيد المراجعة» أو أُدخلت خلال 45 يوماً — فالموقف صحيح ولا يُعدّ خللاً، ويُذكر في قسم مستقل */
function coPending(v,co,tol,m){const it=co.items||[];let cum=0;const sums=it.map(x=>(cum+=num(x.net)));
  for(let k=0;k<sums.length-1;k++)if(Math.abs(sums[k]-v)<=tol){const later=it.slice(k+1);if(later.every(x=>!String(x.decNo||'').trim()))
    return `أوامر التغيير: الموقف (${m(v)}) صحيح حتى الأمر ${k+1}؛ ${later.map(x=>`الأمر ${x.no} (صافيه ${num(x.net)>=0?'+':''}${m(x.net)})`).join(' و')} لم يصدر بعد (لا عدد ولا تاريخ للأمر الإداري في نظام أوامر التغيير) — يُضاف إلى الموقف بعد إصداره`;return '';}
  return '';}
function adPending(v,ad,tol,m){const it=ad.items||[],k=it.findIndex(x=>Math.abs(num(x.cum)-v)<=tol);if(k<0||k>=it.length-1)return '';
  const later=it.slice(k+1),now=Date.now(),recent=x=>{const t=Date.parse(String(x.date||'').slice(0,10));return isFinite(t)&&now-t<=45*864e5;};
  if(!later.every(x=>x.st==='review'||x.st==='draft'&&recent(x)||recent(x)))return '';
  return `السلف: الموقف (${m(v)}) صحيح حتى السلفة ${it[k].name||it[k].no}؛ ${later.map(x=>`السلفة ${x.name||x.no} (صافيها ${m(x.net)}${x.date?'، بتاريخ '+dmyS(x.date):''})`).join(' و')} ${later.length>1?'حديثة':'حديثة'} في لجنة التدقيق${later.some(x=>x.st==='review')?' (الملف «قيد المراجعة»)':''} ولم تُرفع بعد على ما يبدو — تُضاف إلى الموقف بعد رفعها`;}
function issuesOf(p,L,total,pend,acked){const I=[],tol=Math.max(1000,(total||0)*0.001),m=v=>Math.round(num(v)).toLocaleString('en-US');
  if(pend&&stKind(p.status)==='ok'&&!aeOf(p))pend.push(['ae','المشروع منجز ولم يُدخل «تاريخ الإنجاز الفعلي» — أدخله في «الكلفة والمدة» أدناه']);
  if(L.ad&&num(L.ad.cumulative)>0){const d=num(p.advRaised)-num(L.ad.cumulative),pa=has(p.advRaised)&&Math.abs(d)>tol?adPending(num(p.advRaised),L.ad,tol,m):'';if(pa){if(pend)pend.push(['ad',pa]);}else if(!has(p.advRaised)||Math.abs(d)>tol)I.push(['ad',`السلف المرفوعة في الموقف ${has(p.advRaised)?m(p.advRaised):'(فارغة)'} ≠ التراكمي في لجنة تدقيق السلف ${m(L.ad.cumulative)}${has(p.advRaised)?' (الفرق '+m(d)+')':''}${has(p.advRaised)?adWhy(num(p.advRaised),L.ad,tol,m):''}${adFiles(L.ad,m)}`]);}
  if(num(p.advPaid)>num(p.advRaised)+tol&&has(p.advRaised))I.push(['ad',`السلف المصروفة ${m(p.advPaid)} أكبر من المرفوعة ${m(p.advRaised)}`]);
  const adMax=Math.max(num(p.advRaised),L.ad?num(L.ad.cumulative):0);if(total>0&&adMax>total+tol)I.push(['ad',`السلف ${m(adMax)} تتجاوز الكلفة الكلية ${m(total)}`]);
  if(L.co&&has(L.co.changeCost)&&Math.abs(num(p.changeCost)-num(L.co.changeCost))>tol){
    /* ملف أوامر التغيير بلا مبالغ (صافي 0) والموقف فيه مبلغ: ليس خطأً في قراءة الموقف بل ملف أوامر غير مكتمل — يُقال ذلك صراحةً */
    if(Math.abs(num(L.co.changeCost))<=tol&&Math.abs(num(p.changeCost))>tol){const it=L.co.items||[],days=it.reduce((x,y)=>x+num(y.days),0)||num(L.co.extraDays);
      I.push(['co',`كلفة أوامر التغيير ${m(p.changeCost)} مسجّلة في الموقف، لكن ملف المشروع في نظام أوامر التغيير فيه ${num(L.co.orders)||it.length||1} أمر بلا مبالغ (المحذوفة والمضافة والمستحدثة = 0)${days?` — مسجّلة فيه مدد إضافية فقط (${days} يوم)`:''} — أدخل مبالغ الأمر في نظام أوامر التغيير ليطابق الموقف`]);}
    else{const pc=coPending(num(p.changeCost),L.co,tol,m);if(pc){if(pend)pend.push(['co',pc]);}else I.push(['co',`كلفة أوامر التغيير في الموقف ${m(p.changeCost)} ≠ في نظام أوامر التغيير ${m(L.co.changeCost)}${coWhy(num(p.changeCost),L.co,tol,m)}${coAlts(L.co,m)}`]);}}
  if(L.du&&num(L.du.ext)>0&&has(p.extra)&&Math.abs(num(p.extra)-num(L.du.ext))>0)I.push(['du',`المدة الإضافية في الموقف ${m(p.extra)} يوم ≠ الممنوحة في نظام المدد ${m(L.du.ext)} يوم`]);
  const acc=L.ac&&L.ac.records&&L.ac.records.length?L.ac.records:null;if(acc&&stKind(p.status)!=='ok'&&acc.some(r=>/^(pac|fac)$/.test(r.type)))I.push(['ac',`للمشروع محضر ${acc.map(r=>r.typeLabel).join(' و')} وحالته في الموقف «${p.status||'—'}» لا «منجز»`]);
  if(window.FinLink)try{I.push(...FinLink.issues(p,L));}catch(_){}
  /* «✔ تحققتُ — تجاهل هذا الفرق»: الفرق الذي تحقق منه المستخدم لا يُعدّ خللاً لهذا المشروع، ويعود تلقائياً إن تغيّر أي رقم فيه (البصمة من نص الفرق بأرقامه) */
  const ak=ackSet(p.fileNo);if(ak.size){const keep=[];I.forEach(x=>{if(ak.has(issH(x))){if(acked)acked.push(x);}else keep.push(x);});return keep;}
  return I;}
function issH(x){const t=String(x[0])+'|'+String(x[1]);let h=5381;for(let i=0;i<t.length;i++)h=((h<<5)+h+t.charCodeAt(i))|0;return (h>>>0).toString(36);}
function ackSet(fn){try{const m=AnbarReg.getMeta(fn);return new Set(String(m&&m.ackIss||'').split(',').filter(x=>x&&x!=='-'));}catch(_){return new Set();}}
/* «الموقف المعروض»: موقف لجنة واحدة (الكرمة، حديثة…) أو كل اللجان — يشمل البطاقات والرسوم والجدول والخريطة والمهندسين والتقارير */
let sitCom=(()=>{try{return localStorage.getItem('sitCom')||'';}catch(_){return '';}})();
const comOf=p=>String(p&&p.committee||'').trim()||AnbarReg.districtOf(p)||'غير محدد';
const inCom=p=>!sitCom||comOf(p)===sitCom;
function comBar(S){const el=$q('sitComBar');if(!el)return;const m={};S.projects.forEach(p=>{const k=comOf(p);m[k]=(m[k]||0)+1;});
  const keys=Object.keys(m).sort((a,b)=>(a==='غير محدد')-(b==='غير محدد')||m[b]-m[a]||a.localeCompare(b,'ar'));
  if(sitCom&&!m[sitCom]){sitCom='';try{localStorage.setItem('sitCom','');}catch(_){}}
  if(keys.length<2&&!sitCom){el.innerHTML='';el.hidden=true;return;}el.hidden=false;
  el.className='comsel'+(sitCom?' on':'');
  el.innerHTML=`<label for="sitCom">📋 الموقف المعروض:</label><select id="sitCom"><option value="">كل اللجان — الموقف المتراكم (${S.projects.length} مشروع)</option>${keys.map(k=>`<option value="${esc(k)}"${k===sitCom?' selected':''}>${esc(k)} (${m[k]} مشروع)</option>`).join('')}</select>
    <span class="cominfo">${sitCom?`يُعرض الآن موقف <b>${esc(sitCom)}</b> وحده: البطاقات والرسوم والجدول والخريطة والمهندسون والتقارير <button class="btn sm" data-comall="1">↩ كل اللجان</button>`:'اختر لجنة لعرض موقفها ومتابعته وإصدار تقاريرها وحدها'}</span>`;}
document.addEventListener('change',e=>{if(e.target&&e.target.id==='sitCom'){sitCom=e.target.value;try{localStorage.setItem('sitCom',sitCom);}catch(_){}selDept='';render();}});
document.addEventListener('click',e=>{if(e.target.closest('[data-comall]')){sitCom='';try{localStorage.setItem('sitCom','');}catch(_){}render();}});
function finDlg(){if(!window.desktop||!window.desktop.finUnlock)return;const st=window.desktop.finState(),d=document.createElement('div');d.className='ov';d.id='finOv';
  d.innerHTML=`<div class="dlg" style="width:min(440px,100%)"><h3>🔒 إظهار المبالغ المالية وعدد مشاريع المهندسين</h3><p>كلفة العقود وأوامر التغيير والسلف، وعدد المشاريع لكل مهندس مقيم أو مشرف، محجوبة عن الموظفين. أدخل <b>كلمة سر المدير</b> لإظهارها؛ تُحجب ثانية مع «قفل الكل» أو القفل التلقائي.</p>
   <label class="ml">كلمة سر المدير<input id="finPw" type="password" autocomplete="off"></label>
   <label class="chk"><input type="checkbox" id="finAlways" ${st.always?'checked':''}> هذه حاسبة مدير القسم — إظهار المبالغ دائماً على هذه الحاسبة</label>
   <div class="err" id="finE"></div><div class="row"><button class="btn" data-fin="no">إلغاء</button><button class="btn pri" data-fin="ok">إظهار</button></div></div>`;
  document.body.appendChild(d);d.hidden=false;setTimeout(()=>$q('finPw').focus(),50);
  const go=async()=>{const al=$q('finAlways').checked,r=await window.desktop.finUnlock($q('finPw').value,al!==st.always?al:null);if(r==='ok'){d.remove();render();flash(al?'المبالغ ظاهرة دائماً على هذه الحاسبة':'ظهرت المبالغ المالية');}else{$q('finE').textContent=r==='wait'?'محاولات كثيرة خاطئة — انتظر دقيقة':'كلمة سر المدير غير صحيحة';$q('finPw').value='';$q('finPw').focus();}};
  d.addEventListener('click',e=>{const b=e.target.closest('[data-fin]');if(e.target===d||(b&&b.dataset.fin==='no'))d.remove();else if(b)go();});$q('finPw').addEventListener('keydown',e=>{if(e.key==='Enter')go();if(e.key==='Escape')d.remove();});}
document.addEventListener('click',e=>{if(e.target.closest('[data-finshow]'))finDlg();});
try{if(window.desktop&&window.desktop.onFin)window.desktop.onFin(()=>{try{render();}catch(_){}});}catch(_){}
/* نوع التمويل والجهة المستفيدة من ملف التخطيط (إن رُبط المشروع بمكوّن فيه) — للعرض والتقارير فقط */
/* طبقات العرض: التمويل والجهة من ملف التخطيط، ثم السلف المصححة من ملف المالية (Excel) */
/* تاريخ الإنجاز الفعلي: من ملف موقف اللجنة (عمود «تاريخ الإنجاز الفعلي») أو يُدخل في البرنامج للمشروع المنجز (يُحفظ مع بيانات المشروع ويُزامن) */
/* الكلفة المصادقة: من ملف موقف اللجنة (عمود «الكلفة المصادقة»)، وإلا من ملف التخطيط للمكوّن المرتبط */
const apOf=p=>{if(!p)return null;if(num(p.approvedCost)>0)return {v:num(p.approvedCost),src:'من ملف الموقف'};if(num(p._approvedPl)>0)return {v:num(p._approvedPl),src:'من ملف التخطيط'};return null;};
const aeOf=p=>{if(!p)return '';if(has(p.actualEnd))return String(p.actualEnd);try{const m=AnbarReg.getMeta(p.fileNo);return m&&m.actualEnd?String(m.actualEnd):'';}catch(_){return '';}};
const aeIso=v=>{const t=String(v||'').trim();let m=/^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(t);if(m)return `${m[1]}-${String(m[2]).padStart(2,'0')}-${String(m[3]).padStart(2,'0')}`;m=/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/.exec(t);return m?`${m[3]}-${String(m[2]).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}`:'';};
const aeLate=p=>{const a=aeIso(aeOf(p)),b=aeIso(p&&p.planEnd);if(!a||!b)return null;return Math.round((Date.parse(a)-Date.parse(b))/864e5);};
/* خانة السلف في القائمة: إن لم يكن في ملف الموقف رقم للسلف المرفوعة والمصروفة، تُعرض أرقام المشروع من برنامج الشؤون المالية (إن كان مرتبطاً) مع بيان أنها من المالية */
/* أرقام ملف المالية تختلف عن موقف اللجنة؟ (للاستدلال فقط — لا تغيّر الموقف) */
function finDiff(p){const f=p&&p._finXl;if(!f)return false;return (f.raised!=null&&Math.round(f.raised)!==Math.round(num(p.advRaised)))||(f.paid!=null&&Math.round(f.paid)!==Math.round(num(p.advPaid)));}
function finCell(p){try{const m=window.FinLink&&FinLink.of(p.fileNo),f=m&&m.f;if(!f||!(num(f.sp)||num(f.legacyLeft)))return '<span class="co">—</span>';
  return `<span class="co">من المالية:</span><br>مصروف ${money(f.sp)}${num(f.legacyLeft)?`<br>سلفة${f.advNo?' '+esc(f.advNo):''} غير مصروفة ${money(f.legacyLeft)}`:''}`;}catch(_){return '<span class="co">—</span>';}}
const ov=p=>{try{p=window.PlanLink?PlanLink.apply(p):p;}catch(_){}try{p=window.FinXl?FinXl.apply(p):p;}catch(_){}
  try{if(p&&!has(p.actualEnd)){const m=AnbarReg.getMeta(p.fileNo);if(m&&m.actualEnd)p=Object.assign({},p,{actualEnd:m.actualEnd,_aeIn:1});}}catch(_){}return p;};
function rows(){const S=AnbarReg.state();return S.projects.filter(inCom).map(p0=>{const p=ov(p0);const L=S.links[p.fileNo]||{};
  const total=num(p.total)||num(p.orig),dev=has(p.actualPct)&&has(p.planPct)?num(p.actualPct)-num(p.planPct):null;
  const sys=[];
  if(L.co)sys.push(['co',L.co.orders+' أمر تغيير'+((L.co.alts||[]).length?` (⚠ ${(L.co.alts||[]).length+1} ملفات للمشروع)`:''),L.co.exceeds||(L.co.alts||[]).length?'bad':'ok']);
  if(L.du){sys.push(['du',DU_L[L.du.status]||'مدد',L.du.status==='stop'||L.du.status==='over'?'bad':(L.du.status==='pend'||L.du.status==='p25'||L.du.status==='miss')?'warn':'ok']);}
  if(L.ad)sys.push(['ad',L.ad.count+' سلفة',L.ad.pct>num(p.actualPct)+0.05&&has(p.actualPct)?'warn':'ok']);
  if(L.in)sys.push(['in',L.in.done?'التأمينات صادرة':'التأمينات مسودة',L.in.done?'ok':'warn']);
  if(L.ac&&L.ac.records&&L.ac.records.length){const r=L.ac.records[0];sys.push(['ac',r.typeLabel,r.status==='expired'?'bad':r.status==='soon'?'warn':'ok']);}
  const iss=issuesOf(p,L,total);
  return {p,L,total,dev,sys,iss,bad:sys.some(x=>x[2]==='bad')||iss.length>0};});}
function opts(sel,list,first){const cur=sel.value;sel.innerHTML=`<option value="">${first}</option>`+list.map(x=>`<option>${esc(x)}</option>`).join('');if(list.includes(cur))sel.value=cur;}
function uniq(P,k){return [...new Set(P.map(p=>p[k]).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),'ar'));}

/* ---------- مؤشرات ورسوم ---------- */
/* برامج التمويل: تُعرض كما هي مكتوبة في ملفات Excel للموقف (عمود «برنامج التمويل»)، بلا تجميع في فئات.
   الكتابات التي تختلف بالمسافات أو الهمزة أو التاء المربوطة أو الألف المقصورة فقط تُعدّ برنامجاً واحداً، ويُعرض بأول كتابة وردت في الموقف. */
function fundColor(k){const t=RN(k).replace(/[إأآ]/g,'ا');return /منافذ/.test(t)?'#2563a8':/تنميه\s*(ال)?اقاليم/.test(t)?'#1f6b3a':/استقرار/.test(t)?'#b08a2e':'#6b7a72';}
const FUND_SEEN=new Map();
function fundGroup(f){if(f&&typeof f==='object')f=f.fund;let raw=String(f==null?'':f).replace(/\s+/g,' ').trim();if(raw&&AnbarReg.fundCanon)raw=AnbarReg.fundCanon(raw);if(!raw)return 'غير محدد';
  const k=RN(raw).replace(/[إأآ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي').replace(/[\s.،,\-–_/\\()]+/g,'');
  if(!FUND_SEEN.has(k))FUND_SEEN.set(k,raw);return FUND_SEEN.get(k);}
function fundTiles(R){const g={};R.forEach(r=>{const k=fundGroup(r.p.fund);(g[k]=g[k]||{n:0,cost:0}).n++;g[k].cost+=r.total;});
  const keys=Object.keys(g).sort((a,b)=>(a==='غير محدد')-(b==='غير محدد')||g[b].n-g[a].n||a.localeCompare(b,'ar'));
  return `<div class="card fundc"><h4>عدد المشاريع حسب برنامج التمويل</h4><div class="fundt">${keys.map(k=>`<button class="ft" data-fund="${esc(k)}" style="--fc:${fundColor(k)}" title="عرض مشاريع «${esc(k)}» في الجدول"><b>${g[k].n}</b><span>${esc(k)}</span><small>${compact(g[k].cost)} د.ع</small></button>`).join('')}</div></div>`;}
/* المبالغ الحساسة: تظهر بكلمة سر المدير أو على حاسبة المدير؛ وفي المتصفح والهاتف (بلا برنامج) تبقى ظاهرة */
function finVis(){try{return !window.desktop||!window.desktop.finState||window.desktop.finState().visible;}catch(_){return true;}}
/* أسماء المهندسين المشرفين والمقيمين: مخفية حتى كلمة سر المدير (القفل نفسه الذي يُظهر المبالغ المالية، ويُغلق مع «قفل الكل») */
/* أسماء المهندسين المقيمين والمشرفين ظاهرة لكل اللجان (1.55.0)؛ عدد المشاريع لكل مهندس وحده يُحجب حتى كلمة سر المدير */
const engVis=()=>true,cntVis=()=>finVis();
const ENGLOCK='<div class="hint" data-finshow="1" style="cursor:pointer" title="اضغط وأدخل كلمة سر المدير">🔒 أسماء المهندسين المشرفين والمقيمين مخفية — كلمة سر المدير</div>';
function kpis(R,S){const P=R.map(r=>r.p),n=P.length,FV=finVis();
  const sum=(f)=>P.reduce((a,p)=>a+num(f(p)),0),totalCost=R.reduce((a,r)=>a+r.total,0),chg=sum(p=>p.changeCost);
  const withAct=P.filter(p=>has(p.actualPct)),avgAct=withAct.length?withAct.reduce((a,p)=>a+num(p.actualPct),0)/withAct.length:0,withPl=P.filter(p=>has(p.planPct)),avgPl=withPl.length?withPl.reduce((a,p)=>a+num(p.planPct),0)/withPl.length:0;
  const cnt=k=>P.filter(p=>stKind(p.status)===k).length;
  const raised=sum(p=>p.advRaised),paid=sum(p=>p.advPaid);
  let adCnt=0,adSum=0,acCnt=0,acWarn=0,coCnt=0,duStop=0,coNet=0;
  Object.keys(S.links||{}).forEach(fn=>{const L=S.links[fn];if(!P.find(p=>String(p.fileNo)===String(fn)))return;if(L.ad){adCnt+=L.ad.count;adSum+=L.ad.cumulative;}if(L.ac&&L.ac.records){acCnt+=L.ac.records.length;acWarn+=L.ac.records.filter(r=>r.status==='soon'||r.status==='expired').length;}if(L.co){coCnt+=L.co.orders;coNet+=num(L.co.changeCost);}if(L.du&&L.du.status==='stop')duStop++;});
  const k=(l,v,s,c)=>`<div class="kpi ${c||''}"><span>${l}</span><b>${v}</b>${s?`<small>${s}</small>`:''}</div>`;
  const kf=(l,v,s,c)=>FV?k(l,v,s,c):`<div class="kpi ${c||''} finhid" data-finshow="1" title="مبلغ مالي محجوب — اضغط لإظهاره بكلمة سر المدير"><span>${l}</span><b>🔒 ••••••</b><small>محجوب — اضغط وأدخل كلمة سر المدير</small></div>`;
  const brk=ST_NAMES.map(([kk,l])=>[kk,l,cnt(kk)]).filter(x=>x[2]||x[0]!=='none'),tot=brk.reduce((a,x)=>a+x[2],0);
  const brkHtml=`<span class="stb">${brk.map(([kk,l,c])=>`<span class="stbi" data-st-k="${kk}" title="${esc(l)}"><i style="background:${KCOL[kk]}"></i>${({ok:'منجز',blue:'مستمر',warn:'متأخر / خارج الخطة',warn2:'متلكئ',bad:'متوقف',none:'غير مصنّف'})[kk]} <b>${c}</b></span>`).join('')}</span><span class="stbt${tot===n?'':' bad'}">المجموع ${tot} ${tot===n?'= عدد مشاريع الموقف ✓':'≠ '+n}</span>${duStop?`<span class="stcur" style="color:#b42318">${duStop} من المتوقفة بقرار توقف في نظام المدد</span>`:''}<span class="stcur">مشاريع الخطة الحالية = الكلي ${n} − المنجز ${cnt('ok')} = <b>${n-cnt('ok')}</b></span>`;
  return [k('مشروع في الموقف',n,brkHtml),
    kf('مبالغ أوامر التغيير (دينار)',`<span title="${money(chg)}">${compact(chg)}</span>`,`${P.filter(p=>num(p.changeCost)).length} مشروع بأوامر تغيير — ${num(sum(p=>p.orig))?pc(chg/num(sum(p=>p.orig))*100):0}% من الكلفة الأصلية`,'warn'),
    kf('إجمالي كلفة العقود (دينار)',`<span title="${money(totalCost)}">${compact(totalCost)}</span>`,`أوامر التغيير: ${chg>=0?'+':''}${money(chg)}`,'gold'),
    k('متوسط الانجاز الفعلي',pc(avgAct)+'%',`المخطط ${pc(avgPl)}% — الفرق ${pc(avgAct-avgPl)}%`,avgAct<avgPl?'warn':'blue'),
    kf('السلف المرفوعة (دينار)',`<span title="${money(raised)}">${compact(raised)}</span>`,`${money(raised)} — ${P.filter(p=>num(p.advRaised)>0).length} مشروع (من الموقف)`,'blue'),
    kf('السلف المصروفة (دينار)',`<span title="${money(paid)}">${compact(paid)}</span>`,`${money(paid)}${raised?` — ${pc(paid/raised*100)}% من المرفوعة`:''}`,'ok'),
    kf('المبلغ المتبقي للصرف (دينار)',`<span title="${money(raised-paid)}">${compact(raised-paid)}</span>`,`${money(raised-paid)}${raised?` — ${pc((raised-paid)/raised*100)}% من المرفوعة`:''} — ${P.filter(p=>num(p.advRaised)-num(p.advPaid)>0).length} مشروع لم تُصرف سلفه كاملة`,'warn'),
    ...(()=>{const F=window.FinLink&&FinLink.kpi(R);return F?[kf('المصروف في المالية (دينار)',`<span title="${money(F.sp)}">${compact(F.sp)}</span>`,`${F.n} مشروع مرتبط بالمالية من ${F.total}${F.pend>0?` — سلف مدققة لم تُصرف كاملة: ${money(F.pend)}`:''}`,'ok')]:[];})(),
    k('سلف لجنة التدقيق',adCnt,adCnt?`التراكمي ${money(adSum)} دينار`:'لم تُدخل سلف بعد'),
    k('أوامر التغيير (بالنظام)',coCnt,coCnt?`صافي المبالغ بالنظام: ${compact(coNet)} د.ع`:''),
    k('محاضر الاستلام',acCnt,acWarn?`${acWarn} تنبيه صيانة`:'', acWarn?'bad':'')].join('');}
function hbars(title,items,colorFn,fmtv){const max=Math.max(1,...items.map(x=>x[1]));
  return `<div class="card"><h4>${title}</h4>${items.length?items.map(([l,n,c])=>`<div class="hb"><span title="${esc(l)}">${esc(l.length>26?l.slice(0,25)+'…':l)}</span><div class="tr"><i style="width:${Math.max(3,n/max*100)}%;background:${c||colorFn||'var(--green-2)'}"></i></div><span class="n">${fmtv?fmtv(n):n}</span></div>`).join(''):'<div class="hint">لا بيانات</div>'}</div>`;}
function group(P,f){const m={};P.forEach(p=>{const k=f(p)||'غير محدد';m[k]=(m[k]||0)+1;});return Object.entries(m).sort((a,b)=>b[1]-a[1]);}
function charts(R){const P=R.map(r=>r.p);
  const st=group(P,p=>p.status).map(([l,n])=>[l,n,KCOL[stKind(l)]]);
  const topCo=P.filter(p=>num(p.changeCost)>0).sort((a,b)=>num(b.changeCost)-num(a.changeCost)).slice(0,7).map(p=>[p.name||('اضبارة '+p.fileNo),num(p.changeCost),'#c2570c']);
  return hbars('حالة المشاريع',st)+hbars('أعلى المشاريع بمبالغ أوامر التغيير (د.ع)',topCo,null,compact)+hbars('حسب القطاع (الجهة المستفيدة)',group(P,p=>sectorOf(p)==='غير محدد'?'':sectorOf(p)).slice(0,7).map(([l,n])=>[l,n,'#b08a2e']));}

/* ---------- الجدول ---------- */
function filtered(R){const q=($q('q').value||'').trim().toLowerCase(),fs=$q('fs').value,ff=$q('ff').value,fz=$q('fz').value,fx=$q('fx').value,so=$q('so').value;
  const EV=engVis();let f=R.filter(r=>{const p=r.p;if(q&&![p.fileNo,p.name,p.contractor,p.contractNo,EV?p.resident:'',p.residentOffice,p.status,EV?AnbarReg.supText(p.fileNo):''].join(' ').toLowerCase().includes(q))return false;
    if(fs&&p.status!==fs)return false;if(ff&&fundGroup(p.fund)!==ff)return false;if(fz&&sectorOf(p)!==fz)return false;
    if(fx==='co'&&!r.L.co)return false;if(fx==='du'&&!r.L.du)return false;if(fx==='ad'&&!r.L.ad)return false;if(fx==='ac'&&!(r.L.ac&&r.L.ac.records))return false;
    if(fx==='bad'&&!r.bad)return false;if(fx==='mis'&&!r.iss.length)return false;if(fx==='none'&&r.sys.length)return false;return true;});
  const cmp={fileNo:(a,b)=>num(a.p.fileNo)-num(b.p.fileNo),name:(a,b)=>String(a.p.name).localeCompare(String(b.p.name),'ar'),cost:(a,b)=>b.total-a.total,
    act:(a,b)=>(has(a.p.actualPct)?num(a.p.actualPct):999)-(has(b.p.actualPct)?num(b.p.actualPct):999),late:(a,b)=>{const x=planDays(a.p),y=planDays(b.p);return (y==null?-1e9:y)-(x==null?-1e9:x);},dev:(a,b)=>(a.dev==null?999:a.dev)-(b.dev==null?999:b.dev)}[so];
  if(cmp)f=f.slice().sort(cmp);return f;}
function progress(p){if(!has(p.actualPct)&&!has(p.planPct))return '<span class="co">—</span>';const a=Math.min(100,num(p.actualPct)),pl=has(p.planPct)?Math.min(100,num(p.planPct)):null;
  return `<div class="pb" title="الفعلي ${pc(p.actualPct)}% — المخطط ${has(p.planPct)?pc(p.planPct)+'%':'—'}"><i style="width:${a}%;background:${KCOL[stKind(p.status)]}"></i>${pl!=null?`<u style="left:${pl}%"></u>`:''}</div><div class="pbl">فعلي ${pc(p.actualPct)}%${pl!=null?' · مخطط '+pc(pl)+'%':''}</div>`;}
function table(f){
  if(!f.length)return '<div class="empty">لا توجد مشاريع مطابقة.</div>';const EVt=engVis();
  return `<table><thead><tr><th class="pk" title="تحديد كل المشاريع الظاهرة"><input type="checkbox" id="pkAll"></th><th>الاضبارة</th><th>المشروع والشركة</th><th>الكلفة (دينار)</th><th>الانجاز</th><th>الحالة</th><th>السلف (موقف)</th><th>المهندس المقيم</th><th>الأنظمة</th></tr></thead><tbody>${f.map(r=>{const p=r.p;
    return `<tr data-fn="${esc(p.fileNo)}"${r.iss&&r.iss.length?' class="hasiss"':''}><td class="pk"><input type="checkbox" data-pk="${esc(p.fileNo)}"${picked.has(String(p.fileNo))?' checked':''} title="تحديد المشروع للطباعة أو النسخ أو التقرير"></td><td class="n">${esc(p.fileNo)}${r.iss&&r.iss.length?`<div class="issmark" title="${esc(r.iss.map(x=>x[1]).join('\n'))}">⚠ ${r.iss.length}</div>`:''}</td>
    <td><div class="pn">${esc(p.name)}</div><div class="co">${esc(p.contractor||'')}${p.contractNo?' — عقد '+esc(p.contractNo)+(p.year?'/'+esc(p.year):''):''}${p.sector?' — القطاع: '+esc(p.sector):''}${p.district?' — '+esc(p.district)+(p.sub?' / '+esc(p.sub):''):''}</div></td>
    <td class="n"><b>${money(r.total)}</b>${num(p.changeCost)?`<br><span class="co">أوامر التغيير ${num(p.changeCost)>0?'+':''}${money(p.changeCost)}</span>`:''}</td>
    <td style="min-width:130px">${progress(p)}${p.planEnd?`<div class="pdays${planDays(p)>0&&stKind(p.status)!=='ok'?' late':''}" title="تاريخ الإنجاز المخطط ${esc(planDate(p))}">المخطط ${esc(planDate(p))}${planDays(p)!=null?' — '+planDaysTxt(p,1):''}</div>`:''}</td>
    <td><span class="chip ${stKind(p.status)}">${esc(p.status||'—')}</span>${p.legal&&p.legal!=='-'?`<div class="co">${esc(p.legal)}</div>`:''}</td>
    <td class="n">${num(p.advRaised)||num(p.advPaid)?`مرفوعة ${money(p.advRaised)}<br>مصروفة ${money(p.advPaid)}${num(p.advRaised)?` <span class="co">(${pc(num(p.advPaid)/num(p.advRaised)*100)}%)</span>`:''}${finDiff(p)?`<br><span class="co" style="color:#b45309">المالية: ${p._finXl.raised!=null&&Math.round(p._finXl.raised)!==Math.round(num(p.advRaised))?'مرفوعة '+money(p._finXl.raised)+' ':''}${p._finXl.paid!=null&&Math.round(p._finXl.paid)!==Math.round(num(p.advPaid))?'مصروفة '+money(p._finXl.paid):''}</span>`:''}`:finCell(p)}</td>
    <td>${EVt?`<div>${esc(p.resident||'—')}</div>`:`<div class="co" data-finshow="1" style="cursor:pointer" title="كلمة سر المدير">🔒 مخفي</div>`}<div class="co">${esc(p.residentOffice||'')}</div>${EVt&&AnbarReg.supText(p.fileNo)?`<div class="co">المشرفون: ${esc(AnbarReg.supText(p.fileNo))}</div>`:''}</td>
    <td>${r.sys.length?r.sys.map(([a,t,k])=>`<span class="pill ${k}" data-app="${a}">${esc(t)}</span>`).join(''):'<span class="co">لا سجل</span>'}</td></tr>`;}).join('')}</tbody></table>`;}

/* ---------- درج تفاصيل المشروع ---------- */
function d(l,v,cls){return `<div class="${cls||''}"><i>${l}</i><b>${v===''||v==null?'—':v}</b></div>`;}
/* ملخص «سلف لجنة التدقيق» في الموقف يُتحقق منه بملفات لجنة السلف على هذه الحاسبة:
   - مصدره: اسم ملف السلف (يُعرض في بطاقة المشروع، مع تنبيه إن كان اسماً لمشروع آخر — اضبارة مكتوبة خطأً في ملف السلف)
   - ملخص لا يقابله أي ملف سلف (حُذف الملف أو نُقلت سلفه إلى اضبارة أخرى، وبقي الملخص القديم من حاسبة/نسخة أخرى) يُزال من الموقف،
     بشرط أن تكون بيانات السلف هنا أحدث من الملخص بساعة على الأقل (لا يُزال ملخص سلفة جديدة لم تصل بياناتها بعد بالمزامنة) */
let ADX=null,adxAt=0;
function adIdx(){if(Date.now()-adxAt<5000&&ADX)return ADX;adxAt=Date.now();try{const x=window.desktop&&window.desktop.adIndex?window.desktop.adIndex():null;if(!x){ADX=null;return null;}
  const by={};x.recs.forEach(r=>{let fn=r.fn&&AnbarReg.find(r.fn)?r.fn:'';if(!fn){const m=AnbarReg.matchProject('',r.name,r.cno);if(m)fn=String(m.fileNo);}if(fn)(by[fn]=by[fn]||[]).push(r);});ADX={mt:x.mt,by};}catch(_){ADX=null;}return ADX;}
/* ملخص سلف في الموقف بلا ملف يقابله في لجنة التدقيق على هذه الحاسبة: وصل من حاسبة أخرى بالمزامنة قبل بياناتها، أو بقي من ملف حُذف/نُقل.
   يُقال ذلك صراحةً مع «إزالة هذا الملخص» (إن كانت السلفة حقيقية على حاسبة أخرى يعيده تحديث تلك الحاسبة) */
function adOrphan(fn,X){const a=(AnbarReg.links(fn)||{}).ad;if(!a)return '';const at=Date.parse(a.at||'')||0,other=a.src&&AnbarReg.srcId&&a.src!==AnbarReg.srcId();
  return `<div class="hint" style="grid-column:1/-1;color:#b42318"><b>⚠ لا يوجد في لجنة تدقيق السلف على هذه الحاسبة ملف سلف لهذا المشروع</b> — هذا الملخص (${esc(a.count||0)} سلفة، التراكمي ${money(a.cumulative)}${at?'، آخر تحديث '+esc(DMY(new Date(at).toISOString().slice(0,10))):''}) وصل من حاسبة أخرى بالمزامنة قبل بيانات السلف، أو بقي من ملف سلف حُذف أو نُقل إلى اضبارة أخرى.${other?' <b>كتبه البرنامج على حاسبة أخرى أو باسم مستخدم آخر</b> — لذلك كان يعود بعد إزالته؛ الإزالة الآن تمنع عودته ما لم تُضف سلفة جديدة فعلاً.':''}${X?'':' (لا توجد بيانات لجنة التدقيق على هذه الحاسبة أصلاً.)'} <button class="btn sm" data-adrm="${esc(fn)}">إزالة هذا الملخص</button></div>`;}
function adSrc(fn,p){const X=adIdx();if(!X)return adOrphan(fn,null);const L=(X.by[fn]||[]).filter(r=>r.n);if(!L.length)return adOrphan(fn,X);const K=s=>RN(s).replace(/[^ء-ي0-9]/g,'');
  const bad=L.filter(r=>AnbarReg.nameSim&&AnbarReg.nameSim(K(r.name),K(p.name))<0.45);
  return `<div class="hint" style="grid-column:1/-1">مصدر السلف: ${L.map(r=>`ملف «${esc(r.name)}»${r.cno?' — عقد '+esc(r.cno):''}${r.legacy?' (أرشيف)':''}`).join('، ')}${bad.length?` <b style="color:#b33">⚠ اسم ملف السلف يختلف عن اسم هذا المشروع — تحقق من رقم الاضبارة المكتوب في ملف السلف</b>`:''}</div>`;}
let adClean=0;
function adStale(){if(Date.now()-adClean<60000)return;adClean=Date.now();const X=adIdx();if(!X||!X.mt)return;const S=AnbarReg.state();let n=0;
  Object.keys(S.links||{}).forEach(fn=>{const a=S.links[fn]&&S.links[fn].ad;if(!a)return;const at=Date.parse(a.at||'')||0;
    if(!(X.by[fn]||[]).some(r=>r.n)&&at&&X.mt-at>3600e3&&Date.now()-at>3600e3){AnbarReg.dropLink('ad',fn);n++;}});
  if(n)try{console.log('أُزيل '+n+' ملخص سلف لا يقابله ملف في لجنة التدقيق');}catch(_){}}
window.SitAdStale=()=>{adClean=0;adxAt=0;adStale();};
function drawer(fn){const S=AnbarReg.state(),p=ov(S.projects.find(x=>String(x.fileNo)===String(fn)));if(!p)return;const L=S.links[fn]||{},total=num(p.total)||num(p.orig);
  const stf=(p.staff&&p.staff.length)?p.staff:[...(p.resident?[{name:p.resident,dept:p.residentOffice,role:'مهندس مقيم'}]:[])];
  const eng=S.engineers||[],phoneOf=n=>{const e=eng.find(x=>RN(x.name)===RN(n));return e&&e.phone?e.phone:(RN(n)===RN(p.resident)?p.phone:'');};
  const sy=(id,t,txt,kind)=>`<div class="sys"><span><b>${t}</b> — <span class="chip ${kind||'none'}">${esc(txt)}</span></span><button class="btn sm" data-open="${id}">فتح في النظام</button></div>`;
  const ac=L.ac&&L.ac.records&&L.ac.records.length?L.ac.records.map(r=>`${r.typeLabel} ${r.serial}: ${r.statusLabel||''}${r.mEnd?' (الصيانة حتى '+r.mEnd+')':''}`).join(' | '):'لا محاضر بعد';
  const el=$q('drawer');
  el.innerHTML=`<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px"><div><h2>${esc(p.name)}</h2><div class="co">اضبارة ${esc(p.fileNo)} — ${esc(p.contractor||'')}</div></div><div class="dact"><button class="btn sm" data-dp="print" title="طباعة موقف هذا المشروع">🖨 طباعة</button><button class="btn sm" data-dp="pdf" title="حفظ موقف هذا المشروع PDF">📄 PDF</button><button class="btn sm" data-dp="copy" title="نسخ موقف المشروع نصاً للصقه في واتساب أو Word">📋 نسخ</button><button class="btn sm" data-dp="pick" title="إضافة المشروع إلى المشاريع المحددة (لطباعة عدة مشاريع معاً)">${picked.has(String(fn))?'☑ محدد':'☐ تحديد'}</button><button class="btn sm" id="dClose">✕ إغلاق</button></div></div>
   ${(()=>{const PD=[],AK=[],I=issuesOf(p,L,total,PD,AK);return (AK.length?`<div class="issbox" style="border-color:#8a968f;background:rgba(138,150,143,.07)"><b style="color:#5b6660">✔ فروقات تحققتَ منها — لا تُعدّ خللاً (${AK.length})</b><ul>${AK.map(x=>`<li style="color:#5b6660">${esc(x[1])} <button class="btn sm" data-unack="${esc(p.fileNo)}" data-h="${issH(x)}">إلغاء</button></li>`).join('')}</ul></div>`:'')+(PD.length?`<div class="issbox" style="border-color:#1f4fa0;background:rgba(31,79,160,.06)"><b style="color:#1f4fa0">⏳ قيد الإنجاز — ليس خللاً (${PD.length})</b><ul>${PD.map(x=>`<li>${esc(x[1])}</li>`).join('')}</ul></div>`:'')+(I.length?`<div class="issbox"><b>⚠ خلل بين الموقف والأنظمة (${I.length})</b><ul>${I.map(x=>`<li>${esc(x[1])} <button class="btn sm" data-ack="${esc(p.fileNo)}" data-h="${issH(x)}" title="تحققتَ من الموقف والنظام ووجدت الرقمين صحيحين: يُخفى هذا الفرق لهذا المشروع، ويعود إن تغيّر أي رقم فيه">✔ تحققتُ — تجاهل هذا الفرق</button></li>`).join('')}</ul></div>`:`<div class="issok">✔ الموقف مطابق لما في لجنة السلف وأوامر التغيير والمدد والاستلام</div>`);})()}
   <h5>ملخص الأنظمة</h5><div class="dg">${d('سلف لجنة التدقيق',L.ad?L.ad.count+' سلفة — التراكمي '+money(L.ad.cumulative)+(((L.ad.files||[]).length>1)?` — ⚠ للمشروع ${(L.ad.files||[]).length} ملفات: `+(L.ad.files||[]).map(f=>`${f.count} سلفة آخر تراكمي ${money(f.cumulative)}${f.legacy?' (مستورد)':''}`).join('، '):''):(num(p.advRaised)>0?'لا ملف في لجنة التدقيق (لا يمكن مطابقة السلف المرفوعة)':'لا ملف'))}${L.ad?adSrc(fn,p):''}${d(p._finXl?'السلف المرفوعة / المصروفة (مصححة من ملف المالية)':'السلف المرفوعة / المصروفة (الموقف)',money(p.advRaised)+' / '+money(p.advPaid))}${d('أوامر التغيير',L.co?L.co.orders+' أمر — صافي '+money(L.co.changeCost)+((L.co.alts||[]).length?` — ⚠ للمشروع ${(L.co.alts||[]).length+1} ملفات: `+(L.co.alts||[]).map(a=>`${a.orders} أمر بصافي ${money(a.changeCost)}${a.legacy?' (مستورد)':''}`).join('، '):''):'لا ملف')}${d('المدد والتوقف',L.du?(DU_L[L.du.status]||L.du.status||'')+(L.du.ext?' — '+money(L.du.ext)+' يوم':''):'لا ملف')}${d('الاستلام',L.ac&&L.ac.records&&L.ac.records.length?L.ac.records.map(r=>r.typeLabel).join('، '):'لا محاضر')}${d('إطلاق التأمينات',L.in?(L.in.done?'صادرة':'مسودة'):'لا استمارة')}</div>
   <h5>بيانات المشروع والعقد</h5><div class="dg">${d('الشركة المنفذة',esc(p.contractor))}${d('برنامج التمويل',esc(p.fund))}${d('رقم العقد',esc(p.contractNo)+(p.year?' / '+esc(p.year):''))}${d('الجهة المستفيدة (القطاع)',esc(p.sector))}${d('القضاء / الناحية',esc([p.district,p.sub].filter(Boolean).join(' / ')))}${d('الحالة',`<span class="chip ${stKind(p.status)}">${esc(p.status||'—')}</span>`)}${d('الإجراءات القانونية',esc(p.legal))}${d('الاحداثيات',has(p.lat)&&has(p.lng)?`<a href="https://www.google.com/maps?q=${encodeURIComponent(p.lat+','+p.lng)}" target="_blank" rel="noopener">${esc(p.lat)} , ${esc(p.lng)}</a>`:'')}</div>
   <h5>الكلفة والمدة</h5><div class="dg">${d('الكلفة الأصلية',money(p.orig))}${d('كلفة أوامر التغيير',(num(p.changeCost)>0?'+':'')+money(p.changeCost))}${d('الكلفة الكلية',money(total))}${(()=>{const a=apOf(p);return a?d('الكلفة المصادقة',money(a.v)+` <small class="co">(${a.src})</small>`):'';})()}${d('تاريخ المباشرة',esc(DMY(p.start)))}${d('مدة العقد (يوم)',esc(p.dur))}${d('المدة الإضافية (يوم)',esc(p.extra))}${d('المدة الكلية (يوم)',esc(p.totalDays))}${d('تاريخ الانجاز المخطط',esc(planDate(p)))}${d('المدة المنقضية على الإنجاز المخطط',planDaysTxt(p)||'')}${(()=>{const ae=aeOf(p),done=stKind(p.status)==='ok',lt=aeLate(p);
     const late=lt==null?'':lt>0?` <span style="color:#b42318">(متأخر ${lt} يوماً عن المخطط)</span>`:lt<0?` <span style="color:#2f8a45">(قبل المخطط بـ ${-lt} يوماً)</span>`:' (في موعده)';
     if(ae&&!p._aeIn)return d('تاريخ الإنجاز الفعلي',esc(DMY(aeIso(ae)||ae))+late+' <small class="co">(من ملف الموقف)</small>');
     if(!done&&!ae)return '';
     return d('تاريخ الإنجاز الفعلي',`<span style="display:inline-flex;gap:6px;align-items:center;flex-wrap:wrap"><input type="date" id="aeIn" value="${esc(aeIso(ae))}" style="font:inherit"><button class="btn sm" data-aesave="${esc(p.fileNo)}">💾 حفظ</button>${ae?esc(DMY(aeIso(ae)))+late:'<span style="color:#b42318">لم يُدخل بعد</span>'}</span>`);})()}</div>
   <h5>الانجاز</h5><div class="dg f2">${d('',progress(p),'f2')}${d('الانجاز المخطط',has(p.planPct)?pc(p.planPct)+'%':'')}${d('الانجاز الفعلي',has(p.actualPct)?pc(p.actualPct)+'%':'')}${d('الانحراف عن الخطة',has(p.planPct)&&has(p.actualPct)?(num(p.actualPct)-num(p.planPct)>0?'+':'')+pc(num(p.actualPct)-num(p.planPct))+'%':'')}</div>
   <h5>السلف</h5><div class="dg">${d('المرفوعة (موقف اللجنة)',money(p.advRaised))}${d('المصروفة (موقف اللجنة)',money(p.advPaid))}${p._finXl?d('في ملف المالية (للاستدلال)',`مرفوعة ${p._finXl.raised==null?'—':money(p._finXl.raised)}، مصروفة ${p._finXl.paid==null?'—':money(p._finXl.paid)}${finDiff(p)?` <span style="color:#b45309">— تختلف عن موقف اللجنة</span>`:''} — «${esc(p._finXl.src)}» ${esc(DMY(p._finXl.at))}`):''}${d('غير المصروف',money(num(p.advRaised)-num(p.advPaid)))}${d('نسبة الصرف',num(p.advRaised)?pc(num(p.advPaid)/num(p.advRaised)*100)+'%':'')}${L.ad?d('سلف لجنة التدقيق',L.ad.count+' سلفة — التراكمي '+money(L.ad.cumulative)+' ('+pc(L.ad.pct)+'% من الكلفة)','f2'):''}</div>
   ${advTable(L.ad)}
   ${window.FinLink?FinLink.section(p,L):''}
   ${window.PlanLink?PlanLink.section(p):''}
   <h5>أوامر التغيير المرفوعة</h5>${coTable(L.co)}
   <h5>الكادر الهندسي</h5>${!engVis()?ENGLOCK:stf.length?`<table><thead><tr><th>الاسم</th><th>الصفة</th><th>الدائرة</th><th>الهاتف</th></tr></thead><tbody>${stf.map(x=>`<tr style="cursor:default"><td>${esc(x.name)}</td><td>${esc(x.role||'')}</td><td>${esc(x.dept||'')}</td><td class="n" dir="ltr">${esc(phoneOf(x.name)||'')}</td></tr>`).join('')}</tbody></table>`:'<div class="hint">لا بيانات مهندسين لهذا المشروع.</div>'}
   <h5>حالته في الأنظمة</h5>${sy('in','إطلاق التأمينات',L.in?`${L.in.done?'صادرة':'مسودة'}${L.in.orderNo?' — أمر الاستلام النهائي '+L.in.orderNo:''}${L.in.maintTo?' — الصيانة حتى '+L.in.maintTo:''}`:'لا استمارة بعد',L.in?(L.in.done?'ok':'warn'):'none')}${sy('co','أوامر التغيير',L.co?`${L.co.orders} أمر — صافي ${money(L.co.changeCost)} — مدد ${money(L.co.extraDays)} يوم`:'لا ملف بعد',L.co?(L.co.exceeds?'bad':'ok'):'none')}${sy('du','المدد والتوقف',L.du?`${DU_L[L.du.status]||L.du.status}${L.du.ext?' — مدد '+money(L.du.ext)+' يوم':''}${L.du.curEnd?' — انتهاء العقد '+L.du.curEnd:''}`:'لا ملف بعد',L.du?(L.du.status==='stop'||L.du.status==='over'?'bad':'ok'):'none')}${sy('ad','لجنة تدقيق السلف',L.ad?`${L.ad.count} سلفة — ${money(L.ad.cumulative)}`:'لا سلف بعد',L.ad?'ok':'none')}${sy('ac','الاستلام',ac,L.ac&&L.ac.records?'ok':'none')}
   ${p.more&&Object.keys(p.more).length?`<h5>بيانات إضافية من ملف الموقف</h5><div class="dg">${Object.entries(p.more).map(([k,v])=>d(esc(k),esc(v))).join('')}</div>`:''}
   ${p.notes?`<h5>ملاحظات</h5><div>${esc(p.notes)}</div>`:''}`;
  el.hidden=false;openFn=fn;}
window.SitOpen=fn=>{try{drawer(fn);}catch(_){}};
window.SitDrawerRefresh=()=>{try{if(openFn&&!$q('drawer').hidden)drawer(openFn);}catch(_){}};
/* تفاصيل السلف وأوامر التغيير المرفوعة للمشروع (تصل من نظامي السلف وأوامر التغيير لمشاريع الموقف فقط) */
const fdD=v=>v?`<span dir="ltr">${esc(DMY(v))}</span>`:'—';
function advTable(A){if(!A||!(A.items||[]).length)return A?'':'<div class="hint">لا سلف مرفوعة في نظام لجنة تدقيق السلف لهذا المشروع.</div>';
  const it=A.items;return `<div class="dtw"><table class="dtb"><thead><tr><th>السلفة</th><th>التاريخ</th><th>رقم الاستمارة</th><th>الصافي</th><th>التراكمي</th><th>المالي %</th><th>الفعلي %</th></tr></thead><tbody>${it.map(x=>`<tr style="cursor:default"><td>${esc(x.no)} <span class="co">${esc(x.name||'')}</span></td><td>${fdD(x.date)}</td><td>${esc(x.serial||'')}</td><td class="n">${money(x.net)}</td><td class="n">${money(x.cum)}</td><td class="n">${has(x.fin)?pc(x.fin):''}</td><td class="n">${has(x.act)?pc(x.act):''}</td></tr>`).join('')}</tbody>
   <tfoot><tr><td colspan="3"><b>المجموع (${it.length} سلفة)</b></td><td class="n"><b>${money(it.reduce((a,x)=>a+num(x.net),0))}</b></td><td class="n"><b>${money(A.cumulative)}</b></td><td colspan="2"></td></tr></tfoot></table></div>`;}
function coTable(C){if(!C)return '<div class="hint">لا أوامر تغيير مرفوعة في نظام أوامر التغيير لهذا المشروع.</div>';const it=C.items||[];if(!it.length)return `<div class="hint">${C.orders} أمر — صافي ${money(C.changeCost)} د.ع</div>`;
  return `<div class="dtw"><table class="dtb"><thead><tr><th>الأمر</th><th>العدد والتاريخ</th><th>المحذوفة</th><th>المضافة</th><th>المستحدثة</th><th>صافي الأمر</th><th>مدة (يوم)</th><th>الكلفة بعده</th></tr></thead><tbody>${it.map(x=>`<tr style="cursor:default"${x.net<0?' class="neg"':''}><td>${x.fix?'تصحيح ':''}${esc(x.no)}</td><td>${x.decNo?esc(x.decNo)+' — ':''}${fdD(x.date)}</td><td class="n">${money(x.del)}</td><td class="n">${money(x.add)}</td><td class="n">${money(x.nw)}</td><td class="n">${money(x.net)}</td><td class="n">${esc(x.days||0)}</td><td class="n">${money(x.after)}</td></tr>`).join('')}</tbody>
   <tfoot><tr><td colspan="5"><b>الصافي المتراكم (${it.length} أمر)${C.exceeds?' — <span class="chip bad">يتجاوز الحدود</span>':''}</b></td><td class="n"><b>${money(C.changeCost)}</b></td><td class="n"><b>${esc(C.extraDays||0)}</b></td><td class="n"><b>${money(C.newValue)}</b></td></tr></tfoot></table></div>`;}
function closeD(){$q('drawer').hidden=true;openFn='';}
$q('drawer').addEventListener('click',e=>{if(e.target.id==='dClose')closeD();const dp=e.target.closest('[data-dp]');if(dp&&openFn){const r=rows().find(x=>String(x.p.fileNo)===String(openFn));if(!r)return;if(dp.dataset.dp==='pick'){if(picked.has(String(openFn)))picked.delete(String(openFn));else picked.add(String(openFn));savePick();dp.textContent=picked.has(String(openFn))?'☑ محدد':'☐ تحديد';syncPk();pickBar();return;}pickAct(dp.dataset.dp,[r]);return;}const b=e.target.closest('[data-open]');if(b)window.desktop.go(b.dataset.open,openFn);});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$q('drawer').hidden&&['authOv','pwOv','syOv'].every(i=>$q(i).hidden))closeD();});

/* ---------- المهندسون حسب الدائرة ---------- */
function engData(){const S=AnbarReg.state(),map=new Map(),add=e=>{const k=RN(e.name);if(!k)return null;if(!map.has(k))map.set(k,{name:e.name,role:e.role||'',dept:AnbarReg.cleanDept(e.dept),phone:e.phone||'',notes:e.notes||'',projects:[]});const o=map.get(k);if(!o.dept&&e.dept)o.dept=AnbarReg.cleanDept(e.dept);if(!o.role&&e.role)o.role=e.role;if(!o.phone&&e.phone)o.phone=e.phone;return o;};
  (S.engineers||[]).forEach(add);
  S.projects.filter(inCom).forEach(p=>{const seen=new Set();(p.staff||[]).forEach(x=>{const e=add(x);if(e&&!seen.has(RN(x.name))){e.projects.push({p,role:x.role});seen.add(RN(x.name));}});
    if(p.resident&&!seen.has(RN(p.resident))){const e=add({name:p.resident,role:'مهندس مقيم',dept:p.residentOffice,phone:p.phone});if(e)e.projects.push({p,role:'مهندس مقيم'});}});
  /* المشروع المنجز يُرفع من عدد مشاريع المهندس (يبقى مذكوراً في قائمة «المنجزة» للاطلاع فقط) */
  let E=[...map.values()];if(sitCom)E=E.filter(e=>e.projects.length);E.forEach(e=>{e.done=e.projects.filter(x=>stKind(x.p.status)==='ok');e.projects=e.projects.filter(x=>stKind(x.p.status)!=='ok');});return E;}
/* تقييم المهندس (على حاسبة مدير القسم فقط): خمسة مربعات، وأقل من 3 = «لا يكلّف». التقييم لا يُزامَن ولا يصل إلى حاسبات اللجان */
var RATE=null;
function rateMap(){try{RATE=window.desktop&&window.desktop.engRatings?window.desktop.engRatings():null;}catch(_){RATE=null;}return RATE;}
function rateOf(n){try{const x=(RATE||{})[NK(n)];return x?+x.v||0:0;}catch(_){return 0;}}
function rateCell(n){const v=rateOf(n);return `<td class="rate" data-rn="${esc(n)}"><span class="rbx">${[1,2,3,4,5].map(i=>`<button class="rb${i<=v?' on':''}" data-rv="${i}" title="${i} من 5">${i<=v?'■':'□'}</button>`).join('')}${v?'<button class="rb x" data-rv="0" title="مسح التقييم">×</button>':''}</span>${v&&v<3?' <span class="nocharge">لا يكلّف</span>':''}</td>`;}
function rateBadge(n){if(!RATE)return '';const v=rateOf(n);return v?` <span class="rbadge${v<3?' bad':''}" title="تقييم مدير القسم">${'■'.repeat(v)}${'□'.repeat(5-v)}${v<3?' لا يكلّف':''}</span>`:'';}
window.SitRate={rateOf,rateBadge,refresh:rateMap};
function engView(){if(!engVis()){$q('engs').innerHTML=ENGLOCK.replace('hint','empty');try{$q('ekpis').innerHTML='';const rb=$q('rosterBox');if(rb)rb.innerHTML='';}catch(_){}return;}try{rosterView();}catch(err){console.error(err);}const E=engData(),q=($q('eq').value||'').trim().toLowerCase(),rf=$q('er').value;const RV=finVis()&&!!rateMap();
  opts($q('er'),[...new Set(E.map(e=>e.role).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ar')),'كل الصفات');
  const isRes=e=>e.projects.some(x=>/مقيم/.test(x.role))||/مقيم/.test(e.role),isSup=e=>e.projects.some(x=>/مشرف/.test(x.role))||/مشرف/.test(e.role);
  /* بطاقات المؤشرات تُصفّي القائمة: مقيمون، مشرفون، بلا مشاريع، بلا رقم هاتف */
  const EF={res:isRes,sup:isSup,noproj:e=>!e.projects.length,nophone:e=>!e.phone};
  const list=E.filter(e=>(!engF||!EF[engF]||EF[engF](e))&&(!rf||e.role===rf)&&(!q||[e.name,e.dept,e.phone,e.role,...e.projects.map(x=>x.p.name)].join(' ').toLowerCase().includes(q)));
  window.__engList=list;
  const groups={};list.forEach(e=>{const k=e.dept||'غير محدد';(groups[k]=groups[k]||[]).push(e);});
  const keys=Object.keys(groups).sort((a,b)=>groups[b].length-groups[a].length||a.localeCompare(b,'ar'));
  const nRes=E.filter(e=>e.projects.some(x=>/مقيم/.test(x.role))||/مقيم/.test(e.role)).length,nSup=E.filter(e=>e.projects.some(x=>/مشرف/.test(x.role))||/مشرف/.test(e.role)).length;
  const k=(l,v,s,f)=>`<div class="kpi${f?' ekf'+(engF===f?' on':''):''}"${f?` data-ef="${f}" title="${engF===f?'إلغاء التصفية':'عرض هذه الأسماء فقط'}"`:''}><span>${l}</span><b>${v}</b>${s?`<small>${s}</small>`:''}${f?`<small class="ekh">${engF===f?'✕ إلغاء التصفية':'اضغط لعرض الأسماء'}</small>`:''}</div>`;
  $q('ekpis').innerHTML=k('مهندس في القاعدة',E.length,'')+k('دائرة',new Set(E.map(e=>e.dept||'غير محدد')).size,'')+k('مهندسون مقيمون',nRes,'','res')+k('مهندسون مشرفون',nSup,'','sup')+k('بلا مشاريع',E.filter(e=>!e.projects.length).length,'','noproj')+k('بلا رقم هاتف',E.filter(e=>!e.phone).length,'','nophone')+(engF?`<div class="kpi ekbar"><span>يُعرض الآن</span><b>${list.length}</b><small>${({res:'مهندسون مقيمون',sup:'مهندسون مشرفون',noproj:'مهندسون بلا مشاريع',nophone:'بلا رقم هاتف'})[engF]} — «تصدير CSV» يصدّر هذه الأسماء</small></div>`:'');
  if(selDept&&!keys.includes(selDept))selDept='';
  $q('depts').innerHTML=`<button class="dchip ${selDept?'':'on'}" data-d="">الكل <small>(${list.length})</small></button>`+keys.map(k=>`<button class="dchip ${selDept===k?'on':''}" data-d="${esc(k)}">${esc(k)} <small>(${groups[k].length})</small></button>`).join('');
  if(!E.length){$q('engs').innerHTML='<div class="empty">لا توجد قاعدة مهندسين بعد. استورد ملف الموقف الذي يحوي ورقتي «قائمة المشرفين» و«الكادر الهندسي» (أو أي ملف فيه عمود المهندس المقيم ودائرته).</div>';return;}
  $q('engs').innerHTML=(RV?'':'<div style="margin:6px 0"><button class="btn" data-finshow="1" title="تقييم المهندسين من 1 إلى 5 — على حاسبة مدير القسم فقط">🔒 تقييم المهندسين — أدخل كلمة سر المدير</button></div>')+keys.filter(k=>!selDept||selDept===k).map(k=>{const CV=cntVis(),L=groups[k].slice().sort((a,b)=>(CV?b.projects.length-a.projects.length:0)||a.name.localeCompare(b.name,'ar')),pn=new Set();L.forEach(e=>e.projects.forEach(x=>pn.add(x.p.fileNo)));
    return `<div class="dept"><h3>${esc(k)}<span>${L.length} مهندس${CV?` — ${pn.size} مشروع`:''}</span></h3><table><thead><tr><th>الاسم</th><th>الصفة</th><th>الهاتف</th>${RV?'<th title="يظهر على حاسبة مدير القسم فقط">التقييم 🔒</th>':''}<th>المشاريع${CV?'':' 🔒'}</th></tr></thead><tbody>${L.map(e=>`<tr style="cursor:default"><td><b>${esc(e.name)}</b>${e.notes?`<div class="co">${esc(e.notes)}</div>`:''}</td><td>${esc(e.role||'')}</td><td class="n" dir="ltr" style="text-align:right">${esc(e.phone||'—')}</td>${RV?rateCell(e.name):''}
      <td>${!CV?(e.projects.length||e.done.length?'<span class="co" data-finshow="1" style="cursor:pointer" title="عدد المشاريع لكل مهندس — كلمة سر المدير">🔒 مخفي</span>':'<span class="co">—</span>'):e.projects.length||e.done.length?`<details><summary>${e.projects.length} مشروع${e.done.length?` <span class="co">(+${e.done.length} منجز لا يُحسب)</span>`:''}</summary><ul>${e.projects.map(x=>`<li>${esc(x.p.name)} <span class="co">— ${esc(x.role||'')}</span></li>`).join('')}${e.done.map(x=>`<li class="co" style="text-decoration:line-through">${esc(x.p.name)} — ${esc(x.role||'')} (منجز)</li>`).join('')}</ul></details>`:'<span class="co">—</span>'}</td></tr>`).join('')}</tbody></table></div>`;}).join('')||'<div class="empty">لا نتائج مطابقة.</div>';}
$q('depts').addEventListener('click',e=>{const b=e.target.closest('[data-d]');if(b){selDept=b.dataset.d;engView();}});
document.addEventListener('click',async e=>{const b=e.target.closest('#engs [data-rv], #rosterBox [data-rv]');if(!b)return;const td=b.closest('[data-rn]');if(!td||!window.desktop||!window.desktop.engRate)return;e.preventDefault();e.stopPropagation();
  const n=td.dataset.rn,r=await window.desktop.engRate(NK(n),n,+b.dataset.rv);if(r==='locked'){flash('التقييم على حاسبة مدير القسم فقط — أظهر المبالغ بكلمة سر المدير',true);engView();return;}rateMap();engView();});
$q('ekpis').addEventListener('click',e=>{const b=e.target.closest('[data-ef]');if(!b)return;engF=engF===b.dataset.ef?'':b.dataset.ef;selDept='';engView();const d=$q('engs');if(d&&engF)d.scrollIntoView({behavior:'smooth',block:'start'});});

/* ---------- استمارة أسماء القسم الهندسي والدوائر: مقاطعة الأسماء مع المقيمين والمشرفين ---------- */
let rosF='none';
/* مفتاح الاسم: بلا ألقاب (م. / المهندس / السيد) وبلا تشكيل، و«عبد الله» = «عبدالله» */
const NK=s=>RN(s).replace(/[^ء-ي\s.]/g,' ').replace(/^\s*(?:(?:م|د)\s*\.\s*|(?:ال)?مهندس(?:ه)?\s+|(?:ال)?سيد(?:ه)?\s+|(?:ال)?دكتور(?:ه)?\s+)+/,'').replace(/\./g,' ').replace(/(^|\s)عبد\s+/g,'$1عبد').replace(/\s+/g,' ').trim();
const RH=t=>RN(t).replace(/[^ء-ي\s\/]/g,'').replace(/\s+/g,' ').trim();
const RCOL={name:t=>/^(?:ال)?اسم(?:\s|$)|^اسم (?:المهندس|الموظف|المنتسب)/.test(t)&&!/المشروع|الدائره|الام|الشركه/.test(t),
  dept:t=>/الدائره|^القسم|الشعبه|جهه الانتساب|مكان العمل|مقر العمل|^الجهه|الوحده|التشكيل|المديريه/.test(t),
  title:t=>/العنوان الوظيفي|^الصفه|الوظيفه|المنصب|الاختصاص|التخصص|الدرجه/.test(t),phone:t=>/هاتف|موبايل|جوال|الاتصال/.test(t),notes:t=>/^ملاحظات/.test(t)};
const DEPTW=/^(?:ال)?(?:دائره|مديريه|قسم|شعبه|بلديه|هيئه|مكتب|وحده|ناحيه|قضاء|مجلس|ديوان|مركز|مستشفي|جامعه|كليه|المهندس المقيم)(?:\s|$)/;
function rosterParse(sheets){const out=[],seen=new Set();
  sheets.forEach(sh=>{const rows=sh.rows||[],sName=/^(sheet|ورقه|ورقة)\s*\d*$/i.test(String(sh.name||'').trim())?'':String(sh.name||'').trim();let H=null,group='',last='';
    const hdr=r=>{const m={};(r||[]).forEach((c,j)=>{const t=RH(c);if(!t||t.length>40)return;for(const k of Object.keys(RCOL))if(m[k]==null&&RCOL[k](t)){m[k]=j;break;}});return m.name!=null?m:null;};
    for(let i=0;i<rows.length;i++){const r=rows[i]||[],h=hdr(r);if(h){H=h;last='';continue;}if(!H)continue;
      const cells=r.map(c=>String(c==null?'':c).replace(/\s+/g,' ').trim()),filled=cells.filter(Boolean),nm=cells[H.name]||'';
      if(!filled.length)continue;
      /* صف عنوان دائرة داخل الجدول: خانة نص واحدة (مع رقم تسلسل أو بدونه) تبدأ بكلمة دائرة/مديرية/قسم...، أو تقع خارج عمود الاسم */
      const txt=filled.filter(x=>!/^\d+$/.test(x));
      if(txt.length===1&&filled.length<=2&&(!nm||DEPTW.test(RN(txt[0])))){group=txt[0].replace(/[:：]\s*$/,'');last='';continue;}
      if(!nm||/^\d+([.,]\d+)?$/.test(nm)||NK(nm).split(' ').length<2)continue;
      let dept=H.dept!=null?cells[H.dept]:'';if(dept)last=dept;else if(H.dept!=null)dept=last;   // خلايا الدائرة المدمجة
      dept=dept||group||sName;const k=NK(nm)+'|'+RN(dept);if(seen.has(k))continue;seen.add(k);
      out.push({name:nm,dept,title:H.title!=null?cells[H.title]:'',phone:H.phone!=null?cells[H.phone]:'',notes:H.notes!=null?cells[H.notes]:''});}});
  return out;}
/* المقاطعة: لكل اسم في الاستمارة عدد مشاريعه مقيماً ومشرفاً (المنجزة لا تُحسب) + المهندسون في الموقف غير المدرجين في الاستمارة */
function rosterX(){const S=AnbarReg.state(),P=(S.roster||[]).map(r=>({...r,k:NK(r.name),res:[],sup:[],done:[]}));P.forEach(p=>p.t=p.k.split(' '));
  const ex=new Map();P.forEach(p=>{if(!ex.has(p.k))ex.set(p.k,[]);ex.get(p.k).push(p);});
  const find=(name,dept)=>{const k=NK(name);if(!k)return null;let c=ex.get(k);
    if(!c){const t=k.split(' ');if(t.length<3)return null;c=P.filter(p=>{const a=p.t.length<=t.length?p.t:t,b=p.t.length<=t.length?t:p.t;return a.length>=3&&a.every((x,i)=>b[i]===x);});}
    if(!c.length)return null;if(c.length>1&&dept){const d=RN(dept),c2=c.filter(p=>{const q=RN(p.dept);return q&&(q.includes(d)||d.includes(q));});if(c2.length)c=c2;}return c[0];};
  const out=new Map();
  S.projects.forEach(p=>{const done=stKind(p.status)==='ok',seen=new Set(),L=(p.staff||[]).map(x=>({name:x.name,dept:x.dept,role:x.role}));if(p.resident)L.push({name:p.resident,dept:p.residentOffice,role:'مهندس مقيم'});
    L.forEach(x=>{const k=NK(x.name);if(!k)return;const isR=/مقيم/.test(x.role||''),key=k+(isR?'|r':'|s');if(seen.has(key))return;seen.add(key);
      let m=find(x.name,x.dept);if(!m){if(!out.has(k))out.set(k,{name:x.name,dept:AnbarReg.cleanDept(x.dept)||'',res:[],sup:[],done:[]});m=out.get(k);if(!m.dept&&x.dept)m.dept=AnbarReg.cleanDept(x.dept);}
      if(done){if(!m.done.includes(p))m.done.push(p);}else{const a=isR?m.res:m.sup;if(!a.includes(p))a.push(p);}});});
  const cat=e=>e.res.length&&e.sup.length?'both':e.res.length?'res':e.sup.length?'sup':'none';P.forEach(e=>e.cat=cat(e));
  return {P,out:[...out.values()].filter(e=>e.res.length||e.sup.length),S};}
const ROSC={all:'كل الأسماء في الاستمارة',res:'مقيم فقط',sup:'مشرف فقط',both:'مقيم ومشرف معاً',none:'بلا مشاريع',out:'في الموقف وغير مدرجين في الاستمارة'};
function rosterView(){const box=$q('rosterBox');if(!box)return;const S=AnbarReg.state();
  const btns=`<button class="btn pri" data-ro="up">⬆ تحميل استمارة أسماء القسم والدوائر</button><button class="btn" data-ro="tpl" title="ملف Excel فارغ بالأعمدة المطلوبة">⬇ نموذج الاستمارة (Excel)</button>`;
  if(!(S.roster||[]).length){box.innerHTML=`<div class="rbox"><div class="rhd"><div><b>📋 مقاطعة أسماء القسم الهندسي والدوائر مع المشاريع</b><div class="co">حمّل ملف Excel بأسماء مهندسي القسم والدوائر (الاسم، العنوان الوظيفي، الدائرة) ليُطابق مع المهندسين المقيمين والمشرفين في الموقف: كم مشروعاً لكل مهندس مقيماً أو مشرفاً أو كليهما، ومن لا توجد لديه مشاريع.</div></div><div class="row">${btns}</div></div></div>`;return;}
  const X=rosterX(),P=X.P,n=c=>c==='all'?P.length:c==='out'?X.out.length:P.filter(e=>e.cat===c).length;
  const card=(c,cls)=>`<div class="kpi ekf ${cls||''}${rosF===c?' on':''}" data-rf="${c}"><span>${ROSC[c]}</span><b>${n(c)}</b><small class="ekh">${rosF===c?'✓ معروض أدناه':'اضغط لعرض الأسماء'}</small></div>`;
  const nAsg=P.reduce((a,e)=>a+e.res.length+e.sup.length,0);
  let L=rosF==='out'?X.out:P.filter(e=>rosF==='all'||e.cat===rosF);
  const g={};L.forEach(e=>{const k=e.dept||'غير محدد';(g[k]=g[k]||[]).push(e);});const keys=Object.keys(g).sort((a,b)=>g[b].length-g[a].length||a.localeCompare(b,'ar'));
  const pl=(A,lab)=>A.length?`<details><summary>${A.length} ${lab}</summary><ul>${A.map(p=>`<li>${esc(p.name)} <span class="co">(${esc(p.fileNo)})</span></li>`).join('')}</ul></details>`:'<span class="co">—</span>';
  let i=0;const RV=finVis()&&!!rateMap();
  box.innerHTML=`<div class="rbox"><div class="rhd"><div><b>📋 مقاطعة أسماء القسم الهندسي والدوائر مع المشاريع</b><div class="co">الاستمارة: «${esc(S.rosterSrc||'—')}» — ${P.length} اسماً في ${new Set(P.map(e=>e.dept||'غير محدد')).size} دائرة/قسم${S.rosterAt?' — حُمّلت '+new Date(S.rosterAt).toLocaleDateString('en-GB'):''} — ${nAsg} تكليفاً في مشاريع غير منجزة (المنجزة لا تُحسب)</div></div>
    <div class="row">${btns.replace('⬆ تحميل استمارة أسماء القسم والدوائر','⬆ تحميل استمارة جديدة')}<button class="btn pri" data-ro="xl">⬇ تصدير المقاطعة (Excel)</button>${RV?'':'<button class="btn" data-finshow="1" title="تقييم المهندسين من 1 إلى 5 — على حاسبة مدير القسم فقط">🔒 تقييم المهندسين</button>'}<button class="btn" data-ro="del" title="إزالة الاستمارة من البرنامج">✕</button></div></div>
    <div class="kpis">${card('all')}${card('res')}${card('sup')}${card('both')}${card('none','rnone')}${card('out','rout')}</div>
    <div class="rlist"><h3>${ROSC[rosF]} — ${L.length}</h3>${L.length?keys.map(k=>`<div class="dept"><h3>${esc(k)}<span>${g[k].length} اسماً</span></h3><table><thead><tr><th>ت</th><th>الاسم</th>${rosF==='out'?'':'<th>العنوان الوظيفي</th><th>الهاتف</th>'}<th>مقيم</th><th>مشرف</th><th>المجموع</th>${RV?'<th title="يظهر على حاسبة مدير القسم فقط">التقييم 🔒</th>':''}${rosF==='all'?'<th>التصنيف</th>':''}</tr></thead><tbody>${g[k].sort((a,b)=>(b.res.length+b.sup.length)-(a.res.length+a.sup.length)||a.name.localeCompare(b.name,'ar')).map(e=>`<tr style="cursor:default"><td class="n">${++i}</td><td><b>${esc(e.name)}</b>${e.done.length?`<div class="co">+${e.done.length} منجز لا يُحسب</div>`:''}</td>${rosF==='out'?'':`<td>${esc(e.title||'')}</td><td class="n" dir="ltr" style="text-align:right">${esc(e.phone||'—')}</td>`}<td>${pl(e.res,'مقيم')}</td><td>${pl(e.sup,'مشرف')}</td><td class="n"><b>${e.res.length+e.sup.length}</b></td>${RV?rateCell(e.name):''}${rosF==='all'?`<td>${ROSC[e.cat]}</td>`:''}</tr>`).join('')}</tbody></table></div>`).join(''):'<div class="empty">لا أسماء في هذا التصنيف.</div>'}</div></div>`;}
function rosterBook(){const X=XLW.S,R=rosterX(),P=R.P,S=R.S,today=new Date().toLocaleDateString('en-GB'),foot='نظام الشؤون الهندسية الموحد — '+today;
  const sub=`الاستمارة: ${S.rosterSrc||'—'} — الموقف: ${S.source||'—'} — ${today} — المشاريع المنجزة لا تُحسب`,T=v=>({v:v==null?'':String(v),s:X.txt}),I=v=>({v:+v||0,s:X.int}),W=v=>({v:v||'',s:X.wrap});
  const nm=A=>A.map(p=>p.name+(p.fileNo?' ('+p.fileNo+')':'')).join('\n'),sheets=[];
  { const C=['الدائرة / القسم','عدد الأسماء','مقيم فقط','مشرف فقط','مقيم ومشرف','بلا مشاريع','تكليفات مقيم','تكليفات مشرف'],hd=repHead('مقاطعة أسماء القسم الهندسي والدوائر مع المشاريع',sub,C.length),rows=hd.rows,merges=hd.merges.slice();rows.push([]);
    const tot=[['عدد الأسماء في الاستمارة',P.length],['مقيم فقط',P.filter(e=>e.cat==='res').length],['مشرف فقط',P.filter(e=>e.cat==='sup').length],['مقيم ومشرف معاً',P.filter(e=>e.cat==='both').length],['بلا مشاريع',P.filter(e=>e.cat==='none').length],['في الموقف وغير مدرجين في الاستمارة',R.out.length]];
    tot.forEach(t=>{rows.push([{v:t[0],s:X.kpiL},{s:X.kpiL},{s:X.kpiL},{v:t[1],s:X.kpiV}]);merges.push(`A${rows.length}:C${rows.length}`);});rows.push([]);
    rows.push(C.map(h=>({v:h,s:X.head})));const hr=rows.length,g={};P.forEach(e=>{const k=e.dept||'غير محدد';(g[k]=g[k]||[]).push(e);});
    Object.keys(g).sort((a,b)=>g[b].length-g[a].length||a.localeCompare(b,'ar')).forEach(k=>{const L=g[k],c=x=>L.filter(e=>e.cat===x).length;rows.push([T(k),I(L.length),I(c('res')),I(c('sup')),I(c('both')),I(c('none')),I(L.reduce((a,e)=>a+e.res.length,0)),I(L.reduce((a,e)=>a+e.sup.length,0))]);});
    const r0=hr+1,r1=rows.length;rows.push([{v:'الإجمالي',s:X.gtT},...[1,2,3,4,5,6,7].map(c=>({f:`SUM(${XLW.colL(c)}${r0}:${XLW.colL(c)}${r1})`,v:0,s:X.gtI}))]);
    rows[rows.length-1].forEach((x,j)=>{if(j)x.v=rows.slice(hr,r1).reduce((a,r)=>a+(+r[j].v||0),0);});
    sheets.push({name:'الملخص',cols:[36,12,11,11,12,11,13,13],rows,merges,heights:{1:30,2:26,[hr]:30},footer:foot,tab:'FF1F5F36',bars:[{ref:`F${r0}:F${r1}`,color:'FFC00000'}]});}
  const list=(name,title,L,withCat,tab)=>{const C=['ت','الاسم','العنوان الوظيفي','الدائرة / القسم','الهاتف','عدد (مقيم)','عدد (مشرف)','المجموع',...(withCat?['التصنيف']:[]),'المشاريع — مقيم','المشاريع — مشرف','منجزة (لا تُحسب)'],hd=repHead(title,sub,C.length),rows=hd.rows;
    rows.push(C.map(h=>({v:h,s:X.head})));const hr=rows.length;
    L.slice().sort((a,b)=>(a.dept||'').localeCompare(b.dept||'','ar')||(b.res.length+b.sup.length)-(a.res.length+a.sup.length)||a.name.localeCompare(b.name,'ar')).forEach((e,i)=>rows.push([I(i+1),T(e.name),T(e.title),T(e.dept||'غير محدد'),T(e.phone),I(e.res.length),I(e.sup.length),I(e.res.length+e.sup.length),...(withCat?[T(ROSC[e.cat]||'')]:[]),W(nm(e.res)),W(nm(e.sup)),W(nm(e.done))]));
    return {name,cols:[6,30,20,26,14,10,10,10,...(withCat?[16]:[]),46,46,30],rows,merges:hd.merges,freeze:hr,titles:hr,filter:`A${hr}:${XLW.colL(C.length-1)}${hr}`,heights:{1:30,2:26,[hr]:30},footer:foot,tab,zoom:90};};
  sheets.push(list('المقاطعة','كل الأسماء — عدد المشاريع مقيماً ومشرفاً',P,true,'FF2E7D4F'));
  sheets.push(list('بلا مشاريع','مهندسون لا توجد لديهم مشاريع',P.filter(e=>e.cat==='none'),false,'FFC00000'));
  sheets.push(list('مقيم ومشرف','مهندسون مقيمون ومشرفون معاً',P.filter(e=>e.cat==='both'),false,'FFC9A227'));
  sheets.push(list('غير مدرجين','مهندسون في الموقف وغير مدرجين في الاستمارة',R.out,false,'FF5B9BD5'));
  return XLW.book(sheets,{title:'مقاطعة أسماء القسم الهندسي',author:'قسم الشؤون الهندسية — محافظة الأنبار'});}
function rosterTpl(){const X=XLW.S,C=['ت','الاسم الكامل','العنوان الوظيفي','الدائرة / القسم','رقم الهاتف','ملاحظات'],hd=repHead('استمارة أسماء مهندسي القسم الهندسي والدوائر','املأ اسماً في كل صف؛ الدائرة لكل اسم (أو ورقة لكل دائرة باسمها)',C.length),rows=hd.rows;
  rows.push(C.map(h=>({v:h,s:X.head})));for(let i=1;i<=150;i++)rows.push([{v:i,s:X.int},{s:X.txt},{s:X.txt},{s:X.txt},{s:X.txt},{s:X.txt}]);
  return XLW.book([{name:'الأسماء',cols:[6,34,24,32,16,26],rows,merges:hd.merges,freeze:4,titles:4,heights:{1:30,2:26,4:28}}],{title:'استمارة أسماء القسم الهندسي',author:'قسم الشؤون الهندسية — محافظة الأنبار'});}
async function saveXl(name,buf){if(window.desktop&&window.desktop.saveFile){const r=await window.desktop.saveFile(name,buf);if(r==='ok')flash('تم حفظ الملف');else if(r==='error')flash('تعذّر حفظ الملف',true);}
  else{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));a.download=name;a.click();}}
async function rosterLoad(file){try{const L=rosterParse(await AnbarReg.readSheets(file));
    if(!L.length){flash('لم يُعثر على أسماء في الملف: يلزم صف عناوين فيه عمود «الاسم» (ومعه الدائرة أو العنوان الوظيفي إن وُجدا)',true);return 0;}
    AnbarReg.setRoster(L,file.name);rosF='none';engView();flash(`استُوردت الاستمارة: ${L.length} اسماً في ${new Set(L.map(e=>e.dept||'غير محدد')).size} دائرة/قسم`);return L.length;}
  catch(err){flash('تعذّر قراءة الاستمارة: '+(err&&err.message||err),true);return 0;}}
window.__rosterLoad=rosterLoad;window.__ros={engData:()=>engData(),NK,rosterX,rosterBook,rosterTpl};
document.addEventListener('click',async e=>{const f=e.target.closest('#rosterBox [data-rf]');if(f){rosF=f.dataset.rf;rosterView();return;}
  const b=e.target.closest('#rosterBox [data-ro]');if(!b)return;const a=b.dataset.ro,d=new Date().toISOString().slice(0,10);
  if(a==='up'){const inp=document.createElement('input');inp.type='file';inp.accept='.xlsx,.xlsm,.csv';inp.onchange=()=>{if(inp.files[0])rosterLoad(inp.files[0]);};inp.click();}
  else if(a==='tpl')saveXl('استمارة-أسماء-القسم-الهندسي-والدوائر.xlsx',rosterTpl());
  else if(a==='xl')saveXl(`مقاطعة-أسماء-القسم-مع-المشاريع_${d}.xlsx`,rosterBook());
  else if(a==='del'){if(confirm('إزالة استمارة الأسماء من البرنامج؟ (لا يتأثر الموقف)')){AnbarReg.setRoster([],'');rosterView();}}});

/* ---------- التصدير ---------- */
function csv(rows){return '﻿'+rows.map(r=>r.map(c=>{c=c==null?'':String(c);return /[",\n]/.test(c)?'"'+c.replace(/"/g,'""')+'"':c;}).join(',')).join('\r\n');}
/* ⬇ تصدير الموقف بنموذج اللجان: نفس بنية ملف الموقف الذي رفعته اللجنة وترتيب أعمدته (صفوف العنوان، ثم العناوين، ثم المشاريع)،
   مع ورقتي «الكادر الهندسي» و«قائمة المشرفين» — فيكون المُخرَج صالحاً للاستيراد كما هو (المدخل = المخرج).
   نوع التمويل والجهة المستفيدة من ملف التخطيط إن رُبط المشروع به. يصدّر «الموقف المعروض» (لجنة واحدة) أو كل اللجان مع عمود «اللجنة». */
const DEF_HEAD=['ت','رقم الاضبارة','اسم المشروع','الشركة المنفذة','برنامج التمويل (نوع الخطة)','رقم العقد','السنة','القطاع (الجهة المستفيدة)','القضاء','الناحية','كلفة المشروع الأصلية','كلفة أوامر التغيير','الكلفة الكلية مع أوامر التغيير','تاريخ المباشرة الفعلية','مدة العقد (يوم)','المدة الإضافية (يوم)','المدة الكلية (يوم)','تاريخ الإنجاز المخطط','نسبة الإنجاز المخطط','نسبة الإنجاز الفعلي','الانحراف عن الخطة','تصنيف حالة المشروع','الإجراءات القانونية','السلف المرفوعة','السلف المصروفة','Nالاحداثيات','Eالاحداثيات','المهندس المقيم','دائرة المهندس المقيم','رقم الهاتف','الملاحظات'];
function comBook(R){const S=AnbarReg.state(),X=XLW.S,lays=AnbarReg.layouts?AnbarReg.layouts():{};
  const pickLay=()=>{if(sitCom&&lays[sitCom])return lays[sitCom];const L=Object.values(lays).filter(l=>l&&Array.isArray(l.head)&&l.head.length);return L.sort((a,b)=>b.head.filter(Boolean).length-a.head.filter(Boolean).length)[0]||null;};
  const lay=pickLay()||{titles:['نموذج إدخال موحد'],head:DEF_HEAD};
  const head=lay.head.map(h=>String(h||'').trim());const F=head.map(h=>AnbarReg.fieldOf(h));
  const multi=!sitCom&&new Set(R.map(r=>comOf(r.p))).size>1;if(multi&&!F.includes('committee')){head.push('اللجنة');F.push('committee');}
  const titles=(lay.titles||[]).slice();if(!titles.some(Boolean))titles.splice(0,titles.length,'نموذج إدخال موحد');
  const isDev=h=>/^الانحراف/.test(RN(h)),PCT={planPct:1,actualPct:1},INT={orig:1,changeCost:1,total:1,dur:1,extra:1,totalDays:1,advRaised:1,advPaid:1};
  const cell=(p,i,j,k)=>{const h=head[j];
    if(k==='seq'||(!k&&/^ت$/.test(RN(h))))return {v:i+1,s:X.int};
    if(k==='committee')return {v:comOf(p),s:X.txt};
    if(PCT[k])return has(p[k])?{v:num(p[k]).toFixed(1)+'%',s:X.txt}:{v:'',s:X.txt};
    if(INT[k])return has(p[k])?{v:num(p[k]),s:X.int}:{v:'',s:X.txt};
    if(k)return {v:p[k]==null?'':String(p[k]),s:X.txt};
    if(isDev(h)&&has(p.actualPct)&&has(p.planPct))return {v:(num(p.actualPct)-num(p.planPct)).toFixed(1)+'%',s:X.txt};
    const m=p.more&&(p.more[h]!=null?p.more[h]:Object.entries(p.more).find(([kk])=>RN(kk)===RN(h))?.[1]);return {v:m==null?'':m,s:X.txt};};
  const rows=[];Array.from(titles).forEach(t=>rows.push(t?[{v:t,s:X.title}]:[]));const hr=rows.length;rows.push(head.map(h=>({v:h,s:X.head})));
  R.forEach((r,i)=>rows.push(F.map((k,j)=>cell(r.p,i,j,k))));
  const L=XLW.colL(head.length-1);const credit='إعداد قسم الشؤون الهندسية — ديوان محافظة الانبار';
  const main={name:'مشاريع القضاء',cols:head.map(h=>/اسم المشروع|الملاحظات/.test(h)?44:/الشركه|الشركة|المهندس|دائره|دائرة|برنامج|القطاع/.test(h)?22:13),rows,merges:titles.map((t,i)=>t?`A${i+1}:${L}${i+1}`:null).filter(Boolean),freeze:hr+1,filter:`A${hr+1}:${L}${hr+1+R.length}`,titles:`${hr+1}`,footer:credit};
  /* الكادر الهندسي */
  const st=R.map(r=>{const p=r.p,L0=(p.staff||[]);const rs=L0.filter(x=>/مقيم/.test(x.role||''));const res=rs.length?{name:rs.map(x=>x.name).join(' / '),dept:rs[0].dept||p.residentOffice||''}:(p.resident?{name:p.resident,dept:p.residentOffice||''}:null);return {p,res,sup:L0.filter(x=>!/مقيم/.test(x.role||''))};});
  const ns=Math.max(4,...st.map(x=>x.sup.length));const sh2=['ت','اسم المشروع','المهندس المقيم (من الجدول الرئيسي)','دائرة المقيم'];for(let k=1;k<=ns;k++)sh2.push('مشرف '+k,'دائرة المشرف '+k);
  const rows2=[sh2.map(h=>({v:h,s:X.head}))].concat(st.map((x,i)=>{const a=[{v:i+1,s:X.int},{v:x.p.name||'',s:X.txt},{v:x.res?x.res.name||'':'',s:X.txt},{v:x.res?x.res.dept||'':'',s:X.txt}];for(let k=0;k<ns;k++){const q=x.sup[k];a.push({v:q?q.name||'':'',s:X.txt},{v:q?q.dept||'':'',s:X.txt});}return a;}));
  const staff={name:'الكادر الهندسي',cols:[5,44,24,20].concat(Array(ns*2).fill(20)),rows:rows2,freeze:1,footer:credit};
  /* قائمة المشرفين */
  const names=new Set();st.forEach(x=>{if(x.res)String(x.res.name).split(' / ').forEach(n=>names.add(RN(n)));x.sup.forEach(q=>names.add(RN(q.name)));});
  const E=(S.engineers||[]).filter(e=>sitCom?names.has(RN(e.name)):true);
  const rows3=[['الاسم الكامل','الصفة','الدائرة المنسوب إليها','رقم الهاتف','ملاحظات'].map(h=>({v:h,s:X.head}))].concat(E.map(e=>[{v:e.name||'',s:X.txt},{v:e.role||'',s:X.txt},{v:e.dept||'',s:X.txt},{v:e.phone||'',s:X.txt},{v:e.notes||'',s:X.txt}]));
  /* «لوحة» ملخّصة أولاً كما في ملفات اللجان (تُتجاهل عند الاستيراد) */
  const P=R.map(r=>r.p),sum=k=>P.reduce((t,p)=>t+num(p[k]),0),byS={};P.forEach(p=>{const k=String(p.status||'غير محدد').trim()||'غير محدد';byS[k]=(byS[k]||0)+1;});
  const av=k=>{const L=P.filter(p=>has(p[k]));return L.length?L.reduce((t,p)=>t+num(p[k]),0)/L.length:0;};
  const d=[[{v:'لوحة الموقف العام — '+(sitCom?'لجنة '+sitCom:'كل اللجان'),s:X.title}],[{v:credit,s:X.sub}],[{v:'تاريخ الإصدار: '+new Date().toISOString().slice(0,10),s:X.sub}],[],
    [{v:'المؤشر',s:X.head},{v:'القيمة',s:X.head}],[{v:'عدد المشاريع',s:X.kpiL},{v:P.length,s:X.kpiV}],[{v:'الكلفة الأصلية',s:X.kpiL},{v:sum('orig'),s:X.kpiV}],[{v:'الكلفة الكلية مع أوامر التغيير',s:X.kpiL},{v:sum('total'),s:X.kpiV}],
    [{v:'السلف المرفوعة',s:X.kpiL},{v:sum('advRaised'),s:X.kpiV}],[{v:'السلف المصروفة',s:X.kpiL},{v:sum('advPaid'),s:X.kpiV}],[{v:'معدل الإنجاز المخطط',s:X.kpiL},{v:av('planPct'),s:X.kpiP}],[{v:'معدل الإنجاز الفعلي',s:X.kpiL},{v:av('actualPct'),s:X.kpiP}],[],
    [{v:'تصنيف حالة المشروع',s:X.head},{v:'العدد',s:X.head}]].concat(Object.entries(byS).sort((a,b)=>b[1]-a[1]).map(([k,n])=>[{v:k,s:X.txt},{v:n,s:X.int}]));
  const dash={name:'لوحة',cols:[36,22],rows:d,merges:['A1:B1','A2:B2','A3:B3'],footer:credit};
  const sheets=[dash,main,staff];if(E.length)sheets.push({name:'قائمة المشرفين',cols:[28,16,26,16,30],rows:rows3,freeze:1,footer:credit});
  return XLW.book(sheets);}
window.SitComBook=()=>comBook(rows());
/* بيانات ملف النموذج لمجموعة مشاريع لجنة: قيمة كل عمود من عناوين النموذج نفسه (الأعمدة المحسوبة تبقى معادلات النموذج) */
const xlSerial=v=>{const m=/^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(String(v||''));return m?Math.round(Date.UTC(+m[1],+m[2]-1,+m[3])/864e5+25569):null;};
const numOrText=v=>{const t=String(v==null?'':v).trim();return /^[1-9]\d{0,14}$/.test(t)?+t:t;};
function tplData(I,com,L){const S=AnbarReg.state();
  const val=(h,p,i)=>{const k=AnbarReg.fieldOf(h.text);const v=k?p[k]:undefined;
    if(k==='seq')return i+1;
    if(k==='fund')return AnbarReg.fundCanon?AnbarReg.fundCanon(p.fund):p.fund;
    if(['fileNo','contractNo','year','phone'].includes(k))return numOrText(v);
    if(k==='approvedCost'){const a=apOf(p);return a?a.v:null;}
    if(['orig','changeCost','total','dur','extra','totalDays','advRaised','advPaid'].includes(k))return has(v)?num(v):null;
    if(k==='actualEnd'){const a=aeOf(p);return xlSerial(aeIso(a))||(a?String(a):null);}
    if(k==='start'||k==='planEnd')return xlSerial(v)||(has(v)?String(v):null);
    if(k==='planPct'||k==='actualPct')return has(v)?Math.round(num(v)*100)/10000:null;
    if(k==='lat'||k==='lng'){const n=parseFloat(String(v||'').replace(',','.'));return isFinite(n)?n:(has(v)?String(v):null);}
    if(k==='committee')return comOf(p);
    if(k==='resident'&&!has(v)){const rs=(p.staff||[]).filter(x=>/مقيم/.test(x.role||''));return rs.length?rs.map(x=>x.name).join(' / '):null;}
    if(k==='residentOffice'&&!has(v)){const rs=(p.staff||[]).find(x=>/مقيم/.test(x.role||''));return rs&&rs.dept?rs.dept:null;}
    if(k)return v==null?null:String(v);
    if(/^الانحراف/.test(RN(h.text)))return has(p.actualPct)&&has(p.planPct)?Math.round((num(p.actualPct)-num(p.planPct))*100)/10000:null;
    const m=p.more&&(p.more[h.text]!=null?p.more[h.text]:(Object.entries(p.more).find(([kk])=>RN(kk)===RN(h.text))||[])[1]);
    if(m==null||m==='')return null;if(xlSerial(m))return xlSerial(m);return /^\d+(\.\d+)?$/.test(String(m))?+m:String(m);};
  const latC=(I.head.find(h=>AnbarReg.fieldOf(h.text)==='lat')||{}).c;
  const rowsOut=[],links=[],staff=[];const names=new Set();
  L.forEach((r,i)=>{const p=r.p,cells={};I.head.forEach(h=>{const v=val(h,p,i);if(v!=null&&v!=='')cells[h.c]=v;});rowsOut.push({cells});
    const la=parseFloat(p.lat),ln=parseFloat(p.lng);if(latC&&isFinite(la)&&isFinite(ln))links.push({ref:latC+(I.headRow+1+i),url:`https://earth.google.com/web/search/${la},${ln}`});
    const st=p.staff||[],rs=st.filter(x=>/مقيم/.test(x.role||''));const res=rs.length?rs.map(x=>x.name).join(' / '):(p.resident||'');
    staff.push({name:p.name||'',res,resDept:(rs[0]&&rs[0].dept)||p.residentOffice||'',sup:st.filter(x=>!/مقيم/.test(x.role||'')).map(x=>[x.name||'',x.dept||''])});
    String(res).split(' / ').forEach(n=>names.add(RN(n)));st.forEach(x=>names.add(RN(x.name)));});
  const eng=(S.engineers||[]).filter(e=>names.has(RN(e.name))).map(e=>[e.name||'',e.role||'',e.dept||'',numOrText(e.phone),e.notes||'']);
  return {title:`موقف مشاريع محافظة الأنبار - ${com}`,rows:rowsOut,staff,engineers:eng,links};}
async function comExport(){if(!engVis()){flash('ملف اللجان يحوي أسماء المهندسين المشرفين والمقيمين — أدخل كلمة سر المدير',true);finDlg();return;}const R0=rows();if(!R0.length){flash('لا مشاريع للتصدير',true);return;}
  /* على ملف نموذج اللجان نفسه (بمعادلاته ولوحته وترتيبه)؛ «كل اللجان» ← ملف لكل لجنة في مجلد يُختار */
  if(window.desktop&&window.desktop.comTpl){const I=await window.desktop.comTpl.info();
    if(I&&!I.error){const d=new Date().toISOString().slice(0,10);const g=new Map();R0.forEach(r=>{const c=sitCom||comOf(r.p);(g.get(c)||g.set(c,[]).get(c)).push(r);});
      const books=[...g.entries()].map(([c,L])=>({name:`الموقف-${c}-${d}`,data:tplData(I,c,L)}));
      const res=await window.desktop.comTpl.save(books);if(!res)return;if(res.error){flash(res.error,true);return;}
      flash(res.files.length>1?`حُفظت مواقف ${res.files.length} لجان بنموذج اللجان`:'حُفظ الموقف بنموذج اللجان');return;}}
  if(!window.XLW){flash('التصدير غير متاح',true);return;}const R=R0;
  const nm=`الموقف-${sitCom||'كل-اللجان'}-${new Date().toISOString().slice(0,10)}.xlsx`.replace(/[\\/:*?"<>|]/g,'-');await saveXl(nm,comBook(R));}
async function save(name,text){const r=await window.desktop.saveFile(name,text);if(r==='ok')flash('تم حفظ الملف');else if(r==='error')flash('تعذّر حفظ الملف',true);}
/* ---------- دمج مواقف الأقضية ---------- */
async function doMerge(){if(!window.desktop||!window.desktop.xlMerge){flash('الدمج متاح في البرنامج على الحاسبة',true);return;}
  flash('اختر ملفات مواقف الأقضية (الملف الأول هو الأساس)…');const r=await window.desktop.xlMerge();if(!r||r.cancel)return;if(!r.ok){flash('تعذّر الدمج: '+(r.msg||''),true);return;}
  const R=r.report,S=r.stats,d=document.createElement('div');d.className='ov';d.id='mgOv';
  d.innerHTML=`<div class="dlg" style="width:min(640px,100%);max-height:88vh;overflow:auto"><h3>🧩 تم دمج ${R.files.length} مواقف في موقف واحد</h3>
   <p>الملف الأساس: <b>${esc(R.files[0])}</b> — أُضيفت إليه بيانات: ${R.files.slice(1).map(esc).join('، ')}. بقيت الأعمدة والتنسيقات والمعادلات واللوحات كما هي، ونُقلت معادلات الصفوف المضافة إلى مواضعها الجديدة.</p>
   <table class="mgt"><tr><th>الورقة</th><th>الأساس</th><th>المضاف</th><th>المجموع</th><th>الصفوف</th></tr>${R.sheets.map(x=>`<tr><td>${esc(x.name)}</td><td>${x.base}</td><td>${x.added}</td><td><b>${x.total}</b></td><td>${x.firstRow}–${x.lastRow}</td></tr>`).join('')}</table>
   ${R.extended?`<p class="hint">مُدّت ${R.extended} معادلة/نطاق (مجاميع ولوحات) لتشمل الصفوف المضافة؛ وتُحسب النتائج عند فتح الملف في Excel.</p>`:''}
   ${R.committees&&R.committees.length?`<p>🏷 أُضيف عمود «اللجنة (ملف الموقف)» لكل مشروع: ${R.committees.map(esc).join('، ')} — ويمكن عرض مركز المتابعة والتقارير حسب اللجنة.</p>`:''}
   ${R.seq?`<p>🔢 أُعطي <b>تسلسل واحد</b> لكل المشاريع (عمود «ت») من 1 إلى آخر مشروع في الملفات المدموجة.</p>`:''}
   ${R.renamedSheets&&R.renamedSheets.length?`<p><b>أوراق بأسماء مختلفة دُمجت في ورقتها المقابلة:</b></p><ul>${R.renamedSheets.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:''}
   ${R.matchedCols&&R.matchedCols.length?`<details><summary><b>${R.matchedCols.length} عموداً بعنوان مختلف الكتابة طوبق مع عموده في الأساس</b> (بدل إضافته عموداً جديداً فارغ الخلايا)</summary><ul>${R.matchedCols.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></details>`:''}
   ${R.costIssues&&R.costIssues.length?`<details><summary style="color:#b54708"><b>🧮 تدقيق البيانات: ${R.costIssues.length} ملاحظة في ملفات الأقضية</b> (الكلية لا تساوي الأصلية + أوامر التغيير، كلفة أو تاريخ مكتوب نصاً، معادلة تشير إلى صف آخر) — نُقلت كما هي، وتحتاج تصحيحاً من اللجنة</summary><ul>${R.costIssues.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></details>`:''}
   ${R.numFixed?`<p>🔢 ${R.numFixed} كلفة كانت مكتوبة نصاً (مثل «5.206.495.000») حُوّلت إلى رقم ليحسبها Excel.</p>`:''}
   ${R.dateFixed?`<p>📅 ${R.dateFixed} تاريخ كان مكتوباً نصاً (مثل «25/3/2025») حُوّل إلى تاريخ.</p>`:''}
   ${R.addedCols.length?`<p><b>أعمدة أُضيفت في آخر الورقة</b> (موجودة في ملف قضاء وغير موجودة في الأساس — لم يُحذف شيء):</p><ul>${R.addedCols.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:''}
   ${R.verify?(R.verify.bad?`<p style="color:#b42318"><b>⚠ التحقق: ${R.verify.bad} خلية لا تطابق ملفها الأصلي</b> (من ${R.verify.cells}) — أرسل الملفات للمطوّر:</p><ul>${R.verify.samples.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:`<p style="color:#1f6b3a"><b>✔ التحقق:</b> قورنت ${R.verify.cells} خلية في ${R.verify.rows} صفاً مضافاً بملفاتها الأصلية — كلها مطابقة.</p>`):''}
   ${R.pctFixed&&R.pctFixed.length?`<p><b>توحيد كتابة النسب</b> (45 و45% تُكتب بطريقة الملف الأساس):</p><ul>${R.pctFixed.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:''}
   ${R.dups&&R.dups.length?`<p style="color:#b42318"><b>تنبيه — أرقام اضبارة مكررة بين الملفات:</b></p><ul>${R.dups.slice(0,12).map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:''}
   ${R.skipped.length?`<p class="hint">لم تُدمج: ${R.skipped.map(esc).join('؛ ')}</p>`:''}
   <h3 style="margin-top:12px">👷 كشف المهندسين المقيمين والمشرفين</h3>
   <p>${S.engineers} مهندساً في ${S.projects} مشروعاً — <b>${S.repeated}</b> مهندساً لديه أكثر من مشروع${S.top.length&&cntVis()?`: ${S.top.map(esc).join('، ')}${S.repeated>S.top.length?'…':''}`:''}.${S.done?` المشاريع المنجزة (${S.done}) لا تُحسب ضمن عدد مشاريع المقيم والمشرف.`:''} (الأوراق: المهندسون، المتكررون، المشاريع والمهندسون)</p>
   ${r.dl?`<p><b>تنزيل الملفين:</b></p><div class="row" style="justify-content:flex-start;flex-wrap:wrap">${r.dl.map((x,i)=>`<button class="btn pri" data-mg="dl${i}">⬇ ${esc(x.name)}</button>`).join('')}</div>`:`<p class="hint">حُفظ: ${(r.saved||[]).filter(Boolean).map(esc).join(' — ')||'لم يُحفظ (أُلغي الحفظ)'}</p>`}
   <div class="row"><button class="btn" data-mg="close">إغلاق</button><button class="btn pri" data-mg="imp">استيراد الموقف المدمج إلى البرنامج</button></div></div>`;
  document.body.appendChild(d);d.hidden=false;
  d.addEventListener('click',async e=>{const b=e.target.closest('[data-mg]');if(e.target===d||(b&&b.dataset.mg==='close')){d.remove();return;}
    if(b&&/^dl\d$/.test(b.dataset.mg)&&r.dl){const x=r.dl[+b.dataset.mg.slice(2)];window.desktop.download(x.name,x.blob);return;}
    if(b&&b.dataset.mg==='imp'){try{const x=await AnbarReg.importFile(new File([r.merged],r.name),{replaceAll:true});flash(`استُورد الموقف المدمج: ${x.total} مشروع — المهندسون ${x.engineers.total}`);d.remove();render();engView();}catch(err){flash('تعذّر الاستيراد: '+(err&&err.message||err),true);}}});}
$q('bMerge').onclick=doMerge;document.addEventListener('click',e=>{if(e.target.closest('[data-merge]'))doMerge();});
try{$q('bComX').onclick=comExport;}catch(_){}
try{$q('bComTpl').onclick=async()=>{if(!window.desktop||!window.desktop.comTpl)return;const I=await window.desktop.comTpl.info();
  if(I&&I.custom&&confirm(`النموذج المعتمد الآن: «${I.file}» (نموذج اختير سابقاً).\n\nموافق = العودة إلى نموذج اللجان الموحد المضمَّن في البرنامج\nإلغاء = اختيار ملف نموذج آخر`)){{const r=await window.desktop.comTpl.reset();if(r&&r.error){flash(r.error,true);return;}}flash('اعتُمد نموذج اللجان الموحد');return;}
  const r=await window.desktop.comTpl.choose();if(!r)return;if(r.error){flash(r.error,true);return;}flash(`اعتُمد النموذج «${r.file}» لتصدير المواقف`);};}catch(_){}
$q('bCsv').onclick=()=>{const f=filtered(rows());const H=['الاضبارة','اسم المشروع','الشركة','التمويل','رقم العقد','السنة','القطاع (الجهة المستفيدة)','القضاء','الناحية','الإحداثي N','الإحداثي E','الكلفة الأصلية','كلفة أوامر التغيير','الكلفة الكلية','تاريخ المباشرة','مدة العقد','المدة الاضافية','المدة الكلية','تاريخ الانجاز المخطط','الانجاز المخطط %','الانجاز الفعلي %','الحالة','الاجراءات القانونية','السلف المرفوعة','السلف المصروفة','المهندس المقيم','الدائرة','الهاتف','الملاحظات','الأيام منذ الإنجاز المخطط (سالب = متبقٍّ)','تاريخ الإنجاز الفعلي','الكلفة المصادقة'];
  save(`الموقف-العام_${new Date().toISOString().slice(0,10)}.csv`,csv([H].concat(f.map(r=>{const p=r.p;return [p.fileNo,p.name,p.contractor,p.fund,p.contractNo,p.year,p.sector,p.district,p.sub,repXY(p,'lat'),repXY(p,'lng'),p.orig,p.changeCost,r.total,DMY(p.start),p.dur,p.extra,p.totalDays,DMY(p.planEnd),p.planPct,p.actualPct,p.status,p.legal,p.advRaised,p.advPaid,engVis()?p.resident:'',p.residentOffice,engVis()?p.phone:'',p.notes,planDays(p)==null?'':planDays(p),(()=>{const a=aeOf(p);return a?DMY(aeIso(a)||a):'';})(),(()=>{const a=apOf(p);return a?a.v:'';})()];}))));};
$q('bECsv').onclick=()=>{if(!cntVis()){flash('قائمة المهندسين تحوي عدد المشاريع لكل مهندس — أدخل كلمة سر المدير',true);finDlg();return;}const E=engF&&window.__engList?window.__engList:engData();save(`المهندسون-المشرفون_${new Date().toISOString().slice(0,10)}.csv`,csv([['الاسم','الصفة','الدائرة','الهاتف','عدد المشاريع (غير المنجزة)','المشاريع','المشاريع المنجزة (لا تُحسب)']].concat(E.map(e=>[e.name,e.role,e.dept||'غير محدد',e.phone,e.projects.length,e.projects.map(x=>x.p.name+' ('+(x.role||'')+')').join(' | '),e.done.map(x=>x.p.name).join(' | ')]))));};

/* ---------- العرض ---------- */
function render(){if(state.current!=='sit')return;try{adStale();}catch(_){}
  AnbarReg.mount($q('arHome'),{system:'ac',homeOnly:true,onImported:()=>render()});
  {const P=AnbarReg.parts?AnbarReg.parts():[];$q('sitParts').innerHTML=P.length>1||(P.length===1&&P[0].committee!=='الموقف')?`<b>🗂 الموقف المتراكم من ${P.length} ${P.length>2&&P.length<11?'لجان':'لجنة'}:</b>`+P.map(x=>`<span class="pp" title="من الملف «${esc(x.source)}»"><b>${esc(x.committee)}</b> ${x.n} مشروع <small>${new Date(x.at).toLocaleDateString('en-GB')}</small><button data-rmpart="${esc(x.committee)}" title="حذف موقف هذه اللجنة من الموقف المتراكم (ينتقل الحذف بالمزامنة)">✕</button></span>`).join('')+`<small style="color:#6b7a72">— كل لجنة تستورد موقفها فيُستبدل جزؤها وحده ويُجمع مع البقية في كل الحاسبات</small>`:'';}
  const S=AnbarReg.state();comBar(S);const R=rows();
  try{window.AnbarMap&&AnbarMap.earthSync&&AnbarMap.earthSync(R,{stKind,KCOL,compact,num});}catch(_){}   /* ملف Google Earth Pro الحي */
  if(sub==='proj'){
    opts($q('fs'),uniq(S.projects,'status'),'كل الحالات');opts($q('ff'),[...new Set(S.projects.map(p=>fundGroup(ov(p).fund)))].sort((a,b)=>(a==='غير محدد')-(b==='غير محدد')||a.localeCompare(b,'ar')),'كل برامج التمويل');opts($q('fz'),[...new Set(S.projects.map(p=>sectorOf(ov(p))))].filter(x=>x!=='غير محدد').sort((a,b)=>a.localeCompare(b,'ar')),'كل القطاعات');
    $q('kpis').innerHTML=S.projects.length?kpis(R,S):'';$q('charts').innerHTML=S.projects.length?fundTiles(R)+charts(R):'';
    if(!S.projects.length){$q('tbl').innerHTML='<div class="empty"><p>لم يُستورد الموقف بعد. استورده من الأعلى (xlsx أو xlsm)؛ وكل ملف جديد يُضاف فوق المشاريع الموجودة، والمكرر يُستبدل بالجديد.</p></div>';$q('info').textContent='';return;}
    const f=filtered(R);$q('tbl').innerHTML=table(f);pickBar();
    $q('info').textContent=`${f.length} من ${sitCom?rows().length+' مشروع في موقف «'+sitCom+'» (من '+S.projects.length+')':S.projects.length+' مشروع'} — الموقف: «${S.source}» (${DMY(String(S.updated).slice(0,10))}). انقر أي مشروع لعرض بياناته كاملة. يتحدّث الجدول تلقائياً عند الحفظ في أي نظام.`;
  }else if(sub==='map'){window.AnbarMap.render(R,{stKind,KCOL,compact,num,drawer});}
  else engView();
  if(openFn&&!$q('drawer').hidden)drawer(openFn);}
document.querySelectorAll('.st').forEach(b=>b.onclick=()=>{sub=b.dataset.st;document.querySelectorAll('.st').forEach(x=>x.classList.toggle('on',x===b));$q('st-proj').hidden=sub!=='proj';$q('st-eng').hidden=sub!=='eng';$q('st-map').hidden=sub!=='map';$q('pg-sit').classList.toggle('maponly',sub==='map');render();if(sub==='map')setTimeout(()=>window.AnbarMap.resize(),100);});
/* البحث والتصفية: الجدول وحده (المؤشرات والمخططات لا تتغير بالتصفية)، بعد 180 ملي ثانية من آخر حرف */
let tblT=null;
function renderTable(){if(state.current!=='sit'||sub!=='proj')return;const S=AnbarReg.state();if(!S.projects.length)return;const f=filtered(rows());$q('tbl').innerHTML=table(f);pickBar();
  $q('info').textContent=`${f.length} من ${sitCom?rows().length+' مشروع في موقف «'+sitCom+'» (من '+S.projects.length+')':S.projects.length+' مشروع'} — الموقف: «${S.source}» (${DMY(String(S.updated).slice(0,10))}). انقر أي مشروع لعرض بياناته كاملة. يتحدّث الجدول تلقائياً عند الحفظ في أي نظام.`;}
['q','fs','ff','fz','fx','so'].forEach(id=>$q(id).addEventListener('input',()=>{clearTimeout(tblT);tblT=setTimeout(renderTable,id==='q'?180:0);}));
let engT=null;['eq','er'].forEach(id=>$q(id).addEventListener('input',()=>{clearTimeout(engT);engT=setTimeout(engView,id==='eq'?180:0);}));
$q('charts').addEventListener('click',e=>{const b=e.target.closest('[data-fund]');if(!b)return;$q('ff').value=b.dataset.fund;renderTable();$q('tbl').scrollIntoView({behavior:'smooth',block:'start'});});
$q('tbl').addEventListener('click',e=>{const ck=e.target.closest('input[data-pk],#pkAll,td.pk,th.pk');if(ck){pickClick(e);return;}const pill=e.target.closest('[data-app]');const tr=e.target.closest('tr[data-fn]');if(!tr)return;if(pill){window.desktop.go(pill.dataset.app,tr.dataset.fn);return;}drawer(tr.dataset.fn);});
const prevNav=window.onNav,prevData=window.onData;
window.SitEng=engData;window.SitFund=fundGroup;window.SitTable=()=>renderTable();window.SitRender=()=>{try{render();}catch(_){}};
window.onNav=s=>{if(prevNav)prevNav(s);if(s.current==='sit')render();};
/* بيانات المزامنة: إعادة رسم واحدة بعد 600 ms من آخر وصول (دورة المزامنة تحمل عدة مجموعات بيانات)، وفقط للمجموعات التي تظهر في الموقف */
let sitDataT=null;const SIT_DS=new Set(['reg','co','du','ad','ac','in','fin','pl','wf']);
window.onData=s=>{if(prevData)prevData(s);if(s&&s.ds&&!SIT_DS.has(s.ds))return;clearTimeout(sitDataT);sitDataT=setTimeout(()=>{if(state.current==='sit')render();},600);};
let last='';setInterval(()=>{if(state.current!=='sit')return;const a=document.activeElement;if(a&&['q','eq'].includes(a.id))return;const s=AnbarReg.state().updated;if(s!==last){last=s;render();}},2500);

/* ---------- تقارير Excel الاحترافية: تجميع حسب الإنجاز أو التمويل أو القضاء أو القطاع أو الحالة ---------- */
const REP_DIMS=[['pct','نسبة الإنجاز الفعلي'],['fund','برنامج التمويل'],['district','القضاء'],['committee','اللجنة (ملف الموقف)'],['sector','القطاع (الجهة المستفيدة)'],['status','حالة المشروع']];
const PCT_BANDS=['منجز (100%)','75% فأكثر','50% – أقل من 75%','25% – أقل من 50%','أقل من 25%','بلا نسبة إنجاز'];
/* توحيد القطاع: «التربية/تربية/التعليم/مديرية تربية الانبار» قطاع واحد في التجميع والتصفية والتقارير (العمود في التقرير يبقى كما كُتب) */
const SECTORS=[['التربية',/تربي|تعليم|مدارس|مدرس/],['الصحة',/صح[هي]|مستشف|مركز صحي/],['الطرق والجسور',/طرق|جسور|جسر/],['المجاري',/مجاري|صرف صحي/],['الموارد المائية',/موارد مائي|(^|\s)الري(\s|$)|سدود/],['الماء',/^ال?ماء|مديريه ماء|ماء الانبار|مشاريع الماء|اسالة/],['البلديات',/بلدي/],['الكهرباء',/كهرب/],['الشباب والرياضة',/رياض|شباب/],['الزراعة',/زراع/],['الجامعات',/جامعه|كليه/],['الإدارة المحلية',/اداره?\s*(ال)?محلي|مجلس|قائممقام|ديوان|محافظ/],['المنافذ الحدودية',/منافذ/],['الداخلية',/داخليه|شرط|دفاع مدني|احوال مدنيه|جوازات/],['المالية',/ماليه|ضريب|تقاعد/],['الثقافة',/ثقاف/],['المخابرات',/مخابرات/],['الدفاع',/دفاع/],['العمل والشؤون الاجتماعية',/وزاره العمل|رعايه اجتماعيه|شؤون اجتماعيه/]];
function sectorOf(p){const t=String(p&&p.sector||'').trim();if(!t)return 'غير محدد';const r=RN(t);for(const [n,re] of SECTORS)if(re.test(r))return n;return t;}
function repKey(dim,p){if(dim==='pct'){if(stKind(p.status)==='ok'||(has(p.actualPct)&&num(p.actualPct)>=100))return PCT_BANDS[0];if(!has(p.actualPct))return PCT_BANDS[5];const a=num(p.actualPct);return a>=75?PCT_BANDS[1]:a>=50?PCT_BANDS[2]:a>=25?PCT_BANDS[3]:PCT_BANDS[4];}
  if(dim==='fund')return fundGroup(p.fund);if(dim==='district')return AnbarReg.districtOf(p);if(dim==='committee')return String(p.committee||'').trim()||AnbarReg.districtOf(p);
  if(dim==='sector')return sectorOf(p);return String(p.status||'').trim()||'غير محدد';}
function repGroups(dim,R){const G=new Map();R.forEach(r=>{const k=repKey(dim,r.p);if(!G.has(k))G.set(k,[]);G.get(k).push(r);});
  let keys=[...G.keys()];if(dim==='pct')keys=PCT_BANDS.filter(k=>G.has(k));else keys.sort((a,b)=>(a==='غير محدد')-(b==='غير محدد')||G.get(b).length-G.get(a).length||a.localeCompare(b,'ar'));
  return keys.map(k=>({name:k,R:G.get(k)}));}
function repStats(R){const P=R.map(r=>r.p),cost=R.reduce((a,r)=>a+r.total,0),w=k=>{let s=0,ww=0;P.forEach((p,i)=>{if(!has(p[k]))return;const c=R[i].total||1;s+=num(p[k])*c;ww+=c;});return ww?s/ww:null;};
  const act=w('actualPct'),plan=w('planPct'),paid=P.reduce((a,p)=>a+num(p.advPaid),0),done=P.filter(p=>stKind(p.status)==='ok').length,stop=P.filter(p=>stKind(p.status)==='bad').length;
  const lag=R.filter(r=>r.dev!=null&&r.dev<-10&&stKind(r.p.status)!=='ok').length;
  return {n:P.length,cost,act,plan,dev:act!=null&&plan!=null?act-plan:null,paid,fin:cost?paid/cost*100:null,done,stop,lag,work:P.length-done-stop};}
/* الإحداثيات كما تقرؤها الخريطة: N وE المقلوبتان تُعدَّلان، والدرجات والدقائق والثواني المتلاصقة تُحوَّل إلى عشرية؛ وما لا يُقرأ يُكتب كما في الموقف */
function repXY(p,k){try{const c=window.AnbarMap&&AnbarMap.coord?AnbarMap.coord(p):null;if(c)return Math.round(c[k]*1e6)/1e6;}catch(_){}return p[k];}
const REP_COLS=[['الاضبارة',10,'t',p=>p.fileNo],['اسم المشروع',46,'w',p=>p.name],['الشركة المنفذة',22,'w',p=>p.contractor],['برنامج التمويل',18,'w',p=>p.fund],['رقم العقد',12,'t',p=>p.contractNo],['السنة',8,'t',p=>p.year],['القطاع (الجهة المستفيدة)',18,'w',p=>p.sector],['القضاء',11,'t',p=>p.district],['الناحية',11,'t',p=>p.sub],['الإحداثي N (خط العرض)',13,'c',p=>repXY(p,'lat')],['الإحداثي E (خط الطول)',13,'c',p=>repXY(p,'lng')],
  ['الكلفة الأصلية',16,'n',p=>p.orig],['كلفة أوامر التغيير',15,'n',p=>p.changeCost],['الكلفة الكلية',16,'n',(p,r)=>r.total],['تاريخ المباشرة',12,'t',p=>DMY(p.start)],['مدة العقد',9,'n',p=>p.dur],['المدة الإضافية',9,'n',p=>p.extra],['المدة الكلية',9,'n',p=>p.totalDays],['تاريخ الإنجاز المخطط',12,'t',p=>p.planEnd],
  ['الإنجاز المخطط %',10,'p',p=>p.planPct],['الإنجاز الفعلي %',10,'p',p=>p.actualPct],['الانحراف',9,'d',(p,r)=>r.dev],['الحالة',14,'w',p=>p.status],['الإجراءات القانونية',18,'w',p=>p.legal],['السلف المرفوعة',15,'n',p=>p.advRaised],['السلف المصروفة',15,'n',p=>p.advPaid],['المهندس المقيم',18,'w',p=>p.resident],['الدائرة',14,'w',p=>p.residentOffice],['الهاتف',13,'t',p=>p.phone],['الملاحظات',30,'w',p=>p.notes],['تدقيق الموقف مقابل الأنظمة',46,'w',(p,r)=>(r.iss||[]).map(x=>'⚠ '+x[1]).join('\n')],
  ['الأيام منذ الإنجاز المخطط (سالب = متبقٍّ)',16,'n',p=>{const n=planDays(p);return n==null?'':n;}],['تاريخ الإنجاز الفعلي',12,'t',p=>{const a=aeOf(p);return a?DMY(aeIso(a)||a):'';}],['الكلفة المصادقة',16,'n',p=>{const a=apOf(p);return a?a.v:'';}]];
function repCell(c,p,r){const X=XLW.S,v=c[3](p,r);if(c[2]==='c'){const t=String(v==null?'':v).trim(),n=parseFloat(t.replace(/[^\d.\-]/g,''));return t&&isFinite(n)?{v:n,s:X.txt}:{v:t,s:X.txt};}if(c[2]==='n'){if(!has(v))return {v:'',s:X.txt};const n=num(v);return /[\d]/.test(String(v))?{v:n,s:X.int}:{v:String(v),s:X.txt};}
  if(c[2]==='p')return has(v)?{v:Math.round(num(v)*10)/10,s:X.pct}:{v:'',s:X.txt};if(c[2]==='d')return v==null?{v:'',s:X.txt}:{v:Math.round(v*10)/10,s:X.dev};
  return {v:v==null?'':String(v),s:c[2]==='w'?X.wrap:X.txt};}
function repSort(R,how){const a=R.slice();if(how==='act')a.sort((x,y)=>(num(y.p.actualPct)-num(x.p.actualPct)));else if(how==='actup')a.sort((x,y)=>(num(x.p.actualPct)-num(y.p.actualPct)));else if(how==='cost')a.sort((x,y)=>y.total-x.total);else a.sort((x,y)=>String(x.p.fileNo).localeCompare(String(y.p.fileNo),'ar',{numeric:true}));return a;}
function repHead(title,sub,nc){const X=XLW.S;const blank=n=>Array.from({length:n-1},()=>({s:X.title}));
  return {rows:[[{v:'محافظة الأنبار — قسم الشؤون الهندسية',s:X.title},...blank(nc)],[{v:title,s:X.org}],[{v:sub,s:X.sub}]],merges:[`A1:${XLW.colL(nc-1)}1`,`A2:${XLW.colL(nc-1)}2`,`A3:${XLW.colL(nc-1)}3`]};}
/* ورقة الملخص لتصنيف واحد: جدول المجموعات مع الإجمالي، تبدأ من الصف start */
function repSummaryTable(dimLabel,groups,start){const X=XLW.S,H=[dimLabel,'عدد المشاريع','% من العدد','الكلفة الكلية (د.ع)','% من الكلفة','المخطط %','الفعلي %','الانحراف','السلف المصروفة (د.ع)','نسبة الصرف %','منجزة','قيد التنفيذ','متوقفة','متلكئة (>10%)'];
  const all=repStats(groups.flatMap(g=>g.R)),rows=[H.map(h=>({v:h,s:X.head}))],r0=start+2,r1=start+1+groups.length;
  groups.forEach(g=>{const s=repStats(g.R);rows.push([{v:g.name,s:X.txt},{v:s.n,s:X.int},{v:all.n?Math.round(s.n/all.n*1000)/10:0,s:X.pct},{v:Math.round(s.cost),s:X.int},{v:all.cost?Math.round(s.cost/all.cost*1000)/10:0,s:X.pct},
    s.plan==null?{v:'',s:X.txt}:{v:Math.round(s.plan*10)/10,s:X.pct},s.act==null?{v:'',s:X.txt}:{v:Math.round(s.act*10)/10,s:X.pct},s.dev==null?{v:'',s:X.txt}:{v:Math.round(s.dev*10)/10,s:X.dev},{v:Math.round(s.paid),s:X.int},s.fin==null?{v:'',s:X.txt}:{v:Math.round(s.fin*10)/10,s:X.pct},{v:s.done,s:X.int},{v:s.work,s:X.int},{v:s.stop,s:X.int},{v:s.lag,s:X.int}]);});
  const C=XLW.colL,sum=c=>({f:`SUM(${C(c)}${r0}:${C(c)}${r1})`});
  rows.push([{v:'الإجمالي',s:X.gtT},{...sum(1),v:all.n,s:X.gtI},{v:100,s:X.gtP},{...sum(3),v:Math.round(all.cost),s:X.gtI},{v:100,s:X.gtP},all.plan==null?{v:'',s:X.gtT}:{v:Math.round(all.plan*10)/10,s:X.gtP},all.act==null?{v:'',s:X.gtT}:{v:Math.round(all.act*10)/10,s:X.gtP},all.dev==null?{v:'',s:X.gtT}:{v:Math.round(all.dev*10)/10,s:X.gtD},
    {...sum(8),v:Math.round(all.paid),s:X.gtI},all.fin==null?{v:'',s:X.gtT}:{v:Math.round(all.fin*10)/10,s:X.gtP},{...sum(10),v:all.done,s:X.gtI},{...sum(11),v:all.work,s:X.gtI},{...sum(12),v:all.stop,s:X.gtI},{...sum(13),v:all.lag,s:X.gtI}]);
  return {rows,bars:[{ref:`G${r0}:G${r1}`,color:'FF2E7D4F'},{ref:`J${r0}:J${r1}`,color:'FF5B9BD5'},{ref:`C${r0}:C${r1}`,color:'FFC9A227'}],neg:[`H${r0}:H${r1}`],headRow:start+1};}
function repKpis(R,start){const X=XLW.S,s=repStats(R);const L=[['عدد المشاريع',s.n,X.kpiV],['الكلفة الكلية (د.ع)',Math.round(s.cost),X.kpiV],['الإنجاز الفعلي المرجّح بالكلفة',s.act==null?0:Math.round(s.act*10)/10,X.kpiP],['الإنجاز المخطط المرجّح',s.plan==null?0:Math.round(s.plan*10)/10,X.kpiP],['نسبة الصرف',s.fin==null?0:Math.round(s.fin*10)/10,X.kpiP],['منجزة',s.done,X.kpiV],['متوقفة',s.stop,X.kpiV]];
  const r1=[],r2=[],merges=[];L.forEach((k,i)=>{r1.push({v:k[0],s:X.kpiL},{s:X.kpiL});r2.push({v:k[1],s:k[2]},{s:k[2]});const c=i*2;merges.push(`${XLW.colL(c)}${start+1}:${XLW.colL(c+1)}${start+1}`,`${XLW.colL(c)}${start+2}:${XLW.colL(c+1)}${start+2}`);});
  return {rows:[r1,r2],merges};}
function buildReport(o){const X=XLW.S,S=AnbarReg.state(),R=o.R,today=new Date().toLocaleDateString('en-GB'),dims=o.dim==='all'?REP_DIMS:REP_DIMS.filter(d=>d[0]===o.dim);
  const sub=`الموقف: ${S.source||'—'}${S.updated?' — تحديث '+DMY(String(S.updated).slice(0,10)):''} — تاريخ التقرير ${today} — ${R.length} مشروعاً${o.note?' — '+o.note:''}`;
  const foot='نظام الشؤون الهندسية الموحد — '+today,sheets=[];
  /* 1) الملخص */
  { const hd=repHead(o.title||(o.dim==='all'?'تقرير المشاريع الشامل':'تقرير المشاريع حسب '+dims[0][1]),sub,14),rows=hd.rows,merges=hd.merges.slice(),bars=[],neg=[];rows.push([]);
    const k=repKpis(R,rows.length);k.rows.forEach(r=>rows.push(r));k.merges.forEach(m=>merges.push(m));
    dims.forEach(d=>{rows.push([]);rows.push([{v:'حسب '+d[1],s:X.grp},...Array.from({length:13},()=>({s:X.grp}))]);merges.push(`A${rows.length}:N${rows.length}`);
      const t=repSummaryTable(d[1],repGroups(d[0],R),rows.length);t.rows.forEach(r=>rows.push(r));bars.push(...t.bars);neg.push(...t.neg);});
    sheets.push({name:'الملخص',cols:[30,11,10,19,10,10,10,10,19,11,9,10,9,11],rows,merges,bars,neg,heights:{1:30,2:26,6:22},tab:'FF1F5F36',footer:foot,zoom:100});}
  /* 2) جميع المشاريع مجمّعة حسب التصنيف الأول مع مجموع كل مجموعة */
  /* الأعمدة المختارة (o.cols أرقام في REP_COLS)؛ المجاميع والأشرطة تتبع موضع كل عمود بعد الاختيار */
  const CI=(Array.isArray(o.cols)&&o.cols.length?[...new Set([1,...o.cols])].sort((a,b)=>a-b):REP_COLS.map((_,i)=>i)),COLS=CI.map(i=>REP_COLS[i]),at=i=>CI.indexOf(i);
  const d0=dims[0],G=repGroups(o.dim==='all'?'district':d0[0],R),nc=COLS.length,iP=at(19),iA=at(20),iDv=at(21);
  const subRow=(label,RR,st)=>{const s=repStats(RR),row=COLS.map(()=>({s:st[0]}));row[0]={v:label,s:st[0]};if(nc>1)row[1]={v:s.n+' مشروعاً',s:st[0]};
    [11,12,13,24,25].forEach(i=>{const j=at(i);if(j>0)row[j]={v:Math.round(RR.reduce((a,r)=>a+num(i===13?r.total:REP_COLS[i][3](r.p,r)),0)),s:st[1]};});
    if(iP>0)row[iP]=s.plan==null?{s:st[0]}:{v:Math.round(s.plan*10)/10,s:st[2]};if(iA>0)row[iA]=s.act==null?{s:st[0]}:{v:Math.round(s.act*10)/10,s:st[2]};if(iDv>0)row[iDv]=s.dev==null?{s:st[0]}:{v:Math.round(s.dev*10)/10,s:st[3]};return row;};
  const tableSheet=(name,title,groups,grouped,tab)=>{const hd=repHead(title,sub,nc),rows=hd.rows,merges=hd.merges.slice();rows.push(COLS.map(c=>({v:c[0],s:X.head})));const hr=rows.length;
    groups.forEach(g=>{if(grouped){rows.push([{v:`${g.name} — ${g.R.length} مشروعاً`,s:X.grp},...Array.from({length:nc-1},()=>({s:X.grp}))]);merges.push(`A${rows.length}:${XLW.colL(nc-1)}${rows.length}`);}
      repSort(g.R,o.sort).forEach(r=>rows.push(COLS.map(c=>repCell(c,r.p,r))));
      if(grouped)rows.push(subRow('مجموع '+g.name,g.R,[X.stT,X.stI,X.stP,X.stD]));});
    rows.push(subRow('الإجمالي العام',groups.flatMap(g=>g.R),[X.gtT,X.gtI,X.gtP,X.gtD]));
    return {name,cols:COLS.map(c=>c[1]),rows,merges,freeze:hr,titles:hr,filter:grouped?null:`A${hr}:${XLW.colL(nc-1)}${hr}`,bars:iA>0?[{ref:`${XLW.colL(iA)}${hr+1}:${XLW.colL(iA)}${rows.length-1}`,color:'FF63BE7B'}]:[],neg:iDv>0?[`${XLW.colL(iDv)}${hr+1}:${XLW.colL(iDv)}${rows.length-1}`]:[],heights:{1:30,2:26,[hr]:34},footer:foot,tab,zoom:90,paper:8};};
  sheets.push(tableSheet('جميع المشاريع','جميع المشاريع'+(o.dim==='all'?' حسب القضاء':' حسب '+d0[1]),G,true,'FF2E7D4F'));
  /* 3) ورقة لكل مجموعة */
  if(o.each&&o.dim!=='all')G.forEach(g=>sheets.push(tableSheet(g.name,`${d0[1]}: ${g.name}`,[g],false,'FFC9A227')));
  return XLW.book(sheets,{title:'تقرير المشاريع',author:'قسم الشؤون الهندسية — محافظة الأنبار'});}
/* اختيار مشاريع التقرير المخصص: نسبة الإنجاز (من–إلى)، الوضع، الحالة كما في الموقف، التمويل، القضاء، القطاع.
   داخل الفئة الواحدة يكفي أحد الخيارات (أو)، وبين الفئات يجب أن تتحقق كلها (و) */
const REP_STATE=[['run','المستمرة (غير منجزة وغير متوقفة)'],['lag','المتلكئة (الفعلي أقل من المخطط بأكثر من 10%)'],['stop','المتوقفة'],['done','المنجزة']];
function repState(k,r){const t=stKind(r.p.status);if(k==='done')return t==='ok';if(k==='stop')return t==='bad';if(k==='run')return t!=='ok'&&t!=='bad';
  return t!=='ok'&&((r.dev!=null&&r.dev<-10)||/متلك/.test(String(r.p.status||'')));}
/* الطلب بالكلام: «مشاريع الكرمة وحديثة المتلكئة تمويل المنافذ قطاع التربية إنجاز أقل من 50 حسب القطاع» → اختيارات التقرير.
   يتعرف على: الأقضية والقطاعات وبرامج التمويل وحالات الموقف الموجودة فعلاً، والوضع (مستمرة/متلكئة/متوقفة/منجزة)، ونسب الإنجاز (أقل من/أكثر من/من..إلى/بين)، والتجميع (حسب ...)، والترتيب */
function repParse(text,L){const t=' '+RN(String(text||'')).replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[،,؛:]/g,' ').replace(/\s+/g,' ')+' ',out={dist:[],sect:[],fund:[],status:[],state:[],from:null,to:null,dim:null,sort:null,got:[]};
  const bare=v=>RN(v).replace(/^ال/,'').replace(/\s+/g,' ').trim(),has1=v=>{const b=bare(v);if(b.length<3)return false;return t.includes(' '+b)||t.includes(' ال'+b)||t.includes(RN(v));};
  (L.DI||[]).forEach(v=>{if(v!=='غير محدد'&&has1(v))out.dist.push(v);});
  (L.SE||[]).forEach(v=>{if(v!=='غير محدد'&&(has1(v)||RN(v).split(' ').some(w=>w.length>=4&&!/^(مديريه|دائره|قسم|الانبار|محافظه|العامه|المحافظه)$/.test(w)&&t.includes(' '+w)&&/قطاع|جهه|دائر|مديري|تربي|صح|بلدي|طرق|ماء|مجاري|كهرب|زراع|رياض|شباب/.test(t))))out.sect.push(v);});
  (L.FU||[]).forEach(v=>{const w=RN(v).split(/[\s\/]+/).filter(x=>x.length>=4&&!/^(استثماري|تنميه|برنامج)$/.test(x));if(has1(v)||w.some(x=>t.includes(x.replace(/^ال/,''))))out.fund.push(v);});
  if(/تنميه الاقاليم|اقاليم/.test(t))(L.FU||[]).forEach(v=>{if(/اقاليم/.test(RN(v))&&!out.fund.includes(v))out.fund.push(v);});
  if(/متلك/.test(t))out.state.push('lag');if(/متوقف|موقوف/.test(t))out.state.push('stop');if(/غير منجز|غير المنجز/.test(t))out.state.push('run','lag','stop');else if(/منجز|المكتمل|مكتمل/.test(t))out.state.push('done');if(/مستمر|قيد التنفيذ|جاري/.test(t))out.state.push('run');
  out.state=[...new Set(out.state)];
  let m=t.match(/(?:من|بين)\s*(\d{1,3})\s*%?\s*(?:الي|الى|إلى|حتي|و|-|–)\s*(\d{1,3})/)||t.match(/(\d{1,3})\s*%?\s*(?:-|–)\s*(\d{1,3})\s*%/);if(m){out.from=Math.min(+m[1],+m[2]);out.to=Math.max(+m[1],+m[2]);}
  else{if((m=t.match(/(?:اقل من|دون|تحت)\s*(\d{1,3})/)))out.to=+m[1]-(/اقل من|دون|تحت/.test(m[0])?0.01:0);if((m=t.match(/(?:اكثر من|اعلي من|فوق|اكبر من)\s*(\d{1,3})/)))out.from=+m[1]+0.01;if((m=t.match(/(\d{1,3})\s*%?\s*فاكثر/)))out.from=+m[1];}
  if(out.to!=null)out.to=Math.round(out.to*100)/100;if(out.from!=null)out.from=Math.round(out.from*100)/100;
  const DM=[['sector',/حسب (ال)?قطاع|حسب (ال)?جهه/],['district',/حسب (ال)?قضاء|حسب (ال)?اقضيه/],['fund',/حسب (ال)?تمويل|حسب (ال)?برنامج/],['status',/حسب (ال)?حاله/],['pct',/حسب (ال)?نسب|حسب (ال)?انجاز/],['committee',/حسب (ال)?لجن/]];
  for(const [k,re] of DM)if(re.test(t)){out.dim=k;break;}
  if(/اكبر كلفه|الاعلي كلفه|حسب الكلفه/.test(t))out.sort='cost';else if(/الاقل انجاز|الاضعف/.test(t))out.sort='actup';else if(/الاعلي انجاز/.test(t))out.sort='act';
  return out;}
function repMatch(r,c){const p=r.p;
  if(c.from!=null||c.to!=null){if(!has(p.actualPct))return false;const a=num(p.actualPct);if(c.from!=null&&a<c.from)return false;if(c.to!=null&&a>c.to)return false;}
  if(c.state.length||c.status.length){if(!(c.state.some(k=>repState(k,r))||c.status.includes(String(p.status||'').trim()||'غير محدد')))return false;}
  if(c.fund.length&&!c.fund.includes(fundGroup(p.fund)))return false;
  if(c.dist.length&&!c.dist.includes(repKey('district',p)))return false;
  if(c.sect.length&&!c.sect.includes(repKey('sector',p)))return false;return true;}
function repCritText(c){const L=[];if(c.from!=null||c.to!=null)L.push(`الإنجاز الفعلي ${c.from!=null?c.from:0}% – ${c.to!=null?c.to:100}%`);
  const st=[...c.state.map(k=>REP_STATE.find(x=>x[0]===k)[1].replace(/\s*\(.*\)$/,'')),...c.status];if(st.length)L.push('الوضع: '+st.join('، '));
  if(c.fund.length)L.push('التمويل: '+c.fund.join('، '));if(c.dist.length)L.push('القضاء: '+c.dist.join('، '));if(c.sect.length)L.push('القطاع: '+c.sect.join('، '));return L.join(' · ');}
function reportDlg(opt){opt=opt&&opt.only?opt:null;const S=AnbarReg.state();if(!S.projects.length){flash('استورد الموقف أولاً',true);return;}
  const all=rows(),f=filtered(all),d=document.createElement('div');d.className='ov';d.id='repOv';
  const vals=fn=>[...new Set(all.map(fn))].sort((a,b)=>(a==='غير محدد')-(b==='غير محدد')||a.localeCompare(b,'ar'));
  const cnt=(fn,v)=>all.filter(r=>fn(r)===v).length;
  const chips=(grp,list,fn)=>list.map(v=>`<label class="rc"><input type="checkbox" data-g="${grp}" value="${esc(v)}"> ${esc(v)} <small>${fn?fn(v):''}</small></label>`).join('');
  const FU=vals(r=>fundGroup(r.p.fund)),DI=vals(r=>repKey('district',r.p)),SE=vals(r=>repKey('sector',r.p)),ST=vals(r=>String(r.p.status||'').trim()||'غير محدد');
  d.innerHTML=`<div class="dlg repdlg"><h3>📊 تقرير Excel احترافي</h3>
   <p class="hint" style="margin-top:0">بأعمدة الموقف نفسها، مع ورقة ملخص (العدد والكلفة والإنجاز المرجّح والصرف لكل مجموعة) وورقة للمشاريع مجمّعة بمجاميعها.</p>
   <div class="repai"><b>✨ اكتب ما تريد</b><div class="row" style="gap:6px;margin-top:4px"><input id="repAsk" placeholder="مثال: مشاريع الكرمة وحديثة المتلكئة تمويل المنافذ إنجاز أقل من 50 حسب القطاع"><button class="btn pri" data-r="ask">تطبيق</button></div><div class="hint" id="repAskR"></div></div>
   <div class="reptpl"><b>📁 قوالب اللجان المحفوظة</b> <select id="repTpl"><option value="">— اختر قالباً —</option></select> <button class="btn" data-r="tplload">فتح</button> <button class="btn" data-r="tplsave">💾 حفظ الاختيار الحالي قالباً</button> <button class="btn" data-r="tpldel" title="حذف القالب المختار">✕</button></div>
   <div class="repk"><label><input type="radio" name="repKind" value="full" checked> <b>تقرير كامل</b> — كل المشاريع</label><label><input type="radio" name="repKind" value="cust"> <b>تقرير مخصص</b> — مشاريع بنسب أو حالات أو تمويل معيّن</label></div>
   <div id="repCust" hidden>
    <div class="repq"><span>اختيار سريع:</span><button class="btn" data-pre="7599">الإنجاز 75% – 99%</button><button class="btn" data-pre="runlag">المستمرة والمتلكئة</button><button class="btn" data-pre="lag">المتلكئة فقط</button><button class="btn" data-pre="stop">المتوقفة</button><button class="btn" data-pre="mnf">تمويل المنافذ</button><button class="btn" data-pre="clr">مسح الاختيار</button></div>
    <div class="repf"><b>نسبة الإنجاز الفعلي</b><span>من <input type="number" id="repFrom" min="0" max="100" placeholder="0">% إلى <input type="number" id="repTo" min="0" max="100" placeholder="100">%</span></div>
    <details open><summary>الوضع والحالة</summary><div class="rcs">${chips('state',REP_STATE.map(x=>x[1]))}</div><div class="rcs sub"><span class="mu">الحالة كما في الموقف:</span>${chips('status',ST,v=>cnt(r=>String(r.p.status||'').trim()||'غير محدد',v))}</div></details>
    <details open><summary>برنامج التمويل</summary><div class="rcs">${chips('fund',FU,v=>cnt(r=>fundGroup(r.p.fund),v))}</div></details>
    <details><summary>القضاء</summary><div class="rcs">${chips('dist',DI,v=>cnt(r=>repKey('district',r.p),v))}</div></details>
    <details><summary>القطاع (الجهة المستفيدة)</summary><div class="rcs">${chips('sect',SE,v=>cnt(r=>repKey('sector',r.p),v))}</div></details>
   </div>
   <div class="repn" id="repN"></div>
   <label class="ml">تجميع التقرير حسب</label><div class="repd">${REP_DIMS.map((x,i)=>`<label><input type="radio" name="repDim" value="${x[0]}" ${i===0?'checked':''}> ${x[1]}</label>`).join('')}<label><input type="radio" name="repDim" value="all"> تقرير شامل (كل التصنيفات)</label></div>
   <label class="ml">ترتيب المشاريع داخل كل مجموعة<select id="repSort"><option value="file">رقم الاضبارة</option><option value="act">الإنجاز الفعلي (الأعلى أولاً)</option><option value="actup">الإنجاز الفعلي (الأقل أولاً)</option><option value="cost">الكلفة (الأكبر أولاً)</option></select></label>
   <details class="repcols"><summary><b>أعمدة التقرير</b> <small id="repColN"></small></summary><div class="row" style="gap:6px;margin:4px 0"><button class="btn" data-cols="all">الكل</button><button class="btn" data-cols="brief">مختصر (الأساسية)</button><button class="btn" data-cols="fin">مالي</button><button class="btn" data-cols="time">المدد والإنجاز</button><button class="btn" data-cols="loc">الموقع والإحداثيات</button></div><div class="rcs">${REP_COLS.map((c,i)=>`<label class="rc"><input type="checkbox" data-col="${i}" ${i===1?'checked disabled':'checked'}> ${esc(c[0])}</label>`).join('')}</div></details>
   <div class="reppick"><b>📌 مشاريع محددة</b> <span class="hint">لتقرير مشروع واحد أو عدة مشاريع بعينها: اكتب رقم الاضبارة أو جزءاً من اسم المشروع ثم Enter (أو عدة أرقام بينها فاصلة)، أو حدّدها بالمربعات في جدول المشاريع.</span>
    <div class="row" style="gap:6px;margin-top:4px;justify-content:flex-start"><input id="repPickQ" list="repPickL" placeholder="رقم الاضبارة أو اسم المشروع… مثال: 1234، 1250، 1301"><button class="btn" data-rp="add">إضافة</button><datalist id="repPickL">${all.slice(0,4000).map(r=>`<option value="${esc(r.p.fileNo)} — ${esc(String(r.p.name||'').slice(0,90))}">`).join('')}</datalist></div>
    <div id="repPickC" class="pchips"></div>
    <label class="chk"><input type="checkbox" id="repPick"> التقرير للمشاريع المحددة فقط</label>
    <div class="row" style="gap:6px;justify-content:flex-start"><button class="btn" data-rp="print">🖨 طباعة موقف المحددة</button><button class="btn" data-rp="pdf">📄 حفظ PDF</button><button class="btn" data-rp="copy">📋 نسخ نصاً</button><span class="hint" id="repPickM"></span></div></div>
   <label class="chk"><input type="checkbox" id="repEach" checked> ورقة منفصلة لكل مجموعة</label>
   <label class="chk"><input type="checkbox" id="repFilt" ${f.length===all.length?'disabled':''}> الاقتصار على المشاريع الظاهرة بتصفية الجدول الحالية (${f.length} من ${all.length})</label>
   <div class="row"><button class="btn" data-r="no">إلغاء</button><button class="btn pri" data-r="go">⬇ إنشاء التقرير</button></div></div>`;
  document.body.appendChild(d);d.hidden=false;
  const crit=()=>{const g=k=>[...d.querySelectorAll(`[data-g=${k}]:checked`)].map(x=>x.value),n=id=>{const v=$q(id).value;return v===''?null:Math.max(0,Math.min(100,+v));};
    return {from:n('repFrom'),to:n('repTo'),state:g('state').map(t=>REP_STATE.find(x=>x[1]===t)[0]),status:g('status'),fund:g('fund'),dist:g('dist'),sect:g('sect')};};
  const cust=()=>d.querySelector('[name=repKind]:checked').value==='cust';
  const pick=()=>{let R=$q('repPick').checked?all.filter(r=>picked.has(String(r.p.fileNo))):$q('repFilt').checked?f:all;let c=null;if(cust()){c=crit();R=R.filter(r=>repMatch(r,c));}return {R,c};};
  const upd=()=>{$q('repCust').hidden=!cust();const {R,c}=pick(),t=c?repCritText(c):'';$q('repN').innerHTML=`سيشمل التقرير <b>${R.length}</b> مشروعاً${t?` — <span>${esc(t)}</span>`:''}`;};
  /* الأعمدة */
  const COLSETS={brief:[0,1,2,3,6,7,9,10,13,19,20,22],fin:[0,1,2,3,6,11,12,13,24,25],time:[0,1,6,7,14,15,16,17,18,31,19,20,21,22],loc:[0,1,6,7,8,9,10,22]};
  const colsSel=()=>[...d.querySelectorAll('[data-col]')].filter(x=>x.checked).map(x=>+x.dataset.col);
  const colsSet=L=>{d.querySelectorAll('[data-col]').forEach(x=>{x.checked=x.dataset.col==='1'||!L||L.includes(+x.dataset.col);});colN();};
  const colN=()=>{const n=colsSel().length;$q('repColN').textContent=`(${n} من ${REP_COLS.length})`;};colN();
  /* الطلب بالكلام */
  const applyAsk=()=>{const q=$q('repAsk').value.trim();if(!q)return;const P=repParse(q,{DI,SE,FU,ST});
    d.querySelector('[name=repKind][value=cust]').checked=true;d.querySelectorAll('[data-g]').forEach(x=>x.checked=false);$q('repFrom').value=P.from!=null?P.from:'';$q('repTo').value=P.to!=null?P.to:'';
    const set=(g,L)=>d.querySelectorAll(`[data-g=${g}]`).forEach(x=>{if(L.includes(x.value))x.checked=true;});
    set('dist',P.dist);set('sect',P.sect);set('fund',P.fund);set('state',P.state.map(k=>REP_STATE.find(x=>x[0]===k)[1]));
    if(P.dim){const r=d.querySelector(`[name=repDim][value=${P.dim}]`);if(r)r.checked=true;}if(P.sort)$q('repSort').value=P.sort;
    d.querySelectorAll('details').forEach(x=>{if(x.querySelector('[data-g]:checked'))x.open=true;});
    const said=[P.dist.length?'القضاء: '+P.dist.join('، '):'',P.sect.length?'القطاع: '+P.sect.join('، '):'',P.fund.length?'التمويل: '+P.fund.join('، '):'',P.state.length?'الوضع: '+P.state.map(k=>REP_STATE.find(x=>x[0]===k)[1].replace(/\s*\(.*\)$/,'')).join('، '):'',
      P.from!=null||P.to!=null?`الإنجاز ${P.from!=null?P.from:0}% – ${P.to!=null?P.to:100}%`:'',P.dim?'التجميع حسب '+(REP_DIMS.find(x=>x[0]===P.dim)||['', P.dim])[1]:''].filter(Boolean);
    $q('repAskR').innerHTML=said.length?'فهمت: '+said.map(esc).join(' — ')+' <span class="mu">(يمكنك تعديل الاختيار أدناه)</span>':'<span style="color:#b42318">لم أتعرف على قضاء أو قطاع أو تمويل أو حالة في الطلب — اختر من القوائم أدناه</span>';upd();};
  $q('repAsk').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();applyAsk();}});
  /* القوالب المحفوظة (لكل لجنة قالبها: الاختيار والتجميع والترتيب والأعمدة) */
  const TK='sitRepTemplates',tplGet=()=>{try{return JSON.parse(localStorage.getItem(TK)||'[]')||[];}catch(_){return [];}},tplPut=L=>{try{localStorage.setItem(TK,JSON.stringify(L));}catch(_){}};
  const tplFill=()=>{const v=$q('repTpl').value;$q('repTpl').innerHTML='<option value="">— اختر قالباً —</option>'+tplGet().map(x=>`<option${x.name===v?' selected':''}>${esc(x.name)}</option>`).join('');};tplFill();
  const tplState=()=>({kind:d.querySelector('[name=repKind]:checked').value,checks:[...d.querySelectorAll('[data-g]:checked')].map(x=>x.dataset.g+'|'+x.value),from:$q('repFrom').value,to:$q('repTo').value,dim:d.querySelector('[name=repDim]:checked').value,sort:$q('repSort').value,each:$q('repEach').checked,cols:colsSel(),ask:$q('repAsk').value});
  const tplApply=T=>{d.querySelector(`[name=repKind][value=${T.kind||'full'}]`).checked=true;d.querySelectorAll('[data-g]').forEach(x=>{x.checked=(T.checks||[]).includes(x.dataset.g+'|'+x.value);});$q('repFrom').value=T.from||'';$q('repTo').value=T.to||'';
    const r=d.querySelector(`[name=repDim][value=${T.dim}]`);if(r)r.checked=true;$q('repSort').value=T.sort||'file';$q('repEach').checked=T.each!==false;colsSet(T.cols&&T.cols.length?T.cols:null);$q('repAsk').value=T.ask||'';upd();};
  d.addEventListener('input',upd);d.addEventListener('change',e=>{if(e.target.closest('[data-col]'))colN();upd();});
  d.addEventListener('click',async e=>{const cs=e.target.closest('[data-cols]');if(cs){colsSet(cs.dataset.cols==='all'?null:COLSETS[cs.dataset.cols]);return;}
    const rb=e.target.closest('[data-r=ask],[data-r=tplsave],[data-r=tplload],[data-r=tpldel]');
    if(rb){const k=rb.dataset.r;if(k==='ask'){applyAsk();return;}
      if(k==='tplsave'){const nm=(prompt('اسم القالب (مثلاً: تقرير لجنة الكرمة الشهري)',$q('repTpl').value||(sitCom?'تقرير لجنة '+sitCom:''))||'').trim();if(!nm)return;const L=tplGet().filter(x=>x.name!==nm);L.push(Object.assign({name:nm,saved:Date.now()},tplState()));tplPut(L);$q('repTpl').value=nm;tplFill();$q('repTpl').value=nm;flash('حُفظ القالب «'+nm+'»');return;}
      if(k==='tplload'){const T=tplGet().find(x=>x.name===$q('repTpl').value);if(!T){flash('اختر قالباً أولاً',true);return;}tplApply(T);flash('فُتح القالب «'+T.name+'»');return;}
      if(k==='tpldel'){const nm=$q('repTpl').value;if(!nm||!confirm('حذف القالب «'+nm+'»؟'))return;tplPut(tplGet().filter(x=>x.name!==nm));tplFill();return;}}
    const pre=e.target.closest('[data-pre]');
    if(pre){const k=pre.dataset.pre,set=(g,fn)=>d.querySelectorAll(`[data-g=${g}]`).forEach(x=>{x.checked=fn(x.value);});
      d.querySelectorAll('[data-g]').forEach(x=>x.checked=false);$q('repFrom').value='';$q('repTo').value='';
      if(k==='7599'){$q('repFrom').value=75;$q('repTo').value=99;}
      if(k==='runlag')set('state',v=>/^المستمرة|^المتلكئة/.test(v));if(k==='lag')set('state',v=>/^المتلكئة/.test(v));if(k==='stop')set('state',v=>/^المتوقفة/.test(v));
      if(k==='mnf')set('fund',v=>/منافذ/.test(v));upd();return;}
    const b=e.target.closest('[data-r]');if(e.target===d||(b&&b.dataset.r==='no')){d.remove();return;}if(!b)return;
    const {R,c}=pick();if(!R.length){flash('لا توجد مشاريع مطابقة للاختيار',true);return;}
    const dim=d.querySelector('[name=repDim]:checked').value,lbl=c?'مخصص':dim==='all'?'شامل':REP_DIMS.find(x=>x[0]===dim)[1],ct=c?repCritText(c):'';
    const buf=buildReport({dim,R,cols:colsSel(),sort:$q('repSort').value,each:$q('repEach').checked,title:c?'تقرير مخصص'+(ct?' — '+ct:''):null,note:[sitCom?'موقف '+sitCom:'',ct,$q('repPick').checked?'مشاريع محددة ('+R.length+')':$q('repFilt').checked?'حسب تصفية الجدول':''].filter(Boolean).join(' — ')});
    const name=`تقرير-المشاريع-${sitCom?sitCom.replace(/[\\/:*?"<>|\s]+/g,'-')+'-':''}${lbl.replace(/[()\s/]+/g,'-').replace(/-+$/,'')}_${new Date().toISOString().slice(0,10)}.xlsx`;
    if(window.desktop&&window.desktop.saveFile){const r=await window.desktop.saveFile(name,buf);if(r==='ok'){flash('تم حفظ التقرير');d.remove();}else if(r==='error')flash('تعذّر حفظ التقرير',true);}
    else{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));a.download=name;a.click();d.remove();}});
  /* المشاريع المحددة */
  const chipsP=()=>{const R=all.filter(r=>picked.has(String(r.p.fileNo)));$q('repPickC').innerHTML=R.length?R.map(r=>`<span class="pc">${esc(r.p.fileNo)} — ${esc(String(r.p.name||'').slice(0,50))} <a data-rpx="${esc(r.p.fileNo)}" title="إزالة">✕</a></span>`).join('')+(R.length>1?' <a class="pcx" data-rpx="*">مسح الكل</a>':''):'<span class="hint">لا مشاريع محددة بعد.</span>';$q('repPick').disabled=!R.length;if(!R.length)$q('repPick').checked=false;};
  const addQ=()=>{const v=$q('repPickQ').value.trim();if(!v)return;const r=pickAdd(v,all);$q('repPickM').textContent=r.msg;if(r.n){$q('repPick').checked=true;$q('repPickQ').value='';}chipsP();upd();syncPk();pickBar();};
  $q('repPickQ').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();addQ();}});
  $q('repPickQ').addEventListener('change',()=>{if(/ — /.test($q('repPickQ').value))addQ();});
  d.addEventListener('click',e=>{const x=e.target.closest('[data-rpx]');if(x){if(x.dataset.rpx==='*')picked.clear();else picked.delete(x.dataset.rpx);savePick();chipsP();upd();syncPk();pickBar();return;}
    const b=e.target.closest('[data-rp]');if(!b)return;if(b.dataset.rp==='add'){addQ();return;}pickAct(b.dataset.rp,all.filter(r=>picked.has(String(r.p.fileNo))));});
  if(opt){opt.only.forEach(x=>picked.add(String(x)));savePick();}chipsP();if(opt&&!$q('repPick').disabled)$q('repPick').checked=true;
  upd();}
$q('bRep').onclick=()=>reportDlg();
/* ---------- مشاريع محددة: طباعة / PDF / نسخ / Excel لمشروع واحد أو أكثر ---------- */
function savePick(){try{localStorage.setItem('sitPicked',JSON.stringify([...picked]));}catch(_){}}
function pickRows(){const R=rows(),m=new Map(R.map(r=>[String(r.p.fileNo),r]));return [...picked].map(fn=>m.get(fn)).filter(Boolean);}
function syncPk(){document.querySelectorAll('#tbl input[data-pk]').forEach(x=>{x.checked=picked.has(x.dataset.pk);});}
function pickBar(){const el=$q('sitPick');if(!el)return;const n=pickRows().length;el.hidden=!n;
  const all=$q('pkAll');if(all){const v=[...document.querySelectorAll('#tbl input[data-pk]')];all.checked=!!v.length&&v.every(x=>x.checked);}
  if(!n)return;el.innerHTML=`<b>☑ ${n===1?'مشروع واحد محدد':n+' مشاريع محددة'}</b><button class="btn sm pri" data-pp="print">🖨 طباعة موقفها</button><button class="btn sm" data-pp="pdf">📄 حفظ PDF</button><button class="btn sm" data-pp="copy">📋 نسخ نصاً</button><button class="btn sm" data-pp="xl">📊 تقرير Excel</button><button class="btn sm" data-pp="show">👁 عرضها فقط</button><button class="btn sm" data-pp="clear">✕ إلغاء التحديد</button>`;}
function pickClick(e){const t=e.target;if(t.id==='pkAll'){document.querySelectorAll('#tbl input[data-pk]').forEach(x=>{if(t.checked)picked.add(x.dataset.pk);else picked.delete(x.dataset.pk);});}
  else if(t.matches&&t.matches('input[data-pk]')){if(t.checked)picked.add(t.dataset.pk);else picked.delete(t.dataset.pk);}
  else{const c=t.querySelector&&t.querySelector('input');if(c){c.click();return;}}
  savePick();syncPk();pickBar();}
/* إضافة بالرقم أو بالاسم: «1234، 1250» أو «1234 — اسم» أو جزء من الاسم (إن طابق مشروعاً واحداً) */
function pickAdd(v,all){const by=new Map(all.map(r=>[RN(String(r.p.fileNo)),r]));const s=RN(String(v)).replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d));
  if(/ — /.test(s)){const fn=s.split(' — ')[0].trim();if(by.has(fn)){picked.add(String(by.get(fn).p.fileNo));savePick();return {n:1,msg:'أُضيف '+fn};}}
  const toks=s.split(/[,،;؛\s]+/).filter(Boolean);if(toks.length&&toks.every(t=>by.has(t))){toks.forEach(t=>picked.add(String(by.get(t).p.fileNo)));savePick();return {n:toks.length,msg:`أُضيف ${toks.length} مشروع`};}
  const q=s.trim().toLowerCase(),M=all.filter(r=>RN(String(r.p.name||'')).toLowerCase().includes(q)||RN(String(r.p.fileNo))===q);
  if(M.length===1){picked.add(String(M[0].p.fileNo));savePick();return {n:1,msg:'أُضيف '+M[0].p.fileNo+' — '+M[0].p.name};}
  const miss=toks.filter(t=>!by.has(t));if(toks.length>1&&miss.length<toks.length){toks.filter(t=>by.has(t)).forEach(t=>picked.add(String(by.get(t).p.fileNo)));savePick();return {n:toks.length-miss.length,msg:`أُضيف ${toks.length-miss.length} — غير موجود في الموقف: ${miss.join('، ')}`};}
  return {n:0,msg:M.length?`يطابق ${M.length} مشروعاً — اختر من القائمة أو اكتب رقم الاضبارة`:'لا يوجد مشروع بهذا الرقم أو الاسم في الموقف'};}
$q('sitPick').addEventListener('click',e=>{const b=e.target.closest('[data-pp]');if(!b)return;const k=b.dataset.pp,R=pickRows();
  if(k==='clear'){picked.clear();savePick();syncPk();pickBar();return;}
  if(k==='show'){$q('q').value='';$q('fs').value='';$q('ff').value='';$q('fz').value='';$q('fx').value='';const f=R;$q('tbl').innerHTML=table(f);pickBar();$q('info').textContent=`يُعرض ${f.length} مشروعاً محدداً فقط — اكتب في البحث أو غيّر التصفية للرجوع إلى كل المشاريع.`;return;}
  pickAct(k,R);});
async function copyText(t){try{await navigator.clipboard.writeText(t);return true;}catch(_){const a=document.createElement('textarea');a.value=t;a.style.cssText='position:fixed;opacity:0';document.body.appendChild(a);a.select();let ok=false;try{ok=document.execCommand('copy');}catch(_){}a.remove();return ok;}}
async function pickAct(k,R){if(!R.length){flash('حدّد مشروعاً أو أكثر أولاً',true);return;}
  if(k==='copy'){const ok=await copyText(R.map(projText).join('\n\n— — — — —\n\n'));flash(ok?(R.length===1?'نُسخ موقف المشروع — الصقه في واتساب أو Word (Ctrl+V)':`نُسخ موقف ${R.length} مشاريع — الصقه في واتساب أو Word (Ctrl+V)`):'تعذّر النسخ',!ok);return;}
  if(k==='xl'){reportDlg({only:R.map(r=>String(r.p.fileNo))});return;}
  const name=R.length===1?`موقف-مشروع-${R[0].p.fileNo}_${new Date().toISOString().slice(0,10)}`:`موقف-${R.length}-مشاريع-محددة_${new Date().toISOString().slice(0,10)}`;
  if(!window.desktop||!window.desktop.printReport){const w=window.open('','_blank');if(!w){flash('تعذّر فتح نافذة الطباعة',true);return;}w.document.write(sheetHTML(R).replace(/__LOGO__/g,'logo.png'));w.document.close();setTimeout(()=>w.print(),400);return;}
  flash(k==='pdf'?'جارٍ إنشاء ملف PDF…':'جارٍ تجهيز الطباعة…');const r=await window.desktop.printReport(sheetHTML(R),k==='pdf'?'pdf':'print',name);
  if(r==='error')flash('تعذّرت الطباعة',true);else if(r==='ok'&&k==='pdf')flash('حُفظ ملف PDF وفُتح');}
/* نص المشروع للنسخ (واتساب / Word) */
function projText(r){const p=r.p,L=r.L||{},ln=['📌 '+p.name,`الاضبارة: ${p.fileNo}${p.contractor?' — الشركة: '+p.contractor:''}`];
  if(p.contractNo)ln.push(`العقد: ${p.contractNo}${p.year?' / '+p.year:''}${p.fund?' — التمويل: '+p.fund:''}`);
  if(p.district||p.sector)ln.push(`الموقع: ${[p.district,p.sub].filter(Boolean).join(' / ')||'—'}${p.sector?' — القطاع: '+p.sector:''}`);
  ln.push(`الكلفة الكلية: ${money(r.total)} د.ع${num(p.changeCost)?' (منها أوامر التغيير '+money(p.changeCost)+')':''}`);
  if(p.start||p.planEnd)ln.push(`المباشرة: ${DMY(p.start)||'—'} — الإنجاز المخطط: ${planDate(p)||'—'}${planDays(p)!=null?' ('+planDaysTxt(p,1)+')':''}${p.totalDays?' — المدة الكلية '+p.totalDays+' يوم':''}`);
  ln.push(`نسبة الإنجاز: المخطط ${has(p.planPct)?pc(p.planPct)+'%':'—'} — الفعلي ${has(p.actualPct)?pc(p.actualPct)+'%':'—'}`);
  ln.push('الحالة: '+(p.status||'—')+(p.legal&&p.legal!=='-'?' — '+p.legal:''));
  if(num(p.advRaised)||num(p.advPaid))ln.push(`السلف: المرفوعة ${money(p.advRaised)} — المصروفة ${money(p.advPaid)} — المتبقي ${money(num(p.advRaised)-num(p.advPaid))}`);
  if(L.ad)ln.push(`لجنة تدقيق السلف: ${L.ad.count} سلفة — التراكمي ${money(L.ad.cumulative)}`);
  if(L.co)ln.push(`أوامر التغيير: ${L.co.orders} أمر — الصافي ${money(L.co.changeCost)}${num(L.co.extraDays)?' — مدد '+L.co.extraDays+' يوم':''}`);
  if(L.du)ln.push('المدد والتوقف: '+(DU_L[L.du.status]||L.du.status||'')+(L.du.ext?' — '+L.du.ext+' يوم':''));
  if(L.ac&&L.ac.records&&L.ac.records.length)ln.push('الاستلام: '+L.ac.records.map(x=>x.typeLabel).join('، '));
  if(p.resident&&engVis())ln.push(`المهندس المقيم: ${p.resident}${p.residentOffice?' ('+p.residentOffice+')':''}`);
  const sp=engVis()?AnbarReg.supText(p.fileNo):'';if(sp)ln.push('المشرفون: '+sp);
  const la=repXY(p,'lat'),lg=repXY(p,'lng');if(has(la)&&has(lg))ln.push(`الإحداثيات: N ${la} — E ${lg}`);
  if(p.notes)ln.push('ملاحظات: '+p.notes);return ln.join('\n');}
/* صفحة الطباعة: صفحة A4 لكل مشروع، وقبلها جدول ملخص إذا كانت المشاريع أكثر من واحد */
function sheetHTML(R){const S=AnbarReg.state(),now=new Date(),dts=`${now.getFullYear()}/${now.getMonth()+1}/${now.getDate()}`,FV=finVis();
  const F=(l,v,w)=>`<div class="f${w?' w':''}"><i>${l}</i><b>${v===''||v==null?'—':v}</b></div>`;
  const head=t=>`<header><span class="lg"></span><div class="o"><b>محافظة الأنبار</b><span>قسم الشؤون الهندسية</span></div><div class="t"><h1>${t}</h1><span>${sitCom?'موقف '+esc(sitCom)+' — ':''}الموقف: ${esc(S.source||'')} (${esc(DMY(String(S.updated||'').slice(0,10)))}) — طُبع ${dts}</span></div></header>`;
  const bar=p=>{if(!has(p.actualPct)&&!has(p.planPct))return '';const a=Math.min(100,num(p.actualPct)),pl=has(p.planPct)?Math.min(100,num(p.planPct)):null;return `<div class="bar"><i style="width:${a}%;background:${KCOL[stKind(p.status)]}"></i>${pl!=null?`<u style="right:${pl}%"></u>`:''}</div>`;};
  const one=r=>{const p=r.p,L=r.L||{},total=r.total,I=issuesOf(p,L,total);
    const stf=(p.staff&&p.staff.length)?p.staff:[...(p.resident?[{name:p.resident,dept:p.residentOffice,role:'مهندس مقيم'}]:[])];
    const eng=S.engineers||[],phoneOf=n=>{const e=eng.find(x=>RN(x.name)===RN(n));return e&&e.phone?e.phone:(RN(n)===RN(p.resident)?p.phone:'');};
    const la=repXY(p,'lat'),lg=repXY(p,'lng');
    return `<h2>${esc(p.name)}</h2><div class="sub">اضبارة <b>${esc(p.fileNo)}</b>${p.contractor?' — '+esc(p.contractor):''}</div>
    <h5>بيانات المشروع والعقد</h5><div class="g">${F('رقم العقد / السنة',esc(p.contractNo)+(p.year?' / '+esc(p.year):''))}${F('برنامج التمويل',esc(p.fund))}${F('القطاع (الجهة المستفيدة)',esc(p.sector||sectorOf(p)))}${F('القضاء / الناحية',esc([p.district,p.sub].filter(Boolean).join(' / ')))}${F('الحالة',esc(p.status))}${F('الإجراءات القانونية',p.legal&&p.legal!=='-'?esc(p.legal):'')}${F('الإحداثي N (خط العرض)',has(la)?`<span dir="ltr">${la}</span>`:'')}${F('الإحداثي E (خط الطول)',has(lg)?`<span dir="ltr">${lg}</span>`:'')}</div>
    <h5>الكلفة والمدة</h5><div class="g">${F('الكلفة الأصلية',money(p.orig))}${F('كلفة أوامر التغيير',(num(p.changeCost)>0?'+':'')+money(p.changeCost))}${F('الكلفة الكلية',money(total))}${F('تاريخ المباشرة',esc(DMY(p.start)))}${F('مدة العقد (يوم)',esc(p.dur))}${F('المدة الإضافية (يوم)',esc(p.extra))}${F('المدة الكلية (يوم)',esc(p.totalDays))}${F('تاريخ الإنجاز المخطط',esc(planDate(p)))}${F('المدة من الإنجاز المخطط إلى اليوم',planDaysTxt(p,1))}</div>
    <h5>نسب الإنجاز</h5><div class="g">${F('المخطط',has(p.planPct)?pc(p.planPct)+'%':'')}${F('الفعلي',has(p.actualPct)?pc(p.actualPct)+'%':'')}${F('الانحراف عن الخطة',has(p.planPct)&&has(p.actualPct)?(num(p.actualPct)-num(p.planPct)>0?'+':'')+pc(num(p.actualPct)-num(p.planPct))+'%':'')}</div>${bar(p)}
    <h5>السلف</h5><div class="g">${F('المرفوعة (الموقف)',money(p.advRaised))}${F('المصروفة (الموقف)',money(p.advPaid))}${F('المتبقي للصرف',money(num(p.advRaised)-num(p.advPaid)))}${F('نسبة الصرف',num(p.advRaised)?pc(num(p.advPaid)/num(p.advRaised)*100)+'%':'')}${L.ad?F('سلف لجنة التدقيق',L.ad.count+' سلفة — التراكمي '+money(L.ad.cumulative)+' ('+pc(L.ad.pct)+'% من الكلفة)',1):''}</div>${advTable(L.ad)}
    <h5>أوامر التغيير</h5>${coTable(L.co)}
    <h5>حالته في الأنظمة</h5><div class="g">${F('المدد والتوقف',L.du?esc(DU_L[L.du.status]||L.du.status||'')+(L.du.ext?' — '+money(L.du.ext)+' يوم':''):'لا ملف')}${F('الاستلام',L.ac&&L.ac.records&&L.ac.records.length?L.ac.records.map(x=>esc(`${x.typeLabel} ${x.serial||''}${x.mEnd?' (الصيانة حتى '+x.mEnd+')':''}`)).join('، '):'لا محاضر')}${F('إطلاق التأمينات',L.in?(L.in.done?'صادرة':'مسودة')+(L.in.orderNo?' — أمر '+esc(L.in.orderNo):''):'لا استمارة')}</div>
    <h5>الكادر الهندسي</h5>${!engVis()?ENGLOCK:stf.length?`<table><thead><tr><th>الاسم</th><th>الصفة</th><th>الدائرة</th><th>الهاتف</th></tr></thead><tbody>${stf.map(x=>`<tr><td>${esc(x.name)}</td><td>${esc(x.role||'')}</td><td>${esc(x.dept||'')}</td><td class="n">${esc(phoneOf(x.name)||'')}</td></tr>`).join('')}</tbody></table>`:'<div class="hint">لا بيانات مهندسين لهذا المشروع.</div>'}
    ${I.length?`<h5>ملاحظات المطابقة بين الموقف والأنظمة</h5><ul class="iss">${I.map(x=>`<li>${esc(x[1])}</li>`).join('')}</ul>`:''}
    ${p.notes?`<h5>ملاحظات</h5><div>${esc(p.notes)}</div>`:''}`;};
  const sum=R.length>1?`<section class="pg">${head(`موقف ${R.length} مشاريع محددة — ملخص`)}<table class="sm"><thead><tr><th>ت</th><th>الاضبارة</th><th>المشروع</th><th>الشركة</th><th>القضاء</th><th>الكلفة الكلية</th><th>المخطط %</th><th>الفعلي %</th><th>الحالة</th><th>السلف المرفوعة</th><th>المصروفة</th><th>أوامر التغيير (صافي)</th></tr></thead><tbody>${R.map((r,i)=>{const p=r.p;return `<tr><td class="n">${i+1}</td><td class="n">${esc(p.fileNo)}</td><td>${esc(p.name)}</td><td>${esc(p.contractor||'')}</td><td>${esc(p.district||'')}</td><td class="n">${money(r.total)}</td><td class="n">${has(p.planPct)?pc(p.planPct):''}</td><td class="n">${has(p.actualPct)?pc(p.actualPct):''}</td><td>${esc(p.status||'')}</td><td class="n">${money(p.advRaised)}</td><td class="n">${money(p.advPaid)}</td><td class="n">${money(r.L&&r.L.co?r.L.co.changeCost:p.changeCost)}</td></tr>`;}).join('')}</tbody>${FV?`<tfoot><tr><td colspan="5"><b>المجموع</b></td><td class="n"><b>${money(R.reduce((a,r)=>a+num(r.total),0))}</b></td><td colspan="3"></td><td class="n"><b>${money(R.reduce((a,r)=>a+num(r.p.advRaised),0))}</b></td><td class="n"><b>${money(R.reduce((a,r)=>a+num(r.p.advPaid),0))}</b></td><td class="n"><b>${money(R.reduce((a,r)=>a+num(r.L&&r.L.co?r.L.co.changeCost:r.p.changeCost),0))}</b></td></tr></tfoot>`:''}</table><p class="hint">تليه صفحة لكل مشروع بتفاصيله.</p></section>`:'';
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${R.length===1?'موقف مشروع '+esc(R[0].p.fileNo):'موقف المشاريع المحددة'}</title><style>
@page{size:A4;margin:11mm 11mm 13mm}*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{margin:0;font-family:"Segoe UI",Tahoma,Arial,sans-serif;font-size:10.5pt;color:#14201a;direction:rtl}
section.pg+section.pg{break-before:page}header{break-inside:avoid;padding-top:3mm}
header{display:flex;align-items:center;gap:10px;border-bottom:2.5px solid #1f6b3a;padding-bottom:6px;margin-bottom:8px}header .lg{flex:0 0 56px;width:56px;height:56px;background:url(__LOGO__) center/contain no-repeat}
header .o{display:flex;flex-direction:column;font-size:10.5pt}header .o b{font-size:12pt}header .t{margin-right:auto;text-align:left}header h1{margin:0;font-size:14pt;color:#1f4d33}header .t span{font-size:8.5pt;color:#5b6b62}
h2{margin:4px 0 0;font-size:14pt}.sub{color:#3d4d44;margin-bottom:4px}h5{margin:9px 0 4px;font-size:11pt;color:#1f4d33;border-bottom:1px solid #c9d8ce;padding-bottom:2px;break-after:avoid}
.g{display:grid;grid-template-columns:repeat(4,1fr);gap:3px 6px}.f{border:1px solid #dde6e0;border-radius:4px;padding:2px 6px;break-inside:avoid}.f.w{grid-column:span 2}.f i{display:block;font-style:normal;font-size:8pt;color:#5b6b62}.f b{font-size:10pt;font-weight:600}
.bar{position:relative;height:9px;background:#e4ebe6;border-radius:5px;margin:5px 0;overflow:hidden}.bar i{position:absolute;top:0;bottom:0;right:0}.bar u{position:absolute;top:-2px;bottom:-2px;width:2px;background:#14201a}
table{width:100%;border-collapse:collapse;font-size:9pt;margin-top:3px}th,td{border:1px solid #a9bcb0;padding:2px 4px;text-align:right;vertical-align:top}th{background:#e6f0e9}tr{break-inside:avoid}tfoot td{background:#f2f6f3}
table.sm{font-size:7.5pt}table.sm td,table.sm th{padding:2px 3px}.n{text-align:center;direction:ltr;unicode-bidi:plaintext;white-space:nowrap}.co,.hint{color:#5b6b62;font-size:8.5pt}.chip{border:1px solid #b5463b;color:#b5463b;border-radius:3px;padding:0 3px}.neg td{color:#9a2a1f}
.iss{margin:2px 0;padding-right:18px;color:#7a3b00;font-size:9pt}.dtw{overflow:visible}
</style></head><body>${sum}${R.map(r=>`<section class="pg">${head('موقف مشروع')}${one(r)}</section>`).join('')}</body></html>`;}
document.addEventListener('click',e=>{const b=e.target.closest('[data-rmpart]');if(!b)return;const c=b.dataset.rmpart;if(!confirm(`حذف موقف «${c}» من الموقف المتراكم؟\nيُحذف من كل الحاسبات بالمزامنة، ويعود إذا استوردت اللجنة موقفها مجدداً.`))return;AnbarReg.removePart(c);flash('حُذف موقف «'+c+'»');render();});
window.SitIssues=issuesOf;
window.SitReport={planDays,planDaysTxt,repColsN:()=>REP_COLS.map(c=>c[0]),sheetHTML,projText,pickAct,finDlg,finVis,sectorOf,repParse,reportDlg,com:()=>sitCom,setCom:v=>{sitCom=v||'';try{localStorage.setItem('sitCom',sitCom);}catch(_){}render();},comOf,buildReport,repGroups,repStats,rows,filtered,repMatch,repCritText};

/* حفظ «تاريخ الإنجاز الفعلي» من بطاقة المشروع (المنجز) */
document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('[data-aesave]');if(!b)return;const fn=b.dataset.aesave,inp=document.getElementById('aeIn'),v=inp&&inp.value;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(v||'')){flash('اختر تاريخ الإنجاز الفعلي أولاً',true);return;}
  if(v>new Date().toISOString().slice(0,10)){flash('تاريخ الإنجاز الفعلي لا يكون بعد اليوم',true);return;}
  try{AnbarReg.setMeta(fn,{actualEnd:v});}catch(err){flash('تعذّر الحفظ: '+err.message,true);return;}
  flash('حُفظ تاريخ الإنجاز الفعلي '+DMY(v)+' للاضبارة '+fn);try{drawer(fn);}catch(_){}try{window.SitRender&&window.SitRender();}catch(_){}});
/* «✔ تحققتُ — تجاهل هذا الفرق» وإلغاؤه */
document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('[data-ack],[data-unack]');if(!b)return;const fn=b.dataset.ack||b.dataset.unack,h=b.dataset.h,S=ackSet(fn);
  if(b.dataset.ack){if(!confirm('تأكيد: تحققتَ من الموقف ونظام أوامر التغيير/السلف ووجدت الرقمين صحيحين؟\nيُخفى هذا الفرق لهذا المشروع، ويعود تلقائياً إن تغيّر أي رقم فيه.'))return;S.add(h);}else S.delete(h);
  try{AnbarReg.setMeta(fn,{ackIss:[...S].join(',')||'-'});}catch(err){flash('تعذّر الحفظ: '+err.message,true);return;}
  flash(b.dataset.ack?'أُخفي الفرق لهذا المشروع (يعود إن تغيّر أي رقم)':'أُعيد إظهار الفرق');try{drawer(fn);}catch(_){}try{window.SitRender&&window.SitRender();}catch(_){}});
/* «إزالة هذا الملخص»: ملخص سلف بلا ملف مقابل على هذه الحاسبة */
document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('[data-adrm]');if(!b)return;const fn=b.dataset.adrm;
  if(!confirm('إزالة ملخص السلف من الموقف لهذه الاضبارة؟\nلا يوجد ملف سلف يقابله في لجنة التدقيق على هذه الحاسبة. إن كانت السلفة حقيقية على حاسبة أخرى فسيعود الملخص عند تحديث تلك الحاسبة.'))return;
  try{const a=(AnbarReg.links(fn)||{}).ad;AnbarReg.setMeta(fn,{linkDrop_ad:(a&&a.at)||new Date().toISOString()});AnbarReg.dropLink('ad',fn);}catch(err){flash('تعذّر: '+err.message,true);return;}
  flash('أُزيل ملخص السلف للاضبارة '+fn);try{drawer(fn);}catch(_){}try{window.SitRender&&window.SitRender();}catch(_){}});
})();
