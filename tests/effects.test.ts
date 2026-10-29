import test from 'node:test';
import assert from 'node:assert/strict';
import {
  Engine,
  applyEffect,
  removeEffects,
  advanceEffects,
  matchingEffects,
  useEffectAbility,
  adjustResource,
  serializeCharacter,
  deserializeCharacter,
  applyEdit,
} from '@/dist/index.js';
import type { Catalogue, FeatureDefinition, EffectPolicy, Character } from '@/dist/index.js';

function feature(
  id: string,
  components: FeatureDefinition['components'] = [],
  effect?: EffectPolicy,
): FeatureDefinition {
  return { id, revision: 1, name: id, components, ...(effect ? { effect } : {}) };
}
function speed(
  id: string,
  amount: number,
  policy: EffectPolicy = { tags: ['magical', 'spell'] },
): FeatureDefinition {
  return feature(
    id,
    [{ kind: 'modifyStat', id: 'speed', stat: 'speed', operation: 'add', value: amount }],
    policy,
  );
}
function engine(features: FeatureDefinition[]): Engine {
  const catalogue: Catalogue = {
    id: 'effects',
    revision: 1,
    classes: [],
    features,
    system: {
      id: 'effects',
      revision: 1,
      name: 'Effects',
      allowMultipleClasses: true,
      characterLevel: { context: 'totalClassLevels' },
      stats: [{ id: 'speed', name: 'Speed', kind: 'input', default: 30 }],
    },
  };
  return new Engine(catalogue);
}
const source = { character: 'caster', application: 'casting' };
const request = (id: string, definition = 'buff') => ({ id, feature: definition, source });
const removal = { kind: 'removeEffects' as const, tags: { all: ['spell'] } };
const value = (rules: Engine, character: Character) => rules.evaluate(character).stats.speed.value;

test('permanent effects and nested modifiers reuse Features without turning owned Features into effects', () => {
  const rules = engine([
    speed('mobile', 10),
    speed('child', 5),
    feature('buff', [{ kind: 'grantFeature', id: 'child', feature: 'child' }], { tags: ['spell'] }),
  ]);
  const base = rules.createCharacter(
    'hero',
    'Hero',
    [],
    [{ id: 'mobile', feature: 'mobile', acquiredCharacterLevel: 0 }],
  );
  const applied = applyEffect(rules, base, request('a'), 'apply');
  assert.equal(value(rules, applied), 45);
  assert.equal(base.effects, undefined);
  assert.equal(applied.effects?.[0].remaining, undefined);
  assert.equal(rules.evaluate(applied).instances.filter((entry) => entry.effect === 'a').length, 2);
  assert.deepEqual(
    matchingEffects(rules, applied, { all: ['spell'] }).map((effect) => effect.id),
    ['a'],
  );
  const ended = removeEffects(rules, applied, removal, 'remove');
  assert.equal(value(rules, ended), 40);
  assert.equal(ended.roots.length, 1);
});

test('effect and command IDs prevent duplicate applications and survive serialization', () => {
  const rules = engine([speed('buff', 10)]);
  const applied = applyEffect(rules, rules.createCharacter('hero', 'Hero'), request('a'), 'apply');
  assert.deepEqual(applyEffect(rules, applied, request('a'), 'apply'), applied);
  assert.throws(() => applyEffect(rules, applied, request('b'), 'apply'), /different data/);
  const loaded = deserializeCharacter(serializeCharacter(applied), rules);
  assert.equal(value(rules, loaded), 40);
  const ended = removeEffects(rules, loaded, removal, 'remove');
  assert.throws(() => applyEffect(rules, ended, request('a'), 'another'), /cannot be reused/);
});

test('game-clock expiry is idempotent and does not affect permanent effects', () => {
  const rules = engine([
    speed('buff', 10, { tags: ['spell'], duration: { clock: 'round', amount: 3 } }),
    speed('blessing', 5, { tags: ['blessing'] }),
  ]);
  let hero = applyEffect(rules, rules.createCharacter('hero', 'Hero'), request('a'), 'apply');
  hero = applyEffect(rules, hero, request('b', 'blessing'), 'bless');
  hero = advanceEffects(rules, hero, { clock: 'round', amount: 2 }, 'tick');
  assert.equal(hero.effects?.[0].remaining?.amount, 1);
  assert.deepEqual(advanceEffects(rules, hero, { clock: 'round', amount: 2 }, 'tick'), hero);
  hero = advanceEffects(rules, hero, { clock: 'round', amount: 1 }, 'tick2');
  assert.equal(value(rules, hero), 35);
  assert.equal(hero.effects?.length, 1);
  assert.throws(
    () => advanceEffects(rules, hero, { clock: 'round', amount: -1 }, 'bad'),
    /positive/,
  );
});

