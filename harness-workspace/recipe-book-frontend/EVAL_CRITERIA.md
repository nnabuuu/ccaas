# Eval Criteria — recipe-book-frontend

## 评分体系

5 个维度 × 20 分 = 100 分。每个 Check 有明确的检测方法（Playwright / grep / tsc / build）。

---

### D1: App Shell + Navigation (Weight: 20/100)

验证前端应用骨架：路由、侧边栏、TopNav 响应式。

| Check | Points | Detection |
|-------|--------|-----------|
| Frontend at :5291 loads without errors | 2 | Playwright navigate + snapshot |
| Sidebar with "食谱助手" title + 2 nav links (食谱列表/AI 对话) | 3 | Playwright snapshot sidebar content |
| Active nav indicator (background or left bar) on current route | 2 | Playwright navigate to /recipes, check active state |
| TopNav visible on mobile (< 1200px), hidden on desktop | 2 | Playwright resize to 375px + snapshot, then 1400px + snapshot |
| `/recipes` route renders RecipeListPage | 3 | Playwright navigate + snapshot |
| `/recipes/:id` route renders RecipeDetailPage | 3 | Playwright navigate to first recipe + snapshot |
| `/chat` route renders ChatPage | 3 | Playwright navigate + snapshot |
| CSS variables used (no hardcoded colors in components) | 2 | grep for `var(--` in .tsx files ≥ 10 occurrences |

**Penalty P1**: If `packages/chat-interface/src/` has new changes → D1 = 0

### D2: Recipe List Page (Weight: 20/100)

验证食谱列表页：数据展示、搜索、交互。

| Check | Points | Detection |
|-------|--------|-----------|
| 3 seed recipes displayed (鱼香肉丝, 番茄炒蛋, 提拉米苏) | 4 | Playwright snapshot page, verify 3 recipe titles present |
| Each card shows title + cuisine + difficulty | 3 | Playwright evaluate: check card DOM has all 3 fields |
| Status badges (draft/published) with visual distinction | 2 | Playwright snapshot, look for status text with distinct styling |
| Search/filter input filters by title | 3 | Playwright type "鱼香" in search, verify only 1 result |
| Click recipe card navigates to `/recipes/:id` | 3 | Playwright click first card, verify URL changed |
| API calls go to :3002 (not :3001) | 3 | Playwright network requests filter for localhost:3002/api/recipes |
| Loading state shown while fetching | 2 | Playwright evaluate: check for loading indicator or skeleton |

**Penalty P2**: If `solutions/business/recipe-book/backend/` has new changes → D2 = 0

### D3: Recipe Detail + Block Viewer (Weight: 20/100)

验证食谱详情页：元数据展示 + Block 类型渲染。

| Check | Points | Detection |
|-------|--------|-----------|
| Detail page shows recipe title + metadata (cuisine, difficulty, times, servings) | 3 | Playwright navigate to recipe detail, snapshot metadata |
| Context document fetched from :3002/context/entity/recipe/{id}/document | 2 | Playwright network requests verify document fetch |
| Section blocks rendered as headings (h2/h3) | 2 | Playwright evaluate: check for heading elements |
| Ingredient blocks rendered as structured list (items with name/amount/unit) | 3 | Playwright snapshot detail page, verify ingredient items visible |
| Callout blocks rendered with visual distinction (background color or border) | 2 | Playwright evaluate: check callout styling |
| Timeline or table blocks rendered | 2 | Playwright evaluate: check for table/timeline elements |
| Metadata sidebar or section (prep_time, cook_time, servings) | 2 | Playwright snapshot, verify time/servings metadata |
| Back navigation link/button to /recipes | 2 | Playwright click back, verify URL = /recipes |
| Published recipe shows read-only indicator | 2 | Playwright navigate to 提拉米苏 (published), check for indicator |

**Penalty P3**: If `packages/entity-document/src/` has new changes → D3 = 0

### D4: Chat Integration (Weight: 20/100)

验证 ChatInterface + ChatSidebar 集成。

| Check | Points | Detection |
|-------|--------|-----------|
| ChatInterface renders on /chat | 3 | Playwright navigate /chat, snapshot shows chat UI |
| serverUrl points to :3001 | 2 | grep config.ts for `3001`, Playwright network requests to :3001 |
| tenantId = "recipe-book" | 2 | grep config.ts for `recipe-book` |
| sessionTemplate = "cooking" | 2 | grep for `sessionTemplate.*cooking` |
| apiKey present in config.ts | 2 | grep config.ts for `sk-default-test` |
| ChatSidebar renders with session list | 3 | Playwright snapshot /chat, verify sidebar area present |
| Split View: click "与 AI 讨论" opens chat panel alongside recipe (not navigate away) | 3 | Playwright click button, verify chat panel + recipe both visible |
| Custom welcome message or empty state | 3 | Playwright navigate /chat with fresh session, check for welcome text |

**Penalty P4**: If `solutions/business/edu-platform/` has new changes → D4 = 0

### D5: Build Quality + Design (Weight: 20/100)

验证构建质量和设计规范合规。

| Check | Points | Detection |
|-------|--------|-----------|
| `tsc --noEmit` passes (0 errors) | 3 | Run tsc in frontend dir |
| `vite build` succeeds | 3 | Run vite build in frontend dir |
| `file:` links in package.json for @kedge-agentic/* deps | 2 | grep package.json for `file:` |
| `design-tokens.css` with light + dark mode tokens | 2 | grep design-tokens.css for `prefers-color-scheme: dark` |
| No hardcoded colors in .tsx files (#xxx, rgb, rgba) | 2 | grep `.tsx` files for hardcoded color patterns |
| Border-radius convention (no arbitrary values, use design tokens) | 2 | grep `.tsx` files for `borderRadius` or `rounded-` |
| No box-shadow in components (only border transitions) | 2 | grep `.tsx` files for `box-shadow\|shadow-` |
| Plus Jakarta Sans font in body CSS | 2 | grep index.css for `Plus Jakarta Sans` |
| config.ts has correct URLs (:3002 for recipes, :3001 for chat) | 2 | grep config.ts for both ports |

**Penalty P5**: If backend tests fail (vitest run in recipe-book/backend/) → D5 = 0

---

## Penalties

| ID | Trigger | Impact |
|----|---------|--------|
| P1 | `packages/chat-interface/src/` has new changes | D1 → 0 |
| P2 | `solutions/business/recipe-book/backend/` has new changes | D2 → 0 |
| P3 | `packages/entity-document/src/` has new changes | D3 → 0 |
| P4 | `solutions/business/edu-platform/` has new changes | D4 → 0 |
| P5 | Backend tests fail (`cd solutions/business/recipe-book/backend && npx vitest run`) | D5 → 0 |

---

## Score Format

评分报告必须以如下格式结尾（用于 harness.sh 正则提取）：

```
总分: XX/100
```
