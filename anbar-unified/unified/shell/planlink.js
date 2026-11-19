/* 📐 مشاريع التخطيط: ملف لجنة تحديث الخطة (Excel) داخل البرنامج.
   - شجرة: المشروع التخطيطي (ترميزه ووزارته وكلفته التخمينية) وتحته مكوّناته؛ المكوّن المرتبط بموقف لجاننا يحمل رقم اضبارته.
   - لوحة معلومات خاصة بالتخطيط.
   - نوع التمويل والجهة المستفيدة (الدائرة) من ملف التخطيط يُعتمدان في «الموقف العام» وتقاريره (PlanLink.apply).
   - «⬇ تصدير ملف التخطيط المحدَّث»: نسخة من الملف الأصلي تُحدَّث فيها مكوّناتنا فقط من بيانات اللجان (لا تُمس خلايا المعادلات). */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=v=>{const n=parseFloat(String(v==null?'':v).replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/,/g,''));return isFinite(n)?n:0;};
const has=v=>v!==''&&v!=null&&!(typeof v==='number'&&isNaN(v));
const codeOf=p=>{const c=String(p&&p.code||'');return /\d/.test(c)?c.split('-').map(x=>x.trim()||'·').join('-'):'';};
const money=v=>Math.round(num(v)).toLocaleString('en-US');
const compact=v=>{v=num(v);const a=Math.abs(v);return a>=1e9?(v/1e9).toFixed(2)+' مليار':a>=1e6?(v/1e6).toFixed(1)+' مليون':money(v);};
const finVis=()=>{try{return !window.desktop||!window.desktop.finState||window.desktop.finState().visible;}catch(_){return true;}};
const T=s=>String(s==null?'':s).replace(/[ً-ْـ]/g,'').replace(/[إأآٱ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/ؤ/g,'و').replace(/ئ/g,'ي')
  .replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d)).toLowerCase().replace(/[^ء-ي0-9a-z]+/g,' ').trim();
const STOP=new Set(['مشروع','شركه','للمقاولات','المقاولات','العامه','المحدوده','والتجاره','التجاره','في','من','الى','مع','و','قضاء','ناحيه','محافظه','الانبار']);
const toks=s=>new Set(T(s).split(' ').map(w=>w.replace(/^ال(?=..)/,'')).filter(w=>w.length>1&&!STOP.has(w)&&!STOP.has('ال'+w)));
const jac=(A,B)=>{if(!A.size||!B.size)return 0;let n=0;A.forEach(x=>{if(B.has(x))n++;});return n/(A.size+B.size-n);};
const dig=s=>String(s==null?'':s).replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/\D/g,'').replace(/^0+/,'');
let R=null,M=null,mKey='',ui={q:'',plan:'',st:'',dist:'',min:'',ours:false,open:new Set(),limit:150};
const stK=s=>{s=String(s||'');if(/منجز/.test(s)&&!/غير منجز/.test(s))return 'ok';if(/متوقف|توقف|سحب/.test(s))return 'bad';if(/متلك/.test(s))return 'warn2';if(/فسخ/.test(s))return 'cut';if(/مكون (مقسم|مدمج)/.test(s))return 'split';if(/مستمر|قيد|متاخر|متأخر|ضمن/.test(s))return 'blue';return 'none';};
const STL={ok:'منجز',blue:'مستمر',warn2:'متلكئ',bad:'متوقف',cut:'فسخ عقد',split:'مكوّن مقسّم / مدمج',none:'غير محدد'};
const STC={ok:'#2f8a45',blue:'#2563a8',warn2:'#c2570c',bad:'#c0392b',cut:'#7a2e2e',split:'#8a6d1f',none:'#8a968f'};

const dmy=v=>(window.DMY?window.DMY(v):String(v||''));
async function load(){if(!window.desktop||!window.desktop.plan)return null;try{R=await window.desktop.plan.get();}catch(_){R=null;}M=null;
  /* توحيد التمويل بأسماء الموقف العام (ملفات التخطيط المستوردة قبل التوحيد أيضاً) */
  try{const fc=window.AnbarReg&&AnbarReg.fundCanon;const m=R&&R.model;if(fc&&m){(m.comps||[]).forEach(c=>{if(c.fund)c.fund=fc(c.fund);});(m.projects||[]).forEach(p=>{if(p.plan)p.plan=fc(p.plan);});}}catch(_){}
  return R;}
const model=()=>R&&R.model;

/* مطابقة المكوّنات بموقف اللجان: رقم العقد مع الشركة أو الاسم، ثم الاسم والشركة */
/* تطابق قوي (قاعدة القسم): اسم المشروع متطابق بنسبة 90% فأكثر + اسم الشركة متشابه + رقم العقد نفسه ← يُعتمد الربط
   ويغلب أي تطابق أضعف (التعادل بين مكوّنين، أو مكوّن مرتبط باضبارة أخرى بتطابق أضعف). رقم العقد يُقارن بالرقم الأول («65/2026» = «65») */
