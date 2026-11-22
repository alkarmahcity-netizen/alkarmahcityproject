// يولّد shell/flow-legacy.js (لوحة سير المعاملات لمتصفحات تلفاز القاعة القديمة) من shell/flow.js:
// الشيفرة محوّلة إلى ES2015 بمحوّل TypeScript الموجود في المشروع، ويبقى سدّ الدوال الحديثة في أول الملف كما هو.
// الاستعمال: node tools/flow-legacy.js   (بعد أي تعديل في shell/flow.js)
const fs = require('fs'), path = require('path'), crypto = require('crypto'), ts = require('typescript');
const D = path.join(__dirname, '..', 'shell'), src = fs.readFileSync(path.join(D, 'flow.js'), 'utf8'), old = fs.readFileSync(path.join(D, 'flow-legacy.js'), 'utf8');
const head = old.slice(0, old.indexOf('/* src-sha1'));
const out = ts.transpileModule(src, { compilerOptions: { target: ts.ScriptTarget.ES2015, module: ts.ModuleKind.None } }).outputText;
fs.writeFileSync(path.join(D, 'flow-legacy.js'), head + '/* src-sha1: ' + crypto.createHash('sha1').update(src).digest('hex') + ' */\n' + out);
console.log('flow-legacy.js ←', out.length, 'bytes');
