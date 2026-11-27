/* ينسخ صفحات النظام من البرنامج الموحد (المصدر الواحد) الى هذا البرنامج المستقل قبل التشغيل أو البناء:
   app/am.html (المشاريع)، app/lt.html (محرر المخاطبات بوضع aml)، shell/xlwriter.js (Excel)، shell/anbar-geo.js (حدود الأقضية) */
const fs = require('fs'), path = require('path');
const U = path.join(__dirname, '..', 'unified');
for (const [from, to] of [['app/am.html', 'app/am.html'], ['app/lt.html', 'app/lt.html'], ['shell/xlwriter.js', 'shell/xlwriter.js'], ['shell/anbar-geo.js', 'shell/anbar-geo.js']]) {
  const d = path.join(__dirname, to); fs.mkdirSync(path.dirname(d), { recursive: true }); fs.copyFileSync(path.join(U, from), d);
}
console.log('prepared');