const n1=v=>(String(v==null?'':v).replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d)).match(/\d+/)||[''])[0].replace(/^0+/,'');
const flat=s=>T(s).replace(/\s+/g,'');
function dice(a,b){if(!a||!b)return 0;if(a===b)return 1;const g=s=>{const m=new Map();for(let i=0;i<s.length-1;i++){const t=s.substr(i,2);m.set(t,(m.get(t)||0)+1);}return m;},A=g(a),B=g(b);let x=0;A.forEach((v,k)=>{x+=Math.min(v,B.get(k)||0);});return 2*x/Math.max(1,a.length+b.length-2);}
function matchAll(){
  const m=model();if(!m||!window.AnbarReg)return null;const S=AnbarReg.state();const key=[R.updated,S.projects.length,S.projects.map(p=>p.fileNo).join(',').length].join('|');
  if(M&&mKey===key)return M;
  const C=m.comps.map(c=>({c,nt:toks(c.name),ct:toks(c.company),cn:dig(c.contractNo)})),byC=new Map(),inv=new Map();
  C.forEach(x=>{if(x.cn)(byC.get(x.cn)||byC.set(x.cn,[]).get(x.cn)).push(x);x.nt.forEach(t=>(inv.get(t)||inv.set(t,[]).get(t)).push(x));});
  const byN1=new Map();C.forEach(x=>{const k=n1(x.c.contractNo);if(k)(byN1.get(k)||byN1.set(k,[]).get(k)).push(x);});
  const byFn={},byComp={},why={};
  S.projects.forEach(p=>{const fn=String(p.fileNo),nt=toks(p.name),ct=toks(p.contractor),cn=dig(p.contractNo);const cand=[];
    {const k=n1(p.contractNo);if(k){const pn=flat(p.name),pc=flat(p.contractor);(byN1.get(k)||[]).forEach(x=>{const ns=dice(pn,flat(x.c.name)),cs=dice(pc,flat(x.c.company));
      if(ns>=0.9&&(cs>=0.6||jac(ct,x.ct)>=0.5))cand.push({x,s:10+ns+cs,strong:1,how:'تطابق اسم المشروع '+Math.round(ns*100)+'% والشركة ورقم العقد'});});}}
    if(!cand.some(c=>c.strong)&&cn)(byC.get(cn)||[]).forEach(x=>{const cs=jac(ct,x.ct),ns=jac(nt,x.nt);if(cs>=0.3||ns>=0.4)cand.push({x,s:3+cs+ns,how:'رقم العقد'+(cs>=0.3?' والشركة':' واسم المشروع')});});
    if(!cand.length&&nt.size){/* بلا رقم عقد مطابق */const seen=new Map();nt.forEach(t=>(inv.get(t)||[]).forEach(x=>seen.set(x,(seen.get(x)||0)+1)));
      seen.forEach((c,x)=>{if(c<2&&nt.size>2)return;const ns=jac(nt,x.nt),cs=jac(ct,x.ct);if(T(p.name)===T(x.c.name))cand.push({x,s:2.5+cs,how:'اسم المشروع'});else if(ns>=0.6&&(cs>=0.3||!ct.size||!x.ct.size))cand.push({x,s:1+ns+cs*0.5,how:'تشابه اسم المشروع'+(cs>=0.3?' والشركة':'')});});}
    cand.sort((a,b)=>b.s-a.s);if(!cand.length){why[fn]={k:'none'};return;}
    if(cand[1]&&cand[1].x!==cand[0].x&&cand[0].s-cand[1].s<0.05&&!(cand[0].strong&&!cand[1].strong)){why[fn]={k:'tie',a:cand[0].x.c,b:cand[1].x.c};return;}
    const k=cand[0].x.c.key;if(byComp[k]&&byComp[k].s>=cand[0].s){why[fn]={k:'taken',a:cand[0].x.c,by:byComp[k].fn};return;}if(byComp[k]){const o=byComp[k].fn;delete byFn[o];why[o]={k:'taken',a:cand[0].x.c,by:fn};}
    byFn[fn]={c:cand[0].x.c,how:cand[0].how,s:cand[0].s};byComp[k]={fn,s:cand[0].s};});
  M={byFn,byComp,why,C};mKey=key;return M;}
window.__plTest={setModel:m=>{R={model:m,updated:Date.now(),file:'test'};M=null;}};
const projOf=key=>{const m=model();return m&&m.projects.find(p=>p.key===key);};

