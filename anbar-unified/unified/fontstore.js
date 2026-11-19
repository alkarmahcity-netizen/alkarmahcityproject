'use strict';
/* خزانة الخطوط داخل البرنامج (مشتركة: أوامر التغيير والبرنامج الموحد؛ منقولة من برنامج المخاطبات)
   تُحفظ ملفات الخطوط (.ttf/.otf) في مجلد «خطوط» بجانب بيانات البرنامج وتُحمَّل منه عند كل تشغيل، فخطوط الكتب الرسمية
   (PT Bold Heading، Simplified Arabic …) — وهي خطوط تجارية لا تُوزَّع مع البرنامج — تُنسخ من حاسبة القسم المرخَّصة أو من ملف .ttf
   وتبقى مع البرنامج إن نُقل إلى حاسبة لا تحويها.
   الاستعمال: require('./fontstore')({ ipcMain, dialog, app, dir: () => مجلد البيانات, win: () => النافذة }) */
const fs = require('fs'), path = require('path');
module.exports = function register(opt) {
const { ipcMain, dialog, app } = opt;
/* ===== الخطوط داخل البرنامج =====
   تُحفظ ملفات الخطوط (.ttf/.otf) في «بيانات-المخاطبات\خطوط» بجانب البرنامج، وتُحمَّل منها عند كل تشغيل؛
   فخطوط الكتب الرسمية (Simplified Arabic، PT Bold Heading …) تبقى مع البرنامج إن نُقل إلى حاسبة لا تحويها. */
const fontsDir = () => path.join(opt.dir(), 'خطوط');
// يقرأ اسم عائلة الخط ووزنه من جدولي name و OS/2 داخل الملف
function fontInfo(src) {
  // src: Buffer كامل أو مسار ملف (يُقرأ منه رأس الجداول وجدول الأسماء فقط، فالمسح سريع حتى مع مئات الخطوط)
  let fd = null;
  try {
    const rd = Buffer.isBuffer(src) ? (o, l) => src.slice(o, o + l)
      : (fd = fs.openSync(src, 'r'), (o, l) => { const b = Buffer.alloc(l); const n = fs.readSync(fd, b, 0, l, o); return b.slice(0, n); });
    const hd = rd(0, 12); if (hd.length < 12) return null;
    const tag = hd.toString('latin1', 0, 4);
    if (!['\x00\x01\x00\x00', 'OTTO', 'true'].includes(tag)) return null;
    const n = hd.readUInt16BE(4), dir = rd(12, n * 16), tables = {};
    for (let i = 0; i < n; i++) { const o = i * 16; tables[dir.toString('latin1', o, o + 4)] = [dir.readUInt32BE(o + 8), dir.readUInt32BE(o + 12)]; }
    if (!tables.name || tables.name[1] > 2e6) return null;
    const nb = rd(tables.name[0], tables.name[1]);
    const cnt = nb.readUInt16BE(2), so = nb.readUInt16BE(4), names = {};
    for (let i = 0; i < cnt; i++) {
      const r = 6 + i * 12, pid = nb.readUInt16BE(r), lid = nb.readUInt16BE(r + 4), id = nb.readUInt16BE(r + 6), len = nb.readUInt16BE(r + 8), off = nb.readUInt16BE(r + 10);
      if (![1, 2, 16, 17].includes(id)) continue;
      const raw = nb.slice(so + off, so + off + len); let v;
      if (pid === 3 || pid === 0) { const sw = Buffer.alloc(raw.length); for (let j = 0; j + 1 < raw.length; j += 2) { sw[j] = raw[j + 1]; sw[j + 1] = raw[j]; } v = sw.toString('utf16le'); }
      else if (pid === 1) v = raw.toString('latin1'); else continue;
      const score = (pid === 3 ? 4 : 0) + (lid === 0x409 || lid === 0 ? 2 : 0);
      if (!names[id] || names[id].score < score) names[id] = { v: v.replace(/\0/g, '').trim(), score };
    }
    const fam = (names[16] || names[1] || {}).v; if (!fam) return null;
    const sub = ((names[17] || names[2] || {}).v || '').toLowerCase();
    let weight = /bold|heavy|black/.test(sub) ? 700 : 400; const italic = /italic|oblique/.test(sub);
    if (tables['OS/2']) { const os = rd(tables['OS/2'][0], 6); if (os.length >= 6) { const w = os.readUInt16BE(4); if (w >= 100 && w <= 900) weight = w >= 600 ? 700 : 400; } }
    return { family: fam, weight, italic };
  } catch (_) { return null; }
  finally { if (fd != null) try { fs.closeSync(fd); } catch (_) {} }
}
const isFontFile = f => /\.(ttf|otf)$/i.test(f);
function listFontDir(dir) { try { return fs.readdirSync(dir).filter(isFontFile).map(f => path.join(dir, f)); } catch (_) { return []; } }
function systemFontDirs() {
  if ((process.env.LT_FONT_SRC || process.env.FONT_SRC_TEST)) return [(process.env.LT_FONT_SRC || process.env.FONT_SRC_TEST)];
  const d = [];
  if (process.platform === 'win32') {
    d.push(path.join(process.env.WINDIR || 'C:\\Windows', 'Fonts'));
    if (process.env.LOCALAPPDATA) d.push(path.join(process.env.LOCALAPPDATA, 'Microsoft', 'Windows', 'Fonts'));
  } else d.push('/usr/share/fonts', path.join(app.getPath('home'), '.fonts'));
  return d;
}
function savedFonts() { return listFontDir(fontsDir()).map(f => { try { const b = fs.readFileSync(f); const i = fontInfo(b); return i ? { ...i, file: f, buf: b } : null; } catch (_) { return null; } }).filter(Boolean); }
function saveFontFile(src, buf) {
  fs.mkdirSync(fontsDir(), { recursive: true });
  let dst = path.join(fontsDir(), path.basename(src));
  if (fs.existsSync(dst)) { try { if (fs.readFileSync(dst).equals(buf)) return dst; } catch (_) {} dst = path.join(fontsDir(), Date.now() + '-' + path.basename(src)); }
  fs.writeFileSync(dst, buf); return dst;
}
ipcMain.handle('fonts:list', () => savedFonts().map(f => ({ family: f.family, weight: f.weight, italic: f.italic, data: new Uint8Array(f.buf) })));
// ينسخ من خطوط الحاسبة كل ملف تنتمي عائلته إلى الخطوط المطلوبة ولم يُحفظ بعد (عادي وغامق)
ipcMain.handle('fonts:collect', (_e, wanted) => {
  const want = new Set((Array.isArray(wanted) ? wanted : []).map(x => String(x).toLowerCase()));
  const have = new Set(savedFonts().map(f => (f.family + '|' + f.weight + '|' + f.italic).toLowerCase()));
  const copied = new Set();
  for (const dir of systemFontDirs()) {
    const files = [];
    (function walk(d, depth) { for (const f of listFontDir(d)) files.push(f); if (depth < 3) { try { for (const e of fs.readdirSync(d, { withFileTypes: true })) if (e.isDirectory()) walk(path.join(d, e.name), depth + 1); } catch (_) {} } })(dir, 0);
    for (const f of files) {
      try {
        const i = fontInfo(f); if (!i || i.italic || !want.has(i.family.toLowerCase())) continue;
        const k = (i.family + '|' + i.weight + '|' + i.italic).toLowerCase(); if (have.has(k)) continue;
        if (fs.statSync(f).size > 30e6) continue;
        saveFontFile(f, fs.readFileSync(f)); have.add(k); copied.add(i.family);
      } catch (_) {}
    }
  }
  return { copied: [...copied], dir: fontsDir() };
});
ipcMain.handle('fonts:import', async () => {
  let files = process.env.LT_TEST_FONT_FILES ? process.env.LT_TEST_FONT_FILES.split(path.delimiter) : null;
  if (!files) {
    const r = await dialog.showOpenDialog(opt.win(), { title: 'اختر ملف الخط', properties: ['openFile', 'multiSelections'], filters: [{ name: 'خطوط', extensions: ['ttf', 'otf', 'TTF', 'OTF'] }] });
    if (r.canceled || !r.filePaths.length) return 'cancel';
    files = r.filePaths;
  }
  const fams = new Set();
  for (const f of files) { try { const b = fs.readFileSync(f), i = fontInfo(b); if (!i) continue; saveFontFile(f, b); fams.add(i.family); } catch (_) {} }
  return [...fams];
});
return { savedFonts };   // للبرنامج الموحد: نسخة الطباعة تحمل هذه الخطوط
};
