/** Invented engine fixture; these are not official DnD5e class rules. */
const add = (...args) => ({ op: 'add', args });
export const catalogue = {
  id: 'example:catalogue', revision: 1,
  system: {
    id: 'example:system', revision: 1, name: 'Example System', allowMultipleClasses: true,
    characterLevel: { context: 'totalClassLevels' }, contextDefaults: { guarded: false },
    stats: [
      { id: 'agility', name: 'Agility', kind: 'input', default: 2, integer: true },
      { id: 'insight', name: 'Insight', kind: 'input', default: 1, integer: true },
      { id: 'rank', name: 'Defense training', kind: 'input', default: 0, integer: true },
      { id: 'defense', name: 'Defense', kind: 'derived', expression: add(10, { stat: 'agility' }, { stat: 'rank' }) },
    ],
  },
  classes: [{ id: 'example:adventurer', revision: 1, name: 'Adventurer', levels: {
    1: [
      { id: 'training', kind: 'grantFeature', feature: 'example:training' },
      { id: 'technique', kind: 'chooseFeatures', minimum: 1, maximum: 1, candidates: { tags: ['technique'], maximumLevel: { context: 'acquiredClassLevel' } }, retraining: { allowed: true } },
      { id: 'talent', kind: 'chooseFeatures', minimum: 0, maximum: 1, candidates: { ids: ['example:agile'] }, retraining: { allowed: true } },
    ],
    2: [{ id: 'energy', kind: 'grantFeature', feature: 'example:energy-package' }],
    3: [{ id: 'upgrade', kind: 'grantFeature', feature: 'example:expert' }],
  } }],
  features: [
    { id: 'example:training', revision: 1, name: 'Starting training', repeat: { maximum: 5, scope: 'character' }, components: [
      { id: 'defense', kind: 'modifyStat', stat: 'rank', operation: 'floor', value: 1 },
    ] },
    { id: 'example:expert', revision: 1, name: 'Expert training', repeat: { maximum: 5, scope: 'character' }, components: [
      { id: 'defense', kind: 'modifyStat', stat: 'rank', operation: 'floor', value: 2 },
    ] },
    { id: 'example:agile', revision: 1, name: 'Agile', repeat: { maximum: 5, scope: 'character' }, components: [
      { id: 'agility', kind: 'modifyStat', stat: 'agility', operation: 'add', value: 1 },
    ] },
    { id: 'example:guard', revision: 1, name: 'Guard', tags: ['technique'], contentLevel: 1, components: [
      { id: 'stance', kind: 'modifyStat', stat: 'defense', operation: 'add', value: 1, group: 'circumstance', stacking: 'bestBonusAndWorstPenalty', condition: { context: 'guarded' } },
    ] },
    { id: 'example:lore', revision: 1, name: 'Lore', tags: ['technique'], contentLevel: 1, components: [{ id: 'text', kind: 'describe', text: 'Knows old stories.' }] },
    { id: 'example:advanced', revision: 1, name: 'Advanced technique', tags: ['technique'], contentLevel: 3, components: [] },
    { id: 'example:caster', revision: 1, name: 'Caster permission', components: [] },
    { id: 'example:energy-package', revision: 1, name: 'Energy package', components: [
      // Consumer before provider intentionally checks presentation-order independence.
      { id: 'technique', kind: 'chooseFeatures', minimum: 1, maximum: 1, candidates: { ids: ['example:energy-technique'] }, ignorePrerequisites: true, retraining: { allowed: true } },
      { id: 'reserve', kind: 'grantFeature', feature: 'example:energy-reserve' },
    ] },
    { id: 'example:energy-reserve', revision: 1, name: 'Energy reserve', tables: {
      capacity: { mode: 'threshold', rows: [{ key: 0, value: 1 }, { key: 2, value: 3 }, { key: 5, value: 6 }], below: 'error', above: 'boundary' },
    }, components: [
      { id: 'pool', kind: 'defineResource', key: 'energy', scope: 'character', units: 'uses', integer: true,
        capacity: add({ table: 'capacity', input: { context: 'classLevel' } }, { stat: 'insight' }),
        recovery: [{ event: 'rest', amount: 'full' }, { event: 'pause', amount: 1 }] },
    ] },
    { id: 'example:energy-technique', revision: 1, name: 'Energy technique', prerequisites: { feature: 'example:caster' }, resources: [
      { id: 'energy', key: 'energy', scope: 'character', units: 'uses', minimumCapacity: 1 },
    ], components: [
      { id: 'pulse', kind: 'grantCapability', name: 'Energy pulse', action: { kind: 'action', amount: 1 }, costs: [{ key: 'energy', requirement: 'energy', amount: 1 }] },
      { id: 'test', kind: 'grantCapability', name: 'Attempt', costs: [{ key: 'energy', requirement: 'energy', amount: 1 }], spendOnOutcomes: ['success'] },
    ] },
  ],
};
