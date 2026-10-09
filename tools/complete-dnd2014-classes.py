"""Complete SRD nested class selections and level grants without replacing saved acquisition IDs."""
from pathlib import Path
import json,re,copy
P='dnd5e:2014:';path=Path('src/systems/dnd5e-2014/system.json');d=json.loads(path.read_text(encoding='utf-8'));fs={f['id']:f for f in d['features']};ss=json.loads(Path('.reference-cache/srd-class-spell-sections.json').read_text(encoding='utf-8'))
slug=lambda s:re.sub('[^a-z0-9]+','-',s.lower()).strip('-');op=lambda name,*args:{'op':name,'args':list(args)};lv=lambda c:{'context':'level.'+P+c};st=lambda s:{'stat':s}
def section(name,a,b):return next(x for x in ss if a<=x['page']<=b and x['heading']==name)
def make(cls,name,a,b,ident=None):
 s=section(name,a,b);fid=P+cls+'.'+(ident or slug(name));fs[fid]={'id':fid,'revision':1,'name':name,'displayName':name,'description':name+'\n'+s['text'],'source':f'SRD 5.1 p. {s["page"]} (CC BY 4.0), https://media.wizards.com/2023/downloads/dnd/SRD_CC_v5.1.pdf#page={s["page"]}','tags':['class-feature'],'components':[]};return fid
G=lambda fid,ident=None,**kw:{'id':ident or fid.split(':')[-1],'kind':'grantFeature','feature':fid if fid.startswith(P) else P+fid,**kw}
def C(id,ids,n=1,**kw):return {'id':id,'kind':'chooseFeatures','eligibility':'current','minimum':n,'maximum':n,'candidates':{'ids':ids,**kw},'retraining':{'allowed':True}}
# Attach related source subsections to their parent rule, without synthesizing rule prose.
for cls,a,b in [('bard',11,14),('druid',19,23),('paladin',30,34),('ranger',35,38),('sorcerer',42,45),('warlock',46,51)]:
 f=fs[P+cls+('.pact-magic' if cls=='warlock' else '.spellcasting')]
 parts=[x for x in ss if a<=x['page']<=b and x['heading'] in ['Cantrips','Spell Slots','Preparing and Casting Spells','Spells Known of 1st Level and Higher','Spellcasting Ability','Ritual Casting','Spellcasting Focus']]
 for s in parts:
  text=s['heading']+'\n'+s['text']
  if text not in f['description']:f['description']+='\n\n'+text
for cls,root,names,a,b in [('sorcerer','font-of-magic',['Sorcery Points','Flexible Casting'],43,44),('monk','ki',['Flurry of Blows','Patient Defense','Step of the Wind'],27,27)]:
 f=fs[P+cls+'.'+root]
 for name in names:
  fid=make(cls,name,a,b)

  if G(fid) not in f['components']:f['components'].append(G(fid))
# Invocation selection, with class-level and pact requirements.
invocations=[x for x in ss if 48<=x['page']<=50]
start=next(i for i,x in enumerate(invocations) if x['heading']=='Agonizing Blast');end=next(i for i,x in enumerate(invocations) if x['heading']=='Otherworldly Patrons')
ids=[]
for s in invocations[start:end]:
 fid=make('warlock',s['heading'],s['page'],s['page'],'invocation.'+slug(s['heading']));ids.append(fid)
 req=[];line=s['text'].split('\n')[0]
 if 'Prerequisite' in line:
  match=re.search(r'(\d+)(?:st|nd|rd|th) level',line)
  if match:req.append({'expression':op('gte',lv('warlock'),int(match[1]))})
  for name in ['Chain','Blade','Tome']:
   if 'Pact of the '+name in line:req.append({'feature':P+'warlock.pact-of-the-'+name.lower()})
  if 'eldritch blast' in line.lower():req.append({'feature':P+'warlock.cantrip.eldritch-blast'})
 if req:fs[fid]['prerequisites']={'all':req}
