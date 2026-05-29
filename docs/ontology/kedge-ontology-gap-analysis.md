# kedge-ontology vs Palantir Ontology — Gap Analysis

> Companion to the [design spec](./kedge-ontology-design.md) and the [implementation plan](./kedge-ontology-implementation-plan.md).
>
> **Purpose**: honest inventory of what we borrowed from Palantir's Ontology, what we deliberately rejected, and what we missed and should add. The doc has strong opinions on each item; the rationale is included so a future reader can override any single line.

---

## 0. TL;DR

One row per gap. **Tier 1** = add now (Phase 1 PR); **Tier 2** = MVP follow-up; **Tier 3** = adopt when a Solution actually asks; **Tier 4** = explicit non-goal.

| # | Gap | Category | Tier | Recommendation |
|---|---|---|---|---|
| G1 | **Function Types** — pure, side-effect-free typed computations distinct from Actions | Type system | **1** | Add `FunctionDef` as a sibling of `ActionDef`. Today's "computed property" and "Action with `auditLevel: 'none'`" both lie about intent. |
| G2 | **Action preconditions** — declarative predicates that gate dispatch | Governance | **1** | Add `ActionDef.preconditions`. Today every "if `phase !== 'practice'`" check lives in handler code and is invisible to the agent. |
| G3 | **i18n on `displayName`** — multi-locale labels in the schema | Lifecycle | **1** | Promote `displayName: string` to `displayName: LocalizedString`. Cheap, opt-in via union (plain string still works). Education customer is Chinese-first; English ships later. |
| G4 | **Interface Types** — polymorphism contracts shared by multiple `ObjectTypeDef`s | Type system | **2 ✓ merged** | `InterfaceDef` in design spec §3.8; `ObjectTypeDef.implements`; structural conformance validator in §9.7. |
| G5 | **Predicate-based AccessBoundary** — row-level security expressions, not just path lists | Governance | **2 ✓ merged** | `BoundaryPathEntry` union in §4.4; `BoundaryPredicate` sub-language in §5.5. `'named'` escape hatch via `registerPredicate`. |
| G6 | **Object Sets as first-class types** — named, typed, filtered collections | Type system | **2 ✓ merged** | `ObjectSetDef` in §3.9; `SlotTarget.kind: 'objectSet'`; `PropertyType: 'objectSet'` for Action parameters. |
| G7 | **Declarative validation rules** — business constraints separate from schema types | Behavior | **3 ✓ merged** | `ValidationRuleMeta` sidecar in design spec §3.10 names Zod `.refine()` calls and exposes them to agent projection + compliance queries. |
| G8 | **Object-level state machines** — per-instance lifecycle, not just manifest-level | Behavior | **3 ✓ merged** | `StateMachineDef` in §3.11; bound to z.enum field; transitions optionally name an ActionDef for governance+audit; `op: { kind: 'transition' }` in boundary check. |
| G9 | **Classification tags** — PII / sensitive / regulated markers on properties + actions | Governance | **3 ✓ merged** | `PropertyMeta.classification: readonly Classification[]` (§3.1). Curated core taxonomy `'pii' \| 'sensitive' \| 'regulated'` + open string extension. `registry.getPropertiesByClassification(tag)` for compliance queries. |
| G10 | **Change notification model** — webhook / pub-sub on data change | Behavior | **3 ✓ merged** | `NotificationRule` + `NotificationChannel` in §4.8; declared on `ManifestDef.notifications`; built-in `sse` / `push` channels + `kind: 'named'` escape hatch via `registerNotificationChannel`. |
| G11 | **Action result schema** — typed declaration of what an Action returns | Behavior | **3 ✓ merged** | `ActionDef.returnType?: z.ZodTypeAny` (§3.3); parsed return delivered as `ActionResult.returnValue` (§5.3); projected to agent via `zod-to-json-schema(returnType)`. |
| G12 | **Property-level redaction / masking** — view-time PII protection | Governance | **3 ✓ merged** | `PropertyMeta.redaction?: { roles, strategy, maskTemplate? }` (§3.1). Pipeline in §5.4: applies `mask` / `hash` / `omit` after boundary check, before return. Bundled with G9 as planned. |
| G13 | **Lineage / provenance** — "what produced this StudentAlert?" graph | Lifecycle | **4** | Don't build. Existing `tool_events` audit table already provides per-call traceability. Full lineage graph is a Foundry-scale problem; we don't have it. |
| G14 | **Schema branching with PR review** — propose ontology changes for human review | Lifecycle | **4** | Don't build. Solution registration is already restart-cheap; gate review at code review of the Solution backend. Adding workflow infra here would be redundant. |
| G15 | **Object Set versioning** — snapshot a filtered set for reproducibility | Lifecycle | **4** | Don't build. Audit reproducibility for *manifest instances* (§9.1 of design) covers what customers actually need. Set-level snapshotting is over-engineering. |
| G16 | **Datasource binding** — declarative map from external data to ObjectTypes | Type system | **4** | Don't build. CcaaS has no unified data plane (each Solution owns its DB); imposing a binding layer would force every Solution into a backend redesign for no payoff. |
| G17 | **MDM / golden records** — deduplication, canonical entity resolution | Behavior | **4** | Don't build. Solution-specific concern; this package would only get in the way. |
| G18 | **Geospatial / time-series as first-class property types** | Type system | **4** | Don't build. `type: 'json'` covers the rare cases. Promoting them to first-class types pulls in coordinate-system conventions, indexing semantics, and chart-rendering decisions that belong in the Solution. |
| G19 | **Workshop / Quiver — application builder UI** | (out of scope) | **4** | Don't build. ADR-0001 effectively forbids it: the application layer is each Solution's frontend. We provide schema; Solutions provide UI. |
| G20 | **Custom property type system** — owning our own `PropertyType` union, `PropertyDef` shape, etc. | Type system | **(cleared — different by design)** | Delegate to Zod (runtime) + TypeScript (compile-time). The repo already uses Zod everywhere this would otherwise show up (live-lesson `manifest.schema.ts`, ToolCallerProxy `argsSchema`). Owning a parallel type system would force solutions to declare every field twice. See §2.6. |

