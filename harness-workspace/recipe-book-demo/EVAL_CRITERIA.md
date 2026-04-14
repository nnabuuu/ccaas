# Evaluation Criteria: Recipe Book Demo Solution

## Dimensions

### D1: TransformRegistry 自定义 (20/100)

| Check | Points | Detection |
|-------|--------|-----------|
| `recipe-registry.ts` exists with `ingredientTransform` | 2 | `grep 'ingredientTransform' solutions/business/recipe-book/backend/src/referenceable/recipe-registry.ts` |
| Transform uses `<!-- type:ingredient` marker | 2 | `grep 'type:ingredient' solutions/business/recipe-book/backend/src/referenceable/recipe-registry.ts` |
| Transform implements detect/serialize/deserialize | 3 | grep for all 3 method names |
| Registry via `TransformRegistry.withDefaults()` + `register('ingredient', ...)` | 3 | `grep 'withDefaults' solutions/business/recipe-book/backend/src/referenceable/recipe-registry.ts` AND `grep "register.*ingredient" ...` |
| ingredient-transform.test.ts exists with ≥6 passing tests | 5 | vitest output |
| Round-trip: serialize → deserialize identical | 3 | test file check — grep for 'round-trip' or 'roundtrip' or serialize→deserialize flow |
| detectTransform correctly identifies ingredient lines | 2 | test file check — grep for 'detect' in test |

**Penalty P1**: If `packages/entity-document/src/` modified → D1 = 0

### D2: Surgical Diff 正确性 (20/100)

| Check | Points | Detection |
|-------|--------|-----------|
| Tests verify str_replace preserves callout color attribute | 4 | grep test files for 'callout' AND 'color' AND 'str_replace' |
| Tests verify str_replace preserves ingredient category attribute | 4 | grep test files for 'ingredient' AND 'category' AND 'str_replace' |
| Tests verify frontmatter-only edit preserves ALL attributes | 4 | grep test files for 'frontmatter' or 'meta' AND 'str_replace' |
| str_replace uses recipeRegistry (not defaultRegistry) | 4 | grep recipe.provider.ts for `recipeRegistry` in edit/strReplace call path |
| Tests verify cross-block replacement preserves surrounding attributes | 4 | grep test files for 'cross-block' or 'surrounding' or 'preserve' |

**Penalty P2**: If `packages/context-layer/src/core/` modified → D2 = 0

### D3: Dual Edit Path (20/100)

| Check | Points | Detection |
|-------|--------|-----------|
| RecipeProvider extends DocumentEditProvider | 2 | `grep 'extends DocumentEditProvider' solutions/business/recipe-book/backend/src/referenceable/providers/recipe.provider.ts` |
| 5 abstract methods implemented (loadEntity, saveEntity, toEntityDocument, getEditableFields, getContentToAttrConfig) | 4 | grep count for all 5 method names |
| validateEdit rejects published recipes | 2 | grep for 'published' in recipe.provider.ts |
| Test: field_set changes metadata | 3 | grep test file for 'field_set' |
| Test: str_replace modifies content | 3 | grep test file for 'str_replace' |
| Test: block_attr_set changes attribute | 3 | grep test file for 'block_attr_set' |
| Test: block_content_set updates content field | 3 | grep test file for 'block_content_set' |

**Penalty P3**: If DocumentEditProvider not imported from `@kedge-agentic/context-layer` → D3 = 0

### D4: CCAAS 租户接入 (20/100)

| Check | Points | Detection |
|-------|--------|-----------|
| solution.json exists with correct schemaVersion/tenant/skills/mcpServers | 3 | file exists + JSON parse + grep for schemaVersion, tenant.slug, skills array |
| 3 Skill directories each with SKILL.md | 3 | `find solutions/business/recipe-book/skills -name SKILL.md \| wc -l` = 3 |
| MCP server index.ts defines ≥6 tools | 3 | `grep -c "name:" solutions/business/recipe-book/mcp-server/src/index.ts` ≥ 6 |
| solution-register.service.ts implements OnApplicationBootstrap | 2 | `grep 'OnApplicationBootstrap' solutions/business/recipe-book/backend/src/solution-register.service.ts` |
| context-layer-local.module.ts with local controller | 3 | grep for Controller class + @ApiTags in that file |
| referenceable.module.ts registers recipe entity type + provider | 3 | grep for `registry.register` AND `registerProvider` |
| RecipeBrowseProvider implements EntityBrowseProvider (browse/search/resolve) | 3 | grep for all 3 method names in browse provider file |

**Penalty P4**: If solution.json missing or invalid JSON → D4 = 0

### D5: Solution 完整性 (20/100)

| Check | Points | Detection |
|-------|--------|-----------|
| package.json has entity-document + context-layer file: deps | 2 | `grep 'entity-document' solutions/business/recipe-book/backend/package.json` AND `grep 'context-layer'` |
| Recipe entity has all 8 required fields (id, title, cuisine, difficulty, prep_time, cook_time, servings, status, blocks) | 2 | grep entity file for all column names |
| block-utils.ts ≤15 lines with callout + ingredient in config | 2 | `wc -l < .../block-utils.ts` ≤ 15 AND `grep 'callout' ...` AND `grep 'ingredient' ...` |
| seed.ts creates 3 recipes | 2 | grep for recipe count or 3 insert operations |
| Recipe 1 uses ≥7 distinct block types | 2 | inspect seed for section, text, ingredient, list, timeline, table, callout |
| Published recipe exists in seed | 2 | `grep 'published' solutions/business/recipe-book/backend/src/seed.ts` |
| All tests pass | 3 | vitest output |
| tsc --noEmit clean | 2 | tsc output |
| Controller has @ApiTags | 1 | `grep 'ApiTags' solutions/business/recipe-book/backend/src/recipe/recipe.controller.ts` |
| sessionTemplates.cooking.enabledSkills has all 3 skills | 2 | JSON parse solution.json, check enabledSkills array contains recipe-assistant, nutrition-calculator, menu-planner |

**Penalty P5**: If `solutions/business/edu-platform/` modified → D5 = 0

## Penalty Summary

| ID | Trigger | Impact |
|----|---------|--------|
| P1 | entity-document src modified | D1 → 0 |
| P2 | context-layer core modified | D2 → 0 |
| P3 | DocumentEditProvider not from context-layer | D3 → 0 |
| P4 | solution.json missing or invalid JSON | D4 → 0 |
| P5 | edu-platform modified | D5 → 0 |

## Score Format

The evaluator MUST output the total score in this exact format:
```
总分: XX/100
```
