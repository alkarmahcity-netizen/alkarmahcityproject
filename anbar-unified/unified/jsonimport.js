'use strict';
/* استيراد شامل لملفات JSON من الحاسبة: يبحث عن ملفات الأنظمة (نسخ احتياطية، ملفات البرامج المستقلة القديمة، ملفات حُفظت يدوياً)،
   ويتعرف على نوع كل ملف من محتواه (لا من اسمه)، ويدمج سجلاته في النظام المناسب داخل البرنامج الموحد:
   - السجل الجديد يُضاف، والموجود يُستبدل فقط إن كانت نسخة الملف أحدث تعديلاً (updated)، ولا يُحذف شيء؛
   - السجل المحذوف عمداً (له شاهد حذف في المزامنة) لا يُعاد؛
   - ملف «التحويل الأول» للأرشيف القديم (old-access، فيه أخطاء) يُتجاوز؛ ولأرشيف السلف تُتجاوز النسخة 2 وتُستعمل النسخة 3 (old-access-v3)؛
   - ملفات بيانات البرنامج نفسه ونسخه الاحتياطية لا تُقرأ. */
const fs = require('fs');
const path = require('path');

const SYS = { co: 'أوامر التغيير', ad: 'لجنة تدقيق السلف', du: 'المدد والتوقف', in: 'إطلاق التأمينات', lt: 'المخاطبات والمطالعات', fu: 'مطالعات أوامر التغيير' };
const KEY = { co: 'records', ad: 'records', du: 'recs', in: 'records', lt: 'records', fu: 'records' };
const APPS = { 'anbar-change-orders': 'co', 'anbar-advances': 'ad', 'anbar-durations': 'du', 'anbar-insurance': 'in', 'anbar-letters': 'lt', 'anbar-followup': 'fu' };
const SKIP_DIRS = /^(node_modules|\$Recycle\.Bin|System Volume Information|Windows|Program Files|Program Files \(x86\)|ProgramData|\.git|\.cache|AppData|Microsoft|OneDriveTemp|backups)$/i;

const isObj = x => !!x && typeof x === 'object' && !Array.isArray(x);
/* نوع السجل من شكله */
function kindOf(r) {
  if (!isObj(r)) return '';
  if (r.project && Array.isArray(r.orders)) return 'co';
  if (r.project && Array.isArray(r.advances)) return 'ad';
  if (r.project && (r.co || r.conc) && (r.del || r.add || r.nw || r.tx)) return 'fu';
  if (r.project && Array.isArray(r.approvals) && (r.dec || r.committee)) return 'in';
  if ((r.type === 'memo' || r.type === 'letter' || r.type) && (typeof r.body === 'string' || r.sign || r.subject !== undefined) && !r.project) return 'lt';
  if (isObj(r.data) && isObj(r.data.p)) return 'du';
  if (isObj(r.p) && Array.isArray(r.exts)) return 'du1';
  return '';
}
/* محتوى ملف → {ds, records, skip?} */
function detect(d) {
  if (!d) return null;
  if (isObj(d) && /^old-access$/.test(String(d.source || ''))) return { skip: 'نسخة التحويل الأول للأرشيف القديم (فيها أخطاء) — استعمل الملف المصحح' };
  if (isObj(d) && d.app === 'anbar-advances' && /^old-access-v2$/.test(String(d.source || ''))) return { skip: 'نسخة سابقة من أرشيف السلف القديم (بلا أرقام الاستمارات، وفيها الاستمارات الفارغة) — استعمل النسخة 3 (old-access-v3)' };
  let list = null, ds = isObj(d) ? APPS[d.app] || '' : '';
  if (Array.isArray(d)) list = d;
  else if (isObj(d)) {
    if (Array.isArray(d.recs)) { list = d.recs; ds = ds || 'du'; }
    else if (Array.isArray(d.records)) list = d.records;
    else if (isObj(d.record)) list = [d.record];
    else list = [d];
  }
  if (!list || !list.length) return null;
  const kinds = {}; list.forEach(r => { const k = kindOf(r); if (k) kinds[k] = (kinds[k] || 0) + 1; });
  let k = ds || Object.keys(kinds).sort((a, b) => kinds[b] - kinds[a])[0] || '';
  if (k === 'du1') { list = list.filter(r => kindOf(r) === 'du1').map(r => ({ id: String(r.rid || ''), created: Date.now(), updated: +r.updated || Date.now(), data: r })).filter(r => r.id); k = 'du'; }
  if (!SYS[k]) return null;
  const recs = list.filter(r => isObj(r) && r.id && (k === 'du' ? isObj(r.data) : kindOf(r) === k || (k === 'lt' && !r.project)) && !r.demo);
  return recs.length ? { ds: k, records: recs } : null;
}

