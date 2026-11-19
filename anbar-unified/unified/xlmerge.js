'use strict';
/* دمج مواقف الأقضية في موقف واحد (xlsx) + كشف المهندسين المقيمين والمشرفين.
   الدمج يجري على ملفات Excel نفسها (XML داخل الملف) لا بإعادة إنشائها:
   - الملف الأول هو الأساس: تبقى أوراقه وتنسيقاته ومعادلاته ولوحاته وأسماؤه المعرّفة كما هي.
   - صفوف البيانات من الملفات الأخرى تُضاف تحت بيانات الأساس في الورقة نفسها (بالاسم)، بمعادلاتها،
     وتُزاح مراجع الصفوف في معادلاتها إلى مواضعها الجديدة (ومنها المراجع بين الأوراق).
   - لا يُحذف أي عمود: الأعمدة الموجودة في ملف قضاء وليست في الأساس تُضاف في آخر الورقة بعنوانها.
   - النطاقات التي تغطي بيانات الورقة (في المعادلات والجداول والتصفية والتنسيق الشرطي والأسماء المعرّفة)
     تُمدّ لتشمل الصفوف المضافة، كما يفعل Excel عند إدراج صفوف داخل الجدول. */
const zlib = require('zlib');

/* ---------- ZIP ---------- */
const CRC_T = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(b) { let c = ~0; for (let i = 0; i < b.length; i++) c = CRC_T[(c ^ b[i]) & 255] ^ (c >>> 8); return (~c) >>> 0; }
function unzip(buf) {
  let e = buf.length - 22; while (e >= 0 && buf.readUInt32LE(e) !== 0x06054b50) e--;
  if (e < 0) throw new Error('ليس ملف Excel صالحاً (xlsx)');
  const n = buf.readUInt16LE(e + 10); let p = buf.readUInt32LE(e + 16); const out = new Map();
  for (let i = 0; i < n; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break;
    const meth = buf.readUInt16LE(p + 10), csz = buf.readUInt32LE(p + 20), nl = buf.readUInt16LE(p + 28), xl = buf.readUInt16LE(p + 30), cl = buf.readUInt16LE(p + 32), lo = buf.readUInt32LE(p + 42);
    const name = buf.slice(p + 46, p + 46 + nl).toString('utf8'); p += 46 + nl + xl + cl;
    const ds = lo + 30 + buf.readUInt16LE(lo + 26) + buf.readUInt16LE(lo + 28), raw = buf.slice(ds, ds + csz);
    out.set(name, meth === 8 ? zlib.inflateRawSync(raw) : Buffer.from(raw));
  }
  return out;
}
function zip(entries) {   // entries: Map name -> Buffer|string
  const parts = [], cen = []; let off = 0;
  for (const [name, d] of entries) {
    const data = Buffer.isBuffer(d) ? d : Buffer.from(String(d), 'utf8'), nb = Buffer.from(name, 'utf8'), crc = crc32(data), comp = zlib.deflateRawSync(data, { level: 6 });
    const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x0800, 6); lh.writeUInt16LE(8, 8); lh.writeUInt32LE(0x00210000, 10);
    lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(data.length, 22); lh.writeUInt16LE(nb.length, 26); lh.writeUInt16LE(0, 28);
    parts.push(lh, nb, comp);
    const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x0800, 8); ch.writeUInt16LE(8, 10); ch.writeUInt32LE(0x00210000, 12);
    ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(comp.length, 20); ch.writeUInt32LE(data.length, 24); ch.writeUInt16LE(nb.length, 28); ch.writeUInt32LE(off, 42);
    cen.push(ch, nb); off += 30 + nb.length + comp.length;
  }
  const cd = Buffer.concat(cen), end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.size, 8); end.writeUInt16LE(entries.size, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(off, 16);
  return Buffer.concat([...parts, cd, end]);
}

/* ---------- أدوات XML وعناوين الخلايا ---------- */
const dec = s => String(s).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&amp;/g, '&');
const enc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const encT = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');   // نص العنصر (المعادلات)
const attrs = s => { const o = {}; String(s || '').replace(/([\w:]+)="([^"]*)"/g, (_, k, v) => { o[k] = v; }); return o; };
const attrStr = o => Object.entries(o).map(([k, v]) => ` ${k}="${v}"`).join('');
const colN = L => { let n = 0; for (const ch of L) n = n * 26 + ch.charCodeAt(0) - 64; return n; };
const colL = n => { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
const splitRef = r => { const m = /^([A-Z]+)(\d+)$/.exec(r); return m ? { c: colN(m[1]), r: +m[2] } : null; };
const toEn = s => String(s == null ? '' : s).replace(/[٠-٩]/g, d => d.charCodeAt(0) - 1632);
/* تطبيع الأسماء للمقارنة: الهمزات والتاء المربوطة والألف المقصورة والتشكيل و«عبد ال...» */
const RN = s => toEn(s).replace(/[ً-ْـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/عبد\s+ال/g, 'عبدال').replace(/\s+/g, ' ').trim();

/* ---------- قراءة المصنف ---------- */
/* إصلاح ملف أفسده إصدار سابق من الدمج: بعد <f .../> المغلق ذاتياً كُتب جزء من الورقة نصاً مُهرَّباً حتى </f>.
   يُعاد النص إلى XML كما كان فتُستعاد الخلايا والصفوف المبتلعة */
/* تعديل نص كل صيغة في الورقة. لا يطابق <f .../> المغلق ذاتياً: كان النمط القديم يمتد منه عبر الخلايا حتى </f> التالي
   فيكتب جزءاً من الورقة نصاً داخل صيغة ويُفسد الورقة (اختفاء صفوف «الكادر الهندسي» بعد الدمج) */
const mapFormulas = (xml, fn) => xml.replace(/<f((?:\s[^>]*?[^\/])?)>([\s\S]*?)<\/f>/g, (m, a, f) => { const d0 = dec(f), d1 = fn(d0); return d1 === d0 ? m : `<f${a}>${encT(d1)}</f>`; });
const repairXml = x => x.replace(/(<f\b[^>]*?\/>)([^<]*?&lt;[^<]*)<\/f>/g, (m, a, t) => a + dec(t) + "</f>");   /* </f> الأخير يعود لصيغة الخلية التي ابتُلعت بدايتها */
function readBook(buf, label) {
  const z = unzip(buf);
  for (const [k, v] of z) if (/^xl\/worksheets\/[^/]+\.xml$/.test(k)) { const t = v.toString('utf8'), f = repairXml(t); if (f !== t) z.set(k, Buffer.from(f, 'utf8')); }
  const txt = n => (z.has(n) ? z.get(n).toString('utf8') : '');
  const wb = txt('xl/workbook.xml'), rels = txt('xl/_rels/workbook.xml.rels'), rmap = {};
  rels.replace(/<Relationship\b([^>]*)\/?>/g, (_, a) => { const o = attrs(a); rmap[o.Id] = o.Target; });
  const sheets = [];
  wb.replace(/<sheet\b([^>]*)\/?>/g, (_, a) => { const o = attrs(a); let t = rmap[o['r:id']] || ''; t = t.replace(/^\/?xl\//, '').replace(/^\//, ''); sheets.push({ name: dec(o.name), path: 'xl/' + t }); });
  const sst = []; const sx = txt('xl/sharedStrings.xml');
  sx.replace(/<si\b[^>]*?(?:\/>|>([\s\S]*?)<\/si>)/g, (m, inner) => { inner = inner || ''; const t = inner.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '').replace(/<t\b[^>]*\/>/g, '').match(/<t\b[^>]*>([\s\S]*?)<\/t>/g) || []; sst.push({ xml: inner, text: t.map(x => dec(x.replace(/<t\b[^>]*>|<\/t>/g, ''))).join('') }); });
  return { z, label, sheets, sst, styles: txt('xl/styles.xml') };
}
function parseSheet(xml) {
  const sd = /<sheetData\b[^>]*?(?:\/>|>([\s\S]*?)<\/sheetData>)/.exec(xml); const rows = new Map();
  if (sd && sd[1]) sd[1].replace(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g, (_, ra, inner) => {
    const a = attrs(ra), r = +a.r, cells = [];
    (inner || '').replace(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g, (__, ca, ci) => {
      const o = attrs(ca), rc = splitRef(o.r || ''); if (!rc) return; ci = ci || '';
      const fm = /<f\b([^>]*?)(?:\/>|>([\s\S]*?)<\/f>)/.exec(ci), vm = /<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/.exec(ci), is = /<is>([\s\S]*?)<\/is>/.exec(ci);
      cells.push({ c: rc.c, r, a: o, f: fm ? { a: attrs(fm[1]), t: fm[2] != null ? dec(fm[2]) : null } : null, v: vm ? dec(vm[1]) : null, is: is ? is[1] : null, raw: ci });
    });
    rows.set(r, { a, cells });
  });
  return rows;
}
function cellText(book, cell) {
  if (!cell) return '';
  const t = cell.a.t;
  if (t === 's') { const s = book.sst[+cell.v]; return s ? s.text : ''; }
  if (t === 'inlineStr') return dec((cell.is || '').replace(/<rPh\b[\s\S]*?<\/rPh>/g, '').replace(/<[^>]+>/g, ''));
  return cell.v == null ? '' : String(cell.v);
}
/* صف العناوين: أكثر صف بخلايا نصية في أول ٤٠ صفاً (٣ في الأقل) */
function findHeader(book, rows) {
  let best = null, bn = 2;
  for (const [r, row] of rows) { if (r > 40) continue; const n = row.cells.filter(c => { const t = cellText(book, c).trim(); return t && !/^[\d.\-]+$/.test(t) && !c.f; }).length; if (n > bn) { bn = n; best = r; } }
  return best;
}
function sheetInfo(book, sh) {
  const xml = book.z.has(sh.path) ? book.z.get(sh.path).toString('utf8') : ''; const rows = parseSheet(xml); const hr = findHeader(book, rows);
  if (hr == null) return { xml, rows, hr: null };
  const head = {}; for (const c of rows.get(hr).cells) { const t = cellText(book, c).replace(/\s+/g, ' ').trim(); if (t) head[c.c] = t; }
  const seqCol = +(Object.keys(head).find(k => /^ت$|^تسلسل$|^التسلسل$/.test(RN(head[k]))) || 0);
  /* صف بيانات = فيه قيمة مُدخلة (لا معادلة) في عمود غير «ت» */
  const data = [...rows.keys()].filter(r => r > hr && rows.get(r).cells.some(c => !c.f && c.c !== seqCol && cellText(book, c).trim() !== '')).sort((a, b) => a - b);
  return { xml, rows, hr, head, seqCol, data, first: data.length ? data[0] : hr + 1, last: data.length ? data[data.length - 1] : hr };
}

/* ---------- ترجمة المراجع في المعادلات ---------- */
const SHEETN = "(?:'(?:[^']|'')+'|[A-Za-z0-9_.\\u0600-\\u06FF]+)";
const REF_RE = new RegExp(`(^|[^A-Za-z0-9_.'\\u0600-\\u06FF$])(?:(${SHEETN})!)?(\\$?)([A-Z]{1,3})(\\$?)(\\d+)(?::(\\$?)([A-Z]{1,3})(\\$?)(\\d+))?(?![A-Za-z0-9_(])`, 'g');
const unq = s => (s && s[0] === "'" ? s.slice(1, -1).replace(/''/g, "'") : s);
/* يطبّق fn على كل مرجع خارج النصوص: fn(sheet|null, {c,r,ca,ra}) -> {c,r} */
function mapRefs(formula, fn) {
  return String(formula).split(/("(?:[^"]|"")*")/).map((seg, i) => i % 2 ? seg : seg.replace(REF_RE, (m, pre, sh, cd1, c1, rd1, r1, cd2, c2, rd2, r2) => {
    const sheet = sh ? unq(sh) : null;
    const x1 = { c: colN(c1), r: +r1, ca: !!cd1, ra: !!rd1 }, x2 = c2 ? { c: colN(c2), r: +r2, ca: !!cd2, ra: !!rd2 } : null;
    /* النطاق يُترجم كاملاً (fn.range) حتى لا يُزاح طرفه الأول وحده فينقلب أو يقصر (مثل VLOOKUP على جدول المشرفين) */
    const P = x2 && fn.range ? fn.range(sheet, x1, x2) : null;
    const A = P ? P[0] : fn(sheet, x1, 0);
    let out = `${pre}${sh ? sh + '!' : ''}${cd1}${colL(A.c)}${rd1}${A.r}`;
    if (x2) { const B = P ? P[1] : fn(sheet, x2, 1); out += `:${cd2}${colL(B.c)}${rd2}${B.r}`; }
    return out;
  })).join('');
}
/* إزاحة نسبية (لتوسيع المعادلات المشتركة) */
const shiftRel = (f, dr, dc) => mapRefs(f, (_s, x) => ({ c: x.ca ? x.c : x.c + dc, r: x.ra ? x.r : x.r + dr }));
/* نطاقات تُمدّ: [ورقة، عمود؟] كل نطاق في الورقة يبدأ قبل/عند أول صف بيانات وينتهي عند آخرها أو بعده وقبل الحد الجديد */
function extendRange(r1, r2, info) { return r1 <= info.first && r2 >= info.oldLast && r2 < info.newLast ? info.newLast : r2; }
function extendFormula(f, curSheet, ext) {
  return String(f).split(/("(?:[^"]|"")*")/).map((seg, i) => i % 2 ? seg : seg.replace(REF_RE, (m, pre, sh, cd1, c1, rd1, r1, cd2, c2, rd2, r2) => {
    if (!c2) return m; const info = ext[sh ? unq(sh) : curSheet]; if (!info) return m;
    const n = extendRange(+r1, +r2, info); return n === +r2 ? m : `${pre}${sh ? sh + '!' : ''}${cd1}${c1}${rd1}${r1}:${cd2}${c2}${rd2}${n}`;
  })).join('');
}
const extendSqref = (sq, info) => sq.split(/\s+/).map(rg => { const m = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/.exec(rg); if (!m) return rg; const n = extendRange(+m[2], +m[4], info); return `${m[1]}${m[2]}:${m[3]}${n}`; }).join(' ');

