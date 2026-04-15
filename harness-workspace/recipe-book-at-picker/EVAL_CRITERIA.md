# Eval Criteria — recipe-book-at-picker

## 评分体系

5 个维度 × 20 分 = 100 分。每个 Check 有明确的检测方法（Playwright / grep / curl / tsc / build）。

---

### D1: Backend Entity Hierarchy (Weight: 20/100)

验证后端实体层级：recipe_section 注册、关系树、浏览/搜索/解析。

| Check | Points | Detection |
|-------|--------|-----------|
| `recipe_section` entity type registered | 3 | GET /context/entity-types → types array includes object with type='recipe_section' |
| Relation tree has recipe → recipe_section | 3 | GET /context/entity-types → tree.relations includes {parent:'recipe', child:'recipe_section'} |
| Browse recipes returns `hasChildren: true` | 3 | GET /context/browse?entity_type=recipe → items[0].hasChildren === true |
| Drill into recipe returns section blocks | 4 | GET /context/browse?entity_type=recipe_section&parent_type=recipe&parent_id={id} → items.length > 0 |
| Search finds recipe sections | 3 | GET /context/search?q=食材 → results include item with entityType='recipe_section' |
| Resolve recipe_section returns block data | 2 | GET /context/resolve?entity_type=recipe_section&entity_id={sectionId} → data with content |
| Existing recipe browse/search unchanged (backward compat) | 2 | GET /context/browse?entity_type=recipe still returns 3 recipes with correct fields |

**Penalty P1**: If `packages/context-layer/src/` has new changes → D1 = 0

### D2: Frontend @Picker Integration (Weight: 20/100)

验证前端 @Picker 组件集成：依赖、渲染、交互、contextEntity + autoRef。

| Check | Points | Detection |
|-------|--------|-----------|
| `@kedge-agentic/context-layer-react` in package.json | 2 | grep package.json for context-layer-react |
| MentionProvider wraps ChatInterface in split view | 2 | grep RecipeDetailPage.tsx for MentionProvider |
| MentionPicker renders with `contextEntity` + `autoRef` props | 3 | grep RecipeDetailPage.tsx for contextEntity and autoRef={true} |
| MentionPicker renders in split view chat panel | 3 | Playwright: open split view, type @, snapshot shows AtPicker |
| AtPicker shows "当前上下文" pinned section with recipe | 3 | Playwright: open picker in split view, verify "当前上下文" section with recipe name |
| AtPicker shows entity types (食谱, 章节) | 2 | Playwright: snapshot picker home view, verify both types listed |
| Drill into pinned context entity shows sections | 3 | Playwright: click drill ▶ on pinned recipe in "当前上下文", verify sections appear |
| MentionPicker also works on /chat page (no contextEntity) | 2 | Playwright: navigate /chat, type @, verify picker opens without "当前上下文" section |

**Penalty P2**: If `packages/chat-interface/src/` has new changes → D2 = 0
**Penalty P3**: If `packages/context-layer-react/src/` has new changes → D2 = 0

### D3: Context Injection (Weight: 20/100)

验证上下文注入：sessionContext、autoRef 自动 pill、引用 pill、@ 触发。

| Check | Points | Detection |
|-------|--------|-----------|
| sessionContext prop passed to ChatInterface in split view | 3 | grep RecipeDetailPage.tsx for sessionContext |
| sessionContext includes recipeId and recipeName | 2 | grep for recipeId in sessionContext object |
| autoRef auto-adds recipe pill on split view open (without user @-ing) | 4 | Playwright: open split view, verify ref pill appears automatically in composer area |
| Reference pills display correctly (icon + name + remove button) | 3 | Playwright: verify auto-added or manually-added pill has icon, name, × button |
| Picker opens on @ keypress in composer | 2 | Playwright: type @ in composer, verify picker opens |
| Picker closes on Escape | 2 | Playwright: press Escape, verify picker closed |
| Selected refs cleared after sending message | 2 | Playwright: evaluate MentionContext refs state after send |
| baseUrl points to :3002 (recipe backend, not core) | 2 | grep MentionPicker usage for RECIPE_BACKEND_URL or :3002 |

**Penalty P4**: If `packages/entity-document/src/` has new changes → D3 = 0

### D4: UX Quality (Weight: 20/100)

验证 AtPicker UX 交互质量：上下文区域、搜索、面包屑、autoRef pill 删除。

| Check | Points | Detection |
|-------|--------|-----------|
| Picker home with context shows "当前上下文" + type browse; /chat page shows only type browse | 3 | Playwright: compare picker home in split view vs /chat page |
| Picker search works (type recipe name) | 4 | Playwright: type "鱼香" in picker search, verify filtered results |
| Breadcrumb trail when drilling into recipe sections | 3 | Playwright: drill into recipe, verify breadcrumb path |
| Section items show meaningful display names (heading text) | 3 | Playwright: drill into recipe, verify section names like "食材准备" or "烹饪步骤" |
| Back button in drill-down works | 2 | Playwright: drill in, click back, verify returns to recipe list |
| Multiple refs can be added (auto-ref + manual) | 3 | Playwright: with auto-ref pill present, select another entity, verify 2 pills |
| Remove auto-ref pill stays removed | 2 | Playwright: click × on auto-added pill, verify removed and not re-added |

**Penalty P5**: If `solutions/business/edu-platform/` has new changes → D4 = 0

### D5: Build Quality (Weight: 20/100)

验证构建质量：TypeScript、Vite、测试、冻结约束。

| Check | Points | Detection |
|-------|--------|-----------|
| `tsc --noEmit` passes (frontend) | 3 | Run npx tsc --noEmit in frontend dir |
| `vite build` succeeds (frontend) | 3 | Run npx vite build in frontend dir |
| `tsc --noEmit` passes (backend) | 3 | Run npx tsc --noEmit in backend dir |
| Backend existing tests pass | 3 | Run npx vitest run in backend dir |
| No frozen package modifications | 3 | git diff on all frozen dirs shows no changes |
| file: links correct in package.json | 3 | grep package.json for file: links, verify paths resolve |
| Existing frontend features still work (recipe list, detail, chat) | 2 | Playwright: basic navigation — /recipes loads, /recipes/:id loads, /chat loads |

---

## Penalties

| ID | Condition | Effect |
|----|-----------|--------|
| P1 | `packages/context-layer/src/` modified | D1 = 0 |
| P2 | `packages/chat-interface/src/` modified | D2 = 0 |
| P3 | `packages/context-layer-react/src/` modified | D2 = 0 |
| P4 | `packages/entity-document/src/` modified | D3 = 0 |
| P5 | `solutions/business/edu-platform/` modified | D4 = 0 |
| P6 | Backend existing tests fail | D5 = 0 |
| P7 | Existing recipe browse/search endpoints broken | D1 = 0 |
