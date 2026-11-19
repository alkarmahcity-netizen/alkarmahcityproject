'use strict';
/* «تحديث نسب الإنجاز في ملف التخطيط» (ملف تخصيصات المحافظة / مشاريع التخطيط):
   - القراءة: الأوراق التي فيها «اسم المشروع» و«نسبة الإنجاز الفني» (= الفعلي عندنا) و«نسبة الإنجاز المخطط» — أول عمود من كل نوع
     (في «مشاريع مستمرة»: H و I، وفي «متوقف بسبب عدم صرف المستحقات»: L و K). الأعمدة تُعرف بعناوينها لا بمواقعها.
   - الربط بمشاريع الموقف: لا يوجد رقم اضبارة في الملف، فالربط باسم المشروع ويؤكَّد باسم الشركة؛ وما لا يتأكد يُعرض للتأكيد ولا يُكتب تلقائياً.
     الربط المؤكَّد يُحفظ (اسم المشروع في الملف ← رقم الاضبارة) فتكون المرات القادمة تلقائية.
   - الكتابة: نسخة من الملف نفسه تتغير فيها خلايا النسب فقط (exportBook: لا تُمس خلية معادلة، والأوراق والتنسيق والدمج كما هي)،
     مع ورقة «التغييرات» (القديم ← الجديد).
   - المبالغ (من الموقف العام): «مبلغ العقد بعد التغيير» = مبلغ العقد + أوامر التغيير، و«مجموع اوامر التغيير» (ورقة Projects)،
     و«مبلغ العقد» يُملأ إن كان فارغاً فقط. مبلغ العقد ورقم العقد يؤكدان الربط، واختلافهما يُعرض («فروقات») ولا يُكتب فوقه.
   - مطابقة المكوّن كاملة (1.62.0): مبلغ العقد، مبلغ أوامر التغيير، الكلفة الكلية بعد الأوامر، تاريخ المباشرة، المخطط، الفعلي، الإحداثيات،
     مدة العقد، المدد الإضافية، المدة الكلية — للمكوّنات فقط (صف بلا شركة ولا رقم عقد = مشروع تخطيطي فلا يُمس).
     الحقل الذي لا عمود له في الورقة يُضاف عموداً جديداً في آخرها (بعنوانه) في الملف المُخرج. */
const X = require('./xlmerge');
const P = require('./planning');
const { readBook, sheetInfo, cellText, RN } = X;

