# Generic Feature System Specification Draft

A class is a progression of Features. Each level contains independent grants and choices; each Feature can grant other Features, offer further choices, and contain small mechanical components. A character stores its acquired instances and choices separately from reusable definitions. Numeric stats are defined by the rules system and calculated from basic inputs, formulas, and Feature effects.

This specification defines the model and its behavior before implementation. Dungeons and Dragons 5e, DnD5e, and 5e refer to the same system. Implement separate 2014 and 2024 5e systems first, before PF2e. Pathfinder2e and PF2e refer to the same system. The engine must not require fixed ability names, proficiency ranks, class names, or a particular action economy.

## Scope and decisions

The first deliverable is a written specification. Retraining, prerequisites, and limited-use abilities belong in the initial model. The design reference is `D:\User\Workspace\Anime5e`; official D&D rules and SRDs are additionally authorized to study and define the 5e systems. All new project work belongs in `D:\User\Workspace\TTRPG System`.

Confirmed decisions are an unrestricted named-stat registry, support for independent class progressions with system-controlled legality, and prerequisite repair after retraining. Dependent choices that lose eligibility make the build invalid until repaired; they are never changed automatically.

A later implementation should provide definition validation, character validation, calculation, and serialization before adding a React character-building interface. The UI will also browse Classes and Features directly and eventually allow custom Feature creation. This step specifies the UI plan; implementation follows the engine. A complete PF2e class catalogue and combat automation are separate work. Examples below are invented conversion examples, not official class progressions or exact transcriptions of PF2e rules.

## Lessons from Anime5e

| Reference | Existing concept | Generalized design |
| --- | --- | --- |
| `src/models/Feature.ts` | Identity, description, source, nested Features, programmable functionality | Reusable definitions with explicit components and references |
| `src/models/Feature.ts` | Subfeature lists and all or selected subfeatures | Independent grants and choices with explicit cardinality |
| `src/models/Feature.ts` | Feature rank, enhancements, limiters | Instance parameters and composition without a mandatory point system |
| `src/models/Basic.ts` | Basic ability score and derived modifier | Named numeric stats with declared formulas |
| `src/models/CharacterSheet.ts` | Features, class IDs and levels, HP, skills, derived getters | Character state with class progressions, acquisition records, and a stat registry |
| `src/models/References.ts` | Loading definitions and associating subfeatures | Validated references using explicit IDs rather than name or prefix matching |
| `src/lib/Database.ts` | Serialized character storage | Versioned plain data that preserves selections and resource state |

Do not copy Anime5e's fixed ability calculations or class instances as the generic engine. Keep definitions immutable and use explicit IDs for relationships. A display name may change without changing identity.

## Core entities

| Entity | Responsibility |
| --- | --- |
| SystemDefinition | Defines stats, stacking policies, legal progression structures, and system-specific conventions |
| FeatureDefinition | Reusable content and components; describes what a Feature does |
| FeatureInstance | One acquired occurrence, its parameters, choices, and acquisition context |
| ClassDefinition | Level-indexed progression entries that grant or select Features |
| ClassProgression | A character's class definition reference and attained class level |
| StatDefinition | A numeric input or calculated value, its constraints and formula |
| Character | Inputs, progressions, root instances, selection history, and resource state |
| EvaluationResult | Calculated stats, expanded Features, capabilities, resources, and diagnostics with provenance |

Every reusable definition has a stable namespaced ID and revision. Character saves pin a rules-system revision and content revision set. Editing published content creates a revision and an explicit migration; loading a save must not silently apply different rules.

## Basic and derived stats

A basic stat is a character input, such as an attribute modifier or movement value. A derived stat has an expression built from other stats and context. Derived stats cannot also accept an independent base input. Character level is computed from the system's progression policy, rather than silently assumed to equal the sum of class levels.

Each StatDefinition contains `id`, `name`, `kind` (`input` or `derived`), numeric constraints, a default input or expression, and a modifier policy. Constraints declare integer or decimal values, rounding, and optional bounds. Unknown stat IDs, missing required inputs, nonfinite results, and dependency cycles are errors. Bounds should reject invalid authored inputs; final-value clamping occurs only when explicitly declared by the system.

For example, a system could define:

| Stat ID | Kind | Base value or formula |
| --- | --- | --- |
| `attribute.agility` | Input | Character-entered modifier |
| `attribute.vitality` | Input | Character-entered modifier |
| `defense.rank` | Input | Default 0; permanent Features may raise it |
| `defense.proficiency` | Derived | System function of rank and character level |
| `defense.total` | Derived | 10 + agility + defense proficiency |
| `health.maximum` | Derived | Ancestry health + class health + vitality contribution |

These are example keys, not mandatory engine stats. A system may instead use ability scores and derive modifiers. Text values, tags, actions, and proficiencies with nonnumeric meaning are separate capabilities or system data, not disguised numeric stats.

