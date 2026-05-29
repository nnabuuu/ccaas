# Key Conventions

## Imports

```typescript
// Import from workspace packages
import { Session, Skill, TokenUsage } from '@kedge-agentic/common'
import { useAgentState, useFormBridge } from '@kedge-agentic/vue-sdk'
```

## Adding New Types

1. Add interface to `packages/common/src/types/index.ts`
2. Re-export from `packages/common/src/index.ts`
3. Run `npm run build:common`
4. Import from `@kedge-agentic/common` in consumer packages

## Adding New Protocols

1. Add to `packages/common/src/protocols/`
2. Export from `packages/common/src/protocols/index.ts`
3. Run `npm run build:common`

## Adding New Composables (vue-sdk)

1. Create file in `packages/vue-sdk/src/composables/`
2. Export from `packages/vue-sdk/src/composables/index.ts`
3. Document usage in file JSDoc

## Testing

```bash
# Run all tests
npm run test

# Run specific package tests
npm run test -w @kedge-agentic/backend
npm run test -w @kedge-agentic/vue-sdk
npm run test -w @kedge-agentic/common

# Architecture tests
npm run test:architecture
```

## Refactoring Terminology / Field Names

When refactoring terminology or field names across the codebase:

1. **Search First**: Use `Grep` to find ALL usages before making changes
2. **Document Scope**: List all affected files and usage contexts
3. **Verify Coverage**: After changes, grep again to ensure no instances were missed
4. **Update Tests**: Check that tests reflect the new terminology
5. **Update Documentation**: Ensure all docs use consistent terminology

## Package layering

> A workspace package's main entry point (`src/index.ts`) MUST be framework-free, OR the package name MUST carry a framework suffix (`-react`, `-vue`, `-nest`).

Foundation packages (`common`, `entity-document`, `agent-runtime`, the proposed `ontology`) are framework-free — they can be consumed by agent subprocesses, CLI tools, browsers, and NestJS services without imposing a framework choice on the consumer. Framework-binding packages (`context-layer-react`, `react-sdk`, `vue-sdk`) bind a framework-free core to a specific framework; the suffix makes the constraint visible at the import site.

**Why this rule exists**: cross-process portability (agent subprocesses shouldn't pull NestJS transitively for 50 MB+ install penalty); testability without framework boot; honest naming at the import site.

**Authoritative analysis + refactor plan**: [`docs/architecture/package-layering.md`](./architecture/package-layering.md) (the empirical audit of all 15 packages and the convention itself) + [`docs/architecture/package-refactor-plan.md`](./architecture/package-refactor-plan.md) (the per-package refactor sequence). Read these before adding a new package or proposing a framework dependency in an existing one.

**Known violations under refactor** (per the analysis):

- `@kedge-agentic/context-layer` mixes framework-free core + NestJS bindings in one package; refactor plan Phase 2 splits this into `-core` and `-nest`.
- `@kedge-agentic/harness` and `@kedge-agentic/observer-engine` ship NestJS peerDeps without `-nest` suffix; flagged for follow-up.

When adding a new package, check the [package-layering.md §1 inventory table](./architecture/package-layering.md#1-empirical-layer-inventory) and the convention in §2 to confirm your package follows the rule.

### Editor abstractions are intentionally per-altitude

The codebase has two editor abstractions: `ArtifactEditor<T>` (in `@kedge-agentic/agent-runtime`, artifact-level, in-memory) and `DocumentEditProvider` (in `@kedge-agentic/context-layer`, entity-level, load-edit-save). They share an `EditOperation` discriminated union shape but are NOT polymorphic — they operate at different abstraction altitudes.

If you need a third editor, evaluate which altitude it belongs to:

- **Artifact-level** (you have an in-memory object/document and want to apply ops to it) → implement `ArtifactEditor<T>`.
- **Entity-level** (you have an ID and want load+edit+save round-trip) → extend `DocumentEditProvider`.

Do NOT introduce a third sibling abstraction without revisiting this decision; the proliferation of editor abstractions is the failure mode this convention prevents. See [package-layering.md §3.2](./architecture/package-layering.md#32-inconsistency-2--two-unrelated-editor-abstractions-medium-severity) for the analysis.
