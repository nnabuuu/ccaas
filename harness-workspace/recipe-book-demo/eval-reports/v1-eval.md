# Eval Report — recipe-book-demo v1

## Per-Dimension Scores

### D1 TransformRegistry 自定义 (Weight: 20/100)
**Score: 20/20**
**Justification**:
- `recipe-registry.ts` exists with `ingredientTransform` exported (line 4) — **2/2**
- Transform uses `<!-- type:ingredient` marker (lines 8, 15, 20) — **2/2**
- Transform implements detect (line 7), serialize (line 11), deserialize (line 18) — **3/3**
- Registry via `TransformRegistry.withDefaults()` (line 30) + `register('ingredient', ingredientTransform)` (line 31) — **3/3**
- `ingredient-transform.test.ts` has 9 passing tests (≥6 required) — **5/5**
- Round-trip test at line 51: `serialize → deserialize` with equality assertion — **3/3**
- `detectTransform` test at line 63: verifies registry detects ingredient lines — **2/2**

P1 check: `git diff --name-only -- packages/entity-document/src/` = empty. No penalty.
**Suggestion**: None.

### D2 Surgical Diff 正确性 (Weight: 20/100)
**Score: 16/20**
**Justification**:
- Tests verify str_replace preserves callout color: test at line 95 (`str_replace: callout color preserved as attribute then merged back`), base recipe includes `{ type: 'callout', content: { text: '注意火候', color: 'warning' } }` — **4/4**
- Tests verify str_replace preserves ingredient category: test at line 83, assertion at line 92 `expect(ingredientBlock.content.category).toBe('主料')` — **4/4**
- Tests verify frontmatter-only edit preserves ALL attributes: **No test found.** grep for 'frontmatter' or 'meta' AND 'str_replace' yields no matches. The `field_set` test (line 43) changes title but doesn't verify block attributes are preserved afterward — **0/4**
- `str_replace` uses `recipeRegistry` (not defaultRegistry): confirmed at line 95 of recipe.provider.ts: `strReplace(currentDoc, op.old_string, op.new_string, recipeRegistry)` — **4/4**
- Tests verify cross-block replacement preserves surrounding attributes: tests at lines 70, 83, 95 all use 'preserve'/'preserved' in names. Line 70 replaces text in a text block and verifies ingredient block still round-trips correctly. Line 83 verifies ingredient category preserved after unrelated str_replace — **4/4**

P2 check: `git diff --name-only -- packages/context-layer/src/core/` = empty. No penalty.
**Suggestion**: Add a test for frontmatter-only edit (`field_set` only, no `str_replace`) that verifies all block attributes (callout color, ingredient category) remain unchanged after the edit.

### D3 Dual Edit Path (Weight: 20/100)
**Score: 14/20**
**Justification**:
- `RecipeProvider extends DocumentEditProvider` at line 25 — **2/2**
- 5 abstract methods implemented: `loadEntity` (line 28), `saveEntity` (line 29), `toEntityDocument` (line 33), `getEditableFields` (line 30), `getContentToAttrConfig` (line 31). Grep count = 14 (includes multiple references) — **4/4**
- `validateEdit` rejects published recipes at lines 128-131: `entity.status === 'published'` returns error — **2/2**
- Test: `field_set` changes metadata at line 43, verifies `mockService.update` called with `{ title: '新标题' }` — **3/3**
- Test: `str_replace` modifies content at line 61, verifies `result.document` contains '美味' — **3/3**
- Test: `block_attr_set` changes attribute: **NOT FOUND.** No grep match for 'block_attr_set' in test file. The `edit()` method also doesn't handle `block_attr_set` operations — **0/3**
- Test: `block_content_set` updates content field: **NOT FOUND.** No grep match for 'block_content_set' in test file. The `edit()` method also doesn't handle `block_content_set` operations — **0/3**

P3 check: `DocumentEditProvider` imported from `@kedge-agentic/context-layer/core` (line 9). No penalty.
**Suggestion**: Implement `block_attr_set` and `block_content_set` operation handlers in `RecipeProvider.edit()`, then add corresponding tests.

### D4 CCAAS 租户接入 (Weight: 20/100)
**Score: 20/20**
**Justification**:
- `solution.json` exists with `schemaVersion: "3.0"`, `tenant.slug: "recipe-book"`, `skills` array (3 items), `mcpServers.recipe-tools` — **3/3**
- 3 Skill directories each with SKILL.md: `find` returns 3 (recipe-assistant, nutrition-calculator, menu-planner) — **3/3**
- MCP server `index.ts` defines 8 unique tools (recipe_search, recipe_get_document, recipe_edit, nutrition_analyze, nutrition_compare, menu_suggest, show_info_card, suggest_actions). `grep -c 'name:'` = 10 (≥6 required, some internal name: occurrences) — **3/3**
- `solution-register.service.ts` implements `OnApplicationBootstrap` (lines 1, 6) — **2/2**
- `context-layer-local.module.ts` has `@ApiTags('context')` (line 49) and `@Controller('context')` (line 50) with full `RecipeContextLayerController` class — **3/3**
- `referenceable.module.ts` calls `registry.register({type: 'recipe',...})` (line 21) and `registry.registerProvider('recipe', this.recipeProvider)` (line 29) — **3/3**
- `RecipeBrowseProvider` implements `EntityBrowseProvider` with `browse` (line 17), `search` (line 43), `resolve` (line 67) — **3/3**

P4 check: `solution.json` exists and is valid JSON. No penalty.
**Suggestion**: None.

