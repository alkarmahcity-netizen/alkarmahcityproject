/* 📘 الدليل الاسترشادي: سؤال ← جواب من نصوص التعليمات والضوابط وشروط المقاولة وقانون الانضباط (بلا إنترنت وبلا ذكاء اصطناعي).
   - البحث: توحيد الكتابة العربية (الهمزات، التاء المربوطة، التشكيل، الأرقام)، تجذير خفيف، مرادفات المصطلحات، تسامح مع خطأ حرف،
     ترتيب BM25 مع مكافأة العبارات المتجاورة ورقم المادة/الضوابط.
   - الجواب: أقرب الفقرات بنصها مع المصدر (المستند، الضوابط/المادة، الصفحة) — نسخ بزر، وعرض صورة الصفحة الأصلية للتحقق.
   - نصوص المستندات المصوّرة مستخرجة آلياً (OCR): يُنبَّه إلى مقارنتها بالصفحة الأصلية قبل الاقتباس الرسمي.
   - «➕ إضافة مستند»: PDF نصي أو TXT يُضاف على هذه الحاسبة (guide-user.json). */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const N=s=>String(s==null?'':s).replace(/[ً-ْـ‎‏]/g,'').replace(/[إأآٱ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/ؤ/g,'و').replace(/ئ/g,'ي')
  .replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).toLowerCase();
const STOP=new Set('في من الى على عن ان او و ما هل كيف متى ماذا لماذا اين هو هي التي الذي الذين هذه هذا ذلك تلك كم مع اذا او ثم قد لا لم لن كان تكون يكون به بها له لها عند بعد قبل كل اي ايه هناك ماهي ماهو وما وهل اذ حيث'.split(' '));
function stem(w){if(/^\d+$/.test(w))return w;let s=w;
  if(s.length>5&&/^(وال|فال|بال|كال|لل)/.test(s))s=s.slice(3);else if(s.length>4&&/^ال/.test(s))s=s.slice(2);else if(s.length>4&&/^[وفبلك]ال/.test(s))s=s.slice(3);else if(s.length>4&&/^[وف]/.test(s)&&!/^(وزار|وقت|وظيف|وثيق|وفق|وجود|وضع|وصف)/.test(s))s=s.slice(1);
  if(s.length>5)s=s.replace(/(هما|كما|تها|تهم|يات|ات|ون|ين|ان|ها|هم|يه|يا)$/,'');if(s.length>4)s=s.replace(/[هي]$/,'');return s;}
const toks=s=>N(s).replace(/[^ء-ي0-9a-z]+/g,' ').split(' ').filter(w=>w.length>1&&!STOP.has(w)).map(stem).filter(w=>w.length>1);
/* مرادفات المصطلحات (كل مجموعة: كلمات بعد التوحيد والتجذير) */
const SYN=[['سحب','سحب العمل','سحب المقاوله'],['غرام','غرامات تاخيريه','غرامه تاخيريه'],['تمديد','مدد اضافيه','مده اضافيه','تمديد المده'],['سلف','سلفه','دفع','دفعات'],
  ['ضمان','تامين','تامينات','خطاب ضمان','كفال'],['اعتراض','تظلم','طعن'],['عقوب','جزاء','عقوبات انضباطيه'],['موظف','منتسب'],['مقاول','متعاقد','مجهز'],['صاحب العمل','جهه التعاقد'],
  ['احال','ترسي'],['مناقص','عطاء','عطاءات'],['اوامر غيار','اوامر تغيير','تغيير','غيار'],['فسخ','انهاء العقد'],['استلام','تسلم'],['توقف','ايقاف','توقيف'],['تلكؤ','متلكي','متلكئ'],['امانه','تنفيذ امانه','اسلوب التنفيذ امانه','لجنه تنفيذ العمل امانه'],
  ['مهندس','مهندس مقيم','ممثل المهندس'],['انذار','انذار نهائي','اشعار'],['لجن','لجان'],['تخمين','كلفه تخمينيه'],['قايم سودا','قايمه سوداء','حظر'],['مخالف','خطا'],['راتب','مخصصات']];
