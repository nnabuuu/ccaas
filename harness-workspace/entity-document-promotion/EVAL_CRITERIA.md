# Evaluation Criteria: entity-document CCAAS Component Promotion

## Dimensions

### D1: 现有测试完整性 (20/100)

| Check | Points | Detection |
|-------|--------|-----------|
| All 57 original tests pass | 15 | `cd packages/entity-document && npx vitest run` — count pass/fail from output |
| 4 frozen test files unchanged | 5 | `git diff --name-only -- packages/entity-document/src/__tests__/{transforms,round-trip,str-replace,cross-block}.test.ts` returns empty |

**Penalty P1**: If ANY original test fails → D1 = 0 (entire dimension zeroed)

### D2: TransformRegistry 正确性 (25/100)

| Check | Points | Detection |
|-------|--------|-----------|
| `transform-registry.ts` exists with `export class TransformRegistry` | 3 | `grep 'export class TransformRegistry' packages/entity-document/src/transform-registry.ts` |
| `defaultRegistry` exported as singleton | 2 | `grep 'export const defaultRegistry' packages/entity-document/src/transform-registry.ts` |
| `withDefaults()` registers all 7 built-in types | 3 | registry.test.ts verifies `getRegisteredTypes()` has 7 entries |
| `register()` / `unregister()` / `getTransform()` / `detectTransform()` work | 5 | registry.test.ts ≥8 tests pass |
| Module-level `getTransform()` / `detectTransform()` backward compatible | 5 | Original transforms.test.ts passes (D1 coverage) |
| `serialize(doc, registry?)` optional param | 3 | `grep 'registry.*TransformRegistry' packages/entity-document/src/serializer.ts` |
| `deserialize(text, registry?)` optional param | 2 | `grep 'registry.*TransformRegistry' packages/entity-document/src/deserializer.ts` |
| `strReplace(doc, old, new, registry?)` optional param | 2 | `grep 'registry.*TransformRegistry' packages/entity-document/src/str-replace.ts` |

### D3: block-utils 泛化 (15/100)

| Check | Points | Detection |
|-------|--------|-----------|
| `block-utils.ts` exists in entity-document with both functions | 3 | `grep -c 'export function' packages/entity-document/src/block-utils.ts` ≥ 2 |
| `ContentToAttrConfig` type exported from interfaces.ts | 2 | `grep 'ContentToAttrConfig' packages/entity-document/src/interfaces.ts` |
| Functions accept optional `config` parameter | 3 | `grep 'config.*ContentToAttrConfig' packages/entity-document/src/block-utils.ts` |
| block-utils.test.ts exists with ≥6 passing tests | 4 | vitest output shows block-utils.test.ts with ≥6 pass |
| edu block-utils.ts is thin wrapper ≤15 lines | 3 | `wc -l < solutions/business/edu-platform/backend/src/referenceable/block-utils.ts` ≤ 15 |

### D4: DocumentEditProvider 抽象 (20/100)

| Check | Points | Detection |
|-------|--------|-----------|
| `document-edit-provider.ts` exists in context-layer/core | 3 | File exists |
| Has all 5 abstract methods + concrete `serialize`/`edit` | 4 | grep for `abstract loadEntity`, `abstract saveEntity`, `abstract toEntityDocument`, `abstract getEditableFields`, `abstract getContentToAttrConfig` |
| LessonPlanProvider extends DocumentEditProvider | 4 | `grep 'extends DocumentEditProvider' .../lesson-plan.provider.ts` |
| TemplateProvider extends DocumentEditProvider | 3 | `grep 'extends DocumentEditProvider' .../template.provider.ts` |
| LessonPlanProvider ≤120 lines | 3 | `wc -l < .../lesson-plan.provider.ts` ≤ 120 |
| tsc --noEmit clean in all 3 packages | 3 | 0 errors from entity-document, context-layer, edu-backend |

**Penalty P2**: If `context-layer/src/core/interfaces.ts` modified → D4 = 0
**Penalty P3**: If `context-router.ts` or `entity-registry.ts` modified → D4 = 0

### D5: 包结构与导出 (20/100)

| Check | Points | Detection |
|-------|--------|-----------|
| `TransformRegistry` exported from entity-document/index.ts | 3 | grep check |
| `defaultRegistry` exported from entity-document/index.ts | 2 | grep check |
| `ContentToAttrConfig` exported from entity-document/index.ts | 2 | grep check |
| `splitBlockForDocument` / `mergeBlockForStorage` exported from index.ts | 3 | grep check |
| `DocumentEditProvider` exported from context-layer/core/index.ts | 3 | grep check |
| No `@nestjs/*` imports in entity-document/src/ | 4 | `grep -r "from '@nestjs" packages/entity-document/src/` returns empty |
| No `@nestjs/*` imports in context-layer/src/core/ | 3 | `grep -r "from '@nestjs" packages/context-layer/src/core/` returns empty |

**Penalty P4**: If `@nestjs` found in entity-document/src/ → D5 − 5

## Penalty Summary

| ID | Trigger | Impact |
|----|---------|--------|
| P1 | Any original test fails | D1 → 0 |
| P2 | interfaces.ts signature changed | D4 → 0 |
| P3 | context-router/entity-registry modified | D4 → 0 |
| P4 | @nestjs import in entity-document | D5 − 5 |

## Score Format

The evaluator MUST output the total score in this exact format:
```
总分: XX/100
```
