"""Add the SRD spell lists and class spell selections from approved extracted source text."""
from pathlib import Path
import json,re,copy
P='dnd5e:2014:';path=Path('src/systems/dnd5e-2014/system.json');d=json.loads(path.read_text(encoding='utf-8'));fs={f['id']:f for f in d['features']};sections=json.loads(Path('.reference-cache/srd-class-spell-sections.json').read_text(encoding='utf-8'))
slug=lambda s:re.sub('[^a-z0-9]+','-',s.lower()).strip('-');op=lambda name,*args:{'op':name,'args':list(args)};stat=lambda s:{'stat':s};level=lambda c:{'context':'level.'+P+c}
grant=lambda f,ident=None,**kw:{'kind':'grantFeature','id':ident or f.split(':')[-1],'feature':f if f.startswith(P) else P+f,**kw}
def choose(ident,ids,minimum,maximum=None,maxlevel=None):return {'kind':'chooseFeatures','eligibility':'current','id':ident,'minimum':minimum,'maximum':minimum if maximum is None else maximum,'candidates':{'ids':ids,**({'maximumLevel':maxlevel} if maxlevel is not None else {})},'retraining':{'allowed':True}}
spells={}
d['blocks']=[block for block in d.get('blocks',[]) if not block['id'].startswith(P+'casting.')]
for s in sections:
 if s['page']<114 or 'Casting Time:' not in s['text']:continue
 name=s['heading'];text=s['text'].replace('Component:', 'Components:');header=text.split('\n')[0];lev=0 if 'cantrip' in header.lower() else int(header[0]);key=slug(name)
 md={'spell':P+'spell.'+key,'spellLevel':lev,'school':next(x for x in ['abjuration','conjuration','divination','enchantment','evocation','illusion','necromancy','transmutation'] if x in header.lower()),'sourcePage':s['page']}
 for label,nxt,out in [('Casting Time:','Range:','castingTime'),('Range:','Components:','range'),('Components:','Duration:','components')]:md[out]=text.split(label,1)[1].split(nxt,1)[0].strip()
 spells[name]={'id':key,'name':name,'level':lev,'metadata':md,'ritual':'(ritual)' in header}
 if md['spell'] not in fs:fs[md['spell']]={'id':md['spell'],'revision':1,'name':name,'displayName':name,'tags':['spell'],'contentLevel':lev,'components':[],'description':name+'\n'+s['text'],'source':f'SRD 5.1 p. {s["page"]} (CC BY 4.0), https://media.wizards.com/2023/downloads/dnd/SRD_CC_v5.1.pdf#page={s["page"]}'}
# Match longest names first, so Mass Cure Wounds cannot be confused with Cure Wounds.
pattern=re.compile('|'.join(re.escape(name.replace('’', "'")) for name in sorted(spells,key=len,reverse=True)))
spell_names={name.replace('’', "'"):name for name in spells}
lists={};current=None
for s in sections:
 if not 105<=s['page']<=113:continue
 if s['heading'].endswith(' Spells') and s['heading'].split()[0].lower() in ['bard','cleric','druid','paladin','ranger','sorcerer','warlock','wizard']:
  current=s['heading'].split()[0].lower();lists[current]=[]
 elif current and re.match(r'^(Cantrips|[1-9])',s['heading']):
  lists[current] += [spell_names[m.group(0)] for m in pattern.finditer(s['text'].replace('’', "'"))]
