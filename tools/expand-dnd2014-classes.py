"""Expand the approved SRD 5.1 class catalogue using extracted source prose.

Run extract-srd-catalogue.py first. Conditional combat effects retain source rules;
base progression, proficiencies, HP, resources, selections and spell slots use engine blocks.
"""
from pathlib import Path
import json,re,copy
P='dnd5e:2014:'
path=Path('src/systems/dnd5e-2014/system.json');data=json.loads(path.read_text(encoding='utf-8'))
sections=json.loads(Path('.reference-cache/srd-class-spell-sections.json').read_text(encoding='utf-8'))
features={f['id']:f for f in data['features']}
slug=lambda s:re.sub('[^a-z0-9]+','-',s.lower()).strip('-')
op=lambda name,*args:{'op':name,'args':list(args)}
stat=lambda name:{'stat':name}
level=lambda cls:{'context':'level.'+P+cls}
grant=lambda fid,ident=None,**kw:{'id':ident or fid.split(':')[-1],'kind':'grantFeature','feature':fid if fid.startswith(P) else P+fid,**kw}
def choice(ident,ids,count=1,maximum=None):return {'id':ident,'kind':'chooseFeatures','minimum':count,'maximum':count if maximum is None else maximum,'candidates':{'ids':[x if x.startswith(P) else P+x for x in ids]},'retraining':{'allowed':True}}
def modifier(ident,target,value,operation='add',**kw):return {'id':ident,'kind':'modifyStat','stat':target,'operation':operation,'value':value,**kw}
ranges={'barbarian':(8,10),'bard':(11,14),'cleric':(15,18),'druid':(19,23),'fighter':(24,25),'monk':(26,29),'paladin':(30,34),'ranger':(35,38),'rogue':(39,41),'sorcerer':(42,45),'warlock':(46,51),'wizard':(52,55)}
def source(page):return f'SRD 5.1 p. {page} (CC BY 4.0), https://media.wizards.com/2023/downloads/dnd/SRD_CC_v5.1.pdf#page={page}'
def find(cls,name):
 a,b=ranges[cls];matches=[s for s in sections if a<=s['page']<=b and s['heading'].replace('’',"'")==name.replace('’',"'")]
 if not matches:raise ValueError((cls,name))
 return matches[0]
def prose(cls,name):
 s=find(cls,name);return s['heading']+'\n'+s['text']
def make(cls,name,components=None,ident=None,tags=None):
 fid=P+cls+'.'+(ident or slug(name));s=find(cls,name)
 f={'id':fid,'revision':1,'name':name,'displayName':name,'tags':tags or ['class-feature'],'description':prose(cls,name),'source':source(s['page']),'components':components or []}
 features[fid]=f;return fid
def newfeature(fid,name,components,tags=None):
 f={'id':P+fid,'revision':1,'name':name,'displayName':name,'components':components,'tags':tags or ['class-feature']};features[f['id']]=f;return f
