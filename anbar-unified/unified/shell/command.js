/* مركز المتابعة: لوحة قيادة داكنة للأقضية — الخريطة والإنجاز والصرف والقطاعات والإنذارات، من الموقف الشهري والأنظمة المرتبطة به.
   تعمل بلا إنترنت: الخريطة مخطط بإسقاط بسيط لحدود الأنبار التقريبية، والأقضية في الموقع الوسيط لإحداثيات مشاريعها. */
(function(){
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=v=>{const n=parseFloat(String(v==null?'':v).replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[,،\s]/g,''));return isFinite(n)?n:0;};
const has=v=>v!=null&&String(v).trim()!==''&&isFinite(parseFloat(String(v).replace(/[,،\s]/g,'')));
const pctOf=v=>{let n=num(v);if(n>0&&n<=1.0001&&!/%/.test(String(v)))n*=100;return Math.max(0,Math.min(100,n));};
const f0=n=>Math.round(n).toLocaleString('en-US');
const bil=n=>(n/1e9).toLocaleString('en-US',{maximumFractionDigits:n>=1e11?0:1});
const col=v=>v==null?'#6f93ad':v>=70?'#3dffa8':v>=50?'#38e8ff':v>=30?'#ffc23d':'#ff4d6a';
/* حدود محافظة الأنبار (تقريبية، للعرض فقط) ومجرى الفرات — [خط العرض، خط الطول] */
/* حدود العراق ومحافظة الأنبار (تقريبية، للعرض فقط) — [خط العرض، خط الطول] */
const IRQ=[[37.10,42.36],[37.33,42.80],[37.25,43.60],[37.20,44.30],[37.14,44.79],[36.70,45.05],[36.00,45.40],[35.80,46.10],[35.10,46.15],[34.60,45.60],[34.20,45.55],[33.60,45.90],[33.00,46.60],[32.50,47.30],[32.00,47.70],[31.00,47.68],[30.10,47.95],[29.95,48.50],[29.90,48.00],[29.60,47.70],[29.10,46.55],[29.00,44.70],[29.90,43.00],[30.60,42.10],[31.40,41.40],[32.23,39.30],[33.37,38.79],[34.05,40.20],[34.45,40.95],[35.30,41.25],[36.30,41.25],[36.85,42.00]];
const OUT0=[[34.62,41.20],[34.45,40.95],[34.05,40.20],[33.37,38.79],[32.23,39.30],[31.40,41.40],[31.65,42.10],[32.10,42.80],[32.55,43.30],[32.90,43.75],[33.15,44.05],[33.42,44.20],[33.70,44.00],[34.05,43.60],[34.35,43.20],[34.75,42.60],[34.95,42.10],[34.85,41.60]];
/* إن وُجدت بيانات الحدود المستخرجة من خريطة النواحي (anbar-geo.js) تُستعمل بدل الحدود التقريبية أعلاه */
const GEO=window.ANBAR_GEO||null;
const OUT=GEO?GEO.outline:OUT0;
if(GEO&&GEO.iraq&&GEO.iraq.length>10)IRQ.splice(0,IRQ.length,...GEO.iraq);
else if(GEO&&GEO.sw&&GEO.sw.length){const i0=IRQ.findIndex(p=>p[0]===29.90&&p[1]===43.00),i1=IRQ.findIndex(p=>p[0]===34.45&&p[1]===40.95);if(i0>0&&i1>i0)IRQ.splice(i0,i1-i0+1,[29.75,43.60],...GEO.sw);}
const RIV=[[34.45,40.93],[34.37,41.10],[34.40,41.60],[34.47,41.92],[34.37,42.00],[34.14,42.38],[33.92,42.55],[33.64,42.83],[33.48,43.05],[33.42,43.30],[33.40,43.60],[33.35,43.78],[33.30,44.05],[33.31,44.37]];
/* الطرق الرئيسية (تقريبية للعرض): الطريق السريع رقم 1 (بغداد–الرمادي–الرطبة–طريبيل)، فرع الرطبة–الوليد، وطريق الفرات (الرمادي–هيت–حديثة–عنه–القائم) */
const ROADS=[['طريق المرور السريع (1)',[[33.30,44.30],[33.29,44.05],[33.30,43.80],[33.33,43.55],[33.37,43.25],[33.30,42.95],[33.20,42.50],[33.12,42.00],[33.07,41.50],[33.05,40.90],[33.03,40.30],[32.90,39.80],[32.73,39.29]]],
  ['طريق الرطبة – الوليد',[[33.03,40.30],[33.15,39.90],[33.30,39.25],[33.38,38.80]]],
  ['طريق الفرات',[[33.42,43.30],[33.55,43.02],[33.64,42.83],[33.86,42.53],[34.13,42.38],[34.30,42.15],[34.36,41.98],[34.38,41.60],[34.37,41.08],[34.40,40.98]]],
  ['طريق بغداد – الفلوجة',[[33.31,44.30],[33.33,44.00],[33.35,43.78],[33.40,43.55],[33.42,43.30]]]];
/* البحيرات (تقريبية): [الاسم، خط العرض، خط الطول، نصف القطر طولاً، نصف القطر عرضاً، الدوران] */
const LAKES=[['بحيرة الحبانية',33.28,43.47,.10,.07,0],['بحيرة القادسية',34.30,42.18,.18,.045,-38],['بحيرة الثرثار',33.98,43.20,.22,.17,15],['بحيرة الرزازة',32.70,43.75,.17,.10,-10]];
const LABELS=[['سوريا',34.85,39.40],['الأردن',32.05,38.90],['السعودية',31.15,40.30],['العراق',34.55,44.30]];
/* مراكز الأقضية المعروفة: تُستعمل إن لم تكن لمشاريع القضاء إحداثيات */
const KNOWN={'الرمادي':[33.42,43.30],'الفلوجة':[33.35,43.78],'الكرمة':[33.40,43.92],'هيت':[33.64,42.83],'حديثة':[34.14,42.38],'عنه':[34.37,41.99],'عانه':[34.37,41.99],'راوة':[34.47,41.91],'راوه':[34.47,41.91],'القائم':[34.37,41.08],'الرطبة':[33.04,40.28],'الرطبه':[33.04,40.28],'العامرية':[33.12,43.88],'الخالدية':[33.37,43.57],'الصقلاوية':[33.40,43.70],'البغدادي':[33.86,42.53],'الحبانية':[33.37,43.57]};
const normD=s=>String(s||'').replace(/^\s*(قضاء|ناحية|ناحيه)\s+/,'').replace(/[ىي]$/,'ي').replace(/ة$/,'ة').trim();
const W=600,H=430,LAT=GEO?[30.85,35.35]:[31.2,35.15],LNG=GEO?[38.5,44.7]:[38.55,44.85];
const xy=(lat,lng)=>[20+(lng-LNG[0])/(LNG[1]-LNG[0])*(W-40),15+(LAT[1]-lat)/(LAT[1]-LAT[0])*(H-30)];
const pathOf=(pts,close)=>pts.map((p,i)=>(i?'L':'M')+xy(p[0],p[1]).map(v=>v.toFixed(1)).join(',')).join(' ')+(close?' Z':'');
/* القطاع من حقل القطاع/الجهة المستفيدة واسم المشروع */
const SECT=[['التربية',/تربي|مدرس|ثانوي|روض|تعليم|جامع(ة|ه)|كلي/],['الصحة',/صح|مستشف|مستوصف|طب/],['الماء والمجاري',/ماء|مياه|مجاري|صرف صحي|تصريف|مشروع الماء|مجمع ماء|خزان/],['الطرق والجسور',/طريق|طرق|جسر|شارع|تبليط|اكساء|إكساء|مقترب|تقاطع/],['الكهرباء',/كهرب|محطة تحويل|انارة|إنارة|طاقة/],['البلديات والخدمات',/بلدي|حدائق|متنزه|سوق|مجزر|نفايات|ارصفة|أرصفة/],['الزراعة والري',/زراع|ري |الري|مبازل|سدة|قناة/],['المباني الحكومية',/بناية|مبنى|مقر|دائرة|قاعة|مركز/]];
const sectorOf=p=>{const t=[p.sector,p.name].join(' ');for(const [n,re] of SECT)if(re.test(t))return n;return 'أخرى';};
const isDone=p=>/منجز|مكتمل|مستلم/.test(String(p.status||''));
const isStop=p=>/متوقف|توقف/.test(String(p.status||''));
let sel=null,fundF='',lastKey='',grp=(()=>{try{return localStorage.getItem('ccGrp')||'dist';}catch(_){return 'dist';}})();
function data(){
  const S=AnbarReg.state(),G={};let all=S.projects.slice();
  if(fundF&&window.SitFund)all=all.filter(p=>window.SitFund(p)===fundF);
  all.forEach(p=>{const d=grp==='com'&&p.committee?String(p.committee):(AnbarReg.districtOf?AnbarReg.districtOf(p):(normD(p.district)||'غير محدد'));const g=G[d]||(G[d]={n:d,P:[],lat:[],lng:[]});g.P.push(p);
    const la=num(p.lat),ln=num(p.lng);if(la>31.5&&la<35.5&&ln>38.5&&ln<45)(g.lat.push(la),g.lng.push(ln));});
  const med=a=>{const s=a.slice().sort((x,y)=>x-y);return s.length?s[Math.floor(s.length/2)]:null;};
  const D=Object.values(G).map(g=>{const P=g.P,cost=P.reduce((a,p)=>a+(num(p.total)||num(p.orig)),0);
    const wsum=(k)=>{let a=0,w=0;P.forEach(p=>{if(!has(p[k]))return;const c=num(p.total)||num(p.orig)||1;a+=pctOf(p[k])*c;w+=c;});return w?a/w:null;};
    const act=wsum('actualPct'),plan=wsum('planPct'),paid=P.reduce((a,p)=>a+num(p.advPaid),0),raised=P.reduce((a,p)=>a+num(p.advRaised),0);
    const lag=P.filter(p=>has(p.actualPct)&&has(p.planPct)&&pctOf(p.actualPct)-pctOf(p.planPct)<-10&&!isDone(p)).length;
    const kn=KNOWN[g.n]||(Object.entries(KNOWN).find(([k])=>g.n.includes(k)||k.includes(g.n))||[])[1]||null;
    const c=g.lat.length?[med(g.lat),med(g.lng)]:kn;
    return {n:g.n,P,cost,act:act==null?null:Math.round(act*10)/10,plan:plan==null?null:Math.round(plan*10)/10,fin:cost?Math.min(100,paid/cost*100):null,paid,raised,
      stop:P.filter(isStop).length,done:P.filter(isDone).length,lag,c};});
  D.sort((a,b)=>b.cost-a.cost);
  return {S,all,D};}
function kpis(M){const T=M.all,cost=T.reduce((a,p)=>a+(num(p.total)||num(p.orig)),0);
  let aw=0,ww=0;T.forEach(p=>{if(!has(p.actualPct))return;const c=num(p.total)||num(p.orig)||1;aw+=pctOf(p.actualPct)*c;ww+=c;});
  const paid=T.reduce((a,p)=>a+num(p.advPaid),0),act=ww?aw/ww:0,fin=cost?paid/cost*100:0,stop=M.D.reduce((a,d)=>a+d.stop,0),lag=M.D.reduce((a,d)=>a+d.lag,0),done=M.D.reduce((a,d)=>a+d.done,0);
  const K=[[f0(T.length),'إجمالي المشاريع',100],[bil(cost),'الكلفة الكلية (مليار د.ع)',100],[act.toFixed(1)+'%','الإنجاز الفعلي المرجّح بالكلفة',act],[fin.toFixed(1)+'%','نسبة الصرف (المصروف ÷ الكلفة)',fin],[f0(done),'مشاريع منجزة',T.length?done/T.length*100:0],[f0(stop)+' / '+f0(lag),'متوقفة / متلكئة (انحراف > 10%)',T.length?(stop+lag)/T.length*100*4:0]];
  $('ccK').innerHTML=K.map(k=>`<div class="k"><b>${k[0]}</b><span>${k[1]}</span><div class="kb"><i style="width:${Math.max(2,Math.min(100,k[2]))}%"></i></div></div>`).join('');}
/* حدود الأقضية داخل الأنبار: تقريبية، محسوبة من مراكز الأقضية (كل نقطة تتبع أقرب مركز قضاء، مع وزن للأقضية الواسعة) ومقصوصة بحدود المحافظة */
const SEEDS=[['القائم',34.22,40.95,0],['الرمانة',34.38,41.45,0],['راوة',34.68,41.95,0],['عنه',34.12,41.95,0],['حديثة',34.42,42.55,0],['هيت',33.85,42.85,0],['الرمادي',33.00,43.05,2600],['الحبانية',33.40,43.60,0],['الفلوجة',33.27,43.80,0],['الكرمة',33.52,43.98,0],['العامرية',32.98,43.92,0],['الرطبة',32.80,40.40,4000]];
const dkey=s=>normD(s).replace(/^ال/,'').replace(/[ةه]$/,'ه').replace(/\s+/g,'');
function clipHalf(poly,a,b,c){const out=[];for(let i=0;i<poly.length;i++){const P=poly[i],Q=poly[(i+1)%poly.length],fp=a*P[0]+b*P[1]-c,fq=a*Q[0]+b*Q[1]-c;
  if(fp<=0)out.push(P);if((fp<0)!==(fq<0)&&fp!==fq){const t=fp/(fp-fq);out.push([P[0]+(Q[0]-P[0])*t,P[1]+(Q[1]-P[1])*t]);}}return out;}
/* موضع اسم القضاء الذي لا بيانات له: أبعد نقطة داخل حدوده عن دوائر الأقضية وأسمائها */
function inPoly(x,y,P){let c=false;for(let i=0,j=P.length-1;i<P.length;j=i++){const a=P[i],b=P[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])c=!c;}return c;}
function freeSpot(P,nodes,placed,name,fs){fs=fs||11;const xs=P.map(p=>p[0]),ys=P.map(p=>p[1]),hw=name.length*fs*.31+3,hh=fs*.62;let best=null,bd=-1;
  // صناديق العوائق: كل دائرة مع اسمها فوقها ونسبتها تحتها، والأسماء التي وُضعت قبلها
  const box=[...nodes.map(n=>n.fixed?[n.x-18,n.y-8,n.x+18,n.y+22]:[n.x-Math.max(n.r,40),n.y-n.r-22,n.x+Math.max(n.r,40),n.y+n.r+20]),...placed];
  for(let x=Math.min(...xs)+2;x<Math.max(...xs);x+=3)for(let y=Math.min(...ys)+4;y<Math.max(...ys);y+=3){if(!inPoly(x-hw,y,P)||!inPoly(x+hw,y,P)||!inPoly(x,y-hh,P)||!inPoly(x,y+hh,P))continue;
    let m=1e9;for(const b of box){const dx=Math.max(b[0]-(x+hw),(x-hw)-b[2],0),dy=Math.max(b[1]-(y+hh),(y-hh)-b[3],0);m=Math.min(m,Math.hypot(dx,dy));}
    if(m>bd){bd=m;best=[x,y];}}
  if(!best||bd<1)return null;placed.push([best[0]-hw,best[1]-hh,best[0]+hw,best[1]+hh]);return [best[0],best[1]+fs*.35];}
