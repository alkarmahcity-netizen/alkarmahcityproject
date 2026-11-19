/* ربط «الموقف العام» ببرنامج الشؤون المالية (قراءة فقط):
   مطابقة المشاريع (رقم العقد وسنته، ثم الاسم والشركة)، وقسم «💰 من برنامج الشؤون المالية» في بطاقة المشروع (السلف بمراحلها ودفعاتها
   وأرقام الصكوك، وخطابات الضمان، والقرض القائم)، وتنبيهات الفروق (تُضاف إلى «⚠ خلل بين الموقف والأنظمة»)، ونافذة «💰 ربط المالية». */
(function(){
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=v=>{const n=parseFloat(String(v==null?'':v).replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/,/g,''));return isFinite(n)?n:0;};
const money=v=>Math.round(num(v)).toLocaleString('en-US');
const today=()=>new Date().toISOString().slice(0,10);
const days=(a,b)=>Math.round((Date.parse(b)-Date.parse(a))/864e5);
const PENDING_DAYS=30,GU_DAYS=30;
let fxMsg='',D=null,loading=null,lastAt=0,M=null,mKey='';
const T=s=>String(s==null?'':s).replace(/[ً-ْـ]/g,'').replace(/[إأآٱ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/ؤ/g,'و').replace(/ئ/g,'ي')
  .replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d)).toLowerCase().replace(/[^ء-ي0-9a-z]+/g,' ').trim();
const STOP=new Set(['مشروع','شركه','للمقاولات','المقاولات','العامه','العامة','المحدوده','المحدودة','والتجاره','التجاره','العراقيه','في','من','الى','مع','و','قضاء','ناحيه','محافظه','الانبار']);
const toks=s=>new Set(T(s).split(' ').map(w=>w.replace(/^ال(?=..)/,'')).filter(w=>w.length>1&&!STOP.has(w)&&!STOP.has('ال'+w)));
const jac=(A,B)=>{if(!A.size||!B.size)return 0;let n=0;A.forEach(x=>{if(B.has(x))n++;});return n/(A.size+B.size-n);};
const dig=s=>String(s==null?'':s).replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/\D/g,'').replace(/^0+/,'');
const yr=s=>{const m=String(s||'').match(/(19|20)\d\d/);return m?m[0]:'';};

async function load(force){
  if(!window.desktop||!window.desktop.finx)return D;
  if(!force&&D&&Date.now()-lastAt<60000)return D;
  if(loading)return loading;
  loading=window.desktop.finx.get().then(r=>{const first=!D||(!D.ok&&r.ok)||(D.mtime!==r.mtime);D=r;lastAt=Date.now();M=null;if(first&&r.ok)setTimeout(()=>{try{window.SitRender&&window.SitRender();window.SitDrawerRefresh&&window.SitDrawerRefresh();}catch(_){}},0);return D;}).catch(e=>{D={ok:false,error:String(e&&e.message||e),links:{}};return D;}).finally(()=>{loading=null;});
  return loading;}

