'use strict';
// النسخ الاحتياطي الخارجي التلقائي: نسخة من مجلد البيانات كل يوم إلى فلاشة أو قرص ثانٍ أو مجلد شبكة،
// وتنبيه إن لم تُعمل النسخة منذ يومين. لا يلمس ملفات البيانات نفسها (قراءة فقط)، ويعمل في الخلفية بلا تجميد.
//   <المجلد المختار>/نسخة-نظام-الشؤون-الهندسية/<اسم الحاسبة>/الأحدث/   ← صورة مطابقة لمجلد البيانات (يُنسخ الجديد والمعدّل فقط)
//   <المجلد المختار>/نسخة-نظام-الشؤون-الهندسية/<اسم الحاسبة>/يومي/YYYY-MM-DD/ ← ملفات البيانات (JSON) لكل يوم، آخر 30 يوماً
const fs = require('fs'), fsp = fs.promises, path = require('path');
const ROOT = 'نسخة-نظام-الشؤون-الهندسية';
const DAY = 24 * 3600 * 1000;
const SKIP = new Set(['backups', 'errors.log']);   // النسخ اليومية الداخلية لا داعي لتكرارها في الخارج
const safeName = s => String(s || 'حاسبة').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '_').trim().slice(0, 60) || 'حاسبة';

