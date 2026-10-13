import { useState } from 'react';
import type { Choice, Engine } from '@/src/index';
import { FeatureLink } from '@/ui/src/features/catalogue/components/FeatureLink';
import { FeatureRequirements } from '@/ui/src/features/catalogue/components/FeatureRequirements';
import { FeatureRules } from '@/ui/src/features/catalogue/components/RulesText';
import { featureName } from '@/ui/src/features/catalogue/model/display';
import { labelFromId } from '@/ui/src/lib/workspace';

const pageSize = 12;

export function FeatureSelectionContent({ choice, engine, openFeature }: { choice: Choice; engine: Engine; openFeature: (id: string) => void }) {
  const [page, setPage] = useState(0);
  const options = engine.getSelectionFeatures(choice);
  const lastPage = Math.max(0, Math.ceil(options.length / pageSize) - 1);
  const currentPage = Math.min(page, lastPage);
  return (
    <section className="feature-selection-content">
      <h3>{labelFromId(choice.id)}</h3>
      <p className="muted small">
        {options.length}
        {' options. Character requirements still apply.'}
      </p>
      {options.slice(currentPage * pageSize, (currentPage + 1) * pageSize).map((option) => (
        <section className="feature-content-entry" key={option.id}>
          <h4><FeatureLink id={option.id} engine={engine}>{featureName(option)}</FeatureLink></h4>
          <FeatureRequirements feature={option} engine={engine} compact />
          <FeatureRules feature={option} engine={engine} openFeature={openFeature} />
        </section>
      ))}
      {options.length > pageSize && (
        <nav className="row feature-content-pagination" aria-label={`${labelFromId(choice.id)} options pages`}>
          <button disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous options</button>
          <span>{`Page ${currentPage + 1} of ${lastPage + 1}`}</span>
          <button disabled={currentPage === lastPage} onClick={() => setPage(currentPage + 1)}>Next options</button>
        </nav>
      )}
    </section>
  );
}
