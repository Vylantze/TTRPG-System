"""Build accessible, source-linked 2014 subclass progressions without paid prose.

Run after the SRD and Artificer authorship scripts. The reviewed manifest contains
names, acquisition levels and source links only. Locked entries are not imported.
"""
import copy
import json
import re
from pathlib import Path

PATH = Path('src/systems/dnd5e-2014/system.json')
D = json.loads(PATH.read_text(encoding='utf-8'))
SOURCE = json.loads(Path('tools/data/dnd2014-subclasses.json').read_text(encoding='utf-8'))
P = 'dnd5e:2014:'
PREFIX = P + 'subclass.'
F = {f['id']: f for f in D['features'] if not f['id'].startswith(PREFIX)}
slug = lambda s: re.sub('[^a-z0-9]+', '-', s.lower()).strip('-')
op = lambda name, *args: {'op': name, 'args': list(args)}
st = lambda name: {'stat': name}
lv = lambda name: {'context': 'level.' + P + name}
iff = lambda condition, yes, no: {'if': condition, 'then': yes, 'else': no}
PB = st('proficiencyBonus')
minimum_modifier = lambda ability: op('max', 1, st('modifier.' + ability))
SRD = {'barbarian': ('Path of the Berserker', 'subclass'), 'bard': ('College of Lore', 'subclass'),
       'cleric': ('Life Domain', 'life'), 'druid': ('Circle of the Land', 'subclass'),
       'fighter': ('Champion', 'champion'), 'monk': ('Way of the Open Hand', 'subclass'),
       'paladin': ('Oath of Devotion', 'subclass'), 'ranger': ('Hunter', 'subclass'),
       'rogue': ('Thief', 'thief'), 'sorcerer': ('Draconic Bloodline', 'subclass'),
       'warlock': ('The Fiend', 'subclass'), 'wizard': ('School of Evocation', 'evocation')}
SPECIAL = {'fighter': ['remarkable-athlete', 'superior-critical', 'survivor'],
           'rogue': ['supreme-sneak', 'use-magic-device', 'thiefs-reflexes'],
           'wizard': ['potent-cantrip', 'empowered-evocation', 'overchannel'],
           'cleric': ['channel-divinity-preserve-life', 'blessed-healer', 'divine-strike', 'supreme-healing']}
INDEX = {}
ROOTS = {}

def grant(fid, key=None, level=None):
    result = {'id': key or fid, 'kind': 'grantFeature', 'feature': fid}
    if level is not None: result['atClassLevel'] = level
    return result

def choose(key, ids, amount=1):
    return {'id': key, 'kind': 'chooseFeatures', 'minimum': amount, 'maximum': amount,
            'candidates': {'ids': ids}, 'retraining': {'allowed': True}, 'eligibility': 'acquisition'}

def make(fid, name, source, level, components=None, tags=None):
    F[fid] = {'id': fid, 'revision': 1, 'name': name, 'displayName': name,
              'source': source, 'contentLevel': level, 'components': components or [],
              'tags': ['class-feature'] + (tags or []),
              'mechanicalSummary': ['Acquisition is automated. Resolve the effect using the linked source; this entry does not automate its effects.']}
    return F[fid]

def child(owner, key, name, component, tag='subclass-mechanic'):
    fid = owner['id'] + '.' + key
    feature = make(fid, name, owner['source'], owner['contentLevel'], [component], [tag])
    feature.pop('mechanicalSummary')
    if name == owner['name']: feature['textReferences'] = [owner['id']]
    owner['components'].append(grant(fid, key))
    return feature

def modify(owner, target, value, operation='add', **kw):
    child(owner, 'stat-' + target, owner['name'], {'id': 'value', 'kind': 'modifyStat',
          'stat': target, 'operation': operation, 'value': value, **kw})

def pool(owner, capacity, short=False, key=None, initial=None):
    key = key or owner['id']
    child(owner, 'resource', owner['name'] + ' uses', {'id': 'tracker', 'kind': 'trackResource',
          'key': key, 'name': owner['name'], 'units': 'uses', 'integer': True,
          'maximum': capacity, 'initialAmount': capacity if initial is None else initial,
          'recovery': [{'event': e, 'amount': 'full'} for e in (['short-rest', 'long-rest'] if short else ['long-rest'])]}, 'resource-tracker')
    owner['components'].append({'id': 'use', 'kind': 'grantCapability', 'name': owner['name'], 'costs': [{'key': key, 'amount': 1}]})
    owner['mechanicalSummary'] = ['The use pool and rest recovery are automated. Activate this ability to spend one use; resolve targeting, timing and its effect using the linked source.']
    return key

def find(cls, sub, name):
    return F[INDEX[(cls, sub, name)]]

def roll(owner, dice, bonus=0, capability=None, restore=None):
    fid=owner['id']+'.roll'
    f=make(fid,owner['name'],owner['source'],owner['contentLevel'],tags=['roll-feature'])
    f.pop('mechanicalSummary')
    f['textReferences']=[owner['id']]
    f['roll']={'id':'roll','label':owner['name'],'dice':dice,'bonus':bonus,'capability':capability or owner['name']}
    if restore:f['roll']['restoreResource']=restore
    owner['components'].append(grant(fid,'roll'))
    return f