const SYNI=new Map();SYN.forEach(g=>{const T=g.map(x=>toks(x).join(' '));T.forEach(t=>{SYNI.set(t,T.filter(o=>o!==t));});});
/* الأعداد الترتيبية لأرقام المواد (المادة 45 = المادة الخامسة والاربعون) */
const ORD1=['','الاولي','الثانيه','الثالثه','الرابعه','الخامسه','السادسه','السابعه','الثامنه','التاسعه','العاشره'],ONE=['','الحاديه','الثانيه','الثالثه','الرابعه','الخامسه','السادسه','السابعه','الثامنه','التاسعه'],TENS=['','','العشرون','الثلاثون','الاربعون','الخمسون','الستون','السبعون','الثمانون','التسعون'];
function ordinal(n){if(n<=10)return ORD1[n];if(n<20)return (n===11?'الحاديه':ONE[n-10])+' عشر';const t=Math.floor(n/10),u=n%10;return u?(u===1?'الحاديه':ONE[u])+' و'+TENS[t]:TENS[t];}

let D=null,IX=null,OFF=new Set();   /* المستندات غير المؤشَّرة (الجديد يكون مؤشَّراً) */const PG='../guide/pages/';
function build(){const C=D.chunks,df=new Map(),docs=[];let tot=0;
  C.forEach((c,i)=>{const t=toks(c.t+' '+(c.c||'')+' '+(c.a||''));c._t=t;c._h=new Set(toks((c.c||'')+' '+(c.a||'')));c._n=N((c.c||'')+' '+(c.a||''));c._aw=N(c.a||'').replace(/[^\u0621-\u064A0-9\s]/g,' ').split(/\s+/).filter(Boolean);
    {const L=String(c.t).split('\n'),h=L.filter(x=>/^(ال)?ماد[ةه]\s/.test(x.trim())).length;c._toc=h>=3&&h/L.length>=0.4;}c._len=t.length;tot+=t.length;new Set(t).forEach(w=>df.set(w,(df.get(w)||0)+1));});
  IX={df,avg:tot/Math.max(1,C.length),n:C.length,vocab:[...df.keys()]};
  /* الأقسام: كل ضوابط/مادة متتالية في مستند = قسم يُقرأ كاملاً ويُتصفح بعنوانه */
  SECS=[];let cur=null;C.forEach((c,i)=>{c._i=i;const k=c.d+'|'+(c.c||'')+'|'+(c.a||'');if(!cur||cur.k!==k){cur={k,d:c.d,c:c.c||'',a:c.a||'',idx:[],p0:c.p,toc:!!(c.toc||c._toc)};SECS.push(cur);}cur.idx.push(i);c._s=SECS.length-1;});
  SECS.forEach(x=>{x._t=new Set(toks(x.c+' '+x.a));x.p1=C[x.idx[x.idx.length-1]].p;});}
let SECS=[];
/* عناوين الضوابط/المواد الأقرب للسؤال (لمن يسأل عن «ضوابط كذا» أو «مادة كذا») */
function secHits(q,docsOn){const Q=[...new Set(toks(q).map(near))].filter(w=>!/^(ضوابط|ماده|مواد|تعليمات|حال|ما|كيف)$/.test(w));if(!Q.length)return [];const isC=/ضوابط|ضابط/.test(N(q));
  const out=[],seen=new Set();SECS.forEach((x,i)=>{if(x.toc||(!x.c&&!x.a)||(docsOn&&!docsOn.has(x.d)))return;const title=x.a||x.c;const key=x.d+'|'+title;if(seen.has(key))return;
    let s=0,h=0;Q.forEach(w=>{if(x._t.has(w)){h++;s+=Math.log(1+IX.n/((IX.df.get(w)||0)+1));}});if(!h)return;if(isC&&x.c&&!x.a)s*=1.4;if(h>=Math.min(2,Q.length)){seen.add(key);out.push({i,s:s*(h/Q.length)});}});
  return out.sort((a,b)=>b.s-a.s).slice(0,6);}
function secText(i){return SECS[i].idx.map(j=>D.chunks[j].t).join('\n');}
function secTitle(x){const d=docOf(x.d);return `${d.short||d.title}${x.c?' — '+x.c:''}${x.a?' — '+x.a:''}`;}
function near(w){/* أقرب كلمة في النصوص بفرق حرف واحد (خطأ إملائي) */if(w.length<4||IX.df.has(w))return w;let best=null,bd=0;
  for(const v of IX.vocab){if(Math.abs(v.length-w.length)>1)continue;if(ed1(v,w)){const d=IX.df.get(v);if(d>bd){bd=d;best=v;}}}return best||w;}