/* ---------- الدمج ---------- */
/* ---------- التنسيقات: نقل تنسيق خلايا ملف القضاء (التواريخ والنسب والأرقام والخطوط) إلى الأساس كما هي ---------- */
function parseStyles(xml) {
  const sec = tag => { const m = new RegExp(`<${tag}\\b[^>]*?(?:/>|>([\\s\\S]*?)</${tag}>)`).exec(xml); return m ? (m[1] || '') : ''; };
  const items = (body, tag) => body.match(new RegExp(`<${tag}\\b[^>]*?(?:/>|>[\\s\\S]*?</${tag}>)`, 'g')) || [];
  const nf = new Map(); items(sec('numFmts'), 'numFmt').forEach(x => { const o = attrs(x.replace(/^<numFmt/, '')); nf.set(+o.numFmtId, dec(o.formatCode || '')); });
  return { xml, nf, fonts: items(sec('fonts'), 'font'), fills: items(sec('fills'), 'fill'), borders: items(sec('borders'), 'border'), xfs: items(sec('cellXfs'), 'xf') };
}
const BUILTIN_PCT = new Set([9, 10]);
const isPctFmt = (st, s) => { const x = st && st.xfs[+s]; if (!x) return false; const id = +(attrs(x.replace(/^<xf/, '').split('>')[0]).numFmtId || 0); return BUILTIN_PCT.has(id) || /%/.test(st.nf.get(id) || ''); };
function styleImporter(base) {
  const S = parseStyles(base.styles || ''), add = (list, x) => { let i = list.indexOf(x); if (i < 0) { list.push(x); i = list.length - 1; } return i; };
  let changed = false;
  return {
    S,
    imp(B, Bs, s) {   // رقم تنسيق في ملف القضاء ← رقم تنسيق مكافئ في الأساس
      const x = Bs.xfs[+s]; if (!x || !S.xfs.length) return null;
      const head = x.replace(/^<xf/, '').split('>')[0], o = attrs(head);
      const font = Bs.fonts[+o.fontId || 0], fill = Bs.fills[+o.fillId || 0], border = Bs.borders[+o.borderId || 0];
      if (font != null) o.fontId = String(add(S.fonts, font)); if (fill != null) o.fillId = String(add(S.fills, fill)); if (border != null) o.borderId = String(add(S.borders, border));
      let id = +(o.numFmtId || 0);
      if (id >= 164) { const code = Bs.nf.get(id); if (code != null) { let nid = [...S.nf].find(([, c]) => c === code); if (nid) id = nid[0]; else { id = Math.max(163, ...S.nf.keys()) + 1; S.nf.set(id, code); } } else id = 0; }
      o.numFmtId = String(id); o.xfId = '0';
      const inner = /<xf\b[^>]*?\/>$/.test(x) ? '' : ((/>([\s\S]*)<\/xf>$/.exec(x) || [])[1] || '');
      const nx = `<xf${attrStr(o)}${inner ? `>${inner}</xf>` : '/>'}`; const before = S.xfs.length, i = add(S.xfs, nx); if (S.xfs.length !== before) changed = true;
      return String(i);
    },
    write(styles) {   // كتابة القوائم المحدَّثة في styles.xml
      if (!changed) return styles;
      const put = (xml, tag, item, list) => { const re = new RegExp(`<${tag}\\b[^>]*?(?:/>|>[\\s\\S]*?</${tag}>)`); const body = list.join(''); return re.test(xml) ? xml.replace(re, `<${tag} count="${list.length}">${body}</${tag}>`) : xml; };
      let x = styles;
      const nfx = [...S.nf].map(([i, c]) => `<numFmt numFmtId="${i}" formatCode="${enc(c)}"/>`).join('');
      if (/<numFmts\b/.test(x)) x = x.replace(/<numFmts\b[^>]*?(?:\/>|>[\s\S]*?<\/numFmts>)/, `<numFmts count="${S.nf.size}">${nfx}</numFmts>`);
      else if (S.nf.size) x = x.replace(/(<styleSheet\b[^>]*>)/, `$1<numFmts count="${S.nf.size}">${nfx}</numFmts>`);
      x = put(x, 'fonts', 'font', S.fonts); x = put(x, 'fills', 'fill', S.fills); x = put(x, 'borders', 'border', S.borders); x = put(x, 'cellXfs', 'xf', S.xfs);
      return x;
    }
  };
}

