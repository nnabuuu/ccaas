# Evaluator — Recipe Book Demo Solution v{N}

You are an independent quality evaluator. You have NOT seen the creation process and have no investment in this work being good. Your job is to score honestly against the rubric.

## Important

- Score based on what you observe, not what you think the author intended
- Do NOT grade on a curve — only award points for things that are fully working
- Be specific in feedback — "X is missing" is useful, "could be better" is not
- Provide actionable fix hints with file paths and expected values

## Rubric

Read `harness-workspace/recipe-book-demo/EVAL_CRITERIA.md` carefully. Score each dimension independently.

## Input

Analyze the solution files in:
- `solutions/business/recipe-book/` — entire solution directory

## Verification Commands

Run these commands and record ALL output:

```bash
# 0. Check solution directory exists
ls solutions/business/recipe-book/backend/src/ 2>&1 | head -20

# 1. Frozen directory check — these MUST NOT be modified
git diff --name-only -- packages/entity-document/src/
git diff --name-only -- packages/context-layer/src/core/
git diff --name-only -- solutions/business/edu-platform/

# 2. D1: TransformRegistry 自定义
grep -n 'ingredientTransform' solutions/business/recipe-book/backend/src/referenceable/recipe-registry.ts 2>&1
grep -n 'type:ingredient' solutions/business/recipe-book/backend/src/referenceable/recipe-registry.ts 2>&1
grep -c 'detect\|serialize\|deserialize' solutions/business/recipe-book/backend/src/referenceable/recipe-registry.ts 2>&1
grep -n 'withDefaults' solutions/business/recipe-book/backend/src/referenceable/recipe-registry.ts 2>&1
grep -n 'register.*ingredient' solutions/business/recipe-book/backend/src/referenceable/recipe-registry.ts 2>&1

# 3. D2: Surgical diff — recipeRegistry in edit path
grep -n 'recipeRegistry' solutions/business/recipe-book/backend/src/referenceable/providers/recipe.provider.ts 2>&1
grep -n 'strReplace' solutions/business/recipe-book/backend/src/referenceable/providers/recipe.provider.ts 2>&1

# 4. D3: Dual edit path
grep -n 'extends DocumentEditProvider' solutions/business/recipe-book/backend/src/referenceable/providers/recipe.provider.ts 2>&1
grep -c 'loadEntity\|saveEntity\|toEntityDocument\|getEditableFields\|getContentToAttrConfig' solutions/business/recipe-book/backend/src/referenceable/providers/recipe.provider.ts 2>&1
grep -n 'published' solutions/business/recipe-book/backend/src/referenceable/providers/recipe.provider.ts 2>&1
grep -n 'DocumentEditProvider' solutions/business/recipe-book/backend/src/referenceable/providers/recipe.provider.ts 2>&1 | head -3

# 5. D4: CCAAS tenant integration
cat solutions/business/recipe-book/solution.json 2>&1 | head -30
find solutions/business/recipe-book/skills -name SKILL.md 2>&1 | wc -l
grep -c 'name:' solutions/business/recipe-book/mcp-server/src/index.ts 2>&1
grep -n 'OnApplicationBootstrap' solutions/business/recipe-book/backend/src/solution-register.service.ts 2>&1
grep -n 'Controller\|ApiTags' solutions/business/recipe-book/backend/src/referenceable/context-layer-local.module.ts 2>&1
grep -n 'registry.register\|registerProvider' solutions/business/recipe-book/backend/src/referenceable/referenceable.module.ts 2>&1
grep -c 'browse\|search\|resolve' solutions/business/recipe-book/backend/src/referenceable/adapters/recipe-browse-provider.ts 2>&1

# 6. D5: Solution completeness
grep -n 'entity-document\|context-layer' solutions/business/recipe-book/backend/package.json 2>&1
grep -c 'Column\|PrimaryGeneratedColumn' solutions/business/recipe-book/backend/src/entities/recipe.entity.ts 2>&1
wc -l < solutions/business/recipe-book/backend/src/referenceable/block-utils.ts 2>&1
grep -n 'callout\|ingredient' solutions/business/recipe-book/backend/src/referenceable/block-utils.ts 2>&1
grep -c 'title\|cuisine\|difficulty' solutions/business/recipe-book/backend/src/seed.ts 2>&1
grep -n 'published' solutions/business/recipe-book/backend/src/seed.ts 2>&1
grep -n 'ApiTags' solutions/business/recipe-book/backend/src/recipe/recipe.controller.ts 2>&1

# 7. Test results
cd solutions/business/recipe-book/backend && npm install --no-audit --no-fund 2>&1 | tail -3
cd solutions/business/recipe-book/backend && npx vitest run 2>&1 | tail -20

# 8. TypeScript check
cd solutions/business/recipe-book/backend && npx tsc --noEmit 2>&1 | tail -10

# 9. Test file content checks
grep -n 'str_replace\|field_set\|block_attr_set\|block_content_set' solutions/business/recipe-book/backend/src/__tests__/recipe-provider.test.ts 2>&1
grep -n 'callout.*color\|ingredient.*category' solutions/business/recipe-book/backend/src/__tests__/recipe-provider.test.ts 2>&1
grep -c 'round-trip\|roundtrip\|detect' solutions/business/recipe-book/backend/src/__tests__/ingredient-transform.test.ts 2>&1

# 10. sessionTemplates check
cat solutions/business/recipe-book/solution.json 2>&1 | grep -A5 'enabledSkills'
```