function lev(a,b){if(Math.abs(a.length-b.length)>2)return 9;const m=[];for(let i=0;i<=a.length;i++){m[i]=[i];for(let j=1;j<=b.length;j++)m[i][j]=i?Math.min(m[i-1][j]+1,m[i][j-1]+1,m[i-1][j-1]+(a[i-1]===b[j-1]?0:1)):j;}return m[a.length][b.length];}
/* رقم المادة المطلوب يطابق عنوان المادة: رقماً أو كتابةً («الخامسة والاربعون») مع تسامح مع أخطاء القراءة الآلية */
function artHit(c,n){const w=c._aw;if(!w.length||!/ماده/.test(w[0]))return false;const rest=w.slice(1,4);if(rest.some(x=>x===String(n)))return true;
  const O=N(ordinal(n)).split(' ');if(rest.length<O.length)return false;for(let i=0;i<O.length;i++)if(lev(rest[i],O[i])>(i===0?1:2))return false;   /* الكلمة الأولى (الآحاد) تُميّز المادة: خطأ حرف واحد فقط */
  /* «الخامسة» وحدها لا تطابق «الخامسة عشرة/والاربعون» */const nx=rest[O.length];return !(O.length===1&&nx&&(/^و?ال/.test(nx)&&/ون$|ين$/.test(nx)||/^عشر/.test(nx)));}