/* ---------- مطابقة العناوين المختلفة الكتابة ---------- */
const FIELDS = [['seq', /^ت\.?$|^التسلسل$|^تسلسل$/], ['fileNo', /رقم الاضبار|^الاضبار/], ['name', /^اسم المشروع|^المشروع$/], ['contractor', /الشركه المنفذه|المقاول|^الشركه/], ['fund', /برنامج التمويل|^التمويل|نوع الخطه/],
  ['contractNo', /رقم العقد/], ['year', /^السنه$|سنه العقد/], ['sector', /^القطاع|^الجهه المستفيده/], ['district', /^القضاء$/], ['sub', /^الناحيه$/],
  ['orig', /كلفه المشروع الاصليه|كلفه المشروع التعاقديه|الكلفه التعاقديه|مبلغ العقد|^الكلفه الاصليه/], ['changeCost', /كلفه اوامر (التغيير|الغيار)/], ['total', /الكلفه الكليه/],
  ['start', /تاريخ المباشره/], ['dur', /^مده العقد/], ['extra', /المده الاضافيه/], ['totalDays', /المده الكليه/], ['planEnd', /تاريخ الانجاز المخطط/],
  ['planPct', /نسبه الانجاز المخطط|الانجاز المخطط/], ['actualPct', /نسبه الانجاز الفعلي|الانجاز الفعلي/], ['dev', /الانحراف/], ['status', /تصنيف حاله|^حاله المشروع|^الحاله$/], ['legal', /الاجراءات القانونيه/],
  ['advRaised', /السلف المرفوعه/], ['advPaid', /السلف المصروفه/], ['lat', /^Nالاحداثيات|^خط العرض|الاحداثيات ?N/], ['lng', /^Eالاحداثيات|^خط الطول|الاحداثيات ?E/],
  ['resident', /^المهندس المقيم/], ['residentOffice', /دائره المهندس المقيم|جهه انتساب المقيم|^دائره المقيم/], ['supervisor', /^المهندس المشرف|^المشرف$|^مشرف$/], ['supervisorOffice', /دائره (المهندس )?المشرف/], ['phone', /رقم الهاتف|^الهاتف/], ['notes', /^الملاحظات|^ملاحظات/], ['committee', /^اللجنه|ملف الموقف/]];
const fieldOf = h => { const t = RN(h); for (const [k, re] of FIELDS) if (re.test(t)) return k; return null; };
const SYN = t => t.replace(/^جهه انتساب المقيم/, 'دائره المقيم').replace(/^جهه (?:ال)?انتساب(?: المشرف)? (\d+)/, 'دائره المشرف $1').replace(/^دائره المهندس المقيم/, 'دائره المقيم').replace(/كلفه المشروع التعاقديه/, 'كلفه المشروع الاصليه');
const looseKey = h => SYN(RN(h)).replace(/\([^)]*\)/g, ' ').replace(/[%٪:.\-_\/\\,،*#]+/g, ' ').split(/\s+/).map(w => w.replace(/^ال/, '')).filter(Boolean).join(' ');
const words = h => new Set(looseKey(h).split(' ').filter(w => w.length > 1));
const dice = (a, b) => { const A = words(a), B = words(b); if (!A.size || !B.size) return 0; let n = 0; A.forEach(w => { if (B.has(w)) n++; }); return 2 * n / (A.size + B.size); };
/* عمود ملف القضاء ← عمود الأساس: الاسم نفسه، ثم الاسم بعد حذف الأقواس والرموز، ثم الحقل نفسه في الموقف، ثم التشابه؛ ولا يُطابَق عمودا أساس بعمود واحد */
function matchColumns(baseHead, head) {
  const taken = new Set(), cm = {}, fuzzy = [], bcols = Object.keys(baseHead).map(Number), order = Object.keys(head).map(Number).sort((a, b) => a - b);
  const tryPick = (c, pred) => { for (const b of bcols) if (!taken.has(b) && pred(b)) { taken.add(b); cm[c] = b; return true; } return false; };
  for (const c of order) tryPick(c, b => RN(baseHead[b]) === RN(head[c]));
  for (const c of order) if (cm[c] == null && tryPick(c, b => looseKey(baseHead[b]) === looseKey(head[c]) && looseKey(head[c]))) fuzzy.push([head[c], baseHead[cm[c]]]);
  for (const c of order) { if (cm[c] != null) continue; const f = fieldOf(head[c]); if (f && tryPick(c, b => fieldOf(baseHead[b]) === f)) fuzzy.push([head[c], baseHead[cm[c]]]); }
  for (const c of order) { if (cm[c] != null) continue; let best = null, bs = 0.72; for (const b of bcols) { if (taken.has(b)) continue; const d = dice(baseHead[b], head[c]); if (d > bs) { bs = d; best = b; } } if (best != null) { taken.add(best); cm[c] = best; fuzzy.push([head[c], baseHead[best]]); } }
  return { cm, fuzzy };
}
/* اسم اللجنة (ملف الموقف): من اسم الملف بعد حذف الكلمات العامة والأرقام والتواريخ، وإلا القضاء الأكثر في الملف */
function committeeOf(B) { let t = String(B.label || '').replace(/\.(xlsx|xlsm|xls)$/i, '').replace(/^[0-9a-f]{8}-/i, '').replace(/[_\-–—()\[\]]+/g, ' ');
  t = t.replace(/\b\d{4}[-\/.]\d{1,2}[-\/.]\d{1,2}\b|\d+/g, ' ').split(/\s+/).filter(w => w && !/^(موقف|الموقف|نموذج|مشاريع|المشاريع|لجنه|اللجنه|لجنة|اللجنة|متابعه|متابعة|المتابعة|قسم|الشؤون|الهندسيه|الهندسية|محافظه|محافظة|الانبار|الأنبار|نسخه|نسخة|النهائي|المحدث|محدث|شهر|لشهر|copy|final)$/i.test(w)).join(' ').trim();
  if (t.length >= 2 && /[\u0600-\u06FF]/.test(t)) return t;
  try { const c = {}; for (const sh of B.sheets) { const I = sheetInfo(B, sh); if (I.hr == null || !isDataSheet(sh.name, I)) continue; const dc = Object.keys(I.head).find(k => fieldOf(I.head[k]) === 'district'); if (dc == null) continue;
      I.data.forEach(r => { const v = cellText(B, I.rows.get(r).cells.find(x => x.c === +dc)).trim(); if (v) c[v] = (c[v] || 0) + 1; }); break; }
    const best = Object.entries(c).sort((a, b) => b[1] - a[1])[0]; if (best) return best[0]; } catch (_) {}
  return String(B.label || 'ملف').replace(/\.(xlsx|xlsm)$/i, ''); }
/* أوراق البيانات فقط تُدمج صفوفها: جدول المشاريع (رقم الاضبارة واسم المشروع) وقوائم الكادر والمشرفين.
   لوحة المعلومات والتعليمات وجداول المطابقة والقوائم المساعدة تبقى كما في الملف الأساس (ومعادلاتها تُمدّ لتشمل كل المشاريع) */
function isDataSheet(name, I) { const f = new Set(Object.values(I.head || {}).map(fieldOf)); if (f.has('fileNo') && f.has('name')) return true;
  return /الكادر|قائمه المشرفين|^المشرفون$|المهندسين|المهندسون/.test(RN(name)); }
/* رقم مكتوب نصاً في عمود رقمي: «5,116,123,000» أو «5.206.495.000» ← 5116123000 */
const DATEF = new Set(['start', 'planEnd']);
/* تاريخ مكتوب نصاً «25/3/2025» أو «2025-03-25» ← رقم تاريخ Excel */
function textDate(t) { const x = toEn(String(t == null ? '' : t)).trim(); let m = x.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/), y, mo, d;
  if (m) { d = +m[1]; mo = +m[2]; y = +m[3]; } else if ((m = x.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/))) { y = +m[1]; mo = +m[2]; d = +m[3]; } else return null;
  if (mo > 12 && d <= 12) [d, mo] = [mo, d]; if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 1990 || y > 2100) return null;
  return Math.round((Date.UTC(y, mo - 1, d) - Date.UTC(1899, 11, 30)) / 864e5); }
const NUMF = new Set(['orig', 'changeCost', 'total', 'advRaised', 'advPaid', 'dur', 'extra', 'totalDays']);
function textNum(t) { let x = toEn(String(t == null ? '' : t)).replace(/٬/g, ',').replace(/٫/g, '.').replace(/\s+/g, '').replace(/(دينار|د\.ع|IQD)$/i, '');
  if (!/^-?[\d.,]+$/.test(x) || !/\d/.test(x)) return null;
  if ((x.match(/\./g) || []).length > 1 || /^\d{1,3}(\.\d{3})+$/.test(x) && x.length > 6) x = x.replace(/\./g, ''); x = x.replace(/,/g, '');
  const n = +x; return isFinite(n) ? n : null; }
/* ورقة ملف القضاء ← ورقة الأساس: بالاسم، وإلا بأكثر ورقة تشترك معها في العناوين */
function matchSheet(baseInfo, I, name, used) {
  if (baseInfo[name]) return name; if (!I || I.hr == null) return null; let best = null, bs = 0.5;
  for (const n in baseInfo) { const { cm } = matchColumns(baseInfo[n].head, I.head), sc = Object.keys(cm).length / Math.max(1, Object.keys(I.head).length); if (sc > bs || (sc === bs && best && used.has(best))) { bs = sc; best = n; } }
  return best;
}

