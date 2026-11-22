/* الربط مع «نظام الشؤون المالية» (AnbarFinance — نسخة ويندوز): قراءة فقط.
   - ملف بياناته anbar-data.json: المستندات\AnbarFinance، أو المكان الذي اختير في برنامج المالية (ملف ← تغيير مكان ملف البيانات،
     ويُحفظ في %APPDATA%\AnbarFinance\config.json)، أو ملف يختاره المستخدم من البرنامج الموحد.
   - مشاريع المالية الأساسية (من ملفات Excel للموقف المالي والخطط) مضمَّنة في برنامج المالية نفسه، فنُسخت هنا في finance-base.json؛
     والمشاريع المضافة في المالية تُقرأ من ملف البيانات.
   - يُعاد حساب ما يلزم كما يحسبه برنامج المالية: المصروف (دفعات السلف + الصرف المباشر)، وأوامر الغيار، وتعديل الحالة والبيانات،
     والسلف بمراحلها ودفعاتها (المبلغ والتاريخ ورقم الصك)، وخطابات الضمان، والقروض القائمة.
   - لا يُكتب في ملف المالية أبداً. القراءة تُخزَّن وتُعاد فقط إذا تغيّر الملف. */
const fs = require('fs'), path = require('path');
const STAGE = { raised: 'مرفوعة', audited: 'مدققة', ready: 'جاهزة للصرف', partial: 'مصروفة جزئياً', paid: 'مصروفة', rejected: 'مرفوضة' };
const N = v => { const n = +v; return isFinite(n) ? n : 0; };
const vals = o => o && typeof o === 'object' ? Object.entries(o).map(([id, d]) => Object.assign({ _id: id }, d || {})) : [];

