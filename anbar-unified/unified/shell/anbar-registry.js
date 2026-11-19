/* سجل المشاريع المشترك (الموقف الشهري) — نفس الملف مضمَّن في الأنظمة الثلاثة:
   أوامر التغيير (co) · المدد والتوقفات (du) · الاستلام الأولي والنهائي (ac).
   - يستورد الموقف الشهري من xlsx / xlsm / csv / json ويحفظه في ملف مشترك واحد.
   - كل نظام يسحب منه بيانات الشركة والمشروع برقم الاضبارة، ويكتب فيه ملخصاً عن حالة المشروع لديه
     ليراه النظامان الآخران.
   النقل: window.desktop.regLoad/regSave (Electron) ثم /__reg (خادم الاستلام) ثم localStorage. */
(function(){
'use strict';
var LSK='anbar_shared_registry_v1';
var SYS={co:'أوامر التغيير',du:'المدد والتوقفات',ac:'الاستلام',ad:'لجنة تدقيق السلف',fu:'مطالعة لجنة المتابعة',in:'إطلاق التأمينات'};

/* ---------- النقل ---------- */
function tLoad(){
  try{if(window.desktop&&window.desktop.regLoad){var t=window.desktop.regLoad();if(t)return t;if(t===null)return localStorage.getItem(LSK)||null;}}catch(_){}
  try{if(/^https?:$/.test(location.protocol)&&location.hostname==='127.0.0.1'){var x=new XMLHttpRequest();x.open('GET','/__reg',false);x.send();if(x.status===200&&x.responseText)return x.responseText;}}catch(_){}
  try{return localStorage.getItem(LSK)||null;}catch(_){return null;}
}
function tSave(text){
  try{if(window.desktop&&window.desktop.regSave){if(window.desktop.regSave(text))return true;}}catch(_){}
  try{if(/^https?:$/.test(location.protocol)&&location.hostname==='127.0.0.1'){var x=new XMLHttpRequest();x.open('POST','/__reg',false);x.send(text);if(x.status<300)return true;}}catch(_){}
  try{localStorage.setItem(LSK,text);return true;}catch(_){return false;}
}
function blank(){return {app:'anbar-projects-shared',version:1,updated:'',source:'',projects:[],links:{},meta:{},projectsAt:0,metaAt:{},engineers:[],engineersAt:0,parts:{},roster:[],rosterAt:0,rosterSrc:''};}
/* الموقف في الذاكرة: يُعاد قراءته وتحليله فقط إن تغيّر الملف (بصمة سريعة من البرنامج: الحجم ووقت التعديل)، وإلا يُعاد المحفوظ.
   كانت كل قراءة تقرأ الملف كله وتحلله — عدة مرات في كل رسم للصفحة وكل 2.5 ثانية — فيبطئ الموقف والبحث مع الملفات الكبيرة */
var REGC={text:null,stamp:null,s:null};
function regStamp(){try{if(window.desktop&&window.desktop.regStamp)return window.desktop.regStamp();}catch(_){}return null;}
/* فحص تغيّر الملف مرة واحدة كل ربع ثانية على الأكثر (كانت المطابقة لآلاف الملفات تفحصه آلاف المرات في الحفظ الواحد) */
var nowMs=function(){return (window.performance&&performance.now)?performance.now():Date.now();};
function state(){var now=nowMs();if(REGC.s&&now-(REGC.chk||-1e9)<250)return REGC.s;var st=regStamp();if(st!=null&&REGC.s&&st===REGC.stamp){REGC.chk=now;return REGC.s;}var t=tLoad();if(REGC.s&&t===REGC.text){REGC.stamp=st;REGC.chk=now;return REGC.s;}var s=parseState(t);REGC={text:t,stamp:st,s:s,chk:now};return s;}
/* توحيد «برنامج التمويل» في كل المواقف والبرامج والتخطيط (بأسماء الموقف العام المعتمدة):
   الكتابات المختلفة للبرنامج نفسه تُعرض باسم واحد؛ والكتابة الأصلية تُحفظ في fundRaw. ما لا يطابق قاعدة يبقى كما هو. */
var FUND_RULES=[[/^تنميهاقاليمجدوله$/,'تنمية الأقاليم جدول هـ'],[/^تنميهاقاليمو?امنغذائي$/,'تنمية أقاليم - أمن غذائي'],[/^تنميهاقاليم$/,'تنمية الأقاليم'],
  [/^اعاده(ال)?استقرار$/,'إعادة استقرار'],[/^(تشغيلي)?(ال)?منافذ(ال)?حدود?يه$/,'تشغيلي /المنافذ الحدودية'],[/^منافذ(\d{4})$/,'منافذ $1'],
  [/^(ا?ستراتيجيه)?التخفيفمنالفقر$/,'التخفيف من الفقر'],[/^بترودولار$/,'بترودولار'],[/^بترودولارو?امنغذائي$/,'بترودولار - أمن غذائي'],
  [/^(ال)?امن(ال)?غذائي$/,'الأمن الغذائي'],[/^(استثماريه|البرنامجالحكومي)(ال)?جامعاتالمستحدثه$/,'استثمارية/الجامعات المستحدثة']];
function fundKey(v){return RN(v).replace(/[إأآ]/g,'ا').replace(/[\s.،,\-–_\/\\()+]+/g,'').replace(/الاقاليم/g,'اقاليم');}
function fundCanon(v){var raw=String(v==null?'':v).replace(/\s+/g,' ').trim();if(!raw||raw==='0')return '';var k=fundKey(raw);
  for(var i=0;i<FUND_RULES.length;i++){var m=k.match(FUND_RULES[i][0]);if(m)return FUND_RULES[i][1].replace('$1',m[1]||'');}return raw;}
function canonFunds(list){(list||[]).forEach(function(p){if(p&&p.fund){var c=fundCanon(p.fund);if(c!==p.fund){if(!p.fundRaw)p.fundRaw=p.fund;p.fund=c;}}});}
function parseState(t){var s=blank();try{if(t){var d=JSON.parse(t);if(d&&Array.isArray(d.projects)){s.projects=d.projects;s.source=d.source||'';s.updated=d.updated||'';s.links=d.links&&typeof d.links==='object'?d.links:{};s.meta=d.meta&&typeof d.meta==='object'?d.meta:{};s.projectsAt=+d.projectsAt||0;s.metaAt=d.metaAt&&typeof d.metaAt==='object'?d.metaAt:{};s.engineers=Array.isArray(d.engineers)?d.engineers:[];s.engineersAt=+d.engineersAt||0;s.roster=Array.isArray(d.roster)?d.roster:[];s.rosterAt=+d.rosterAt||0;s.rosterSrc=d.rosterSrc||'';s.parts=d.parts&&typeof d.parts==='object'?d.parts:{};}}}catch(_){}try{canonFunds(s.projects);Object.keys(s.parts).forEach(function(c){if(s.parts[c])canonFunds(s.parts[c].projects);});}catch(_){}return s;}
/* الحفظ: إن تغيّر ملف الموقف منذ قراءته (مزامنة أو نافذة أخرى كتبت فيه) لا يُكتب فوقه بنسخة قديمة،
   بل تُنقل تعديلات هذه النافذة وحدها (لكل مشروع ولكل لجنة ولكل ربط نظام) إلى النسخة الأحدث ثم تُحفظ */
function J(x){try{return JSON.stringify(x===undefined?null:x);}catch(_){return '';}}
function mergeStale(mine,base,fresh){var ch=function(a,b){return J(a)!==J(b);};
  ['links','meta','parts'].forEach(function(k){var M=mine[k]||{},B=base[k]||{};fresh[k]=fresh[k]||{};
    Object.keys(M).concat(Object.keys(B)).forEach(function(id){if(k==='links'){var m=M[id]||{},b=B[id]||{};Object.keys(m).concat(Object.keys(b)).forEach(function(sys){if(ch(m[sys],b[sys])){fresh.links[id]=fresh.links[id]||{};if(m[sys]===undefined)delete fresh.links[id][sys];else fresh.links[id][sys]=m[sys];}});}
      else if(ch(M[id],B[id])){if(M[id]===undefined)delete fresh[k][id];else fresh[k][id]=M[id];if(k==='meta'){fresh.metaAt=fresh.metaAt||{};fresh.metaAt[id]=(mine.metaAt||{})[id];}}});});
  if(Object.keys(fresh.parts||{}).length){if(ch(mine.parts,base.parts)){fresh.projects=combineParts(fresh.parts);fresh.projectsAt=Math.max(+fresh.projectsAt||0,+mine.projectsAt||0);fresh.source=mine.source;}}
  else if(ch(mine.projects,base.projects)){fresh.projects=mine.projects;fresh.projectsAt=mine.projectsAt;fresh.source=mine.source;}
  if(ch(mine.engineers,base.engineers)){fresh.engineers=mine.engineers;fresh.engineersAt=mine.engineersAt;}
  if(ch(mine.roster,base.roster)){fresh.roster=mine.roster;fresh.rosterAt=mine.rosterAt;fresh.rosterSrc=mine.rosterSrc;}
  return fresh;}
function put(s){var st=regStamp();if(st!=null&&REGC.stamp!=null&&st!==REGC.stamp&&REGC.text!=null){var t0=tLoad();if(t0&&t0!==REGC.text){try{s=mergeStale(s,parseState(REGC.text),parseState(t0));}catch(_){}}}
  s.updated=new Date().toISOString();var t=JSON.stringify(s),ok=tSave(t);if(ok)REGC={text:t,stamp:regStamp(),s:s,chk:nowMs()};return ok;}
function invalidate(){REGC.chk=-1e9;}

/* ---------- أدوات ---------- */
var esc=function(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});};
var toEn=function(s){return String(s==null?'':s).replace(/[٠-٩]/g,function(d){return d.charCodeAt(0)-1632;}).replace(/[۰-۹]/g,function(d){return d.charCodeAt(0)-1776;}).replace(/٫/g,'.');};
/* الأرقام المكتوبة نصاً: «5,116,123,000» و«5.206.495.000» (النقاط فواصل آلاف إن تكررت) و«٥٬٢٠٦» */
var num=function(s){if(typeof s==='number')return isFinite(s)?s:0;var t=toEn(s).replace(/٬/g,',').replace(/٫/g,'.');if((t.match(/\./g)||[]).length>1)t=t.replace(/\./g,'');var v=parseFloat(t.replace(/[^\d.\-]/g,''));return isNaN(v)?0:v;};
var fmt=function(n){n=Math.round(+n||0);return (n<0?'−':'')+Math.abs(n).toLocaleString('en-US');};
var RN=function(s){return String(s==null?'':s).replace(/[ً-ْـ]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/\s+/g,' ').trim();};

