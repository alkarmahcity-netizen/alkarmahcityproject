/* أسماء المهندسين المشرفين والمقيمين: مخفية حتى كلمة سر المدير (قفل المبالغ نفسه) */
const engVisM=()=>true;   // أسماء المهندسين ظاهرة لكل اللجان (1.55.0)
/* خريطة المشاريع التفاعلية (واجهة قيادة): الإحداثيات من الموقف الشهري على خريطة حية.
   المحرك الافتراضي Leaflet بدون مفتاح (داكن / قمر صناعي / هجين / طرق)، ومحرك Google Maps اختياري بمفتاح API يُدخله المستخدم. */
(function(){
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $=id=>document.getElementById(id);
const LSK='anbar_map_v1';
let cfg={engine:'leaflet',key:'',base:'dark',s2year:'2023',custom:{on:false,name:'',type:'xyz',url:'',layers:'',date:'',opacity:80,maxNative:19}};
try{const o=JSON.parse(localStorage.getItem(LSK)||'{}');Object.assign(cfg,o,{custom:Object.assign({},cfg.custom,o.custom||{})});}catch(_){}
if(['sat','hyb','s2'].includes(cfg.base))cfg.base=cfg.key?'gsat':'dark';
const saveCfg=()=>{try{localStorage.setItem(LSK,JSON.stringify(cfg));}catch(_){}};

/* ---------- الإحداثيات: عشري أو درجات/دقائق/ثوان، وتصحيح القلب، ورفض القيم الشاذة ---------- */
function toNum(v){
  let s=String(v==null?'':v).trim();if(!s)return null;
  if(!/[°'′"″]/.test(s))s=s.replace(/^(\s*-?\d{1,3}):(\d{3,})/,'$1.$2');
  s=s.replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/٫/g,'.').replace(/،/g,'.');
  const neg=/[SWsw]\s*$/.test(s)||/^-/.test(s);
  const dms=s.match(/(\d+(?:\.\d+)?)\s*[°د:\s]\s*(\d+(?:\.\d+)?)?\s*['′ٴ]?\s*(\d+(?:\.\d+)?)?/);
  let n;
  if(/[°'′"″]/.test(s)&&dms){n=parseFloat(dms[1])+(parseFloat(dms[2]||0)/60)+(parseFloat(dms[3]||0)/3600);}
  else{const m=s.match(/-?\d+(?:\.\d+)?/);if(!m)return null;if(/[A-Za-z؀-ۿ]{3,}/.test(s.replace(/[NSEWnsew]/g,'')))return null;n=Math.abs(parseFloat(m[0]));}
  if(n>=1000)n=packed(s);
  return n==null?null:neg?-n:n;}
/* إحداثي كُتب بلا فاصلة عشرية أو درجات ودقائق وثوانٍ متلاصقة: 333517 = 33°35′17″، 333931.11 = 33°39′31.11″، 33616156 = 33.616156 */
function packed(s){const raw=(String(s).match(/\d+(?:\.\d+)?/)||[''])[0],ip=raw.split('.')[0],fr=raw.split('.')[1]||'';if(ip.length<5)return null;
  if(ip.length===6){const D=+ip.slice(0,2),M=+ip.slice(2,4),S=parseFloat(ip.slice(4)+(fr?'.'+fr:''));if(M<60&&S<60)return D+M/60+S/3600;}
  return parseFloat(ip.slice(0,2)+'.'+ip.slice(2)+fr);}
function coordPartial(p){   // إحداثي واحد صالح فقط (العمود مزاح): يُستفاد منه في الموضع التقريبي
  const a=toNum(p.lat),b=toNum(p.lng);let lat=null,lng=null;
  [a,b].forEach(v=>{if(v==null)return;if(v>=35&&v<=52&&lng==null)lng=v;else if(v>=20&&v<=40&&lat==null)lat=v;});return {lat,lng};}
/* القيم المحتملة: «334145» قد تكون 33°41′45″ أو 33.4145 — يُختار لاحقاً الأقرب إلى مشاريع القضاء نفسه */
function cands(v){const n=toNum(v);if(n==null)return [];const raw=(String(v).match(/\d+(?:\.\d+)?/)||[''])[0],ip=raw.split('.')[0];
  if(ip.length===6&&!/[°'′"″:]/.test(String(v))){const d=parseFloat(ip.slice(0,2)+'.'+ip.slice(2)+(raw.split('.')[1]||''));if(Math.abs(d-n)>1e-6)return [n,d];}return [n];}
function coord(p,ref){
  const A=cands(p.lat),B=cands(p.lng),out=[];
  A.forEach(a0=>B.forEach(b0=>{let a=a0,b=b0;
    if(a>=38.7&&a<=48.8&&b>=29&&b<=37.5){const t=a;a=b;b=t;}       // مقلوبة: خط الطول في خانة العرض
    if(a>=29&&a<=37.5&&b>=38.7&&b<=48.8)out.push({lat:a,lng:b});}));   // داخل حدود العراق فقط
  if(!out.length)return null;if(!ref||out.length===1)return out[0];
  return out.sort((x,y)=>Math.hypot(x.lat-ref.lat,x.lng-ref.lng)-Math.hypot(y.lat-ref.lat,y.lng-ref.lng))[0];}
const ambiguous=p=>cands(p.lat).length>1||cands(p.lng).length>1;

/* ---------- المحركات ---------- */
const BASES={
  dark:{t:'داكن',url:'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',sub:'abcd',attr:'© OpenStreetMap © CARTO',g:'roadmap'},
  street:{t:'طرق',url:'https://tile.openstreetmap.org/{z}/{x}/{y}.png',attr:'© OpenStreetMap',g:'roadmap'},
  /* صور Google الفضائية عالية الدقة (صور Google Earth نفسها) عبر واجهة Google الرسمية «Map Tiles API» بمفتاح المستخدم (يُدخل في ⚙) */
  gsat:{t:'Google فضائي',google:'satellite',attr:'صور © Google',g:'satellite'},
  ghyb:{t:'Google هجين',google:'hybrid',attr:'صور وخرائط © Google',g:'hybrid'}};
/* أُزيلت طبقات الصور القديمة (Esri «قمر صناعي/هجين» وفسيفساء Sentinel-2 السنوية) بطلب القسم لأنها غير حديثة؛ الصور الفضائية من Google، أو طبقة مخصصة بتاريخ */
const S2_YEARS=['2024','2023','2022','2021','2020','2019','2018'];
const s2url=()=>'';
/* طبقة مخصصة: رابط صور (XYZ أو WMS) لمصدر تحصلون عليه — صور حديثة مشتراة أو من جهة رسمية، أو صور درون مقطّعة في مجلد على الحاسبة.
   {date} في الرابط يُستبدل بالتاريخ المختار (للطبقات الزمنية مثل Sentinel-2 بتاريخ معيّن). */
const CUSTOM_PRESETS=[
  {k:'hls',t:'NASA HLS (Sentinel-2 بدقة 30 م، بتاريخ — بلا مفتاح)',type:'xyz',url:'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/HLS_S30_Nadir_BRDF_Adjusted_Reflectance/default/{date}/GoogleMapsCompatible_Level12/{z}/{y}/{x}.jpg',maxNative:12,name:'Sentinel-2 HLS'},
  {k:'cdse',t:'Copernicus Data Space (Sentinel-2 بدقة 10 م بتاريخ — حساب مجاني ومعرّف إعداد)',type:'wms',url:'https://sh.dataspace.copernicus.eu/ogc/wms/ضع-معرّف-الإعداد-هنا',layers:'TRUE_COLOR',maxNative:16,name:'Copernicus Sentinel-2'},
  {k:'folder',t:'مجلد صور على الحاسبة (درون مقطّعة XYZ)',type:'xyz',url:'file:///D:/خرائط/مشروع/{z}/{x}/{y}.png',maxNative:22,name:'صور درون'}];
function customUrl(c){return String(c.url||'').replace(/\{date\}/g,c.date||new Date(Date.now()-864e5*3).toISOString().slice(0,10));}
const GDARK=[{elementType:'geometry',stylers:[{color:'#0b1220'}]},{elementType:'labels.text.fill',stylers:[{color:'#7d8fb0'}]},{elementType:'labels.text.stroke',stylers:[{color:'#0b1220'}]},
  {featureType:'road',elementType:'geometry',stylers:[{color:'#1c2a44'}]},{featureType:'water',elementType:'geometry',stylers:[{color:'#06101f'}]},{featureType:'poi',stylers:[{visibility:'off'}]}];

/* جلسة Google Map Tiles API (رسمية): تُنشأ بالمفتاح وتُحفظ حتى انتهائها (نحو أسبوعين) */
const GTK='anbar_gtiles_v1';
async function gSession(kind){
  const key=String(cfg.key||'').trim();if(!key)throw new Error('لعرض صور Google: أدخل مفتاح Google API من ⚙ (إعدادات الخريطة) وفعّل «Map Tiles API» في Google Cloud لذلك المفتاح');
  const ck=kind+'|'+key.slice(-8);let C={};try{C=JSON.parse(localStorage.getItem(GTK)||'{}');}catch(_){}
  if(C[ck]&&C[ck].exp*1000>Date.now()+36e5)return C[ck].token;
  const body={mapType:'satellite',language:'ar',region:'IQ',scale:'scaleFactor2x',highDpi:true};if(kind==='hybrid')body.layerTypes=['layerRoadmap'];
  const f=window.__gtFetch||fetch;let r;try{r=await f('https://tile.googleapis.com/v1/createSession?key='+encodeURIComponent(key),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});}catch(e){throw new Error('تعذّر الاتصال بخدمة صور Google — تحقق من الإنترنت');}
  let j={};try{j=await r.json();}catch(_){}
  if(!r.ok||!j.session){const msg=(j.error&&j.error.message)||('HTTP '+r.status);throw new Error('رفضت Google طلب الصور: '+msg+' — تأكد من تفعيل «Map Tiles API» للمفتاح ومن الفوترة في Google Cloud');}
  C[ck]={token:j.session,exp:+j.expiry||Math.floor(Date.now()/1000)+86400};try{localStorage.setItem(GTK,JSON.stringify(C));}catch(_){}
  return j.session;}
const gTileUrl=tok=>'https://tile.googleapis.com/v1/2dtiles/{z}/{x}/{y}?session='+encodeURIComponent(tok)+'&key='+encodeURIComponent(cfg.key);
function leafletEngine(el,hooks){
  const m=L.map(el,{zoomControl:false,attributionControl:true,worldCopyJump:false,preferCanvas:true}).setView([33.4,43.3],8);
  L.control.zoom({position:'bottomleft'}).addTo(m);L.control.scale({position:'bottomleft',imperial:false}).addTo(m);
  let layers=[],markers=new Map(),sel=null,cl=null;
  /* صور لم تُحمَّل (لا إنترنت، أو رابط خاطئ، أو لا صور لتلك السنة/التاريخ): تنبيه واضح بدل خريطة فارغة صامتة */
  const watchTiles=(ly,nm)=>{let ok=0,bad=0;ly.on('tileload',()=>{ok++;if(bad&&ok>2)note('');});ly.on('tileerror',()=>{bad++;if(bad>=6&&ok===0)note(`تعذّر تحميل صور «${nm}» — تحقق من الاتصال بالإنترنت أو من الرابط/السنة/التاريخ في ⚙`);});return ly;};
  const e={
    setBase(k){layers.forEach(l=>m.removeLayer(l));layers=[];const b=BASES[k]||BASES.dark;
      if(b.google){const gen=(e.__g=(e.__g||0)+1);gSession(b.google).then(tok=>{if(gen!==e.__g)return;layers.push(watchTiles(L.tileLayer(gTileUrl(tok),{attribution:b.attr,maxZoom:22,maxNativeZoom:22,tileSize:256}),b.t).addTo(m));note('');e.setCustom();})
        .catch(err=>{if(gen!==e.__g)return;note(err.message+' — عُرضت الخريطة الداكنة بدلاً منها');const s0=BASES.dark;layers.push(L.tileLayer(s0.url,{subdomains:s0.sub,attribution:s0.attr,maxZoom:19}).addTo(m));e.setCustom();});return;}
      e.__g=(e.__g||0)+1;
      layers.push(watchTiles(L.tileLayer(k==='s2'?s2url(cfg.s2year):b.url,{subdomains:b.sub||'abc',attribution:k==='s2'?b.attr+' '+cfg.s2year:b.attr,maxZoom:19,maxNativeZoom:b.maxNative||19}),k==='s2'?'Sentinel-2 '+cfg.s2year:b.t).addTo(m));
      if(b.over)layers.push(L.tileLayer(b.over,{subdomains:b.sub||'abc',maxZoom:19}).addTo(m));
      e.setCustom();},
    setCustom(){if(cl){m.removeLayer(cl);cl=null;}const c=cfg.custom||{};if(!c.on||!c.url)return;
      const op=Math.max(.1,Math.min(1,(+c.opacity||80)/100)),mx=Math.max(1,Math.min(22,+c.maxNative||19)),nm=c.name||'الطبقة المخصصة';
      cl=c.type==='wms'?L.tileLayer.wms(String(c.url).split('?')[0],{layers:c.layers||'',format:'image/png',transparent:true,version:'1.3.0',opacity:op,maxZoom:22,maxNativeZoom:mx,attribution:nm,...(c.date?{time:c.date}:{})})
        :L.tileLayer(customUrl(c),{opacity:op,maxZoom:22,maxNativeZoom:mx,attribution:nm});
      watchTiles(cl,nm).addTo(m);cl.setZIndex(5);},
    clear(){markers.forEach(x=>m.removeLayer(x));markers.clear();},
    add(it){const h=`<div class="mk ${it.kind}${it.approx?' apx':''}" style="--c:${it.color}"><i></i><b></b></div>`;
      const mk=L.marker([it.lat,it.lng],{icon:L.divIcon({className:'mkw',html:h,iconSize:[26,26],iconAnchor:[13,13]}),title:it.name,keyboard:true}).addTo(m);
      mk.on('click',()=>hooks.pick(it.fn));markers.set(it.fn,mk);},
    fit(pts){if(!pts.length)return;if(pts.length===1){m.setView(pts[0],14);return;}m.fitBounds(L.latLngBounds(pts),{padding:[60,60],maxZoom:15});},
    fly(lat,lng,z){m.flyTo([lat,lng],Math.max(m.getZoom(),z||15),{duration:.9});},
    select(fn){if(sel&&markers.get(sel))markers.get(sel).getElement()&&markers.get(sel).getElement().classList.remove('sel');sel=fn;const mk=markers.get(fn);if(mk&&mk.getElement())mk.getElement().classList.add('sel');},
    onMove(f){m.on('mousemove',ev=>f(ev.latlng.lat,ev.latlng.lng));},
    resize(){m.invalidateSize();},destroy(){m.remove();}};
  return e;}

let gPromise=null;
function loadGoogle(key){
  if(window.google&&google.maps)return Promise.resolve();if(gPromise)return gPromise;
  gPromise=new Promise((res,rej)=>{window.__gmReady=()=>res();window.gm_authFailure=()=>{rej(new Error('رفض Google المفتاح (تحقق من تفعيل Maps JavaScript API ومن قيود المفتاح)'));};
    const s=document.createElement('script');s.src='https://maps.googleapis.com/maps/api/js?key='+encodeURIComponent(key)+'&callback=__gmReady&language=ar&region=IQ';s.async=true;s.onerror=()=>rej(new Error('تعذّر الاتصال بـ Google Maps (تحقق من الإنترنت)'));document.head.appendChild(s);});
  gPromise.catch(()=>{gPromise=null;});return gPromise;}
function googleEngine(el,hooks){
  const m=new google.maps.Map(el,{center:{lat:33.4,lng:43.3},zoom:8,mapTypeId:'roadmap',styles:GDARK,disableDefaultUI:true,zoomControl:true,scaleControl:true,gestureHandling:'greedy',backgroundColor:'#0b1220'});
  let markers=new Map(),sel=null;const icon=(c,big)=>({path:google.maps.SymbolPath.CIRCLE,scale:big?11:8,fillColor:c,fillOpacity:.95,strokeColor:'#fff',strokeWeight:big?3:2});
  return {setBase(k){const b=BASES[k]||BASES.dark;m.setMapTypeId(b.g);m.setOptions({styles:k==='dark'?GDARK:null});},
    clear(){markers.forEach(x=>x.setMap(null));markers.clear();},
    add(it){const mk=new google.maps.Marker({position:{lat:it.lat,lng:it.lng},map:m,title:it.name,icon:icon(it.color,false)});mk.__c=it.color;mk.addListener('click',()=>hooks.pick(it.fn));markers.set(it.fn,mk);},
    fit(pts){if(!pts.length)return;if(pts.length===1){m.setCenter({lat:pts[0][0],lng:pts[0][1]});m.setZoom(14);return;}const b=new google.maps.LatLngBounds();pts.forEach(p=>b.extend({lat:p[0],lng:p[1]}));m.fitBounds(b,60);},
    fly(lat,lng,z){m.panTo({lat,lng});if(m.getZoom()<(z||15))m.setZoom(z||15);},
    select(fn){if(sel&&markers.get(sel))markers.get(sel).setIcon(icon(markers.get(sel).__c,false));sel=fn;const mk=markers.get(fn);if(mk){mk.setIcon(icon(mk.__c,true));mk.setZIndex(999);}},
    onMove(f){m.addListener('mousemove',ev=>f(ev.latLng.lat(),ev.latLng.lng()));},
    resize(){google.maps.event.trigger(m,'resize');},destroy(){}};}

/* ---------- الواجهة ---------- */
let eng=null,engKind='',items=[],hooks=null,curFn='',filterKind='',q='',built=false,wasKey='';
const fmtN=n=>(+n||0).toLocaleString('en-US');
function ui(){
  const host=$('st-map');
  host.innerHTML=`<div class="mapx" id="mapx">
    <div class="mapside" id="mapSide">
      <div class="mhead"><b>مركز المتابعة الميدانية</b><span class="live"><i></i>مباشر</span></div>
      <input id="mq" placeholder="بحث: مشروع، شركة، قضاء، مهندس...">
      <div class="mchips" id="mchips"></div>
      <div class="mlist" id="mlist"></div>
      <div class="mcard" id="mcard" hidden></div>
    </div>
    <div class="mapmain">
      <div class="mapel" id="mapel"></div>
      <div class="hud tl" id="hudTl"></div>
      <div class="hud tr"><div class="bases" id="bases"></div><button class="hb2" id="mEarth" title="Google Earth: فتح المشاريع في Google Earth Pro (ربط مباشر يتحدّث وحده) أو Google Earth على الويب، أو حفظ ملف KML">🌍 Google Earth</button><div class="earthm" id="earthM" hidden></div><button class="hb2" id="mFs" title="ملء الشاشة للخريطة (Esc للخروج)">⛶ ملء الشاشة</button><button class="hb2" id="mFit" title="إلغاء التصفية وعرض كل المشاريع في المحافظة (Esc)">⌖ الكل</button><button class="hb2" id="mSet" title="إعدادات الخريطة">⚙</button></div>
      <div class="hud bl" id="mCoord">— —</div>
      <div class="hud note" id="mNote" hidden></div>
      <div class="scan"></div><div class="grid"></div>
    </div>
    <div class="mset" id="mset" hidden><div class="dlg"><h3>إعدادات الخريطة</h3>
      <label>محرك الخريطة<select id="mEng"><option value="leaflet">مدمج: داكن / طرق (بلا مفتاح) + Google فضائي / هجين (بمفتاح)</option><option value="google">Google Maps (يتطلب مفتاح API)</option></select></label>
      <label id="mKeyL">مفتاح Google API — لطبقتي «Google فضائي/هجين» (فعّل Map Tiles API) ولمحرك Google Maps (فعّل Maps JavaScript API)<input id="mKey" placeholder="AIza..." style="direction:ltr;text-align:left" autocomplete="off"></label>
      <label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="mKeyShare" checked style="width:auto"> نشر المفتاح إلى بقية حاسبات القسم واللجان (بالمزامنة) <small id="mKeyInfo" style="opacity:.75"></small></label>
      <p class="hint" style="margin:6px 0">لاستعمال Google: فعّل «Maps JavaScript API» في Google Cloud وأنشئ مفتاحاً (يفضّل بلا قيود موقع لأن البرنامج يعمل كتطبيق مكتبي). يلزم اتصال بالإنترنت للخرائط الحية؛ والمشاريع تظهر بمواقعها حتى بدونه.</p>
      <fieldset class="mfs" hidden><legend>Sentinel-2 (أُزيلت)</legend>
        <label>السنة<select id="mS2Y">${S2_YEARS.map(y=>`<option value="${y}">${y}</option>`).join('')}</select></label>
        <p class="hint" style="margin:4px 0">فسيفساء سنوية خالية من الغيوم (EOX s2maps.eu). تُظهر الطرق والمجمعات وأعمال الحفر الكبيرة، لا التفاصيل الصغيرة. لصور بتاريخ قريب استعمل الطبقة المخصصة أدناه.</p></fieldset>
      <fieldset class="mfs"><legend>طبقة مخصصة</legend>
        <label class="chk"><input type="checkbox" id="mCOn"> عرضها فوق الخريطة</label>
        <label>جاهزة<select id="mCPre"><option value="">— اختر لتعبئة الحقول —</option>${CUSTOM_PRESETS.map(p=>`<option value="${p.k}">${esc(p.t)}</option>`).join('')}</select></label>
        <label>الاسم<input id="mCName" placeholder="مثلاً: صور تشرين الأول 2026"></label>
        <div class="mrow"><label>النوع<select id="mCType"><option value="xyz">XYZ / WMTS ({z}/{x}/{y})</option><option value="wms">WMS</option></select></label><label id="mCLyrL">طبقة WMS<input id="mCLyr" style="direction:ltr;text-align:left" placeholder="TRUE_COLOR"></label></div>
        <label>الرابط<input id="mCUrl" style="direction:ltr;text-align:left" placeholder="https://…/{z}/{x}/{y}.png" autocomplete="off"></label>
        <div class="mrow"><label>التاريخ ({date})<input id="mCDate" type="date"></label><label>الشفافية <span id="mCOpV"></span><input id="mCOp" type="range" min="10" max="100" step="5"></label></div>
        <p class="hint" style="margin:4px 0">{date} في الرابط يُستبدل بالتاريخ المختار. مجلد على الحاسبة: file:///D:/مجلد/{z}/{x}/{y}.png. الطبقة تظهر في المحرك المدمج فقط.</p></fieldset>
      <div class="row"><button class="btn" id="mSetNo">إغلاق</button><button class="btn pri" id="mSetOk">حفظ</button></div></div></div></div>`;
  built=true;
  $('mq').addEventListener('input',()=>{q=$('mq').value.trim().toLowerCase();list();chips();paint();});
  $('mFit').onclick=()=>resetAll();
  /* ملء الشاشة للخريطة: نافذة البرنامج كلها (يُخفى الشريط العلوي)، والخروج بالزر أو Esc */
  const fsUI=on=>{document.body.classList.toggle('mapfs',!!on);const b=$('mFs');if(b)b.textContent=on?'✕ خروج من ملء الشاشة':'⛶ ملء الشاشة';setTimeout(()=>{if(eng)eng.resize();},120);setTimeout(()=>{if(eng)eng.resize();},450);};
  window.__mapFs=async on=>{let r=on;try{if(window.desktop&&window.desktop.fullscreen)r=await window.desktop.fullscreen(on);}catch(_){}fsUI(on&&r!==false);};
  $('mFs').onclick=()=>window.__mapFs(!document.body.classList.contains('mapfs'));
  try{if(window.desktop&&window.desktop.onFs)window.desktop.onFs(v=>{if(!v&&document.body.classList.contains('mapfs'))fsUI(false);});}catch(_){}
  try{if(window.desktop&&window.desktop.onState)window.desktop.onState(st=>{if(st.current!=='sit'&&document.body.classList.contains('mapfs'))window.__mapFs(false);});}catch(_){}
  const cFill=c=>{$('mCOn').checked=!!c.on;$('mCName').value=c.name||'';$('mCType').value=c.type||'xyz';$('mCLyr').value=c.layers||'';$('mCUrl').value=c.url||'';$('mCDate').value=c.date||'';$('mCOp').value=c.opacity||80;$('mCOpV').textContent=($('mCOp').value)+'%';$('mCLyrL').style.display=$('mCType').value==='wms'?'':'none';};
  $('mSet').onclick=()=>{$('mEng').value=cfg.engine;$('mKey').value=cfg.key;$('mKeyInfo').textContent=cfg.keyBy?`— المفتاح الحالي من: ${cfg.keyBy}`:'';$('mKeyL').style.display='';$('mS2Y').value=S2_YEARS.includes(String(cfg.s2year))?cfg.s2year:'2023';cFill(cfg.custom||{});$('mset').hidden=false;};
  $('mCType').onchange=()=>{$('mCLyrL').style.display=$('mCType').value==='wms'?'':'none';};
  $('mCOp').oninput=()=>{$('mCOpV').textContent=$('mCOp').value+'%';};
  $('mCPre').onchange=()=>{const p=CUSTOM_PRESETS.find(x=>x.k===$('mCPre').value);if(!p)return;cFill({on:true,name:p.name,type:p.type,url:p.url,layers:p.layers||'',date:$('mCDate').value||'',opacity:+$('mCOp').value||80,maxNative:p.maxNative});cfg.__preMax=p.maxNative;};
  $('mEng').onchange=()=>{$('mKeyL').style.display='';};
  $('mSetNo').onclick=()=>{$('mset').hidden=true;};
  $('mSetOk').onclick=async()=>{const nk=$('mKey').value.trim(),kch=nk!==cfg.key;if(kch&&$('mKeyShare').checked&&window.desktop&&window.desktop.mapKeySet){const r=await window.desktop.mapKeySet(nk);if(r&&r.error){cfg.keyAt=Date.now();cfg.keyBy='';if(window.flash)window.flash(r.error+' — حُفظ على هذه الحاسبة فقط ولم يُنشر',true);}else{if(r&&r.at){cfg.keyAt=r.at;cfg.keyBy='هذه الحاسبة';}if(window.flash)window.flash(nk?'نُشر مفتاح الخرائط — يصل إلى بقية الحاسبات مع المزامنة':'أُلغي مفتاح الخرائط في كل الحاسبات');}}else if(kch){cfg.keyAt=Date.now();cfg.keyBy='';}
    cfg.engine=$('mEng').value;cfg.key=nk;cfg.s2year=$('mS2Y').value;
    const url=$('mCUrl').value.trim(),okUrl=!url||/^(https?:|file:)\/\//i.test(url);if(!okUrl){alert('الرابط يجب أن يبدأ بـ https:// أو http:// أو file:///');return;}
    cfg.custom={on:$('mCOn').checked&&!!url,name:$('mCName').value.trim(),type:$('mCType').value,url,layers:$('mCLyr').value.trim(),date:$('mCDate').value,opacity:+$('mCOp').value||80,maxNative:cfg.__preMax||(cfg.custom&&cfg.custom.maxNative)||19};delete cfg.__preMax;
    saveCfg();$('mset').hidden=true;boot(true);};
  $('mchips').addEventListener('click',e=>{if(e.target.closest('[data-reset]')){resetAll();return;}const b=e.target.closest('[data-k]');if(!b)return;const k=b.dataset.k;filterKind=!k||k===filterKind?'':k;curFn='';$('mcard').hidden=true;list();chips();paint();fit();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.body.classList.contains('mapfs')){window.__mapFs(false);return;}if(e.key==='Escape'&&built&&$('st-map')&&$('st-map').offsetParent!==null&&(filterKind||q||curFn))resetAll();});
  $('mlist').addEventListener('click',e=>{const b=e.target.closest('[data-fn]');if(b)pick(b.dataset.fn,true);});
  $('mcard').addEventListener('click',e=>{const g=e.target.closest('[data-earth]');if(g){const it=items.find(x=>x.fn===curFn);if(it)earthOpen(g.dataset.earth,it);return;}});
  $('mEarth').onclick=e=>{e.stopPropagation();earthMenu();};document.addEventListener('click',e=>{const m=$('earthM');if(m&&!m.hidden&&!e.target.closest('#earthM'))m.hidden=true;});
  $('mcard').addEventListener('click',e=>{const b=e.target.closest('[data-open]');if(b)window.desktop.go(b.dataset.open,curFn);const d=e.target.closest('[data-det]');if(d)hooks.drawer(curFn);});
  $('bases').addEventListener('click',e=>{if(e.target.closest('[data-cust]')){cfg.custom.on=!cfg.custom.on;saveCfg();if(eng&&eng.setCustom)eng.setCustom();bases();return;}const b=e.target.closest('[data-b]');if(!b)return;cfg.base=b.dataset.b;saveCfg();if(eng)eng.setBase(cfg.base);bases();});
  bases();}
function bases(){$('bases').innerHTML=Object.keys(BASES).map(k=>`<button class="hb2 ${cfg.base===k?'on':''}" data-b="${k}" title="${k==='s2'?'Sentinel-2 — فسيفساء '+esc(cfg.s2year)+' (تُغيَّر السنة من ⚙)':''}">${BASES[k].t}${k==='s2'?' '+esc(cfg.s2year):''}</button>`).join('')+(cfg.custom&&cfg.custom.url?`<button class="hb2 ${cfg.custom.on?'on':''}" data-cust="1" title="إظهار/إخفاء الطبقة المخصصة (تُضبط من ⚙)">◧ ${esc(cfg.custom.name||'مخصصة')}</button>`:'');}
function visible(){return items.filter(it=>(!filterKind||it.kind===filterKind)&&(!q||it.hay.includes(q)));}
function list(){
  const v=visible();$('mlist').innerHTML=v.length?v.map(it=>`<div class="mi ${it.fn===curFn?'on':''}" data-fn="${esc(it.fn)}" style="--c:${it.color}"><i></i><div><b>${esc(it.name)}</b><small>${esc(it.contractor||'')} · ${esc(it.status||'—')}</small></div><span>${it.act!=null?it.act+'%':''}</span></div>`).join(''):'<div class="empty" style="padding:14px">لا مشاريع مطابقة.</div>';}
function chips(){
  const cnt={};items.forEach(i=>{(cnt[i.kind]=cnt[i.kind]||{n:0,c:i.color,l:i.kindLabel}).n++;});
  $('mchips').innerHTML=`<button class="mc all ${filterKind?'':'on'}" data-k="" style="--c:#38e8ff"><i></i>الكل <b>${items.length}</b></button>`+Object.keys(cnt).map(k=>`<button class="mc ${filterKind===k?'on':''}" data-k="${k}" style="--c:${cnt[k].c}" title="${filterKind===k?'اضغط مرة أخرى للعودة إلى الكل':'عرض هذه المشاريع فقط'}"><i></i>${esc(cnt[k].l)} <b>${cnt[k].n}</b></button>`).join('')
    +(filterKind||q||curFn?`<button class="mc back" data-reset="1" title="إلغاء التصفية والبحث وإغلاق بطاقة المشروع وعرض كل المحافظة (Esc)">↩ العودة إلى كل المشاريع</button>`:'');}
/* العودة: إلغاء التصفية والبحث وإغلاق البطاقة وعرض كل المشاريع على الخريطة */
function resetAll(){filterKind='';q='';const mq=$('mq');if(mq)mq.value='';curFn='';const c=$('mcard');if(c)c.hidden=true;if(eng)eng.select('');chips();list();paint();fit();}
function hud(total,noCoord,apx){
  const money=items.reduce((a,i)=>a+i.total,0);
  $('hudTl').innerHTML=`<div class="hk"><span>مواقع مرصودة</span><b>${items.length}</b><small>من ${total} مشروع — ${items.length-apx} بإحداثيات دقيقة${apx?`، ${apx} موقع تقريبي (حسب الناحية)`:''}${noCoord?`، ${noCoord} بلا موقع`:''}</small></div>
    <div class="hk"><span>متوقفة / متأخرة</span><b class="r">${items.filter(i=>i.kind==='bad').length}/${items.filter(i=>i.kind==='warn'||i.kind==='warn2').length}</b></div>
    <div class="hk"><span>إجمالي الكلفة</span><b>${hooks.compact(money)}</b></div>
    <div class="hk"><span>مبالغ أوامر التغيير</span><b>${hooks.compact(items.reduce((a,i)=>a+i.chg,0))}</b></div>`;}
function card(fn){
  const it=items.find(x=>x.fn===fn),c=$('mcard');if(!it){c.hidden=true;return;}
  const sys=[['co','أوامر التغيير',it.L.co],['du','المدد',it.L.du],['ad','السلف',it.L.ad],['ac','الاستلام',it.L.ac&&it.L.ac.records]];
  c.hidden=false;c.style.setProperty('--c',it.color);
  c.innerHTML=`<div class="ct"><span class="chip" style="background:${it.color}">${esc(it.kindLabel)}</span><button class="x" id="mcx" aria-label="إغلاق">×</button></div><h4>${esc(it.name)}</h4>
    <div class="cr"><span>اضبارة ${esc(fn)}</span><span>${esc(it.contractor||'')}</span></div>
    <div class="cg"><div><small>الانجاز الفعلي</small><b>${it.act!=null?it.act+'%':'—'}</b></div><div><small>المخطط</small><b>${it.plan!=null?it.plan+'%':'—'}</b></div><div><small>الكلفة</small><b>${hooks.compact(it.total)}</b></div></div>
    <div class="bar"><i style="width:${Math.min(100,it.act||0)}%"></i>${it.plan!=null?`<u style="left:${Math.min(100,it.plan)}%"></u>`:''}</div>
    <div class="cr"><span>المقيم: <b>${engVisM()?esc(it.resident||'—'):'🔒 مخفي (كلمة سر المدير)'}</b></span></div>${it.sup?`<div class="cr"><span>المشرفون: ${esc(it.sup)}</span></div>`:''}
    ${it.chg?`<div class="cr">مبلغ أوامر التغيير: <b>${it.chg>0?'+':''}${hooks.compact(it.chg)}</b> د.ع</div>`:''}
    <div class="cr co">${esc(it.district||'')} ${it.lat.toFixed(5)}°N ${it.lng.toFixed(5)}°E</div>${it.approx?'<div class="cr" style="color:#fbbf24">⚠ موقع تقريبي حسب الناحية — لا إحداثيات صالحة لهذا المشروع في الموقف</div>':''}
    <div class="cs">${sys.map(([id,t,v])=>`<button class="btn sm ${v?'':'dim'}" data-open="${id}">${t}${v?' ✓':''}</button>`).join('')}<button class="btn sm pri" data-det="1">التفاصيل الكاملة</button><button class="btn sm" data-earth="web" title="Google Earth على الويب في نافذة من البرنامج على موقع المشروع">🌍 Google Earth</button><button class="btn sm" data-earth="pro" title="الانتقال إلى المشروع في Google Earth Pro (سطح المكتب)">Earth Pro</button></div>`;
  $('mcx').onclick=()=>{curFn='';c.hidden=true;list();chips();if(eng)eng.select('');};}
function pick(fn,fly){curFn=fn;const it=items.find(x=>x.fn===fn);if(!it)return;card(fn);list();if(eng){eng.select(fn);if(fly)eng.fly(it.lat,it.lng,15);}
  const el=document.querySelector(`.mi[data-fn="${CSS.escape(fn)}"]`);if(el)el.scrollIntoView({block:'nearest'});}
function paint(){if(!eng)return;eng.clear();visible().forEach(it=>eng.add(it));if(curFn)eng.select(curFn);}
function fit(){if(eng)eng.fit(visible().map(i=>[i.lat,i.lng]));}
function note(t){const n=$('mNote');if(!n)return;n.hidden=!t;n.textContent=t||'';}
/* المفتاح المشترك: الأحدث يغلب (المُدخَل محلياً أو المنشور من حاسبة أخرى) */
async function sharedKey(){try{if(!window.desktop||!window.desktop.mapKeyGet)return false;const s=await window.desktop.mapKeyGet();if(!s||!s.at||s.at<=(+cfg.keyAt||0))return false;
  cfg.keyAt=s.at;cfg.keyBy=s.by||'';if(s.val===cfg.key){saveCfg();return false;}cfg.key=s.val;saveCfg();return true;}catch(_){return false;}}
try{window.desktop&&window.desktop.onSyncData&&window.desktop.onSyncData(s=>{if(s&&s.ds==='wf')sharedKey().then(ch=>{if(ch&&built)boot(true);});});}catch(_){}
async function boot(force){
  await sharedKey();
  const el=$('mapel');if(!el)return;
  if(eng&&!force&&engKind===cfg.engine&&wasKey===cfg.key){eng.resize();return;}
  if(eng){try{eng.destroy();}catch(_){}eng=null;el.innerHTML='';el.className='mapel';}
  const h={pick:fn=>pick(fn,false)};engKind=cfg.engine;wasKey=cfg.key;
  if(cfg.engine==='google'){
    if(!cfg.key){note('أدخل مفتاح Google Maps من ⚙ للتفعيل — تُعرض الخريطة المدمجة مؤقتاً');engKind='leaflet';}
    else{try{await loadGoogle(cfg.key);eng=googleEngine(el,h);note('');}catch(err){note(err.message+' — عُرضت الخريطة المدمجة');engKind='leaflet';}}}
  if(!eng){if(typeof L==='undefined'){note('تعذّر تحميل محرك الخرائط');return;}eng=leafletEngine(el,h);if(cfg.engine!=='google')note('');}
  eng.setBase(cfg.base);eng.onMove((a,b)=>{const c=$('mCoord');if(c)c.textContent=a.toFixed(5)+'°N   '+b.toFixed(5)+'°E';});
  if(engKind==='google'&&cfg.custom&&cfg.custom.on)note('الطبقة المخصصة وSentinel-2 تظهران في المحرك المدمج فقط');
  bases();paint();fit();setTimeout(()=>eng&&eng.resize(),150);}
/* مواقع المشاريع من الموقف (تُستعمل للخريطة ولملف Google Earth) */
function buildItems(R,hk){
  const grp=p=>[p.district,p.sub].filter(Boolean).join('/')||'-',cen={};
  R.forEach(r=>{const c=ambiguous(r.p)?null:coord(r.p);if(c){(cen[grp(r.p)]=cen[grp(r.p)]||{a:[],b:[]}).a.push(c.lat);cen[grp(r.p)].b.push(c.lng);}});
  const med=a=>{const s=a.slice().sort((x,y)=>x-y);return s.length?s[Math.floor(s.length/2)]:null;};
  const all={a:[].concat(...Object.values(cen).map(x=>x.a)),b:[].concat(...Object.values(cen).map(x=>x.b))};
  let apx=0,noC=0;const items=[];
  const EV=engVisM();
  R.forEach(r=>{const p=r.p,gc=cen[grp(p)]||cen[p.district||'-'];let c=coord(p,gc&&gc.a.length?{lat:med(gc.a),lng:med(gc.b)}:all.a.length?{lat:med(all.a),lng:med(all.b)}:null),approx=false;
    if(!c){const pc=coordPartial(p),g=cen[grp(p)]||all,h=[...String(p.fileNo)].reduce((x,ch)=>x*31+ch.charCodeAt(0)>>>0,7),jx=((h%1000)/1000-.5)*.012,jy=((Math.floor(h/1000)%1000)/1000-.5)*.012;
      const la=pc.lat!=null?pc.lat:med(g.a),ln=pc.lng!=null?pc.lng:med(g.b);
      if(la==null||ln==null){noC++;return;}c={lat:la+(pc.lat!=null?0:jy),lng:ln+(pc.lng!=null?0:jx)};approx=true;apx++;}
    const kind=hk.stKind(p.status);
    items.push({committee:p.committee||'',approx,chg:hk.num(p.changeCost),fn:String(p.fileNo),name:p.name||('اضبارة '+p.fileNo),contractor:p.contractor,status:p.status,kind,color:hk.KCOL[kind],kindLabel:{ok:'منجز',bad:'متوقف',warn:'متأخر',warn2:'متلكئ',blue:'قيد التنفيذ',none:'غير مصنف'}[kind],
      lat:c.lat,lng:c.lng,act:p.actualPct!==''&&p.actualPct!=null?Math.round(parseFloat(p.actualPct)*10)/10:null,plan:p.planPct!==''&&p.planPct!=null?Math.round(parseFloat(p.planPct)*10)/10:null,
      total:hk.num(p.total)||hk.num(p.orig),resident:EV?p.resident:'',sup:EV?AnbarReg.supText(p.fileNo):'',district:[p.district,p.sub].filter(Boolean).join(' / '),L:r.L,
      hay:[p.fileNo,p.name,p.contractor,p.district,p.sub,EV?p.resident:'',p.status,EV?AnbarReg.supText(p.fileNo):''].join(' ').toLowerCase()});});
  return {list:items,noC,apx};}
function render(R,hk){
  hooks=hk;if(!built||!$('mapel'))ui();
  const S=AnbarReg.state();const B=buildItems(R,hk);items=B.list;const noC=B.noC,apx=B.apx;
  window.__mapItems=items;
  hud(S.projects.length,noC,apx);chips();list();
  if(!S.projects.length)note('لم يُستورد الموقف بعد'); else if(!items.length)note('لا إحداثيات صالحة في الموقف (عمودا N وE)'); else if(!(cfg.engine==='google'&&!cfg.key))note('');
  boot(false).then(()=>{paint();if(curFn)card(curFn);});}
/* ---------- Google Earth ---------- */
const EK='anbar_earth_live';
const earthLive=()=>{try{return localStorage.getItem(EK)==='1';}catch(_){return false;}};
let earthT=0,earthLast='';
function earthPayload(L){return L.map(i=>({fn:i.fn,name:i.name,lat:i.lat,lng:i.lng,kind:i.kind,kindLabel:i.kindLabel,color:i.color,status:i.status||'',contractor:i.contractor||'',act:i.act,plan:i.plan,total:i.total,chg:i.chg,district:i.district,resident:i.resident||'',sup:i.sup||'',committee:i.committee||'',approx:!!i.approx}));}
/* تحديث ملف Google Earth Pro مع كل تغيّر في الموقف (بعد أول ربط) */
function earthSync(R,hk){if(!earthLive()||!window.desktop||!window.desktop.earth)return;clearTimeout(earthT);earthT=setTimeout(()=>{try{const P=earthPayload(buildItems(R,hk).list);const k=JSON.stringify(P);if(k===earthLast)return;earthLast=k;window.desktop.earth.write(P);}catch(_){}},1500);}
async function earthOpen(kind,it){const E=window.desktop&&window.desktop.earth;if(!E){window.open(`https://earth.google.com/web/search/${it.lat},${it.lng}`,'_blank');return;}
  if(kind==='web'){await E.web(it.lat,it.lng,it.name);return;}
  const r=await E.pro(earthPayload(items),earthPayload([it])[0]);earthAfter(r);}
function earthAfter(r){if(!r)return;if(r.error&&r.app!=='none'){alert(r.error);return;}
  if(r.ok){try{localStorage.setItem(EK,'1');}catch(_){}earthLast='';if(window.flash)window.flash(r.app==='pro'||r.app==='assoc'?'فُتحت المشاريع في Google Earth Pro — الربط مباشر: أي تغيير في الموقف يظهر فيه وحده':'أُنشئ ملف Google Earth');}
  else if(r.app==='none')alert('لم يُعثر على Google Earth Pro في هذه الحاسبة.\n\nثبّته مجاناً من موقع Google ‏(google.com/earth/versions) ثم أعد الضغط، أو استعمل «Google Earth على الويب».\n\nملف الربط جاهز في مجلد البيانات: '+r.target);}
function earthMenu(){const m=$('earthM');if(!m)return;const v=visible();
  m.innerHTML=`<b>🌍 Google Earth</b>
    <button class="hb2" data-em="pro">🛰 فتح في Google Earth Pro — ربط مباشر${earthLive()?' ✓':''}</button><small>كل مشاريع الموقف بألوان حالاتها وبطاقة لكل مشروع؛ يُفتح مرة ويبقى في «أماكني» ويتحدّث وحده كل 30 ثانية.</small>
    <button class="hb2" data-em="web">🌐 Google Earth على الويب${curFn?' — المشروع المحدد':''}</button><small>في نافذة من البرنامج${curFn?' على موقع المشروع':''} (يحتاج إنترنت).</small>
    <button class="hb2" data-em="save">💾 حفظ ملف KML للمشاريع المعروضة (${v.length})</button><small>للاستيراد في Google Earth على الويب (المشاريع ← استيراد ملف KML) أو للمشاركة.</small>
    <button class="hb2" data-em="dir">📂 مجلد ملفات Google Earth</button>`;
  m.hidden=!m.hidden;
  m.onclick=async e=>{const b=e.target.closest('[data-em]');if(!b)return;m.hidden=true;const E=window.desktop&&window.desktop.earth;const k=b.dataset.em;
    if(k==='web'){const it=items.find(x=>x.fn===curFn);if(E)await E.web(it?it.lat:null,it?it.lng:null,it?it.name:'');else window.open('https://earth.google.com/web/','_blank');return;}
    if(!E)return;
    if(k==='pro'){earthAfter(await E.pro(earthPayload(items)));return;}
    if(k==='save'){const r=await E.save(earthPayload(v),'مشاريع-الانبار-'+new Date().toISOString().slice(0,10));if(r&&r.ok&&window.flash)window.flash('حُفظ ملف KML: '+v.length+' مشروعاً');return;}
    if(k==='dir')E.dir();};}
window.AnbarMap={earthSync,earthLive,earthPayload,buildItems,render,coord,items:()=>items,resize:()=>{if(eng)eng.resize();},cfg:()=>cfg,engine:()=>eng};
})();
