'use strict';
/* ربط الخريطة التفاعلية بـ Google Earth:
   - Google Earth Pro (سطح المكتب): ملف KML لمشاريع الموقف (ألوان الحالات، بطاقة كل مشروع، مجلد لكل حالة) في مجلد البيانات،
     وملف «ربط مباشر» (NetworkLink) يقرؤه كل 30 ثانية — يُفتح مرة واحدة فيبقى في «أماكني» ويتحدّث وحده كلما تغيّر الموقف.
   - Google Earth (الويب) في نافذة من البرنامج على موقع المشروع.
   - حفظ KML للمشاريع المعروضة (للاستيراد في Google Earth على الويب أو للمشاركة). */
const fs = require('fs'), path = require('path');
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const kmlColor = hex => { const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(String(hex || '')); return m ? ('ff' + m[3] + m[2] + m[1]).toLowerCase() : 'ff00ffff'; };
const fmt = n => (+n || 0).toLocaleString('en-US');
function kml(items, title) {
  const kinds = new Map(); for (const it of items) if (!kinds.has(it.kind)) kinds.set(it.kind, { label: it.kindLabel || it.kind, color: it.color });
  const styles = [...kinds.entries()].map(([k, v]) => `<Style id="s_${esc(k)}"><IconStyle><color>${kmlColor(v.color)}</color><scale>1.1</scale><Icon><href>http://maps.google.com/mapfiles/kml/shapes/placemark_circle.png</href></Icon></IconStyle><LabelStyle><scale>0.75</scale></LabelStyle><BalloonStyle><text>$[description]</text></BalloonStyle></Style>`).join('');
  const pm = it => {
    const rows = [['رقم الاضبارة', it.fn], ['الشركة المنفذة', it.contractor], ['الحالة', it.status || it.kindLabel], ['الإنجاز الفعلي', it.act != null ? it.act + '%' : ''], ['الإنجاز المخطط', it.plan != null ? it.plan + '%' : ''], ['الكلفة الكلية', it.total ? fmt(it.total) + ' د.ع' : ''], ['أوامر التغيير', it.chg ? fmt(it.chg) + ' د.ع' : ''], ['القضاء / الناحية', it.district], ['المهندس المقيم', it.resident], ['المشرفون', it.sup], ['اللجنة', it.committee], ['الإحداثيات', `${(+it.lat).toFixed(6)}, ${(+it.lng).toFixed(6)}`]].filter(r => r[1] != null && r[1] !== '');
    const desc = `<div dir="rtl" style="font-family:Tahoma,Arial;font-size:13px;min-width:280px"><h3 style="margin:0 0 6px;color:#0b3d2e">${esc(it.name)}</h3><table style="border-collapse:collapse">${rows.map(r => `<tr><td style="color:#666;padding:2px 8px">${esc(r[0])}</td><td style="padding:2px 8px"><b>${esc(r[1])}</b></td></tr>`).join('')}</table>${it.approx ? '<p style="color:#b45309">⚠ موقع تقريبي حسب الناحية — لا إحداثيات صالحة في الموقف</p>' : ''}<p style="color:#888;font-size:11px">إعداد قسم الشؤون الهندسية — ديوان محافظة الانبار</p></div>`;
    return `<Placemark><name>${esc(it.name)}</name><Snippet maxLines="1">${esc([it.fn, it.status || it.kindLabel, it.act != null ? it.act + '%' : ''].filter(Boolean).join(' · '))}</Snippet><styleUrl>#s_${esc(it.kind)}</styleUrl><description><![CDATA[${desc.replace(/\]\]>/g, ']] >')}]]></description>`
      + `<ExtendedData>${[['fileNo', it.fn], ['status', it.status], ['actual', it.act], ['plan', it.plan], ['cost', it.total]].map(([k, v]) => `<Data name="${k}"><value>${esc(v == null ? '' : v)}</value></Data>`).join('')}</ExtendedData>`
      + `<Point><coordinates>${+it.lng},${+it.lat},0</coordinates></Point></Placemark>`;
  };
  const folders = [...kinds.entries()].map(([k, v]) => { const L = items.filter(i => i.kind === k); return `<Folder><name>${esc(v.label)} (${L.length})</name>${L.map(pm).join('')}</Folder>`; }).join('');
  const c = items.length ? [items.reduce((s, i) => s + +i.lat, 0) / items.length, items.reduce((s, i) => s + +i.lng, 0) / items.length] : [33.4, 42.5];
  return `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${esc(title)}</name><open>1</open><description>${esc('مشاريع الموقف العام — إعداد قسم الشؤون الهندسية، ديوان محافظة الانبار. آخر تحديث ' + new Date().toLocaleString('en-GB'))}</description>`
    + `<LookAt><longitude>${c[1]}</longitude><latitude>${c[0]}</latitude><altitude>0</altitude><range>${items.length > 1 ? 450000 : 3000}</range><tilt>0</tilt><heading>0</heading></LookAt>${styles}${folders}</Document></kml>`;
}
const linkKml = (target, title) => `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><NetworkLink><name>${esc(title)}</name><open>1</open><flyToView>1</flyToView><refreshVisibility>0</refreshVisibility>`
  + `<description>${esc('ربط مباشر بالبرنامج الموحد: يتحدّث كل 30 ثانية من ملف المشاريع في مجلد بيانات البرنامج.')}</description><Link><href>${esc(require('url').pathToFileURL(target).href)}</href><refreshMode>onInterval</refreshMode><refreshInterval>30</refreshInterval></Link></NetworkLink></kml>`;
function proExe() {
  if (process.platform !== 'win32') return '';
  const c = [process.env['ProgramFiles'], process.env['ProgramFiles(x86)'], process.env['LOCALAPPDATA']].filter(Boolean).flatMap(d => [path.join(d, 'Google', 'Google Earth Pro', 'client', 'googleearth.exe'), path.join(d, 'Google', 'Google Earth', 'client', 'googleearth.exe')]);
  return c.find(f => { try { return fs.statSync(f).isFile(); } catch (_) { return false; } }) || '';
}
function write(dir, items) {
  fs.mkdirSync(dir, { recursive: true });
  const data = path.join(dir, 'مشاريع-الانبار.kml'), link = path.join(dir, 'Google Earth - مشاريع الانبار (ربط مباشر).kml');
  const tmp = data + '.tmp'; fs.writeFileSync(tmp, kml(items, 'مشاريع محافظة الانبار — الموقف العام'), 'utf8'); fs.renameSync(tmp, data);
  if (!fs.existsSync(link)) fs.writeFileSync(link, linkKml(data, 'مشاريع محافظة الانبار (مباشر من البرنامج الموحد)'), 'utf8');
  return { data, link };
}
module.exports = { kml, linkKml, write, proExe, kmlColor };
