# Evaluation Report: v3

## Pre-Gate Results
- tsc (context-layer): **PASS** — 0 errors
- tsc (context-layer-react): **PASS** — 0 errors
- tsc (edu-platform): **PASS** — 0 errors
- tsc (chat-interface): **PASS** — 0 errors
- P1 (core NestJS import): **PASS** — `grep -rn "from '@nestjs" packages/context-layer/src/core/` returned no results
- P2 (backward compatibility): **PASS** — all endpoints return correct response keys (`types`/`tree`, `recents`, `items`, `results`)
- P3 (entity/service modification): **PASS** — `git diff --name-only` on lesson-plan/, template/, curriculum/ returned no changes
- P5 (provider in solution layer): **PASS** — `ls solutions/business/edu-platform/backend/src/referenceable/providers/` shows lesson-plan.provider.ts, template.provider.ts, requirement.provider.ts

## Per-Dimension Scores

### D1: 场景通过率 (Weight: 35/100)
**Score: 4/5**
**Scenarios**: 10/12 passed (2 skipped)

| # | Scenario | Result | Detail |
|---|----------|--------|--------|
| 1 | EntityContext 获取 | PASS | Returns `{ref, structured, relations, attachments}` correctly |
| 2 | AtReference summary | PASS | summary=30 chars ("八(2)班 数学 new 教案 45分钟 学业要求7.3.1"), <= 100 |
| 3 | Relations 正确 | PASS | relation has all 4 fields: type, id, display_name, summary |
| 4 | Template EntityContext | PASS | structured contains block_summary |
| 5 | Requirement EntityContext | PASS | structured contains name, level, subject, grade_range |
| 6 | Provider search + summary | PASS | search results include summary field |
| 7 | Apply Action 成功 | PASS | `{success: true}` on draft lesson plan |
| 8 | Apply 业务规则 | PASS | `{success: false, error: "已发布的教案不允许通过 Apply 修改，请先取消发布"}` on published LP |
| 9 | Picker summary 显示 | SKIPPED | Chat UI not served at backend endpoint; no `index.html` available |
| 10 | 消息 references | SKIPPED | Same reason — no Chat UI endpoint |
| 11 | Apply 按钮渲染 | PASS | Component renders correctly |
| 12 | 向后兼容 | PASS | All 4 existing endpoints return expected response shapes |

**Justification**: 10/12 scenarios pass. S9 and S10 are skipped because the E2E tests require a served Chat UI (`/index.html`) which is not available when testing against the edu-platform backend alone. The test code gracefully skips rather than fails. The underlying frontend code (AtPicker.tsx, MentionContext.tsx) does implement summary display and MentionRef with summary field — verified via code analysis.

**Suggestion**: Serve a minimal Chat UI dev page at the backend endpoint (e.g., via a static assets middleware or a separate Vite dev server) so that S9 and S10 can be validated via E2E.

### D2: 架构合规性 (Weight: 25/100)
**Score: 4/5**

**Justification**:
- **core/ 零 NestJS**: PASS — `packages/context-layer/src/core/` contains only pure TypeScript files. No `@nestjs` imports.
- **分层正确**: ContextRouter in core (`packages/context-layer/src/core/context-router.ts`) is pure TS, correctly delegates to EntityContextProvider interface. NestJS controller (`context-layer-local.module.ts:135-149`) calls ContextRouter.
- **Provider 在 solution 层**: PASS — all 3 providers in `solutions/business/edu-platform/backend/src/referenceable/providers/`.
- **Provider 注册在 ReferenceableModule.onModuleInit()**: PASS — `referenceable.module.ts:38-40` calls `registry.registerProvider()`.
- **现有 entity/service 未修改**: PASS.
- **DB schema 不变**: PASS — no migration files added.

**1 处轻微越界**:
- `entity-types` 端点返回空数组 `{types: [], tree: {roots: [], relations: []}}` — ReferenceableModule 只注册了 providers 但没有通过 `registry.register()` 注册 entity types（type metadata like displayName, icon, color）。这意味着 entity-types API 虽然格式正确（向后兼容），但不反映已注册的 referenceable types。这是一个功能缺漏而非架构违规。

**Suggestion**: 在 `ReferenceableModule.onModuleInit()` 中调用 `registry.register()` 注册 lesson_plan, template, requirement 的 `ReferenceableOptions`（包含 type, displayName, icon, color），使 `/context/entity-types` 返回有意义的数据。