### Expression language

Expressions use a serializable syntax tree, never executable source strings. Initial operations are numeric literals, stat references, acquisition-context references, arithmetic, minimum, maximum, floor, ceiling, comparisons, boolean operations, conditional expressions, and table lookups. Systems can register named pure functions with declared argument and dependency types. Division by zero and unknown functions are errors. Expressions do not read clocks, random numbers, arbitrary files, or hidden global state.

Stat references read the final value of the referenced stat in the current evaluation view. Therefore a modifier to agility flows through to defense. A modifier to a stat cannot read that same final stat. Instead, its own pre-modifier value is available as `base`; all dependencies through modifiers participate in cycle detection. `base` does not mean an unmodified value of some other stat.

Context distinguishes `characterLevel`, `classLevel`, `acquiredCharacterLevel`, `acquiredClassLevel`, and Feature parameters. Acquisition values are frozen; current levels can increase. A component must state which meaning it uses.

### Modifier primitives and order

| Primitive | Behavior |
| --- | --- |
| `add` | Adds an evaluated numeric amount under the declared stacking policy |
| `multiply` | Multiplies by an evaluated factor; default factors all apply |
| `floor` | Enforces a minimum, useful for proficiency upgrades |
| `ceiling` | Enforces a maximum |
| `override` | Replaces the base value using an explicit priority |

For each stat, calculate its input or formula; resolve the highest-priority override; combine additions; apply multipliers; apply floor and ceiling; then apply declared rounding and bounds. An override changes the starting value, so additions still apply. Equal-priority conflicting overrides are invalid. A floor above a ceiling is invalid. Alternative calculation methods, such as competing defense formulas, use explicit system alternatives with a named selection rule; they must not be represented as whichever override happens to run last.

An addition declares a stacking group and policy. Supported policies are `sum`, `highest`, `lowest`, and `bestBonusAndWorstPenalty`. In the last policy, use the largest positive and most negative amount in the group. PF2e-style typed bonuses and penalties can use that policy; untyped additions can use `sum`. Distinct groups combine. The engine imposes no PF2e stacking policy on another system. Multipliers and overrides use separate policies rather than borrowing addition groups.

Every applied, suppressed, or inactive modifier records its source instance, component, evaluated amount, and reason. A stat explanation must show enough detail to reproduce the total.

## Features and their components

A FeatureDefinition contains `id`, `revision`, `name`, `description`, source metadata, tags, acquisition prerequisites, nonwaivable resource requirements, optional maintenance requirements, repeat policy, parameter definitions, optional local scaling tables, and an ordered list of components. Components have stable local IDs. Component order is for presentation and stable identity, not a hidden stat-calculation order.

| Component | Purpose |
| --- | --- |
| `modifyStat` | Applies one numeric modifier |
| `grantFeature` | Automatically acquires another Feature |
| `chooseFeatures` | Offers a constrained selection of other Features |
| `grantCapability` | Adds an action, permission, resistance description, or other structured capability |
| `defineResource` | Defines a limited-use pool and recovery rules |
| `describe` | Preserves narrative or rules text with no automated stat effect |

A Feature may contain zero or many components. A purely descriptive Feature is valid. There is no special engine type for feat, subclass, class feature, spell, or ancestry benefit; these are tags and content conventions. A component can include a condition, but permanent acquisition and temporary activation are different operations.

Automatic grants cannot depend on temporary combat state. Their acquisition conditions may depend on progression facts and validated build choices. Temporary conditions control stat effects and capabilities without acquiring or deleting children. This avoids a resource pool or child instance appearing and disappearing whenever a stance changes.

### Composition and stable instances

A Feature with multiple `grantFeature` components is a composite. A Feature with one modifier is an atomic Feature. Both share the same schema, so a class or a choice can refer to either.

References form a directed graph. Reusing the same definition in different branches is allowed; circular composition is invalid. Instances have distinct IDs and ownership paths. A child identity derives from its parent instance and component ID, and a selected child also uses a stable selection-entry ID. Reordering a display list must not reset choices or resource state.

The same definition may occur multiple times if its repeat policy allows it. Define `maximum`, `scope` (character, progression, or parent), and optionally `uniqueBy` parameters. For example, a specialization may repeat for different weapon parameters but not twice for the same weapon. A duplicated nonrepeatable grant is a validation diagnostic, never an accidental double bonus or a silently discarded grant.

### Choices inside Features

Each `chooseFeatures` component declares a local ID, minimum and maximum picks, a candidate source, candidate filters, duplicate policy, retraining policy, and `ignorePrerequisites` (default `false`). This option waives ordinary acquisition predicates for the directly selected Feature. It does not waive resource requirements, pick counts, candidate filters, repeat limits, maintenance conditions, or ability-use costs. Candidate sources are explicit Feature IDs or a query over system content tags. Filters include content level, class tag, and parameter requirements. Content level and acquisition level are distinct fields. A builder that intends to waive a level prerequisite must not separately exclude that option through a level filter.

