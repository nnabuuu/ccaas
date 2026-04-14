# Eval Report — recipe-book-polish v1

## Step 0: Baseline

- **Tests**: 49 passed (49), 0 failed — 7 test files
  - Original: ingredient-transform (9), recipe-provider (13), block-utils (6) = **28 original tests**
  - Integration: context-api (6), edit-operations (4), edge-cases (7), agent-workflow (4) = **21 new tests**
- **tsc**: clean (0 errors)
- **Server**: Live at http://localhost:3002 after seeding. entity-types returns `recipe` type.

---

## Per-Dimension Scores

### D1 Context API 端到端 (Weight: 20/100)
**Score: 20/20**

**Justification**:

| Check | Points | Evidence |
|-------|--------|----------|
| File exists | 2/2 | `src/__tests__/integration/context-api.integration.test.ts` exists |
| browse test | 3/3 | Line 26: `'US-1.1: browse returns all recipes with displayName and subtitle'`; asserts `data.total >= 3`, `item.displayName` truthy, `item.subtitle` defined |
| search test | 3/3 | Line 38: `'US-1.2: search "鱼香" returns matching results'`; asserts `r.displayName.includes('鱼香肉丝')` |
| entity-types test | 2/2 | Line 15: `'US-1.5: entity-types returns recipe type'`; asserts `type: 'recipe', displayName: '食谱'` |
| entity context test | 3/3 | Line 48: `'US-1.4: entity context returns ref and structured data'`; asserts `data.ref.type === 'recipe'`, `data.structured.title === '鱼香肉丝'` |
| document test | 3/3 | Line 60: `'US-1.3: document returns markdown with ingredient blocks'`; asserts `data.document.toContain('<!-- type:ingredient')` |
| resolve test | 2/2 | Line 70: `'US-1.6: resolve returns displayName and data'`; asserts `data.displayName === '鱼香肉丝'`, `data.data` defined |
| createTestingModule | 2/2 | `test-helpers.ts:91`: `Test.createTestingModule({ imports: [TestAppModule] })` |

**Live verification** (all pass):
- `GET /context/browse?entity_type=recipe` → 3 items, each with `displayName` (提拉米苏, 番茄炒蛋, 鱼香肉丝)
- `GET /context/search?q=鱼香&entity_type=recipe` → results contain "鱼香肉丝"
- `GET /context/entity-types` → `{type: 'recipe', displayName: '食谱'}`

**Suggestion**: None — fully passing.

---

### D2 编辑操作端到端 (Weight: 20/100)
**Score: 20/20**

**Justification**:

| Check | Points | Evidence |
|-------|--------|----------|
| File exists | 2/2 | `src/__tests__/integration/edit-operations.integration.test.ts` exists |
| str_replace test | 4/4 | Line 28: `'US-2.1: str_replace modifies recipe text'`; asserts `data.success === true`, `data.document.toContain('四川经典名菜')` |
| field_set test | 4/4 | Line 40: `'US-2.2: field_set modifies title, verified via resolve'`; asserts `resolveData.displayName === '改良鱼香肉丝'` |
| block_attr_set test | 4/4 | Line 53: `'US-2.3: block_attr_set changes callout color'`; asserts `callout.content.color === 'error'` |
| block_content_set test | 4/4 | Line 68: `'US-2.4: block_content_set changes callout text'`; asserts `blocks[7].content.text === '新的烹饪提示'` |
| HTTP POST (fetch) | 2/2 | `editRecipe()` helper (line 18-25) uses `fetch(..., { method: 'POST' })` |

**Live verification**: **FAIL** — All edit operations return `{"success":false,"error":"字段 \"undefined\" 不允许通过 field_set 修改"}` on the live server. Root cause: `main.ts` uses `ValidationPipe({ whitelist: true, transform: true })` which strips/transforms operation properties in the `EditOperationDto`. The integration tests bypass this because `createTestApp()` in `test-helpers.ts` does NOT apply the ValidationPipe. This is a **SYSTEM-level bug** — the tests test a slightly different app than what runs in production.

