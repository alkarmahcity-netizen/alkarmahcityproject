'use strict';
/* window.desktop لصفحتي البرنامج (am: المشاريع، aml: المخاطبات) وللشريط العلوي (shell) */
const { contextBridge, ipcRenderer } = require('electron');
const APP = (process.argv.find(a => a.startsWith('--app-id=')) || '').slice(9);
if (APP === 'shell') {
  contextBridge.exposeInMainWorld('amana', {
    go: id => ipcRenderer.invoke('nav:go', id),
    onState: cb => ipcRenderer.on('nav:state', (_e, id) => cb(id)),
    openDataFolder: () => ipcRenderer.invoke('data:openFolder'),
    info: () => ipcRenderer.sendSync('app:info')
  });
} else {
  contextBridge.exposeInMainWorld('desktop', {
    load: () => ipcRenderer.sendSync('data:load', APP),
    dataPath: () => ipcRenderer.sendSync('data:path', APP),
    save: text => ipcRenderer.invoke('data:save', APP, text),
    saveSync: text => ipcRenderer.sendSync('data:saveSync', APP, text),
    tomb: () => {},
    saveFile: (name, data) => ipcRenderer.invoke('file:save', name, data),
    pdf: name => ipcRenderer.invoke('pdf:save', name),
    openFile: p => ipcRenderer.invoke('file:open', p),
    showFile: p => ipcRenderer.invoke('file:show', p),
    openDataFolder: () => ipcRenderer.invoke('data:openFolder'),
    go: (id, arg) => ipcRenderer.invoke('nav:go', id, arg),
    who: () => { try { return ipcRenderer.sendSync('who:get') || ''; } catch (_) { return ''; } },
    setWho: n => ipcRenderer.invoke('who:set', n),
    /* المخاطبات تقرأ مشاريع البرنامج لتملأ الأمر الإداري */
    amData: () => ipcRenderer.sendSync('data:load', 'am')
  });
}