/* المطابقة: تُعاد فقط إذا تغيّر ملف المالية أو الموقف أو الربط اليدوي */
function matchAll(){
  if(!D||!D.ok||!window.AnbarReg)return null;
  const S=AnbarReg.state(),key=[D.mtime,S.projects.length,S.updated||'',JSON.stringify(D.links||{})].join('|');
  if(M&&mKey===key)return M;
  const F=D.P.map(f=>({f,nt:toks(f.nm),ct:toks(f.co),cn:dig(f.cno),y:yr(f.cdt)})),byId=new Map(F.map(x=>[x.f.id,x])),byC=new Map(),inv=new Map();
  F.forEach(x=>{if(x.cn)(byC.get(x.cn)||byC.set(x.cn,[]).get(x.cn)).push(x);x.nt.forEach(t=>(inv.get(t)||inv.set(t,[]).get(t)).push(x));});
  const out={},links=D.links||{},used={};
  S.projects.forEach(p=>{const fn=String(p.fileNo);
    if(fn in links){const id=links[fn];out[fn]=id&&byId.has(id)?{f:byId.get(id).f,how:'ربط يدوي',score:9}:{f:null,how:'لا يوجد مقابل (يدوي)',manual:true};return;}
    const nt=toks(p.name),ct=toks(p.contractor),cn=dig(p.contractNo),y=yr(p.year)||yr(p.start);const cand=[];
    if(cn)(byC.get(cn)||[]).forEach(x=>{if(y&&x.y&&y!==x.y&&Math.abs(+y-+x.y)>1)return;const cs=jac(ct,x.ct),ns=jac(nt,x.nt);if(cs>=0.3||ns>=0.4)cand.push({x,s:3+cs+ns,how:'رقم العقد'+(x.y&&y?' وسنته':'')+(cs>=0.3?' والشركة':' واسم المشروع')});});
    if(!cand.length&&nt.size){const seen=new Map();nt.forEach(t=>{(inv.get(t)||[]).forEach(x=>seen.set(x,(seen.get(x)||0)+1));});
      seen.forEach((c,x)=>{if(c<2&&nt.size>2)return;const ns=jac(nt,x.nt),cs=jac(ct,x.ct);if(T(p.name)===T(x.f.nm))cand.push({x,s:2.5+cs,how:'اسم المشروع'+(cs>=0.3?' والشركة':'')});else if(ns>=0.6&&(cs>=0.3||!ct.size||!x.ct.size))cand.push({x,s:1+ns+cs*0.5,how:'تشابه اسم المشروع'+(cs>=0.3?' والشركة':'')});});}
    cand.sort((a,b)=>b.s-a.s);
    if(!cand.length){out[fn]={f:null,how:'لم يُعثر على مقابل'};return;}
    if(cand[1]&&cand[1].x!==cand[0].x&&cand[0].s-cand[1].s<0.05){out[fn]={f:null,how:'أكثر من مقابل محتمل — اربطه يدوياً',alts:cand.slice(0,4).map(c=>c.x.f)};return;}
    out[fn]={f:cand[0].x.f,how:cand[0].how,score:cand[0].s};used[cand[0].x.f.id]=(used[cand[0].x.f.id]||0)+1;});
  /* مشروع مالية واحد طابق تلقائياً أكثر من اضبارة: لا يُعتمد إلا الأعلى تطابقاً */
  Object.keys(used).filter(id=>used[id]>1).forEach(id=>{const L=Object.entries(out).filter(([,m])=>m.f&&m.f.id===id&&m.how!=='ربط يدوي').sort((a,b)=>b[1].score-a[1].score);L.slice(1).forEach(([fn,m])=>{out[fn]={f:null,how:'مشروع المالية نفسه طابق اضبارة أخرى — اربطه يدوياً',alts:[m.f]};});});
  M=out;mKey=key;return M;}
const of=fn=>{const m=matchAll();return m&&m[String(fn)]||null;};

/* تنبيهات الفروق مع المالية (تظهر مع «خلل بين الموقف والأنظمة») */
function issues(p,L){const m=of(p.fileNo);if(!m||!m.f)return [];const f=m.f,I=[],tol=Math.max(1000,num(f.c)*0.001),t=today();
  f.advs.filter(a=>/^(audited|ready|partial)$/.test(a.stage)&&a.since&&days(a.since,t)>PENDING_DAYS).forEach(a=>I.push(['fin',`المالية: السلفة ${a.final?'النهائية':a.no||''} «${a.stageT}» منذ ${days(a.since,t)} يوماً ولم تُصرف كاملة (المتبقي ${money(a.gross-a.paid)} دينار)`]));
  if(L&&L.ad&&num(L.ad.cumulative)>0&&num(f.sp)>num(L.ad.cumulative)+tol)I.push(['fin',`المصروف الكلي في المالية ${money(f.sp)} أكبر من التراكمي المدقق في لجنة السلف ${money(L.ad.cumulative)}`]);
  const nf=f.advs.filter(a=>!a.legacy&&a.stage!=='rejected'&&!a.final).length,na=L&&L.ad?num(L.ad.count):0;if(nf>na)I.push(['fin',`في المالية ${nf} سلفة مسجلة، وفي لجنة تدقيق السلف ${na} فقط`]);
  const rate=num(f.c)>0?num(f.sp)/num(f.c)*100:null;if(rate!=null&&p.actualPct!==''&&p.actualPct!=null&&rate>num(p.actualPct)+10)I.push(['fin',`نسبة الصرف في المالية ${rate.toFixed(1)}% أعلى من الإنجاز الفعلي ${num(p.actualPct)}%`]);
  f.gs.filter(g=>g.st==='active'&&g.exp).forEach(g=>{const d=days(t,g.exp);if(d<0)I.push(['fin',`خطاب الضمان ${g.no} (${g.kind}) منتهٍ منذ ${-d} يوماً ولم يُمدد`]);else if(d<=GU_DAYS)I.push(['fin',`خطاب الضمان ${g.no} (${g.kind}) ينتهي خلال ${d} يوماً (${g.exp})`]);});
  return I;}