for cls in lists:lists[cls]=list(dict.fromkeys(lists[cls]))
print('Spell list sizes:',{k:len(v) for k,v in lists.items()})
abilities={'bard':'charisma','cleric':'wisdom','druid':'wisdom','paladin':'charisma','ranger':'wisdom','sorcerer':'charisma','warlock':'charisma'}
extra=[]
def newstat(id,name,expr):extra.append({'id':id,'name':name,'kind':'derived','expression':expr})
cantrips={'bard':[2,3,4],'cleric':[3,4,5],'druid':[2,3,4],'sorcerer':[4,5,6],'warlock':[2,3,4]}
known={'bard':[4,5,6,7,8,9,10,11,12,12,13,13,14,14,15,15,16,16,16,16],'ranger':[0,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11],'sorcerer':[2,3,4,5,6,7,8,9,10,11,12,12,13,13,14,14,15,15,15,15],'warlock':[2,3,4,5,6,7,8,9,10,10,11,11,12,12,13,13,14,14,15,15]}
newstat('pactSlotLevel','Pact Magic slot level',op('min',5,op('ceil',op('divide',level('warlock'),2))))
newstat('pactSlotCount','Pact Magic slots',{'if':op('gte',level('warlock'),17),'then':4,'else':{'if':op('gte',level('warlock'),11),'then':3,'else':{'if':op('gte',level('warlock'),2),'then':2,'else':{'if':op('gte',level('warlock'),1),'then':1,'else':0}}}})
fs[P+'resource.pact-slot']={'id':P+'resource.pact-slot','revision':1,'name':'Pact Magic slots','displayName':'Pact Magic slots','tags':['resource-tracker'],'components':[{'id':'tracker','kind':'trackResource','key':'pact-slot','name':'Pact Magic slots','units':'slots','integer':True,'maximum':stat('pactSlotCount'),'initialAmount':stat('pactSlotCount'),'recovery':[{'event':'short-rest','amount':'full'},{'event':'long-rest','amount':'full'}]}]}
for cls,ability in abilities.items():
 half=cls in ['paladin','ranger'];limit=op('ceil',op('divide',level(cls),4 if half else 2));limit=op('min',5 if cls=='warlock' else 9,limit)
 newstat(cls+'SpellLevel',cls.title()+' spell level',{'if':op('gte',level(cls),2 if half else 1),'then':limit,'else':0})
 newstat(cls+'SpellAttack',cls.title()+' spell attack',op('add',stat('modifier.'+ability),stat('proficiencyBonus')))
 newstat(cls+'SpellDC',cls.title()+' spell save DC',op('add',8,stat(cls+'SpellAttack')))
 if cls in ['cleric','druid','paladin']:newstat(cls+'PreparationLimit',cls.title()+' prepared spells',op('max',1,op('add',stat('modifier.'+ability),op('floor',op('divide',level(cls),2)) if half else level(cls))))
 if cls in known:
  fs[P+'tables']['tables'][cls+'Known']={'mode':'exact','below':'boundary','above':'boundary','rows':[{'key':i,'value':v} for i,v in enumerate([0]+known[cls])]}
  newstat(cls+'Known',cls.title()+' spells known',{'table':cls+'Known','owner':P+'tables','input':level(cls)})
 wrappers=[];cantripids=[]
 # Magical Secrets and domain spells can reuse each class's casting wrappers for any SRD spell.
 names=list(spells) if cls in ['bard','warlock','druid','paladin'] else lists[cls]
 for name in names:
  sp=spells[name];lev=sp['level'];fid=P+cls+'.'+('cantrip.' if lev==0 else 'prepared.')+sp['id'];components=[]
  modes=[(0,False)] if lev==0 else [(n,False) for n in range(lev,10)]+[(n,True) for n in range(max(1,lev),6)]
  for n,pact in modes:
   cond=op('and',op('gte',stat('armorProficient'),1),{'context':'spellComponentsAvailable'})
   if n:cond=op('and',cond,op('eq',stat('pactSlotLevel'),n) if pact else op('gte',stat(f'spellSlots.{n}'),1),op('gte',stat('pactSlotCount'),1) if pact else True)
   components.append({'id':('pact-' if pact else 'slot-')+str(n),'kind':'grantCapability','name':name+(f' (pact slot {n})' if pact else f' (slot {n})' if n else ''),'condition':cond,'costs':[{'key':'pact-slot' if pact else f'spell-slot.{n}','amount':1}] if n else [],'metadata':{**sp['metadata'],'castingAbility':ability,'spellSlotLevel':n,'ritual':False,'castingMode':('pact-' if pact else 'slot-')+str(n)}})
  if True:
   components.append({'id':'ritual','condition':op('and',{'argument':'ritualAllowed'},op('gte',stat('armorProficient'),1),{'context':'spellComponentsAvailable'}),'kind':'grantCapability','name':name+' (ritual)','costs':[],'metadata':{**sp['metadata'],'castingAbility':ability,'spellSlotLevel':0,'ritual':True,'castingMode':'ritual'}})
  blockid=P+'casting.level-'+str(lev)
  parameters={'castingAbility':{'kind':'string'},'ritualAllowed':{'kind':'boolean','default':False},'spellName':{'kind':'string'},'actionKind':{'kind':'string'},'actionAmount':{'kind':'number'}}
  for key,value in sp['metadata'].items():
   if key!='spellLevel':parameters[key]={'kind':'number' if isinstance(value,int) else 'string'}
  if not any(block['id']==blockid for block in d['blocks']):
   for component in components:
    component['name']={'argument':'spellName'}
    if component['id']!='ritual':component['action']={'kind':{'argument':'actionKind'},'amount':{'argument':'actionAmount'}}
    for key in ['castingAbility',*parameters]:
     if key in component['metadata']:component['metadata'][key]={'argument':key}
   d['blocks'].append({'id':blockid,'parameters':parameters,'components':components})
  arguments={key:value for key,value in sp['metadata'].items() if key!='spellLevel'}
  time=sp['metadata']['castingTime'];action=next((kind for label,kind in [('1 action','action'),('1 bonus action','bonus-action'),('1 reaction','reaction')] if time.startswith(label)),None)
  arguments.update(actionKind=action or 'action',actionAmount=1 if action else 0,castingAbility=ability,ritualAllowed=sp['ritual'] and cls in ['bard','cleric','druid'],spellName=name)
  components=[{'id':'casting','kind':'useBlock','block':blockid,'arguments':arguments}]
  wrapper={'id':fid,'revision':1,'name':name,'displayName':name,'tags':[cls+'-cantrip' if not lev else cls+'-spell'],'contentLevel':lev,'textReferences':[sp['metadata']['spell']],'components':components,'repeat':{'maximum':1,'scope':'character'}}
  # Preserve existing level-one Cleric saves and grant paths.
  if fid in fs and cls=='cleric':wrapper['repeat']={'maximum':2,'scope':'character'}
  fs[fid]=wrapper
  if name in lists[cls]:(cantripids if lev==0 else wrappers).append(fid)
 fid=P+cls+('.pact-magic' if cls=='warlock' else '.spellcasting');f=fs[fid]
 f['components']=[grant('resource.spell-slot.'+str(n),'slot-'+str(n)) for n in range(1,10)]+([grant('resource.pact-slot','pact')] if cls=='warlock' else [])
 if cls in cantrips:
  values=cantrips[cls];count={'if':op('gte',level(cls),10),'then':values[2],'else':{'if':op('gte',level(cls),4),'then':values[1],'else':values[0]}}
  # Existing Cleric entry grants its three cantrips; retain these stable paths.
  if cls!='cleric':f['components'].append(choose('cantrips',cantripids,count))
  else:f['components'].append(choose('additional-cantrips',[x for x in cantripids if x.split('.')[-1] not in ['light','sacred-flame','thaumaturgy']],op('subtract',count,3)))
 f['components'].append(choose('prepared' if cls in ['cleric','druid','paladin'] else 'known', [x for x in wrappers if cls!='cleric' or x not in [P+'cleric.prepared.bless',P+'cleric.prepared.cure-wounds']],1 if cls in ['cleric','druid','paladin'] else stat(cls+'Known'),stat(cls+'PreparationLimit') if cls in ['cleric','druid','paladin'] else None,stat(cls+'SpellLevel')))
