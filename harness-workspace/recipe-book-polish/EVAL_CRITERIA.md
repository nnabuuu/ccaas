# Eval Criteria — recipe-book-polish (UX/Color Fix)

## 评分体系

5 个维度 × 20 分 = 100 分。每个 Check 有明确的检测方法（Playwright computed style / grep / bash）。

---

### D1: AtPicker Theme Integration (Weight: 20/100)

验证 AtPicker 的颜色已被 override 为暖色调 design tokens。

| Check | Points | Detection |
|-------|--------|-----------|
| AtPicker container background uses design token (not hardcoded white) | 3 | Playwright: open picker, evaluate computed background-color of picker overlay |
| AtPicker select/primary button uses warm color (not #1a73e8) | 3 | Playwright: evaluate computed color of select buttons in picker |
| AtPicker hover states use design tokens | 2 | Playwright: evaluate computed styles on hover items |
| AtPicker border color uses design token (not #e0e0e0) | 2 | Playwright: evaluate computed border-color of picker container |
| AtPicker text colors use design tokens (not hardcoded grays) | 2 | Playwright: evaluate computed color of text elements in picker |
| "当前上下文" section styled consistently with warm theme | 3 | Playwright: open picker on detail page, verify context section styling |
| AtPicker breadcrumb/navigation uses warm colors | 2 | Playwright: drill into entity, check breadcrumb computed styles |
| CSS overrides use design token variables (not new hardcoded colors) | 3 | grep index.css/override files for `var(--` usage, verify no new hex colors |

### D2: Typography & Readability (Weight: 20/100)

验证文字对比度和字体一致性。

| Check | Points | Detection |
|-------|--------|-----------|
| Ingredient amounts readable (contrast ratio ≥ 4.5:1 WCAG AA) | 4 | Playwright: evaluate computed color of ingredient amount text, calculate contrast |
| Font family consistent (Plus Jakarta Sans) across all pages | 3 | Playwright: evaluate computed font-family on body, headings, buttons |
| Section headings have consistent size/weight | 3 | Playwright: evaluate computed font-size/weight of h2 elements |
| Body text line-height ≥ 1.5 | 2 | Playwright: evaluate computed line-height of paragraph text |
| Loading/empty states use readable color (not --t3) | 2 | Playwright: navigate to invalid recipe, check computed color |
| Meta labels (准备时间 etc.) legible | 3 | Playwright: evaluate meta-label computed color + font-size |
| Badge text legible against badge background | 3 | Playwright: evaluate published-badge computed color + background |

### D3: Component Visual Quality (Weight: 20/100)

验证表格、食材列表、卡片等组件的视觉质量。

| Check | Points | Detection |
|-------|--------|-----------|
| Tables have alternating row backgrounds or visual separation | 3 | Playwright: check table row computed backgrounds |
| Tables have rounded container or refined borders | 2 | Playwright: evaluate table container border-radius |
| Ingredient items have clear visual separation | 3 | Playwright: evaluate ingredient-item computed gap/border |
| Callout blocks visually refined (padding ≥ 12px, readable) | 2 | Playwright: evaluate callout computed padding and color |
| Meta cards have consistent border treatment | 3 | Playwright: evaluate meta-item computed border + shadow |
| Recipe cards on list page have polished hover state | 3 | Playwright: navigate /recipes, check card hover effect |
| Chat trigger button visually matches theme | 2 | Playwright: evaluate chat-trigger-btn computed colors |
| Back button has clear interactive affordance | 2 | Playwright: evaluate back-btn computed styles |

### D4: Dark Mode & Theme Consistency (Weight: 20/100)

验证暗色模式完整性和主题一致性。**重点检查输入框文字在暗色模式下的可见性。**

| Check | Points | Detection |
|-------|--------|-----------|
| **Composer textarea text visible in dark mode** (contrast ≥ 4.5:1) | 4 | Playwright: emulate dark mode, navigate to /chat, evaluate textarea computed color vs background, calculate contrast |
| **Search input text visible in dark mode** (contrast ≥ 4.5:1) | 3 | Playwright: emulate dark mode, navigate to /recipes, evaluate search input computed color vs background |
| **Placeholder text visible in dark mode** | 2 | Playwright: emulate dark mode, check input::placeholder computed color |
| AtPicker dark mode: background uses dark surface token | 2 | Playwright: emulate dark mode, open picker, check background |
| AtPicker dark mode: text uses light text token | 2 | Playwright: emulate dark mode, check picker text color |
| Recipe detail page dark mode renders correctly | 2 | Playwright: emulate dark mode, navigate to recipe detail, take snapshot |
| No hardcoded white/black in CSS overrides (all use tokens) | 3 | grep CSS files for hardcoded `#fff`, `#000`, `white`, `black` in new code |
| Chat panel border visible in dark mode | 2 | Playwright: emulate dark mode, open split view, check border visibility |

### D5: Build Quality (Weight: 20/100)

验证构建通过、冻结目录未被修改。

| Check | Points | Detection |
|-------|--------|-----------|
| Frontend tsc --noEmit passes | 3 | bash: run tsc |
| Frontend vite build succeeds | 3 | bash: run vite build |
| Backend tsc --noEmit passes | 2 | bash: run tsc in backend |
| Backend tests pass | 2 | bash: run vitest |
| No frozen package modifications | 4 | git diff on frozen dirs |
| file: links correct in package.json | 2 | grep + verify |
| Existing features work (/recipes, /recipes/:id, /chat) | 2 | Playwright: basic navigation |
| AtPicker still functional (opens, shows entities, drill works) | 2 | Playwright: open picker, verify data loads |

---

## Penalties

| ID | Trigger | Impact |
|----|---------|--------|
| P1 | `packages/context-layer-react/src/` modified | D1 = 0 |
| P2 | `packages/chat-interface/src/` modified | D3 = 0 |
| P3 | `packages/context-layer/src/` modified | D1 = 0 |
| P4 | `packages/entity-document/src/` modified | D5 = 0 |
| P5 | `solutions/business/edu-platform/` modified | D4 = 0 |
| P6 | Backend existing tests fail | D5 = 0 |
| P7 | AtPicker stops functioning (can't load data) | D1 = 0 |

---

## Score Format

评分报告必须以如下格式结尾（用于 harness.sh 正则提取）：

```
总分: XX/100
```
