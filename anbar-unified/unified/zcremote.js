'use strict';
/* نسخة اللجنة المركزية للمصادقة — التبادل عبر Google Drive ببريد القسم نفسه (حاسبة اللجنة قد تكون على شبكة/راوتر آخر).
   - حاسبة القسم (البرنامج الكامل، تبويب اللجنة المركزية ← «ربط نسخة اللجنة المركزية») تُنشئ ملفين خاصين في Drive القسم
     (بلا مشاركة ولا رابط عام — لا يقرؤهما إلا البرنامج المسجَّل ببريد القسم):
       • ملف الإحالات (القسم ← اللجنة): كل طلب تجاوز 25% (وتحديثه أو سحبه) كما يرسله برنامج المدد.
       • ملف القرارات (اللجنة ← القسم): قرار مقرر اللجنة المركزية لكل إحالة.
   - المحتوى مشفّر AES-128-GCM بمفتاح عشوائي لا يخرج إلا في «رمز الربط» (ZC1.<الإحالات>.<القرارات>.<المفتاح>).
   - نسخة اللجنة (anbarZc) تقرأ الإحالات وتكتب القرارات فقط؛ حاسبة القسم تقرأ القرارات وتكتبها في ملف المشروع في برنامج المدد
     فيصدر الأمر الإداري من هناك. كل جهة تكتب ملفها فقط. */
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { seal, unseal } = require('./viewer');
const FOLDER = 'اللجنة المركزية للمصادقة — قسم الشؤون الهندسية';
const PUSH_MS = +process.env.UNI_ZC_PUSH_MS || 4000, POLL_MS = +process.env.UNI_ZC_POLL_MS || 3 * 60 * 1000;
const b64u = b => b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const ub64 = s => Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64');
/* ZC2: يحمل أيضاً معرّف تطبيق Google وسرّه (مشفّرين بالمفتاح نفسه) فلا يُكتبان يدوياً في حاسبة اللجنة */
const mkCode = (inId, outId, key, creds) => (creds ? 'ZC2.' : 'ZC1.') + inId + '.' + outId + '.' + b64u(key) + (creds ? '.' + b64u(seal(key, Buffer.from(JSON.stringify(creds)))) : '');
function parseCode(s) { const m = /^ZC([12])\.([A-Za-z0-9_-]{10,})\.([A-Za-z0-9_-]{10,})\.([A-Za-z0-9_-]{22})(?:\.([A-Za-z0-9_-]{20,}))?$/.exec(String(s || '').replace(/\s+/g, '')); if (!m || (m[1] === '2') !== !!m[5]) return null; const key = ub64(m[4]); if (key.length !== 16) return null;
  let creds = null; if (m[5]) { try { creds = JSON.parse(unseal(key, ub64(m[5])).toString('utf8')); } catch (_) { return null; } }
  return { inId: m[2], outId: m[3], key, creds, code: m[0] }; }
const sha1 = s => crypto.createHash('sha1').update(s).digest('hex');
function readJson(f) { try { return JSON.parse(fs.readFileSync(f, 'utf8')) || {}; } catch (_) { return {}; } }
function writeAtomic(f, data) { fs.mkdirSync(path.dirname(f), { recursive: true }); const t = f + '.tmp'; fs.writeFileSync(t, data); fs.renameSync(t, f); }
const encFor = ss => s => { try { if (ss && ss.isEncryptionAvailable()) return 'e:' + ss.encryptString(String(s)).toString('base64'); } catch (_) {} return 'p:' + Buffer.from(String(s)).toString('base64'); };
const decFor = ss => s => { s = String(s || ''); try { if (s.startsWith('e:')) return ss.decryptString(Buffer.from(s.slice(2), 'base64')); if (s.startsWith('p:')) return Buffer.from(s.slice(2), 'base64').toString(); } catch (_) {} return ''; };
const errMsg = e => String(e && e.message || e);
function readBox(key, buf, app) { if (!buf || !buf.length) return null; const o = JSON.parse(unseal(key, buf).toString('utf8')); if (!o || o.app !== app) throw new Error('ملف التبادل لا يخص نسخة اللجنة المركزية'); return o; }