count={'if':op('gte',lv('warlock'),18),'then':8,'else':{'if':op('gte',lv('warlock'),15),'then':7,'else':{'if':op('gte',lv('warlock'),12),'then':6,'else':{'if':op('gte',lv('warlock'),9),'then':5,'else':{'if':op('gte',lv('warlock'),7),'then':4,'else':{'if':op('gte',lv('warlock'),5),'then':3,'else':2}}}}}}
fs[P+'warlock.eldritch-invocations']['components']=[C('invocations',ids,count)]
# Preserve each subclass's real alternatives as independent selectable Features.
for root,names in [('hunter-s-prey',['Colossus Slayer','Giant Killer','Horde Breaker']),('defensive-tactics',['Escape the Horde','Multiattack Defense','Steel Will']),('multiattack',['Volley','Whirlwind Attack']),('superior-hunter-s-defense',['Evasion','Stand Against the Tide','Uncanny Dodge'])]:
 parent=fs[P+'ranger.subclass.'+root];text=parent['description'];children=[]
 for i,name in enumerate(names):
  start=text.index(name+'.');end=text.index(names[i+1]+'.',start) if i+1<len(names) else len(text)
  fid=P+'ranger.option.'+slug(name);fs[fid]={'id':fid,'revision':1,'name':name,'displayName':name,'description':text[start:end].strip(),'source':parent['source'],'tags':['class-feature'],'components':[]};children.append(fid)
 parent['components']=[C('option',children)]
# Bard's expertise and bonus proficiencies reuse the original atomic proficiency Features.
skills=[f['id'] for f in fs.values() if f['id'].startswith(P+'skill.') and '.roll.' not in f['id']]
expertise=[f['id'] for f in fs.values() if f['id'].startswith(P+'expertise.') and '.roll.' not in f['id'] and f['id'] != P+'expertise.thieves-tools']
fs[P+'bard.expertise']['components']=[C('expertise',expertise,{'if':op('gte',lv('bard'),10),'then':4,'else':2})]
fs[P+'bard.subclass.bonus-proficiencies']['components']=[C('skills',skills,3)]
# Magical Secrets use a separate choice, keeping their spells distinct from the Bard list allowance.
bardspells=[f['id'] for f in fs.values() if f['id'].startswith(P+'bard.prepared.') or f['id'].startswith(P+'bard.cantrip.')]
fs[P+'bard.magical-secrets']['components']=[C('secrets',bardspells,{'if':op('gte',lv('bard'),18),'then':6,'else':{'if':op('gte',lv('bard'),14),'then':4,'else':2}},maximumLevel=st('bardSpellLevel'))]
fs[P+'bard.subclass.additional-magical-secrets']['components']=[C('secrets',bardspells,2,maximumLevel=st('bardSpellLevel'))]
# Cleric's remaining progression and Life Domain.
cleric={2:['Channel Divinity','Channel Divinity: Turn Undead'],5:['Destroy Undead'],10:['Divine Intervention']};life={2:['Channel Divinity: Preserve Life'],6:['Blessed Healer'],8:['Divine Strike'],17:['Supreme Healing']}
for lvl,names in {**cleric}.items():
 for name in names:make('cleric',name,16,17)
for lvl,names in life.items():
 for name in names:
  fid=make('cleric',name,17,17);fs[fid]['prerequisites']={'feature':P+'cleric.life'}
for c in d['configurations']:
 cls=next(x for x in c['classes'] if x['id']==P+'cleric')
 for group in [cleric,life]:
  for lvl,names in group.items():
   for name in names:
    grant=G('cleric.'+slug(name))
    if grant not in cls['levels'][str(lvl)]:cls['levels'][str(lvl)].append(grant)
 # Entries supply saving throws and full skill allotments only when starting this class.
 entry=fs[P+'cleric.entry']
 for component in entry['components']:
  if component.get('stat','').startswith('training.save.'):component['condition']={'context':'isStartingClass'}
  if component['id']=='skills':component['minimum']=component['maximum']={'if':{'context':'isStartingClass'},'then':2,'else':0}
