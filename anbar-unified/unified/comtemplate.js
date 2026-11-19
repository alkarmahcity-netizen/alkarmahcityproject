'use strict';
/* تصدير الموقف «بنموذج اللجان» على ملف النموذج نفسه (xlsm بماكروه ولوحته ومخططاته وجدوله ومعادلاته):
   - تُكتب مشاريع الموقف في صفوف جدول «مشاريع القضاء» المهيّأة بنفس تنسيقها، والأعمدة المحسوبة تبقى معادلات النموذج
     (الرقم التسلسلي، الكلفة الكلية، المدة الكلية، تاريخ الإنجاز المخطط، الانحراف، الإجراءات القانونية…) مع قيمها المحسوبة مخزّنة.
   - «نسبة الإنجاز المخطط»: القيمة من الموقف إن وُجدت، وإلا معادلة النموذج (تُحسب من تاريخ المباشرة والمدة).
   - «الكادر الهندسي»: المقيم ودائرته من الجدول الرئيسي بمعادلات النموذج، والمشرفون ودوائرهم في أعمدتهم؛ و«قائمة المشرفين».
   - إن زادت المشاريع على صفوف النموذج تُضاف صفوف بنفس التنسيق والمعادلات، وتُمدّ نطاقات الجدول واللوحة والتنسيق الشرطي.
   - التواريخ يوم/شهر/سنة. الملف يُعاد حسابه عند الفتح. */
