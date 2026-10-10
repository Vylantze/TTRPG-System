"""Author mechanical data from the approved Tasha Artificer (2020), not book prose.

Source: https://www.dndbeyond.com/sources/dnd/tcoe/artificer
Idempotent: preserves other Systems and existing SRD spell descriptions.
"""
import copy
import json
import re
from pathlib import Path

PATH = Path('src/systems/dnd5e-2014/system.json')
D = json.loads(PATH.read_text(encoding='utf-8'))
P = 'dnd5e:2014:'
URL = 'https://www.dndbeyond.com/sources/dnd/tcoe/artificer'
F = {f['id']: f for f in D['features'] if not f['id'].startswith(P+'artificer.')}
slug = lambda s: re.sub('[^a-z0-9]+', '-', s.lower()).strip('-')
op = lambda name, *args: {'op': name, 'args': list(args)}
st = lambda s: {'stat': s}
lv = lambda c='artificer': {'context': 'level.'+P+c}
at = lambda n: op('gte', lv(), n)
iff = lambda c, a, b: {'if': c, 'then': a, 'else': b}
INT = st('modifier.intelligence')
PB = st('proficiencyBonus')
IM = op('max', 1, INT)
stats = []

def grant(fid, id=None):
    return {'id': id or fid.split(':')[-1], 'kind': 'grantFeature', 'feature': fid if fid.startswith(P) else P+fid}

def mod(id, target, value, operation='add', **kw):
    return {'id': id, 'kind': 'modifyStat', 'stat': target, 'operation': operation, 'value': value, **kw}

def define(id, value, name=None):
    return {'id': id, 'kind': 'defineStat', 'stat': {'id': id, 'name': name or id, 'kind': 'derived', 'expression': value}}

def choose(id, ids, count=1, maximum=None, **kw):
    return {'id': id, 'kind': 'chooseFeatures', 'eligibility': 'current', 'minimum': count, 'maximum': count if maximum is None else maximum, 'candidates': {'ids': ids}, 'retraining': {'allowed': True}, **kw}

def feature(key, name, components=None, level=1, anchor=None, **kw):
    fid=P+'artificer.'+key
    F[fid]={'id':fid,'revision':1,'name':name,'displayName':name,'tags':['class-feature'], 'contentLevel':level,'source':"Tasha’s Cauldron of Everything (2020), "+URL+'#'+(anchor or {'Artificer Starting Traits':'Proficiencies1','Artificer Spellcasting':'Spellcasting','Guardian':'ArmorModel','Infiltrator':'ArmorModel'}.get(name,re.sub('[^A-Za-z0-9]','',name))), 'components':components or [], **kw}
    return fid

def pool(owner, key, name, capacity, events=('long-rest',), condition=None):
    tracker={'id':'tracker','kind':'trackResource','key':key,'name':name,'units':'uses','integer':True,'maximum':capacity,'initialAmount':capacity,'recovery':[{'event':e,'amount':'full'} for e in events]}
    if condition: tracker['condition']=condition
    fid=feature('resource.'+key,name,[tracker],tags=['resource-tracker'],anchor='ArtificerInfusions' if 'infusion' in key else None)
    F[fid]['source']=F[owner]['source']
    F[owner]['components'].append(grant(fid,'resource-'+key))
    return key

def capability(owner, name, key=None, condition=None, id=None):
    c={'id':id or slug(name),'kind':'grantCapability','name':name,'costs':[{'key':key,'amount':1}] if key else []}
    if condition:c['condition']=condition
    F[owner]['components'].append(c)
    return name

def roll(owner, name, dice, bonus=0, cost=None, restore=None, condition=None):
    label=capability(owner,name,cost,condition)
    r={'id':slug(name),'label':name,'dice':dice,'bonus':bonus,'capability':label}
    if restore:r['restoreResource']=restore
    fid=feature(owner.split('artificer.',1)[1]+'.roll.'+slug(name),name,[],tags=['roll-feature'],roll=r)
    F[fid]['source']=F[owner]['source']
    F[owner]['components'].append(grant(fid))

def summary(fid, *lines):
    F[fid]['mechanicalSummary']=list(lines)

hp=copy.deepcopy(F[P+'rogue.hit-points'])
hp.update(id=P+'artificer.hit-points',name='Artificer Hit Points',displayName='Artificer Hit Points',source=URL+'#ClassFeatures')
for k in ['description','descriptionOverride']:hp.pop(k,None)
hp['components']=[c for c in hp['components'] if c['id']!='roll-feature-1'];F[hp['id']]=hp
summary(hp['id'],'Hit die: d8. First character level: 8 + Constitution modifier; subsequent Artificer levels: 5 (or a d8 roll) + Constitution modifier.')
levels={str(n):[grant(hp['id'],'hit-points')] for n in range(1,21)}
def base(n,key,name,components=None):
    fid=feature(key,name,components,n);levels[str(n)].append(grant(fid));return fid

tools=['alchemists-supplies','brewers-supplies','calligraphers-supplies','carpenters-tools','cartographers-tools','cobblers-tools','cooks-utensils','glassblowers-tools','jewelers-tools','leatherworkers-tools','masons-tools','painters-supplies','potters-tools','smiths-tools','tinkers-tools','weavers-tools','woodcarvers-tools']
toolids=[]
for t in tools:
    tid='training.tool.'+t
    stats.append({'id':tid,'name':t.replace('-',' ').title()+' proficiency','kind':'derived','expression':0})
    toolids.append(feature('tool.'+t,t.replace('-',' ').title(),[mod('training',tid,1,'floor')],tags=['tool-proficiency'],anchor='Proficiencies1'))