specs={
'barbarian':{'die':12,'save':['strength','constitution'],'skills':'animal-handling athletics intimidation nature perception survival','count':2,'armor':['light','medium','shield'],'weapons':['simple','martial'],'multi':['strength'],'sub':('Path of the Berserker',3,{3:['Frenzy'],6:['Mindless Rage'],10:['Intimidating Presence'],14:['Retaliation']}),'levels':{1:['Rage','Unarmored Defense'],2:['Reckless Attack','Danger Sense'],3:['Primal Path'],5:['Extra Attack','Fast Movement'],7:['Feral Instinct'],9:['Brutal Critical'],11:['Relentless Rage'],15:['Persistent Rage'],18:['Indomitable Might'],20:['Primal Champion']}},
'bard':{'die':8,'save':['dexterity','charisma'],'skills':'all','count':3,'armor':['light'],'weapons':['simple'],'multi':['charisma'],'sub':('College of Lore',3,{3:['Bonus Proficiencies','Cutting Words'],6:['Additional Magical Secrets'],14:['Peerless Skill']}),'levels':{1:['Spellcasting','Bardic Inspiration'],2:['Jack of All Trades','Song of Rest'],3:['Bard College','Expertise'],5:['Font of Inspiration'],6:['Countercharm'],10:['Magical Secrets'],20:['Superior Inspiration']}},
'druid':{'die':8,'save':['intelligence','wisdom'],'skills':'arcana animal-handling insight medicine nature perception religion survival','count':2,'armor':['light','medium','shield'],'weapons':[],'multi':['wisdom'],'sub':('Circle of the Land',2,{2:['Bonus Cantrip','Natural Recovery','Circle Spells'],6:["Land’s Stride"],10:["Nature’s Ward"],14:["Nature’s Sanctuary"]}),'levels':{1:['Druidic','Spellcasting'],2:['Wild Shape','Druid Circle'],18:['Timeless Body','Beast Spells'],20:['Archdruid']}},
'monk':{'die':8,'save':['strength','dexterity'],'skills':'acrobatics athletics history insight religion stealth','count':2,'armor':[],'weapons':['simple'],'multi':['dexterity','wisdom'],'sub':('Way of the Open Hand',3,{3:['Open Hand Technique'],6:['Wholeness of Body'],11:['Tranquility'],17:['Quivering Palm']}),'levels':{1:['Unarmored Defense','Martial Arts'],2:['Ki','Unarmored Movement'],3:['Monastic Tradition','Deflect Missiles'],4:['Slow Fall'],5:['Extra Attack','Stunning Strike'],6:['Ki-Empowered Strikes'],7:['Evasion','Stillness of Mind'],10:['Purity of Body'],13:['Tongue of the Sun and Moon'],14:['Diamond Soul'],15:['Timeless Body'],18:['Empty Body'],20:['Perfect Self']}},
'paladin':{'die':10,'save':['wisdom','charisma'],'skills':'athletics insight intimidation medicine persuasion religion','count':2,'armor':['light','medium','heavy','shield'],'weapons':['simple','martial'],'multi':['strength','charisma'],'sub':('Oath of Devotion',3,{3:['Oath Spells','Channel Divinity'],7:['Aura of Devotion'],15:['Purity of Spirit'],20:['Holy Nimbus']}),'levels':{1:['Divine Sense','Lay on Hands'],2:['Fighting Style','Spellcasting','Divine Smite'],3:['Divine Health','Sacred Oath'],5:['Extra Attack'],6:['Aura of Protection'],10:['Aura of Courage'],11:['Improved Divine Smite'],14:['Cleansing Touch']}},
'ranger':{'die':10,'save':['strength','dexterity'],'skills':'animal-handling athletics insight investigation nature perception stealth survival','count':3,'armor':['light','medium','shield'],'weapons':['simple','martial'],'multi':['dexterity','wisdom'],'sub':('Hunter',3,{3:["Hunter’s Prey"],7:['Defensive Tactics'],11:['Multiattack'],15:["Superior Hunter’s Defense"]}),'levels':{1:['Favored Enemy','Natural Explorer'],2:['Fighting Style','Spellcasting'],3:['Ranger Archetype','Primeval Awareness'],5:['Extra Attack'],8:["Land’s Stride"],10:['Hide in Plain Sight'],14:['Vanish'],18:['Feral Senses'],20:['Foe Slayer']}},
'sorcerer':{'die':6,'save':['constitution','charisma'],'skills':'arcana deception insight intimidation persuasion religion','count':2,'armor':[],'weapons':[],'multi':['charisma'],'sub':('Draconic Bloodline',1,{1:['Dragon Ancestor','Draconic Resilience'],6:['Elemental Affinity'],14:['Dragon Wings'],18:['Draconic Presence']}),'levels':{1:['Spellcasting','Sorcerous Origin'],2:['Font of Magic'],3:['Metamagic'],20:['Sorcerous Restoration']}},
'warlock':{'die':8,'save':['wisdom','charisma'],'skills':'arcana deception history intimidation investigation nature religion','count':2,'armor':['light'],'weapons':['simple'],'multi':['charisma'],'sub':('The Fiend',1,{1:['Expanded Spell List',"Dark One’s Blessing"],6:["Dark One’s Own Luck"],10:['Fiendish Resilience'],14:['Hurl Through Hell']}),'levels':{1:['Otherworldly Patron','Pact Magic'],2:['Eldritch Invocations'],3:['Pact Boon'],11:['Mystic Arcanum'],20:['Eldritch Master']}}
}
allskills=[f['id'] for f in features.values() if f['id'].startswith(P+'skill.') and not '.roll.' in f['id']]
newclasses=[]
for cls,sp in specs.items():
 entry=[]
 for ability in sp['save']:entry.append(modifier('save.'+ability,'training.save.'+ability,1,'floor',condition={'context':'isStartingClass'}))
 for armor in sp['armor']:entry.append(modifier('armor.'+armor,'training.armor.'+armor,1,'floor',**({'condition':{'context':'isStartingClass'}} if armor=='heavy' or cls=='bard' else {})))
 for weapon in sp['weapons']:entry.append(modifier('weapon.'+weapon,'training.weapons.'+weapon,1,'floor',**({'condition':{'context':'isStartingClass'}} if cls=='bard' else {})))
 ids=allskills if sp['skills']=='all' else ['skill.'+s for s in sp['skills'].split()]
 count={'if':{'context':'isStartingClass'},'then':sp['count'],'else':1 if cls in ['bard','ranger'] else 0}
 entry.append(choice('skills',ids,count))
 entryid=make(cls,'Proficiencies',entry,'entry');features[entryid]['description']+='\n\n'+prose(cls,'Equipment');features[entryid]['displayName']=cls.title()+' Starting Traits'
 hp=copy.deepcopy(features[P+'fighter.hit-points']);hp.update(id=P+cls+'.hit-points',name=cls.title()+' Hit Points',displayName=cls.title()+' Hit Points',source=source(ranges[cls][0]),description=prose(cls,'Hit Points'))
 hp['components']=[copy.deepcopy(hp['components'][0]),grant('resource.hit-points','hp-tracker')];hp['parameters']['roll']['default']=sp['die']//2+1;hp['parameters']['roll']['maximum']=sp['die']
 def replace(v):
  if isinstance(v,dict):
   for k,x in v.items():
    if x==10:v[k]=sp['die']
    elif x==6:v[k]=sp['die']//2+1
    else:replace(x)
  elif isinstance(v,list):
   for i,x in enumerate(v):
    if x==10:v[i]=sp['die']
    elif x==6:v[i]=sp['die']//2+1
    else:replace(x)
 replace(hp['components'][0]);features[hp['id']]=hp
 levels={str(n):[grant(cls+'.hit-points','hit-points')] for n in range(1,21)}
 levels['1'] += [grant(entryid,'entry'),grant(f'hit-dice.d{sp["die"]}','rest-healing')]
 for lvl,names in sp['levels'].items():
  for name in names:
   fid=make(cls,name);features[fid]['contentLevel']=lvl;levels[str(lvl)].append(grant(fid))
 sub,sublevel,sublevels=sp['sub'];subid=make(cls,sub,ident='subclass',tags=['class-feature','subclass',cls+'-subclass'])
 for lvl,names in sublevels.items():
  for name in names:
   fid=make(cls,name,ident='subclass.'+slug(name));features[fid]['contentLevel']=lvl
   features[fid]['prerequisites']={'feature':subid}
   levels[str(lvl)].append(grant(fid))
 levels[str(sublevel)].append(choice('subclass',[subid]))
 newclasses.append({'id':P+cls,'revision':1,'name':cls.title(),'maximumLevel':20,'source':source(ranges[cls][0]),'description':'\n\n'.join(prose(cls,n) for n in ['Class Features','Hit Points','Proficiencies','Equipment']),'levels':levels,'multiclassPrerequisites':{'all':[{'stat':s,'minimum':13} for s in sp['multi']]}})
