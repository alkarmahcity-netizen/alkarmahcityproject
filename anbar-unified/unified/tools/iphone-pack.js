'use strict';
/* صفحة iPhone لـ Google Apps Script: الشيفرة الرئيسية تُحزم Base64 (حروف وأرقام فقط) وتُفك داخل الهاتف،
   فلا تُفسدها معالجة HtmlService ولا النسخ واللصق (ظهر «SyntaxError: Unexpected EOF» في Safari مع الشيفرة الصريحة).
   الاستعمال: node tools/iphone-pack.js  ← iphone/build/index.html (هو الملف الذي يُلصق في Apps Script) */
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'iphone', 'index.html'), 'utf8');
const re = /<script>\n\/\* صفحة الاطلاع \(iPhone\)[\s\S]*?<\/script>/;
const m = re.exec(src); if (!m) throw new Error('main script not found');
const code = m[0].replace(/^<script>\n/, '').replace(/<\/script>$/, '');
const b64 = Buffer.from(code, 'utf8').toString('base64').replace(/.{1,100}/g, s => s + '\n');
const loader = `<script id="appb64" type="text/plain">\n${b64}</script>
<script>
/* الشيفرة محزومة (Base64) — تُفك وتُشغَّل هنا. المصدر المقروء: iphone/index.html في البرنامج */
(function(){try{var s=document.getElementById('appb64').textContent.replace(/[^A-Za-z0-9+\\/=]/g,'');var b=atob(s),u=new Uint8Array(b.length);for(var i=0;i<b.length;i++)u[i]=b.charCodeAt(i);
  var c=new TextDecoder('utf-8').decode(u);var n=(c.match(/\\n/g)||[]).length;window.__APP_LINES=n;(0,eval)(c+'\\n//# sourceURL=app.js');}
 catch(e){var u2=document.getElementById('upd');if(u2){u2.className='upd bad';u2.textContent='⚠ خطأ في الصفحة: '+(e&&e.message||e)+' — تأكد أن ملف index لُصق كاملاً (آخره </html>)';}}})();
</script>`;
const out = src.replace(re, () => loader);
const dir = path.join(__dirname, '..', 'iphone', 'build'); fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'index.html'), out);
console.log('iphone/build/index.html', out.length, 'bytes,', out.split('\n').length, 'lines; code', code.length);
