"""Save display text for the implemented SRD 5.1 content in system.json.

Run from the project root with pdfplumber installed. The official source PDF belongs
in .reference-cache/srd-5.1.pdf; its digest is pinned below. This tool changes
only descriptions, sources, and display references, never mechanical rules.
"""
import hashlib
import json
import re
from pathlib import Path
import pdfplumber
from dnd2014_class_tags import apply_class_tags

ROOT = Path(__file__).resolve().parents[1]
PDF = ROOT / '.reference-cache/srd-5.1.pdf'
SYSTEM = ROOT / 'src/systems/dnd5e-2014/system.json'
SHA256 = '2504d2a0abb0a4d491a939be4f17910a2dde0312570ab8d208080225ccf0a1f0'
URL = 'https://media.wizards.com/2023/downloads/dnd/SRD_CC_v5.1.pdf'
PREFIX = 'dnd5e:2014:'

if hashlib.sha256(PDF.read_bytes()).hexdigest() != SHA256:
    raise ValueError('The PDF does not match the pinned official SRD 5.1 edition.')


def clean(value):
    # Normalize the PDF's encoded hyphen sequence and typographic whitespace.
    value = re.sub(r'[-\u00ad\u2010\u2011]{2,}', '-', value).replace('\u00ad', '')
    value = re.sub(r'\s+', ' ', value).strip()
    value = re.sub(r'(?<=\w)-\s+(?=\w)', '-', value)
    # Verified PDF spacing artifacts inside these words (SRD pp. 25, 41).
    return value.replace('r ests', 'rests').replace('e qual', 'equal')


sections = []
current = None
with pdfplumber.open(PDF) as document:
    for page_number, page in enumerate(document.pages[:194], 1):
        # Crop columns in reading order, excluding the footer. pdfplumber uses
        # transformed character coordinates; raw PDF text matrices can place
        # legitimate spell text outside the page and silently lose clauses.
        if not (3 <= page_number <= 7 or 24 <= page_number <= 25 or 39 <= page_number <= 41 or 52 <= page_number <= 55 or 59 <= page_number <= 61 or 70 <= page_number <= 71 or 75 <= page_number <= 82 or 114 <= page_number <= 194):
            continue
        regions = [(45, 30, 316, 745), (316, 30, 580, 745)]
        if page_number == 52:
            # The Wizard's full-width table divides the page into two separate
            # column pairs. Read starting traits before the spellcasting text.
            regions = [(45, 30, 316, 285), (316, 30, 580, 285), (45, 555, 316, 745), (316, 555, 580, 745)]
        for bounds in regions:
            for line in page.crop(bounds).extract_text_lines(return_chars=True):
                value = clean(line['text'])
                if page_number == 39 and value == 'Thievesʼ Cant':
                    continue  # Wrapped progression-table cell, not Equipment prose.
                chars = [c for c in line['chars'] if c['text'].strip()]
                if page_number in [24, 39, 52] and chars and all('Calibri' in c['fontname'] for c in chars):
                    continue  # Full-width progression table, already represented as level data.
                heading = chars and all('GillSans-SemiBold' in c['fontname'] and c['size'] >= 11.9 for c in chars)
                if heading or value in ['Your Spellbook', 'Standard Languages', 'Exotic Languages', 'Draconic Ancestry']:
                    current = {'heading': value, 'page': page_number, 'lastPage': page_number, 'parts': []}
                    sections.append(current)
                elif current:
                    current['lastPage'] = page_number
                    label = bool(re.match(r'(Casting Time:|Range:|Components:|Duration:|Hit Dice:|Hit Points at|Armor:|Weapons:|Tools:|Saving Throws:|Skills:|•)', value))
                    bold = chars and 'Bold' in chars[0]['fontname']
                    indent = line['x0'] > bounds[0] + 18 and current['parts'] and current['parts'][-1].rstrip().endswith(('.', ':', '!', '?'))
                    follows_duration = current['parts'] and current['parts'][-1].startswith('Duration:')
                    if current['parts'] and (label or bold or indent or follows_duration):
                        current['parts'].append('PARAGRAPH_BREAK')
                    current['parts'].append(value)
for section in sections:
    section['text'] = '\n\n'.join(clean(part) for part in ' '.join(section.pop('parts')).split('PARAGRAPH_BREAK') if clean(part))