def stat(owner, key, name, expression):
    child(owner,'definition-'+key,name,{'id':'value','kind':'defineStat','stat':{'id':key,'name':name,'kind':'derived','expression':expression}})

# Convert old unconditional SRD subclass grants into descendants of their chosen
# subclass. Existing Feature IDs are retained so a reload can migrate ownership.
champion=next(s for c in SOURCE['classes'] if c['className']=='Fighter' for s in c['subclasses'] if s['name']=='Champion')
style_source=next(f['url'] for f in champion['features'] if f['name']=='Additional Fighting Style')
make(PREFIX+'fighter.champion.additional-fighting-style','Additional Fighting Style','Player’s Handbook (2014), '+style_source,10,
     [choose('additional-style',[P+'style.'+s for s in ['archery','defense','dueling','great-weapon-fighting','protection','two-weapon-fighting']])])
for config in D['configurations']:
    for cls in config['classes']:
        key = cls['id'].removeprefix(P)
        if key not in SRD: continue
        root = F[P + key + '.' + SRD[key][1]]
        for level, entries in cls['levels'].items():
            retained = []
            for entry in entries:
                fid = entry.get('feature', '')
                move = fid.startswith(P + key + '.subclass.') or fid in [P + key + '.' + s for s in SPECIAL.get(key, [])]
                if key == 'fighter' and entry['id'] == 'additional-style':
                    fid = PREFIX + 'fighter.champion.additional-fighting-style'
                    if fid not in F: make(fid, 'Additional Fighting Style', root.get('source', ''), 10, [copy.deepcopy(entry)])
                    move = True
                if move:
                    nested = grant(fid, 'progression-' + entry['id'], int(level))
                    if not any(c['id'] == nested['id'] for c in root['components']): root['components'].append(nested)
                else: retained.append(entry)
            cls['levels'][level] = retained

for source_class in SOURCE['classes']:
    key = slug(source_class['className'])
    if key == 'artificer': continue  # The complete Tasha implementation already exists.
    ROOTS[key] = []
    for subclass in source_class['subclasses']:
        sub = subclass['name']
        if key in SRD and sub == SRD[key][0]:
            root = F[P + key + '.' + SRD[key][1]]
            root['tags'] = list(dict.fromkeys(root.get('tags', []) + ['subclass', key + '-subclass']))
            ROOTS[key].append(root['id'])
            continue
        sid = PREFIX + key + '.' + slug(sub)
        origin = ['partner-content'] if subclass['partner'] else ['official-content']
        entry = min(f['level'] for f in subclass['features'])
        root = make(sid, sub, subclass['publication'] + ', ' + subclass['url'], entry, tags=['subclass', key + '-subclass'] + origin)
        root['mechanicalSummary'] = ['Select this subclass to receive its level-gated Features. Each Feature states its automation coverage; source rules remain authoritative.']
        ROOTS[key].append(sid)
        for item in subclass['features']:
            fid = sid + '.' + slug(item['name']) + '.' + str(item['level'])
            # Repeated names at different levels are distinct progression steps.
            feature = make(fid, item['name'], subclass['publication'] + ', ' + item['url'], item['level'], tags=['subclass-feature'] + origin)
            INDEX[(key, sub, item['name'])] = fid
            root['components'].append(grant(fid, slug(item['name']) + '-' + str(item['level']), item['level']))

# Direct, unconditional numeric effects verified against the linked entries.
for cls, sub, name in [('bard','College of Swords','Extra Attack'),('bard','College of Valor','Extra Attack'),('wizard','Bladesinging','Extra Attack')]:
    f = find(cls, sub, name); modify(f, 'attacksPerAction', 2, 'floor')
    f['mechanicalSummary'] = ['Two attacks per Attack action. Any additional casting/action exceptions are resolved using the source.']
for cls, sub, name, ability in [('rogue','Swashbuckler','Rakish Audacity','charisma'),('wizard','War Magic','Tactical Wit','intelligence'),('wizard','Chronurgy Magic','Temporal Awareness','intelligence')]:
    f = find(cls, sub, name); modify(f, 'initiative', st('modifier.' + ability))
    f['mechanicalSummary'] = ['The ' + ability + ' modifier is added to initiative. Other benefits are resolved using the source.']
f = find('fighter', 'Gunslinger', 'Quickdraw'); modify(f, 'initiative', PB)
f['mechanicalSummary'] = ['Proficiency bonus is added to initiative. Weapon handling is resolved at the table.']
f = find('rogue', 'Scout', 'Superior Mobility'); modify(f, 'speed', 10)
f['mechanicalSummary'] = ['Walking speed gains 10 feet. Apply the same increase to existing climbing and swimming speeds at the table.']
f = find('rogue', 'Scout', 'Survivalist')
for skill in ['nature', 'survival']: modify(f, 'training.skill.' + skill, 2, 'floor')
f['mechanicalSummary'] = ['Nature and Survival gain proficiency with doubled proficiency bonus.']

