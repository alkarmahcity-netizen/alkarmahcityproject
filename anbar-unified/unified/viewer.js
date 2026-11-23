'use strict';
/* نسخة الاطلاع (المحافظ / النائب / المعاون): الموقف المركز + الموقف العام + مشاريع التخطيط + صور المشاريع — عرض فقط.
   - حاسبة القسم (البرنامج الكامل) تنشر ملفاً واحداً مشفّراً على Google Drive القسم (رابط «عارض» ثابت) ويُحدَّث تلقائياً،
     وكل صورة مشروع ملف مشفّر مستقل لا يُرفع إلا عند إضافتها أو تغييرها.
   - نسخة الاطلاع تقرأ الملف فقط (لا تكتب على Drive ولا ترسل شيئاً)، ولا تحتاج حساب Google.
   - الملف لا يحوي بيانات أوامر التغيير ولا السلف ولا المدد ولا المحاضر: سجل المشاريع (الموقف) + ملف التخطيط + عدد السلف لكل مشروع.
   - التشفير AES-128-GCM بمفتاح عشوائي لا يخرج إلا في «رمز الربط» (AV1.<معرّف الملف>.<المفتاح>) — الرابط وحده لا يكفي لقراءة الملف. */
const fs = require('fs'), path = require('path'), crypto = require('crypto'), zlib = require('zlib');
const MAGIC = Buffer.from('AV1'), FOLDER = 'نسخة الاطلاع — قسم الشؤون الهندسية';
const AUTO_MS = +process.env.UNI_VW_AUTO_MS || 10 * 60 * 1000, FETCH_MS = +process.env.UNI_VW_FETCH_MS || 5 * 60 * 1000;
const b64u = b => b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const ub64 = s => Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64');
function seal(key, buf) { const iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-128-gcm', key, iv); const ct = Buffer.concat([c.update(zlib.gzipSync(buf)), c.final()]); return Buffer.concat([MAGIC, iv, c.getAuthTag(), ct]); }
function unseal(key, b) {
  if (!Buffer.isBuffer(b) || b.length < 31 || !b.slice(0, 3).equals(MAGIC)) throw new Error('الملف المستلم ليس ملف نسخة الاطلاع');
  const d = crypto.createDecipheriv('aes-128-gcm', key, b.slice(3, 15)); d.setAuthTag(b.slice(15, 31));
  try { return zlib.gunzipSync(Buffer.concat([d.update(b.slice(31)), d.final()])); } catch (_) { throw new Error('رمز الربط لا يطابق الملف (أُصدر رمز جديد؟)'); }
}
const mkCode = (id, key) => 'AV1.' + id + '.' + b64u(key);
function parseCode(s) { const m = /^AV1\.([A-Za-z0-9_-]{10,})\.([A-Za-z0-9_-]{22})$/.exec(String(s || '').replace(/\s+/g, '')); if (!m) return null; const key = ub64(m[2]); return key.length === 16 ? { id: m[1], key, code: m[0] } : null; }
const sha1 = b => crypto.createHash('sha1').update(b).digest('hex');
function readJson(f) { try { return JSON.parse(fs.readFileSync(f, 'utf8')) || {}; } catch (_) { return {}; } }
function writeAtomic(f, data) { fs.mkdirSync(path.dirname(f), { recursive: true }); const t = f + '.tmp'; fs.writeFileSync(t, data); fs.renameSync(t, f); }
const encFor = ss => s => { try { if (ss && ss.isEncryptionAvailable()) return 'e:' + ss.encryptString(String(s)).toString('base64'); } catch (_) {} return 'p:' + Buffer.from(String(s)).toString('base64'); };
const decFor = ss => s => { s = String(s || ''); try { if (s.startsWith('e:')) return ss.decryptString(Buffer.from(s.slice(2), 'base64')); if (s.startsWith('p:')) return Buffer.from(s.slice(2), 'base64').toString(); } catch (_) {} return ''; };

/* ---------------- حاسبة القسم: النشر ---------------- */
function createPublisher(ctx) {
  // ctx: file() ملف الحالة، gd() وحدة Drive، readReg()، readPlan()، adIndex()، photoRefs() Map<«مجلد/اسم», رقم الاضبارة>، photoRoot()، safeStorage، log(m)
  const enc = encFor(ctx.safeStorage), dec = decFor(ctx.safeStorage);
  const load = () => readJson(ctx.file()), save = s => writeAtomic(ctx.file(), JSON.stringify(s));
  let busy = null, timer = null;
  const keyOf = st => { const k = ub64(dec(st.k)); return k.length === 16 ? k : null; };
  function status(withCode) {
    const st = load(), g = (() => { try { return ctx.gd().status(); } catch (_) { return {}; } })();
    const o = { on: !!st.fileId, connected: !!g.connected, email: g.email || '', at: st.at || 0, tried: st.tried || 0, err: st.err || '', size: st.size || 0, photos: Object.keys(st.photos || {}).length, busy: !!busy };
    if (withCode && st.fileId) { const k = keyOf(st); if (k) o.code = mkCode(st.fileId, k); }
    return o;
  }
  async function run(force) {
    const gd = ctx.gd(); if (!gd.status().connected) throw new Error('البرنامج غير مربوط ببريد القسم في Google Drive — اربطه أولاً من «إعدادات Google Drive» ثم أعد النشر');
    let st = load(), key = st.fileId ? keyOf(st) : null;
    if (!st.fileId || !key) {
      key = crypto.randomBytes(16);
      const r = await gd.reserveBin('نسخة-الاطلاع.bin', FOLDER);
      if (!r.shared) { try { await gd.trash(r.id); } catch (_) {} throw new Error('لم تسمح Google بمشاركة الملف «لمن لديه الرابط» (إعدادات بريد المحافظة) — لا تستطيع نسخة الاطلاع قراءته'); }
      st = { fileId: r.id, k: enc(b64u(key)), photos: {}, created: Date.now() }; save(st);
    }
    /* الصور: ملف لكل صورة، يُرفع مرة واحدة (ويُعاد فقط إن تغيّر محتواها) */
    const refs = ctx.photoRefs(), P = Object.assign({}, st.photos), ph = {};
    for (const [k, fn] of refs) {
      const f = path.join(ctx.photoRoot(), k); let s; try { s = fs.statSync(f); } catch (_) { continue; }
      const sig = s.mtimeMs + ':' + s.size; let e = P[k];
      if (!e || e.sig !== sig) {
        const b = fs.readFileSync(f), h = sha1(b);
        if (!e || e.h !== h) { const r = e && e.id ? { id: e.id } : await gd.reserveBin('صورة-' + h.slice(0, 10) + '.bin', FOLDER); await gd.uploadBin(r.id, seal(key, b)); e = { id: r.id, h }; }
        e = { id: e.id, h: e.h, sig };
        P[k] = e; st.photos = P; save(st);
      }
      ph[k] = { id: e.id, h: e.h, fn: String(fn) };
    }
    for (const k of Object.keys(P)) if (!refs.has(k)) { const id = P[k].id; delete P[k]; try { await gd.trash(id); } catch (_) {} }
    st.photos = P;
    const body = { reg: ctx.readReg() || null, pl: ctx.readPlan() || null, ad: ctx.adIndex() || null, ph };
    const h = sha1(JSON.stringify(body));
    st.tried = Date.now();
    if (!force && h === st.hash) { st.err = ''; save(st); return { ok: true, same: true, at: st.at }; }
    const at = Date.now(), buf = seal(key, Buffer.from(JSON.stringify(Object.assign({ app: 'anbar-viewer', v: 1, at }, body))));
    await gd.uploadBin(st.fileId, buf);
    Object.assign(st, { hash: h, at, size: buf.length, err: '' }); save(st);
    return { ok: true, at, size: buf.length };
  }
  function publish(force) {
    if (busy) return busy;
    busy = run(force).catch(e => { const m = String(e && e.message || e); try { const st = load(); if (st.fileId) { st.err = m; st.tried = Date.now(); save(st); } } catch (_) {} ctx.log && ctx.log(m); return { error: m }; })
      .finally(() => { busy = null; });
    return busy;
  }
  async function stop() {
    const st = load(), gd = ctx.gd(); const ids = [st.fileId].concat(Object.values(st.photos || {}).map(e => e.id)).filter(Boolean);
    let bad = 0; for (const id of ids) { try { await gd.trash(id); } catch (_) { bad++; } }
    try { fs.unlinkSync(ctx.file()); } catch (_) {}
    return { ok: true, removed: ids.length - bad, failed: bad };
  }
  function start() {
    if (timer) return;
    const tick = () => { try { if (load().fileId && !busy) publish(false); } catch (_) {} };
    setTimeout(tick, +process.env.UNI_VW_FIRST_MS || 120000); timer = setInterval(tick, AUTO_MS);
  }
  return { status, publish, stop, start };
}

/* ---------------- نسخة الاطلاع: القراءة فقط ---------------- */
function createReader(ctx) {
  // ctx: dir() مجلد نسخة الاطلاع، get(url) → Buffer (عبر شبكة Chromium)، writeReg(text)، writePlan(text)، notify(ds)، safeStorage، log(m)
  const enc = encFor(ctx.safeStorage), dec = decFor(ctx.safeStorage);
  const stFile = () => path.join(ctx.dir(), 'viewer-state.json'), pkgFile = () => path.join(ctx.dir(), 'viewer-package.json');
  const load = () => readJson(stFile()), save = s => writeAtomic(stFile(), JSON.stringify(s));
  const DL = () => process.env.UNI_VW_DL || 'https://drive.google.com/uc?export=download&id=';
  let busy = null, timer = null, pkg = null;
  const cur = () => { const c = parseCode(dec(load().c)); return c; };
  const meta = () => { if (!pkg) pkg = readJson(pkgFile()); return pkg; };
  async function download(id) {
    const b = await ctx.get(DL() + encodeURIComponent(id));
    if (!b || !b.length) throw new Error('لم يصل شيء من Google Drive');
    if (!b.slice(0, 3).equals(MAGIC)) throw new Error('Google Drive لم يُعطِ الملف (أُوقفت نسخة الاطلاع من حاسبة القسم، أو الرابط غير متاح للعرض)');
    return b;
  }
  async function pull(c) {
    const o = JSON.parse(unseal(c.key, await download(c.id)).toString('utf8'));
    if (!o || o.app !== 'anbar-viewer') throw new Error('الملف المستلم ليس ملف نسخة الاطلاع');
    return o;
  }
  function apply(o) {
    const m = meta(); if (m.at && o.at && o.at <= m.at && fs.existsSync(pkgFile())) return false;
    if (o.reg) ctx.writeReg(o.reg); if (o.pl) ctx.writePlan(o.pl);
    pkg = { at: o.at || Date.now(), ad: o.ad || null, ph: o.ph || {} }; writeAtomic(pkgFile(), JSON.stringify(pkg));
    ctx.notify('reg'); ctx.notify('pl'); return true;
  }
  function refresh() {
    if (busy) return busy;
    const c = cur(); if (!c) return Promise.resolve({ error: 'لم يُدخل رمز الربط بعد' });
    busy = pull(c).then(o => { const changed = apply(o); const s = load(); s.checked = Date.now(); s.err = ''; save(s); return { ok: true, changed, at: meta().at }; })
      .catch(e => { const m = String(e && e.message || e); const s = load(); s.checked = Date.now(); s.err = m; save(s); return { error: m }; })
      .finally(() => { busy = null; });
    return busy;
  }
  async function link(code) {
    const c = parseCode(code); if (!c) return { error: 'رمز الربط غير صحيح — يبدأ بـ AV1. وينسخ كما هو من حاسبة القسم' };
    let o; try { o = await pull(c); } catch (e) { return { error: String(e && e.message || e) }; }
    pkg = {}; try { fs.unlinkSync(pkgFile()); } catch (_) {}
    save({ c: enc(c.code), linked: Date.now(), checked: Date.now(), err: '' }); apply(o);
    return { ok: true, at: meta().at };
  }
  function status() { const s = load(); return { linked: !!cur(), at: meta().at || 0, checked: s.checked || 0, err: s.err || '', busy: !!busy }; }
  function adIndex() { return meta().ad || null; }
  async function photo(fn, name) {
    const ph = meta().ph || {}; fn = String(fn || ''); name = String(name || '');
    const k = Object.keys(ph).find(x => ph[x].fn === fn && x.endsWith('/' + name)); if (!k) return null;
    const e = ph[k]; if (!/^[0-9a-f]{40}$/.test(e.h)) return null;
    const f = path.join(ctx.dir(), 'صور', e.h + '.jpg');
    try { return 'data:image/jpeg;base64,' + fs.readFileSync(f).toString('base64'); } catch (_) {}
    const c = cur(); if (!c) return null;
    try { const b = unseal(c.key, await download(e.id)); if (!(b[0] === 0xff && b[1] === 0xd8) || sha1(b) !== e.h) return null; writeAtomic(f, b); return 'data:image/jpeg;base64,' + b.toString('base64'); }
    catch (err) { ctx.log && ctx.log('photo: ' + (err && err.message || err)); return null; }
  }
  function start() { if (timer) return; setTimeout(() => refresh(), 1500); timer = setInterval(() => refresh(), FETCH_MS); }
  return { status, link, refresh, adIndex, photo, start };
}
module.exports = { createPublisher, createReader, parseCode, seal, unseal, mkCode, FOLDER };
