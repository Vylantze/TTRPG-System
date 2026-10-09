import { createContext } from 'react';

export const FeatureOrigin = createContext<string | undefined>(undefined);

export function safeReturn(value: string | undefined | null): string | undefined {
  return value && /^#(?:classes|features|characters)(?:[/?]|$)/.test(value) ? value : undefined;
}