Pick counts can be constants or expressions evaluated from declared stats, context, or tables. Counts must be nonnegative integers with minimum no greater than maximum. A change in capacity exposes missing or excess selections for repair rather than silently choosing or dropping options. Choices also declare permitted replacement events, such as level advancement or daily preparation; these differ from general retraining. These contracts support 5e spell preparation and other system-specific changing selections.

The waiver belongs to the selection and is recorded on the acquired instance with its source selection ID. It does not modify the reusable definition or automatically propagate to descendants. A nested choice can declare its own waiver. Automatic grants keep their normal prerequisite rules unless they explicitly declare an ordinary-prerequisite exemption. All paths still enforce resource requirements.

A choice acquires complete Feature instances, so its selected children can grant more Features and contain their own choices. Two choices inside one Feature are independent. A class can also provide two independent selection entries at the same level.

Store selected IDs and parameters, not a copied candidate list. Resolve candidates against the pinned content revision. A partially built character may have incomplete required choices; report an incomplete build and expose the missing slots. An unavailable selection, excessive pick count, or disallowed duplicate is invalid. Do not fill choices automatically.

Choices are scoped to a particular instance. Two copies of the same Feature must not share a selection merely because their definition IDs match. Deterministic expansion should produce the same instance graph after saving and loading.

## Classes and level progression

A ClassDefinition is a named progression container, not a special stat calculator. Its `levels` map associates each class level with an array of progression entries. Each entry has a stable ID and is either a grant of a Feature or a Feature selection with the same choice contract as above.

For example:

| Class level | Independent entries |
| --- | --- |
| 1 | Grant starting proficiencies; grant a health Feature; choose a training package; choose a class technique |
| 2 | Choose a class technique; choose a skill improvement |
| 3 | Grant a defense advancement; choose a general Feature |

This invented example illustrates structure only. A progression entry becomes available when its level is reached. Grants remain acquired at higher levels; they are not reapplied as new instances on every calculation. A higher-level grant may raise a rank using `floor`, so an earlier grant cannot reduce it.

Recurring benefits require an explicit encoding. A health Feature granted once can scale with `classLevel`; alternatively each class level can grant a repeatable health increment. Content must choose one representation to avoid double counting. A choice gained at level 2 normally uses its frozen acquisition level for its level cap, so reaching level 10 does not silently permit replacing it with a level 10 option. A retraining rule may explicitly change this.

System-wide advancement such as general choices or attribute increases may use a separate character-level progression. An entry must declare whether it belongs to a class or to character advancement; adding another class must not duplicate character-wide benefits.

Multiple class progressions can be represented with independent instance IDs and class levels. The system decides whether they are permitted, how character level is derived, and how shared benefits interact. PF2e archetype-style progression should be expressible as selected Features; it must not automatically mean adding a second full class.

## Prerequisites and validation

Acquisition prerequisites use structured predicates: minimum level, acquired Feature or tag, parameter match, build-stat threshold, all, any, and not. The initial implementation should support all of these. System-specific predicates need declared inputs and explicit error behavior. A selection with `ignorePrerequisites: true` records those predicates as waived rather than falsely reporting them satisfied.

Evaluate ordinary acquisition prerequisites at the acquisition event using the build up to that point. Within a level, automatic grants are applied first; choices that depend on other same-level choices require explicit prerequisite order. Resolve positive dependencies in that order and reject cycles. A Feature cannot satisfy an ordinary prerequisite through its own effects or descendants. Resource provision within a composite follows the separate sibling-resolution rule below. Temporary bonuses, equipment context, and active stances do not qualify by default. Use a separate eligibility stat view containing only the permanent build effects permitted by the system.

Automatic grants must also satisfy their declared prerequisites. Granting content does not implicitly bypass restrictions. Content can explicitly declare a documented exemption for ordinary prerequisites, with the reason included in provenance. Resource requirements cannot be exempted.

### Required resources and sibling SubFeatures

A resource requirement is a structured dependency on a usable pool definition, separate from a requirement to own a particular Feature. It declares a resource key, required scope, and optionally a minimum capacity. A Feature that normally requires a provider Feature must also declare the resource requirement if its mechanics rely on that provider's resource. The converter and Feature builder must preserve that dependency; merely marking every prerequisite waivable would lose essential information.

Ignoring prerequisites can waive ownership of the original provider Feature, but cannot waive the resource it supplies. A compatible alternative provider may satisfy the resource dependency. Compatibility uses the resource key, scope, units, and system-defined contract, never a display name. Bind the consumer to a specific resolved pool ID; ambiguous multiple pools require an explicit binding or a system selection rule.