function merge(files) {   // files: [{name, buf}]
  if (!files || files.length < 2) throw new Error('اختر ملفين في الأقل');
  const skippedFiles = [], books = files.map((f, i) => { try { return readBook(f.buf, f.name); } catch (e) { if (i === 0) throw new Error(`تعذّرت قراءة الملف الأساس «${f.name}»: ${e.message || e}`); skippedFiles.push(`${f.name}: تعذّرت قراءته (${e.message || e}) — تأكد أنه xlsx وليس xls قديماً`); return null; } }).filter(Boolean);
  if (books.length < 2) throw new Error('لم يُقرأ إلا ملف واحد صالح — ' + skippedFiles.join('؛ '));
  const base = books[0], report = { files: books.map(b => b.label), sheets: [], skipped: skippedFiles.slice(), addedCols: [], matchedCols: [], extended: 0, renamedSheets: [] };
  const sameStyles = books.map(b => b.styles === base.styles), SI = styleImporter(base), Bst = books.map((b, i) => (i && !sameStyles[i] ? parseStyles(b.styles || '') : null));
  report.pctFixed = []; const checks = []; let numFixed = 0, dateFixed = 0;
  /* سلاسل الأساس المشتركة: تُضاف إليها سلاسل الملفات الأخرى */
  const sstIdx = new Map(); base.sst.forEach((s, i) => { if (!sstIdx.has(s.xml)) sstIdx.set(s.xml, i); });
  const sstAdd = xml => { if (sstIdx.has(xml)) return sstIdx.get(xml); base.sst.push({ xml, text: '' }); sstIdx.set(xml, base.sst.length - 1); return base.sst.length - 1; };
  const baseInfo = {}, ext = {};
  for (const sh of base.sheets) { const I = sheetInfo(base, sh); if (I.hr != null && Object.keys(I.head).length >= 3 && isDataSheet(sh.name, I)) baseInfo[sh.name] = I; }
  const next = {}; for (const n in baseInfo) next[n] = baseInfo[n].last + 1;
  /* أعمدة النسب في الأساس (عنوانها فيه «نسبة» أو «%» أو «الانحراف») ومتوسط قيمها، للتوحيد */
  const pctCols = {}, pctBase = {}; let pctN = 0;
  for (const n in baseInfo) { const I = baseInfo[n]; pctCols[n] = new Set(); pctBase[n] = new Map();
    for (const c in I.head) if (/نسب|%|الانحراف|الانجاز/.test(RN(I.head[c]))) { pctCols[n].add(+c);
      const v = I.data.map(r => (I.rows.get(r).cells.find(x => x.c === +c) || {})).filter(x => x && !x.f && x.v != null && (!x.a.t || x.a.t === 'n')).map(x => Math.abs(+x.v)).filter(x => isFinite(x) && x > 0);
      pctBase[n].set(+c, v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0); } }
  const added = {}; for (const n in baseInfo) added[n] = new Map();   // صف جديد -> {a, cells xml}
  const newMerges = {}; for (const n in baseInfo) newMerges[n] = [];
  const counts = {}; for (const n in baseInfo) counts[n] = { base: baseInfo[n].data.length, add: 0 };
  /* اللجنة (ملف الموقف) لكل مشروع */
  const comCache = {}, comLabel = bi => (comCache[bi] = comCache[bi] || committeeOf(books[bi])), comRow = {}; for (const n in baseInfo) { comRow[n] = new Map(); baseInfo[n].data.forEach(r => comRow[n].set(r, comLabel(0))); }
  for (let bi = 1; bi < books.length; bi++) {
    const B = books[bi], infos = {}, colMap = {}, rowMap = {}, T = {}, usedT = new Set();
    for (const sh of B.sheets) { try {
      const I = sheetInfo(B, sh); if (I.hr == null || !isDataSheet(sh.name, I)) continue;
      const tn = matchSheet(baseInfo, I, sh.name, usedT);
      if (!tn) { if (I.data.length) report.skipped.push(`${B.label}: الورقة «${sh.name}» لا تشبه أي ورقة في الملف الأساس`); continue; }
      if (tn !== sh.name) { if (!I.data.length) continue; report.renamedSheets.push(`${B.label}: «${sh.name}» ← «${tn}»`); }
      usedT.add(tn); T[sh.name] = tn; infos[sh.name] = I; const BI = baseInfo[tn];
      /* مطابقة الأعمدة بعناوينها (ولو اختلفت كتابتها)؛ العمود غير الموجود في الأساس يُضاف في آخر الورقة */
      const M = matchColumns(BI.head, I.head), cm = M.cm; let maxC = Math.max(...Object.keys(BI.head).map(Number), ...[...BI.rows.values()].flatMap(r => r.cells.map(c => c.c)));
      M.fuzzy.forEach(([a, b]) => { if (RN(a) !== RN(b)) report.matchedCols.push(`«${a}» (${B.label}) ← «${b}»`); });
      for (const c in I.head) if (cm[c] == null) { maxC++; cm[c] = maxC; BI.head[maxC] = I.head[c]; BI.newHeads = BI.newHeads || []; BI.newHeads.push({ c: maxC, text: I.head[c] }); report.addedCols.push(`«${I.head[c]}» في ورقة «${tn}» (من ${B.label})`); }
      colMap[sh.name] = c => (cm[c] != null ? cm[c] : c);
      const rm = new Map(); I.data.forEach(r => { rm.set(r, next[tn]++); }); rowMap[sh.name] = rm; counts[tn].add += I.data.length;
      { const lb = comLabel(bi); I.data.forEach(r => comRow[tn].set(rm.get(r), lb)); }
    } catch (e) { report.skipped.push(`${B.label}: الورقة «${sh.name}» تُركت (${e.message || e})`); delete infos[sh.name]; delete rowMap[sh.name]; } }
    const mapRef = (cur) => { const f = (sheet, x) => { const sn = sheet || cur; const rm = rowMap[sn], cm = colMap[sn]; if (!rm) return { c: x.c, r: x.r }; return { c: cm(x.c), r: rm.has(x.r) ? rm.get(x.r) : x.r }; };
      /* نطاق يغطي بيانات ورقة في ملف القضاء ← نطاق بيانات الورقة نفسها في الأساس (ويُمدّ لاحقاً ليشمل كل الصفوف المضافة) */
      f.range = (sheet, x1, x2) => { const sn = sheet || cur, I = infos[sn], BI = baseInfo[T[sn]], cm = colMap[sn];
        if (!I || !BI || !I.data.length || x1.r === x2.r || !(x1.r <= I.first && x2.r >= I.last)) return [f(sheet, x1), f(sheet, x2)];
        const r1 = x1.r < I.first ? Math.max(1, BI.first - (I.first - x1.r)) : BI.first, r2 = x2.r > I.last ? BI.last + (x2.r - I.last) : BI.last;
        return [{ c: cm(x1.c), r: r1 }, { c: cm(x2.c), r: Math.max(r1, r2) }]; };
      return f; };
    /* أسماء الأوراق المختلفة في معادلات ملف القضاء تُكتب باسم ورقة الأساس المقابلة */
    const ren = Object.entries(T).filter(([a, b]) => a !== b).map(([a, b]) => [new RegExp(`(^|[^A-Za-z0-9_.\u0600-\u06FF])(?:'${a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/'/g, "''")}'|${/^[A-Za-z0-9_.\u0600-\u06FF]+$/.test(a) ? a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '\u0000NOPE'})!`, 'g'), `'${b.replace(/'/g, "''")}'!`]);
    const renF = f => ren.reduce((x, [re, to]) => x.replace(re, (m, pre) => pre + to), f);
    for (const sn in infos) { try {
      const I = infos[sn], rm = rowMap[sn], cm = colMap[sn], tn = T[sn], BI = baseInfo[tn], fx = mapRef(sn);
      const masters = {}; for (const row of I.rows.values()) for (const c of row.cells) if (c.f && c.f.a.t === 'shared' && c.f.t != null) masters[c.f.a.si] = c;
      for (const r of I.data) {
        const row = I.rows.get(r), nr = rm.get(r), ra = {};
        if (row.a.ht) { ra.ht = row.a.ht; if (row.a.customHeight) ra.customHeight = row.a.customHeight; }
        if (row.a.s && sameStyles[bi]) { ra.s = row.a.s; ra.customFormat = row.a.customFormat || '1'; }
        const cells = [], skip = new Set();
        for (const c of row.cells) {
          const nc = cm(c.c), ref = colL(nc) + nr, a = { r: ref };
          const tpl = (BI.rows.get(BI.first) || { cells: [] }).cells.find(x => x.c === nc);
          if (c.a.s != null) { if (sameStyles[bi]) a.s = c.a.s; else { const s2 = SI.imp(B, Bst[bi], c.a.s); if (s2 != null) a.s = s2; else if (tpl && tpl.a.s != null) a.s = tpl.a.s; } }
          let inner = '', t = c.a.t, val = c.v;
          if (!c.f && (t === 's' || t === 'inlineStr' || t === 'str') && DATEF.has(fieldOf(BI.head[nc] || ''))) { const n = textDate(cellText(B, c)); if (n != null) { t = undefined; delete a.t; val = String(n); if (tpl && tpl.a.s != null) a.s = tpl.a.s; skip.add(c.c); dateFixed++; } }
          if (!c.f && (t === 's' || t === 'inlineStr' || t === 'str') && NUMF.has(fieldOf(BI.head[nc] || ''))) { const n = textNum(cellText(B, c)); if (n != null) { t = undefined; delete a.t; val = String(n); skip.add(c.c); numFixed++; } }
          /* النسبة المئوية بكتابتين: في الأساس 45% (0.45) وفي ملف القضاء 45، أو العكس — تُوحَّد على كتابة الأساس */
          if (!c.f && (!t || t === 'n') && val != null && /^-?[\d.]+(e-?\d+)?$/i.test(val) && tpl && pctCols[tn] && pctCols[tn].has(nc)) {
            const bp = tpl.a.s != null && isPctFmt(SI.S, tpl.a.s), cp = c.a.s != null && isPctFmt(sameStyles[bi] ? SI.S : Bst[bi], c.a.s), n = +val;
            const useBase = () => { if (tpl.a.s != null) a.s = tpl.a.s; else delete a.s; pctN++; skip.add(c.c); };
            if (bp && !cp && n > 1.5 && n <= 1000) { val = String(n / 100); useBase(); }
            else if (!bp && cp && Math.abs(n) <= 10 && pctBase[tn] && pctBase[tn].get(nc) > 1.5) { val = String(Math.round(n * 1e6) / 1e4); useBase(); }
          }
          if (c.f) {
            let ftxt = c.f.t;
            if (c.f.a.t === 'shared') { const m = masters[c.f.a.si]; ftxt = m ? (m === c ? m.f.t : shiftRel(m.f.t, c.r - m.r, c.c - m.c)) : null; }
            if (ftxt != null) {
              const fa = {}; if (c.f.a.t === 'array' && c.f.a.ref) { fa.t = 'array'; fa.ref = mapRefs(c.f.a.ref, fx); }
              inner += `<f${attrStr(fa)}>${encT(renF(mapRefs(ftxt, fx)))}</f>`;
            }
          }
          if (t === 's') { if (c.v != null) { const s = B.sst[+c.v]; inner += `<v>${s ? sstAdd(s.xml) : 0}</v>`; } }
          else if (t === 'inlineStr') inner += `<is>${c.is || ''}</is>`;
          else if (val != null) inner += `<v>${enc(val)}</v>`;
          if (t) a.t = t;
          if (!inner && a.s == null) continue;
          cells.push({ c: nc, xml: `<c${attrStr(a)}${inner ? `>${inner}</c>` : '/>'}` });
        }
        cells.sort((x, y) => x.c - y.c); added[tn].set(nr, { a: ra, cells }); checks.push({ B, sn: tn, row, nr, cm, skip, seq: I.seqCol });
      }
      if (pctN) { report.pctFixed.push(`${B.label}: ورقة «${tn}» — ${pctN} خلية نسبة وُحّدت كتابتها مع الأساس`); pctN = 0; }
      /* الخلايا المدموجة داخل صفوف البيانات */
      (I.xml.match(/<mergeCell\b[^>]*ref="([A-Z]+\d+:[A-Z]+\d+)"/g) || []).forEach(m => { const rg = /ref="([^"]+)"/.exec(m)[1], p = rg.split(':').map(splitRef); if (rm.has(p[0].r) && rm.has(p[1].r)) newMerges[tn].push(`${colL(cm(p[0].c))}${rm.get(p[0].r)}:${colL(cm(p[1].c))}${rm.get(p[1].r)}`); });
    } catch (e) { report.skipped.push(`${B.label}: ورقة «${sn}» تُركت (${e.message || e})`); } }
  }
  /* تكرار رقم الاضبارة بين الملفات (المشروع نفسه في موقفين) */
  report.dups = []; { const seen = new Map();
    books.forEach((B, bi) => B.sheets.forEach(sh => { const I = bi === 0 ? baseInfo[sh.name] : sheetInfo(B, sh); if (!I || I.hr == null) return; const cf = Object.keys(I.head).find(c => /رقم الاضبار|^الاضبار/.test(RN(I.head[c]))); if (cf == null) return;
      I.data.forEach(r => { const v = toEn(cellText(B, I.rows.get(r).cells.find(x => x.c === +cf))).trim(); if (!v) return; const k = sh.name + '|' + v; if (seen.has(k) && seen.get(k) !== B.label) report.dups.push(`الاضبارة ${v} في «${seen.get(k)}» و«${B.label}»`); else if (!seen.has(k)) seen.set(k, B.label); }); })); }
  for (const n in baseInfo) { const I = baseInfo[n]; ext[n] = { first: I.first, oldLast: I.last, newLast: next[n] - 1 }; report.sheets.push({ name: n, base: counts[n].base, added: counts[n].add, total: counts[n].base + counts[n].add, firstRow: I.first, lastRow: next[n] - 1 }); }
  /* كتابة الأوراق */
  const out = new Map(base.z);
  for (const sh of base.sheets) {
    let xml = out.has(sh.path) ? out.get(sh.path).toString('utf8') : ''; if (!xml) continue;
    const I = baseInfo[sh.name], A = I ? added[sh.name] : null;
    if (I && (A.size || I.newHeads)) {
      /* إعادة بناء sheetData: صفوف الأساس كما هي (عدا صفوف القالب الفارغة التي حلّت محلها الصفوف المضافة) */
      const sd = /<sheetData\b[^>]*?(?:\/>|>([\s\S]*?)<\/sheetData>)/.exec(xml), rowsXml = new Map();
      if (sd && sd[1]) sd[1].replace(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g, (m, ra) => { rowsXml.set(+attrs(ra).r, m); });
      for (const [r, row] of A) rowsXml.set(r, `<row${attrStr(Object.assign({ r: String(r) }, row.a))}>${row.cells.map(c => c.xml).join('')}</row>`);
      /* عمود «اللجنة (ملف الموقف)» في جدول المشاريع (إن لم يكن موجوداً) — يُملأ لكل مشروع باسم ملفه */
      const fs0 = new Set(Object.values(I.head).map(fieldOf));
      if (fs0.has('fileNo') && fs0.has('name') && !fs0.has('committee')) {
        const cc = Math.max(...Object.keys(I.head).map(Number), ...[...A.values()].flatMap(r => r.cells.map(c => c.c)), ...[...I.rows.values()].flatMap(r => r.cells.map(c => c.c))) + 1, L = colL(cc);
        I.head[cc] = 'اللجنة (ملف الموقف)'; (I.newHeads = I.newHeads || []).push({ c: cc, text: 'اللجنة (ملف الموقف)' });
        for (const [r, lb] of comRow[sh.name]) { const rx = rowsXml.get(r); if (!rx) continue; const cell = `<c r="${L}${r}" t="inlineStr"><is><t>${enc(lb)}</t></is></c>`;
          rowsXml.set(r, /\/>$/.test(rx) && !/<\/row>$/.test(rx) ? rx.replace(/\/>$/, `>${cell}</row>`) : rx.replace(/<\/row>$/, cell + '</row>')); }
        report.committees = [...new Set(comRow[sh.name].values())].map(n => `${n} (${[...comRow[sh.name].values()].filter(x => x === n).length})`);
      }
      if (I.newHeads) {   // عناوين الأعمدة الجديدة في صف العناوين
        const hr = I.hr, hm = rowsXml.get(hr) || `<row r="${hr}"></row>`, hs = (I.rows.get(hr).cells.slice(-1)[0] || {}).a || {};
        const add = I.newHeads.map(h => `<c r="${colL(h.c)}${hr}"${hs.s != null ? ` s="${hs.s}"` : ''} t="s"><v>${sstAdd(`<t>${enc(h.text)}</t>`)}</v></c>`).join('');
        rowsXml.set(hr, hm.replace(/\sspans="[^"]*"/, '').replace(/<\/row>$|\/>$/, m => (m === '/>' ? `>${add}</row>` : `${add}</row>`)));
      }
      /* أرقام مكتوبة نصاً في أعمدة الكلف والسلف والمدد لمشاريع الملف الأساس */
      for (const r of I.data) { const row = I.rows.get(r); let rx = rowsXml.get(r); if (!row || !rx) continue;
        for (const c of row.cells) { const fd = fieldOf(I.head[c.c] || ''); if (c.f || !(c.a.t === 's' || c.a.t === 'inlineStr' || c.a.t === 'str') || !(NUMF.has(fd) || DATEF.has(fd))) continue; const n = DATEF.has(fd) ? textDate(cellText(base, c)) : textNum(cellText(base, c)); if (n == null) continue; if (DATEF.has(fd)) dateFixed++; else numFixed--;
          const ref = colL(c.c) + r, re = new RegExp(`<c r="${ref}"(?:[^>]*?/>|[^>]*>[\\s\\S]*?</c>)`); rx = rx.replace(re, `<c r="${ref}"${c.a.s != null ? ` s="${c.a.s}"` : ''}><v>${n}</v></c>`); numFixed++; }
        rowsXml.set(r, rx); }
      /* «ت»: تسلسل واحد لكل المشاريع من 1 إلى آخر مشروع (مشاريع الأساس ثم مشاريع الملفات المدموجة) */
      if (I.seqCol) {
        const L = colL(I.seqCol), tplSeq = (I.rows.get(I.first) || { cells: [] }).cells.find(x => x.c === I.seqCol), st = tplSeq && tplSeq.a.s != null ? ` s="${tplSeq.a.s}"` : '';
        const all = [...new Set([...I.data, ...A.keys()])].sort((a, b) => a - b); let n = 0;
        for (const r of all) { n++; let rx = rowsXml.get(r); if (!rx) continue; const cell = `<c r="${L}${r}"${st}><v>${n}</v></c>`;
          const re = new RegExp(`<c r="${L}${r}"(?:[^>]*?/>|[^>]*>[\\s\\S]*?</c>)`);
          if (re.test(rx)) { rx = rx.replace(re, m => { const a = attrs(/^<c\b([^>]*?)\/?>/.exec(m)[1]); return `<c r="${L}${r}"${a.s != null ? ` s="${a.s}"` : st}><v>${n}</v></c>`; }); }
          else { let done = false; rx = rx.replace(/<c r="([A-Z]+)\d+"/g, (m, cl) => { if (!done && colN(cl) > I.seqCol) { done = true; return cell + m; } return m; }); if (!done) rx = rx.replace(/<\/row>$/, cell + '</row>').replace(/\/>$/, `>${cell}</row>`); }
          rowsXml.set(r, rx); }
        report.seq = (report.seq || 0) + n; }
      const body = [...rowsXml.keys()].sort((a, b) => a - b).map(r => rowsXml.get(r).replace(/\sspans="[^"]*"/, '')).join('');
      xml = sd ? xml.replace(sd[0], `<sheetData>${body}</sheetData>`) : xml;
      if (newMerges[sh.name].length) {
        const mc = newMerges[sh.name].map(r => `<mergeCell ref="${r}"/>`).join('');
        if (/<mergeCells\b/.test(xml)) xml = xml.replace(/<mergeCells\b[^>]*>/, m => m.replace(/count="\d+"/, '')).replace('</mergeCells>', mc + '</mergeCells>');
        else { /* ترتيب عناصر الورقة في Excel: mergeCells بعد autoFilter وقبل التنسيق الشرطي والتحقق وإعداد الطباعة… */
          const after = /<(?:phoneticPr|conditionalFormatting|dataValidations|hyperlinks|printOptions|pageMargins|pageSetup|headerFooter|rowBreaks|colBreaks|customProperties|cellWatches|ignoredErrors|smartTags|drawing|legacyDrawing|legacyDrawingHF|picture|oleObjects|controls|webPublishItems|tableParts|extLst)\b/.exec(xml);
          xml = after ? xml.slice(0, after.index) + `<mergeCells>${mc}</mergeCells>` + xml.slice(after.index) : xml.replace('</worksheet>', `<mergeCells>${mc}</mergeCells></worksheet>`); }
      }
      const maxRow = Math.max(...rowsXml.keys()), maxCol = Math.max(...Object.keys(I.head).map(Number), ...[...A.values()].flatMap(r => r.cells.map(c => c.c)), 1);
      xml = xml.replace(/<dimension ref="[^"]*"\/>/, `<dimension ref="A1:${colL(maxCol)}${maxRow}"/>`);
    }
    /* مدّ النطاقات في معادلات كل الأوراق وفي التنسيق الشرطي والتحقق والتصفية */
    xml = mapFormulas(xml, d0 => { const d1 = extendFormula(d0, sh.name, ext); if (d1 !== d0) report.extended++; return d1; });
    if (I && ext[sh.name].newLast > ext[sh.name].oldLast) {
      xml = xml.replace(/(<(?:conditionalFormatting|dataValidation|selection)\b[^>]*\bsqref=")([^"]+)"/g, (m, p, sq) => `${p}${extendSqref(sq, ext[sh.name])}"`);
      xml = xml.replace(/(<autoFilter\b[^>]*\bref=")([^"]+)"/g, (m, p, sq) => `${p}${extendSqref(sq, ext[sh.name])}"`);
    }
    /* النتائج المخزنة للمعادلات تُحذف لتُحسب من جديد عند الفتح (المجاميع واللوحات تشمل الصفوف المضافة) */
    /* (نتائج صفوف البيانات تبقى صحيحة لأنها تخص صفوفها، فتُحفظ ليقرأها البرنامج وأي قارئ) */
    xml = xml.replace(/<c\b([^>]*?)>((?:(?!<\/c>)[\s\S])*?<f\b(?:(?!<\/c>)[\s\S])*?)<\/c>/g, (m, a, inner) => {
      if (I) { const rr = splitRef(attrs(a).r || ''); if (rr && rr.r > I.hr && rr.r <= ext[sh.name].newLast && !/<f\b[^>]*>[^<]*![^<]*:/.test(inner) && !/<f\b[^>]*>[^<]*\b[A-Z]{1,3}\d+:[A-Z]{1,3}\d+/.test(inner)) return m; }
      const nin = inner.replace(/<v(?:\s[^>]*)?>[\s\S]*?<\/v>/, ''); if (nin === inner) return m; return `<c${a.replace(/\s+t="(?:str|n|b|e)"/, '')}>${nin}</c>`; });
    out.set(sh.path, Buffer.from(xml, 'utf8'));
    /* جداول Excel المرتبطة بالورقة */
    const relP = sh.path.replace(/([^/]+)$/, '_rels/$1.rels'); const rels = out.has(relP) ? out.get(relP).toString('utf8') : '';
    if (I && rels) rels.replace(/<Relationship\b([^>]*)\/?>/g, (_, a) => { const o = attrs(a); if (!/\/table$/.test(o.Type || '')) return; const tp = 'xl/' + o.Target.replace(/^\.\.\//, '').replace(/^\/xl\//, ''); if (!out.has(tp)) return;
      let tx = out.get(tp).toString('utf8'); tx = tx.replace(/(<(?:table|autoFilter)\b[^>]*\bref=")([^"]+)"/g, (m, p, sq) => `${p}${extendSqref(sq, ext[sh.name])}"`); out.set(tp, Buffer.from(tx, 'utf8')); });
  }
  /* الأسماء المعرّفة (نطاقات الطباعة والأسماء) */
  let wb = out.get('xl/workbook.xml').toString('utf8');
  wb = wb.replace(/(<definedName\b[^>]*>)([\s\S]*?)(<\/definedName>)/g, (m, a, f, b) => { const d0 = dec(f), d1 = extendFormula(d0, null, ext); return d1 === d0 ? m : a + encT(d1) + b; });
  /* إعادة الحساب عند الفتح، وإزالة calcChain (تتغير بعد إضافة المعادلات) */
  if (/<calcPr\b/.test(wb)) wb = wb.replace(/<calcPr\b([^>]*?)\/?>/, (m, a) => `<calcPr${a.replace(/\s*fullCalcOnLoad="[^"]*"/, '')} fullCalcOnLoad="1"/>`);
  else wb = wb.replace('</workbook>', '<calcPr fullCalcOnLoad="1"/></workbook>');
  out.set('xl/workbook.xml', Buffer.from(wb, 'utf8'));
  if (out.has('xl/calcChain.xml')) {
    out.delete('xl/calcChain.xml');
    out.set('xl/_rels/workbook.xml.rels', Buffer.from(out.get('xl/_rels/workbook.xml.rels').toString('utf8').replace(/<Relationship\b[^>]*Target="[^"]*calcChain\.xml"[^>]*\/>/, ''), 'utf8'));
    out.set('[Content_Types].xml', Buffer.from(out.get('[Content_Types].xml').toString('utf8').replace(/<Override\b[^>]*PartName="\/xl\/calcChain\.xml"[^>]*\/>/, ''), 'utf8'));
  }
  /* التنسيقات المنقولة من ملفات الأقضية */
  if (out.has('xl/styles.xml')) out.set('xl/styles.xml', Buffer.from(SI.write(out.get('xl/styles.xml').toString('utf8')), 'utf8'));
  /* السلاسل المشتركة */
  const sstXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${base.sst.length}" uniqueCount="${base.sst.length}">${base.sst.map(s => `<si>${s.xml}</si>`).join('')}</sst>`;
  if (!out.has('xl/sharedStrings.xml')) {
    out.set('xl/_rels/workbook.xml.rels', Buffer.from(out.get('xl/_rels/workbook.xml.rels').toString('utf8').replace('</Relationships>', '<Relationship Id="rIdSST9" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>'), 'utf8'));
    out.set('[Content_Types].xml', Buffer.from(out.get('[Content_Types].xml').toString('utf8').replace('</Types>', '<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/></Types>'), 'utf8'));
  }
  out.set('xl/sharedStrings.xml', Buffer.from(sstXml, 'utf8'));
  report.numFixed = numFixed; report.dateFixed = dateFixed; report.costIssues = costAudit(books);
  dmyDates(out);   /* التواريخ يوم/شهر/سنة */
  const buf = zip(out); report.verify = verifyMerge(buf, checks);
  return { buf, report };
}
/* تدقيق الكلف في ملفات الأقضية: الكلفة الكلية ≠ الأصلية (التعاقدية) + أوامر التغيير، أو الكلفة مكتوبة نصاً، أو فارغة */
function costAudit(books) {
  const out = [];
  for (const B of books) for (const sh of B.sheets) { let I; try { I = sheetInfo(B, sh); } catch (_) { continue; } if (I.hr == null || !isDataSheet(sh.name, I)) continue;
    const col = {}; for (const c in I.head) { const f = fieldOf(I.head[c]); if (f && col[f] == null) col[f] = +c; } if (col.orig == null || col.name == null) continue;
    for (const r of I.data) { const row = I.rows.get(r), cell = c => row.cells.find(x => x.c === c), tx = c => (c == null ? '' : cellText(B, cell(c)));
      const nm = tx(col.name).trim(); if (!nm) continue; const n = c => { const t = tx(c); if (t === '') return null; const v = textNum(t); return v == null ? null : v; };
      const K = n(col.orig), L = col.changeCost != null ? n(col.changeCost) : null, M = col.total != null ? n(col.total) : null, kc = cell(col.orig);
      const where = `${B.label} — صف ${r} — ${nm.slice(0, 45)}`;
      if (K == null) out.push(`${where}: الكلفة الأصلية (التعاقدية) فارغة`);
      else if (kc && (kc.a.t === 's' || kc.a.t === 'inlineStr')) out.push(`${where}: الكلفة مكتوبة نصاً «${tx(col.orig)}» (حُوّلت إلى رقم ${K.toLocaleString('en-US')})`);
      for (const f of ['start', 'planEnd']) if (col[f] != null) { const c = cell(col[f]); if (c && !c.f && (c.a.t === 's' || c.a.t === 'inlineStr') && textDate(tx(col[f])) != null) out.push(`${where}: التاريخ مكتوب نصاً «${tx(col[f])}» (حُوّل إلى تاريخ)`); }
      for (const c of row.cells) { if (!c.f || c.f.t == null || c.f.a.t === 'shared') continue; const rows = new Set(); mapRefs(c.f.t, (sh, x) => { if (!sh && !x.ra) rows.add(x.r); return x; });
        if (rows.size > 1 || (rows.size === 1 && !rows.has(r))) { out.push(`${where}: معادلة عمود «${I.head[c.c] || colL(c.c)}» تشير إلى صف آخر (${[...rows].join('، ')}) — ${c.f.t.slice(0, 60)}`); break; } }
      if (K != null && M != null && Math.abs(M - (K + (L || 0))) > 1) out.push(`${where}: الكلية ${M.toLocaleString('en-US')} ≠ الأصلية ${K.toLocaleString('en-US')} + أوامر التغيير ${(L || 0).toLocaleString('en-US')} (الفرق ${(M - K - (L || 0)).toLocaleString('en-US')})`); } }
  return out;
}
/* تحقق بعد الدمج: كل خلية مُدخلة (لا معادلة) في صفوف ملفات الأقضية تُقارن بنظيرتها في الملف المدموج */
function verifyMerge(buf, checks) {
  const M = readBook(buf, 'merged'), cache = {}, res = { cells: 0, rows: checks.length, bad: 0, samples: [] };
  const grid = sn => { if (cache[sn]) return cache[sn]; const sh = M.sheets.find(x => x.name === sn); const rows = sh ? parseSheet(M.z.get(sh.path).toString('utf8')) : new Map(); return (cache[sn] = rows); };
  const norm = v => { const t = String(v == null ? '' : v).trim(); return /^-?[\d.]+(e-?\d+)?$/i.test(t) ? String(+t) : t.replace(/\s+/g, ' '); };
  for (const k of checks) { const G = grid(k.sn), mr = G.get(k.nr);
    for (const c of k.row.cells) { if (c.f || k.skip.has(c.c) || (k.seq && c.c === k.seq)) continue; const a = norm(cellText(k.B, c)); if (a === '') continue; res.cells++;
      const mc = mr && mr.cells.find(x => x.c === k.cm(c.c)), b = norm(cellText(M, mc));
      if (a !== b) { res.bad++; if (res.samples.length < 10) res.samples.push(`${k.B.label} — «${k.sn}» صف ${k.row.a.r || ''} عمود ${colL(c.c)}: «${a.slice(0, 40)}» ← «${b.slice(0, 40)}»`); } } }
  return res;
}

/* ---------- كشف المهندسين ---------- */
function rowsOf(book, sh) { const I = sheetInfo(book, sh); return I; }
const pick = (head, re) => { for (const c in head) if (re.test(RN(head[c]))) return +c; return null; };
function parsePerson(v) {
  let t = String(v == null ? '' : v).replace(/\s+/g, ' ').trim(); if (!t || /^مطابق$/.test(RN(t)) || /^[-–—.]+$/.test(t)) return null; let dept = '';
  const m = t.match(/^(مشرف|المشرف|المقيم|مقيم)\s*[:：]\s*(.+)$/); if (m) t = m[2];
  const q = t.split(/\s*[–—]\s*|\s+-\s+/); if (q.length > 1) { t = q[0].trim(); dept = q.slice(1).join(' – ').trim(); }
  t = t.replace(/^(المهندس|م\.|المهندسة|السيد)\s+/, '').trim(); return t ? { name: t, dept } : null;
}
const phoneFix = v => { const s = toEn(v == null ? '' : v).replace(/[^\d]/g, ''); return /^7\d{9}$/.test(s) ? '0' + s : s; };
function engineers(files) {
  const books = files.map(f => { try { return readBook(f.buf, f.name); } catch (_) { return null; } }).filter(Boolean), E = new Map(), P = [];
  const eng = (name, x) => { const k = RN(name); if (!k) return null; if (!E.has(k)) E.set(k, { name, depts: new Set(), phones: new Set(), roles: new Set(), res: new Map(), sup: new Map(), done: new Map(), districts: new Set() }); const e = E.get(k); if (x.dept) e.depts.add(x.dept); if (x.phone) e.phones.add(x.phone); if (x.role) e.roles.add(x.role); return e; };
  for (const B of books) {
    const projByName = new Map(); let fileDistrict = '';
    const infos = B.sheets.map(sh => ({ sh, I: rowsOf(B, sh) })).filter(x => x.I.hr != null);
    /* الورقة الرئيسة */
    for (const { I } of infos) {
      const cn = pick(I.head, /^اسم المشروع|^المشروع$/), cf = pick(I.head, /رقم الاضبار|^الاضبار/); if (cn == null || cf == null) continue;
      const cr = pick(I.head, /^المهندس المقيم/), cro = pick(I.head, /دائره المهندس المقيم|^دائره المقيم/), cph = pick(I.head, /رقم الهاتف|^الهاتف/), cd = pick(I.head, /^القضاء$/), cst = pick(I.head, /تصنيف حاله|^حاله المشروع|^الحاله$/);
      const sups = Object.keys(I.head).filter(c => /^المهندس المشرف|^مشرف/.test(RN(I.head[c]))).map(Number);
      const g = (row, c) => (c == null ? '' : cellText(B, row.cells.find(x => x.c === c)).replace(/\s+/g, ' ').trim());
      const dist = {}; for (const r of I.data) { const row = I.rows.get(r), nm = g(row, cn); if (!nm) continue; const d = g(row, cd); if (d) dist[d] = (dist[d] || 0) + 1;
        const p = { file: B.label, district: d, fileNo: toEn(g(row, cf)), name: nm, status: g(row, cst), staff: [] }; projByName.set(RN(nm), p); P.push(p);
        const rp = parsePerson(g(row, cr)); if (rp) p.staff.push({ name: rp.name, dept: g(row, cro) || rp.dept, role: 'مهندس مقيم', phone: phoneFix(g(row, cph)) });
        for (const c of sups) { const sp = parsePerson(g(row, c)); if (sp) p.staff.push({ name: sp.name, dept: sp.dept, role: 'مهندس مشرف' }); } }
      fileDistrict = Object.entries(dist).sort((a, b) => b[1] - a[1]).map(x => x[0])[0] || fileDistrict;
    }
    /* ورقة الكادر الهندسي: المقيم والمشرفون لكل مشروع */
    for (const { I } of infos) {
      const cn = pick(I.head, /^اسم المشروع/), cres = pick(I.head, /^المهندس المقيم/); const sups = Object.keys(I.head).filter(c => /^مشرف \d+$/.test(RN(I.head[c]))).map(Number);
      if (cn == null || cres == null || !sups.length) continue;
      const cdep = c => { const n = RN(I.head[c]).match(/\d+/); return pick(I.head, new RegExp(`^دائره المشرف ${n ? n[0] : ''}$`)); }, crd = pick(I.head, /^دائره المقيم/);
      const g = (row, c) => (c == null ? '' : cellText(B, row.cells.find(x => x.c === c)).replace(/\s+/g, ' ').trim());
      for (const r of I.data) { const row = I.rows.get(r), nm = g(row, cn); if (!nm) continue; let p = projByName.get(RN(nm)); if (!p) { p = { file: B.label, district: fileDistrict, fileNo: '', name: nm, staff: [] }; projByName.set(RN(nm), p); P.push(p); }
        const rp = parsePerson(g(row, cres)); if (rp && !p.staff.some(s => s.role === 'مهندس مقيم' && RN(s.name) === RN(rp.name))) p.staff.push({ name: rp.name, dept: g(row, crd) || rp.dept, role: 'مهندس مقيم' });
        for (const c of sups) { const sp = parsePerson(g(row, c)); if (sp && !p.staff.some(s => RN(s.name) === RN(sp.name) && s.role === 'مهندس مشرف')) p.staff.push({ name: sp.name, dept: g(row, cdep(c)) || sp.dept, role: 'مهندس مشرف' }); } }
    }
    /* قائمة المشرفين: الصفة والدائرة والهاتف */
    for (const { I } of infos) {
      const cn = pick(I.head, /^الاسم الكامل|^الاسم$/), crole = pick(I.head, /^الصفه$/), cd = pick(I.head, /الدائره/), cph = pick(I.head, /رقم الهاتف|^الهاتف/); if (cn == null || crole == null) continue;
      const g = (row, c) => (c == null ? '' : cellText(B, row.cells.find(x => x.c === c)).replace(/\s+/g, ' ').trim());
      for (const r of I.data) { const row = I.rows.get(r), pp = parsePerson(g(row, cn)); if (!pp) continue; let dept = g(row, cd), ph = phoneFix(g(row, cph)); if (/^\d{9,}$/.test(toEn(dept).replace(/\D/g, '')) && !ph) { ph = phoneFix(dept); dept = ''; }
        eng(pp.name, { dept: dept || pp.dept, phone: ph, role: g(row, crole) }); }
    }
    for (const p of P) if (p.file === B.label && !p.district) p.district = fileDistrict;
  }
  /* المشروع المنجز لا يُحسب ضمن عدد مشاريع المقيم أو المشرف */
  const isDone = p => /منجز/.test(RN(p.status || '')) && !/غير منجز/.test(RN(p.status || ''));
  for (const p of P) for (const s of p.staff) { const e = eng(s.name, s); if (!e) continue; const key = p.file + '|' + RN(p.name); (isDone(p) ? e.done : s.role === 'مهندس مقيم' ? e.res : e.sup).set(key, p); if (p.district) e.districts.add(p.district); }
  const list = [...E.values()].map(e => { const all = new Map([...e.res, ...e.sup]); for (const k of all.keys()) e.done.delete(k); const lr = [...e.roles].map(x => (/مقيم/.test(x) ? 'مهندس مقيم' : /مشرف/.test(x) ? 'مهندس مشرف' : x)).filter((x, i, A) => x && A.indexOf(x) === i);
    return { name: e.name, nDone: e.done.size, done: [...e.done.values()].map(p => p.name), role: e.res.size && e.sup.size ? 'مهندس مقيم ومشرف' : e.res.size ? 'مهندس مقيم' : e.sup.size ? 'مهندس مشرف' : lr.join(' / '), dept: [...e.depts].join(' / '), phone: [...e.phones].join(' / '), nRes: e.res.size, nSup: e.sup.size, nAll: all.size, districts: [...e.districts].join('، '), projects: [...all.values()].map(p => p.name) }; })
    .sort((a, b) => b.nAll - a.nAll || a.name.localeCompare(b.name, 'ar'));
  return { list, projects: P };
}
/* مصنف xlsx بسيط منسَّق (من اليمين لليسار) */
function writeBook(sheets) {   // [{name, cols:[{h,w}], rows:[[...]], hl:(row)=>bool}]
  const sst = [], si = new Map(), S = v => { v = String(v); if (!si.has(v)) { si.set(v, sst.length); sst.push(v); } return si.get(v); };
  const sheetXml = sh => {
    const rows = [[...sh.cols.map(c => c.h)], ...sh.rows].map((r, i) => `<row r="${i + 1}"${i === 0 ? ' ht="30" customHeight="1"' : ''}>${r.map((v, j) => { const ref = colL(j + 1) + (i + 1), st = i === 0 ? 1 : sh.hl && sh.hl(sh.rows[i - 1]) ? 3 : 2;
      return v === '' || v == null ? `<c r="${ref}" s="${st}"/>` : typeof v === 'number' ? `<c r="${ref}" s="${st}"><v>${v}</v></c>` : `<c r="${ref}" s="${st}" t="s"><v>${S(v)}</v></c>`; }).join('')}</row>`).join('');
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetViews><sheetView rightToLeft="1" workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${sh.cols.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.w}" customWidth="1"/>`).join('')}</cols><sheetData>${rows}</sheetData><autoFilter ref="A1:${colL(sh.cols.length)}${sh.rows.length + 1}"/></worksheet>`;
  };
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="12"/><name val="Arial"/></font><font><b/><sz val="12"/><color rgb="FFFFFFFF"/><name val="Arial"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1F6B3A"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFF2CC"/></patternFill></fill></fills><borders count="2"><border/><border><left style="thin"><color rgb="FF999999"/></left><right style="thin"><color rgb="FF999999"/></right><top style="thin"><color rgb="FF999999"/></top><bottom style="thin"><color rgb="FF999999"/></bottom></border></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="4"><xf/><xf fontId="1" fillId="2" borderId="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf borderId="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf fillId="3" borderId="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  const E = new Map();
  E.set('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/></Types>`);
  E.set('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
  E.set('xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets>${sheets.map((s, i) => `<sheet name="${enc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets><definedNames>${sheets.map((s, i) => `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">'${s.name.replace(/'/g, "''")}'!$A$1:$${colL(s.cols.length)}$${s.rows.length + 1}</definedName>`).join('')}</definedNames></workbook>`);
  E.set('xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rIdS" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rIdT" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>`);
  sheets.forEach((s, i) => E.set(`xl/worksheets/sheet${i + 1}.xml`, sheetXml(s)));
  E.set('xl/styles.xml', styles);
  E.set('xl/sharedStrings.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${sst.length}" uniqueCount="${sst.length}">${sst.map(v => `<si><t xml:space="preserve">${enc(v)}</t></si>`).join('')}</sst>`);
  return zip(E);
}
function engineersBook(files) {
  const { list, projects } = engineers(files);
  const many = list.filter(e => e.nAll > 1);
  const engRows = L => L.map((e, i) => [i + 1, e.name, e.role, e.dept, e.phone, e.nRes, e.nSup, e.nAll, e.districts, e.projects.join(' | '), e.nDone, e.done.join(' | ')]);
  const cols = [{ h: 'ت', w: 6 }, { h: 'اسم المهندس', w: 28 }, { h: 'الصفة', w: 18 }, { h: 'الدائرة', w: 24 }, { h: 'رقم الهاتف', w: 15 }, { h: 'عدد المشاريع (مقيم)', w: 12 }, { h: 'عدد المشاريع (مشرف)', w: 12 }, { h: 'مجموع المشاريع (غير المنجزة)', w: 14 }, { h: 'الأقضية', w: 20 }, { h: 'المشاريع', w: 90 }, { h: 'المنجزة (لا تُحسب)', w: 12 }, { h: 'المشاريع المنجزة', w: 60 }];
  const det = []; projects.forEach(p => p.staff.forEach(s => det.push([0, p.district || '', p.fileNo || '', p.name, p.status || '', s.name, s.role, s.dept || '']))); det.forEach((r, i) => { r[0] = i + 1; });
  const buf = writeBook([
    { name: 'المهندسون', cols, rows: engRows(list), hl: r => r[7] > 1 },
    { name: 'المتكررون', cols, rows: engRows(many), hl: () => true },
    { name: 'المشاريع والمهندسون', cols: [{ h: 'ت', w: 6 }, { h: 'القضاء', w: 14 }, { h: 'رقم الاضبارة', w: 12 }, { h: 'اسم المشروع', w: 70 }, { h: 'حالة المشروع', w: 14 }, { h: 'المهندس', w: 28 }, { h: 'الصفة', w: 16 }, { h: 'الدائرة', w: 24 }], rows: det }]);
  return { buf, stats: { engineers: list.length, repeated: many.length, projects: projects.length, done: projects.filter(p => /منجز/.test(RN(p.status || '')) && !/غير منجز/.test(RN(p.status || ''))).length, top: many.slice(0, 5).map(e => `${e.name} (${e.nAll})`) } };
}
/* كل تنسيق تاريخ كامل في المصنف يصبح يوم/شهر/سنة (dd/mm/yyyy): الصيغ المخصصة التي فيها يوم وشهر وسنة (مثل yyyy/mm/dd و[$-1010000]yyyy/mm/dd)،
   والتنسيق المدمج 14 (يظهر شهر/يوم/سنة في Excel الإنكليزي). صيغ السنة وحدها أو الشهر والسنة أو الوقت تبقى كما هي. */
function dmyDates(z) {
  if (!z.has('xl/styles.xml')) return 0;
  let st = z.get('xl/styles.xml').toString('utf8'), n = 0;
  const isFullDate = code => { const c = String(code).replace(/&quot;[^&]*&quot;/g, '').replace(/"[^"]*"/g, '').replace(/\[[^\]]*\]/g, '').replace(/\\./g, '').toLowerCase();
    return /y/.test(c) && /d/.test(c) && /m/.test(c) && !/[hs]/.test(c) && !/^dd\/mm\/yyyy(;@)?$/.test(c); };
  st = st.replace(/<numFmt\b([^>]*?)formatCode="([^"]*)"([^>]*)\/>/g, (m, a, code, b) => isFullDate(code.replace(/&quot;/g, '"')) ? (n++, `<numFmt${a}formatCode="dd/mm/yyyy"${b}/>`) : m);
  if (/<xf\b[^>]*numFmtId="14"/.test(st)) {
    const ids = []; st.replace(/numFmtId="(\d+)"/g, (m, i) => { ids.push(+i); return m; }); const id = Math.max(163, ...ids) + 1, nf = `<numFmt numFmtId="${id}" formatCode="dd/mm/yyyy"/>`;
    st = /<numFmts\b[^>]*>/.test(st) ? st.replace(/<numFmts\b([^>]*)>([\s\S]*?)<\/numFmts>/, (m, at, inner) => `<numFmts${at.replace(/\scount="\d+"/, '')} count="${(inner.match(/<numFmt\b/g) || []).length + 1}">${inner}${nf}</numFmts>`)
      : st.replace(/(<styleSheet\b[^>]*>)/, (m, a1) => `${a1}<numFmts count="1">${nf}</numFmts>`);
    st = st.replace(/(<cellXfs\b[^>]*>)([\s\S]*?)(<\/cellXfs>)/, (m, a1, inner, b1) => a1 + inner.replace(/(<xf\b[^>]*?)numFmtId="14"/g, (q, pre) => (n++, `${pre}numFmtId="${id}"`)) + b1);
  }
  z.set('xl/styles.xml', Buffer.from(st, 'utf8')); return n;
}
module.exports = { dmyDates, mapFormulas, repairXml, merge, engineersBook, engineers, readBook, sheetInfo, cellText, unzip, zip, mapRefs, shiftRel, RN };