for cls,sub,name,targets in [
    ('bard','College of Swords','Bonus Proficiencies',['armor.medium']),
    ('bard','College of Valor','Bonus Proficiencies',['armor.medium','armor.shield','weapons.martial']),
    ('cleric','Arcana Domain','Arcane Initiate',['skill.arcana']),
    ('cleric','Death Domain','Bonus Proficiency',['weapons.martial']),
    ('cleric','Forge Domain','Bonus Proficiencies',['armor.heavy','tool.smiths-tools']),
    ('cleric','Nature Domain','Bonus Proficiency',['armor.heavy']),
    ('cleric','Order Domain','Bonus Proficiencies',['armor.heavy']),
    ('cleric','Tempest Domain','Bonus Proficiencies',['armor.heavy','weapons.martial']),
    ('cleric','Twilight Domain','Bonus Proficiencies',['armor.heavy','weapons.martial']),
    ('cleric','War Domain','Bonus Proficiencies',['armor.heavy','weapons.martial']),
    ('monk','Way of Mercy','Implements of Mercy',['skill.insight','skill.medicine']),
    ('monk','Way of the Drunken Master','Bonus Proficiencies',['skill.performance','tool.brewers-supplies']),
    ('warlock','The Hexblade','Hex Warrior',['armor.medium','armor.shield','weapons.martial']),
    ('wizard','Bladesinging','Training in War and Song',['armor.light','skill.performance']),
]:
    f=find(cls,sub,name)
    for target in targets:modify(f,'training.'+target,1,'floor')
    f['mechanicalSummary']=['Automated proficiencies: '+', '.join(t.replace('.',' ').replace('-',' ') for t in targets)+'. Other benefits and specific weapon/tool exceptions are resolved using the source.']
for cls,sub,name,skills in [
    ('cleric','Nature Domain','Acolyte of Nature',['animal-handling','nature','survival']),
    ('cleric','Order Domain','Bonus Proficiencies',['intimidation','persuasion']),
    ('cleric','Peace Domain','Implement of Peace',['insight','performance','persuasion']),
]:
    f=find(cls,sub,name);f['components'].append(choose('skill',[P+'skill.'+s for s in skills]))
    f['mechanicalSummary'].append('Choose one of the listed skill proficiencies.')

