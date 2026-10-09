import { useContext, useState } from 'react';
import { featureRollExpression, rollDice, rollFeature, type Engine, type FeatureDefinition } from '@/src/index';
import { CharacterRuleContext } from '@/ui/src/character-rule-context';
import { resolvedRuleText } from '@/ui/src/personalized-rules';
import { descriptionBody } from '@/ui/src/feature-description';
import { Tooltip } from '@/ui/src/Tooltip';

export function FeatureRolls({ feature, engine }: { feature: FeatureDefinition; engine: Engine }) {
  const context = useContext(CharacterRuleContext);
  const [outcomes, setOutcomes] = useState<Record<string, { total: number; breakdown: string; applied?: number }>>({});
  if (!context) return null;
  const { character, result, update, report } = context;
  const instance = result.instances.find((item) => item.feature === feature.id && item.active);
  const configured = feature.rolls ?? [];
  const source = resolvedRuleText(descriptionBody(feature) ?? '', engine, character, result).replace(/\bplus\b/gi, '+').replace(/\bminus\b/gi, '-').replace(/\bd(?=\d)/gi, '1d');
  const expressions = [...new Set(source.match(/\b\d+d\d+(?:\s*[+−-]\s*-?\d+(?:d\d+)?)*\b/gi) ?? [])];
  const affordable = (id: string) => {
    const roll = configured.find((item) => item.id === id);
    const capability = result.capabilities.find((item) => item.source === instance?.id && item.definition.name === roll?.capability);
    return !roll?.capability || Boolean(capability && Object.entries(capability.costs).every(([pool, cost]) => (result.resources[pool]?.available ?? 0) >= cost));
  };
  const choices = [
    ...configured.map((roll) => ({ id: roll.id, label: roll.label, expression: featureRollExpression(roll, character, result), effect: true })),
    ...expressions.filter((expression) => !configured.some((roll) => featureRollExpression(roll, character, result).replace(/\s/g, '') === expression.replace(/\s/g, ''))).map((expression) => ({ id: expression, label: 'Reference roll', expression, effect: false })),
  ];
  return (
    <div className="feature-rolls">
      {choices.map((choice) => (
        <div className="toolbar" key={choice.id}>
          <button
            className="quiet"
            disabled={choice.effect && (!instance || character.buildState === 'draft' || result.status !== 'valid' || !affordable(choice.id))}
            onClick={() => {
              try {
                const outcome = choice.effect ? rollFeature(engine, character, instance!.id, choice.id, crypto.randomUUID()) : rollDice(choice.expression.replace(/−/g, '-'));
                if ('character' in outcome) update((outcome as ReturnType<typeof rollFeature>).character);
                setOutcomes({ ...outcomes, [choice.id]: outcome });
              } catch (error) { report(error instanceof Error ? error.message : String(error)); }
            }}
          >
            {`Roll ${choice.expression}${choice.effect ? ' & apply' : ''}`}
          </button>
          {outcomes[choice.id] && <Tooltip text={outcomes[choice.id].breakdown}><output aria-live="polite">{outcomes[choice.id].total}</output></Tooltip>}
          <small>{choice.effect ? `${choice.label}${outcomes[choice.id] ? ` · restored ${outcomes[choice.id].applied ?? 0} HP` : ''}` : 'Dice only; apply targets and conditional effects at the table.'}</small>
        </div>
      ))}
    </div>
  );
}