const toEn = s => String(s == null ? '' : s).replace(/[٠-٩]/g, d => d.charCodeAt(0) - 1632).replace(/[۰-۹]/g, d => d.charCodeAt(0) - 1776);
const numOf = v => { const t = toEn(v).replace(/[,٬\s]/g, '').replace(/٫/g, '.'); const pc = /%$/.test(t); const x = t.replace(/%$/, ''); if (!x || !/^-?\d+(\.\d+)?(e[-+]?\d+)?$/i.test(x)) return null; const n = +x; return isFinite(n) ? { n, pc } : null; };
const STOPW = /(^| )(شركه|شركة|مكتب|للمقاولات|المقاولات|للمقاولات العامه|العامه|المحدوده|والتجاره|التجاره|التجاريه|والاستثمارات|الهندسيه|للتجاره|العامة|المحدودة)(?= |$)/g;
const K = s => RN(String(s == null ? '' : s)).toLowerCase().replace(/[^ء-ي0-9a-z]+/g, ' ').replace(/ +/g, ' ').trim();
const KN = s => K(s).replace(/ /g, '');                          /* مفتاح الاسم: بلا مسافات ولا علامات */
const KC = s => K(s).replace(STOPW, ' ').replace(/ +/g, ' ').trim().replace(/ /g, '');
function dice(a, b) { if (!a || !b) return 0; if (a === b) return 1; const g = s => { const m = new Map(); for (let i = 0; i < s.length - 1; i++) { const t = s.substr(i, 2); m.set(t, (m.get(t) || 0) + 1); } return m; }; const A = g(a), B = g(b); let x = 0; for (const [t, n] of A) x += Math.min(n, B.get(t) || 0); return 2 * x / Math.max(1, a.length + b.length - 2); }
function coOk(a, b) { a = KC(a); b = KC(b); if (!a || !b) return null; if (a.includes(b) || b.includes(a)) return true; return a.split('+').some(x => x && dice(x, b) >= 0.75) || dice(a, b) >= 0.75; }
/* أقضية ونواحي المحافظة: اسمان متقاربان في قضاءين مختلفين = مشروعان مختلفان (يُعرض للتأكيد) */
const PLACES = ['الرمادي', 'الفلوجه', 'هيت', 'حديثه', 'عنه', 'راوه', 'القائم', 'الرطبه', 'الكرمه', 'العامريه', 'الصقلاويه', 'الحبانيه', 'الخالديه', 'البغدادي', 'الوفاء', 'كبيسه', 'الحقلانيه', 'بروانه', 'العبيدي', 'الكرابله', 'النخيب', 'الفرات', 'العامريه'].map(K);
const placesOf = s => { const t = ' ' + K(s) + ' '; return new Set(PLACES.filter(p => t.includes(' ' + p + ' ') || t.includes(' ' + p.replace(/^ال/, '') + ' '))); };
const placeClash = (a, b) => { const A = placesOf(a), B = placesOf(b); if (!A.size || !B.size) return false; for (const x of A) if (B.has(x)) return false; return true; };
const RE = { name: /^اسم المشروع$/, co: /^اسم الشركه/, act: /الانجا[زر] الفني/, plan: /الانجا[زر] .*المخطط|المخطط/, orig: /^الكلفه الكليه \(مبلغ العقد\)$|^مبلغ العقد$|^مبلغ الاحاله$/, tot: /^مبلغ العقد بعد التغيير$|^الكلفه الكليه بعد اوامر التغيير$/, no: /^رقم العقد$/, coSum: /^مجموع اوامر التغيير$|^مبلغ اوامر التغيير$/,
  start: /^تاريخ المباشره$/, coords: /^الاحداثيات$|^الإحداثيات$/, dur: /^مده التنفيذ$|^مده العقد/, extra: /^المده المضافه$|^المدد الاضافيه/, totalDays: /^المده الكليه/ };
/* الحقول المطابَقة للمكوّن (بالترتيب) وعناوين الأعمدة التي تُضاف إن لم توجد */
const FIELDS = [['orig', 'مبلغ العقد'], ['coSum', 'مبلغ اوامر التغيير'], ['tot', 'الكلفة الكلية بعد اوامر التغيير'], ['start', 'تاريخ المباشرة'], ['plan', 'نسبة الإنجاز المخطط'], ['act', 'نسبة الانجاز الفعلي'], ['coords', 'الاحداثيات'], ['dur', 'مدة العقد (يوم)'], ['extra', 'المدد الاضافية (يوم)'], ['totalDays', 'المدة الكلية (يوم)']];
const FLABEL = Object.fromEntries(FIELDS);
const YEAR_OLD = n => { const y = (String(n).match(/20\d\d/g) || []).map(Number); const cur = new Date().getFullYear(); return y.length && y.every(v => v < cur - 1) ? true : /كانون|الخلاصه|الخلاصة|pro20/i.test(String(n)) && y.length > 0; };

