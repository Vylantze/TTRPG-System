"""Extract approved CC-BY SRD class/spell prose in reading order, excluding progression tables."""
from pathlib import Path
import pdfplumber,json,re,hashlib
PDF=Path('.reference-cache/srd-5.1.pdf')
assert hashlib.sha256(PDF.read_bytes()).hexdigest()=='2504d2a0abb0a4d491a939be4f17910a2dde0312570ab8d208080225ccf0a1f0'
def clean(t):
 t=re.sub(r'[-\u00ad\u2010\u2011]{2,}','-',t).replace('\u00ad','')
 return re.sub(r'\s+',' ',t).strip()
sections=[];current=None
with pdfplumber.open(PDF) as pdf:
 for num in list(range(8,56))+list(range(105,194)):
  page=pdf.pages[num-1]
  regions=[(45,30,316,745),(316,30,580,745)]
  if num in [8,11,15,19,24,26,30,35,39,42,46,52]:
   cs=[c for c in page.chars if c['text'].strip() and 'Calibri' in c['fontname'] and 50<c['top']<730]
   left=[c for c in cs if c['x0']<316];right=[c for c in cs if c['x0']>=316]
   if left and right and abs(min(c['top'] for c in left)-min(c['top'] for c in right))<45:
    top=min(c['top'] for c in cs)-8;bottom=max(c['bottom'] for c in cs)+6
    regions=[(45,30,316,top),(316,30,580,top)]+([(45,bottom,316,745),(316,bottom,580,745)] if bottom<745 else [])
  for bounds in regions:
   for line in page.crop(bounds).extract_text_lines(return_chars=True):
    value=clean(line['text']);chars=[c for c in line['chars'] if c['text'].strip()]
    if num in [8,11,15,19,24,26,30,35,39,42,46,52] and chars and all('Calibri' in c['fontname'] for c in chars):continue
    heading=chars and all('GillSans-SemiBold' in c['fontname'] and c['size']>=11.9 for c in chars)
    if heading:
     current={'heading':value,'page':num,'parts':[]};sections.append(current)
    elif current:
     label=bool(re.match(r'(Casting Time:|Range:|Components:|Duration:|Hit Dice:|Hit Points at|Armor:|Weapons:|Tools:|Saving Throws:|Skills:|•)',value))
     bold=chars and 'Bold' in chars[0]['fontname']
     indent=line['x0']>bounds[0]+18 and current['parts'] and current['parts'][-1].endswith(('.',':','!','?'))
     if current['parts'] and (label or bold or indent):current['parts'].append('\n\n')
     current['parts'].append(value)
for s in sections:s['text']='\n\n'.join(clean(p) for p in ' '.join(s.pop('parts')).split('\n\n') if clean(p))
Path('.reference-cache/srd-class-spell-sections.json').write_text(json.dumps(sections,indent=2,ensure_ascii=False),encoding='utf-8')
print(len(sections),'sections extracted')
