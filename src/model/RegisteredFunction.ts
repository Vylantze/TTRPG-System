export interface RegisteredFunction { arguments: ('number' | 'boolean')[]; result: 'number' | 'boolean'; invoke: (...values: (number | boolean)[]) => number | boolean }
