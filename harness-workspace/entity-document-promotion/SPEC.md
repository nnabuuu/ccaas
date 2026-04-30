# SPEC: entity-document CCAAS Component Promotion

## Objective

Promote `@kedge-agentic/entity-document` from a flat solution-level tool to a proper CCAAS component with:
1. Pluggable **TransformRegistry** — solutions can register custom block types
2. Generic **block-utils** — parameterized `ContentToAttrConfig`, extracted from edu-platform
3. Abstract **DocumentEditProvider** base class — eliminates ~60 lines of duplicated edit orchestration per provider

All 57 existing tests must pass unchanged.

## Artifact Description

**Primary**: `packages/entity-document/src/` (live source code)
**Secondary**: `packages/context-layer/src/core/document-edit-provider.ts` (new file)
**Adapters**: `solutions/business/edu-platform/backend/src/referenceable/` (modified)

## Frozen Constraints

| ID | Constraint | Files |
|----|-----------|-------|
| FC-1 | 4 existing test files MUST NOT be modified | `entity-document/src/__tests__/{transforms,round-trip,str-replace,cross-block}.test.ts` |
| FC-2 | EntityContextProvider / EditOperation / EditResult signatures unchanged | `context-layer/src/core/interfaces.ts` |
| FC-3 | context-router.ts unchanged | `context-layer/src/core/context-router.ts` |
| FC-4 | entity-registry.ts unchanged | `context-layer/src/core/entity-registry.ts` |
| FC-5 | No `@nestjs/*` imports in entity-document/src/ | Entire directory |
| FC-6 | No `@nestjs/*` imports in context-layer/src/core/ | Entire directory |
| FC-7 | RequirementProvider not forced to extend DocumentEditProvider | `requirement.provider.ts` |

## Code Change Map

```
packages/entity-document/
  src/
    transform-registry.ts      # NEW — pluggable registry class
    block-utils.ts              # NEW — generic split/merge with ContentToAttrConfig param
    interfaces.ts               # UPDATE — add ContentToAttrConfig type
    index.ts                    # UPDATE — expand exports
    transforms/index.ts         # UPDATE — delegate to defaultRegistry, keep function signatures
    serializer.ts               # UPDATE — accept optional registry param
    deserializer.ts             # UPDATE — accept optional registry param
    str-replace.ts              # UPDATE — accept optional registry param
    __tests__/
      registry.test.ts          # NEW — ≥8 tests
      block-utils.test.ts       # NEW — ≥6 tests

packages/context-layer/src/core/
  document-edit-provider.ts     # NEW — abstract base class
  index.ts                      # UPDATE — export DocumentEditProvider

solutions/business/edu-platform/backend/src/referenceable/
  block-utils.ts                # REPLACE — thin wrapper, <15 lines
  providers/
    lesson-plan.provider.ts     # UPDATE — extends DocumentEditProvider
    template.provider.ts        # UPDATE — extends DocumentEditProvider
```

## Design Details

### TransformRegistry

```typescript
export class TransformRegistry {
  register(type: string, transform: BlockTransform): void;
  unregister(type: string): boolean;
  getTransform(type: string): BlockTransform;        // fallback to text
  detectTransform(lines: string[]): BlockTransform;  // priority order
  getRegisteredTypes(): string[];
  static withDefaults(): TransformRegistry;           // factory with 7 built-ins
}
export const defaultRegistry = TransformRegistry.withDefaults();
```

Module-level functions (`getTransform`, `detectTransform`) delegate to `defaultRegistry`. Signatures unchanged.
`serialize(doc, registry?)` / `deserialize(text, registry?)` / `strReplace(doc, old, new, registry?)` — optional param, defaults to `defaultRegistry`.

### block-utils

```typescript
export type ContentToAttrConfig = Record<string, string[]>;
export function splitBlockForDocument(block: any, config?: ContentToAttrConfig): BlockData;
export function mergeBlockForStorage(block: BlockData, config?: ContentToAttrConfig): Record<string, any>;
```

edu-platform `block-utils.ts` becomes thin wrapper (~10 lines) with `{ callout: ['color'] }` config.

### DocumentEditProvider

```typescript
export abstract class DocumentEditProvider implements Pick<EntityContextProvider, 'serialize' | 'edit'> {
  abstract loadEntity(id: string, userId: string): Promise<any>;
  abstract saveEntity(id: string, updates: any, userId: string): Promise<void>;
  abstract toEntityDocument(entity: any): EntityDocument;
  abstract getEditableFields(): Set<string>;
  abstract getContentToAttrConfig(): ContentToAttrConfig;
  protected validateEdit?(entity: any, ops: EditOperation[]): EditResult | null;
  async serialize(id: string, userId: string): Promise<string>;
  async edit(id: string, ops: EditOperation[], userId: string): Promise<EditResult>;
}
```

## Exit Conditions

- **Target**: ≥90/100
- **Pass**: ≥70/100 with D1=20/20
- **Max iterations**: 8
- **Diminishing returns**: <3 point improvement for 2 consecutive iterations
