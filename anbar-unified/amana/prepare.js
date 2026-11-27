/* am.html مصدره هذا المجلد؛ وينسخ من البرنامج الموحد محرر المخاطبات (lt.html — وضع aml فيه لا يظهر في الموحد) وكاتب Excel وحدود الأقضية الى هذا البرنامج المستقل قبل التشغيل أو البناء:
   app/am.html (المشاريع)، app/lt.html (محرر المخاطبات بوضع aml)، shell/xlwriter.js (Excel)، shell/anbar-geo.js (حدود الأقضية) */
const fs = require('fs'), path = require('path');
const U = path.join(__dirname, '..', 'unified');
fs.mkdirSync(path.join(__dirname, 'app'), { recursive: true }); fs.copyFileSync(path.join(__dirname, 'am.html'), path.join(__dirname, 'app', 'am.html'));   // صفحة المشاريع: مصدرها هنا
for (const [from, to] of [['app/lt.html', 'app/lt.html'], ['shell/xlwriter.js', 'shell/xlwriter.js'], ['shell/anbar-geo.js', 'shell/anbar-geo.js']]) {
  const d = path.join(__dirname, to); fs.mkdirSync(path.dirname(d), { recursive: true }); fs.copyFileSync(path.join(U, from), d);
}
console.log('prepared');
