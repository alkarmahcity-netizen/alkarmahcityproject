'use strict';
/* لوحتا معلومات تفاعليتان داخل ملف التخطيط المُصدَّر: «لوحة الخطة» و«لوحة المنافذ وإعادة الاستقرار».
   - كل رقم فيهما معادلة (COUNTIFS / SUMIFS / AVERAGEIFS / INDEX-MATCH) على الجدول الأصلي نفسه، فأي تعديل في الجدول يظهر فيهما.
   - قوائم اختيار (القضاء، الخطة أو نوع التمويل، حالة المشروع، الجهة المستفيدة) تُصفّي كل الأرقام، و«بطاقة مشروع» تعرض كل حقول مكوّن واحد.
   - المكوّنات تُميَّز بعمود علامات في ورقة مساعدة مخفية «بيانات اللوحة» (صفوف المشاريع التخطيطية والمجاميع لا تُحسب مرتين).
   - «إعداد قسم الشؤون الهندسية — ديوان محافظة الانبار» أعلى اللوحتين وأعلى كل جدول أصلي، والعناوين والتوقيع مقفلة بكلمة سر المدير
     (SHA-512)؛ صفوف البيانات في الجداول الأصلية تبقى قابلة للتعديل والتصفية والفرز، وفي اللوحتين قوائم الاختيار وحدها. */
