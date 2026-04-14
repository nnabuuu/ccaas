# v1 Changelog

## 改动文件
- `frontend/package.json` — Project dependencies with file: links to monorepo packages
- `frontend/vite.config.ts` — Vite config, port 5291
- `frontend/tsconfig.json` — TypeScript config (bundler moduleResolution)
- `frontend/tailwind.config.js` — Tailwind with CSS var bridge for chat-interface
- `frontend/postcss.config.js` — PostCSS with tailwind + autoprefixer
- `frontend/index.html` — SPA entry point
- `frontend/src/styles/design-tokens.css` — Copied from edu-platform (light/dark tokens)
- `frontend/src/index.css` — Tailwind directives + chat-interface overrides + composer styling
- `frontend/src/vite-env.d.ts` — Vite type reference
- `frontend/src/config.ts` — RECIPE_BACKEND_URL(:3002), CCAAS_URL(:3001), TENANT_ID, SESSION_TEMPLATE, API_KEY
- `frontend/src/components/layout/nav-config.ts` — NavRoute array (食谱列表, AI 对话)
- `frontend/src/components/layout/Sidebar.tsx` — Fixed 232px sidebar, desktop only (≥1200px), active indicator
- `frontend/src/components/layout/TopNav.tsx` — Mobile nav bar (< 1200px), 48px height
- `frontend/src/types/recipe.ts` — Recipe, Block, IngredientItem interfaces
- `frontend/src/hooks/useRecipes.ts` — useRecipes(q?) and useRecipe(id) fetch hooks
- `frontend/src/pages/RecipeListPage.tsx` — Recipe grid with search, status badges, card click → detail
- `frontend/src/pages/RecipeDetailPage.tsx` — Recipe detail with all 7 block type renderers
- `frontend/src/pages/ChatPage.tsx` — ChatInterface + ChatSidebar integration
- `frontend/src/App.tsx` — Routes (/, /recipes, /recipes/:id, /chat) + PageWrapper
- `frontend/src/main.tsx` — React 18 entry point with BrowserRouter

## 对应维度
- D1: Full project scaffolding from scratch — all config files, dependencies, build pipeline
- D2: Design system parity with edu-platform — copied design-tokens.css, CSS var-only styling
- D3: Responsive layout — Sidebar (desktop ≥1200px) + TopNav (mobile <1200px) + PageWrapper
- D4: Recipe list page with search, status badges, grid layout
- D5: Recipe detail page with all 7 block type renderers (section, text, ingredient, list, timeline, table, callout)
- D6: ChatInterface + ChatSidebar integration with CCAAS core
- D7: Build verification — tsc --noEmit + vite build both pass, backend tests (49/49) pass

## 本轮重点
从零构建完整的 recipe-book 前端应用，包含项目脚手架、设计系统、响应式布局、食谱列表/详情页（含7种Block渲染器）、AI对话页，全部通过 TypeScript 和 Vite 构建验证。
