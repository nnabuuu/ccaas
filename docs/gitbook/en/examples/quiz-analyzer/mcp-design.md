# MCP Design: Hierarchical Data

How the Quiz Analyzer MCP server handles 31,497 hierarchical knowledge points with leaf-priority search, in-memory indexing, and a composite ranking formula. These patterns apply to any domain that stores read-heavy hierarchical classification data.

---

## 1. The leafOnly Algorithm

### Why parent nodes pollute results

The knowledge point tree has up to 10 levels of depth. Many nodes that appear to be leaf concepts are actually intermediate parents. Real data from the tree:

```
勾股定理 (level 3, PARENT)     ← "obvious leaf" — actually a parent
├── 勾股定理及其证明 (level 4, LEAF ✅)
└── 勾股定理的实际应用 (level 4, LEAF ✅)

一次函数 (level 2, PARENT)
├── 一次函数的解析式 (level 3, LEAF ✅)
├── 一次函数的图象与性质 (level 3, PARENT)
│   ├── 一次函数的图象的特点 (level 4, LEAF ✅)
│   └── k,b对一次函数图象及性质的影响 (level 4, LEAF ✅)
└── 一次函数图像的交点问题 (level 3, LEAF ✅)
```

Without `leafOnly: true`, a search for "勾股定理" returns the parent node. The agent tags the quiz with "勾股定理" — which is correct but too broad. The actual concept being tested ("proof" or "application") is missed.

### Implementation

```typescript
if (options?.leafOnly) {
  const leafResults = results.filter(r => r.children.length === 0)
  if (leafResults.length > 0) {
    results = leafResults  // Replace with leaf-only subset
  }
  // If no leaf matched, fall back to all results (silent, not an error)
}
```

**Leaf detection is O(1)**: `kp.children.length === 0`. This works because the JSON export pre-populates each node's `children[]` array — there is no runtime query to find children.

**Fallback guarantee**: `leafOnly: true` never returns an empty result when there are matches. If the filter would eliminate everything, it is silently relaxed. The agent can always use `leafOnly: true` without defensive error handling.

### Score preservation

`leafOnly` is a post-processing filter. It does not change `matchScore` or `matchedKeywords` for any node. The leaf entries have exactly the same scores they would have without `leafOnly` — ranking is unaffected.

---

## 2. Five In-Memory Indexes

### Why JSON + Map instead of SQLite for knowledge points

The original implementation queried knowledge points from SQLite. The switch to JSON + in-memory Maps happened for four reasons:

| Concern | SQLite | JSON + Map |
|---------|--------|------------|
| Startup speed | DB connection + schema init | Single JSON parse |
| Deployment | DB file + migrations | One JSON file to copy |
| Query speed | SQL query per request | O(1) Map lookup |
| Leaf detection | Query for children at runtime | O(1) — pre-populated `children[]` |

All 31,497 knowledge points fit in ~8 MB. For this dataset size, an in-memory approach is strictly better than a database for read-only queries.

### The five indexes

```typescript
// Built once at startup (O(n)), used for every subsequent query (O(1))
kpById:       Map<string, KnowledgePoint>      // Lookup by ID
kpByName:     Map<string, KnowledgePoint[]>    // Lookup by exact name
kpBySubject:  Map<string, KnowledgePoint[]>    // Lookup by subject ID
subjectById:  Map<string, Subject>             // Lookup by subject ID
subjectByName:Map<string, Subject[]>           // Lookup by exact name
```

Text search (substring match on `name` and `description`) still requires an O(n) scan — but since the full dataset is in memory, this scan completes in single-digit milliseconds.

{% hint style="info" %}
**Note**: The SQLite database is still used for quiz records (`search_quizzes`, `get_quiz_details`, `save_complete_analysis`). Only the knowledge point tree migrated to JSON. The two datastores have different access patterns: knowledge points are read-only and relation-heavy; quiz records are read-write and row-oriented.
{% endhint %}

---

## 3. batchScore Formula

### The formula

```
matchScore = matchedKeywords.length × 10 + kp.level
```

### Why ×10?

Two criteria determine which knowledge point is the best match:

1. **Keyword count** — A node matching 2 of your 3 query keywords is more relevant than a node matching only 1.
2. **Tree depth** — When two nodes match the same number of keywords, the deeper (more specific) node is preferred.

The ×10 multiplier ensures keyword count **always** dominates. A node matching 2 keywords scores at least 20. No single-keyword node can outscore it regardless of depth (maximum depth is 10, so maximum single-keyword score is 1×10+10 = 20 — which ties but never beats a 2-keyword match). In practice, depths rarely exceed 6, so the separation is clear.

