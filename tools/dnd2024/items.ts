import { readFileSync } from 'node:fs';
import type { ItemDefinition } from '@/src/model/ItemDefinition.js';
import type { ItemFeature } from '@/src/model/ItemFeature.js';
import { ARMOR, TOOLS } from './core.ts';
import { id, slug, source } from './srd.ts';

interface Row {
  page: number;
  row: string;
}
const rows: Row[] = JSON.parse(readFileSync(new URL('../../.reference-cache/srd-5.2.1-sections.json', import.meta.url), 'utf8')).equipment;

const WEAPON = /^(.+?) (\d+d\d+|1) (Acid|Bludgeoning|Piercing|Slashing) (.+?) (Cleave|Graze|Nick|Push|Sap|Slow|Topple|Vex) (.+? lb\.|—) (.+)$/;
const ARMOR_ROW = /^(.+?) (\d+(?: \+ Dex modifier(?: \(max 2\))?)?|\+2) (Str \d+|—) (Disadvantage|—) (.+? lb\.) (.+)$/;
const GEAR = /^(.+?) ((?:[\d/½]+|1,?\d*) lb\.(?: \(full\))?|—) ([\d,]+ (?:GP|SP|CP))$/;

/** Weapons, armor, tools and adventuring gear from the SRD 5.2.1 equipment tables (pp. 91–97). */
export function items(): { items: ItemDefinition[]; itemFeatures: ItemFeature[] } {
  const features = new Map<string, ItemFeature>();
  const list: ItemDefinition[] = [];
  const damage = (type: string) => {
    const key = `damage.${slug(type)}`;
    features.set(key, { id: key, name: `${type} damage`, properties: { 'Damage type': type } });
    return key;
  };
  for (const { page, row } of rows.filter((entry) => entry.page === 91)) {
    const match = WEAPON.exec(row);
    if (!match) continue;
    const [, name, dice, type, properties, mastery, weight, cost] = match;
    const key = `weapon.${slug(name)}`;
    features.set(key, { id: key, name, features: [damage(type)], properties: { 'Damage dice': dice, 'Properties': properties, 'Mastery': mastery, 'Weight': weight, 'Cost': cost } });
    list.push({ id: id(`item.${slug(name)}`), revision: 1, name, category: 'Weapons', features: [key], source: source(page) });
  }
  for (const { page, row } of rows.filter((entry) => entry.page === 92)) {
    const match = ARMOR_ROW.exec(row);
    if (!match) continue;
    const [, name, armorClass, strength, stealth, weight, cost] = match;
    const key = `armor.${slug(name)}`;
    const shield = name === 'Shield';
    const index = ARMOR.indexOf(name);
    if (!shield && index < 1) throw new Error(`Armor ${name} is missing from the armor table order.`);
    features.set(key, {
      id: key,
      name,
      properties: { 'Armor Class': armorClass, 'Strength': strength, 'Stealth': stealth, 'Weight': weight, 'Cost': cost },
      modifiers: [{ id: 'armor', kind: 'modifyStat', stat: shield ? 'shield' : 'armorIndex', operation: 'override', value: shield ? 1 : index }],
    });
    list.push({ id: id(`item.${slug(name)}`), revision: 1, name, category: 'Armor', features: [key], slot: shield ? 'shield' : 'armor', source: source(page) });
  }
  if (list.filter((item) => item.category === 'Weapons').length !== 38 || list.filter((item) => item.category === 'Armor').length !== 13) {
    throw new Error('The SRD weapon or armor table did not parse completely.');
  }
  for (const [name] of TOOLS) list.push({ id: id(`item.${slug(name)}`), revision: 1, name, category: 'Tools', features: [], source: source(93) });
  for (const { page, row } of rows.filter((entry) => entry.page >= 95)) {
    const match = GEAR.exec(row);
    if (!match || list.some((item) => item.name === match[1])) continue;
    const [, listed, weight, cost] = match;
    // The table lists "Clothes, Traveler’s"; starting equipment says "Traveler’s Clothes".
    const name = listed.replace(/^([^,]+), (.+)$/, '$2 $1');
    const key = `gear.${slug(name)}`;
    features.set(key, { id: key, name, properties: { Weight: weight, Cost: cost } });
    list.push({ id: id(`item.${slug(name)}`), revision: 1, name, category: 'Adventuring Gear', features: [key], source: source(page) });
  }
  // Spellcasting foci are categories with variants (pp. 96–97); the Spellbook is the
  // Wizard's own item (p. 77). Starting equipment names them generically.
  for (const [name, page] of [['Arcane Focus', 96], ['Druidic Focus', 97], ['Holy Symbol', 97], ['Spellbook', 77]] as const) {
    list.push({ id: id(`item.${slug(name)}`), revision: 1, name, category: 'Adventuring Gear', features: [], source: source(page) });
  }
  list.push({ id: id('item.arrows'), revision: 1, name: 'Arrows', category: 'Ammunition', features: [], source: source(96) });
  list.push({ id: id('item.bolts'), revision: 1, name: 'Bolts', category: 'Ammunition', features: [], source: source(96) });
  return { items: list, itemFeatures: [...features.values()] };
}
