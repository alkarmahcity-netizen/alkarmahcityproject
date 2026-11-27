'use strict';
/* برنامج «مشاريع التنفيذ أمانة» المستقل — محافظة الأنبار / قسم الشؤون الهندسية / شعبة تنفيذ العمل أمانة.
   نافذة واحدة بتبويبين: «المشاريع» (app/am.html) و«المخاطبات» (app/lt.html بوضع aml وترويسة الشعبة).
   البيانات: مجلد «بيانات مشاريع الأمانة» بجانب البرنامج (يُنقل معه على الفلاش)، وإن تعذّرت الكتابة هناك فمجلد المستخدم.
   نسخة احتياطية يومية لكل ملف (آخر 30) في «نسخ-احتياطية». */
const { app, BrowserWindow, BrowserView, ipcMain, dialog, shell } = require('electron');
const fs = require('fs'), path = require('path');
app.commandLine.appendSwitch('lang', 'en-GB');   // حقول التاريخ يوم/شهر/سنة

const VIEWS = {
  am: { title: 'المشاريع', file: 'app/am.html', query: {}, data: 'AmanaProjects-Data.json' },
  aml: { title: 'المخاطبات', file: 'app/lt.html', query: { ltm: 'aml' }, data: 'AmanaLetters-Data.json' }
};
const BAR = 46;
let win = null, dataDir = null, current = 'am';
const views = {};

function pickDataDir() {
  if (process.env.AMANA_DATA_DIR) return process.env.AMANA_DATA_DIR;   // للاختبار
  const bases = [process.env.PORTABLE_EXECUTABLE_DIR, app.isPackaged ? path.dirname(app.getPath('exe')) : null].filter(Boolean);
  for (const b of bases) {
    const d = path.join(b, 'بيانات مشاريع الأمانة');
    try { fs.mkdirSync(d, { recursive: true }); const t = path.join(d, '.w'); fs.writeFileSync(t, '1'); fs.unlinkSync(t); return d; } catch (_) {}
  }
  const d = path.join(app.getPath('documents'), 'بيانات مشاريع الأمانة'); fs.mkdirSync(d, { recursive: true }); return d;
}
const fileOf = id => path.join(dataDir, VIEWS[id].data);
const okId = id => Object.prototype.hasOwnProperty.call(VIEWS, id);
const looksJson = t => { try { const o = JSON.parse(t); return o && typeof o === 'object'; } catch (_) { return false; } };
function atomicWrite(f, text) { const tmp = f + '.tmp'; fs.writeFileSync(tmp, text); fs.renameSync(tmp, f); }
function backup(id) {
  try {
    const f = fileOf(id); if (!fs.existsSync(f)) return;
    const bd = path.join(dataDir, 'نسخ-احتياطية'); fs.mkdirSync(bd, { recursive: true });
    const day = new Date().toISOString().slice(0, 10), b = path.join(bd, VIEWS[id].data.replace('.json', '') + '_' + day + '.json');
    if (!fs.existsSync(b)) fs.copyFileSync(f, b);
    const old = fs.readdirSync(bd).filter(n => n.startsWith(VIEWS[id].data.replace('.json', '') + '_')).sort(); while (old.length > 30) fs.unlinkSync(path.join(bd, old.shift()));
  } catch (_) {}
}
const readData = id => { try { return fs.readFileSync(fileOf(id), 'utf8'); } catch (_) { return null; } };
function saveData(id, text) { if (!okId(id) || !looksJson(text)) return false; backup(id); atomicWrite(fileOf(id), text); return true; }
const prefsFile = () => path.join(dataDir, 'prefs.json');
const prefs = () => { try { return JSON.parse(fs.readFileSync(prefsFile(), 'utf8')) || {}; } catch (_) { return {}; } };
const setPref = (k, v) => { const p = prefs(); p[k] = v; try { atomicWrite(prefsFile(), JSON.stringify(p)); } catch (_) {} };
const idOf = sender => Object.keys(views).find(k => views[k].webContents === sender);

