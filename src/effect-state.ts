import type { Character } from '@/src/model/Character.js';
import type { FeatureDefinition } from '@/src/model/FeatureDefinition.js';
import { RuleError } from '@/src/expression.js';

export const effectPath = (id: string): string => `effect/${encodeURIComponent(id)}`;

export function checkEffectDefinitions(
  character: Character,
  getFeature: (id: string) => FeatureDefinition | undefined,
): void {
  const groups = new Map<string, string[]>();
  for (const effect of character.effects ?? []) {
    const definition = getFeature(effect.feature);
    if (!definition?.effect || definition.revision !== effect.revision)
      throw new RuleError('EFFECT_DEFINITION', 'Effect definition or revision is unavailable.');
    const policy = definition.effect;
    if (
      !!effect.remaining !== !!policy.duration
      || (effect.remaining
        && policy.duration
        && (effect.remaining.clock !== policy.duration.clock
          || effect.remaining.amount > policy.duration.amount))
    )
      throw new RuleError('EFFECT_DEFINITION', 'Effect duration does not match its definition.');
    const key = policy.stacking?.key ?? effect.feature;
    const modes = [...(groups.get(key) ?? []), policy.stacking?.mode ?? 'reject'];
    groups.set(key, modes);
    if (modes.length > 1 && modes.some((mode) => mode !== 'stack'))
      throw new RuleError('EFFECT_STACKING', 'Conflicting effects share a nonstacking group.');
  }
}
