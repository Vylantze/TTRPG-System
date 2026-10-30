import { useMemo, useState } from 'react';
import type { ClassDefinition, Engine, FeatureDefinition } from '@/src/index';
import { DataTable } from '@/ui/src/components/DataTable';
import { FeatureTree } from '@/ui/src/components/FeatureTree';
import { FilterChips } from '@/ui/src/components/FilterChips';
import { FeatureLink } from '@/ui/src/features/catalogue/components/FeatureLink';
import { FeatureRules } from '@/ui/src/features/catalogue/components/RulesText';
import { entryNodes, oneLine, structuralEntries } from '@/ui/src/features/catalogue/model/definition-tree';
import { featureName, tagName } from '@/ui/src/features/catalogue/model/display';
import { featureDescription } from '@/ui/src/features/catalogue/model/feature-description';
import type { DataTableColumn } from '@/ui/src/types/DataTableColumn';
import type { TreeNode } from '@/ui/src/types/TreeNode';

const PAGE_SIZE = 50;
const sourceLabel = (source?: string) => source?.split(', http')[0] ?? '';

/** Searchable, filterable tables for Classes, Features and Races, with rows that open in place. */
export function CatalogueBrowser({
  page,
  engine,
  query,
  tags,
  level,
  listPage,
  sort,
  browse,
  openFeature,
  classHref,
}: {
  page: 'classes' | 'features' | 'races';
  engine: Engine;
  query: string;
  tags: string[];
  level: string;
  listPage: number;
  /** Column key, with "-desc" for descending; "name", "name-desc" and "level" come from older links. */
  sort: string;
  browse: (changes: Record<string, string>) => void;
  openFeature: (id: string) => void;
  classHref: (id: string) => string;
}) {
  const system = engine.catalogue.system;
  const classSingular = system.terminology?.classSingular ?? 'Class',
    classPlural = system.terminology?.classPlural ?? 'Classes',
    creaturePlural = system.terminology?.creaturePlural ?? 'Races',
    creatureTag = system.terminology?.creatureTag ?? 'race';
  const [filtersOpen, setFiltersOpen] = useState(page === 'features');
  const sortState = {
    key: sort.replace(/-desc$/, '') || 'name',
    direction: (sort.endsWith('-desc') ? -1 : 1) as 1 | -1,
  };
  const setSort = (next: { key: string; direction: 1 | -1 }) =>
    browse({ sort: next.direction === 1 ? next.key : `${next.key}-desc`, page: '' });
  const needle = query.toLowerCase();
  const pool = useMemo(
    () =>
      engine.catalogue.features.filter(
        (f) => page !== 'races' || f.tags?.includes(creatureTag),
      ),
    [engine, page, creatureTag],
  );
  const searched = useMemo(
    () =>
      pool.filter((f) =>
        `${featureName(f)} ${f.name} ${featureDescription(f, engine) ?? ''} ${f.source ?? ''}`
          .toLowerCase()
          .includes(needle),
      ),
    [pool, engine, needle],
  );
  const features = useMemo(
    () =>
      searched
        .filter(
          (f) =>
            tags.every((tag) => f.tags?.includes(tag))
            && (level === '' || String(f.contentLevel ?? '') === level),
        ),
    [searched, tags, level],
  );
  const tagOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const f of searched) for (const tag of f.tags ?? []) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    return [...counts]
      .map(([value, count]) => ({ value, label: tagName(system, value), count }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [searched, system]);
  const levelOptions = useMemo(
    () =>
      [...new Set(searched.flatMap((f) => (f.contentLevel === undefined ? [] : [f.contentLevel])))]
        .sort((a, b) => a - b)
        .map((l) => ({ value: String(l), label: String(l) })),
    [searched],
  );
  const toggleTag = (tag: string) =>
    browse({
      tag: (tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag]).join(','),
      page: '',
    });
  const search = (
    <div className="catalogue-search">
      <input
        type="search"
        aria-label={`Search ${page === 'classes' ? classPlural : page === 'races' ? creaturePlural : 'Features'}`}
        placeholder={page === 'classes'
          ? `Search ${classPlural.toLowerCase()} by name or description`
          : `Search ${page === 'races' ? creaturePlural.toLowerCase() : 'Features'} by name, description or source`}
        value={query}
        onChange={(e) => browse({ q: e.target.value, page: '' })}
      />
      {page === 'features' && (
        <button
          className="quiet"
          aria-expanded={filtersOpen}
          onClick={() => setFiltersOpen(!filtersOpen)}
        >
          Filters
          {tags.length + (level ? 1 : 0) > 0 && ` (${tags.length + (level ? 1 : 0)})`}
        </button>
      )}
      <button
        className="quiet"
        onClick={() => browse({ q: '', tag: '', level: '', page: '' })}
      >
        Reset
      </button>
    </div>
  );

  if (page === 'classes') {
    const classes = engine.catalogue.classes.filter((c) =>
      `${c.name} ${c.description ?? ''}`.toLowerCase().includes(needle),
    );
    const levelNodes = (cls: ClassDefinition): TreeNode[] =>
      engine.getClassLevels(cls.id).map((row) => ({
        id: `level-${row.level}`,
        name: `Level ${row.level}`,
        label: `${cls.name} level ${row.level}`,
        meta: `${row.entries.length} ${row.entries.length === 1 ? 'entry' : 'entries'}`,
        children: () => entryNodes(engine, row.entries, openFeature, cls.name, []),
      }));
    const columns: DataTableColumn<ClassDefinition>[] = [
      {
        key: 'name',
        header: classSingular,
        cell: (c) => <a href={classHref(c.id)}>{c.name}</a>,
        sortValue: (c) => c.name,
      },
      {
        key: 'first',
        header: 'Level 1',
        secondary: true,
        cell: (c) =>
          (engine.getClassLevels(c.id)[0]?.entries ?? [])
            .flatMap((entry) =>
              entry.kind === 'grantFeature' ? [featureName(engine.getFeature(entry.feature))] : [],
            )
            .slice(0, 3)
            .join(', '),
      },
      {
        key: 'choices',
        header: 'Choices',
        cell: (c) =>
          engine
            .getClassLevels(c.id)
            .flatMap((row) => row.entries)
            .filter((entry) => entry.kind === 'chooseFeatures').length,
        sortValue: (c) =>
          engine
            .getClassLevels(c.id)
            .flatMap((row) => row.entries)
            .filter((entry) => entry.kind === 'chooseFeatures').length,
      },
      {
        key: 'levels',
        header: 'Levels',
        cell: (c) => c.maximumLevel ?? Object.keys(c.levels).length,
        sortValue: (c) => c.maximumLevel ?? Object.keys(c.levels).length,
      },
      {
        key: 'source',
        header: 'Source',
        secondary: true,
        cell: (c) => <span className="muted">{sourceLabel(c.source)}</span>,
      },
    ];
    return (
      <>
        {search}
        <p className="result-count">
          {classes.length}
          {' of '}
          {engine.catalogue.classes.length}
          {' '}
          {classPlural.toLowerCase()}
        </p>
        <DataTable
          label={classPlural}
          columns={columns}
          rows={classes}
          sort={sortState}
          onSort={setSort}
          rowKey={(c) => c.id}
          empty={`No ${classPlural.toLowerCase()} match this search.`}
          detail={(c) => (
            <div className="catalogue-detail">
              {c.description && <p className="muted">{oneLine(c.description, 240)}</p>}
              <FeatureTree
                nodes={levelNodes(c)}
                openDepth={1}
                controls={false}
              />
              <a href={classHref(c.id)}>{`Open the full ${classSingular} guide →`}</a>
            </div>
          )}
        />
      </>
    );
  }

  const columns: DataTableColumn<FeatureDefinition>[] = [
    {
      key: 'name',
      header: page === 'races' ? (system.terminology?.creatureSingular ?? 'Race') : 'Feature',
      cell: (f) => (
        <FeatureLink
          id={f.id}
          engine={engine}
        >
          {featureName(f)}
        </FeatureLink>
      ),
      sortValue: (f) => featureName(f),
    },
    {
      key: 'category',
      header: 'Category',
      cell: (f) => (f.tags?.[0] ? tagName(system, f.tags[0]) : 'Feature'),
      sortValue: (f) => (f.tags?.[0] ? tagName(system, f.tags[0]) : 'Feature'),
    },
    {
      key: 'level',
      header: 'Level',
      cell: (f) => f.contentLevel ?? '—',
      sortValue: (f) => f.contentLevel ?? -1,
    },
    {
      key: 'contents',
      header: 'Contains',
      secondary: true,
      cell: (f) => {
        const count = structuralEntries(f).length;
        return count ? `${count} ${count === 1 ? 'entry' : 'entries'}` : '';
      },
    },
    {
      key: 'source',
      header: 'Source',
      secondary: true,
      cell: (f) => <span className="muted">{sourceLabel(f.source)}</span>,
    },
  ];
  // Sort the whole list, not just the visible page; ties fall back to name order.
  const sortColumn = columns.find((column) => column.key === sortState.key) ?? columns[0];
  const ordered = [...features].sort((a, b) => {
    const left = sortColumn.sortValue?.(a) ?? '',
      right = sortColumn.sortValue?.(b) ?? '';
    const compared
      = typeof left === 'number' && typeof right === 'number'
        ? left - right
        : String(left).localeCompare(String(right));
    return compared * sortState.direction || featureName(a).localeCompare(featureName(b));
  });
  const pages = Math.max(1, Math.ceil(ordered.length / PAGE_SIZE));
  const current = Math.min(listPage, pages - 1);
  return (
    <>
      {search}
      {page === 'features' && filtersOpen && (
        <div className="filter-panel">
          <FilterChips
            label="Category"
            options={tagOptions}
            selected={tags}
            toggle={toggleTag}
          />
          <FilterChips
            label="Level"
            options={levelOptions}
            selected={level ? [level] : []}
            toggle={(value) => browse({ level: value === level ? '' : value, page: '' })}
          />
        </div>
      )}
      <p className="result-count">
        {features.length}
        {' of '}
        {pool.length}
        {' '}
        {page === 'races' ? creaturePlural.toLowerCase() : 'Features'}
      </p>
      <DataTable
        label={page === 'races' ? creaturePlural : 'Features'}
        columns={columns}
        rows={ordered.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE)}
        sort={sortState}
        onSort={setSort}
        rowKey={(f) => f.id}
        empty="Nothing matches these filters."
        detail={(f) => (
          <div className="catalogue-detail">
            <FeatureRules
              feature={f}
              engine={engine}
              openFeature={openFeature}
            />
            {structuralEntries(f).length > 0 && (
              <FeatureTree
                nodes={entryNodes(engine, structuralEntries(f), openFeature, featureName(f), [f.id])}
                controls={false}
              />
            )}
            <FeatureLink
              id={f.id}
              engine={engine}
            >
              Open Feature →
            </FeatureLink>
          </div>
        )}
      />
      {pages > 1 && (
        <div className="row pagination">
          <button
            className="quiet"
            disabled={current === 0}
            onClick={() => browse({ page: String(current - 1) })}
          >
            Previous
          </button>
          <span>
            {'Page '}
            {current + 1}
            {' of '}
            {pages}
          </span>
          <button
            className="quiet"
            disabled={current + 1 >= pages}
            onClick={() => browse({ page: String(current + 1) })}
          >
            Next
          </button>
        </div>
      )}
    </>
  );
}
