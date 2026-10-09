import type { Engine, FeatureDefinition } from '../../src/index';
import { advancementLabels, predicateText } from './feature-requirements';

export function FeatureRequirements ({feature,engine,compact = false}:{feature:FeatureDefinition;engine:Engine;compact?:boolean}) {
  const advancement = advancementLabels(feature,engine);
  return <section className="feature-requirements" aria-label="Feature requirements">
    {!compact && (advancement.length > 0 || feature.contentLevel !== undefined || feature.prerequisites || feature.maintenance) && <h3>Levels &amp; requirements</h3>}
    {advancement.length > 0 && <p><strong>Class progression:</strong> {advancement.join(' · ')}. {!compact && 'Granted or offered as a selection at these levels; other requirements still apply.'}</p>}
    {feature.contentLevel !== undefined && <p><strong>Content level:</strong> {feature.contentLevel}. {!compact && 'Used by selection filters; this is separate from character and class level.'}</p>}
    {feature.prerequisites && <div className="requirement-text"><strong>Acquisition requirements:</strong><p>{predicateText(feature.prerequisites,engine)}</p></div>}
    {!compact && feature.maintenance && <div className="requirement-text"><strong>Requirements after acquisition:</strong><p>{predicateText(feature.maintenance,engine)}</p></div>}
  </section>;
}