# Separate reusable resource children: no pool exists unless its owner is gained.
for cls, sub, name, capacity, short in [
    ('barbarian','Path of the Ancestral Guardian','Consult the Spirits',1,True),
    ('barbarian','Path of the Beast','Infectious Fury',PB,False),
    ('barbarian','Path of the Beast','Call the Hunt',PB,False),
    ('barbarian','Path of the Zealot','Zealous Presence',1,False),
    ('barbarian','Path of Wild Magic','Magic Awareness',PB,False),
    ('barbarian','Path of Wild Magic','Bolstering Magic',PB,False),
    ('bard','College of Eloquence','Infectious Inspiration',minimum_modifier('charisma'),False),
    ('bard','College of Glamour','Enthralling Performance',1,True),
    ('bard','College of Glamour','Mantle of Majesty',1,False),
    ('bard','College of Glamour','Unbreakable Majesty',1,True),
    ('bard','College of Whispers','Words of Terror',1,True),
    ('bard','College of Whispers','Mantle of Whispers',1,True),
    ('bard','College of Whispers','Shadow Lore',1,False),
    ('fighter','Arcane Archer','Arcane Shot',2,True),
    ('fighter','Cavalier','Unwavering Mark',minimum_modifier('strength'),False),
    ('fighter','Cavalier','Warding Maneuver',minimum_modifier('constitution'),False),
    ('fighter','Rune Knight','Giant’s Might',PB,False),
    ('fighter','Rune Knight','Runic Shield',PB,False),
    ('fighter','Samurai','Fighting Spirit',3,False),
    ('fighter','Samurai','Strength before Death',1,False),
    ('fighter','Echo Knight','Unleash Incarnation',minimum_modifier('constitution'),False),
    ('fighter','Echo Knight','Shadow Martyr',1,True),
    ('fighter','Echo Knight','Reclaim Potential',minimum_modifier('constitution'),False),
    ('rogue','Arcane Trickster','Spell Thief',1,False),
    ('rogue','Inquisitive','Unerring Eye',minimum_modifier('wisdom'),False),
    ('rogue','Phantom','Wails from the Grave',PB,False),
    ('rogue','Swashbuckler','Master Duelist',1,True),
    ('wizard','Bladesinging','Bladesong',PB,False),
    ('wizard','Order of Scribes','One with the Word',1,False),
    ('wizard','School of Illusion','Illusory Self',1,True),
    ('wizard','School of Transmutation','Shapechanger',1,True),
    ('wizard','Chronurgy Magic','Chronal Shift',2,False),
    ('wizard','Chronurgy Magic','Momentary Stasis',minimum_modifier('intelligence'),False),
    ('wizard','Chronurgy Magic','Arcane Abeyance',1,True),
    ('wizard','Graviturgy Magic','Violent Attraction',minimum_modifier('intelligence'),False),
    ('cleric','Forge Domain','Blessing of the Forge',1,False),
    ('cleric','Grave Domain','Eyes of the Grave',minimum_modifier('wisdom'),False),
    ('cleric','Grave Domain','Sentinel at Death’s Door',minimum_modifier('wisdom'),False),
    ('cleric','Knowledge Domain','Visions of the Past',1,True),
    ('cleric','Light Domain','Warding Flare',minimum_modifier('wisdom'),False),
    ('cleric','Order Domain','Embodiment of the Law',minimum_modifier('wisdom'),False),
    ('cleric','Peace Domain','Emboldening Bond',PB,False),
    ('cleric','Tempest Domain','Wrath of the Storm',minimum_modifier('wisdom'),False),
    ('cleric','Twilight Domain','Steps of Night',PB,False),
    ('cleric','War Domain','War Priest',minimum_modifier('wisdom'),False),
    ('druid','Circle of Dreams','Hidden Paths',minimum_modifier('wisdom'),False),
    ('druid','Circle of Dreams','Walker in Dreams',1,False),
    ('druid','Circle of Spores','Fungal Infestation',minimum_modifier('wisdom'),False),
    ('druid','Circle of Stars','Cosmic Omen',PB,False),
    ('druid','Circle of the Shepherd','Spirit Totem',1,True),
    ('druid','Circle of the Shepherd','Faithful Summons',1,False),
    ('druid','Circle of Wildfire','Cauterizing Flames',PB,False),
    ('druid','Circle of Wildfire','Blazing Revival',1,False),
    ('paladin','Oath of Conquest','Invincible Conqueror',1,False),
    ('paladin','Oath of Glory','Glorious Defense',minimum_modifier('charisma'),False),
    ('paladin','Oath of the Ancients','Undying Sentinel',1,False),
    ('paladin','Oath of the Ancients','Elder Champion',1,False),
    ('paladin','Oath of the Crown','Exalted Champion',1,False),
    ('paladin','Oath of Vengeance','Avenging Angel',1,False),
    ('paladin','Oath of the Open Sea','Mythic Swashbuckler',1,False),
    ('ranger','Drakewarden','Perfected Bond',PB,False),
    ('ranger','Fey Wanderer','Misty Wanderer',minimum_modifier('wisdom'),False),
    ('ranger','Horizon Walker','Detect Portal',1,True),
    ('ranger','Horizon Walker','Ethereal Step',1,True),
    ('ranger','Monster Slayer','Hunter’s Sense',minimum_modifier('wisdom'),False),
    ('ranger','Monster Slayer','Magic-User’s Nemesis',1,True),
    ('ranger','Swarmkeeper','Writhing Tide',PB,False),
    ('ranger','Swarmkeeper','Swarming Dispersal',PB,False),
    ('sorcerer','Clockwork Soul','Restore Balance',PB,False),
    ('sorcerer','Divine Soul','Favored by the Gods',1,True),
    ('sorcerer','Divine Soul','Unearthly Recovery',1,False),
    ('warlock','The Archfey','Fey Presence',1,True),
    ('warlock','The Archfey','Misty Escape',1,True),
    ('warlock','The Archfey','Dark Delirium',1,True),
    ('warlock','The Fathomless','Tentacle of the Deeps',PB,False),
    ('warlock','The Fathomless','Fathomless Plunge',1,True),
    ('warlock','The Genie','Elemental Gift',PB,False),
    ('warlock','The Great Old One','Entropic Ward',1,True),
    ('warlock','The Hexblade','Hexblade’s Curse',1,True),
    ('warlock','The Hexblade','Accursed Specter',1,False),
    ('warlock','The Undead','Form of Dread',PB,False),
    ('warlock','The Undead','Spirit Projection',1,False),
    ('warlock','The Undying','Defy Death',1,False),
    ('warlock','The Undying','Indestructible Life',1,True),
]: pool(find(cls, sub, name), capacity, short)

f=find('fighter','Battle Master','Combat Superiority')
pool(f,iff(op('gte',lv('fighter'),15),6,iff(op('gte',lv('fighter'),7),5,4)),True,'superiority-dice')
stat(f,'superiorityDie','Superiority die',iff(op('gte',lv('fighter'),18),12,iff(op('gte',lv('fighter'),10),10,8)))
f['mechanicalSummary']=['Superiority dice scale from four d8s to six d12s. Selected maneuvers share this pool and recover on a short or long rest. Resolve triggers and targets at the table; replace one maneuver only when learning new maneuvers.']
maneuvers=[]
for name in ['Ambush','Bait and Switch','Brace','Commander’s Strike','Commanding Presence','Disarming Attack','Distracting Strike','Evasive Footwork','Feinting Attack','Goading Attack','Grappling Strike','Lunging Attack','Maneuvering Attack','Menacing Attack','Parry','Precision Attack','Pushing Attack','Quick Toss','Rally','Riposte','Sweeping Attack','Tactical Assessment','Trip Attack']:
    fid=f['id']+'.maneuver.'+slug(name)
    m=make(fid,name,find('fighter','Battle Master','Maneuvers')['source'],3,[{'id':'use','kind':'grantCapability','name':name,'costs':[{'key':'superiority-dice','amount':1}]}],['maneuver'])
    roll(m,{'count':1,'sides':st('superiorityDie')},st('modifier.dexterity') if name=='Parry' else st('modifier.charisma') if name=='Rally' else 0)
    m['mechanicalSummary']=['Rolling spends one superiority die. Apply the rolled contribution to the maneuver at the table; any attack roll and conditional effects remain separate.']
    maneuvers.append(fid)
