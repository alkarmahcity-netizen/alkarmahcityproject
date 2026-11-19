'use strict';
// التحديث من حاسبة القسم عبر الشبكة الداخلية:
//  • حاسبة القسم (الخادم) تعرض ملف البرنامج الذي تعمل به هي (ملف portable واحد) لحاسبات اللجان: معلوماته (الإصدار، الحجم، البصمة SHA-256) والملف نفسه.
//  • حاسبة اللجنة: إن كان إصدار حاسبة القسم أحدث يظهر «يتوفر تحديث»، فتُنزّل الملف بجانب البرنامج، وتتحقق من الحجم والبصمة،
//    ثم يُغلق البرنامج ويستبدل ملفه بالاسم نفسه (يبقى اختصار سطح المكتب يعمل)، ويُحفظ القديم بجانبه «نسخة سابقة» للرجوع، ويعاد التشغيل.
//  • البيانات (مجلد «بيانات-النظام-الموحد») لا تُلمس.
//  • 1.64.0: الملف المنزّل يُسمّى باسم الإصدار الجديد (لا يبقى «.part»)، ويُحفظ «تحديث معلّق»؛ سكربت الاستبدال يُشغَّل خارج عملية البرنامج
//    (فلا يُغلق معه)، وينتظر مُشغّل البرنامج أيضاً، وإن بقي الملف القديم مقفلاً يُشغَّل الإصدار الجديد من ملفه وتُوجَّه اختصارات سطح المكتب إليه.
//    عند كل تشغيل: تُحذف بقايا «.part» القديمة، وإن وُجد تحديث منزّل لم يُثبَّت يظهر «إعادة التشغيل الآن» دون تنزيل جديد.
const fs = require('fs'), fsp = fs.promises, path = require('path'), crypto = require('crypto'), http = require('http');

const cmpVer = (a, b) => { const x = String(a || '').split('.').map(n => +n || 0), y = String(b || '').split('.').map(n => +n || 0); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0) ? 1 : -1; } return 0; };