test('lifecycle events can end one source application without ending another', () => {
  const rules = engine([
    speed('buff', 10, {
      tags: ['spell'],
      endOn: ['concentration-ended'],
      stacking: { mode: 'stack' },
    }),
  ]);
  let hero = applyEffect(rules, rules.createCharacter('hero', 'Hero'), request('a'), 'apply');
  hero = applyEffect(
    rules,
    hero,
    { ...request('b'), source: { ...source, application: 'other' } },
    'apply2',
  );
  hero = advanceEffects(rules, hero, { event: 'concentration-ended', source }, 'end');
  assert.deepEqual(
    hero.effects?.map((effect) => effect.id),
    ['b'],
  );
  assert.equal(value(rules, hero), 40);
});

test('tag all/any/none filters, removal methods and explicit selection limits', () => {
  const rules = engine([
    speed('buff', 1),
    speed('curse', 2, { tags: ['curse', 'magical'], removalMethods: ['cleanse'] }),
    speed('protected', 3, { tags: ['spell', 'protected'], removalMethods: [] }),
  ]);
  let hero = rules.createCharacter('hero', 'Hero');
  for (const id of ['buff', 'curse', 'protected'])
    hero = applyEffect(rules, hero, request(id, id), `apply-${id}`);
  assert.equal(
    matchingEffects(rules, hero, { any: ['spell', 'curse'], none: ['protected'] }).length,
    1,
  );
  assert.equal(matchingEffects(rules, hero, { all: ['magical'] }, 'cleanse').length, 2);
  const operation = {
    kind: 'removeEffects' as const,
    tags: { any: ['spell', 'curse'] },
    method: 'cleanse',
    maximum: 1,
  };
  assert.throws(() => removeEffects(rules, hero, operation, 'too-many'), /Explicitly select/);
  assert.throws(
    () => removeEffects(rules, hero, operation, 'protected', ['protected']),
    /matching/,
  );
  const changed = removeEffects(rules, hero, operation, 'clean', ['curse']);
  assert.equal(changed.effects?.length, 2);
  assert.throws(() => matchingEffects(rules, hero, {}), /nonempty/);
});

test('stacking is explicit and replacement is transactional', () => {
  const rules = engine([
    speed('buff', 10),
    speed('replacement', 20, { tags: ['spell'], stacking: { key: 'buff', mode: 'replace' } }),
  ]);
  const hero = applyEffect(rules, rules.createCharacter('hero', 'Hero'), request('a'), 'apply');
  assert.throws(() => applyEffect(rules, hero, request('b'), 'again'), /already applied/);
  const replaced = applyEffect(rules, hero, request('c', 'replacement'), 'replace');
  assert.equal(replaced.effects?.length, 1);
  assert.equal(value(rules, replaced), 50);
});

test('shared resource expenditure survives provider removal and reapplication', () => {
  const tracker = feature('tracker', [
    {
      id: 'energy',
      kind: 'trackResource',
      key: 'energy',
      name: 'Energy',
      units: 'points',
      initialAmount: 3,
      maximum: 3,
      recovery: [],
    },
  ]);
  const rules = engine([
    tracker,
    feature('buff', [{ id: 'tracker', kind: 'grantFeature', feature: 'tracker' }], {
      tags: ['spell'],
      stacking: { mode: 'stack' },
    }),
  ]);
  let hero = applyEffect(rules, rules.createCharacter('hero', 'Hero'), request('a'), 'apply');
  const poolId = Object.keys(rules.evaluate(hero).resources)[0];
  hero = adjustResource(rules, hero, poolId, -2, 'spend');
  hero = applyEffect(rules, hero, request('b'), 'apply2');
  assert.equal(rules.evaluate(hero).resources[poolId].current, 1);
  hero = removeEffects(rules, hero, removal, 'remove');
  assert.deepEqual(rules.evaluate(hero).resources, {});
  hero = applyEffect(rules, hero, request('c'), 'apply3');
  assert.equal(rules.evaluate(hero).resources[poolId].current, 1);
});

