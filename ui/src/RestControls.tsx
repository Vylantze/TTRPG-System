import { useState } from 'react';
import { recoverResources, type Character, type Engine, type EvaluationResult } from '@/src/index';
import { Modal } from '@/ui/src/Modal';
import { labelFromId } from '@/ui/src/workspace';
import { FeatureRolls } from '@/ui/src/FeatureRolls';
import { expressionText } from '@/ui/src/feature-requirements';

export function RestControls({ engine, character, result, update, report }: { engine: Engine; character: Character; result: EvaluationResult; update: (character: Character) => void; report: (message: string) => void }) {
  const [event, setEvent] = useState<string>();
  const [allocation, setAllocation] = useState<Record<string, number>>({});
  const ready = character.buildState !== 'draft' && result.status === 'valid';
  const events = [...new Set([...(engine.catalogue.system.recoveryEvents ?? []), ...Object.values(result.resources).flatMap((pool) => pool.recovery.map((rule) => rule.event)), ...Object.keys(engine.catalogue.system.recoveryAllocations ?? {}), ...(engine.catalogue.system.commandRules?.selectedRecovery ? [engine.catalogue.system.commandRules.selectedRecovery.requiredEvent] : [])])];
  const conditions = engine.catalogue.system.resetConditions;
  const buttons = conditions?.filter((condition) => condition.showButton !== false).map((condition) => ({ event: condition.id, label: condition.name })) ?? engine.catalogue.system.resetButtons ?? events.map((name) => ({ event: name, label: labelFromId(name) }));
  const eventLabel = (name: string) => buttons.find((button) => button.event === name)?.label ?? labelFromId(name);
  const recover = (name: string, counts?: Record<string, number>) => {
    try {
      update(recoverResources(engine, character, name, crypto.randomUUID(), counts));
      setEvent(undefined);
    } catch (error) {
      report(error instanceof Error ? error.message : String(error));
    }
  };
  const policy = event ? engine.catalogue.system.recoveryAllocations?.[event] : undefined;
  const pools = policy ? Object.values(result.resources).filter((pool) => policy.keys.includes(pool.key) && pool.spent > 0) : [];
  return (
    <>
      <div className="toolbar rest-controls" role="group" aria-label="Character resets">
        {buttons.map(({ event: name, label }) => (
          <button
            className="quiet"
            key={name}
            title={conditions?.find((condition) => condition.id === name)?.description}
            disabled={!ready}
            onClick={() => {
              const rule = engine.catalogue.system.recoveryAllocations?.[name];
              if (!engine.catalogue.system.sheetDisplay?.restPreview && (!rule || !Object.values(result.resources).some((pool) => rule.keys.includes(pool.key) && pool.spent > 0))) return recover(name);
              let remaining = rule ? result.stats[rule.budgetStat].value : 0;
              const defaults: Record<string, number> = {};
              for (const key of rule?.keys ?? []) {
                const pool = Object.values(result.resources).find((pool) => pool.key === key);
                defaults[key] = Math.min(remaining, pool?.spent ?? 0);
                remaining -= defaults[key];
              }
              setAllocation(defaults);
              setEvent(name);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {event && (
        <Modal title={`Complete ${eventLabel(event)}`} onClose={() => setEvent(undefined)}>
          <h3>Recovery preview</h3>
          <ul>{Object.values(result.resources).filter((pool) => pool.recovery.some((recovery) => recovery.event === event) || policy?.keys.includes(pool.key) || engine.catalogue.system.healthRules?.clearOnReset?.[event]?.includes(pool.key)).map((pool) => <li key={pool.id}>{`${pool.name ?? labelFromId(pool.key)} · ${pool.current ?? pool.capacity - pool.spent} / ${Number.isFinite(pool.capacity) ? pool.capacity : 'no maximum'} · ${engine.catalogue.system.healthRules?.clearOnReset?.[event]?.includes(pool.key) ? 'clear to minimum' : policy?.keys.includes(pool.key) ? `recover ${allocation[pool.key] ?? 0}` : pool.recovery.filter((rule) => rule.event === event).map((rule) => rule.amount === 'full' ? 'restore to maximum' : `recover ${rule.dice ? `${rule.dice} + ` : ''}${expressionText(rule.amount, engine)}`).join(' · ')}`}</li>)}</ul>
          {policy && <p>{`Recover up to ${result.stats[policy.budgetStat].value} spent resource units in total. Other resources recover normally.`}</p>}
          {engine.catalogue.system.healingFeaturesTag && (
            <details>
              <summary>Hit dice and rest healing</summary>
              {[...new Set(result.instances.filter((instance) => instance.active && instance.eligible && engine.getFeature(instance.feature)?.tags?.includes(engine.catalogue.system.healingFeaturesTag!)).map((instance) => instance.feature))].map((id) => <FeatureRolls key={id} feature={engine.getFeature(id)!} engine={engine} />)}
            </details>
          )}
          {pools.map((pool) => (
            <label key={pool.id}>
              {pool.name}
              <input type="number" min="0" max={pool.spent} step="1" value={allocation[pool.key] ?? 0} onChange={(e) => setAllocation({ ...allocation, [pool.key]: Number(e.target.value) })} />
            </label>
          ))}
          <button disabled={!!policy && (Object.values(allocation).some((amount) => !Number.isInteger(amount) || amount < 0) || Object.values(allocation).reduce((a, b) => a + b, 0) > result.stats[policy.budgetStat].value)} onClick={() => recover(event, policy ? allocation : undefined)}>{`Complete ${eventLabel(event)}`}</button>
        </Modal>
      )}
    </>
  );
}