/* نوع التمويل والجهة المستفيدة من ملف التخطيط في الموقف العام (نسخة للعرض والتقارير؛ سجل الموقف نفسه لا يُغيَّر) */
const AC=new Map();let acKey='';
function apply(p){
  if(!p||!model())return p;const mm=matchAll();if(!mm)return p;if(acKey!==mKey){AC.clear();acKey=mKey;}
  const k=String(p.fileNo),hit=mm.byFn[k];if(!hit)return p;const c=AC.get(k);if(c&&c.src===p)return c.v;
  const pr=projOf(hit.c.proj)||{};
  const v=Object.assign({},p,{fund:hit.c.fund||p.fund,sector:hit.c.directorate||p.sector,ministry:hit.c.ministry||pr.ministry||'',_orig:{fund:p.fund,sector:p.sector},_plan:{c:hit.c,p:pr,how:hit.how}});
  AC.set(k,{src:p,v});return v;}

/* قسم بطاقة المشروع في الموقف العام */
function section(p){
  if(!p||!p._plan)return '';const c=p._plan.c,pr=p._plan.p,d=(l,v)=>v===''||v==null?'':`<div><small>${l}</small><b>${v}</b></div>`;const FV=finVis();
  return `<h5>📐 في خطة المحافظة (ملف لجنة تحديث الخطة)</h5><div class="hint">مطابق للمكوّن «${esc(c.name)}» <span class="co">(${esc(p._plan.how)} — الورقة «${esc(c.sheet)}»، الصف ${c.row})</span></div>
    <div class="dg">${d('المشروع التخطيطي',esc(pr.name||'—'))}${d('الترميز',esc(codeOf(pr)))}${d('نوع التمويل (ملف التخطيط)',esc(c.fund))}${d('الجهة المستفيدة (الدائرة)',esc(c.directorate||'—'))}${d('الوزارة',esc(c.ministry||pr.ministry||''))}
    ${d('في موقف اللجنة',`التمويل: ${esc(p._orig.fund||'—')} — الجهة: ${esc(p._orig.sector||'—')}`)}${FV&&has(pr.cost)?d('الكلفة التخمينية للمشروع',money(pr.cost)):''}${FV&&has(c.spent)?d('مجموع المصروف (التخطيط)',money(c.spent)):''}${has(c.actPct)?d('الإنجاز الفني (التخطيط)',num(c.actPct)+'%'):''}${c.status?d('الحالة في ملف التخطيط',esc(c.status)):''}</div>`;}

/* ---------- الصفحة ---------- */
function filtered(){const m=model(),mm=matchAll()||{byComp:{}};const q=T(ui.q);
  return m.projects.map(p=>{const comps=p.comps.map(k=>m.comps.find(c=>c.key===k)).filter(Boolean).filter(c=>(!ui.st||stK(c.status)===ui.st)&&(!ui.dist||String(c.district||'').trim()===ui.dist)&&(!ui.ours||mm.byComp[c.key])&&(!ui.plan||(c.fund||p.plan)===ui.plan)&&(!ui.min||(c.ministry||p.ministry)===ui.min)&&(!q||T([c.name,c.company,c.contractNo,c.resident,c.directorate,mm.byComp[c.key]?mm.byComp[c.key].fn:''].join(' ')).includes(q)||T(p.name+' '+p.code).includes(q)));
    return {p,comps};}).filter(x=>x.comps.length||(!ui.st&&!ui.dist&&!ui.ours&&!q&&(!ui.plan||x.p.plan===ui.plan)&&(!ui.min||x.p.ministry===ui.min)&&!x.p.comps.length));}
function kpis(){const m=model(),mm=matchAll()||{byComp:{},byFn:{}},FV=finVis();
  const real=m.projects.filter(p=>!p.virtual),cost=real.reduce((s,p)=>s+num(p.cost),0),spent=m.comps.reduce((s,c)=>s+num(c.spent),0);
  const ours=Object.keys(mm.byComp).length,S=window.AnbarReg?AnbarReg.state():{projects:[]},regN=S.projects.length,regM=Object.keys(mm.byFn).length;
  const cnt={};m.comps.forEach(c=>{const k=stK(c.status);cnt[k]=(cnt[k]||0)+1;});
  const k=(l,v,s,cl)=>`<div class="kpi" style="${cl?'--kc:'+cl:''}"><span>${l}</span><b>${v}</b>${s?`<small>${s}</small>`:''}</div>`;
  const kf=(l,v,s,cl)=>FV?k(l,v,s,cl):`<div class="kpi finhid" data-finshow="1" title="مبلغ مالي محجوب — اضغط لإظهاره بكلمة سر المدير"><span>${l}</span><b>🔒 ••••••</b><small>محجوب — اضغط وأدخل كلمة سر المدير</small></div>`;
  const split=m.comps.filter(c=>stK(c.status)==='split').length;
  return k('المشاريع التخطيطية',real.length,`${m.projects.filter(p=>p.virtual).length?'+ '+m.projects.filter(p=>p.virtual).length+' مجموعة منافذ / إعادة استقرار — ':''}${split?split+' مكوّن مقسّم أو مدمج':''}`)
    +k('المكوّنات (العقود)',m.comps.length,Object.keys(STL).filter(x=>cnt[x]).map(x=>`<span style="color:${STC[x]}">${STL[x]} ${cnt[x]}</span>`).join(' · '))
    +k('مكوّنات لجاننا',ours,`${regM} من ${regN} مشروعاً في الموقف مرتبط بملف التخطيط${regN>regM?` — <a href="#" data-plgaps="1" style="color:#b33;font-weight:700">${regN-regM} غير مرتبط: لماذا؟</a>`:''}`,'#2563a8')
    +kf('الكلفة التخمينية (المشاريع التخطيطية)',`<span title="${money(cost)}">${compact(cost)}</span>`,money(cost)+' دينار','#b08a2e')
    +kf('مجموع المصروف (المكوّنات)',`<span title="${money(spent)}">${compact(spent)}</span>`,cost?((spent/cost*100).toFixed(1)+'% من الكلفة التخمينية'):'','#2f8a45');}
