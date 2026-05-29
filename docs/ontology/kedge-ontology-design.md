# kedge-ontology — Infrastructure Design Spec

> Authoritative spec for the `@kedge-agentic/ontology` package. Companion: [kedge-ontology-implementation-plan.md](./kedge-ontology-implementation-plan.md) · [kedge-ontology-gap-analysis.md](./kedge-ontology-gap-analysis.md).

---

## How to read this document

This is a ~200 KB / ~3000-line spec. It is **dual-audience**: the first half (§1.0, §1.4, §8.6, §12) answers *why this matters and how to talk about it* — readable by non-technical stakeholders, customers, and decision-makers. The rest (§2–§11) defines the package — readable by engineers implementing or reviewing the schema layer. You can read top-to-bottom, but most readers don't need every section.

**Pick your route:**

| If you are… | Read these sections, in this order | Time |
|---|---|---|
| **Non-technical** (deciding if this matters, explaining it to a colleague, writing a pitch) | §1.0 *(market positioning)* → §1.4 *(seeing vs doing — the mental model)* → §8.6 *(before/after table)* → §12 *(FAQ)* | ~15 min |
| **Engineer** (implementing the package or reviewing the design) | §0 *(Glossary)* → §1 *(full background)* → §2 *(structure)* → §3–§5 *(primitives)* → §6–§7 *(registry + projection)* → §9 *(design decisions)* → §10 *(reconciliation with existing code, **critical**)* | ~45 min |
| **Solution integrator** (writing a Solution that registers ObjectTypes + ManifestDef) | §1.4 *(mental model)* → §3.6 *(worked ObjectType examples)* → §4.7 *(worked ManifestDef)* → §8 *(end-to-end usage)* → §10 *(bridge to ToolCallerProxy)* → §11 *(projection formats)* → [impl plan](./kedge-ontology-implementation-plan.md) | ~30 min |
| **Auditor / Compliance** (what does governance actually look like) | §0 *(Glossary)* → §1.4 *("same map" principle)* → §3.3 *(ActionDef + preconditions + auditLevel)* → §3.1 *(PropertyMeta.classification + redaction)* → §4.4 *(AccessBoundary)* → §8.5 *(end-to-end trace of one governed call)* → §10.3 *(role mapping)* | ~25 min |
| **You only have 5 minutes** | §1.4 *(mental model)* + the §8.6 before/after table. Two pages. Skip everything else for now. | ~5 min |

**Reading conventions used throughout:**

- TypeScript code blocks are the authoritative interface signatures — if prose and code disagree, trust the code.
- **Tier 1 / Tier 2 / Tier 3** annotations refer to the [gap analysis](./kedge-ontology-gap-analysis.md) tiers; all three are merged into this spec.
- Section cross-references like (§5.5) are always to *this* document. References to other docs are spelled out as full filenames.
- File paths starting with `packages/`, `solutions/`, or `docs/` are absolute from the repo root.
- Chinese terms (即见, 课堂会话) appear without translation when they are platform-internal product names; one-time translations are given inline.

