import type { SelectionResult, Diagnostic } from '@/src/index';

export function selectionLevel(slot: SelectionResult): number {
  return Number(slot.context.acquiredClassLevel) || Number(slot.context.acquiredCharacterLevel) || Number(slot.id.match(/^class\/[^/]+\/(\d+)/)?.[1]) || 0;
}
export function selectionBucket(slot: SelectionResult): string {
  return slot.id.startsWith('advancement/') ? 'origins' : selectionLevel(slot) ? String(selectionLevel(slot)) : 'extra';
}
export function sortBuildSelections(slots: SelectionResult[]): SelectionResult[] {
  return [...slots].sort((a, b) => selectionLevel(a) - selectionLevel(b) || a.id.localeCompare(b.id));
}
export function selectionIssues(slot: SelectionResult, diagnostics: Diagnostic[]): string[] {
  return [...new Set(diagnostics.filter((issue) => issue.path === slot.id || issue.path.startsWith(`${slot.id}/`)).map((issue) => issue.message))];
}
