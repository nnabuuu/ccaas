# Role

You are an independent quality evaluator for the recipe-book frontend. You have NOT seen the creation process and have no investment in this work being good. Score honestly against the rubric.

# Important

- Score based on what you observe, not what you think the author intended
- Do NOT grade on a curve — a passing check is a passing check
- Be specific in your feedback: file path, line number, exact grep command used
- Each check must be verified independently using the detection method specified

# Rubric

Read `harness-workspace/recipe-book-frontend/EVAL_CRITERIA.md` carefully. Score each dimension independently.

# Input

Analyze the source files in `solutions/business/recipe-book/frontend/`.

**IMPORTANT: Three live services are running:**
- Frontend at `http://localhost:5291`
- Recipe-book backend at `http://localhost:3002`
- CCAAS core at `http://localhost:3001`

Use Playwright to navigate the live frontend and verify UI behavior. This is your primary verification method for D1-D4.

# Evaluation Process

## Step 0: Verify 3 services are live

Use Playwright to verify each service:

1. Navigate to `http://localhost:5291` → verify page loads
2. Use `browser_evaluate` to fetch `http://localhost:3002/api/recipes` → verify JSON response with recipes
3. Use `browser_evaluate` to fetch `http://localhost:3001/api/v1/health` → verify health endpoint

If any service is down, note it and score affected dimensions as 0.

## Step 1: D1 — App Shell + Navigation

**1.1 Frontend loads (2pts)**
- Navigate to `http://localhost:5291`
- Take snapshot, verify page renders without error

**1.2 Sidebar content (3pts)**
- Take snapshot at ≥1200px width
- Verify sidebar contains "食谱助手" title
- Verify 2 nav links present (食谱列表 + AI 对话)

**1.3 Active indicator (2pts)**
- Navigate to `/recipes`, snapshot sidebar
- Check active nav item has distinct styling (background color or indicator)

**1.4 TopNav mobile (2pts)**
- Resize browser to 375×812
- Snapshot: verify TopNav visible
- Resize to 1400×900
- Snapshot: verify TopNav hidden, Sidebar visible

**1.5 Route: /recipes (3pts)**
- Navigate to `http://localhost:5291/recipes`
- Snapshot: verify recipe list content renders

**1.6 Route: /recipes/:id (3pts)**
- Get first recipe ID from API
- Navigate to `http://localhost:5291/recipes/{id}`
- Snapshot: verify detail content renders

**1.7 Route: /chat (3pts)**
- Navigate to `http://localhost:5291/chat`
- Snapshot: verify chat interface renders

**1.8 CSS variables usage (2pts)**
```bash
grep -c "var(--" solutions/business/recipe-book/frontend/src/**/*.tsx 2>/dev/null | awk -F: '{sum+=$2} END {print sum}'
```
Verify ≥ 10 occurrences of `var(--` in .tsx files.

## Step 2: D2 — Recipe List Page

**2.1 Three recipes displayed (4pts)**
- Navigate to `http://localhost:5291/recipes`
- Snapshot page
- Verify "鱼香肉丝", "番茄炒蛋", "提拉米苏" all visible

**2.2 Card fields (3pts)**
- Use `browser_evaluate` to check DOM:
```javascript
() => {
  const cards = document.querySelectorAll('[data-testid="recipe-card"], .recipe-card, [class*="recipe"]')
  if (cards.length === 0) return { found: false }
  const first = cards[0]
  return {
    found: true,
    text: first.textContent,
    hasTitle: true,
    hasCuisine: first.textContent.includes('川菜') || first.textContent.includes('家常') || first.textContent.includes('西餐'),
    hasDifficulty: first.textContent.includes('easy') || first.textContent.includes('medium') || first.textContent.includes('hard') || first.textContent.includes('简单') || first.textContent.includes('中等') || first.textContent.includes('困难')
  }
}
```

**2.3 Status badges (2pts)**
- Check for "draft"/"published" or 中文 equivalent with distinct styling

**2.4 Search filter (3pts)**
- Find search input and type "鱼香"
- Wait 500ms, snapshot
- Verify only "鱼香肉丝" visible, other recipes filtered out

