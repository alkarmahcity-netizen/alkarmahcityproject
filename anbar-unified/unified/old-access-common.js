// أدوات مشتركة لتحويل جداول Access القديمة (السلف وأوامر التغيير) المصدَّرة إلى Excel
'use strict';
const path = require('path');
const X = require(require('fs').existsSync(path.join(__dirname, 'xlmerge.js')) ? path.join(__dirname, 'xlmerge.js') : path.join(__dirname, '..', 'unified', 'xlmerge.js'));   // داخل البرنامج الموحد تكون بجانبه

/* قراءة الورقة الأولى صفوفاً {عنوان العمود: النص} */
function readRows(buf) {
  const B = X.readBook(buf, 'old'), I = X.sheetInfo(B, B.sheets[0]);
  return I.data.map(r => { const o = {}; for (const c of I.rows.get(r).cells) { const k = I.head[c.c]; if (k) o[k] = X.cellText(B, c); } return o; });
}
/* النص: فك ترميز Excel للمحارف الخاصة (_x000d_ سطر جديد، _x001a_ محرف تحكم)، وحذف محارف التحكم، وتوحيد المسافات */
const decodeX = s => String(s == null ? '' : s).replace(/_x([0-9A-Fa-f]{4})_/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
const T = v => decodeX(v).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
const TL = v => decodeX(v).replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, ' ').split('\n').map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n');
const N = v => { const n = parseFloat(String(v == null ? '' : v).replace(/[^\d.\-]/g, '')); return isFinite(n) ? n : 0; };
const has = v => T(v) !== '';
const RN = X.RN;
const nk = s => RN(T(s)).replace(/[^ء-ي0-9]/g, '');
/* التاريخ: رقم Excel التسلسلي، أو سنة/شهر/يوم، أو يوم/شهر/سنة. والتاريخ غير المعقول (ساعة حاسبة خاطئة: 2051، 2085) يُترك فارغاً */
function iso(v) {
  v = T(v); if (!v) return '';
  if (/^\d{5}(\.\d+)?$/.test(v)) { const n = +v; if (n > 20000 && n < 80000) return okY(new Date(Date.UTC(1899, 11, 30) + Math.floor(n) * 864e5).toISOString().slice(0, 10)); }
  let m = v.match(/(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/); if (m) return okY(`${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`);
  m = v.match(/(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})/); return m ? okY(`${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`) : '';
}
function okY(d) { const y = +d.slice(0, 4), mo = +d.slice(5, 7), da = +d.slice(8, 10); return y >= 1990 && y <= new Date().getFullYear() + 1 && mo >= 1 && mo <= 12 && da >= 1 && da <= 31 ? d : ''; }
/* «( 14420 ) في 2022/6/28» أو «22193 في 9/10/2023 وملحقة ذي العدد 787 في 11/1/2024» → العدد والتاريخ والباقي */
function numDate(v) {
  v = T(v); const m = v.match(/^\(?\s*([\d\/\-]+)\s*\)?\s*في\s*([\d\/\-.]+)\s*(.*)$/);
  return m ? { no: m[1], date: iso(m[2]), rest: m[3].trim() } : { no: /^\d+$/.test(v) ? v : '', date: '', rest: /^\d+$/.test(v) ? '' : v };
}
/* تشابه اسمين (ثنائيات الحروف) */
function dice(a, b) {
  if (!a || !b) return 0; if (a === b) return 1;
  const g = s => { const m = new Map(); for (let i = 0; i < s.length - 1; i++) { const k = s.substr(i, 2); m.set(k, (m.get(k) || 0) + 1); } return m; };
  const A = g(a), B = g(b); let x = 0; for (const [k, n] of A) x += Math.min(n, B.get(k) || 0);
  return 2 * x / Math.max(1, a.length - 1 + b.length - 1);
}
const prefixOf = (a, b) => { const [s, l] = a.length <= b.length ? [a, b] : [b, a]; return s.length >= 15 && l.startsWith(s); };
const similar = (a, b, th = 0.72) => !!a && !!b && (a === b || prefixOf(a, b) || dice(a, b) >= th);
/* اتحاد المجموعات */
function DSU(n) { const p = Array.from({ length: n }, (_, i) => i); const f = x => (p[x] === x ? x : (p[x] = f(p[x]))); return { find: f, union: (a, b) => { a = f(a); b = f(b); if (a !== b) p[Math.max(a, b)] = Math.min(a, b); } }; }
/* القيمة الأكثر تكراراً (والأحدث عند التساوي) */
function mode(vals) { const c = new Map(); vals.forEach((v, i) => { if (v === '' || v == null) return; const e = c.get(v) || { n: 0, last: 0 }; e.n++; e.last = i; c.set(v, e); }); let best = '', bn = -1, bl = -1; for (const [v, e] of c) if (e.n > bn || (e.n === bn && e.last > bl)) { best = v; bn = e.n; bl = e.last; } return best; }
const lastOf = vals => { for (let i = vals.length - 1; i >= 0; i--) if (vals[i] !== '' && vals[i] != null) return vals[i]; return ''; };
module.exports = { X, readRows, decodeX, T, TL, N, has, RN, nk, iso, numDate, dice, similar, prefixOf, DSU, mode, lastOf };