/* ---------- قراءة ملف الموقف ---------- */
var COLS=[['seq',/^ت$/],['fileNo',/رقم الاضبار|^الاضبار/],['name',/^اسم المشروع|^المشروع$/],['contractor',/الشركه المنفذه|المقاول|^الشركه/],['fund',/برنامج التمويل/],
 ['contractNo',/رقم العقد/],['year',/^السنه$/],['sector',/^القطاع|^الجهه المستفيده/],['district',/^القضاء$/],['sub',/^الناحيه$/],
 ['orig',/كلفه المشروع الاصليه|كلفه المشروع التعاقديه|الكلفه التعاقديه|مبلغ العقد|^الكلفه الاصليه/],['changeCost',/كلفه اوامر (التغيير|الغيار)/],['total',/الكلفه الكليه/],
 ['start',/تاريخ المباشره/],['dur',/^مده العقد/],['extra',/المده الاضافيه/],['totalDays',/المده الكليه/],['planEnd',/تاريخ الانجاز المخطط/],
 ['planPct',/نسبه الانجاز المخطط/],['actualPct',/نسبه الانجاز الفعلي/],['status',/تصنيف حاله|^حاله المشروع|^الحاله$/],['legal',/الاجراءات القانونيه/],
 ['advRaised',/السلف المرفوعه/],['advPaid',/السلف المصروفه/],['lat',/^Nالاحداثيات|^خط العرض/],['lng',/^Eالاحداثيات|^خط الطول/],
 ['resident',/^المهندس المقيم/],['residentOffice',/دائره المهندس المقيم|جهه انتساب المقيم|^دائره المقيم/],['supervisor',/^المهندس المشرف|^المشرف$|^مشرف$/],['supervisorOffice',/دائره (المهندس )?المشرف/],['phone',/رقم الهاتف|^الهاتف/],['notes',/^الملاحظات/],['committee',/^اللجنه|ملف الموقف/]];
var NUMS={orig:1,changeCost:1,total:1,dur:1,extra:1,totalDays:1,advRaised:1,advPaid:1};
var DATES={start:1,planEnd:1};
function iso(v){if(v==null||v==='')return '';if(typeof v==='number'||/^\d{5}(\.\d+)?$/.test(String(v))){var n=+v;if(n>20000&&n<80000)return new Date(Date.UTC(1899,11,30)+Math.round(n)*864e5).toISOString().slice(0,10);}
  var s=toEn(v).trim(),m=s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);if(m)return m[1]+'-'+('0'+m[2]).slice(-2)+'-'+('0'+m[3]).slice(-2);
  m=s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);return m?m[3]+'-'+('0'+m[2]).slice(-2)+'-'+('0'+m[1]).slice(-2):'';}
function hashS(t){var h=5381;t=String(t);for(var i=0;i<t.length;i++)h=((h<<5)+h+t.charCodeAt(i))>>>0;return h.toString(36).slice(0,6);}
function rowsToProjects(rows){var hi=-1,map=null,alt={},i,j;
  for(i=0;i<Math.min(rows.length,40)&&hi<0;i++){var m={};alt={};(rows[i]||[]).forEach(function(c,j){var t=RN(c);if(!t)return;for(var k=0;k<COLS.length;k++){if(COLS[k][1].test(t)){if(m[COLS[k][0]]==null)m[COLS[k][0]]=j;else (alt[COLS[k][0]]=alt[COLS[k][0]]||[]).push(j);break;}}});
    if(m.fileNo!=null&&m.name!=null){hi=i;map=m;}else alt={};}
  if(hi<0)return null;var out=[],seen={},used={},hdr=(rows[hi]||[]).map(function(c){return String(c==null?'':c).replace(/\s+/g,' ').trim();});Object.keys(map).forEach(function(k){used[map[k]]=1;});Object.keys(alt).forEach(function(k){alt[k].forEach(function(j){used[j]=1;});});
  for(i=hi+1;i<rows.length;i++){var r=rows[i]||[];var g=function(k){var v=map[k]==null?'':r[map[k]];if((v==null||String(v).trim()==='')&&alt[k])for(var a=0;a<alt[k].length;a++){var w=r[alt[k][a]];if(w!=null&&String(w).trim()!==''){v=w;break;}}return v;};
    var fn=String(toEn(g('fileNo'))).trim(),nm0=String(g('name')==null?'':g('name')).replace(/\s+/g,' ').trim();if(!nm0||/^(المجموع|الاجمالي|الإجمالي|المجموع الكلي)$/.test(RN(nm0)))continue;
    /* مشروع بلا رقم اضبارة: يُضاف برقم مميز ثابت (لا يُهمل) */
    var noFn=!fn||!/\d/.test(fn);if(noFn)fn='بلا رقم-'+hashS(RN(nm0)+'|'+RN(g('district')));
    /* رقم اضبارة مكرر: إن كان المشروع نفسه (الاسم نفسه) يُتجاهل التكرار، وإن كان مشروعاً آخر (قضاء آخر غالباً) يُضاف برقم مميز 123/2 */
    var dupOf='';if(seen[fn]){if(seen[fn][RN(nm0)])continue;var n2=2;while(seen[fn+'/'+n2])n2++;dupOf=fn;fn=fn+'/'+n2;}
    (seen[dupOf||fn]=seen[dupOf||fn]||{})[RN(nm0)]=1;seen[fn]=seen[fn]||{};
    var p={};for(j=0;j<COLS.length;j++){var k=COLS[j][0],v=g(k);
      if(NUMS[k])v=num(v);else if(DATES[k])v=iso(v);else if(k==='actualPct'||k==='planPct')v=typeof v==='number'&&v<=1.5?v*100:num(v);
      else if(k==='lat'||k==='lng')v=v===''?'':String(toEn(v)).trim();else v=String(v==null?'':v).replace(/\s+/g,' ').trim();p[k]=v;}
    if(p.fund){var fc=fundCanon(p.fund);if(fc!==p.fund){p.fundRaw=p.fund;p.fund=fc;}}
    p.fileNo=fn;if(noFn)p.noFileNo=1;if(dupOf)p.fileNoDup=dupOf;var more={};hdr.forEach(function(h,j){if(!h||used[j]||/^ت$/.test(RN(h)))return;var v=r[j];if(v==null||v==='')return;v=typeof v==='number'?String(v):String(v).replace(/\s+/g,' ').trim();if(v)more[h]=v.slice(0,300);});if(Object.keys(more).length)p.more=more;out.push(p);}
  out.score=Object.keys(map).length;
  /* بنية ملف اللجنة (للتصدير بنفس الترتيب): صفوف العنوان فوق الجدول، وعناوين الأعمدة بترتيبها */
  out.layout={titles:Array.from(rows.slice(0,hi)).map(function(rw){var t=(rw||[]).filter(function(c){return c!=null&&String(c).trim()!=='';});return t.length?String(t[0]).replace(/\s+/g,' ').trim():'';}),head:hdr.slice(0,Math.max.apply(null,[0].concat(hdr.map(function(h,j){return h?j+1:0;}))))};
  return out;}