function parse(buf, label) {
  const book = readBook(buf, label); const sheets = [];
  for (const sh of book.sheets) {
    let I; try { I = sheetInfo(book, sh); } catch (_) { continue; }
    if (!I || I.hr == null) continue;
    const cols = {}; const ks = Object.keys(I.head).map(Number).sort((a, b) => a - b);
    for (const k of ['name', 'co', 'act', 'plan', 'orig', 'tot', 'no', 'coSum', 'start', 'coords', 'dur', 'extra', 'totalDays']) for (const c of ks) { const h = RN(I.head[c]); if (RE[k].test(h) && !Object.values(cols).includes(c) && !(k === 'plan' && RE.act.test(h))) { cols[k] = c; break; } }
    if (!cols.name || !cols.act || !cols.plan) continue;
    const rows = []; const vals = { act: [], plan: [], orig: [], tot: [], coSum: [], dur: [], extra: [], totalDays: [] };
    let maxC = 0; for (const [, rw] of I.rows) for (const c of rw.cells) if (c.c > maxC) maxC = c.c;
    for (const r of I.data) {
      const row = I.rows.get(r); if (!row) continue; const at = c => row.cells.find(x => x.c === c);
      const nm = cellText(book, at(cols.name)).replace(/\s+/g, ' ').trim(); if (!nm || /^(المجموع|الاجمالي|الإجمالي|المجموع الكلي)$/.test(RN(nm))) continue;
      const rd = k => { if (!cols[k]) return { v: null, pc: false, f: false }; const cl = at(cols[k]); const v = numOf(cellText(book, cl)); if (v) vals[k].push(v.n); return { v: v ? v.n : null, pc: v ? v.pc : false, f: !!(cl && cl.f) }; };
      const co = cols.co ? cellText(book, at(cols.co)).replace(/\s+/g, ' ').trim() : '', no = cols.no ? toEn(cellText(book, at(cols.no))).replace(/\s+/g, '').trim() : '';
      if ((cols.co || cols.no) && !co && !no) continue;   /* مشروع تخطيطي (لا مكوّن): بلا شركة ولا رقم عقد */
      const tx = k => { if (!cols[k]) return { t: '', f: false }; const cl = at(cols[k]); return { t: cellText(book, cl).trim(), f: !!(cl && cl.f) }; };
      rows.push({ row: r, name: nm, co, no, act: rd('act'), plan: rd('plan'), orig: rd('orig'), tot: rd('tot'), coSum: rd('coSum'), dur: rd('dur'), extra: rd('extra'), totalDays: rd('totalDays'), start: tx('start'), coords: tx('coords') });
    }
    /* صيغة الإحداثيات في الورقة: «N33.35 E43.90» أو «33.35, 43.90» — تُكتب الجديدة بالصيغة نفسها */
    const ct = rows.map(x => x.coords.t).filter(Boolean), coordFmt = ct.length && ct.filter(t => /[NnSs]\s*-?\d/.test(t) && /[EeWw]\s*-?\d/.test(t)).length >= ct.length / 2 ? 'NE' : 'plain';
    const scale = {}; for (const k of ['act', 'plan']) { const v = vals[k].filter(x => x > 0); scale[k] = v.length && v.filter(x => x <= 1.0001).length >= v.length * 0.8 ? 'frac' : 'pct'; }
    /* الأعمدة الجديدة (تُستعمل فقط إن احتاجها صف مطابَق) في آخر الورقة */
    const add = {}; let nc = maxC; for (const [k] of FIELDS) if (!cols[k]) add[k] = ++nc;
    sheets.push({ name: sh.name, hr: I.hr, add, coordFmt, allLetters: Object.fromEntries(FIELDS.map(([k]) => [k, colL(cols[k] || add[k])])), cols, letters: { act: colL(cols.act), plan: colL(cols.plan), name: colL(cols.name), orig: cols.orig ? colL(cols.orig) : '', tot: cols.tot ? colL(cols.tot) : '', no: cols.no ? colL(cols.no) : '', coSum: cols.coSum ? colL(cols.coSum) : '' }, head: { act: I.head[cols.act], plan: I.head[cols.plan], orig: I.head[cols.orig] || '', tot: I.head[cols.tot] || '', coSum: I.head[cols.coSum] || '' }, scale, old: YEAR_OLD(sh.name), rows });
  }
  return { file: label, sheets };
}
const colL = n => { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
const toPct = (v, sc) => v == null || v.v == null ? null : sc === 'frac' && !v.pc && v.v <= 1.5 ? Math.round(v.v * 10000) / 100 : v.v;
/* رقم العقد: الرقم قبل «/» (الموقف قد يحمل السنة: «226 / 2023»، وملف التخطيط الرقم وحده) */
const noKey = v => { const m = /\d+/.exec(toEn(v)); return m ? String(+m[0]) : ''; };
const pnum = v => { const x = numOf(v); return x ? x.n : null; };

/* projects: مشاريع الموقف [{fileNo,name,contractor,actualPct,planPct}]، links: {مفتاح الاسم في الملف: رقم الاضبارة} */
function match(model, projects, links = {}) {
  const PJ = (projects || []).filter(p => p && p.fileNo != null && String(p.name || '').trim()).map(p => ({ p, kn: KN(p.name) }));
  const byFn = new Map(PJ.map(x => [String(x.p.fileNo), x]));
  /* فهرس الكلمات: المقارنة التفصيلية بالمشاريع التي تشترك مع الصف في كلمتين في الأقل (سريع مع مئات المشاريع وآلاف الصفوف) */
  const W = s => [...new Set(K(s).split(' ').filter(w => w.length >= 3))];
  const idx = new Map(), exact = new Map(); PJ.forEach((x, i) => { x.w = W(x.p.name); x.w.forEach(w => { if (!idx.has(w)) idx.set(w, []); idx.get(w).push(i); }); if (!exact.has(x.kn)) exact.set(x.kn, x); });
  const near = nm => { const cnt = new Map(); for (const w of W(nm)) for (const i of (idx.get(w) || [])) cnt.set(i, (cnt.get(i) || 0) + 1); const out = []; for (const [i, n] of cnt) if (n >= 2 || PJ[i].w.length < 2) out.push(PJ[i]); return out; };
  const out = [];
  for (const sh of model.sheets) {
    const cand = [];
    for (const r of sh.rows) {
      const kn = KN(r.name); let best = null, why = '';
      const lk = links[sh.name + '|' + kn] || links['*|' + kn];
      if (lk && byFn.has(String(lk))) { best = { x: byFn.get(String(lk)), s: 1 }; why = 'link'; }
      else if (exact.has(kn)) best = { x: exact.get(kn), s: 1 };
      else for (const x of near(r.name)) { const s = dice(kn, x.kn); if (s >= 0.72 && (!best || s > best.s)) best = { x, s }; }
      if (!best) continue;
      const co = coOk(r.co, best.x.p.contractor);
      const clash = why !== 'link' && best.s < 1 && placeClash(r.name, best.x.p.name);
      const sure = why === 'link' || (best.s >= 0.9 && co !== false && !clash);
      /* مبلغ العقد ورقم العقد: يؤكدان الربط أو يشككان فيه */
      const po = pnum(best.x.p.orig), ro = r.orig.v, origEq = po > 0 && ro > 0 && Math.abs(po - ro) < 1, origDiff = po > 0 && ro > 0 && !origEq;
      const pn = noKey(best.x.p.contractNo), rn = noKey(r.no), noEq = !!(pn && rn && pn === rn), noDiff = !!(pn && rn && pn !== rn);
      let ok = sure, w = why || (sure ? '' : clash ? 'القضاء مختلف' : co === false ? 'الشركة مختلفة' : 'الاسم متقارب لا مطابق'), via = '';
      if (!ok && why !== 'link' && origEq && (noEq || (best.s >= 0.8 && co !== false && !clash))) { ok = true; w = ''; via = noEq ? 'مبلغ العقد ورقمه' : 'مبلغ العقد'; }
      else if (ok && why !== 'link' && origDiff && !noEq) { ok = false; w = 'مبلغ العقد مختلف'; }
      cand.push({ r, x: best.x, s: best.s, co, sure: ok, why: w, via, origEq, origDiff, noEq, noDiff });
    }
    /* مشروع واحد ← صف واحد في الورقة (الأعلى تطابقاً) */
    const taken = new Map(); cand.sort((a, b) => (b.sure - a.sure) || (b.s - a.s));
    for (const c of cand) {
      const fn = String(c.x.p.fileNo); if (taken.has(fn)) continue; taken.set(fn, 1);
      const T0 = { t: '', f: false }, N0 = { v: null, pc: false, f: false }; ['start', 'coords'].forEach(k => { if (!c.r[k]) c.r[k] = T0; }); ['dur', 'extra', 'totalDays', 'orig', 'tot', 'coSum'].forEach(k => { if (!c.r[k]) c.r[k] = N0; });
      const p = c.x.p, na = pnum(p.actualPct), np = pnum(p.planPct), oa = toPct(c.r.act, sh.scale.act), op = toPct(c.r.plan, sh.scale.plan);
      /* صفر في الموقف فوق نسبة موجودة في الملف = حقل غير مملوء عندنا غالباً: لا يُكتب */
      const z0A = na === 0 && oa > 0, z0P = np === 0 && op > 0, e0A = na === 0 && oa == null, e0P = np === 0 && op == null;   /* ولا يُكتب صفر في خلية فارغة */
      const dA = na != null && !z0A && !e0A && (oa == null || Math.abs(oa - na) >= 0.05) && !c.r.act.f, dP = np != null && !z0P && !e0P && (op == null || Math.abs(op - np) >= 0.05) && !c.r.plan.f;
      /* المبالغ من الموقف العام */
      const po = pnum(p.orig), pc = pnum(p.changeCost) || 0, pt = pnum(p.total), nT = pt > 0 ? pt : po > 0 ? po + pc : null;
      const oT = c.r.tot.v, oC = c.r.coSum.v, oO = c.r.orig.v;
      const chTot = !!(nT > 0 && !c.r.tot.f && (oT == null || Math.abs(oT - nT) >= 1));
      const chCo = !!(pc > 0 && !c.r.coSum.f && (oC == null || Math.abs(oC - pc) >= 1));
      /* مبلغ العقد: يُملأ إن كان فارغاً؛ وإن اختلف فالمشروع «للتأكيد» ويُكتب مبلغ الموقف إن أكّده الموظف */
      const chOrig = !!(po > 0 && !c.r.orig.f && (oO == null || Math.abs(oO - po) >= 1));
      const flags = []; const f$ = v => Math.round(v).toLocaleString('en-US');
      if (c.origDiff) flags.push(`مبلغ العقد: في الملف ${f$(oO)} ≠ في الموقف ${f$(po)}`);
      if (c.noDiff) flags.push(`رقم العقد: في الملف (${c.r.no}) ≠ في الموقف (${toEn(p.contractNo).trim()})`);
      if (c.r.tot.f && nT > 0 && oT != null && Math.abs(oT - nT) >= 1) flags.push('«مبلغ العقد بعد التغيير» في الملف معادلة — لا يُغيَّر');
      /* بقية بيانات المكوّن: تاريخ المباشرة، الإحداثيات، المدد — من الموقف العام */
      const more = [];   /* [{k, label, old, neu, newCol}] */
      const iso = v => { const t = String(v || '').trim(); let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(t); if (m) return `${m[1]}-${String(+m[2]).padStart(2, '0')}-${String(+m[3]).padStart(2, '0')}`; m = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/.exec(toEn(t)); if (m) return `${m[3]}-${String(+m[2]).padStart(2, '0')}-${String(+m[1]).padStart(2, '0')}`; const n = +toEn(t); if (n > 20000 && n < 80000) { const d = new Date(Date.UTC(1899, 11, 30) + n * 864e5); return d.toISOString().slice(0, 10); } return ''; };
      const dmyS = s0 => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s0 || ''); return m ? `${+m[3]}/${+m[2]}/${m[1]}` : ''; };
      const ps = iso(p.start), os = iso(c.r.start.t);
      if (ps && !c.r.start.f && ps !== os) more.push({ k: 'start', old: c.r.start.t ? (dmyS(os) || c.r.start.t) : '', neu: ps, show: dmyS(ps) });
      if (ps && os && ps !== os && ps.slice(0, 4) === os.slice(0, 4) && ps.slice(5, 7) === os.slice(8, 10) && ps.slice(8, 10) === os.slice(5, 7)) flags.push(`تاريخ المباشرة: اليوم والشهر معكوسان بين الملف (${dmyS(os)}) والموقف (${dmyS(ps)}) — تأكّد أيهما الصحيح`);
      const la = pnum(p.lat), lo = pnum(p.lng);
      /* الإحداثيات: تُملأ الخلية الفارغة فقط (بصيغة الورقة)؛ الموجودة لا يُكتب فوقها، وإن بعدت عن الموقف أكثر من 300 م تُنبَّه بالمسافة */
      if (la && lo && !c.r.coords.f) { const have = c.r.coords.t, want = sh.coordFmt === 'NE' ? `N${la} E${lo}` : `${la}, ${lo}`;
        if (!have) more.push({ k: 'coords', old: '', neu: want, show: want });
        else { const hn = (toEn(have).match(/-?\d+(\.\d+)?/g) || []).map(Number).filter(v => v > 20 && v < 60);
          if (hn.length >= 2) { const [a1, b1] = hn[0] < hn[1] ? [hn[0], hn[1]] : [hn[1], hn[0]], [a2, b2] = la < lo ? [la, lo] : [lo, la];
            const dm = Math.round(6371000 * Math.hypot((a2 - a1) * Math.PI / 180, (b2 - b1) * Math.PI / 180 * Math.cos(a1 * Math.PI / 180)));
            if (dm > 300) flags.push(`الإحداثيات في الملف (${have.replace(/\s+/g, ' ')}) تبعد ${dm.toLocaleString('en-US')} م عن الموقف (${la}, ${lo}) — لم تُغيَّر، تحقّق منها`); } } }
      for (const k of ['dur', 'extra', 'totalDays']) { const nv = pnum(p[k]), ov = c.r[k].v; if (nv == null || c.r[k].f) continue; if (nv === 0 && (ov == null || ov > 0)) continue; if (ov != null && Math.abs(ov - nv) < 0.5) continue; more.push({ k, old: ov == null ? '' : String(ov), neu: nv, show: String(nv) }); }
      more.forEach(x => { x.label = FLABEL[x.k]; x.newCol = !sh.cols[x.k]; });
      const newCols = [...new Set([chOrig && !sh.cols.orig ? 'orig' : '', chCo && !sh.cols.coSum ? 'coSum' : '', chTot && !sh.cols.tot ? 'tot' : ''].filter(Boolean).concat(more.filter(x => x.newCol).map(x => x.k)))];
      out.push({ sheet: sh.name, row: c.r.row, rname: c.r.name, rco: c.r.co, fileNo: fn, pname: String(p.name || ''), pco: String(p.contractor || ''), score: Math.round(c.s * 100), coOk: c.co, sure: c.sure, why: c.why, via: c.via, link: c.why === 'link',
        oldAct: oa, oldPlan: op, newAct: na, newPlan: np, chAct: dA, chPlan: dP, fAct: c.r.act.f, fPlan: c.r.plan.f, z0Act: z0A, z0Plan: z0P,
        oldTot: oT, newTot: nT, chTot, oldCo: oC, newCo: pc || null, chCo, oldOrig: oO, newOrig: po, chOrig, flags, more, newCols,
        ch: dA || dP || chTot || chCo || chOrig || more.length > 0, key: sh.name + '|' + KN(c.r.name) });
    }
  }
  return out;
}