function bars(title,map,color){const e=Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,10),mx=Math.max(1,...e.map(x=>x[1]));
  return `<div class="card"><h4>${title}</h4>${e.map(([l,n])=>`<div class="hbr"><span title="${esc(l)}">${esc(l||'غير محدد')}</span><i style="width:${Math.max(2,n/mx*100)}%;background:${typeof color==='function'?color(l):color}"></i><b>${n}</b></div>`).join('')}</div>`;}
function charts(){const m=model(),by=f=>{const o={};m.comps.forEach(c=>{const k=f(c);o[k]=(o[k]||0)+1;});return o;};
  return bars('المكوّنات حسب نوع التمويل',by(c=>c.fund||'غير محدد'),'#b08a2e')+bars('حسب الحالة',by(c=>STL[stK(c.status)]),l=>STC[Object.keys(STL).find(k=>STL[k]===l)]||'#888')+bars('حسب القضاء',by(c=>String(c.district||'').trim()||'غير محدد'),'#2563a8')+bars('حسب الجهة المستفيدة (الدائرة)',by(c=>c.directorate||'غير محدد'),'#0f766e');}
function opts(id,vals,all,cur){const s=$(id);if(!s)return;s.innerHTML=`<option value="">${all}</option>`+vals.map(v=>`<option${v===cur?' selected':''}>${esc(v)}</option>`).join('');}
function tree(){const L=filtered(),mm=matchAll()||{byComp:{}},FV=finVis();const shown=L.slice(0,ui.limit);
  const comp=c=>{const o=mm.byComp[c.key];return `<tr class="plc${o?' ours':''}"><td class="pk">${o?`<button class="btn sm" data-plopen="${esc(o.fn)}" title="فتح في الموقف العام">اضبارة ${esc(o.fn)}</button>`:''}</td>
    <td><div class="pn">${esc(c.name)}</div><div class="co">${esc(c.company||'')}${c.contractNo?' — عقد '+esc(c.contractNo):''}${c.contractDate?' / '+esc(dmy(c.contractDate)):''}${c.resident?' — المقيم: '+esc(c.resident):''}</div></td>
    <td>${esc(c.fund||'')}</td><td>${esc(c.directorate||'')}</td><td>${esc(String(c.district||'').trim())}</td><td><span class="chip" style="background:${STC[stK(c.status)]}22;color:${STC[stK(c.status)]}">${esc(c.status||'—')}</span></td>
    <td class="n">${has(c.actPct)?num(c.actPct)+'%':''}</td><td class="n">${FV&&has(c.contractAfter||c.contract)?money(c.contractAfter||c.contract):FV?'':'🔒'}</td><td class="n">${FV&&has(c.spent)?money(c.spent):FV?'':'🔒'}</td></tr>`;};
  return `<div class="tw"><table class="pltab"><thead><tr><th></th><th>المشروع التخطيطي / المكوّن</th><th>التمويل</th><th>الجهة المستفيدة</th><th>القضاء</th><th>الحالة</th><th>الإنجاز الفني</th><th>مبلغ العقد</th><th>المصروف</th></tr></thead><tbody>
    ${shown.map(({p,comps})=>{const op=ui.open.has(p.key)||!!ui.q||ui.ours;const nOurs=p.comps.filter(k=>mm.byComp[k]).length;
      return `<tr class="plp" data-plk="${esc(p.key)}"><td class="pk">${comps.length?(op?'▾':'▸'):''}</td><td colspan="2"><b>${esc(p.name)}</b><div class="co">${codeOf(p)?'الترميز '+esc(codeOf(p))+' — ':''}${esc(p.ministry||'')}${p.plan?' — '+esc(p.plan):''} — ${p.comps.length} مكوّن${nOurs?` — <b style="color:#2563a8">${nOurs} من لجاننا</b>`:''}</div></td>
        <td colspan="3"></td><td class="n">${has(p.actPct)?num(p.actPct)+'%':''}</td><td class="n">${FV&&has(p.cost)?'<span title="الكلفة التخمينية">'+money(p.cost)+'</span>':''}</td><td class="n">${FV&&has(p.spent)?money(p.spent):''}</td></tr>${op?comps.map(comp).join(''):''}`;}).join('')}</tbody></table></div>
    ${L.length>shown.length?`<div style="text-align:center;margin:8px"><button class="btn" data-plmore="1">عرض المزيد (${L.length-shown.length})</button></div>`:''}`;}
