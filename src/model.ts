/** Plain, versioned content data. No expressions contain executable source. */
export type Value = number | boolean | string;
export type Expression = number | boolean | { literal: number | boolean }
  | { stat: string } | { context: string } | { parameter: string } | { base: true }
  | { op: 'add' | 'subtract' | 'multiply' | 'divide' | 'min' | 'max' | 'floor' | 'ceil'
      | 'eq' | 'gt' | 'gte' | 'lt' | 'lte' | 'and' | 'or' | 'not'; args: Expression[] }
  | { if: Expression; then: Expression; else: Expression }
  | { table: string; owner?: string; input: Expression }
  | { call: string; args: Expression[] };
export type BoundaryPolicy = 'error' | 'boundary' | { fallback: number };
export interface ScalingTable {
  mode: 'exact' | 'threshold'; rows: { key: number; value: number }[];
  below: BoundaryPolicy; above: BoundaryPolicy; missing?: 'error' | { fallback: number };
}
export type Predicate = { level: number; kind?: 'character' | 'class' }
  | { feature: string; parameters?: Record<string, Value> } | { tag: string }
  | { stat: string; minimum: number } | { parameter: string; equals: Value }
  | { expression: Expression }
  | { all: Predicate[] } | { any: Predicate[] } | { not: Predicate };
export interface NumericConstraints { integer?: boolean; minimum?: number; maximum?: number; rounding?: 'floor' | 'ceil' | 'round'; clamp?: boolean }
export type StatDefinition = NumericConstraints & { id: string; name: string } & (
  { kind: 'input'; default?: number } | { kind: 'derived'; expression: Expression });