module.exports = function createImporter(ctx) {
  // ctx: { dataDir(), readData(ds), writeData(ds,text), applied(ds), isTomb(ds,id), dirs(): [{dir, depth}] , dialogDirs?() }
  function walk(root, depth, out, seen) {
    let ents; try { ents = fs.readdirSync(root, { withFileTypes: true }); } catch (_) { return; }
    for (const e of ents) {
      if (out.length >= 3000) return;
      const p = path.join(root, e.name);
      if (e.isDirectory()) { if (depth > 0 && !SKIP_DIRS.test(e.name) && !e.name.startsWith('.')) walk(p, depth - 1, out, seen); continue; }
      if (!/\.json$/i.test(e.name) || seen.has(p)) continue;
      seen.add(p); out.push(p);
    }
  }
  function current(ds) {
    let o = {}; try { o = JSON.parse(ctx.readData(ds) || '{}') || {}; } catch (_) { o = {}; }
    const L = Array.isArray(o[KEY[ds]]) ? o[KEY[ds]] : []; const m = new Map(); L.forEach(r => { if (r && r.id) m.set(String(r.id), r); });
    return { o, L, m };
  }
  const upd = r => +r.updated || 0;
  /* البحث: كل ملف JSON في المجلدات المعطاة (أو الافتراضية)، مع عدد السجلات الجديدة والأحدث لكل نظام */
  function scan(dirs) {
    const live = path.resolve(ctx.dataDir()), seen = new Set(), files = [];
    for (const d of (dirs && dirs.length ? dirs.map(x => (typeof x === 'string' ? { dir: x, depth: 4 } : x)) : ctx.dirs())) {
      if (!d || !d.dir) continue; let st; try { st = fs.statSync(d.dir); } catch (_) { continue; }
      if (st.isFile()) { if (/\.json$/i.test(d.dir)) { seen.add(d.dir); files.push(d.dir); } continue; }
      walk(d.dir, d.depth == null ? 3 : d.depth, files, seen);
    }
    const cur = {}; Object.keys(SYS).forEach(ds => { cur[ds] = current(ds); });
    const out = [];
    for (const f of files) {
      const rp = path.resolve(f); if (rp.startsWith(live + path.sep) || rp === live) continue;   // ملفات البرنامج نفسه ونسخه الاحتياطية
      let st; try { st = fs.statSync(f); } catch (_) { continue; } if (st.size < 20 || st.size > 120 * 1024 * 1024) continue;
      let d; try { d = JSON.parse(fs.readFileSync(f, 'utf8').replace(/^﻿/, '')); } catch (_) { continue; }
      const r = detect(d); if (!r) continue;
      if (r.skip) { out.push({ file: f, name: path.basename(f), dir: path.dirname(f), size: st.size, mtime: st.mtimeMs, ds: '', sys: '', total: 0, fresh: 0, newer: 0, same: 0, deleted: 0, skip: r.skip }); continue; }
      const C = cur[r.ds]; let fresh = 0, newer = 0, same = 0, deleted = 0;
      r.records.forEach(x => { const id = String(x.id), o = C.m.get(id); if (ctx.isTomb && ctx.isTomb(r.ds, id)) deleted++; else if (!o) fresh++; else if (upd(x) > upd(o)) newer++; else same++; });
      out.push({ file: f, name: path.basename(f), dir: path.dirname(f), size: st.size, mtime: st.mtimeMs, ds: r.ds, sys: SYS[r.ds], total: r.records.length, fresh, newer, same, deleted });
    }
    return out.sort((a, b) => (a.ds || 'z').localeCompare(b.ds || 'z') || b.fresh + b.newer - (a.fresh + a.newer) || b.mtime - a.mtime);
  }
  /* الدمج: الملفات المختارة، كل ملف في نظامه */
  function apply(files) {
    const by = {}, res = {};
    for (const f of files || []) { let d; try { d = JSON.parse(fs.readFileSync(f, 'utf8').replace(/^﻿/, '')); } catch (_) { continue; } const r = detect(d); if (!r || r.skip) continue; (by[r.ds] = by[r.ds] || []).push(...r.records); }
    for (const ds of Object.keys(by)) {
      const C = current(ds); let added = 0, replaced = 0;
      for (const x of by[ds]) { const id = String(x.id); if (ctx.isTomb && ctx.isTomb(ds, id)) continue; const o = C.m.get(id);
        if (!o) { C.L.push(x); C.m.set(id, x); added++; } else if (upd(x) > upd(o)) { C.L[C.L.indexOf(o)] = x; C.m.set(id, x); replaced++; } }
      if (added || replaced) { C.o[KEY[ds]] = C.L; if (!C.o.app && ds !== 'du') C.o.app = Object.keys(APPS).find(k => APPS[k] === ds); ctx.writeData(ds, JSON.stringify(C.o)); try { ctx.applied(ds); } catch (_) {} }
      res[ds] = { sys: SYS[ds], added, replaced };
    }
    return res;
  }
  return { scan, apply, detect, SYS };
};
