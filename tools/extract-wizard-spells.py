"""Rebuild the SRD 5.1 Wizard spell metadata from the authorized official PDF.

Requires pypdf. Source PDF is a local, untracked reference cache. This script
does not download third-party content or alter the rules mechanically.
"""
import json
import re
import hashlib
from pathlib import Path
from pypdf import PdfReader

SPELLS = [
    'Acid Splash|Chill Touch|Dancing Lights|Fire Bolt|Light|Mage Hand|Mending|Message|Minor Illusion|Poison Spray|Prestidigitation|Ray of Frost|Shocking Grasp|True Strike',
    'Alarm|Burning Hands|Charm Person|Color Spray|Comprehend Languages|Detect Magic|Disguise Self|Expeditious Retreat|False Life|Feather Fall|Find Familiar|Floating Disk|Fog Cloud|Grease|Hideous Laughter|Identify|Illusory Script|Jump|Longstrider|Mage Armor|Magic Missile|Protection from Evil and Good|Shield|Silent Image|Sleep|Thunderwave|Unseen Servant',
    'Acid Arrow|Alter Self|Arcane Lock|Arcanist’s Magic Aura|Blindness/Deafness|Blur|Continual Flame|Darkness|Darkvision|Detect Thoughts|Enlarge/Reduce|Flaming Sphere|Gentle Repose|Gust of Wind|Hold Person|Invisibility|Knock|Levitate|Locate Object|Magic Mouth|Magic Weapon|Mirror Image|Misty Step|Ray of Enfeeblement|Rope Trick|Scorching Ray|See Invisibility|Shatter|Spider Climb|Suggestion|Web',
    'Animate Dead|Bestow Curse|Blink|Clairvoyance|Counterspell|Dispel Magic|Fear|Fireball|Fly|Gaseous Form|Glyph of Warding|Haste|Hypnotic Pattern|Lightning Bolt|Magic Circle|Major Image|Nondetection|Phantom Steed|Protection from Energy|Remove Curse|Sending|Sleet Storm|Slow|Stinking Cloud|Tiny Hut|Tongues|Vampiric Touch|Water Breathing',
    'Arcane Eye|Banishment|Black Tentacles|Blight|Confusion|Conjure Minor Elementals|Control Water|Dimension Door|Fabricate|Faithful Hound|Fire Shield|Greater Invisibility|Hallucinatory Terrain|Ice Storm|Locate Creature|Phantasmal Killer|Polymorph|Private Sanctum|Resilient Sphere|Secret Chest|Stone Shape|Stoneskin|Wall of Fire',
    'Animate Objects|Arcane Hand|Cloudkill|Cone of Cold|Conjure Elemental|Contact Other Plane|Creation|Dominate Person|Dream|Geas|Hold Monster|Legend Lore|Mislead|Modify Memory|Passwall|Planar Binding|Scrying|Seeming|Telekinesis|Telepathic Bond|Teleportation Circle|Wall of Force|Wall of Stone',
    'Chain Lightning|Circle of Death|Contingency|Create Undead|Disintegrate|Eyebite|Flesh to Stone|Freezing Sphere|Globe of Invulnerability|Guards and Wards|Instant Summons|Irresistible Dance|Magic Jar|Mass Suggestion|Move Earth|Programmed Illusion|Sunbeam|True Seeing|Wall of Ice',
    'Arcane Sword|Delayed Blast Fireball|Etherealness|Finger of Death|Forcecage|Magnificent Mansion|Mirage Arcane|Plane Shift|Prismatic Spray|Project Image|Reverse Gravity|Sequester|Simulacrum|Symbol|Teleport',
    'Antimagic Field|Antipathy/Sympathy|Clone|Control Weather|Demiplane|Dominate Monster|Feeblemind|Incendiary Cloud|Maze|Mind Blank|Power Word Stun|Sunburst',
    'Astral Projection|Foresight|Gate|Imprisonment|Meteor Swarm|Power Word Kill|Prismatic Wall|Shapechange|Time Stop|True Polymorph|Weird|Wish',
]

source_path = Path('.reference-cache/srd-5.1.pdf')
expected_sha256 = '2504d2a0abb0a4d491a939be4f17910a2dde0312570ab8d208080225ccf0a1f0'
if hashlib.sha256(source_path.read_bytes()).hexdigest() != expected_sha256:
    raise ValueError('The source PDF does not match the pinned official SRD 5.1 edition.')
reader = PdfReader(source_path)
pages = [(i + 1, re.sub(r'System Reference Document 5\.1 \d+', '', re.sub(r'\s+', ' ', p.extract_text()))) for i, p in enumerate(reader.pages) if 113 <= i < 235]
combined = ' '.join(text for _, text in pages)
page_starts = []
position = 0
for page, text in pages:
    page_starts.append((page, position))
    position += len(text) + 1
rows = []
for level, names in enumerate(SPELLS):
    for name in names.split('|'):
        schools = r'(?:abjuration|conjuration|divination|enchantment|evocation|illusion|necromancy|transmutation)'
        header_pattern = r'(?:[1-9](?:st|nd|rd|th)[^\w]{1,8}level\s+' + schools + r'|' + schools + r'\s+cantrip)(?:\s*\(ritual\))?'
        pattern = re.compile(r'\b' + re.escape(name) + r'\s+(' + header_pattern + r')\s+Casting Time:\s*(.*?)\s*Range:\s*(.*?)\s*Components:\s*(.*?)\s*Duration:\s*', re.I)
        found = [(max(page for page, start in page_starts if start <= match.start()), match) for match in pattern.finditer(combined) if (0 if 'cantrip' in match[1].lower() else int(match[1][0])) == level]
        found = [(page, match) for page, match in found if not any(other != name and other.endswith(name) and combined[:match.start()].endswith(other[:-len(name)]) for other in SPELLS[level].split('|'))]
        if len(found) != 1:
            raise ValueError(f'{name}: expected one spell header, got {len(found)}')
        page, match = found[0]
        header = match[1].lower()
        school = next(s for s in ['abjuration','conjuration','divination','enchantment','evocation','illusion','necromancy','transmutation'] if s in header)
        rows.append({'slug': re.sub(r'[^a-z0-9]+','-',name.lower()).strip('-'), 'name': name, 'level': level, 'school': school, 'ritual': '(ritual)' in header, 'castingTime': match[2], 'range': match[3], 'components': match[4], 'page': page})

output = '// Generated from the official SRD 5.1; see tools/extract-wizard-spells.py and NOTICE.md.\n'
output += 'export interface Spell { slug: string; name: string; level: number; school: string; ritual: boolean; castingTime: string; range: string; components: string; page: number }\n'
output += 'export const wizardSpells: Spell[] = ' + json.dumps(rows, ensure_ascii=False, indent=2) + ';\n'
Path('src/systems/dnd5e-2014/spells.ts').write_text(output, encoding='utf8')
print(f'Extracted {len(rows)} Wizard spell headers from SRD 5.1.')