/* updates: [{sheet,row,label,act,plan,tot,coSum,orig}] — النسب بالمئة (0–100) كما في الموقف، والمبالغ بالدينار */
function exportBook(buf, model, updates, opts = {}) {
  const m = { sheets: {} };
  const KEY = { act: 'actPct', plan: 'planPct' }, kk = k => KEY[k] || k;
  const need = {}; (updates || []).forEach(u => FIELDS.forEach(([k]) => { if (u[k] != null && u[k] !== '') (need[u.sheet] = need[u.sheet] || new Set()).add(k); }));
  const heads = [];
  for (const sh of model.sheets) { const cols = {}, head = {};
    for (const [k, lab] of FIELDS) { const c = sh.cols[k] || ((need[sh.name] && need[sh.name].has(k)) ? sh.add[k] : 0); if (!c) continue; cols[kk(k)] = c; head[kk(k)] = sh.cols[k] ? (sh.head[k] || lab) : lab; if (!sh.cols[k]) heads.push({ sheet: sh.name, row: sh.hr, label: 'عنوان عمود جديد', set: { [kk(k)]: lab } }); }
    m.sheets[sh.name] = { cols, head, scale: { actPct: sh.scale.act, planPct: sh.scale.plan } }; }
  const ups = heads.concat((updates || []).filter(u => m.sheets[u.sheet] && u.row).map(u => { const set = {};
    for (const [k] of FIELDS) { const v = u[k]; if (v == null || v === '') continue;
      if (k === 'act' || k === 'plan') set[kk(k)] = +v; else if (k === 'orig' || k === 'tot' || k === 'coSum') { if (+v > 0) set[k] = Math.round(+v); } else if (k === 'dur' || k === 'extra' || k === 'totalDays') set[k] = +v; else set[k] = String(v); }
    return { sheet: u.sheet, row: +u.row, label: u.label || '', set }; }));
  return P.exportBook(buf, m, ups, { dash: false, keepDates: true, highlight: opts.highlight !== false, now: opts.now });
}
module.exports = { parse, match, exportBook, KN, FIELDS, K, dice, coOk, placeClash, noKey, numOf };
