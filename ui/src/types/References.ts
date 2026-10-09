import type { Engine } from '@/src/index';
import type { Preview } from '@/ui/src/types/Preview';

export type References = { engine?: Engine; openFeature?: (id: string) => void; exclude?: string[]; onPreview?: (reference: Preview) => void };
