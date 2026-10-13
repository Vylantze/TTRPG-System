export type FormSchema = {
  kind: string;
  name?: string;
  value?: string | number | boolean;
  item?: FormSchema;
  base?: FormSchema;
  filter?: FormSchema;
  variants?: FormSchema[];
  fields?: Record<string, { schema: FormSchema; optional: boolean }>;
};
