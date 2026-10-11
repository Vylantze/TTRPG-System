"""Idempotent mechanical corrections; run after the class and roll generators.

Uses the approved SRD and source links on the reviewed subclass entries. No paid prose.
"""
import copy
import json
import re
from pathlib import Path
from system_package import read_system, write_system

path = Path('src/systems/dnd5e-2014/system.json')
data = read_system(path)
P = 'dnd5e:2014:'
F = {f['id']: f for f in data['features']}
op = lambda key, *args: {'op': key, 'args': list(args)}
st = lambda key: {'stat': key}
lv = lambda cls: {'context': 'level.' + P + cls}
iff = lambda c, yes, no: {'if': c, 'then': yes, 'else': no}
slug = lambda name: re.sub('[^a-z0-9]+', '-', name.lower()).strip('-')


def grant(fid, key=None, level=None):
    return {'id': key or fid, 'kind': 'grantFeature', 'feature': fid, **({'atClassLevel': level} if level else {})}


def choice(key, ids, count, maximum=None):
    return {'id': key, 'kind': 'chooseFeatures', 'eligibility': 'current', 'minimum': count,
            'maximum': count if maximum is None else maximum, 'candidates': {'ids': ids}, 'retraining': {'allowed': True}}


def feature(fid, name, owner, components=None, level=None, tags=None):
    f = {'id': fid, 'revision': 1, 'name': name, 'displayName': name, 'source': owner.get('source', ''),
         'contentLevel': owner.get('contentLevel', 1) if level is None else level,
         'components': components or [], 'tags': tags or ['class-feature', 'subclass-mechanic']}
    F[fid] = f
    return f


def put(owner, component):
    owner['components'] = [c for c in owner['components'] if c['id'] != component['id']] + [component]


def atomic(owner, key, component, name=None):
    f = feature(owner['id'] + '.audit.' + key, name or owner['name'], owner, [component])
    put(owner, grant(f['id'], 'audit-' + key))
    return f


def define(owner, key, expression):
    atomic(owner, 'stat-' + key, {'id': 'value', 'kind': 'defineStat', 'stat': {'id': key, 'name': key, 'kind': 'derived', 'expression': expression}})


def modify(owner, key, value, condition=None):
    atomic(owner, 'modify-' + key, {'id': 'value', 'kind': 'modifyStat', 'stat': key, 'operation': 'floor', 'value': value, **({'condition': condition} if condition else {})})


def pool(owner, key, maximum, short=False):
    tracker = atomic(owner, 'resource', {'id': 'tracker', 'kind': 'trackResource', 'key': key, 'name': owner['name'], 'units': 'uses',
        'integer': True, 'maximum': maximum, 'initialAmount': maximum,
        'recovery': [{'event': event, 'amount': 'full'} for event in (['short-rest', 'long-rest'] if short else ['long-rest'])]}, owner['name'] + ' uses')
    tracker['tags'] = ['resource-tracker']


# Both classes contribute options to the same Channel Divinity allowance.
capacity = iff(op('gte', lv('cleric'), 18), 3, iff(op('gte', lv('cleric'), 6), 2, 1))
for key in ['cleric-channel-divinity', 'paladin-channel-divinity']:
    f = F[P + 'resource.' + key]
    f['name'] = f['displayName'] = 'Channel Divinity'
    f['components'] = [{'id': 'tracker', 'kind': 'trackResource', 'key': 'cleric-channel-divinity', 'name': 'Channel Divinity',
        'units': 'uses', 'integer': True, 'maximum': capacity, 'initialAmount': capacity,
        'recovery': [{'event': event, 'amount': 'full'} for event in ['short-rest', 'long-rest']]}]
for f in F.values():
    for c in f['components']:
        if c['kind'] == 'grantCapability':
            for cost in c.get('costs', []):
                if cost.get('key') == 'paladin-channel-divinity': cost['key'] = 'cleric-channel-divinity'

