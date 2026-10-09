import { useContext, type ReactNode } from 'react';
import type { Engine } from '@/src/index';
import { featureHref } from '@/ui/src/feature-description';
import { FeatureOrigin } from '@/ui/src/feature-origin';

export function FeatureLink({ id, engine, children, className = 'link' }: { id: string; engine: Engine; children: ReactNode; className?: string }) {
  const origin = useContext(FeatureOrigin);
  return <a className={className} href={featureHref(id, engine, origin)}>{children}</a>;
}
