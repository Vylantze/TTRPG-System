import { useContext, useState } from 'react';
import { spellGroups, featureRollExpression, featureRollInstances, rollCapability, rollFeature, applyFeatureRoll, type Engine, type FeatureDefinition } from '@/src/index';
import { CharacterRuleContext } from '@/ui/src/character-rule-context';
import { Tooltip } from '@/ui/src/Tooltip';

export function FeatureRolls({ feature, engine, instanceId, castingCapability, resultsOnly = false }: { feature: FeatureDefinition; engine: Engine; instanceId?: string; castingCapability?: string; resultsOnly?: boolean }) {
  const context = useContext(CharacterRuleContext);
  const [selectedModes, setSelectedModes] = useState<Record<string, string>>({});
  if (!context) return null;
  const { character, result, update, report } = context;
  const instances = featureRollInstances(engine, result, feature.id, instanceId);
  const ready = character.buildState !== 'draft' && result.status === 'valid';
  const attempt = (action: () => void) => {
    try {
      action();
    } catch (error) {
      report(error instanceof Error ? error.message : String(error));
    }
  };
  return (
    <div className="feature-rolls">
      {instances.map((instance) => {
        const roll = engine.getFeature(instance.feature)!.roll!;
        const modes = roll.spell ? spellGroups(engine, result).filter((group) => group.feature === roll.spell).flatMap((group) => group.modes) : [];
        const selectedMode = castingCapability ?? selectedModes[instance.id] ?? modes.find((mode) => mode.available)?.capability.id;
        const mode = modes.find((option) => option.capability.id === selectedMode);
        const capability = mode?.capability ?? rollCapability(engine, result, instance.id);
        const affordable = roll.spell ? Boolean(mode?.available) : !roll.capability || Boolean(capability && Object.entries(capability.costs).every(([pool, cost]) => (result.resources[pool]?.available ?? 0) >= cost));
        const records = character.rollResults?.filter((record) => record.instance === instance.id) ?? [];
        return (
          <section className="roll-control" key={instance.id}>
            {!resultsOnly && roll.spell && !castingCapability && (
              <label>
                Cast using
                <select aria-label={`Casting option for ${roll.label}`} value={selectedMode ?? ''} onChange={(event) => setSelectedModes({ ...selectedModes, [instance.id]: event.target.value })}>
                  <option value="" disabled>Select casting option</option>
                  {modes.map((option) => <option key={option.capability.id} value={option.capability.id} disabled={!option.available}>{`${option.capability.definition.name}${option.ritual ? ' · Ritual' : option.slotLevel ? ` · Level ${option.slotLevel} slot` : ' · Cantrip'}${option.available ? '' : ' · none remaining'}`}</option>)}
                </select>
              </label>
            )}
            {!resultsOnly && (
              <div className="toolbar">
                <button
                  className="quiet"
                  disabled={!ready || !affordable}
                  onClick={() => attempt(() => {
                    if (roll.spell && selectedMode) setSelectedModes({ ...selectedModes, [instance.id]: selectedMode });
                    update(rollFeature(engine, character, instance.id, crypto.randomUUID(), undefined, roll.spell ? selectedMode : undefined).character);
                  })}
                >
                  {`Roll ${featureRollExpression(roll, character, result)}`}
                </button>
                <small>{roll.spell ? `${roll.label} · spends the selected casting cost when rolled` : roll.capability ? `${roll.label} · spends the ability use when rolled` : `${roll.label} · reference dice only`}</small>
              </div>
            )}
            {records.map((record) => (
              <div className="toolbar roll-result" key={record.id}>
                <Tooltip text={record.breakdown}><output aria-live="polite" aria-label={`Result of ${record.expression}`}>{record.total}</output></Tooltip>
                {(roll.restoreResource || record.casting) && <button className="quiet" disabled={!ready || record.applied !== undefined} onClick={() => attempt(() => update(applyFeatureRoll(engine, character, record.id, crypto.randomUUID()).character))}>{record.applied === undefined ? roll.restoreResource ? 'Apply healing' : 'Mark applied' : 'Applied'}</button>}
                {record.casting && <small>{record.casting.ritual ? 'Ritual · no slot spent' : record.casting.slotLevel ? `Level ${record.casting.slotLevel} slot spent` : 'Cantrip · no slot spent'}</small>}
                {record.applied !== undefined && roll.restoreResource && <small>{`Restored ${record.applied} HP`}</small>}
                {record.casting && !roll.restoreResource && <small>Apply to targets manually, then mark applied.</small>}
              </div>
            ))}
          </section>
        );
      })}
    </div>
  );
}