def find(heading, first, last=None):
    matches = [s for s in sections if s['heading'] == heading and first <= s['page'] <= (last or first)]
    if len(matches) != 1 or not matches[0]['text']:
        raise ValueError(f'Expected one nonempty {heading!r} in pages {first}–{last or first}, got {len(matches)}.')
    return matches[0]


def source(first, last=None):
    pages = f'pp. {first}–{last}' if last and first != last else f'p. {first}'
    return f'SRD 5.1 {pages} (CC BY 4.0), {URL}#page={first}'


system = json.loads(SYSTEM.read_text(encoding='utf8'))
features = {f['id']: f for f in system['features']}
apply_class_tags(system)
for feature in features.values():
    feature.pop('description', None)
    feature.pop('textReferences', None)
    feature.pop('textAliases', None)


def save(short_id, items):
    feature = features[PREFIX + short_id]
    feature['description'] = '\n\n'.join(s.get('verbatim', s['heading'] + '\n' + s['text']) for s in items)
    feature['source'] = source(min(s['page'] for s in items), max(s['lastPage'] for s in items))


def title(value):
    return value.replace('-', ' ').title()


for feature in features.values():
    name = feature['name']
    if ':skill.' in feature['id']:
        name = title(name.split(': ', 1)[1]) + ' Proficiency'
    elif ':expertise.' in feature['id']:
        name = title(name.split(': ', 1)[1]) + ' Expertise'
    elif ':language.' in feature['id']:
        name = title(name.split(': ', 1)[1]) + ' Language'
    elif ':tool.' in feature['id']:
        name = {'smith': 'Smith’s Tools Proficiency', 'brewer': 'Brewer’s Supplies Proficiency', 'mason': 'Mason’s Tools Proficiency'}[feature['id'].rsplit('.', 1)[1]]
    elif ':dragon-ancestry.' in feature['id']:
        name = title(name)
    elif ':background-replacement.' in feature['id']:
        name = 'Replacement ' + title(feature['id'].rsplit('.', 1)[1]) + ' Proficiency'
    elif name.endswith('entry benefits'):
        name = name.replace('entry benefits', 'Starting Traits')
    elif name.endswith('hit points for one level'):
        name = name.replace('hit points for one level', 'Hit Points')
    elif 'resource/attack upgrade' in name:
        level = feature['id'].rsplit('-', 1)[1]
        name = {'11': 'Extra Attack: Three Attacks', '13': 'Indomitable: Two Uses', '17': 'Action Surge and Indomitable: Additional Uses', '20': 'Extra Attack: Four Attacks'}[level]
    elif feature['id'].endswith(':tables'):
        name = 'DnD5e 2014 Rules Tables'
    feature['displayName'] = name

tag_names = {
    'class-feature': 'Class Feature',
    'background': 'Background', 'expertise': 'Expertise', 'feat': 'Feat',
    'fighter-subclass': 'Fighter Subclass', 'language': 'Language', 'race': 'Race',
    'racial-cantrip': 'Racial Cantrip', 'rogue-subclass': 'Rogue Subclass',
    'skill-proficiency': 'Skill Proficiency', 'spell': 'Spell', 'subclass': 'Subclass',
    'wizard-cantrip': 'Wizard Cantrip', 'wizard-caster': 'Wizard Spellcasting',
    'wizard-prepared': 'Prepared Wizard Spell', 'wizard-spellbook': 'Wizard Spellbook',
    'wizard-subclass': 'Wizard Subclass',
}
if set(tag_names) != {tag for f in features.values() for tag in f.get('tags', [])}:
    raise ValueError('Update the tag display names for new or removed tags.')
for configuration in system['configurations']:
    configuration['system']['tagDisplayNames'] = tag_names


# Class introductions retain traits and equipment. Progression tables are already
# represented by level entries; do not flatten the PDF's two-column tables.
for name, page in [('Fighter', 24), ('Rogue', 39), ('Wizard', 52)]:
    items = [find(h, page) for h in ['Class Features', 'Hit Points', 'Proficiencies', 'Equipment']]
    items[-1] = {**items[-1], 'text': items[-1]['text'].split('The ' + name)[0].strip()}
    description = '\n\n'.join(s['heading'] + '\n' + s['text'] for s in items)
    for configuration in system['configurations']:
        cls = next(c for c in configuration['classes'] if c['name'] == name)
        cls['description'] = description
        cls['source'] = source(page, {'Fighter': 25, 'Rogue': 41, 'Wizard': 54}[name])
    save(name.lower() + '.entry', [items[2], items[3]])
    save(name.lower() + '.hit-points', [items[1]])