# Channel Divinity pool is shared by the granted turn/preserve abilities.
cap={'if':op('gte',lv('cleric'),18),'then':3,'else':{'if':op('gte',lv('cleric'),6),'then':2,'else':1}}
fs[P+'resource.cleric-channel-divinity']={'id':P+'resource.cleric-channel-divinity','revision':1,'name':'Channel Divinity','displayName':'Channel Divinity','tags':['resource-tracker'],'components':[{'id':'tracker','kind':'trackResource','key':'cleric-channel-divinity','name':'Channel Divinity','units':'uses','maximum':cap,'initialAmount':cap,'integer':True,'recovery':[{'event':'short-rest','amount':'full'},{'event':'long-rest','amount':'full'}]}]}
fs[P+'cleric.channel-divinity']['components']=[G('resource.cleric-channel-divinity')]
for name in ['channel-divinity-turn-undead','channel-divinity-preserve-life']:fs[P+'cleric.'+name]['components']=[{'id':'use','kind':'grantCapability','name':fs[P+'cleric.'+name]['name'],'costs':[{'key':'cleric-channel-divinity','amount':1}]}]
# Every learned spell grants its canonical source and its reusable Roll Features.
for f in list(fs.values()):
 if any(t.endswith('-spell') or t.endswith('-cantrip') for t in f.get('tags',[])):
  for ref in f.get('textReferences',[]):
   if fs.get(ref,{}).get('tags')==['spell'] and not any(x.get('feature')==ref for x in f['components']):f['components'].append(G(ref,'spell-rules'))
fs[P+'cleric.life']['components']=[x for x in fs[P+'cleric.life']['components'] if not x.get('condition')]
for f in fs.values():
 if 'spell' in f.get('tags',[]):f['repeat']={'maximum':20,'scope':'character'}
# A prepared caster's class spell list and a known caster's extra patron options
# remain separate from the reusable casting wrappers.
lists=json.loads(Path('src/systems/dnd5e-2014/spell-lists.json').read_text(encoding='utf-8'))
for name in ['Burning Hands','Command','Blindness/Deafness','Scorching Ray','Fireball','Stinking Cloud','Fire Shield','Wall of Fire','Flame Strike','Hallow']:
 fid=P+'warlock.prepared.'+slug(name)
 known=next(x for x in fs[P+'warlock.pact-magic']['components'] if x['id']=='known')
 if fid not in known['candidates']['ids']:known['candidates']['ids'].append(fid)
# Mystic Arcanum is one independent daily resource for each spell level.
for spelllevel,classlevel in [(6,11),(7,13),(8,15),(9,17)]:
 key='mystic-arcanum.'+str(spelllevel);pool=P+'resource.'+key
 fs[pool]={'id':pool,'revision':1,'name':f'Mystic Arcanum (level {spelllevel})','displayName':f'Mystic Arcanum (level {spelllevel})','tags':['resource-tracker'],'components':[{'id':'tracker','kind':'trackResource','key':key,'name':f'Mystic Arcanum (level {spelllevel})','units':'uses','maximum':1,'initialAmount':1,'integer':True,'recovery':[{'event':'long-rest','amount':'full'}]}]}
 options=[]
 for name in lists['warlock']:
  source=fs[P+'spell.'+slug(name)]
  if source['contentLevel']!=spelllevel:continue
  wrapper=copy.deepcopy(fs[P+'warlock.prepared.'+slug(name)]);fid=P+'warlock.arcanum.'+slug(name);wrapper['id']=fid
  arguments=wrapper['components'][0]['arguments'];meta={k:v for k,v in arguments.items() if k not in ['ritualAllowed','spellName']}
  meta.update(spellLevel=spelllevel,spellSlotLevel=spelllevel,ritual=False,castingMode='arcanum')
  wrapper['components']=[G(pool),G(source['id'],'spell-rules'),{'id':'cast','kind':'grantCapability','name':name,'costs':[{'key':key,'amount':1}],'metadata':meta}]
  fs[fid]=wrapper;options.append(fid)
 for config in d['configurations']:
  cls=next(x for x in config['classes'] if x['id']==P+'warlock')
  choice=C(key,options)
  cls['levels'][str(classlevel)]=[x for x in cls['levels'][str(classlevel)] if x['id']!=key]+[choice]