/* ---------------- حاسبة القسم ---------------- */
function createDept(ctx) {
  // ctx: file() ملف الحالة، gd()، apply(p) → يكتب القرار في برنامج المدد، referAll() → يطلب من برنامج المدد إعادة إرسال كل الإحالات، safeStorage، log
  const enc = encFor(ctx.safeStorage), dec = decFor(ctx.safeStorage);
  const load = () => readJson(ctx.file()), save = s => writeAtomic(ctx.file(), JSON.stringify(s));
  const keyOf = st => { const k = ub64(dec(st.k)); return k.length === 16 ? k : null; };
  let pushT = null, timer = null, pushing = null, pulling = null;
  function status(withCode) {
    const st = load(), g = (() => { try { return ctx.gd().status(); } catch (_) { return {}; } })();
    const o = { on: !!st.inId, connected: !!g.connected, email: g.email || '', pushed: st.pushed || 0, pulled: st.pulled || 0, err: st.err || '', n: Object.values(st.out || {}).filter(x => x.need).length, applied: Object.keys(st.applied || {}).length };
    if (withCode && st.inId) { const k = keyOf(st); let cr = null; try { cr = ctx.gd().appCreds(); } catch (_) {} if (k) o.code = mkCode(st.inId, st.outId, k, cr); }
    return o;
  }
  async function link() {
    const gd = ctx.gd(); if (!gd.status().connected) return { error: 'البرنامج غير مربوط ببريد القسم في Google Drive — اربطه أولاً من «إعدادات Google Drive»' };
    let st = load(); if (st.inId && keyOf(st)) { schedule(0); return { ok: true, code: status(true).code }; }
    try {
      const key = crypto.randomBytes(16);
      const a = await gd.reserveBin('اللجنة-المركزية-الإحالات.bin', FOLDER, true), b = await gd.reserveBin('اللجنة-المركزية-القرارات.bin', FOLDER, true);
      await gd.uploadBin(b.id, seal(key, Buffer.from(JSON.stringify({ app: 'anbar-zc-out', at: 0, items: {} }))));
      st = { inId: a.id, outId: b.id, k: enc(b64u(key)), out: {}, applied: {}, created: Date.now() }; save(st);
    } catch (e) { return { error: errMsg(e) }; }
    try { await ctx.referAll(); } catch (_) {}
    await push(true);
    return { ok: true, code: status(true).code };
  }
  /* الإحالات من برنامج المدد (نفس ما يصل الى التبويب المحلي) */
  function queue(list) {
    const st = load(); if (!st.inId) return false; const out = st.out || {}; let ch = 0;
    (Array.isArray(list) ? list : []).forEach(x => { if (!x || !x.key) return; if (!x.need && !out[x.key]) return; const old = out[x.key]; const n = Object.assign({}, x, { at: Date.now() });
      if (old && JSON.stringify(Object.assign({}, old, { at: 0 })) === JSON.stringify(Object.assign({}, n, { at: 0 }))) return; out[x.key] = n; ch++; });
    if (ch) { st.out = out; st.dirty = 1; save(st); schedule(PUSH_MS); }
    return true;
  }
  function schedule(ms) { clearTimeout(pushT); pushT = setTimeout(() => push(false), ms); }
  function push(force) {
    if (pushing) return pushing;
    pushing = (async () => { const st = load(); if (!st.inId) return { error: 'غير مربوط' }; if (!st.dirty && !force) return { ok: true, same: true };
      const key = keyOf(st); const body = JSON.stringify({ app: 'anbar-zc-in', at: Date.now(), items: st.out || {} });
      try { await ctx.gd().uploadBin(st.inId, seal(key, Buffer.from(body))); const s2 = load(); s2.pushed = Date.now(); s2.err = ''; if (sha1(JSON.stringify(s2.out || {})) === sha1(JSON.stringify(st.out || {}))) delete s2.dirty; save(s2); return { ok: true }; }
      catch (e) { const s2 = load(); s2.err = errMsg(e); save(s2); ctx.log && ctx.log('zc push: ' + s2.err); return { error: s2.err }; } })().finally(() => { pushing = null; });
    return pushing;
  }
  /* قرارات اللجنة: كل قرار جديد (أو مُعاد إصداره) يُكتب في برنامج المدد مرة واحدة */
  function pull() {
    if (pulling) return pulling;
    pulling = (async () => { const st = load(); if (!st.outId) return { error: 'غير مربوط' }; const key = keyOf(st);
      let o; try { o = readBox(key, await ctx.gd().getBin(st.outId), 'anbar-zc-out'); } catch (e) { const s2 = load(); s2.err = errMsg(e); save(s2); return { error: s2.err }; }
      let n = 0; const items = (o && o.items) || {};
      for (const k of Object.keys(items)) { const d = items[k]; if (!d || !d.at) continue; const s2 = load(); if ((s2.applied || {})[k] >= d.at) continue;
        const r = await ctx.apply({ rid: d.rid, extId: d.extId, name: d.name, z: d.z, zset: d.zset });
        if (r && r.ok) { const s3 = load(); s3.applied = Object.assign({}, s3.applied, { [k]: d.at }); save(s3); n++; } }
      const s4 = load(); s4.pulled = Date.now(); s4.err = ''; save(s4); return { ok: true, n }; })().finally(() => { pulling = null; });
    return pulling;
  }
  async function stop() { const st = load(); let bad = 0; for (const id of [st.inId, st.outId].filter(Boolean)) { try { await ctx.gd().trash(id); } catch (_) { bad++; } } try { fs.unlinkSync(ctx.file()); } catch (_) {} return { ok: true, failed: bad }; }
  function start() { if (timer) return; const tick = () => { if (!load().inId) return; push(false); pull(); }; setTimeout(tick, +process.env.UNI_ZC_FIRST_MS || 60000); timer = setInterval(tick, POLL_MS); }
  return { status, link, queue, push, pull, stop, start };
}