export type StackingPolicy = 'sum' | 'highest' | 'lowest' | 'bestBonusAndWorstPenalty';
export interface ParameterDefinition { kind: 'number' | 'string' | 'boolean'; default?: Value; options?: Value[]; minimum?: number; maximum?: number; integer?: boolean }
export interface ComponentBase { id: string; condition?: Expression }
export interface Grant extends ComponentBase { kind: 'grantFeature'; feature: string; parameters?: Record<string, Value>; ignorePrerequisites?: boolean }
export interface Choice extends ComponentBase {
  kind: 'chooseFeatures'; minimum: Expression; maximum: Expression;
  candidates: { ids?: string[]; tags?: string[]; maximumLevel?: Expression };
  ignorePrerequisites?: boolean; allowDuplicates?: boolean;
  /** Daily preparation can check current ownership rather than historical acquisition. */
  eligibility?: 'acquisition' | 'current';
  retraining?: { allowed: boolean; events?: string[] };
}
export interface Modifier extends ComponentBase {
  kind: 'modifyStat'; stat: string; operation: 'add' | 'multiply' | 'floor' | 'ceiling' | 'override';
  value: Expression; group?: string; stacking?: StackingPolicy; priority?: number;
}
export type Scope = 'character' | 'progression' | 'parent' | 'instance';
export interface ResourceRequirement { id: string; key: string; scope?: Scope; units?: string; contract?: string; minimumCapacity?: number }
export interface Resource extends ComponentBase, NumericConstraints {
  kind: 'defineResource'; key: string; scope: Scope; units: string; contract?: string;
  capacity: Expression; combine?: 'sum' | 'highest'; initial?: 'full' | 'empty';
  recovery: { event: string; amount: Expression | 'full' }[];
}
export interface Capability extends ComponentBase {
  kind: 'grantCapability'; name: string; description?: string; action?: { kind: string; amount: number };
  requirements?: Predicate; costs?: { key: string; amount: Expression; requirement?: string }[];
  /** Outcomes that consume a reserved use. Other outcomes release it. */
  spendOnOutcomes?: string[]; metadata?: Record<string, Value>;
}
export type Component = Grant | Choice | Modifier | Resource | Capability | (ComponentBase & { kind: 'describe'; text: string });
export interface FeatureDefinition {
  id: string; revision: number; name: string; description?: string; source?: string; tags?: string[]; contentLevel?: number;
  prerequisites?: Predicate; maintenance?: Predicate; resources?: ResourceRequirement[];
  repeat?: { maximum: number; scope: 'character' | 'progression' | 'parent'; uniqueBy?: string[] };
  parameters?: Record<string, ParameterDefinition>; tables?: Record<string, ScalingTable>; components: Component[];
}
export interface ClassDefinition { id: string; revision: number; name: string; levels: Record<string, (Grant | Choice)[]>; maximumLevel?: number; multiclassPrerequisites?: Predicate }
export interface SystemDefinition {
  id: string; revision: number; name: string; stats: StatDefinition[]; classes?: string[];
  allowMultipleClasses: boolean; characterLevel: Expression;
  allowDuplicateClasses?: boolean;
  /** Restrict additional root acquisitions without restricting nested or class Features. */
  rootCandidates?: { ids?: string[]; tags?: string[] };
  validation?: { id: string; requirement: Predicate; message: string }[];
  contextDefaults?: Record<string, Value>; advancement?: Record<string, (Grant | Choice)[]>;
  /** Explicit alternative base calculations, selected by character input. */
  alternatives?: Record<string, { id: string; expression: Expression; requirements?: Predicate }[]>;
  /** Engine command policies, authored as data rather than System-specific code. */
  commandRules?: {
    spellTurn?: { castingAbilityKey: string; levelKey: string; timeKey: string; ritualKey: string; bonusTime: string; actionTime: string };
    selectedRecovery?: { eventKind?: string; capabilityName: string; requiredEvent: string; boundaryEvent?: string; budgetStat: string;
      targets: Record<string, { key: string; scope: Scope; weight: number }> };
  };
}
export interface Catalogue { id: string; revision: number; system: SystemDefinition; features: FeatureDefinition[]; classes: ClassDefinition[] }
export interface Progression { id: string; class: string; level: number }
export interface Pick { id: string; feature: string; parameters?: Record<string, Value> }
export interface RootAcquisition extends Pick { acquiredCharacterLevel: number; acquiredEvent?: number }
export interface PendingUse { ability: string; costs: Record<string, number>; spendOnOutcomes: string[] }
export interface Character {
  version: 1; id: string; name: string; system: { id: string; revision: number };
  catalogue: { id: string; revision: number }; contentRevisions: Record<string, number>;
  inputs: Record<string, number>; progressions: Progression[];
  history: { progression: string; level: number }[]; roots: RootAcquisition[];
  selections: Record<string, Pick[]>; bindings: Record<string, string>;
  alternatives: Record<string, string>; resources: Record<string, { spent: number }>;
  pending: Record<string, PendingUse>; events: { id: string; fingerprint: string; actions?: Record<string, number> }[];
}
export interface Diagnostic { code: string; severity: 'invalid' | 'incomplete'; path: string; message: string }
export interface Instance {
  id: string; feature: string; parent?: string; progression?: string;
  parameters: Record<string, Value>; acquiredCharacterLevel: number; acquiredClassLevel: number;
  acquiredEvent?: number;
  active: boolean; eligible: boolean; waived: boolean; selection?: string;
}
export interface ModifierExplanation { source: string; component: string; operation: Modifier['operation']; amount?: number; applied: boolean; reason: string }
export interface StatResult { value: number; base: number; modifiers: ModifierExplanation[] }
export interface PoolResult { id: string; key: string; scope: Scope; units: string; contract?: string; integer: boolean; capacity: number; spent: number; reserved: number; available: number; providers: string[]; recovery: Resource['recovery']; initial: 'full' | 'empty' }
export interface CapabilityResult { id: string; source: string; definition: Capability; costs: Record<string, number> }
export interface SelectionResult { id: string; owner?: string; definition: Choice; minimum: number; maximum: number; picks: Pick[]; context: Record<string, Value> }
export interface EvaluationResult {
  status: 'valid' | 'incomplete' | 'invalid'; provisional: boolean; characterLevel: number;
  instances: Instance[]; selections: SelectionResult[]; stats: Record<string, StatResult>;
  resources: Record<string, PoolResult>; capabilities: CapabilityResult[]; bindings: Record<string, string>;
  diagnostics: Diagnostic[];
}
export type Edit = { kind: 'input'; stat: string; value: number }
  | { kind: 'addProgression'; progression: Progression }
  | { kind: 'select'; selection: string; picks: Pick[]; event?: string }
  | { kind: 'level'; progression: string; level: number }
  | { kind: 'root'; acquisition: RootAcquisition } | { kind: 'removeRoot'; id: string }
  | { kind: 'alternative'; stat: string; alternative: string } | { kind: 'bind'; requirement: string; pool: string };
export interface Candidate { feature: string; status: EvaluationResult['status']; waived: boolean; diagnostics: Diagnostic[] }
export interface EditPreview { character: Character; before: EvaluationResult; after: EvaluationResult; added: string[]; removed: string[]; changedStats: string[]; changedResources: string[] }
export interface RegisteredFunction { arguments: ('number' | 'boolean')[]; result: 'number' | 'boolean'; invoke: (...values: (number | boolean)[]) => number | boolean }
export type FunctionRegistry = Record<string, RegisteredFunction>;
