import type { ClassSpec } from './common.ts';
import { byLevel, fightingStyle, full, pool, steps, weaponMastery } from './common.ts';
import { id } from '../srd.ts';

/** Fighter, SRD 5.2.1 pp. 47–49, with the Champion subclass. */
export const fighter: ClassSpec = {
  name: 'Fighter',
  pages: [47, 49],
  die: 10,
  saves: ['strength', 'constitution'],
  skills: { count: 2, from: ['Acrobatics', 'Animal Handling', 'Athletics', 'History', 'Insight', 'Intimidation', 'Persuasion', 'Perception', 'Survival'] },
  weapons: { simple: true, martial: true },
  armor: ['light', 'medium', 'heavy', 'shield'],
  multiclass: {
    prerequisites: { any: [{ stat: 'strength', minimum: 13 }, { stat: 'dexterity', minimum: 13 }] },
    armor: ['light', 'medium', 'shield'],
    martial: true,
  },
  improvements: [4, 6, 8, 12, 14, 16],
  features: [
    { level: 1, name: 'Fighting Style', ...fightingStyle() },
    {
      level: 1,
      name: 'Second Wind',
      tables: { uses: steps([[1, 2], [4, 3], [10, 4]]) },
      summary: ['Uses: 2, rising to 3 at Fighter level 4 and 4 at level 10. A Short Rest restores one use; a Long Rest restores all.'],
      components: (ctx, owner) => {
        ctx.extra.push(pool(owner, 'second-wind', 'Second Wind', byLevel('uses', owner), [{ event: 'short-rest', amount: 1 }, full('long-rest')]), {
          id: `${owner}.roll`,
          revision: 1,
          name: 'Second Wind healing',
          displayName: 'Second Wind healing',
          textReferences: [owner],
          tags: ['roll-feature'],
          repeat: { maximum: 1, scope: 'parent' },
          roll: { id: 'healing', label: 'Second Wind healing', dice: '1d10', bonus: { class: id('fighter') }, capability: 'Second Wind', restoreResource: 'hit-points' },
          components: [],
        });
        return [
          { id: 'pool', kind: 'grantFeature', feature: id('resource.second-wind') },
          { id: 'second-wind', kind: 'grantCapability', name: 'Second Wind', action: { kind: 'bonus-action', amount: 1 }, costs: [{ key: 'second-wind', amount: 1 }] },
          { id: 'roll', kind: 'grantFeature', feature: `${owner}.roll` },
        ];
      },
    },
    { level: 1, name: 'Weapon Mastery', ...weaponMastery([[1, 3], [4, 4], [10, 5], [16, 6]]) },
    {
      level: 2,
      name: 'Action Surge',
      tables: { uses: steps([[2, 1], [17, 2]]) },
      components: (ctx, owner) => {
        ctx.extra.push(pool(owner, 'action-surge', 'Action Surge', byLevel('uses', owner), [full('short-rest'), full('long-rest')]));
        return [
          { id: 'pool', kind: 'grantFeature', feature: id('resource.action-surge') },
          { id: 'action-surge', kind: 'grantCapability', name: 'Action Surge', costs: [{ key: 'action-surge', amount: 1 }], description: 'Take one additional action (not the Magic action); at most once per turn.' },
        ];
      },
    },
    {
      level: 2,
      name: 'Tactical Mind',
      summary: ['Spends a Second Wind use only when the boosted check succeeds.'],
      components: () => [
        { id: 'tactical-mind', kind: 'grantCapability', name: 'Tactical Mind', costs: [{ key: 'second-wind', amount: 1 }], spendOnOutcomes: ['success'], description: 'After failing an ability check, roll 1d10 and add it. The use is spent only if the check then succeeds.' },
      ],
    },
    {
      level: 5,
      name: 'Extra Attack',
      tables: { attacks: steps([[5, 2], [11, 3], [20, 4]]) },
      components: () => [{ id: 'attacks', kind: 'modifyStat', stat: 'attacksPerAction', operation: 'floor', value: byLevel('attacks') }],
    },
    { level: 5, name: 'Tactical Shift' },
    {
      level: 9,
      name: 'Indomitable',
      tables: { uses: steps([[9, 1], [13, 2], [17, 3]]) },
      components: (ctx, owner) => {
        ctx.extra.push(pool(owner, 'indomitable', 'Indomitable', byLevel('uses', owner), [full('long-rest')]));
        return [
          { id: 'pool', kind: 'grantFeature', feature: id('resource.indomitable') },
          { id: 'indomitable', kind: 'grantCapability', name: 'Indomitable', costs: [{ key: 'indomitable', amount: 1 }], description: 'Reroll a failed saving throw with a bonus equal to your Fighter level.' },
        ];
      },
    },
    { level: 9, name: 'Tactical Master' },
    { level: 11, name: 'Two Extra Attacks', components: () => [{ id: 'rules', kind: 'describe', text: 'Extra Attack now gives three attacks; the Extra Attack Feature applies this.' }] },
    { level: 13, name: 'Studied Attacks' },
    { level: 20, name: 'Three Extra Attacks', components: () => [{ id: 'rules', kind: 'describe', text: 'Extra Attack now gives four attacks; the Extra Attack Feature applies this.' }] },
  ],
  subclassLevels: [3, 7, 10, 15, 18],
  subclass: {
    name: 'Champion',
    features: [
      { level: 3, name: 'Improved Critical', components: () => [{ id: 'critical', kind: 'modifyStat', stat: 'criticalThreshold', operation: 'ceiling', value: 19 }] },
      { level: 3, name: 'Remarkable Athlete' },
      { level: 7, name: 'Additional Fighting Style', components: () => [{ id: 'style', kind: 'chooseFeatures', minimum: 1, maximum: 1, candidates: { tags: ['fighting-style-feat'] }, retraining: { allowed: false } }] },
      { level: 10, name: 'Heroic Warrior' },
      { level: 15, name: 'Superior Critical', components: () => [{ id: 'critical', kind: 'modifyStat', stat: 'criticalThreshold', operation: 'ceiling', value: 18 }] },
      { level: 18, name: 'Survivor' },
    ],
  },
};