/* ---------------- نسخة اللجنة المركزية ---------------- */
function createClient(ctx) {
  // ctx: dir()، gd()، deliver(list) → تبويب اللجنة (__zcIn)، safeStorage، log
  const enc = encFor(ctx.safeStorage), dec = decFor(ctx.safeStorage);
  const stFile = () => path.join(ctx.dir(), 'zc-link.json');
  const load = () => readJson(stFile()), save = s => writeAtomic(stFile(), JSON.stringify(s));
  const cur = () => parseCode(dec(load().c));
  let timer = null, pulling = null, pushT = null;
  async function fetchIn(c) { return readBox(c.key, await ctx.gd().getBin(c.inId), 'anbar-zc-in') || { items: {} }; }
  async function link(code) {
    if (!code) { code = dec(load().pend); if (!code) return { error: 'الصق رمز الربط أولاً' }; }
    const c = parseCode(code); if (!c) return { error: 'رمز الربط غير صحيح — يبدأ بـ ZC2. (أو ZC1.) ويُنسخ كاملاً كما هو من حاسبة القسم' };
    const gd = ctx.gd();
    if (c.creds && c.creds.cid) { const cur = gd.appCreds ? gd.appCreds() : null; if (!cur || cur.cid !== c.creds.cid || cur.cs !== c.creds.cs) { const r = gd.setApp(c.creds.cid, c.creds.cs); if (r && r.error) return r; } }
    if (!gd.status().connected) { const s0 = load(); s0.pend = enc(c.code); save(s0); return { needLogin: true, error: gd.status().configured ? '' : 'هذا الرمز لا يحمل معرّف التطبيق — أنشئ رمزاً جديداً من حاسبة القسم (ZC2)' }; }
    let o; try { o = await fetchIn(c); } catch (e) { return { error: errMsg(e) }; }
    save({ c: enc(c.code), linked: Date.now(), dec: (load().dec || {}), inAt: 0 });
    const r = await deliver(o); return { ok: true, n: r };
  }
  async function deliver(o) { const items = Object.values((o && o.items) || {}); const s = load(); s.inAt = o && o.at || 0; s.pulled = Date.now(); s.err = ''; save(s); if (items.length) await ctx.deliver(items); return items.length; }
  function pull() {
    if (pulling) return pulling; const c = cur(); if (!c) return Promise.resolve({ error: 'لم يُدخل رمز الربط بعد' });
    pulling = (async () => { try { const o = await fetchIn(c); const s = load(); if (o.at && o.at === s.inAt) { s.pulled = Date.now(); s.err = ''; save(s); } else await deliver(o); if (load().dirty) await push(); return { ok: true }; }
      catch (e) { const s = load(); s.err = errMsg(e); s.pulled = Date.now(); save(s); return { error: s.err }; } })().finally(() => { pulling = null; });
    return pulling;
  }
  async function push() { const c = cur(); if (!c) return { error: 'غير مربوط' }; const s = load();
    try { await ctx.gd().uploadBin(c.outId, seal(c.key, Buffer.from(JSON.stringify({ app: 'anbar-zc-out', at: Date.now(), items: s.dec || {} })))); const s2 = load(); delete s2.dirty; s2.pushed = Date.now(); s2.err = ''; save(s2); return { ok: true }; }
    catch (e) { const s2 = load(); s2.err = errMsg(e); save(s2); clearTimeout(pushT); pushT = setTimeout(push, 60000); return { error: s2.err }; } }
  /* قرار المقرر: يُحفظ هنا أولاً ثم يُرفع (إن انقطع الإنترنت يُعاد رفعه تلقائياً) */
  async function decide(p) { const c = cur(); if (!c) return { error: 'نسخة اللجنة غير مربوطة بحاسبة القسم — أدخل رمز الربط' };
    if (!p || !p.key) return { error: 'بيانات القرار ناقصة' };
    const s = load(); s.dec = Object.assign({}, s.dec, { [p.key]: { rid: p.rid, extId: p.extId, name: p.name || '', z: p.z || {}, zset: p.zset || null, at: Date.now() } }); s.dirty = 1; save(s);
    const r = await push(); return r.ok ? { ok: true } : { ok: true, queued: true, warn: 'حُفظ القرار، وتعذّر رفعه الآن (' + r.error + ') — سيُرفع تلقائياً عند عودة الاتصال' }; }
  function status() { const s = load(); return { pendLogin: !cur() && !!dec(s.pend), linked: !!cur(), connected: (() => { try { return !!ctx.gd().status().connected; } catch (_) { return false; } })(), pulled: s.pulled || 0, pushed: s.pushed || 0, err: s.err || '', pending: !!s.dirty, decided: Object.keys(s.dec || {}).length }; }
  function unlink() { try { fs.unlinkSync(stFile()); } catch (_) {} return { ok: true }; }
  function start() { if (timer) return; setTimeout(() => pull(), +process.env.UNI_ZC_FIRST_MS || 3000); timer = setInterval(() => pull(), POLL_MS); }
  return { status, link, pull, decide, unlink, start };
}
module.exports = { createDept, createClient, parseCode, mkCode, FOLDER };