/* ---------- المهندسون والكادر (ورقتا «قائمة المشرفين» و«الكادر الهندسي») ---------- */
function cleanDept(v){var s=String(v==null?'':v).replace(/\s+/g,' ').trim();if(!s)return '';if(/\d{5,}/.test(s.replace(/[\s\-+]/g,'')))return '';if(/^(مشرف|المشرف|المقيم|مقيم|مطابق)/.test(s))return '';if(s.length>40||/[:：]/.test(s))return '';return s;}
var ECOLS=[['name',/^الاسم الكامل|^الاسم$/],['role',/^الصفه$/],['dept',/الدائره/],['phone',/رقم الهاتف|^الهاتف/],['notes',/^ملاحظات/]];
/* خانة مشرف قد تحوي «مشرف: الاسم – الدائرة» أو «مطابق»: يُستخرج منها الاسم والدائرة */
function parsePerson(v){var t=String(v==null?'':v).replace(/\s+/g,' ').trim();if(!t||/^مطابق$/.test(RN(t)))return null;var role='',dept='';
  var m=t.match(/^(مشرف|المشرف|المقيم|مقيم)\s*[:：]\s*(.+)$/);if(m){role=/مقيم/.test(m[1])?'مهندس مقيم':'مهندس مشرف';t=m[2];}
  var q=t.split(/\s*[–—]\s*|\s+-\s+/);if(q.length>1){t=q[0].trim();dept=cleanDept(q.slice(1).join(' – '));}
  return t?{name:t,dept:dept,role:role}:null;}
function phoneFix(v){var s=String(toEn(v==null?'':v)).replace(/[^\d]/g,'');return /^7\d{9}$/.test(s)?'0'+s:s;}
function findHeader(rows,test){for(var i=0;i<Math.min(rows.length,40);i++){var m=test(rows[i]||[]);if(m)return {i:i,m:m};}return null;}
function rowsToEngineers(rows){
  var h=findHeader(rows,function(r){var m={};r.forEach(function(c,j){var t=RN(c);if(!t)return;for(var k=0;k<ECOLS.length;k++){if(m[ECOLS[k][0]]==null&&ECOLS[k][1].test(t)){m[ECOLS[k][0]]=j;break;}}});return m.name!=null&&m.dept!=null&&m.role!=null?m:null;});
  if(!h)return null;var out=[];
  for(var i=h.i+1;i<rows.length;i++){var r=rows[i]||[],g=function(k){return h.m[k]==null?'':r[h.m[k]];},nm=String(g('name')==null?'':g('name')).replace(/\s+/g,' ').trim();if(!nm)continue;
    var role=String(g('role')||'').trim(),rawD=String(g('dept')==null?'':g('dept')).replace(/\s+/g,' ').trim(),dept=cleanDept(rawD),phone=phoneFix(g('phone'));
    if(/^مطابق$/.test(RN(nm)))continue;
    var pm=nm.match(/^(مشرف|المشرف|المقيم|مقيم)\s*[:：]\s*(.+)$/);   // «مشرف: الاسم – الدائرة» داخل خانة الاسم
    if(pm){role=role||(/مقيم/.test(pm[1])?'مهندس مقيم':'مهندس مشرف');var q=pm[2].split(/\s*[–—]\s*|\s+-\s+/);nm=q[0].trim();if(q.length>1&&!dept)dept=cleanDept(q.slice(1).join(' – '));}
    if(!dept&&/^[\d\s+\-]{9,}$/.test(rawD)&&!phone)phone=phoneFix(rawD);   // رقم الهاتف وقع في عمود الدائرة
    if(!nm)continue;
    out.push({name:nm,role:role,dept:dept,phone:phone,notes:String(g('notes')||'').trim()});}
  return out;}
/* خانة فيها أكثر من اسم («فلان / فلان» أو «فلان، فلان») = أكثر من مهندس */
function parsePeople(v){var t=String(v==null?'':v).trim();if(!t)return [];var out=[];t.split(/\s*[\/\n،;؛]\s*/).forEach(function(x){var p=parsePerson(x);if(p&&p.name.length>2)out.push(p);});return out;}
function firstOf(r,cols){for(var i=0;i<cols.length;i++){var v=r[cols[i]];if(v!=null&&String(v).trim()!=='')return v;}return '';}
function rowsToStaff(rows){
  var h=findHeader(rows,function(r){var m={sup:{},sdept:{},rdept:[]};r.forEach(function(c,j){var t=RN(c);if(!t)return;
    if(m.name==null&&/^اسم المشروع/.test(t))m.name=j;else if(m.seq==null&&/^ت$/.test(t))m.seq=j;else if(m.res==null&&/^المهندس المقيم/.test(t))m.res=j;else if(/^دائره المقيم|^جهه انتساب المقيم/.test(t))m.rdept.push(j);
    else{var a=t.match(/^مشرف (\d+)$/);if(a)m.sup[a[1]]=j;var b=t.match(/^(?:دائره المشرف|جهه الانتساب|جهه انتساب المشرف) (\d+)$/);if(b)(m.sdept[b[1]]=m.sdept[b[1]]||[]).push(j);}});
    return m.name!=null&&m.res!=null&&Object.keys(m.sup).length?m:null;});
  if(!h)return null;var out=[];
  for(var i=h.i+1;i<rows.length;i++){var r=rows[i]||[],nm=String(r[h.m.name]==null?'':r[h.m.name]).replace(/\s+/g,' ').trim(),sq=h.m.seq==null?'':String(toEn(r[h.m.seq]==null?'':r[h.m.seq])).trim();
    var st=[],rd=cleanDept(firstOf(r,h.m.rdept));parsePeople(r[h.m.res]).forEach(function(rp){st.push({name:rp.name,dept:rd||rp.dept,role:'مهندس مقيم'});});
    Object.keys(h.m.sup).sort(function(a,b){return a-b;}).forEach(function(n){var sd=cleanDept(firstOf(r,h.m.sdept[n]||[]));parsePeople(r[h.m.sup[n]]).forEach(function(pp){if(!st.some(function(x){return RN(x.name)===RN(pp.name);}))st.push({name:pp.name,dept:sd||pp.dept,role:'مهندس مشرف'});});});
    if(!nm&&!sq)continue;if(!st.length&&!rd)continue;out.push({seq:sq,name:nm,staff:st,rdept:rd});}
  return out;}
/* ورقة الكادر تُربط بالمشاريع باسم المشروع؛ وبالتسلسل «ت» فقط إن كانت الورقة على تسلسل الجدول الرئيسي نفسه
   (أغلب صفوفها المسمّاة تطابق اسم المشروع بالتسلسل نفسه)، لئلا تُنسب ورقة مشرفين لقضاء آخر إلى مشاريع هذا القضاء */
function attachStaff(projects,staff){if(!staff||!staff.length)return;var lists=Array.isArray(staff[0])?staff:[staff],bySeqP={},byNameP={};
  projects.forEach(function(p){if(p.seq)bySeqP[String(p.seq)]=p;byNameP[RN(p.name)]=p;});
  var L=lists.map(function(list){var named=0,same=0,hits=0,byName={},bySeq={};list.forEach(function(x){var k=RN(x.name);if(k){byName[k]=x;if(byNameP[k])hits++;}if(x.seq)bySeq[x.seq]=x;
      if(k&&x.seq){named++;var q=bySeqP[x.seq];if(q&&RN(q.name)===k)same++;}});
    return {byName:byName,bySeq:bySeq,seqOK:named>=3&&same/named>=0.6,score:hits+(named>=3&&same/named>=0.6?list.length:0)};}).sort(function(a,b){return b.score-a.score;});
  projects.forEach(function(p){for(var i=0;i<L.length;i++){var x=L[i].byName[RN(p.name)]||(L[i].seqOK&&p.seq&&L[i].bySeq[String(p.seq)]);if(!x)continue;
    var st=(x.staff||[]).slice();if(!p.residentOffice&&x.rdept)p.residentOffice=x.rdept;
    if(p.resident){var rk=RN(p.resident);st.forEach(function(y){if(y.role==='مهندس مقيم'&&RN(y.name)===rk&&!y.dept)y.dept=cleanDept(p.residentOffice);});}
    if(st.length){p.staff=st;return;}}});}
