/* الحوارات المشتركة: كلمات السر، المزامنة، التنقل بين الصفحات */
/*SHELL*/
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>{n=Math.round(+n||0);return (n<0?'−':'')+Math.abs(n).toLocaleString('en-US');};
let tt=null;window.flash=(m,bad)=>{const t=$('toast');t.textContent=m;t.className='on'+(bad?' bad':'');clearTimeout(tt);tt=setTimeout(()=>t.className='',bad?5000:2800);};
const DU_ST={stop:['متوقف','bad'],over:['انتهت مدة العقد','bad'],pend:['بانتظار قرار','warn'],p25:['تجاوز 25%','warn'],run:['جارٍ','ok'],miss:['بيانات ناقصة','warn']};
const AC_ST={active:'ok',soon:'warn',expired:'bad',closed:'ok',unknown:'warn'};
let state={current:'home'};
function closeDrawer(){const d=document.getElementById('drawer');if(d)d.hidden=true;}
document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>window.desktop.go(b.dataset.go));
$('bFolder').onclick=()=>window.desktop.openDataFolder();
const NAMES={co:'أوامر التغيير',du:'المدد والتوقف',ad:'لجنة تدقيق السلف',in:'إطلاق التأمينات',ac:'الاستلام',lt:'المخاطبات',fu:'مطالعات الأوامر',ar:'📥 الأرشيف',dm:'مطالعات لجنة المدد',cm:'مطالعات لجنة أوامر التغيير'};
function markLocks(locked){document.querySelectorAll('.tab').forEach(b=>{const id=b.dataset.go;if(!NAMES[id])return;b.textContent=(locked&&locked.includes(id)?'🔒 ':'')+NAMES[id];});}
let openCount=0;
function openOv(id){const el=$(id);if(el.hidden){el.hidden=false;openCount++;window.desktop.modal(true);}}
function closeOv(id){const el=$(id);if(!el.hidden){el.hidden=true;openCount=Math.max(0,openCount-1);if(!openCount)window.desktop.modal(false);}}
document.addEventListener('keydown',e=>{if(e.key==='Escape'){for(const id of ['authOv','pwOv','syOv','mlOv','msOv','whoOv','rsOv']){if(!$(id).hidden){if(id==='authOv'){pendingAuth=null;}closeOv(id);break;}}}});
let pendingAuth=null;
const AUDIT_SYS=['co','du','ad','ac'];
window.desktop.onAuth(a=>{pendingAuth=a;$('authT').textContent='كلمة سر: '+a.title;$('authPw').value='';$('authE').textContent='';try{window.__whoNames&&window.__whoNames();}catch(_){}const w=window.desktop.who();$('authName').value=w||'';$('authNameL').style.display=AUDIT_SYS.includes(a.id)?'':'none';document.querySelector('#authOv .audnote').style.display=AUDIT_SYS.includes(a.id)?'':'none';openOv('authOv');setTimeout(()=>(AUDIT_SYS.includes(a.id)&&!w?$('authName'):$('authPw')).focus(),50);});
async function doAuth(){if(!pendingAuth)return;const nm=$('authName').value.trim();if(AUDIT_SYS.includes(pendingAuth.id)&&nm.length<3){$('authE').textContent='اكتب اسمك الثلاثي (يُسجَّل في سجل التعديلات)';$('authName').focus();return;}const r=await window.desktop.unlock(pendingAuth.id,$('authPw').value);
  if(r===true){const a=pendingAuth;pendingAuth=null;if(nm)await window.desktop.setWho(nm);try{window.__whoChip&&window.__whoChip();}catch(_){}closeOv('authOv');window.desktop.go(a.id,a.fileNo);if(AUDIT_SYS.includes(a.id))window.desktop.auditLogin(a.id);}
  else{$('authE').textContent=r==='wait'?'محاولات كثيرة خاطئة. انتظر 30 ثانية ثم أعد المحاولة.':'كلمة السر غير صحيحة';$('authPw').value='';$('authPw').focus();}}
$('authOk').onclick=doAuth;$('authName').addEventListener('keydown',e=>{if(e.key==='Enter')$('authPw').focus();if(e.key==='Escape')$('authNo').click();});$('authPw').addEventListener('keydown',e=>{if(e.key==='Enter')doAuth();if(e.key==='Escape')$('authNo').click();});
$('authNo').onclick=()=>{pendingAuth=null;closeOv('authOv');};
/* نسيت كلمة السر: كلمة سر المدير تعيد كلمة سر النظام إلى الافتراضية أو إلى كلمة جديدة */
$('authForgot').onclick=()=>{const a=pendingAuth;closeOv('authOv');const info=window.desktop.authInfo();$('rsSys').innerHTML=info.map(i=>`<option value="${i.id}"${a&&a.id===i.id?' selected':''}>${esc(i.title)}</option>`).join('');$('rsMaster').value='';$('rsNew').value='';$('rsE').textContent='';openOv('rsOv');setTimeout(()=>$('rsMaster').focus(),50);};
$('rsNo').onclick=()=>closeOv('rsOv');
$('rsOk').onclick=async()=>{const r=await window.desktop.resetPw($('rsSys').value,$('rsMaster').value,$('rsNew').value);
  if(r==='ok'){closeOv('rsOv');flash($('rsNew').value?'تم وضع كلمة السر الجديدة للنظام':'أُعيدت كلمة سر النظام إلى الافتراضية');}else $('rsE').textContent=r==='wait'?'محاولات كثيرة خاطئة، انتظر دقيقة':'كلمة سر المدير غير صحيحة';};