# Common rule blocks are reused; each class supplies its own source prose.
for cls in ['barbarian','monk','paladin','ranger']:features[P+cls+'.extra-attack']['components']=[modifier('extra-attack','attacksPerAction',2,'floor')]
features[P+'barbarian.primal-champion']['components']=[modifier('strength','strength',4),modifier('constitution','constitution',4)]
features[P+'sorcerer.subclass.draconic-resilience']['components']=[modifier('hp','hitPoints',level('sorcerer'))]
for cls,ability in [('barbarian','constitution'),('monk','wisdom')]:
 features[P+cls+'.unarmored-defense']['components']=[modifier('unarmored-ac','armorClass',op('add',10,stat('modifier.dexterity'),stat('modifier.'+ability),*( [op('multiply',2,stat('shield'))] if cls=='barbarian' else [])),'floor',condition=op('and',op('eq',stat('armorIndex'),0),op('eq',stat('shield'),0) if cls=='monk' else True))]
features[P+'barbarian.fast-movement']['components']=[modifier('speed','walkingSpeed',10,condition=op('lt',{'table':'armorCategory','owner':P+'tables','input':stat('armorIndex')},3))]
features[P+'monk.unarmored-movement']['components']=[modifier('speed','walkingSpeed',op('add',10,op('multiply',5,op('floor',op('divide',op('subtract',level('monk'),2),4)))) ,condition=op('and',op('eq',stat('armorIndex'),0),op('eq',stat('shield'),0)))]
# Generic resource wrappers preserve one tracker per Feature.
extra_stats=[]
def resource(cls,fid,key,maximum,recovery,cost=1):
 cap='resource.capacity.'+key
 extra_stats.append({'id':cap,'name':key.replace('-',' ').title()+' Maximum','kind':'derived','expression':maximum,'minimum':0,'integer':True})
 pool=newfeature('resource.'+key,key.replace('-',' ').title(),[{'id':'tracker','kind':'trackResource','key':key,'name':key.replace('-',' ').title(),'units':'points' if 'points' in key or key=='lay-on-hands' else 'uses','integer':True,'maximum':stat(cap),'initialAmount':stat(cap),'recovery':recovery}],['resource-tracker'])
 features[fid]['components'] += [grant(pool['id'],'resource'),{'id':'use','kind':'grantCapability','name':features[fid]['name'],'costs':[{'key':key,'amount':cost}]}]