entry=[mod('save-'+a,'training.save.'+a,1,'floor',condition={'context':'isStartingClass'}) for a in ['constitution','intelligence']]
entry += [mod('armor-'+a,'training.armor.'+a,1,'floor') for a in ['light','medium','shield']]+[mod('simple','training.weapons.simple',1,'floor',condition={'context':'isStartingClass'}),mod('thieves','training.tool.thieves-tools',1,'floor'),mod('tinker','training.tool.tinkers-tools',1,'floor')]
entry += [choose('artisan-tool',toolids,iff({'context':'isStartingClass'},1,0),eligibility='acquisition'),choose('skills',[P+'skill.'+s for s in ['arcana','history','investigation','medicine','nature','perception','sleight-of-hand']],iff({'context':'isStartingClass'},2,0))]
base(1,'entry','Artificer Starting Traits',entry)
levels['1'].append(grant('hit-dice.d8','rest-healing'))
tinkering=base(1,'magical-tinkering','Magical Tinkering',[define('magicalTinkeringLimit',IM,'Magical Tinkering objects')])
summary(tinkering,'Maximum active objects: Intelligence modifier (minimum 1). Object effects and replacement are managed at the table.')
infuse=base(2,'infuse-item','Infuse Item',[define('infusionsKnown',op('add',4,op('multiply',2,op('floor',op('divide',op('max',0,op('subtract',lv(),2)),4)))),'Infusions known'),define('infusionsActive',op('add',2,op('floor',op('divide',op('max',0,op('subtract',lv(),2)),4))),'Infused items')])
base(3,'right-tool','The Right Tool for the Job')
base(6,'tool-expertise','Tool Expertise',[mod('thieves-expertise','check.thieves-tools',PB,condition=op('eq',st('training.tool.thieves-tools'),1))]+[define('toolBonus.'+t,op('multiply',PB,iff(op('gte',st('training.tool.'+t),1),2,0)),t.replace('-',' ').title()+' proficiency bonus') for t in tools])
flash=base(7,'flash-of-genius','Flash of Genius');pool(flash,'flash-of-genius','Flash of Genius',IM);capability(flash,'Flash of Genius','flash-of-genius');summary(flash,'Reaction: add Intelligence modifier to an ability check or saving throw within 30 feet. Uses: Intelligence modifier (minimum 1) per long rest.')
base(10,'magic-item-adept','Magic Item Adept');store=base(11,'spell-storing-item','Spell-Storing Item');pool(store,'spell-storing-item','Spell-Storing Item',op('multiply',2,IM));capability(store,'Use stored spell','spell-storing-item');summary(store,'Store an Artificer level 1 or 2 spell with a one-action casting time in a weapon or focus. Its bearer uses your spellcasting ability. Choose the spell and resolve its effects at the table.')
base(14,'magic-item-savant','Magic Item Savant');base(18,'magic-item-master','Magic Item Master')
base(20,'soul-of-artifice','Soul of Artifice',[mod('save-'+a,'save.'+a,{'context':'attunedItemCount'}) for a in ['strength','dexterity','constitution','intelligence','wisdom','charisma']])

# Spell wrappers reuse existing casting blocks and canonical SRD Roll Features.
spellnames=[
'Acid Splash|Booming Blade|Create Bonfire|Dancing Lights|Fire Bolt|Frostbite|Green-Flame Blade|Guidance|Light|Lightning Lure|Mage Hand|Magic Stone|Mending|Message|Poison Spray|Prestidigitation|Ray of Frost|Resistance|Shocking Grasp|Spare the Dying|Sword Burst|Thorn Whip|Thunderclap',
'Absorb Elements|Alarm|Catapult|Cure Wounds|Detect Magic|Disguise Self|Expeditious Retreat|Faerie Fire|False Life|Feather Fall|Grease|Identify|Jump|Longstrider|Purify Food and Drink|Sanctuary|Snare|Tasha’s Caustic Brew',
'Aid|Alter Self|Arcane Lock|Blur|Continual Flame|Darkvision|Enhance Ability|Enlarge/Reduce|Heat Metal|Invisibility|Lesser Restoration|Levitate|Magic Mouth|Magic Weapon|Protection from Poison|Pyrotechnics|Rope Trick|See Invisibility|Skywrite|Spider Climb|Web',
'Blink|Catnap|Create Food and Water|Dispel Magic|Elemental Weapon|Flame Arrows|Fly|Glyph of Warding|Haste|Intellect Fortress|Protection from Energy|Revivify|Tiny Servant|Water Breathing|Water Walk',
'Arcane Eye|Elemental Bane|Fabricate|Freedom of Movement|Secret Chest|Faithful Hound|Private Sanctum|Resilient Sphere|Stone Shape|Stoneskin|Summon Construct',
'Animate Objects|Arcane Hand|Creation|Greater Restoration|Skill Empowerment|Transmute Rock|Wall of Stone']
wrappers={}
def spell(name, n):
    key=slug(name);canonical=P+'spell.'+key
    sourcewrapper=next((f for f in F.values() if any(c.get('kind')=='useBlock' and c.get('arguments',{}).get('spell')==canonical for c in f['components'])),None)
    if canonical not in F:
        F[canonical]={'id':canonical,'revision':1,'name':name,'displayName':name,'tags':['spell'],'contentLevel':n,'source':URL+'#ArtificerSpellList','components':[], 'repeat':{'maximum':20,'scope':'character'}}
    if sourcewrapper:
        block=copy.deepcopy(next(c for c in sourcewrapper['components'] if c['kind']=='useBlock'))
        block['arguments']['castingAbility']='intelligence'
        block['arguments']['ritualAllowed']=name in ['Alarm','Detect Magic','Identify','Purify Food and Drink','Magic Mouth','Skywrite','Water Breathing','Water Walk']
    else:
        block={'id':'casting','kind':'useBlock','block':P+'casting.level-'+str(n),'arguments':{'spellName':name,'spell':canonical,'castingAbility':'intelligence','ritualAllowed':name=='Skywrite','actionKind':'action','actionAmount':1,'school':'See source','sourcePage':0,'castingTime':'See source','range':'See source','components':'See source'}}
    fid=feature(('cantrip.' if n==0 else 'prepared.')+key,name,[block,grant(canonical,'spell-text')],n,anchor='ArtificerSpellList',tags=['artificer-cantrip' if n==0 else 'artificer-spell'],textReferences=[canonical],repeat={'maximum':2,'scope':'character'})
    wrappers[name]=fid
    return fid