$('bLock').onclick=()=>window.desktop.lockAll().then(()=>{try{window.__whoChip&&window.__whoChip();}catch(_){}flash('تم قفل الأنظمة');});
$('bPw').onclick=()=>{const info=window.desktop.authInfo();$('pwSys').innerHTML=info.map(i=>`<option value="${i.id}">${esc(i.title)}${i.locked?' 🔒':' (بلا كلمة سر)'}</option>`).join('')+'<option value="master">🔑 كلمة سر المدير (لاسترجاع كلمات السر)</option>';$('pwOld').value='';$('pwNew').value='';$('pwE').textContent='';openOv('pwOv');};
$('pwNo').onclick=()=>{closeOv('pwOv');};
$('pwOk').onclick=async()=>{if($('pwSys').value==='master'){const m=await window.desktop.setMaster($('pwOld').value,$('pwNew').value);if(m==='ok'){closeOv('pwOv');flash('تم حفظ كلمة سر المدير');}else $('pwE').textContent=m==='short'?'كلمة سر المدير 6 أحرف أو أرقام على الأقل':m==='wait'?'محاولات كثيرة، انتظر دقيقة':'كلمة سر المدير الحالية غير صحيحة';return;}
  const r=await window.desktop.changePw($('pwSys').value,$('pwOld').value,$('pwNew').value);
  if(r==='ok'){closeOv('pwOv');flash('تم حفظ كلمة السر');}else $('pwE').textContent=r==='wrong'?'كلمة السر الحالية غير صحيحة':r==='wait'?'محاولات كثيرة، انتظر 30 ثانية':'تعذّر الحفظ';};
let syncSt=null;
function syLabel(st){if(!st||st.mode==='off')return ['#9aa','المزامنة معطّلة'];
  if(st.mode==='server')return st.ok===false?['#c0392b','حاسبة القسم: '+st.error]:['#2f8a45','حاسبة القسم تعمل — الحاسبات الأخرى تجدها تلقائياً'];
  if(st.ok===false)return ['#c0392b','غير متصل: '+st.error];if(!st.last)return ['#d19a1a','جارٍ البحث عن حاسبة القسم والاتصال...'];
  return ['#2f8a45','متصل'+(st.found?' بحاسبة القسم'+(st.foundName?' «'+st.foundName+'»':'')+' ('+st.found.split(':')[0]+')':'')+' — آخر مزامنة '+new Date(st.last).toLocaleTimeString('ar-IQ')+(Math.abs(st.skew)>120?' — تنبيه: ساعة هذا الجهاز تختلف عن الخادم بـ '+Math.round(Math.abs(st.skew)/60)+' دقيقة، اضبط الوقت':'')];}
