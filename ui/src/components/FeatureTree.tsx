import { useState } from 'react';
import type { TreeNode } from '@/ui/src/types/TreeNode';

const readToggled = (key?: string) => {
  if (!key) return new Set<string>();
  try {
    return new Set<string>(JSON.parse(localStorage.getItem(key) ?? '[]') as string[]);
  } catch {
    return new Set<string>();
  }
};

/** Nested Feature rows with no depth limit; indentation stops growing past a cap. */
export function FeatureTree({
  nodes,
  storageKey,
  openDepth = 0,
  controls = true,
  empty = 'Nothing to show.',
}: {
  nodes: TreeNode[];
  /** Remembers which rows are open, for example per character. */
  storageKey?: string;
  /** Rows shallower than this start open. */
  openDepth?: number;
  /** Expand all walks lazily built children, so leave it off for unbounded catalogue trees. */
  controls?: boolean;
  empty?: string;
}) {
  // A row is open when its default state is flipped by the user (or by Expand/Collapse all).
  const [toggled, setToggled] = useState(() => readToggled(storageKey));
  const save = (next: Set<string>) => {
    setToggled(next);
    if (!storageKey) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify([...next]));
    } catch {
      // Open rows are a convenience; the tree still works without storage.
    }
  };
  const isOpen = (path: string, depth: number) => (depth < openDepth) !== toggled.has(path);
  const toggle = (path: string) => {
    const next = new Set(toggled);
    if (!next.delete(path)) next.add(path);
    save(next);
  };
  const setAll = (open: boolean) => {
    const next = new Set<string>();
    const visit = (items: TreeNode[], prefix: string, depth: number) => {
      for (const node of items) {
        const path = `${prefix}/${node.id}`;
        if (node.leaf || (!node.children && !node.detail)) continue;
        if (open !== (depth < openDepth)) next.add(path);
        if (open && node.children && depth < 12) visit(node.children(), path, depth + 1);
      }
    };
    visit(nodes, '', 0);
    save(next);
  };
  const rows = (items: TreeNode[], prefix: string, depth: number, trail: string[]) =>
    items.map((node) => {
      const path = `${prefix}/${node.id}`;
      const head = (
        <>
          {node.tag && <span className="tree-tag">{node.tag}</span>}
          <span className="tree-text">
            <span className="tree-name">{node.name}</span>
            {node.description && (
              <span className="tree-description">
                {' — '}
                {node.description}
              </span>
            )}
          </span>
          {node.state
            ? <span className={`tree-meta ${node.state.tone}`}>{node.state.text}</span>
            : node.meta && <span className="tree-meta">{node.meta}</span>}
        </>
      );
      if (node.leaf || (!node.children && !node.detail))
        return (
          <div
            className={`tree-row tree-leaf${node.pending ? ' pending' : ''}`}
            key={path}
          >
            {head}
          </div>
        );
      const expanded = isOpen(path, depth);
      return (
        <div
          className="tree-item"
          key={path}
        >
          <button
            className="tree-row tree-toggle"
            aria-expanded={expanded}
            onClick={() => toggle(path)}
          >
            {head}
          </button>
          {expanded && (
            <div
              className="tree-children"
              data-depth={depth + 1}
            >
              {depth + 1 >= 2 && (
                <p className={`tree-path${depth + 1 >= 5 ? ' deep' : ''}`}>
                  {[...trail, node.label].join(' › ')}
                </p>
              )}
              {node.detail && <div className="tree-detail">{node.detail()}</div>}
              {node.children && rows(node.children(), path, depth + 1, [...trail, node.label])}
            </div>
          )}
        </div>
      );
    });
  return (
    <div className="feature-tree">
      {controls && nodes.some((node) => !node.leaf) && (
        <div className="tree-controls">
          <button
            className="quiet small-button"
            onClick={() => setAll(true)}
          >
            Expand all
          </button>
          <button
            className="quiet small-button"
            onClick={() => setAll(false)}
          >
            Collapse all
          </button>
        </div>
      )}
      {nodes.length ? rows(nodes, '', 0, []) : <p className="muted">{empty}</p>}
    </div>
  );
}