### D5 Solution 完整性 (Weight: 20/100)
**Score: 20/20**
**Justification**:
- `package.json` has `@kedge-agentic/entity-document` (line 13) and `@kedge-agentic/context-layer` (line 12) as file: dependencies — **2/2**
- Recipe entity has 9 fields (id, title, cuisine, difficulty, prep_time, cook_time, servings, status, blocks). Column decorator count = 10 (1 PrimaryGeneratedColumn + 8 Column + 1 simple-json Column) — **2/2**
- `block-utils.ts` is exactly 15 lines (≤15 required), contains both `callout` and `ingredient` in RECIPE_CONFIG — **2/2**
- `seed.ts` creates 3 recipes via `repo.save(repo.create({...}))` — **2/2**
- Recipe 1 (鱼香肉丝) uses 7 distinct block types: section, text, ingredient, list, timeline, table, callout — **2/2**
- Published recipe exists: Recipe 3 (提拉米苏) at line 68 `status: 'published'` — **2/2**
- All tests pass: 25 tests across 3 files, 0 failures — **3/3**
- `tsc --noEmit` clean: no output — **2/2**
- Controller has `@ApiTags('recipes')` at line 7 of recipe.controller.ts — **1/1**
- `sessionTemplates.cooking.enabledSkills` contains all 3 skills: `["recipe-assistant", "nutrition-calculator", "menu-planner"]` — **2/2**

P5 check: `git diff --name-only -- solutions/business/edu-platform/` = empty. No penalty.
**Suggestion**: None.

## Penalties Applied
- None. All 5 penalty conditions checked clean.

## Score Summary

| Dimension | Scored | Max | Notes |
|-----------|--------|-----|-------|
| D1 TransformRegistry 自定义 | 20 | 20 | Full marks — 9 tests, clean round-trip, registry pattern correct |
| D2 Surgical Diff 正确性 | 16 | 20 | Missing frontmatter-only edit preservation test (-4) |
| D3 Dual Edit Path | 14 | 20 | Missing block_attr_set (-3) and block_content_set (-3) tests & implementation |
| D4 CCAAS 租户接入 | 20 | 20 | Full marks — solution.json, skills, MCP, browse provider all complete |
| D5 Solution 完整性 | 20 | 20 | Full marks — all tests pass, tsc clean, seed data correct |

Penalties: -0

总分: 90/100

## Bug Classification

For each deduction, classify:
- **[COMPONENT]** D2: Missing frontmatter-only edit test — fixable by adding a test in `recipe-provider.test.ts`
- **[COMPONENT]** D3: Missing `block_attr_set` op handler + test — fixable by extending `edit()` method and adding test
- **[COMPONENT]** D3: Missing `block_content_set` op handler + test — fixable by extending `edit()` method and adding test

## Actionable Fix Hints

For each [COMPONENT] deduction:

1. **D2 frontmatter-only preservation test** (-4 points)
   - File: `solutions/business/recipe-book/backend/src/__tests__/recipe-provider.test.ts`
   - Expected: A test named something like `'field_set: preserves all block attributes'` that calls `field_set` on title, then verifies saved blocks still contain `callout.color='warning'` and `ingredient.category='主料'`
   - Approach: Add test after the existing `field_set` tests (~line 59). Use `field_set` only (no `str_replace`), then inspect `mockService.update.mock.calls` to verify blocks are unchanged.

2. **D3 block_attr_set handler + test** (-3 points)
   - File: `solutions/business/recipe-book/backend/src/referenceable/providers/recipe.provider.ts` (lines 84-100)
   - Expected: Add `else if (op.op === 'block_attr_set')` branch in `edit()` that locates a block by index or type and sets an attribute (e.g., callout color)
   - File: `solutions/business/recipe-book/backend/src/__tests__/recipe-provider.test.ts`
   - Expected: Test `'block_attr_set: changes callout color'` that sends `{ op: 'block_attr_set', block_index: 2, attr: 'color', value: 'error' }` and verifies the attribute changed

3. **D3 block_content_set handler + test** (-3 points)
   - File: `solutions/business/recipe-book/backend/src/referenceable/providers/recipe.provider.ts` (lines 84-100)
   - Expected: Add `else if (op.op === 'block_content_set')` branch that locates a block and updates a specific content field
   - File: `solutions/business/recipe-book/backend/src/__tests__/recipe-provider.test.ts`
   - Expected: Test `'block_content_set: updates callout text'` that sends `{ op: 'block_content_set', block_index: 2, field: 'text', value: '新提示' }` and verifies content updated

## Top 3 Priority Fixes

1. **D2: Add frontmatter-only preservation test** (4 points) — `recipe-provider.test.ts`, add test that does `field_set` only and asserts saved blocks retain all original attributes (callout color, ingredient category). Lowest effort, highest ROI.
2. **D3: Implement block_attr_set** (3 points) — `recipe.provider.ts:84-100`, add new operation type in the `edit()` for-loop. Then add test. Requires defining the operation shape in types.
3. **D3: Implement block_content_set** (3 points) — Same location as #2. Add operation handler and test. These two can be implemented together.

## What's Working Well
1. **TransformRegistry customization** — The ingredientTransform with detect/serialize/deserialize and registry pattern is clean and well-tested (9 tests with full round-trip coverage). Do NOT change this.
2. **CCAAS integration layer** — The solution.json, context-layer-local.module.ts controller, browse provider, and referenceable module registration are comprehensive and correctly wired. The MCP server with 8 tools provides good coverage. Do NOT change this architecture.