function render(){
  const pg=$('pg-pl');if(!pg||pg.hidden)return;const m=model();
  $('plState').innerHTML=!window.desktop||!window.desktop.plan?'غير متاح في هذه النسخة':m?`${m.clean?'«الملف المنظَّم»: ':'الملف: '}<b>${esc(R.file)}</b> — استُورد ${esc(dmy(String(R.importedAt||'').slice(0,10)))}${R.by?' بواسطة '+esc(R.by):''} — ${m.projects.length} مشروعاً تخطيطياً، ${m.comps.length} مكوّناً${R.hasSource?'':' — <span style="color:#b42318">الملف الأصلي ليس على هذه الحاسبة: سيُطلب عند التصدير</span>'}`:'لم يُستورد ملف التخطيط بعد. اضغط «📥 استيراد ملف التخطيط».';
  $('plExp').disabled=!m;
  if(!m){$('plKpis').innerHTML='';$('plCharts').innerHTML='';$('plTree').innerHTML='';return;}
  $('plKpis').innerHTML=kpis();$('plCharts').innerHTML=charts();
  const vals=f=>[...new Set(m.comps.map(f).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ar'));
  opts('plPlan',vals(c=>c.fund),'كل أنواع التمويل',ui.plan);opts('plDist',vals(c=>String(c.district||'').trim()),'كل الأقضية',ui.dist);opts('plMin',vals(c=>c.ministry),'كل الوزارات',ui.min);
  $('plTree').innerHTML=tree();}
async function doImport(){const r=await window.desktop.plan.import();if(!r)return;if(r.error){alert(r.error);return;}await load();render();
  const mm=matchAll();if(window.flash)window.flash(`استُورد ${r.clean?'«الملف المنظَّم»':'ملف التخطيط'}: ${r.projects} مشروعاً تخطيطياً، ${r.comps} مكوّناً — ${mm?Object.keys(mm.byFn).length:0} مشروعاً من الموقف ارتبط به${r.clean&&!r.hasOriginal?' (لتصدير ملف التخطيط الأصلي محدَّثاً سيُطلب منك الملف الأصلي مرة واحدة)':''}`);try{window.SitRender&&window.SitRender();}catch(_){}}
/* حقول التحديث لكل مكوّن من مشاريعنا (من الموقف العام وملخصات الأنظمة) */
const stMain={ok:'منجز',bad:'متوقف',warn2:'متلكئ',blue:'مستمر'},stS2={ok:'العمل منجز',bad:'متوقف',warn2:'متلكئ',blue:'مستمر'};
function updates(){const m=model(),mm=matchAll();if(!m||!mm)return [];const S=AnbarReg.state(),today=new Date().toISOString().slice(0,10);
  const out=[];Object.entries(mm.byFn).forEach(([fn,h])=>{const p=S.projects.find(x=>String(x.fileNo)===fn);if(!p)return;const L=S.links[fn]||{},c=h.c,set={};
    const put=(k,v)=>{if(v===''||v==null||(typeof v==='number'&&!isFinite(v)))return;set[k]=v;};
    const nn=v=>has(v)?num(v):null,iso=v=>{const t=String(v||'').trim();let x=t.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);if(x)return `${x[1]}-${String(x[2]).padStart(2,'0')}-${String(x[3]).padStart(2,'0')}`;x=t.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);return x?`${x[3]}-${String(x[2]).padStart(2,'0')}-${String(x[1]).padStart(2,'0')}`:'';};
    const k=(()=>{const s=String(p.status||'');if(/منجز/.test(s)&&!/غير منجز/.test(s))return 'ok';if(/متوقف|توقف|سحب/.test(s))return 'bad';if(/متلك/.test(s))return 'warn2';return s?'blue':'';})();
    put('contractNo',String(p.contractNo||'').trim());put('start',iso(p.start));
    {const rs=String(p.resident||'').trim();if(rs.split(/\s+/).length>=2&&!/مديري|دائر|قسم|بلدي|طرق|جسور|الانبار|محافظ|وزار|شعب|هيئ|شرك/.test(rs))put('resident',rs);}
    {const ph=String(p.phone||'').replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/\D/g,'');if(/^0?7\d{9}$/.test(ph))put('phone',ph.replace(/^0/,''));}put('company',String(p.contractor||'').trim());
    put('dur',num(p.dur)>0?num(p.dur):null);put('advRaised',num(p.advRaised)>0?num(p.advRaised):null);put('advPaid',num(p.advPaid)>0?num(p.advPaid):null);put('ext',num(p.extra)>0?num(p.extra):null);put('planPct',nn(p.planPct));put('actPct',nn(p.actualPct));put('district',String(p.district||'').trim());
    if(k)put('status',(c.kind==='s2'?stS2:stMain)[k]);
    const la=num(p.lat),ln=num(p.lng);if(la>29&&la<38&&ln>38&&ln<49){if(c.kind==='s2'){put('lat',la);put('lng',ln);}else put('coords',`N${la} E${ln}`);}
    if(L.co&&has(L.co.orders))put('coCount',num(L.co.orders));
    if(c.kind==='s2'&&has(p.total))put('contractAfter',num(p.total));
    if(c.kind==='main')put('updated',today);
    out.push({sheet:c.sheet,row:c.row,label:`${c.name} (اضبارة ${fn})`,set});});
  return out;}
