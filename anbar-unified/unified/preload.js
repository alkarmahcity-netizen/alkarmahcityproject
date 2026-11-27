'use strict';
// واجهة window.desktop لكل نظام داخل البرنامج الموحد: تحمل معرّف النظام (co / du / ad) مع كل نداء
const { contextBridge, ipcRenderer } = require('electron');
const APP = (process.argv.find(a => a.startsWith('--app-id=')) || '').slice(9);
contextBridge.exposeInMainWorld('desktop', {
  who: () => { try { return ipcRenderer.sendSync('audit:who') || ''; } catch (_) { return ''; } },   // اسم المعدِّل على هذه الحاسبة (المخاطبات: من طبع الكتاب)
  setWho: n => ipcRenderer.invoke('audit:setWho', n),
  fontsList: () => ipcRenderer.invoke('fonts:list'),
  fontsCollect: wanted => ipcRenderer.invoke('fonts:collect', wanted),
  fontsImport: () => ipcRenderer.invoke('fonts:import'),
  load: () => ipcRenderer.sendSync('data:load', APP),
  /* اللجنة المركزية للمصادقة: إحالات المدد ← المركزية ← المدد، وطلب مدة من أوامر التغيير */
  zcRefer: list => ipcRenderer.invoke('zc:refer', list), zcInbox: () => ipcRenderer.invoke('zc:inbox'), zcrStatus: withCode => ipcRenderer.invoke('zcr:status', !!withCode), zcrLink: code => ipcRenderer.invoke('zcr:link', code), zcrSync: () => ipcRenderer.invoke('zcr:sync'), zcrStop: () => ipcRenderer.invoke('zcr:stop'), zcrPw: (o, n) => ipcRenderer.invoke('zcr:pw', o, n), zclState: () => ipcRenderer.sendSync('zcl:state'), zclUnlock: pw => ipcRenderer.invoke('zcl:unlock', pw), zclFirst: pw => ipcRenderer.invoke('zcl:first', pw), zclReset: (m, pw) => ipcRenderer.invoke('zcl:reset', m, pw), zcPull: () => ipcRenderer.invoke('zc:pull'), zcDecide: p => ipcRenderer.invoke('zc:decide', p), zcOpen: key => ipcRenderer.invoke('zc:open', key), duFromCo: p => ipcRenderer.invoke('du:fromCo', p),
  dataPath: () => ipcRenderer.sendSync('data:path', APP),
  save: text => ipcRenderer.invoke('data:save', APP, text),
  saveSync: text => ipcRenderer.sendSync('data:saveSync', APP, text),
  saveFile: (name, data) => ipcRenderer.invoke('file:save', name, data),
  pdf: name => ipcRenderer.invoke('pdf:save', name),
  print: () => ipcRenderer.invoke('print:do'),
  openDataFolder: () => ipcRenderer.invoke('data:openFolder'),
  tomb: id => ipcRenderer.send('data:tomb', APP, id),
  regLoad: () => ipcRenderer.sendSync('reg:load'),
  plApproved: fn => ipcRenderer.sendSync('pl:apGet', fn),
  regStamp: () => ipcRenderer.sendSync('reg:stamp'),
  regSave: text => ipcRenderer.sendSync('reg:save', text),
  peek: id => ipcRenderer.sendSync('data:peek', id),
  acFinal: () => ipcRenderer.invoke('ac:final'),
  go: (id, fileNo) => ipcRenderer.invoke('nav:go', id, fileNo),
  openFile: p => ipcRenderer.invoke('file:open', p),
  showFile: p => ipcRenderer.invoke('file:show', p),
  spellLangs: () => ipcRenderer.sendSync('spell:langs'),
  archPick: rec => ipcRenderer.invoke('arch:pick', rec),
  archPut: (rec, name, data) => ipcRenderer.invoke('arch:put', rec, name, data),
  archPickDir: () => ipcRenderer.invoke('arch:pickDir'),
  purgeLegacy: () => ipcRenderer.invoke('ad:purgeLegacy'),
  accessImport: () => ipcRenderer.invoke(APP === 'co' ? 'co:accessImport' : 'ad:accessImport'),
  numState: () => ipcRenderer.sendSync('mgr:numState'),
  numUnlock: pw => ipcRenderer.invoke('mgr:numUnlock', pw),
  /* Google Drive لبريد القسم: إصدار المستند ورفع PDF تلقائياً (رمز QR يفتحه عند الجميع) */
  gdStatus: () => ipcRenderer.invoke('gd:status'), gdSetApp: (id, sec) => ipcRenderer.invoke('gd:setApp', id, sec), gdConnect: hint => ipcRenderer.invoke('gd:connect', hint),
  gdDisconnect: () => ipcRenderer.invoke('gd:disconnect'), gdExport: () => ipcRenderer.invoke('gd:exportSetup'), gdShareState: () => ipcRenderer.invoke('gd:shareState'), gdShare: (on, pw) => ipcRenderer.invoke('gd:share', on, pw), gdImport: code => ipcRenderer.invoke('gd:importSetup', code), gdReserve: name => ipcRenderer.invoke('gd:reserve', name), gdUpload: (id, name) => ipcRenderer.invoke('gd:upload', id, name), gdOwns: id => ipcRenderer.invoke('gd:owns', id),
  flowGet: key => ipcRenderer.invoke('wf:get', key),
  flowSet: (key, patch) => ipcRenderer.invoke('wf:set', key, patch),
  onFlow: cb => ipcRenderer.on('wf:changed', () => cb()),
  archImportPicked: (rec, key) => ipcRenderer.invoke('arch:importPicked', rec, key),
  archOpen: (rec, name) => ipcRenderer.invoke('arch:open', rec, name),
  archShow: (rec, name) => ipcRenderer.invoke('arch:show', rec, name),
  archDel: (rec, name) => ipcRenderer.invoke('arch:del', rec, name),
  archHas: (rec, name) => ipcRenderer.sendSync('arch:has', rec, name),
  deviceName: () => ipcRenderer.sendSync('device:name'),
  syncMode: () => ipcRenderer.sendSync('sync:mode'),
  archExportFn: (title, items) => ipcRenderer.invoke('arch:exportFn', title, items),
  archPurge: keep => ipcRenderer.invoke('arch:purge', keep),
  /* التقارير الشهرية لدوائر المقيم */
  mrCfg: set => ipcRenderer.invoke('mr:cfg', set), mrShare: (on, pw) => ipcRenderer.invoke('mr:share', on, pw), mrPull: () => ipcRenderer.invoke('mr:pull'), mrPdf: rec => ipcRenderer.invoke('mr:pdf', rec), mrLocal: list => ipcRenderer.invoke('mr:local', list)
});

/* نشاط المستخدم (الفأرة والتمرير واللمس، لا لوحة المفاتيح فقط) يمدّ مهلة القفل التلقائي */
{ let t = 0; const act = () => { const n = Date.now(); if (n - t > 3000) { t = n; try { ipcRenderer.send('ui:activity'); } catch (_) {} } };
  ['mousemove', 'mousedown', 'wheel', 'keydown', 'touchstart', 'scroll'].forEach(ev => window.addEventListener(ev, act, { capture: true, passive: true })); }