A composite may grant a resource-providing SubFeature and a resource-consuming SubFeature in the same acquisition transaction. First expand its proposed children, then validate independently eligible providers, then bind and validate consumers. The provider may appear after the consumer in the display list. A provider in another sibling branch within the same composite can qualify if scope permits. A descendant cannot bootstrap its ancestor's ordinary eligibility, and a consumer cannot fulfill its own external resource requirement using grants that only become eligible through that consumer. Resource-dependency cycles with no independently valid provider are invalid.

For example, Arcane Package grants Energy Reserve and offers a choice of Arcane Technique. Energy Reserve defines an `arcane-energy` pool, and Arcane Technique requires that resource. Arcane Technique can be selected with its ordinary spellcaster prerequisite ignored because Energy Reserve fulfills the nonwaivable resource dependency. Selecting Arcane Technique alone without any compatible provider is invalid. The containing package needs no special hard-coded exception.

Candidate validation uses the enclosing composite's proposed acquisition context. A consumer awaiting an unfilled sibling provider choice is shown as pending with the missing resource identified; it cannot finalize as valid until that sibling choice supplies a compatible provider. Candidate eligibility is recomputed when sibling selections change.

Resource requirements are checked both when acquiring the Feature and when validating the current build. An inactive, removed, or incompatible provider does not qualify. Resource availability is different from resource provision: an exhausted pool still fulfills a provision requirement, while using an ability must pay its costs. Zero capacity is permitted only if the requirement's minimum capacity permits zero. Removing the only provider through retraining makes dependent Features invalid until repaired, even if their ordinary prerequisites were waived.

Prerequisites default to acquisition-only checks. A separate maintenance requirement controls whether an already acquired Feature remains usable in changing circumstances. A historical prerequisite failure after retraining follows the system's chosen repair policy; ordinary loss of a temporary condition does not trigger retraining repair.

Return structured diagnostics with code, severity, entity path, and human-readable explanation. Distinguish `incomplete`, `invalid`, and `valid` builds. Catalogue validation rejects missing references, illegal component data, stat cycles, composition cycles, and invalid candidate queries before character evaluation.

## Retraining and level changes

Retraining is an explicit transaction replacing a chosen instance and its owned descendants. Preview the removed and added Features, changed stats, prerequisite consequences, and resource changes before applying it. Independent sibling choices remain untouched.

Retraining that breaks dependent eligibility flags the build as invalid and requires repairing the dependent choices. A draft edit can retain the invalid selections so the user can see and repair them; finalizing a valid build requires all repairs. Dependent Features are identified through prerequisite and ownership relationships. Do not automatically replace or delete unrelated selections. A repair may replace several choices atomically. Retaining historical eligibility or automatically removing dependent Features is outside the agreed policy.

When reducing level, mark higher-level acquisitions inactive and retain their choices for possible restoration. Inactive instances grant no effects, capabilities, or usable pools. Revalidate remaining instances. Delete history only through an explicit character-edit operation. Increasing level restores still-valid selections without automatically refilling resources.

Keep an acquisition and revision history sufficient to reconstruct prerequisite snapshots and explain choices. Current instances represent the active build; history is evidence, not a second set of effects.

## Abilities and limited resources

A `grantCapability` component can declare an ability with action cost, trigger, requirements, targets, range, duration, traits, resource costs, and descriptive resolution. A reaction and a free action are distinct action-cost kinds. Systems supply their own permitted action kinds and units. Unsupported automation stays descriptive rather than being replaced with guessed effects.

A resource definition includes a pool ID, capacity expression, initial state, sharing scope, recovery events, and usage costs. Instance-owned pools remain separate; a character-wide pool intentionally combines contributions under a declared policy. Two unrelated limited-use abilities must not share a pool because they have the same display name.

### Capacity scaling and Feature tables

The Feature builder must let authors express resource capacity as a constant, a formula referencing named stats or context, a lookup in the Feature's own arbitrary table, or a combination of those expressions. The same expression system also supports scaling stat modifiers, recovery amounts, and ability costs. No class-level or character-level formula is mandatory.

A local table has a stable ID, numeric keys and values, a lookup mode (`exact` or `threshold`), and explicit policies for missing keys and values outside its range. Keys must be unique. Threshold mode returns the value at the greatest key less than or equal to the lookup input; below the first key uses the declared below-range policy. Above the last key uses the declared above-range policy. Exact mode requires a matching key within the range or applies its declared missing-key policy. Policies can return an explicit fallback, use the boundary value for out-of-range input, or produce an error. There is no implicit interpolation, extrapolation, or fixed 20-level size.

Tables belong to the Feature definition revision. A lookup identifies its table owner and table ID explicitly and supplies an input expression; a nested Feature does not inherit a parent's table implicitly. A granted child can receive an explicit table reference or a parameter from the parent. Initial table outputs are numeric; structured ability-result tables can be a later extension. The builder should validate keys, preview values for representative inputs, and show lookup policy and dependencies.

For example, Energy Reserve can use the following authored capacity table indexed by the `arcane.training` stat:

| Training threshold | Base capacity |
| --- | --- |
| 0 | 1 |
| 2 | 3 |
| 5 | 6 |

With threshold lookup, below-range error, and above-range boundary value, training 4 yields 3 and training 8 yields 6. A combined capacity formula `tableValue + max(0, attribute.insight)` yields 5 at training 4 and insight 2. An alternative formula can omit the table entirely. These are invented authoring examples, not PF2e resource rules.

Capacity dependencies join the calculation graph. Declared rounding and bounds apply to the final expression; negative or nonfinite capacity is invalid, and an integer-use pool requires an integer result after explicit rounding. The builder must reject self-referential capacity or stat-resource dependency cycles. Resource requirements that inspect capacity are checked after the independently eligible provider's capacity is calculated; they cannot validate a provider using bonuses from its not-yet-eligible consumer.

Persist expenditure separately from computed capacity: `available = max(0, capacity - spent)`. If capacity falls below expenditure, preserve that expenditure. Recalculating or increasing capacity does not clear expenditure, though higher capacity can legitimately increase available uses. For example, capacity 5 with 4 spent has 1 available; lowering capacity to 2 gives 0; returning to 5 gives 1, not 5. New acquisition uses the system's explicit initialization rule. Retraining preserves expenditure for equivalent pools, and a new pool may initialize empty or inherit expenditure according to the system; replacement must not provide free recovery by default.

Recovery happens only through explicit events, such as daily preparation, rest, or a recharge activity. Recovery never occurs as a side effect of evaluation or loading. Each event records its identity, affected pools, and effect; replaying the same event is idempotent. Timers and elapsed time are recorded game state, not wall-clock assumptions.

Using an ability validates active ownership, requirements, available actions, and all resource costs before spending anything. Commit all costs atomically; failure spends none. Combat results can initially be resolved manually. Stat effects with durations are separate effect instances that remember their source, start, and expiration event; automatic combat timing is a later implementation scope.

For an ability with outcome-dependent expenditure, an explicit pending-use event reserves the declared costs atomically. A later settlement event spends or releases the reservation according to the authored outcome rule, exactly once. Reservations reduce available uses while pending but are recorded separately from settled expenditure. Reloading preserves them; evaluation never settles them. This extends the immediate-payment contract for rules such as revised 5e Tactical Mind without relying on ad hoc refunds.

## Character state and calculation

Persist system and content revisions, character identity, base stat inputs, class progressions, root Feature acquisitions, nested choices, parameter values, advancement history, resource expenditure and recovery events, and explicit active context. Do not persist calculated totals as authoritative inputs.

Evaluation is pure and deterministic for the same content, character, and context. It does not mutate saved choices or consume resources.

1. Validate the catalogue and character references against pinned revisions.
2. Resolve legal progressions and the character-level policy.
3. Replay acquisition order and expand proposed permanent grants and selected descendants with stable instance IDs; preserve each selection's prerequisite-waiver policy.
4. Check selection counts, repeat policies, and ordinary acquisition eligibility. Resolve independently eligible resource providers and their capacity dependencies before validating resource-dependent consumers, including siblings in the same composite. Expose incomplete and invalid choices; reject unsupported dependency cycles.
5. Resolve the active instance set and component conditions for the requested build or runtime view.
6. Collect effects and build the full stat dependency graph, including modifier expressions.
7. Evaluate stats in dependency order, apply declared stacking policies, and retain explanations.
8. Calculate capabilities and final resource capacities without changing expenditure; recheck active resource bindings and minimum capacity requirements. Provisional effects from invalid consumers cannot make their providers eligible.
9. Return results and diagnostics. An incomplete or invalid build may expose provisional totals clearly labeled as provisional; it cannot be represented as a legal character.

The build view supplies permanent character totals. A runtime view can add equipment and temporary effects with context predicates. Eligibility uses the restricted historical build view described above. Derived-stat references never silently switch between views.

## Illustrative data shape

This JSON illustrates naming and relationships. The final schema must formally define every field before implementation.

```json
{
  "feature": {
    "id": "example:combat-training",
    "revision": 1,
    "name": "Combat Training",
    "tags": ["training"],
    "repeat": { "maximum": 1, "scope": "character" },
    "components": [
      {
        "id": "defense-training",
        "kind": "modifyStat",
        "stat": "defense.rank",
        "operation": "floor",
        "value": { "literal": 1 }
      },
      {
        "id": "starting-tools",
        "kind": "grantFeature",
        "feature": "example:starting-tools"
      },
      {
        "id": "style",
        "kind": "chooseFeatures",
        "minimum": 1,
        "maximum": 1,
        "ignorePrerequisites": false,
        "candidates": {
          "ids": ["example:guarded-style", "example:mobile-style"]
        },
        "retraining": { "allowed": true }
      }
    ]
  },
  "class": {
    "id": "example:adventurer",
    "revision": 1,
    "name": "Adventurer",
    "levels": {
      "1": [
        {
          "id": "training",
          "kind": "grantFeature",
          "feature": "example:combat-training"
        },
        {
          "id": "technique",
          "kind": "chooseFeatures",
          "minimum": 1,
          "maximum": 1,
          "candidates": { "tags": ["adventurer-technique"] },
          "retraining": { "allowed": true }
        }
      ]
    }
  }
}
```

