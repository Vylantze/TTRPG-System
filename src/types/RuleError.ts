export class RuleError extends Error {
  constructor(public code: string, message: string, public path = '') { super(message); }
}