/* قاعدة المهندسين = «قائمة المشرفين» + أي مهندس يرد في الكادر ولم يرد في القائمة (بدائرته وصفته) */
function buildEngineers(list,projects){var map={},out=[];
  (list||[]).forEach(function(e){var k=RN(e.name);if(!k)return;if(!map[k]){map[k]={name:e.name,role:e.role||'',dept:e.dept||'',phone:e.phone||'',notes:e.notes||''};out.push(map[k]);}else{var m=map[k];m.role=m.role||e.role;m.dept=m.dept||e.dept;m.phone=m.phone||e.phone;}});
  (projects||[]).forEach(function(p){(p.staff||[]).forEach(function(x){var k=RN(x.name);if(!k)return;if(!map[k]){map[k]={name:x.name,role:x.role||'',dept:x.dept||'',phone:'',notes:''};out.push(map[k]);}else{if(!map[k].dept&&x.dept)map[k].dept=x.dept;if(!map[k].role&&x.role)map[k].role=x.role;}});
    var rk=RN(p.resident);if(rk){if(!map[rk]){map[rk]={name:p.resident,role:'مهندس مقيم',dept:p.residentOffice||'',phone:phoneFix(p.phone),notes:''};out.push(map[rk]);}else{if(!map[rk].dept&&p.residentOffice)map[rk].dept=p.residentOffice;if(!map[rk].phone&&p.phone)map[rk].phone=phoneFix(p.phone);}}});
  return out;}
function colIx(ref){var n=0,s=ref.replace(/\d+/g,'');for(var i=0;i<s.length;i++)n=n*26+s.charCodeAt(i)-64;return n-1;}
function inflate(data){
  if(typeof DecompressionStream==='undefined')return Promise.reject(new Error('المتصفح قديم ولا يدعم فك الضغط. احفظ الموقف بصيغة CSV أو استخدم Edge/Chrome حديثاً.'));
  return new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer().then(function(b){return new Uint8Array(b);});}
function unzip(buf){var dv=new DataView(buf),u8=new Uint8Array(buf),td=new TextDecoder(),e=u8.length-22;
  while(e>=0&&dv.getUint32(e,true)!==0x06054b50)e--;if(e<0)return Promise.reject(new Error('ملف Excel غير صالح'));
  var n=dv.getUint16(e+10,true),p=dv.getUint32(e+16,true),out={},jobs=[];
  for(var i=0;i<n;i++){if(dv.getUint32(p,true)!==0x02014b50)break;
    var meth=dv.getUint16(p+10,true),csz=dv.getUint32(p+20,true),nl=dv.getUint16(p+28,true),xl=dv.getUint16(p+30,true),cl=dv.getUint16(p+32,true),lo=dv.getUint32(p+42,true);
    var name=td.decode(u8.subarray(p+46,p+46+nl));p+=46+nl+xl+cl;
    if(!/^xl\/(sharedStrings\.xml|workbook\.xml|_rels\/workbook\.xml\.rels|worksheets\/[^\/]+\.xml)$/.test(name))continue;
    var ds=lo+30+dv.getUint16(lo+26,true)+dv.getUint16(lo+28,true),data=u8.subarray(ds,ds+csz);
    (function(name,meth,data){jobs.push(meth===8?inflate(data).then(function(d){out[name]=td.decode(d);}):Promise.resolve().then(function(){out[name]=td.decode(data);}));})(name,meth,data);}
  return Promise.all(jobs).then(function(){return out;});}