# Additional cantrips and proficiencies use existing atomic choices.
fs[P+'druid.subclass.bonus-cantrip']['components']=[C('cantrip',[P+'druid.cantrip.'+slug(name) for name in lists['druid'] if fs[P+'spell.'+slug(name)]['contentLevel']==0])]
fs[P+'warlock.pact-of-the-tome']['components']=[C('cantrips',[f['id'] for f in fs.values() if f['id'].startswith(P+'warlock.cantrip.')],3)]
fs[P+'warlock.invocation.beguiling-influence']['components']=[G('skill.deception'),G('skill.persuasion')]
fs[P+'monk.diamond-soul']['components']=[{'id':ability,'kind':'modifyStat','stat':'training.save.'+ability,'operation':'floor','value':1} for ability in ['strength','dexterity','constitution','intelligence','wisdom','charisma']]
fs[P+'sorcerer.subclass.draconic-resilience']['components']=[{'id':'hp','kind':'modifyStat','stat':'hitPoints','operation':'add','value':lv('sorcerer')},{'id':'unarmored-ac','kind':'modifyStat','stat':'armorClass','operation':'floor','value':op('add',13,st('modifier.dexterity')),'condition':op('eq',st('armorIndex'),0)}]
# Narrative choices are real editable acquisitions even when their conditional
# effects require adjudication. Reuse the parent's exact source passage.
def named_choices(parent,names,count=1):
 ids=[]
 for name in names:
  fid=parent+'.option.'+slug(name)
  label=fs[parent]['name']+': '+name
  fs[fid]={'id':fid,'revision':1,'name':label,'displayName':label,'tags':['class-feature'],'textReferences':[parent],'components':[]}
  ids.append(fid)
 fs[parent]['components']=[x for x in fs[parent]['components'] if x['id']!='options']+[C('options',ids,count)]
 return ids
named_choices(P+'ranger.natural-explorer',['Arctic','Coast','Desert','Forest','Grassland','Mountain','Swamp','Underdark'],{'if':op('gte',lv('ranger'),10),'then':3,'else':{'if':op('gte',lv('ranger'),6),'then':2,'else':1}})
enemy=fs[P+'ranger.favored-enemy'];enemy['components']=[]
ids=named_choices(enemy['id'],['Aberrations','Beasts','Celestials','Constructs','Dragons','Elementals','Fey','Fiends','Giants','Monstrosities','Oozes','Plants','Undead','Two types of humanoid'],{'if':op('gte',lv('ranger'),14),'then':3,'else':{'if':op('gte',lv('ranger'),6),'then':2,'else':1}})
humanoid=fs[ids[-1]];humanoid['parameters']={'firstType':{'kind':'string'},'secondType':{'kind':'string'}}
languages=[f['id'] for f in fs.values() if f['id'].startswith(P+'language.') and not f.get('roll')]
enemy['components'].append(C('languages',languages,{'if':op('gte',lv('ranger'),14),'then':3,'else':{'if':op('gte',lv('ranger'),6),'then':2,'else':1}}))
named_choices(P+'druid.subclass.circle-spells',['Arctic','Coast','Desert','Forest','Grassland','Mountain','Swamp'])
fs.pop(P+'druid.subclass.circle-spells.option.underdark',None)
named_choices(P+'sorcerer.subclass.dragon-ancestor',['Black','Blue','Brass','Bronze','Copper','Gold','Green','Red','Silver','White'])
named_choices(P+'warlock.subclass.fiendish-resilience',['Acid','Bludgeoning','Cold','Fire','Force','Lightning','Necrotic','Piercing','Poison','Psychic','Radiant','Slashing','Thunder'])
lands={
 'arctic':'hold person|spike growth|sleet storm|slow|freedom of movement|ice storm|commune with nature|cone of cold',
 'coast':'mirror image|misty step|water breathing|water walk|control water|freedom of movement|conjure elemental|scrying',
 'desert':'blur|silence|create food and water|protection from energy|blight|hallucinatory terrain|insect plague|wall of stone',
 'forest':'barkskin|spider climb|call lightning|plant growth|divination|freedom of movement|commune with nature|tree stride',
 'grassland':'invisibility|pass without trace|daylight|haste|divination|freedom of movement|dream|insect plague',
 'mountain':'spider climb|spike growth|lightning bolt|meld into stone|stone shape|stoneskin|passwall|wall of stone',
 'swamp':'acid arrow|darkness|water walk|stinking cloud|freedom of movement|locate creature|insect plague|scrying',
}
for land,names in lands.items():
 parent=fs[P+'druid.subclass.circle-spells.option.'+land]
 count=op('multiply',2,op('min',4,op('max',0,op('subtract',op('ceil',op('divide',lv('druid'),2)),1))))
 parent['components']=[C('circle-spells',[P+'druid.prepared.'+slug(name) for name in names.split('|')],count,maximumLevel=st('druidSpellLevel'))]
