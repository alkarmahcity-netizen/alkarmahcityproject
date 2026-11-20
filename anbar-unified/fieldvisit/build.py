# يبني unified/app/fv.html: صفحة برنامج «تقرير الزيارة الميدانية» الأصلية (src.html، مستخرجة من FieldVisitReport.exe دون تغيير)
# + طبقة الحفظ ولوحة المعلومات (fv-addon.html) قبل </body>
import os
H=os.path.dirname(os.path.abspath(__file__))
s=open(os.path.join(H,'src.html'),encoding='utf8').read();a=open(os.path.join(H,'fv-addon.html'),encoding='utf8').read()
i=s.rfind('</body>');assert i>0
s=s[:i]+a+'\n'+s[i:]
s=s.replace('<title>تقرير الزيارة الميدانية</title>','<title>تقرير زيارة مشاريع التنفيذ أمانة</title>',1)
open(os.path.join(H,'..','unified','app','fv.html'),'w',encoding='utf8').write(s);print('built',len(s))