# Perfected Guardian exists only while the Guardian armor model is active.
guardian = F[P + 'artificer.armorer.guardian']
modify(guardian, 'guardianArmorModel', 1)
perfect = F[P + 'artificer.armorer.perfected-armor']
guard = op('eq', st('guardianArmorModel'), 1)
for c in perfect['components']:
    if c['kind'] == 'grantCapability': c['condition'] = guard
F[P + 'artificer.resource.perfected-guardian']['components'][0]['condition'] = guard
for config in data['configurations']:
    config['system']['stats'] = [s for s in config['system']['stats'] if s['id'] != 'guardianArmorModel'] + [{'id': 'guardianArmorModel', 'name': 'Guardian armor model', 'kind': 'derived', 'expression': 0}]

# Reuse canonical spell data and casting blocks, with the subclass's casting ability.
casts = {}
for f in list(F.values()):
    for c in f['components']:
        if c['kind'] == 'useBlock' and 'spell' in c.get('arguments', {}) and c['block'].startswith(P + 'casting.level-'):
            casts.setdefault(c['arguments']['spell'], copy.deepcopy(c))


def spell(owner, name, ability, key=None):
    canonical = P + 'spell.' + slug(name)
    base = F[canonical]
    block = copy.deepcopy(casts[canonical])
    block['id'] = 'casting'
    block['arguments'].update(castingAbility=ability, ritualAllowed=False)
    fid = key or owner['id'] + '.audit.spell.' + slug(name)
    f = feature(fid, base['name'], owner, [block, grant(canonical, 'spell-rules')], base.get('contentLevel', 0), ['spell', 'subclass-spell'])
    f['textReferences'] = [canonical]
    return f


arcana = F[P + 'subclass.cleric.arcana-domain.arcane-initiate.1']
meta = json.loads(Path('src/systems/dnd5e-2014/metadata.json').read_text(encoding='utf-8'))
cantrips = [spell(arcana, entry['name'], 'wisdom')['id'] for entry in meta['wizardSpells'] if entry['level'] == 0]
put(arcana, choice('wizard-cantrips', cantrips, 2))
arcana['mechanicalSummary'] = ['Arcana proficiency and two Wizard cantrips are granted. These cantrips use Wisdom as Cleric spells.']
arcana_root = F[P + 'subclass.cleric.arcana-domain']
for level, names in [(1, ['Detect Magic', 'Magic Missile']), (3, ['Magic Weapon', 'Arcanist’s Magic Aura']), (5, ['Dispel Magic', 'Magic Circle']), (7, ['Arcane Eye', 'Secret Chest']), (9, ['Planar Binding', 'Teleportation Circle'])]:
    for name in names:
        f = spell(arcana_root, name, 'wisdom')
        put(arcana_root, grant(f['id'], 'audit-domain-' + slug(name), level))

celestial = F[P + 'subclass.warlock.the-celestial.bonus-cantrips.1']
for name in ['Light', 'Sacred Flame']:
    f = spell(celestial, name, 'charisma')
    put(celestial, grant(f['id'], 'audit-' + slug(name)))
celestial['mechanicalSummary'] = ['Light and Sacred Flame are granted as Charisma-based Warlock cantrips without using known-cantrip selections.']
healing = F[P + 'subclass.warlock.the-celestial.healing-light.1']
pool(healing, 'celestial-healing-light', op('add', 1, lv('warlock')))
for count in range(1, 11):
    name = 'Healing Light (' + str(count) + 'd6)'
    put(healing, {'id': 'audit-use-' + str(count), 'kind': 'grantCapability', 'name': name,
        'costs': [{'key': 'celestial-healing-light', 'amount': count}],
        'condition': op('gte', op('max', 1, st('modifier.charisma')), count)})
    f = feature(healing['id'] + '.audit.roll.' + str(count), name, healing, tags=['roll-feature'])
    f['roll'] = {'id': 'healing', 'label': name, 'dice': str(count) + 'd6', 'capability': name, 'restoreResource': 'hit-points'}
    put(healing, grant(f['id'], 'audit-roll-' + str(count)))