test('effect bonuses cannot qualify build acquisitions', () => {
  const learned = feature('fast', [], undefined);
  learned.prerequisites = { stat: 'speed', minimum: 40 };
  const rules = engine([speed('buff', 10), learned]);
  const hero = applyEffect(rules, rules.createCharacter('hero', 'Hero'), request('a'), 'apply');
  const changed = applyEdit(
    rules,
    hero,
    [{ kind: 'root', acquisition: { id: 'fast', feature: 'fast', acquiredCharacterLevel: 0 } }],
    'learn',
  );
  assert.equal(rules.evaluate(changed).status, 'invalid');
});

test('effect ability spends once and returns both participants; failure spends nothing', () => {
  const tracker = feature('tracker', [
    {
      id: 'uses',
      kind: 'trackResource',
      key: 'uses',
      name: 'Uses',
      units: 'uses',
      maximum: 2,
      initialAmount: 2,
      recovery: [],
    },
  ]);
  const casting = feature('caster', [
    {
      id: 'cast',
      kind: 'grantCapability',
      name: 'Cast',
      costs: [{ key: 'uses', amount: 1 }],
      effects: [{ kind: 'applyEffect', feature: 'buff' }],
    },
  ]);
  const rules = engine([tracker, casting, speed('buff', 10)]);
  const actor = rules.createCharacter(
    'caster',
    'Caster',
    [],
    ['tracker', 'caster'].map((id) => ({ id, feature: id, acquiredCharacterLevel: 0 })),
  );
  const target = rules.createCharacter('hero', 'Hero');
  const ability = rules.evaluate(actor).capabilities[0].id;
  const outcome = useEffectAbility(rules, actor, target, ability, 'cast');
  assert.equal(Object.values(rules.evaluate(outcome.actor).resources)[0].current, 1);
  assert.equal(value(rules, outcome.target), 40);
  assert.deepEqual(
    useEffectAbility(rules, outcome.actor, outcome.target, ability, 'cast'),
    outcome,
  );
  assert.throws(
    () => useEffectAbility(rules, outcome.actor, outcome.target, ability, 'cast2'),
    /already applied/,
  );
  assert.equal(Object.values(rules.evaluate(outcome.actor).resources)[0].current, 1);
  assert.throws(
    () => useEffectAbility(rules, outcome.actor, target, ability, 'cast'),
    /Incomplete effect transaction/,
  );
  const self = useEffectAbility(rules, actor, actor, ability, 'self');
  assert.deepEqual(self.actor, self.target);
  assert.equal(value(rules, self.actor), 40);
});

test('malformed policies, operations and saved effect revisions fail validation', () => {
  assert.throws(
    () => engine([speed('buff', 10, { tags: ['spell'], duration: { clock: 'round', amount: 0 } })]),
    /positive/,
  );
  assert.throws(
    () =>
      engine([
        feature('caster', [
          {
            id: 'bad',
            kind: 'grantCapability',
            name: 'Bad',
            effects: [{ kind: 'applyEffect', feature: 'missing' }],
          },
        ]),
      ]),
    /effect-enabled/,
  );
  const rules = engine([speed('buff', 10)]);
  const hero = applyEffect(rules, rules.createCharacter('hero', 'Hero'), request('a'), 'apply');
  hero.effects![0].revision = 999;
  assert.throws(() => deserializeCharacter(serializeCharacter(hero), rules), /revision/);
});

