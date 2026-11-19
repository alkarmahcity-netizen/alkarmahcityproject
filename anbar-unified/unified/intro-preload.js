'use strict';
// فيديو البداية: إبلاغ البرنامج بانتهائه (وبخيار «عدم العرض عند التشغيل»)
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('intro', { done: off => ipcRenderer.send('intro:done', !!off) });