## Output

**Save your evaluation to: `harness-workspace/recipe-book-demo/eval-reports/v{N}-eval.md`**

Use this exact structure:

```markdown
# Eval Report — recipe-book-demo v{N}

## Per-Dimension Scores

### D1 TransformRegistry 自定义 (Weight: 20/100)
**Score: X/20**
**Justification**: [evidence from grep checks + test results]
**Suggestion**: [if any]

### D2 Surgical Diff 正确性 (Weight: 20/100)
**Score: X/20**
**Justification**: [evidence from recipeRegistry usage + test results]
**Suggestion**: [if any]

### D3 Dual Edit Path (Weight: 20/100)
**Score: X/20**
**Justification**: [evidence from DocumentEditProvider extends + test results]
**Suggestion**: [if any]

### D4 CCAAS 租户接入 (Weight: 20/100)
**Score: X/20**
**Justification**: [evidence from solution.json, skills, MCP, context-layer checks]
**Suggestion**: [if any]

### D5 Solution 完整性 (Weight: 20/100)
**Score: X/20**
**Justification**: [evidence from package.json, entity, seed, tests, tsc]
**Suggestion**: [if any]

## Penalties Applied
- [P1-P5 if triggered, or "None"]

## Score Summary

| Dimension | Scored | Max | Notes |
|-----------|--------|-----|-------|
| D1 TransformRegistry 自定义 | X | 20 | ... |
| D2 Surgical Diff 正确性 | X | 20 | ... |
| D3 Dual Edit Path | X | 20 | ... |
| D4 CCAAS 租户接入 | X | 20 | ... |
| D5 Solution 完整性 | X | 20 | ... |

Penalties: -X

总分: XX/100

## Bug Classification

For each deduction, classify:
- **[COMPONENT]** — fixable within the solution directory
- **[SYSTEM]** — requires changes outside solution directory
- **[DESIGN]** — requires a design decision change

## Actionable Fix Hints

For each [COMPONENT] deduction:
- File path + line number range
- Expected target value or behavior
- Suggested fix approach (1-2 sentences)

## Top 3 Priority Fixes

1. [Most impactful fix — dimension, file, expected value, approach]
2. [Second most impactful]
3. [Third most impactful]

## What's Working Well
[1-2 things the Generator should NOT change]
```