Suppose the system defines a trained defense bonus as character level + 2. At level 3 with agility 2, Combat Training raises rank to trained and defense becomes `10 + 2 + (3 + 2) = 17`. If Guarded Style grants a conditional circumstance bonus of 1, the runtime defense is 18 while its condition holds. A simultaneous circumstance bonus of 2 replaces that bonus under `bestBonusAndWorstPenalty`, yielding 19. Neither temporary bonus qualifies the character for a permanent prerequisite.

The sample refers to other definitions supplied by a future example catalogue. It is a schema illustration rather than a loadable complete character.

## PF2e conversion contract

| PF2e content concept | Generic encoding |
| --- | --- |
| Class's automatic feature | Progression grant to a Feature |
| Class feat slot | Progression choice filtered to an eligible feat catalogue |
| Skill or general feat slot | Independent choice using the corresponding tags and eligibility predicates |
| Subclass decision | Feature containing a choice whose options grant subclass Features |
| Proficiency advancement | Modifier enforcing a minimum rank, with system-defined numeric interpretation |
| Passive bonus | Stat modifier with stacking type, condition, and source |
| New action or reaction | Capability with structured costs and descriptive resolution |
| Focus or other shared limited resource | Named shared resource pool with explicit contribution and recovery rules |
| Feature that bundles benefits | Multiple components or grants to smaller Features |
| Feature with no numeric effect | Descriptive or permission capability |
| Archetype progression | Features, prerequisites, and choices governed by the system |

A conversion record preserves source name, source revision, original content identity, original text where available, modeled components, and automation coverage (`descriptive`, `partial`, or `complete`). Complete coverage means every mechanical clause has a representation; it does not mean an entire combat engine exists.

Do not force a complex ability into a numeric modifier. If a feat changes how an action resolves, model an action rule or leave that clause descriptive with partial coverage. Future extensions should add typed components with validation rather than executable snippets attached to individual feats.

No external PF2e sources or other workspace projects are design references for this draft. Official D&D rules and SRDs are authorized for the first two systems; see the [5e Systems](dnd5e-systems.md). Filling official PF2e class data still requires a later source decision consistent with the user's reference restriction.

## Acceptance criteria for implementation

These are future behavioral checks, not claims that an engine has already been implemented.

| Scenario | Required result |
| --- | --- |
| Two independent choices at one class level | Both remain distinct and each enforces its own pick count |
| Selected Feature grants a child with another choice | Expansion exposes and saves the nested choice |
| Shared definition used in separate valid branches | Instances and their selections remain independent |
| Feature with only descriptive content | It is acquired and shown without changing stats |
| Basic stat changes | All dependent derived stats recalculate |
| Typed positive and negative additions | Stacking preserves the strongest bonus and worst penalty for that group |
| Proficiency upgrade acquired later | Earlier lower floor cannot downgrade it |
| Formula or composition cycle | Validation explains the cycle instead of recursing indefinitely |
| Missing mandatory selection | Build is incomplete and the missing instance path is identified |
| Self-satisfying or mutually circular prerequisites | Build is invalid |
| Selection ignores ordinary prerequisites | Selected instance records the waiver; resource requirements and selection constraints still apply |
| Waived Feature requires an absent resource | Build is invalid and identifies the missing resource |
| Sibling SubFeature supplies the required resource | Consumer validates regardless of sibling presentation order |
| Alternate provider supplies the same compatible resource | Waived original provider ownership is unnecessary; consumer binds to the alternate pool |
| Only resource provider is removed through retraining | Dependents become invalid and require repair |
| Required pool is exhausted | Feature remains acquired; ability use fails if costs cannot be paid |
| Feature capacity references another stat | Capacity follows that stat and preserves expenditure |
| Capacity uses an arbitrary local threshold table | Lookup uses the declared thresholds and boundary policies |
| Table lookup misses a key or exceeds its range | Declared policy applies without implicit interpolation |
| Capacity combines a table lookup and a stat formula | Both contributions evaluate under declared rounding and bounds |
| Resource provider depends on its consumer to validate | Build is invalid rather than circularly self-validating |
| Choice gained earlier than current level | Its acquisition-level eligibility remains stable |
| Retraining a parent choice | Only its owned descendants change, with dependency consequences previewed |
| Resource capacity decreases then increases | Expenditure persists without automatic recovery |
| Ability with multiple insufficient costs | No cost is spent |
| Save and reload | IDs, choices, history, and expenditure survive; totals are recomputed |
| Evaluate the same build twice | Same results, no state mutation or duplicate grants |
| Increase or reduce class level | Correct entries activate or deactivate without duplicating acquisitions |