healing['mechanicalSummary'] = ['Choose the number of d6s to spend, up to your Charisma modifier (minimum 1). Rolling spends the dice; applying healing is separate. The pool recovers on a long rest. Healing another target is resolved at the table.']

# Expanded lists add candidates, never automatically learn all their spells.
known = next(c for c in F[P + 'warlock.pact-magic']['components'] if c['id'] == 'known')
fiend_spells = ['Burning Hands', 'Command', 'Blindness/Deafness', 'Scorching Ray', 'Fireball', 'Stinking Cloud', 'Fire Shield', 'Wall of Fire', 'Flame Strike', 'Hallow']
celestial_spells = ['Cure Wounds', 'Guiding Bolt', 'Flaming Sphere', 'Lesser Restoration', 'Daylight', 'Revivify', 'Guardian of Faith', 'Wall of Fire', 'Flame Strike', 'Greater Restoration']
for name in set(fiend_spells + celestial_spells):
    fid = P + 'warlock.prepared.' + slug(name)
    f = F.get(fid) or spell(celestial, name, 'charisma', fid)
    roots = ([{'feature': P + 'warlock.subclass'}] if name in fiend_spells else []) + ([{'feature': P + 'subclass.warlock.the-celestial'}] if name in celestial_spells else [])
    f['prerequisites'] = {'any': roots}
    if fid not in known['candidates']['ids']: known['candidates']['ids'].append(fid)
F[P + 'subclass.warlock.the-celestial.expanded-spell-list.1']['mechanicalSummary'] = ['Expanded spells are available in Warlock known-spell choices while this patron is selected. They count against spells known.']

swords = F[P + 'subclass.bard.college-of-swords.fighting-style.3']
put(swords, choice('style', [P + 'style.dueling', P + 'style.two-weapon-fighting'], 1))
swords['mechanicalSummary'] = ['Choose Dueling or Two-Weapon Fighting. Uses the same fighting-style Features as other classes.']

runes = F[P + 'subclass.fighter.rune-knight.rune-carver.3']
rune_ids = []
for name in ['Cloud', 'Fire', 'Frost', 'Stone', 'Hill', 'Storm']:
    f = feature(runes['id'] + '.audit.rune.' + name.lower(), name + ' Rune', runes, level=7 if name in ['Hill', 'Storm'] else 3)
    f['prerequisites'] = {'expression': op('gte', lv('fighter'), f['contentLevel'])}
    key = 'rune-knight-' + name.lower()
    pool(f, key, iff(op('gte', lv('fighter'), 15), 2, 1), True)
    put(f, {'id': 'invoke', 'kind': 'grantCapability', 'name': 'Invoke ' + name + ' Rune', 'costs': [{'key': key, 'amount': 1}]})
    f['mechanicalSummary'] = ['Rune selection, level requirement, invocation uses and short/long rest recovery are automated. Inscription, carrying the item, passive benefits, targets and effect duration are resolved using the source.']
    rune_ids.append(f['id'])
put(runes, choice('runes', rune_ids, op('add', 2, *[iff(op('gte', lv('fighter'), n), 1, 0) for n in [7, 10, 15]])))
define(runes, 'runeSaveDC', op('add', 8, st('proficiencyBonus'), st('modifier.constitution')))
runes['mechanicalSummary'] = ['Choose 2 runes at Fighter 3, 3 at 7, 4 at 10 and 5 at 15. Hill and Storm require Fighter 7. Each rune tracks its own invocation uses; Master of Runes increases each to two. Replacement timing and inscribing carried equipment remain table-managed.']
F[P + 'subclass.fighter.rune-knight.master-of-runes.15']['mechanicalSummary'] = ['Each selected rune’s invocation pool increases to two uses per short or long rest.']