module.exports = function createUpdater(ctx) {
  // ctx: version, exePath() (ملف البرنامج الحالي أو null), platform, quit(), log(msg)
  let shaCache = null;
  /* ---------- جهة حاسبة القسم ---------- */
  async function offer() {
    const f = ctx.exePath(); if (!f || !fs.existsSync(f)) return null;
    const st = await fsp.stat(f);
    if (!shaCache || shaCache.f !== f || shaCache.size !== st.size || shaCache.mtime !== st.mtimeMs) {
      const h = crypto.createHash('sha256'); await new Promise((res, rej) => fs.createReadStream(f).on('data', d => h.update(d)).on('end', res).on('error', rej));
      shaCache = { f, size: st.size, mtime: st.mtimeMs, sha: h.digest('hex') };
    }
    return { ver: String(ctx.version || ''), size: shaCache.size, sha256: shaCache.sha, name: path.basename(f) };
  }
  // يُستدعى من خادم المزامنة بعد التحقق من رمز القسم
  async function serve(kind, res) {
    const o = await offer().catch(() => null);
    if (!o) { res.writeHead(404, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ error: 'none' })); }
    if (kind === 'info') { const b = Buffer.from(JSON.stringify(o)); res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': b.length }); return res.end(b); }
    res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Length': o.size });
    fs.createReadStream(ctx.exePath()).pipe(res);
  }
  /* ---------- جهة حاسبة اللجنة ---------- */
  const state = { avail: null, phase: '', got: 0, size: 0, error: '', ready: null };
  function getJSON(base, key, p, ms = 15000) {
    return new Promise((resolve, reject) => {
      const u = new URL(base + p);
      const rq = http.request({ hostname: u.hostname, port: u.port, path: u.pathname, method: 'GET', headers: { 'x-sync-key': key }, timeout: ms }, r => {
        const ch = []; r.on('data', c => ch.push(c)); r.on('end', () => { if (r.statusCode !== 200) return reject(new Error('code ' + r.statusCode)); try { resolve(JSON.parse(Buffer.concat(ch).toString('utf8'))); } catch (e) { reject(e); } });
      });
      rq.on('timeout', () => rq.destroy(new Error('انتهت المهلة'))); rq.on('error', reject); rq.end();
    });
  }
  // يُستدعى بعد كل مزامنة ناجحة: هل لدى حاسبة القسم إصدار أحدث؟
  async function check(base, key, serverVer) {
    if (!base || !serverVer || cmpVer(serverVer, ctx.version) <= 0) { if (state.avail && !state.phase) state.avail = null; return state.avail; }
    if (state.avail && state.avail.ver === serverVer) return state.avail;
    try { const o = await getJSON(base, key, '/sync/update/info'); if (o && o.ver && cmpVer(o.ver, ctx.version) > 0 && o.size > 1000 && /^[0-9a-f]{64}$/.test(o.sha256)) state.avail = { ...o, base, key }; }
    catch (_) { /* حاسبة القسم بإصدار لا يعرض التحديث، أو ليست ملفاً واحداً (تشغيل تجريبي) */ }
    return state.avail;
  }
  function download(o, dest, onProg) {
    return new Promise((resolve, reject) => {
      const u = new URL(o.base + '/sync/update/file'), h = crypto.createHash('sha256'); let got = 0;
      const out = fs.createWriteStream(dest);
      const rq = http.request({ hostname: u.hostname, port: u.port, path: u.pathname, method: 'GET', headers: { 'x-sync-key': o.key }, timeout: 60000 }, r => {
        if (r.statusCode !== 200) { r.resume(); out.destroy(); return reject(new Error('حاسبة القسم لم ترسل الملف (' + r.statusCode + ')')); }
        r.on('data', c => { got += c.length; h.update(c); onProg(got); });
        r.pipe(out);
        out.on('finish', () => resolve({ got, sha: h.digest('hex') }));
        r.on('error', reject); out.on('error', reject);
      });
      rq.on('timeout', () => rq.destroy(new Error('انقطع التنزيل — ستُعاد المحاولة')));
      rq.on('error', e => { out.destroy(); reject(e); }); rq.end();
    });
  }
  // تنزيل الإصدار الجديد بجانب البرنامج والتحقق منه (لا يُستبدل شيء بعد)
  async function fetchUpdate(onState) {
    const o = state.avail; if (!o) return { ok: false, msg: 'لا يوجد تحديث متاح' };
    const cur = ctx.exePath(); if (!cur) return { ok: false, msg: 'هذا التشغيل ليس ملف البرنامج المستقل — لا يمكن التحديث الذاتي' };
    const dir = path.dirname(cur), tmp = path.join(dir, `.تحديث-${o.ver}.part`), fin = newName(dir, o, cur);
    Object.assign(state, { phase: 'download', got: 0, size: o.size, error: '' }); onState();
    let last = 0;
    try {
      const r = await download(o, tmp, g => { state.got = g; if (Date.now() - last > 500) { last = Date.now(); onState(); } });
      if (r.got !== o.size) throw new Error('حجم الملف المنزّل غير مطابق — ستُعاد المحاولة');
      if (r.sha !== o.sha256) throw new Error('بصمة الملف المنزّل غير مطابقة — لم يُستعمل');
      try { if (fs.existsSync(fin)) fs.unlinkSync(fin); } catch (_) {}
      fs.renameSync(tmp, fin);
      try { fs.writeFileSync(path.join(dir, PEND), JSON.stringify({ ver: o.ver, file: path.basename(fin), size: o.size, sha256: o.sha256 })); } catch (_) {}
      Object.assign(state, { phase: 'ready', ready: { file: fin, ver: o.ver, cur } }); onState();
      ctx.log(`نُزّل الإصدار ${o.ver} من حاسبة القسم وتُحقق منه — ${path.basename(fin)}`);
      return { ok: true, ver: o.ver, file: fin };
    } catch (e) {
      try { fs.unlinkSync(tmp); } catch (_) {}
      Object.assign(state, { phase: '', error: String(e && e.message || e) }); onState();
      return { ok: false, msg: state.error };
    }
  }
  const PEND = '.تحديث-معلق.json';
  // اسم الملف الجديد: اسم ملف حاسبة القسم (فيه رقم الإصدار) أو «<الاسم الحالي>-<الإصدار>.exe» — ولا يساوي اسم الملف الحالي
  function newName(dir, o, cur) {
    const ext = path.extname(cur) || '.exe'; let n = String(o.name || '').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '_').trim();
    if (!n || !n.toLowerCase().endsWith(ext.toLowerCase()) || !n.includes(o.ver) || n.toLowerCase() === path.basename(cur).toLowerCase()) n = path.basename(cur, ext).replace(/-?\d+\.\d+\.\d+/, '') + '-' + o.ver + ext;
    if (n.toLowerCase() === path.basename(cur).toLowerCase()) n = path.basename(cur, ext) + '-جديد-' + o.ver + ext;
    return path.join(dir, n);
  }
  // عند التشغيل: تنظيف بقايا التنزيل، وإظهار تحديث منزّل لم يُثبَّت
  async function recover() {
    const cur = ctx.exePath(); if (!cur) return null; const dir = path.dirname(cur);
    let names = []; try { names = fs.readdirSync(dir); } catch (_) { return null; }
    names.filter(n => /^\.تحديث-.*\.part$/.test(n)).forEach(n => { try { fs.unlinkSync(path.join(dir, n)); ctx.log('حُذف ملف تنزيل غير مكتمل: ' + n); } catch (_) {} });
    const pf = path.join(dir, PEND); let p = null; try { p = JSON.parse(fs.readFileSync(pf, 'utf8')); } catch (_) { return null; }
    const f = p && p.file ? path.join(dir, path.basename(p.file)) : '';
    if (!p || cmpVer(p.ver, ctx.version) <= 0 || !f || path.resolve(f) === path.resolve(cur) || !fs.existsSync(f)) { try { fs.unlinkSync(pf); } catch (_) {} return null; }
    const st = await fsp.stat(f); if (st.size !== p.size) { try { fs.unlinkSync(pf); } catch (_) {} return null; }
    const h = crypto.createHash('sha256'); await new Promise((res, rej) => fs.createReadStream(f).on('data', d => h.update(d)).on('end', res).on('error', rej));
    if (h.digest('hex') !== p.sha256) { try { fs.unlinkSync(pf); } catch (_) {} return null; }
    if (state.phase) return null;
    Object.assign(state, { phase: 'ready', ready: { file: f, ver: p.ver, cur }, size: p.size, got: p.size, error: '' });
    ctx.log(`تحديث منزّل سابقاً لم يُثبَّت: ${p.ver} — يظهر «إعادة التشغيل الآن»`);
    return state.ready;
  }
  // سكربت الاستبدال (ويندوز): ينتظر إغلاق البرنامج، يحفظ القديم «نسخة سابقة»، يضع الجديد بالاسم نفسه، ويشغّله.
  // بصيغة PowerShell مشفّرة UTF-16 فتعمل مع المسارات العربية.
  function swapScript(cur, neu, bak, pid, ppid) {
    const q = s => "'" + String(s).replace(/'/g, "''") + "'";
    return [
      `$ErrorActionPreference='SilentlyContinue'`,
      `$cur=${q(cur)}; $new=${q(neu)}; $bak=${q(bak)}`,
      `try { Wait-Process -Id ${+pid} -Timeout 60 } catch {}`,
      /* مُشغّل البرنامج (ملف portable) يبقى مفتوحاً لحظات بعد إغلاق البرنامج — ننتظره إن كان هو الملف نفسه */
      `try { $pp = Get-Process -Id ${+ppid || 0} -ErrorAction Stop; if ($pp.Path -and ($pp.Path -ieq $cur)) { Wait-Process -Id ${+ppid || 0} -Timeout 60 } } catch {}`,
      `$moved=$false; for ($i=0; $i -lt 120; $i++) { try { if (Test-Path -LiteralPath $bak) { Remove-Item -LiteralPath $bak -Force }; Move-Item -LiteralPath $cur -Destination $bak -Force -ErrorAction Stop; $moved=$true; break } catch { Start-Sleep -Seconds 1 } }`,
      /* الملف القديم ما زال مقفلاً: يُشغَّل الإصدار الجديد من ملفه وتُوجَّه اختصارات سطح المكتب إليه */
      `function Fix-Links($to) { try { $sh = New-Object -ComObject WScript.Shell; foreach ($d in @([Environment]::GetFolderPath('Desktop'), [Environment]::GetFolderPath('CommonDesktopDirectory'))) { if ($d) { Get-ChildItem -LiteralPath $d -Filter *.lnk | ForEach-Object { $l = $sh.CreateShortcut($_.FullName); if ($l.TargetPath -ieq $cur) { $l.TargetPath = $to; $l.Save() } } } } } catch {} }`,
      `if (-not $moved) { Fix-Links $new; Start-Process -FilePath $new; exit }`,
      `try { Move-Item -LiteralPath $new -Destination $cur -Force -ErrorAction Stop; Start-Process -FilePath $cur } catch { Move-Item -LiteralPath $bak -Destination $cur -Force; Fix-Links $new; Start-Process -FilePath $new }`,
    ].join('\r\n');
  }
  function launcher(enc) {
    const cl = `powershell.exe -NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -EncodedCommand ${enc}`;
    return [`$ErrorActionPreference='SilentlyContinue'`, `$ok=$false`,
      `try { $r = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = '${cl}' } -ErrorAction Stop; if ($r.ReturnValue -eq 0) { $ok=$true } } catch {}`,
      `if (-not $ok) { try { $r = ([wmiclass]'Win32_Process').Create('${cl}'); if ($r.ReturnValue -eq 0) { $ok=$true } } catch {} }`,
      `if (-not $ok) { & powershell.exe -NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -EncodedCommand ${enc} }`].join('\r\n');
  }
  function apply() {
    const r = state.ready; if (!r) return { ok: false, msg: 'لم يُنزّل التحديث بعد' };
    const ext = path.extname(r.cur), bak = r.cur.slice(0, r.cur.length - ext.length) + `.نسخة-سابقة-${ctx.version}${ext}`;
    const script = swapScript(r.cur, r.file, bak, process.pid, process.ppid);
    if (process.env.UNI_UPDATE_DRYRUN || ctx.platform !== 'win32') return { ok: true, dry: true, script, bak, launcher: launcher('X') };
    const { spawn } = require('child_process');
    const enc = Buffer.from(script, 'utf16le').toString('base64');
    /* يُشغَّل السكربت عبر WMI فيكون خارج عملية البرنامج ومُشغّله (لا يُغلق معهما)، وإن تعذّر فمباشرة */
    const outer = Buffer.from(launcher(enc), 'utf16le').toString('base64');
    spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', outer], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
    ctx.log(`تحديث البرنامج إلى ${r.ver} — النسخة السابقة محفوظة: ${path.basename(bak)}`);
    setTimeout(() => ctx.quit(), 400);
    return { ok: true, bak };
  }
  return { offer, serve, check, fetchUpdate, apply, recover, state: () => ({ ...state, avail: state.avail ? { ver: state.avail.ver, size: state.avail.size } : null, cur: String(ctx.version || '') }), cmpVer };
};