full=lambda *events:[{'event':e,'amount':'full'} for e in events]
resource('barbarian',P+'barbarian.rage','rage',{'if':op('gte',level('barbarian'),20),'then':0,'else':{'if':op('gte',level('barbarian'),17),'then':6,'else':{'if':op('gte',level('barbarian'),12),'then':5,'else':{'if':op('gte',level('barbarian'),6),'then':4,'else':{'if':op('gte',level('barbarian'),3),'then':3,'else':2}}}}},full('long-rest'))
features[P+'barbarian.rage']['components'][-1]['costs'][0]['amount']={'if':op('gte',level('barbarian'),20),'then':0,'else':1}
resource('monk',P+'monk.ki','ki',level('monk'),full('short-rest','long-rest'))
resource('sorcerer',P+'sorcerer.font-of-magic','sorcery-points',level('sorcerer'),full('long-rest')+[{'event':'short-rest','amount':{'if':op('gte',level('sorcerer'),20),'then':4,'else':0}}])
resource('druid',P+'druid.wild-shape','wild-shape',2,full('short-rest','long-rest'))
features[P+'druid.wild-shape']['components'][-1]['costs'][0]['amount']={'if':op('gte',level('druid'),20),'then':0,'else':1}
resource('bard',P+'bard.bardic-inspiration','bardic-inspiration',op('max',1,stat('modifier.charisma')),full('long-rest')+[{'event':'short-rest','amount':{'if':op('gte',level('bard'),5),'then':op('max',1,stat('modifier.charisma')),'else':0}}])
resource('paladin',P+'paladin.lay-on-hands','lay-on-hands',op('multiply',5,level('paladin')),full('long-rest'))
resource('paladin',P+'paladin.divine-sense','divine-sense',op('max',0,op('add',1,stat('modifier.charisma'))),full('long-rest'))
resource('paladin',P+'paladin.cleansing-touch','cleansing-touch',op('max',1,stat('modifier.charisma')),full('long-rest'))
resource('paladin',P+'paladin.subclass.channel-divinity','paladin-channel-divinity',1,full('short-rest','long-rest'))
resource('monk',P+'monk.subclass.wholeness-of-body','wholeness-of-body',1,full('long-rest'))
resource('warlock',P+'warlock.subclass.dark-one-s-own-luck','dark-ones-own-luck',1,full('short-rest','long-rest'))
resource('warlock',P+'warlock.subclass.hurl-through-hell','hurl-through-hell',1,full('long-rest'))
# Make authored option lists actual nested selections.
for cls,heading,names,count in [('sorcerer','Metamagic',['Careful Spell','Distant Spell','Empowered Spell','Extended Spell','Heightened Spell','Quickened Spell','Subtle Spell','Twinned Spell'],{'if':op('gte',level('sorcerer'),17),'then':4,'else':{'if':op('gte',level('sorcerer'),10),'then':3,'else':2}}),('warlock','Pact Boon',['Pact of the Chain','Pact of the Blade','Pact of the Tome'],1)]:
 features[P+cls+'.'+slug(heading)]['components'].append(choice('options',[make(cls,n) for n in names],count))
