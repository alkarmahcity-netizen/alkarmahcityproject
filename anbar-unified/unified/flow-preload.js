'use strict';
// نافذة «لوحة سير المعاملات» على الشاشة الثانية: قراءة فقط
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('flowApi', {
  board: () => ipcRenderer.invoke('wfd:board'),
  onChange: cb => ipcRenderer.on('wf:changed', (_e, r) => cb(r))
});