function layout() { if (!win) return; const [w, h] = win.getContentSize(); for (const v of Object.values(views)) v.setBounds({ x: 0, y: BAR, width: w, height: Math.max(0, h - BAR) }); }
function ensureView(id) {
  if (views[id]) return views[id];
  const v = new BrowserView({ webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: false, spellcheck: false, additionalArguments: ['--app-id=' + id] } });
  views[id] = v; win.addBrowserView(v); layout();
  v.webContents.loadFile(path.join(__dirname, VIEWS[id].file), { query: VIEWS[id].query });
  v.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/i.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  v.webContents.on('will-navigate', (e, url) => { if (/^https?:/i.test(url)) { e.preventDefault(); shell.openExternal(url); } });
  v.webContents.on('before-input-event', (e, i) => { if (i.type === 'keyDown' && i.key === 'F12' && !app.isPackaged) v.webContents.openDevTools({ mode: 'detach' }); });
  return v;
}
const loaded = v => new Promise(r => { if (!v.webContents.isLoading()) return r(); v.webContents.once('did-finish-load', () => r()); });
async function go(id, arg) {
  if (!okId(id)) return false;
  const v = ensureView(id); current = id; win.setTopBrowserView(v); v.webContents.focus();
  win.webContents.send('nav:state', id);
  if (arg) { await loaded(v); try { await v.webContents.executeJavaScript(`window.__openProject&&window.__openProject(${JSON.stringify(String(arg))})`); } catch (_) {} }
  if (id === 'am' && !arg) { try { await v.webContents.executeJavaScript('window.__syncReload&&window.__syncReload()'); } catch (_) {} }
  return true;
}

/* ---- واجهة window.desktop (preload.js) ---- */
ipcMain.on('data:load', (e, id) => { e.returnValue = okId(id) ? readData(id) : null; });
ipcMain.on('data:path', (e, id) => { e.returnValue = okId(id) ? fileOf(id) : ''; });
ipcMain.handle('data:save', (_e, id, text) => { try { return saveData(id, text); } catch (_) { return false; } });
ipcMain.on('data:saveSync', (e, id, text) => { try { e.returnValue = saveData(id, text); } catch (_) { e.returnValue = false; } });
ipcMain.handle('data:openFolder', () => shell.openPath(dataDir));
ipcMain.handle('nav:go', (_e, id, arg) => go(id, arg));
ipcMain.on('who:get', e => { e.returnValue = prefs().who || ''; });
ipcMain.handle('who:set', (_e, n) => { setPref('who', String(n || '').slice(0, 80)); return true; });
async function askPath(name) {
  const r = await dialog.showSaveDialog(win, { defaultPath: path.join(prefs().lastDir || app.getPath('documents'), String(name || 'ملف').replace(/[\\/:*?"<>|]+/g, '_')) });
  if (r.canceled || !r.filePath) return null; setPref('lastDir', path.dirname(r.filePath)); return r.filePath;
}
ipcMain.handle('file:save', async (_e, name, data) => { try { const p = await askPath(name); if (!p) return 'cancel'; fs.writeFileSync(p, typeof data === 'string' ? data : Buffer.from(data)); return 'ok'; } catch (_) { return 'error'; } });
ipcMain.handle('pdf:save', async (e, name) => {
  try { const p = await askPath(name); if (!p) return 'cancel';
    const buf = await e.sender.printToPDF({ printBackground: true, preferCSSPageSize: true, pageSize: 'A4', margins: { top: 0, bottom: 0, left: 0, right: 0 } });
    fs.writeFileSync(p, buf); shell.openPath(p); return 'ok'; } catch (_) { return 'error'; }
});
ipcMain.handle('file:open', async (_e, p) => { const m = await shell.openPath(String(p || '')); return { ok: !m, msg: m }; });
ipcMain.handle('file:show', (_e, p) => { shell.showItemInFolder(String(p || '')); return true; });
ipcMain.on('app:info', e => { e.returnValue = { ver: app.getVersion(), dir: dataDir }; });

app.whenReady().then(() => {
  dataDir = pickDataDir();
  win = new BrowserWindow({ width: 1400, height: 900, minWidth: 900, minHeight: 600, title: 'مشاريع التنفيذ أمانة', backgroundColor: '#f1efe9', show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, additionalArguments: ['--app-id=shell'] } });
  win.setMenu(null);
  win.loadFile(path.join(__dirname, 'shell.html'));
  win.once('ready-to-show', () => { win.maximize(); win.show(); });
  win.on('resize', layout);
  ensureView('am'); go('am');
  setTimeout(() => ensureView('aml'), 1500);   // يُحمَّل في الخلفية فيُفتح فوراً
  /* قبل الإغلاق: كل صفحة تحفظ ما لم يُحفظ بعد (الحفظ المؤجل) ثم تُغلق النافذة */
  let closing = false;
  win.on('close', e => { if (closing) return; e.preventDefault(); closing = true;
    Promise.all(Object.values(views).map(v => v.webContents.executeJavaScript('window.dispatchEvent(new Event("beforeunload"));1').catch(() => 0)))
      .finally(() => { try { win.destroy(); } catch (_) {} }); });
});
app.on('window-all-closed', () => app.quit());
if (!app.requestSingleInstanceLock()) app.quit(); else app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
global.__amana = { views, go };
