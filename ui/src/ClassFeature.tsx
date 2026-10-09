import type { Engine } from '@/src/index';
import { featureName } from '@/ui/src/display';
import { FeatureRules } from '@/ui/src/RulesText';

export function ClassFeature({ id, engine, openFeature }: { id: string; engine: Engine; openFeature: (id: string) => void }) {
  const feature = engine.getFeature(id);
  if (!feature) return null;
  return (
    <section className="class-level-feature">
      <h3>
        <button className="link" onClick={() => openFeature(id)}>
          {featureName(feature)}
          {' '}
          →
        </button>
      </h3>
      <FeatureRules feature={feature} engine={engine} openFeature={openFeature} />
    </section>
  );
}