/* ملف أفسده إصدار سابق من «دمج مواقف الأقضية»: نص XML مُهرَّب بعد <f .../> حتى </f> — يُعاد كما كان قبل القراءة */
function unesc(t){return t.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&');}
function sheetRows(xml,ss){xml=xml.replace(/(<f\b[^>]*?\/>)([^<]*?&lt;[^<]*)<\/f>/g,function(m,a,t){return a+unesc(t)+"</f>";});var d=new DOMParser().parseFromString(xml,'text/xml'),rows=[],rs=d.getElementsByTagName('row');
  for(var a=0;a<rs.length;a++){var row=rs[a],ri=+row.getAttribute('r')-1,arr=[],cs=row.getElementsByTagName('c');
    for(var b=0;b<cs.length;b++){var c=cs[b],t=c.getAttribute('t'),v=c.getElementsByTagName('v')[0],val='';
      if(t==='s')val=v?ss[+v.textContent]:'';
      else if(t==='inlineStr')val=Array.prototype.map.call(c.getElementsByTagName('t'),function(x){return x.textContent;}).join('');
      else if(v)val=(t==='str'||t==='b'||t==='e')?v.textContent:parseFloat(v.textContent);
      arr[colIx(c.getAttribute('r'))]=val;}
    rows[ri]=arr;}
  return rows;}
function parseXlsx(buf){return unzip(buf).then(function(z){var ss=[];
  if(z['xl/sharedStrings.xml']){var d=new DOMParser().parseFromString(z['xl/sharedStrings.xml'],'text/xml'),si=d.getElementsByTagName('si');
    for(var i=0;i<si.length;i++){var ts=si[i].getElementsByTagName('t'),s='';for(var j=0;j<ts.length;j++)if(ts[j].parentNode.nodeName!=='rPh')s+=ts[j].textContent;ss.push(s);}}
  var keys=Object.keys(z).filter(function(k){return /worksheets\//.test(k);}).sort(function(a,b){return (parseInt(a.replace(/\D/g,''),10)||0)-(parseInt(b.replace(/\D/g,''),10)||0);}),projects=null,prs=null,engineers=[],staff=null;
  for(var q=0;q<keys.length;q++){var rows=sheetRows(z[keys[q]],ss);
    var pr=rowsToProjects(rows);if(pr&&pr.length)(prs=prs||[]).push(pr);
    var en=rowsToEngineers(rows);if(en&&en.length)engineers=engineers.concat(en);
    var st=rowsToStaff(rows);if(st&&st.length)(staff=staff||[]).push(st);}
  /* كل أوراق المشاريع (ورقة لكل قضاء مثلاً) لا ورقة واحدة: الأوراق ذات أكبر عدد أعمدة معروفة (ومَن يقاربها)، بلا تكرار للمشروع نفسه */
  if(prs){var best=Math.max.apply(null,prs.map(function(x){return x.score;}));projects=[];var have={};
    prs.filter(function(x){return x.score>=best-2&&x.score>=4;}).forEach(function(L){L.forEach(function(p){var raw=p.fileNoDup||p.fileNo,k=RN(p.name);
      var cur=have[raw];if(cur&&cur[k])return;if(cur&&!p.noFileNo){var n2=2;while(have[raw+'/'+n2])n2++;if(!p.fileNoDup){p.fileNoDup=raw;p.fileNo=raw+'/'+n2;}else{p.fileNo=raw+'/'+n2;}}
      (have[raw]=have[raw]||{})[k]=1;have[p.fileNo]=have[p.fileNo]||{};projects.push(p);});});projects.score=best;var L0=prs.filter(function(x){return x.score>=best-2&&x.score>=4;})[0];projects.layout=L0&&L0.layout||null;}
  return {projects:projects,engineers:engineers,staff:staff};});}
/* كل أوراق الملف بأسمائها (لاستمارة أسماء القسم والدوائر وغيرها): [{name, rows}] */
function readSheets(file){var nm=file.name.toLowerCase();
  if(/\.(csv|tsv|txt)$/.test(nm))return file.text().then(function(t){return [{name:file.name.replace(/\.[^.]+$/,''),rows:parseDelim(t)}];});
  if(!/\.(xlsx|xlsm)$/.test(nm))return Promise.reject(new Error('صيغة غير مدعومة. استخدم ملف Excel (xlsx) أو csv'));
  return file.arrayBuffer().then(unzip).then(function(z){var ss=[];
    if(z['xl/sharedStrings.xml']){var d=new DOMParser().parseFromString(z['xl/sharedStrings.xml'],'text/xml'),si=d.getElementsByTagName('si');
      for(var i=0;i<si.length;i++){var ts=si[i].getElementsByTagName('t'),x='';for(var j=0;j<ts.length;j++)if(ts[j].parentNode.nodeName!=='rPh')x+=ts[j].textContent;ss.push(x);}}
    var rel={},out=[];try{var rd=new DOMParser().parseFromString(z['xl/_rels/workbook.xml.rels']||'','text/xml').getElementsByTagName('Relationship');for(var a=0;a<rd.length;a++)rel[rd[a].getAttribute('Id')]=String(rd[a].getAttribute('Target')).replace(/^\/?(xl\/)?/,'xl/');}catch(_){}
    var used={};try{var wb=new DOMParser().parseFromString(z['xl/workbook.xml']||'','text/xml').getElementsByTagName('sheet');
      for(var b=0;b<wb.length;b++){var id=wb[b].getAttribute('r:id')||wb[b].getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id'),path=rel[id];if(path&&z[path]){used[path]=1;out.push({name:wb[b].getAttribute('name')||'',rows:sheetRows(z[path],ss)});}}}catch(_){}
    Object.keys(z).filter(function(k){return /worksheets\/[^/]+\.xml$/.test(k)&&!used[k];}).forEach(function(k){out.push({name:'',rows:sheetRows(z[k],ss)});});
    return out;});}
function setRoster(list,src){var s=state();s.roster=list||[];s.rosterAt=Date.now();s.rosterSrc=src||'';put(s);return s.roster.length;}
function parseDelim(text){var sep=text.indexOf('\t')>=0?'\t':',',rows=[],row=[],cur='',q=false;
  for(var i=0;i<text.length;i++){var ch=text[i];
    if(q){if(ch==='"'){if(text[i+1]==='"'){cur+='"';i++;}else q=false;}else cur+=ch;}
    else if(ch==='"'&&!cur)q=true;else if(ch===sep){row.push(cur);cur='';}
    else if(ch==='\n'||ch==='\r'){if(ch==='\r'&&text[i+1]==='\n')i++;row.push(cur);rows.push(row);row=[];cur='';}else cur+=ch;}
  if(cur||row.length){row.push(cur);rows.push(row);}return rows;}
function readFile(file){var nm=file.name.toLowerCase();
  if(/\.(xlsx|xlsm)$/.test(nm))return file.arrayBuffer().then(parseXlsx);
  if(nm.slice(-5)==='.json')return file.text().then(function(t){var d=JSON.parse(t),a=Array.isArray(d)?d:d.projects;
    return {projects:Array.isArray(a)?a.filter(function(x){return x&&x.fileNo!=null;}).map(function(x){var y={};for(var k in x)y[k]=x[k];y.fileNo=String(x.fileNo);delete y.live;return y;}):null,engineers:Array.isArray(d.engineers)?d.engineers:[],staff:null};});
  if(/\.(csv|tsv|txt)$/.test(nm))return file.text().then(function(t){return {projects:rowsToProjects(parseDelim(t)),engineers:[],staff:null};});
  return Promise.reject(new Error('صيغة غير مدعومة. استخدم xlsx أو xlsm أو csv أو json'));}

/* ---------- توحيد اسم القضاء ----------
   «حديثه/حديثة»، «قضاء حديثة»، «مركز حديثة»، «راوه والقائم»، أو ناحية مكتوبة في عمود القضاء (بروانة ← حديثة) تُرجع إلى اسم القضاء نفسه،
   حتى لا تتوزع مشاريع القضاء الواحد على أكثر من مجموعة. ما لا يُعرف يبقى كما كُتب، وإن كان فارغاً تُجرب الناحية ثم «غير محدد». */
var DIST=['الرمادي','الفلوجة','الكرمة','هيت','حديثة','عنه','راوة','القائم','الرطبة','العامرية','الحبانية','الرمانة'];
var DIST_ALIAS={'عانه':'عنه','عانة':'عنه','البغدادي':'هيت','الفرات':'هيت','كبيسة':'هيت','كبيسه':'هيت','الحقلانية':'حديثة','بروانة':'حديثة','بروانه':'حديثة','الكرابلة':'القائم','العبيدي':'القائم','العبيدى':'القائم','النخيب':'الرطبة','الوليد':'الرطبة','الرحالية':'الرمادي','الوفاء':'الرمادي','الصقلاوية':'الفلوجة','الخالدية':'الحبانية','عامرية الفلوجة':'العامرية','حصيبة':'القائم','الحصيبة':'القائم','الطاش':'الرمادي','البو عبيد':'الرمادي','الثرثار':'الفلوجة','الكرمه':'الكرمة'};
var dk=function(t){return RN(t).replace(/^ال/,'').replace(/ي$/,'ي').replace(/\s+/g,'');};
var DIST_IDX=null;function distIdx(){if(DIST_IDX)return DIST_IDX;DIST_IDX={};DIST.forEach(function(d){DIST_IDX[dk(d)]=d;});Object.keys(DIST_ALIAS).forEach(function(k){DIST_IDX[dk(k)]=DIST_ALIAS[k];});return DIST_IDX;}
function districtOf(p){var I=distIdx(),look=function(v){var t=String(v==null?'':v).replace(/\s+/g,' ').trim();if(!t)return '';
    var full=dk(t.replace(/^(قضاء|ناحية|ناحيه|مركز|مركز قضاء)\s+/,''));if(I[full])return I[full];
    var parts=t.split(/\s*(?:[\/،,\-–]|\s و|\sو(?=\S))\s*/);for(var i=0;i<parts.length;i++){var q=parts[i].replace(/^و(?=ال)/,'').replace(/^(قضاء|ناحية|ناحيه|مركز)\s+/,'');if(I[dk(q)])return I[dk(q)];}
    var w=t.split(/\s+/);for(var j=0;j<w.length;j++){var x=w[j].replace(/^و(?=ال)/,'');if(x.length>2&&I[dk(x)])return I[dk(x)];}return '';};
  if(!p)return 'غير محدد';var d=look(p.district);if(d)return d;var s2=look(p.sub);if(s2)return s2;
  var raw=String(p.district||'').replace(/^\s*(قضاء|ناحية|ناحيه)\s+/,'').replace(/\s+/g,' ').trim();return raw||'غير محدد';}

/* ---------- الواجهة العامة ---------- */
function find(fn){if(fn==null||fn==='')return null;var s=String(fn),P=state().projects;for(var i=0;i<P.length;i++)if(String(P[i].fileNo)===s)return P[i];return null;}
function label(p){return p.fileNo+' | '+p.name+' | '+(p.contractor||'');}
function findByLabel(v){v=String(v||'').trim();if(!v)return null;var fn=v.split('|')[0].trim(),p=find(fn);if(p)return p;var P=state().projects,k=RN(v);
  for(var i=0;i<P.length;i++)if(RN(label(P[i]))===k)return P[i];return null;}
/* ---------- موقف متراكم من مواقف اللجان ----------
   لكل لجنة جزء خاص بها في الموقف (parts[اللجنة] = {at, projects, source}). استيراد موقف لجنة يستبدل جزأها وحدها،
   وتبقى أجزاء اللجان الأخرى؛ والموقف الكامل = كل الأجزاء مجتمعة (المشروع المكرر بالرقم والاسم نفسيهما يُؤخذ من الجزء الأحدث،
   ورقم الاضبارة المكرر لمشروع آخر يُميَّز 123/2). الخوارزمية نفسها في sync.js لتطابق النتيجة على كل الأجهزة. */
var MONTHS=/^(كانون|شباط|اذار|آذار|نيسان|ايار|أيار|حزيران|تموز|اب|آب|ايلول|أيلول|تشرين|الاول|الأول|الثاني|يناير|فبراير|مارس|ابريل|أبريل|مايو|يونيو|يوليو|اغسطس|أغسطس|سبتمبر|اكتوبر|أكتوبر|نوفمبر|ديسمبر|شهر|لشهر|لغاية|حتى)$/;
function committeeKey(fileName,list){var t=String(fileName||'').replace(/\.(xlsx|xlsm|csv|json)$/i,'').replace(/[_\-–—()\[\]]+/g,' ').replace(/\d+/g,' ');
  var w=t.split(/\s+/).filter(Boolean);for(var i=0;i<w.length;i++){var x=w[i].replace(/^و(?=ال)/,'');var d=distIdx()[dk(x)];if(d)return d;if(i+1<w.length){var d2=distIdx()[dk(x+' '+w[i+1])];if(d2)return d2;}}
  var rest=w.filter(function(x){return !/^(موقف|الموقف|نموذج|مشاريع|المشاريع|لجنه|اللجنه|لجنة|اللجنة|متابعة|المتابعة|قسم|الشؤون|الهندسية|محافظة|الانبار|الأنبار|نسخة|المدمج|مدمج|قضاء|ناحية|النهائي|المحدث|copy|final)$/i.test(x)&&!MONTHS.test(x);}).join(' ').trim();
  if(rest.length>=2&&/[\u0600-\u06FF]/.test(rest))return rest;
  var c={};(list||[]).forEach(function(p){var d=districtOf(p);c[d]=(c[d]||0)+1;});var best=Object.keys(c).sort(function(a,b){return c[b]-c[a];})[0];return best||'الموقف';}
function combineParts(parts){var keys=Object.keys(parts||{}).filter(function(k){return parts[k]&&!parts[k].removed&&Array.isArray(parts[k].projects);}).sort(function(a,b){return a<b?-1:a>b?1:0;});
  /* المشروع نفسه: رقم الاضبارة نفسه مع الاسم نفسه أو القضاء نفسه (أو قضاء غير مكتوب)؛ وغير ذلك مشروع آخر في قضاء آخر */
  var dkk=function(p){return RN(p.district).replace(/^(قضاء|ناحيه|ناحية)\s+/,'').replace(/^ال/,'').replace(/\s+/g,'');};
  var same=function(a,b){if(RN(a.name)===RN(b.name))return true;var x=dkk(a),y=dkk(b);return !x||!y||x===y;};
  /* المشروع في أكثر من موقف: يبقى من الموقف الأحدث تحميلاً في البرنامج (وقت الاستيراد، على أي حاسبة، ويصل بالمزامنة) — باختيار القسم */
  var rk=function(k){return [+parts[k].at||0];};
  var better=function(a,b){for(var i=0;i<a.length;i++)if(a[i]!==b[i])return a[i]>b[i];return false;};
  var groups={},kept=[];keys.forEach(function(k){var R=rk(k);parts[k].projects.forEach(function(p){var base=String(p.fileNoDup||p.fileNo),G=groups[base]=groups[base]||[],e=null;
    if(!p.noFileNo)for(var i=0;i<G.length;i++){if(same(G[i].p,p)){e=G[i];break;}}
    if(e){if(better(R,e.r)){e.p=p;e.k=k;e.r=R;}}else{e={p:p,k:k,r:R,base:base};G.push(e);kept.push(e);}});});
  var out=[],used={};kept.forEach(function(e){var p=e.p,q={};for(var f in p)q[f]=p[f];q.committee=q.committee||e.k;var fn=e.base,n=2;if(!p.noFileNo){while(used[fn]){fn=e.base+'/'+n;n++;}}q.fileNo=fn;if(fn!==e.base)q.fileNoDup=e.base;else delete q.fileNoDup;used[fn]=1;out.push(q);});
  return out;}
function partsFromLegacy(s){var g={};(s.projects||[]).forEach(function(p){var c=p.committee||districtOf(p);(g[c]=g[c]||[]).push(p);});var o={};Object.keys(g).forEach(function(c){o[c]={at:+s.projectsAt||1,projects:g[c],source:s.source||''};});return o;}
function partsList(){var P=state().parts||{};return Object.keys(P).filter(function(k){return P[k]&&!P[k].removed;}).map(function(k){return {committee:k,n:(P[k].projects||[]).length,at:+P[k].at||0,source:P[k].source||''};}).sort(function(a,b){return a.committee<b.committee?-1:1;});}
function removePart(c){var s=state();if(!s.parts||!s.parts[c])return false;s.parts[c]={at:Date.now(),removed:true,projects:[]};s.projects=combineParts(s.parts);s.projectsAt=Date.now();return put(s);}

/* الاستيراد دمج لا استبدال: المشاريع الجديدة تُضاف في أعلى القائمة، والمكرر (نفس رقم الاضبارة) يُحذف قديمه ويُستبدل بالجديد،
   وبقية المشاريع الموجودة تبقى. opts.replaceAll=true يمسح الموقف القديم ويستورد الملف وحده. ينطبق نفسه على المهندسين (بالاسم). */
function importFile(file,opts){opts=opts||{};return readFile(file).then(function(res){
  var pr=res&&res.projects;
  if(!pr||!pr.length)throw new Error('لم أجد جدول المشاريع. تأكد من وجود عمودي «رقم الاضبارة» و«اسم المشروع» في صف العناوين.');
  attachStaff(pr,res.staff);
  /* اللجنة (ملف الموقف): من عمود «اللجنة» في الموقف المدمج، وإلا من اسم الملف المستورد */
  var fileCom=committeeKey(file.name,pr);
  pr.forEach(function(p){if(!p.committee)p.committee=fileCom;});
  var s=state(),old=opts.replaceAll?[]:s.projects,inc={},added=0,replaced=0,oldIdx={};
  /* جزء كل لجنة: من عمود «اللجنة» في الموقف المدمج، وإلا لجنة واحدة من اسم الملف (أو قضائها الغالب) */
  old.forEach(function(p){oldIdx[String(p.fileNo)]=p;});
  /* نفس رقم الاضبارة لمشروع آخر (اسم مختلف وقضاء مختلف) لا يستبدل القديم: يُضاف برقم مميز */
  var same=function(a,b){return RN(a.name)===RN(b.name)||(RN(a.district)&&RN(a.district)===RN(b.district));},dups=0,noFile=0;
  pr.forEach(function(p){var o=oldIdx[String(p.fileNo)];if(o&&!same(o,p)){var raw=p.fileNoDup||String(p.fileNo),n2=2;while(oldIdx[raw+'/'+n2]||pr.some(function(x){return x!==p&&String(x.fileNo)===raw+'/'+n2;}))n2++;p.fileNoDup=raw;p.fileNo=raw+'/'+n2;}
    if(p.fileNoDup)dups++;if(p.noFileNo)noFile++;});
  pr.forEach(function(p){inc[String(p.fileNo)]=1;if(oldIdx[String(p.fileNo)]){replaced++;if(!p.staff&&oldIdx[String(p.fileNo)].staff)p.staff=oldIdx[String(p.fileNo)].staff;}else added++;});
  if(opts.replaceAll)s.parts={};else if(!s.parts||!Object.keys(s.parts).length)s.parts=partsFromLegacy(s);
  var now=Date.now(),grp={};pr.forEach(function(p){(grp[p.committee]=grp[p.committee]||[]).push(p);});
  var lay=pr.layout||null;Object.keys(grp).forEach(function(c){s.parts[c]={at:now,projects:grp[c],source:file.name};if(lay)s.parts[c].layout=lay;});
  s.projects=combineParts(s.parts);
  /* مشاريع هذا الملف التي بقيت ببيانات موقف لجنة أحدث (الملف المستورد أقدم) */
  var keptBy={};pr.forEach(function(p){var q=null;for(var i=0;i<s.projects.length;i++){var x=s.projects[i];if(String(x.fileNoDup||x.fileNo)===String(p.fileNoDup||p.fileNo)&&RN(x.name)===RN(p.name)){q=x;break;}}
    if(q&&q.committee&&q.committee!==p.committee)keptBy[q.committee]=(keptBy[q.committee]||0)+1;});
  var inE=buildEngineers(res.engineers,pr),eOld=opts.replaceAll?[]:s.engineers,eMap={},eAdd=0,eRep=0,eOldIdx={};
  eOld.forEach(function(e){eOldIdx[RN(e.name)]=e;});inE.forEach(function(e){eMap[RN(e.name)]=1;if(eOldIdx[RN(e.name)]){eRep++;var o=eOldIdx[RN(e.name)];e.phone=e.phone||o.phone;e.dept=e.dept||o.dept;e.role=e.role||o.role;}else eAdd++;});
  s.engineers=inE.concat(eOld.filter(function(e){return !eMap[RN(e.name)];}));
  s.source=file.name;s.projectsAt=now;s.engineersAt=now;
  if(!put(s))throw new Error('تعذّر حفظ الموقف');
  return {total:s.projects.length,imported:pr.length,added:added,replaced:replaced,dups:dups,noFile:noFile,committees:Object.keys(grp),keptNewer:keptBy,engineers:{total:s.engineers.length,added:eAdd,replaced:eRep}};});}
function engineers(){return state().engineers||[];}
/* المهندسون المشرفون ودوائرهم: من ورقة «قائمة المشرفين»/«الكادر» (مشرف 1..n) وإلا من عمودي المشرف ودائرته في جدول المشاريع */
function supervisors(fileNo){var p=find(fileNo);if(!p)return [];var out=[],seen={};
  (p.staff||[]).forEach(function(x){if(/مشرف/.test(x.role||'')&&x.name&&!seen[RN(x.name)]){seen[RN(x.name)]=1;out.push({name:x.name,dept:cleanDept(x.dept)});}});
  if(!out.length&&p.supervisor){String(p.supervisor).split(/[\n،;؛]+/).forEach(function(n,i){n=n.trim();if(n&&!seen[RN(n)]){seen[RN(n)]=1;out.push({name:n,dept:i===0?cleanDept(p.supervisorOffice):''});}});}
  return out;}
function supText(fileNo,deptOnly){var L=supervisors(fileNo);if(deptOnly){var d=[];L.forEach(function(x){if(x.dept&&d.indexOf(x.dept)<0)d.push(x.dept);});return d.join('، ');}
  return L.map(function(x){return x.name+(x.dept?' ('+x.dept+')':'');}).join('، ');}
function residentText(p){return p?(p.resident||'')+(p.resident&&p.residentOffice?' ('+cleanDept(p.residentOffice)+')':''):'';}
function staffOf(fileNo){var p=find(fileNo);return p&&p.staff?p.staff:[];}
/* ربط نظام كامل بالموقف دفعة واحدة (قراءة وحفظ مرة واحدة): list = [{fileNo, data}] لمشاريع الموقف فقط؛
   ويُحذف ربط هذا النظام عن أي مشروع لم يعد في القائمة (ملف حُذف أو فُك ربطه) */
/* مصدر الكتابة (لكل برنامج على كل حاسبة رقم ثابت) ووقت البيانات:
   ملخص النظام في الموقف يُختم بوقت آخر تعديل لبياناته (x.at) لا بوقت الحفظ، ولا يكتب برنامجٌ ملخصاً أقدم فوق ملخص أحدث كتبه برنامج آخر
   (حاسبة أخرى لم تصلها السلفة الجديدة بعد، أو نسخة مستقلة قديمة من النظام تشارك ملف الموقف) — كانت تُرجع الموقف إلى بيانات قديمة */
var SRC=(function(){try{var k='anbar-reg-src',v=localStorage.getItem(k);if(!v){v=Math.random().toString(36).slice(2,10)+Date.now().toString(36);localStorage.setItem(k,v);}return v;}catch(_){return 'x';}})();
function setLinks(sys,list){if(!SYS[sys])return 0;var s=state(),ch=0,keep={},now=new Date().toISOString();
  (list||[]).forEach(function(x){var fn=String(x.fileNo||'');if(!fn||!find(fn))return;keep[fn]=1;var L=s.links[fn]=s.links[fn]||{},cur=L[sys],old=cur?JSON.parse(JSON.stringify(cur)):null;if(old){delete old.at;delete old.src;}
    if(old&&JSON.stringify(old)===JSON.stringify(x.data))return;
    var at=x.at&&!isNaN(Date.parse(x.at))?new Date(Math.min(Date.parse(x.at),Date.now())).toISOString():now;
    if(cur&&cur.src&&cur.src!==SRC&&x.at&&Date.parse(cur.at)>Date.parse(at))return;   // ملخص أحدث من مصدر آخر: يبقى
    var n={};for(var k in x.data)n[k]=x.data[k];n.at=at;n.src=SRC;L[sys]=n;ch++;});
  /* لا يُحذف ملخص كتبه مصدر آخر (برنامج على حاسبة أخرى أو نسخة أخرى) لمجرد أن بيانات هذا البرنامج لا تحوي المشروع */
  Object.keys(s.links).forEach(function(fn){var c=s.links[fn]&&s.links[fn][sys];if(c&&!keep[fn]&&(!c.src||c.src===SRC)){delete s.links[fn][sys];ch++;}});
  if(ch)put(s);return ch;}
/* مطابقة ملف نظام بمشروع في الموقف: برقم الاضبارة، وإلا باسم المشروع (بعد توحيد الكتابة) — مع رقم العقد إن وُجد في الطرفين */
var MIDX={key:null,byName:null};
function matchProject(fileNo,name,contractNo){var S=state();if(fileNo){var p=find(fileNo);if(p)return p;}var k=RN(name||'').replace(/[^\u0621-\u064a0-9]/g,'');if(k.length<6)return null;
  if(MIDX.key!==S.updated){MIDX={key:S.updated,byName:{},memo:{}};S.projects.forEach(function(q){var kk=RN(q.name||'').replace(/[^\u0621-\u064a0-9]/g,'');(MIDX.byName[kk]=MIDX.byName[kk]||[]).push(q);});}
  var L=MIDX.byName[k]||[];if(L.length>1&&contractNo){var c=String(contractNo).replace(/\D/g,'');var f=L.filter(function(q){return String(q.contractNo||'').replace(/\D/g,'')===c;});if(f.length)L=f;}
  var mk=k+'|'+String(contractNo||'');if(!L.length&&contractNo&&MIDX.memo&&(mk in MIDX.memo))return MIDX.memo[mk];   // نتيجة محفوظة: لا يُعاد مسح كل المشاريع عند كل حفظ
  if(!L.length&&contractNo){/* الاسم مكتوب بصيغة أخرى («البوخليفة» / «البو خليفة»): رقم العقد نفسه + اسم مشابه، إن كان مشروعاً واحداً */
    var n1=function(v){return (String(v==null?'':v).match(/\d+/)||[''])[0].replace(/^0+/,'');},cn=n1(contractNo);if(cn){L=S.projects.filter(function(q){return n1(q.contractNo)===cn&&nameSim(k,RN(q.name||'').replace(/[^\u0621-\u064a0-9]/g,''))>=0.6;});}}
  var res=L.length===1?L[0]:null;if(contractNo&&MIDX.memo&&!(MIDX.byName[k]||[]).length)MIDX.memo[mk]=res;return res;}
function nameSim(a,b){if(!a||!b)return 0;if(a===b)return 1;var g=function(s){var m={};for(var i=0;i<s.length-1;i++){var t=s.substr(i,2);m[t]=(m[t]||0)+1;}return m;},A=g(a),B=g(b),x=0;for(var t in A)x+=Math.min(A[t],B[t]||0);return 2*x/Math.max(1,a.length+b.length-2);}
function setLink(sys,fileNo,data){if(!fileNo||!SYS[sys])return false;var s=state(),L=s.links[fileNo]=s.links[fileNo]||{},old=L[sys]?JSON.parse(JSON.stringify(L[sys])):null;
  if(old)delete old.at;if(old&&JSON.stringify(old)===JSON.stringify(data))return false;
  var n={};for(var k in data)n[k]=data[k];n.at=new Date().toISOString();L[sys]=n;return put(s);}
function dropLink(sys,fileNo){var s=state();if(s.links[fileNo]&&s.links[fileNo][sys]){delete s.links[fileNo][sys];put(s);}}
function links(fileNo){return state().links[fileNo]||{};}
/* بيانات طرفي العقد لملحق العقد (المحافظ، مدير الشركة، عنوانها...): تُدخل مرة واحدة وتُشارَك بين الأنظمة */
function getMeta(fileNo){return (state().meta||{})[fileNo]||{};}
/* بيانات طرفي العقد لعدة مشاريع دفعة واحدة (حفظ واحد) */
function setMetas(list){var s=state(),ch=0;(list||[]).forEach(function(x){var fn=x&&x.fileNo,obj=x&&x.data;if(!fn||!obj)return;var m=s.meta[fn]||{},c=false,k;
  for(k in obj){var v=obj[k];if(v==null||typeof v==='object'||v==='')continue;if(m[k]!==v){m[k]=v;c=true;}}if(c){s.meta[fn]=m;s.metaAt[fn]=Date.now();ch++;}});if(ch)put(s);return ch;}
/* حذف مفاتيح من بيانات المشاريع (مثل تصحيح السلف من ملف المالية) */
function dropMetaKeys(keys){var s=state(),ch=0;Object.keys(s.meta||{}).forEach(function(fn){var m=s.meta[fn],c=false;(keys||[]).forEach(function(k){if(m&&Object.prototype.hasOwnProperty.call(m,k)){delete m[k];c=true;}});if(c){s.metaAt[fn]=Date.now();ch++;}});if(ch)put(s);return ch;}
function setMeta(fileNo,obj){if(!fileNo||!obj)return false;var s=state(),m=s.meta[fileNo]||{},ch=false,k;
  for(k in obj){var v=obj[k];if(v==null||typeof v==='object'||v==='')continue;if(m[k]!==v){m[k]=v;ch=true;}}
  if(!ch)return false;s.meta[fileNo]=m;s.metaAt[fileNo]=Date.now();return put(s);}

var DU_ST={stop:'متوقف',over:'انتهت مدة العقد',pend:'بانتظار قرار',p25:'تجاوز 25%',run:'جارٍ',miss:'بيانات ناقصة'};
function linkLines(sys,fileNo){var L=links(fileNo),out=[];
  if(sys!=='co'&&L.co){var c=L.co;out.push('<b>أوامر التغيير:</b> '+c.orders+' أمر، صافي '+fmt(c.changeCost)+' دينار، مدد '+fmt(c.extraDays)+' يوم'+(c.exceeds?' — <span class="ar-bad">يتجاوز الحدود</span>':''));}
  if(sys!=='du'&&L.du){var d=L.du;out.push('<b>المدد والتوقفات:</b> '+(DU_ST[d.status]||d.status||'')+(d.ext?'، مدد ممنوحة '+fmt(d.ext)+' يوم':'')+(d.stp?'، توقف '+fmt(d.stp)+' يوم':'')+(d.openDays?'، متوقف منذ '+fmt(d.openDays)+' يوم':'')+(d.curEnd?'، انتهاء العقد '+esc(d.curEnd):''));}
  if(sys!=='ad'&&L.ad){var a=L.ad;out.push('<b>السلف:</b> '+a.count+' سلفة، التراكمي '+fmt(a.cumulative)+' دينار ('+(Math.round(a.pct*10)/10)+'% من الكلفة)');}
  if(sys!=='in'&&L.in){var n=L.in;out.push('<b>إطلاق التأمينات:</b> '+(n.done?'صادرة':'مسودة')+(n.orderNo?' — أمر الاستلام النهائي '+esc(n.orderNo):'')+(n.maintTo?' — الصيانة حتى '+esc(n.maintTo):''));}
  if(sys!=='ac'&&L.ac&&L.ac.records){L.ac.records.forEach(function(r){out.push('<b>'+esc(r.typeLabel)+' '+esc(r.serial)+':</b> '+esc(r.statusLabel||'')+(r.mEnd?' — الصيانة حتى '+esc(r.mEnd):''));});}
  return out;}
function css(){if(document.getElementById('ar-css'))return;var st=document.createElement('style');st.id='ar-css';
  st.textContent='.ar-box{border:1.5px dashed #3f8a45;border-radius:10px;padding:10px 12px;margin:0 0 12px;background:rgba(63,138,69,.07);font:inherit;line-height:1.7}'+
  '.ar-box b.ar-t{font-size:1.02em}.ar-row{display:flex;gap:6px;margin-top:6px;flex-wrap:wrap;align-items:center}.ar-row input{flex:1;min-width:200px;padding:6px 8px;border:1px solid #9aa;border-radius:8px;font:inherit;background:#fff;color:#111}'+
  '.ar-btn{border:1px solid #9aa;background:#fff;color:#111;border-radius:8px;padding:5px 12px;font:inherit;font-size:.92em;cursor:pointer}.ar-btn.p{background:#2f6b34;border-color:#2f6b34;color:#fff}'+
  '.ar-note{margin:6px 0 0;font-size:.9em;opacity:.85}.ar-bad{color:#b42318;font-weight:700}.ar-lines{margin:6px 0 0;padding:6px 10px;border-top:1px solid rgba(0,0,0,.12);font-size:.92em}.ar-lines div{margin:2px 0}@media print{.ar-box{display:none!important}}';
  document.head.appendChild(st);}
var flashFn=function(m,bad){try{if(typeof window.flash==='function')return window.flash(m,bad);if(typeof window.toast==='function')return window.toast(m,bad);}catch(_){}try{alert(m);}catch(_){}};
function pickFile(done,replaceAll){var inp=document.createElement('input');inp.type='file';inp.accept='.xlsx,.xlsm,.csv,.tsv,.txt,.json';
  inp.onchange=function(){var f=inp.files[0];if(!f)return;importFile(f,{replaceAll:!!replaceAll}).then(function(r){flashFn((replaceAll?'(بعد مسح الموقف القديم) ':'')+'تم استيراد «'+f.name+'»: '+r.added+' مشروع جديد أُضيف، '+r.replaced+' مكرر استُبدل بالجديد، والإجمالي '+r.total+' مشروع'+(r.dups?' — '+r.dups+' مشروعاً برقم اضبارة مكرر لمشروع آخر أُضيفت برقم مميز (مثل 123/2)':'')+(r.noFile?' — '+r.noFile+' مشروعاً بلا رقم اضبارة أُضيفت':'')+(r.engineers.total?' — المهندسون: '+r.engineers.total:'')+(r.keptNewer&&Object.keys(r.keptNewer).length?' — ⚠ بقيت بيانات أحدث لمواقف لجان: '+Object.keys(r.keptNewer).map(function(c){return c+' ('+r.keptNewer[c]+')';}).join('، '):''));done();}).catch(function(e){flashFn('تعذّر قراءة الملف: '+(e&&e.message||e),true);});};inp.click();}
/* opts: system, fileNo, onPick(project), homeOnly (استيراد فقط بدون اختيار مشروع) */
function mount(el,opts){if(!el)return;css();opts=opts||{};var sys=opts.system;
  function draw(){var s=state(),cur=opts.fileNo?find(opts.fileNo):null,h;
    if(!s.projects.length){h='<b class="ar-t">الموقف الشهري</b><p class="ar-note">لم يُستورد الموقف بعد. استورده مرة واحدة (xlsx أو xlsm) فتقرأ منه الأنظمة الثلاثة أسماء الشركات وبيانات العقود.</p><div class="ar-row"><button type="button" class="ar-btn p" data-ar="imp">استيراد الموقف الشهري</button></div>';}
    else{h='<b class="ar-t">الموقف الشهري</b> <span class="ar-note">'+s.projects.length+' مشروع — «<bdi dir="ltr">'+esc(s.source)+'</bdi>» — <bdi dir="ltr">'+esc(String(s.updated).slice(0,10))+'</bdi></span>';
      if(!opts.homeOnly){h+='<div class="ar-row"><input data-ar="pick" list="ar-list" placeholder="اكتب رقم الاضبارة أو اسم المشروع أو الشركة" autocomplete="off" value="'+(cur?esc(label(cur)):'')+'"><datalist id="ar-list">'+s.projects.map(function(p){return '<option value="'+esc(label(p))+'">';}).join('')+'</datalist>'+
        (opts.fileNo&&cur?'<button type="button" class="ar-btn" data-ar="pull" title="إعادة سحب البيانات من الموقف">تحديث من الموقف</button>':'')+'<button type="button" class="ar-btn" data-ar="imp" title="الجديد يُضاف فوق المشاريع الموجودة، والمكرر يُستبدل بالجديد">استيراد ملف موقف (يُضاف فوق الموجود)</button></div>';
        if(opts.fileNo){h+='<p class="ar-note">'+(cur?'مرتبط بالاضبارة '+esc(cur.fileNo)+(cur.status?' — حالة المشروع: '+esc(cur.status):'')+(cur.actualPct!==''&&cur.actualPct!=null?' — الإنجاز الفعلي '+Math.round(cur.actualPct*10)/10+'%':'')+(cur.changeCost?' — كلفة أوامر التغيير في الموقف '+fmt(cur.changeCost)+' دينار':'')+(cur.extra?'، المدة الإضافية '+fmt(cur.extra)+' يوم':''):'الاضبارة '+esc(opts.fileNo)+' غير موجودة في الموقف الحالي.')+'</p>';
          var ls=linkLines(sys,opts.fileNo);if(ls.length)h+='<div class="ar-lines">'+ls.map(function(x){return '<div>'+x+'</div>';}).join('')+'</div>';}
        else h+='<p class="ar-note">اختر المشروع فتُملأ بياناته (الشركة والعقد والمبلغ والمدة والموقع...) تلقائياً من الموقف.</p>';}
      else h+='<div class="ar-row"><button type="button" class="ar-btn" data-ar="imp" title="الجديد يُضاف فوق المشاريع الموجودة، والمكرر (نفس رقم الاضبارة) يُستبدل بالجديد">استيراد ملف موقف (يُضاف فوق الموجود)</button><button type="button" class="ar-btn" data-ar="impall" title="يمسح الموقف القديم كله ويستورد الملف وحده">استيراد وإحلال كامل</button></div>';}
    el.className=(el.className.replace(/\bar-box\b/,'')+' ar-box').trim();el.innerHTML=h;
    var b;if((b=el.querySelector('[data-ar=imp]')))b.onclick=function(){pickFile(function(){if(opts.onImported)opts.onImported();draw();});};
    if((b=el.querySelector('[data-ar=impall]')))b.onclick=function(){if(!confirm('سيُمسح الموقف الشهري القديم (المشاريع وقاعدة المهندسين) ويُستبدل بمحتوى الملف الجديد وحده. أنصح بالاستيراد العادي الذي يُضيف فوق الموجود. متابعة؟'))return;pickFile(function(){if(opts.onImported)opts.onImported();draw();},true);};
    if((b=el.querySelector('[data-ar=pull]')))b.onclick=function(){var p=find(opts.fileNo);if(p&&opts.onPick)opts.onPick(p,true);};
    if((b=el.querySelector('[data-ar=pick]')))b.onchange=function(){var p=findByLabel(b.value);if(!p){if(b.value)flashFn('لم أجد هذا المشروع في الموقف',true);return;}
      if(opts.fileNo&&String(opts.fileNo)!==String(p.fileNo)&&!confirm('سيُربط هذا الملف بمشروع آخر وتُستبدل بياناته ببيانات المشروع المختار. متابعة؟')){b.value=cur?label(cur):'';return;}
      opts.fileNo=String(p.fileNo);if(opts.onPick)opts.onPick(p,false);draw();};}
  draw();}

function fieldOf(h){var t=RN(h);if(!t)return '';for(var k=0;k<COLS.length;k++)if(COLS[k][1].test(t))return COLS[k][0];return '';}
window.AnbarReg={dropMetaKeys:dropMetaKeys,fundCanon:fundCanon,fieldOf:fieldOf,layouts:function(){var P=state().parts||{};var o={};Object.keys(P).forEach(function(k){if(P[k]&&!P[k].removed&&P[k].layout)o[k]=P[k].layout;});return o;},readSheets:readSheets,setRoster:setRoster,invalidate:invalidate,districtOf:districtOf,parts:partsList,removePart:removePart,combineParts:combineParts,committeeKey:committeeKey,setLinks:setLinks,setMetas:setMetas,matchProject:matchProject,_t:{sheetRows:sheetRows,rowsToStaff:rowsToStaff,attachStaff:attachStaff,rowsToProjects:rowsToProjects},state:state,find:find,label:label,findByLabel:findByLabel,importFile:importFile,engineers:engineers,staffOf:staffOf,supervisors:supervisors,supText:supText,residentText:residentText,setLink:setLink,dropLink:dropLink,nameSim:nameSim,links:links,getMeta:getMeta,setMeta:setMeta,mount:mount,fmt:fmt,num:num,
  RN:RN,cleanDept:cleanDept,_rowsToProjects:rowsToProjects,_parseDelim:parseDelim};
})();