choice=choose('maneuvers',maneuvers,op('add',3,*[iff(op('gte',lv('fighter'),n),2,0) for n in [7,10,15]]))
choice['eligibility']='current';f['components'].append(choice)
for item in F.values():
    if item['id'].startswith(PREFIX+'fighter.battle-master.improved-combat-superiority.'):
        item['mechanicalSummary']=['The die-size upgrade is included in Combat Superiority’s calculated die stat.']
find('fighter','Battle Master','Maneuvers')['mechanicalSummary']=['Maneuver choices and shared superiority-die rolls are supplied by Combat Superiority. Resolve each selected maneuver’s triggers and effects using its source.']

for cls,sub,name,dice,bonus in [
    ('fighter','Cavalier','Warding Maneuver','1d8',0),
    ('sorcerer','Divine Soul','Favored by the Gods','2d4',0),
    ('druid','Circle of Stars','Cosmic Omen','1d6',0),
    ('warlock','The Undying','Indestructible Life','1d8',{'class':P+'warlock'}),
]:
    f=find(cls,sub,name);roll(f,dice,bonus,restore='hit-points' if name=='Indestructible Life' else None)
    f['mechanicalSummary'].append('Rolling spends the use and records the result; applying the result is a separate action.')

# Shared class pools: subclass abilities spend the existing pool, never a new
# independently refreshing copy of Channel Divinity, Ki or Wild Shape.
for (cls, sub, name), fid in list(INDEX.items()):
    f = F[fid]
    if cls in ['cleric', 'paladin'] and name.startswith('Channel Divinity'):
        key = cls + '-channel-divinity'
        f['components'] += [grant(P + 'resource.' + key, 'resource'), {'id': 'use', 'kind': 'grantCapability', 'name': sub + ': ' + name, 'costs': [{'key': key, 'amount': 1}]}]
        f['mechanicalSummary'] = ['Spends one use from the shared ' + cls.title() + ' Channel Divinity pool. Choose and resolve the option using the source.']

# Repeat activations paid with a spell slot or class resource are separate
# capabilities, so spending one route never consumes both routes.
for cls, sub, name, key, amount in [
    ('sorcerer','Aberrant Mind','Warping Implosion','sorcery-points',5),
    ('sorcerer','Clockwork Soul','Trance of Order','sorcery-points',5),
    ('sorcerer','Clockwork Soul','Clockwork Cavalcade','sorcery-points',7),
    ('monk','Way of the Ascendant Dragon','Aspect of the Wyrm','ki',3),
]:
    f=find(cls,sub,name);pool(f,1)
    f['components'].append({'id':'paid-use','kind':'grantCapability','name':name+' ('+str(amount)+' '+key+')','costs':[{'key':key,'amount':amount}]})
    f['mechanicalSummary'].append('The alternate activation spends ' + str(amount) + ' ' + key + ' instead of the free use.')

for cls, sub, name, minimum in [
    ('bard','College of Creation','Performance of Creation',2),
    ('bard','College of Creation','Animating Performance',3),
    ('bard','College of Eloquence','Universal Speech',1),
    ('cleric','Twilight Domain','Eyes of Night',1),
    ('paladin','Oath of Glory','Living Legend',5),
    ('paladin','Oath of the Watchers','Mortal Bulwark',5),
    ('ranger','Drakewarden','Drake Companion',1),
    ('ranger','Drakewarden','Drake’s Breath',3),
    ('wizard','Graviturgy Magic','Event Horizon',3),
]:
    f=find(cls,sub,name);pool(f,1)
    for level in range(minimum,10):
        f['components'].append({'id':'slot-'+str(level),'kind':'grantCapability','name':name+' (slot '+str(level)+')','costs':[{'key':'spell-slot.'+str(level),'amount':1}],'condition':op('gte',st('spellSlots.'+str(level)),1)})
    f['mechanicalSummary'].append('An alternate activation spends a spell slot of level ' + str(minimum) + ' or higher instead of the free use.')

BH = 'blood-hunter'
BHURL = 'https://www.dndbeyond.com/classes/357975-blood-hunter'
bhlevels = {str(n): [] for n in range(1, 21)}
def bhfeature(key, name, level, anchor, components=None, summary=None):
    f=make(PREFIX+BH+'.base.'+key,name,'Critical Role (partner content), '+BHURL+'#'+anchor,level,components,['partner-content'])
    if summary: f['mechanicalSummary']=summary
    bhlevels[str(level)].append(grant(f['id'],key))
    return f

