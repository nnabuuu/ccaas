# Quiz Analyzer

AI tags educational quiz questions with the most specific matching knowledge points from a 31,000-node hierarchy, then generates a structured solution approach and writes all analysis fields to the frontend.

---

## Architecture

```
┌──────────────────────────────────┐
│  AI Agent (exercise-planner Skill)│
│                                  │
│  1. Parse quiz stem → keywords   │
│  2. Parse answer → method type   │
│  3. Search knowledge point tree  │
│  4. Select leaf-level tags       │
│  5. Generate 解题思路 (approach) │
│  6. write_output × 10 fields     │
└──────────────┬───────────────────┘
               │ stdio MCP protocol
               ▼
┌──────────────────────────────────┐
│  quiz-analyzer MCP Server        │
│                                  │
│  Tools:                          │
│  • batch_search_knowledge_points │  ← Mode A (fast)
│  • get_knowledge_point_children  │  ← Mode B (hierarchical)
│  • verify_knowledge_point_tags   │
│  • write_output (10 fields)      │
│  • search_quizzes / save_analysis│
└──────────────┬───────────────────┘
               │ in-memory indexes
               ▼
┌──────────────────────────────────┐
│  Data Layer                      │
│                                  │
│  knowledge-points.json           │  ← 31,497 nodes, ~8 MB
│  catalogs.json                   │  ← Subject definitions
│  quiz-analyzer.db (SQLite)       │  ← Quiz records only
└──────────────────────────────────┘
```

**Key design principle**: The knowledge point tree lives in JSON + in-memory Maps, not in SQLite. Quiz data stays in SQLite. The two datastores have different access patterns, so they use different storage strategies.

---

## 10 Sync Fields

The agent writes these fields via `write_output`. The frontend shows a "Sync to Form" button per field; users review and approve before the form updates.

| Field | Type | Description |
|-------|------|-------------|
| `quiz_analysis` | string | Overall analysis summary (Markdown) |
| `knowledge_point_tags` | `KnowledgePointTag[]` | Tags with confidence scores and source annotation |
| `thinking_process` | string | 解题思路 (Markdown) |
| `solution_steps` | `SolutionStep[]` | Detailed step-by-step breakdown |
| `correct_answer` | string | The answer |
| `common_mistakes` | `Mistake[]` | Mistakes with frequency and remediation |
| `knowledge_gap_analysis` | string | Gap analysis (Markdown) |
| `difficulty` | number 1–5 | Calculated from knowledge point count and step count |
| `related_quizzes` | `RelatedQuiz[]` | Similar quizzes with similarity scores |
| `time_estimate` | string | Estimated solving time |

---

## What Makes This Solution Interesting

The MCP layer solves a specific problem that appears in any domain with **deep hierarchical classification data**: how do you prevent the AI from tagging at too broad a level?

For example, "勾股定理" (Pythagorean theorem) looks like a leaf concept — but in the actual data, it is a parent node with two children: "勾股定理及其证明" (proof) and "勾股定理的实际应用" (application). Without guidance, the AI tags the quiz with the parent and misses the specific concept being tested.

Two mechanisms solve this:

**Mode A — Fast path**: `batch_search_knowledge_points(keywords, leafOnly: true)` searches all 31,497 nodes and post-filters to leaf nodes only. One tool call handles most quizzes with unambiguous keywords.

**Mode B — Hierarchical traversal**: When Mode A returns parent nodes (or zero results), the agent traverses the tree top-down: `list_subjects` → `list_root_knowledge_points` → `get_knowledge_point_children` (repeated per level) → `search_knowledge_points_under` (when a branch has many children). The agent makes an explicit judgment at each level about which subtree matches the quiz — mirroring how a human expert navigates a taxonomy.

The `leafOnly` algorithm and the two-mode protocol are documented in detail in the sub-page below.

---

## Sub-page

[**MCP Design: Hierarchical Data**](mcp-design.md) — leafOnly algorithm, 5 in-memory indexes, batchScore formula, and the stdio logging rule.
