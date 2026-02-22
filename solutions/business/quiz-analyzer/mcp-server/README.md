# Quiz Analyzer MCP Server

An [MCP](https://modelcontextprotocol.io/) server that gives AI agents structured access to 31,497 hierarchical knowledge points for educational quiz analysis. The agent tags quizzes with the most specific ("leaf") knowledge points, generates solution approaches, and writes structured output to the frontend.

---

## Table of Contents

- [Overview](#overview)
- [Architecture Decisions](#architecture-decisions)
- [Data Model](#data-model)
- [Tool Catalog](#tool-catalog)
- [Agent Tagging Workflow](#agent-tagging-workflow)
- [Core Algorithm: batchSearchKnowledgePoints](#core-algorithm-batchsearchknowledgepoints)
- [Verification Guide](#verification-guide)
- [Developer Patterns](#developer-patterns)

---

## Overview

### What this server does

The agent receives a quiz question and uses these tools to:

1. **Parse** the quiz to extract key terms
2. **Search** the knowledge point tree to find matching concepts
3. **Tag** the quiz with the most specific leaf-level knowledge points
4. **Generate** a structured solution approach (解题思路)
5. **Write** all analysis fields to the frontend via `write_output`

### Transport: stdio MCP (not HTTP)

This is a **stdio MCP server**, not an HTTP REST API. The old README was wrong about port 3006 and HTTP endpoints — those never existed in the current implementation.

```json
// solution.json registration
{
  "mcpServers": {
    "quiz-analyzer-tools": {
      "command": "node",
      "args": ["mcp-server/dist/index.js"]
    }
  }
}
```

The MCP host (CCAAS agent engine) launches this as a child process and communicates over stdin/stdout. The agent calls tools by name; there are no HTTP calls.

### Data snapshot

| Metric | Value |
|--------|-------|
| Total knowledge points | 31,497 |
| Leaf nodes (no children) | ~74% |
| Subjects/catalogs | varies by JSON export |
| Tree depth | up to 10 levels |
| In-memory footprint | ~8 MB |

---

## Architecture Decisions

### Why MCP instead of HTTP REST?

| Concern | HTTP REST | stdio MCP |
|---------|-----------|-----------|
| Agent tool discovery | Agent must know endpoint paths | Agent queries `list_tools` and gets typed schemas |
| Schema introspection | Requires separate OpenAPI doc | Built into the protocol |
| Transport overhead | HTTP stack per call | Direct pipe, no network |
| Agent integration | Custom connector per agent | Standard MCP client works everywhere |

MCP gives the agent a self-describing interface: it can discover all 16 tools, their parameter types, and their descriptions in a single `list_tools` call.

### Why JSON files instead of SQLite for knowledge points?

The original implementation used SQLite queries. The switch to JSON + in-memory indexes happened because:

1. **Startup speed**: JSON parse is faster than DB connection + schema init
2. **Deployment simplicity**: One JSON file to copy, no DB migration
3. **Query flexibility**: All 31,497 KPs fit in ~8 MB; O(1) lookup by ID, O(n) scan for text search
4. **Pre-computed children**: The JSON export pre-populates each node's `children[]` array, enabling O(1) leaf detection (`kp.children.length === 0`)

Note: the SQLite database is still used for quiz data (`search_quizzes`, `get_quiz_details`, `save_complete_analysis`). Only the knowledge point tree migrated to JSON.

### Five indexes built at startup

```typescript
// Built once in buildIndexes(), used for every subsequent query
kpById:       Map<string, KnowledgePoint>      // O(1) by ID
kpByName:     Map<string, KnowledgePoint[]>    // O(1) by exact name
kpBySubject:  Map<string, KnowledgePoint[]>    // O(1) by subject ID
subjectById:  Map<string, Subject>             // O(1) by subject ID
subjectByName:Map<string, Subject[]>           // O(1) by exact name
```

### Singleton loader with lazy init

```typescript
export const jsonDataLoader = new JsonDataLoader()
// index.ts calls jsonDataLoader.load() once at startup.
// Each query method also calls load() defensively — idempotent.
```

---

## Data Model

### KnowledgePoint

```typescript
interface KnowledgePoint {
  id: string;                    // Unique string ID (e.g. "1998702114322399906")
  subjectId: string;             // Links to Subject.id
  parentId: string | null;       // null = root node
  name: string;                  // Display name (e.g. "一次函数的解析式")
  code: string | null;           // Optional curriculum code
  description: string;           // Extended description (searched along with name)
  level: number;                 // Tree depth: 0 = root, higher = deeper
  gradeLevel: string;            // e.g. "初中", "高中"
  difficultyContribution: number;// Weight for difficulty calculation
  commonProblemTypes: string[];  // Associated quiz types
  relatedFormulas: string[];     // Formula references
  children: string[];            // IDs of direct children — empty [] means LEAF
}
```

**Leaf detection**: `kp.children.length === 0`

This is the key invariant for `leafOnly` mode. It is O(1) because `children[]` is pre-populated in the JSON export — there is no need to query for children at runtime.

### Subject

```typescript
interface Subject {
  id: string;
  name: string;
  code: string | null;
  description: string;
  gradeLevels: string[];   // Grade levels this subject covers
  hasFormula: boolean;
  createdAt: string;
}
```

### Tree depth reality

Many nodes that seem like leaves ("obvious" leaf concepts) are actually **intermediate parents** with specific sub-topics beneath them. Empirically confirmed from data inspection:

```
一次函数 (level 2, PARENT)
├── 一次函数的解析式 (level 3, LEAF ✅)
├── 一次函数的图象与性质 (level 3, PARENT)
│   ├── 一次函数的图象的特点 (level 4, LEAF ✅)
│   └── k,b对一次函数图象及性质的影响 (level 4, LEAF ✅)
└── 一次函数图像的交点问题 (level 3, LEAF ✅)

二次函数 (level 2, PARENT)
├── 二次函数的概念 (level 3, LEAF ✅)
├── 二次函数的图象与性质 (level 3, PARENT)
│   ├── 描点法画二次函数图象 (level 4, LEAF ✅)
│   └── 二次函数的性质 (level 4, PARENT)
│       └── 二次函数的对称轴 (level 5, LEAF ✅)
└── 二次函数的图象变换 (level 3, LEAF ✅)

勾股定理 (level 3, PARENT)     ← "obvious leaf" that is actually a parent
├── 勾股定理及其证明 (level 4, LEAF ✅)
└── 勾股定理的实际应用 (level 4, LEAF ✅)

一元二次方程 (level 2, PARENT)  ← same pattern
├── 一元二次方程的概念 (level 3, LEAF ✅)
└── 一元二次方程根的判别式 (level 3, LEAF ✅)
```

This is why `leafOnly: true` matters: without it, the agent might tag a quiz with "勾股定理" (a parent) instead of "勾股定理及其证明" (the actual leaf concept being tested).

---

## Tool Catalog

16 tools in 4 groups.

### Group 1: Knowledge Point Search (JSON-backed)

| Tool | Purpose |
|------|---------|
| `search_knowledge_points_json` | Single-keyword search across name + description |
| `batch_search_knowledge_points` | Multi-keyword search, deduplicated, ranked, leafOnly supported |
| `search_catalog` | Search subjects/catalogs |
| `get_root_categories` | Get top-level nodes for a subject |

**Primary tool for quiz analysis: `batch_search_knowledge_points`**

```json
{
  "keywords": ["二次函数", "对称轴", "图象"],
  "gradeLevel": "初中",
  "leafOnly": true,
  "limit": 10
}
```

### Group 2: Tree Navigation (JSON-backed)

| Tool | Purpose |
|------|---------|
| `get_children_nodes` | Get direct children of a parent node |
| `get_node_path` | Get path from root to a node (for breadcrumb display) |
| `search_in_scope` | Search within a specific parent's subtree |
| `search_knowledge_points` | DB-based search (legacy, prefer JSON version) |

### Group 3: Quiz Analysis Output

| Tool | Purpose |
|------|---------|
| `write_output` | Write analysis fields to frontend (triggers "Sync to Form" button) |
| `verify_knowledge_point_tags` | Verify that proposed tag IDs exist in the data |
| `generate_thinking_process_template` | Get Markdown template for a quiz type |
| `get_knowledge_points_tree` | Get full subject tree (legacy, expensive for large subjects) |

#### write_output fields

```typescript
// All fields the agent can write:
type SyncField =
  | 'quiz_analysis'         // string — overall summary (Markdown)
  | 'knowledge_point_tags'  // KnowledgePointTag[] — with confidence scores
  | 'thinking_process'      // string — 解题思路 (Markdown)
  | 'solution_steps'        // SolutionStep[]
  | 'correct_answer'        // string
  | 'common_mistakes'       // Mistake[]
  | 'knowledge_gap_analysis'// string (Markdown)
  | 'difficulty'            // number 1–5
  | 'related_quizzes'       // RelatedQuiz[]
  | 'time_estimate'         // string
```

**KnowledgePointTag schema** (for `knowledge_point_tags` field):

```typescript
interface KnowledgePointTag {
  id: string
  name: string
  confidence: number      // 0.0–1.0 — see confidence guidelines below
  verified: boolean
  level: number           // tree depth of this node
  path: string[]          // breadcrumb from root to this node
  source?: 'question' | 'solution' | 'both'
  // 'question' — identified from quiz stem (student recognizes at read time)
  // 'solution' — identified from answer/solution process (method used to solve)
  // 'both'     — implied by stem and confirmed by solution
  note?: string           // REQUIRED when using a parent (non-leaf) node
  // Explain why leaf could not be determined and list possible leaf candidates
}
```

**Confidence guidelines:**

| Range | Node type | Situation |
|-------|-----------|-----------|
| 0.95–1.0 | Leaf | Quiz explicitly uses this exact concept |
| 0.85–0.94 | Leaf | Inferred with high confidence from context |
| 0.70–0.84 | Parent | Quiz implies it but specific method unclear |
| 0.60–0.69 | Parent | Only rough category determinable |
| < 0.60 | — | Too uncertain — do not tag |

**Difficulty levels** (for `difficulty` field):

| Score | Label | Formula weight |
|-------|-------|----------------|
| 1 | 简单 | 选择题 × 0.8 |
| 2 | 较易 | 填空题 × 1.0 |
| 3 | 中等 | 解答题 × 1.2 |
| 4 | 较难 | 证明题 × 1.5 |
| 5 | 困难 | — |

Formula: `difficulty = min(5, ceil((知识点数 × 0.5 + 步骤数 × 0.3) × 题型权重))`

### Group 4: Quiz Database (SQLite-backed)

| Tool | Purpose |
|------|---------|
| `search_quizzes` | Search quiz records by keyword/subject/type |
| `get_quiz_details` | Get full quiz record + linked knowledge points |
| `save_complete_analysis` | Persist all analysis fields to database |
| `parse_quiz_content` | Parse raw quiz text into stem + options + type |

---

## Agent Tagging Workflow

The recommended 8-step workflow for the agent to tag a quiz question with knowledge points.

### Step 1: Parse quiz stem → extract `question` keywords

Identify what the student recognizes just by reading the question (topic type, exam direction).

```
Quiz: "用因式分解法解方程 x² + 5x + 6 = 0"
question keywords: ["方程", "因式分解"]   ← visible in stem
```

### Step 2: Parse answer/solution → extract `solution` keywords

The answer reveals the *specific method* used — often more precise than the stem.

```
Answer: "(x+2)(x+3) = 0 → x = -2 或 x = -3"
Answer pattern: (x+a)(x+b)  → 十字相乘法因式分解  ← source: 'solution'
```

Key answer-to-method patterns:

| Answer form | Identified method |
|-------------|------------------|
| `(x+a)(x+b)` | 十字相乘法因式分解 |
| `(a+b)(a-b)` | 平方差公式法因式分解 |
| `(a+b)²` | 完全平方公式因式分解 |
| `a(x+b)` | 提公因式法因式分解 |
| `x = (-b±√…)/2a` | 求根公式 |
| `对称轴 x = …` | 二次函数的对称轴 |

### Step 3: Batch search all keywords

Use `batch_search_knowledge_points` with `leafOnly: true` for all question + solution keywords in one call:

```json
{
  "keywords": ["方程", "因式分解", "十字相乘法"],
  "gradeLevel": "初中",
  "leafOnly": true,
  "limit": 15
}
```

### Step 4: Expand parent nodes (when needed)

If a candidate has children but `leafOnly` did not return it (because fallback kicked in), use `get_children_nodes` to explore its subtree manually.

```
"因式分解" (parent, 10 children) → expand →
  十字相乘法因式分解 ✅
  平方差公式法因式分解
  完全平方公式因式分解
  提公因式法因式分解
  ...
```

### Step 5: Build candidate pool

Collect all matching leaf (and any necessary parent) nodes from steps 3–4.

### Step 6: Select and annotate

Pick nodes that are directly tested or required for solving. Annotate each with `source`:

```json
[
  { "name": "一元二次方程", "source": "question", "confidence": 0.95 },
  { "name": "因式分解",     "source": "question", "confidence": 0.85 },
  { "name": "十字相乘法因式分解", "source": "solution", "confidence": 0.95 }
]
```

**Fallback rule**: If you cannot determine the specific leaf, use the nearest parent + lower confidence + `note` field:

```json
{
  "name": "因式分解",
  "confidence": 0.70,
  "note": "题目未明确具体方法，可能涉及：十字相乘法、公式法、提公因式法。建议人工复核。"
}
```

### Step 7: Validate with `verify_knowledge_point_tags`

Pass the selected tag IDs to confirm they exist in the data.

### Step 8: Get breadcrumb paths and write output

```bash
# Get full path for each tag
get_node_path({ nodeId: "..." })

# Write final tags to frontend
write_output({ field: "knowledge_point_tags", value: [...], preview: "3个知识点" })
```

### Common mistakes to avoid

| Mistake | Wrong | Right |
|---------|-------|-------|
| Only search one keyword | `search("因式分解")` only | Search all keywords in one batch call |
| Stop at parent without expanding | Tag "因式分解" without looking at its 10 children | `get_children_nodes` to find specific method |
| Use parent node without `note` | `{ name: "因式分解", confidence: 0.9 }` | Add `note` field explaining why leaf unavailable |
| Ignore answer/solution | Only look at quiz stem | Also analyze answer form to identify `source: 'solution'` nodes |

---

## Core Algorithm: batchSearchKnowledgePoints

### The scoring formula

```
matchScore = matchedKeywords.length × 10 + kp.level
```

- **Keyword count dominates** (×10 weight): A KP matching 2 keywords scores at least 20, outranking any single-keyword match regardless of depth.
- **Level as tiebreaker**: Within the same keyword count, deeper (more specific) nodes rank higher. Level 5 beats level 3 when both match the same number of keywords.

### Implementation

```typescript
// For each keyword, scan all KPs:
for (const keyword of keywords) {
  for (const kp of this.knowledgePoints) {
    if (!kp.name.includes(keyword) && !kp.description.includes(keyword)) continue
    // ...
    hitMap.set(kp.id, { kp, matched: new Set([keyword]) })
  }
}

// Compute scores and deduplicate:
let results = Array.from(hitMap.values()).map(({ kp, matched }) => ({
  ...kp,
  matchedKeywords: Array.from(matched),
  matchScore: matched.size * 10 + kp.level,
}))
```

### leafOnly mode

```typescript
if (options?.leafOnly) {
  const leafResults = results.filter(r => r.children.length === 0)
  if (leafResults.length > 0) {
    results = leafResults  // Replace with leaf-only subset
  }
  // If no leaf matched, fall back to all results (no change)
}
```

**Fallback guarantee**: `leafOnly: true` never returns fewer results than `leafOnly: false` in the "no leaf found" edge case. The fallback ensures the agent always gets something useful.

**Score preservation**: `leafOnly` is a post-processing filter — it does not change `matchScore` or `matchedKeywords` for any node. The leaf entries have exactly the same scores as they would without `leafOnly`.

### Expected behavior by category

| Category | Keywords | leafOnly | Expected result |
|----------|----------|----------|-----------------|
| A: Single leaf | `['二次函数', '对称轴']` | `true` | "二次函数的对称轴" (leaf), NOT "二次函数" (parent) |
| A: Single leaf | `['勾股定理', '直角三角形']` | `true` | "勾股定理及其证明" (leaf), NOT "勾股定理" (parent) |
| B: Sibling leaves | `['一次函数', '解析式', '图象']` | `true` | Both "一次函数的解析式" AND "一次函数的图象的特点" (leaves), NOT "一次函数" (parent) |
| B: Sibling leaves | `['二次函数', '概念', '对称轴']` | `true` | Both "二次函数的概念" AND "二次函数的对称轴" (leaves) |
| C: Cross-branch | `['一次函数', '勾股定理']` | `true` | "一次函数的解析式" (function branch leaf) + "勾股定理及其证明" (geometry branch leaf) |
| C: Cross-branch | `['二次函数', '一元二次方程']` | `true` | Leaves from both function branch and equation branch |
| Fallback | `['不存在的知识点xyz']` | `true` | Empty array (no results at all, not a fallback issue) |
| No leaf | `[keyword matching only parents]` | `true` | Falls back to all matched nodes (leafOnly relaxed) |

---

## Verification Guide

### Run the test suite

```bash
cd solutions/business/quiz-analyzer/mcp-server
npm test
```

Expected: **47 tests pass** across 3 files:
- `__tests__/leaf-priority-search.test.ts` — 14 tests for leafOnly behavior
- `__tests__/batch-search.test.ts` — 18 tests for multi-keyword ranking
- `__tests__/knowledge-point-search.test.ts` — 15 tests for basic search

### Inspect the data in Node.js REPL

```bash
cd solutions/business/quiz-analyzer/mcp-server
node --loader ts-node/esm --input-type=module << 'EOF'
import { jsonDataLoader } from './src/json-data-loader.js'
jsonDataLoader.load()

// Check total KP count
console.log('Total KPs:', jsonDataLoader.getAllKnowledgePoints().length)

// Check leaf percentage
const all = jsonDataLoader.getAllKnowledgePoints()
const leaves = all.filter(kp => kp.children.length === 0)
console.log('Leaf nodes:', leaves.length, `(${Math.round(leaves.length/all.length*100)}%)`)

// Verify a known parent node has children
const quadFunc = jsonDataLoader.getKnowledgePointById('1998702114322399941')
console.log('二次函数 children:', quadFunc?.children.length, '(should be > 0)')

// Verify leafOnly suppresses it
const results = jsonDataLoader.batchSearchKnowledgePoints(
  ['二次函数'], { gradeLevel: '初中', leafOnly: true }
)
const hasParent = results.some(r => r.id === '1998702114322399941')
console.log('Parent in leafOnly results:', hasParent, '(should be false)')
EOF
```

### Verify specific node IDs from tests

The test files use confirmed node IDs derived from data inspection. Key parent nodes that must NOT appear with `leafOnly: true`:

| ID | Name | Why it matters |
|----|------|----------------|
| `1998702114322399941` | 二次函数 | Matches keyword "二次函数" but is a parent |
| `1998702114322399906` | 一次函数 | Matches keyword "一次函数" but is a parent |
| `1998702114322400154` | 勾股定理 | Classic "obvious leaf" that is actually a parent |
| `1998702114322399803` | 一元二次方程 | Parent with concept and discriminant as leaves |

Key leaf nodes that MUST appear with `leafOnly: true` for the right query:

| ID | Name | Matched by keywords |
|----|------|---------------------|
| `1998702114322399955` | 二次函数的对称轴 | 二次函数, 对称轴 |
| `1998702114322399908` | 一次函数的解析式 | 一次函数, 解析式 |
| `1998702114322400157` | 勾股定理及其证明 | 勾股定理 |
| `1998702114322399804` | 一元二次方程的概念 | 一元二次方程 |
| `1998702114322399922` | 一次函数图像的交点问题 | 一次函数, 交点 |

### Check the MCP server starts cleanly

```bash
cd solutions/business/quiz-analyzer/mcp-server
npm run build
echo '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{}},"id":1}' | node dist/index.js
```

You should see startup logs on stderr (`📚 Loading JSON data files...`) and a valid JSON-RPC response on stdout.

---

## Developer Patterns

These patterns emerged from building this MCP server. Use them when building similar domain-specific MCPs.

### 1. In-memory index over repeated scans

Build typed Maps at startup instead of filtering the full array on every query:

```typescript
// At startup: O(n) once
this.knowledgePoints.forEach(kp => {
  this.kpById.set(kp.id, kp)         // O(1) lookup
  this.kpBySubject.get(kp.subjectId)?.push(kp) // O(1) filtered collection
})

// At query time: O(1)
const kp = this.kpById.get(id)
const subjectKPs = this.kpBySubject.get(subjectId) ?? []
```

### 2. Singleton loader with idempotent lazy init

```typescript
class JsonDataLoader {
  private loaded = false

  load() {
    if (this.loaded) return  // idempotent
    // ... load and index ...
    this.loaded = true
  }

  // Each public method calls load() defensively
  getKnowledgePointById(id: string) {
    this.load()
    return this.kpById.get(id)
  }
}

export const jsonDataLoader = new JsonDataLoader()
```

This pattern avoids constructor-time I/O (which can fail silently) while guaranteeing data is available at first use.

### 3. Composite matchScore for multi-criterion ranking

When combining keyword relevance with structural preference:

```typescript
// Primary criterion × large weight + secondary criterion (tiebreaker)
matchScore = matched.size * 10 + kp.level
```

The ×10 multiplier ensures the primary criterion (keyword count) always dominates. The secondary criterion (level/depth) only matters when the primary is tied.

### 4. leafOnly with automatic fallback

Never return zero results when a filter is "too strict":

```typescript
if (options?.leafOnly) {
  const leafResults = results.filter(r => r.children.length === 0)
  if (leafResults.length > 0) {
    results = leafResults  // Apply filter only when it produces results
  }
  // Otherwise: silently fall back (don't throw, don't return empty)
}
```

This pattern is agent-friendly: the agent can always use `leafOnly: true` without defensive error handling.

### 5. Test with real data, not synthetic fixtures

The knowledge point tests (`leaf-priority-search.test.ts`) load the actual JSON files and use real node IDs. This catches real-world edge cases (parents masquerading as leaves) that synthetic fixtures would miss.

```typescript
// Real node IDs validated by data inspection
const PARENTS = {
  quadraticFunction: '1998702114322399941', // confirmed: has children
}
const LEAVES = {
  quadraticFnSymmetryAxis: '1998702114322399955', // confirmed: children === []
}

it('leafOnly suppresses parent, surfaces leaf', () => {
  const results = jsonDataLoader.batchSearchKnowledgePoints(
    ['二次函数', '对称轴'],
    { leafOnly: true }
  )
  expect(results.map(r => r.id)).toContain(LEAVES.quadraticFnSymmetryAxis)
  expect(results.map(r => r.id)).not.toContain(PARENTS.quadraticFunction)
})
```

### 6. Separate PARENTS and LEAVES constants in tests

Distinct named constants communicate intent and prevent confusion:

```typescript
// Clear: this node is expected to appear
const LEAVES = { pythagoreanProof: '...' }

// Clear: this node must NOT appear in leafOnly results
const PARENTS = { pythagoreanTheorem: '...' }
```

Avoid using raw string IDs inline in assertions — they are opaque and don't explain why a node is expected or forbidden.

### 7. MCP tool schema as developer documentation

The `description` field in each MCP tool is the primary documentation developers (and agents) read. Make it complete:

```typescript
const batchSearchKnowledgePointsTool: Tool = {
  name: 'batch_search_knowledge_points',
  description: `Search knowledge points by multiple keywords in a single call.

Returns a deduplicated, ranked list. Each result includes:
- matchedKeywords: which of the input keywords hit this knowledge point
- matchScore: number of matched keywords × 10 + depth level
  (more keyword matches wins; within same count, deeper/more specific nodes rank higher)

Use leafOnly: true to suppress intermediate parent nodes and return only
the most specific (leaf) knowledge points. Falls back to all matches if no
leaf matches.`,
  // ...
}
```

### 8. stdio transport for agent integration

```typescript
// index.ts — always stdio for MCP servers integrated with agent engines
const transport = new StdioServerTransport()
await server.connect(transport)

// Log to stderr — stdout is reserved for MCP protocol
console.error('Server started')
```

stdout is the MCP communication channel. Any `console.log()` calls in server code will corrupt the protocol stream. Always use `console.error()` for diagnostics.

---

## Quick Reference

### Running tests

```bash
npm test                    # All 47 tests
npm test leaf-priority      # Leaf-priority tests only
npm test batch-search       # Batch search tests only
```

### Building

```bash
npm run build               # Compile TypeScript to dist/
npm run dev                 # Watch mode
```

### Key files

| File | Purpose |
|------|---------|
| `src/index.ts` | MCP server entry, tool definitions, request handlers |
| `src/json-data-loader.ts` | In-memory KP loader, all search/navigation methods |
| `src/common/types.ts` | SYNC_FIELDS, WriteOutputInput, WriteOutputResult |
| `src/common/schemas.ts` | Zod validators for each sync field |
| `src/__tests__/leaf-priority-search.test.ts` | leafOnly behavior tests (real data) |
| `src/__tests__/batch-search.test.ts` | Multi-keyword ranking tests |
| `data/knowledge-points.json` | 31,497 KPs with pre-populated children[] |
| `data/catalogs.json` | Subject/catalog definitions |