/* مشاريع الموقف غير المرتبطة بملف التخطيط: السبب وأقرب مكوّن، وتوزيعها حسب نوع التمويل في الموقف */
function gaps(){const mm=matchAll();if(!mm)return null;const S=AnbarReg.state();
  const L=S.projects.filter(p=>!mm.byFn[String(p.fileNo)]).map(p=>{const fn=String(p.fileNo),w=mm.why[fn]||{k:'none'};let near=null;
    if(w.k==='none'){const nt=toks(p.name),ct=toks(p.contractor);let best=0;mm.C.forEach(x=>{const s=jac(nt,x.nt)+jac(ct,x.ct)*0.5;if(s>best){best=s;near=x.c;}});if(best<0.2)near=null;}
    return {p,fn,w,near};});
  const fund=p=>(window.AnbarReg&&AnbarReg.fundCanon?AnbarReg.fundCanon(p.fund||''):p.fund)||'غير محدد';const by={};
  S.projects.forEach(p=>{const f=fund(p),o=by[f]=by[f]||{n:0,ok:0};o.n++;if(mm.byFn[String(p.fileNo)])o.ok++;});
  return {L,by,fund};}
function gapsDlg(){const g=gaps();if(!g)return;const old=document.getElementById('plGapOv');if(old)old.remove();
  const cn=c=>c?`«${esc(c.name)}» <span class="co">(${esc(c.sheet)}، الصف ${c.row}${c.contractNo?'، عقد '+esc(c.contractNo):''}${c.company?'، '+esc(c.company):''})</span>`:'';
  const why=x=>x.w.k==='tie'?`يشبه مكوّنين بالدرجة نفسها فلم يُختر أحدهما: ${cn(x.w.a)} و${cn(x.w.b)}`:x.w.k==='taken'?`أقرب مكوّن ${cn(x.w.a)} مرتبط باضبارة أخرى أقرب إليه (${esc(x.w.by)}) — قد يكون المشروعان مكرّرين في الموقف أو مكوّنين لعقد واحد`
    :`لا يوجد في ملف التخطيط رقم العقد نفسه ولا اسم مشابه${x.near?` — أقرب اسم: ${cn(x.near)}`:' — غالباً غير مدرج في ملف التخطيط (مثل مشاريع لا تموّلها الخطة)'}`;
  const F=Object.keys(g.by).sort((a,b)=>(g.by[b].n-g.by[b].ok)-(g.by[a].n-g.by[a].ok)||g.by[b].n-g.by[a].n);
  const ov=document.createElement('div');ov.className='ov';ov.id='plGapOv';
  ov.innerHTML=`<div class="dlg" style="max-width:900px;max-height:86vh;overflow:auto"><h3>مشاريع الموقف غير المرتبطة بملف التخطيط (${g.L.length})</h3>
   <p class="hint">الربط تلقائي: رقم العقد مع الشركة أو الاسم، ثم تشابه اسم المشروع والشركة. المشروع الذي لا يُربط يبقى بنوع تمويله وجهته من موقف اللجنة.</p>
   <h4>حسب نوع التمويل في موقف اللجان</h4><table><thead><tr><th>نوع التمويل</th><th>في الموقف</th><th>مرتبط بالتخطيط</th><th>غير مرتبط</th></tr></thead><tbody>${F.map(f=>{const o=g.by[f];return `<tr><td>${esc(f)}</td><td class="n">${o.n}</td><td class="n">${o.ok}</td><td class="n"${o.n>o.ok?' style="color:#b33;font-weight:700"':''}>${o.n-o.ok}</td></tr>`;}).join('')}</tbody></table>
   <h4>المشاريع وسبب عدم الربط</h4><table><thead><tr><th>الاضبارة</th><th>المشروع</th><th>العقد / الشركة</th><th>التمويل</th><th>السبب</th></tr></thead><tbody>${g.L.map(x=>`<tr><td><button class="btn sm" data-plopen="${esc(x.fn)}">${esc(x.fn)}</button></td><td>${esc(x.p.name)}</td><td>${esc(x.p.contractNo||'—')}<div class="co">${esc(x.p.contractor||'')}</div></td><td>${esc(g.fund(x.p))}</td><td style="font-size:12.5px">${why(x)}</td></tr>`).join('')||'<tr><td colspan="5">كل مشاريع الموقف مرتبطة</td></tr>'}</tbody></table>
   <p class="hint">للعلاج: صحّح رقم العقد أو اسم المشروع/الشركة في موقف اللجنة أو في ملف التخطيط ثم أعد الاستيراد؛ والمشاريع غير المدرجة في الخطة تبقى خارجها.</p>
   <div style="text-align:left"><button class="btn" data-plgx="1">إغلاق</button></div></div>`;
  document.body.appendChild(ov);ov.addEventListener('click',e=>{if(e.target===ov||e.target.closest('[data-plgx]'))ov.remove();else if(e.target.closest('[data-plopen]'))ov.remove();});}
