/* الصفحة الرئيسية: مربعات الأنظمة في الوسط مع شعار المحافظة */
(function(){
const TILES=[
  {id:'co',t:'أوامر التغيير',d:'إعداد أوامر التغيير ومحاضر اللجنة وكتبها وملحق العقد، مع حدود التعليمات.',ic:'📝',c:'#2f6b34'},
  {id:'du',t:'المدد والتوقف',d:'قرارات لجنة المدد الإضافية، التوقف والاستئناف، والأوامر الإدارية.',ic:'⏱️',c:'#2563a8'},
  {id:'ad',t:'لجنة تدقيق السلف',d:'استمارات تدقيق السلف بالتراكمي والسابقة والصافي ونسب الانجاز.',ic:'💰',c:'#b08a2e'},
  {id:'in',t:'إطلاق التأمينات',d:'استمارة إطلاق التأمينات بعد انتهاء الصيانة، تُسحب من شهادة الاستلام النهائي ولجنة السلف.',ic:'🛡️',c:'#0f766e'},
  {id:'ac',t:'الاستلام',d:'محاضر الاستلام الأولي والنهائي والجزئي، وتنبيهات انتهاء الصيانة.',ic:'🏗️',c:'#9b2c2c'},
  {id:'lt',t:'المخاطبات والمطالعات',d:'الكتب الرسمية والمطالعات والأوامر الإدارية، بالترويسة والتواقيع ورمز QR وملف Word.',ic:'✉️',c:'#1f3c88'},
  {id:'fv',t:'تقرير زيارة مشاريع التنفيذ أمانة',d:'تقرير الزيارة الميدانية لمشاريع التنفيذ أمانة: نسبة الإنجاز والجودة والمطابقة والتوصية بصرف السلفة، مع حفظ التقارير ولوحة معلومات.',ic:'🏗️',c:'#1f4d2a'},
  {id:'mr',t:'التقارير الشهرية لدوائر المقيم',d:'تقارير المقيمين الشهرية المرسلة من هواتفهم: اسم المشروع والشركة والقضاء والإنجاز والسلامة المهنية وملف PDF، مع الربط برقم الاضبارة ولوحة معلومات.',ic:'🗓️',c:'#0e7490'},
  {id:'fu',t:'مطالعات أوامر التغيير',d:'مطالعة لجنة المتابعة لأمر التغيير: الكميات المحذوفة والمضافة والمستحدثة والتوصيات.',ic:'📑',c:'#7c3aed'},
  {id:'ar',t:'الأرشيف والتوزيع',d:'أرشفة الكتب الصادرة والواردة وتوزيعها إلكترونياً على صناديق اللجان بدل التوزيع الورقي، مع تأكيد الاستلام.',ic:'📥',c:'#b45309'},
  {id:'wf',t:'سير المعاملات',d:'لوحة السلف وأوامر التغيير والمدد: اسم الشركة ومرحلة كل معاملة (استلام، تدقيق، مراجعة، طباعة، إنجاز أو إرجاع) ومدة بقائها، وتُعرض على شاشة ثانية أو تلفاز القاعة.',ic:'📋',c:'#334155'},
  {id:'cc',t:'مركز المتابعة',d:'لوحة القيادة: الأقضية على الخريطة، نسب الإنجاز والصرف، القطاعات والإنذارات.',ic:'🛰️',c:'#0891b2'},
  {id:'sit',t:'الموقف العام',d:'لوحة المشاريع الكاملة، الانجاز والسلف، والمهندسون المشرفون حسب الدوائر.',ic:'📊',c:'#6b46c1'}
];
function countLinks(S,k){return Object.keys(S.links||{}).filter(fn=>S.links[fn]&&S.links[fn][k]).length;}
function render(){
  if(!window.AnbarReg)return;const S=AnbarReg.state(),locked=new Set();
  try{window.desktop.authInfo().forEach(i=>{if(i.locked)locked.add(i.id);});}catch(_){}
  const ct={wf:'المعاملات الجارية ومراحلها',ar:'صناديق اللجان الاثنتي عشرة',lt:'الكتب والمطالعات والأوامر',fu:'مطالعات لجنة المتابعة',cc:S.projects.length?'لوحة '+S.projects.length+' مشروعاً':'تحتاج استيراد الموقف',co:countLinks(S,'co')+' مشروع بأوامر تغيير',du:countLinks(S,'du')+' مشروع بمدد أو توقف',ad:countLinks(S,'ad')+' مشروع بسلف',in:countLinks(S,'in')+' استمارة إطلاق تأمينات',ac:countLinks(S,'ac')+' مشروع بمحاضر استلام',
    sit:S.projects.length?S.projects.length+' مشروع — '+(S.engineers||[]).length+' مهندس':'لم يُستورد الموقف بعد'};
  document.getElementById('tiles').innerHTML=TILES.map(t=>`<div class="tile" data-go="${t.id}" style="--tc:${t.c}" tabindex="0" role="button" aria-label="${t.t}">${locked.has(t.id)?'<span class="lock" title="محمي بكلمة سر">🔒</span>':''}
    <div class="ic">${t.ic}</div><h3>${t.t}</h3><p>${t.d}</p><div class="ct">${ct[t.id]}</div></div>`).join('');
  document.getElementById('homeInfo').textContent=S.projects.length?`الموقف الحالي: «${S.source}» — ${(window.DMY||(x=>x))(String(S.updated).slice(0,10))}`:'ابدأ باستيراد الموقف الشهري من «الموقف العام»، فتقرؤه الأنظمة كلها.';
}
document.getElementById('tiles').addEventListener('click',e=>{const t=e.target.closest('[data-go]');if(t)window.desktop.go(t.dataset.go);});
document.getElementById('tiles').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){const t=e.target.closest('[data-go]');if(t){e.preventDefault();window.desktop.go(t.dataset.go);}}});
window.renderHome=render;
const prevNav=window.onNav,prevData=window.onData;
window.onNav=s=>{if(prevNav)prevNav(s);if(s.current==='home')render();};
window.onData=()=>{if(prevData)prevData();if(state.current==='home')render();};
render();
})();