# Profane Soul uses the Warlock list, Hemocraft ability and the documented joint Pact progression.
profane = F[P + 'subclass.blood-hunter.order-of-the-profane-soul.pact-magic.3']
profane['components'] = [c for c in profane['components'] if c['id'] != 'audit-stat-profaneSoulLevel']
F.pop(profane['id'] + '.audit.stat-profaneSoulLevel', None)
modify(profane, 'profaneSoulLevel', lv('blood-hunter'))
define(profane, 'profaneSoulSpellAttack', op('add', st('proficiencyBonus'), st('hemocraftModifier')))
define(profane, 'profaneSoulSpellDC', op('add', 8, st('profaneSoulSpellAttack')))
put(profane, grant(P + 'resource.pact-slot', 'audit-pact-slots'))
for n in range(1, 10): put(profane, grant(P + 'resource.spell-slot.' + str(n), 'audit-slot-' + str(n)))
wisdom = F[P + 'subclass.blood-hunter.hemocraft-wisdom']
modify(wisdom, 'hemocraftUsesWisdom', 1)
blocks = {b['id']: b for b in data['blocks']}
for n in range(0, 5):
    block = copy.deepcopy(blocks[P + 'casting.level-' + str(n)])
    block['id'] = P + 'audit.profane-casting.' + str(n)
    block['parameters']['hemocraftMode'] = {'kind': 'number'}
    for c in block['components']:
        c['condition'] = op('and', c.get('condition', True), op('eq', st('hemocraftUsesWisdom'), {'argument': 'hemocraftMode'}))
    blocks[block['id']] = block
warlock = F[P + 'warlock.pact-magic']
warlock_cantrips = next(c for c in warlock['components'] if c['id'] == 'cantrips')['candidates']['ids']
# Exclude patron-expanded spells: Profane Soul does not grant Warlock patron spell lists.
warlock_known = [fid for fid in known['candidates']['ids'] if F[fid].get('contentLevel', 0) <= 4 and not F[fid].get('prerequisites')]
profane_ids = {0: [], 1: []}
for fid in warlock_cantrips + warlock_known:
    base = F[fid]
    canonical = next(c['feature'] for c in base['components'] if c['kind'] == 'grantFeature' and c['feature'].startswith(P + 'spell.'))
    f = feature(profane['id'] + '.audit.spell.' + canonical.split('spell.')[1], base['name'], profane, level=base['contentLevel'], tags=['spell', 'subclass-spell', 'partner-content'])
    for mode, ability in enumerate(['intelligence', 'wisdom']):
        c = copy.deepcopy(casts[canonical]); c['id'] = ability; c['block'] = P + 'audit.profane-casting.' + str(base['contentLevel'])
        c['arguments'].update(castingAbility=ability, ritualAllowed=False, hemocraftMode=mode)
        f['components'].append(c)
    f['components'].append(grant(canonical, 'spell-rules'))
    f['textReferences'] = [canonical]
    profane_ids[0 if base['contentLevel'] == 0 else 1].append(f['id'])
