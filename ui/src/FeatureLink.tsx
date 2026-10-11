import { useContext, type ReactNode } from 'react';
import type { Engine } from '@/src/index';
import { featureHref } from '@/ui/src/feature-description';
import { FeatureOrigin } from '@/ui/src/feature-origin';
import { CharacterRuleContext } from '@/ui/src/character-rule-context';

export function FeatureLink({ id, engine, children, className = 'link' }: { id: string; engine: Engine; children: ReactNode; className?: string }) {
  const origin = useContext(FeatureOrigin);
  const context = useContext(CharacterRuleContext);
  return (
    <a
      className={className}
      href={featureHref(id, engine, origin)}
      onClick={(event) => {
        if (!context?.openDetails || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        context.openDetails(id);
      }}
    >
      {children}
    </a>
  );
}
