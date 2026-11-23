'use strict';
/* صور المشاريع (بطاقة المشروع في الموقف العام): 3 صور كحد أقصى لكل مشروع، مصغّرة داخل البرنامج إلى 300 كيلوبايت أو أقل.
   - الملفات: «صور-المشاريع/<مجلد الاضبارة>/p<وقت>.jpg» في مجلد البيانات (لا داخل ملفات البيانات، فلا يثقل الموقف).
   - أسماء صور كل مشروع تُحفظ في بيانات المشروع بسجل الموقف (meta.photos = «اسم1;اسم2;اسم3» أو «-» لا صور) فتُزامَن معه،
     والملفات نفسها تُزامَن كمجموعة pph (المذكورة في السجل فقط). */
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const MAX_BYTES = 330 * 1024, MAX_N = 3;
const okName = n => /^p[0-9a-z]{6,16}\.jpg$/.test(String(n || ''));
const dirOf = fn => { const s = String(fn == null ? '' : fn); const c = s.replace(/[^\w؀-ۿ-]+/g, '_').slice(0, 40) || 'p'; return c + '-' + crypto.createHash('sha1').update(s).digest('hex').slice(0, 6); };
const listOf = v => String(v || '').split(';').map(x => x.trim()).filter(okName).slice(0, MAX_N);
module.exports = function createPhotos(ctx) {
  // ctx: dataDir(), regFile()
  const root = () => path.join(ctx.dataDir(), 'صور-المشاريع');
  const fileOf = (fn, name) => path.join(root(), dirOf(fn), name);
  function save(fn, dataUrl) {
    if (!String(fn || '').trim()) return { error: 'لا يوجد رقم اضبارة' };
    const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || '')); if (!m) return { error: 'الصورة غير صالحة' };
    const b = Buffer.from(m[1], 'base64'); if (b.length > MAX_BYTES) return { error: 'الصورة أكبر من 300 كيلوبايت' };
    if (!(b[0] === 0xff && b[1] === 0xd8)) return { error: 'الصورة ليست JPEG' };
    const name = 'p' + Date.now().toString(36) + crypto.randomBytes(2).toString('hex') + '.jpg';
    const f = fileOf(fn, name); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, b);
    return { ok: true, name, kb: Math.round(b.length / 1024) };
  }
  function read(fn, name) { if (!okName(name)) return null; try { return 'data:image/jpeg;base64,' + fs.readFileSync(fileOf(fn, name)).toString('base64'); } catch (_) { return null; } }
  function del(fn, name) { if (!okName(name)) return false; try { fs.unlinkSync(fileOf(fn, name)); return true; } catch (_) { return false; } }
  /* الصور المذكورة في سجل الموقف: مفتاح المزامنة «مجلد/اسم» */
  function refs() {
    const out = new Map(); let d = null; try { d = JSON.parse(fs.readFileSync(ctx.regFile(), 'utf8')); } catch (_) { return out; }
    const M = (d && d.meta) || {}; for (const fn of Object.keys(M)) for (const n of listOf(M[fn] && M[fn].photos)) out.set(dirOf(fn) + '/' + n, fn);
    return out;
  }
  /* ---- المزامنة (pph) ---- */
  const okKey = k => /^[^\\/:*?"<>|]{1,60}\/p[0-9a-z]{6,16}\.jpg$/.test(k) && !k.includes('..');
  function digest() {
    const R = refs(), ids = {};
    for (const k of R.keys()) { try { const st = fs.statSync(path.join(root(), k)); if (st.isFile() && st.size <= MAX_BYTES) ids[k] = st.size; } catch (_) {} }
    // تنظيف: صورة لم تعد في السجل (حُذفت أو استُبدلت) تُحذف بعد ساعة (الوقت يسمح بوصول السجل قبل ملفه أو بعده)
    try { const now = Date.now(); for (const d of fs.readdirSync(root())) { const D = path.join(root(), d); let L; try { L = fs.readdirSync(D); } catch (_) { continue; }
      for (const n of L) { const k = d + '/' + n; if (!okName(n) || R.has(k)) continue; try { const st = fs.statSync(path.join(D, n)); if (now - st.mtimeMs > 3600e3) fs.unlinkSync(path.join(D, n)); } catch (_) {} } } } catch (_) {}
    return { ids, tomb: {} };
  }
  function get(wanted) { const out = []; let total = 0; for (const k of wanted || []) { if (!okKey(k)) continue; try { const b = fs.readFileSync(path.join(root(), k)); if (b.length > MAX_BYTES) continue; if (out.length && total + b.length > 12 * 1024 * 1024) break; total += b.length; out.push({ id: k, u: b.length, v: b.toString('base64') }); } catch (_) {} } return out; }
  function apply(items) { let n = 0; for (const it of items || []) { const k = it && it.id; if (!okKey(k) || typeof it.v !== 'string') continue;
      try { const b = Buffer.from(it.v, 'base64'); if (b.length > MAX_BYTES || !(b[0] === 0xff && b[1] === 0xd8)) continue; const f = path.join(root(), k); let same = false; try { same = fs.statSync(f).size === b.length; } catch (_) {}
        if (!same) { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, b); n++; } } catch (_) {} }
    return n; }
  return { save, read, del, refs, digest, get, apply, root, dirOf, MAX_N };
};
module.exports.dirOf = dirOf; module.exports.listOf = listOf; module.exports.MAX_N = MAX_N;