const { unzip, zip, RN } = require('./xlmerge');
const enc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const dec = s => String(s).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
const colL = n => { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
const colN = L => { let n = 0; for (const ch of L) n = n * 26 + ch.charCodeAt(0) - 64; return n; };
const attrsOf = s => { const o = {}; String(s || '').replace(/([\w:]+)="([^"]*)"/g, (_, k, v) => { o[k] = v; }); return o; };
const attrStr = o => Object.entries(o).map(([k, v]) => ` ${k}="${v}"`).join('');

/* ---------- قراءة المصنف ---------- */
function book(z) {
  const wb = z.get('xl/workbook.xml').toString('utf8'), rels = z.get('xl/_rels/workbook.xml.rels').toString('utf8');
  const tgt = {}; rels.replace(/<Relationship\b[^>]*?Id="([^"]+)"[^>]*?Target="([^"]+)"[^>]*>/g, (m, id, t) => { tgt[id] = t; return m; });
  rels.replace(/<Relationship\b[^>]*?Target="([^"]+)"[^>]*?Id="([^"]+)"[^>]*>/g, (m, t, id) => { tgt[id] = tgt[id] || t; return m; });
  const sheets = []; wb.replace(/<sheet\b([^>]*)\/>/g, (m, a) => { const o = attrsOf(a); const t = tgt[o['r:id']] || ''; sheets.push({ name: dec(o.name), path: 'xl/' + t.replace(/^\/?xl\//, ''), hidden: !!o.state }); return m; });
  const ss = []; if (z.has('xl/sharedStrings.xml')) z.get('xl/sharedStrings.xml').toString('utf8').replace(/<si>([\s\S]*?)<\/si>/g, (m, inner) => { ss.push(dec((inner.match(/<t[^>]*>([\s\S]*?)<\/t>/g) || []).map(x => x.replace(/<[^>]+>/g, '')).join(''))); return m; });
  return { sheets, ss };
}
/* صفوف الورقة: خريطة الصف ← {a: سمات، cells: خريطة العمود ← {a, inner}} مع موضعها في النص */
function rowsOf(xml) {
  const sd = /<sheetData\b[^>]*>([\s\S]*?)<\/sheetData>|<sheetData\b[^>]*\/>/.exec(xml);
  const rows = new Map(); const order = [];
  if (sd && sd[1]) sd[1].replace(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g, (m, a, inner) => {
    const at = attrsOf(a); const r = +at.r; const cells = new Map();
    (inner || '').replace(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g, (mm, ca, ci) => { const o = attrsOf(ca); const L = (o.r || '').replace(/\d+/g, ''); cells.set(L, { a: o, inner: ci || '' }); return mm; });
    rows.set(r, { a: at, cells }); order.push(r); return m;
  });
  return { sd, rows, order };
}
const textOf = (bk, c) => { if (!c) return ''; const v = (/<v>([\s\S]*?)<\/v>/.exec(c.inner) || [])[1];
  if (c.a.t === 's') return bk.ss[+v] || ''; if (c.a.t === 'inlineStr') return dec((c.inner.match(/<t[^>]*>([\s\S]*?)<\/t>/g) || []).map(x => x.replace(/<[^>]+>/g, '')).join('')); return v == null ? '' : dec(v); };
/* إزاحة مراجع الخلايا في معادلة (الصفوف والأعمدة غير المثبّتة بـ $) — تتجاوز النصوص بين علامات التنصيص والمراجع المهيكلة [..] */
function shiftF(f, dr, dc) {
  if (!dr && !dc) return f;
  let out = '', i = 0;
  while (i < f.length) {
    const ch = f[i];
    if (ch === '"') { const j = f.indexOf('"', i + 1); const e = j < 0 ? f.length : j + 1; out += f.slice(i, e); i = e; continue; }
    if (ch === '[') { let d = 1, j = i + 1; while (j < f.length && d) { if (f[j] === '[') d++; else if (f[j] === ']') d--; j++; } out += f.slice(i, j); i = j; continue; }
    if (ch === "'") { const j = f.indexOf("'", i + 1); const e = j < 0 ? f.length : j + 1; out += f.slice(i, e); i = e; continue; }
    const m = /^(\$?)([A-Z]{1,3})(\$?)(\d+)(?![\d(A-Za-z_])/.exec(f.slice(i));
    const prev = i ? f[i - 1] : '';
    if (m && !/[A-Za-z0-9_.]/.test(prev)) {
      const c = m[1] ? m[2] : colL(colN(m[2]) + dc), r = m[3] ? m[4] : String(+m[4] + dr);
      out += m[1] + c + m[3] + r; i += m[0].length; continue;
    }
    out += ch; i++;
  }
  return out;
}
/* المعادلات المشتركة (t="shared") ← نص المعادلة لكل خلية */
function sharedMasters(rows) {
  const M = {}; for (const [r, row] of rows) for (const [L, c] of row.cells) { const fm = /<f\b([^>]*)>([\s\S]*?)<\/f>/.exec(c.inner); if (fm) { const fa = attrsOf(fm[1]); if (fa.t === 'shared' && fa.si != null && fa.ref) M[fa.si] = { f: dec(fm[2]), r, c: colN(L) }; } }
  return M;
}
function formulaOf(c, r, L, M) {
  if (!c) return null; const fm = /<f\b([^>]*?)(?:\/>|>([\s\S]*?)<\/f>)/.exec(c.inner); if (!fm) return null; const fa = attrsOf(fm[1]);
  if (fa.t === 'shared') { if (fm[2]) return { f: dec(fm[2]), ca: fa.ca }; const m = M[fa.si]; return m ? { f: shiftF(m.f, r - m.r, colN(L) - m.c), ca: fa.ca } : null; }
  if (fa.t === 'array') return { f: dec(fm[2] || ''), ca: fa.ca, array: true, cm: c.a.cm };
  return { f: dec(fm[2] || ''), ca: fa.ca };
}
/* خلية جديدة */
function cellX(ref, s, o) {
  const st = s != null ? ` s="${s}"` : '';
  if (o.f != null) {
    const ca = o.ca ? ' ca="1"' : '', cm = o.cm ? ` cm="${o.cm}"` : '';
    const fx = o.array ? `<f t="array" ref="${ref}"${ca}>${enc(o.f)}</f>` : `<f${ca}>${enc(o.f)}</f>`;
    if (o.v == null || o.v === '') return `<c r="${ref}"${st}${cm}>${fx}</c>`;
    return typeof o.v === 'number' && isFinite(o.v) ? `<c r="${ref}"${st}${cm}>${fx}<v>${o.v}</v></c>` : `<c r="${ref}"${st} t="str"${cm}>${fx}<v>${enc(o.v)}</v></c>`;
  }
  if (o.v == null || o.v === '') return `<c r="${ref}"${st}/>`;
  if (typeof o.v === 'number' && isFinite(o.v)) return `<c r="${ref}"${st}><v>${o.v}</v></c>`;
  return `<c r="${ref}"${st} t="inlineStr"><is><t xml:space="preserve">${enc(o.v)}</t></is></c>`;
}
const findSheet = (bk, z, test) => { for (const s of bk.sheets) { if (!z.has(s.path)) continue; const R = rowsOf(z.get(s.path).toString('utf8')); for (const r of R.order.slice(0, 12)) { const t = [...R.rows.get(r).cells.values()].map(c => RN(textOf(bk, c))); if (test(t, s)) return { s, hr: r }; } } return null; };

/* ---------- معلومات النموذج: العناوين (يحتاجها البرنامج ليطابق الحقول) ---------- */
function info(buf) {
  const z = unzip(Buffer.from(buf)); const bk = book(z);
  const main = findSheet(bk, z, t => t.includes('اسم المشروع') && t.some(x => /^رقم الاضبار/.test(x)));
  if (!main) throw new Error('الملف ليس نموذج موقف لجنة: لا توجد ورقة فيها «رقم الاضبارة» و«اسم المشروع».');
  const R = rowsOf(z.get(main.s.path).toString('utf8'));
  const head = [...R.rows.get(main.hr).cells.entries()].map(([L, c]) => ({ c: L, text: textOf(bk, c).replace(/\s+/g, ' ').trim() })).filter(h => h.text);
  const staff = findSheet(bk, z, (t, s) => s !== main.s && t.includes('اسم المشروع') && t.some(x => /^مشرف 1$/.test(x)) && t.some(x => /^(جهه الانتساب|جهه انتساب المشرف|دائره المشرف) 1$/.test(x)));
  const sh = staff ? [...rowsOf(z.get(staff.s.path).toString('utf8')).rows.get(staff.hr).cells.entries()].map(([L, c]) => ({ c: L, text: textOf(bk, c).replace(/\s+/g, ' ').trim() })).filter(h => h.text) : [];
  return { sheet: main.s.name, headRow: main.hr, head, staffSheet: staff ? staff.s.name : '', staffHead: sh };
}

/* ---------- التعبئة ---------- */
const VALUE_OVER_FORMULA = [/^نسبه الانجاز المخطط/];
function fill(buf, data) {
  const z = unzip(Buffer.from(buf)); const bk = book(z);
  const main = findSheet(bk, z, t => t.includes('اسم المشروع') && t.some(x => /^رقم الاضبار/.test(x)));
  if (!main) throw new Error('نموذج اللجان غير صالح');
  let xml = z.get(main.s.path).toString('utf8'); const R = rowsOf(xml), M = sharedMasters(R.rows), hr = main.hr;
  /* حدود الجدول: من تعريف الجدول (Table) إن وُجد */
  let tbl = null; for (const k of [...z.keys()].filter(k => /^xl\/tables\/table\d+\.xml$/.test(k))) { const t = z.get(k).toString('utf8'); const m = /\bref="([A-Z]+)(\d+):([A-Z]+)(\d+)"/.exec(t); if (m && +m[2] === hr) tbl = { k, t, a: m[1], b: m[3], last: +m[4] }; }
  const first = hr + 1, tplLast = tbl ? tbl.last : Math.max(...R.order);
  const headCells = R.rows.get(hr).cells; const hText = {}; for (const [L, c] of headCells) hText[L] = RN(textOf(bk, c));
  const rowsIn = data.rows || []; const n = rowsIn.length; const last = Math.max(tplLast, first + n - 1);
  /* أعمدة محسوبة دائماً: فيها معادلة في كل خلايا الصفوف المهيّأة */
  const calc = {}, dflt = {}; const lastRow = R.rows.get(tplLast);
  const cols = new Set(); for (let r = first; r <= tplLast; r++) { const row = R.rows.get(r); if (row) for (const L of row.cells.keys()) cols.add(L); }
  for (const L of cols) { let has = 0, fx = 0; for (let r = first; r <= tplLast; r++) { const c = R.rows.get(r) && R.rows.get(r).cells.get(L); if (!c) continue; has++; if (/<f\b/.test(c.inner)) fx++; } calc[L] = has > 0 && fx === has; }
  if (lastRow) for (const [L, c] of lastRow.cells) { const f = formulaOf(c, tplLast, L, M); if (f) dflt[L] = f; }
  const vof = L => VALUE_OVER_FORMULA.some(re => re.test(hText[L] || ''));
  const htC = {}; for (let r = first; r <= tplLast; r++) { const h = R.rows.get(r) && R.rows.get(r).a.ht; if (h) htC[h] = (htC[h] || 0) + 1; } const htMode = (Object.entries(htC).sort((a, b) => b[1] - a[1])[0] || [])[0];
  /* بناء صفوف البيانات */
  const out = [];
  for (let r = first; r <= last; r++) {
    const base = R.rows.get(Math.min(r, tplLast)) || lastRow; const vals = (rowsIn[r - first] || {}).cells || {};
    const at = Object.assign({}, base ? base.a : {}); at.r = String(r);
    if (htMode) { at.ht = htMode; at.customHeight = '1'; } else { delete at.ht; delete at.customHeight; }   /* ارتفاع موحّد لصفوف البيانات (الأكثر تكراراً في النموذج) */
    const cells = new Map();
    const Ls = new Set([...(base ? base.cells.keys() : []), ...Object.keys(vals)]);
    for (const L of Ls) {
      const bc = base && base.cells.get(L); const s = bc ? bc.a.s : undefined; const v = vals[L];
      const tplF = bc ? formulaOf(bc, Math.min(r, tplLast), L, M) : null;
      let f = tplF ? Object.assign({}, tplF, { f: shiftF(tplF.f, r - Math.min(r, tplLast), 0) }) : null;
      const hasV = v != null && v !== '';
      if (!f && dflt[L] && !hasV && vof(L)) f = Object.assign({}, dflt[L], { f: shiftF(dflt[L].f, r - tplLast, 0) });   /* «نسبة الإنجاز المخطط» الفارغة ← معادلة النموذج */
      if (f && hasV && vof(L) && !calc[L]) f = null;
      if (f && hasV && vof(L) && calc[L]) f = null;
      cells.set(L, cellX(L + r, s, f ? Object.assign(f, { v: hasV ? v : null }) : { v: hasV ? v : null }));
    }
    const sorted = [...cells.entries()].sort((a, b) => colN(a[0]) - colN(b[0])).map(x => x[1]).join('');
    out.push(`<row${attrStr(at)}>${sorted}</row>`);
  }
  /* بقية الصفوف كما هي (العنوان والعدّادات فوق الجدول، وما بعد الجدول) + العنوان */
  const keep = R.order.filter(r => r < first || r > tplLast).map(r => { const row = R.rows.get(r); return { r, x: `<row${attrStr(row.a)}>${[...row.cells.entries()].map(([L, c]) => `<c${attrStr(c.a)}${c.inner ? `>${c.inner}</c>` : '/>'}`).join('')}</row>` }; });
  if (data.title) { const k = keep.find(x => x.r === 1); if (k) k.x = k.x.replace(/<c\b([^>]*?\br="A1"[^>]*?)(?:\/>|>[\s\S]*?<\/c>)/, (m, a) => { const o = attrsOf(a); delete o.t; return `<c${attrStr(o)} t="inlineStr"><is><t xml:space="preserve">${enc(data.title)}</t></is></c>`; }); }
  const before = keep.filter(x => x.r < first).map(x => x.x).join(''), after = keep.filter(x => x.r > tplLast && x.r > last).map(x => x.x).join('');
  xml = xml.replace(R.sd[0], () => `<sheetData>${before}${out.join('')}${after}</sheetData>`);
  /* روابط ارتباط الصفوف القديمة (مجلدات اللجنة على حاسبتها) تُزال؛ وروابط Google Earth لإحداثيات كل مشروع تُضاف */
  let rels = z.has(relPath(main.s.path)) ? z.get(relPath(main.s.path)).toString('utf8') : '';
  xml = xml.replace(/<hyperlinks>[\s\S]*?<\/hyperlinks>/, '');
  if (rels) rels = rels.replace(/<Relationship\b[^>]*relationships\/hyperlink"[^>]*\/>/g, '');
  const links = (data.links || []).filter(x => x && x.ref && x.url);
  if (links.length) {
    if (!rels) rels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';
    const hl = links.map((x, i) => { rels = rels.replace('</Relationships>', () => `<Relationship Id="rIdGE${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${enc(x.url)}" TargetMode="External"/></Relationships>`); return `<hyperlink ref="${x.ref}" r:id="rIdGE${i + 1}"/>`; }).join('');
    const pos = /<(printOptions|pageMargins|pageSetup|headerFooter|rowBreaks|colBreaks|customProperties|cellWatches|ignoredErrors|smartTags|drawing|legacyDrawing|legacyDrawingHF|picture|oleObjects|controls|webPublishItems|tableParts|extLst)\b/.exec(xml);
    xml = pos ? xml.slice(0, pos.index) + `<hyperlinks>${hl}</hyperlinks>` + xml.slice(pos.index) : xml.replace('</worksheet>', () => `<hyperlinks>${hl}</hyperlinks></worksheet>`);
  }
  /* تعليقات الصفوف القديمة تُزال */
  ({ xml, rels } = dropComments(z, xml, rels));
  if (rels) z.set(relPath(main.s.path), Buffer.from(rels, 'utf8'));
  /* تمديد النطاقات إن زادت الصفوف */
  const grow = s => last > tplLast ? s.replace(new RegExp(`(\\$?[A-Z]{1,3}\\$?)${tplLast}(?![0-9])`, 'g'), `$1${last}`) : s;
  if (last > tplLast) {
    xml = xml.replace(/<dimension ref="([^"]+)"\/>/, (m, a) => `<dimension ref="${grow(a)}"/>`).replace(/sqref="([^"]+)"/g, (m, a) => `sqref="${grow(a)}"`)
      .replace(/<f\b([^>]*)>([^<]*)<\/f>/g, (m, a, f) => `<f${a}>${grow(f)}</f>`);
    if (tbl) z.set(tbl.k, Buffer.from(tbl.t.replace(/\bref="([^"]+)"/g, (m, a) => `ref="${grow(a)}"`), 'utf8'));
    for (const s of bk.sheets) if (s.path !== main.s.path && z.has(s.path)) { const x = z.get(s.path).toString('utf8'); const nx = x.replace(/<f\b([^>]*)>([^<]*)<\/f>/g, (m, a, f) => /مشاريع|الجدول|'/.test(f) || true ? `<f${a}>${f.replace(new RegExp(`(\\$?[A-Z]{1,3}\\$?)${tplLast}(?![0-9])`, 'g'), `$1${last}`)}</f>` : m); if (nx !== x) z.set(s.path, Buffer.from(nx, 'utf8')); }
    let wb = z.get('xl/workbook.xml').toString('utf8'); wb = wb.replace(/(<definedName\b[^>]*>)([^<]*)(<\/definedName>)/g, (m, a, f, b) => a + grow(f) + b); z.set('xl/workbook.xml', Buffer.from(wb, 'utf8'));
  }
  z.set(main.s.path, Buffer.from(xml, 'utf8'));
  /* الكادر الهندسي */
  const staff = findSheet(bk, z, (t, s) => s !== main.s && t.includes('اسم المشروع') && t.some(x => /^مشرف 1$/.test(x)) && t.some(x => /^(جهه الانتساب|جهه انتساب المشرف|دائره المشرف) 1$/.test(x)));
  if (staff) fillStaff(z, bk, staff, data.staff || [], rowsIn, Math.max(n, 0));
  /* قائمة المشرفين */
  const sup = findSheet(bk, z, (t, s) => s !== main.s && t.includes('الاسم الكامل') && t.some(x => /^الصفه$/.test(x)));
  if (sup) fillList(z, sup, data.engineers || []);
  for (const nm of data.clearSheets || []) { const s = bk.sheets.find(x => x.name === nm); if (s && z.has(s.path)) clearValues(z, s.path, 2); }
  /* التواريخ يوم/شهر/سنة (كل صيغ التاريخ الكامل، والتنسيق المدمج 14) */
  require('./xlmerge').dmyDates(z);
  for (const s of bk.sheets) if (z.has(s.path)) { const x = z.get(s.path).toString('utf8'); const nx = x.replace(/(TEXT\([^<]*?,&quot;)yyyy-mm-dd(&quot;\))/g, '$1dd/mm/yyyy$2'); if (nx !== x) z.set(s.path, Buffer.from(nx, 'utf8')); }
  /* إعادة الحساب عند الفتح: تُحذف سلسلة الحساب القديمة */
  if (z.has('xl/calcChain.xml')) { z.delete('xl/calcChain.xml'); let r = z.get('xl/_rels/workbook.xml.rels').toString('utf8').replace(/<Relationship\b[^>]*calcChain[^>]*\/>/g, ''); z.set('xl/_rels/workbook.xml.rels', Buffer.from(r, 'utf8')); let ct = z.get('[Content_Types].xml').toString('utf8').replace(/<Override\b[^>]*calcChain[^>]*\/>/g, ''); z.set('[Content_Types].xml', Buffer.from(ct, 'utf8')); }
  let wb = z.get('xl/workbook.xml').toString('utf8');
  wb = /<calcPr\b/.test(wb) ? wb.replace(/<calcPr\b([^>]*?)\/?>/, (m, a) => `<calcPr${a.replace(/\sfullCalcOnLoad="\w+"/, '')} fullCalcOnLoad="1"/>`) : wb.replace('</workbook>', () => '<calcPr fullCalcOnLoad="1"/></workbook>');
  z.set('xl/workbook.xml', Buffer.from(wb, 'utf8'));
  compactStrings(z);
  require('./planning').xmlGuard(z);
  return zip(z);
}
const relPath = p => p.replace(/([^/]+)$/, '_rels/$1.rels');
function dropComments(z, xml, rels) {
  if (!rels || !/comments/.test(rels)) return { xml, rels };
  const ids = []; rels = rels.replace(/<Relationship\b([^>]*)\/>/g, (m, a) => { const o = attrsOf(a); if (/\/(comments|vmlDrawing)$/.test(o.Type || '')) { ids.push(o.Id); const t = 'xl/' + String(o.Target).replace(/^\.\.\//, '').replace(/^\/?xl\//, ''); if (z.has(t)) z.delete(t); let ct = z.get('[Content_Types].xml').toString('utf8').replace(new RegExp(`<Override\\b[^>]*PartName="/${t.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}"[^>]*/>`), ''); z.set('[Content_Types].xml', Buffer.from(ct, 'utf8')); return ''; } return m; });
  for (const id of ids) xml = xml.replace(new RegExp(`<legacyDrawing\\b[^>]*r:id="${id}"[^>]*/>`), '');
  return { xml, rels };
}
/* الكادر: صف k+1 يقابل الصف k من جدول المشاريع (معادلات النموذج ROW()-1)؛ المشرفون ودوائرهم في أعمدة «مشرف N» و«جهة الانتساب N» */
function fillStaff(z, bk, st, staff, rowsIn, n) {
  let xml = z.get(st.s.path).toString('utf8'); const R = rowsOf(xml), M = sharedMasters(R.rows), hr = st.hr;
  const H = {}; for (const [L, c] of R.rows.get(hr).cells) H[L] = RN(textOf(bk, c));
  const pairs = []; Object.entries(H).forEach(([L, t]) => { const m = /^مشرف (\d+)$/.exec(t); if (m) pairs[+m[1] - 1] = [L, colL(colN(L) + 1)]; });
  const P = pairs.filter(Boolean);
  const lastT = Math.max(...R.order.filter(r => r > hr)), last = Math.max(lastT, hr + n);
  const lastRow = R.rows.get(lastT);
  const out = [];
  for (let r = hr + 1; r <= last; r++) {
    const base = R.rows.get(Math.min(r, lastT)) || lastRow; const at = Object.assign({}, base.a); at.r = String(r);
    const k = r - hr - 1, sv = staff[k] || {}, sup = sv.sup || [];
    const cells = [];
    const allL = new Map(base.cells); for (const pr of P) for (const L of pr) if (!allL.has(L)) allL.set(L, { a: { s: (base.cells.get(P[0][0]) || { a: {} }).a.s }, inner: '' });   /* خلايا ناقصة في صف النموذج */
    for (const [L, c] of allL) {
      const f0 = formulaOf(c, Math.min(r, lastT), L, M); const f = f0 ? Object.assign({}, f0, { f: shiftF(f0.f, r - Math.min(r, lastT), 0) }) : null;
      const pi = P.findIndex(p => p[0] === L || p[1] === L); let v = null;
      if (pi >= 0 && !f) { const q = sup[pi]; v = q ? (P[pi][0] === L ? q[0] : q[1]) : null; }
      if (f) { const t = H[L] || ''; f.v = k < n ? (t === 'اسم المشروع' ? sv.name : /^المهندس المقيم/.test(t) ? sv.res : /^(جهه انتساب المقيم|دائره المقيم)/.test(t) ? sv.resDept : t === 'ت' ? (sv.name ? k + 1 : null) : null) : null; }
      cells.push([L, cellX(L + r, c.a.s, f || { v })]);
    }
    out.push(`<row${attrStr(at)}>${cells.sort((a, b) => colN(a[0]) - colN(b[0])).map(x => x[1]).join('')}</row>`);
  }
  const before = R.order.filter(r => r <= hr).map(r => { const row = R.rows.get(r); return `<row${attrStr(row.a)}>${[...row.cells.values()].map(c => `<c${attrStr(c.a)}${c.inner ? `>${c.inner}</c>` : '/>'}`).join('')}</row>`; }).join('');
  xml = xml.replace(R.sd[0], () => `<sheetData>${before}${out.join('')}</sheetData>`);
  if (last > lastT) xml = xml.replace(/<dimension ref="([^"]+)"\/>/, (m, a) => `<dimension ref="${a.replace(/\d+$/, String(last))}"/>`);
  z.set(st.s.path, Buffer.from(xml, 'utf8'));
}
function fillList(z, st, list) {
  let xml = z.get(st.s.path).toString('utf8'); const R = rowsOf(xml), hr = st.hr; const lastT = Math.max(hr + 1, ...R.order);
  const base = R.rows.get(hr + 1) || R.rows.get(lastT); const last = Math.max(lastT, hr + list.length);
  const out = [];
  for (let r = hr + 1; r <= last; r++) {
    const b = R.rows.get(Math.min(r, lastT)) || base; const at = Object.assign({}, b ? b.a : {}); at.r = String(r); const v = list[r - hr - 1] || [];
    const Ls = b ? [...b.cells.keys()] : ['A', 'B', 'C', 'D', 'E'];
    out.push(`<row${attrStr(at)}>${Ls.map((L, i) => cellX(L + r, b && b.cells.get(L) ? b.cells.get(L).a.s : undefined, { v: v[colN(L) - 1] == null ? null : v[colN(L) - 1] })).join('')}</row>`);
  }
  const before = R.order.filter(r => r <= hr).map(r => { const row = R.rows.get(r); return `<row${attrStr(row.a)}>${[...row.cells.values()].map(c => `<c${attrStr(c.a)}${c.inner ? `>${c.inner}</c>` : '/>'}`).join('')}</row>`; }).join('');
  xml = xml.replace(R.sd[0], () => `<sheetData>${before}${out.join('')}</sheetData>`);
  z.set(st.s.path, Buffer.from(xml, 'utf8'));
}
/* تفريغ القيم المدخلة (غير المعادلات) من الصف from فما بعد — لتنظيف أوراق مساعدة فيها بيانات لجنة أخرى */
function clearValues(z, p, from) {
  let xml = z.get(p).toString('utf8');
  xml = xml.replace(/<row\b([^>]*?)>([\s\S]*?)<\/row>/g, (m, a, inner) => { const r = +attrsOf(a).r; if (r < from) return m;
    return `<row${a}>${inner.replace(/<c\b([^>]*?)>([\s\S]*?)<\/c>/g, (mm, ca, ci) => /<f\b/.test(ci) ? mm : (() => { const o = attrsOf(ca); delete o.t; return `<c${attrStr(o)}/>`; })())}</row>`; });
  xml = xml.replace(/<hyperlinks>[\s\S]*?<\/hyperlinks>/, '');
  z.set(p, Buffer.from(xml, 'utf8'));
}
/* حذف النصوص غير المستعملة من sharedStrings وإعادة ترقيم المراجع (حتى لا تبقى بيانات لجنة سابقة مخزّنة في الملف) */
function compactStrings(z) {
  if (!z.has('xl/sharedStrings.xml')) return;
  const sx = z.get('xl/sharedStrings.xml').toString('utf8'); const items = sx.match(/<si>[\s\S]*?<\/si>/g) || [];
  const paths = [...z.keys()].filter(k => /^xl\/worksheets\/sheet\d+\.xml$/.test(k)); const used = new Map();
  for (const p of paths) z.get(p).toString('utf8').replace(/<c\b[^>]*\bt="s"[^>]*>\s*<v>(\d+)<\/v>/g, (m, i) => { if (!used.has(+i)) used.set(+i, used.size); return m; });
  const order = [...used.entries()].sort((a, b) => a[1] - b[1]);
  for (const p of paths) { const x = z.get(p).toString('utf8'); z.set(p, Buffer.from(x.replace(/(<c\b[^>]*\bt="s"[^>]*>\s*<v>)(\d+)(<\/v>)/g, (m, a, i, b) => a + used.get(+i) + b), 'utf8')); }
  const head = /^[\s\S]*?<sst\b[^>]*>/.exec(sx)[0].replace(/\s(count|uniqueCount)="\d+"/g, '').replace(/<sst\b/, `<sst count="${order.length}" uniqueCount="${order.length}"`);
  z.set('xl/sharedStrings.xml', Buffer.from(head + order.map(([i]) => items[i]).join('') + '</sst>', 'utf8'));
}
/* إعداد نموذج نظيف من ملف لجنة: تفريغ كل بياناتها مع بقاء البنية والمعادلات والتنسيق واللوحة والماكرو */
function makeTemplate(buf, title) {
  const out = fill(buf, { title: title || 'موقف مشاريع محافظة الأنبار', rows: [], staff: [], engineers: [], clearSheets: ['جدول مطابقة الاضابير', 'المشرفون'] });
  const z = unzip(Buffer.from(out));
  /* القيم المخزّنة لمعادلات اللوحة والعدّادات كانت محسوبة من بيانات اللجنة السابقة */
  for (const k of [...z.keys()].filter(k => /^xl\/worksheets\/sheet\d+\.xml$/.test(k))) { const x = z.get(k).toString('utf8'); z.set(k, Buffer.from(x.replace(/(<c\b[^>]*>)(<f\b[^>]*(?:\/>|>[\s\S]*?<\/f>))<v>[\s\S]*?<\/v>(<\/c>)/g, '$1$2$3').replace(/(<c\b[^>]*?)\st="(?:str|e)"([^>]*>)(<f\b)/g, '$1$2$3'), 'utf8')); }
  for (const k of [...z.keys()].filter(k => /^xl\/charts\/chart\d+\.xml$/.test(k))) { const x = z.get(k).toString('utf8'); z.set(k, Buffer.from(x.replace(/<c:(str|num)Cache>[\s\S]*?<\/c:\1Cache>/g, ''), 'utf8')); }
  if (z.has('docProps/core.xml')) z.set('docProps/core.xml', Buffer.from(z.get('docProps/core.xml').toString('utf8').replace(/<dc:creator>[\s\S]*?<\/dc:creator>/, '<dc:creator></dc:creator>').replace(/<cp:lastModifiedBy>[\s\S]*?<\/cp:lastModifiedBy>/, '<cp:lastModifiedBy></cp:lastModifiedBy>'), 'utf8'));
  compactStrings(z);
  return zip(z);
}
module.exports = { info, fill, shiftF, makeTemplate, compactStrings };
