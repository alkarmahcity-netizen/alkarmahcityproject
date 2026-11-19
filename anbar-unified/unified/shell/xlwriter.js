/* كاتب ملفات Excel (xlsx) بلا مكتبات: أوراق من اليمين لليسار، تنسيقات جاهزة، دمج خلايا، تجميد العناوين،
   تصفية، أشرطة بيانات، معادلات، وإعداد طباعة A4 أفقي بملاءمة العرض وتكرار صف العناوين وترقيم الصفحات.
   الاستعمال: XLW.book([{name, cols:[عرض...], rows:[[خلية...]], merges:['A1:F1'], freeze:4, filter:'A4:F4', bars:[{ref,color}], titles:4, heights:{1:28}}]) ← Uint8Array
   الخلية: null أو {v, s, f} — v نص أو رقم، s رقم التنسيق (XLW.S)، f معادلة (اختياري، مع v قيمة محسوبة) */
(function(root){
'use strict';
const S={def:0,title:1,sub:2,head:3,txt:4,int:5,pct:6,grp:7,stT:8,stI:9,stP:10,gtT:11,gtI:12,gtP:13,dev:14,wrap:15,org:16,kpiL:17,kpiV:18,kpiP:19,num1:20,stD:21,gtD:22};
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'');
const colL=n=>{let s='';n++;while(n>0){const m=(n-1)%26;s=String.fromCharCode(65+m)+s;n=Math.floor((n-1)/26);}return s;};
const ref=(r,c)=>colL(c)+(r+1);
const absRef=a=>String(a).split(':').map(x=>{const m=/^([A-Z]+)(\d+)$/.exec(x);return m?'$'+m[1]+'$'+m[2]:x;}).join(':');
const STYLES=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="4"><numFmt numFmtId="164" formatCode="#,##0"/><numFmt numFmtId="165" formatCode="0.0&quot;%&quot;"/><numFmt numFmtId="166" formatCode="+0.0&quot;%&quot;;-0.0&quot;%&quot;;0.0&quot;%&quot;"/><numFmt numFmtId="167" formatCode="#,##0.0"/></numFmts>
<fonts count="9">
<font><sz val="10"/><name val="Arial"/><family val="2"/></font>
<font><b/><sz val="15"/><color rgb="FFFFFFFF"/><name val="Arial"/><family val="2"/></font>
<font><i/><sz val="9.5"/><color rgb="FF5F6B65"/><name val="Arial"/><family val="2"/></font>
<font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Arial"/><family val="2"/></font>
<font><b/><sz val="10"/><name val="Arial"/><family val="2"/></font>
<font><sz val="10"/><color rgb="FFC00000"/><name val="Arial"/><family val="2"/></font>
<font><b/><sz val="11"/><color rgb="FF1F5F36"/><name val="Arial"/><family val="2"/></font>
<font><b/><sz val="16"/><color rgb="FF1F5F36"/><name val="Arial"/><family val="2"/></font>
<font><sz val="9"/><color rgb="FF5F6B65"/><name val="Arial"/><family val="2"/></font>
</fonts>
<fills count="8">
<fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF1F5F36"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF2E7D4F"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFE2EFDA"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFF2F2F2"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFFFF7E0"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFF7FBF8"/><bgColor indexed="64"/></patternFill></fill>
</fills>
<borders count="3">
<border><left/><right/><top/><bottom/><diagonal/></border>
<border><left style="thin"><color rgb="FFBFC8C2"/></left><right style="thin"><color rgb="FFBFC8C2"/></right><top style="thin"><color rgb="FFBFC8C2"/></top><bottom style="thin"><color rgb="FFBFC8C2"/></bottom><diagonal/></border>
<border><left style="thin"><color rgb="FF1F5F36"/></left><right style="thin"><color rgb="FF1F5F36"/></right><top style="medium"><color rgb="FF1F5F36"/></top><bottom style="medium"><color rgb="FF1F5F36"/></bottom><diagonal/></border>
</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="23">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"><alignment readingOrder="2"/></xf>
<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center" readingOrder="2"/></xf>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="right" vertical="center" readingOrder="2"/></xf>
<xf numFmtId="0" fontId="3" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1" readingOrder="2"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center" readingOrder="2"/></xf>
<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="0" fontId="6" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center" readingOrder="2"/></xf>
<xf numFmtId="0" fontId="4" fillId="5" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center" readingOrder="2"/></xf>
<xf numFmtId="164" fontId="4" fillId="5" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="165" fontId="4" fillId="5" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="0" fontId="3" fillId="2" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center" readingOrder="2"/></xf>
<xf numFmtId="164" fontId="3" fillId="2" borderId="2" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="165" fontId="3" fillId="2" borderId="2" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="166" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center" wrapText="1" readingOrder="2"/></xf>
<xf numFmtId="0" fontId="7" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="center" readingOrder="2"/></xf>
<xf numFmtId="0" fontId="8" fillId="7" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1" readingOrder="2"/></xf>
<xf numFmtId="164" fontId="6" fillId="7" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="165" fontId="6" fillId="7" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="167" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="166" fontId="4" fillId="5" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="166" fontId="3" fillId="2" borderId="2" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
<dxfs count="2"><dxf><font><color rgb="FFC00000"/></font><fill><patternFill><bgColor rgb="FFFDE9E7"/></patternFill></fill></dxf><dxf><font><color rgb="FF1F5F36"/></font></dxf></dxfs>
</styleSheet>`;
function cellXml(c,r,ci){if(c==null||(c.v==null&&!c.f&&c.s==null))return '';const R=ref(r,ci),s=c.s!=null?` s="${c.s}"`:'';
  if(c.f)return `<c r="${R}"${s}><f>${esc(c.f)}</f>${typeof c.v==='number'&&isFinite(c.v)?`<v>${c.v}</v>`:''}</c>`;
  if(c.v==null||c.v==='')return `<c r="${R}"${s}/>`;
  if(typeof c.v==='number'&&isFinite(c.v))return `<c r="${R}"${s}><v>${c.v}</v></c>`;
  return `<c r="${R}"${s} t="inlineStr"><is><t xml:space="preserve">${esc(c.v)}</t></is></c>`;}
function sheetXml(sh){const rows=sh.rows||[],nc=Math.max(1,...rows.map(r=>r?r.length:0)),H=sh.heights||{};
  const cols=(sh.cols||[]).map((w,i)=>`<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`).join('');
  const data=rows.map((r,ri)=>{const ht=H[ri+1]?` ht="${H[ri+1]}" customHeight="1"`:'';return `<row r="${ri+1}"${ht}>${(r||[]).map((c,ci)=>cellXml(c,ri,ci)).join('')}</row>`;}).join('');
  const fr=sh.freeze?`<pane ySplit="${sh.freeze}" topLeftCell="A${sh.freeze+1}" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A${sh.freeze+1}" sqref="A${sh.freeze+1}"/>`:'';
  let pr=1;const cf=[...(sh.bars||[]).map(b=>`<conditionalFormatting sqref="${b.ref}"><cfRule type="dataBar" priority="${pr++}"><dataBar><cfvo type="num" val="0"/><cfvo type="num" val="${b.max||100}"/><color rgb="${b.color||'FF63BE7B'}"/></dataBar></cfRule></conditionalFormatting>`),
    ...(sh.neg||[]).map(rf=>`<conditionalFormatting sqref="${rf}"><cfRule type="cellIs" dxfId="0" priority="${pr++}" operator="lessThan"><formula>-10</formula></cfRule></conditionalFormatting>`)].join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheetPr>${sh.tab?`<tabColor rgb="${sh.tab}"/>`:''}<pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="A1:${ref(Math.max(0,rows.length-1),nc-1)}"/>
<sheetViews><sheetView rightToLeft="1" workbookViewId="0"${sh.first?' tabSelected="1"':''} zoomScale="${sh.zoom||100}" zoomScaleNormal="${sh.zoom||100}">${fr}</sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="18" customHeight="1"/>${cols?`<cols>${cols}</cols>`:''}<sheetData>${data}</sheetData>
${sh.filter?`<autoFilter ref="${sh.filter}"/>`:''}${sh.merges&&sh.merges.length?`<mergeCells count="${sh.merges.length}">${sh.merges.map(m=>`<mergeCell ref="${m}"/>`).join('')}</mergeCells>`:''}${cf}
<printOptions horizontalCentered="1"/><pageMargins left="0.3" right="0.3" top="0.5" bottom="0.55" header="0.25" footer="0.25"/>
<pageSetup paperSize="${sh.paper||9}" orientation="${sh.portrait?'portrait':'landscape'}" fitToWidth="1" fitToHeight="${sh.fitH?1:0}"/>
<headerFooter><oddFooter>&amp;C&amp;8صفحة &amp;P من &amp;N&amp;R&amp;8${esc(sh.footer||'')}</oddFooter></headerFooter>
</worksheet>`;}
function cleanName(n,used){let s=String(n||'ورقة').replace(/[\[\]:*?\/\\']/g,' ').replace(/\s+/g,' ').trim().slice(0,31)||'ورقة',b=s,i=2;while(used.has(s)){const t=' ('+i+++')';s=b.slice(0,31-t.length)+t;}used.add(s);return s;}
function book(sheets,meta){const used=new Set();sheets.forEach((s,i)=>{s.name=cleanName(s.name,used);if(i===0)s.first=true;});
  const F={};
  F['[Content_Types].xml']=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((s,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`;
  F['_rels/.rels']=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`;
  const now=new Date().toISOString().replace(/\.\d+Z$/,'Z');
  F['docProps/core.xml']=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${esc((meta&&meta.title)||'')}</dc:title><dc:creator>${esc((meta&&meta.author)||'')}</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`;
  F['docProps/app.xml']=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Microsoft Excel</Application></Properties>`;
  const dn=sheets.map((s,i)=>s.titles?`<definedName name="_xlnm.Print_Titles" localSheetId="${i}">'${s.name.replace(/'/g,"''")}'!$${s.titles}:$${s.titles}</definedName>`:'').join('')+sheets.map((s,i)=>s.filter?`<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">'${s.name.replace(/'/g,"''")}'!${absRef(s.filter)}</definedName>`:'').join('');
  F['xl/workbook.xml']=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView xWindow="0" yWindow="0" windowWidth="28800" windowHeight="15000" activeTab="0"/></bookViews><sheets>${sheets.map((s,i)=>`<sheet name="${esc(s.name)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets>${dn?`<definedNames>${dn}</definedNames>`:''}<calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`;
  F['xl/_rels/workbook.xml.rels']=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((s,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
  F['xl/styles.xml']=STYLES;
  sheets.forEach((s,i)=>{F[`xl/worksheets/sheet${i+1}.xml`]=sheetXml(s);});
  return zip(F);}
/* ZIP بلا ضغط (Stored) — يقبله Excel ولا يحتاج مكتبة */
const CRC=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0;}return t;})();
const crc32=b=>{let c=~0;for(let i=0;i<b.length;i++)c=CRC[(c^b[i])&255]^(c>>>8);return (~c)>>>0;};
function zip(files){const te=new TextEncoder(),parts=[],cen=[];let off=0;
  const u16=(a,o,v)=>{a[o]=v&255;a[o+1]=(v>>>8)&255;},u32=(a,o,v)=>{a[o]=v&255;a[o+1]=(v>>>8)&255;a[o+2]=(v>>>16)&255;a[o+3]=(v>>>24)&255;};
  for(const [name,txt] of Object.entries(files)){const d=te.encode(txt),nb=te.encode(name),c=crc32(d),lh=new Uint8Array(30);
    u32(lh,0,0x04034b50);u16(lh,4,20);u16(lh,6,0x0800);u16(lh,8,0);u32(lh,10,0x00210000);u32(lh,14,c);u32(lh,18,d.length);u32(lh,22,d.length);u16(lh,26,nb.length);
    parts.push(lh,nb,d);const ch=new Uint8Array(46);u32(ch,0,0x02014b50);u16(ch,4,20);u16(ch,6,20);u16(ch,8,0x0800);u16(ch,10,0);u32(ch,12,0x00210000);u32(ch,16,c);u32(ch,20,d.length);u32(ch,24,d.length);u16(ch,28,nb.length);u32(ch,42,off);
    cen.push(ch,nb);off+=30+nb.length+d.length;}
  const cl=cen.reduce((a,b)=>a+b.length,0),end=new Uint8Array(22),n=Object.keys(files).length;u32(end,0,0x06054b50);u16(end,8,n);u16(end,10,n);u32(end,12,cl);u32(end,16,off);
  const all=[...parts,...cen,end],out=new Uint8Array(all.reduce((a,b)=>a+b.length,0));let p=0;for(const a of all){out.set(a,p);p+=a.length;}return out;}
const api={book,S,colL,ref};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.XLW=api;
})(typeof window!=='undefined'?window:globalThis);
