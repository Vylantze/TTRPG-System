import definitions from '@/ui/src/authoring-schema.json';
import type { FormSchema } from '@/ui/src/types/FormSchema';

const resolvedSchemas = new Map<string, FormSchema>();
export function resolveFormSchema(schema: FormSchema): FormSchema {
  if (schema.kind === 'ref') {
    const name = schema.name!;
    const cached = resolvedSchemas.get(name);
    if (cached) return cached;
    const resolved = resolveFormSchema((definitions as unknown as Record<string, FormSchema>)[name] ?? { kind: 'unknown' });
    resolvedSchemas.set(name, resolved);
    return resolved;
  }
  if (schema.kind === 'intersection') {
    let variants: FormSchema[] = [{ kind: 'object', fields: {} }];
    for (const part of schema.variants!) {
      const resolved = resolveFormSchema(part);
      const options = resolved.kind === 'union' ? resolved.variants! : [resolved];
      variants = variants.flatMap((previous) => options.map((option) => ({ kind: 'object', fields: { ...previous.fields, ...resolveFormSchema(option).fields } })));
    }
    return variants.length === 1 ? variants[0] : { kind: 'union', variants };
  }
  if (schema.kind === 'extract') {
    const base = resolveFormSchema(schema.base!);
    const filter = resolveFormSchema(schema.filter!);
    const variants = (base.variants ?? [base]).filter((variant) => Object.entries(filter.fields!).every(([key, field]) => resolveFormSchema(variant).fields?.[key]?.schema.value === field.schema.value));
    return variants.length === 1 ? resolveFormSchema(variants[0]) : { kind: 'union', variants };
  }
  return schema;
}
export function formSchema(name: string): FormSchema {
  return { kind: 'ref', name };
}
export function formLabel(key: string): string {
  return key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[-_.]/g, ' ').replace(/^./, (letter) => letter.toUpperCase());
}
export function formDefault(input: FormSchema): unknown {
  const schema = resolveFormSchema(input);
  if (schema.kind === 'literal') return schema.value;
  if (schema.kind === 'union') return formDefault(schema.variants![0]);
  if (schema.kind === 'object') return Object.fromEntries(Object.entries(schema.fields!).filter(([, field]) => !field.optional).map(([key, field]) => [key, formDefault(field.schema)]));
  if (schema.kind === 'record') return {};
  if (schema.kind === 'array') return [];
  return schema.kind === 'number' ? 0 : schema.kind === 'boolean' ? false : '';
}
export function matchesFormSchema(input: FormSchema, value: unknown): boolean {
  const schema = resolveFormSchema(input);
  if (schema.kind === 'literal') return value === schema.value;
  if (schema.kind === 'union') return schema.variants!.some((variant) => matchesFormSchema(variant, value));
  if (schema.kind === 'array') return Array.isArray(value);
  if (schema.kind === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const fields = value as Record<string, unknown>;
    return Object.entries(schema.fields!).every(([key, field]) => field.optional || (Object.hasOwn(fields, key) && matchesFormSchema(field.schema, fields[key])));
  }
  if (schema.kind === 'record') return !!value && typeof value === 'object' && !Array.isArray(value);
  return schema.kind === 'unknown' || typeof value === schema.kind;
}
export function switchFormVariant(input: FormSchema, previous: unknown): unknown {
  const next = formDefault(input);
  const schema = resolveFormSchema(input);
  if (schema.kind !== 'object' || !previous || typeof previous !== 'object' || Array.isArray(previous)) return next;
  const preserved = Object.fromEntries(Object.entries(previous).filter(([key, value]) => schema.fields?.[key] && matchesFormSchema(schema.fields[key].schema, value)));
  return { ...next as object, ...preserved };
}
export function variantLabel(input: FormSchema): string {
  const schema = resolveFormSchema(input);
  const discriminator = schema.fields?.kind?.schema;
  if (discriminator?.kind === 'literal') return formLabel(String(discriminator.value));
  if (input.kind === 'ref') return formLabel(input.name!);
  if (schema.kind === 'literal') return String(schema.value);
  if (schema.kind === 'object') return Object.entries(schema.fields!).map(([key, field]) => field.schema.kind === 'literal' ? String(field.schema.value) : formLabel(key)).slice(0, 3).join(' / ');
  return formLabel(schema.kind);
}