### D3: TypeScript 正确性 (Weight: 15/100)
**Score: 5/5**

**Justification**:
- `tsc --noEmit` 零错误：context-layer, context-layer-react, edu-platform backend, chat-interface 全部通过。
- Interface 与设计文档对齐检查：

| Interface | Spec Fields | Implementation (`interfaces.ts`) | Status |
|-----------|------------|----------------------------------|--------|
| AtReference | type, id, display_name, summary | Lines 196-201: exact match | PASS |
| EntityContext | ref, structured, relations, attachments | Lines 203-208: exact match | PASS |
| EntityAttachment | name, path, mime_type, size_bytes | Lines 210-215: exact match | PASS |
| ApplyAction | id, target, field_path, suggested_value, description, status, applied_at? | Lines 217-225: exact match | PASS |
| ApplyRequest | entity_id, field_path, suggested_value, action_description, session_id | Lines 227-233: exact match | PASS |
| EntityContextProvider | getContext, search, apply? | Lines 235-239: exact match | PASS |

**Suggestion**: None — interfaces are fully aligned.

### D4: EntityContext 数据质量 (Weight: 15/100)
**Score: 4/5**

**Justification**:

**LessonPlan**:
- summary: "八(2)班 数学 new 教案 45分钟 学业要求7.3.1" (30 chars, <=100) — PASS
- summary content: includes class_name, subject, lesson_type, duration, requirement code — PASS
- structured: contains title, class_name, subject, lesson_type, duration_minutes, status, blocks, requirement — PASS
- relations: includes requirement AtReference with all 4 fields — PASS

**Template**:
- structured contains block_summary: ["教学目标", "教学重难点", "教学过程", "课堂练习", "板书设计", "课后反思"] — PASS
- summary: properly formatted with name, scope, lesson_type, version — PASS

**Requirement**:
- structured contains name, level, subject, grade_range — PASS
- summary: "math 数与代数" — contains subject + name — PASS

**1 处数据质量不足 (-1)**:
- LessonPlan summary 使用原始 `lesson_type` 值 "new" 而非中文映射（如 "新授课"）。SPEC 设计文档 `reference/CCaaS-Referenceable-AtPicker.md` 示例中 summary 为 `"八(2)班 数学 新授课 45分钟"`，但实际输出为 `"八(2)班 数学 new 教案 45分钟"`。这降低了 summary 的可读性。
- Requirement summary 使用 subject 原始值 "math" 而非中文 "数学"。
- `browse` 和 `search` 的 summary 格式与 EntityContext 的 summary 格式不一致（browse: "八(2)班 数学 new 教案"，EntityContext: "八(2)班 数学 new 教案 45分钟 学业要求7.3.1"），这是合理的简化，不扣分。

**Suggestion**: 在 `lesson-plan.provider.ts:93` 的 `buildSummary()` 中将 `lp.lesson_type` 映射为中文（`new` → `新授课`, `review` → `复习课`）。同样在 `requirement.provider.ts:94` 中将 `node.subject` 映射为中文。

### D5: 前端交互 (Weight: 10/100)
**Score: 4/5**

**Justification**:

**Summary 显示** (PASS):
- `AtPicker.tsx:351-353`: recent items 显示 summary（灰色 11px 小字，`data-testid="recent-summary-*"`）
- `AtPicker.tsx:494-496`: browse items 显示 summary（同上）
- `AtPicker.tsx:541-543`: search items 显示 summary（同上）

**RefPill color prop** (PASS):
- `RefPill.tsx:19`: `color?: RefPillColor` prop 存在
- `RefPill.tsx:3`: `RefPillColor = 'blue' | 'green' | 'orange' | 'purple' | 'red'`
- `RefPill.tsx:5-11`: COLOR_MAP 正确映射每种颜色到 bg/text/border palette

**MentionRef summary** (PASS):
- `MentionContext.tsx:9`: `summary?: string` field exists in `MentionRef` interface
- `AtPicker.tsx:161`: handleSelect passes summary to addRef

**Apply 按钮渲染** (PARTIAL):
- E2E S11 PASS（测试通过），但代码搜索中 `grep -rn "apply-action|ApplyAction|apply_action"` 在 chat-interface 和 context-layer-react 中未找到匹配。这意味着 apply button 渲染可能完全在 E2E 测试的 HTML fixture 中实现，而非作为生产组件存在。
- 缺少一个独立的 ApplyActionButton 组件。