module.exports = function createFinLink({ app, prefs }) {
  let cache = null, base = null;
  const BASE = () => base || (base = (() => { try { return require('./finance-base.json').P || []; } catch (_) { return []; } })());
  function candidates() {
    const c = [];
    if (process.env.UNI_FIN_FILE) c.push(process.env.UNI_FIN_FILE);
    try { const p = prefs().financeFile; if (p) c.push(p); } catch (_) {}
    for (const nm of ['AnbarFinance', 'anbar-finance', 'AnbarFinance-1.1.0']) { try { const cfg = JSON.parse(fs.readFileSync(path.join(app.getPath('appData'), nm, 'config.json'), 'utf8')); if (cfg && cfg.dataFile) c.push(cfg.dataFile); } catch (_) {} }
    const home = (() => { try { return app.getPath('home'); } catch (_) { return ''; } })();
    for (const d of [(() => { try { return app.getPath('documents'); } catch (_) { return ''; } })(), home && path.join(home, 'Documents'), home && path.join(home, 'OneDrive', 'Documents'), home && path.join(home, 'OneDrive', 'المستندات'), home && path.join(home, 'المستندات')].filter(Boolean)) c.push(path.join(d, 'AnbarFinance', 'anbar-data.json'));
    return [...new Set(c)];
  }
  const locate = () => { for (const f of candidates()) { try { if (fs.statSync(f).isFile()) return f; } catch (_) {} } return null; };
  /* بحث تلقائي عن ملف بيانات المالية (anbar-data.json) في مجلدات المستخدم والأقراص والمجلدات المشتركة المربوطة، بلا إيقاف البرنامج:
     قراءة غير متزامنة، بعمق محدود، مع تجاوز مجلدات النظام والبرامج. أول ملف صالح (فيه {v, c}) يُحفظ ويُستعمل. */
  const SKIP = /^(\$recycle\.bin|system volume information|windows|program files( \(x86\))?|programdata|appdata\\local\\temp|node_modules|\.git|temp|tmp|cache|caches|microsoft|google|mozilla|perflogs|recovery|msocache|intel|amd|nvidia)$/i;
  /* ملف بيانات المالية: anbar-data.json، أو نسخة احتياطية منه: «نسخة احتياطية الآن» (anbar-backup-<تاريخ>.json) والنسخ اليومية التلقائية (backups/anbar-data-<تاريخ>.json) — البنية نفسها {v, c} */
  const NAME_RX = /^anbar-(data|backup)([-_ .][^\\/]*)?\.json$/i;
  const isBackup = f => (/anbar-backup/i.test(path.basename(f)) || /[\\/]backups[\\/]/i.test(f) || /^anbar-data[-_ .].+\.json$/i.test(path.basename(f))) ? 1 : 0;
  async function search(onDir) {
    const fsp = fs.promises, roots = [], seen = new Set(); let dirs = 0; const found = [];
    const home = (() => { try { return app.getPath('home'); } catch (_) { return ''; } })();
    if (process.env.UNI_FIN_SEARCH_ROOT) roots.push([process.env.UNI_FIN_SEARCH_ROOT, 5]); else {
    if (home) roots.push([home, 5]);
    try { roots.push([path.join(app.getPath('appData')), 2]); } catch (_) {}
    if (process.platform === 'win32') for (const L of 'CDEFGHIJKLMNOPQRSTUVWXYZ') roots.push([L + ':\\', L === 'C' ? 3 : 4]);
    else roots.push(['/mnt', 4], ['/media', 4]); }
    const ok = async f => { try { const st = await fsp.stat(f); if (!st.isFile() || st.size > 400 * 1024 * 1024) return false; const fd = await fsp.open(f, 'r'); const b = Buffer.alloc(64); await fd.read(b, 0, 64, 0); await fd.close(); return /^\s*\{\s*"v"\s*:\s*\d+\s*,\s*"c"\s*:/.test(b.toString('utf8')); } catch (_) { return false; } };
    async function walk(d, depth) {
      if (depth < 0 || seen.has(d.toLowerCase()) || dirs > 60000) return; seen.add(d.toLowerCase()); dirs++; if (onDir && dirs % 200 === 0) onDir(dirs, d);
      let ents; try { ents = await fsp.readdir(d, { withFileTypes: true }); } catch (_) { return; }
      for (const e of ents) { if (e.isFile() && NAME_RX.test(e.name)) { const f = path.join(d, e.name); if (await ok(f)) found.push(f); } }
      for (const e of ents) { if (!e.isDirectory() || e.name.startsWith('.') || SKIP.test(e.name)) continue; await walk(path.join(d, e.name), depth - 1); }
    }
    for (const [r, dp] of roots) { try { await fsp.access(r); } catch (_) { continue; } await walk(r, dp); }
    /* ملف البيانات الحي أولاً (الأحدث تعديلاً)، ثم النسخ الاحتياطية (الأحدث أولاً) */
    const st = await Promise.all(found.map(async f => [f, (await fsp.stat(f)).mtimeMs])); st.sort((a, b) => (isBackup(a[0]) - isBackup(b[0])) || b[1] - a[1]);
    return { found: st.map(x => x[0]), dirs };
  }
  const payList = a => Array.isArray(a.pays) && a.pays.length ? a.pays : (a.stage === 'paid' ? [{ amt: N(a.gross), date: a.paidDate || String(a.paidAt || a.at || '').slice(0, 10), ref: a.payRef }] : []);
  function build(d) {
    const C = (d && d.c) || {};
    const np = vals(C.projects).filter(p => p && p.nm).map(p => ({ id: p._id, src: p.src || 'الموقف المالي العام', st: p.st || 'غير محددة', pl: p.pl || '', nm: p.nm, co: p.co || '', c0: N(p.c0), c: N(p.c) || N(p.c0), sp: 0, adv: 0, cno: p.cno || '', cdt: p.cdt || '', isNew: true }));
    const P = BASE().map(p => Object.assign({ st: '', pl: '', co: '', c0: 0, c: 0, sp: 0, adv: 0, cno: '', cdt: '' }, p)).concat(np);
    const M = new Map(P.map(p => [p.id, p]));
    const by = (list) => { const g = {}; list.forEach(x => { if (x && x.pid != null) (g[x.pid] = g[x.pid] || []).push(x); }); return g; };
    const TX = by(vals(C.txns)), AD = by(vals(C.advances)), GU = by(vals(C.guarantees)), LO = by(vals(C.loans));
    const out = [];
    for (const p of P) {
      const tx = (TX[p.id] || []).slice().sort((a, b) => String(a.at || '').localeCompare(String(b.at || '')));
      const e = Object.assign({}, p);
      for (const t of tx) {
        if (t.type === 'pay') e.sp += N(t.amt);
        else if (t.type === 'change') e.c += N(t.amt);
        else if (t.type === 'status' && t.newSt) e.st = t.newSt;
        else if (t.type === 'edit' && t.changes) for (const [f, ch] of Object.entries(t.changes)) { if (!ch) continue; if (['c0', 'c', 'sp', 'adv'].includes(f)) e[f] = N(ch.to); else if (['nm', 'co', 'cno', 'cdt', 'st', 'pl'].includes(f)) e[f] = ch.to || ''; }
      }
      const advs = (AD[p.id] || []).map(a => { const pays = payList(a).map(q => ({ amt: N(q.amt), date: q.date || String(q.at || '').slice(0, 10), ref: q.ref || '', loan: !!q.loanId })); const paid = pays.reduce((s, q) => s + q.amt, 0);
        return { no: a.final ? 'النهائية' : (a.no || ''), final: !!a.final, legacy: !!a.legacy, gross: N(a.gross), ded: N(a.ret) + N(a.tax) + N(a.fine) + N(a.oth), stage: a.stage || '', stageT: STAGE[a.stage] || a.stage || '', date: a.date || String(a.at || '').slice(0, 10), ref: a.ref || '', paid, pays,
          since: (() => { const h = (a.hist || []).filter(x => x && x.s === a.stage).map(x => x.at).filter(Boolean).sort(); return String(h[0] || a.at || '').slice(0, 10); })() }; })
        .sort((a, b) => (a.final ? 1e9 : N(a.no)) - (b.final ? 1e9 : N(b.no)) || String(a.date).localeCompare(String(b.date)));
      advs.filter(a => a.stage !== 'rejected').forEach(a => { e.sp += a.paid; });
      const legG = advs.filter(a => a.legacy && a.stage !== 'rejected').reduce((s, a) => s + a.gross, 0);
      const gs = (GU[p.id] || []).map(g => ({ kind: g.kind || '', no: g.no || '', bank: g.bank || '', amt: N(g.amt), exp: g.exp || '', st: g.st || '' })).sort((a, b) => String(a.exp).localeCompare(String(b.exp)));
      const loanOut = (LO[p.id] || []).filter(l => l.st === 'active').reduce((s, l) => s + Math.max(0, N(l.amt) - N(l.repaid)), 0);
      out.push({ id: e.id, src: e.src, st: e.st, pl: e.pl, nm: e.nm, co: e.co, cno: e.cno == null ? '' : String(e.cno), cdt: e.cdt || '', c0: e.c0, c: e.c, sp: e.sp,
        legacyLeft: Math.max(0, N(e.adv) - legG), advs, gs, loanOut, isNew: !!e.isNew });
    }
    return { P: out, counts: { projects: out.length, advances: Object.values(AD).reduce((s, l) => s + l.length, 0), guarantees: Object.values(GU).reduce((s, l) => s + l.length, 0) } };
  }
  /* ملف Excel «الموقف الشامل» الذي يُصدره برنامج الشؤون المالية (الورقة الأولى: اسم المشروع، الشركة، مبلغ العقد وبعد التغيير، الكلفة المصادقة،
     نسبة الإنجاز المالي، مجموع المصروف الكلي، رقم السلفة، مبلغ السلفة غير المصروفة، المستلم من المصرف، نسبة الإنجاز الفعلي، المصدر).
     يُقرأ بالأعمدة بعناوينها، ولا تفاصيل فيه للسلف ودفعاتها وخطابات الضمان (تلك في ملف البيانات anbar-data.json فقط). */
  const XL_RX = /\.xls[xm]$/i;
  const HN = s => String(s == null ? '' : s).replace(/[إأآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/[ًٌٍَُِّْـ]/g, '').replace(/\s+/g, ' ').trim();
  const XCOL = [['nm', /^اسم المشروع|^المشروع$/], ['co', /^اسم الشركه|^الشركه|المقاول/], ['st', /^حاله المشروع|^الحاله$/], ['pl', /^اسم الخطه|^الخطه$/],
    ['c', /بعد التغيير/], ['c0', /^الكلفه الكليه|^مبلغ العقد/], ['appr', /الكلفه المصادقه/], ['finPct', /نسبه الانجا[رز] المالي/], ['sp', /^مجموع المصروف الكلي$|^المصروف الكلي$|^المصروف التراكمي/],
    ['advNo', /^رقم السلفه/], ['pend', /مبلغ السلفه|غير مصروفه/], ['bank', /^المبلغ المستلم من المصرف$/], ['actPct', /نسبه الانجاز الفعلي/], ['cno', /^رقم العقد/], ['fileNo', /اضبار/], ['src', /^المصدر$/]];
  function readXl(f, st) {
    let rows; try { rows = require('./old-access-common').readRows(fs.readFileSync(f)); } catch (e) { return { ok: false, file: f, error: 'تعذّر قراءة ملف Excel: ' + (e.message || e) }; }
    const heads = rows.length ? Object.keys(Object.assign({}, ...rows.slice(0, 50))) : [], col = {};
    for (const h of heads) { const t = HN(h); for (const [k, re] of XCOL) if (col[k] == null && re.test(t)) { col[k] = h; break; } }
    if (col.nm == null || (col.sp == null && col.c == null && col.c0 == null)) return { ok: false, file: f, error: 'ملف Excel هذا ليس «الموقف الشامل» من برنامج المالية: يلزم عمود «اسم المشروع» وعمود «مجموع المصروف الكلي» أو «مبلغ العقد».' };
    const g = (r, k) => (col[k] == null ? '' : String(r[col[k]] == null ? '' : r[col[k]]).trim()), pct = v => { if (v === '') return null; let n = N(String(v).replace(/[%,]/g, '')); if (n > 0 && n <= 1.5) n *= 100; return Math.round(n * 10) / 10; };
    const P = []; rows.forEach((r, i) => { const nm = g(r, 'nm').replace(/\s+/g, ' '); if (!nm || /^(ال)?مجموع|^الاجمالي/.test(HN(nm))) return;
      const c0 = N(g(r, 'c0')), c = N(g(r, 'c')) || c0;
      P.push({ id: 'xl' + (i + 2), src: g(r, 'src') || 'الموقف الشامل (Excel)', st: g(r, 'st'), pl: g(r, 'pl'), nm, co: g(r, 'co'), cno: g(r, 'cno'), cdt: '', fileNo: g(r, 'fileNo'), c0, c, sp: N(g(r, 'sp')),
        legacyLeft: N(g(r, 'pend')), advs: [], gs: [], loanOut: 0, isNew: false, xl: true, appr: N(g(r, 'appr')), finPct: pct(g(r, 'finPct')), actPct: pct(g(r, 'actPct')), bank: N(g(r, 'bank')), advNo: g(r, 'advNo') }); });
    if (!P.length) return { ok: false, file: f, error: 'لم يُعثر في ملف Excel على صفوف مشاريع.' };
    return { P, counts: { projects: P.length, advances: 0, guarantees: 0 }, ok: true, file: f, mtime: st.mtimeMs, at: new Date(st.mtimeMs).toISOString(), backup: false, xl: true };
  }
  function read() {
    const f = locate();
    if (!f) return { ok: false, tried: candidates(), error: 'لم يُعثر على ملف بيانات برنامج الشؤون المالية (anbar-data.json).' };
    let st; try { st = fs.statSync(f); } catch (e) { return { ok: false, file: f, error: String(e.message || e) }; }
    if (cache && cache.f === f && cache.m === st.mtimeMs && cache.s === st.size) return cache.v;
    if (XL_RX.test(f)) { const v = readXl(f, st); if (v.ok) cache = { f, m: st.mtimeMs, s: st.size, v }; return v; }
    let d; try { d = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return { ok: false, file: f, error: 'تعذّر قراءة ملف المالية: ' + (e.message || e) }; }
    if (d && typeof d.c !== 'object' && d.data && typeof d.data.c === 'object') d = d.data;   /* نسخة مغلّفة */
    if (!d || typeof d.c !== 'object') return { ok: false, file: f, error: 'الملف ليس ملف بيانات برنامج الشؤون المالية.' };
    const v = Object.assign(build(d), { ok: true, file: f, mtime: st.mtimeMs, at: new Date(st.mtimeMs).toISOString(), backup: !!isBackup(f) });
    cache = { f, m: st.mtimeMs, s: st.size, v }; return v;
  }
  return { read, candidates, locate, search, isBackup, _build: build, _readXl: readXl };
};