test('effect-created stats disappear with the last provider and dependencies become invalid', () => {
  const provider = feature(
    'provider',
    [
      {
        kind: 'defineStat',
        id: 'stat',
        stat: { id: 'aura', name: 'Aura', kind: 'derived', expression: 5 },
      },
    ],
    { tags: ['provider'] },
  );
  const dependent = feature(
    'dependent',
    [{ kind: 'modifyStat', id: 'speed', stat: 'speed', operation: 'add', value: { stat: 'aura' } }],
    { tags: ['dependent'] },
  );
  const rules = engine([provider, dependent]);
  let hero = applyEffect(
    rules,
    rules.createCharacter('hero', 'Hero'),
    request('provider', 'provider'),
    'provider',
  );
  hero = applyEffect(rules, hero, request('dependent', 'dependent'), 'dependent');
  assert.equal(value(rules, hero), 35);
  const ended = removeEffects(
    rules,
    hero,
    { kind: 'removeEffects', tags: { all: ['provider'] } },
    'remove',
  );
  const result = rules.evaluate(ended);
  assert.equal(result.stats.aura, undefined);
  assert.equal(result.status, 'invalid');
  const repaired = removeEffects(
    rules,
    ended,
    { kind: 'removeEffects', tags: { all: ['dependent'] } },
    'repair',
  );
  assert.equal(rules.evaluate(repaired).status, 'valid');
  assert.deepEqual(
    ended.effects?.map((effect) => effect.id),
    ['dependent'],
  );
});

test('required resources and bad parameters cannot be bypassed through effect application', () => {
  const buff = speed('buff', 10);
  buff.resources = [{ id: 'energy', key: 'missing-energy' }];
  const rules = engine([buff]);
  const hero = rules.createCharacter('hero', 'Hero');
  assert.throws(() => applyEffect(rules, hero, request('a'), 'apply'), /Requires resource/);
  assert.equal(hero.effects, undefined);
  const parameterized = speed('buff', 10);
  parameterized.parameters = { amount: { kind: 'number', minimum: 1 } };
  const parameterRules = engine([parameterized]);
  const target = parameterRules.createCharacter('hero', 'Hero');
  assert.throws(
    () => applyEffect(parameterRules, target, request('a'), 'apply'),
    /Invalid parameter/,
  );
});

test('drafts and outstanding reservations block effect mutations without losing state', () => {
  const rules = engine([speed('buff', 10)]);
  const hero = rules.createCharacter('hero', 'Hero');
  const draft = { ...hero, buildState: 'draft' as const };
  assert.throws(() => applyEffect(rules, draft, request('a'), 'apply'), /Finalize/);
  const applied = applyEffect(rules, hero, request('a'), 'apply');
  applied.pending.pending = { ability: 'reserved', costs: {}, spendOnOutcomes: ['hit'] };
  assert.throws(() => removeEffects(rules, applied, removal, 'remove'), /reserved uses/);
  assert.equal(applied.effects?.length, 1);
  assert.ok(applied.pending.pending);
});

test('authored removal capabilities remove target effects without changing owned Features', () => {
  const cleanse = feature('cleanse', [
    { id: 'cleanse', kind: 'grantCapability', name: 'Cleanse', effects: [removal] },
  ]);
  const rules = engine([speed('buff', 10), cleanse]);
  const actor = rules.createCharacter(
    'caster',
    'Caster',
    [],
    [{ id: 'cleanse', feature: 'cleanse', acquiredCharacterLevel: 0 }],
  );
  let target = rules.createCharacter(
    'hero',
    'Hero',
    [],
    [{ id: 'owned', feature: 'buff', acquiredCharacterLevel: 0 }],
  );
  target = applyEffect(rules, target, request('applied'), 'apply');
  const capability = rules.evaluate(actor).capabilities[0].id;
  const result = useEffectAbility(rules, actor, target, capability, 'cleanse');
  assert.equal(result.target.effects?.length, 0);
  assert.equal(value(rules, result.target), 40);
  assert.equal(result.target.roots.length, 1);
});

test('permanent shrine blessings retain their origin and end only on the matching event', () => {
  const rules = engine([speed('buff', 5, { tags: ['blessing'], endOn: ['revoked'] })]);
  const origin = { origin: 'shrine-of-wind', application: 'blessing-one' };
  let hero = applyEffect(
    rules,
    rules.createCharacter('hero', 'Hero'),
    { ...request('a'), source: origin },
    'bless',
  );
  hero = deserializeCharacter(serializeCharacter(hero), rules);
  assert.equal(hero.effects?.[0].source.origin, 'shrine-of-wind');
  hero = advanceEffects(rules, hero, { clock: 'day', amount: 100 }, 'time');
  assert.equal(value(rules, hero), 35);
  hero = advanceEffects(rules, hero, { event: 'revoked', source: origin }, 'revoke');
  assert.equal(value(rules, hero), 30);
});
