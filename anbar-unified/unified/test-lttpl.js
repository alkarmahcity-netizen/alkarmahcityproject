// اختبار المخاطبات: القوالب في مستطيل مستقل بقائمة منسدلة وتسمية مرجعية + مسافة التوقيع 3–50 ملم + شريط تمرير التبويبات أسمك
const { _electron: electron } = require('playwright');
const fs = require('fs'), path = require('path'), os = require('os');
const T = path.join(os.tmpdir(), 'uni-lttpl'); fs.rmSync(T, { recursive: true, force: true });
const mk = n => { const d = path.join(T, n); fs.mkdirSync(d, { recursive: true }); return d; }; const sleep = ms => new Promise(r => setTimeout(r, ms));
const R = []; const ok = (n, c, d = '') => R.push([c ? 'PASS' : 'FAIL', n, d]);
(async () => {
  const app = await electron.launch({ executablePath: require('electron'), args: ['--no-sandbox', __dirname], env: { ...process.env, UNI_MULTI: mk('u'), UNI_DATA_DIR: mk('d'), ANBAR_REG_DIR: mk('r'), UNI_AC_PORT: '48455', UNI_NO_JSONSCAN: '1', UNI_NO_LINKREFRESH: '1' } });
  const pg = await app.firstWindow(); await pg.waitForLoadState('domcontentloaded'); await sleep(1500);
  const sb = await pg.evaluate(() => { const t = document.getElementById('tabs'); return [...document.styleSheets].some(ss => { try { return [...ss.cssRules].some(r => /\.tabs::-webkit-scrollbar/.test(r.selectorText || '') && /height:\s*12px/.test(r.cssText)); } catch (_) { return false; } }); });
  ok('top systems tab bar: scrollbar is thicker (12px instead of 4px)', sb);
  await pg.evaluate(() => window.desktop.go('lt')); await sleep(2500);
  const lt = c => app.evaluate(async (_, c) => global.__uni.views.lt.webContents.executeJavaScript(c), c);
  // ثلاثة قوالب: مطالعتان وكتاب
  for (const [t, subj, name] of [['memo', 'توقف العمل بسبب الأمطار', 'مطالعة توقف — أمطار'], ['memo', 'استئناف العمل', 'مطالعة استئناف'], ['letter', 'طلب تمديد الضمان', 'كتاب تمديد ضمان']]) {
    await lt(`(()=>{window.prompt=()=>${JSON.stringify(name)};document.querySelector('[data-act=new][data-t=${t}]').click();const r=R();r.subject=${JSON.stringify(subj)};touch();renderForm();document.querySelector('[data-act=savetpl]').click();renderHome();return 1})()`); await sleep(500);
  }
  await lt(`(()=>{window.confirm=()=>true;document.querySelector('[data-act=new][data-t=letter]').click();const r=R();r.subject='كتاب عادي ليس قالباً';touch();renderHome();return 1})()`); await sleep(600);
  const h = JSON.parse(await lt(`JSON.stringify({box:!!document.querySelector('#hTpls .tplbox'),sel:!!document.getElementById('tplSel'),groups:[...document.querySelectorAll('#tplSel optgroup')].map(g=>g.label+':'+g.children.length),opts:[...document.querySelectorAll('#tplSel option')].map(o=>o.textContent),tplRows:document.querySelectorAll('#hTpls .rec').length,firstList:(document.querySelector('#hList .rec h3')||{}).textContent})`));
  ok('templates are ONE box with a dropdown (no list of template cards above the letters)', h.box && h.sel && h.tplRows === 0, JSON.stringify(h));
  ok('the dropdown shows each template by its reference name, grouped by type (كتاب رسمي / مطالعة)', h.groups.includes('كتاب رسمي:1') && h.groups.includes('مطالعة:2') && h.opts.some(o => /^مطالعة توقف — أمطار/.test(o)) && h.opts.some(o => /^كتاب تمديد ضمان/.test(o)), JSON.stringify(h.opts));
  ok('the letters list starts right after the box (templates do not push it down)', /كتاب عادي ليس قالباً/.test(h.firstList || ''), h.firstList);
  // اختيار قالب وإنشاء كتاب منه
  await lt(`(()=>{const s=document.getElementById('tplSel');const o=[...s.options].find(o=>/مطالعة استئناف/.test(o.textContent));s.value=o.value;s.dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('#hTpls [data-act=fromtpl]').click();return 1})()`); await sleep(600);
  const nr = JSON.parse(await lt(`JSON.stringify({s:R().subject,t:R().tpl,type:R().type})`));
  ok('choosing a template in the dropdown + «إنشاء كتاب منه» creates a new letter from THAT template', nr.s === 'استئناف العمل' && !nr.t && nr.type === 'memo', JSON.stringify(nr));
  await lt(`renderHome()`); await sleep(300);
  await lt(`(()=>{window.prompt=()=>'مطالعة استئناف — معدّلة';const s=document.getElementById('tplSel');const o=[...s.options].find(o=>/مطالعة استئناف/.test(o.textContent));s.value=o.value;s.dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('#hTpls [data-act=tplname]').click();return 1})()`); await sleep(300);
  ok('«✏ التسمية» renames a template', /مطالعة استئناف — معدّلة/.test(await lt(`document.getElementById('tplSel').textContent`)));
  // مسافة التوقيع
  await lt(`(()=>{document.querySelector('#hList .rec').click();return 1})()`); await sleep(600);
  const sg = JSON.parse(await lt(`(()=>{const i=document.querySelector('input[data-po=sgMm]');return JSON.stringify(i?{min:i.min,max:i.max}:null)})()`));
  ok('«المسافة بين المتن وصاحب التوقيع»: from 3 mm to 50 mm', sg && +sg.min === 3 && +sg.max === 50, JSON.stringify(sg));
  const cl = await lt(`(()=>{DB.settings.po=Object.assign({},DB.settings.po||{},{sgMm:45});return PO().sgMm})()`);
  ok('a value of 45 mm is kept (was cut to 25 before)', +cl === 45, String(cl));
  const e = await app.evaluate(() => (global.__uniErrors || []).slice()); ok('no JavaScript errors', e.length === 0, e.join(' | ').slice(0, 400));
  await app.close();
  R.forEach(x => console.log(x[0], x[1], x[2] ? '— ' + String(x[2]).slice(0, 500) : '')); console.log(`${R.filter(x => x[0] === 'PASS').length}/${R.length}`); process.exit(R.every(x => x[0] === 'PASS') ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