function ed1(a,b){if(a===b)return true;const la=a.length,lb=b.length;let i=0,j=0,e=0;while(i<la&&j<lb){if(a[i]===b[j]){i++;j++;continue;}if(++e>1)return false;if(la>lb)i++;else if(lb>la)j++;else{i++;j++;}}return e+(la-i)+(lb-j)<=1;}
function search(q,docsOn){if(!IX)return [];let Q=toks(q).map(near);if(!Q.length)return [];
  const W=new Map();Q.forEach(w=>W.set(w,Math.max(W.get(w)||0,1)));
  /* مرادفات: لكل كلمة أو كلمتين متتاليتين */
  const grams=[...Q,...Q.slice(1).map((w,i)=>Q[i]+' '+w)];grams.forEach(g=>{(SYNI.get(g)||[]).forEach(s=>s.split(' ').forEach(w=>{if(!W.has(w))W.set(w,0.55);}));});
  const art=/(?:ماده|م)\s*\(?\s*(\d{1,3})/.exec(N(q)),ctl=/ضوابط\s*(?:رقم)?\s*\(?\s*(\d{1,3})/.exec(N(q));
  const dHint=[[/انضباط|موظف|عقوب/,'law14'],[/2014|2\s*\/\s*2014/,'i2014'],[/2025/,'i2025'],[/شروط المقاول|الشروط العامه|هندسه مدنيه/,'gc'],[/امانه/,'am2018'],[/امانه/,'amg']].filter(x=>x[0].test(N(q))).map(x=>x[1]);
  const numQ=/(^|\s)(كم|مده|نسبه|مبلغ|متي|سقف|حد)(\s|$)/.test(N(q));
  const k1=1.4,b=0.7,out=[];
  D.chunks.forEach((c,i)=>{if(docsOn&&!docsOn.has(c.d))return;const tf=new Map();c._t.forEach(w=>tf.set(w,(tf.get(w)||0)+1));let s=0,hit=0;
    W.forEach((wt,w)=>{const f=tf.get(w);if(!f)return;const idf=Math.log(1+(IX.n-(IX.df.get(w)||0)+0.5)/((IX.df.get(w)||0)+0.5));s+=wt*idf*(f*(k1+1))/(f+k1*(1-b+b*c._len/IX.avg));if(wt>=1)hit++;});
    if(!s)return;
    Q.forEach(w=>{if(c._h.has(w))s+=1.6*Math.log(1+IX.n/((IX.df.get(w)||0)+1));});   /* كلمة السؤال في عنوان المادة/الضوابط */
    for(let j=0;j+1<Q.length;j++){const a=Q[j],bb=Q[j+1];for(let k=0;k+1<c._t.length;k++)if(c._t[k]===a&&c._t[k+1]===bb){s+=2.2;break;}}
    s*=0.6+0.4*hit/Math.max(1,new Set(Q).size);
    if(art&&artHit(c,+art[1]))s+=14;
    if(c._toc||c.toc)s*=0.3;   /* صفحات الفهرس */
    if(ctl&&c._n.includes('ضوابط رقم ('+ctl[1]+')'))s+=5;
    if(dHint.includes(c.d))s*=1.35;
    {const dd=docOf(c.d);if(dd.by&&!dHint.includes(c.d))s*=0.88;}   /* الملغى/المعدَّل بعد النص النافذ ما لم يُذكر في السؤال */
    if(numQ&&/\d|[٠-٩]|يوم|ايام|شهر|سنه|نسبه|بالمائه|%/.test(N(c.t)))s*=1.15;
    out.push({c,s});});
  out.sort((a,b)=>b.s-a.s);return out.slice(0,30);}

/* ---------- الواجهة ---------- */
const docOf=id=>(D.docs||[]).find(d=>d.id===id)||{title:id,short:id};
const srcLine=c=>{const d=docOf(c.d);return `${d.title}${c.c?' — '+c.c:''}${c.a?' — '+c.a:''} — الصفحة ${c.p}`;};
function hl(t,q){const W=new Set(toks(q).map(near));const out=[];String(t).split(/(\s+)/).forEach(w=>{if(/^\s+$/.test(w)){out.push(w);return;}const k=toks(w)[0];out.push(k&&W.has(k)?`<mark>${esc(w)}</mark>`:esc(w));});return out.join('').replace(/\n/g,'<br>');}
function card(r,q,main){const c=r.c,d=docOf(c.d);return `<div class="gd-c${main?' main':''}"><div class="gd-src"><b>${esc(d.short||d.title)}</b>${c.c?' — '+esc(c.c):''}${c.a?' — '+esc(c.a):''} <span class="gd-pg">الصفحة ${c.p}</span></div>
  ${d.note?`<div class="gd-note">⚠ ${esc(d.note)}${d.by?` <button class="btn sm" data-gpage="${esc(d.by)}|${+d.byp||1}">عرض النص</button>`:''}</div>`:''}
  <div class="gd-t" dir="rtl">${hl(c.t,q)}</div>
  <div class="gd-act"><button class="btn sm pri" data-gcopy="${c._i}">📋 نسخ</button><button class="btn sm" data-gsec="${c._s}" title="النص الكامل ${c.a||c.c?'للمادة/الضوابط':'للصفحة'} مع ما قبل هذه الفقرة وما بعدها">📖 النص الكامل</button>${c.u?'':`<button class="btn sm" data-gpage="${esc(c.d)}|${c.p}">🖼 الصفحة الأصلية</button>`}${c.u?'':'<small class="gd-ocr">النص مستخرج آلياً من المستند — قارنه بالصفحة الأصلية قبل الاقتباس الرسمي</small>'}</div></div>`;}
let lastQ='',lastR=[];
function ask(){const q=$('gdQ').value.trim();if(!q){$('gdOut').innerHTML='';return;}lastQ=q;const on=new Set([...document.querySelectorAll('#gdDocs input:checked')].map(x=>x.value));
  const R=search(q,on);lastR=R;try{const H=JSON.parse(localStorage.getItem('gd_hist')||'[]').filter(x=>x!==q);H.unshift(q);localStorage.setItem('gd_hist',JSON.stringify(H.slice(0,12)));}catch(_){}
  hist();
  if(!R.length){$('gdOut').innerHTML='<div class="empty">لم أجد نصاً يجيب عن السؤال في المستندات المختارة — جرّب كلمات أخرى (مثلاً: «سحب العمل»، «الغرامات التأخيرية»، «العقوبات»).</div>';return;}
  const top=R[0].s,main=R.filter((r,i)=>i<3&&r.s>=top*0.62),more=R.slice(main.length,main.length+8);
  const SH=secHits(q,on).filter(h=>!main.some(r=>r.c._s===h.i)).slice(0,5);
  $('gdOut').innerHTML=`<div class="gd-ans"><div class="gd-h"><h3>الجواب</h3><button class="btn sm pri" data-gcopyall="1">📋 نسخ الجواب كاملاً مع المصادر</button></div>${SH.length?`<div class="gd-sh"><b>📑 ضوابط ومواد عناوينها قريبة من السؤال:</b> ${SH.map(h=>`<button class="dchip" data-gsec="${h.i}">${esc(secTitle(SECS[h.i]))} <small>ص${SECS[h.i].p0}</small></button>`).join('')}</div>`:''}${main.map(r=>card(r,q,true)).join('')}</div>
    ${more.length?`<details class="gd-more"><summary>نصوص أخرى ذات صلة (${more.length})</summary>${more.map(r=>card(r,q,false)).join('')}</details>`:''}`;}
const copyTxt=c=>{const d=docOf(c.d);return `${c.t}\n— المصدر: ${srcLine(c)}${d.note?'\n— ملاحظة: '+d.note:''}`;};
async function copy(t){try{await navigator.clipboard.writeText(t);}catch(_){const a=document.createElement('textarea');a.value=t;a.style.cssText='position:fixed;opacity:0';document.body.appendChild(a);a.select();document.execCommand('copy');a.remove();}if(window.flash)window.flash('نُسخ النص — الصقه حيث تريد');}
function pageDlg(d,p){const doc=docOf(d),n=+doc.pages||p,lo=doc.only?doc.only[0]:1,hi=doc.only?doc.only[1]:n;const ov=document.createElement('div');ov.className='ov';ov.id='gdPg';
  const show=()=>{ov.innerHTML=`<div class="dlg" style="width:min(980px,96vw);max-height:94vh;overflow:auto"><div style="display:flex;gap:8px;align-items:center;justify-content:space-between;flex-wrap:wrap"><b>${esc(doc.title)} — الصفحة ${p} من ${n}</b>
    <span><button class="btn sm" data-gp="-1" ${p<=lo?'disabled':''}>▶ السابقة</button> <button class="btn sm" data-gp="1" ${p>=hi?'disabled':''}>التالية ◀</button> <button class="btn sm" data-gx="1">إغلاق</button></span></div>
    <img src="${PG}${esc(d)}-${String(p).padStart(3,'0')}.png" alt="صفحة ${p}" style="width:100%;margin-top:8px;border:1px solid #ccd;background:#fff"><div class="hint">${esc(doc.src||'')}</div></div>`;};
  show();document.body.appendChild(ov);
  ov.addEventListener('click',e=>{if(e.target===ov||e.target.closest('[data-gx]')){ov.remove();return;}const b=e.target.closest('[data-gp]');if(b){p=Math.min(hi,Math.max(lo,p+ +b.dataset.gp));show();}});}
function secDlg(i,q){const x=SECS[i];if(!x)return;let idx=x.idx;if(!x.c&&!x.a){/* بلا عنوان: الصفحة كاملة */idx=D.chunks.filter(c=>c.d===x.d&&c.p===D.chunks[x.idx[0]].p).map(c=>c._i);}
  const d=docOf(x.d),txt=idx.map(j=>D.chunks[j].t).join('\n'),pages=[...new Set(idx.map(j=>D.chunks[j].p))];const ov=document.createElement('div');ov.className='ov';ov.id='gdSec';
  ov.innerHTML=`<div class="dlg" style="width:min(980px,96vw);max-height:92vh;overflow:auto"><div style="display:flex;gap:8px;align-items:center;justify-content:space-between;flex-wrap:wrap"><b>${esc(secTitle(x))}</b><span><button class="btn sm pri" data-gscopy="1">📋 نسخ النص كاملاً</button> <button class="btn sm" data-gx="1">إغلاق</button></span></div>
    ${d.note?`<div class="gd-note">⚠ ${esc(d.note)}</div>`:''}<div class="hint">الصفحات: ${pages.map(p=>x.u||d.u?p:`<button class="btn sm" data-gpage="${esc(x.d)}|${p}">🖼 ${p}</button>`).join(' ')}</div>
    <div class="gd-t" dir="rtl" style="margin-top:8px">${q?hl(txt,q):esc(txt).replace(/\n/g,'<br>')}</div></div>`;
  document.body.appendChild(ov);ov.addEventListener('click',e=>{if(e.target===ov||e.target.closest('[data-gx]')){ov.remove();return;}if(e.target.closest('[data-gscopy]')){copy(`${txt}\n— المصدر: ${secTitle(x)} — الصفحات ${pages.join('، ')}${d.note?'\n— ملاحظة: '+d.note:''}`);return;}
    const p=e.target.closest('[data-gpage]');if(p){const [dd,n]=p.dataset.gpage.split('|');pageDlg(dd,+n);}});}
function browseDlg(){const ov=document.createElement('div');ov.className='ov';ov.id='gdBr';let cur=(D.docs[0]||{}).id;
  const show=()=>{const L=[];const seen=new Set();SECS.forEach((x,i)=>{if(x.d!==cur||x.toc||(!x.c&&!x.a))return;const k=x.c+'|'+x.a;if(seen.has(k))return;seen.add(k);L.push(i);});
    ov.innerHTML=`<div class="dlg" style="width:min(980px,96vw);max-height:92vh;overflow:auto"><div style="display:flex;gap:8px;align-items:center;justify-content:space-between;flex-wrap:wrap"><b>📑 تصفّح الضوابط والمواد</b><button class="btn sm" data-gx="1">إغلاق</button></div>
      <div class="gd-docs" style="margin:8px 0">${D.docs.map(d=>`<button class="dchip${d.id===cur?' on':''}" data-gbd="${esc(d.id)}">${esc(d.short||d.title)}</button>`).join('')}</div>
      <div class="hint">${esc(docOf(cur).title)} — ${L.length} عنوان. اضغط العنوان لقراءة نصه كاملاً.</div>
      <ol class="gd-br">${L.map(i=>{const x=SECS[i];return `<li><button class="lnk" data-gsec="${i}">${esc(x.c&&x.a?x.c+' — '+x.a:(x.a||x.c))}</button> <small>ص${x.p0}${x.p1!==x.p0?'–'+x.p1:''}</small></li>`;}).join('')||'<li>لا عناوين مستخرجة لهذا المستند — استعمل السؤال أو «🖼 الصفحة الأصلية».</li>'}</ol></div>`;};
  show();document.body.appendChild(ov);
  ov.addEventListener('click',e=>{if(e.target===ov||e.target.closest('[data-gx]')){ov.remove();return;}const b=e.target.closest('[data-gbd]');if(b){cur=b.dataset.gbd;show();return;}const s=e.target.closest('[data-gsec]');if(s)secDlg(+s.dataset.gsec,'');});}
function hist(){let H=[];try{H=JSON.parse(localStorage.getItem('gd_hist')||'[]');}catch(_){}
  const EX=['ما هي حالات سحب العمل من المقاول؟','كيف تحتسب الغرامات التأخيرية؟','ما هي العقوبات الانضباطية للموظف؟','متى تمنح المدد الإضافية؟','ما هي التأمينات الاولية للمناقصة؟','ما مدة الاعتراض على العقوبة؟','ما هي صلاحيات لجنة تنفيذ العمل أمانة؟'];
  $('gdEx').innerHTML=(H.length?'<b>أسئلة سابقة:</b> '+H.slice(0,6).map(x=>`<button class="dchip" data-gq="${esc(x)}">${esc(x)}</button>`).join(''):'')+'<b>أمثلة:</b> '+EX.map(x=>`<button class="dchip" data-gq="${esc(x)}">${esc(x)}</button>`).join('');}
function docsUI(){$('gdDocs').innerHTML=D.docs.map(d=>`<label class="gd-doc" title="${esc(d.title)}${d.src?' — '+esc(d.src):''}"><input type="checkbox" value="${esc(d.id)}" ${OFF.has(d.id)?'':'checked'}> ${esc(d.short||d.title)}${d.u?` <button class="btn sm" data-gdel="${esc(d.id)}" title="حذف هذا المستند المضاف">✕</button>`:''}</label>`).join('')+
  `<button class="btn sm" id="gdBrowse" title="قائمة الضوابط والمواد لكل مستند — اضغط العنوان لقراءة نصه كاملاً">📑 تصفّح الضوابط والمواد</button><button class="btn sm" id="gdAdd" title="PDF يحوي نصاً، Word، TXT، أو لصق نص">➕ إضافة مستند</button>`;}
async function load(){if(D)return D;try{const r=await window.desktop.guideData();D=r&&r.base?JSON.parse(r.base):{docs:[],chunks:[]};const u=r&&r.user?JSON.parse(r.user):null;
  if(u&&u.docs){u.docs.forEach(d=>{d.u=1;D.docs.push(d);});(u.chunks||[]).forEach(c=>{c.u=1;D.chunks.push(c);});}}catch(e){D={docs:[],chunks:[]};}build();return D;}
/* تقسيم نص مستند مضاف إلى فقرات مع عنوان المادة/الضوابط */
function splitDoc(id,pages){const chunks=[];let art='',ctl='';pages.forEach((t,i)=>{let buf=[];const flush=()=>{const par=buf.join('\n').replace(/[ \t]+/g,' ').trim();buf=[];if((par.match(/[ء-ي]/g)||[]).length<25)return;for(let k=0;k<par.length;k+=1100)chunks.push({d:id,p:i+1,c:ctl,a:art,t:par.slice(k,k+1100)});};
    String(t).split('\n').forEach(l=>{const x=l.trim();if(!x){if(buf.join('').length>500)flush();return;}
      if(/^(ال)?ضوابط\s*(رقم)?\s*\(?\s*[\d٠-٩]+/.test(x)){flush();ctl=x.slice(0,70);art='';}else if(/^(ال)?ماد[ةه]\s*[-–(]?\s*([\d٠-٩]+|ال[ء-ي]+)/.test(x)){flush();art=x.slice(0,70);}
      buf.push(x);if(buf.join('').length>900)flush();});flush();});return chunks;}
function addDoc(){const ov=document.createElement('div');ov.className='ov';ov.id='gdAddOv';
  ov.innerHTML=`<div class="dlg" style="width:min(640px,96vw)"><h3>➕ إضافة مستند إلى الدليل</h3>
    <label class="ml">اسم المستند (كما يظهر في النتائج)<input id="gaT" placeholder="مثال: تعميم وزارة التخطيط بشأن …"></label>
    <label class="ml">الملف: PDF يحوي نصاً، أو Word (docx)، أو TXT<input type="file" id="gaF" accept=".pdf,.docx,.txt"></label>
    <div class="hint" style="margin:4px 0">أو الصق النص مباشرة (مثلاً نسخة من كتاب أو تعميم):</div><textarea id="gaX" rows="6" style="width:100%;font:inherit" placeholder="الصق النص هنا…"></textarea>
    <p id="gaE" style="color:#b00020;min-height:1.2em"></p><div class="row" style="display:flex;gap:8px;justify-content:flex-end"><button class="btn" data-ga="no">إلغاء</button><button class="btn pri" data-ga="ok">إضافة</button></div></div>`;
  document.body.appendChild(ov);const E=m=>{ov.querySelector('#gaE').textContent=m;};
  ov.querySelector('#gaF').onchange=()=>{const f=ov.querySelector('#gaF').files[0];const t=ov.querySelector('#gaT');if(f&&!t.value.trim())t.value=f.name.replace(/\.[^.]+$/,'');};
  ov.addEventListener('click',async e=>{const b=e.target.closest('[data-ga]');if(!b)return;if(b.dataset.ga==='no'){ov.remove();return;}
    const title=ov.querySelector('#gaT').value.trim(),f=ov.querySelector('#gaF').files[0],pasted=ov.querySelector('#gaX').value.trim();
    if(!title){E('اكتب اسم المستند');return;}if(!f&&!pasted){E('اختر ملفاً أو الصق النص');return;}
    b.disabled=true;E('');let pages=[],src='نص ملصوق';
    try{if(f){src=f.name;if(/\.txt$/i.test(f.name))pages=[await f.text()];
        else if(/\.docx$/i.test(f.name)){const r=await window.desktop.guideDocx(new Uint8Array(await f.arrayBuffer()));if(!r||r.error)throw new Error((r&&r.error)||'ملف Word غير صالح');pages=[r.text];}
        else{const lib=await loadPdf();const doc=await lib.getDocument({data:new Uint8Array(await f.arrayBuffer())}).promise;
          for(let i=1;i<=doc.numPages;i++){const pg=await doc.getPage(i);const tc=await pg.getTextContent();let s2='',y=null;tc.items.forEach(it=>{const yy=Math.round(it.transform[5]);if(y!==null&&Math.abs(yy-y)>3)s2+='\n';s2+=it.str;if(!/\s$/.test(it.str))s2+=' ';y=yy;});pages.push(s2.normalize('NFKC'));}}}
      if(pasted)pages.push(pasted);}
    catch(err){b.disabled=false;E('تعذّرت قراءة الملف: '+(err&&err.message||err));return;}
    const txt=pages.join('\n');if((txt.match(/[ء-ي]/g)||[]).length<60){b.disabled=false;E(f&&/\.pdf$/i.test(f.name)?'هذا الـPDF صورة ممسوحة ضوئياً (لا نص فيه) — الصق نصه في المربع، أو أرسله ليُحوَّل إلى نص ويُضاف مع البرنامج.':'لا يوجد نص عربي كافٍ في المستند');return;}
    const id='u'+Date.now().toString(36),chunks=splitDoc(id,pages);
    const r=await window.desktop.guideAdd({doc:{id,title,short:title.slice(0,40),src:'مستند مضاف على هذه الحاسبة ('+src+')',pages:pages.length},chunks});
    if(r&&r.ok){ov.remove();D=null;await load();docsUI();if(window.flash)window.flash(`أُضيف «${title}» — ${chunks.length} فقرة — اسأل عنه الآن`);}else{b.disabled=false;E((r&&r.error)||'تعذّر الحفظ');}});}
function loadPdf(){if(window.pdfjsLib)return Promise.resolve(window.pdfjsLib);return new Promise((res,rej)=>{const s=document.createElement('script');s.src='vendor/pdfjs/pdf.min.js';s.onload=()=>{window.pdfjsLib.GlobalWorkerOptions.workerSrc='vendor/pdfjs/pdf.worker.min.js';res(window.pdfjsLib);};s.onerror=()=>rej(new Error('تعذّر تحميل قارئ PDF'));document.head.appendChild(s);});}
async function render(){const pg=$('pg-guide');if(!pg)return;if(!pg.dataset.ok){pg.dataset.ok='1';
    pg.innerHTML=`<div class="wrap"><h1 class="pt">📘 الدليل الاسترشادي</h1><p class="sub">اسأل بلغتك العادية، فيجيب البرنامج بنص المادة أو الفقرة من: تعليمات تنفيذ العقود العامة 1/2025 وضوابطها، تعليمات تنفيذ العقود الحكومية 2/2014 وضوابطها، شروط المقاولة لأعمال الهندسة المدنية، تعليمات تنفيذ الأعمال أمانة 1/2018 وتعديلها 3/2022، وقانون انضباط موظفي الدولة 14/1991 — مع المصدر ورقم الصفحة وزر النسخ. يعمل بلا إنترنت.</p>
    <div class="gd-ask"><textarea id="gdQ" rows="2" placeholder="اكتب سؤالك… مثال: ما هي حالات سحب العمل من المقاول؟"></textarea><button class="btn pri" id="gdGo">اسأل</button></div>
    <div class="gd-docs" id="gdDocs"></div><div class="gd-ex" id="gdEx"></div><div id="gdOut"></div></div>`;
    $('gdGo').onclick=ask;$('gdQ').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();ask();}});
    pg.addEventListener('click',async e=>{const t=e.target;
      if(t.closest('#gdAdd'))return addDoc();
      if(t.closest('#gdBrowse'))return browseDlg();
      const sc=t.closest('[data-gsec]');if(sc){secDlg(+sc.dataset.gsec,lastQ);return;}
      const dl=t.closest('[data-gdel]');if(dl){e.preventDefault();if(!confirm('حذف هذا المستند المضاف من الدليل على هذه الحاسبة؟'))return;{const r=await window.desktop.guideDel(dl.dataset.gdel);if(r&&r.error){if(window.flash)window.flash(r.error,true);return;}}D=null;await load();docsUI();return;}
      const gq=t.closest('[data-gq]');if(gq){$('gdQ').value=gq.dataset.gq;ask();return;}
      const c=t.closest('[data-gcopy]');if(c){copy(copyTxt(D.chunks[+c.dataset.gcopy]));return;}
      if(t.closest('[data-gcopyall]')){const top=lastR[0]?lastR[0].s:0;copy(`السؤال: ${lastQ}\n\n`+lastR.filter((r,i)=>i<3&&r.s>=top*0.62).map(r=>copyTxt(r.c)).join('\n\n'));return;}
      const p=t.closest('[data-gpage]');if(p){const [d,n]=p.dataset.gpage.split('|');pageDlg(d,+n);return;}});
    pg.addEventListener('change',e=>{if(e.target.closest('#gdDocs input')){OFF=new Set([...document.querySelectorAll('#gdDocs input:not(:checked)')].map(x=>x.value));if(lastQ)ask();}});}
  await load();docsUI();hist();}
window.Guide={search:q=>{if(!D)return null;return search(q,null).slice(0,5).map(r=>({d:r.c.d,p:r.c.p,c:r.c.c,a:r.c.a,s:Math.round(r.s*10)/10,t:r.c.t.slice(0,160)}));},load,ask,ordinal};
const prev=window.onNav;window.onNav=function(s){try{if(prev)prev.apply(this,arguments);}finally{const pg=$('pg-guide');if(pg){pg.hidden=s.current!=='guide';if(s.current==='guide')render();}}};
})();