# Explicit table avoids inventing rounding at levels 3/4, 19/20.
profane_count = 2
for n, count in [(5, 3), (7, 4), (9, 5), (11, 6), (13, 7), (15, 8), (17, 9), (19, 10), (20, 11)]: profane_count = iff(op('gte', lv('blood-hunter'), n), count, profane_count)
combined = op('add', lv('warlock'), op('floor', op('divide', lv('blood-hunter'), 3)))
warlock_cantrip_count = lambda level: iff(op('gte', level, 10), 4, iff(op('gte', level, 4), 3, 2))
# Warlock keeps its own choices; Profane Soul supplies only the additional
# cantrips allowed by the combined table, rather than granting both totals.
cantrip_count = iff(op('gt', lv('warlock'), 0), op('max', 0, op('subtract', warlock_cantrip_count(combined), warlock_cantrip_count(lv('warlock')))), iff(op('gte', lv('blood-hunter'), 10), 3, 2))
put(profane, choice('cantrips', profane_ids[0], cantrip_count))
put(profane, choice('known', profane_ids[1], profane_count))
next(c for c in profane['components'] if c['id'] == 'known')['candidates']['maximumLevel'] = iff(op('gte', lv('blood-hunter'), 19), 4, iff(op('gte', lv('blood-hunter'), 13), 3, iff(op('gte', lv('blood-hunter'), 7), 2, 1)))
profane['mechanicalSummary'] = ['Warlock-list spell choices, Hemocraft casting ability and short-rest Pact slots are automated. With Warlock levels, one third of Blood Hunter levels (rounded down) contributes to the shared Pact slots and total cantrips known; Warlock keeps its own cantrip choices and Profane Soul supplies any remaining choices. Replace at most one known spell when gaining a Blood Hunter level; timing is table-managed.']
for config in data['configurations']:
    stats = config['system']['stats']
    for key in ['profaneSoulLevel', 'hemocraftUsesWisdom']:
        if not any(s['id'] == key for s in stats): stats.append({'id': key, 'name': key, 'kind': 'derived', 'expression': 0})
    combined = op('add', lv('warlock'), op('floor', op('divide', st('profaneSoulLevel'), 3)))
    slot_level = iff(op('gt', lv('warlock'), 0), op('min', 5, op('ceil', op('divide', combined, 2))), iff(op('gte', st('profaneSoulLevel'), 19), 4, iff(op('gte', st('profaneSoulLevel'), 13), 3, iff(op('gte', st('profaneSoulLevel'), 7), 2, iff(op('gte', st('profaneSoulLevel'), 3), 1, 0)))))
    slot_count = iff(op('gt', lv('warlock'), 0), iff(op('gte', combined, 17), 4, iff(op('gte', combined, 11), 3, iff(op('gte', combined, 2), 2, 1))), iff(op('gte', st('profaneSoulLevel'), 6), 2, iff(op('gte', st('profaneSoulLevel'), 3), 1, 0)))
    for key, expression in [('pactSlotLevel', slot_level), ('pactSlotCount', slot_count)]: next(s for s in stats if s['id'] == key)['expression'] = expression

# Correct the concrete spell-roll failures without changing source descriptions.
for name in ['Fire Bolt', 'Chill Touch', 'Ray of Frost', 'Sacred Flame', 'Shocking Grasp', 'Poison Spray', 'Acid Splash']:
    owner = F.get(P + 'spell.' + slug(name))
    if not owner: continue
    grants = [c for c in owner['components'] if c['kind'] == 'grantFeature' and F.get(c['feature'], {}).get('roll')]
    if not grants: continue
    first = F[grants[0]['feature']]
    first['roll']['characterScaling'] = [{'level': n, 'count': count} for n, count in [(5, 2), (11, 3), (17, 4)]]
    for c in grants[1:]:
        owner['components'].remove(c)
        F.pop(c['feature'], None)
for name in ['Cure Wounds', 'Healing Word', 'Mass Cure Wounds', 'Mass Healing Word', 'Prayer of Healing']:
    owner = F[P + 'spell.' + slug(name)]
    for c in owner['components']:
        if c['kind'] == 'grantFeature' and F.get(c['feature'], {}).get('roll'):
            roll = F[c['feature']]['roll']
            roll['bonus'] = {'castingAbility': True}
            roll['restoreResource'] = 'hit-points'
            roll['slotScaling'] = {'baseLevel': owner['contentLevel'], 'dicePerLevel': 1}
# Simple per-slot damage scaling, explicitly limited to reviewed single-term spells.
for name in ['Burning Hands', 'Fireball', 'Lightning Bolt', 'Thunderwave', 'Shatter', 'Cone of Cold']:
    owner = F[P + 'spell.' + slug(name)]
    for c in owner['components']:
        if c['kind'] == 'grantFeature' and F.get(c['feature'], {}).get('roll'):
            F[c['feature']]['roll']['slotScaling'] = {'baseLevel': owner['contentLevel'], 'dicePerLevel': 1}

data['features'] = list(F.values())
data['blocks'] = list(blocks.values())
write_system(path, data)
print('Applied audited subclass, resource, and spell-roll corrections.')
