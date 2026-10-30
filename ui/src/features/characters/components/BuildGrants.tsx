import type { Character, Engine, EvaluationResult } from '@/src/index';
import { useContext } from 'react';
import { FeatureTree } from '@/ui/src/components/FeatureTree';
import { CharacterRuleContext } from '@/ui/src/features/characters/model/character-rule-context';
import { instanceNodes } from '@/ui/src/features/characters/model/instance-tree';

export function BuildGrants({
  engine,
  character,
  result,
  level,
  openFeature,
}: {
  engine: Engine;
  character: Character;
  result: EvaluationResult;
  level: string;
  openFeature: (id: string) => void;
}) {
  const inSheet = useContext(CharacterRuleContext) !== undefined;
  const grants = result.instances
    .filter(
      (instance) =>
        instance.active
        && !instance.selection
        && !instance.id.startsWith('root/')
        && (level === 'all'
          || (instance.progression ? String(instance.acquiredClassLevel) : 'origins') === level),
    )
    .sort(
      (a, b) =>
        a.acquiredClassLevel - b.acquiredClassLevel
        || a.acquiredCharacterLevel - b.acquiredCharacterLevel
        || a.id.localeCompare(b.id),
    );
  const visible = new Set(grants.map((instance) => instance.id));
  const roots = grants.filter((instance) => !instance.parent || !visible.has(instance.parent));
  return (
    <section className="automatic-grants">
      <h3>Automatically granted Features</h3>
      {!grants.length && <p className="muted">No automatic Features at this level.</p>}
      <FeatureTree
        nodes={instanceNodes(roots, engine, character, result, visible, openFeature, inSheet)}
        controls={false}
      />
    </section>
  );
}