hp=copy.deepcopy(F[P+'fighter.hit-points'])
hp.update(id=PREFIX+BH+'.base.hit-points',name='Blood Hunter Hit Points',displayName='Blood Hunter Hit Points',source=BHURL+'#HitPoints-1610518')
hp['tags']=list(dict.fromkeys(hp.get('tags',[])+['partner-content']))
for field in ['description','descriptionOverride','textReferences']:hp.pop(field,None)
hp['components']=[c for c in hp['components'] if c['kind']=='modifyStat']
hp['mechanicalSummary']=['Hit die: d10. First character level: 10 + Constitution modifier. Later Blood Hunter levels: 6 + Constitution modifier, with a minimum of 1 HP per level.']
F[hp['id']]=hp
for entries in bhlevels.values():entries.append(grant(hp['id'],'hit-points'))
bhlevels['1'].append(grant(P+'hit-dice.d10','rest-healing'))
entry=bhfeature('entry','Blood Hunter Starting Traits',1,'Proficiencies-1610574',summary=['Light and medium armor, shields, simple and martial weapons, alchemist’s supplies. Starting class: Dexterity and Intelligence saves; choose three listed skills.'])
for ability in ['dexterity','intelligence']:modify(entry,'training.save.'+ability,1,'floor',condition={'context':'isStartingClass'})
for target in ['armor.light','armor.medium','armor.shield','weapons.simple','weapons.martial','tool.alchemists-supplies']:modify(entry,'training.'+target,1,'floor')
bhskills=['acrobatics','arcana','athletics','history','insight','investigation','religion','survival']
entry['components'].append(choose('skills',[P+'skill.'+s for s in bhskills],iff({'context':'isStartingClass'},3,0)))
modifier_ids=[]
for ability in ['intelligence','wisdom']:
    fid=PREFIX+BH+'.hemocraft-'+ability
    f=make(fid,ability.title()+' Hemocraft',BHURL+'#HuntersBane-1610579',1,[{'id':'modifier','kind':'modifyStat','stat':'hemocraftModifier','operation':'add','value':st('modifier.'+ability)}],['partner-content'])
    f['mechanicalSummary']=['Use '+ability+' for Hemocraft. The Wisdom variant requires the GM’s permission.']
    modifier_ids.append(fid)
bane=bhfeature('hunters-bane','Hunter’s Bane',1,'HuntersBane-1610579',[choose('hemocraft',modifier_ids)],['Choose the Hemocraft ability; its save DC is calculated. Tracking and knowledge advantages against fey, fiends and undead are resolved at the table.'])
child(bane,'modifier-stat','Hemocraft modifier',{'id':'value','kind':'defineStat','stat':{'id':'hemocraftModifier','name':'Hemocraft modifier','kind':'derived','expression':0}})
child(bane,'save-dc','Hemocraft save DC',{'id':'value','kind':'defineStat','stat':{'id':'hemocraftSaveDC','name':'Hemocraft save DC','kind':'derived','expression':op('add',8,PB,st('hemocraftModifier'))}})
maledict=bhfeature('blood-maledict','Blood Maledict',1,'BloodMaledict-1610580')
uses=iff(op('gte',lv(BH),17),4,iff(op('gte',lv(BH),13),3,iff(op('gte',lv(BH),6),2,1)))
child(maledict,'capacity','Blood Maledict capacity',{'id':'value','kind':'defineStat','stat':{'id':'bloodMaledictUses','name':'Blood Maledict uses','kind':'derived','expression':uses}})
pool(maledict,st('bloodMaledictUses'),True,'blood-maledict')
curse_ids=[]
for name in ['the Anxious','Binding','Bloated Agony','Exposure','the Eyeless','the Fallen Puppet','the Marked','the Muddled Mind']:
    fid=PREFIX+BH+'.curse.'+slug(name)
    f=make(fid,'Blood Curse of '+name,BHURL+'#BloodCurses-1611383',1,[{'id':'use','kind':'grantCapability','name':'Blood Curse of '+name,'costs':[{'key':'blood-maledict','amount':1}]}],['partner-content'])
    f['mechanicalSummary']=['Spends one shared Blood Maledict use. Resolve the curse and optional amplification damage using the source.']
    curse_ids.append(fid)
for level in [1,6,10,14,18]:bhlevels[str(level)].append(choose('blood-curse',curse_ids))
bhlevels['2'].append(choose('style',[P+'style.'+s for s in ['archery','dueling','great-weapon-fighting','two-weapon-fighting']]))
rite=bhfeature('crimson-rite','Crimson Rite',2,'CrimsonRite-1610627',summary=['Activating a rite costs one Hemocraft die of necrotic damage. Its weapon damage die scales d4/d6/d8/d10 at levels 2/5/11/17. Damage, weapons and duration are managed at the table.'])
riteids=[]
for name,damage,level in [('Flame','fire',2),('Frozen','cold',2),('Storm','lightning',2),('Dead','necrotic',14),('Oracle','psychic',14),('Roar','thunder',14)]:
    fid=PREFIX+BH+'.rite.'+slug(name)
    f=make(fid,'Rite of the '+name,BHURL+'#CrimsonRite-1610627',level,tags=['partner-content'])
    f['prerequisites']={'expression':op('gte',lv(BH),level)}
    f['mechanicalSummary']=['Crimson Rite damage type: '+damage+'. Apply its damage and activation cost using the source.']
    riteids.append(fid)