/* قسم بطاقة المشروع */
function section(p,L){
  if(!window.desktop||!window.desktop.finx)return '';
  const h='<h5>💰 من برنامج الشؤون المالية</h5>';
  if(!D){load().then(()=>{if(window.SitTable)try{window.SitDrawerRefresh&&window.SitDrawerRefresh();}catch(_){}});return h+'<div class="hint">جارٍ قراءة بيانات المالية…</div>';}
  if(!D.ok)return h+`<div class="hint">${esc(D.error||'لم تُقرأ بيانات المالية')} <button class="btn sm" data-finx="dlg">💰 ربط المالية</button></div>`;
  const m=of(p.fileNo);
  if(!m||!m.f)return h+`<div class="hint">${esc(m?m.how:'لم يُعثر على مقابل')} <button class="btn sm" data-finx="pick" data-fn="${esc(p.fileNo)}">ربط بمشروع في المالية</button></div>`;
  const f=m.f,rate=num(f.c)>0?num(f.sp)/num(f.c)*100:null,d=(l,v)=>`<div><small>${l}</small><b>${v}</b></div>`;
  const A=f.advs.filter(a=>a.stage!=='rejected');
  const advT=A.length?`<div class="dtw"><table class="dtb"><thead><tr><th>السلفة</th><th>المبلغ</th><th>الاستقطاعات</th><th>المرحلة</th><th>المصروف</th><th>دفعات الصرف (التاريخ — رقم الصك — المبلغ)</th></tr></thead><tbody>${A.map(a=>`<tr style="cursor:default"><td>${esc(a.no)}${a.legacy?' <span class="co">رصيد Excel</span>':''}</td><td class="n">${money(a.gross)}</td><td class="n">${money(a.ded)}</td><td>${esc(a.stageT)}</td><td class="n">${money(a.paid)}</td><td>${a.pays.length?a.pays.map(q=>`<span dir="ltr">${esc(window.DMY?window.DMY(q.date):String(q.date||''))}</span> — ${esc(q.ref||'بلا رقم')} — ${money(q.amt)}${q.loan?' (للمصرف المقرض)':''}`).join('<br>'):'—'}</td></tr>`).join('')}</tbody>
    <tfoot><tr><td><b>المجموع</b></td><td class="n"><b>${money(A.reduce((s,a)=>s+a.gross,0))}</b></td><td></td><td></td><td class="n"><b>${money(A.reduce((s,a)=>s+a.paid,0))}</b></td><td></td></tr></tfoot></table></div>`:'<div class="hint">لا سلف مسجلة لهذا المشروع في برنامج المالية.</div>';
  const guT=f.gs.length?`<div class="dtw"><table class="dtb"><thead><tr><th>خطاب الضمان</th><th>النوع</th><th>المصرف</th><th>المبلغ</th><th>نافذ حتى</th><th>الحالة</th></tr></thead><tbody>${f.gs.map(g=>`<tr style="cursor:default"><td>${esc(g.no)}</td><td>${esc(g.kind)}</td><td>${esc(g.bank)}</td><td class="n">${money(g.amt)}</td><td dir="ltr">${esc(window.DMY?window.DMY(g.exp):String(g.exp||''))}</td><td>${esc({active:'نافذ',released:'أُعيد للشركة',seized:'مُصادَر'}[g.st]||g.st)}</td></tr>`).join('')}</tbody></table></div>`:'';
  const I=issues(p,L);
  return h+`<div class="hint">مطابق لـ«${esc(f.nm)}» — ${esc(f.co||'')}${f.cno?' — عقد '+esc(f.cno):''} <span class="co">(${esc(m.how)})</span> <button class="btn sm" data-finx="pick" data-fn="${esc(p.fileNo)}">تغيير الربط</button></div>
    <div class="dg">${d('مبلغ العقد (المالية)',money(f.c))}${d('المصروف الكلي (المالية)',money(f.sp))}${d('نسبة الصرف',rate==null?'—':rate.toFixed(1)+'%')}${d('رصيد سلف غير مصروف (Excel)',money(f.legacyLeft))}${f.loanOut?d('قرض مصرفي قائم بضمان السلف',money(f.loanOut)):''}${d('الحالة في المالية',esc(f.st||'—'))}</div>
    ${advT}${guT}${I.length?`<div class="hint">فروق المالية مذكورة في «⚠ خلل بين الموقف والأنظمة» أعلى البطاقة (${I.length}).</div>`:''}`;}