/* نافذة التصدير: لوحتا المعلومات + توقيع القسم + القفل بكلمة سر المدير */
function exportDlg(n,mode){return new Promise(res=>{const ov=document.createElement('div');ov.className='ov';ov.id='plExpOv';
  ov.innerHTML=`<div class="dlg" style="max-width:520px"><h3>${mode==='clean'?'🧹 ملف التخطيط المنظَّم':'⬇ تصدير ملف التخطيط المحدَّث'}</h3>
   ${mode==='clean'?`<p>ملف Excel جديد مبني من ملف التخطيط بعد قراءته (الأصل لا يُمس): «الملخص»، «المشاريع والمكوّنات» (المشروع ثم مكوّناته، والأعمدة في مجموعات: التعريف، العقد، المالية، المدد، الإنجاز، الكادر والموقع)، «المنافذ وإعادة الاستقرار»، «ملاحظات جودة البيانات» بأرقام صفوف الأصل، و«دليل التوحيد».</p>
   <p>الحالة من قائمة موحّدة، و«استحداث / مكوّن مقسم / مدمج» في عمود «الاستحداث والمكونات المقسمة»، ونسبة إنجاز المشروع = معدل نسب مكوّناته.</p>
   <input type="checkbox" id="plxDash" checked hidden>
   <label style="display:block;margin:8px 0"><input type="checkbox" id="plxLock" checked> قفل الملف (قراءة وتصفية فقط) وتوقيع «إعداد قسم الشؤون الهندسية — ديوان محافظة الانبار»</label>`:`<p>${n?`تُحدَّث خلايا <b>${n}</b> مكوّناً من مشاريعنا (ملوّنة بالأصفر) مع ورقة «التغييرات».`:'لا توجد مشاريع من الموقف مرتبطة بملف التخطيط: يُصدَّر الملف كما هو مع اللوحتين.'}</p>
   <label style="display:block;margin:8px 0"><input type="checkbox" id="plxDash" checked> إضافة لوحتي المعلومات التفاعليتين: «لوحة الخطة» و«لوحة المنافذ وإعادة الاستقرار» (مرتبطتان بالجدول الأصلي)</label>
   <label style="display:block;margin:8px 0"><input type="checkbox" id="plxLock" checked> قفل لوحتي المعلومات فقط بكلمة سر المدير — جداول التخطيط الأصلية وبياناتها غير مقفلة (التوقيع «إعداد قسم الشؤون الهندسية — ديوان محافظة الانبار» يبقى في صف العنوان)</label>`}
   <label class="ml" id="plxPwL">كلمة سر المدير (تصبح كلمة سر فك القفل في Excel)<input id="plxPw" type="password" autocomplete="off"></label>
   <p id="plxErr" style="color:#b00020;min-height:1.2em"></p>
   <div class="row" style="display:flex;gap:8px;justify-content:flex-end"><button class="btn" data-plx="no">إلغاء</button><button class="btn pri" data-plx="ok">تصدير</button></div></div>`;
  document.body.appendChild(ov);const q=id=>ov.querySelector('#'+id);
  const sync=()=>{const d=q('plxDash').checked;q('plxLock').disabled=!d;q('plxPwL').hidden=!(d&&q('plxLock').checked);};q('plxDash').onchange=sync;q('plxLock').onchange=sync;sync();
  const done=v=>{ov.remove();res(v);};
  ov.addEventListener('click',e=>{const b=e.target.closest('[data-plx]');if(!b)return;if(b.dataset.plx==='no')return done(null);
    const dash=q('plxDash').checked,lock=dash&&q('plxLock').checked,pw=q('plxPw').value;if(lock&&!pw){q('plxErr').textContent='اكتب كلمة سر المدير للقفل، أو ألغِ خيار القفل';return;}
    done({dash,pw:lock?pw:''});});
  setTimeout(()=>{try{q('plxPw').focus();}catch(_){}},50);});}