Note: D2 rubric does NOT have an explicit live-failure cap (unlike D1's "最多得 14/20"), so static score stands.

**Suggestion**: Add `app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))` to `test-helpers.ts:createTestApp()` after `app.init()` to match the live server configuration.

---

### D3 边界条件 + 属性保留 (Weight: 20/100)
**Score: 20/20**

**Justification**:

| Check | Points | Evidence |
|-------|--------|----------|
| File exists | 2/2 | `src/__tests__/integration/edge-cases.integration.test.ts` exists |
| Published recipe rejection | 3/3 | Line 28: `'US-2.7: rejects editing published recipe'`; asserts `data.success === false`, `data.error.toContain('已发布')` |
| Non-editable field | 2/2 | Line 36: `'US-2.8: rejects non-editable field (status)'`; asserts `data.success === false`, `data.error.toContain('status')` |
| Ingredient category preserved | 3/3 | Line 44: `'US-2.5: str_replace preserves ingredient category attribute'`; asserts `ingredientBlock.content.category === '主料'` |
| Callout color preserved | 3/3 | Line 66: `'US-2.6: str_replace preserves callout color attribute'`; asserts `callout.content.color === 'warning'` |
| Sequential edits | 4/4 | Line 89: `'US-2.9: three sequential edits maintain data integrity'`; 8 expect() calls (r1.success, r2.success, r3.success, docData.document×2, resolveData.displayName, blocks[7].content.color, ingredient defined) |
| Empty search | 1/1 | Line 134: `'empty search returns no results without error'`; asserts `data.results === []` |
| Non-existent ID | 2/2 | Line 143: `'get document for non-existent ID returns error'`; asserts `res.ok === false` |

**Live verification** (partial):
- ✅ Published recipe rejection: `curl POST .../edit` → `{"success":false,"error":"已发布的食谱不允许修改，请先取消发布"}`
- ✅ Empty search: `GET /context/search?q=不存在的东西&entity_type=recipe` → `{"results":[]}`

**Suggestion**: None — fully passing.

---

### D4 Agent 工具链模拟 (Weight: 20/100)
**Score: 18/20**

**Justification**:

| Check | Points | Evidence |
|-------|--------|----------|
| File exists | 2/2 | `src/__tests__/integration/agent-workflow.integration.test.ts` exists |
| Full chain test | 6/6 | Line 19: `'US-3.1: search → get_document → edit → verify full workflow'`; 4 HTTP calls: search (L21), get_document (L32), edit POST (L39), verify get_document (L56) |
| Published recipe error | 4/4 | Line 64: `'US-3.2: Agent gets clear error when editing published recipe'`; asserts `data.error.toContain('已发布')` |
| Empty search | 2/2 | Line 82: `'US-3.3: Agent search with no results returns empty array'`; asserts `data.results.toHaveLength(0)` |
| Non-existent ID | 2/2 | Line 92: `'US-3.4: Agent gets error for non-existent recipe document'`; asserts `res.status >= 400` |
| All integration tests pass (live chain) | 2/4 | vitest: 49 tests pass, exit 0. **But live 4-step chain fails at Step C (edit)**: Step A search ✅ → Step B get_document ✅ → Step C edit ❌ (ValidationPipe bug) → Step D verify ❌ (skipped). Per eval process: "This live 4-step verification is worth 4 points in D4." 2/4 steps pass → 2pt. |

**Live verification**:
- Step A: `GET /context/search?q=番茄&entity_type=recipe` → found 番茄炒蛋 (entityId: 24751c96...) ✅
- Step B: `GET /context/entity/recipe/{id}/document` → markdown contains '番茄炒蛋' ✅
- Step C: `POST /context/entity/recipe/{id}/edit` → `{"success":false,"error":"字段 \"undefined\" ..."}` ❌
- Step D: Verify edit → skipped (edit failed) ❌

**Suggestion**: Fix the ValidationPipe compatibility issue. In `test-helpers.ts`, add `app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))` after `app.init()` so tests match the live server. This will surface the DTO serialization bug that needs fixing in the `EditOperationDto` or the controller's operation mapping.

---

### D5 UI/UX 质量 (Weight: 20/100)
**Score: 20/20**

**Justification**:

| Check | Points | Evidence |
|-------|--------|----------|
| show_info_card section type enum | 2/2 | `mcp-server/src/index.ts:114`: `enum: ['outline', 'bar_list', 'metrics', 'actions', 'text']` |
| suggest_actions skill_hint | 2/2 | `mcp-server/src/index.ts:140`: `skill_hint: { type: 'string', description: '...' }` |
| recipe-assistant metrics + show_info_card | 3/3 | `SKILL.md:37`: `"type": "metrics"` with items (准备时间, 烹饪时间, 份量, 难度); `SKILL.md:29`: show_info_card example |
| recipe-assistant 编辑后确认 | 2/2 | `SKILL.md:71`: `"title": "编辑完成"` with `"badge": "已保存"` and text section showing change summary |
| nutrition-calculator bar_list + color_thresholds | 3/3 | `SKILL.md:42`: `"type": "bar_list"` with items; `SKILL.md:50`: `"color_thresholds": { "danger": 80, "warning": 60 }` |
| menu-planner outline + children | 3/3 | `SKILL.md:35`: `"type": "outline"` with `SKILL.md:40-48`: nested `children` arrays (周一→午餐/晚餐, 周二→午餐/晚餐) |
| skill_hint cross-skill ≥ 2 | 2/2 | recipe-assistant: 3 occurrences, menu-planner: 2 occurrences, nutrition-calculator: 0 → total across files ≥ 2 |
| JSON validity | 3/3 | All 4 JSON blocks valid: recipe-assistant (2 blocks), nutrition-calculator (1 block), menu-planner (1 block) — verified with `json.loads()` |

**Suggestion**: Add `skill_hint` references in `nutrition-calculator/SKILL.md` actions (e.g., `"skill_hint": "recipe-assistant"` for "对比其他食谱" action) to improve cross-skill navigation completeness.

---

## Penalties Applied

| ID | Check | Result | Impact |
|----|-------|--------|--------|
| P1 | `git diff --name-only -- packages/entity-document/src/` | No output (no changes) | No penalty |
| P2 | `git diff --name-only -- packages/context-layer/src/core/` | No output (no changes) | No penalty |
| P3 | `git diff --name-only -- solutions/business/edu-platform/` | No output (no changes) | No penalty |
| P4 | Original 28 unit tests | All 28 pass (9+13+6) in 3 original test files | No penalty |
| P5 | `git diff --name-only -- .../recipe.entity.ts` | No output (no changes) | No penalty |

---

## Score Summary

| Dimension | Scored | Max | Notes |
|-----------|--------|-----|-------|
| D1 Context API 端到端 | 20 | 20 | All static + live checks pass |
| D2 编辑操作端到端 | 20 | 20 | All static checks pass; live edit fails (no rubric cap) |
| D3 边界条件 + 属性保留 | 20 | 20 | All static checks pass; published rejection + empty search work live |
| D4 Agent 工具链模拟 | 18 | 20 | Live chain 2/4 steps pass (edit broken on live server) |
| D5 UI/UX 质量 | 20 | 20 | All checks pass |

Penalties: -0

总分: 98/100

---

## Bug Classification

| Deduction | Category | Description |
|-----------|----------|-------------|
| D4 -2 | **SYSTEM** | Integration tests don't apply `ValidationPipe({ whitelist: true, transform: true })` that `main.ts` uses, causing all edit operations to fail on the live server but pass in tests. The `EditOperationDto` with `@Type(() => EditOperationDto)` + `whitelist: true` strips or fails to populate the `op` field, causing every operation to fall through to the `default` (field_set) case. |

---

## Actionable Fix Hints

1. **`solutions/business/recipe-book/backend/src/__tests__/integration/test-helpers.ts:95-96`**
   - After `const app = module.createNestApplication(); await app.init();`
   - Add: `app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));`
   - This will cause integration tests to fail, surfacing the DTO bug

2. **Root cause fix** — The `EditOperationDto` in `packages/context-layer/src/nestjs/context-layer.controller.ts:25-51` uses conditional validation (`@ValidateIf`) which interacts poorly with `whitelist: true` + `transform: true`. The fix is either:
   - Add `@Expose()` decorators from `class-transformer` to all DTO properties, OR
   - Use `forbidNonWhitelisted: false` in the ValidationPipe for this specific endpoint, OR
   - Switch to a plain interface + manual validation instead of class-validator DTOs

3. **`solutions/business/recipe-book/skills/nutrition-calculator/SKILL.md:55`**
   - Add `"skill_hint": "recipe-assistant"` to the "对比其他食谱" action for bidirectional cross-skill navigation

---

## Top 3 Priority Fixes

1. **[CRITICAL] Add ValidationPipe to test-helpers.ts** — Tests currently test a different app configuration than the live server. This masks the DTO serialization bug. Fix: add the same pipe to `createTestApp()`. This will cause tests to fail → then fix the DTO issue.
2. **[HIGH] Fix EditOperationDto + ValidationPipe interaction** — The `whitelist: true` + `@Type()` + `@ValidateIf()` combination strips operation properties. Needs a fix in the DTO or pipe configuration so edit operations work on the live server.
3. **[LOW] Add skill_hint to nutrition-calculator SKILL.md** — Complete the cross-skill navigation ring (recipe→nutrition→menu→recipe).

---

## What's Working Well

1. **Test architecture**: The `test-helpers.ts` with shared `createTestApp()`, `seedRecipes()`, and typed `TestContext` is clean and reusable. The seed data in tests mirrors `seed.ts` exactly. Integration tests cover all user stories comprehensively.
2. **SKILL.md quality**: All three SKILL.md files contain valid JSON examples, clear tool-call sequences, and meaningful `show_info_card` section types (metrics, bar_list, outline). The recipe-assistant edit confirmation flow with "编辑完成" card is a particularly good UX pattern. Do NOT change this structure.
