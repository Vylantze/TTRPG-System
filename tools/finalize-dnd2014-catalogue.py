"""Attach source references and presentation labels to generated atomic Features."""
from pathlib import Path
import json,re
import pdfplumber

path=Path('src/systems/dnd5e-2014/system.json')
data=json.loads(path.read_text(encoding='utf-8'))
prefix='dnd5e:2014:'
features={feature['id']:feature for feature in data['features']}
with pdfplumber.open('.reference-cache/srd-5.1.pdf') as pdf:
 page=pdf.pages[86]
 text=page.crop((316,30,580,745)).extract_text(x_tolerance=2,y_tolerance=3)
 text=text[:text.find('System Reference Document')] if 'System Reference Document' in text else text
 # Restore paragraphs from the two named sections rather than copying line wraps.
 sections=[]
 for heading in ['Resting','Short Rest','Long Rest']:
  start=text.index(heading)+len(heading)
  nexts=[text.find(other,start) for other in ['Short Rest','Long Rest'] if text.find(other,start)>=0]
  body=text[start:min(nexts) if nexts else len(text)]
  sections.append(heading+'\n'+re.sub(r'\s+',' ',body).strip().replace('24-\u00ad\u2010\u2011hour','24-hour'))
features[prefix+'rules.resting']={'id':prefix+'rules.resting','revision':1,'name':'Resting','displayName':'Resting','tags':['rules-reference'],'description':'\n\n'.join(sections),'source':'SRD 5.1 p. 87 (CC BY 4.0), https://media.wizards.com/2023/downloads/dnd/SRD_CC_v5.1.pdf#page=87','components':[]}
for feature in features.values():
 if feature['id'].startswith((prefix+'hit-dice.',prefix+'resource.hit-dice.')):
  feature['textReferences']=[prefix+'rules.resting']
 if not feature.get('description') and not feature.get('textReferences'):
  parent=next((f for f in features.values() if f.get('description') and any(c.get('feature')==feature['id'] for c in f['components'])),None)
  if parent:feature['textReferences']=[parent['id']]
  elif feature['id']==prefix+'resource.pact-slot':feature['textReferences']=[prefix+'warlock.pact-magic']
  elif feature['id'].startswith(prefix+'resource.mystic-arcanum.'):feature['textReferences']=[prefix+'warlock.mystic-arcanum']
for config in data['configurations']:
 for feature in features.values():
  for tag in feature.get('tags',[]):config['system']['tagDisplayNames'].setdefault(tag,tag.replace('-',' ').title())
data['features']=list(features.values())
path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('Attached source text and tag display names.')