let CELLS=null;
function cells(){if(CELLS)return CELLS;
  if(GEO&&GEO.subs)return (CELLS=GEO.subs.map(sb=>{const poly=sb.p.map(p=>xy(p[0],p[1]));return {n:sb.n,dn:sb.d,k:dkey(sb.d),poly,sub:true};}));
const base=OUT.map(p=>xy(p[0],p[1])),S=SEEDS.map(s=>{const [x,y]=xy(s[1],s[2]);return {n:s[0],x,y,w:s[3]};});
  CELLS=S.map((si,i)=>{let poly=base.slice();S.forEach((sj,j)=>{if(i===j||poly.length<3)return;
      // |p-si|²-wi ≤ |p-sj|²-wj  ⇔  2(sj-si)·p ≤ |sj|²-|si|² - wj + wi
      poly=clipHalf(poly,2*(sj.x-si.x),2*(sj.y-si.y),(sj.x*sj.x+sj.y*sj.y)-(si.x*si.x+si.y*si.y)-sj.w+si.w);});
    const cx=poly.reduce((a,p)=>a+p[0],0)/(poly.length||1),cy=poly.reduce((a,p)=>a+p[1],0)/(poly.length||1);return {n:si.n,k:dkey(si.n),poly,cx,cy};}).filter(c=>c.poly.length>=3);
  return CELLS;}