for cls,styles in [('paladin',['defense','dueling','great-weapon-fighting','protection']),('ranger',['archery','defense','dueling','two-weapon-fighting'])]:features[P+cls+'.fighting-style']['components'].append(choice('style',['style.'+s for s in styles]))
# Install definitions into every rules configuration.
for c in data['configurations']:
 for cls in newclasses:
  item=copy.deepcopy(cls)
  for n in [4,8,12,16,19]:item['levels'][str(n)].append(copy.deepcopy(c['classes'][0]['levels']['4'][-1]))
  c['classes']=[old for old in c['classes'] if old['id']!=item['id']]+[item]
 s=c['system'];s['classes']=[cls['id'] for cls in c['classes']];s['recoveryEvents']=['short-rest','long-rest'];s['stats']=[x for x in s['stats'] if x['id'] not in {v['id'] for v in extra_stats}]+copy.deepcopy(extra_stats)
 # Hit Dice capacities count all classes sharing that die type.
 dies={**{k:v['die'] for k,v in specs.items()},'fighter':10,'rogue':8,'wizard':6,'cleric':8}
 for die in [6,8,10,12]:
  sid=f'resource.capacity.hit-dice.d{die}';s['stats']=[x for x in s['stats'] if x['id']!=sid]+[{'id':sid,'name':f'Hit Dice (d{die}) maximum','kind':'derived','expression':op('add',*[level(cls) for cls,n in dies.items() if n==die]),'minimum':0,'integer':True}]
 s['recoveryAllocations']['long-rest']['keys']=['hit-dice.d12','hit-dice.d10','hit-dice.d8','hit-dice.d6']
 s['stats']=[x for x in s['stats'] if x['id']!='srdCasterLevel']+[{'id':'srdCasterLevel','name':'Spellcasting level','kind':'derived','expression':op('add',*[level(cls) for cls in ['bard','cleric','druid','sorcerer','wizard']],op('floor',op('divide',level('paladin'),2)),op('floor',op('divide',level('ranger'),2)))}]
 for n in range(1,10):
  target=next(x for x in s['stats'] if x['id']==f'spellSlots.{n}')
  target['expression']={'table':f'slots{n}','owner':P+'tables','input':stat('srdCasterLevel')}
# d12 Hit Dice reuse the same resource/roll definitions.
for fid in [P+'resource.hit-dice.d10',P+'hit-dice.d10',P+'hit-dice.d10.roll']:
 f=json.loads(json.dumps(features[fid]).replace('d10','d12'));features[f['id']]=f
for cls,die in {**{k:v['die'] for k,v in specs.items()},'fighter':10,'rogue':8,'wizard':6,'cleric':8}.items():
 hp=features[P+cls+'.hit-points'];hp['components']=[x for x in hp['components'] if x['id']!='hit-die-grant']+[{'id':'hit-die-grant','kind':'grantResource','key':f'hit-dice.d{die}','amount':1}]
for die in [6,8,10,12]:features[P+f'resource.hit-dice.d{die}']['components'][0]['initialAmount']=0
# Record exact catalogue automation scope separately from source text.
meta_path=Path('src/systems/dnd5e-2014/metadata.json');meta=json.loads(meta_path.read_text(encoding='utf-8'))
meta['coverage']['unsupportedClasses']=[]
meta['coverage']['additionalSourcesPending']=['Artificer (final published 2014-compatible version)','Non-SRD subclasses: final published sources pending approval/access']
meta['coverage']['classCatalogue']='All 12 SRD classes; conditional combat, transformations, companions, and narrative effects remain source-text adjudicated.'
for cls,sp in specs.items():meta['classInfo'][cls]={'hitDie':sp['die'],'asi':[4,8,12,16,19],'subclassAt':sp['sub'][1],'subclass':'subclass','startingSkills':sp['count'],'multiclassSkills':1 if cls in ['bard','ranger'] else 0,'skills':[x.split('skill.')[-1] for x in (allskills if sp['skills']=='all' else sp['skills'].split())]}
meta_path.write_text(json.dumps(meta,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
data['features']=list(features.values());path.write_text(json.dumps(data,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
print('Added eight SRD class progressions and their subclass source Features.')
