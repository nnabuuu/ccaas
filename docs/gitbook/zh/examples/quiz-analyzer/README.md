# Quiz Analyzer

AI 将教育题目标注为 3.1 万节点层级树中最精确的匹配知识点，生成结构化解题思路，并将所有分析字段写入前端。

---

## 架构

```
┌──────────────────────────────────┐
│  AI Agent（exercise-planner Skill）│
│                                  │
│  1. 解析题干 → 关键词              │
│  2. 解析答案 → 解题方法类型         │
│  3. 搜索知识点树                   │
│  4. 选取叶节点标签                  │
│  5. 生成解题思路                   │
│  6. write_output × 10 个字段      │
└──────────────┬───────────────────┘
               │ stdio MCP 协议
               ▼
┌──────────────────────────────────┐
│  quiz-analyzer MCP Server        │
│                                  │
│  工具：                           │
│  • batch_search_knowledge_points │  ← leafOnly 模式
│  • get_children_nodes            │
│  • verify_knowledge_point_tags   │
│  • write_output（10 个字段）       │
│  • search_quizzes / save_analysis│
└──────────────┬───────────────────┘
               │ 内存索引
               ▼
┌──────────────────────────────────┐
│  数据层                           │
│                                  │
│  knowledge-points.json           │  ← 31,497 节点，约 8 MB
│  catalogs.json                   │  ← 科目定义
│  quiz-analyzer.db（SQLite）       │  ← 仅题目记录
└──────────────────────────────────┘
```

**核心设计原则**：知识点树存储于 JSON + 内存 Map，而非 SQLite。题目数据保留在 SQLite。两个数据存储的访问模式不同，因此采用不同的存储策略。

---

## 10 个同步字段

Agent 通过 `write_output` 写入以下字段。前端为每个字段显示"同步到表单"按钮，用户确认后才更新表单。

| 字段 | 类型 | 描述 |
|------|------|------|
| `quiz_analysis` | string | 整体分析摘要（Markdown） |
| `knowledge_point_tags` | `KnowledgePointTag[]` | 带置信度和来源标注的标签 |
| `thinking_process` | string | 解题思路（Markdown） |
| `solution_steps` | `SolutionStep[]` | 详细步骤分解 |
| `correct_answer` | string | 答案 |
| `common_mistakes` | `Mistake[]` | 常见错误及补救措施 |
| `knowledge_gap_analysis` | string | 知识漏洞分析（Markdown） |
| `difficulty` | number 1–5 | 基于知识点数和步骤数计算 |
| `related_quizzes` | `RelatedQuiz[]` | 相似题目及相似度分数 |
| `time_estimate` | string | 预计解题时间 |

---

## 这个 Solution 有什么值得关注的

MCP 层解决了一个在**深层级分类数据**领域普遍存在的问题：如何防止 AI 在过于宽泛的层级打标？

例如，"勾股定理"看起来像一个叶节点，但在实际数据中它是一个父节点，包含两个子节点："勾股定理及其证明"和"勾股定理的实际应用"。如果没有引导，AI 会将题目标注为父节点，漏掉被实际考察的具体概念。

`batch_search_knowledge_points` 中的 `leafOnly` 算法解决了这个问题。完整分析见子页。

---

## 子页

[**MCP 层设计：层级数据**](mcp-design.md) — leafOnly 算法、5 个内存索引、batchScore 公式，以及 stdio 日志规则。
