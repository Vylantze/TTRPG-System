import { useState } from 'react';
import type { FormSchema } from '@/ui/src/types/FormSchema';
import { formDefault, formLabel, matchesFormSchema, resolveFormSchema, variantLabel, switchFormVariant } from '@/ui/src/authoring-form';

/** Recursive typed controls: data remains structured throughout editing. */
export function AuthoringField({ schema: input, value, label, change, depth = 0 }: { schema: FormSchema; value: unknown; label: string; change: (value: unknown) => void; depth?: number }) {
  const [newKey, setNewKey] = useState('');
  const [expanded, setExpanded] = useState(depth < 2);
  const schema = resolveFormSchema(input);
  if (schema.kind === 'unknown') return <AuthoringField schema={{ kind: 'union', variants: [{ kind: 'string' }, { kind: 'number' }, { kind: 'boolean' }, { kind: 'array', item: { kind: 'unknown' } }, { kind: 'record', item: { kind: 'unknown' } }] }} value={value} label={label} change={change} depth={depth + 1} />;
  if (depth > 24) return <p>Collapse the surrounding group to edit other fields. Maximum editor nesting reached.</p>;
  if (schema.kind === 'literal') return (
    <label>
      {label}
      <input value={String(schema.value)} readOnly />
    </label>
  );
  if (schema.kind === 'union') {
    const variants = schema.variants!;
    const index = Math.max(0, variants.findIndex((variant) => matchesFormSchema(variant, value)));
    const enums = variants.every((variant) => variant.kind === 'literal');
    return (
      <div className="authoring-union">
        <label>
          {label}
          {!enums && ' · Value type'}
          <select value={index} onChange={(event) => change(switchFormVariant(variants[Number(event.target.value)], value))}>{variants.map((variant, position) => <option value={position} key={position}>{variantLabel(variant)}</option>)}</select>
        </label>
        {!enums && <AuthoringField schema={variants[index]} value={value} label={label} change={change} depth={depth + 1} />}
      </div>
    );
  }
  if (schema.kind === 'array') {
    const values = Array.isArray(value) ? value : [];
    return (
      <details className="authoring-group" open={expanded} onToggle={(event) => setExpanded(event.currentTarget.open)}>
        <summary>
          {label}
          {' '}
          (
          {values.length}
          )
        </summary>
        {expanded && values.map((entry, index) => (
          <div className="authoring-entry" key={index}>
            <AuthoringField schema={schema.item!} value={entry} label={`${label} ${index + 1}`} depth={depth + 1} change={(next) => change(values.map((old, position) => index === position ? next : old))} />
            <div className="toolbar">
              <button
                className="quiet"
                disabled={index === 0}
                onClick={() => {
                  const next = [...values];
                  [next[index - 1], next[index]] = [next[index], next[index - 1]];
                  change(next);
                }}
              >
                Move up
              </button>
              <button className="quiet danger" onClick={() => change(values.filter((_, position) => position !== index))}>Remove entry</button>
            </div>
          </div>
        ))}
        <button className="quiet" onClick={() => change([...values, formDefault(schema.item!)])}>
          Add
          {label.toLowerCase()}
          {' '}
          entry
        </button>
      </details>
    );
  }
  if (schema.kind === 'object' || schema.kind === 'record' || (schema.kind === 'unknown' && value && typeof value === 'object')) {
    const data = (value ?? {}) as Record<string, unknown>;
    const fields = schema.fields ?? {};
    const available = Object.entries(fields).filter(([key]) => !Object.hasOwn(data, key));
    const key = schema.kind === 'record' ? newKey : available.some(([name]) => name === newKey) ? newKey : available[0]?.[0] || '';
    return (
      <details className="authoring-group" open={expanded} onToggle={(event) => setExpanded(event.currentTarget.open)}>
        <summary>{label}</summary>
        {expanded && Object.entries(data).map(([name, entry]) => (
          <div className="authoring-property" key={name}>
            <AuthoringField schema={fields[name]?.schema ?? schema.item ?? { kind: 'unknown' }} value={entry} label={label === 'Levels' ? `Level ${name}` : formLabel(name)} depth={depth + 1} change={(next) => change({ ...data, [name]: next })} />
            {(schema.kind === 'record' || fields[name]?.optional) && (
              <button
                className="quiet danger"
                aria-label={`Remove ${formLabel(name)}`}
                onClick={() => {
                  const next = { ...data };
                  delete next[name];
                  change(next);
                }}
              >
                Remove field
              </button>
            )}
          </div>
        ))}
        {(schema.kind === 'record' || available.length > 0) && (
          <div className="toolbar">
            <label>
              {schema.kind === 'record' ? 'New entry name' : 'Optional field'}
              {schema.kind === 'record' ? <input value={newKey} onChange={(event) => setNewKey(event.target.value)} /> : <select value={key} onChange={(event) => setNewKey(event.target.value)}>{available.map(([name]) => <option key={name} value={name}>{formLabel(name)}</option>)}</select>}
            </label>
            <button
              className="quiet"
              disabled={!key.trim() || Object.hasOwn(data, key)}
              onClick={() => {
                change({ ...data, [key]: formDefault(fields[key]?.schema ?? schema.item ?? { kind: 'string' }) });
                setNewKey('');
              }}
            >
              Add field
            </button>
          </div>
        )}
      </details>
    );
  }
  const kind = schema.kind === 'unknown' ? typeof value : schema.kind;
  if (kind === 'boolean') return (
    <label className="authoring-checkbox">
      <input type="checkbox" checked={!!value} onChange={(event) => change(event.target.checked)} />
      {label}
    </label>
  );
  if (kind === 'number') return (
    <label>
      {label}
      <input type="number" value={Number.isFinite(value) ? Number(value) : ''} onChange={(event) => change(event.target.value === '' ? 0 : Number(event.target.value))} />
    </label>
  );
  if (/description|summary|text|override string|original string/i.test(label)) return (
    <label>
      {label}
      <textarea value={String(value ?? '')} onChange={(event) => change(event.target.value)} />
    </label>
  );
  return (
    <label>
      {label}
      <input list={/^tags?/i.test(label) ? 'authoring-tags' : /feature|spell|stat|resource|class|block|^ids/i.test(label) ? 'authoring-references' : undefined} value={String(value ?? '')} onChange={(event) => change(event.target.value)} />
    </label>
  );
}
