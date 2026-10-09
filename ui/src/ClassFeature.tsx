import { FeatureLink } from '@/ui/src/FeatureLink';
import type { Engine } from '@/src/index';
import { featureName } from '@/ui/src/display';
import { FeatureRules } from '@/ui/src/RulesText';

export function ClassFeature({ id, engine, openFeature }: { id: string; engine: Engine; openFeature: (id: string) => void }) {
  const feature = engine.getFeature(id);
  if (!feature) return null;
  return (
    <section className="class-level-feature">
      <h3>
        <FeatureLink className="link" id={id} engine={engine}>
          {featureName(feature)}
          {' '}
          →
        </FeatureLink>
      </h3>
      <FeatureRules feature={feature} engine={engine} openFeature={openFeature} />
    </section>
  );
}