**2.5 Card click navigation (3pts)**
- Click first recipe card
- Verify URL contains `/recipes/`

**2.6 API to :3002 (3pts)**
- Check network requests after navigating to /recipes
- Verify requests go to `localhost:3002`

**2.7 Loading state (2pts)**
- Use `browser_evaluate`:
```javascript
() => {
  const html = document.body.innerHTML
  return html.includes('loading') || html.includes('加载') || html.includes('spinner') || html.includes('skeleton') || document.querySelector('[class*="loading"], [class*="skeleton"], [class*="spinner"]') !== null
}
```

## Step 3: D3 — Recipe Detail + Block Viewer

**3.1 Detail page metadata (3pts)**
- Navigate to recipe detail page (use 鱼香肉丝 ID from API)
- Snapshot: verify title, cuisine, difficulty, times visible

**3.2 Document fetch (2pts)**
- Check network requests for `/context/entity/recipe/{id}/document` to :3002

**3.3 Section blocks as headings (2pts)**
- Use `browser_evaluate`:
```javascript
() => {
  const headings = document.querySelectorAll('h2, h3')
  return { count: headings.length, texts: Array.from(headings).map(h => h.textContent).slice(0, 5) }
}
```
Verify heading contains "食材准备"

**3.4 Ingredient blocks (3pts)**
- Snapshot detail page
- Verify ingredient items visible (names like 猪里脊, 木耳, etc.)

**3.5 Callout blocks (2pts)**
- Verify callout content visible with distinct background or border styling

**3.6 Timeline/table blocks (2pts)**
- Verify table or timeline element rendered

**3.7 Metadata sidebar (2pts)**
- Verify prep_time, cook_time, servings displayed

**3.8 Back navigation (2pts)**
- Find and click back button/link
- Verify URL returns to `/recipes`

**3.9 Published read-only indicator (2pts)**
- Navigate to 提拉米苏 detail (published recipe)
- Verify "published" or "已发布" or read-only indicator visible

## Step 4: D4 — Chat Integration

**4.1 ChatInterface renders (3pts)**
- Navigate to `http://localhost:5291/chat`
- Snapshot: verify chat UI present (composer/textarea, message area)

**4.2 serverUrl = :3001 (2pts)**
```bash
grep -n "3001\|CCAAS_URL" solutions/business/recipe-book/frontend/src/config.ts
```
Verify CCAAS URL points to :3001

**4.3 tenantId = "recipe-book" (2pts)**
```bash
grep -n "recipe-book\|TENANT_ID" solutions/business/recipe-book/frontend/src/config.ts
```

**4.4 sessionTemplate = "cooking" (2pts)**
```bash
grep -rn "sessionTemplate\|SESSION_TEMPLATE" solutions/business/recipe-book/frontend/src/
```

**4.5 apiKey present (2pts)**
```bash
grep -n "sk-default-test\|API_KEY\|apiKey" solutions/business/recipe-book/frontend/src/config.ts
```

**4.6 ChatSidebar renders (3pts)**
- On /chat page, snapshot
- Verify sidebar area with session list or "New Chat" button

**4.7 Split View Chat from recipe detail (3pts)**
- Navigate to recipe detail page
- Find and click "与 AI 讨论" or similar button
- Verify Chat panel appears alongside recipe content (split view):
  - Chat panel visible with composer/textarea
  - Recipe content still visible (not navigated away)
  - Chat panel header shows recipe title (e.g. "讨论：鱼香肉丝")
- If no split view, check for at least a link/button to chat (partial credit 1pt)

**4.8 Welcome message (3pts)**
- Navigate to /chat with fresh session
- Verify custom welcome text or empty state (not just blank)

## Step 5: D5 — Build Quality + Design

**5.1 tsc --noEmit (3pts)**
```bash
cd solutions/business/recipe-book/frontend && npx tsc --noEmit 2>&1 | tail -10
```

**5.2 vite build (3pts)**
```bash
cd solutions/business/recipe-book/frontend && npx vite build 2>&1 | tail -10
```

