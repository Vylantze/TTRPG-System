export type Expression = number | boolean | { literal: number | boolean }
  | { stat: string } | { context: string } | { parameter: string } | { base: true }
  | { op: 'add' | 'subtract' | 'multiply' | 'divide' | 'min' | 'max' | 'floor' | 'ceil'
      | 'eq' | 'gt' | 'gte' | 'lt' | 'lte' | 'and' | 'or' | 'not'; args: Expression[] }
  | { if: Expression; then: Expression; else: Expression }
  | { table: string; owner?: string; input: Expression }
  | { call: string; args: Expression[] };