## React UI plan

Build the UI after the engine and serialization contracts are working. React is the required UI foundation, with TypeScript to share model types. The UI reads definitions and engine results, submits character-edit commands, and renders diagnostics. Calculation, eligibility, stacking, resource binding, and retraining behavior remain engine responsibilities; React components must not implement competing versions of those rules.

The initial application runs in the browser with local character storage and JSON import and export. Cloud accounts, collaboration, and a backend are future scope. A storage adapter should let those capabilities be added without changing the rules engine.

### Navigation and direct content browsing

Provide four main destinations: Characters, Classes, Features, and eventually Create Feature. Class and Feature browsers work without an open character. When a character is open, a browser may additionally show eligibility for a chosen selection slot, clearly distinguished from the definition's general requirements.

| Destination | Required behavior |
| --- | --- |
| Characters | List saved characters, create a draft, reopen, duplicate, import, and export |
| Class browser | Search and filter by system, source, and tags; inspect full progression grouped by class level |
| Class detail | Show every independent grant and choice at each level, with links to referenced Features |
| Feature browser | Search and filter by system, source, tags, content level, and automation coverage |
| Feature detail | Show descriptions, components, grants, nested choices, prerequisites, resource requirements, scaling tables, and source revision |
| Character builder | Edit identity, system-driven basic stats, progressions, and level-by-level Feature selections |
| Character sheet | Show calculated stats, acquired Features, usable abilities, resource capacity and expenditure, and explanations |
| Feature editor | Future authoring workflow for new reusable definitions, preview, validation, and revision management |

Use addressable detail routes based on stable IDs so content can be opened directly, bookmarked, and navigated with browser back and forward. Preserve source system and revision in the resolved detail context. Expand composite Features progressively, with a breadcrumb or ownership path for nested items; a definition detail must not imply that a character has acquired it.

### Character creation and editing

Character creation starts with a name and rules system, then system-defined inputs and class progressions. System-specific ancestry, background, or other origins should appear as root Feature choices when the system defines them. No fixed six-attribute screen or PF2e-specific class list belongs in the generic UI.

1. Create a draft with pinned system and content revisions.
2. Enter basic stats using system-defined labels, constraints, defaults, and help text.
3. Choose legal class progressions and attained levels; show automatic grants separately from selectable entries.
4. Work through independent choice slots by level. Selecting a Feature reveals any nested choices and parameter inputs immediately.
5. Review provisional stats, missing choices, eligibility issues, and resource dependencies as the draft changes.
6. Save the draft at any time. Mark it complete only when the engine reports a valid build.

Use a level navigation panel, a main selection area, and a character summary with diagnostics on wider screens. Stack these areas on smaller screens, retaining a visible count of unresolved choices. Every independent choice remains visible as its own slot, even when two slots use the same candidate catalogue.

Candidate lists show eligible, ineligible, and pending options with engine-provided reasons. For a selection that ignores ordinary prerequisites, show which requirements are waived and which resource requirements still apply. This policy is authored on the selection; a player cannot switch it on arbitrarily in a character slot. When a sibling choice can provide the missing resource, link the diagnostic to that choice. Recompute candidates when the sibling changes.

Each selection view shows minimum and maximum picks, current count, acquisition level, and parameter requirements. Opening a candidate's detail should preserve the unfinished choice. Invalid imported or retrained selections remain visible for repair, rather than disappearing from the UI.

Changing levels or retraining shows the engine's transaction preview: changed Features and stats, affected descendants and independent dependencies, and resource consequences. Allow the user to save an invalid draft while repairing choices; do not present it as a completed legal character. Preserve instance IDs, historical choices, and expenditure according to the engine contract.

### Character sheet and resource controls

Show basic and derived stats with an explanation action that reveals formulas, contributing Features, and applied or suppressed modifiers. Keep permanent build totals distinct from any runtime context, such as an active stance.

Resource controls show capacity, spent amount, available amount, recovery rules, and provider identity. Ability use and recovery invoke explicit engine commands; rendering, reloading, and opening a sheet do not spend or recover resources. If capacity changes, preserve expenditure and explain any resulting change in available uses. Manual expenditure edits, if exposed, are explicit recorded adjustments.

### Future Feature authoring

The Feature editor creates definitions rather than attaching hidden custom logic to a particular character. Begin with identity, description, source metadata, tags, repeat rules, and parameters. Then provide component editors for stat modifiers, automatic grants, nested Feature choices, capabilities, and resource pools.

The choice editor exposes candidate lists or tag queries, pick counts, `ignorePrerequisites`, and retraining rules. The prerequisite editor distinguishes ordinary predicates from nonwaivable resource requirements. The composition editor shows resource providers and consumers across SubFeatures, including unresolved bindings.