for level in [2,7,14]:bhlevels[str(level)].append(choose('rite',riteids))
bhlevels['3'].append(choose('subclass',ROOTS[BH]))
extra=bhfeature('extra-attack','Extra Attack',5,'ExtraAttack-1610898',summary=['Two attacks per Attack action.']);modify(extra,'attacksPerAction',2,'floor')
brand=bhfeature('brand-of-castigation','Brand of Castigation',6,'BrandofCastigation-1610903');pool(brand,1,True)
bhfeature('grim-psychometry','Grim Psychometry',9,'GrimPsychometry-1610910')
dark=bhfeature('dark-augmentation','Dark Augmentation',10,'DarkAugmentation-1610911',summary=['Speed gains 5 feet. Strength, Dexterity and Constitution saves gain the Hemocraft modifier, minimum +1.'])
modify(dark,'speed',5)
for ability in ['strength','dexterity','constitution']:modify(dark,'save.'+ability,op('max',1,st('hemocraftModifier')))
bhfeature('brand-of-tethering','Brand of Tethering',13,'BrandofTethering-1610915')
bhfeature('hardened-soul','Hardened Soul',14,'HardenedSoul-1610921')
bhfeature('sanguine-mastery','Sanguine Mastery',20,'SanguineMastery-1610923')
f=find(BH,'Order of the Ghostslayer','Curse Specialist');modify(f,'bloodMaledictUses',1)
f['mechanicalSummary']=['Blood Maledict gains one additional use. Targeting exceptions are resolved using the source.']
pool(find(BH,'Order of the Ghostslayer','Aether Walk'),iff(op('gte',lv(BH),15),2,1),True)
f=find(BH,'Order of the Lycan',"Stalker's Prowess");modify(f,'speed',10)
f['mechanicalSummary']=['Speed gains 10 feet. Jumping and hybrid-form attack benefits are resolved using the source.']
pool(find(BH,'Order of the Mutant','Strange Metabolism'),1)
pool(find(BH,'Order of the Mutant','Exalted Mutation'),op('max',1,st('hemocraftModifier')))

# The two PHB third-casters reuse the normal casting blocks and shared slot
# resources. Known spells are selected at their own acquisition levels.
META_PATH=Path('src/systems/dnd5e-2014/metadata.json')
META=json.loads(META_PATH.read_text(encoding='utf-8'))
for cls,sub,schools in [('fighter','Eldritch Knight',['abjuration','evocation']),('rogue','Arcane Trickster',['enchantment','illusion'])]:
    caster=find(cls,sub,'Spellcasting')
    modify(caster,'thirdCasterLevel.'+cls,lv(cls),'floor')
    caster['components'] += [grant(P+'resource.spell-slot.'+str(n),'slot-'+str(n)) for n in range(1,10)]
    wrappers={}
    for spell in META['wizardSpells']:
        if spell['level']>4:continue
        canonical=P+'spell.'+spell['slug']
        block=next((copy.deepcopy(c) for f in F.values() for c in f['components'] if c.get('kind')=='useBlock' and c.get('arguments',{}).get('spell')==canonical),None)
        if block is None:raise ValueError('Missing casting block: '+canonical)
        block['arguments']['castingAbility']='intelligence'
        block['arguments']['ritualAllowed']=False
        fid=caster['id']+'.spell.'+spell['slug']
        f=make(fid,spell['name'],caster['source'],spell['level'],[block],['spell','subclass-spell'])
        f['textReferences']=[canonical]
        f['mechanicalSummary']=['Known spell cast with Intelligence. Uses the shared spell-slot pool; this subclass does not grant ritual casting.']
        wrappers[spell['slug']]=fid
    root=F[PREFIX+cls+'.'+slug(sub)]
    for level in [3,4,7,8,10,11,13,14,16,19,20]:
        # Current-level eligibility permits the rule's later known-spell replacement.
        maxexpr=iff(op('gte',lv(cls),19),4,iff(op('gte',lv(cls),13),3,iff(op('gte',lv(cls),7),2,1)))
        categories=['school','any'] if level==3 else ['any' if level in [8,14,20] else 'school']
        components=[]
        for category in categories:
            ids=[wrappers[s['slug']] for s in META['wizardSpells'] if 0<s['level']<=4 and (category=='any' or s['school'].lower() in schools)]
            choice=choose(category,ids,2 if level==3 and category=='school' else 1)
            choice['eligibility']='current';choice['candidates']['maximumLevel']=maxexpr
            components.append(choice)
        if level in [3,10]:
            choice=choose('cantrips',[wrappers[s['slug']] for s in META['wizardSpells'] if s['level']==0 and not (cls=='rogue' and s['slug']=='mage-hand')],2 if level==3 else 1)
            components.append(choice)
        if level==3 and cls=='rogue':components.append(grant(wrappers['mage-hand'],'mage-hand'))
        fid=caster['id']+'.known-'+str(level)
        f=make(fid,sub+' Known Spells ('+str(level)+')',caster['source'],level,components)
        f['mechanicalSummary']=['Select known spells. School restrictions and maximum spell level are checked; only replace one known spell when gaining a class level.']
        root['components'].append(grant(fid,'known-'+str(level),level))
    caster['mechanicalSummary']=['Intelligence spellcasting, known-spell choices, school restrictions and shared slots are automated. Third-caster multiclass contribution rounds down; a single casting class uses its own progression. Spell replacement timing is managed at the table.']