async function doClean(){let o=await exportDlg(0,'clean');if(!o)return;let r=await window.desktop.plan.clean(o);
  while(r&&r.error&&/كلمة سر المدير|محاولات/.test(r.error)){alert(r.error);o=await exportDlg(0,'clean');if(!o)return;r=await window.desktop.plan.clean(o);}
  if(!r)return;if(r.error){alert(r.error);return;}
  if(window.flash)window.flash(`حُفظ ملف التخطيط المنظَّم: ${r.stats.comps} مكوّناً، ${r.stats.issues} ملاحظة جودة بيانات`);
  try{if(window.desktop.showFile&&confirm(`حُفظ الملف:\n${r.file}\n\n${r.stats.comps} مكوّناً مرتبة تحت مشاريعها، و${r.stats.issues} ملاحظة في ورقة «ملاحظات جودة البيانات»${r.locked?' (الملف مقفل بكلمة سر المدير)':''}.\n\nفتح مجلد الملف؟`))window.desktop.showFile(r.file);}catch(_){}}
async function doExport(){const u=updates();
  let o=await exportDlg(u.length);if(!o)return;
  let r=await window.desktop.plan.export(u,o);
  while(r&&r.error&&/كلمة سر المدير|محاولات/.test(r.error)){alert(r.error);o=await exportDlg(u.length);if(!o)return;r=await window.desktop.plan.export(u,o);}
  if(!r)return;if(r.error){alert(r.error);return;}
  if(window.flash)window.flash(`حُفظ ملف التخطيط المحدَّث: ${r.changed} خلية في ${r.rows} مكوّناً${r.skipped?` — ${r.skipped} خلية معادلة (رابط) لم تُمس`:''}`);
  try{if(window.desktop.showFile&&confirm(`حُفظ الملف:\n${r.file}\n\n${r.changed} خلية حُدّثت (ملوّنة بالأصفر) في ${r.rows} مكوّناً، وورقة «التغييرات» فيها القديم والجديد.${r.dash&&r.dash.added&&r.dash.added.length?`\nأُضيفت: ${r.dash.added.join(' و')}${r.dash.locked?' (مقفلة بكلمة سر المدير)':''}.`:''}\n\nفتح مجلد الملف؟`))window.desktop.showFile(r.file);}catch(_){}}

/* الأحداث */
document.addEventListener('click',e=>{const pg=$('pg-pl');if(!pg||pg.hidden)return;
  const p=e.target.closest('[data-plk]');if(p&&!e.target.closest('button')){const k=p.dataset.plk;ui.open.has(k)?ui.open.delete(k):ui.open.add(k);$('plTree').innerHTML=tree();return;}
  const o=e.target.closest('[data-plopen]');if(o){window.desktop.go('sit').then(()=>setTimeout(()=>{try{window.SitOpen&&window.SitOpen(o.dataset.plopen);}catch(_){}},250));return;}
  if(e.target.closest('[data-plmore]')){ui.limit+=150;$('plTree').innerHTML=tree();}
  if(e.target.closest('[data-plgaps]')){e.preventDefault();gapsDlg();}});
function wire(){if(!$('plImp'))return;$('plImp').onclick=doImport;$('plExp').onclick=doExport;if($('plClean'))$('plClean').onclick=doClean;
  $('plQ').addEventListener('input',()=>{ui.q=$('plQ').value;ui.limit=150;$('plTree').innerHTML=tree();});
  [['plPlan','plan'],['plSt','st'],['plDist','dist'],['plMin','min']].forEach(([id,k])=>$(id).addEventListener('change',()=>{ui[k]=$(id).value;ui.limit=150;$('plTree').innerHTML=tree();}));
  $('plOurs').addEventListener('change',()=>{ui.ours=$('plOurs').checked;ui.limit=150;$('plTree').innerHTML=tree();});
  $('plSt').innerHTML='<option value="">كل الحالات</option>'+Object.keys(STL).map(k=>`<option value="${k}">${STL[k]}</option>`).join('');}
wire();
const prev=window.onNav;window.onNav=function(s){try{if(prev)prev.apply(this,arguments);}finally{const pg=$('pg-pl');if(pg){pg.hidden=s.current!=='pl';if(s.current==='pl')load().then(render);}}};
try{window.desktop&&window.desktop.onSyncData&&window.desktop.onSyncData(s=>{if(s&&s.ds==='pl')load().then(()=>{render();try{window.SitRender&&window.SitRender();}catch(_){} });});}catch(_){}
window.PlanLink={load,apply,section,matchAll,updates,model,render,gaps,data:()=>R};
load().then(()=>{try{window.SitRender&&window.SitRender();}catch(_){}});
})();