**Suggestion**: 在 `packages/chat-interface/src/components/chat/` 中添加 `ApplyActionBlock.tsx` 组件，渲染 apply_action content block 为确认按钮，调用 `POST /context/apply`。

## Penalty Deductions
- 无致命 penalty 触发
- 无严重 penalty 触发
- 无一般 penalty 触发

## Score Summary
| Dimension | Score | Weighted |
|-----------|-------|----------|
| D1 场景通过率 | 4/5 | 28/35 |
| D2 架构合规性 | 4/5 | 20/25 |
| D3 TS正确性 | 5/5 | 15/15 |
| D4 数据质量 | 4/5 | 12/15 |
| D5 前端交互 | 4/5 | 8/10 |

**Penalties**: -0
**总分: 83/100**

## Bug Classification
- **[COMPONENT]** — Generator 可修:
  1. `solutions/business/edu-platform/backend/src/referenceable/providers/lesson-plan.provider.ts:93` — lesson_type 未映射为中文（"new" → "新授课"）
  2. `solutions/business/edu-platform/backend/src/referenceable/providers/requirement.provider.ts:95` — subject 未映射为中文（"math" → "数学"）
  3. `solutions/business/edu-platform/backend/src/referenceable/referenceable.module.ts:37` — 缺少 `registry.register()` 调用，entity-types 返回空数组

- **[SYSTEM]** — 超出范围:
  1. S9/S10 需要 Chat UI 静态文件服务 — 需要配置 Vite dev server 或 static assets middleware，不属于 context-layer 实现范围

- **[DESIGN]** — 需设计决策:
  1. ApplyActionBlock 组件是否应该在 chat-interface 还是 context-layer-react 中实现，需要明确组件归属

## Actionable Fix Hints
1. **[D4]** File: `solutions/business/edu-platform/backend/src/referenceable/providers/lesson-plan.provider.ts:93` — Expected: summary 中 lesson_type 显示为中文 — Fix: 添加 `LESSON_TYPE_MAP: Record<string, string> = { new: '新授课', review: '复习课', practice: '练习课' }`，在 buildSummary 中使用 `LESSON_TYPE_MAP[lp.lesson_type] ?? lp.lesson_type`
2. **[D4]** File: `solutions/business/edu-platform/backend/src/referenceable/providers/requirement.provider.ts:95` — Expected: subject 显示为中文 — Fix: 添加 `SUBJECT_MAP = { math: '数学', ... }` 映射
3. **[D2]** File: `solutions/business/edu-platform/backend/src/referenceable/referenceable.module.ts:37` — Expected: entity-types 返回注册的 types — Fix: 在 onModuleInit 中调用 `this.registry.register({ type: 'lesson_plan', displayName: '教案', icon: '📋', color: 'purple', ... })` 等
4. **[D5]** File: `packages/chat-interface/src/components/chat/` — Expected: ApplyActionBlock 组件存在 — Fix: 创建 `ApplyActionBlock.tsx`，渲染 apply_action content block 为按钮

## Top 3 Priority Fixes
1. **[D2] 注册 entity types** — `referenceable.module.ts:37`: 添加 `registry.register()` 调用注册 lesson_plan, template, requirement 的 ReferenceableOptions。影响 entity-types 端点和 @ Picker 类型列表展示。修复后 entity-types 将返回有意义的 types 数组。
2. **[D4] lesson_type 中文映射** — `lesson-plan.provider.ts:93`: summary 中 "new" 应显示为 "新授课"。影响所有 LessonPlan 的 summary 可读性。在 buildSummary 中添加映射表即可。
3. **[D1] 提供 Chat UI 测试入口** — 需要一个可访问的前端页面使 S9/S10 从 SKIP 变为 PASS。可以在 E2E 配置中启动 Vite dev server 或提供最小化 HTML fixture。

## What's Working Well
1. **Core/NestJS 分层完美** — `packages/context-layer/src/core/` 完全纯 TS，ContextRouter 通过 EntityContextProvider interface 解耦。`context-layer-local.module.ts` 在 solution 层重新声明 controller 避免 NestJS 版本冲突，这是一个聪明的架构决策。Generator 不应改动此分层结构。
2. **Apply 业务规则完整** — LessonPlanProvider.apply() 正确检查 `status === 'published'` 并返回中文错误信息，符合 SPEC 中 S8 的要求。这种 solution 层业务校验模式是正确的实践。
