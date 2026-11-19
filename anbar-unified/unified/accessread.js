'use strict';
/* قراءة ملف Access (‎.accdb أو ‎.mdb) بلا Access وبلا إنترنت: مكتبة mdb-reader (MIT) مجمّعة في ملف واحد (mdb-reader.cjs).
   تُعاد صفوف جدول السلف القديم بالصيغة نفسها التي تقرؤها أداة التحويل من Excel ({اسم العمود: النص})، فتُطبَّق قواعد التحويل نفسها. */
const MDB = require('./mdb-reader.cjs');
const Reader = MDB.default || MDB;
const norm = v => {
  if (v == null) return '';
  if (v instanceof Date) return isNaN(v) ? '' : v.toISOString().slice(0, 10);
  if (typeof v === 'number') return isFinite(v) ? String(Number.isInteger(v) ? v : +v.toFixed(6)) : '';
  if (typeof v === 'bigint') return String(v);
  if (typeof v === 'boolean') return v ? '1' : '0';
  if (typeof v === 'string') return v;
  /* حقل مركّب (متعدد القيم أو مرفقات): يُعاد معرّفه. في جدول السلف القديم هذا هو عمود Engineer الذي فيه رقم الاستمارة؛
     يُكتب حرفاً رمزه هو الرقم، كما يظهر عند تصدير الجدول إلى Excel، فيفكّه التحويل بالطريقة نفسها */
  if (v && typeof v === 'object' && Number.isInteger(v.complexId)) return v.complexId > 0 && v.complexId < 0x110000 ? String.fromCodePoint(v.complexId) : '';
  return '';   // مرفقات وكائنات OLE لا تُنقل
};
/* الجداول المعروفة: السلف (tblProjects) وأوامر التغيير (Table1) */
const SPECS = {
  ad: { name: /^tblProjects$/i, cols: ['Cumulative', 'projectname'], label: 'جدول السلف القديم (tblProjects، أو جدول فيه العمودان Cumulative و projectname)', data: 'سلف مشاريع.accdb' },
  co: { name: /^Table1$/i, cols: ['PRO', 'contcost'], label: 'جدول أوامر التغيير القديم (Table1، أو جدول فيه العمودان PRO و contcost)', data: 'ملف بيانات أوامر التغيير' } };
function readAccess(buf, opts) {
  const SP = SPECS[(opts && opts.kind) || 'ad'] || SPECS.ad;
  let R;
  try { R = new Reader(buf, opts && opts.password ? { password: opts.password } : undefined); }
  catch (e) { return { error: 'تعذّر قراءة ملف Access: قد يكون محمياً بكلمة سر أو مشفّراً أو تالفاً. صدّر جدول السلف إلى Excel وأرسله للتحويل.', detail: String(e && e.message || e) }; }
  let names = []; try { names = R.getTableNames(); } catch (e) { return { error: 'تعذّر قراءة جداول الملف', detail: String(e && e.message || e) }; }
  const colsOf = n => { try { return R.getTable(n).getColumnNames(); } catch (_) { return []; } };
  const pick = names.find(n => SP.name.test(n)) || names.find(n => { const c = colsOf(n); return SP.cols.every(x => c.includes(x)); });
  if (!pick) {
    /* ملف الواجهة (النماذج فقط): جدول السلف فيه «مرتبط» بملف بيانات آخر — يُذكر مساره ليُختار ذلك الملف */
    let linked = null; try { linked = R.getTable('MSysObjects').getData({ columns: ['Name', 'Type', 'Database', 'ForeignName'] }).find(o => o.Type === 6 && (SP.name.test(String(o.Name)) || SP.name.test(String(o.ForeignName)))); } catch (_) {}
    if (linked) return { error: 'هذا ملف الواجهة (النماذج) للبرنامج القديم، والجدول فيه مرتبط بملف بيانات آخر:\n' + (linked.Database || '(مسار غير معروف)') + '\n\nاختر ملف البيانات ذاك (' + SP.data + ') للاستيراد.', linked: linked.Database || '', tables: names };
    return { error: 'لا يوجد في الملف ' + SP.label + '.', tables: names };
  }
  const t = R.getTable(pick), rows = t.getData().map(o => { const x = {}; for (const k of Object.keys(o)) x[k] = norm(o[k]); return x; });
  return { table: pick, tables: names, rows };
}
module.exports = { readAccess, norm };