window.desktop.onSync(st=>{syncSt=st;const [c,t]=syLabel(st);$('syDot').style.color=c;$('bSync').title=t;if(!$('syOv').hidden)$('syStat').textContent=t;});
window.desktop.onSyncData(s=>{try{if(window.AnbarReg&&AnbarReg.invalidate)AnbarReg.invalidate();}catch(_){}if(window.onData)window.onData(s);});
function syShow(){const m=$('syMode').value;$('syClient').style.display=m==='client'?'':'none';$('syServerBox').style.display=m==='server'?'':'none';}
$('syMode').onchange=syShow;
/* عنوان حاسبة القسم اليدوي: IPv4 أو اسم حاسبة (مع المنفذ أو بدونه) أو رابط https — لا رقم وحده */
function syAddrOk(t){t=String(t||'').trim();if(!t)return true;if(/^https:\/\//i.test(t)){try{return !!new URL(t).hostname;}catch(_){return false;}}
  const m=t.match(/^([^:\s\/]+)(?::(\d{1,5}))?$/);if(!m||/^\d+$/.test(m[1]))return false;if(/^[\d.]+$/.test(m[1])){const q=m[1].split('.');return q.length===4&&q.every(x=>x!==''&&+x<=255)&&+q[0]!==0;}return true;}
$('bSync').onclick=()=>{const c=window.desktop.syncGet()||{};$('syMode').value=c.mode||'off';$('syName').value=c.name||'';$('syKey').value=c.key||'';$('syServer').value=c.server||'';setTimeout(()=>{if(c.server&&!syAddrOk(c.server)){$('syStat').textContent=`⚠ العنوان اليدوي المحفوظ «${c.server}» غير صالح (${/^\d+$/.test(String(c.server).trim())?'رقم المنفذ لا عنوان الحاسبة':'صيغة خاطئة'}) — امسحه من «إعدادات متقدمة» ليعمل البحث التلقائي، أو اكتب عنوان حاسبة القسم مثل 192.168.1.10`;$('syStat').style.color='#b42318';const d=document.querySelector('#syOv .syadv');if(d)d.open=true;}},60);$('sySecret').value=c.secret||'';$('syPort').value=c.port||47900;
  $('syAddr').textContent=(c.addresses&&c.addresses.length)?'عنوان هذا الجهاز (للإدخال اليدوي عند الحاجة فقط): '+c.addresses.map(a=>a+':'+(c.port||47900)).join('  أو  '):'لم يُعثر على عنوان شبكة لهذا الجهاز. تأكد من الاتصال بالشبكة.';$('syFound').textContent='';
  syShow();$('syStat').textContent=syLabel(syncSt)[1];openOv('syOv');};
$('syNo').onclick=()=>{closeOv('syOv');};
$('syFind').onclick=async()=>{const k=$('syKey').value.trim();if(!k){$('syFound').textContent='اكتب رمز القسم أولاً';return;}$('syFound').textContent='⏳ جارٍ البحث في الشبكة...';
  const L=await window.desktop.syncDiscover(k);$('syFound').innerHTML=L&&L.length?L.map(x=>`<span style="color:#2f8a45">✔ وُجدت: <b>${esc(x.name||'حاسبة القسم')}</b> (${esc(x.address)})</span>`).join('<br>'):'<span style="color:#c0392b">✖ لم يُعثر على حاسبة القسم: تأكد أنها مشغّلة ومضبوطة «حاسبة القسم» بالرمز نفسه، وأنك على الشبكة نفسها.</span>';};
$('syOk').onclick=async()=>{const mode=$('syMode').value;if(mode!=='off'&&!$('syKey').value.trim()){$('syStat').textContent='اكتب رمز القسم';return;}
  {const sv=$('syServer').value.trim();if(sv&&!syAddrOk(sv)){$('syStat').textContent=/^\d+$/.test(sv)?`«${sv}» رقم المنفذ لا عنوان الحاسبة — اكتب عنوان حاسبة القسم مثل 192.168.1.10 (أو اتركه فارغاً للبحث التلقائي).`:`العنوان «${sv}» غير صالح — اكتبه مثل 192.168.1.10 أو 192.168.1.10:47900، أو اتركه فارغاً للبحث التلقائي.`;$('syStat').style.color='#b42318';$('syServer').focus();return;}}
  await window.desktop.syncSet({mode,name:$('syName').value,key:$('syKey').value.trim(),server:$('syServer').value,secret:$('sySecret').value,port:$('syPort').value});flash(mode==='off'?'تم تعطيل المزامنة':'تم تشغيل المزامنة');};
$('syNow').onclick=async()=>{$('syStat').textContent='جارٍ المزامنة...';await window.desktop.syncNow();};
window.desktop.onState(s=>{state=s;markLocks(s.locked);{const cur={dm:'du',cm:'co'}[s.current]||s.current;document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('on',b.dataset.go===cur));}
  $('pg-home').hidden=s.current!=='home';$('pg-sit').hidden=s.current!=='sit';if($('pg-cc'))$('pg-cc').hidden=s.current!=='cc';if($('pg-wf'))$('pg-wf').hidden=s.current!=='wf';if(s.current!=='sit')closeDrawer();
  if(window.onNav)window.onNav(s);});
try{markLocks(window.desktop.authInfo().filter(i=>i.locked).map(i=>i.id));}catch(_){}

/* ===== إرسال المستند المعروض بالبريد (PDF) ===== */
let mlCfg=null;
const bookLines=c=>(c.contacts||[]).map(x=>(x.name?x.name+' - ':'')+x.email).join('\n');
const parseBook=t=>String(t||'').split('\n').map(l=>l.trim()).filter(Boolean).map(l=>{const m=l.match(/[^\s<>,;،]+@[^\s<>,;،]+/);if(!m)return null;return {email:m[0],name:l.replace(m[0],'').replace(/[-–<>:]+\s*$/,'').trim()};}).filter(Boolean);
async function msShow(){mlCfg=await window.desktop.mailGet();$('msUser').value=mlCfg.user||'';$('msPass').value='';$('msPassHint').textContent=mlCfg.hasPass?'(محفوظة — اتركها فارغة للإبقاء عليها)':'(غير محفوظة بعد)';
  $('msName').value=mlCfg.fromName||'';$('msHost').value=mlCfg.host||'';$('msPort').value=mlCfg.port||'';$('msSec').value=mlCfg.secure||'ssl';$('msSig').value=mlCfg.signature||'';$('msBook').value=bookLines(mlCfg);$('msE').textContent='';openOv('msOv');}