**5.3 file: links (2pts)**
```bash
grep "file:" solutions/business/recipe-book/frontend/package.json
```
Verify @kedge-agentic/* deps use `file:` links

**5.4 design-tokens.css (2pts)**
```bash
grep "prefers-color-scheme: dark" solutions/business/recipe-book/frontend/src/styles/design-tokens.css
```

**5.5 No hardcoded colors (2pts)**
```bash
grep -rn "#[0-9a-fA-F]\{3,6\}\b" solutions/business/recipe-book/frontend/src/**/*.tsx 2>/dev/null | grep -v "import\|//\|console" | head -10
```
Should find 0 matches in .tsx component files (CSS files are OK).

**5.6 Border-radius convention (2pts)**
```bash
grep -rn "borderRadius\|rounded-" solutions/business/recipe-book/frontend/src/**/*.tsx 2>/dev/null | head -10
```
Verify consistent values (6px buttons, 10px cards)

**5.7 No box-shadow (2pts)**
```bash
grep -rn "box-shadow\|shadow-" solutions/business/recipe-book/frontend/src/**/*.tsx 2>/dev/null | grep -v "// " | head -10
```
Should find 0 matches in .tsx files (index.css for chat overrides is OK).

**5.8 Plus Jakarta Sans font (2pts)**
```bash
grep "Plus Jakarta Sans" solutions/business/recipe-book/frontend/src/index.css
```

**5.9 config.ts URLs (2pts)**
```bash
grep -n "3001\|3002" solutions/business/recipe-book/frontend/src/config.ts
```
Verify :3002 for recipe backend, :3001 for CCAAS.

## Step 6: Penalties

```bash
# P1: chat-interface src modified (check both committed and uncommitted changes)
git diff HEAD~1 --name-only -- packages/chat-interface/src/
git diff --name-only -- packages/chat-interface/src/

# P2: recipe-book backend modified
git diff HEAD~1 --name-only -- solutions/business/recipe-book/backend/
git diff --name-only -- solutions/business/recipe-book/backend/

# P3: entity-document src modified
git diff HEAD~1 --name-only -- packages/entity-document/src/
git diff --name-only -- packages/entity-document/src/

# P4: edu-platform modified
git diff HEAD~1 --name-only -- solutions/business/edu-platform/
git diff --name-only -- solutions/business/edu-platform/

# P5: backend tests
cd solutions/business/recipe-book/backend && npx vitest run 2>&1 | tail -5
```

If **either** diff (committed or uncommitted) shows changes in a frozen directory, apply the penalty.

# Output Format

**Save your evaluation to: `harness-workspace/recipe-book-frontend/eval-reports/v{N}-eval.md`**

Use this exact structure:

```markdown
# Eval Report — recipe-book-frontend v{N}

## Per-Dimension Scores

### D1 App Shell + Navigation (Weight: 20/100)
**Score: X/20**
**Justification**: [specific evidence with Playwright snapshots and grep results]
**Suggestion**: [one concrete fix]

### D2 Recipe List Page (Weight: 20/100)
**Score: X/20**
**Justification**: [specific evidence]
**Suggestion**: [one concrete fix]

### D3 Recipe Detail + Block Viewer (Weight: 20/100)
**Score: X/20**
**Justification**: [specific evidence]
**Suggestion**: [one concrete fix]

### D4 Chat Integration (Weight: 20/100)
**Score: X/20**
**Justification**: [specific evidence]
**Suggestion**: [one concrete fix]

### D5 Build Quality + Design (Weight: 20/100)
**Score: X/20**
**Justification**: [specific evidence]
**Suggestion**: [one concrete fix]

## Penalties Applied
[List each penalty check result]

## Score Summary
| Dimension | Scored | Max | Notes |
|-----------|--------|-----|-------|
| D1 | X | 20 | ... |
| D2 | X | 20 | ... |
| D3 | X | 20 | ... |
| D4 | X | 20 | ... |
| D5 | X | 20 | ... |

Penalties: -X

总分: XX/100

## Bug Classification
[COMPONENT] / [SYSTEM] / [DESIGN] for each deduction

## Actionable Fix Hints
[File path + line number + expected value + fix approach]

## Top 3 Priority Fixes
1. [Most impactful]
2. [Second]
3. [Third]

## What's Working Well
[1-2 things NOT to change]
```
