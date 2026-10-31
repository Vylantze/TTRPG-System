"""Split SRD 5.2.1 into headed sections for the DnD5e 2024 System.

Run from the project root with the shared pdf-extraction environment:
X:/AI/utils/python-envs/pdf-extraction/Scripts/python.exe tools/extract-dnd2024-srd.py

The official PDF belongs in .reference-cache/srd-5.2.1.pdf; its digest is pinned
below. Output goes to .reference-cache/srd-5.2.1-sections.json, which the 2024
builder reads. Headings are recognised by the PDF's heading typeface, so each
section keeps the source wording of one rule in reading order.
"""
import collections
import hashlib
import json
import re
from pathlib import Path

import pdfplumber

ROOT = Path(__file__).resolve().parents[1]
PDF = ROOT / '.reference-cache/srd-5.2.1.pdf'
OUT = ROOT / '.reference-cache/srd-5.2.1-sections.json'
SHA256 = '8974902d109d6e63672d7c490bde9ccf052410503d9cfa768237154fbc5e3d87'
URL = 'https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf'
COLUMN_SPLIT = 306
TOP, BOTTOM = 30, 750

if hashlib.sha256(PDF.read_bytes()).hexdigest() != SHA256:
    raise ValueError('The PDF does not match the pinned official SRD 5.2.1 edition.')


def clean(value):
    value = value.replace('\u00ad', '')
    # Rejoin words the PDF hyphenates at line ends ("Mar- tial" -> "Martial").
    value = re.sub(r'(?<=[a-z])- (?=[a-z])', '', value)
    return re.sub(r'[ \t]+', ' ', value).strip()


def kind_of(font, size):
    if 'GillSans-SemiBold' in font or 'GillSans-Bold' in font:
        if size >= 17:
            return 'h1'
        if size >= 13.5:
            return 'h2'
        if size >= 11.5:
            return 'h3'
        return 'label'
    if font.startswith('Optima'):
        return 'statblock'
    if font.startswith('GillSans'):
        return 'table'
    return 'body'


def baseline(char):
    # The text matrix holds the true baseline. pdfplumber's top/bottom come from the
    # font's declared descent, which is wrong for this PDF's Cambria subset and puts
    # body lines below a following heading (SRD p. 48, "Level 1: Weapon Mastery").
    return char['page_height'] - char['matrix'][5]


def column_lines(page, left):
    low, high = (0, COLUMN_SPLIT) if left else (COLUMN_SPLIT, page.width)
    chars = [
        dict(c, page_height=page.height) for c in page.chars
        # Rotated chars belong to sidebars and table art, not prose.
        if c.get('upright', True) and low <= c['x0'] < high and TOP <= page.height - c['matrix'][5] <= BOTTOM
    ]
    chars.sort(key=lambda c: (round(baseline(c), 1), c['x0']))
    lines = []
    for char in chars:
        if lines and abs(baseline(char) - baseline(lines[-1][0])) <= 2:
            lines[-1].append(char)
        else:
            lines.append([char])
    for line in lines:
        line.sort(key=lambda c: c['x0'])
    # The column's usual left edge; paragraph openings sit about 8 pt inside it.
    edge = collections.Counter(round(line[0]['x0']) for line in lines).most_common(1)[0][0] if lines else low
    for line in lines:
        # Indented openings start with a space glyph at the column edge.
        if line[0]['text'] == ' ' and len(line) > 1:
            line = line[1:]
        # Small-caps headings ("Acid Splash", p. 107) set capitals at full size and the
        # other letters as smaller capitals; read them by their full size, lowercased.
        small_caps = any('-SC' in c['fontname'] for c in line)
        largest = max(c['size'] for c in line)
        text = ''
        for previous, char in zip([None] + line, line):
            if previous and char['x0'] - previous['x1'] > 0.15 * char['size'] and not text.endswith(' '):
                text += ' '
            text += char['text'].lower() if small_caps and char['size'] < largest - 1 else char['text']
        font, size = collections.Counter((c['fontname'].split('+')[-1], round(c['size'], 1)) for c in line).most_common(1)[0][0]
        if small_caps:
            font, size = font.replace('-SC700', ''), round(largest, 1)
        yield {'kind': kind_of(font, size), 'indent': line[0]['x0'] - edge > 5, 'text': text, 'baseline': baseline(line[0]), 'size': size}


sections = []
current = None
with pdfplumber.open(PDF) as document:
    for number, page in enumerate(document.pages, 1):
        for left in (True, False):
            for line in column_lines(page, left):
                text = line['text'].strip()
                if not text or re.fullmatch(r'\d+|System Reference Document 5\.2\.1', text):
                    continue
                if line['kind'] in ('h1', 'h2', 'h3'):
                    # A heading that wraps continues the previous heading line.
                    if current and current['level'] == line['kind'] and not current['lines'] and not current['table'] and current.get('column') == left and 0 < line['baseline'] - current['baseline'] <= line['size'] * 1.6:
                        current['title'] = clean(current['title'] + ' ' + text)
                        current['baseline'] = line['baseline']
                        continue
                    current = {'title': text, 'level': line['kind'], 'page': number, 'lines': [], 'table': [], 'column': left, 'baseline': line['baseline']}
                    sections.append(current)
                elif current and line['kind'] in ('table', 'label'):
                    # Table cells and sidebar labels interleave across columns; keep them
                    # out of the prose so they can't land inside a neighbouring section.
                    current['table'].append(text)
                elif current:
                    # Indented body lines start a new paragraph in the source layout.
                    # Indented lines open a paragraph only after a finished sentence; inset
                    # option blocks (Forest Gnome, p. 85) indent every line.
                    finished = bool(current['lines']) and re.search(r'[.:!?”)]$', current['lines'][-1].rstrip())
                    current['lines'].append(('\n' if line['indent'] and line['kind'] == 'body' and finished else '') + text)

result = []
for section in sections:
    text = clean(' '.join(section['lines']).replace(' \n', '\n'))
    text = '\n'.join(clean(part) for part in text.split('\n'))
    entry = {'title': clean(section['title']), 'level': section['level'], 'page': section['page'], 'text': text}
    if section['table']:
        entry['table'] = clean(' '.join(section['table']))
    result.append(entry)

# Equipment tables span both columns, so their rows are read across the full page width.
COST = re.compile(r' (?:—|[\d,]+ (?:GP|SP|CP))$')
equipment = []
with pdfplumber.open(PDF) as document:
    for number in range(91, 100):
        for row in document.pages[number - 1].extract_text().split('\n'):
            if COST.search(row):
                equipment.append({'page': number, 'row': row})

OUT.write_text(json.dumps({'source': URL, 'sha256': SHA256, 'sections': result, 'equipment': equipment}, ensure_ascii=False, indent=1), encoding='utf8')
print(f'{len(result)} sections written to {OUT.relative_to(ROOT)}')