### Example

Query: `["二次函数", "对称轴"]`

| Node | Keywords matched | Level | matchScore |
|------|-----------------|-------|------------|
| 二次函数的对称轴 (LEAF) | 2 (both) | 5 | **25** ← wins |
| 二次函数 (PARENT) | 1 | 2 | 12 |
| 对称轴 (different branch) | 1 | 4 | 14 |

With `leafOnly: true`, 二次函数 (PARENT) is additionally filtered out even if it had a higher score.

---

## 4. Two-Mode Search Protocol

`leafOnly` (Mode A) handles the common case where keywords map cleanly to leaf nodes. Mode B handles everything else.

### When to use each mode

| Situation | Mode |
|-----------|------|
| Keywords are specific and unambiguous | **Mode A** — one `batch_search_knowledge_points` call |
| Mode A returns parent nodes (`isLeaf: false`) | **Mode B** — hierarchical traversal |
| Quiz spans multiple knowledge domains | Mode A per domain; Mode B as fallback per domain |
| Mode A returns 0 results | **Mode B** only |

### Mode A — Fast path

```
1. Extract 2–4 keywords from quiz stem and answer
2. batch_search_knowledge_points(keywords, leafOnly: true)
3. All results are leaves → proceed to verify + write_output
4. Any result is a parent → switch to Mode B for that knowledge domain
```

One tool call. Sufficient for most quizzes.

### Mode B — Hierarchical traversal

The agent traverses the tree level by level, making an explicit judgment at each step:

```
B1: list_subjects(subject_name) → subjectId

B2: list_root_knowledge_points(subjectId)
    → ["数与代数", "图形与几何", "统计与概率", ...]
    → AI picks 1–2 branches that match the quiz

B3: get_knowledge_point_children(selectedNodeId)
    → returns each child with isLeaf indicator
    → isLeaf: true  → add to candidate pool
    → isLeaf: false → repeat B3 on that child

B4 (optional — when a branch has >10 children):
    search_knowledge_points_under(nodeId, keyword)
    → searches within the subtree only, avoiding full-tree scan

B5: verify_knowledge_point_tags(candidateIds)
    get_knowledge_point_path(id) × N → build breadcrumbs
    write_output(field: 'knowledge_point_tags', ...)
```

### Example: 勾股定理

```
Mode A: batch_search(["勾股定理"], leafOnly: true)
  → returns "勾股定理及其证明" (leaf ✅) + "勾股定理的实际应用" (leaf ✅)
  → AI picks "勾股定理及其证明" for a proof question ✅

If Mode A had returned the parent instead:
  → "勾股定理" (isLeaf: false) → switch to Mode B
  → get_knowledge_point_children("勾股定理 id")
  → children: ["勾股定理及其证明" (leaf), "勾股定理的实际应用" (leaf)]
  → AI picks appropriate leaf ✅
```

The two modes complement each other: Mode A provides speed for the majority of cases; Mode B provides precision when the keyword search is ambiguous or the relevant concept sits deep in the hierarchy.

---

## 5. stdio Protocol: stdout is the Channel

This MCP server uses **stdio transport** — the MCP host (CCAAS agent engine) launches it as a child process and communicates over stdin/stdout.

**The rule**: stdout belongs to the MCP protocol. Any `console.log()` in server code corrupts the protocol stream and causes the agent engine to receive malformed JSON.

```typescript
// ✅ Correct — stderr is safe for diagnostics
process.stderr.write('[quiz-tools] write_output: field=knowledge_point_tags\n')
console.error('Server started')  // Also OK

// ❌ Wrong — corrupts MCP protocol
console.log('Server started')
console.log(JSON.stringify(debugData))
```

This applies to all stdio MCP servers regardless of domain. The pattern to remember: **log to stderr, never stdout**.

---

## 6. Transferable Scenarios

The patterns in this MCP server apply when:

- **Read-heavy, write-light data** — The knowledge point tree never changes during a session. In-memory indexing pays off when you have many queries per data load.
- **Dataset fits in memory (<~100 MB)** — JSON + Map is simpler and faster than a database for this scale.
- **Hierarchical classification with variable depth** — Any taxonomy where the "obvious" node might not be the most specific (product categories, medical codes, legal classifications, skill trees).
- **Multi-keyword ranking needed** — The `matched × 10 + level` formula works for any scenario where you want multi-keyword relevance to dominate single-keyword depth.
- **Agent must always get a result** — The leafOnly fallback pattern (apply filter only if it yields results, otherwise return all) prevents agent stalls.
