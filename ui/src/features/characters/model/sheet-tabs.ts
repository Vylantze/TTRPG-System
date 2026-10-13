import type { SheetTab } from '@/src/model/SheetTab';

/** Retain saved order, ignore retired tabs, and append newly introduced System tabs. */
export function orderedSheetTabs(tabs: SheetTab[], order: string[] = []): SheetTab[] {
  return [...order.flatMap((id) => tabs.find((tab) => tab.id === id) ?? []), ...tabs.filter((tab) => !order.includes(tab.id))];
}
export function moveSheetTab(order: string[], id: string, direction: number): string[] {
  const index = order.indexOf(id), target = index + direction;
  if (index < 0 || target < 0 || target >= order.length) return order;
  const next = [...order];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