const crypto = require('crypto');
const { sheetInfo, cellText } = require('./xlmerge');
const CREDIT = 'إعداد قسم الشؤون الهندسية — ديوان محافظة الانبار';
const HELPER = 'بيانات اللوحة';
const ALL = 'الكل';
const enc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const colL = n => { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
const qs = n => `'${String(n).replace(/'/g, "''")}'`;
const T = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
const PCTS = new Set(['planPct', 'actPct', 'tech']);
const AVG = new Set(['dur', 'ext', 'planPct', 'actPct', 'tech']);
const NUMS = ['referral', 'contract', 'contractAfter', 'coSum', 'coCount', 'cost', 'advPromo', 'advRaised', 'advPaid', 'spent', 'supSpent', 'spentAll', 'commit', 'remain', 'dur', 'ext', 'planPct', 'tech', 'actPct'];
const DATES = new Set(['contractDate', 'start', 'end', 'updated']);
const DIMS = { main: ['district', 'plan', 'status', 'directorate'], s2: ['fund', 'district', 'status', 'directorate'] };
const BRK = ['contractAfter', 'contract', 'spent', 'advPaid', 'actPct'];

function pwHash(pw) {
  const salt = crypto.randomBytes(16); let h = crypto.createHash('sha512').update(Buffer.concat([salt, Buffer.from(String(pw), 'utf16le')])).digest();
  const it = Buffer.alloc(4); for (let i = 0; i < 100000; i++) { it.writeUInt32LE(i, 0); h = crypto.createHash('sha512').update(Buffer.concat([h, it])).digest(); }
  return `algorithmName="SHA-512" hashValue="${h.toString('base64')}" saltValue="${salt.toString('base64')}" spinCount="100000"`;
}

/* أنماط اللوحة تُضاف إلى styles.xml الموجود */
function addStyles(z) {
  let st = z.get('xl/styles.xml').toString('utf8');
  const sect = (tag, item, add) => {
    const re = new RegExp(`<${tag}\\b([^>]*)>([\\s\\S]*?)<\\/${tag}>`), m = re.exec(st);
    if (!m) { const selfRe = new RegExp(`<${tag}\\b[^>]*\\/>`); const base = add.join(''); if (selfRe.test(st)) st = st.replace(selfRe, () => `<${tag} count="${add.length}">${base}</${tag}>`); return 0; }
    const n = (m[2].match(new RegExp(`<${item}\\b`, 'g')) || []).length;
    st = st.replace(m[0], () => `<${tag}${m[1].replace(/\scount="\d+"/, '')} count="${n + add.length}">${m[2]}${add.join('')}</${tag}>`); return n;
  };
  /* صيغ الأرقام */
  const ids = []; st.replace(/numFmtId="(\d+)"/g, (_, i) => { ids.push(+i); return _; }); let nid = Math.max(163, ...ids) + 1;
  const FM = { int: [nid++, '#,##0'], pctN: [nid++, '0.0"%"'], pctF: [nid++, '0.0%'], date: [nid++, 'dd/mm/yyyy'], dec: [nid++, '#,##0.0'] };
  const fmtXml = Object.values(FM).filter(x => x[1]).map(([i, c]) => `<numFmt numFmtId="${i}" formatCode="${enc(c)}"/>`);
  if (/<numFmts\b/.test(st)) sect('numFmts', 'numFmt', fmtXml); else st = st.replace(/(<styleSheet\b[^>]*>)/, (m, a1) => `${a1}<numFmts count="${fmtXml.length}">${fmtXml.join('')}</numFmts>`);
  const f0 = sect('fonts', 'font', [
    '<font><b/><sz val="18"/><color rgb="FFFFFFFF"/><name val="Arial"/></font>',      // +0 عنوان
    '<font><b/><sz val="13"/><color rgb="FF1F4E3D"/><name val="Arial"/></font>',      // +1 التوقيع
    '<font><sz val="10"/><color rgb="FF595959"/><name val="Arial"/></font>',          // +2 ملاحظة
    '<font><b/><sz val="12"/><color rgb="FFFFFFFF"/><name val="Arial"/></font>',      // +3 رأس
    '<font><sz val="12"/><color rgb="FF000000"/><name val="Arial"/></font>',          // +4 عادي
    '<font><b/><sz val="12"/><color rgb="FF0B3D2E"/><name val="Arial"/></font>',      // +5 قيمة
    '<font><b/><sz val="14"/><color rgb="FF8B0000"/><name val="Arial"/></font>']);   // +6 توقيع الجدول الأصلي
  const fl0 = sect('fills', 'fill', ['FF1F6F50', 'FFE2EFDA', 'FF2F5D8A', 'FFFFF2CC', 'FFF2F2F2'].map(c => `<fill><patternFill patternType="solid"><fgColor rgb="${c}"/><bgColor indexed="64"/></patternFill></fill>`));
  const b0 = sect('borders', 'border', ['<border><left style="thin"><color rgb="FFBFBFBF"/></left><right style="thin"><color rgb="FFBFBFBF"/></right><top style="thin"><color rgb="FFBFBFBF"/></top><bottom style="thin"><color rgb="FFBFBFBF"/></bottom><diagonal/></border>']);
  const xf = (font, fill, border, fmt, h, locked = true, wrap = false) => `<xf numFmtId="${fmt}" fontId="${f0 + font}" fillId="${fill == null ? 0 : fl0 + fill}" borderId="${border ? b0 : 0}" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1" applyProtection="1"><alignment horizontal="${h}" vertical="center"${wrap ? ' wrapText="1"' : ''} readingOrder="2"/><protection locked="${locked ? 1 : 0}"/></xf>`;
  const L = {
    title: xf(0, 0, false, 0, 'center'), credit: xf(1, 1, false, 0, 'center'), note: xf(2, null, false, 0, 'right', true, true),
    head: xf(3, 2, true, 0, 'center', true, true), label: xf(4, 4, true, 0, 'right', true, true), txt: xf(4, null, true, 0, 'right', true, true),
    int: xf(5, null, true, FM.int[0], 'center'), pctN: xf(5, null, true, FM.pctN[0], 'center'), pctF: xf(5, null, true, FM.pctF[0], 'center'),
    date: xf(5, null, true, FM.date[0], 'center'), dec: xf(5, null, true, FM.dec[0], 'center'), gen: xf(5, null, true, 0, 'right', true, true),
    pick: xf(5, 3, true, 0, 'center', false), srcCredit: xf(6, 1, false, 0, 'center')
  };
  const keys = Object.keys(L); const x0 = sect('cellXfs', 'xf', keys.map(k => L[k]));
  const S = {}; keys.forEach((k, i) => { S[k] = x0 + i; });
  z.set('xl/styles.xml', Buffer.from(st, 'utf8'));
  return S;
}

/* بيانات كل جدول أصلي: صفوف المكوّنات، أعمدتها، والقيم الفريدة للتصفية */
function sheetData(book, sh, meta, model, updates) {
  const I = sheetInfo(book, sh);
  const raw = (r, c) => { const row = I.rows.get(r); const cell = row && row.cells.find(x => x.c === c); return cell ? String(cellText(book, cell) == null ? '' : cellText(book, cell)) : ''; };
  const comps = model.comps.filter(c => c.sheet === sh.name).map(c => c.row).sort((a, b) => a - b);
  if (!comps.length) return null;
  const first = I.hr + 1, last = comps[comps.length - 1];
  const dims = DIMS[meta.kind].filter(k => meta.cols[k]);
  const vals = {}; for (const k of dims) { const cnt = new Map(); for (const r of comps) { const v = raw(r, meta.cols[k]); if (T(v)) cnt.set(v, (cnt.get(v) || 0) + 1); } vals[k] = cnt; }
  for (const u of updates || []) if (u.sheet === sh.name) for (const k of dims) { const v = u.set && u.set[k]; if (typeof v === 'string' && T(v) && !vals[k].has(v)) vals[k].set(v, 0); }
  const names = []; const seen = new Set(); for (const r of comps) { const v = raw(r, meta.cols.name); if (T(v) && !seen.has(v)) { seen.add(v); names.push(v); } }
  const head = Object.entries(I.head).map(([c, h]) => [+c, T(h)]).filter(([, h]) => h).sort((a, b) => a[0] - b[0]);
  return { sh, meta, I, first, last, comps: new Set(comps), dims, vals, names, head, row1: I.rows.get(1), hr: I.hr };
}

function cellXml(ref, o) {
  if (o == null) return '';
  const s = o.s != null ? ` s="${o.s}"` : '';
  if (o.f != null) return `<c r="${ref}"${s}><f>${enc(o.f)}</f></c>`;
  if (typeof o.v === 'number') return `<c r="${ref}"${s}><v>${o.v}</v></c>`;
  if (o.v == null || o.v === '') return `<c r="${ref}"${s}/>`;
  return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${enc(o.v)}</t></is></c>`;
}
function sheetXml({ rows, cols, merges, dv, bars, prot, hiddenCols, selected, heights }) {
  const sd = rows.map((r, i) => { if (!r) return ''; const ht = heights && heights[i + 1] ? ` ht="${heights[i + 1]}" customHeight="1"` : ''; return `<row r="${i + 1}"${ht}>${r.map((c, j) => cellXml(colL(j + 1) + (i + 1), c)).join('')}</row>`; }).join('');
  const colsX = cols.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"${(hiddenCols || []).includes(i + 1) ? ' hidden="1"' : ''}/>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">`
    + `<sheetPr><tabColor rgb="FF1F6F50"/><pageSetUpPr fitToPage="1"/></sheetPr><sheetViews><sheetView rightToLeft="1"${selected ? ' tabSelected="1"' : ''} showGridLines="0" zoomScale="90" workbookViewId="0"/></sheetViews><sheetFormatPr defaultRowHeight="20"/>`
    + (colsX ? `<cols>${colsX}</cols>` : '') + `<sheetData>${sd}</sheetData>`
    + (prot ? `<sheetProtection ${prot} sheet="1" objects="1" scenarios="1"/>` : '')
    + (merges && merges.length ? `<mergeCells count="${merges.length}">${merges.map(m => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>` : '')
    + (bars || []).map((b, i) => `<conditionalFormatting sqref="${b.ref}"><cfRule type="dataBar" priority="${i + 1}"><dataBar><cfvo type="min"/><cfvo type="max"/><color rgb="${b.color || 'FF63BE7B'}"/></dataBar></cfRule></conditionalFormatting>`).join('')
    + (dv && dv.length ? `<dataValidations count="${dv.length}">${dv.map(d => `<dataValidation type="list" allowBlank="1" showInputMessage="1" showErrorMessage="1" sqref="${d.ref}"><formula1>${enc(d.f)}</formula1></dataValidation>`).join('')}</dataValidations>` : '')
    + `<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/><pageSetup paperSize="9" orientation="portrait" fitToWidth="1" fitToHeight="0"/>`
    + `<headerFooter><oddFooter>&amp;C${enc(CREDIT)}</oddFooter></headerFooter></worksheet>`;
}

/* لوحة جدول واحد */
function dashSheet(D, S, helperCol, listCols, prot, title, stamp, sel) {
  const { sh, meta, first, last, dims, vals, names, head } = D;
  const src = qs(sh.name), rng = c => `${src}!$${colL(c)}$${first}:$${colL(c)}$${last}`, flag = `${qs(HELPER)}!$${colL(helperCol)}$${first}:$${colL(helperCol)}$${last}`;
  const rows = [], merges = [], dv = [], bars = [];
  const put = (r, c, o) => { (rows[r - 1] = rows[r - 1] || [])[c - 1] = o; };
  const W = 7;   /* الأعمدة A..G، والعمود J مخفي لمعايير التصفية */
  put(1, 1, { v: title, s: S.title }); merges.push(`A1:${colL(W)}1`);
  put(2, 1, { v: CREDIT, s: S.credit }); merges.push(`A2:${colL(W)}2`);
  put(3, 1, { v: `لوحة تفاعلية مرتبطة بالجدول الأصلي «${sh.name}»: اختر من القوائم الصفراء فتتحدّث كل الأرقام تلقائياً، وأي تعديل في الجدول يظهر هنا. الأرقام للمكوّنات (${D.comps.size} مكوّناً عند الإصدار). تاريخ الإصدار ${stamp}.`, s: S.note }); merges.push(`A3:${colL(W)}3`);
  let r = 5;
  put(r, 1, { v: 'التصفية', s: S.head }); put(r, 2, { v: 'الاختيار', s: S.head }); merges.push(`B${r}:C${r}`); r++;
  const crit = {};
  dims.forEach(k => {
    put(r, 1, { v: meta.head[k] || k, s: S.label }); put(r, 2, { v: ALL, s: S.pick }); put(r, 3, { v: '', s: S.pick }); merges.push(`B${r}:C${r}`);
    const lc = listCols[k]; dv.push({ ref: `B${r}`, f: `${qs(HELPER)}!$${colL(lc.c)}$1:$${colL(lc.c)}$${lc.n}` });
    put(r, 10, { f: `IF(OR(B${r}="${ALL}",B${r}=""),"<>§",SUBSTITUTE(SUBSTITUTE(SUBSTITUTE(B${r},"~","~~"),"*","~*"),"?","~?"))` });
    crit[k] = `$J$${r}`; r++;
  });
  const critStr = skip => dims.filter(k => k !== skip).map(k => `,${rng(meta.cols[k])},${crit[k]}`).join('');
  const fmtOf = k => PCTS.has(k) ? (meta.scale[k] === 'frac' ? S.pctF : S.pctN) : (k === 'dur' || k === 'ext') ? S.dec : S.int;
  /* شرط على العمود نفسه: يستبعد خلايا الخطأ (#VALUE! من الروابط الخارجية) والنصوص، وفي أعمدة النسب الكسرية القيمَ المدخلة بمقياس مئوي خطأً */
  const own = k => `,${rng(meta.cols[k])},"${PCTS.has(k) && meta.scale[k] === 'frac' ? '<=1.5' : '<1E+300'}"`;
  const agg = (k, extra) => { const c = rng(meta.cols[k]); return AVG.has(k) ? `IFERROR(AVERAGEIFS(${c},${flag},1${own(k)}${extra}),"")` : `SUMIFS(${c},${flag},1${own(k)}${extra})`; };
  const lab = (k, avg) => { const h = k === 'coSum' && meta.head.coSumH ? meta.head.coSumH : (meta.head[k] || k); return /^(مجموع|معدل|المجموع)/.test(h) ? h : (avg ? 'معدل ' : 'مجموع ') + h; };
  /* المؤشرات العامة: العدد ومجموع (أو معدل) كل عمود رقمي في الجدول */
  r++; put(r, 1, { v: 'المؤشرات العامة (حسب التصفية)', s: S.head }); put(r, 2, { v: 'القيمة', s: S.head }); merges.push(`B${r}:C${r}`); r++;
  put(r, 1, { v: 'عدد المكوّنات', s: S.label }); put(r, 2, { f: `COUNTIFS(${flag},1${critStr()})`, s: S.int }); merges.push(`B${r}:C${r}`); r++;
  NUMS.filter(k => meta.cols[k]).forEach(k => { put(r, 1, { v: lab(k, AVG.has(k)), s: S.label }); put(r, 2, { f: agg(k, critStr()), s: fmtOf(k) }); merges.push(`B${r}:C${r}`); r++; });
  /* توزيعات: حسب كل عامل تصفية (مع بقية العوامل) */
  const bk = BRK.filter(k => meta.cols[k]).filter((k, i, a) => !(k === 'contract' && a.includes('contractAfter'))).slice(0, 4);
  dims.forEach(k => {
    r++; const list = [...vals[k].entries()].sort((a, b) => b[1] - a[1]).slice(0, 40);
    put(r, 1, { v: 'حسب ' + (meta.head[k] || k), s: S.head }); put(r, 2, { v: 'العدد', s: S.head }); bk.forEach((m, i) => put(r, 3 + i, { v: AVG.has(m) ? lab(m, true) : (meta.head[m] || m), s: S.head }));
    const r0 = r + 1; r++;
    list.forEach(([v]) => {
      const ck = `,${rng(meta.cols[k])},${critOf(v)}`;
      put(r, 1, { v, s: S.txt }); put(r, 2, { f: `COUNTIFS(${flag},1${ck}${critStr(k)})`, s: S.int });
      bk.forEach((m, i) => put(r, 3 + i, { f: agg(m, ck + critStr(k)), s: fmtOf(m) })); r++;
    });
    if (list.length) { bars.push({ ref: `B${r0}:B${r - 1}`, color: 'FF5B9BD5' }); if (bk.length) bars.push({ ref: `C${r0}:C${r - 1}`, color: 'FF63BE7B' }); }
    if (vals[k].size > list.length) { put(r, 1, { v: `… و${vals[k].size - list.length} قيمة أخرى (تظهر باختيارها من القائمة أعلاه)`, s: S.note }); merges.push(`A${r}:${colL(W)}${r}`); r++; }
  });
  /* بطاقة مكوّن: كل حقول الجدول الأصلي لمكوّن واحد */
  r++; put(r, 1, { v: 'بطاقة مشروع (مكوّن): اختر الاسم', s: S.head }); put(r, 2, { v: names[0] || '', s: S.pick }); for (let c = 3; c <= W; c++) put(r, c, { v: '', s: S.pick }); merges.push(`B${r}:${colL(W)}${r}`);
  const lc = listCols._names; dv.push({ ref: `B${r}`, f: `${qs(HELPER)}!$${colL(lc.c)}$1:$${colL(lc.c)}$${lc.n}` });
  const pr = r; r++;
  const keyOf = {}; Object.entries(meta.cols).forEach(([k, c]) => { if (!(c in keyOf)) keyOf[c] = k; });
  head.forEach(([c, h]) => {
    const k = keyOf[c]; const ix = `INDEX(${rng(c)},MATCH($B$${pr},${rng(meta.cols.name)},0))`;
    put(r, 1, { v: h, s: S.label }); put(r, 2, { f: `IFERROR(IF(${ix}="","",${ix}),"")`, s: (k && DATES.has(k)) || /^تاريخ/.test(h) ? S.date : k && PCTS.has(k) ? fmtOf(k) : k && NUMS.includes(k) ? S.int : S.gen }); merges.push(`B${r}:${colL(W)}${r}`); r++;
  });
  r++; put(r, 1, { v: CREDIT, s: S.credit }); merges.push(`A${r}:${colL(W)}${r}`);
  return sheetXml({ rows, cols: [44, 22, 22, 22, 22, 22, 22, 4, 4, 30], merges, dv, bars, prot, selected: sel, hiddenCols: [10], heights: { 1: 36, 2: 26, 3: 34 } });
}
const critOf = v => `"${String(v).replace(/"/g, '""').replace(/~/g, '~~').replace(/\*/g, '~*').replace(/\?/g, '~?')}"`;

/* إضافة ورقة إلى المصنف: في أول القائمة (مع تصحيح localSheetId) أو آخرها، مخفية أو ظاهرة */
function addWs(z, name, xml, { atStart = 0, hidden = false } = {}) {
  const files = [...z.keys()].filter(k => /^xl\/worksheets\/sheet\d+\.xml$/.test(k)).map(k => +k.match(/(\d+)\.xml$/)[1]);
  const n = (files.length ? Math.max(...files) : 0) + 1; z.set(`xl/worksheets/sheet${n}.xml`, Buffer.from(xml, 'utf8'));
  let rels = z.get('xl/_rels/workbook.xml.rels').toString('utf8'); const rid = 'rIdDash' + n;
  rels = rels.replace('</Relationships>', () => `<Relationship Id="${rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${n}.xml"/></Relationships>`);
  z.set('xl/_rels/workbook.xml.rels', Buffer.from(rels, 'utf8'));
  let wb = z.get('xl/workbook.xml').toString('utf8'); const ids = []; wb.replace(/<sheet\b[^>]*sheetId="(\d+)"/g, (_, i) => { ids.push(+i); return _; });
  const tag = `<sheet xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" name="${enc(name)}" sheetId="${Math.max(0, ...ids) + 1}"${hidden ? ' state="hidden"' : ''} r:id="${rid}"/>`;
  if (atStart != null && atStart !== false) {
    const list = /<sheets>([\s\S]*?)<\/sheets>/.exec(wb); const items = list[1].match(/<sheet\b[^>]*\/>/g) || []; items.splice(atStart, 0, tag);
    wb = wb.replace(list[0], () => `<sheets>${items.join('')}</sheets>`);
    wb = wb.replace(/localSheetId="(\d+)"/g, (m, i) => `localSheetId="${+i >= atStart ? +i + 1 : +i}"`);
  } else wb = wb.replace('</sheets>', tag + '</sheets>');
  z.set('xl/workbook.xml', Buffer.from(wb, 'utf8'));
  let ct = z.get('[Content_Types].xml').toString('utf8');
  if (!ct.includes(`/xl/worksheets/sheet${n}.xml`)) ct = ct.replace('</Types>', () => `<Override PartName="/xl/worksheets/sheet${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`);
  z.set('[Content_Types].xml', Buffer.from(ct, 'utf8'));
}

/* التوقيع والقفل في الجدول الأصلي: خلية دمج فارغة في صف العنوان (لا تُزاح الصفوف ولا تمسّ المعادلات والروابط)، وحماية الورقة
   مع «نطاق مسموح بتعديله» يشمل كل صفوف البيانات تحت العناوين */
function stampSource(z, D, S, prot) {
  let xml = z.get(D.sh.path).toString('utf8'); const notes = [];
  if (D.hr >= 2) {
    const lastHead = D.head.length ? D.head[D.head.length - 1][0] : 10;
    const used = new Set(); const r1 = /<row\b[^>]*\br="1"[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/.exec(xml);
    if (r1 && r1[1]) r1[1].replace(/<c\b([^>]*?)\br="([A-Z]+)1"([^>]*?)(\/>|>([\s\S]*?)<\/c>)/g, (m, a, L, b, end, inner) => { if (inner && /<(v|f|is)\b/.test(inner)) used.add(L); return m; });
    const mergedIn1 = []; xml.replace(/<mergeCell ref="([A-Z]+)(\d+):([A-Z]+)(\d+)"\/>/g, (m, a, r1s, b, r2s) => { if (+r1s <= 1 && +r2s >= 1) mergedIn1.push([colN(a), colN(b)]); return m; });
    const free = c => !used.has(colL(c)) && !mergedIn1.some(([a, b]) => c >= a && c <= b);
    /* أول مجموعة خلايا فارغة (3 أعمدة فأكثر) من بداية الصف، وإلا أطولها */
    let best = null, longest = null; for (let c = 1; c <= lastHead; c++) { if (!free(c)) continue; let e = c; while (e + 1 <= lastHead && free(e + 1)) e++; if (!best && e - c >= 2) best = [c, Math.min(e, c + 13)]; if (!longest || e - c > longest[1] - longest[0]) longest = [c, e]; c = e; }
    if (!best) best = longest;
    if (best && best[1] - best[0] >= 1) {
      const a = best[0], ref = `${colL(a)}1`, cx = `<c r="${ref}" s="${S.srcCredit}" t="inlineStr"><is><t xml:space="preserve">${enc(CREDIT)}</t></is></c>`;
      if (r1) {
        let inner = (r1[1] || '').replace(new RegExp(`<c\\b[^>]*\\br="${ref}"[^>]*?(?:\\/>|>[\\s\\S]*?<\\/c>)`), '');
        let placed = false; inner = inner.replace(/<c\b[^>]*?\br="([A-Z]+)1"/g, (m, L) => { if (!placed && colN(L) > a) { placed = true; return cx + m; } return m; }); if (!placed) inner += cx;
        const open = /^<row\b[^>]*?(?=\/?>)/.exec(r1[0])[0]; xml = xml.replace(r1[0], () => `${open}>${inner}</row>`);
      } else xml = xml.replace(/<sheetData>/, `<sheetData><row r="1">${cx}</row>`);
      const mref = `${colL(a)}1:${colL(best[1])}1`;
      xml = /<mergeCells\b/.test(xml) ? xml.replace(/<mergeCells\b([^>]*)>/, (m, at) => `<mergeCells${at.replace(/\scount="(\d+)"/, (_, n) => ` count="${+n + 1}"`)}><mergeCell ref="${mref}"/>`) : xml.replace(/(<\/sheetData>(?:<sheetCalcPr\b[^>]*\/>)?(?:<sheetProtection\b[^>]*\/>)?(?:<protectedRanges>[\s\S]*?<\/protectedRanges>)?(?:<scenarios>[\s\S]*?<\/scenarios>)?(?:<autoFilter\b[^>]*?(?:\/>|>[\s\S]*?<\/autoFilter>))?(?:<sortState\b[\s\S]*?<\/sortState>)?(?:<dataConsolidate\b[\s\S]*?<\/dataConsolidate>)?(?:<customSheetViews>[\s\S]*?<\/customSheetViews>)?)/, `$1<mergeCells count="1"><mergeCell ref="${mref}"/></mergeCells>`);
      notes.push(mref);
    }
  }
  if (prot && !/<sheetProtection\b/.test(xml)) {
    const pr = `<sheetProtection ${prot} sheet="1" objects="1" scenarios="1" formatCells="0" formatColumns="0" formatRows="0" insertRows="0" deleteRows="0" insertHyperlinks="0" sort="0" autoFilter="0" pivotTables="0"/><protectedRanges><protectedRange sqref="A${D.hr + 1}:XFD1048576" name="${enc('بيانات الجدول')}"/></protectedRanges>`;
    xml = /<sheetCalcPr\b[^>]*\/>/.test(xml) ? xml.replace(/(<sheetCalcPr\b[^>]*\/>)/, `$1${pr}`) : xml.replace('</sheetData>', () => `</sheetData>${pr}`);
  }
  z.set(D.sh.path, Buffer.from(xml, 'utf8'));
  return notes;
}
const colN = L => { let n = 0; for (const ch of L) n = n * 26 + ch.charCodeAt(0) - 64; return n; };

/* المدخل: المصنف بعد تحديث الخلايا */
function addDash(z, book, model, updates, opts = {}) {
  if (!z.has('xl/styles.xml')) return { added: [] };
  const D = []; for (const sh of book.sheets) { const meta = model.sheets[sh.name]; if (!meta || !z.has(sh.path)) continue; const d = sheetData(book, sh, meta, model, updates); if (d) D.push(d); }
  if (!D.length) return { added: [] };
  const S = addStyles(z); const prot = opts.lockPw ? pwHash(opts.lockPw) : '';
  const stamp = opts.stamp || (() => { const d = new Date(); return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`; })();
  /* الورقة المساعدة: علامة المكوّن (عمود لكل جدول بمحاذاة صفوفه) + قوائم الاختيار */
  const H = []; const setH = (r, c, v) => { (H[r - 1] = H[r - 1] || [])[c - 1] = { v }; };
  let col = 1; const lists = [];
  D.forEach(d => { d.flagCol = col; for (const r of d.comps) setH(r, col, 1); col++; });
  col++;
  D.forEach(d => {
    d.lists = {};
    d.dims.forEach(k => { const vs = [...d.vals[k].keys()].sort((a, b) => a.localeCompare(b, 'ar')); setH(1, col, ALL); vs.forEach((v, i) => setH(i + 2, col, v)); d.lists[k] = { c: col, n: vs.length + 1 }; col++; });
    d.names.forEach((v, i) => setH(i + 1, col, v)); d.lists._names = { c: col, n: Math.max(1, d.names.length) }; col++;
  });
  const helperRows = H.map(r => r ? r.map(x => x ? { v: x.v } : null) : null);
  for (let i = 0; i < helperRows.length; i++) if (!helperRows[i]) helperRows[i] = null;
  const helperXml = sheetXml({ rows: helperRows, cols: [], merges: [], prot }).replace('<sheetPr><tabColor rgb="FF1F6F50"/><pageSetUpPr fitToPage="1"/></sheetPr>', '');
  const titles = { main: 'لوحة معلومات خطة محافظة الانبار', s2: 'لوحة معلومات المنافذ الحدودية وإعادة الاستقرار' };
  const sheetNames = { main: 'لوحة الخطة', s2: 'لوحة المنافذ وإعادة الاستقرار' };
  /* إلغاء تحديد الأوراق الأخرى (حتى لا تُجمَّع مع اللوحة) */
  for (const sh of book.sheets) if (z.has(sh.path)) { const x = z.get(sh.path).toString('utf8'); if (/tabSelected="1"/.test(x)) z.set(sh.path, Buffer.from(x.replace(/\stabSelected="1"/g, ''), 'utf8')); }
  const added = []; const credits = [];
  D.forEach((d, i) => { addWs(z, sheetNames[d.meta.kind] || ('لوحة ' + d.sh.name).slice(0, 31), dashSheet(d, S, d.flagCol, d.lists, prot, titles[d.meta.kind] || ('لوحة معلومات ' + d.sh.name), stamp, i === 0), { atStart: i }); added.push(sheetNames[d.meta.kind]); });
  addWs(z, HELPER, helperXml, { atStart: null, hidden: true });
  /* الجداول الأصلية لا تُقفل (بياناتها حرّة التعديل)؛ التوقيع فقط في صف العنوان. القفل للوحتين وحدهما */
  D.forEach(d => { credits.push(...stampSource(z, d, S, '')); });
  let wb = z.get('xl/workbook.xml').toString('utf8');
  wb = wb.replace(/<workbookView\b([^>]*?)\/>/, (m, a) => `<workbookView${a.replace(/\s(activeTab|firstSheet)="\d+"/g, '')} activeTab="0"/>`);
  z.set('xl/workbook.xml', Buffer.from(wb, 'utf8'));
  return { added, locked: !!prot, credits };
}
module.exports = { addDash, CREDIT, _pwHash: pwHash };