oath=fs[P+'paladin.subclass.oath-spells'];source=section('Oath Spells',33,33)
oath['description']='Oath Spells\n'+source['text'];oath['source']=oath['source'].replace('#page=32','#page=33').replace('p. 32','p. 33')
names='protection from evil and good|sanctuary|lesser restoration|zone of truth|beacon of hope|dispel magic|freedom of movement|guardian of faith|commune|flame strike'
oath['components']=[C('oath-spells',[P+'paladin.prepared.'+slug(name) for name in names.split('|')],op('multiply',2,st('paladinSpellLevel')),maximumLevel=st('paladinSpellLevel'))]
names='lesser restoration|spiritual weapon|beacon of hope|revivify|death ward|guardian of faith|mass cure wounds|raise dead'
fs[P+'cleric.life']['components']=[x for x in fs[P+'cleric.life']['components'] if x['id']!='domain-spells']+[C('domain-spells',[P+'cleric.prepared.'+slug(name) for name in names.split('|')],op('multiply',2,op('min',4,op('max',0,op('subtract',st('clericSpellLevel'),1)))),maximumLevel=st('clericSpellLevel'))]
# Wizard preparations may also spend a multiclass character's Pact Magic slots.
for feature in list(fs.values()):
 if not feature['id'].startswith(P+'prepared.'):continue
 modes=[x for x in feature['components'] if x['kind']=='grantCapability' and x.get('metadata',{}).get('spellSlotLevel',0)>0]
 if not modes:continue
 original=modes[0];minimum=original['metadata']['spellLevel']
 feature['components']=[x for x in feature['components'] if not x['id'].startswith('pact-')]
 for spelllevel in range(minimum,6):
  mode=copy.deepcopy(original);mode.update(id='pact-'+str(spelllevel),name=fs[original['metadata']['spell']]['name']+f' (pact slot {spelllevel})',costs=[{'key':'pact-slot','amount':1}],condition=op('and',op('gte',st('armorProficient'),1),{'context':'spellComponentsAvailable'},op('eq',st('pactSlotLevel'),spelllevel),op('gte',st('pactSlotCount'),1)))
  mode['metadata'].update(spellSlotLevel=spelllevel,castingMode='pact-'+str(spelllevel));feature['components'].append(mode)
# Source-and-mechanics scope is explicit in the content manifest.
d['features']=list(fs.values());path.write_text(json.dumps(d,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
print('Completed nested selections and Cleric progression.')