clauses = {
    'ability-score-improvement': ('Ability Score Improvement', 25, 25),
    'fighter.second-wind': ('Second Wind', 24, 24),
    'fighter.action-surge': ('Action Surge', 25, 25),
    'fighter.extra-attack': ('Extra Attack', 25, 25),
    'fighter.indomitable': ('Indomitable', 25, 25),
    'fighter.champion': ('Champion', 25, 25),
    'fighter.remarkable-athlete': ('Remarkable Athlete', 25, 25),
    'fighter.superior-critical': ('Superior Critical', 25, 25),
    'fighter.survivor': ('Survivor', 25, 25),
    'rogue.sneak-attack': ('Sneak Attack', 39, 39),
    'rogue.thieves-cant': ('Thieves’ Cant', 39, 39),
    'rogue.cunning-action': ('Cunning Action', 40, 40),
    'rogue.uncanny-dodge': ('Uncanny Dodge', 40, 40),
    'rogue.evasion': ('Evasion', 40, 40),
    'rogue.supreme-sneak': ('Supreme Sneak', 41, 41),
    'rogue.reliable-talent': ('Reliable Talent', 40, 40),
    'rogue.use-magic-device': ('Use Magic Device', 41, 41),
    'rogue.blindsense': ('Blindsense', 40, 40),
    'rogue.slippery-mind': ('Slippery Mind', 40, 40),
    'rogue.thiefs-reflexes': ('Thief’s Reflexes', 41, 41),
    'rogue.elusive': ('Elusive', 40, 40),
    'rogue.stroke-of-luck': ('Stroke of Luck', 40, 40),
    'wizard.potent-cantrip': ('Potent Cantrip', 54, 54),
    'wizard.empowered-evocation': ('Empowered Evocation', 54, 54),
    'wizard.overchannel': ('Overchannel', 54, 54),
    'wizard.arcane-recovery': ('Arcane Recovery', 53, 53),
    'wizard.spell-mastery': ('Spell Mastery', 53, 53),
    'wizard.signature-spells': ('Signature Spells', 54, 54),
    'feat.grappler': ('Grappler', 75, 75),
}
for short_id, (heading, first, last) in clauses.items():
    save(short_id, [find(heading, first, last)])
# This shared Feature appears in three different advancement schedules. Retain
# each class's clause rather than displaying only the Fighter's timing.
save('ability-score-improvement', [find('Ability Score Improvement', page) for page in [25, 40, 53]])
for style in ['Archery', 'Defense', 'Dueling', 'Great Weapon Fighting', 'Protection', 'Two-Weapon Fighting']:
    save('style.' + style.lower().replace(' ', '-'), [find(style, 24)])
save('fighter.champion', [find('Champion', 25), find('Improved Critical', 25)])
save('rogue.thief', [find('Thief', 40), find('Fast Hands', 40), find('Second-Story Work', 41)])
save('wizard.evocation', [find(h, 54) for h in ['School of Evocation', 'Evocation Savant', 'Sculpt Spells']])
save('wizard.spellcasting', [find('Spellcasting', 52), find('Cantrips', 52), find('Spellbook', 52)] +
     [find(h, 53) for h in ['Preparing and Casting Spells', 'Spellcasting Ability', 'Ritual Casting', 'Spellcasting Focus', 'Learning Spells of 1st Level and Higher']] + [find('Your Spellbook', 54)])
save('background.acolyte', [find('Acolyte', 60), find('Feature: Shelter of the Faithful', 61)])

for short_id, headings in {
    'human': [('Human Traits', 5)], 'hill-dwarf': [('Dwarf Traits', 3), ('Hill Dwarf', 4)],
    'high-elf': [('Elf Traits', 4), ('High Elf', 4)],
    'lightfoot-halfling': [('Halfling Traits', 4), ('Lightfoot', 5)],
    'dragonborn': [('Dragonborn Traits', 5), ('Draconic Ancestry', 5)], 'rock-gnome': [('Gnome Traits', 6), ('Rock Gnome', 6)],
    'half-elf': [('Half-Elf Traits', 6)], 'half-orc': [('Half-Orc Traits', 7)], 'tiefling': [('Tiefling Traits', 7)],
}.items():
    save('race.' + short_id, [find(h, p) for h, p in headings])

