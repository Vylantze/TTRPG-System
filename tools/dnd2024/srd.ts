import { readFileSync } from 'node:fs';

/** One headed SRD 5.2.1 section from tools/extract-dnd2024-srd.py. */
interface Section {
  title: string;
  level: 'h1' | 'h2' | 'h3';
  page: number;
  text: string;
  /** Table cells and sidebar labels, kept apart from the prose. */
  table?: string;
}

const PDF = 'https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf';
const cache = new URL('../../.reference-cache/srd-5.2.1-sections.json', import.meta.url);
const sections: Section[] = JSON.parse(readFileSync(cache, 'utf8')).sections;

export const PREFIX = 'dnd5e:2024:';
export const id = (local: string) => PREFIX + local;
export const source = (page: number) => `SRD 5.2.1 p. ${page} (CC BY 4.0), ${PDF}#page=${page}`;

/**
 * Find a section by its exact heading. Headings repeat across chapters
 * ("Druid" is a class and a monster), so callers narrow by page range.
 */
export function section(title: string, pages: [number, number] = [1, 364]): Section {
  const found = sections.filter((entry) => entry.title === title && entry.page >= pages[0] && entry.page <= pages[1]);
  if (found.length !== 1) throw new Error(`SRD section "${title}" (pp. ${pages.join('–')}) matched ${found.length} times.`);
  return found[0];
}

/** A section whose heading starts with a name, for headings that add a price such as "(50 GP)". */
export function sectionStarting(name: string, pages: [number, number]): Section {
  const found = sections.filter((entry) => (entry.title === name || entry.title.startsWith(`${name} (`)) && entry.page >= pages[0] && entry.page <= pages[1]);
  if (found.length !== 1) throw new Error(`SRD section starting "${name}" (pp. ${pages.join('–')}) matched ${found.length} times.`);
  return found[0];
}

/** Section text with its page, for Feature descriptions. */
export function quote(title: string, pages?: [number, number]) {
  const entry = section(title, pages);
  return { description: entry.text, source: source(entry.page) };
}

/** Sections between two headings, for chapters whose entries are all one level. */
export function entries(level: Section['level'], pages: [number, number]): Section[] {
  return sections.filter((entry) => entry.level === level && entry.page >= pages[0] && entry.page <= pages[1]);
}

export const slug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/** Sections from a class heading to the next chapter heading, in reading order. */
export function classSections(name: string): Section[] {
  const start = sections.findIndex((entry) => entry.level === 'h1' && entry.page < 83 && (entry.title === name || entry.title.endsWith(` ${name}`)));
  if (start < 0) throw new Error(`Missing SRD class heading ${name}.`);
  const end = sections.findIndex((entry, index) => index > start && entry.level === 'h1');
  return sections.slice(start, end);
}

/** One heading within a class chapter. */
export function inClass(name: string, title: string): Section {
  const found = classSections(name).filter((entry) => entry.title === title);
  if (found.length !== 1) throw new Error(`SRD ${name} section "${title}" matched ${found.length} times.`);
  return found[0];
}