const msVals=()=>({user:$('msUser').value.trim(),pass:$('msPass').value,fromName:$('msName').value,host:$('msHost').value.trim(),port:+$('msPort').value||465,secure:$('msSec').value,signature:$('msSig').value,contacts:parseBook($('msBook').value)});
$('msNo').onclick=()=>closeOv('msOv');
$('msOk').onclick=async()=>{mlCfg=await window.desktop.mailSet(msVals());$('msPass').value='';$('msPassHint').textContent=mlCfg.hasPass?'(محفوظة)':'(غير محفوظة بعد)';fillBook();$('msE').style.color='#2f8a45';$('msE').textContent='تم الحفظ.';};
$('msTest').onclick=async()=>{$('msE').style.color='';$('msE').textContent='جارٍ الاختبار... (قد يستغرق حتى دقيقة)';const v=msVals();const r=await window.desktop.mailTest(v);
  if(r.ok&&r.found){$('msHost').value=r.found.host;$('msPort').value=r.found.port;$('msSec').value=r.found.secure;}
  $('msE').style.color=r.ok?'#2f8a45':'#c0392b';$('msE').textContent=r.msg;};
function fillBook(){$('mlBook').innerHTML=((mlCfg&&mlCfg.contacts)||[]).map(x=>`<option value="${esc(x.email)}">${esc(x.name||'')}</option>`).join('');}
$('bMail').onclick=async()=>{const b=$('bMail');b.disabled=true;const old=b.textContent;b.textContent='⏳ تجهيز المستند...';
  try{const r=await window.desktop.mailCapture();if(!r.ok){flash(r.msg,true);return;}
    mlCfg=await window.desktop.mailGet();fillBook();
    $('mlInfo').textContent=`المرفق: ${r.name}.pdf (${Math.max(1,Math.round(r.size/1024))} كيلوبايت)${r.app?' — من نظام '+r.app:''}. المرسِل: ${mlCfg.user||'—'}`;
    $('mlTo').value='';$('mlCc').value='';$('mlSub').value=r.name;$('mlFile').value=r.name;
    $('mlTxt').value='السلام عليكم\nمرفق طياً '+r.name+' بصيغة PDF.'+(mlCfg.signature?'\n\n'+mlCfg.signature:'');$('mlE').textContent='';
    if(!mlCfg.hasPass)$('mlE').textContent='لم تُضبط كلمة مرور البريد بعد — اضغط «إعدادات البريد».';
    openOv('mlOv');setTimeout(()=>$('mlTo').focus(),50);}
  finally{b.disabled=false;b.textContent=old;}};
$('mlNo').onclick=()=>closeOv('mlOv');
$('mlSet').onclick=()=>msShow();
$('mlOk').onclick=async()=>{const to=$('mlTo').value.trim();if(!/@/.test(to)){$('mlE').textContent='أدخل عنوان المرسل إليه.';return;}
  const b=$('mlOk');b.disabled=true;$('mlE').style.color='';$('mlE').textContent='جارٍ الإرسال...';
  const r=await window.desktop.mailSend({to,cc:$('mlCc').value,subject:$('mlSub').value,text:$('mlTxt').value,filename:$('mlFile').value});b.disabled=false;
  if(r.ok){closeOv('mlOv');flash(r.msg);}else{$('mlE').style.color='#c0392b';$('mlE').textContent=r.msg;if(r.needSetup)msShow();}};

/* أوامر قائمة «أدوات» في أعلى النافذة */
if(window.desktop.onCmd)window.desktop.onCmd(c=>{const m={mail:'bMail',sync:'bSync',lock:'bLock',pw:'bPw',folder:'bFolder'};
  if(m[c]){const b=$(m[c]);if(b)b.click();return;}
  if(c==='ccfull'){window.desktop.go('cc').then(()=>setTimeout(()=>{const b=$('ccFull');if(b)b.click();},120));}});
/* التبويبات: عجلة الفأرة تحرّكها أفقياً، والتبويب المفتوح يظهر دائماً */
(function(){const t=$('tabs');if(!t)return;t.addEventListener('wheel',e=>{if(Math.abs(e.deltaY)>Math.abs(e.deltaX)){t.scrollLeft-=e.deltaY;e.preventDefault();}},{passive:false});
  window.desktop.onState(s=>{const b=t.querySelector(`.tab[data-go="${s.current}"]`);if(b&&b.scrollIntoView)b.scrollIntoView({block:'nearest',inline:'nearest'});});})();