for n,names in enumerate(spellnames):
    for name in names.split('|'):spell(name,n)
casting=base(1,'spellcasting','Artificer Spellcasting',[grant('resource.spell-slot.'+str(n),'slot-'+str(n)) for n in range(1,10)]+[
    define('artificerSpellLevel',op('min',5,op('ceil',op('divide',lv(),4))),'Artificer spell level'),
    define('artificerSpellAttack',op('add',PB,INT),'Artificer spell attack'),define('artificerSpellDC',op('add',8,PB,INT),'Artificer spell save DC'),
    define('artificerPreparationLimit',op('max',1,op('add',INT,op('floor',op('divide',lv(),2)))),'Artificer prepared spells'),
    choose('cantrips',[wrappers[name] for name in spellnames[0].split('|')],iff(at(14),4,iff(at(10),3,2))),
    choose('prepared',[wrappers[name] for names in spellnames[1:] for name in names.split('|')],1,st('artificerPreparationLimit'))])
F[casting]['components'][-1]['candidates']['maximumLevel']=st('artificerSpellLevel')

subclasses={
'alchemist':{3:['Experimental Elixir'],5:['Alchemical Savant'],9:['Restorative Reagents'],15:['Chemical Mastery']},
'armorer':{3:['Arcane Armor','Armor Model'],5:['Extra Attack'],9:['Armor Modifications'],15:['Perfected Armor']},
'artillerist':{3:['Eldritch Cannon'],5:['Arcane Firearm'],9:['Explosive Cannon'],15:['Fortified Position']},
'battle-smith':{3:['Battle Ready','Steel Defender'],5:['Extra Attack'],9:['Arcane Jolt'],15:['Improved Defender']}}
subspells={
'alchemist':['Healing Word|Ray of Sickness','Flaming Sphere|Acid Arrow','Gaseous Form|Mass Healing Word','Blight|Death Ward','Cloudkill|Raise Dead'],
'armorer':['Magic Missile|Thunderwave','Mirror Image|Shatter','Hypnotic Pattern|Lightning Bolt','Fire Shield|Greater Invisibility','Passwall|Wall of Force'],
'artillerist':['Shield|Thunderwave','Scorching Ray|Shatter','Fireball|Wind Wall','Ice Storm|Wall of Fire','Cone of Cold|Wall of Force'],
'battle-smith':['Heroism|Shield','Branding Smite|Warding Bond','Aura of Vitality|Conjure Barrage','Aura of Purity|Fire Shield','Banishing Smite|Mass Cure Wounds']}
for sub,progression in subclasses.items():
    sid=feature(sub,sub.replace('-',' ').title(),[],3,tags=['class-feature','subclass','artificer-subclass'])
    for n,names in progression.items():
        for name in names:
            fid=feature(sub+'.'+slug(name),name,[],n,prerequisites={'feature':sid},anchor='ExtraAttack1' if sub=='battle-smith' and name=='Extra Attack' else None)
            F[sid]['components'].append({**grant(fid), 'atClassLevel': n})
    tool={'alchemist':'alchemists-supplies','armorer':'smiths-tools','artillerist':'woodcarvers-tools','battle-smith':'smiths-tools'}[sub]
    # Select the listed tool or another artisan tool if already proficient.
    specialisttools=[]
    for t, tid in zip(tools,toolids):
        wrapper=feature(sub+'.tool.'+t,sub.replace('-',' ').title()+': '+t.replace('-',' ').title(),[grant(tid)],3,anchor={'alchemist':'ToolProficiency','armorer':'ToolsoftheTrade','artillerist':'ToolProficiency1','battle-smith':'BattleSmithToolProficiency'}[sub])
        if t!=tool:F[wrapper]['prerequisites']={'stat':'training.tool.'+tool,'minimum':1}
        specialisttools.append(wrapper)
    F[sid]['components'].append(choose('specialist-tool',specialisttools,eligibility='acquisition'))
    F[sid]['components'].append(define('specialistToolDefault.'+sub,1,tool.replace('-',' ').title()+' (or replacement artisan tool)'))
    for n,names in zip([3,5,9,13,17],subspells[sub]):
        fid=feature(sub+'.spells-'+str(n),sub.replace('-',' ').title()+' Spells '+str(n),[grant(wrappers.get(name) or spell(name,(n+1)//4)) for name in names.split('|')],n,prerequisites={'feature':sid},anchor=re.sub('[^A-Za-z]','',sub.title())+'Spells')
        F[sid]['components'].append({**grant(fid), 'atClassLevel': n})
levels['3'].append(choose('specialist',[P+'artificer.'+s for s in subclasses], eligibility='acquisition'))
for sub in ['armorer','battle-smith']:F[P+'artificer.'+sub+'.extra-attack']['components']=[mod('attacks','attacksPerAction',2,'floor')]
F[P+'artificer.armorer.arcane-armor']['components']=[mod('heavy','training.armor.heavy',1,'floor'),mod('strength','armorStrengthExemption',1,'floor')]
F[P+'artificer.battle-smith.battle-ready']['components']=[mod('martial','training.weapons.martial',1,'floor')]

# Resource and roll children remain separate reusable Features.
elixir=P+'artificer.alchemist.experimental-elixir';pool(elixir,'experimental-elixir','Experimental Elixir',iff(at(15),3,iff(at(6),2,1)));roll(elixir,'Determine elixir','1d6',cost='experimental-elixir')
summary(elixir,'d6: 1 healing (2d4 + Intelligence); 2 speed (+10 ft, 1 hour); 3 AC (+1, 10 minutes); 4 attacks/saves (+1d4, 1 minute); 5 flight (10 ft, 10 minutes); 6 transformation (Alter Self, 10 minutes). Extra elixirs consume a spell slot; choose their effect.')
for n in range(1,10):capability(elixir,'Create chosen elixir (slot '+str(n)+')','spell-slot.'+str(n),op('gte',st('spellSlots.'+str(n)),1))
reagents=P+'artificer.alchemist.restorative-reagents';pool(reagents,'reagents','Lesser Restoration (Reagents)',IM);capability(reagents,'Lesser Restoration (Reagents)','reagents');roll(reagents,'Elixir temporary HP','2d6',{'stat':'modifier.intelligence'})
mastery=P+'artificer.alchemist.chemical-mastery'
for name in ['Heal','Greater Restoration']:
    key='chemical-'+slug(name);pool(mastery,key,name,1);capability(mastery,name,key)
summary(mastery,'Acid and poison resistance; poisoned-condition immunity. Heal and Greater Restoration: each once per long rest without a slot or material components.')
summary(P+'artificer.alchemist.alchemical-savant','Using alchemist’s supplies: add Intelligence modifier (minimum 1) to one healing roll or one acid, fire, necrotic, or poison damage roll of the spell.')
guardian=feature('armorer.guardian','Guardian',[],3);infiltrator=feature('armorer.infiltrator','Infiltrator',[mod('speed','walkingSpeed',5)],3)
F[P+'artificer.armorer.armor-model']['components']=[choose('model',[guardian,infiltrator])]
pool(guardian,'defensive-field','Defensive Field',PB);capability(guardian,'Defensive Field','defensive-field');roll(guardian,'Thunder Gauntlets','1d8',{'stat':'modifier.intelligence'});summary(guardian,'Defensive Field grants temporary HP equal to Artificer level. Thunder Gauntlets deal thunder damage and impose disadvantage against other targets until your next turn.')
roll(infiltrator,'Lightning Launcher','1d6',{'stat':'modifier.intelligence'});roll(infiltrator,'Lightning Launcher extra damage','1d6');summary(infiltrator,'Range 90/300 feet; extra damage once per turn. Advantage on Stealth checks.')
perfect=P+'artificer.armorer.perfected-armor';pool(perfect,'perfected-guardian','Perfected Guardian',PB);capability(perfect,'Perfected Guardian pull','perfected-guardian');summary(perfect,'Guardian: reaction pull up to 25 feet on a failed Strength save; attack if within 5 feet. Infiltrator: launcher target grants advantage and +1d6 lightning on the next attack against it, and disadvantage against you.')
jolt=P+'artificer.battle-smith.arcane-jolt';pool(jolt,'arcane-jolt','Arcane Jolt',IM)
roll(jolt,'Arcane Jolt','2d6',cost='arcane-jolt',restore='hit-points',condition=op('lt',lv(),15));roll(jolt,'Improved Arcane Jolt','4d6',cost='arcane-jolt',restore='hit-points',condition=at(15))
summary(jolt,'Once per turn on a qualifying hit: choose extra force damage or healing. Applying healing to the sheet targets this character; apply to other targets manually.')
roll(P+'artificer.artillerist.arcane-firearm','Arcane Firearm bonus','1d8');summary(P+'artificer.artillerist.arcane-firearm','Add this die to one damage roll of an Artificer spell cast through the firearm.')

def companion(owner,key,name,hp,ac,speed,abilities,attack,dice,bonus,kind='creature'):
    prefix='companion.'+key+'.';condition={'context':'companionDeployed'}
    fields={'HP maximum':hp,'AC':ac,'Speed':speed,**abilities}
    ids=[]
    for label,value in fields.items():
        id=prefix+slug(label);ids.append(id);F[owner]['components'].append(define(id,value,name+' '+label))
    resource='companion-'+key+'-hp';pool(owner,resource,name+' HP',hp,(),condition)
    F[owner]['companion']={'kind':kind,'stats':ids,'resources':[resource],'resetOnCreation':[resource]}
    roll(owner,attack,dice,bonus,condition=condition)
    return resource
sd=P+'artificer.battle-smith.steel-defender'
companion(sd,'steel-defender','Steel Defender',op('add',2,INT,op('multiply',5,lv())),iff(at(15),17,15),40,{'Strength':14,'Dexterity':12,'Constitution':14,'Intelligence':4,'Wisdom':10,'Charisma':6,'Attack':st('artificerSpellAttack'),'Dex save':op('add',1,PB),'Con save':op('add',2,PB),'Athletics':op('add',2,PB),'Perception':op('multiply',2,PB)},'Force-Empowered Rend','1d8',{'stat':'proficiencyBonus'})
pool(sd,'steel-defender-repair','Steel Defender Repair',3,('long-rest',),{'context':'companionDeployed'});F[sd]['companion']['resources'].append('steel-defender-repair');roll(sd,'Repair','2d8',{'stat':'proficiencyBonus'},'steel-defender-repair','companion-steel-defender-hp',{'context':'companionDeployed'})
summary(sd,'Bonus action to command; otherwise Dodges. Mending heals 2d6. Revive within one hour: spell slot level 1+, one minute. A new defender replaces the old one. Deflect Attack uses its reaction. Poison damage and charmed/exhaustion/poisoned immunity; darkvision 60 feet.')
cannon=P+'artificer.artillerist.eldritch-cannon';pool(cannon,'cannon-creation','Eldritch Cannon creation',1)
capability(cannon,'Create cannon (free)','cannon-creation')
for n in range(1,10):capability(cannon,'Create cannon (slot '+str(n)+')','spell-slot.'+str(n),op('gte',st('spellSlots.'+str(n)),1))
companion(cannon,'cannon','Eldritch Cannon',op('multiply',5,lv()),18,15,{a:10 for a in ['Strength','Dexterity','Constitution','Intelligence','Wisdom','Charisma']},'Force Ballista','2d8',0,'object')
F[cannon]['companion']['creationCapability']='Create cannon'
for c in F[cannon]['components']:
    if c.get('name')=='Force Ballista':c['condition']=op('and',{'context':'companionDeployed'},op('lt',lv(),9))
roll(cannon,'Improved Force Ballista','3d8',condition=op('and',{'context':'companionDeployed'},at(9)))
roll(cannon,'Flamethrower','2d8',condition=op('and',{'context':'companionDeployed'},op('lt',lv(),9)));roll(cannon,'Improved Flamethrower','3d8',condition=op('and',{'context':'companionDeployed'},at(9)))
F[cannon]['components'].append(define('cannonProtectorBonus',IM,'Protector bonus'));roll(cannon,'Protector','1d8',{'stat':'cannonProtectorBonus'},condition={'context':'companionDeployed'})
summary(cannon,'Choose Flamethrower, Force Ballista, or Protector when created; one hour duration. Bonus action to activate within 60 feet. Flamethrower: 15-foot cone, Dexterity save for half. Ballista: ranged spell attack, 120 feet, force damage, 5-foot push. Protector: temporary HP within 10 feet. Poison and psychic damage immunity.')
roll(P+'artificer.artillerist.explosive-cannon','Detonate cannon','3d8');summary(P+'artificer.artillerist.fortified-position','Half cover within 10 feet of a cannon. Maximum two cannons; both can be created with the same action but require separate uses or slots, and both activate with one bonus action.')

# Infusions are learnable Features; their output properties are Item Features.
infusionids=[]
def infusion(name,n,categories,attune=False,properties=None,modifiers=None,required=None):
    key=slug(name);iid='infusion.'+key
    D['itemFeatures']=[f for f in D['itemFeatures'] if f['id']!=iid]+[{'id':iid,'name':name,'properties':properties or {},'modifiers':modifiers or []}]
    fid=feature('infusion.'+key,name,[],n,anchor=re.sub('[^A-Za-z0-9]','',name),tags=['class-feature','infusion'],prerequisites={'expression':at(n)},equipmentEffect={'categories':categories,'attunement':attune,'group':'artificer-infusions','capacityStat':'infusionsActive','itemFeatures':[iid],**({'requiredProperties':required} if required else {})})
    infusionids.append(fid);return fid
boost=iff(at(10),2,1)
infusion('Arcane Propulsion Armor',14,['Armor'],True,{'Gauntlets':'1d8 force, thrown 20/60, returning'},[mod('speed','walkingSpeed',5)])
strength=infusion('Armor of Magical Strength',2,['Armor'],True);pool(strength,'infusion-magical-strength','Armor of Magical Strength',6,(),{'context':'equipmentAssigned'});capability(strength,'Strength check/save bonus or resist prone','infusion-magical-strength',{'context':'equipmentAssigned'})
infusion('Boots of the Winding Path',6,['Boots'],True,{'Teleport':'15 feet to a space occupied this turn; bonus action'})
infusion('Enhanced Arcane Focus',2,['Focus'],True,{'Cover':'Ignore half cover'},[mod('spell-attack-'+c,c+'SpellAttack',boost) for c in ['artificer','bard','cleric','druid','paladin','ranger','sorcerer','warlock','wizard']])
infusion('Enhanced Defense',2,['Armor','Shields'],False,{},[mod('ac','armorClass',boost)])
infusion('Enhanced Weapon',2,['Weapons'],False,{'Attack/damage bonus':'+1; +2 at Artificer 10'})
infusion('Helm of Awareness',10,['Helmet'],True,{'Initiative':'Advantage','Surprise':'Immune while not incapacitated'})
hom=infusion('Homunculus Servant',2,['Gem'],False,{'Material':'Gem or crystal worth at least 100 gp'})
companion(hom,'homunculus','Homunculus Servant',op('add',1,INT,lv()),13,20,{'Fly':30,'Strength':4,'Dexterity':15,'Constitution':12,'Intelligence':10,'Wisdom':10,'Charisma':7,'Attack':st('artificerSpellAttack'),'Dex save':op('add',2,PB),'Perception':op('multiply',2,PB),'Stealth':op('add',2,PB)},'Force Strike','1d4',{'stat':'proficiencyBonus'})
summary(hom,'Requires an assigned infusion. Bonus action to command; otherwise Dodges. Force Strike range: 30 feet. Reaction delivers your touch spell within 120 feet. Evasion; poison damage and exhaustion/poisoned immunity; darkvision 60 feet. Mending heals 2d6.')
sharp=infusion('Mind Sharpener',2,['Armor','Robes']);radiant=infusion('Radiant Weapon',6,['Weapons'],True,{'Attack/damage bonus':1,'Light':'30 feet bright / 30 feet dim'})
infusion('Repeating Shot',2,['Weapons'],True,{'Attack/damage bonus':1,'Ammunition':'Generated; ignores loading'},required=['ammunition'])
shield=infusion('Repulsion Shield',6,['Armor'],True,{},[mod('ac','armorClass',1)],required=['shield'])
resist=infusion('Resistant Armor',6,['Armor'],True)
F[resist]['components'].append(choose('resistance',[feature('resistance.'+t,'Resistant Armor: '+t.title(),[],6,anchor='ResistantArmor') for t in ['acid','cold','fire','force','lightning','necrotic','poison','psychic','radiant','thunder']]))
infusion('Returning Weapon',2,['Weapons'],False,{'Attack/damage bonus':1,'Return':'Immediately after ranged attack'},required=['thrown'])
ring=infusion('Spell-Refueling Ring',6,['Ring'],True);pool(ring,'spell-refueling-ring','Spell-Refueling Ring',1,('dawn',),{'context':'equipmentAssigned'});capability(ring,'Recover one spell slot (level 1–3)','spell-refueling-ring',{'context':'equipmentAssigned'})
for fid,name in [(sharp,'Mind Sharpener'),(radiant,'Radiant Weapon'),(shield,'Repulsion Shield')]:
    key='infusion-'+slug(name);pool(fid,key,name,4,(),{'context':'equipmentAssigned'});capability(fid,'Use '+name,key,{'context':'equipmentAssigned'});summary(fid,'Charges: 4; recover 1d4 at dawn. Adjust the pool by the dawn roll. '+{'Mind Sharpener':'Reaction: turn a failed Constitution concentration save into a success.','Radiant Weapon':'Reaction after being hit: Constitution save or blinded until the end of the attacker’s next turn.','Repulsion Shield':'Reaction after a melee hit: push attacker up to 15 feet.'}[name])
summary(strength,'Charges: 6; recover 1d6 at dawn. Spend one for Intelligence bonus to a Strength check/save, or a reaction to prevent being knocked prone.')
replicas={2:'Alchemy Jug|Bag of Holding|Cap of Water Breathing|Goggles of Night|Rope of Climbing|Sending Stones|Wand of Magic Detection|Wand of Secrets',6:'Boots of Elvenkind|Cloak of Elvenkind|Cloak of the Manta Ray|Eyes of Charming|Gloves of Thievery|Lantern of Revealing|Pipes of Haunting|Ring of Water Walking',10:'Boots of Striding and Springing|Boots of the Winterlands|Bracers of Archery|Brooch of Shielding|Cloak of Protection|Eyes of the Eagle|Gauntlets of Ogre Power|Gloves of Missile Snaring|Gloves of Swimming and Climbing|Hat of Disguise|Headband of Intellect|Helm of Telepathy|Medallion of Thoughts|Necklace of Adaptation|Periapt of Wound Closure|Pipes of the Sewers|Quiver of Ehlonna|Ring of Jumping|Ring of Mind Shielding|Slippers of Spider Climbing|Winged Boots',14:'Amulet of Health|Belt of Hill Giant Strength|Boots of Levitation|Boots of Speed|Bracers of Defense|Cloak of the Bat|Dimensional Shackles|Gem of Seeing|Horn of Blasting|Ring of Free Action|Ring of Protection|Ring of the Ram'}
for n,names in replicas.items():
    for name in names.split('|'):
        attune=(n==6 and name in ['Cloak of Elvenkind','Eyes of Charming']) or (n>=10 and name not in ['Quiver of Ehlonna','Dimensional Shackles','Horn of Blasting'])
        category='Replica materials: '+name
        fid=infusion('Replicate Magic Item: '+name,n,[category],attune,{'Replicated item':name})
        F[fid]['source']=URL+'#ReplicateMagicItem'
        F[fid]['repeat']={'maximum':12,'scope':'character'}
        iid='replica-materials.'+slug(name)
        D['items']=[i for i in D['items'] if i['id']!=iid]+[{'id':iid,'revision':1,'name':'Materials for '+name,'category':category,'features':[],'source':URL+'#ReplicateMagicItem'}]
common=infusion('Replicate Magic Item: Common Item',2,['Common item materials'])
F[common]['parameters']={'itemName':{'kind':'string','default':'DM-approved common item (not a potion or scroll)'},'requiresAttunement':{'kind':'boolean','default':False}}
F[common]['equipmentEffect']['attunementParameter']='requiresAttunement'
F[common]['repeat']={'maximum':12,'scope':'character'}
F[common]['source']=URL+'#ReplicateMagicItem'
summary(common,'Enter the name of a common magic item other than a potion or scroll. Its item-specific effects require an approved catalogue entry or table resolution.')
D['items']=[i for i in D['items'] if i['id']!='replica-materials.common']+[{'id':'replica-materials.common','revision':1,'name':'Materials for a common magic item (not a potion or scroll)','category':'Common item materials','features':[]}]
F[infuse]['components'].append(choose('known-infusions',infusionids,st('infusionsKnown'),allowDuplicates=True))

# Numerical item effects use the already approved SRD 5.1 item rules.
srd_items='https://media.wizards.com/2023/downloads/dnd/SRD_CC_v5.1.pdf'
replica_mods={
 'Amulet of Health':[mod('constitution','constitution',19,'floor')],
 'Gauntlets of Ogre Power':[mod('strength','strength',19,'floor')],
 'Headband of Intellect':[mod('intelligence','intelligence',19,'floor')],
 'Belt of Hill Giant Strength':[mod('strength','strength',21,'floor')],
 'Bracers of Defense':[mod('unarmored-ac','armorClass',2,condition=op('and',op('eq',st('armorIndex'),0),op('eq',st('shield'),0)))],
 'Goggles of Night':[mod('darkvision','darkvision',60)],
 'Boots of Striding and Springing':[mod('walking-speed','walkingSpeed',30,'floor'),mod('heavy-armor-speed','armorStrengthExemption',1,'floor')],
}
for name in ['Cloak of Protection','Ring of Protection']:
    replica_mods[name]=[mod('ac','armorClass',1)]+[mod('save-'+a,'save.'+a,1) for a in ['strength','dexterity','constitution','intelligence','wisdom','charisma']]
for name,mods in replica_mods.items():
    key='infusion.'+slug('Replicate Magic Item: '+name)
    next(f for f in D['itemFeatures'] if f['id']==key)['modifiers']=mods
    F[P+'artificer.'+key]['source']+=', '+srd_items
    summary(P+'artificer.'+key,*[m['stat']+(': at least ' if m['operation']=='floor' else ': +')+str(m['value'])+(' (while unarmored and without a shield)' if m.get('condition') else '') for m in mods])

# Explicit preparation for the spell-storing object, distinct from prepared spells.
stored=[]
for names in spellnames[1:3]:
    for name in names.split('|'):
        wrapper=F[wrappers[name]]
        block=next(c for c in wrapper['components'] if c['kind']=='useBlock')
        if block['arguments']['castingTime']!='1 action':continue
        stored.append(feature('stored-spell.'+slug(name),'Stored spell: '+name,[],11,anchor='SpellStoringItem',textReferences=[P+'spell.'+slug(name)]))
F[store]['components'].append(choose('stored-spell',stored,0,1))
# Creation and special-case rules are summarized as original implementation notes.
summary(P+'artificer.right-tool','After one hour with thieves’ tools or artisan’s tools, create one artisan tool set. It lasts until this feature creates another set.')
summary(P+'artificer.magic-item-adept','Attunement limit: 4. Common/uncommon magic item crafting uses one quarter of the normal time and half the normal gold cost.')
summary(P+'artificer.magic-item-savant','Attunement limit: 5. Ignore class, race, spell, and level requirements to use or attune to magic items.')
summary(P+'artificer.magic-item-master','Attunement limit: 6.')
summary(P+'artificer.soul-of-artifice','Saving throws gain +1 per attuned item. When reduced to 0 HP without being killed, a reaction can end one infusion to remain at 1 HP; end the selected infusion and adjust HP separately.')
summary(P+'artificer.armorer.arcane-armor','Choose worn armor as Arcane Armor. It has no Strength requirement, can serve as a spellcasting focus, replaces missing limbs, cannot be removed against your will, and takes an action to don or doff.')
summary(P+'artificer.armorer.armor-modifications','Treat Arcane Armor chest, boots, helmet, and special weapon as separate infusion targets. Two additional active infusions must use those components. Add its component entries to inventory for assignment.')
summary(P+'artificer.battle-smith.battle-ready','Martial weapon proficiency. When attacking with a magic weapon, Intelligence can replace Strength or Dexterity for attack and damage rolls.')
summary(P+'artificer.battle-smith.improved-defender','Arcane Jolt becomes 4d6. Defender AC increases by 2. Deflect Attack also deals 1d4 + your Intelligence modifier force damage to the attacker.')
roll(P+'artificer.battle-smith.improved-defender','Deflect Attack damage','1d4',{'stat':'modifier.intelligence'})
summary(P+'artificer.artillerist.explosive-cannon','Cannon damage increases by 1d8. Action: destroy a cannon within 60 feet; creatures within 20 feet make a Dexterity save against 3d8 force damage (half on success). Dismiss that cannon after rolling.')
summary(casting,'Intelligence spellcasting. Prepared spells: max(1, Intelligence modifier + half Artificer level rounded down). Rituals must be prepared. Use thieves’ tools, artisan’s tools, or an infused item as the required focus. Multiclass slot contribution rounds Artificer levels up.')
summary(infuse,'Infuse nonmagical items after a long rest. Each known infusion affects one item; each item accepts one infusion. Replacing a known infusion ends its item effect. When the active limit is exceeded, end an old assignment before creating the new one. Infusions persist after death for Intelligence modifier days (minimum 1).')
# Required attunement gates activation, including use by an external recipient.
for fid in infusionids:
    if F[fid]['equipmentEffect']['attunement']:
        for component in F[fid]['components']:
            if component['kind']=='grantCapability':component['condition']=op('and',component.get('condition',True),{'context':'equipmentUserAttuned'})

# Dawn rolls are evaluated once by the engine recovery command, independently per pool.
for key,die in [('infusion-magical-strength','1d6'),('infusion-mind-sharpener','1d4'),('infusion-radiant-weapon','1d4'),('infusion-repulsion-shield','1d4')]:
    F[P+'artificer.resource.'+key]['components'][0]['recovery']=[{'event':'dawn','amount':0,'dice':die}]
for fid in [sharp,radiant,shield]:F[fid]['mechanicalSummary']=[line.replace('Adjust the pool by the dawn roll. ','') for line in F[fid]['mechanicalSummary']]

# Armorer bonus capacity applies only to its four distinct Arcane Armor components.
stats.append({'id':'infusionsArmorBonus','name':'Additional armor infusions','kind':'derived','expression':0})
F[P+'artificer.armorer.armor-modifications']['components']=[mod('additional-infusions','infusionsArmorBonus',2,'floor')]
D['itemFeatures']=[f for f in D['itemFeatures'] if f['id']!='arcane-armor.component']+[{'id':'arcane-armor.component','name':'Arcane Armor component','properties':{'arcaneArmorComponent':True}}]
for part,category in [('chest','Armor'),('boots','Boots'),('helmet','Helmet'),('weapon','Weapons')]:
    iid='arcane-armor.'+part
    D['items']=[i for i in D['items'] if i['id']!=iid]+[{'id':iid,'revision':1,'name':'Arcane Armor: '+part.title(),'category':category,'slot':'arcane-armor.'+part,'features':['arcane-armor.component']}]
for fid in infusionids:F[fid]['equipmentEffect']['bonusCapacity']={'stat':'infusionsArmorBonus','itemProperty':'arcaneArmorComponent'}
F[cannon]['companion']['modes']=['Force Ballista','Flamethrower','Protector']
for component in F[cannon]['components']:
    if component.get('kind')=='grantCapability' and component['name'] in ['Force Ballista','Improved Force Ballista','Flamethrower','Improved Flamethrower','Protector']:
        component['condition']=op('and',component.get('condition',True),{'context':'companionMode.'+component['name'].replace('Improved ','')})
# A second cannon has its own HP and rolls but shares the creation allowance.
second=feature('artillerist.second-cannon','Second Eldritch Cannon',copy.deepcopy(F[cannon]['components']),15,anchor='FortifiedPosition',companion=copy.deepcopy(F[cannon]['companion']),mechanicalSummary=F[cannon]['mechanicalSummary'])
secondhp=copy.deepcopy(F[P+'artificer.resource.companion-cannon-hp'])
secondhp['id']=P+'artificer.resource.companion-second-cannon-hp'
secondhp['name']=secondhp['displayName']='Second Eldritch Cannon HP'
secondhp['components'][0]['key']='companion-second-cannon-hp'
secondhp['components'][0]['name']='Second Eldritch Cannon HP'
F[secondhp['id']]=secondhp
for component in F[second]['components']:
    if component.get('feature')==P+'artificer.resource.companion-cannon-hp':component['feature']=secondhp['id']
F[second]['companion']['resources']=['companion-second-cannon-hp']
F[second]['companion']['resetOnCreation']=['companion-second-cannon-hp']
F[P+'artificer.artillerist.fortified-position']['components'].append(grant(second))
for f in F.values():
    if f['id'].startswith(P+'artificer.') and f.get('roll'):f['repeat']={'maximum':1,'scope':'parent'}

# Compatibility properties on mundane equipment, separate from character grants.
for name,category in [('Boots','Boots'),('Helmet','Helmet'),('Wand','Focus'),('Rod','Focus'),('Robes','Robes'),('Ring','Ring'),('Gem (100 gp)','Gem')]:
    iid='artificer-material.'+slug(name)
    D['items']=[i for i in D['items'] if i['id']!=iid]+[{'id':iid,'revision':1,'name':name,'category':category,'features':[]}]
for prop,names in [('shield',['Shield']),('ammunition',['Shortbow','Longbow','Crossbow, light','Light crossbow']),('thrown',['Dagger','Handaxe','Javelin','Light hammer','Spear','Trident'])]:
    iid='property.'+prop
    D['itemFeatures']=[f for f in D['itemFeatures'] if f['id']!=iid]+[{'id':iid,'name':prop.title(),'properties':{prop:True}}]
    for item in D['items']:
        if item['name'] in names and iid not in item['features']:item['features'].append(iid)

for config in D['configurations']:
    cls={'id':P+'artificer','revision':1,'name':'Artificer','maximumLevel':20,'source':URL,'levels':copy.deepcopy(levels),'multiclassPrerequisites':{'stat':'intelligence','minimum':13}}
    for n in [4,8,12,16,19]:cls['levels'][str(n)].append(copy.deepcopy(config['classes'][0]['levels']['4'][-1]))
    config['classes']=[c for c in config['classes'] if c['id']!=cls['id']]+[cls]
    system=config['system'];system['equipmentRules']={'attunementLimitStat':'attunementLimit','preventDuplicateAttunement':True};system['classes']=[c['id'] for c in config['classes']]
    system['tagDisplayNames'].update({'tool-proficiency':'Tool Proficiencies','infusion':'Infusions','artificer-subclass':'Artificer Specialists','artificer-cantrip':'Artificer Cantrips','artificer-spell':'Artificer Spells'})
    system['stats']=[s for s in system['stats'] if s['id'] not in {x['id'] for x in stats}|{'attunementLimit'}]+copy.deepcopy(stats)+[{'id':'attunementLimit','name':'Attunement limit','kind':'derived','expression':iff(at(18),6,iff(at(14),5,iff(at(10),4,3)))}]
    hd=next(s for s in system['stats'] if s['id']=='resource.capacity.hit-dice.d8')
    hd['expression']=op('add',*[lv(c) for c in ['bard','cleric','druid','monk','rogue','warlock','artificer']])
    caster=next(s for s in system['stats'] if s['id']=='srdCasterLevel')
    casters=['bard','cleric','druid','sorcerer','wizard','paladin','ranger','artificer']
    expr=op('add',*[lv(c) for c in casters[:5]],*[op('floor',op('divide',lv(c),2)) for c in ['paladin','ranger']],op('ceil',op('divide',lv(),2)))
    for c in ['paladin','ranger']:
        expr=iff(op('and',op('eq',op('add',*[iff(op('gte',lv(x),2 if x in ['paladin','ranger'] else 1),1,0) for x in casters]),1),op('gte',lv(c),2)),op('ceil',op('divide',lv(c),2)),expr)
    caster['expression']=expr
    system['recoveryEvents']=list(dict.fromkeys(system['recoveryEvents']+['dawn']))
D['features']=list(F.values())
PATH.write_text(json.dumps(D,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
path=Path('src/systems/dnd5e-2014/metadata.json');meta=json.loads(path.read_text(encoding='utf-8'))
meta['classInfo']['artificer']={'hitDie':8,'asi':[4,8,12,16,19],'subclassAt':3,'subclass':'specialist','startingSkills':2,'multiclassSkills':0,'skills':['arcana','history','investigation','medicine','nature','perception','sleight-of-hand']}
meta['coverage']['additionalSourcesPending']=['Other non-SRD subclasses: final published sources pending approval/access']
meta['coverage']['classCatalogue']='All 12 SRD classes plus Tasha’s Artificer and four specialists. See the System document for automated and table-managed effects.'
meta['coverage']['artificer']='Tasha’s Cauldron of Everything (2020): mechanical data and source links; no paid source descriptions.'
path.write_text(json.dumps(meta,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
print('Artificer, four specialists,',len(infusionids),'infusion choices authored (including the common-item option).')