/* بطاقة لوحة المشاريع: المصروف في المالية للمشاريع المعروضة */
function kpi(R){if(!D||!D.ok)return null;let sp=0,n=0,adv=0,pend=0;R.forEach(r=>{const m=of(r.p.fileNo);if(m&&m.f){n++;sp+=num(m.f.sp);m.f.advs.forEach(a=>{if(a.stage!=='rejected'){adv+=a.paid;if(/^(audited|ready|partial)$/.test(a.stage))pend+=a.gross-a.paid;}});}});return {sp,n,adv,pend,total:R.length};}

/* نافذة «💰 ربط المالية»: الحالة، والملف، والمطابقة، والربط اليدوي */
function dlg(focusFn){
  let ov=document.getElementById('finxDlg');if(ov)ov.remove();ov=document.createElement('div');ov.id='finxDlg';ov.className='finx-ov';document.body.appendChild(ov);
  const draw=()=>{const m=matchAll()||{},S=window.AnbarReg?AnbarReg.state():{projects:[]},P=S.projects;
    const ok=P.filter(p=>m[String(p.fileNo)]&&m[String(p.fileNo)].f),un=P.filter(p=>!(m[String(p.fileNo)]&&m[String(p.fileNo)].f));
    const list=(focusFn?P.filter(p=>String(p.fileNo)===String(focusFn)):un).slice(0,200);
    ov.innerHTML=`<div class="finx-box" role="dialog" aria-label="ربط برنامج الشؤون المالية"><h3>💰 ربط برنامج الشؤون المالية (قراءة فقط)</h3>
      ${D&&D.ok?`<p>الملف: <span dir="ltr" class="mono">${esc(D.file)}</span>${D.backup?'<br><b style="color:#b06d00">⚠ هذه نسخة احتياطية من بيانات المالية (لقطة بتاريخها): لا تظهر فيها السلف والدفعات اللاحقة. اربط ملف البيانات الحي (anbar-data.json) متى توفّر.</b>':''}<br>آخر تعديل في المالية: ${esc(new Date(D.mtime).toLocaleString('ar-IQ'))} — ${D.counts.projects} مشروع، ${D.counts.advances} سلفة، ${D.counts.guarantees} خطاب ضمان.</p>
        <p><b>${ok.length}</b> مشروع من الموقف مرتبط بالمالية، و<b>${un.length}</b> بلا مقابل.</p>`
        :`<p class="bad">${esc(D&&D.error||'لم تُقرأ بيانات المالية بعد')}</p>${D&&D.tried?`<p class="hint">بحثت في: ${D.tried.map(t=>`<span dir="ltr" class="mono">${esc(t)}</span>`).join('، ')}</p>`:''}`}
      <div class="row" style="margin:6px 0"><button class="btn pri" data-fx="xl" title="ملف Excel يُصدره برنامج الشؤون المالية (فيه اسم المشروع والسلف المرفوعة/المصروفة أو مجموع المصروف الكلي): يصحح السلف في الموقف العام وتقارير اللجان بعد معاينة">📥 استيراد ملف Excel من المالية (تصحيح السلف)</button>${window.FinXl&&window.FinXl.count()?`<button class="btn" data-fx="xlclear">إزالة تصحيح المالية (${window.FinXl.count()} مشروعاً)</button>`:''}</div>
      <div class="row"><button class="btn pri" data-fx="search" title="يبحث في مجلدات المستخدم والأقراص والمجلدات المشتركة المربوطة عن ملف anbar-data.json لبرنامج المالية، ويربطه ويتابع تغيّره تلقائياً">🔍 بحث تلقائي عن ملف المالية</button><button class="btn" data-fx="choose">📂 اختيار الملف يدوياً…</button><span class="hint" id="fxProg">${esc(fxMsg)}</span><button class="btn" data-fx="reload">⟳ إعادة القراءة</button></div>
      <p class="hint">برنامج المالية لا يُعدَّل من هنا. الملف عادة في «المستندات\\AnbarFinance\\anbar-data.json» أو في المجلد المشترك الذي اختير في برنامج المالية.</p>
      ${D&&D.ok&&list.length?`<h4>${focusFn?'ربط الاضبارة '+esc(focusFn):'مشاريع بلا مقابل في المالية'} ${focusFn?'':'('+un.length+')'}</h4>
        <input id="fxQ" placeholder="ابحث في مشاريع المالية: الاسم، الشركة، رقم العقد…" autocomplete="off"><div id="fxRes" class="fx-res"></div>
        <div class="fx-list">${list.map(p=>{const x=m[String(p.fileNo)]||{};return `<div class="fx-it${String(p.fileNo)===String(focusFn||'')?' on':''}" data-fn="${esc(p.fileNo)}"><b>${esc(p.fileNo)}</b> ${esc(p.name)} <span class="co">${esc(p.contractor||'')}${p.contractNo?' — عقد '+esc(p.contractNo):''}</span><br><small>${esc(x.how||'')}${x.f?' ← '+esc(x.f.nm):''}</small>
          ${(x.alts||[]).map(a=>`<button class="btn sm" data-fx="link" data-fn="${esc(p.fileNo)}" data-id="${esc(a.id)}">ربط بـ: ${esc(a.nm)} (${esc(a.co||'')})</button>`).join('')}
          <button class="btn sm" data-fx="sel" data-fn="${esc(p.fileNo)}">اختيار من البحث</button><button class="btn sm" data-fx="none" data-fn="${esc(p.fileNo)}">لا يوجد مقابل</button>${x.how==='ربط يدوي'||x.manual?`<button class="btn sm" data-fx="auto" data-fn="${esc(p.fileNo)}">إعادة الربط التلقائي</button>`:''}</div>`;}).join('')}</div>`:''}
      <div class="row"><button class="btn" data-fx="close">إغلاق</button></div></div>`;
    const q=ov.querySelector('#fxQ');if(q)q.addEventListener('input',()=>{const s=toks(q.value),c=dig(q.value);const R=!q.value.trim()?[]:D.P.map(f=>({f,s:(c&&dig(f.cno)===c?2:0)+jac(s,toks(f.nm+' '+f.co))})).filter(x=>x.s>0.15).sort((a,b)=>b.s-a.s).slice(0,12);
      ov.querySelector('#fxRes').innerHTML=R.map(x=>`<label class="fx-r"><input type="radio" name="fxpick" value="${esc(x.f.id)}"> ${esc(x.f.nm)} <span class="co">${esc(x.f.co||'')}${x.f.cno?' — عقد '+esc(x.f.cno):''}${x.f.cdt?' — '+esc(window.DMY?window.DMY(x.f.cdt):x.f.cdt):''}</span></label>`).join('')||'<div class="hint">لا نتائج</div>';});};
  const relink=async(fn,id)=>{await window.desktop.finx.link(fn,id);await load(true);draw();try{window.SitRender&&window.SitRender();window.SitDrawerRefresh&&window.SitDrawerRefresh();}catch(_){} };
  ov.addEventListener('click',async e=>{if(e.target===ov){ov.remove();return;}const b=e.target.closest('[data-fx]');if(!b)return;const a=b.dataset.fx,fn=b.dataset.fn;
    if(a==='xl'){ov.remove();if(window.FinXl)await window.FinXl.pick();return;}if(a==='xlclear'){if(confirm('إزالة تصحيح السلف من ملف المالية والعودة إلى قيم مواقف اللجان؟')){ov.remove();window.FinXl&&window.FinXl.clear();}return;}
    if(a==='close')ov.remove();
    else if(a==='choose'){const f=await window.desktop.finx.choose();if(f){await load(true);draw();try{window.SitRender&&window.SitRender();}catch(_){} }}
    else if(a==='reload'){await load(true);draw();}
    else if(a==='search'){b.disabled=true;const pr=document.getElementById('fxProg');if(pr)pr.textContent='جارٍ البحث…';const r=await window.desktop.finx.search();b.disabled=false;await load(true);draw();
      fxMsg=r.found.length?`عُثر على ${r.found.length} ملف — رُبط ${/anbar-backup|[\\/]backups[\\/]|anbar-data[-_ .].+\.json$/i.test(r.found[0])?'أحدث نسخة احتياطية (لم يُعثر على ملف البيانات الحي)':'ملف البيانات الحي'}: ${r.found[0]}`:`لم يُعثر على ملف المالية بعد فحص ${r.dirs.toLocaleString('en-US')} مجلداً. شغّل برنامج المالية مرة على هذه الحاسبة، أو اختر ملفه من المجلد المشترك يدوياً.`;draw();try{window.SitRender&&window.SitRender();}catch(_){} }
    else if(a==='link')relink(fn,b.dataset.id);
    else if(a==='none')relink(fn,null);
    else if(a==='auto')relink(fn,undefined);
    else if(a==='sel'){const r=ov.querySelector('input[name=fxpick]:checked');if(!r){alert('ابحث عن المشروع في المالية واختره من النتائج أولاً');return;}relink(fn,r.value);}});
  load(true).then(draw);draw();}