function map(M){const sv=$('ccMap');const pts=M.D.filter(d=>d.c);
  // مواضع الدوائر مع إبعاد المتداخلة
  const R=d=>13+Math.sqrt(Math.max(d.cost,1)/1e9)*.7;
  const nodes=pts.map(d=>{const [x,y]=xy(d.c[0],d.c[1]);return {d,x,y,x0:x,y0:y,r:Math.min(22,R(d))};});
  // إبعاد الدوائر وأسمائها عن بعضها بحدّ أقصى للإزاحة عن الموقع الحقيقي، ويُرسم خط رفيع إلى الموقع الحقيقي
  const MAXD=115;const [bgx,bgy]=xy(33.31,44.37);nodes.push({fixed:true,x:bgx,y:bgy,x0:bgx,y0:bgy,r:8});
  for(let it=0;it<200;it++){for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){const a=nodes[i],b=nodes[j],dx=(b.x-a.x)||(i-j)*.01,dy=(b.y-a.y)||.01,
      sx=a.r+b.r+62,sy=a.r+b.r+38,nx=Math.abs(dx)/sx,ny=Math.abs(dy)/sy;if(nx<1&&ny<1){const fa=a.fixed?0:b.fixed?2:1,fb=b.fixed?0:a.fixed?2:1;if(nx>ny){const k=(1-nx)*sx/2*Math.sign(dx);a.x-=k*fa;b.x+=k*fb;}else{const k=(1-ny)*sy/2*Math.sign(dy);a.y-=k*fa;b.y+=k*fb;}}}
    nodes.forEach(n=>{if(n.fixed)return;const ddx=n.x-n.x0,ddy=n.y-n.y0,dd=Math.hypot(ddx,ddy);if(dd>MAXD){n.x=n.x0+ddx*MAXD/dd;n.y=n.y0+ddy*MAXD/dd;}
      n.x=Math.max(n.r+34,Math.min(W-n.r-34,n.x));n.y=Math.max(n.r+24,Math.min(H-n.r-24,n.y));});}
  let h=`<defs><radialGradient id="ccg"><stop offset="0" stop-color="#38e8ff" stop-opacity=".35"/><stop offset="1" stop-color="#38e8ff" stop-opacity="0"/></radialGradient>
   <linearGradient id="ccs" x1="0" x2="1"><stop offset="0" stop-color="#38e8ff" stop-opacity="0"/><stop offset="1" stop-color="#38e8ff" stop-opacity=".22"/></linearGradient>
   <pattern id="ccd" width="8" height="8" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".8" fill="#38e8ff" opacity=".22"/></pattern></defs>
   <path d="${pathOf(IRQ,true)}" fill="#1b2b44" fill-opacity=".75" stroke="#5b7392" stroke-width="1" stroke-opacity=".7" vector-effect="non-scaling-stroke"/>
   ${LABELS.map(l=>{const [x,y]=xy(l[1],l[2]);return `<text x="${x.toFixed(0)}" y="${y.toFixed(0)}" text-anchor="middle" font-size="${l[0]==='العراق'?15:13}" fill="#8aa0b8" opacity=".75">${l[0]}</text>`;}).join('')}
   <path d="${pathOf(OUT,true)}" fill="#0e6f8f" fill-opacity=".35" stroke="none"/>
   ${(()=>{const byK={},placedL=[];M.D.forEach(d=>{byK[dkey(d.n)]=d;});return cells().map(c=>{const d=byK[c.k],pd='M'+c.poly.map(p=>p[0].toFixed(1)+','+p[1].toFixed(1)).join(' L')+' Z';
     return `<g class="cell${d&&sel===d.n?' on':''}"${d?` data-d="${esc(d.n)}"`:''}><path d="${pd}" fill="${d?col(d.act):'#28415f'}" fill-opacity="${d?.16:.25}" stroke="#9fefff" stroke-opacity=".55" stroke-width="${c.sub?.8:1}" stroke-dasharray="${c.sub?'3 3':'5 4'}" stroke-linejoin="round" vector-effect="non-scaling-stroke"/><title>${c.sub?'ناحية '+esc(c.n)+' — قضاء '+esc(c.dn):esc(c.n)}${d?' — '+d.P.length+' مشروعاً في القضاء':' — لا توجد مشاريع في الموقف الحالي'}</title>${d&&!c.sub?'':(()=>{const fs=c.sub?9.5:11,L=freeSpot(c.poly,nodes,placedL,c.n,fs);return L?`<text x="${L[0].toFixed(0)}" y="${L[1].toFixed(0)}" text-anchor="middle" font-size="${fs}" fill="${c.sub?'#b9d7e8':'#8fb3c9'}" opacity=".8">${esc(c.n)}</text>`:'';})()}</g>`;}).join('');})()}
   ${GEO&&GEO.dists?GEO.dists.map(q=>`<path d="${pathOf(q.p,true)}" fill="none" stroke="#d6f6ff" stroke-opacity=".7" stroke-width="1.4" stroke-linejoin="round" pointer-events="none" vector-effect="non-scaling-stroke"/>`).join(''):''}
   <path class="outl" d="${pathOf(OUT,true)}" fill="none" stroke="#5ff3ff" stroke-width="2.4" stroke-linejoin="round" vector-effect="non-scaling-stroke" style="filter:drop-shadow(0 0 10px #38e8ff) drop-shadow(0 0 4px #38e8ff)"/>
   ${(()=>{const [bx,by]=xy(33.31,44.37);return `<circle class="ov" cx="${bx}" cy="${by}" r="3.5" fill="#fff" style="filter:drop-shadow(0 0 5px #fff)"/><text x="${bx}" y="${by+16}" font-size="11" fill="#cfe3f5" text-anchor="middle">بغداد</text>`;})()}
   ${LAKES.map(l=>{const [x,y]=xy(l[1],l[2]),[x2]=xy(l[1],l[2]+l[3]),[,y2]=xy(l[1]+l[4],l[2]);return `<g class="lake"><ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${(x2-x).toFixed(1)}" ry="${(y-y2).toFixed(1)}" transform="rotate(${l[5]} ${x.toFixed(1)} ${y.toFixed(1)})" fill="#1f7bff" fill-opacity=".45" stroke="#6fb6ff" stroke-width=".8" vector-effect="non-scaling-stroke"/><title>${l[0]} (موقع تقريبي)</title></g>`;}).join('')}
   <g class="roads">${ROADS.map(r=>`<path d="${pathOf(r[1])}" fill="none" stroke="#000" stroke-opacity=".45" stroke-width="3.2" stroke-linejoin="round" vector-effect="non-scaling-stroke"/><path class="road" d="${pathOf(r[1])}" fill="none" stroke="#ffd36b" stroke-width="1.3" stroke-linejoin="round" vector-effect="non-scaling-stroke"><title>${r[0]} (مسار تقريبي)</title></path>`).join('')}
    ${(()=>{const [x,y]=xy(32.98,40.95);return `<text class="rlbl" x="${x.toFixed(1)}" y="${(y+11).toFixed(1)}" text-anchor="middle">طريق المرور السريع</text>`;})()}</g>
   <path d="${pathOf(RIV)}" fill="none" stroke="#2a7fff" stroke-width="7" stroke-opacity=".18" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
   <path d="${pathOf(RIV)}" fill="none" stroke="#3d8cff" stroke-width="2.6" stroke-opacity=".9" stroke-linecap="round" vector-effect="non-scaling-stroke" style="filter:drop-shadow(0 0 4px #2a7fff)"/>
   <path class="flow" d="${pathOf(RIV)}" fill="none" stroke="#bfe0ff" stroke-width="1.3" stroke-linecap="round" vector-effect="non-scaling-stroke"><title>نهر الفرات</title></path>
   ${(()=>{const [x,y]=xy(34.52,41.45);return `<text class="wlbl rv" x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle">نهر الفرات</text>`;})()}
   <path class="comet ov" d="${pathOf(OUT,true)}" pathLength="1000" fill="none" stroke="#e9ffff" stroke-width="3" stroke-linecap="round"/>
   <path class="comet c2 ov" d="${pathOf(OUT,true)}" pathLength="1000" fill="none" stroke="#5ff3ff" stroke-width="3" stroke-linecap="round"/>
   <g class="sweep ov" style="transform-origin:${W/2}px ${H/2}px"><path d="M${W/2},${H/2} L${W/2},${H/2-200} A200,200 0 0,1 ${W/2+173},${H/2-100} Z" fill="url(#ccs)" opacity=".5"/></g>
   <circle class="ov" cx="${W/2}" cy="${H/2}" r="200" fill="none" stroke="#38e8ff" stroke-opacity=".1"/><circle class="ov" cx="${W/2}" cy="${H/2}" r="120" fill="none" stroke="#38e8ff" stroke-opacity=".08" stroke-dasharray="4 6"/>`;
  /* إذا تبادلت دائرتان موضعيهما (تتقاطع خطوطهما إلى موقعيهما الحقيقيين) تُعادان: كل دائرة إلى الموضع الأقرب لموقعها */
  for(let it=0;it<4;it++)for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){const a=nodes[i],b=nodes[j];if(a.fixed||b.fixed)continue;
    const cur=Math.hypot(a.x-a.x0,a.y-a.y0)+Math.hypot(b.x-b.x0,b.y-b.y0),sw=Math.hypot(b.x-a.x0,b.y-a.y0)+Math.hypot(a.x-b.x0,a.y-b.y0);
    if(sw<cur-4&&Math.abs(a.r-b.r)<7){const t=[a.x,a.y];a.x=b.x;a.y=b.y;b.x=t[0];b.y=t[1];}}
  const bgN=nodes.pop();
  /* أماكن الأسماء والنسب بلا تداخل: لكل قضاء يُجرَّب (فوق/تحت) ثم (يمين/يسار) ثم مواضع أبعد */
  const taken=nodes.map(n=>[n.x-n.r,n.y-n.r,n.x+n.r,n.y+n.r]);taken.push([bgN.x-16,bgN.y-6,bgN.x+16,bgN.y+20]);
  const hit=b=>taken.some(t=>b[0]<t[2]&&b[2]>t[0]&&b[1]<t[3]&&b[3]>t[1]);
  const place=(n,hw,hh,cands)=>{for(const [dx,dy,an] of cands){const cx=n.x+dx(hw),cy=n.y+dy,b=[cx-hw,cy-hh,cx+hw,cy+hh];if(b[0]<2||b[2]>W-2||b[1]<2||b[3]>H-2)continue;if(!hit(b)){taken.push(b);return [cx,cy+hh*.62,'middle'];}}
    const [dx,dy]=cands[0];const cx=n.x+dx(hw),cy=n.y+dy;taken.push([cx-hw,cy-hh,cx+hw,cy+hh]);return [cx,cy+hh*.62,'middle'];};
  nodes.forEach(n=>{const r=n.r,nh=(String(n.d.n).length+String(n.d.P.length).length+3)*3.5+4,ph=34;
    n.L=place(n,nh,8,[[()=>0,-r-12],[w=>-(r+w+4),-4],[w=>r+w+4,-4],[()=>0,-r-28],[w=>-(r+w+4),-18],[w=>r+w+4,-18],[()=>0,r+30]]);
});
  nodes.forEach(n=>{if(Math.hypot(n.x-n.x0,n.y-n.y0)>n.r)h+=`<g class="lead"><line x1="${n.x0.toFixed(1)}" y1="${n.y0.toFixed(1)}" x2="${n.x.toFixed(1)}" y2="${n.y.toFixed(1)}" stroke="#9fefff" stroke-opacity=".55" stroke-width="1"/><circle cx="${n.x0.toFixed(1)}" cy="${n.y0.toFixed(1)}" r="2.2" fill="#9fefff"/></g>`;});
  nodes.forEach((n,i)=>{const d=n.d,c=col(d.act),r=n.r,a=d.act||0;
    h+=`<g class="dist${sel===d.n?' on':''}" data-d="${esc(d.n)}"><circle cx="${n.x}" cy="${n.y}" r="${r*2}" fill="url(#ccg)"/><circle class="ring" cx="${n.x}" cy="${n.y}" r="${r}" stroke="${c}" style="animation-delay:${(i*.3).toFixed(1)}s"/>
     <circle cx="${n.x}" cy="${n.y}" r="${r}" fill="${c}" fill-opacity=".14" stroke="${c}" stroke-width="1.5"/>
     <circle cx="${n.x}" cy="${n.y}" r="${r}" fill="none" stroke="${c}" stroke-width="3" stroke-dasharray="${(2*Math.PI*r*a/100).toFixed(1)} 999" transform="rotate(-90 ${n.x} ${n.y})"/>
     <circle cx="${n.x}" cy="${n.y}" r="${(r-4.2).toFixed(1)}" fill="none" stroke="#ffc23d" stroke-opacity=".25" stroke-width="2"/>
     <circle cx="${n.x}" cy="${n.y}" r="${(r-4.2).toFixed(1)}" fill="none" stroke="#ffc23d" stroke-width="2" stroke-dasharray="${(2*Math.PI*(r-4.2)*(d.plan||0)/100).toFixed(1)} 999" transform="rotate(-90 ${n.x} ${n.y})"/>
     <text class="lbl" x="${n.L[0].toFixed(1)}" y="${n.L[1].toFixed(1)}" text-anchor="middle">${esc(d.n)} <tspan class="cnt">(${d.P.length})</tspan></text>
     <circle cx="${n.x}" cy="${n.y}" r="${(r-6.5).toFixed(1)}" fill="#030a14" fill-opacity=".72"/>
     <text class="pin" x="${n.x}" y="${(n.y+1).toFixed(1)}" text-anchor="middle" direction="ltr" fill="${c}" font-size="${Math.min(10,r*.5).toFixed(1)}">${d.act==null?'—':d.act.toFixed(0)+'%'}</text>
     <text class="pin pl" x="${n.x}" y="${(n.y+Math.min(10,r*.5)*.95).toFixed(1)}" text-anchor="middle" direction="ltr" font-size="${Math.min(7.5,r*.37).toFixed(1)}">${d.plan==null?'—':d.plan.toFixed(0)+'%'}</text>
     <title>${esc(d.n)}: الإنجاز الفعلي ${d.act==null?'—':d.act.toFixed(1)+'%'} — المخطط ${d.plan==null?'—':d.plan.toFixed(1)+'%'} — ${d.P.length} مشروعاً</title></g>`;});
  h+='<g id="ccFx"></g>';
  sv.innerHTML=h;sv.setAttribute('viewBox',cam.join(' '));sv.querySelectorAll('.dist,.cell[data-d]').forEach(g=>g.onclick=e=>{e.stopPropagation();touchAct();focus(g.dataset.d);});
  if(focusN)drawFx(window.__ccM&&window.__ccM.D.find(x=>x.n===focusN),false);
  const miss=M.D.filter(d=>!d.c);$('ccMiss').textContent=miss.length?'بلا موقع على الخريطة: '+miss.map(d=>d.n+' ('+d.P.length+')').join('، '):'';}
function gauge(v,c){const R=48,L=2*Math.PI*R,a=v||0;return `<circle cx="60" cy="60" r="${R}" fill="none" stroke="rgba(56,232,255,.12)" stroke-width="9"/>
 <circle cx="60" cy="60" r="${R}" fill="none" stroke="${c}" stroke-width="9" stroke-linecap="round" stroke-dasharray="${(L*a/100).toFixed(1)} ${L}" transform="rotate(-90 60 60)" style="filter:drop-shadow(0 0 6px ${c})"/>
 <circle cx="60" cy="60" r="36" fill="none" stroke="rgba(56,232,255,.25)" stroke-dasharray="2 4"/>
 <text x="60" y="64" text-anchor="middle" font-family="Consolas,monospace" font-size="21" fill="#fff">${v==null?'—':a.toFixed(1)+'%'}</text><text x="60" y="80" text-anchor="middle" font-size="9" fill="#6f93ad">الإنجاز الفعلي</text>`;}
function sectors(P){const G={};P.forEach(p=>{const s=sectorOf(p),g=G[s]||(G[s]={n:s,c:0,a:0,w:0,pl:0,pw:0});g.c++;const w=num(p.total)||num(p.orig)||1;if(has(p.actualPct)){g.a+=pctOf(p.actualPct)*w;g.w+=w;}if(has(p.planPct)){g.pl+=pctOf(p.planPct)*w;g.pw+=w;}});
  return Object.values(G).sort((a,b)=>b.c-a.c).slice(0,8).map(g=>({n:g.n,c:g.c,a:g.w?g.a/g.w:0,p:g.pw?g.pl/g.pw:null}));}
function pick(n){const M=window.__ccM;if(!M)return;const d=M.D.find(x=>x.n===n)||M.D[0];if(!d)return;sel=d.n;
  document.querySelectorAll('#ccMap .dist,#ccMap .cell').forEach(g=>g.classList.toggle('on',g.dataset.d===sel));document.querySelectorAll('#ccRank tr').forEach(t=>t.classList.toggle('on',t.dataset.d===sel));
  $('ccDN').textContent=d.n;$('ccDS').textContent=d.P.length+' مشروعاً · '+bil(d.cost)+' مليار د.ع';$('ccG').innerHTML=gauge(d.act,col(d.act));
  const dev=d.act!=null&&d.plan!=null?d.act-d.plan:null;
  $('ccDR').innerHTML=[['المخطط',d.plan==null?'—':d.plan.toFixed(1)+'%'],['الفعلي',d.act==null?'—':d.act.toFixed(1)+'%'],['الانحراف',dev==null?'—':(dev>0?'+':'')+dev.toFixed(1)+'%'],['نسبة الصرف',d.fin==null?'—':d.fin.toFixed(1)+'%'],['المصروف (مليار)',bil(d.paid)],['منجزة',d.done],['متوقفة',d.stop],['متلكئة',d.lag]]
    .map(r=>`<div><span>${r[0]}</span><b>${r[1]}</b></div>`).join('');
  $('ccSec').innerHTML=sectors(d.P).map(s=>`<div class="sec"><div class="t"><span>${esc(s.n)} <small>(${s.c})</small></span><b>${s.a.toFixed(0)}%</b></div><div class="tr"><i style="width:${s.a}%"></i>${s.p!=null?`<u style="right:${Math.min(100,s.p)}%"></u>`:''}</div></div>`).join('')||'<p class="mu">لا توجد بيانات</p>';
  $('ccGo').onclick=()=>{window.desktop.go('sit');setTimeout(()=>{const q=document.getElementById('q');if(q){q.value=d.n==='غير محدد'?'':d.n;q.dispatchEvent(new Event('input',{bubbles:true}));if(window.SitTable)window.SitTable();}},150);};}
function alerts(M){const A=[],L=M.S.links||{};
  M.D.forEach(d=>{const dev=d.act!=null&&d.plan!=null?d.act-d.plan:null;
    if(dev!=null&&dev<-10)A.push(['',`${d.n}: الإنجاز الفعلي أقل من المخطط بـ ${Math.abs(dev).toFixed(1)}% — ${d.lag} مشروعاً متلكئاً`,3+(-dev)/10]);
    if(d.stop)A.push(['w',`${d.n}: ${d.stop} مشروعاً متوقفاً`,2+d.stop/5]);
    if(d.act!=null&&d.act>=70&&dev!=null&&dev>=0)A.push(['g',`${d.n}: الإنجاز ${d.act.toFixed(0)}% ومتقدم على المخطط`,0.5]);});
  {let ni=0,na=0;const S=AnbarReg.state();M.all.forEach(p=>{if(!window.SitIssues)return;const L=S.links[p.fileNo]||{},I=window.SitIssues(p,L,num(p.total)||num(p.orig));if(I.length){ni++;if(I.some(x=>x[0]==='ad'))na++;}});
   if(ni)A.push(['',`خلل بين الموقف والأنظمة: ${ni} مشروعاً${na?` (منها ${na} في السلف المرفوعة)`:''} — راجعها من «الموقف العام» ← «⚠ خلل بين الموقف والأنظمة»`,3.5]);}
  let duP=0,coX=0,acS=0;Object.values(L).forEach(l=>{if(l.du&&(l.du.status==='pend'||l.du.status==='p25'))duP++;if(l.co&&l.co.exceeds)coX++;if(l.ac&&l.ac.records&&l.ac.records.some(r=>r.status==='soon'))acS++;});
  if(duP)A.push(['w',`المدد: ${duP} مشروعاً بانتظار قرار لجنة المدد أو تجاوز 25%`,2.5]);
  if(coX)A.push(['',`أوامر التغيير: ${coX} مشروعاً تتجاوز حدود التعليمات`,3]);
  if(acS)A.push(['w',`الاستلام: ${acS} مشروعاً تنتهي صيانته قريباً`,2]);
  A.sort((a,b)=>b[2]-a[2]);$('ccA').innerHTML=A.slice(0,7).map(a=>`<div class="al ${a[0]}"><i></i><span>${esc(a[1])}</span></div>`).join('')||'<div class="al g"><i></i><span>لا توجد إنذارات</span></div>';
  const cnt=k=>Object.values(L).filter(l=>l[k]).length;
  $('ccT').innerHTML=M.D.map(d=>`<span>◆ <b>${esc(d.n)}</b> — فعلي ${d.act==null?'—':d.act.toFixed(0)+'%'} / مخطط ${d.plan==null?'—':d.plan.toFixed(0)+'%'} / صرف ${d.fin==null?'—':d.fin.toFixed(0)+'%'} — ${d.P.length} مشروعاً</span>`).join('')
    +`<span>◆ <b>أوامر التغيير</b> — ${cnt('co')} مشروعاً</span><span>◆ <b>السلف</b> — ${cnt('ad')} مشروعاً</span><span>◆ <b>المدد والتوقف</b> — ${cnt('du')} مشروعاً</span><span>◆ <b>الاستلام</b> — ${cnt('ac')} مشروعاً</span>`;}
function rank(M){$('ccRank').innerHTML=M.D.slice().sort((a,b)=>(b.act||0)-(a.act||0)).map(d=>`<tr data-d="${esc(d.n)}"><td>${esc(d.n)}</td><td class="n">${d.P.length}</td><td class="n" style="color:${col(d.act)}">${d.act==null?'—':d.act.toFixed(0)+'%'}<span class="mini"><i style="width:${d.act||0}%;background:${col(d.act)}"></i></span></td><td class="n">${d.fin==null?'—':d.fin.toFixed(0)+'%'}</td></tr>`).join('');
  $('ccRank').querySelectorAll('tr').forEach(t=>t.onclick=()=>{touchAct();focus(t.dataset.d);});}
function render(force){if(!window.AnbarReg||$('pg-cc').hidden&&!force)return;const M=data();window.__ccM=M;
  $('ccEmpty').hidden=!!M.S.projects.length;$('ccBody').hidden=!M.S.projects.length;if(!M.S.projects.length)return;
  if(window.SitFund){const fs=[...new Set(M.S.projects.map(p=>window.SitFund(p)).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ar'));const s=$('ccF'),cur=fundF;s.innerHTML='<option value="">كل برامج التمويل</option>'+fs.map(x=>`<option ${x===cur?'selected':''}>${esc(x)}</option>`).join('');}
  $('ccSrc').textContent=M.S.source?`الموقف: «${M.S.source}» — ${String(M.S.updated||'').slice(0,10)}`:'';
  if(focusN&&!M.D.some(d=>d.n===focusN)){focusN=null;cam=FULL.slice();}
  kpis(M);map(M);rank(M);alerts(M);pick(sel&&M.D.some(d=>d.n===sel)?sel:(M.D[0]||{}).n);if(focusN)hud(M.D.find(d=>d.n===focusN));}

/* ===================== رصد القضاء: الكاميرا تطير إلى القضاء وتُبرز حدوده ومشاريعه =====================
   بالضغط على قضاء، أو تلقائياً بعد 30 ثانية سكون، ثم ينتقل إلى القضاء التالي كل مدة (افتراضياً 30 ثانية). */
const FULL=[0,0,W,H],ASP=W/H;let cam=FULL.slice(),focusN=null,flyR=0,lastAct=Date.now(),tourOn=true,dwell=30000,nextAt=0;
const unxy=(x,y)=>[LAT[1]-(y-15)/(H-30)*(LAT[1]-LAT[0]),LNG[0]+(x-20)/(W-40)*(LNG[1]-LNG[0])];
const ease=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
function setCam(c){cam=c;const sv=$('ccMap');if(sv)sv.setAttribute('viewBox',c.map(v=>v.toFixed(2)).join(' '));}
function flyTo(t,dur){cancelAnimationFrame(flyR);const s=cam.slice(),t0=performance.now(),D=dur||1500;
  const sc=[s[0]+s[2]/2,s[1]+s[3]/2],tc=[t[0]+t[2]/2,t[1]+t[3]/2],bump=(s[2]<W*.9&&t[2]<W*.9)?.55:0;
  const st=now=>{const p=Math.min(1,(now-t0)/D),e=ease(p),w=(s[2]+(t[2]-s[2])*e)*(1+bump*Math.sin(Math.PI*e)),h=w/ASP,cx=sc[0]+(tc[0]-sc[0])*e,cy=sc[1]+(tc[1]-sc[1])*e;
    setCam([cx-w/2,cy-h/2,w,h]);if(p<1)flyR=requestAnimationFrame(st);};flyR=requestAnimationFrame(st);}
function geomOf(d){const k=dkey(d.n),polys=GEO&&GEO.subs?GEO.subs.filter(sb=>dkey(sb.d)===k).map(sb=>({n:sb.n,p:sb.p.map(q=>xy(q[0],q[1]))})):[];
  const pts=d.P.map(p=>{const la=num(p.lat),ln=num(p.lng);if(!(la>31.5&&la<35.5&&ln>38.5&&ln<45))return null;const [x,y]=xy(la,ln);return {p,x,y};}).filter(Boolean);
  let A=polys.flatMap(q=>q.p);if(!A.length)A=pts.map(q=>[q.x,q.y]);if(!A.length&&d.c){const [x,y]=xy(d.c[0],d.c[1]);A=[[x-14,y-10],[x+14,y+10]];}
  if(!A.length)return null;const xs=A.map(a=>a[0]),ys=A.map(a=>a[1]);return {polys,pts,b:[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)]};}
/* إطار الكاميرا: القضاء في الثلثين الأيسرين من الخريطة، ولوحة المعلومات في الثلث الأيمن */
function camFor(g){const [x0,y0,x1,y1]=g.b,bw=Math.max(x1-x0,26),bh=Math.max(y1-y0,20),cx=(x0+x1)/2,cy=(y0+y1)/2;
  let vw=Math.max(bw/.58,bh/.78*ASP,95),vh=vw/ASP;return [cx-.33*vw,cy-vh/2,vw,vh];}
function drawFx(d,anim){const fx=$('ccFx');if(!fx)return;if(!d){fx.innerHTML='';return;}const g=geomOf(d);if(!g){fx.innerHTML='';return;}
  const t=camFor(g),k=t[2]/W,[x0,y0,x1,y1]=g.b,cx=(x0+x1)/2,cy=(y0+y1)/2,pd=7*k,L=16*k,c=col(d.act),dl=anim?1.25:0;
  const P=pts=>'M'+pts.map(p=>p[0].toFixed(2)+','+p[1].toFixed(2)).join(' L')+' Z';
  const [la,ln]=unxy(cx,cy),R=Math.hypot(x1-x0,y1-y0)/2+10*k;
  let h=`<defs><linearGradient id="fxScan" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#38e8ff" stop-opacity="0"/><stop offset="1" stop-color="#38e8ff" stop-opacity=".55"/></linearGradient>
   <radialGradient id="fxGlow"><stop offset="0" stop-color="${c}" stop-opacity=".22"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>
   <clipPath id="fxClip">${g.polys.length?g.polys.map(q=>`<path d="${P(q.p)}"/>`).join(''):`<rect x="${x0-pd}" y="${y0-pd}" width="${x1-x0+2*pd}" height="${y1-y0+2*pd}"/>`}</clipPath></defs>
   <g class="fxg" style="animation-delay:${dl}s">
   <circle cx="${cx}" cy="${cy}" r="${R*1.15}" fill="url(#fxGlow)"/>
   <g class="fxspin" style="transform-origin:${cx}px ${cy}px"><circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="#38e8ff" stroke-opacity=".35" stroke-dasharray="${(2*k).toFixed(2)} ${(5*k).toFixed(2)}" vector-effect="non-scaling-stroke"/>
    <path d="M${cx},${cy-R-4*k} l${-3*k},${-6*k} h${6*k} z M${cx},${cy+R+4*k} l${-3*k},${6*k} h${6*k} z" fill="#38e8ff" opacity=".7"/></g>
   <g class="fxspin rev" style="transform-origin:${cx}px ${cy}px"><circle cx="${cx}" cy="${cy}" r="${R*.82}" fill="none" stroke="#38e8ff" stroke-opacity=".18" stroke-dasharray="${(24*k).toFixed(2)} ${(10*k).toFixed(2)}" vector-effect="non-scaling-stroke"/></g>
   <line x1="${t[0]}" y1="${cy}" x2="${t[0]+t[2]}" y2="${cy}" stroke="#38e8ff" stroke-opacity=".22" stroke-dasharray="4 6" vector-effect="non-scaling-stroke"/>
   <line x1="${cx}" y1="${t[1]}" x2="${cx}" y2="${t[1]+t[3]}" stroke="#38e8ff" stroke-opacity=".22" stroke-dasharray="4 6" vector-effect="non-scaling-stroke"/>
   ${g.polys.map(q=>`<path d="${P(q.p)}" fill="${c}" fill-opacity=".10" stroke="none"/>`).join('')}
   <g clip-path="url(#fxClip)"><rect x="${x0-pd}" y="${y0-pd}" width="${x1-x0+2*pd}" height="${(10*k).toFixed(2)}" fill="url(#fxScan)"><animate attributeName="y" from="${y0-pd-10*k}" to="${y1+pd}" dur="3.2s" repeatCount="indefinite"/></rect></g>
   ${g.polys.map(q=>`<path class="fxedge" d="${P(q.p)}" fill="none" stroke="#7ff6ff" stroke-width="2.2" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`).join('')}
   ${g.polys.map((q,j)=>`<path class="fxcomet" d="${P(q.p)}" pathLength="1000" fill="none" stroke="#ffffff" stroke-width="${(2.8*k).toFixed(2)}" stroke-linecap="round" style="animation-delay:${(-j*1.3).toFixed(1)}s"/><path class="fxcomet c2" d="${P(q.p)}" pathLength="1000" fill="none" stroke="#ffc23d" stroke-width="${(2.4*k).toFixed(2)}" stroke-linecap="round" style="animation-delay:${(-j*1.3).toFixed(1)}s"/>`).join('')}
   ${[[x0-pd,y0-pd,1,1],[x1+pd,y0-pd,-1,1],[x0-pd,y1+pd,1,-1],[x1+pd,y1+pd,-1,-1]].map(([x,y,sx,sy])=>`<path d="M${x+sx*L},${y} H${x} V${y+sy*L}" fill="none" stroke="#ffc23d" stroke-width="2" vector-effect="non-scaling-stroke"/>`).join('')}
   <text x="${x0-pd}" y="${y0-pd-4*k}" font-size="${(8.5*k).toFixed(2)}" fill="#ffc23d" font-family="Consolas,monospace" direction="ltr">◎ ${la.toFixed(2)}°N  ${ln.toFixed(2)}°E</text>
   <text x="${x1+pd}" y="${y1+pd+10*k}" font-size="${(8*k).toFixed(2)}" fill="#6f93ad" font-family="Consolas,monospace" text-anchor="end" direction="ltr">SECTOR LOCK · ${g.pts.length}/${d.P.length} GEO</text>
   ${g.polys.length>1?g.polys.map(q=>{const qx=q.p.reduce((a,p)=>a+p[0],0)/q.p.length,qy=q.p.reduce((a,p)=>a+p[1],0)/q.p.length;return `<text x="${qx.toFixed(1)}" y="${qy.toFixed(1)}" font-size="${(10*k).toFixed(2)}" fill="#cfefff" opacity=".55" text-anchor="middle" style="paint-order:stroke;stroke:#030a14;stroke-width:${(3*k).toFixed(2)}px">${esc(q.n)}</text>`;}).join(''):''}
   </g>`;
  const S=g.pts.slice().sort((a,b)=>(num(b.p.total)||num(b.p.orig))-(num(a.p.total)||num(a.p.orig)));
  S.forEach((q,i)=>{const p=q.p,st=isStop(p),dn=isDone(p),a=has(p.actualPct)?pctOf(p.actualPct):null,cc=st?'#ff4d6a':dn?'#3dffa8':col(a),
    r=Math.min(6.5,2.3+Math.sqrt((num(p.total)||num(p.orig))/1e9)*.55)*k,lag=has(p.actualPct)&&has(p.planPct)&&pctOf(p.actualPct)-pctOf(p.planPct)<-10&&!dn;
    h+=`<g class="fxp" style="animation-delay:${(dl+.35+Math.min(i,60)*.022).toFixed(2)}s">${st||lag?`<circle class="ring" cx="${q.x.toFixed(2)}" cy="${q.y.toFixed(2)}" r="${(r*1.4).toFixed(2)}" stroke="${cc}" style="animation-delay:${(i%7*.35).toFixed(2)}s"/>`:''}
     <circle cx="${q.x.toFixed(2)}" cy="${q.y.toFixed(2)}" r="${r.toFixed(2)}" fill="${cc}" fill-opacity=".85" stroke="#fff" stroke-opacity=".6" stroke-width=".6" vector-effect="non-scaling-stroke" style="filter:drop-shadow(0 0 ${(3*k).toFixed(2)}px ${cc})"><title>${esc(p.name||'')}${a!=null?' — الإنجاز '+a.toFixed(0)+'%':''}${p.status?' — '+esc(p.status):''}</title></circle></g>`;});
  fx.innerHTML=h;}
function hud(d){const H=$('ccHud');if(!H)return;if(!d){H.hidden=true;return;}H.hidden=false;
  const D=window.__ccM.D.filter(x=>x.c),i=D.findIndex(x=>x.n===d.n),g=geomOf(d)||{pts:[]},dev=d.act!=null&&d.plan!=null?d.act-d.plan:null;
  const [la,ln]=g.b?unxy((g.b[0]+g.b[2])/2,(g.b[1]+g.b[3])/2):[0,0],work=d.P.length-d.done-d.stop,c=col(d.act);
  const top=d.P.slice().sort((a,b)=>(num(b.total)||num(b.orig))-(num(a.total)||num(a.orig))).slice(0,6);
  const seg=(n,cl)=>n?`<i style="flex:${n};background:${cl}"></i>`:'';
  H.innerHTML=`<div class="hz"><span>◉ TARGET LOCK</span><b>${String(i+1).padStart(2,'0')}/${String(D.length).padStart(2,'0')}</b></div>
   <div class="hn">قضاء ${esc(d.n)}</div><div class="hc">${la?la.toFixed(3)+'°N · '+ln.toFixed(3)+'°E':''}</div>
   <div class="hk"><div><b>${d.P.length}</b><span>مشروع</span></div><div><b>${bil(d.cost)}</b><span>مليار د.ع</span></div><div><b style="color:${c}">${d.act==null?'—':d.act.toFixed(1)+'%'}</b><span>الإنجاز الفعلي</span></div>
    <div><b>${d.plan==null?'—':d.plan.toFixed(1)+'%'}</b><span>المخطط</span></div><div><b style="color:${dev!=null&&dev<-10?'#ff4d6a':'#fff'}">${dev==null?'—':(dev>0?'+':'')+dev.toFixed(1)}</b><span>الانحراف</span></div><div><b>${d.fin==null?'—':d.fin.toFixed(1)+'%'}</b><span>الصرف</span></div></div>
   <div class="hs">${seg(d.done,'#3dffa8')}${seg(work,'#38e8ff')}${seg(d.stop,'#ff4d6a')}</div>
   <div class="hl"><span><i style="background:#3dffa8"></i>منجز ${d.done}</span><span><i style="background:#38e8ff"></i>قيد التنفيذ ${work}</span><span><i style="background:#ff4d6a"></i>متوقف ${d.stop}</span><span>متلكئ ${d.lag}</span></div>
   <div class="ht">أكبر المشاريع كلفةً</div>
   ${top.map(p=>{const a=has(p.actualPct)?pctOf(p.actualPct):null,cl=isStop(p)?'#ff4d6a':isDone(p)?'#3dffa8':col(a);return `<div class="hp"><div class="hpn" title="${esc(p.name||'')}">${esc(p.name||'—')}</div><div class="hpb"><i style="width:${a||0}%;background:${cl}"></i></div><b style="color:${cl}">${a==null?'—':a.toFixed(0)+'%'}</b></div>`;}).join('')}
   <div class="hf"><span>${g.pts.length} من ${d.P.length} مشروعاً على الخريطة بالإحداثيات</span></div>
   <div class="hn2" id="ccNext"></div>`;tickTour();}
function focus(n,fromTour){const M=window.__ccM;if(!M)return;const d=M.D.find(x=>x.n===n);if(!d)return;const g=geomOf(d);if(!g){pick(n);return;}
  focusN=d.n;pick(d.n);$('ccMap').classList.add('focus');document.querySelectorAll('#ccMap .cell').forEach(c=>c.classList.toggle('foc',c.dataset.d===d.n));
  drawFx(d,true);flyTo(camFor(g),fromTour?2200:1500);hud(d);nextAt=Date.now()+dwell;$('ccOv').hidden=false;}
function unfocus(){focusN=null;$('ccMap').classList.remove('focus');document.querySelectorAll('#ccMap .cell.foc').forEach(c=>c.classList.remove('foc'));drawFx(null);flyTo(FULL,1300);hud(null);$('ccOv').hidden=true;}
function touchAct(){lastAct=Date.now();nextAt=Date.now()+dwell;}
function tickTour(){const el=$('ccNext');const M=window.__ccM;if(!M)return;const D=M.D.filter(x=>x.c);
  const idle=Date.now()-lastAct>=30000;
  if(el){const i=D.findIndex(x=>x.n===focusN),nx=D[(i+1)%D.length],left=Math.max(0,nextAt-Date.now());
    el.innerHTML=tourOn&&nx?(idle?`<span>التالي: <b>${esc(nx.n)}</b></span><span class="hbar"><i style="width:${(100-left/dwell*100).toFixed(1)}%"></i></span><b class="ht2">${String(Math.ceil(left/1000)).padStart(2,'0')}s</b>`:`<span>الرصد التلقائي يستأنف بعد ${Math.ceil((30000-(Date.now()-lastAct))/1000)} ثانية سكون</span>`):'<span>الرصد التلقائي متوقف</span>';}
  const tg=$('ccTourSt');if(tg)tg.textContent=!tourOn?'متوقف':focusN&&idle?'يعمل':idle?'يبدأ الآن':'يبدأ بعد '+Math.ceil((30000-(Date.now()-lastAct))/1000)+' ث';}
setInterval(()=>{if($('pg-cc').hidden||!window.__ccM)return;tickTour();if(!tourOn)return;const D=window.__ccM.D.filter(x=>x.c);if(!D.length)return;
  if(Date.now()-lastAct<30000)return;if(!focusN||Date.now()>=nextAt){const i=D.findIndex(x=>x.n===focusN);focus(D[(i+1)%D.length].n,true);}},500);
['mousemove','mousedown','wheel','keydown','touchstart'].forEach(ev=>$('pg-cc').addEventListener(ev,()=>touchAct(),{passive:true}));
$('ccMap').addEventListener('click',e=>{if(focusN&&!e.target.closest('.cell[data-d],.dist,.fxp'))unfocus();});
$('ccOv').onclick=()=>{touchAct();unfocus();};
$('ccAuto').onclick=()=>{tourOn=!tourOn;$('ccAuto').classList.toggle('off',!tourOn);$('ccAuto').innerHTML=tourOn?'🎯 الرصد التلقائي: <span id="ccTourSt"></span>':'🎯 الرصد التلقائي: <span id="ccTourSt">متوقف</span>';touchAct();tickTour();};
$('ccDwell').onchange=e=>{dwell=+e.target.value*1000;nextAt=Date.now()+dwell;};

function tick(){const t=new Date();if($('ccClk'))$('ccClk').textContent=t.toLocaleTimeString('en-GB');}
setInterval(tick,1000);tick();
$('ccF').onchange=e=>{fundF=e.target.value;render();};
if($('ccGrp')){$('ccGrp').value=grp;$('ccGrp').onchange=e=>{grp=e.target.value;try{localStorage.setItem('ccGrp',grp);}catch(_){}sel=null;if(focusN)unfocus();render();};}
/* ملء الشاشة: النافذة كلها عبر البرنامج (طريقة المتصفح لا تعمل داخل نافذة البرنامج)، ويُخفى الشريط العلوي */
const fsUI=on=>{document.body.classList.toggle('ccfs',!!on);$('ccFull').textContent=on?'✕ خروج من ملء الشاشة':'⛶ ملء الشاشة';setTimeout(()=>render(true),60);};
$('ccFull').onclick=async()=>{const on=!document.body.classList.contains('ccfs');if(window.desktop.fullscreen){const r=await window.desktop.fullscreen(on);fsUI(r);}else fsUI(on);};
if(window.desktop.onFs)window.desktop.onFs(v=>{if(!v)fsUI(false);});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('pg-cc').hidden&&focusN){unfocus();return;}if(e.key==='Escape'&&document.body.classList.contains('ccfs')){window.desktop.fullscreen&&window.desktop.fullscreen(false);fsUI(false);}});
$('ccToSit').onclick=()=>window.desktop.go('sit');
window.desktop.onState(s=>{if(s.current==='cc')setTimeout(()=>render(true),30);else if(document.body.classList.contains('ccfs')){window.desktop.fullscreen&&window.desktop.fullscreen(false);fsUI(false);}});
const prevOnData=window.onData;window.onData=function(){try{if(prevOnData)prevOnData.apply(this,arguments);}finally{if(!$('pg-cc').hidden)render();}};
window.CommandCenter={render,data,focus,unfocus,state:()=>({focusN,cam:cam.slice(),tourOn,dwell})};
})();