# Spellcasting creates only the stats belonging to its active class.
for cls in abilities:
 definitions=[definition for definition in extra if definition['id'].startswith(cls) and definition['id'] not in ['pactSlotCount','pactSlotLevel']]
 feature=fs[P+cls+('.pact-magic' if cls=='warlock' else '.spellcasting')]
 feature['components'] += [{'id':definition['id'],'kind':'defineStat','stat':definition} for definition in definitions]
# Independent Pact Magic pools display at their true slot level.
for c in d['configurations']:
 s=c['system'];existing={x['id'] for x in extra};s['stats']=[x for x in s['stats'] if x['id'] not in existing]+copy.deepcopy([x for x in extra if x['id'] in ['pactSlotLevel','pactSlotCount']])
 # Half casters round up for their single-class table, down only in multiclass slot aggregation.
 caster=next(x for x in s['stats'] if x['id']=='srdCasterLevel')
 base=op('add',*[level(cls) for cls in ['bard','cleric','druid','sorcerer','wizard']],op('floor',op('divide',level('paladin'),2)),op('floor',op('divide',level('ranger'),2)))
 for cls in ['paladin','ranger']:
  base={'if':op('and',op('eq',op('add',*[{'if':op('gte',level(caster),2 if caster in ['paladin','ranger'] else 1),'then':1,'else':0} for caster in ['bard','cleric','druid','sorcerer','wizard','paladin','ranger']]),1),op('gte',level(cls),2)),'then':op('ceil',op('divide',level(cls),2)),'else':base}
 caster['expression']=base
# Expand Cleric to level 20 while retaining all level-one acquisitions.
for c in d['configurations']:
 cls=next(x for x in c['classes'] if x['id']==P+'cleric');cls['maximumLevel']=20;cls['name']='Cleric';cls['multiclassPrerequisites']={'stat':'wisdom','minimum':13}
 for n in range(2,21):cls['levels'][str(n)]=[grant('cleric.hit-points','hit-points')]
 for n in [4,8,12,16,19]:cls['levels'][str(n)].append(copy.deepcopy(c['classes'][0]['levels']['4'][-1]))
 c['system']['validation']=[r for r in c['system'].get('validation',[]) if r['id']!='cleric-level-one-only']
# Retain an audit of source spell lists for regression tests and future content updates.
Path('src/systems/dnd5e-2014/spell-lists.json').write_text(json.dumps(lists,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
d['features']=list(fs.values());path.write_text(json.dumps(d,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
print('Expanded all SRD spell lists and casting wrappers.')