**If something is unclear**, the [FAQ in §12](#12-faq) collects the questions that have come up across the design discussions that produced this spec; check there before assuming the doc is wrong.

---

## 0. Glossary — terms you'll see throughout

A short reference for vocabulary used across this doc and the wider repo. Most terms come from either Palantir-style ontology language or from the existing kedge-ccaas platform.

| Term | Meaning |
|---|---|
| **kedge-ccaas / Jijian (即见)** | The "Claude Code as a Service" platform this package ships into. NestJS backend (`packages/backend`) + several frontends + per-domain solution backends under `solutions/`. |
| **Solution** | A self-contained product built on the platform. Each Solution has its own `solution.json` manifest, its own backend (port ≠ 3001), and its own database. Examples: `live-lesson` (the education product), `demo-sandbox` (B2B SaaS demo), `recipe-book` (reference impl for the @Picker/context-layer plumbing). |
| **Solution backend** | A NestJS service owned by one Solution. Domain entities live here (per ADR-0001). Live-lesson's backend is on port 3007; the core ccaas backend is on 3001. |
| **Session** | One conversation between an end-user and an agent. Persisted in core (`packages/backend/src/sessions/`). Carries `solutionId`, optional `actingUserId`, and a workspace. |
| **Workspace** | The per-session filesystem the agent operates in. Provider is pluggable (`local` or `agentfs`). See [gitbook → Runtime 架构](../gitbook/zh/platform/runtime-architecture.md). |
| **Skill** | A reusable agent-behavior bundle (system prompt, allowed tools, trigger rules). Registered per-Solution at boot via `npm run skill:import`. |
| **MCP server** | A tool surface the agent can call. Two flavors: stdio (in-process child) and rest-adapter. Declared in `solution.json` → `mcpServers`. |
| **ToolCallerProxy** | The 6-step pipeline every solution-scoped tool call passes through (sanitize / Zod-validate / permission / context-inject / dispatch / audit). Lives at `packages/backend/src/tool-caller/`. Bound by ambient identity, never agent-asserted. |
| **`ExecutionContext`** | The platform-asserted identity envelope on every tool call: `{ solutionId, sessionId, actingUserId?, actingRole?, apiKeyId?, effectiveScope? }`. Read-only from the agent's perspective. |
| **`@Picker` / "At-picker"** | The frontend reference-selection UI: user types `@`, sees objects to insert. Today lives in `packages/context-layer-react/src/AtPicker.tsx`, backed by `EntityRegistry`. |
| **EntityRegistry** | Today's in-memory registry of pickable types (`packages/context-layer/src/core/entity-registry.ts`). The closest existing primitive to the proposed `OntologyRegistry`. |
| **`ReferenceableOptions`** | Today's per-type registration shape (icon, search/browse abilities, relations). Closest existing primitive to the proposed `ObjectTypeDef.picker`. |
| **`EntityContextProvider`** | Today's per-type contract for `getContext / search / serialize / edit`. Closest existing primitive to the proposed `ManifestAccessor`'s read/edit surface. |
| **`DocumentEditProvider`** | Today's abstract base class for entities that round-trip through `entity-document` blocks. Handles `field_set` and `str_replace` edits. The recipe-book provider is the reference implementation. |
| **`ManifestDef` (this package)** | A schema-level *composed operational context*: which objects are in scope, what runtime state exists, who can see/do what, what lifecycle hooks fire. Formalizes what `Lesson.manifestJson` already does ad-hoc in live-lesson. |
| **`ObjectTypeDef` (this package)** | A typed business object (LessonPlan, Student, Resource) defined by `{ schema: ZodObject, meta?: PropertyMetaMap, links, actions, picker? }`. The Zod schema is the source of truth for shape and per-field semantics; the meta sidecar carries presentation/governance hints. |
| **`PropertyMeta` (this package)** | Per-field sidecar carrying `searchable`, `displayRole`, `computed`, and optional i18n `displayName` — *only* what the Zod schema can't express. Keys constrained to `keyof z.infer<Schema>` at compile time. |
| **Zod** | Runtime type-validation library used as kedge-ontology's source-of-truth for field shapes, types, constraints, and per-field semantic text (via `.describe('...')`). Repo precedent: `live-lesson/backend/src/schemas/manifest.schema.ts`, `creator-mcp-server/src/schemas.ts`, `ToolCallerProxy.argsSchema: ZodTypeAny`. |
| **`ActionDef` (this package)** | A governed operation: typed params, declared side effects, allowed roles, audit level. At registration, compiles down to a `ToolDefinition` registered with `SolutionToolkitRegistry` so `ToolCallerProxy` enforces it. |
| **`AccessBoundary` (this package)** | The per-role declaration of what's readable / writable / actionable / subscribable inside a manifest. Maps to existing `UserRole` + `ApiKeyScope` via §10.3. |
| **`semantic` field** | A natural-language description carried by every primitive that declares it. The LLM reads `semantic` text to reason about meaning. Required — empty strings fail registration. |
| **Palantir Ontology** | Palantir Foundry's operational layer (Object Types, Links, Actions). The conceptual ancestor of this design; see §1.4 for the differences. |
| **OSDK** | Palantir's "Ontology SDK" — generated typed client libraries. We do *not* build one; the schema is exposed at runtime via a REST endpoint (see §9.6). |
| **ADR-0001** | "Core backend must not contain domain entities" — the architectural constraint that forces all concrete `ObjectTypeDef` instances into solution backends, not into this package. |

> **Sister document**: [kedge-ontology-gap-analysis.md](./kedge-ontology-gap-analysis.md) — what this spec *intentionally* does not yet include vs Palantir Ontology, organized by Tier 1–4.
>
> **Tier 1 (merged)**: `FunctionDef` (§3.7), `ActionDef.preconditions` (§3.3), `LocalizedString` displayName (§3.0).
> **Tier 2 (merged)**: `InterfaceDef` (§3.8), `ObjectSetDef` (§3.9), predicate-scoped `AccessBoundary` + `BoundaryPredicate` sub-language (§4.4 + §5.5).
> **Tier 3 (merged)**: `ValidationRuleMeta` (§3.10), `StateMachineDef` (§3.11), `PropertyMeta.classification` + `.redaction` (§3.1), `NotificationRule` (§4.8), `ActionDef.returnType` + `ActionResult.returnValue` (§3.3 + §5.3).
> **Tier 4** (lineage, schema branching, set versioning, datasource binding, MDM, geo/time-series types, Workshop, custom type system): explicit non-goals; reopening requires an ADR.
>
> Read both docs together if you're auditing the design surface.

---

## 1. Background: where we are and why this matters

### 1.0 Why this is uncharted territory

Before diving into platform context (§1.1) and primitives (§3+), it's worth establishing that what `kedge-ontology` is attempting — applying a Palantir-style operational Ontology (semantic + kinetic + governance, integrated) to education — has no direct precedent. We did the research; this is the lay of the land.

**Globally:**

- **Palantir itself does not do education.** Core customers are defense, intelligence, supply chain, healthcare, energy. The one education-adjacent case we could find is Ukraine's Ministry of Education signing with Palantir in 2024 to model funding allocation for school air-raid shelters and to network displaced children's remote learning — public-sector resource allocation, not the core entities of education (curricula, knowledge points, learning state, teaching strategies). The US Department of Education uses Palantir for foreign-funding reporting portals — again, administrative data management.
- **No academic papers** that we found apply Palantir's Ontology paradigm as a framework for analyzing or designing education systems. The literature treats knowledge graphs in education as descriptive semantic structures, not as operational layers.

**In China:**

- Heavy use of "knowledge graph" (知识图谱) in education-IT — modeling subjects, concepts, theorems, knowledge points, learning ability dimensions, learning-state, exam-performance, and adaptive learning-path recommendations.
- **All of this stays in the traditional semantic layer** — descriptive, static, retrieval-oriented. No one promotes *action* and *governance* to first-class citizens inside the education data model.

**Why the gap exists:**

1. **Palantir's commercial range doesn't include education.** Foundry deployments target customers who can pay enterprise rates and have data infrastructure to integrate. The Chinese education-bureau buyer profile is neither.
2. **Education's core entities aren't physical assets.** A factory has machines, products, shipments — objects with stable identity and clear operations. A classroom has "knowledge points," "cognitive states," "teaching strategies," "learning behaviors" — entities whose definitions are theory-laden (constructivism vs behaviorism vs cognitivism produce radically different ontologies of the same lesson). Building an `ObjectTypeDef` for `Student` is easy; building one for `MisconceptionSignal` is a methodological commitment.
3. **Kinetic layer is particularly valuable in education but no one has built it.** Learning-state data isn't useful as a static report — it needs to *drive action* (push targeted exercises, adjust pacing, trigger interventions) *under governance* (permissions, audit, compliance, especially in regulated education markets). This is exactly what Palantir-style Ontology delivers, but Palantir hasn't pointed it at education, and education-IT vendors haven't reached for this paradigm.

**Bottom line:** what `kedge-ontology` formalizes for education has no direct precedent in either theory or practice. The conventional reaction to "why hasn't anyone built this?" — "it must not be valuable" — is wrong here. The conventional reasons (no business case, no problem to solve) don't apply; the actual reasons (Palantir's go-to-market, education's entity-definition ambiguity, the kinetic-layer omission) are removable barriers, not signals of low value.

This is the *market* justification for the technical work that follows. The rest of §1 covers the *internal* context — what platform this package plugs into, what specific gaps in our current code motivate it, and what design principles guide the primitives.

### 1.1 Jijian (即见) platform context

Jijian is a Claude Code as a Service (CcaaS) platform for B2B customers. Its core architecture:

- **Multi-tenant**: user management with organization/workspace isolation. Tenancy slug is the `solutionId` carried on every cross-cutting type (e.g. `ExecutionContext.solutionId` in `packages/backend/src/tool-caller/types.ts`).
- **Session Templates**: role-based agent configurations that define how AI agents behave in specific scenarios.
- **Engine-agnostic harness layer**: supports Claude Code, OpenCode, or self-implemented agentic engines as pluggable backends.
- **Three-tier authorization** (the actual implementation, see `packages/backend/src/auth/types.ts` and `packages/backend/src/users/entities/user-solution.entity.ts`):
  - **API-key scopes** (`ApiKeyScope`): 10 capability flags — `skills:read|write|execute|delete`, `mcp:read|write`, `chat`, `analytics:read`, `builder`, `admin`. The key prefix is `sk-` (`API_KEY_PREFIX`), not the previously-aspirational `jj_*` notation.
  - **Per-tenant role** (`UserRole`): `'admin' | 'developer' | 'viewer'` recorded in the `user_tenants` join table (`UserSolution` entity), with role hierarchy `admin > developer > viewer`.
  - **Ambient execution identity** (`ExecutionContext`): bound at session creation, never agent-writable; carries `solutionId`, `sessionId`, `actingUserId`, `actingRole`, `apiKeyId`, `effectiveScope` (a `'own' | 'subordinate' | 'org' | 'all'` data-scope hint — stub today).
- **Tech stack**: NestJS backend, Vue 3 / React frontends, HTTP Streaming (SSE) for real-time agent event tracking.

The first major deployment is a PoC for a Chengdu district education bureau, building a precision teaching platform (精准教学平台) that serves 100+ schools. This platform covers the full lesson lifecycle: lesson preparation (备课), lesson execution (授课), classroom observation (课堂观察), and administrative oversight.

> **Authoritative auth references — read alongside this doc**
> - `packages/backend/src/auth/types.ts` — `ApiKeyScope`, `ApiKeyMetadata`, `RequestContext`
> - `packages/backend/src/users/entities/user-solution.entity.ts` — `UserRole`
> - `packages/backend/src/tool-caller/types.ts` — `ExecutionContext`, `ToolCallRequest`, `ToolInvocation`
> - `docs/design-tool-caller-proxy.md` — the ambient-identity contract this package consumes

### 1.2 The @Picker: what it is and why it matters

The @Picker is a core interaction component in Jijian. When a user (teacher, agent, or admin) is composing content — writing a lesson plan, adjusting a live lesson, or reviewing student data — they type `@` to reference other objects in the system. The @Picker is responsible for:

- Showing what types of objects are available to reference (resources, curriculum standards, students, etc.)
- Searching and filtering within an object type
- Allowing the user to "drill down" through relationships (e.g., from a curriculum standard to the resources aligned to it)
- Resolving the selected reference into a structured object that can be consumed by the agent or embedded in the document

A v1 of this Picker already ships in `packages/context-layer-react/src/AtPicker.tsx`, backed by an in-memory `EntityRegistry` (`packages/context-layer/src/core/entity-registry.ts`) populated via the `ReferenceableOptions` shape (`packages/context-layer/src/core/interfaces.ts`). Its limits today:

- Type registration, traversal, and search live in `context-layer` and are loosely coupled to the agent's view of the world (different shape; different consumer).
- There's no first-class **action** notion on `ReferenceableOptions` — actions exist only as `EntityContextProvider.apply` / `.edit` hooks per type, not as discoverable, semantically-described, governance-bearing operations.
- There's no **manifest** notion — i.e. no way to declare "these objects together form an operational context with state, lifecycle, and a per-role access boundary."

`kedge-ontology` is the next layer up: a schema that the Picker, the Agent, and the audit layer all consume.

### 1.3 The Agent operating boundary problem

As the platform moves from "Agent reads and analyzes" to "Agent reads, reasons, and acts," a critical gap emerges.

**Today's state**: When an Agent operates within a lesson session, it needs to understand the teaching plan, the class roster, the real-time event stream from classroom observation (produced by GLM-4.7-Flash structured extraction), and the available teaching resources. Currently, this context is assembled ad-hoc — each use case manually wires together which data the Agent can see and which tools it can call.

**The problem**: Every new Agent capability (adjust difficulty, suggest resources, flag a student for intervention) requires bespoke code to:

1. Assemble the relevant objects into the Agent's context
2. Define what the Agent can read vs. write
3. Wire up permission checks against the API-key scope + per-tenant role system
4. Add audit logging for the action

This doesn't scale. As the platform expands from education to other verticals (the B2B vision), the per-scenario wiring cost becomes prohibitive.

**What we need**: A declarative way to say "in this operational context, these objects are in scope, this state exists, the Agent can read X, write Y, and perform actions Z — and all of this is governed by the same auth system." The infrastructure to enforce that declaration largely *exists* today (it's the `ToolCallerProxy` 6-step pipeline in `packages/backend/src/tool-caller/tool-caller-proxy.service.ts`); what's missing is the schema the proxy can be told to enforce.

### 1.4 The mental model: semantic layer vs kinetic layer — "seeing" vs "doing"

This is the single most important concept in the document. Once you have it, every primitive in §3+ makes immediate sense; without it, the package looks like a generic typed-schema library and the distinction between `ObjectTypeDef` and `ManifestDef` looks arbitrary.

> **"The gap between seeing and doing is why most digital-transformation projects fail."**
>
> Traditional data integration pulls data from scattered systems into a warehouse, then produces reports and analytics. But integrated data is still just "tables and numbers" — you see "Table A, row 3742" without knowing whether that's an admission date or a surgery schedule. The first useful move is turning data into *things*: not tables and fields, but "Patient Zhang Wei," "his second hospital admission," "the surgery on March 15," "the cardiac stent from batch X" — and the relationships between them. This is the **semantic layer**. Many products do this — knowledge graphs, master-data platforms, data-mesh layers.
>
> Palantir's distinctive move is what most products *don't* do: add a kinetic layer on top of the semantic layer. Not just letting you see the surgery is scheduled for March 15, but letting you *reschedule it* directly on this live map — the system automatically checks operating-room, surgeon, and equipment availability; executes if satisfied; records who made the decision and when. This operation is a declared, governed business action — with preconditions, cascading effects, approval flows, and audit records. This is the **kinetic layer**.
>
> The same map for humans and AI. The "map" you see is the "map" you operate. AI Agents operate on the same map, under the same governance, leaving the same audit trail. There is no second world where the agent's actions happen — the agent is a participant in the operational system, not a spectator with privileged write access.

#### Why this matters specifically for AI Agents

Agents that can only consume a semantic layer are *more sophisticated search engines* — they can answer "what is the surgery schedule?" or "which students are struggling?" but they cannot *change* anything without falling outside the system's governance: they call out to some bespoke handler, which writes via some bespoke API, which the audit log may or may not capture. Every agent capability becomes a one-off integration, and every integration is a potential safety failure.

A kinetic layer collapses this to a single contract: the agent's writes are declared `ActionDef`s on the same `ObjectType`s the agent reads. The same permission system that governs human writes governs agent writes. The same audit log records both. The agent *can't* write outside that contract because there is no other path — the platform owns the chokepoint (`ToolCallerProxy` in our case, §10.5).

#### Mapping to education

**Pure semantic layer** (what Chinese education knowledge-graphs do today): the system knows "this is Grade 3 Class 2's math class, the lesson is *Sum of Interior Angles of a Triangle*, Teacher Wang is teaching, 42 students enrolled." The Agent can query these facts, but its relationship to *this specific class period* is the same as reading a Baidu Baike entry — it can look, but it cannot touch.

**With a kinetic layer added**: this class period stops being an entry and becomes a runtime operating context that can be entered, perceived, and operated. What the Agent can do becomes a clearly enumerated list:

- **Subscribe to observation** — real-time event stream (students raising hands, teacher questions, small-group discussions starting) — not after-the-fact static reports
- **Read state** — which teaching phase is current, which resource is active, how much time has elapsed
- **Write judgments** — flag "student engagement dropping in this phase," record "key misconception emerged at minute 12"
- **Trigger actions** — push an immediate exercise, suggest difficulty adjustment, send a hint to a specific student

Every operation carries governance: the Agent can observe but not modify the lesson plan; can suggest difficulty changes but requires teacher confirmation; all operations have audit records; different agent roles see different boundaries.

#### One-sentence summary

> **The semantic layer lets the Agent know "what kind of class this is." The kinetic layer lets the Agent *participate in this class*. The first is cognition; the second is agency. An Agent with only cognition is a more sophisticated search engine. An Agent with agency is a real teaching collaborator.**

#### Why we borrow the thinking, not the platform

Palantir built this as a heavy enterprise platform (Foundry) with its own data infrastructure, deployment model, and generated client SDKs (OSDK in TypeScript/Python/Java). We can't use Palantir directly — Chinese government/education customers won't deploy it, our CcaaS model is fundamentally different, and ADR-0001 forbids us from owning the data plane in the first place. But the **conceptual move** — semantic layer with first-class kinetic on top, governed and audited as one system — is portable. That's what `kedge-ontology` implements, in lightweight, framework-agnostic TypeScript that survives the deployment constraints our customers actually have.

### 1.5 What kedge-ontology is (and is not)

`kedge-ontology` takes the conceptual model from Palantir's Ontology and adapts it for the Jijian context: a lightweight, framework-agnostic TypeScript package that provides schema primitives and access protocols, without the heavy platform infrastructure.

**The key adaptation**: Palantir's Ontology was designed for human operators clicking buttons in Workshop/Quiver. `kedge-ontology` must also serve LLM-based Agents that need to *discover* what objects and actions exist, *reason* about their semantics, and *decide* which actions to take — all without hardcoded tool definitions. This means the schema must carry natural-language semantics alongside structural types.

**It is**:

- A shared type system consumed by backend (NestJS), frontend (@Picker/Vue/React), and Agent runtime
- A manifest composition model that defines Agent operating boundaries
- An accessor protocol that governs read/write/action permissions

**It is not**:

- A database ORM or query builder (the data layer is Jijian's concern)
- A UI component library (the @Picker UI components in `context-layer-react` remain there)
- An Agent framework (the agent engine is pluggable — Claude Code, OpenCode, etc.)
- A bypass of [ADR-0001](../adr/0001-core-must-not-contain-domain-entities.md). The ontology package itself ships **zero** domain types. It defines the meta-types (`ObjectTypeDef`, `ManifestDef`, `InterfaceDef`, `ActionDef`, `FunctionDef`, `ObjectSetDef`, `PropertyMeta`, `BoundaryPredicate`); concrete `LessonPlan` / `Class` / `Student` `ObjectTypeDef` instances are defined in `solutions/business/live-lesson/backend/` and registered at solution-import time.

### 1.6 What this package enables — the concrete payoffs

1. **@Picker becomes schema-driven.** Instead of hardcoding "when the user types @, show these 5 types with these search fields," the Picker reads the `ObjectTypeDef` registry and dynamically renders what's available, what's searchable, and what links are traversable. Adding a new referenceable object type means registering a new `ObjectTypeDef`, not modifying Picker code. (Today's `EntityRegistry` already approximates this; the ontology formalizes it and unifies the shape with the Agent's view.)
2. **Agent context assembly becomes declarative.** Instead of bespoke code to assemble "what the Agent sees" for each use case, you define a `ManifestDef` that declares slots, state, and access boundaries. The Agent runtime loads the manifest and operates within its declared scope.
3. **Governance is built-in.** The existing `ApiKeyScope` + `UserRole` model maps to `AccessBoundary` roles. When an Agent calls `executeAction`, the boundary check and audit log happen *through the existing `ToolCallerProxy` pipeline* — `ActionDef`s compile down to `ToolDefinition`s, and the proxy enforces the boundary the schema declares. This is especially important for education-bureau customers who need auditability.
4. **New verticals reuse the framework.** When Jijian expands beyond education, new business domains define their own `ObjectTypeDef`s and `ManifestDef`s. The Picker, Agent access protocol, and governance layer work unchanged.

### 1.7 Design principles

1. **Schema is data, not code.** All definitions are serializable plain objects — no classes, no decorators. Where types and constraints have a natural runtime representation, we use Zod (which already underlies `ToolCallerProxy.argsSchema` and live-lesson's `manifest.schema.ts`); where the schema carries pure metadata (links, actions, boundaries, lifecycle), we use plain TS interfaces with `readonly` fields. Both forms serialize through `getSchemaDigest()` into the runtime distribution endpoint (§9.6). The point: nothing in the schema layer relies on framework-specific decorators or class machinery — everything travels between NestJS, Vue, React, and Agent processes as JSON. (In-repo precedent for the data-not-code split: `solutions/business/live-lesson/frontend/.../board-data.js` + `board-renderer.js`.)
2. **Manifest over flat model.** The interesting unit is not a single `ObjectType` but a *composed operational context* — a `Manifest` that binds multiple objects into a workspace with explicit state, lifecycle, and access boundaries.
3. **Same schema, multiple consumers.** @Picker reads the schema to know what's selectable, traversable, and displayable. Agent reads the schema to know what's readable, writable, and actionable. Admin reads the schema to know what's auditable. The schema drives all three without each needing its own model.
4. **Semantic-aware.** `kedge-ontology` carries natural-language semantics on properties, links, and actions so that LLM-based Agents can discover and reason about them without hardcoded tool definitions. The `semantic` field is **required**, not optional — its absence at registration time is a validation error.
5. **Governance is structural.** Access boundaries, approval requirements, and audit levels are declared in the schema, not bolted on at the application layer. The schema is enforceable input to `ToolCallerProxy`, not advisory metadata.

6. **i18n is opt-in, not retrofitted.** Every primitive that carries a `displayName` accepts either a plain string (today's common case — Chinese-only) or a locale-keyed map. The union shape means single-locale Solutions write the simpler form unchanged; multi-locale Solutions add the map when they need it. Forcing every consumer to pass a `Record` would be a typed-API breaking change to satisfy a future need; the union is free now and never breaks anyone later. (See [gap-analysis G3](./kedge-ontology-gap-analysis.md#g3--i18n-on-displayname-tier-1).)

### 1.8 Platform architecture in one page (for external readers)

If you've never read the kedge-ccaas codebase, this is the minimum context you need to understand what `kedge-ontology` plugs into.

**Topology** (representative ports — all configurable):

```
┌────────────────────┐     ┌──────────────────────┐
│  Browser (Vue 3 /  │     │  Agent Engine        │
│  React + SSE)      │     │  (Claude Code /      │
│  - Picker UI       │     │   OpenCode subproc)  │
│  - Chat panel      │     │                      │
└─────────┬──────────┘     └──────────┬───────────┘
          │  HTTPS                    │  stdio + MCP
          │  + SSE                    │
          ▼                           ▼
┌──────────────────────────────────────────────────┐
│  Core ccaas backend  (NestJS, :3001)             │
│  - Sessions / Skills / Auth / Files              │
│  - ToolCallerProxy (the governance chokepoint)   │
│  - MCP server pool                               │
│  - SSE event relay                               │
│  - Sandbox + Workspace runtime                   │
└────────┬───────────────────────────────┬─────────┘
         │  REST                         │  REST
         │  (per-solution domain calls)  │
         ▼                               ▼
┌────────────────────┐         ┌────────────────────┐
│  live-lesson       │   ...   │  demo-sandbox      │
│  backend (:3007)   │         │  backend (:38xx)   │
│  - Lessons         │         │  - Customers       │
│  - Classroom       │         │  - Plans           │
│  - Observation     │         │  - Revenue         │
│  - manifest.json   │         │  - static entities │
└────────────────────┘         └────────────────────┘
```

**Key invariants:**

- The agent never talks directly to a solution backend. Every effect the agent has on the world goes through `ToolCallerProxy` in core.
- Solution backends are independent NestJS services. Each owns its own database (recipe-book is in-memory, live-lesson is SQLite, demo-sandbox is static JSON). They depend on `@kedge-agentic/common` and `@kedge-agentic/context-layer` from the workspace.
- A "solution" registers itself with core at boot by POSTing its `solution.json` and skill files. After registration, the core backend knows the solution's MCP servers, session templates, and (after this package lands) ontology.
- The browser **never holds a CCAAS API key**. The recommended pattern is "solution backend as proxy" — see `solutions/business/live-lesson/CLAUDE.md` "Creator app env" + `ccaas-proxy-pattern` memory file.

**Auth identity in one sentence**: every authenticated request carries a `RequestContext` (`packages/backend/src/auth/types.ts`) with `{ solutionId, tenant, apiKeyScopes, userId?, userTenant? }`. At session creation, the platform crystallizes this into an `ExecutionContext` (`packages/backend/src/tool-caller/types.ts`) which travels with every subsequent tool call and which the agent cannot edit. That `ExecutionContext` is the source of truth for the `BoundaryRole` in this package's `AccessBoundary` checks (mapping table in §10.3).

### 1.9 Where live-lesson is today (the most important reference reader)

This package is being introduced primarily to formalize patterns that live-lesson is already groping toward. If you understand live-lesson's current state, you understand 80% of why the package exists.

**The product**: an AI-driven interactive teaching system. Teachers author a "lesson plan" (a JSON manifest with sequenced steps), then run live classroom sessions where students join via a 6-char code (e.g. `HX3KM7`), submit exercises, and an AI observes/coaches.

**The artifacts that exist today** (file paths absolute from repo root):

- **Lesson manifest** as JSON-on-disk + JSON-in-DB. See `solutions/business/live-lesson/data/lessons/math-difference-of-squares/manifest.json` for a real one (a 平方差公式 / "difference of squares" lesson for 8th grade). The DB entity `Lesson` (`solutions/business/live-lesson/backend/src/adapters/persistence/entities/lesson.entity.ts`) stores it verbatim in a `manifest_json` column.
- **Manifest schema** in Zod, defining what a valid lesson looks like — `solutions/business/live-lesson/backend/src/schemas/manifest.schema.ts`. It validates `readingSteps[]`, `answerKey`, `phaseConfig`, `studentView`, `teacherView`, etc. A successful parse means "this manifest is loadable."
- **Classroom session** as a runtime concept — `ClassroomSession` entity holds `{ code, lessonId, status: 'waiting' | 'active' | 'ended', currentStep, startedAt, endedAt }`. Multiple sessions can run the same lesson concurrently.
- **Creator MCP server** — `solutions/business/live-lesson/creator-mcp-server/src/index.ts` exposes three stdio tools (`emit_todo_card`, `emit_questions_card`, `emit_verify_card`) that the agent calls to render rich cards instead of plain text. These are declared in `solution.json` with `proxyEnabled: true` and `toolEventTriggers` mapping the tool result to an SSE `output_update` event with field `card`.
- **Observation engine** — six event handlers in `solutions/business/live-lesson/backend/src/adapters/observer-engine/handlers/` react to classroom events (student join, exercise submit, AI chat turn, status change, step complete, system event). The observation stream is the source of the agent's awareness of what's happening live.
- **Exercise plugin system** — 11 exercise types (quiz, match, matrix, stance, order, select-evidence, map, image-upload, guided-discovery, …) each with a plugin/grader/observe/sanitizer/spec. The "type registry" pattern (`ExerciseTypeRegistry`) auto-discovers `@ExerciseType('quiz')` decorated classes.

**A real lesson manifest looks like this** (excerpt — see the full file at the path above for the rest):

```json
{
  "id": "math-difference-of-squares",
  "locale": "zh",
  "title": "平方差公式 — 探究与应用",
  "subject": "数学",
  "gradeLevel": "初中二年级",
  "lessonType": "math",
  "enableMath": true,
  "phaseConfig": [
    { "id": "listen",   "label": "讲解", "unlockAfter": null     },
    { "id": "practice", "label": "练习", "unlockAfter": "listen" },
    { "id": "discuss",  "label": "讨论", "unlockAfter": "practice" },
    { "id": "takeaway", "label": "小结", "unlockAfter": "discuss" }
  ],
  "readingSteps": [
    {
      "id": "intro",
      "type": "instruction",
      "displayName": "情景引入",
      "duration": 3,
      "studentView": { "title": "...", "body": "...", "confirmLabel": "开始学习" },
      "teacherView": { "speechLine": "...", "cueCards": [...] }
    },
    {
      "id": "explore-discover",
      "type": "task",
      "displayName": "探索发现",
      "answerKey": {
        "type": "rich-content-quiz",
        "subType": "calculation",
        "parts": [{ "id": "q1", "prompt": "(1) 计算 $(y+2)(y-2)$", "accepts": ["y^2-4", "y²-4"], ... }],
        "aiSystemPrompt": "你是一位初中数学教师助手。..."
      }
    }
    // ... more steps
  ]
}
```

**The pain points that motivate this package** (you can see all of these in live-lesson code today):

1. `manifestJson` is a free-form JSON blob. The Zod schema validates *structure* but doesn't tell the agent *what each field means or which actions are legal*. The agent has to be hand-prompted, per surface, about what it's looking at.
2. The agent's allowed actions in a lesson session are encoded across `creator-mcp-server/`, `solution.json`'s `proxyEnabled` + `toolEventTriggers`, and the system prompt in `solution.json`'s `sessionTemplates.creator.appendSystemPrompt`. Three places to keep in sync; no single registry.
3. The `@Picker` (currently scoped to recipe-book + the lesson creator) reads from a separate `EntityRegistry` populated by `@Referenceable()` decorators on solution backend services. The agent has no relationship to that registry — it doesn't know what's pickable.
4. Audit is half-built: `ToolCallerProxy` records `tool_events` per call, but there's no schema-level statement like "this manifest's `phase` state is full_diff-audited; this `adjustDifficulty` action needs approval." Audit policy lives in handler code, not as a discoverable contract.

This package turns those four pain points into a single declarative artifact: register an `ObjectTypeDef` for `LessonPlan` (and `Class`, `Student`, `Resource`, `ClassroomEvent`) once; compose them in a `ManifestDef LessonSession`; declare `AccessBoundary` per role and `ActionDef` per operation; and every consumer (Picker, agent, audit, governance UI) reads from the same schema.

---

## 2. Package structure

```
packages/ontology/
├── src/
│   ├── schema/                    # Layer 1: Primitives
│   │   ├── localized-string.ts    # LocalizedString — i18n union (Tier 1, §3.0)
│   │   ├── property-meta.ts       # PropertyMeta + PropertyMetaMap + Classification (Tier 1+3)
│   │   ├── zod-helpers.ts         # objectRef(name), objectSetRef(name) — branded z.string() helpers
│   │   ├── link.ts                # LinkDef — relationship between ObjectTypes
│   │   ├── action.ts              # ActionDef + ActionPrecondition + returnType (Tier 1+3)
│   │   ├── function.ts            # FunctionDef — pure typed computation (Tier 1, §3.7)
│   │   ├── object-type.ts         # ObjectTypeDef — schema + meta + links + actions composite
│   │   ├── stream.ts              # StreamDef — first-class event-stream slot (§9.3)
│   │   ├── interface.ts           # InterfaceDef + InterfaceLinkSignature + InterfaceActionSignature (Tier 2, §3.8)
│   │   ├── object-set.ts          # ObjectSetDef + SetFilter + OrderClause (Tier 2, §3.9)
│   │   ├── validation-rule.ts     # ValidationRuleMeta (Tier 3, §3.10)
│   │   ├── state-machine.ts       # StateMachineDef + Transition (Tier 3, §3.11)
│   │   ├── validators.ts          # Schema-level validation (circular refs, interface conformance, meta-key validity, state-machine consistency)
│   │   └── index.ts
│   │
│   ├── helpers/                   # Type-inferring registration helpers (Zod-first refactor)
│   │   ├── define.ts              # defineObjectType<S>, defineAction, defineFunction, defineInterface, defineObjectSet, defineManifest, defineStateField
│   │   └── index.ts
│   │
│   ├── manifest/                  # Layer 2: Composition
│   │   ├── slot.ts                # SlotDef — typed placeholder in a manifest
│   │   ├── state.ts               # StateDef — manifest-level runtime state
│   │   ├── access-boundary.ts     # AccessBoundary — per-role read/write/action scope
│   │   ├── lifecycle.ts           # LifecycleDef — hooks for activate/deactivate/change
│   │   ├── notification.ts        # NotificationRule + NotificationChannel (Tier 3, §4.8)
│   │   ├── manifest-def.ts        # ManifestDef — the full manifest schema
│   │   ├── versioning.ts          # SchemaVersion + migrateInstance (§9.1)
│   │   ├── resolve.ts             # Slot derivation logic (derivedFrom resolution)
│   │   └── index.ts
│   │
│   ├── accessor/                  # Layer 3: Consumption protocols
│   │   ├── manifest-accessor.ts   # ManifestAccessor interface — universal consumption API
│   │   ├── action-result.ts       # ActionResult — structured execution outcome
│   │   ├── boundary-check.ts      # Pure function: does this access violate the boundary?
│   │   ├── boundary-predicate.ts  # BoundaryPredicate + PathExpr + evaluator (Tier 2, §5.5)
│   │   └── index.ts
│   │
│   ├── registry/                  # Cross-cutting: discovery
│   │   ├── registry.ts            # OntologyRegistry — ObjectType + ManifestDef store + ETag digest
│   │   └── index.ts
│   │
│   ├── semantic/                  # Cross-cutting: LLM-facing schema projection
│   │   ├── project.ts             # Project a ManifestDef into Agent-readable formats
│   │   ├── formats/
│   │   │   ├── anthropic-tools.ts # Anthropic tool-use JSON schema
│   │   │   ├── system-prompt.ts   # Markdown system-prompt fragment
│   │   │   └── mcp-tools.ts       # MCP tool descriptor list
│   │   └── index.ts
│   │
│   ├── distribution/              # Cross-cutting: schema serialization for REST distribution (§9.6)
│   │   ├── serialize.ts           # canonical JSON serialization
│   │   ├── digest.ts              # ETag-friendly digest of registered schema
│   │   └── index.ts
│   │
│   └── index.ts                   # Public API surface (see §2.1)
│
├── test/                          # Unit + architecture tests (see impl-plan §B4)
├── package.json
├── tsconfig.json
└── README.md
```

### 2.1 Public API surface

The top-level `src/index.ts` re-exports a stable, minimal surface:

```ts
// Shared
export type { LocalizedString } from './schema/localized-string';
export type { PropertyMeta, PropertyMetaMap, Classification } from './schema/property-meta';
export { objectRef, objectSetRef } from './schema/zod-helpers';

// Schema primitives (most are generic over Zod schemas — see §3.4 §3.7 §3.8)
export type { LinkDef, LinkCardinality } from './schema/link';
export type { ActionDef, AuditLevel, ActionPrecondition } from './schema/action';
export type { FunctionDef } from './schema/function';
export type { ObjectTypeDef, PickerConfig } from './schema/object-type';
export type { StreamDef } from './schema/stream';
export type { InterfaceDef, InterfaceLinkSignature, InterfaceActionSignature } from './schema/interface';
export type { ObjectSetDef, SetFilter, OrderClause } from './schema/object-set';
export type { ValidationRuleMeta } from './schema/validation-rule';
export type { StateMachineDef, Transition } from './schema/state-machine';

// Manifest composition
export type { SlotDef, SlotTarget } from './manifest/slot';
export type { StateDef } from './manifest/state';
export type { AccessBoundary, BoundaryRole, BoundaryPathEntry } from './manifest/access-boundary';
export type { LifecycleDef } from './manifest/lifecycle';
export type { NotificationRule, NotificationChannel } from './manifest/notification';
export type { ManifestDef, SchemaVersion } from './manifest/manifest-def';

// Accessor protocols
export type {
  ManifestAccessor,
  ActionResult,
  BoundaryCheckInput,
  BoundaryDecision,
  BoundaryPredicate,
  PathExpr,
  PredicateValue,
  PredicateImpl,
} from './accessor';
export { checkBoundary } from './accessor/boundary-check';

// Type-inferring registration helpers — solutions always go through these,
// never construct the underlying interfaces by hand
export {
  defineObjectType,
  defineAction,
  defineFunction,
  defineInterface,
  defineObjectSet,
  defineManifest,
  defineStateField,
} from './helpers/define';

// Registry
export { OntologyRegistry } from './registry/registry';

// Semantic projection
export { projectManifest } from './semantic/project';
export type { ProjectionFormat, ProjectedManifest } from './semantic/project';

// Distribution
export { serializeRegistry, computeSchemaDigest } from './distribution';
```

No classes are exported except `OntologyRegistry`. Everything else is types + pure functions, so the surface is trivially serializable and tree-shakeable.

---

## 3. Layer 1: Schema primitives

These are the atoms. Everything else is built from them. All shapes are `readonly` plain objects — they survive JSON round-trips and cross process boundaries without surprises.

### 3.0 Shared type: `LocalizedString`

Used by every `displayName` field below. Per Design Principle 6 (§1.7), the shape is a union: plain string for single-locale, locale-keyed map for multi-locale.

```ts
/**
 * A display label.
 *
 * - Plain string: single-locale label (the default; today's Chinese-only case).
 * - Map keyed by ICU locale tag ('zh-CN', 'en', 'en-US', …): resolved by
 *   `OntologyRegistry.getDisplayName(def, locale?)` with default-locale fallback.
 *
 * The union means existing call sites that pass a string keep working with no
 * change; multi-locale Solutions opt in by passing a Record.
 */
export type LocalizedString = string | Readonly<Record<string, string>>;
```

The registry exposes a thin resolver:

```ts
OntologyRegistry.getDisplayName(def: { displayName: LocalizedString }, locale?: string): string
```

Resolution rule: if `displayName` is a string, return it. If it's a map and `locale` matches a key, return that value. If `locale` is not a key but `'zh-CN'` is (the platform default), return that. Otherwise return the first map value. Consumers should pass `locale` from the user's session preferences; absence is benign.

### 3.1 PropertyMeta — the sidecar (replaces the old `PropertyDef`)

> **History**: prior revisions of this spec defined a custom `PropertyDef` (apiName, type, refTarget, enumValues, required, computed, semantic, searchable, displayRole, …). That shape duplicated what TypeScript and Zod already express: the field name *is* the Zod object key, the field type *is* the Zod combinator, required-ness is encoded as `.optional()` or its absence, enum values are `z.enum([...])`, and per-field natural-language descriptions go on `.describe('...')`. The custom shape was outvoted by the existing repo convention (live-lesson's `manifest.schema.ts`, the creator MCP server, and `ToolCallerProxy`'s `argsSchema: ZodTypeAny` all use Zod). What remains is just the *governance and presentation sidecar* — things Zod has no concept of.

A property's structural shape lives in the ObjectType's Zod schema (§3.4). `PropertyMeta` carries only what the Zod schema can't express:

```ts
export interface PropertyMeta {
  /** Optional i18n override. If absent, the property's display label
   *  is derived from the field's `.describe()` text or the field name. */
  readonly displayName?: LocalizedString;
  /** @Picker hint: include this property in full-text search. */
  readonly searchable?: boolean;
  /** @Picker hint: rendering role in list views. */
  readonly displayRole?: 'title' | 'subtitle' | 'badge' | 'body' | 'hidden';
  /** Derived at runtime; readable but never writable by any role.
   *  Agents will see derived values (e.g. student engagement score)
   *  but boundary checks reject writes regardless of role. */
  readonly computed?: boolean;
  /**
   * Regulatory classification tags (Tier 3, G9). Open enum — Solutions
   * may extend the taxonomy; the package curates three core values and
   * takes no position on hierarchy (PII does not imply 'sensitive').
   * Read by audit reporting: `registry.getPropertiesByClassification('pii')`.
   */
  readonly classification?: readonly Classification[];
  /**
   * View-time redaction policy (Tier 3, G12). Applied by ManifestAccessor.readSlot
   * AFTER the boundary check passes, BEFORE returning. Different from absence
   * from `AccessBoundary.readable`: absence loses field existence; redaction
   * preserves shape with the value transformed.
   *
   * Bundled with classification: a field tagged `'pii'` typically declares
   * a redaction policy for non-trusted roles. The package does not derive
   * one from the other — Solutions declare both explicitly.
   */
  readonly redaction?: {
    /** Roles that see the redacted form. Other roles see the raw value. */
    readonly roles: readonly BoundaryRole[];
    /** mask = pattern fill (张** for names); hash = sha256(value) (preserves
     *  equality comparisons); omit = property absent from returned object. */
    readonly strategy: 'mask' | 'hash' | 'omit';
    /** Optional mask template for 'mask' strategy. Defaults to first char
     *  + '**'. The runtime evaluator inspects the field's Zod type to pick
     *  a reasonable default if absent (strings get '***', numbers get 0). */
    readonly maskTemplate?: string;
  };
}

/**
 * Classification taxonomy (Tier 3, G9). Open string union — solutions may
 * extend by passing arbitrary strings. The three core values are documented
 * here as the platform's vocabulary; auditors can query against them with
 * confidence that they mean the same thing across Solutions.
 */
export type Classification =
  | 'pii'        // Personally Identifiable Information
  | 'sensitive'  // Internal sensitive data (not PII but restricted)
  | 'regulated'  // Subject to regulatory compliance (HIPAA, FERPA, …)
  | string;

/**
 * Sidecar map keyed by field names of the bound schema. Generic constraint
 * ensures misnamed keys are TS errors at the `defineObjectType` call site.
 */
export type PropertyMetaMap<S extends z.ZodObject<z.ZodRawShape>> =
  Partial<Record<keyof z.infer<S>, PropertyMeta>>;
```

**Where each piece of information comes from** (the rule the rest of this doc follows):

| Information | Source |
|---|---|
| Field name (apiName) | Key in the Zod object literal |
| Field type | Zod combinator (`z.string()`, `z.number()`, `z.enum([...])`, …) |
| Required vs optional | `.optional()` modifier in Zod |
| Enum values | The argument to `z.enum([...])` or `z.union([z.literal(...)])` |
| Per-field semantic | `z.string().describe('Student display name')` |
| Reference target | A branded helper: `objectRef('Class')` (returns a branded `z.string()`); ObjectType apiName recovered via the brand |
| ObjectSet reference | `objectSetRef('struggling')` — same pattern |
| Picker/governance hints | `meta` sidecar (this interface) |

Meta entries are **optional everywhere**. A field that needs none — `id: z.string()` — appears in the Zod schema but has no `meta[id]` entry. The validator (§9.7) only enforces that every *key* used in the meta map exists in the Zod schema; it does not require meta for every field.

### 3.2 LinkDef

A named, typed relationship between two `ObjectType`s.

```ts
export type LinkCardinality = '1:1' | '1:N' | 'N:1' | 'N:M';

export interface LinkDef {
  readonly apiName: string;
  readonly displayName: LocalizedString;
  /** ObjectTypeDef.apiName of the link target. */
  readonly target: string;
  readonly cardinality: LinkCardinality;
  /** Name of the inverse link on the target; strongly recommended. */
  readonly inverse?: string;
  /** @Picker can drill into this link. */
  readonly traversable?: boolean;
  /** Natural-language description for Agent reasoning. */
  readonly semantic: string;
}
```

Key design decisions:

- `inverse` is optional but strongly recommended. Without it, you can traverse A→B but not B→A, which breaks @Picker's "show me what references this" pattern.
- `traversable` controls whether @Picker can follow this link. Not all relationships should be browsable — e.g. `createdBy` is metadata, not something a teacher needs to navigate.
- `N:M` may need a backing junction table in implementation, but at the schema level it's just a `LinkDef` with `cardinality: 'N:M'`.

### 3.3 ActionDef

A governed operation that can be performed on an object or within a manifest. `ActionDef`s compile down to `ToolDefinition`s at registration time so the existing `ToolCallerProxy` pipeline does the enforcement work (see §10).

```ts
export type AuditLevel = 'none' | 'log' | 'full_diff';

export interface ActionDef {
  readonly apiName: string;
  readonly displayName: LocalizedString;
  /**
   * Typed parameters as a Zod object schema. The same schema travels
   * through `ToolCallerProxy.argsSchema` at the bridge (§10.2), so the
   * proxy's sanitize+validate step parses these exact constraints.
   * Per-param `semantic` lives on `.describe()` calls within the schema.
   */
  readonly params: z.ZodObject<z.ZodRawShape>;
  /**
   * Declarative side-effect tags for Agent reasoning, e.g.
   * 'mutates:LessonSession.state.phase' or 'emits:ClassroomEvent'.
   */
  readonly sideEffects: readonly string[];
  /** Other ActionDef.apiNames this action transitively invokes (§9.5). */
  readonly composes?: readonly string[];
  /**
   * Declarative gates evaluated by checkBoundary BEFORE dispatch.
   * If any precondition is unmet, the action is denied with a structured
   * unmetPreconditions list — the agent never sees a "handler returned
   * early because state was wrong" response.
   *
   * Added per gap-analysis G2 (Tier 1): moves "if (phase !== 'practice')
   * return early" out of handler code where the agent can't see it, into
   * the schema where discoverActions() can filter accordingly.
   */
  readonly preconditions?: readonly ActionPrecondition[];
  /** Human-approval gate before execution. */
  readonly requiresApproval?: boolean;
  /**
   * Roles allowed to invoke this action. Combined AND-style with
   * AccessBoundary.actions — both gates must pass.
   */
  readonly allowedRoles: readonly BoundaryRole[];
  /** Required ApiKeyScopes for the calling session; ANY-of semantics. */
  readonly requiredScopes?: readonly ApiKeyScopeLiteral[];
  readonly auditLevel: AuditLevel;
  /**
   * Typed return value (Tier 3, G11). When set, the bridge attaches the
   * parsed return to `ActionResult.returnValue` and includes the schema's
   * `zod-to-json-schema` rendering in the agent's projected action descriptor
   * — agents can reason about what an Action returns without invoking it.
   *
   * Most Actions return only state changes (already in `ActionResult.stateChanges`);
   * `returnType` is for Actions whose useful output is structured data the
   * agent should chain on (e.g. `bulkFlag` returning `{ flagged: Student[], skipped: Student[] }`).
   */
  readonly returnType?: z.ZodTypeAny;
  /** Natural-language description for Agent consumption. REQUIRED. */
  readonly semantic: string;
}

/**
 * Declarative precondition shapes (discriminated by `kind`).
 * Three forms cover the common cases without committing to a Turing-complete
 * predicate sub-language; richer logic escapes into `kind: 'named'` and
 * registers a Predicate on the OntologyRegistry.
 */
export type ActionPrecondition =
  /** Manifest state at `path` must equal `value`. */
  | { readonly kind: 'stateEquals'; readonly path: string; readonly value: string | number | boolean | null }
  /** Named slot must currently be bound (non-null, non-empty for collections). */
  | { readonly kind: 'slotBound'; readonly slot: string }
  /** Named predicate registered on OntologyRegistry; `params` is optional context. */
  | { readonly kind: 'named'; readonly name: string; readonly params?: Readonly<Record<string, unknown>> };

/** Mirror of packages/backend/src/auth/types.ts ApiKeyScope. */
export type ApiKeyScopeLiteral =
  | 'skills:read' | 'skills:write' | 'skills:execute' | 'skills:delete'
  | 'mcp:read' | 'mcp:write'
  | 'chat' | 'analytics:read' | 'builder' | 'admin';
```

Key design decisions:

- `params: z.ZodObject<...>` — actions take typed, described parameters via a Zod object schema. The same schema is what `ToolCallerProxy.argsSchema` parses against at the bridge (§10.2), so there's no second representation to keep in sync.
- `sideEffects` is a *declarative array of strings*. Agents reason about whether an action is appropriate by checking declared side effects without needing implementation details. (Important: this is the agent-discovery contract; the actual mutations happen in the handler.)
- `requiresApproval`, `allowedRoles`, `requiredScopes`, and `auditLevel` are part of the schema, not the application layer. The schema *is* the governance declaration.
- `requiredScopes` mirrors the literal `ApiKeyScope` union so the ontology package stays free of any backend imports; the registry validates that values are members of this union.

### 3.4 ObjectTypeDef

The composite: properties + links + actions + picker config.

```ts
export interface PickerConfig {
  readonly icon: string;
  readonly color?: string;
  /** Subset of property apiNames to include in full-text search. */
  readonly searchFields: readonly string[];
  /** Property apiName whose value renders as the headline. */
  readonly titleField: string;
  /** Property apiName for subtitle/summary line (optional). */
  readonly subtitleField?: string;
  /**
   * Allow this type to be referenced from manifests OTHER than the one
   * declaring the picker context (§9.4). Default: hermetic.
   */
  readonly crossManifestSources?: readonly ('parent' | 'sibling' | 'all')[];
}

export interface ObjectTypeDef<S extends z.ZodObject<z.ZodRawShape> = z.ZodObject<z.ZodRawShape>> {
  readonly apiName: string;
  readonly displayName: LocalizedString;
  /** REQUIRED — overall description of what this object represents. */
  readonly semantic: string;
  /**
   * Zod object schema — the source of truth for structural shape.
   * Field names are property apiNames; field types determine
   * everything downstream (TS inference, JSON Schema projection,
   * `ToolCallerProxy` validation). Per-field `semantic` text lives
   * on `.describe('...')` calls inside the schema.
   */
  readonly schema: S;
  /** Sidecar carrying picker/governance hints Zod has no concept of. */
  readonly meta?: PropertyMetaMap<S>;
  readonly links: readonly LinkDef[];
  readonly actions: readonly ActionDef[];
  /**
   * InterfaceDef apiNames this object implements (§3.8, Tier 2).
   * Validators at registration check structural conformance: implementor's
   * `schema` must structurally include every key in `InterfaceDef.requiredSchema`
   * with compatible Zod types. Enables polymorphic queries via
   * `OntologyRegistry.getImplementersOf(name)`.
   */
  readonly implements?: readonly string[];
  /**
   * Domain-rule sidecar — names the .refine() calls chained on `schema`
   * and exposes them to the agent's projected view (§3.10, Tier 3, G7).
   */
  readonly validationRules?: readonly ValidationRuleMeta[];
  /**
   * Per-object lifecycle bound to one enum-typed field on `schema`
   * (§3.11, Tier 3, G8). Validators check the property is a z.enum and
   * transitions reference valid enum values + registered ActionDefs.
   */
  readonly stateMachine?: StateMachineDef;
  readonly picker?: PickerConfig;
}
```

**From `defineObjectType<S>({ schema, ... })` you get** (without any duplicate declaration):

- A typed config object whose `meta` keys are constrained to `keyof z.infer<typeof schema>` — misspellings are compile-time errors.
- The TS type for instances: `type Student = z.infer<typeof StudentSchema>` at the call site.
- Runtime introspection: `registry.getObjectType('Student').schema.shape.name` returns the Zod field.
- Free JSON Schema for any consumer that wants it: `zod-to-json-schema(StudentSchema)` (used in §7 semantic projection).

The `defineObjectType<S>()` helper (in `src/helpers/define.ts`) is a passthrough that exists purely so TS infers `S` from the call and the meta map keys are constrained. Solutions never write `ObjectTypeDef<...>` by hand; they always go through the helper.

Key design decisions:

- `picker` is embedded in the `ObjectType`, not in a separate UI config. This is the "same schema, multiple consumers" principle.
- No inheritance / no `extends`. `ObjectType`s are flat. If two types share fields, that's a sign they should share a referenced `ObjectType` (composition over inheritance) or an `InterfaceDef` (§3.8, polymorphic contract). The Zod schema stays serializable and the diamond problem doesn't arise.
- `crossManifestSources` is the *only* way an `ObjectType` becomes pickable from a manifest other than the one that owns it. Default behavior is hermetic.

### 3.5 StreamDef *(new — §9.3 resolution)*

Event streams are first-class, distinct from slots, because their semantics are subscribe-only (push), not read-once (pull).

```ts
export interface StreamDef {
  readonly apiName: string;
  readonly displayName: LocalizedString;
  /**
   * ObjectTypeDef.apiName of the event payload — payload shape comes from
   * the registered ObjectType's Zod schema. Use this for streams whose
   * events are also persisted as first-class objects.
   */
  readonly payloadType?: string;
  /**
   * Inline payload Zod schema, for streams whose events are NOT persisted
   * as standalone ObjectTypes (e.g. ephemeral progress ticks). Exactly one
   * of `payloadType` or `payloadSchema` must be set; validators enforce.
   */
  readonly payloadSchema?: z.ZodTypeAny;
  /** REQUIRED — what this stream emits, when, and what subscribers should do. */
  readonly semantic: string;
  /**
   * Optional backpressure hint for the runtime. 'drop_oldest' is the
   * default for high-volume observability streams (GLM classroom events).
   */
  readonly backpressure?: 'drop_oldest' | 'block_producer' | 'unbounded';
}
```

`StreamDef`s appear at the `ManifestDef` level (not on `ObjectTypeDef`) — they are properties of the *operational context*, not of any individual object.

### 3.6 Worked example: the five `ObjectTypeDef`s a real lesson needs

To make the primitives concrete, here are the five `ObjectTypeDef`s a live-lesson `LessonSession` `ManifestDef` references. These live in the solution backend (`solutions/business/live-lesson/backend/src/ontology/`), not in the ontology package itself.

The Zod schema is the source of truth for shape and per-field semantics. The `meta` sidecar carries only picker/governance hints Zod has no concept of. The `objectRef(...)` and `objectSetRef(...)` helpers return branded `z.string()`s — the brand carries the referenced ObjectType/ObjectSet name into runtime introspection without inventing a separate "ref type."

```ts
import { z } from 'zod';
import { defineObjectType, objectRef, objectSetRef } from '@kedge-agentic/ontology';

// ─── LessonPlan ────────────────────────────────────────────────
const LessonPlanSchema = z.object({
  id: z.string()
    .describe('Stable identifier; matches the manifest.json directory name.'),
  title: z.string()
    .describe('Headline shown to teacher and students.'),
  subject: z.enum(['math', 'reading', 'science'])
    .describe('Subject area; determines which observation handlers and exercise types apply.'),
  gradeLevel: z.string()
    .describe('Target grade level, free-form Chinese (e.g. "初中二年级").'),
  durationMinutes: z.number()
    .describe('Sum of all readingSteps[].duration; computed from steps.'),
  // Foreign keys live in the schema as branded strings — runtime can
  // recover the target ObjectType from the brand.
  targetClassId: objectRef('Class').optional(),
});
type LessonPlan = z.infer<typeof LessonPlanSchema>;

const LessonPlan = defineObjectType({
  apiName: 'LessonPlan',
  displayName: '教学计划',
  semantic:
    'A teacher-authored plan for a single class session, with sequenced ' +
    'steps and per-step learning objectives. One LessonPlan can back ' +
    'many ClassroomSession instances.',
  schema: LessonPlanSchema,
  meta: {
    title: { searchable: true, displayRole: 'title' },
    subject: { searchable: true, displayRole: 'subtitle' },
    gradeLevel: { searchable: true },
    durationMinutes: { computed: true },
  },
  links: [
    { apiName: 'targetClass', displayName: '面向班级', target: 'Class', cardinality: 'N:1',
      inverse: 'lessons', traversable: true,
      semantic: 'The class this plan is authored for.' },
    { apiName: 'usesResources', displayName: '使用资源', target: 'Resource', cardinality: 'N:M',
      inverse: 'usedByPlans', traversable: true,
      semantic: 'Slides, videos, worksheets embedded in this plan.' },
  ],
  actions: [
    defineAction({
      apiName: 'adjustDifficulty',
      displayName: '调整难度',
      // Zod object schema; per-param semantic via .describe(); ToolCallerProxy
      // uses this exact schema as argsSchema at the bridge (§10.2).
      params: z.object({
        direction: z.enum(['easier', 'harder'])
          .describe('Which way to nudge the plan difficulty.'),
        reason: z.string()
          .describe('Free-text justification recorded in the audit trail.'),
      }),
      sideEffects: ['mutates:LessonPlan.steps', 'emits:DifficultyAdjusted'],
      allowedRoles: ['agent', 'admin'],
      requiredScopes: ['chat'],
      auditLevel: 'full_diff',
      semantic: 'Re-paces the plan toward easier or harder content. Use when ' +
        'class metrics show consistent under- or over-performance for ≥3 minutes.',
    }),
  ],
  picker: {
    icon: '📘', color: 'blue',
    searchFields: ['title', 'subject', 'gradeLevel'],
    titleField: 'title',
    subtitleField: 'subject',
  },
});

// ─── Class ────────────────────────────────────────────────
const ClassSchema = z.object({
  id: z.string(),
  name: z.string().describe('Display name shown to teachers, e.g. "初二(3)班".'),
  school: z.string().describe('Which school this class belongs to.'),
  studentCount: z.number().describe('Number of students in `contains`; derived.'),
});

const Class = defineObjectType({
  apiName: 'Class',
  displayName: '班级',
  semantic: 'A persistent roster of students. Many ClassroomSessions reference the same Class.',
  schema: ClassSchema,
  meta: {
    name: { searchable: true, displayRole: 'title' },
    school: { searchable: true, displayRole: 'subtitle' },
    studentCount: { computed: true },
  },
  links: [
    { apiName: 'contains', displayName: '包含学生', target: 'Student', cardinality: '1:N',
      inverse: 'class', traversable: true,
      semantic: 'Students enrolled in this class.' },
    { apiName: 'lessons', displayName: '历史课程', target: 'LessonPlan', cardinality: '1:N',
      inverse: 'targetClass', traversable: true,
      semantic: 'Past and present lesson plans targeting this class.' },
  ],
  actions: [],
  picker: { icon: '👥', color: 'amber', searchFields: ['name', 'school'], titleField: 'name', subtitleField: 'school' },
});

// ─── Student ────────────────────────────────────────────────
const StudentSchema = z.object({
  id: z.string(),
  name: z.string().describe('Student display name.'),
  engagementScore: z.number().min(0).max(100)
    .describe('Rolling engagement score computed from the last 10 ClassroomEvents. Range 0–100.'),
  lastSeenAt: z.string().datetime()
    .describe('Timestamp of the most recent event from this student in the current session.'),
  classId: objectRef('Class'),
});

const Student = defineObjectType({
  apiName: 'Student',
  displayName: '学生',
  semantic: 'A single student in a Class. Mostly read-only from the agent perspective; mutations happen via Submission rather than directly.',
  schema: StudentSchema,
  meta: {
    name: { searchable: true, displayRole: 'title' },
    engagementScore: { computed: true },
    lastSeenAt: { computed: true },
  },
  links: [
    { apiName: 'class', displayName: '所属班级', target: 'Class', cardinality: 'N:1',
      inverse: 'contains', traversable: true,
      semantic: 'The class this student belongs to.' },
  ],
  actions: [
    defineAction({
      apiName: 'flagForIntervention',
      displayName: '标记需关注',
      params: z.object({
        reason: z.string()
          .describe('Why this student needs teacher attention. Recorded verbatim in the alert.'),
        severity: z.enum(['watch', 'urgent'])
          .describe('Watch = surface in dashboard; urgent = teacher push notification.'),
      }),
      sideEffects: ['emits:StudentAlert'],
      allowedRoles: ['agent', 'admin'],
      requiredScopes: ['chat'],
      auditLevel: 'log',
      semantic: 'Raises a teacher-facing alert for this student. Use when ' +
        'engagementScore drops below 30 or after 3 consecutive incorrect submissions.',
    }),
  ],
  picker: {
    icon: '🧑‍🎓', color: 'green',
    searchFields: ['name'],
    titleField: 'name',
    crossManifestSources: ['sibling'],
  },
});

// ─── Resource ────────────────────────────────────────────────
const ResourceSchema = z.object({
  id: z.string(),
  title: z.string().describe('Resource headline.'),
  kind: z.enum(['slide', 'video', 'worksheet', 'image'])
    .describe('Resource medium. Determines how the player renders it.'),
  url: z.string().url().describe('Resource URL (absolute or backend-relative).'),
});

const Resource = defineObjectType({
  apiName: 'Resource',
  displayName: '教学资源',
  semantic: 'A reusable teaching artifact (slide, video, worksheet) referenced by one or more LessonPlans.',
  schema: ResourceSchema,
  meta: {
    title: { searchable: true, displayRole: 'title' },
    kind: { searchable: true, displayRole: 'subtitle' },
  },
  links: [
    { apiName: 'usedByPlans', displayName: '被引用', target: 'LessonPlan', cardinality: 'N:M',
      inverse: 'usesResources', traversable: true,
      semantic: 'Lesson plans that embed this resource.' },
  ],
  actions: [],
  picker: { icon: '🎞', color: 'purple', searchFields: ['title', 'kind'], titleField: 'title', subtitleField: 'kind' },
});

// ─── ClassroomEvent ────────────────────────────────────────────────
// Discriminated-union payload — Zod expresses what our old PropertyDef
// couldn't: per-`kind` shape variation. The agent sees the union via
// zod-to-json-schema in §11 projection.
const ClassroomEventSchema = z.object({
  id: z.string(),
  kind: z.enum(['join', 'submit', 'chat_turn', 'status_change', 'step_complete', 'system'])
    .describe('Event category; mirrors the six handler types in adapters/observer-engine/handlers/.'),
  occurredAt: z.string().datetime()
    .describe('When the event was observed (not when it was processed).'),
  studentId: objectRef('Student').optional(),
  payload: z.record(z.unknown())
    .describe('Event-specific payload. Shape depends on `kind`.'),
});

const ClassroomEvent = defineObjectType({
  apiName: 'ClassroomEvent',
  displayName: '课堂事件',
  semantic: 'One structured event extracted from the live classroom by the ' +
    'GLM-4.7-Flash observation engine. The agent subscribes to a stream of ' +
    'these to maintain awareness.',
  schema: ClassroomEventSchema,
  // No meta — every field is either purely structural or already documented
  // via .describe() in the schema.
  links: [
    { apiName: 'student', displayName: '关联学生', target: 'Student', cardinality: 'N:1',
      semantic: 'The student this event is about, when applicable.' },
  ],
  actions: [],
  // No picker — events are stream items, not user-pickable references.
});
```

A few things to notice in this example set:

- **No duplicate field declarations.** The Student schema declares `engagementScore: z.number().min(0).max(100).describe('Rolling engagement score…')` — name, type, range constraint, and natural-language description in one place. The meta sidecar adds only `{ computed: true }`. Previously this same field needed 5 lines in a `PropertyDef` literal.
- **`computed: true` still bites.** `Student.engagementScore`'s `computed: true` flag in meta tells `boundary-check.ts` to reject writes regardless of any `AccessBoundary.writable` declaration. The Zod schema doesn't know about computed-ness; that's why the meta sidecar exists.
- **`Student.picker.crossManifestSources: ['sibling']`** is the *only* way a teacher in lesson A can `@` a student from lesson B's roster (§9.4). Picker config is unchanged from the previous design (Zod doesn't help with this).
- **`ClassroomEvent` has no `picker` block** — it's stream-only. `OntologyRegistry.getPickableTypes()` skips it, so `@Picker` never renders it as a top-level option.
- **`adjustDifficulty.params` is a Zod object schema**, not a `PropertyDef[]`. The same schema becomes `ToolCallerProxy.argsSchema` at the bridge (§10.2); there is no second representation.
- **`objectRef('Class')` is a branded `z.string()`.** Runtime can read the brand to know that `Student.classId` references `Class`; static TS sees it as a string. This replaces the old `type: 'ref', refTarget: 'Class'` declaration with a single Zod combinator.

### 3.7 FunctionDef — pure, side-effect-free typed computations

`ActionDef` is for "do something that changes state." `FunctionDef` is for "compute something and tell me the answer." Both are agent-callable; the distinction is semantic, and it changes how an agent reasons about cost and approval.

```ts
/**
 * A typed, side-effect-free computation. Distinct from ActionDef by intent:
 * functions return values, actions change state.
 *
 * Compiles to a ToolDefinition at registration time (same bridge as ActionDef)
 * but with the audit level pinned at 'log' (never 'full_diff') and the approval
 * gate skipped entirely. The agent's projected view (§11) lists functions in a
 * separate "What you can compute" section, distinct from "What you can do."
 *
 * Added per gap-analysis G1 (Tier 1).
 */
export interface FunctionDef {
  readonly apiName: string;
  readonly displayName: LocalizedString;
  /** Typed parameters as a Zod object schema (same shape as ActionDef.params). */
  readonly params: z.ZodObject<z.ZodRawShape>;
  /** Shape of the returned value as a Zod schema. Per-field `.describe()`
   *  carries semantic text for the agent's projected view. */
  readonly returnType: z.ZodTypeAny;
  /** Natural-language description for Agent consumption. REQUIRED. */
  readonly semantic: string;
  /** Roles allowed to invoke this function. */
  readonly allowedRoles: readonly BoundaryRole[];
  /** Required ApiKeyScopes for the calling session; ANY-of semantics. */
  readonly requiredScopes?: readonly ApiKeyScopeLiteral[];
  // Deliberately absent:
  //   - sideEffects (functions have none, by definition)
  //   - composes (function composition is a handler concern, not schema)
  //   - preconditions (a precondition that gates a pure read is suspicious;
  //     if needed, use AccessBoundary.readable instead)
  //   - requiresApproval (approval for a read is a category error)
  //   - auditLevel (pinned at 'log' by the bridge — see §10.1)
}
```

**Why this is a separate primitive.** Today, a pure read computation collapses into one of two unsatisfying shapes:

- A `computed: true` `PropertyDef` — but `computed` is per-object and unparameterized. There's no way to express `computeEngagementScore(studentId, windowMinutes) → number` as a property.
- An `ActionDef` with `sideEffects: []` and `auditLevel: 'none'` — but the schema then *lies about intent*. Nothing in the type tells the agent (or the human reviewer) that this is *definitionally* safe to call. The agent's projected view groups it under "What you can do" alongside actual mutations; the reviewer scanning for "what writes state" has to read every action's `sideEffects` array to filter pure reads out.

Both are workarounds for a missing primitive. `FunctionDef` is the primitive.

**Live-lesson example.**

```ts
defineFunction({
  apiName: 'computeEngagementScore',
  displayName: '计算参与度',
  params: z.object({
    studentId: objectRef('Student'),
    windowMinutes: z.number().int().min(1).max(60)
      .describe('Time window (minutes) over which to aggregate ClassroomEvents.'),
  }),
  returnType: z.number().min(0).max(100)
    .describe('Engagement score 0–100; 100 = maximally engaged.'),
  allowedRoles: ['agent', 'admin'],
  semantic: 'Read the student\'s recent ClassroomEvents and compute their ' +
    'engagement score. Pure read; use freely without approval concerns.',
});
```

Today this would be either an invisible service method or a degenerate `ActionDef`; with `FunctionDef` it's a discoverable, callable computation distinct from anything that changes state.

**Boundary semantics.** `FunctionDef` is gated by `AccessBoundary.actions` (same list as `ActionDef.apiName`s) — no new boundary field. Solutions distinguish reads from writes in two ways: (a) by what they put in the actions list per role; (b) by what the projected semantic view (§11) groups under each heading.

### 3.8 InterfaceDef — polymorphic contracts shared across ObjectTypes

`ObjectTypeDef`s are flat (§3.4: "no inheritance, no `extends`"). But a recurring contract — "anything that can be `@`-mentioned in chat," "anything PII-tagged for audit," "anything that participates in a parent/child hierarchy" — shows up across multiple types. Without polymorphism, every consumer of the contract has to enumerate concrete types by hand. `InterfaceDef` is the polymorphism layer.

```ts
/**
 * A shared contract that one or more ObjectTypeDefs declare they implement.
 *
 * Structural, not nominal: validators at registration check that each
 * implementor's actual properties/links/actions satisfy the required
 * signatures (matching by apiName and type). No method-dispatch table is
 * generated — the registry simply tracks who implements what.
 *
 * Resolution is at REGISTRATION time, not call time: when ObjectTypeDef
 * declares `implements: ['Mentionable']`, the registry resolves the link
 * once and rejects boot if the type doesn't conform. A Solution that
 * needs runtime polymorphism overrides `OntologyRegistry.getImplementersOf()`
 * with a custom resolver — see Open Question #2 in the gap analysis.
 *
 * Added per gap-analysis G4 (Tier 2).
 */
export interface InterfaceDef<R extends z.ZodObject<z.ZodRawShape> = z.ZodObject<z.ZodRawShape>> {
  readonly apiName: string;
  readonly displayName: LocalizedString;
  /** REQUIRED — what the contract represents and when an ObjectType should implement it. */
  readonly semantic: string;
  /**
   * Partial Zod schema that implementors must structurally satisfy.
   * Every field in `requiredSchema.shape` must appear in the implementor's
   * `ObjectTypeDef.schema.shape` with a structurally compatible Zod type
   * (validator uses Zod's `.shape` introspection at registration time).
   * Implementors may declare a strict superset of fields.
   */
  readonly requiredSchema?: R;
  /**
   * Required links — implementor `links[]` must include an entry with
   * matching apiName, target, and cardinality.
   */
  readonly requiredLinks?: readonly InterfaceLinkSignature[];
  /**
   * Required actions — implementor `actions[]` must include an entry
   * with matching apiName whose params schema is a structural superset
   * of the signature's params schema.
   */
  readonly requiredActions?: readonly InterfaceActionSignature[];
}

export interface InterfaceLinkSignature {
  readonly apiName: string;
  /** ObjectType.apiName of the link target. */
  readonly target: string;
  readonly cardinality: LinkCardinality;
  readonly semantic: string;
}

export interface InterfaceActionSignature {
  readonly apiName: string;
  /** Minimum params shape the implementor's Action must satisfy. */
  readonly params: z.ZodObject<z.ZodRawShape>;
  readonly semantic: string;
}
```

**Live-lesson example.** Three types — `Student`, `Teacher`, `Parent` — share the `Mentionable` contract (icon + searchable display name + summary line for the picker) and the `Personal` contract (PII flag, redaction rules per gap-analysis G9+G12 when adopted). Without `InterfaceDef`, the "give me all Mentionables registered in this Solution" query forces consumers to enumerate concrete types; with it, `registry.getImplementersOf('Mentionable')` returns all three transparently, and adding a fourth (`StudentGuardian` later) becomes discoverable to every consumer without changes.

**Registry hook.** `OntologyRegistry.getImplementersOf(interfaceName: string): readonly ObjectTypeDef[]` returns all registered types declaring `implements: [..., interfaceName, ...]`. `getInterface(name): InterfaceDef | undefined` retrieves the contract itself. `registerInterface(def: InterfaceDef): void` registers; validators (§9.7) check structural conformance for every existing implementor.

**Validator rule (added to §9.7).** When `ObjectTypeDef.implements: ['X']` is declared, the registry resolves `X` to an `InterfaceDef` and runs three checks: every key in `X.requiredSchema.shape` is present in the implementor's `schema.shape` with a structurally-compatible Zod type (validator walks both schemas in parallel); every `X.requiredLinks` entry has a matching apiName/target/cardinality in the implementor's `links[]`; every `X.requiredActions` entry has a matching apiName whose params schema is a structural superset of the signature's. Mismatched type, missing member, or unregistered interface all throw `RegistrationError` at boot.

### 3.9 ObjectSetDef — named, typed, filtered collections

A common shape in agent reasoning: "the set of struggling students this session," "resources used in the last 3 lessons," "submissions awaiting Teacher Zhang's grading." Today these are derived slots with hardcoded filter logic baked into the manifest, and they can't be passed as Action parameters or referenced cross-manifest. `ObjectSetDef` makes them first-class.

```ts
/**
 * A named, typed, filterable collection of objects of a given ObjectType.
 *
 * Two registrations of an ObjectSetDef with the same `apiName` are the same
 * set (identity by name, not by filter structure — even if two sets happen
 * to compute the same filter, they're distinct unless the apiName matches).
 * This is the explicit "structural equality with explicit apiName" decision
 * from gap-analysis Open Question #4.
 *
 * Added per gap-analysis G6 (Tier 2).
 */
export interface ObjectSetDef {
  readonly apiName: string;
  readonly displayName: LocalizedString;
  /** ObjectTypeDef.apiName whose instances populate this set. */
  readonly objectType: string;
  /** Filter predicate evaluated server-side by the ManifestAccessor implementation. */
  readonly filter: SetFilter;
  /** Optional ordering — applied after filtering, before pagination. */
  readonly orderBy?: readonly OrderClause[];
  /** Optional default page size; consumers may override. */
  readonly defaultLimit?: number;
  /** Natural-language description for Agent consumption. REQUIRED. */
  readonly semantic: string;
}

/**
 * Filter expression — small first-order language, deliberately not Turing-complete.
 * Richer logic escapes into a named Predicate registered on the registry
 * (the same escape hatch used by AccessBoundary §5.5 and ActionPrecondition §3.3).
 */
export type SetFilter =
  | { readonly op: 'eq' | 'ne' | 'lt' | 'le' | 'gt' | 'ge'; readonly path: string; readonly value: string | number | boolean | null }
  | { readonly op: 'in'; readonly path: string; readonly values: readonly (string | number | boolean)[] }
  | { readonly op: 'has'; readonly path: string }
  | { readonly op: 'and' | 'or'; readonly clauses: readonly SetFilter[] }
  | { readonly op: 'not'; readonly clause: SetFilter }
  | { readonly op: 'named'; readonly name: string; readonly params?: Readonly<Record<string, unknown>> };

export interface OrderClause {
  readonly path: string;
  readonly direction: 'asc' | 'desc';
}
```

**Live-lesson example.** `struggling = ObjectSetDef { objectType: 'Student', filter: { op: 'lt', path: 'engagementScore', value: 30 }, orderBy: [{ path: 'engagementScore', direction: 'asc' }] }`. Registered once on the live-lesson backend. The agent can read it via `readSlot` if a manifest slot targets it; an Action `bulkFlagForIntervention(set: ObjectSet<Student>, reason)` can take it as a parameter; another manifest (a future `SemesterPlan`) can reference it without re-implementing the filter logic.

**Slot integration.** `SlotDef.target` (§4.2) gains a third discriminant: `{ kind: 'objectSet', name: string }`. A slot pointing at an ObjectSet is collection-typed by definition (no `collection: true` needed).

**Action parameter integration.** Use `objectSetRef('struggling')` inside a Zod action params schema — it returns a branded `z.string()` whose brand carries the ObjectSet apiName for runtime introspection. Example: `params: z.object({ targets: objectSetRef('struggling').describe('目标集合'), reason: z.string() })`.

**Why filter expressions are first-order.** Per gap-analysis Open Question #3: a Turing-complete predicate sub-language quickly becomes a security surface (sandboxing, resource limits, fixpoint-iteration concerns). First-order suffices for the 80% case (comparison + boolean + property access); the `'named'` escape hatch covers the remaining 20% by registering a named `Predicate` on the registry — the implementation lives in solution code where it can be reviewed.

**Path resolution.** Every `path` in a `SetFilter` resolves through the bound `ObjectType`'s Zod schema via `schema.shape` walking. `path: 'engagementScore'` is valid for `objectType: 'Student'` because `StudentSchema.shape.engagementScore` exists; `path: 'enagmentScore'` (typo) throws `RegistrationError` at `registerObjectSet()`. This is one of the wins of Zod-first — paths are validated against the same shape that runtime data is parsed against, so a filter that compiles is a filter that will execute against rows of the expected shape.

**Registry hook.** `OntologyRegistry.registerObjectSet(def)`, `.getObjectSet(name)`, `.getObjectSetsForType(typeName)`. The schema-distribution endpoint (§9.6) includes ObjectSets in its serialized payload; `getSchemaDigest()` hashes them alongside everything else.

### 3.10 ValidationRuleMeta — exposing domain constraints to the agent (Tier 3, G7)

Zod already does *structural* validation (type, format, range). What it doesn't natively surface to other consumers is *domain-rule* validation — "`durationMinutes` ≤ 60 unless `gradeLevel` === '高中'" type cross-field constraints. The native Zod tool for this is `.refine()` / `.superRefine()`, which works fine at parse time but is invisible to the agent's projected view (and to compliance reporters that want to enumerate "what rules govern LessonPlan?"). `ValidationRuleMeta` is the sidecar that makes refines discoverable.

```ts
/**
 * Metadata exposing a Zod refinement rule to the agent and to compliance
 * tooling. The actual validation logic lives in the .refine() / .superRefine()
 * call on the ObjectTypeDef.schema; the meta entry just gives that anonymous
 * predicate a name, severity, and natural-language explanation.
 *
 * Convention: refine() with a structured params object that carries `name`
 * matching a key in `validationRules`; the runtime cross-references.
 *
 * Added per gap-analysis G7 (Tier 3).
 */
export interface ValidationRuleMeta {
  /** Stable identifier; must match the name passed in the corresponding
   *  Zod .refine() params object. */
  readonly name: string;
  readonly severity: 'error' | 'warn';
  readonly message: LocalizedString;
  /** REQUIRED — what the rule enforces and when it fires (LLM-readable). */
  readonly semantic: string;
}

// Usage — on ObjectTypeDef:
const LessonPlan = defineObjectType({
  apiName: 'LessonPlan',
  // ... displayName, semantic, etc.
  schema: LessonPlanSchema.refine(
    (plan) => plan.durationMinutes <= 60 || plan.gradeLevel.startsWith('高中'),
    { message: '课程时长不应超过 60 分钟（高中除外）', params: { name: 'duration_cap' } }
  ),
  validationRules: [
    {
      name: 'duration_cap',
      severity: 'error',
      message: { 'zh-CN': '课程时长不应超过 60 分钟（高中除外）',
                 'en': 'Lesson duration must not exceed 60 minutes (high school excepted).' },
      semantic: 'Caps lesson duration at 60 min for K-12; relaxed for 高中 ' +
        'because high-school lessons commonly run 90 min in Chinese curricula.',
    },
  ],
  // ... rest of the def
});
```

Why this shape and not "declarative predicate expression":

- Refines can express anything; a constrained sub-language can't. The escape valve is the rule itself; the agent-facing surface is just metadata about that rule.
- Solutions already write Zod refines (live-lesson's `manifest.schema.ts` has them). We don't ask anyone to re-express working code in a custom DSL.
- The `params: { name: 'duration_cap' }` convention means the validator can deterministically link a refine to its meta entry, and the runtime can surface "rule X failed" with the meta's semantic+message rather than Zod's stringified path.

**Validator rule (§9.7).** When `ObjectTypeDef.validationRules` is set, every `name` in the array must appear as a `params.name` in some `.refine()` chained onto `schema`. The reverse is also enforced (every named refine has a meta entry). Anonymous refines without `params.name` are allowed but won't be projected to the agent — flag with a lint, not a hard error.

### 3.11 StateMachineDef — per-object lifecycle (Tier 3, G8)

`ManifestDef.lifecycle` (§4.5) covers the manifest as a whole. Individual objects often have their own state-machine: `Submission` goes `draft → submitted → graded → reviewed`, with certain transitions requiring approval. Today this lives in service-method code, invisible to the agent. `StateMachineDef` exposes it as schema.

```ts
/**
 * Per-object lifecycle bound to a single enum-typed property on the
 * ObjectType's Zod schema. Validators verify the property exists and is
 * a z.enum; transition `from`/`to` values are checked against the enum.
 *
 * Added per gap-analysis G8 (Tier 3).
 */
export interface StateMachineDef {
  /** Field key on ObjectTypeDef.schema; must reference a z.enum(...) field. */
  readonly property: string;
  readonly transitions: readonly Transition[];
}

export interface Transition {
  /** State value (must be one of the bound enum's options). */
  readonly from: string;
  /** Target state value (same constraint). */
  readonly to: string;
  /**
   * Optional ActionDef.apiName that performs this transition. When set,
   * the action's handler IS the transition mechanism — invoking the action
   * writes the new state value AND inherits the action's audit / approval
   * gates. When absent, any boundary-permitted writer can set the property
   * to `to` from `from` directly.
   */
  readonly action?: string;
  /** Forces approval gate even if the underlying ActionDef doesn't require it. */
  readonly requiresApproval?: boolean;
  /** REQUIRED — what this transition means. */
  readonly semantic: string;
}

// Usage on ObjectTypeDef (added field):
const Submission = defineObjectType({
  apiName: 'Submission',
  schema: z.object({
    id: z.string(),
    status: z.enum(['draft', 'submitted', 'graded', 'reviewed']),
    // ... other fields
  }),
  stateMachine: {
    property: 'status',
    transitions: [
      { from: 'draft', to: 'submitted', action: 'submitSubmission',
        semantic: 'Student submits their work.' },
      { from: 'submitted', to: 'graded', action: 'gradeSubmission',
        semantic: 'Teacher records a grade.' },
      { from: 'graded', to: 'reviewed', action: 'reviewSubmission',
        requiresApproval: true,
        semantic: 'Department head reviews graded submission. Requires approval.' },
    ],
  },
  // ... links, actions, picker
});
```

**Validator rule (§9.7).** `StateMachineDef.property` must reference a key on `ObjectTypeDef.schema.shape` whose Zod type is `z.enum(...)`. Every `from`/`to` in transitions must be one of the enum's options. Every named `action` must be a registered `ActionDef.apiName` whose params include a way to identify the target object instance (the validator checks for an `id` param or an objectRef param matching the ObjectType).

**Boundary semantics.** Writes to the state property bypass normal boundary-check writability and instead consult the state machine: a write is allowed only if there's a `Transition` from the current value to the proposed value AND the role has `actions` permission for the transition's `action` (when set). This is enforced by `boundary-check.ts` via a new `op: { kind: 'transition', objectType, property, from, to }`.

**Why per-object lifecycle is separate from manifest lifecycle.** Manifest lifecycle hooks (§4.5) fire on the operational *context* — session activate, slot change. Object state machines govern individual *entities* with potentially-long lives independent of any session — a Submission moves through `draft → reviewed` across multiple ClassroomSessions. Conflating the two would force every Object that has a lifecycle to be wrapped in its own ManifestDef.

---

## 4. Layer 2: Manifest composition

This is the core innovation and what distinguishes `kedge-ontology` from a generic schema library.

### 4.1 The problem Manifest solves

A flat `ObjectType` can describe "what a LessonPlan is." But it cannot describe "when a teacher is executing a lesson, what objects are in scope, what state exists, and what the Agent is allowed to do." That's a *composed operational context*, and it's the unit that Agents actually operate within.

The live-lesson backend has been groping toward this concept ad-hoc: `Lesson.manifestJson` (`solutions/business/live-lesson/backend/src/adapters/persistence/entities/lesson.entity.ts:30-31`) is a free-form JSON blob; `solutions/business/live-lesson/backend/src/schemas/manifest.schema.ts` is its Zod sanity check. `ManifestDef` is the formalization of that pattern.

### 4.2 SlotDef

A `Slot` is a typed placeholder in a `Manifest` that gets bound to a specific object instance (or collection of instances) at runtime.

```ts
/**
 * Slot target discriminator. Three forms:
 *  - 'objectType': bind to an ObjectTypeDef instance (the default case).
 *  - 'manifest': nest a child manifest (§9.2 — manifest nesting).
 *  - 'objectSet': bind to an ObjectSetDef (§3.9, Tier 2). Collection-typed
 *    by definition; `SlotDef.collection: true` is implied and need not be set.
 */
export type SlotTarget =
  | { readonly kind: 'objectType'; readonly apiName: string }
  | { readonly kind: 'manifest'; readonly name: string }
  | { readonly kind: 'objectSet'; readonly name: string };

export interface SlotDef {
  readonly apiName: string;
  readonly displayName: LocalizedString;
  readonly target: SlotTarget;
  /** True = bound to many instances; false/undef = single instance. */
  readonly collection?: boolean;
  readonly required?: boolean;
  /**
   * Dot-path expression that derives this slot's binding from another
   * slot, e.g. 'class.contains' (follow Class.contains LinkDef from
   * the `class` slot). Resolved by manifest/resolve.ts.
   */
  readonly derivedFrom?: string;
  /** Natural-language description for Agent reasoning. REQUIRED. */
  readonly semantic: string;
}
```

Key design decisions:

- `target.kind === 'manifest'` enables manifest nesting (§9.2). The runtime composes child boundaries on top of parent boundaries.
- `derivedFrom` avoids redundant data binding: if a `class` slot is bound, `students` can be `derivedFrom: 'class.contains'` and the resolver follows the link.
- `required` slots block manifest activation when unbound.

### 4.3 StateDef

Manifest-level state that doesn't belong to any individual object. Examples in a lesson session: current teaching phase, active resource index, whether the session is paused for intervention.

```ts
export interface StateDef<S extends z.ZodTypeAny = z.ZodTypeAny> {
  readonly apiName: string;
  readonly displayName: LocalizedString;
  /**
   * Zod schema for this state field. Use combinators directly:
   * `z.enum(['waiting', 'practice', 'discuss'])`, `z.boolean()`,
   * `z.string()`, `z.number().int().min(0)`. Per-state semantic via
   * `.describe()` on the schema is allowed but `semantic` below is
   * still required (it describes *when state changes happen*, which is
   * different from what a single value means).
   */
  readonly schema: S;
  /** Initial value when manifest activates. Type-checked against `schema`. */
  readonly initial: z.infer<S>;
  /** REQUIRED — what this state field means and when it changes. */
  readonly semantic: string;
}

// Example single field:
const phaseState = defineStateField({
  apiName: 'phase',
  displayName: '当前阶段',
  schema: z.enum(['waiting', 'listen', 'practice', 'discuss', 'takeaway', 'ended']),
  initial: 'waiting',
  semantic: 'Current teaching phase. Transitions follow plan.phaseConfig.unlockAfter order.',
});
```

Key design decisions:

- No `objectRef(...)` for state — state is value, not pointer. Pointers go in slots.
- `z.enum([...])` for state fields lets the agent know valid transitions without querying the backend; `zod-to-json-schema` exposes the enum to the projected view in §11.
- State changes flow through `ManifestAccessor.writeState` and are subject to `AccessBoundary` checks and audit logging.

### 4.4 AccessBoundary

The declaration of what a specific role can see and do within a manifest.

```ts
/**
 * Logical role within a manifest. Maps mechanically to the existing
 * platform roles + scopes — see §10.3 for the table.
 */
export type BoundaryRole =
  | 'agent'        // The AI agent operating within the manifest
  | 'picker'       // The @Picker UI consumer (typically end-user-driven)
  | 'admin'        // Platform / solution admin
  | string;        // Solution-defined custom roles permitted

export interface AccessBoundary {
  readonly role: BoundaryRole;
  /**
   * Slot names, dot-paths, or predicate-scoped entries. '*' wildcard
   * is permitted only for the 'admin' role.
   *
   * Two forms accepted (per gap-analysis G5, Tier 2):
   *  - Path string: 'plan' or 'plan.objective' — grant unconditional access.
   *  - Predicate entry: { slot, where } — grant access only to rows/instances
   *    that satisfy the BoundaryPredicate (see §5.5). Enables row-level
   *    security ("agent reads only Students in *this* manifest's class").
   */
  readonly readable: readonly BoundaryPathEntry[];
  /**
   * Typically a strict subset of readable. Agents should usually only
   * write to manifest state, not to underlying business objects.
   * Same shape as readable.
   */
  readonly writable: readonly BoundaryPathEntry[];
  /** ActionDef.apiNames callable by this role. */
  readonly actions: readonly string[];
  /** Streams (StreamDef.apiNames) this role may subscribe to. */
  readonly subscribes?: readonly string[];
}

/**
 * AccessBoundary path entry. Either an unconditional path or a path with
 * a row-level predicate. See §5.5 for the predicate sub-language.
 */
export type BoundaryPathEntry =
  | string
  | {
      readonly slot: string;
      readonly where: BoundaryPredicate;
    };
```

Key design decisions:

- `readable`/`writable` accept slot names or dot-paths into properties. `['plan']` grants the entire `LessonPlan`; `['plan.objective', 'plan.knowledgePoints']` grants only those.
- `actions` lists which `ActionDef`s are callable by this role. Combined with the `ActionDef`'s own `allowedRoles`, this creates a double-gate: the manifest must allow it AND the action must allow the role.
- `'*'` wildcard is supported only for `'admin'` and should never be used for agent access — validators warn.

### 4.5 LifecycleDef

Hooks for manifest lifecycle events, declared as `ActionDef` apiNames (not implementations).

```ts
export interface LifecycleDef {
  /** ActionDef apiName fired when a manifest instance is created/started. */
  readonly onActivate?: string;
  /** Fired when a manifest instance ends. */
  readonly onDeactivate?: string;
  /** Fired when a slot binding changes. */
  readonly onSlotChange?: string;
  /** Fired when manifest state transitions. */
  readonly onStateChange?: string;
}
```

These reference `ActionDef` apiNames, not function implementations. The actual execution is handled by whoever implements the `ManifestAccessor` interface (the NestJS backend, typically).

### 4.6 ManifestDef

The composite.

```ts
/**
 * Semver-flavored version string. Each manifest instance carries the
 * schemaVersion it was created with; migrations are explicit (§9.1).
 */
export type SchemaVersion = string;

export interface ManifestDef {
  readonly name: string;
  readonly displayName: LocalizedString;
  readonly schemaVersion: SchemaVersion;
  /** REQUIRED — what this manifest represents as an operational context. */
  readonly semantic: string;
  readonly slots: readonly SlotDef[];
  readonly streams?: readonly StreamDef[];
  readonly state: readonly StateDef[];
  readonly boundaries: readonly AccessBoundary[];
  readonly lifecycle?: LifecycleDef;
  /**
   * Declarative change-notification rules (§4.8, Tier 3, G10). When set,
   * the runtime fires through the existing notification subsystem (SSE +
   * push); the schema is the truth-source for "what gets notified when."
   */
  readonly notifications?: readonly NotificationRule[];
  /**
   * When this manifest is nested inside another (SlotDef.target.kind ===
   * 'manifest'), should the parent role propagate? Default: false (child
   * boundaries are evaluated independently with their own role mapping).
   */
  readonly inheritParentRole?: boolean;
}
```

A `ManifestDef` is registered in the `OntologyRegistry` alongside `ObjectTypeDef`s. It references `ObjectType`s by `apiName`. Think of `ObjectType` as the "noun" and `ManifestDef` as the "scene" that arranges nouns into an operable context.

### 4.7 Worked example: the complete `LessonSession` `ManifestDef`

Putting §3.6 together: this is what a real composed manifest looks like. Same caveat — this lives in `solutions/business/live-lesson/backend/src/ontology/lesson-session.manifest.ts`, not in the ontology package.

```ts
const LessonSession: ManifestDef = {
  name: 'LessonSession',
  displayName: '课堂会话',
  schemaVersion: '1.0.0',
  semantic:
    'A single in-progress run of a LessonPlan with a specific Class. Composes ' +
    'the static plan + class + resources with the live event stream and runtime ' +
    'phase state. The agent operates within this context to observe and coach.',

  slots: [
    {
      apiName: 'plan',
      displayName: '教学计划',
      target: { kind: 'objectType', apiName: 'LessonPlan' },
      required: true,
      semantic: 'The lesson plan being executed. Bound once at session creation; never reassigned mid-session.',
    },
    {
      apiName: 'class',
      displayName: '班级',
      target: { kind: 'objectType', apiName: 'Class' },
      required: true,
      semantic: 'The class participating. Bound at session creation.',
    },
    {
      apiName: 'students',
      displayName: '学生',
      target: { kind: 'objectType', apiName: 'Student' },
      collection: true,
      derivedFrom: 'class.contains',
      semantic: 'Students enrolled in the bound class. Derived — auto-resolved from `class.contains`, not separately populated.',
    },
    {
      apiName: 'resources',
      displayName: '可用资源',
      target: { kind: 'objectType', apiName: 'Resource' },
      collection: true,
      derivedFrom: 'plan.usesResources',
      semantic: 'Resources embedded in the bound plan. Derived from `plan.usesResources`.',
    },
  ],

  streams: [
    {
      apiName: 'events',
      displayName: '课堂事件流',
      payloadType: 'ClassroomEvent',
      backpressure: 'drop_oldest',
      semantic:
        'Push stream of ClassroomEvent emitted by the GLM-4.7-Flash observation ' +
        'engine as the class progresses. Drop-oldest backpressure: the agent is ' +
        'expected to react to recent events, not replay history.',
    },
  ],

  state: [
    defineStateField({
      apiName: 'phase',
      displayName: '当前阶段',
      schema: z.enum(['waiting', 'listen', 'practice', 'discuss', 'takeaway', 'ended']),
      initial: 'waiting',
      semantic:
        'Current teaching phase. Transitions follow plan.phaseConfig.unlockAfter ' +
        'order. Writable by agent and teacher; advances trigger onStateChange.',
    }),
    defineStateField({
      apiName: 'activeStepId',
      displayName: '当前步骤ID',
      schema: z.string().nullable(),
      initial: null,
      semantic: 'Current readingSteps[].id within the active phase. Null until phase leaves "waiting".',
    }),
    defineStateField({
      apiName: 'pausedForIntervention',
      displayName: '已暂停干预',
      schema: z.boolean(),
      initial: false,
      semantic:
        'True if the session is paused for teacher intervention (e.g. ≥5 students stuck). ' +
        'Writable by agent; teacher can override via dashboard.',
    }),
  ],

  boundaries: [
    {
      role: 'agent',
      readable: ['plan', 'class', 'students', 'resources'],
      writable: ['phase', 'activeStepId', 'pausedForIntervention'],
      actions: ['adjustDifficulty', 'flagForIntervention'],
      subscribes: ['events'],
    },
    {
      role: 'picker',
      // Teacher's @-picker: can reference plan/class/students/resources but
      // cannot write state or call actions through the picker surface.
      readable: ['plan', 'class', 'students', 'resources'],
      writable: [],
      actions: [],
    },
    {
      role: 'admin',
      readable: ['*'],
      writable: ['*'],
      actions: ['*'],
      subscribes: ['events'],
    },
  ],

  lifecycle: {
    onActivate: 'startObservationStream',   // ActionDef apiName, registered separately
    onDeactivate: 'generateSessionReport',
    onStateChange: 'broadcastStateToFrontend',
  },

  // No inheritParentRole — if a SemesterPlan manifest one day nests LessonSession,
  // each LessonSession gets its own boundary evaluation.
};
```

What this declaration buys you, concretely:

- **The agent's system prompt is auto-generated.** §11 projects this manifest into a `system-prompt` markdown fragment that the agent receives at session start; the human-written prompt in `solution.json` shrinks to "you're the lesson observer" + behavioral guidance.
- **The @Picker's menu is auto-generated.** The teacher sees `plan / class / students / resources` as referenceable types within this session, because the `picker` role's `readable` lists them.
- **`writeState('phase', 'practice')` is governed.** When the agent (or teacher dashboard) calls it, `checkBoundary` confirms `phase` is in the writer's `writable` list. No application code does this check.
- **`executeAction('flagForIntervention', { ... })` is governed twice.** First `checkBoundary` confirms the agent is allowed (`'flagForIntervention'` is in `actions`); then `ToolCallerProxy` enforces the `ActionDef.requiredScopes: ['chat']` and writes the audit row. The action's handler never sees an unauthorized call.

### 4.8 NotificationRule — declarative change notifications (Tier 3, G10)

Notifying the teacher's mobile when `phase` changes today requires handler code that calls an SSE broadcaster, a push-notification service, or both. The notification target is implicit — review of "what gets notified when" requires reading every handler. `NotificationRule` makes it declarative: the schema becomes the truth-source for "what fires when," and the runtime dispatches through the existing core notification subsystem.

```ts
/**
 * Declarative rule firing when a matched event occurs inside a manifest
 * instance. Evaluated by the runtime after the triggering operation
 * commits (state write succeeds / action succeeds / stream event delivered).
 *
 * Added per gap-analysis G10 (Tier 3).
 */
export interface NotificationRule {
  /** What triggers this rule. */
  readonly on: 'stateChange' | 'actionResult' | 'streamEvent';
  /**
   * Predicate filtering which events of the chosen `on` kind actually fire
   * this rule. Reuses the §5.5 BoundaryPredicate sub-language with the
   * relevant root paths: `state.<field>` / `action.<apiName>` / `event.<...>`.
   * Example: { op: 'eq', path: 'state.phase', value: 'practice' } fires
   * only when phase transitions TO practice.
   */
  readonly match: BoundaryPredicate;
  /** Where to send the notification. Open discriminated union. */
  readonly channel: NotificationChannel;
  /** REQUIRED — when this rule fires and why a Solution would want it. */
  readonly semantic: string;
}

/**
 * Notification dispatch target. Three built-in channels cover the common
 * cases; Solutions register custom channels via `registerNotificationChannel(name, impl)`
 * — same escape-hatch pattern as named Predicates (§5.5).
 */
export type NotificationChannel =
  /** Fan out via the existing SSE relay; `target` is a session-relative event name. */
  | { readonly kind: 'sse'; readonly target: string }
  /** Push notification to a registered device; `target` is a device-token query path. */
  | { readonly kind: 'push'; readonly target: string }
  /** Custom channel — name resolves to an impl registered on OntologyRegistry. */
  | { readonly kind: 'named'; readonly name: string; readonly params?: Readonly<Record<string, unknown>> };
```

**Usage example.** Notify the teacher's mobile when the phase enters `practice`:

```ts
const LessonSession = defineManifest({
  // ... existing slots, state, boundaries
  notifications: [
    {
      on: 'stateChange',
      match: { op: 'eq', path: 'state.phase', value: 'practice' },
      channel: { kind: 'push', target: 'session.teacher.deviceToken' },
      semantic: 'Wake the teacher when class enters practice phase — they ' +
        'should be circulating to observe students working.',
    },
    {
      on: 'actionResult',
      match: {
        op: 'and',
        clauses: [
          { op: 'eq', path: 'action.apiName', value: 'flagForIntervention' },
          { op: 'eq', path: 'action.params.severity', value: 'urgent' },
        ],
      },
      channel: { kind: 'push', target: 'session.teacher.deviceToken' },
      semantic: 'Surface urgent intervention flags as push notifications, ' +
        'not just dashboard updates.',
    },
  ],
});
```

**Validator rule (§9.7).** Every `match` predicate's `PathExpr` resolves through the appropriate Zod schema (state schema for `on: 'stateChange'`, action params for `on: 'actionResult'`, stream payload for `on: 'streamEvent'`). Every `kind: 'named'` channel name must be a registered NotificationChannel impl.

**Why not just have handlers call notifyTeacher() themselves?** Because that's invisible to four downstream consumers: the agent (which should know "if I emit a flagForIntervention with severity=urgent, the teacher gets notified"), audit reporting ("show me every push notification fired in October"), the privacy review (which needs to enumerate notification channels per user), and the operator-debug experience (a 404 on the notification endpoint should be traceable to a schema-declared rule, not a hidden service call). Declarative notifications are the schema-as-truth-source principle (§1.7 Principle 5) applied to side-channels.

---

## 5. Layer 3: Accessor protocols

### 5.1 ManifestAccessor

This is the **interface** that all consumers implement to interact with a manifest instance. `kedge-ontology` defines the interface; the Jijian backend provides the implementation (typically wrapping `EntityContextProvider` from `packages/context-layer` and the `ToolCallerProxy`).

```ts
export interface ManifestAccessor {
  /** Identity the accessor is operating under. */
  readonly role: BoundaryRole;
  readonly manifestName: string;
  readonly manifestInstanceId: string;

  /** Read the object(s) bound to a slot. */
  readSlot(name: string): Promise<unknown>;

  /** Read manifest-level state (dot-path supported). */
  readState(path: string): Promise<unknown>;

  /** Write manifest-level state (boundary-checked, audited). */
  writeState(path: string, value: unknown): Promise<ActionResult>;

  /** Follow a LinkDef from a slot's object to related objects. */
  traverse(slot: string, link: string): Promise<unknown>;

  /** List actions available for the current role (schema-derived). */
  discoverActions(): Promise<readonly ActionDescriptor[]>;

  /** Execute an action (boundary-checked, audited via ToolCallerProxy). */
  executeAction(
    apiName: string,
    params: Record<string, unknown>,
  ): Promise<ActionResult>;

  /** Subscribe to a stream (StreamDef). Handler invoked per event. */
  subscribeStream(
    name: string,
    handler: (event: unknown) => void | Promise<void>,
  ): Promise<{ readonly unsubscribe: () => void }>;
}

export interface ActionDescriptor {
  readonly apiName: string;
  readonly displayName: LocalizedString;
  readonly semantic: string;
  /** Same Zod schema the agent's tool-use API will validate against. */
  readonly params: z.ZodObject<z.ZodRawShape>;
  readonly sideEffects: readonly string[];
  readonly requiresApproval: boolean;
}
```

Key design decisions:

- The interface is async throughout. Even `discoverActions()` is async to permit implementations that filter on dynamic state.
- Every `writeState` / `executeAction` call passes through `boundary-check.ts` (a pure function) before reaching the implementation. The boundary check is in the package, not in the application code.
- `executeAction` returns an `ActionResult` with explicit `stateChanges` (what changed), `pendingApproval` (if the action needs human approval), and `auditId` (for traceability — references the existing `tool_events` table written by `ToolCallerProxy`).
- **Typed slot reads via Zod inference.** A concrete `ManifestAccessor<M>` (where `M` is the `ManifestDef` instance) can narrow `readSlot(name)` to `Promise<z.infer<SlotSchema<M, K>>>`. This is opt-in — callers can stay at `Promise<unknown>` if they don't need the narrowing. The mapped type lives in `accessor/types.ts`; the runtime cost is zero (TS-only).

### 5.2 boundary-check.ts

A pure function: given a `ManifestDef`, a role, and an operation, return a `BoundaryDecision`. This is the one piece of runtime logic in the package proper (everything else is types and interfaces).

When `AccessBoundary.readable` / `writable` entries are predicate-scoped (Tier 2, §4.4 + §5.5), `checkBoundary` also receives the candidate row(s) being evaluated (passed via an extended `BoundaryCheckInput` shape) and evaluates `BoundaryPredicate` per row. A non-predicate path entry is equivalent to `where: { op: 'has', path: '' }` always-true — no behavior change for Solutions that don't adopt predicates.

```ts
export interface BoundaryCheckInput {
  readonly manifest: ManifestDef;
  readonly role: BoundaryRole;
  readonly op:
    | { readonly kind: 'read'; readonly path: string }
    | { readonly kind: 'write'; readonly path: string }
    | { readonly kind: 'action'; readonly actionApiName: string }
    | { readonly kind: 'subscribe'; readonly streamApiName: string };
}

export interface BoundaryDecision {
  readonly allowed: boolean;
  /** Human-readable reason for denial. */
  readonly reason?: string;
  /** When allowed and action requires it, must trigger approval flow. */
  readonly requiresApproval?: boolean;
  /**
   * When an action is denied because preconditions failed, the failing
   * predicates are listed here (one entry per ActionPrecondition that
   * evaluated to false). Used by discoverActions() to render "available
   * actions" filtered + by the projected semantic view to explain *why*
   * an action is not currently callable.
   *
   * Added per gap-analysis G2 (Tier 1).
   */
  readonly unmetPreconditions?: readonly string[];
}

export function checkBoundary(input: BoundaryCheckInput): BoundaryDecision;
```

Used by:

- The NestJS backend before executing operations (the `ToolCallerProxy` bridge adds `checkBoundary` to its permission step).
- The Vue/React frontend to show/hide UI elements (`@Picker` only shows traversable slots and pickable types).
- The Agent runtime to filter `discoverActions()`.

### 5.3 ActionResult

Structured outcome of any state-mutating call (`writeState`, `executeAction`).

```ts
export interface ActionResult<R = unknown> {
  readonly success: boolean;
  readonly stateChanges: readonly StateChange[];
  /**
   * Typed return value, parsed against `ActionDef.returnType` (Tier 3, G11).
   * Present only for Actions that declare a returnType; pure state-mutators
   * leave this undefined and consumers read `stateChanges` instead.
   * Inferred type at the call site: `z.infer<typeof actionDef.returnType>`.
   */
  readonly returnValue?: R;
  /** Set when the action requires human approval before commit. */
  readonly pendingApproval?: string;
  /** References the existing tool_events audit row written by ToolCallerProxy. */
  readonly auditId: string;
  readonly error?: { readonly code: ActionErrorCode; readonly message: string };
}

export interface StateChange {
  readonly path: string;
  readonly before: unknown;
  readonly after: unknown;
}

export type ActionErrorCode =
  | 'boundary_denied'
  | 'validation_failed'
  | 'pending_approval'
  | 'handler_error'
  | 'tool_not_found';
```

`ActionErrorCode` is deliberately a superset of `ToolResult`'s failure codes in `packages/backend/src/tool-caller/types.ts`, with two ontology-specific additions (`boundary_denied`, `pending_approval`).

### 5.4 Reference implementation skeleton (NestJS, solution-side)

The `ManifestAccessor` interface lives in this package; the concrete impl lives in `packages/backend/src/ontology/` (per ADR-0001 it can't live in the solution backend either, because the bridge to `ToolCallerProxy` needs core-package access). Solution backends inject this service and pass it a manifest instance ID.

```ts
// packages/backend/src/ontology/default-manifest-accessor.service.ts
@Injectable()
export class DefaultManifestAccessor implements ManifestAccessor {
  constructor(
    private readonly registry: OntologyRegistry,           // from @kedge-agentic/ontology
    private readonly proxy: ToolCallerProxyService,        // existing
    private readonly entityCtx: EntityContextProvider,     // existing — from context-layer
    private readonly sessionMeta: SessionMetadataService,  // existing — KV per session
    private readonly auditSink: ToolCallAuditSink,         // existing
  ) {}

  readonly role: BoundaryRole;
  readonly manifestName: string;
  readonly manifestInstanceId: string;

  async readSlot(name: string): Promise<unknown> {
    const manifest = this.requireManifest();
    const decision = checkBoundary({
      manifest, role: this.role, op: { kind: 'read', path: name },
    });
    if (!decision.allowed) throw new BoundaryDeniedError(decision.reason);

    const slot = manifest.slots.find((s) => s.apiName === name);
    if (!slot) throw new Error(`Unknown slot: ${name}`);

    // Derived slots resolve through declared LinkDef traversal.
    if (slot.derivedFrom) return this.resolveDerived(slot);

    // Plain slots: look up the bound instance via EntityContextProvider.
    const binding = await this.sessionMeta.get(this.manifestInstanceId, `slot:${name}`);
    if (!binding) return slot.collection ? [] : null;
    return this.entityCtx.getContext(binding as string, this.role);
  }

  async writeState(path: string, value: unknown): Promise<ActionResult> {
    const manifest = this.requireManifest();
    const decision = checkBoundary({
      manifest, role: this.role, op: { kind: 'write', path },
    });
    if (!decision.allowed) {
      return failureResult('boundary_denied', decision.reason ?? 'denied');
    }

    const before = await this.sessionMeta.get(this.manifestInstanceId, `state:${path}`);
    await this.sessionMeta.set(this.manifestInstanceId, `state:${path}`, value);

    // Audit row written through the same sink ToolCallerProxy uses.
    const auditId = await this.auditSink.record({
      sessionId: this.contextSessionId(),
      solutionId: this.contextSolutionId(),
      actingUserId: this.contextActingUserId(),
      tool: `__manifest_state_write:${this.manifestName}:${path}`,
      strippedFields: [],
      outcome: 'ok',
      argsRedacted: { path, value },
      startedAt: Date.now(),
      durationMs: 0,
    });

    return {
      success: true,
      stateChanges: [{ path, before, after: value }],
      auditId,
    };
  }

  async executeAction(apiName: string, params: Record<string, unknown>): Promise<ActionResult> {
    const manifest = this.requireManifest();
    const decision = checkBoundary({
      manifest, role: this.role, op: { kind: 'action', actionApiName: apiName },
    });
    if (!decision.allowed) {
      return failureResult('boundary_denied', decision.reason ?? 'denied');
    }
    if (decision.requiresApproval) {
      // Surface a pending-approval result; the human-approval flow lives outside this method.
      const approvalId = await this.requestApproval(apiName, params);
      return { success: false, stateChanges: [], pendingApproval: approvalId,
               auditId: '', error: { code: 'pending_approval', message: 'awaiting human approval' } };
    }

    // Hand off to the ToolCallerProxy — this is the bridge in §10.2.
    // The proxy's 6-step pipeline (sanitize / validate / permission /
    // inject / dispatch / audit) does the rest, including writing the
    // tool_events row that becomes our auditId.
    const result = await this.proxy.invoke(
      { tool: this.qualifyToolName(apiName), args: params },
      this.executionContext(),
    );

    if (!result.ok) {
      return failureResult(result.code as ActionErrorCode, result.reason);
    }
    return {
      success: true,
      stateChanges: this.extractStateChanges(result),
      auditId: this.proxy.lastAuditId, // proxy exposes this for our wrapper
    };
  }

  // ...readState, traverse, discoverActions, subscribeStream omitted for brevity.
}
```

Things to notice:

- **`DefaultManifestAccessor` carries `role`, `manifestName`, `manifestInstanceId` on the instance**, not in every method call. Construct one per session-x-role pairing; pass it into agent handlers.
- **Slot reads always go through `EntityContextProvider`** — we don't reinvent the wheel. The provider already knows how to load an entity by id for a role; we only add the boundary check.
- **State writes use `SessionMetadataService`** (the existing per-session KV in core). For most manifests, state fits comfortably in the 256 KB/session budget. Solutions with larger state can substitute their own provider.
- **Action execution hands off to `ToolCallerProxy`** unchanged. The ontology package does not re-implement sanitize/validate/audit; it slots a new `boundary_denied` gate in front of the existing pipeline.
- **Lifecycle hooks** (`onActivate`, `onDeactivate`, `onStateChange`, `onSlotChange`) fire via the same `executeAction` path — the runtime simply calls `executeAction(manifest.lifecycle.onActivate!, {})` when the session starts. So hooks inherit governance + audit for free.
- **Redaction pipeline** (Tier 3, G12): when `readSlot` returns objects, the accessor walks `ObjectTypeDef.meta` for each readable property and applies `redaction.strategy` if the role is in `redaction.roles`. `mask` replaces with the template (defaulting per Zod type); `hash` replaces with sha256(value) preserving equality; `omit` deletes the property from the returned object. Redaction runs after the boundary check, before return — so a permitted reader still sees the *masked* value rather than nothing, which matters for downstream code that reasons about field presence.
- **Notification dispatch** (Tier 3, G10): after each successful state write or action execution, the runtime evaluates `ManifestDef.notifications`; for each matching rule, it invokes the channel's dispatch handler (built-in for `sse`/`push`; resolved through the registry for `kind: 'named'`). Dispatch failures are logged but do not roll back the triggering operation — notifications are best-effort, not transactional.

### 5.5 BoundaryPredicate — the shared predicate sub-language

Three primitives (`AccessBoundary` §4.4, `ObjectSetDef.filter` §3.9, `ActionDef.preconditions` §3.3) all need a small predicate language. Rather than three independent designs, the package defines one `BoundaryPredicate` shape and reuses it everywhere. Per gap-analysis Open Question #3, the language is deliberately **first-order**: no function calls, no quantifiers, no fixpoint iteration. Richer logic escapes through the `'named'` form, which dispatches to a `Predicate` registered on `OntologyRegistry`.

```ts
/**
 * First-order predicate over: (a) the requester's ExecutionContext,
 * (b) the slot or row being evaluated, (c) manifest state.
 *
 * Used by:
 *  - AccessBoundary path entries (row-level security) — §4.4
 *  - ObjectSetDef filters — §3.9 (SetFilter is a structural subset)
 *  - ActionDef preconditions (kind: 'named' escape hatch) — §3.3
 *
 * Added per gap-analysis G5 (Tier 2).
 */
export type BoundaryPredicate =
  /** Equality / inequality / ordering on a single path. */
  | { readonly op: 'eq' | 'ne' | 'lt' | 'le' | 'gt' | 'ge'; readonly path: PathExpr; readonly value: PredicateValue }
  /** Membership in a literal set. */
  | { readonly op: 'in'; readonly path: PathExpr; readonly values: readonly PredicateValue[] }
  /** Path resolves to a non-null/non-empty value. */
  | { readonly op: 'has'; readonly path: PathExpr }
  /** Boolean composition — no implicit short-circuit semantics; evaluators may parallelize. */
  | { readonly op: 'and' | 'or'; readonly clauses: readonly BoundaryPredicate[] }
  | { readonly op: 'not'; readonly clause: BoundaryPredicate }
  /**
   * Escape hatch: dispatches to a Predicate registered on the OntologyRegistry
   * via `registerPredicate(name, impl)`. The impl receives the same evaluation
   * context as built-in operators but may use arbitrary logic. Reviewable as
   * code, not as data — which is the whole point of the escape hatch.
   */
  | { readonly op: 'named'; readonly name: string; readonly params?: Readonly<Record<string, unknown>> };

/**
 * A path expression with a discriminant prefix indicating its root:
 *  - 'ctx.actingUserId' → ExecutionContext.actingUserId
 *  - 'row.engagementScore' → the field on the row being evaluated
 *  - 'state.phase' → manifest state at path 'phase'
 *  - 'slot.<slotName>.<...>' → traverse into a bound slot
 *
 * Bare paths without prefix are interpreted as 'row.' (the common case).
 */
export type PathExpr = string;

export type PredicateValue = string | number | boolean | null;
```

**Live-lesson example for row-level boundary.** `LessonSession`'s `agent` boundary today reads:

```ts
{ role: 'agent', readable: ['students', 'events'], ... }
```

After G5, the same intent — "agent reads only events for students in this session's class" — encodes as:

```ts
{
  role: 'agent',
  readable: [
    'students',
    {
      slot: 'events',
      where: {
        op: 'in',
        path: 'row.student.id',
        values: ['__derived_from_slot:students.id'],  // resolved at eval time
      },
    },
  ],
  // ...
}
```

The runtime's `checkBoundary` resolves slot-derived value sets, evaluates the predicate per row, and returns only matching rows. The agent never sees events from outside its session's roster — and the claim is in the schema, not in handler code.

**Cross-primitive reuse.** `ObjectSetDef.filter` is structurally a subset of `BoundaryPredicate` (no `'named'` arm initially; can be extended). `ActionPrecondition.kind: 'named'` dispatches to the same `Predicate` registry as `BoundaryPredicate.op: 'named'`. One predicate registered with `registerPredicate('isInPracticePhase', impl)` is reusable as both an Action precondition and an ObjectSet filter — single source of truth.

**Why first-order.** A Turing-complete predicate sub-language brings real costs: sandbox concerns, evaluation-resource limits, debugging difficulty, opacity to LLM reasoning. First-order suffices for the 80% case; the `'named'` form covers the rest with code-reviewed implementations. Promoting the language to richer semantics requires an ADR; per gap-analysis §5 Q3 we are explicitly cautious here.

**Path resolution via Zod.** Every `PathExpr` resolves through one of three Zod schemas — the row's `ObjectType.schema` (for `row.<field>`), the manifest's state field schema (for `state.<field>`), or the bound slot's schema (for `slot.<name>.<field>`). Resolution walks `.shape` and rejects paths whose final segment doesn't exist or whose intermediate segments don't traverse a `z.object`. This is enforced at registration of any `ManifestDef` / `ObjectSetDef` / `ActionDef` that uses a predicate — bad paths never reach the runtime.

**Registry hook.** `OntologyRegistry.registerPredicate(name: string, impl: PredicateImpl): void`. `PredicateImpl` is a function `(ctx: PredicateEvalContext, params?) => boolean`. Predicates registered late (after a `ManifestDef` referencing them is already registered) trigger a re-validation pass and may throw `RegistrationError` if the referencing schema is now invalid — same fail-fast philosophy as §9.7.

---

## 6. Cross-cutting: Registry

The Registry is the lookup table for all `ObjectTypeDef`s and `ManifestDef`s and the source of truth for schema distribution (§9.6).

```ts
export class OntologyRegistry {
  // Core registration
  registerObjectType(def: ObjectTypeDef): void;
  registerManifest(def: ManifestDef): void;
  registerFunction(def: FunctionDef): void;          // Tier 1 (§3.7)
  registerInterface(def: InterfaceDef): void;        // Tier 2 (§3.8)
  registerObjectSet(def: ObjectSetDef): void;        // Tier 2 (§3.9)
  registerPredicate(name: string, impl: PredicateImpl): void;  // Tier 2 (§5.5)

  // Core lookup
  getObjectType(apiName: string): ObjectTypeDef | undefined;
  getManifest(name: string): ManifestDef | undefined;
  getFunction(apiName: string): FunctionDef | undefined;
  getInterface(name: string): InterfaceDef | undefined;
  getObjectSet(name: string): ObjectSetDef | undefined;
  getPredicate(name: string): PredicateImpl | undefined;

  /** All ObjectTypes that have picker config (for @Picker root menu). */
  getPickableTypes(): readonly ObjectTypeDef[];

  /** All links from a type that are marked traversable. */
  getTraversableLinks(typeName: string): readonly LinkDef[];

  /** Which manifests include this type as a slot ("where is this used?"). */
  getManifestsForType(typeName: string): readonly ManifestDef[];

  /**
   * All ObjectTypes that declare `implements: [..., interfaceName, ...]`.
   * Resolved at registration time (Open Question #2 — registration-time
   * dispatch); a Solution that needs runtime polymorphism overrides this
   * method with a custom resolver.
   *
   * Added per gap-analysis G4 (Tier 2).
   */
  getImplementersOf(interfaceName: string): readonly ObjectTypeDef[];

  /** All ObjectSets backed by a given ObjectType (for cross-set introspection). */
  getObjectSetsForType(typeName: string): readonly ObjectSetDef[];

  /**
   * All properties across all registered ObjectTypes that carry the given
   * classification tag (Tier 3, G9). Drives compliance reports like
   * "list every PII field accessible by Solution X."
   * Returns `{ objectType, fieldKey, meta }` tuples.
   */
  getPropertiesByClassification(tag: Classification): readonly Array<{
    readonly objectType: string;
    readonly fieldKey: string;
    readonly meta: PropertyMeta;
  }>;

  /** Register a named NotificationChannel impl (Tier 3, G10). */
  registerNotificationChannel(name: string, impl: NotificationChannelImpl): void;
  getNotificationChannel(name: string): NotificationChannelImpl | undefined;

  /**
   * Resolve a `displayName: LocalizedString` to a concrete string for the
   * given locale, falling back per Design Principle 6 (§1.7).
   * Added per gap-analysis G3 (Tier 1).
   */
  getDisplayName(def: { displayName: LocalizedString }, locale?: string): string;

  /**
   * Per-property display label resolver. If `meta[fieldKey].displayName` is
   * set, returns that; otherwise falls back to the field's Zod `.description`
   * text; finally falls back to the field key itself. Used by the projected
   * semantic view (§11) and the @Picker.
   */
  getFieldDisplayName(objectType: string, fieldKey: string, locale?: string): string;

  /**
   * Stable content-hash of the registered schema. Drives the
   * GET /api/v1/ontology/schema ETag header (§9.6).
   *
   * Two registries that have registered the same defs in any order
   * MUST produce the same digest. Implementation: canonicalize Zod
   * schemas via `zod-to-json-schema` (stable across Zod versions),
   * concat with non-schema defs sorted by apiName/name, sha256.
   * Predicate *names* are hashed; predicate impl bodies are not
   * (they live in code, not schema).
   */
  getSchemaDigest(): string;
}
```

The Registry is instantiated once per process and shared. Solution backends populate it at startup (the same lifecycle as `SolutionToolkitRegistry.register()` today — see `packages/backend/src/tool-caller/solution-toolkit-registry.ts`).

Registration is **validating** — every `register*()` call runs the full `src/schema/validators.ts` suite (§9.7) and throws on the first violation. This is the gate that makes the schema's governance claims trustworthy.

### 6.1 What registration looks like at solution boot

Pattern: each solution's `*.module.ts` calls `OnModuleInit.onModuleInit()`, which registers ObjectTypes first (so manifests can reference them) and manifests second.

```ts
// solutions/business/live-lesson/backend/src/ontology/ontology.module.ts
@Module({
  imports: [/* …existing… */],
  providers: [LessonSessionAccessor /* …existing services… */],
})
export class OntologyModule implements OnModuleInit {
  constructor(private readonly registry: OntologyRegistry) {}

  onModuleInit() {
    // Order matters: ObjectTypes before ManifestDefs that reference them,
    // and child manifests before parents (if you use nesting per §9.2).
    try {
      this.registry.registerObjectType(LessonPlan);
      this.registry.registerObjectType(Class);
      this.registry.registerObjectType(Student);
      this.registry.registerObjectType(Resource);
      this.registry.registerObjectType(ClassroomEvent);
      this.registry.registerManifest(LessonSession);
    } catch (err) {
      if (err instanceof RegistrationError) {
        // Don't swallow — a bad schema must fail boot loudly so dev catches
        // it before customers do.
        Logger.error(`[ontology] registration failed: ${err.toString()}`);
        throw err;
      }
      throw err;
    }
  }
}
```

What the validators catch at this point (representative — full list in §9.7):

| Violation | Example | When caught |
|---|---|---|
| `refTarget` not registered | `LessonPlan.targetClass` says `target: 'Class'` but `Class` never registered | First `registerManifest`/`registerObjectType` call after the dangling reference |
| `derivedFrom` path invalid | `students` slot says `derivedFrom: 'class.containz'` (typo) | `registerManifest(LessonSession)` |
| AccessBoundary references unknown slot | `agent` boundary says `actions: ['adjustDifficultie']` | `registerManifest(LessonSession)` |
| Empty `semantic` | Any primitive with `semantic: ''` | The matching `register*` call |
| Circular link chain | `A.next → B`, `B.next → C`, `C.next → A` all `cardinality: '1:1'` | `registerObjectType` of the last in the cycle |
| `'*'` wildcard on non-admin role | `agent` boundary writes `readable: ['*']` | `registerManifest` |

`RegistrationError` carries the failing reference (slot name, link apiName, etc.) and the rule that fired, so the boot log points straight at the broken declaration.

---

## 7. Cross-cutting: Semantic projection

This module answers: **how does an Agent "see" a manifest?**

When an Agent enters a manifest context, it doesn't receive raw TypeScript types. It receives a projected view: a structured description of what's available, formatted for LLM consumption. `semantic/project.ts` takes a `ManifestDef` + a role and produces a `ProjectedManifest`; sub-formatters in `semantic/formats/` render that into specific consumption shapes.

```ts
export type ProjectionFormat =
  | 'anthropic-tools'      // Tool-use JSON schema for Claude Code
  | 'system-prompt'        // Markdown fragment for inlining in system prompts
  | 'mcp-tools';           // MCP tool descriptors for ToolCallerProxy

export interface ProjectedManifest {
  readonly summary: string;
  readonly readableSlots: readonly ProjectedSlot[];
  readonly writableState: readonly ProjectedState[];
  readonly availableActions: readonly ActionDescriptor[];
  readonly subscribableStreams: readonly ProjectedStream[];
}

export function projectManifest(
  manifest: ManifestDef,
  registry: OntologyRegistry,
  role: BoundaryRole,
  format: ProjectionFormat,
): unknown; // shape depends on format — see §11 for examples
```

**Pipeline (Zod-first revision).** For each role-readable slot, the projector:

1. Resolves the slot's `ObjectType` and reads its registered Zod `schema`.
2. Runs the schema through `zod-to-json-schema` to get the structural JSON Schema (field names, types, enum values, format constraints).
3. For per-field `semantic` text, walks the schema's `.shape` and reads each field's `.description` (set via `z.string().describe('...')`).
4. For picker / governance hints (`searchable`, `displayRole`, `computed`), reads the `ObjectType.meta` sidecar.
5. Composes (1)+(2)+(3) into per-slot `ProjectedSlot` entries — structural + semantic + presentation in one shape.

For each role-callable action, the same pipeline runs on `ActionDef.params` — the action's parameter schema is a `z.object()`, so `zod-to-json-schema(actionDef.params)` produces the JSON Schema directly (this is exactly the schema `ToolCallerProxy` parses against, so what the agent sees matches what gets validated). For `FunctionDef`, same treatment for `params` and `returnType`.

For state and streams, same: Zod for structure, `.describe()` for per-field semantic, no meta sidecar (state and streams have no presentation layer).

The package provides the data; the consuming Agent runtime decides how to assemble it into a final prompt or tool list. Concrete worked examples in §11.

---

## 8. How the pieces connect — lesson session example

This is not prescriptive domain modeling. It's an illustration of how the package primitives compose. (Cross-reference: live-lesson's existing `manifestJson` + `manifest.schema.ts` + `board-data.js` is the pre-formalization version of this.)

### The scenario

A teacher starts a lesson. An Agent needs to observe the class, adjust pacing, and suggest interventions. The @Picker needs to let the teacher reference resources and students during the lesson.

### What gets defined (by the live-lesson solution, not by kedge-ontology)

1. **ObjectTypeDefs** for `LessonPlan`, `Resource`, `Class`, `Student`, `ClassroomEvent` — each with properties, links, actions, and picker config. These are domain-specific and live in the application layer.
2. **A ManifestDef** called `LessonSession` that composes the above into an operational context:
   - Slots bind the specific plan, class, resources, students.
   - A `StreamDef` `events` wraps the GLM classroom-observation event stream (§9.3).
   - State tracks execution phase, active resource, pause flags.
   - `AccessBoundary` defines what the observing Agent can see and do.
   - Lifecycle hooks trigger observation start/stop and report generation.
3. **Registry population** at solution startup — all `ObjectType`s and `ManifestDef`s registered. `ActionDef`s automatically register as `ToolDefinition`s in the `SolutionToolkitRegistry`.

### What happens at runtime

1. Teacher starts a lesson → backend creates a manifest instance, populates required slots (plan, class), resolves derived slots (students from `class.contains`).
2. @Picker renders available references based on `ObjectTypeDef.picker.crossManifestSources` and traversable links — teacher can `@` a student or a resource within this session context.
3. Agent runtime loads the manifest via `ManifestAccessor`:
   - Reads the projected semantic view to understand what's happening.
   - Subscribes to the `events` stream (ClassroomEvent stream from GLM observation layer).
   - Decides based on events whether to `writeState('phase', 'practice')` or `executeAction('adjustDifficulty', { ... })`.
   - All operations pass through `checkBoundary`; all action calls flow through `ToolCallerProxy` and produce `tool_events` audit records.
4. Lesson ends → lifecycle `onDeactivate` fires → generates summary.

### What kedge-ontology provides vs what the application provides

| Concern | `kedge-ontology` (the package) | Jijian application |
|---|---|---|
| Type definitions | `LinkDef`, `ActionDef`, `ObjectTypeDef`, `FunctionDef`, `StreamDef`, `InterfaceDef`, `ObjectSetDef`, `PropertyMeta` + Zod re-export | Concrete `ObjectTypeDef`s for education domain (in solution backends) — each owns a Zod schema + sidecar meta |
| Composition model | `SlotDef`, `StateDef`, `AccessBoundary`, `ManifestDef` | Concrete `ManifestDef`s (`LessonSession`, etc.) |
| Access protocol | `ManifestAccessor` interface, `checkBoundary` | `ManifestAccessor` impl (NestJS service wrapping `ToolCallerProxy` + `EntityContextProvider`) |
| Discovery | `OntologyRegistry` interface + impl | Registration calls at solution startup |
| Agent integration | Semantic projection utilities | Agent framework + prompt engineering |
| Data persistence | Nothing | Database, event streams, file storage |
| UI components | Nothing | `@Picker` in `context-layer-react` |

### 8.5 End-to-end trace: one `flagForIntervention` call

Concrete request/response trace of a single agent action, from observation to audit row. Helps anchor the abstractions.

**Setup**: lesson session `code=HX3KM7` is active. `phase='practice'`. The agent has been subscribed to the `events` stream for 4 minutes.

1. **Observation event arrives.** GLM-4.7-Flash emits a `ClassroomEvent { kind: 'submit', student: 'stu_42', payload: { correct: false, attempt: 3 } }`. The observer engine writes it to the live event channel.
2. **Agent receives via stream subscription.** `ManifestAccessor.subscribeStream('events', handler)` was set at session activation. The handler delivers the event into the agent's tool-use context.
3. **Agent reasons + calls action.** Reading the projected `system-prompt` fragment (from §11.3 generated for the `agent` role), it knows `flagForIntervention` exists and takes `{ reason, severity }`. It decides this is the third wrong attempt and emits an action call.
4. **Bridge intercepts.** `actionToToolDefinition` registered `flagForIntervention` as a `ToolDefinition` under the live-lesson toolkit. The agent's call hits `ToolCallerProxyService.invoke({ tool: 'student.flagForIntervention', args: {...} }, executionContext)`.
5. **Step 1 (sanitize).** `sanitizeArgs` strips any reserved fields the agent might have tried to inject (e.g. `__solutionId`, `__actingRole`). For this call, nothing stripped.
6. **Step 2 (validate).** `argsSchema.parse(cleaned)` runs the Zod schema generated from the `ActionDef.params`. `{ reason: '...', severity: 'urgent' }` passes; `severity: 'critical'` would fail with `severity: Invalid enum value`.
7. **Step 3 (ontology boundary check — new).** The bridge handler invokes `checkBoundary({ manifest: LessonSession, role: 'agent', op: { kind: 'action', actionApiName: 'flagForIntervention' } })`. `LessonSession.boundaries[role='agent'].actions` includes `flagForIntervention`, so `allowed: true`. (If the agent had been bound under role `picker`, this would have returned `allowed: false, reason: 'agent action denied for role picker'` and step 4 would never run.)
7b. **Step 3.5 (precondition evaluation — Tier 1, per gap-analysis G2).** Same `checkBoundary` call evaluates `flagForIntervention.preconditions`. For this action the only precondition might be `{ kind: 'slotBound', slot: 'class' }` — bound at session creation, satisfied. If `adjustDifficulty` had been called instead with its `{ kind: 'stateEquals', path: 'phase', value: 'practice' }`, and the current phase were `'discuss'`, `checkBoundary` would return `{ allowed: false, unmetPreconditions: ['phase must equal "practice"'] }` and step 8 would never run. Important: this gate runs *only* for ActionDef-derived tools registered through the ontology bridge; legacy MCP tools without an `ActionDef` skip it (no behavior change for live-lesson's existing `emit_*_card` until Phase 3 migrates them).
8. **Step 4 (context injection).** The handler receives `ToolInvocation { tool: 'student.flagForIntervention', args: { reason, severity }, context: ExecutionContext { solutionId, sessionId, actingUserId, ... } }`. The agent could *never* have set those context fields itself.
9. **Step 5 (dispatch).** The solution-side action handler (e.g. `StudentService.flagForIntervention(args, context)`) runs. It writes a `StudentAlert` row to the live-lesson DB, broadcasts an SSE `student_alert` event to the teacher dashboard, and returns `{ ok: true, content: [{ type: 'text', text: '已标记' }] }`.
10. **Step 6 (audit).** `ToolCallerProxyService.audit()` writes one `ToolCallAuditEntry` to the `tool_events` table:
    ```text
    sessionId      = sess_abc123
    solutionId     = live-lesson
    actingUserId   = teacher_zhang
    tool           = student.flagForIntervention
    strippedFields = []
    outcome        = ok
    argsRedacted   = { reason: '...', severity: 'urgent' }
    startedAt      = 1714449900123
    durationMs     = 47
    ```
    Because `ActionDef.auditLevel === 'log'`, no diff payload is appended. (If it had been `'full_diff'`, the writer would also persist `stateChanges` for any state mutations during the handler.)
11. **Result back to agent.** The proxy returns `{ ok: true, content: [{ type: 'text', text: '已标记' }] }`. The agent's tool-use loop continues with the next event.

Throughout, the agent's surface stayed `{ tool, args }`. Identity, role, audit-id, state-change recording — all platform-asserted. Three independent gates protected the call (sanitize, validate, boundary-check), and a fourth (the proxy's `requiredPermissions`-stub-becoming-real) lands when the permission engine catches up.

### 8.6 Before / after: what changes when a class becomes an operating context

This subsection makes the §1.4 semantic-vs-kinetic distinction concrete by comparing how today's education-IT systems and an ontology-driven LessonSession differ — not in what they store, but in what the agent (and the human teacher) can actually *do*.

| Capability | Today's education-IT system (semantic-only) | LessonSession with kinetic layer |
|---|---|---|
| **Knowing the class exists** | Yes — DB row, dashboard tile, reports | Yes — `ObjectTypeDef LessonPlan` + `Class` registered |
| **Reading static facts** | Yes — query lesson plan, roster, schedule | Yes — `readSlot('plan')`, `readSlot('class')`, `readSlot('students')` |
| **Observing the class in real-time** | Maybe — if someone built a custom dashboard. The agent has no access. | **First-class** — `subscribeStream('events')` delivers ClassroomEvent push notifications; agent reacts to each event |
| **Knowing where in the lesson we are** | Out-of-band — teacher's mental model, or hard-coded handler logic | **State field** — `readState('phase')`, `readState('activeStepId')`; reads pass `checkBoundary` |
| **Recording an observation/judgment** | Custom service call, custom DB write, ad-hoc audit (or none) | **`writeState`** — boundary-checked, audit-logged, no second path |
| **Triggering an intervention** | Custom handler that decides who can call it, what scopes are required, whether teacher approval is needed | **`executeAction('flagForIntervention', {...})`** — `ActionDef.allowedRoles` + `requiredScopes` + `preconditions` + `requiresApproval` all declared; `ToolCallerProxy` enforces |
| **Auditing the agent's behavior** | Spotty — depends on whether each handler remembered to log | **Universal** — `tool_events` row per action; `auditLevel: 'full_diff'` extends to before/after state |
| **Adding a new agent capability** | New service method + new dashboard wiring + new audit hook + new permission rule | **One `defineAction({...})`** — registry validates at boot; bridge auto-generates `ToolDefinition`; projection auto-exposes to agent |

The right column is not "the left column with more features bolted on." It's a different kind of system: the operational layer *is* the schema, the agent is a participant in the operational layer (not a consumer of an exported view), and the boundary between observation and action is collapsed into one governance contract.

This is the difference §1.4 calls "the gap between seeing and doing." For Solutions that only need the left column, the existing live-lesson `manifest.json` + service-method-per-feature pattern is fine. For Solutions where the agent needs to be a real participant — where "the agent shouldn't be able to do X" is a *security property* not a *hopefully-not-implemented behavior* — the right column is the only honest answer, and it's what this package exists to enable.

---

## 9. Design decisions *(formerly "open questions" — now resolved)*

All seven were locked down during the 2026-05-29 design pass. Each carries its decision, the alternatives considered, and the why.

### 9.1 Schema versioning

**Decision**: Immutable per instance. Each manifest instance carries the `schemaVersion` it was created with. The Registry exposes `migrateInstance(name, fromV, toV)` as an explicit, opt-in operation that returns a `MigrationPlan`; runtime never silently upgrades.

**Why**: Education-bureau audit needs reproducibility. An instance state recorded six months ago must be replayable against the same schema today. Live-migration is the seductive shortcut that quietly invalidates older audit trails — pricier to debug than the explicit migration cost.

### 9.2 Manifest nesting

**Decision**: Allowed. `SlotDef.target` is a discriminated union accepting `{ kind: 'objectType' }` or `{ kind: 'manifest' }`. Boundary check composes: child role defaults to *denied* unless the child manifest declares `inheritParentRole: true`.

**Why**: SemesterPlan / multi-LessonSession composition is a near-term need (the education customer plans semester-level dashboards by end of 2026). Hermetic-by-default protects audit clarity; explicit opt-in keeps the convenience case available.

### 9.3 Event semantics

**Decision**: First-class. New `StreamDef` primitive (sibling of `SlotDef`, at the `ManifestDef` level). Streams expose a subscribe-only contract; `ManifestAccessor` gains `subscribeStream(name, handler)`. Streams are NOT slots.

**Why**: The GLM classroom-observation stream is push, not pull — modeling as a `collection: true` slot would mislead Agent reasoning about latency, backpressure, and replay semantics. Distinct primitive prevents that confusion.

### 9.4 Cross-manifest references

**Decision**: Restricted-by-default, opt-in. `ObjectTypeDef.picker` declares `crossManifestSources: ('parent' | 'sibling' | 'all')[]` for @Picker visibility from neighboring manifests. Agent operations remain hermetic — no cross-manifest writes ever, regardless of declaration.

**Why**: Education scenario needs "this student's history from prior lessons" available to the teacher in the picker, but write-isolation must hold for audit (an Agent in lesson A must never silently mutate a Student object viewed from lesson B's perspective).

### 9.5 Action composition

**Decision**: Yes, declared. `ActionDef` has optional `composes: readonly string[]` listing other action apiNames it transitively invokes. Each sub-action passes its own `checkBoundary` + `ToolCallerProxy` validation at execution; the composition is transparent.

**Why**: The Agent must transitively reason about side effects. Hidden composition breaks the discovery model — an Agent that thinks `adjustDifficulty` is read-only because that's what the surface ActionDef says, but which actually calls `insertResource` underneath, can take actions the schema appeared to forbid.

### 9.6 Schema distribution

**Decision**: Runtime via REST + ETag. New `GET /api/v1/ontology/schema` endpoint serves `serializeRegistry()` output with `ETag` header derived from `getSchemaDigest()`. Frontend + Agent fetch on session start; `If-None-Match` short-circuits unchanged schemas.

**Why**: The "schema is data" principle and the existing solution hot-reload (`solutions/business/demo-sandbox/.../solution-register.service.ts` already watches `skills/` on disk and re-registers on file change) both fight a build-time bundling story. Runtime distribution with content-hash caching gives us the freshness of dynamic registration without paying for it on every request.

### 9.7 Validation depth

**Decision**: Maximum, at registration time. `src/schema/validators.ts` enforces (Zod-first revision):

*Zod itself handles* — field types, required vs optional, enum value validity, numeric range constraints, string format constraints. We do not duplicate these checks; if a Zod schema parses, it parses.

*Ontology-layer rules the validator enforces*:

- No circular refs in `LinkDef` chains or `SlotDef.derivedFrom` paths.
- All `LinkDef.target` / `SlotDef.target` references resolve to registered ObjectTypes (or, for `kind: 'manifest'`, registered manifests; for `kind: 'objectSet'` — Tier 2 — registered ObjectSets).
- Every `objectRef('X')` brand inside any `z.object(...)` schema (ObjectTypes, ActionDef params, StateDef, etc.) references a registered ObjectType `X`. Same for `objectSetRef('X')`.
- All `derivedFrom` dot-paths resolve through declared `LinkDef`s.
- All `AccessBoundary.{readable,writable,actions,subscribes}` references resolve to declared slots/actions/streams. Path entries with `where` predicates (Tier 2, §5.5): every `PathExpr` in the predicate resolves through the matching Zod schema (`row.<field>` → `ObjectType.schema.shape`; `state.<field>` → state schema; `slot.<name>.<field>` → bound slot schema); every `op: 'named'` predicate name must be registered.
- All `LifecycleDef` action apiNames are registered `ActionDef`s.
- All `ActionDef.preconditions` (Tier 1): `kind: 'stateEquals'` path resolves to a declared state field with a `z.literal`/`z.enum`-compatible schema; `kind: 'slotBound'` slot name exists on the manifest; `kind: 'named'` name is registered.
- **Interface conformance** (Tier 2, G4): when `ObjectTypeDef.implements: ['X']`, the interface `X` is registered AND its `requiredSchema.shape` is structurally satisfied by the implementor's `schema.shape` (every required field present with compatible Zod type via `.shape` introspection); `requiredLinks` and `requiredActions` matched by apiName + compatible signature. Late `registerInterface()` re-validates existing implementors.
- **ObjectSet validity** (Tier 2, G6): `objectType` resolves to a registered ObjectType; every `path` in the filter resolves through that ObjectType's schema; `'named'` filters reference registered Predicates.
- **Meta-key validity** (new — Tier 1 schema-first refactor): every key used in `ObjectTypeDef.meta: { ... }` must exist in `schema.shape`. Misspelled meta keys are caught at compile time by the `PropertyMetaMap<S>` generic constraint AND at runtime by the validator.
- **StreamDef payload exclusivity**: exactly one of `payloadType` (ObjectType reference) or `payloadSchema` (inline Zod) is set, never both.
- **Validation-rule linkage** (Tier 3, G7): every `name` in `ObjectTypeDef.validationRules` must appear as `params.name` on a `.refine()` chained onto `schema`; conversely, every named refine on the schema must have a meta entry. Anonymous refines are allowed (no error) but not projected.
- **State-machine consistency** (Tier 3, G8): `stateMachine.property` is a key on `schema.shape` whose Zod type is `z.enum(...)`. Every `Transition.from`/`Transition.to` is one of the enum's options. Every `Transition.action` (if set) is a registered ActionDef apiName whose params let the handler identify a target instance.
- **Notification predicate resolution** (Tier 3, G10): every `NotificationRule.match` predicate path resolves through the trigger-appropriate Zod schema (state schema for `on: 'stateChange'`, action params for `'actionResult'`, stream payload for `'streamEvent'`). Every `kind: 'named'` channel name is a registered impl.
- **ActionDef.returnType validity** (Tier 3, G11): when set, must be a valid Zod schema (parseable as such); type-checked at compile time.
- `semantic` is non-empty on every primitive that declares it (validators reject empty strings).
- `'*'` boundary wildcard only appears under `role: 'admin'`.

`register*()` throws `RegistrationError` with the failing reference on the first violation. Late registrations (e.g. an InterfaceDef registered after its implementors) trigger a re-validation pass; if any existing implementor now violates conformance, the late `registerInterface()` call throws and the registry remains in its pre-call state.

**Why**: Schema registration runs once at solution startup — validation cost is amortized. A bad schema reaching production is catastrophic for governance claims; "we validate at runtime when the Agent tries to use it" means the catastrophe is delivered to the customer rather than caught at boot.

---

## 10. Reconciliation with existing infrastructure

This package does not land in a vacuum. The repo already has working primitives that overlap. The disposition for each is below.

### 10.1 Concept → primitive map

| Ontology concept | Existing primitive (path) | Disposition |
|---|---|---|
| `OntologyRegistry` | `EntityRegistry` (`packages/context-layer/src/core/entity-registry.ts`) | Move + generalize into `@kedge-agentic/ontology`. `EntityRegistry` becomes a thin re-export wrapper for backward compatibility. |
| `ObjectTypeDef.picker` | `ReferenceableOptions` (`packages/context-layer/src/core/interfaces.ts:3-21`) | Refactor: `ReferenceableOptions` becomes a projection of `ObjectTypeDef.picker` (legacy callers keep working; new callers register `ObjectTypeDef` directly). |
| `ManifestAccessor.readSlot` / `.traverse` | `EntityContextProvider.getContext` / `.search` (`packages/context-layer/src/core/interfaces.ts:247-254`) | Compose, don't replace: the default `ManifestAccessor` impl wraps `EntityContextProvider` for slot-scoped reads. |
| `ActionDef` execution | `DocumentEditProvider` (`packages/context-layer/src/core/document-edit-provider.ts`) for document edits; `ToolCallerProxy` for everything else | `DocumentEditProvider` keeps handling document `str_replace` / `field_set` (well-tested in recipe-book). General `ActionDef` execution compiles to `ToolDefinition` and uses `ToolCallerProxy`. |
| `ActionDef` governance pipeline | `ToolCallerProxyService` 6-step pipeline (`packages/backend/src/tool-caller/tool-caller-proxy.service.ts`) | Reuse verbatim. `ActionDef` → `ToolDefinition` at registration; the proxy's sanitize/validate/permission/inject/dispatch/audit pipeline does the work. |
| `ActionDef.auditLevel` | `ToolCallAuditEntry` + `tool_events` table (`packages/backend/src/tool-caller/types.ts:141`) | The existing audit infra honors `auditLevel`: `'none'` skips write, `'log'` writes the existing fields, `'full_diff'` extends with `stateChanges`. |
| `AccessBoundary.role` | `UserRole` + `ApiKeyScope` (see §10.3) | `BoundaryRole` maps mechanically — no new permission engine. |
| `ManifestDef` storage at runtime | `Lesson.manifestJson` (live-lesson) + `SessionMetadata` (core, `packages/backend/src/sessions/entities/session-metadata.entity.ts`) | `ManifestDef` is schema only. Instances stored per-solution as before; `SessionMetadata` is the recommended place for runtime state (≤256 KB/session — see entity comment). |
| `LifecycleDef` hooks | NestJS service methods today | Hook `apiName` → service-method registration via `SolutionToolkitRegistry`. |
| `FunctionDef` (§3.7, Tier 1) | (none — net-new) | Net-new. Compiles to `ToolDefinition` like `ActionDef` but the bridge pins `auditLevel: 'log'` (never `'full_diff'`) and skips the approval gate entirely. Distinct projection bucket in §11. |
| `ActionDef.preconditions` (§3.3, Tier 1) | Today: handler-side early-return checks | Evaluated by `checkBoundary` at step 3.5 of the proxy pipeline. `BoundaryDecision.unmetPreconditions` reports failures structurally so `discoverActions()` can filter. |
| `LocalizedString` displayName (§3.0, Tier 1) | Today: `displayName: string` everywhere | Union with plain string — no breaking change for single-locale Solutions; multi-locale Solutions opt in. Resolver `OntologyRegistry.getDisplayName(def, locale?)` handles fallback. |
| `InterfaceDef` (§3.8, Tier 2) | (none — net-new) | Net-new. Solution-side adoption: declare an Interface (e.g. `Mentionable`), add `implements: ['Mentionable']` on ObjectTypeDefs; registry validates structural conformance at boot. Picker / agent queries via `registry.getImplementersOf('Mentionable')` instead of enumerating concrete types. |
| `ObjectSetDef` (§3.9, Tier 2) | Today: derived slot with hardcoded filter | Net-new primitive; today's derived slots become `{ kind: 'objectSet', name }` slot targets pointing at registered ObjectSets. Actions can take `type: 'objectSet'` parameters. The schema-distribution endpoint (§9.6) includes ObjectSets in the ETagged payload. |
| Predicate-scoped `AccessBoundary` (§4.4 + §5.5, Tier 2) | Today: path-string lists only | Path strings still accepted (no breaking change). New entry shape `{ slot, where: BoundaryPredicate }` enables row-level security. `checkBoundary` evaluates predicates per row when invoked with row context; falls back to always-true for legacy string entries. Predicate impl bodies live in solution code via `registerPredicate(name, impl)`. |
| Zod-first schema layer (§3.1 / §3.4 / §3.6) | live-lesson `manifest.schema.ts`, creator-mcp-server `schemas.ts`, `ToolCallerProxy.argsSchema: ZodTypeAny` | No new convention. The Zod schemas defined on each `ObjectTypeDef.schema` and `ActionDef.params` are the *same shape* the rest of the repo already uses. `ToolCallerProxy` takes our `actionDef.params` directly as its `argsSchema`. Drops the custom `PropertyDef` type system in favor of what already works. |
| `ValidationRuleMeta` (§3.10, Tier 3) | Today: Zod `.refine()` calls work but are invisible to the agent | Add `validationRules` sidecar on `ObjectTypeDef`. Each entry names a `.refine()` (via `params: { name }` convention) and gives it semantic+severity+message metadata. Projected to agent via §11; queryable via registry. |
| `StateMachineDef` (§3.11, Tier 3) | Today: handler-side state-transition checks | Extends `ObjectTypeDef` with `stateMachine?: { property, transitions[] }`. Boundary check evaluates `op: { kind: 'transition' }` against the declared transitions. Each Transition can name an ActionDef whose handler IS the transition (inherits audit + approval). |
| `PropertyMeta.classification` + `redaction` (§3.1 ext, Tier 3 — G9+G12) | Today: ad-hoc handler-side PII filtering | Per-property sidecar entries. `getPropertiesByClassification(tag)` enables compliance reports. Redaction pipeline (§5.4) applies `mask` / `hash` / `omit` to `readSlot` results based on `redaction.roles` membership. |
| `NotificationRule` (§4.8, Tier 3, G10) | Today: handler-side SSE/push calls per use case | `ManifestDef.notifications` declares trigger + predicate + channel. Runtime evaluates after each successful state write / action / stream event. Routes through existing SSE relay + push subsystem; named channels via `registerNotificationChannel`. |
| `ActionDef.returnType` + `ActionResult.returnValue` (§3.3 + §5.3 ext, Tier 3, G11) | Today: structured returns go in `ToolResult.content[0].text` as JSON the agent re-parses | Declare with a Zod schema; bridge attaches parsed return to `ActionResult.returnValue`. Agent's projected action descriptor includes `zod-to-json-schema(returnType)` so agents can reason about return shape pre-invocation. |
| Semantic projection | (none — net-new) | Net-new. `semantic/project.ts` + three sub-formatters. |
| Schema distribution endpoint | (none — net-new) | Net-new. `GET /api/v1/ontology/schema` (Phase 3 of impl plan). |

### 10.2 ToolCallerProxy bridge (the critical link)

The bridge that makes `ActionDef`s actionable looks like this (pseudocode — concrete impl lives in `packages/backend` per ADR-0001):

```ts
function actionToToolDefinition(
  action: ActionDef,
  handler: ActionHandler,
  manifest: ManifestDef,
): ToolDefinition {
  // action.params IS already a Zod object schema — no conversion needed.
  const argsSchema = action.params;
  return {
    name: action.apiName,
    description: action.semantic,
    argsSchema,
    requiredPermissions: action.requiredScopes ?? [],
    visibility: { roles: action.allowedRoles },
    handler: async ({ args, context }) => {
      // 1. Ontology boundary check (ManifestDef-aware)
      const decision = checkBoundary({
        manifest,
        role: contextToBoundaryRole(context),
        op: { kind: 'action', actionApiName: action.apiName },
      });
      if (!decision.allowed) {
        return { ok: false, code: 'permission_denied', reason: decision.reason ?? 'boundary denied' };
      }
      // 2. Approval gate
      if (decision.requiresApproval) {
        return { ok: false, code: 'permission_denied', reason: 'pending_approval' };
      }
      // 3. Dispatch to solution handler (already past proxy's sanitize/validate)
      return handler({ args, context });
    },
  };
}
```

The proxy still does its 6 steps (sanitize / validate / permission-stub / inject / dispatch / audit); the boundary check slots into the permission step. No new pipeline; one new gate.

### 10.3 AccessBoundary → existing-auth mapping

`BoundaryRole` is the ontology-facing label. The mapping to the platform's real auth model is mechanical:

| `BoundaryRole` | Required `ApiKeyScope` (any-of) | Typical `UserRole` | Notes |
|---|---|---|---|
| `'agent'` | `'chat'`, `'mcp:read'`, plus `action.requiredScopes` | n/a (session-bound, not user-role-bound) | Identity comes from `ExecutionContext.actingUserId` set at session creation; the agent never asserts a role. |
| `'picker'` | `'chat'` (read), `'skills:execute'` (apply) | `'viewer'` or above | UI-driven; user identity flows from the authenticated browser session via `RequestContext.userId`. |
| `'admin'` | `'admin'` OR `'builder'` | `'admin'` | Allows `'*'` wildcards in `readable`/`writable`/`actions`. |
| `<custom string>` | Declared per-action via `ActionDef.requiredScopes` | Validated per-solution at registration | Solutions may declare e.g. `'teacher'`, `'principal'`; the mapping table is solution-specific config. |

Solutions register their custom-role mapping table at the same lifecycle as `OntologyRegistry.registerManifest()`. The mapping is stored in the registry and consulted by `checkBoundary` when `role` is a custom string.

### 10.4 What does NOT change in existing packages

- `packages/context-layer/src/core/document-edit-provider.ts` — keeps its current shape; works as-is. The `EditOperation` union (`str_replace` / `field_set`) is the right level for document edits and is unrelated to `ActionDef` granularity.
- `packages/agent-runtime/src/sync/sync-engine.ts` — orthogonal layer (file/artifact sync). `ManifestAccessor` may invoke it to persist slot-bound documents, but the sync logic itself is untouched.
- `packages/backend/src/tool-caller/*` — unchanged. The bridge in §10.2 lives in a new file (`packages/backend/src/ontology/*`); no edits to the proxy.
- `packages/backend/src/sessions/entities/session-metadata.entity.ts` — unchanged. The recommended runtime-state store for manifest instances reuses it as-is.

### 10.5 The actual `ToolCallerProxy` 6-step pipeline (current code, for reference)

So readers without access to the repo can see what the bridge plugs into, this is the live code from `packages/backend/src/tool-caller/tool-caller-proxy.service.ts` (excerpted, with comments preserved):

```ts
async invoke(
  request: ToolCallRequest,
  context: ExecutionContext,
): Promise<ToolResult> {
  const startedAt = Date.now();

  // Step 1: strip reserved fields from agent-supplied args.
  const { cleaned, stripped } = sanitizeArgs(request.args);
  if (stripped.length > 0) {
    this.logger.warn(
      `Tool "${request.tool}" call by session ${context.sessionId} ` +
      `(actingUserId=${context.actingUserId ?? 'none'}) tried to set ` +
      `reserved fields: ${stripped.join(', ')} — silently stripped`,
    );
  }

  const resolved = this.registry.resolveTool(context.solutionId, request.tool);
  if (!resolved) {
    const result: ToolResult = { ok: false, code: 'tool_not_found', reason: `...` };
    await this.audit(request, context, stripped, cleaned, result, startedAt);
    return result;
  }

  // Step 2: schema validation of sanitized args.
  let parsedArgs: Record<string, unknown>;
  try {
    parsedArgs = resolved.definition.argsSchema.parse(cleaned);
  } catch (err) {
    const reason = err instanceof ZodError ? this.formatZodError(err) : `Invalid...`;
    const result: ToolResult = { ok: false, code: 'validation_failed', reason };
    await this.audit(request, context, stripped, cleaned, result, startedAt);
    return result;
  }

  // Step 3: permission check — STUB. Always allow.
  // When the permission engine lands, this checks
  // resolved.definition.requiredPermissions against context.permissions.
  // ← THIS is the step where checkBoundary slots in for ActionDef-derived tools.

  // Step 4: assemble the ToolInvocation. ExecutionContext is the
  // caller's claim — we do NOT derive any field from `args` here.
  const invocation: ToolInvocation = {
    tool: resolved.qualifiedName,
    args: parsedArgs,
    context,
  };

  // Step 5: handler dispatch. We catch unexpected throws and turn
  // them into a documented failure shape — the agent should never
  // see an HTTP-style crash.
  let result: ToolResult;
  try {
    result = await resolved.definition.handler(invocation);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    this.logger.error(`Tool "${request.tool}" handler threw...: ${msg}`);
    result = { ok: false, code: 'handler_error', reason: `... failed: ${msg}` };
  }

  // Step 6: audit (always).
  await this.audit(request, context, stripped, parsedArgs, result, startedAt);
  return result;
}
```

The `audit()` method writes one `ToolCallAuditEntry` to the `tool_events` table (via a pluggable `ToolCallAuditSink`); if no sink is wired, it falls back to a logger with a one-shot "wire a sink" warning. **No call path skips audit, ever.** This is the contract the ontology package builds on.

What changes when `ActionDef` is in the picture: at registration time, the bridge wraps the handler so step 5 becomes a two-phase thing — first `checkBoundary` (acting as step 3 for ontology-aware tools), then the real handler. The other five steps are untouched.

---

## 11. Semantic projection format — worked examples

This section makes §7 concrete. Given a tiny `ObjectTypeDef` (3 properties, 2 links, 1 action), show what each `ProjectionFormat` emits.

### 11.1 Input

```ts
const LessonPlanSchema = z.object({
  title: z.string()
    .describe('Short headline shown to the teacher and students.'),
  subject: z.enum(['math', 'reading', 'science'])
    .describe('Subject area; constrains which observation handlers apply.'),
  durationMinutes: z.number()
    .describe('Expected wall-clock duration in minutes; informs pacing decisions.'),
});

const lessonPlan = defineObjectType({
  apiName: 'LessonPlan',
  displayName: '教学计划',
  semantic: 'A teacher-authored plan for a single class session, with sequenced steps and per-step learning objectives.',
  schema: LessonPlanSchema,
  meta: {
    title: { searchable: true, displayRole: 'title' },
  },
  links: [
    { apiName: 'targetClass', displayName: '面向班级', target: 'Class',
      cardinality: 'N:1', inverse: 'lessons', traversable: true,
      semantic: 'The class this plan is authored for.' },
    { apiName: 'usesResources', displayName: '使用资源', target: 'Resource',
      cardinality: 'N:M', inverse: 'usedByPlans', traversable: true,
      semantic: 'Resources (slides, videos, worksheets) embedded in this plan.' },
  ],
  actions: [
    defineAction({
      apiName: 'adjustDifficulty',
      displayName: '调整难度',
      params: z.object({
        direction: z.enum(['easier', 'harder'])
          .describe('Which way to nudge the plan difficulty.'),
        reason: z.string()
          .describe('Free-text justification recorded in the audit trail.'),
      }),
      sideEffects: ['mutates:LessonPlan.steps', 'emits:DifficultyAdjusted'],
      allowedRoles: ['agent', 'admin'],
      requiredScopes: ['chat'],
      auditLevel: 'full_diff',
      semantic: 'Re-paces the plan toward easier or harder content. Should be used when class metrics show consistent under- or over-performance for ≥3 minutes.',
    }),
  ],
});
```

### 11.2 Format A — `'anthropic-tools'` (Claude Code tool-use)

```json
{
  "tools": [
    {
      "name": "LessonPlan.adjustDifficulty",
      "description": "Re-paces the plan toward easier or harder content. Should be used when class metrics show consistent under- or over-performance for ≥3 minutes.\n\nSide effects:\n  - mutates:LessonPlan.steps\n  - emits:DifficultyAdjusted",
      "input_schema": {
        "type": "object",
        "required": ["direction", "reason"],
        "properties": {
          "direction": {
            "type": "string",
            "enum": ["easier", "harder"],
            "description": "Which way to nudge the plan difficulty."
          },
          "reason": {
            "type": "string",
            "description": "Free-text justification recorded in the audit trail."
          }
        }
      }
    }
  ]
}
```

### 11.3 Format B — `'system-prompt'` (Markdown fragment)

```markdown
## Context: LessonPlan (教学计划)

A teacher-authored plan for a single class session, with sequenced steps and per-step learning objectives.

### Readable fields
- `title` (标题, string): Short headline shown to the teacher and students.
- `subject` (学科, enum: math | reading | science): Subject area; constrains which observation handlers apply.
- `durationMinutes` (时长, number): Expected wall-clock duration in minutes; informs pacing decisions.

### Traversable relationships
- `targetClass` → Class (N:1): The class this plan is authored for.
- `usesResources` → Resource (N:M): Resources (slides, videos, worksheets) embedded in this plan.

### Available actions
- **adjustDifficulty** (调整难度) — Re-paces the plan toward easier or harder content. Should be used when class metrics show consistent under- or over-performance for ≥3 minutes.
  - Side effects: mutates `LessonPlan.steps`, emits `DifficultyAdjusted`
  - Audit level: full_diff (before/after state recorded)
  - Params:
    - `direction` (easier | harder): Which way to nudge the plan difficulty.
    - `reason` (string): Free-text justification recorded in the audit trail.
```

### 11.4 Format C — `'mcp-tools'` (MCP tool descriptors)

```json
{
  "tools": [
    {
      "name": "lessonplan__adjust_difficulty",
      "description": "Re-paces the plan toward easier or harder content. Should be used when class metrics show consistent under- or over-performance for ≥3 minutes.",
      "inputSchema": {
        "type": "object",
        "required": ["direction", "reason"],
        "properties": {
          "direction": { "type": "string", "enum": ["easier", "harder"] },
          "reason": { "type": "string" }
        }
      }
    }
  ]
}
```

Note the conventions:

- Format A uses `input_schema` (Anthropic).
- Format C uses `inputSchema` (MCP) and snake_cases the tool name via `<namespace>__<action>`.
- All three carry the `semantic` text verbatim — the LLM reads the same description regardless of transport.

**Where the JSON came from**: Formats A and C are each a one-liner — `zod-to-json-schema(actionDef.params)` produces the `input_schema` / `inputSchema` body verbatim, including the `description` text from every `.describe()` call inside the Zod schema. The projector wraps that output in the format-specific envelope (`name`, `description`) and nothing else. Format B (Markdown) walks the same Zod schema and renders one bullet per field — same source data, different presentation. The point: with Zod as the single source of truth, the projector is a thin renderer, not a re-implementation of the type system.

### 11.5 Manifest-level projection — the full `LessonSession` view

`projectManifest(manifestDef, registry, role, format)` walks the role's `AccessBoundary`, includes only readable slots / writable state / allowed actions / subscribable streams, and emits the union of per-object and per-state projections. The output is what an Agent receives when it enters a manifest context — a faithful, role-scoped, semantically-rich view of its operating environment.

Here's the `system-prompt` format applied to the `LessonSession` `ManifestDef` from §4.7, projected for `role: 'agent'`:

```markdown
# Operating context: LessonSession (课堂会话)

You are operating inside a single in-progress run of a LessonPlan with a specific Class. The static plan + class + resources are bound for the duration of the session; the live event stream and runtime phase state evolve as the lesson unfolds.

## What you can see (readable)

### Slot `plan`: LessonPlan (教学计划)
A teacher-authored plan for a single class session, with sequenced steps and per-step learning objectives.
Fields: title (string), subject (math|reading|science), gradeLevel (string), durationMinutes (number, computed).
Traversable: targetClass → Class, usesResources → Resource[].

### Slot `class`: Class (班级)
A persistent roster of students at a school.
Fields: name (string), school (string), studentCount (number, computed).
Traversable: contains → Student[], lessons → LessonPlan[].

### Slot `students`: Student[] (学生列表)  [derived from class.contains]
Students enrolled in the bound class.
Fields per student: name (string), engagementScore (number, computed, range 0–100), lastSeenAt (datetime, computed).

### Slot `resources`: Resource[] (可用资源)  [derived from plan.usesResources]
Resources embedded in the bound plan.
Fields per resource: title (string), kind (slide|video|worksheet|image), url (string).

## What you can change (writable)

- `phase` (enum: waiting | listen | practice | discuss | takeaway | ended, initially `waiting`):
  Current teaching phase. Transitions follow plan.phaseConfig.unlockAfter order.
- `activeStepId` (string, initially null):
  Current readingSteps[].id within the active phase.
- `pausedForIntervention` (boolean, initially false):
  True if the session is paused for teacher intervention (e.g. ≥5 students stuck).

## What you can subscribe to (streams)

- `events` (payload: ClassroomEvent, backpressure: drop_oldest):
  Push stream of ClassroomEvent emitted by the GLM-4.7-Flash observation engine as the class progresses.

## What you can do (actions)

### `adjustDifficulty(direction, reason)`
Re-paces the plan toward easier or harder content. Use when class metrics show consistent under- or over-performance for ≥3 minutes.
- `direction` (easier | harder, required): Which way to nudge the plan difficulty.
- `reason` (string, required): Free-text justification recorded in the audit trail.
- Side effects: mutates LessonPlan.steps, emits DifficultyAdjusted.
- Audit level: full_diff (before/after recorded).

### `flagForIntervention(reason, severity)`
Raises a teacher-facing alert for a student. Use when engagementScore drops below 30 or after 3 consecutive incorrect submissions.
- `reason` (string, required): Why this student needs teacher attention.
- `severity` (watch | urgent, required): Watch = surface in dashboard; urgent = teacher push.
- Side effects: emits StudentAlert.
- Audit level: log.
```

Same manifest, projected as `anthropic-tools`, yields two tool definitions (`LessonSession.adjustDifficulty`, `LessonSession.flagForIntervention`) with `input_schema` derived from each ActionDef's `params` — the agent's tool-use API sees them directly. As `mcp-tools`, the same two compile to MCP tool descriptors registered via `SolutionToolkitRegistry` (the bridge mechanism in §10.2).

Importantly, the `picker` role's projection of the same manifest would omit the `## What you can change` and `## What you can do` sections entirely (those boundaries are empty), and include `students` and `resources` slots scoped to read-only reference. The same `ManifestDef` produces different views depending on the role — that's the schema's job.

---

## 12. FAQ

Common questions from reviewers and external readers.

**Q: Why Zod-first instead of a custom `PropertyDef`?**
A: Three reasons. (1) **Avoid duplicating what TS already expresses.** An earlier revision defined `PropertyDef` with `apiName / type / required / enumValues / refTarget / ...` — every one of those is something TypeScript+Zod already encodes (`z.string()`, `.optional()`, `z.enum([...])`, branded refs). Writing it twice creates drift and TS-vs-runtime inconsistencies. (2) **Match the repo's existing convention.** `solutions/business/live-lesson/backend/src/schemas/manifest.schema.ts`, `creator-mcp-server`, and `ToolCallerProxy.argsSchema` are all Zod-based. Introducing a parallel custom shape would be the *odd one out*. (3) **Free runtime serialization for the schema-distribution endpoint** (§9.6) via `zod-to-json-schema` — the same library serves the agent's anthropic-tools and mcp-tools projections (§11). The `PropertyMeta` sidecar (§3.1) survives because Zod genuinely has no concept of "searchable in @Picker" or "computed-and-therefore-never-writable" — those are governance/presentation hints that don't belong inside a value-shape language.

**Q: Why not just use Palantir Foundry / OSDK?**
A: Two non-negotiables. (1) Our largest customers are Chinese government / education bureaus who can't deploy Palantir. (2) Our model is CcaaS — we ship a platform that customers extend with their own Solutions, not a closed-source workbench. Foundry's value is the integrated data infra; we have our own. We borrow Palantir's conceptual model (Objects + Links + Actions + governance), not their product.

**Q: This looks like a lot of new abstraction. What's the smallest version that delivers value?**
A: Phase 1 of the [implementation plan](./kedge-ontology-implementation-plan.md) — just the schema primitives, the registry, and validators — already lets a Solution write its first `ObjectTypeDef` and have the validators catch malformed declarations at boot. That alone is a step up from today's free-form `manifest.json`. The full payoff (Picker auto-rendering, agent auto-prompting) lands in Phases 2 and 3, but the package is useful from Phase 1.

**Q: How does this interact with the existing `EntityRegistry` and `ReferenceableOptions`?**
A: `EntityRegistry` becomes a thin re-export wrapper around `OntologyRegistry`. `ReferenceableOptions` becomes a projection of `ObjectTypeDef.picker`. Existing call sites (recipe-book, the React `AtPicker`) keep working unchanged. New call sites register full `ObjectTypeDef`s. See §10.1 for the disposition table; see the impl-plan for the per-phase migration.

**Q: Why is `semantic` required everywhere?**
A: Because the LLM is a primary consumer. A field without `.describe()` text (and a primitive without an object-level `semantic`) is opaque to the agent — the agent sees a name and a type, has to guess meaning, and gets it wrong in ways that are expensive to debug. Making per-primitive `semantic` required at registration time, and strongly encouraging per-field `.describe()` calls in Zod schemas, guarantees the shipped schema is at least minimally agent-readable. The empty-string check on `semantic` is in the validator suite (§9.7); per-field `.describe()` is enforced socially (code review), not by the validator, since legitimately self-explanatory fields (`id: z.string()`) shouldn't be rejected for lacking a description.

**Q: Doesn't action composition (§9.5) break encapsulation?**
A: It's the opposite — it *prevents* hidden composition. Today an agent calling `adjustDifficulty` has no way to know that the handler internally also calls `insertResource`. The `composes: ['insertResource']` declaration surfaces that fact in the agent's view of the action. The agent can then choose to invoke `adjustDifficulty` knowing the full transitive side-effect surface, or decline if any sub-action is forbidden.

**Q: Why not store `ManifestDef` instances in a dedicated table?**
A: Three reasons. (1) Solutions vary too much in storage needs — recipe-book uses in-memory state, live-lesson uses SQLite, an enterprise solution might use Postgres + Redis. Forcing a single storage model would push every Solution into a backend redesign. (2) `SessionMetadata` already exists (key-value, 256KB/session budget) and covers most cases. (3) For state that *doesn't* fit (large student rosters, long event histories), the Solution should own the storage decision — the ontology package's job ends at the access protocol.

**Q: Can I declare a manifest without any agent boundary — just for the @Picker?**
A: Yes. The `boundaries` array is required to exist but is allowed to contain only the roles your solution actually uses. A picker-only manifest declares `[{ role: 'picker', readable: [...], writable: [], actions: [] }]` and nothing else. The agent role just won't be projected.

**Q: What about offline/disconnected operation? The schema endpoint (§9.6) needs the backend.**
A: The schema endpoint is for *update*. Agents and frontends should cache the schema (keyed by `getSchemaDigest()`) and operate from the cache when the backend is reachable. For genuinely offline-only Solutions, build-time bundling is still possible — the `OntologyRegistry`'s defs are plain objects, you can serialize them at build time and ship them in the frontend bundle. Runtime distribution is the recommendation, not a hard requirement.

**Q: How is this different from a GraphQL schema?**
A: GraphQL describes query/mutation shapes for a data layer. `kedge-ontology` describes *operational context* — a manifest binds objects, *plus* runtime state, *plus* a per-role access boundary, *plus* lifecycle, *plus* the audit/approval policy. Closer to "Palantir Ontology meets Spring Security meets Statecharts" than to GraphQL. You could *also* expose your `ObjectTypeDef`s as GraphQL — nothing stops a Solution from auto-generating a schema — but that's an export option, not a competing concept.

**Q: Where does versioning fit if the schema is distributed at runtime?**
A: Per spec §9.1, each *manifest instance* carries the `schemaVersion` it was created with. The runtime endpoint always serves the latest registered schema. If an instance was created under v1 and v2 is now live, the runtime resolves the instance against its frozen v1 schema (the registry keeps old versions until explicitly evicted, which is why `migrateInstance` is opt-in). This is the audit-reproducibility requirement that drove the decision.

**Q: What about pre-conditions on actions (e.g. "phase must be `practice` for `adjustDifficulty`")?**
A: Modeled per gap-analysis G2 — see `ActionDef.preconditions` in §3.3. The discriminated union (`stateEquals` / `slotBound` / `named`) covers the common cases; `checkBoundary` evaluates them at step 3.5 of the proxy pipeline (§8.5). `discoverActions()` honors the same evaluation so the agent only sees actions currently callable. Originally deferred; promoted to Tier 1 by the [gap analysis](./kedge-ontology-gap-analysis.md#g2--action-preconditions-tier-1) because handler-side checks were invisible to agent reasoning and to reviewers.

**Q: Why is `FunctionDef` separate from `ActionDef` with `auditLevel: 'none'`?**
A: Intent clarity. The agent reasons differently about "callable without cost" (`FunctionDef` — pure read, no approval ever, no state mutation possible) and "callable with effect" (`ActionDef` — may mutate, may require approval, audit-tracked). Collapsing the two into one primitive forces every consumer (agent, reviewer, audit pipeline, semantic projection) to re-derive the distinction from `sideEffects.length === 0 && auditLevel === 'none'`. The separate primitive makes the intent structural. See [gap-analysis G1](./kedge-ontology-gap-analysis.md#g1--function-types-tier-1).

**Q: Why is `displayName` a union (`string | Record<...>`) instead of always a `Record`?**
A: Backwards compatibility for the common case. Today's call sites all pass `displayName: '教学计划'` — a single Chinese string. Forcing a `Record<string, string>` everywhere would be a breaking change for every Solution to satisfy a future need. The union (`LocalizedString = string | Readonly<Record<string, string>>`) means single-locale Solutions write the simpler form unchanged; multi-locale Solutions opt in by passing a map. See Design Principle 6 (§1.7) and [gap-analysis G3](./kedge-ontology-gap-analysis.md#g3--i18n-on-displayname-tier-1).

**Q: What about Interface Types / Object Sets / row-level predicates?**
A: Adopted per gap-analysis G4/G5/G6 — `InterfaceDef` (§3.8), `ObjectSetDef` (§3.9), `BoundaryPredicate` (§5.5). Tier 2 items were promoted from "deferred" to "merged" once the structural pattern proved out in Tier 1; see [gap-analysis Tier 2](./kedge-ontology-gap-analysis.md#tier-2--graduate-to-spec-after-phase-3-ships) for the original consequence analysis.

**Q: Why is `InterfaceDef` not just TypeScript-style interface inheritance?**
A: Two reasons. (1) Inheritance would conflict with Design Principle 1 — "schema is data, not code." Interfaces declared as data can travel through `getSchemaDigest()` and the schema-distribution endpoint; TS inheritance can't. (2) Structural conformance (matched at registration by apiName + type) means an ObjectType can implement an Interface defined in a different package without needing to extend a class. The registry tracks the implementation graph; ObjectTypeDefs stay flat.

**Q: When do I use an `ObjectSetDef` vs a `derivedFrom` slot?**
A: `derivedFrom` is for *follow this link to get the related instances* — `students` from `class.contains` is a graph traversal. `ObjectSetDef` is for *apply this filter expression to get a subset* — `struggling` (Students with `engagementScore < 30`) is a query, not a traversal. The two compose: a slot can target an ObjectSet whose objectType is itself reached via traversal. Rule of thumb: if you'd write SQL `WHERE` for it, it's an ObjectSet; if you'd write `JOIN`, it's a `derivedFrom` link.

**Q: Why is the predicate sub-language first-order? Won't I need to express more complex rules?**
A: Probably yes, sometimes. The escape hatch is the `'named'` form: register a `Predicate` implementation on the registry (`registerPredicate('isInPracticePhase', impl)`), and any `BoundaryPredicate` / `SetFilter` / `ActionPrecondition` can reference it by name. The first-order language covers ≥80% of needs (per gap-analysis Q3 reasoning) and stays trivially evaluable. Richer expressions go through code review of the named predicate implementation — which is the right review surface for non-trivial logic.

**Q: What happens to `AccessBoundary.readable: ['students']` when G5 lands?**
A: Nothing — it keeps working. `BoundaryPathEntry` is a union (`string | { slot, where }`), so plain path strings remain valid. The Tier 2 merge is non-breaking for Solutions that don't adopt predicates.

**Q: What about classification tags / state machines / validation rules / notifications / action returns?**
A: All merged per gap-analysis G7/G8/G9+G12/G10/G11. See: `ValidationRuleMeta` (§3.10), `StateMachineDef` (§3.11), `PropertyMeta.classification` + `.redaction` (§3.1), `NotificationRule` (§4.8), `ActionDef.returnType` + `ActionResult.returnValue` (§3.3 + §5.3). The "promotion criteria" originally documented in the gap analysis were what would trigger the merge; the user chose to graduate them ahead of that criterion to avoid Phase 3+ rework when criteria fire.

**Q: Why is `ValidationRuleMeta` a sidecar instead of a declarative rule expression?**
A: Because Zod `.refine()` and `.superRefine()` already express arbitrary domain rules, and Solutions write them today (live-lesson's `manifest.schema.ts` has them). Building a parallel declarative predicate language would either be less expressive than Zod refines (forcing fall-back to refines anyway) or duplicate work. The sidecar gives the refine a name + agent-facing semantic, which is the only thing missing.

**Q: When do I use `StateMachineDef` vs `ActionDef.preconditions`?**
A: `preconditions` gate a *single Action* on arbitrary state. `StateMachineDef` declares the *complete graph* of legal transitions on one enum-typed field, and binds each transition to an Action (optionally). Rule of thumb: if you have one Action whose call depends on state, use `preconditions`. If you have a field whose value moves through ≥3 states with named transitions, use `StateMachineDef` — you get exhaustive enumeration of legal next states, which the agent can read via `discoverTransitions(instance)`.

**Q: Why is redaction a separate concept from "field not in `AccessBoundary.readable`"?**
A: Different semantics. Absence from `readable` means the field doesn't exist for that role — `readSlot` returns an object without it. Redaction preserves the shape: the field is present but its value is masked/hashed/omitted-but-keyed. Downstream code that does `if (student.name)` keeps working; code that needs the actual value gets nothing meaningful. Pick redaction when the consumer's *structure* depends on field presence; pick absence-from-readable when you want the field to vanish from the type entirely.

---

## 13. Reference patterns from the existing repo

If you're implementing parts of this package or its first solution adoption and want a worked precedent, these are the closest patterns already in the repo.

### 13.1 Solution-side type registration → `recipe-book`

`solutions/business/recipe-book/backend/src/referenceable/providers/recipe.provider.ts` is the cleanest existing example of a `EntityContextProvider` implementation that owns serialize + edit for a domain entity. When you write the first `ObjectTypeDef` for a real type, model the Solution-side wiring on this: a NestJS service that extends `DocumentEditProvider`, registers itself with the registry, and implements the abstract methods. The migration story (Phase 2) is exactly: keep this provider working unchanged; add an `ObjectTypeDef` next to it; have both the legacy `register()` and new `registerObjectType()` calls fire in the module's `OnModuleInit`.

### 13.2 Block transforms for round-trippable rich content → `recipe-book`

`solutions/business/recipe-book/backend/src/referenceable/recipe-registry.ts` shows the per-Solution `TransformRegistry` pattern: a domain-specific block type (`ingredient`) registers `detect / serialize / deserialize` so it round-trips through markdown via HTML comments. This is the pattern for entities whose properties include rich content that needs `str_replace` edit support. The `entity-document` package machinery already handles this; the `ObjectTypeDef` for such an entity simply uses `type: 'json'` on the corresponding property and points the consumer at the existing `DocumentEditProvider` infrastructure.

### 13.3 Stdio MCP server as an ActionDef-handler container → `creator-mcp-server`

`solutions/business/live-lesson/creator-mcp-server/src/index.ts` is the canonical example of a stdio MCP server today: three tools (`emit_todo_card`, `emit_questions_card`, `emit_verify_card`) declared as static Tool objects, dispatched by name in the `CallToolRequestSchema` handler, with Zod validation on input and JSON-stringified output that gets re-parsed by `EventMapperService` into SSE `output_update` events. The migration target after Phase 3 lands is: each of these three becomes an `ActionDef` on a `ChatPanel` `ObjectTypeDef` (or similar), `solution.json`'s `proxyEnabled: true` keeps the existing audit wiring, and the agent's system prompt is auto-generated from the `ActionDef.semantic` instead of being hand-written in `appendSystemPrompt`.

### 13.4 Schema-as-data, renderer-as-pure-function → live-lesson's board

`solutions/business/live-lesson/frontend/.../board-data.js` + `board-renderer.js` is the existing precedent for the "schema is data" principle (Principle 1 in §1.7). `board-data.js` is a serializable description of the teacher's blackboard; `board-renderer.js` is a pure function that turns it into DOM. The same architectural split applies to the relationship between `ObjectTypeDef` (data) and the `@Picker` (renderer): when the picker becomes schema-driven (post-Phase 3), the React component is a pure function of `OntologyRegistry.getPickableTypes()` output.

### 13.5 The Zod-driven manifest validator → `live-lesson/backend/src/schemas/manifest.schema.ts`

The existing `manifest.schema.ts` in live-lesson is the "validation depth" decision (§9.7) in action — it composes ~15 inner schemas to validate one lesson manifest, fails fast at load, and returns structured errors. The ontology package's `src/schema/validators.ts` should aim for the same level of fail-fast, structured-error coverage but applied to the meta-schema (ObjectTypeDefs / ManifestDefs) rather than to a single domain's manifest shape.

### 13.6 The platform-asserted identity pattern → `tool-caller-proxy.service.ts`

The `ToolCallerProxy` source itself (`packages/backend/src/tool-caller/tool-caller-proxy.service.ts`) is the most important pattern in this repo to internalize before writing any code for this package. Read the 6 steps documented in the file header and the implementation in §10.5. The ontology's contribution is *additive* — a 7th gate slotted into step 3, an enriched audit row for `auditLevel: 'full_diff'`, and a stable place for `requiredPermissions` to point at when the permission engine lands.

---

## Appendix A — TypeScript snippet index

For quick navigation:

| Interface | Defined in §  |
|---|---|
| `PropertyMeta`, `PropertyMetaMap` (replaces former `PropertyDef`/`PropertyType`) | §3.1 |
| `LinkDef`, `LinkCardinality` | §3.2 |
| `ActionDef`, `AuditLevel`, `ApiKeyScopeLiteral` | §3.3 |
| `ObjectTypeDef`, `PickerConfig` | §3.4 |
| `StreamDef` | §3.5 |
| `SlotDef`, `SlotTarget` | §4.2 |
| `StateDef` | §4.3 |
| `AccessBoundary`, `BoundaryRole` | §4.4 |
| `LifecycleDef` | §4.5 |
| `ManifestDef`, `SchemaVersion` | §4.6 |
| `ManifestAccessor`, `ActionDescriptor` | §5.1 |
| `BoundaryCheckInput`, `BoundaryDecision`, `checkBoundary` | §5.2 |
| `ActionResult`, `StateChange`, `ActionErrorCode` | §5.3 |
| `OntologyRegistry` | §6 |
| `ProjectionFormat`, `ProjectedManifest`, `projectManifest` | §7 |

For the executable migration story, see [kedge-ontology-implementation-plan.md](./kedge-ontology-implementation-plan.md).