module.exports = function createExtBackup(ctx) {
  // ctx: dataDir(), getCfg(), setCfg(cfg), device(), version, onState(state)
  let running = null, timer = null;
  const state = () => {
    const c = ctx.getCfg() || {};
    const now = Date.now(), ok = +c.lastOk || 0;
    const stale = !!c.dest && (!ok || now - ok > 2 * DAY);
    return { dest: c.dest || '', keepDays: +c.keepDays || 30, lastOk: ok, lastTry: +c.lastTry || 0, lastErr: c.lastErr || '', copied: +c.copied || 0, bytes: +c.bytes || 0, files: +c.files || 0,
      running: !!running, stale, quiet: !!process.env.UNI_MULTI && !process.env.UNI_XB_BANNER, ageDays: ok ? Math.floor((now - ok) / DAY) : null, folder: c.dest ? path.join(c.dest, ROOT, safeName(ctx.device())) : '' };
  };
  const push = () => { try { ctx.onState(state()); } catch (_) {} };
  const save = patch => { ctx.setCfg(Object.assign({}, ctx.getCfg() || {}, patch)); push(); };

  async function* walk(dir, rel = '') {
    let ents = [];
    try { ents = await fsp.readdir(dir, { withFileTypes: true }); } catch (_) { return; }
    for (const e of ents) {
      if (!rel && SKIP.has(e.name)) continue;
      if (/\.tmp$/i.test(e.name)) continue;
      const r = rel ? path.join(rel, e.name) : e.name;
      if (e.isDirectory()) yield* walk(path.join(dir, e.name), r); else if (e.isFile()) yield r;
    }
  }
  async function copyIfChanged(src, dst) {
    const s = await fsp.stat(src);
    try { const d = await fsp.stat(dst); if (d.size === s.size && Math.abs(d.mtimeMs - s.mtimeMs) < 2000) return 0; } catch (_) {}
    await fsp.mkdir(path.dirname(dst), { recursive: true });
    const tmp = dst + '.part';
    await fsp.copyFile(src, tmp); await fsp.rename(tmp, dst);
    try { await fsp.utimes(dst, s.atime, s.mtime); } catch (_) {}
    return s.size || 1;
  }
  async function doRun() {
    const c = ctx.getCfg() || {};
    if (!c.dest) return { ok: false, msg: 'لم يُختر مكان النسخة الاحتياطية بعد' };
    save({ lastTry: Date.now() });
    try {
      if (!fs.existsSync(c.dest)) throw new Error('المكان المختار غير موجود الآن (هل الفلاشة أو القرص موصول؟): ' + c.dest);
      const base = path.join(c.dest, ROOT, safeName(ctx.device()));
      const mirror = path.join(base, 'الأحدث');
      await fsp.mkdir(mirror, { recursive: true });
      const src = ctx.dataDir(); let copied = 0, bytes = 0, files = 0;
      for await (const rel of walk(src)) {
        files++;
        try { const b = await copyIfChanged(path.join(src, rel), path.join(mirror, rel)); if (b) { copied++; bytes += b; } } catch (e) { if (e && e.code === 'ENOSPC') throw new Error('لا توجد مساحة كافية في مكان النسخة الاحتياطية'); }
      }
      // نسخة يومية بملف واحد لكل الأنظمة («يومي/نسخة-الشؤون-الهندسية_<التاريخ>.zip») — للرجوع إلى يوم سابق؛ تُسترجع من «↺ استرجاع نسخة احتياطية»
      const day = new Date().toISOString().slice(0, 10), dd = path.join(base, 'يومي');
      await fsp.mkdir(dd, { recursive: true });
      if (ctx.bundle) await ctx.bundle(path.join(dd, 'نسخة-الشؤون-الهندسية_' + day + '.zip'));
      else { const d1 = path.join(dd, day); await fsp.mkdir(d1, { recursive: true }); for (const n of await fsp.readdir(src)) if (/\.json$/i.test(n)) { try { await fsp.copyFile(path.join(src, n), path.join(d1, n)); } catch (_) {} } }
      const keep = Math.max(3, +c.keepDays || 30);
      try { const zs = (await fsp.readdir(dd)).filter(n => /^نسخة-الشؤون-الهندسية_\d{4}-\d{2}-\d{2}\.zip$/.test(n)).sort(); while (zs.length > keep) await fsp.unlink(path.join(dd, zs.shift())); } catch (_) {}
      try { const ds = (await fsp.readdir(dd)).filter(n => /^\d{4}-\d{2}-\d{2}$/.test(n)).sort(); while (ds.length > keep) await fsp.rm(path.join(dd, ds.shift()), { recursive: true, force: true }); } catch (_) {}
      await fsp.writeFile(path.join(base, 'آخر-نسخة.txt'), `آخر نسخة احتياطية: ${new Date().toLocaleString('en-GB')}\r\nالحاسبة: ${ctx.device()}\r\nإصدار البرنامج: ${ctx.version}\r\nعدد الملفات: ${files}\r\n`, 'utf8');
      save({ lastOk: Date.now(), lastErr: '', copied, bytes, files });
      return { ok: true, copied, files, bytes, folder: base };
    } catch (e) {
      save({ lastErr: String(e && e.message || e) });
      return { ok: false, msg: String(e && e.message || e) };
    }
  }
  function run() { if (running) return running; running = doRun().finally(() => { running = null; push(); }); push(); return running; }
  // كل ساعة: إن مضى على آخر نسخة ناجحة 20 ساعة (أو لم تُعمل أبداً) تُعمل نسخة. أول فحص بعد دقيقتين من التشغيل
  function start() {
    const tick = () => { const s = state(); if (s.dest && !running && (!s.lastOk || Date.now() - s.lastOk > 20 * 3600 * 1000) && Date.now() - s.lastTry > 50 * 60 * 1000) run(); else push(); };
    setTimeout(tick, +process.env.UNI_XB_FIRST_MS || 120000); timer = setInterval(tick, 3600 * 1000);
  }
  return {
    state, run, start, stop: () => clearInterval(timer),
    set(c) { const cur = ctx.getCfg() || {}; const dest = String(c && c.dest != null ? c.dest : cur.dest || '').trim(); const keepDays = Math.min(365, Math.max(3, +(c && c.keepDays) || +cur.keepDays || 30));
      save({ dest, keepDays, ...(dest !== cur.dest ? { lastOk: 0, lastErr: '' } : {}) }); return state(); },
  };
};