for config in D['configurations']:
    cls={'id':P+BH,'revision':1,'name':'Blood Hunter','maximumLevel':20,'source':'Critical Role (partner content), '+BHURL,
         'levels':copy.deepcopy(bhlevels),'multiclassPrerequisites':{'all':[{'any':[{'stat':'strength','minimum':13},{'stat':'dexterity','minimum':13}]},{'stat':'intelligence','minimum':13}]}}
    for level in [4,8,12,16,19]:cls['levels'][str(level)].append(copy.deepcopy(next(e for e in config['classes'][0]['levels']['4'] if e['kind']=='chooseFeatures')))
    config['classes']=[c for c in config['classes'] if c['id']!=cls['id']]+[cls]
    config['system']['classes']=[c['id'] for c in config['classes']]
    hd=next(s for s in config['system']['stats'] if s['id']=='resource.capacity.hit-dice.d10')
    hd['expression']=op('add',*[lv(c) for c in ['fighter','paladin','ranger',BH]])
    system=config['system']
    for key in ['fighter','rogue']:
        statid='thirdCasterLevel.'+key
        system['stats']=[s for s in system['stats'] if s['id']!=statid]+[{'id':statid,'name':key.title()+' spellcasting levels','kind':'derived','expression':0}]
    # Count only classes that actually provide Spellcasting, then use the
    # appropriate rounding for one caster or combined multiclass slots.
    levels=[lv(c) for c in ['bard','cleric','druid','sorcerer','wizard']]+[iff(op('gte',lv(c),2),lv(c),0) for c in ['paladin','ranger']]+[lv('artificer'),st('thirdCasterLevel.fighter'),st('thirdCasterLevel.rogue')]
    count=op('add',*[iff(op('gt',value,0),1,0) for value in levels])
    casterlevel=op('add',*levels[:5],*[op('floor',op('divide',v,2)) for v in levels[5:7]],op('ceil',op('divide',levels[7],2)),*[op('floor',op('divide',v,3)) for v in levels[8:]])
    for value,divisor in [(v,2) for v in levels[5:7]]+[(v,3) for v in levels[8:]]:
        casterlevel=iff(op('and',op('eq',count,1),op('gt',value,0)),op('ceil',op('divide',value,divisor)),casterlevel)
    next(s for s in system['stats'] if s['id']=='srdCasterLevel')['expression']=casterlevel
    for cls in config['classes']:
        key = cls['id'].removeprefix(P)
        if key not in ROOTS: continue
        for entries in cls['levels'].values():
            for i, entry in enumerate(entries):
                if entry['id'] == 'subclass' or (key == 'cleric' and entry['id'] == 'domain'):
                    entries[i] = choose(entry['id'], ROOTS[key])
    tags = config['system']['tagDisplayNames']
    tags.update({'subclass': 'Subclasses', 'subclass-feature': 'Subclass Features', 'subclass-mechanic': 'Subclass Mechanics', 'partner-content': 'Partner Content', 'official-content': 'Wizards of the Coast'})
    tags.update({'subclass-spell':'Subclass Spells','maneuver':'Maneuvers'})
    tags.update({key + '-subclass': key.replace('-', ' ').title() + ' Subclasses' for key in ROOTS})

D['features'] = list(F.values())
PATH.write_text(json.dumps(D, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
META['classInfo'][BH]={'hitDie':10,'asi':[4,8,12,16,19],'subclassAt':3,'subclass':'subclass','startingSkills':3,'multiclassSkills':0,'skills':bhskills}
META['coverage']['classCatalogue']='Thirteen standard classes and partner Blood Hunter, with 124 accessible D&D Beyond subclass progressions. Locked entries are excluded.'
META['coverage']['additionalSourcesPending']=[]
META['coverage']['subclasses']='Source-linked acquisition, shared resources and selected numerical effects. Each Feature states its automation coverage. Unimplemented effects remain source references, not simulated rules.'
META_PATH.write_text(json.dumps(META,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
print('Authored', sum(map(len, ROOTS.values())), 'subclass progressions plus existing Artificer specialists.')
