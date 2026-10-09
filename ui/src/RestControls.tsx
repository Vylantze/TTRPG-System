import { useState } from 'react';
import { recoverResources, type Character, type Engine, type EvaluationResult } from '@/src/index';
import { Modal } from '@/ui/src/Modal';
import { labelFromId } from '@/ui/src/workspace';

export function RestControls({ engine, character, result, update, report }: { engine: Engine; character: Character; result: EvaluationResult; update: (character: Character) => void; report: (message: string) => void }) {
  const [event, setEvent] = useState<string>();
  const [allocation, setAllocation] = useState<Record<string, number>>({});
  const ready = character.buildState !== 'draft' && result.status === 'valid';
  const events = [...new Set([...(engine.catalogue.system.recoveryEvents ?? []), ...Object.values(result.resources).flatMap((pool) => pool.recovery.map((rule) => rule.event)), ...Object.keys(engine.catalogue.system.recoveryAllocations ?? {}), ...(engine.catalogue.system.commandRules?.selectedRecovery ? [engine.catalogue.system.commandRules.selectedRecovery.requiredEvent] : [])])];
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
      <div className="toolbar rest-controls">
        {events.map((name) => (
          <button
            className="quiet"
            key={name}
            disabled={!ready}
            onClick={() => {
              const rule = engine.catalogue.system.recoveryAllocations?.[name];
              if (!rule || !Object.values(result.resources).some((pool) => rule.keys.includes(pool.key) && pool.spent > 0)) return recover(name);
              let remaining = result.stats[rule.budgetStat].value;
              const defaults: Record<string, number> = {};
              for (const key of rule.keys) {
                const pool = Object.values(result.resources).find((pool) => pool.key === key);
                defaults[key] = Math.min(remaining, pool?.spent ?? 0);
                remaining -= defaults[key];
              }
              setAllocation(defaults);
              setEvent(name);
            }}
          >
            {labelFromId(name)}
          </button>
        ))}
      </div>
      {event && policy && (
        <Modal title={`Complete ${labelFromId(event)}`} onClose={() => setEvent(undefined)}>
          <p>{`Recover up to ${result.stats[policy.budgetStat].value} spent resource units in total. Other resources recover normally.`}</p>
          {pools.map((pool) => (
            <label key={pool.id}>
              {pool.name}
              <input type="number" min="0" max={pool.spent} step="1" value={allocation[pool.key] ?? 0} onChange={(e) => setAllocation({ ...allocation, [pool.key]: Number(e.target.value) })} />
            </label>
          ))}
          <button disabled={Object.values(allocation).some((amount) => !Number.isInteger(amount) || amount < 0) || Object.values(allocation).reduce((a, b) => a + b, 0) > result.stats[policy.budgetStat].value} onClick={() => recover(event, allocation)}>Complete rest</button>
        </Modal>
      )}
    </>
  );
}
