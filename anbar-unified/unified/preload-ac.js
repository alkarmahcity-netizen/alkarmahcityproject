'use strict';
// نظام الاستلام (خادم Go): طباعة وحفظ PDF وحفظ الملفات عبر البرنامج، دون ربط الاستلام ببيانات الأنظمة الأخرى
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('desktop', {
  saveFile: (name, data) => ipcRenderer.invoke('file:save', name, data),
  pdf: name => ipcRenderer.invoke('pdf:save', name),
  print: () => ipcRenderer.invoke('print:do'),
  /* لوحة سير المعاملات داخل الاستلام (الشريط المحقون) + لقطة سجلات الشهادات للوحة */
  flowGet: key => ipcRenderer.invoke('wf:get', key),
  flowSet: (key, patch) => ipcRenderer.invoke('wf:set', key, patch),
  onFlow: cb => ipcRenderer.on('wf:changed', () => cb()),
  acFlowSnap: snap => ipcRenderer.invoke('ac:flowSnap', snap)
});

/* نشاط المستخدم (الفأرة والتمرير واللمس، لا لوحة المفاتيح فقط) يمدّ مهلة القفل التلقائي */
{ let t = 0; const act = () => { const n = Date.now(); if (n - t > 3000) { t = n; try { ipcRenderer.send('ui:activity'); } catch (_) {} } };
  ['mousemove', 'mousedown', 'wheel', 'keydown', 'touchstart', 'scroll'].forEach(ev => window.addEventListener(ev, act, { capture: true, passive: true })); }