document.addEventListener('click',e=>{const b=e.target.closest('[data-finx]');if(!b)return;if(b.dataset.finx==='dlg')dlg();else if(b.dataset.finx==='pick')dlg(b.dataset.fn);});
const css=document.createElement('style');css.textContent=`.finx-ov{position:fixed;inset:0;background:#0008;z-index:9000;display:flex;align-items:center;justify-content:center}
.finx-box{background:var(--card,#fff);color:inherit;border-radius:14px;padding:16px 18px;width:min(860px,94vw);max-height:88vh;overflow:auto;box-shadow:0 20px 60px #0006}
.finx-box h3{margin:0 0 8px}.finx-box .row{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0}.finx-box .mono{font-family:Consolas,monospace;font-size:12px}.finx-box .bad{color:#b42318}
.finx-box input#fxQ{width:100%;padding:8px 10px;border:1px solid #ccd;border-radius:8px;font:inherit;margin:6px 0}.fx-res{max-height:200px;overflow:auto;border:1px dashed #ccd;border-radius:8px;padding:4px 8px;margin-bottom:8px}
.fx-r{display:block;padding:3px 0;cursor:pointer}.fx-list{display:flex;flex-direction:column;gap:6px}.fx-it{border:1px solid #e3e6ee;border-radius:8px;padding:6px 8px}.fx-it.on{border-color:#2563a8;background:#2563a80d}.fx-it .btn{margin:4px 0 0 4px}`;
if(!window.desktop||!window.desktop.finx)css.textContent+='[data-finx]{display:none!important}';
document.head.appendChild(css);
window.FinLink={load,issues,section,kpi,dlg,of,matchAll,data:()=>D};
/* تعديل في برنامج المالية أو عثور تلقائي على ملفه: إعادة القراءة والعرض مباشرة */
try{window.desktop&&window.desktop.onSyncData&&window.desktop.onSyncData(s=>{if(s&&s.ds==='fin')load(true).then(()=>{try{window.SitRender&&window.SitRender();window.SitDrawerRefresh&&window.SitDrawerRefresh();}catch(_){} const d=document.getElementById('finxDlg');if(d)d.querySelector('[data-fx=reload]')&&d.querySelector('[data-fx=reload]').click();});});
  window.desktop&&window.desktop.finx&&window.desktop.finx.onProgress&&window.desktop.finx.onProgress(p=>{const e=document.getElementById('fxProg');if(e)e.textContent=`جارٍ البحث… ${p.n.toLocaleString('en-US')} مجلداً`;});}catch(_){}
load();
})();