# One full spell description, shared by its prepared, book, mastery, signature,
# cantrip, and racial wrappers. This avoids hundreds of repeated rule blocks.
metadata = json.loads((SYSTEM.parent / 'metadata.json').read_text(encoding='utf8'))
for spell in metadata['wizardSpells']:
    save('spell.' + spell['slug'], [find(spell['name'], spell['page'])])

# Inline bold clauses are source paragraphs, not independent section headings.
# Read columns in order and stop at the next bold clause or section heading.
inline = {}
with pdfplumber.open(PDF) as document:
    active = None
    for page_number in [70, 71, 79, 80, 81, 82]:
        for bounds in [(45, 30, 316, 745), (316, 30, 580, 745)]:
            for line in document.pages[page_number - 1].crop(bounds).extract_text_lines(return_chars=True):
                value = clean(line['text'])
                chars = [c for c in line['chars'] if c['text'].strip()]
                is_bold = chars and ('Bold' in chars[0]['fontname'])
                if is_bold:
                    active = None
                    match = re.match(r'^([^.:]+)\.\s', value)
                    if match:
                        active = {'heading': match[1], 'page': page_number, 'lastPage': page_number, 'lines': []}
                        inline[match[1]] = active
                if active:
                    active['lines'].append(value)
                    active['lastPage'] = page_number
for item in inline.values():
    item['text'] = clean(' '.join(item.pop('lines')))
    item['verbatim'] = item['text']
    # The source already includes the inline heading and punctuation.
    item['text'] = item['text'][len(item['heading']) + 2:]

for level in [11, 13, 17, 20]:
    headings = ['Extra Attack'] if level in [11, 20] else ['Indomitable'] if level == 13 else ['Action Surge', 'Indomitable']
    save(f'fighter.upgrade-{level}', [find(h, 25) for h in headings])

for feature in system['features']:
    local = feature['id'].removeprefix(PREFIX)
    if local.startswith('skill.'):
        skill = next(name for name in inline if name.lower() == title(local.split('.', 1)[1]).lower())
        save(local, [inline[skill]])
        feature['textAliases'] = [skill]
    elif local.startswith('expertise.'):
        save(local, [find('Expertise', 39)])
        feature['textAliases'] = ['Expertise']
    elif local.startswith('language.'):
        save(local, [find(h, 59) for h in ['Languages', 'Standard Languages', 'Exotic Languages']])
        feature['textAliases'] = [title(local.split('.', 1)[1])]
    elif local.startswith('tool.'):
        save(local, [inline['Artisan’s Tools']])
        feature['textAliases'] = [feature['displayName'].removesuffix(' Proficiency')]
    elif local.startswith('background-replacement.'):
        save(local, [find('Proficiencies', 60)])
    elif local.startswith('dragon-ancestry.'):
        ancestry = find('Draconic Ancestry', 5)
        save(local, [{**ancestry, 'text': ancestry['text'].split('Languages.')[0].strip()}])
    elif local == 'tables':
        save(local, [find('Proficiency Bonus', 77)])

features[PREFIX + 'fighter.champion']['textAliases'] = ['Improved Critical']
features[PREFIX + 'rogue.thief']['textAliases'] = ['Fast Hands', 'Second-Story Work']
features[PREFIX + 'wizard.evocation']['textAliases'] = ['Evocation Savant', 'Sculpt Spells']

for feature in system['features']:
    references = []
    for component in feature['components']:
        ref = component.get('metadata', {}).get('spell') if component['kind'] == 'grantCapability' else component.get('feature') if component['kind'] == 'grantFeature' else None
        if ref in features and ':spell.' in ref and ref not in references:
            references.append(ref)
    if references:
        feature['textReferences'] = references
        if not feature['id'].startswith(PREFIX + 'spell.'):
            # Spell wrappers share the original spell text; implementation
            # summaries and adjudication notes are never presented as rules.
            feature.pop('description', None)
            feature['source'] = features[references[0]]['source']
    if not feature.get('description') and not feature.get('textReferences'):
        raise ValueError('Missing source passage for ' + feature['id'])

SYSTEM.write_text(json.dumps(system, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
print(f'Saved source text for {len(system["features"])} Features (including shared references) and 3 Classes; {len(metadata["wizardSpells"])} complete Wizard spell descriptions.')
