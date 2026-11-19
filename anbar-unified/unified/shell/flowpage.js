/* تبويب «سير المعاملات» في البرنامج: اللوحة مع النقل بين المراحل (يتطلب فتح النظام المعني بكلمة سره واسم المعدِّل) */
(function(){
let B=null;
const D=window.desktop;
const api={board:D.wfBoard,move:D.wfMove,add:D.wfAdd,remove:D.wfRemove,cands:D.wfCands,late:D.wfLate,display:D.wfDisplay,web:D.wfWeb,
  unlock:D.wfUnlock||D.unlock,setWho:async n=>{await D.setWho(n);try{D.auditLogin('');}catch(_){}if(window.__whoChip)window.__whoChip();},
  annPublish:D.wfAnnPublish,annHide:D.wfAnnHide,
  go:(sys,fn)=>D.go(sys,fn||undefined),modal:on=>D.modal(on),onChange:cb=>D.onWf(cb)};
function ensure(){if(B)return;const r=document.getElementById('wfRoot');if(!r||!window.FlowBoard)return;
  B=window.FlowBoard.mount(r,api,{edit:true,header:true,logo:'logo.png',toast:m=>window.flash&&flash(m)});}
const prev=window.onNav;
window.onNav=s=>{if(prev)prev(s);if(s.current==='wf'){ensure();if(B)B.refresh();}};
if(window.desktop.onFin)window.desktop.onFin(()=>{if(B)B.refresh();});
window.__flowBoard=()=>B;
/* التبليغ الجديد يظهر بملء الشاشة فوق البرنامج كله (يُخفى النظام المفتوح مؤقتاً) حتى «اطّلعت» أو انتهاء مدته أو إخفائه من المدير */
let annShown=null;
function annClose(){const o=document.getElementById('annFull');if(o){o.remove();try{D.modal(false);}catch(_){}}annShown=null;}
if(D.onAnn)D.onAnn(st=>{if(!window.FlowBoard)return;
  if(annShown&&!(st.active||[]).includes(annShown))annClose();
  const a=st.show;if(!a||annShown===a.id)return;if(annShown)annClose();
  window.FlowBoard.injectCss();const w=document.createElement('div');w.id='annFull';w.innerHTML=window.FlowBoard.annHtml(a,{logo:'logo.png',button:'اطّلعت',pdfOpen:true});
  document.body.appendChild(w);annShown=a.id;try{D.modal(true);}catch(_){}
  const b=w.querySelector('[data-annok]');b.focus();b.onclick=()=>{const id=annShown;annClose();D.wfAnnSeen(id);};});
})();
