'use strict';
/* خطوط إضافية مضمَّنة في البرنامج (build/fonts داخل ملف البرنامج، لا تُرفع إلى المستودع) تُعرَّف لكل نوافذ البرنامج بـ @font-face
   وتُخدَّم من البروتوكول الداخلي anbar-font:// . المثبَّت في ويندوز يُستعمل أولاً (local) ثم الملف المضمَّن.
   «Simplified Arabic» و«Traditional Arabic»: الوزن العادي فقط من الملف المضمَّن؛ الغامق من ويندوز إن وُجد (وإلا يُغمَّق تلقائياً كما كان). */
const FONTS = [
  { family: 'DecoType Thuluth II', file: 'decotype-thuluth-ii.ttf', local: ['DecoType Thuluth II', 'DecoTypeThuluthII'] },
  { family: 'DecoType Thuluth III', file: 'decotype-thuluth-iii.ttf', local: ['DecoType Thuluth III'] },
  { family: 'Dima Thuluth', file: 'dima-thuluth.ttf', local: ['Dima thuluth', 'Dima Thuluth'] },
  { family: 'Palestine', file: 'palestine.ttf', local: ['Palestine'] },
  { family: 'AH Manal Black', file: 'ah-manal-black.ttf', local: ['(AH) Manal Black'] },
  { family: 'SF Arabic Black', file: 'sf-arabic-black.ttf', local: ['SF Arabic Black'] },
  { family: 'Panorama Naskh Long', file: 'nt-panorama-naskh-long.otf', local: ['PanoramaNaskh', 'NT Panorama Naskh Long'] },
  { family: 'PT Bold Heading', file: 'pt-bold-heading.ttf', local: ['PT Bold Heading'] },
  { family: 'Simplified Arabic', file: 'simplified-arabic.ttf', local: ['Simplified Arabic', 'SimplifiedArabic'], bold: ['Simplified Arabic Bold', 'SimplifiedArabic-Bold'] },
  { family: 'Traditional Arabic', file: 'traditional-arabic.ttf', local: ['Traditional Arabic', 'TraditionalArabic'], bold: ['Traditional Arabic Bold', 'TraditionalArabic-Bold'] }
];
const NEW_FAMILIES = FONTS.slice(0, 8).map(f => f.family);   // تُضاف إلى قوائم الخطوط في الأنظمة
function css(has) {
  const q = s => "'" + String(s).replace(/'/g, '') + "'";
  return FONTS.filter(f => has(f.file)).map(f => {
    const fmt = /\.otf$/.test(f.file) ? 'opentype' : 'truetype';
    let s = `@font-face{font-family:${q(f.family)};font-weight:400;font-style:normal;font-display:block;src:${f.local.map(n => `local(${q(n)})`).join(',')},url(anbar-font://f/${f.file}) format('${fmt}')}`;
    if (f.bold) s += `@font-face{font-family:${q(f.family)};font-weight:700;font-style:normal;src:${f.bold.map(n => `local(${q(n)})`).join(',')}}`;
    return s;
  }).join('\n');
}
module.exports = { FONTS, NEW_FAMILIES, css };
