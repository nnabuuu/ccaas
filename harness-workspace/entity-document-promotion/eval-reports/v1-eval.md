# Eval Report — entity-document-promotion v1

## Per-Dimension Scores

### D1 现有测试完整性 (Weight: 20/100)
**Score: 20/20**
**Justification**:
- vitest run output: 6 test files, 76 tests passed, 0 failed. The 4 frozen test files account for 57 original tests: transforms.test.ts (30), round-trip.test.ts (15), str-replace.test.ts (8), cross-block.test.ts (4). All pass.
- `git diff --name-only` on the 4 frozen test files returned empty — no modifications.
- P1 not triggered (no original test failures).

**Suggestion**: None.

### D2 TransformRegistry 正确性 (Weight: 25/100)
**Score: 25/25**
**Justification**:
- `transform-registry.ts` exists with `export class TransformRegistry` — confirmed via grep. **(3/3)**
- `export const defaultRegistry = TransformRegistry.withDefaults();` present. **(2/2)**
- `withDefaults()` registers 7 built-in types (section, timeline, table, list, callout, image, text). registry.test.ts verifies `getRegisteredTypes()` has length 7 and checks all type names. **(3/3)**
- registry.test.ts has 11 passing tests covering register, unregister, getTransform, detectTransform, fallback, text-protection, singleton, and custom-registry-with-serialize/deserialize. 11 ≥ 8. **(5/5)**
- Module-level `getTransform()` / `detectTransform()` still exported from `transforms/index.ts` and all 30 transforms.test.ts tests pass — backward compatibility confirmed. **(5/5)**
- `serialize(doc: EntityDocument, registry?: TransformRegistry)` — optional param confirmed. **(3/3)**
- `deserialize(text: string, registry?: TransformRegistry)` — optional param confirmed. **(2/2)**
- `strReplace` has `registry?: TransformRegistry` parameter — optional param confirmed. **(2/2)**

**Suggestion**: None.

### D3 block-utils 泛化 (Weight: 15/100)
**Score: 15/15**
**Justification**:
- `packages/entity-document/src/block-utils.ts` exists with 2 exported functions (`splitBlockForDocument`, `mergeBlockForStorage`). **(3/3)**
- `ContentToAttrConfig` type exported from `interfaces.ts`: `export type ContentToAttrConfig = Record<string, string[]>`. **(2/2)**
- Both functions accept optional `config` parameter with default `{}`: `config: ContentToAttrConfig = {}`. **(3/3)**
- `block-utils.test.ts` exists with 8 passing tests (4 for split, 4 for merge including round-trip). 8 ≥ 6. **(4/4)**
- edu `block-utils.ts` is exactly 15 lines — a thin wrapper that imports generic functions and binds `EDU_CONFIG = { callout: ['color'] }`. 15 ≤ 15. **(3/3)**

**Suggestion**: None.

### D4 DocumentEditProvider 抽象 (Weight: 20/100)
**Score: 20/20**
**Justification**:
- `packages/context-layer/src/core/document-edit-provider.ts` exists (116 lines). **(3/3)**
- All 5 abstract methods present: `loadEntity`, `saveEntity`, `toEntityDocument`, `getEditableFields`, `getContentToAttrConfig`. Concrete `serialize()` and `edit()` methods implement the orchestration loop. **(4/4)**
- `LessonPlanProvider extends DocumentEditProvider` confirmed in lesson-plan.provider.ts:16. **(4/4)**
- `TemplateProvider extends DocumentEditProvider` confirmed in template.provider.ts:13. **(3/3)**
- LessonPlanProvider is 94 lines. 94 ≤ 120. **(3/3)**
- `tsc --noEmit` clean in all 3 packages (entity-document, context-layer, edu-platform backend) — zero errors. **(3/3)**
- P2 not triggered: `git diff --name-only` on `context-layer/src/core/interfaces.ts` returned empty.
- P3 not triggered: `git diff --name-only` on `context-router.ts` and `entity-registry.ts` returned empty.

**Suggestion**: None.

### D5 包结构与导出 (Weight: 20/100)
**Score: 20/20**
**Justification**:
- `TransformRegistry` exported from `entity-document/src/index.ts`: `export { TransformRegistry, defaultRegistry } from './transform-registry.js'`. **(3/3)**
- `defaultRegistry` exported on same line. **(2/2)**
- `ContentToAttrConfig` exported in the `export type` block. **(2/2)**
- `splitBlockForDocument` / `mergeBlockForStorage` exported: `export { splitBlockForDocument, mergeBlockForStorage } from './block-utils.js'`. **(3/3)**
- `DocumentEditProvider` exported from `context-layer/src/core/index.ts`: `export { DocumentEditProvider } from './document-edit-provider.js'`. **(3/3)**
- `grep -r "from '@nestjs" packages/entity-document/src/` returned empty — no @nestjs imports. **(4/4)**
- `grep -r "from '@nestjs" packages/context-layer/src/core/` returned empty — no @nestjs imports. **(3/3)**
- P4 not triggered.

**Suggestion**: None.

## Penalties Applied
- None

## Score Summary

| Dimension | Scored | Max | Notes |
|-----------|--------|-----|-------|
| D1 现有测试完整性 | 20 | 20 | 76/76 tests pass, 0 frozen files modified |
| D2 TransformRegistry | 25 | 25 | Full class + singleton + optional params + backward compat |
| D3 block-utils 泛化 | 15 | 15 | Generic functions + config param + 8 tests + thin edu wrapper |
| D4 DocumentEditProvider | 20 | 20 | Abstract base + 2 providers extend + tsc clean |
| D5 包结构与导出 | 20 | 20 | All symbols exported, zero @nestjs leakage |

Penalties: 0

总分: 100/100

## Bug Classification

No deductions — no bugs to classify.

## Actionable Fix Hints

No deductions — no fixes needed.

## Top 3 Priority Fixes

No fixes needed — all criteria met.

## What's Working Well

1. **Clean separation of concerns**: The `TransformRegistry` in entity-document is framework-agnostic with zero @nestjs contamination, while the `DocumentEditProvider` in context-layer/core properly abstracts the serialize/edit loop. The edu-platform providers are thin, domain-specific implementations. This layering is textbook.

2. **Backward compatibility preserved**: The module-level `getTransform()` / `detectTransform()` exports remain intact and all 57 original tests pass unchanged. The optional `registry?` parameter on serialize/deserialize/strReplace means existing callers require zero changes. The Generator should NOT change this approach.
