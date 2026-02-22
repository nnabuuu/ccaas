# MCP 层设计：层级数据

Quiz Analyzer MCP server 如何用叶节点优先搜索、内存索引和复合排序公式处理 31,497 个层级知识点。这些模式适用于任何存储读多写少的层级分类数据的领域。

---

## 1. leafOnly 算法

### 为什么中间父节点会污染结果

知识点树最深达 10 层。许多看起来是叶节点的知识点实际上是中间父节点。真实数据示例：

```
勾股定理（level 3，父节点）     ← "显而易见的叶节点" — 实际上是父节点
├── 勾股定理及其证明（level 4，叶节点 ✅）
└── 勾股定理的实际应用（level 4，叶节点 ✅）

一次函数（level 2，父节点）
├── 一次函数的解析式（level 3，叶节点 ✅）
├── 一次函数的图象与性质（level 3，父节点）
│   ├── 一次函数的图象的特点（level 4，叶节点 ✅）
│   └── k,b对一次函数图象及性质的影响（level 4，叶节点 ✅）
└── 一次函数图像的交点问题（level 3，叶节点 ✅）
```

如果不启用 `leafOnly: true`，搜索"勾股定理"会返回父节点。AI 将题目标注为"勾股定理"——正确但过于宽泛，漏掉了实际考察的具体概念（证明或应用）。

### 实现

```typescript
if (options?.leafOnly) {
  const leafResults = results.filter(r => r.children.length === 0)
  if (leafResults.length > 0) {
    results = leafResults  // 替换为仅叶节点的子集
  }
  // 如果没有叶节点匹配，静默回退到全部结果（不报错）
}
```

**叶节点检测是 O(1)**：`kp.children.length === 0`。这得益于 JSON 导出时预填充了每个节点的 `children[]` 数组 — 运行时无需查询子节点。

**回退保证**：`leafOnly: true` 在有匹配结果时永远不会返回空数组。如果过滤会清空所有结果，则静默放宽过滤。Agent 可以始终使用 `leafOnly: true`，无需防御性错误处理。

### 分数保留

`leafOnly` 是一个后处理过滤器。它不改变任何节点的 `matchScore` 或 `matchedKeywords`。叶节点的分数与不启用 `leafOnly` 时完全一致 — 排序不受影响。

---

## 2. 五个内存索引

### 为什么用 JSON + Map 而不是 SQLite 存知识点

原始实现通过 SQLite 查询知识点。切换到 JSON + 内存 Map 有四个原因：

| 关注点 | SQLite | JSON + Map |
|--------|--------|------------|
| 启动速度 | 数据库连接 + Schema 初始化 | 单次 JSON 解析 |
| 部署 | DB 文件 + 迁移 | 复制一个 JSON 文件 |
| 查询速度 | 每次请求一次 SQL 查询 | O(1) Map 查找 |
| 叶节点检测 | 运行时查询子节点 | O(1) — 预填充 `children[]` |

31,497 个知识点约占 8 MB 内存。对于这个数据集规模，只读查询场景下内存方案严格优于数据库。

### 五个索引

```typescript
// 启动时构建一次（O(n)），后续每次查询使用（O(1)）
kpById:       Map<string, KnowledgePoint>      // 按 ID 查找
kpByName:     Map<string, KnowledgePoint[]>    // 按精确名称查找
kpBySubject:  Map<string, KnowledgePoint[]>    // 按科目 ID 查找
subjectById:  Map<string, Subject>             // 按科目 ID 查找
subjectByName:Map<string, Subject[]>           // 按精确名称查找
```

文本搜索（在 `name` 和 `description` 中做子字符串匹配）仍需要 O(n) 扫描 — 但由于完整数据集在内存中，这个扫描只需几毫秒。

{% hint style="info" %}
**注意**：SQLite 数据库仍用于题目记录（`search_quizzes`、`get_quiz_details`、`save_complete_analysis`）。只有知识点树迁移到了 JSON。两个数据存储的访问模式不同：知识点是只读且关系密集的；题目记录是读写且面向行的。
{% endhint %}

---

## 3. batchScore 公式

### 公式

```
matchScore = matchedKeywords.length × 10 + kp.level
```

### 为什么用 ×10？

两个标准决定哪个知识点是最佳匹配：

1. **关键词命中数** — 命中 3 个关键词中 2 个的节点，比只命中 1 个的节点更相关。
2. **树深度** — 当两个节点命中相同数量的关键词时，更深（更精确）的节点优先。

×10 倍数确保关键词命中数**始终**主导排序。命中 2 个关键词的节点至少得 20 分。无论深度如何，任何单关键词节点都无法超越它（最大树深为 10，所以单关键词节点最高得 1×10+10=20 — 平局但永不领先）。实际数据中深度很少超过 6，差距更为明显。

### 示例

查询：`["二次函数", "对称轴"]`

| 节点 | 命中关键词数 | Level | matchScore |
|------|------------|-------|------------|
| 二次函数的对称轴（叶节点） | 2（全中） | 5 | **25** ← 胜出 |
| 二次函数（父节点） | 1 | 2 | 12 |
| 对称轴（不同分支） | 1 | 4 | 14 |

启用 `leafOnly: true` 后，即使二次函数（父节点）分数更高，也会被额外过滤掉。

---

## 4. stdio 协议：stdout 是通信信道

这个 MCP server 使用 **stdio 传输** — MCP 宿主（CCAAS Agent 引擎）将其作为子进程启动，通过 stdin/stdout 通信。

**规则**：stdout 属于 MCP 协议。Server 代码中的任何 `console.log()` 都会破坏协议流，导致 Agent 引擎收到格式错误的 JSON。

```typescript
// ✅ 正确 — stderr 可安全用于诊断
process.stderr.write('[quiz-tools] write_output: field=knowledge_point_tags\n')
console.error('Server started')  // 也可以

// ❌ 错误 — 破坏 MCP 协议
console.log('Server started')
console.log(JSON.stringify(debugData))
```

这适用于所有 stdio MCP server，与领域无关。记住这条规则：**日志写 stderr，永远不写 stdout**。

---

## 5. 可迁移场景

以下情况可以使用此 MCP server 中的模式：

- **读多写少的数据** — 知识点树在会话期间从不变化。当每次数据加载后有大量查询时，内存索引很值得。
- **数据集可放入内存（<~100 MB）** — 在这个规模下，JSON + Map 比数据库更简单、更快。
- **深度可变的层级分类** — 任何"显而易见的叶节点"可能不是最精确节点的分类体系（产品目录、医疗编码、法律分类、技能树）。
- **需要多关键词排序** — `matched × 10 + level` 公式适用于任何希望多关键词相关性主导单关键词深度的场景。
- **Agent 必须始终得到结果** — leafOnly 回退模式（仅在产生结果时应用过滤，否则返回全部）防止 Agent 陷入死角。