A structured expression editor supports constants, stat references, context values, arithmetic, and table lookups. A table editor supports arbitrary numeric rows, exact or threshold lookup, missing-key and boundary policies, and explicit rounding. A preview displays output for representative inputs and a selected sample character, including capacity, expenditure, and validation errors. Users do not need to write executable JavaScript to author Features.

Store unfinished definitions as drafts. Publishing to the local custom-content catalogue requires successful definition and reference validation. Here, publishing means making content available locally, not uploading it to a service. Use a separate custom namespace and create a new revision when editing an existing published definition. Existing characters remain pinned until an explicit migration preview is accepted. Export and import custom content with its dependency manifest; reject missing references or conflicting revisions instead of silently replacing definitions.

### Engine and UI boundary

The engine must expose the following operations before the character builder is implemented. Function names can change; behavior is the contract.

| Operation | UI use |
| --- | --- |
| Validate and load a catalogue | Populate browsers and report invalid content |
| Resolve a definition by ID and revision | Open linked Class or Feature details |
| Evaluate a character draft | Render totals, instance graph, capabilities, pools, and diagnostics |
| Get candidates for a selection instance | Render eligibility, waivers, missing resources, and pending sibling dependencies |
| Preview a character edit | Show retraining and progression consequences |
| Apply a character edit | Update saved inputs, acquisitions, and choices atomically |
| Use an ability or recover a resource | Update expenditure through explicit events |
| Serialize, validate, and migrate saves | Save, reopen, import, export, and upgrade deliberately |
| Validate a Feature draft and evaluate a preview | Support future custom-content authoring |

Keep character commands and persisted data separate from view state such as an open panel or search query. React's local state handles view details; a reducer and context can coordinate the active draft. Cache evaluation results by revision only when necessary, and discard stale results before applying a later edit. Save failures must remain visible; the UI must not claim an edit was persisted when storage rejected it.

### Lightweight tooling suggestions

The following are recommendations, not dependencies already installed. Choose compatible versions and pin them during implementation. Anime5e remains the code-design reference; official D&D sources additionally support the 5e systems. The linked official library documentation supports only these tooling descriptions.

| Tool | Suggested role and adoption |
| --- | --- |
| [Vite](https://vite.dev/guide/) | Development and static production builds; use its React and TypeScript setup |
| [React Router](https://reactrouter.com/start/declarative/installation) | Declarative routes for characters, Class details, and Feature details |
| [React Hook Form](https://www.react-hook-form.com/) | Form handling for stat inputs, parameters, and eventually nested authoring forms |
| [Zod](https://zod.dev/) | Runtime validation and TypeScript inference for schemas and imported data; use shared schemas where possible, while keeping semantic rules in the engine |
| [Radix Primitives](https://www.radix-ui.com/primitives/docs/overview/introduction) | Selected unstyled accessible controls for dialogs, menus, and expandable content; style with plain CSS |
| [Lucide React](https://lucide.dev/guide/react) | Optional SVG icons; import named icons and retain text labels for important actions |

Start with plain CSS or CSS Modules and React's reducer/context for application state. This keeps the initial set of libraries small. Consider additional state management, IndexedDB helpers, list virtualization, or fuzzy search only when character complexity, storage needs, or catalogue size establishes a concrete need. Measure the production bundle before calling the resulting application lightweight; these suggestions do not imply a verified bundle size.

### Accessibility and verification

All inputs need labels, and required selections and errors must be understandable without color. Support keyboard navigation, focus restoration after dialogs, and accessible announcements for validation changes. Collapsed nested Features must reveal where an unresolved choice lives. Use readable layouts across desktop and mobile sizes.

Acceptance scenarios for the UI include creating and reopening a complete character; preserving an incomplete draft; independently filling two same-level slots; resolving nested selections; browsing Classes and Features without a character; exposing resource failures despite prerequisite waivers; repairing retraining dependencies; and exporting and reimporting a character without losing selections or expenditure. The future editor must validate and preview both stat formulas and arbitrary capacity tables before custom content becomes selectable. Verify user workflows in the rendered browser in addition to testing engine and schema behavior.

### Implementation sequence

1. Formal schemas, engine evaluation, resource resolution, transactions, and serialization, with an invented example catalogue.
2. Separate 2014 and 2024 5e systems using authorized official rules and SRDs, following the [5e Systems](dnd5e-systems.md).
3. React application shell and direct Class and Feature browsing using those validated definitions.
4. Character builder, sheet, local save and import/export, retraining previews, and resource commands for both 5e systems.
5. Custom Feature editor, expression and table controls, previews, local catalogue revisions, and migrations.
6. PF2e system and converted content after both 5e systems satisfy their character-building acceptance criteria.

The next deliverable remains the formal schema and calculation engine. The React UI follows it using this contract.