**Tier 1 lands in the same PR as Phase 1 of the [impl plan](./kedge-ontology-implementation-plan.md).** Tier 2 graduates to the design spec after Phase 3 ships and a first real `ManifestDef` proves the MVP. Tier 3 has explicit *promotion criteria* documented per-item below. Tier 4 is closed; reopening requires an ADR.

---

## 1. Methodology

### 1.1 What "Palantir Ontology" means in this doc

I am working from public materials about Palantir Foundry's Ontology and AIP layer that were available at training time. Specifically the concepts:

- **Object Types** (typed business objects with properties)
- **Link Types** (typed relationships)
- **Action Types** (governed write operations)
- **Function Types** / **Functions on Objects** (typed, deployable, side-effect-free or side-effect-bearing computations)
- **Interface Types** (polymorphism / shared contracts across Object Types)
- **Object Sets** (first-class typed collections)
- **Branching** (propose ontology changes in isolation, merge after review)
- **Lineage** (provenance graph from datasource through transformation to ontology)
- **Workshop / Quiver / Slate** (application-builder layer atop the Ontology)
- **AIP Agent Studio** (LLM agents that bind to the Ontology as tools)
- **Row-level / column-level security** (predicates that filter what a user sees per row, mask what they see per column)

I am **not** citing specific Palantir API syntax or licensing details — those change and I don't want to anchor a design decision on something that may have evolved. The gap analysis works at the conceptual level. Where I say "Palantir does X," read it as "the public conceptual model of Palantir's Ontology does X" — not "we should match Palantir's exact API."

### 1.2 What "applicable to CcaaS" means

A Palantir capability is *applicable* to kedge-ccaas only if all four hold:

1. **It survives ADR-0001** — the capability doesn't require us to own domain entities or hold a unified data plane in core. (Kills datasource binding, MDM, full lineage.)
2. **It serves agents *and* humans** — Palantir built much of Workshop for humans clicking buttons. We need every primitive to be both human-friendly (Picker) and agent-friendly (semantic projection). (Kills Workshop directly; doesn't kill the *concepts* Workshop is built on.)
3. **Our customers will deploy it** — Chinese government/education bureaus won't accept a deployment that requires Foundry-grade infrastructure. (Kills full lineage graph; argues for runtime schema distribution.)
4. **The first Solution that lands proves we need it** — we're not in the business of preemptive scaffolding. (Sorts Tier 3 vs Tier 2: Tier 2 = "live-lesson MVP needs it"; Tier 3 = "second or third Solution will need it.")

### 1.3 What the Tier labels mean

| Tier | Meaning | Action on this PR |
|---|---|---|
| 1 | Conceptual error — missing primitive collapses two distinct intents into one, or forces a recurring pattern into handler code | Merge into design spec immediately (this PR) |
| 2 | First-MVP follow-up — design spec is correct without it, but the first real Solution will want it | Stays in this doc; graduates after Phase 3 of impl plan |
| 3 | "Adopt when a Solution asks" — useful, but premature without a concrete trigger | Stays in this doc with explicit promotion criterion |
| 4 | Non-goal — gap is real; cost > value for our specific deployment model | Stays in this doc as a decision-of-record; reopening requires an ADR |

---

## 2. Gap inventory

### 2.1 Type system gaps

#### G1 · Function Types (Tier 1)

**Problem.** Today we have `ActionDef` (governed, audited, possibly approval-gated) and `computed: true` `PropertyDef` (read-only derived value on a single object). There is no shape for "a typed, side-effect-free computation that an agent can invoke with parameters" — e.g. *"given these two students and a time window, return their interaction graph."* This collapses into either:
- A `computed` property — but `computed` is per-object and unparameterized.
- An `ActionDef` with `auditLevel: 'none'` and empty `sideEffects` — but the schema then lies about intent: nothing tells the agent (or the reviewer) that this is *definitionally* safe to call.

**Live-lesson example.** `computeEngagementScore(studentId, windowMinutes) → number`. Today this would be either a Service method (invisible to the agent, has to be hand-prompted) or a degenerate Action. Neither is right.

**Palantir's approach.** Functions on Objects (FoO) — typed, deployable, declared at the schema level, distinguished from Actions by the absence of side effects. An agent inspecting the ontology knows which calls are cost-free.

**What we add (Tier 1).** A new `FunctionDef` sibling of `ActionDef`. Conceptual shape: `{ apiName, displayName, params, returnType, semantic, allowedRoles }`. No `sideEffects`, no `auditLevel`, no `preconditions`, no `requiresApproval` — its purity is structural. At the bridge layer, FunctionDef-derived `ToolDefinition`s record audit at `'log'` only (never `'full_diff'`), and `checkBoundary` skips the approval gate entirely.

**Consequence if we don't add it.** The agent will continue to need hand-written hints distinguishing "you can call this freely" from "this writes to the DB." Every prompt-engineering hour spent on that distinction is a hidden symptom of the missing primitive.

---

#### G4 · Interface Types (Tier 2)

**Problem.** Multiple `ObjectTypeDef`s often share a contract: "anything that can be `@`-mentioned in a chat," "anything that can be audited at full-diff level," "anything that participates in a parent/child hierarchy." Today, satisfying these contracts is repeat-yourself — each `ObjectType` re-declares the same properties.

**Live-lesson example.** `Student`, `Teacher`, `Parent` will all be `Mentionable` (icon + searchable name + display template) and `Personal` (PII flag, redaction rules). Today the only way to enforce "every Mentionable has a `searchFields` declaration" is reviewer vigilance.

**Palantir's approach.** Interface Types — abstract contracts declaring required properties + links + actions; Object Types declare `implements: [...]`. Picker/agent/audit layers can query "give me all `Mentionable`s registered" without naming individual types.

**What we add (Tier 2).** `InterfaceDef` (apiName + required property/link/action signatures + semantic) and `ObjectTypeDef.implements: readonly string[]`. Validators at registration check that the implementing type's actual signatures match the interface (structural conformance, not nominal). `OntologyRegistry.getImplementersOf(interfaceName)` enables the "all Mentionables" query.

**Consequence if we don't add it.** Each new domain (post-education) recreates Mentionable / Auditable / Hierarchical patterns by hand. The pattern is invisible across types; reviewers can't enforce it.

---

#### G6 · Object Sets as first-class types (Tier 2)

**Problem.** A *named, typed, filtered collection of objects* shows up everywhere ad-hoc. "Students struggling this session." "Resources used in the last 3 lessons." "Submissions awaiting grading by Teacher Zhang." Today these are derived slots with hardcoded filter logic baked into the manifest, and they can't be:
- Passed as an Action parameter (`bulkFlag(studentSet: ObjectSet<Student>, reason)`)
- Referenced from another manifest (`SemesterPlan` showing "students struggling across multiple LessonSessions")
- Cached or invalidated by a known query key

**Live-lesson example.** Today's `students` slot with `derivedFrom: 'class.contains'` is a degenerate case — unfiltered, just "all of them." There's no syntax for "students whose engagementScore < 30" as a reusable named set.

**Palantir's approach.** Object Sets are first-class — define them with a filter expression over an Object Type; they can be passed around, versioned, and used as parameters or join targets.

**What we add (Tier 2).** `ObjectSetDef { apiName, objectType, filter: SetFilter, semantic }`. `SlotDef` can target an object set (`target: { kind: 'objectSet', name }`). Actions can take `ObjectSet<T>` parameters. The filter is a small declarative expression language (≥, ≤, ==, in, has, and/or) — not a Turing-complete sandbox, by design.

**Consequence if we don't add it.** Multi-object bulk actions ("flag all students in this set") force one-by-one iteration in handlers. Cross-manifest reuse of derived collections becomes copy-paste.

---

### 2.2 Governance gaps

#### G2 · Action preconditions (Tier 1)

**Problem.** Every Action handler today opens with the same pattern: "if `phase !== 'practice'` return early." This pre-dispatch validation is invisible to the agent — it learns the constraint only by trying and failing.

**Live-lesson example.** `adjustDifficulty` should only be callable while `phase === 'practice'`; `endLesson` should only be callable from `phase ∈ {'discuss', 'takeaway'}`. Today, both checks are inside the handlers, and `discoverActions()` will happily list them as available regardless of state.

**Palantir's approach.** Action Type preconditions — declarative predicates over the surrounding state; the runtime evaluates them before dispatch and exposes "available actions in the current context" filtered by satisfied preconditions.

**What we add (Tier 1).** `ActionDef.preconditions: readonly ActionPrecondition[]`. The shape is a small discriminated union: state-equality (`{ kind: 'stateEquals', path, value }`), slot-bound (`{ kind: 'slotBound', slot }`), custom-named predicate (`{ kind: 'named', name, params? }`). `checkBoundary` evaluates them after the role check, before dispatch; failures return `{ allowed: false, unmetPreconditions: [...] }`. `discoverActions()` honors the same evaluation so the agent only sees actions it can actually call right now.

**Consequence if we don't add it.** Two costs: prompt-engineering ("Hint: don't call adjustDifficulty unless phase is practice") and silent failures that look like agent confusion.

---

#### G5 · Predicate-based AccessBoundary (Tier 2)

**Problem.** Today `AccessBoundary.readable` is a list of path strings: `['plan', 'class', 'students']`. There is no syntax for *row-level* filtering like "agent can read all `ClassroomEvent`s but only those for students *in this manifest's class*." We approximate this by reading the whole slot and trusting the handler not to leak; that's not a security claim, it's a contract.

**Live-lesson example.** `LessonSession.boundaries[role='picker'].readable: ['students']` currently means "read all students attached to the bound class." If a teacher in lesson A picks `@` and reaches across to lesson B's roster — § 9.4's `crossManifestSources: ['sibling']` mechanism — we get the *whole* of B's roster, not "B's students who have ever appeared in A." Without predicates, cross-manifest references are coarser than they should be.

**Palantir's approach.** Row-level security expressions on Object Types; predicates can reference the requester's identity (`currentUser.id === student.teacher_id`) or arbitrary fields.

**What we add (Tier 2).** `readable` and `writable` accept either a path string (today's form) or `{ slot: string, where: BoundaryPredicate }`. Predicates reference (a) the requester's `ExecutionContext`, (b) the slot's bound object fields, and (c) manifest state. The same expression sub-language as `ObjectSetDef.filter` (G6) — share the parser.

**Consequence if we don't add it.** Cross-manifest references stay coarse. Audit-grade row-level claims must be made in handler code; the schema cannot prove them.

---

#### G9 · Classification tags (Tier 3)

**Problem.** Properties and actions carry no metadata about regulatory classification (PII, sensitive, regulated). Compliance reports today are case-by-case: "is this property a PII field?" answered by reading the property name and guessing.

**Live-lesson example.** `Student.name` is PII; `Student.engagementScore` is derived analytics; `flagForIntervention.reason` is teacher-authored free text that may incidentally contain PII. None are tagged today.

**Palantir's approach.** Classification tags on Object Types / properties / actions; classification-aware queries (e.g. "list all PII fields accessed by Solution X in the last 30 days") run against the metadata layer.

**What we add (Tier 3 — when first Solution asks).** Add `classification?: readonly Classification[]` on `PropertyDef` and `ActionDef`. `Classification` is an open enum (`'pii' | 'sensitive' | 'regulated' | string`) so Solutions can extend the taxonomy. Audit sink can read it for compliance reporting.

**Promotion criterion.** First time an education-bureau auditor asks "show me every PII property accessed by the live-lesson agent in October 2026."

**Consequence if we don't add it.** Compliance reporting stays manual. Acceptable until we get the first audit demand; expensive thereafter.

---

#### G12 · Property-level redaction / masking (Tier 3)

**Problem.** Some viewer roles should see a property masked, not absent. "Student name shown as 张** to the system auditor" is different from "Student name not in the auditor's readable list" — the latter loses field existence; the former preserves shape.

**What we add (Tier 3).** Bundle with G9: `PropertyDef.redaction?: { roles: readonly BoundaryRole[], strategy: 'mask' | 'hash' | 'omit' }`. `ManifestAccessor.readSlot` applies redaction after the boundary check, before return.

**Promotion criterion.** Same as G9 — adopt together.

---

### 2.3 Behavior gaps

#### G7 · Declarative validation rules (Tier 3)

**Problem.** Schema validation today is structural ("`phase` is one of these enum values"). It is not domain-rule-aware ("`duration` ≤ 60 minutes unless `gradeLevel === '高中'`"). Domain rules live in handler code, invisible to the agent and to other consumers.

**Live-lesson example.** `LessonPlan.durationMinutes` should be ≤ 45 for primary school, ≤ 60 for middle school, ≤ 90 for high school. Today this lives in `LessonService.validateLessonPlan()` and the agent doesn't know about it until a `create` call fails.

**Palantir's approach.** Validation Rules declared per Object Type; evaluated on every write; expose failures to agent and human reviewers with structured reasons.

**What we add (Tier 3).** `ObjectTypeDef.validationRules?: readonly ValidationRule[]`. `ValidationRule = { name, expression: BoundaryPredicate, severity: 'error' | 'warn', message: LocalizedString }`. Evaluated by `checkBoundary` on writes; failures surface in `ActionResult.error` with a `validationFailures: [...]` field.

**Promotion criterion.** First Solution that has more than 3 domain rules currently living in service methods on the same Object Type.

---

#### G8 · Object-level state machines (Tier 3)

**Problem.** `LessonSession` `ManifestDef` has lifecycle hooks (`onActivate`, `onDeactivate`). But individual objects often have their own lifecycle — `Submission` transitions `draft → submitted → graded → reviewed`, and certain transitions need approval. Today this is service-method code; the agent has no idea which transitions are legal from a given state.

**Palantir's approach.** Some Object Types declare a state-machine column; transitions are first-class operations with their own preconditions and audit policy.

**What we add (Tier 3).** `ObjectTypeDef.stateMachine?: { property: string, transitions: readonly Transition[] }` where `Transition = { from, to, action?: string, requiresApproval?: boolean, semantic }`. The named `action` (if present) is the `ActionDef` that performs the transition — gives us governance + audit for free.

**Promotion criterion.** First Solution with an Object Type whose intended lifecycle has ≥4 distinct states.

---

#### G10 · Change notification model (Tier 3)

**Problem.** Notifying the teacher's mobile when `phase` changes today requires handler code that calls an SSE broadcaster, a push-notification service, or both. The notification target is not declared in the schema — review of "what gets notified when" requires reading every handler.

**What we add (Tier 3).** `ManifestDef.notifications?: readonly NotificationRule[]` where `NotificationRule = { on: 'stateChange' | 'actionResult' | 'streamEvent', match: BoundaryPredicate, channel: NotificationChannel, semantic }`. The runtime fires through the existing core notification subsystem; the schema becomes the truth-source.

**Promotion criterion.** Third unique notification handler implementation across Solutions.

---

#### G11 · Action result schema (Tier 3)

**Problem.** `ActionResult.stateChanges` is the only structured return surface. Richer returns (e.g. `bulkFlag` returning a per-student outcome list) are stuffed into the underlying `ToolResult.content[0].text` as JSON blobs the agent re-parses by trial.

**What we add (Tier 3).** `ActionDef.returnType?: PropertyDef` (or an `ObjectTypeDef` reference) — declares what's in the result beyond state changes. The bridge attaches the typed return to `ActionResult.returnValue: unknown` with documented shape.

**Promotion criterion.** First Action whose useful return is more than a single state-change record.

---

### 2.4 Lifecycle gaps

#### G3 · i18n on `displayName` (Tier 1)

**Problem.** `displayName: string` is single-locale. Our primary customer is Chinese-government education; some Solutions will need English at some point; today there's no place to put the English label in the schema.

**Live-lesson example.** `LessonPlan.displayName = '教学计划'` — fine. But the same `ObjectTypeDef` will at some point need `'Lesson Plan'` for an English-localized teacher dashboard. The Solution backend currently solves this by ignoring `displayName` and doing its own i18n; the schema loses information.

**Palantir's approach.** Localized labels at the metadata layer with a default-locale fallback.

**What we add (Tier 1).** Introduce `LocalizedString = string | Readonly<Record<string, string>>` (union, so plain string still works — no breaking change for any Solution that doesn't care). Swap every `displayName: string` in the design spec to `displayName: LocalizedString`. `OntologyRegistry.getDisplayName(def, locale?)` is a thin resolver that returns the matching locale or falls back to the default.

**Consequence if we don't add it.** Schema-driven UIs (post-Phase 3 picker) can't render in English. Adding i18n later is a typed-API breaking change for every consumer; doing it now is a non-breaking union.

---

#### G13 · Lineage / provenance (Tier 4)

**What it would do.** Track "this `StudentAlert` was produced by `flagForIntervention` called from session `sess_abc` in response to `ClassroomEvent ev_xyz` triggered by `Submission sub_42`." Useful for incident investigation.

**Why we don't.** The `tool_events` audit table already provides per-call traceability — `auditId` links Action → invocation context → original session. The full Palantir lineage graph is *transformation* lineage (datasource → dataset → derived dataset → ObjectType), which doesn't apply here because we don't have datasource binding (G16). Reopen if a real incident demands transitive trace we can't get from the audit log.

---

#### G14 · Schema branching with PR review (Tier 4)

**What it would do.** A solution maintainer proposes ontology changes against a branch; reviewers approve; merge promotes the changes live.

**Why we don't.** Solution registration is already restart-cheap — the gate is the Solution backend's own code review. Adding branching infra here would duplicate the review surface. Reopen if a customer ever shares one Solution's ontology across multiple Solution backends with independent maintainers (no such scenario today).

---

#### G15 · Object Set versioning (Tier 4)

**What it would do.** Snapshot a filtered set ("students struggling on 2026-05-29 at 10:30") for reproducibility.

**Why we don't.** Manifest-instance versioning (design §9.1) covers the audit reproducibility customers actually need ("replay this session's state under its original schema"). Set-level versioning is a fine-grained convenience we don't pay the storage cost for. Reopen if compliance asks for "the exact roster of struggling students at decision time" with byte-stable identity.

---

### 2.5 Cleared — deliberately NOT adopted

This section is the most important one: it explains the gaps we accept *as gaps* because the cost of closing them exceeds the value for our specific deployment model. Future contributors should challenge these by writing an ADR, not by sneaking implementations in.

#### G16 · Datasource binding

Palantir's Ontology sits atop Foundry's unified data plane: every Object Type declares which dataset(s) back it, and the runtime materializes objects from those datasets with full lineage. We have no unified data plane — each Solution owns its DB, ORM, and persistence layer — and *imposing* one would force every Solution into a backend rewrite. The ontology stays storage-agnostic; Solutions register `EntityContextProvider`s that bridge to their own data layer.

#### G17 · MDM / golden records

Master data management — deduplication of "Acme Corp" vs "Acme Corporation" into a canonical entity — is intensely domain-specific. The first Solution that needs it should solve it in its own backend with domain-aware matching rules. Putting MDM in this package would either be useless (no opinion on which fields are identity-bearing) or invasive (forces every Solution to adopt a single matching framework).

#### G18 · Geospatial / time-series as first-class property types

Palantir promotes geo-shapes and time-series to typed properties with built-in operators (spatial join, temporal interpolation). The few Solutions that need these can use `type: 'json'` with their own conventions. Promoting them to first-class brings in coordinate-system selection (WGS84? GCJ-02 because we're in China?), indexing semantics, and chart-rendering decisions that belong in the Solution. Reopen if half our active Solutions independently start needing the same temporal-query primitives.

#### G19 · Workshop / Quiver / Slate — application-builder UI

Palantir ships Workshop (dashboards), Quiver (analyst notebooks), Slate (custom UIs) on top of the Ontology. Each Solution in our model owns its own frontend; ADR-0001 effectively forbids us from owning the application layer. We provide schema; Solutions provide UI. The future schema-driven `@Picker` (Phase 3+ follow-up) is a *building block* for Solution UIs, not a Workshop.

A second reason it's not a competitive omission: **Palantir doesn't actually deploy Workshop in education either** — they don't sell into the education vertical at scale (see design spec §1.0). We're not "behind Palantir on the application layer for our domain"; we're operating in a domain where Palantir hasn't shipped any application layer. Our absence here is a non-competition decision, not a feature gap.

#### Why these specifically.

Each item above appears compelling in the abstract — every Foundry demo highlights them. The CcaaS context refutes each one for a specific reason (no data plane / no canonical-entity opinion / no two Solutions share spatial needs / each Solution owns UI). The discipline of writing them down here is the discipline of not chasing parity for parity's sake.

### 2.6 G20 · Type system delegated to Zod + TypeScript

**What Palantir does.** Palantir's Ontology owns a property type system — primitive types, validation rules, format constraints, enum definitions, foreign-key resolution. This makes sense for Foundry: it owns the data plane (Datasets → Pipeline Builder → Ontology), so it owns the types end-to-end.

**What we do.** We do not own the data plane (per ADR-0001 — each Solution owns its DB). Owning a parallel property type system in this package would force every Solution to declare every field twice: once in their TS interface (or Zod schema, or ORM entity) and once in our `PropertyDef`. This is the failure mode an earlier revision of this design fell into; the user diagnosed it as "building a meta-type-system on top of TypeScript we don't need" and triggered the refactor that became the current §3.1.

The Zod-first refactor delegates the type layer:

- **Runtime types**: Zod (`z.string()`, `z.enum([...])`, `z.object({...})`, `.optional()`, `.describe('...')`). Zod is already in this repo for the same purpose: `solutions/business/live-lesson/backend/src/schemas/manifest.schema.ts`, `solutions/business/live-lesson/creator-mcp-server/src/schemas.ts`, and `packages/backend/src/tool-caller/types.ts` (`ToolDefinition.argsSchema: ZodTypeAny`). Introducing a parallel custom shape would make this package the inconsistent one.
- **Compile-time types**: `z.infer<typeof Schema>` — the TS type comes from the Zod schema. No separate `interface Student { ... }` to keep in sync.
- **Wire format**: `zod-to-json-schema(schema)` for the schema-distribution endpoint (§9.6 of design spec) and the agent's anthropic-tools / mcp-tools projections (§11).
- **What survives in our package**: `PropertyMeta` — a tiny sidecar with `searchable`, `displayRole`, `computed`, and per-property `displayName` i18n override. These are governance/presentation hints Zod has no concept of. The sidecar is keyed by `keyof z.infer<Schema>` so misnamed keys are TS errors at the `defineObjectType` call site.

**Why this is "cleared — different by design"**: not a gap we're choosing to leave open, and not a deferred adoption. It's a deliberate, structural difference from Palantir Ontology driven by our deployment model. Belongs in the §2.5 family rather than §2.1 (where the original Tier 4 type-system items live), because the *intent* — owning a type system — was wrong for our context, not the specific feature we'd build under it.

See design spec §3.1 (the new `PropertyMeta`), §3.6 (worked examples using Zod), §10.1 (reconciliation table row for the delegation), §12 FAQ ("Why Zod-first instead of a custom PropertyDef?").

---

## 3. Tiered recommendations (with consequences)

The Tier assignments above are the recommendation. This section restates them as a single ordered list with the "what happens if we override this" call-out for each, so a reviewer can disagree with one row at a time.

### Tier 1 — merge into design spec now (this PR)

- **G1 `FunctionDef`** · If we don't, every prompt that distinguishes "free to call" from "with effect" carries the explanation in the system prompt rather than the schema.
- **G2 Action preconditions** · If we don't, agents will repeatedly call actions that the handler refuses, wasting turns; reviewers can't see the gating logic at all.
- **G3 i18n on `displayName`** · If we don't, adding i18n later breaks every consumer's typed API; doing it now is free (union with string).

### Tier 2 — ✓ merged into design spec (2026-05-29)

Original disposition was "graduate after Phase 3 ships." Promoted ahead of schedule because the Tier 1 merge proved the structural pattern (one shared sub-language, registry-resolved primitives, fail-fast validation) — once the pattern was established, the marginal cost of adding three more primitives was small and the consequences of *not* adding them were already showing up in design discussion.

- **G4 Interface Types** · merged → design spec §3.8 `InterfaceDef`; §3.4 `ObjectTypeDef.implements`; §6 `OntologyRegistry.getImplementersOf()`; §9.7 structural-conformance validator.
- **G5 Predicate-based AccessBoundary** · merged → §4.4 `BoundaryPathEntry` union (back-compat with plain strings); §5.5 `BoundaryPredicate` sub-language + named-predicate escape hatch; §9.7 path/name resolution validator.
- **G6 Object Sets as first-class** · merged → §3.9 `ObjectSetDef` + `SetFilter`; §4.2 `SlotTarget.kind: 'objectSet'`; §3.1 `PropertyType: 'objectSet'` + `objectSetType?`; §6 `getObjectSet()` / `getObjectSetsForType()` / `registerObjectSet()`.

**Shared infrastructure consolidated during merge.** All three Tier 2 items reuse the same first-order predicate sub-language (`BoundaryPredicate` in §5.5). `ObjectSetDef.filter` is structurally a subset of `BoundaryPredicate`; `ActionPrecondition.kind: 'named'` and `BoundaryPredicate.op: 'named'` dispatch to the same `PredicateImpl` registered via `OntologyRegistry.registerPredicate()`. One predicate definition is reusable across all three primitives — single source of truth.

### Tier 3 — ✓ merged into design spec (2026-05-29)

Original disposition was "adopt with named promotion criteria." Promoted ahead of the criteria because the Zod-first refactor (G20) made the marginal cost of each item small — `validationRules` is a sidecar over Zod refines; `stateMachine` binds to a z.enum field already in the schema; `classification` + `redaction` are extra fields on the already-existing `PropertyMeta`; `notifications` reuses the §5.5 BoundaryPredicate language; `returnType` is just a Zod schema. Five items, ~6 KB of design-doc additions, no new infrastructure.

- **G7 Validation rules** · merged → design spec §3.10 `ValidationRuleMeta` (sidecar naming Zod refines); §3.4 `ObjectTypeDef.validationRules`; §9.7 validator enforces name linkage to refine `params.name`.
- **G8 Object-level state machines** · merged → §3.11 `StateMachineDef` + `Transition`; §3.4 `ObjectTypeDef.stateMachine`; §9.7 validator enforces enum-field binding and transition-value validity; §5.5 boundary check gains `op: { kind: 'transition' }`.
- **G9 Classification tags** + **G12 Redaction** · merged together → §3.1 `PropertyMeta.classification: readonly Classification[]` + `PropertyMeta.redaction?: { roles, strategy, maskTemplate? }`; §6 `OntologyRegistry.getPropertiesByClassification(tag)`; §5.4 redaction pipeline in the ManifestAccessor.
- **G10 Change notifications** · merged → §4.8 `NotificationRule` + `NotificationChannel`; §4.6 `ManifestDef.notifications`; §6 `OntologyRegistry.registerNotificationChannel(name, impl)`; §9.7 validator enforces predicate-path resolution.
- **G11 Action result schema** · merged → §3.3 `ActionDef.returnType?: z.ZodTypeAny`; §5.3 `ActionResult.returnValue?`; §11 projection includes `zod-to-json-schema(returnType)` in the action descriptor.

**Shared infrastructure leverage**. Like the Tier 2 merge before it, Tier 3 graduated cheaply because the foundational decisions were already paid for. `validationRules` reuses Zod's `.refine()` (the alternative — a separate predicate expression language — was rejected in §5 Q3). `NotificationRule.match` reuses `BoundaryPredicate` from §5.5. `Classification` is an open string union mirroring `BoundaryRole`'s extensibility pattern. `redaction.strategy` is closed enum because the operational behaviors are bounded. The Tier 3 surface adds **zero** net-new sub-languages — every new field plugs into infrastructure that was built for Tier 1+2.

### Tier 4 — explicit non-goals

- **G13–G19** · Reopening any of these requires an ADR. The cost / value analysis above is the rationale of record.

---

## 4. Impact on existing design spec (when each Tier graduates)

Useful for budgeting future merges. Each row estimates the edit footprint inside `kedge-ontology-design.md` when the listed gap moves into the spec.

| Gap | Tier | §§ that change in design spec | Est. edit size |
|---|---|---|---|
| G1 FunctionDef | 1 | New §3.7; §10.1 reconciliation row; §12 FAQ entry; §2.1 public-API export list | ~1.5 KB |
| G2 Preconditions | 1 | §3.3 ActionDef extends; §5.2 BoundaryDecision extends; §8.5 trace gains step 7.5 | ~1 KB |
| G3 i18n | 1 | New `LocalizedString` type at top of §3; mechanical swap in §§3.1–4.6 TS blocks; §1.7 Principle 6 | ~1 KB total |
| G4 InterfaceDef | 2 ✓ merged | New §3.8; §6 Registry gains `getImplementersOf`; §9.7 validator gains structural-conformance rule | ~3 KB (actual) |
| G5 Predicate boundary | 2 ✓ merged | §4.4 AccessBoundary union; new §5.5 BoundaryPredicate sub-language spec; validator updates | ~4 KB (actual) |
| G6 ObjectSetDef | 2 ✓ merged | New §3.9; §4.2 SlotTarget gains `'objectSet'` kind; §9.6 distribution serializer extends | ~3 KB (actual) |
| G7 Validation rules | 3 ✓ merged | New §3.10 ValidationRuleMeta sidecar over Zod refines | ~2 KB (actual) |
| G8 Object state machines | 3 ✓ merged | §3.4 ObjectTypeDef extends; new §3.11 StateMachineDef + Transition | ~2 KB (actual) |
| G9+G12 Classification + redaction | 3 ✓ merged | §3.1 PropertyMeta extends; §5.4 redaction pipeline note | ~2 KB (actual) |
| G10 Notifications | 3 ✓ merged | §4.6 ManifestDef extends; new §4.8 NotificationRule + NotificationChannel | ~2 KB (actual) |
| G11 Action result schema | 3 ✓ merged | §3.3 ActionDef extends; §5.3 ActionResult gains `returnValue` | ~1 KB (actual) |

**Total if all Tier 1+2 land**: ~13–14 KB added to design spec. Acceptable; the spec stays under 150 KB even at full Tier 2 expansion.

---

## 5. Open questions for the maintainer

Items the gap analysis surfaced that don't have a single right answer yet. Each is worth a design discussion before the relevant tier ships.

1. **Function vs Action boundary policing.** If a `FunctionDef` handler accidentally mutates state, do we detect it (sandboxed handler? runtime contract check?), or do we trust the developer? Recommendation: trust + document, like the rest of TypeScript; revisit only if it becomes a recurring bug source.
2. **Interface Type method dispatch timing.** When `Mentionable` declares a required `displayLine() → string` and `Student` implements it: do we resolve the implementation at registration time (compile-down) or at action-call time (registry lookup)? The latter is more flexible; the former is faster. Recommendation: registration time, with a registry-level override hook if a Solution needs runtime polymorphism.
3. **Predicate sub-language scope.** G5 + G6 + G7 all need a small expression language. How rich? Comparison + boolean + property access is a minimum; we'd need to decide whether to allow function calls (slippery slope) or stay first-order (safer). Recommendation: first-order only; if a rule needs richer logic, escape into a named `Predicate` registered with the registry.
4. **ObjectSet identity.** Two ObjectSets with identical filters — same set or different? Affects caching, audit, and reference equality. Palantir treats them as equal; we may not want to commit to that. Recommendation: structural equality with explicit `apiName` — same `apiName` → same set, regardless of filter equivalence.
5. **State-machine and lifecycle interaction.** G8 (object state machine) and §4.5 (manifest lifecycle hooks) overlap when an object transition fires inside a manifest hook. Order of evaluation, transaction semantics. Recommendation: object-transition fires first, manifest hook gets the post-transition state; if either fails, both roll back.
6. **Classification taxonomy extensibility.** G9 says `Classification` is an open enum so Solutions can extend. Do we curate a core list (`'pii' | 'sensitive' | 'regulated'`)? Recommendation: curate three core values, document the extensibility, refuse to take a position on hierarchy (no "pii implies sensitive"-style derivation).
7. **Zod-to-PropertyMeta codegen.** Some Solutions already maintain rich Zod schemas elsewhere (live-lesson `manifest.schema.ts` is 15+ inner schemas). Would they benefit from a `zod-to-property-meta()` helper that infers reasonable picker defaults (e.g. `displayRole: 'title'` for the first `z.string()`, `searchable: true` for any field with `.describe()` containing certain markers)? Recommendation: defer. Picker hints are intent, not derivation; auto-inferring them risks getting it wrong silently. If a Solution has many ObjectTypes, write a Solution-local helper; the package doesn't take a position.

---

## 6. References

Material that informed the Palantir side of this comparison. All concept-level — no API-spec citations.

- **Palantir Foundry / Ontology** public marketing and documentation (Object Types, Link Types, Action Types, Interface Types, Object Sets, Functions on Objects, Branching, Workshop). Available at `palantir.com` and `palantir.com/docs/foundry/` — exact URLs intentionally not pinned because the structure of those docs changes.
- **Palantir AIP** announcements and demos (2023–2024) covering agents binding to Ontology as tools, AIP Logic, AIP Agent Studio.
- Internal design discussions in this session (transcripts not retained; decisions captured in this doc and the [design spec](./kedge-ontology-design.md)).
- [ADR-0001](../adr/0001-core-must-not-contain-domain-entities.md) — the architectural constraint that rules out G16, G17, G19.
- [Design spec §1.4](./kedge-ontology-design.md#14-why-ontology--the-palantir-inspiration) — the original "borrow thinking, not platform" framing this gap analysis tightens up.

---

> **Maintainer's note**: this doc is the source-of-truth for "what we chose not to build (yet)." Re-open a Tier 4 item only with an ADR; promote a Tier 2/3 item by editing this doc, opening a design-spec PR that integrates it, and crossing out its row in §0 with the merging-PR link.
