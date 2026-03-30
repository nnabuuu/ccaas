---
name: Quiz Analyzer - Complete Analysis
description: 完整分析题目所有 10 个维度，包含层级遍历知识点搜索协议
---

# Skill: 完整题目分析

## 概述

对题目进行全面深度分析，生成 10 个维度的分析结果并实时同步到前端。

核心特色：使用**层级遍历协议**精准定位知识点，确保标注的是叶节点（最具体的知识点），而非泛化的父类节点。

## 目标

1. 获取题目完整信息（内容、答案、类型）
2. 精准标注知识点（区分题干/解答来源，使用层级遍历确保叶节点）
3. 生成 10 个分析维度，实时通过 `write_output` 同步到前端
4. 询问用户是否持久化到数据库

## ⚠️ 关键执行规则（必读）

### 🔴 静默高效模式（最重要的规则）

> **你的 token 预算有限。** 每一个多余的字都在浪费预算，可能导致后面的字段无法输出。

**强制规则**：
1. **禁止输出解题过程的文字说明**。不要在聊天中写"让我来分析这道题…"、"首先我们看到…"之类的文字。**直接调用工具**。
2. **每步只输出一行确认**：`✅ N` （N=步骤号）。不要复述字段内容。
3. **禁止在 write_output 调用之间输出分析文字**。你的工作是**调用工具**，不是写文章。
4. **知识点搜索**：Mode C 一次调用即可。如果第一轮结果已覆盖核心考点，**立即停止搜索**。
5. **不调用非必需工具**：`generate_thinking_process_template` 可跳过，直接生成思路内容。

### 10 个核心字段必须全部输出

以下字段**全部必须**通过 `write_output` 输出，**一个都不能跳过**：

| # | write_output field 名 | 步骤 |
|---|----------------------|------|
| 1 | `parsed_content` | 步骤1 |
| 2 | `correct_answer` | 步骤1 |
| 3 | `knowledge_point_tags` | 步骤2 |
| 4 | `quick_summary` | 步骤3 |
| 5 | `analysis_strategy` | 步骤4 |
| 6 | `thinking_process` | 步骤5 |
| 7 | `solution_steps` | 步骤6 |
| 8 | `common_mistakes` | 步骤7 |
| 9 | `knowledge_gap_analysis` | 步骤8 |
| 10 | `difficulty_assessment` | 步骤9 |

> ⚠️ 以上 10 个是**评估核心字段**，必须全部输出。特别注意 `analysis_strategy`、`knowledge_gap_analysis`、`difficulty_assessment` 三个字段历史上最常被遗漏。

另外还需输出（非核心但必须尽量输出）：`quiz_analysis`（步骤3）、`difficulty`、`time_estimate`（步骤9-10）。

### 工具调用纪律

1. **严格顺序执行**：每次只调用一个 `write_output`，等返回后再调用下一个。**禁止并行调用多个 write_output**。
2. **🔴 绝对禁止重试规则（最高优先级）**：
   - 如果 `write_output` 返回**任何错误**（包括但不限于 `"Sibling tool call errored"`、HTTP 429、超时、unknown error），**禁止对同一字段再次调用 `write_output`**。
   - **每个字段最多调用 1 次 write_output**。没有例外。
   - 违反此规则会浪费 token 预算，导致后续核心字段（如 `analysis_strategy`、`knowledge_gap_analysis`）无法输出，严重扣分。
3. **不要跳步**：按步骤 1→2→3→4→5→6→7→8→9→10→11 顺序执行，每一步都必须完成。

### 容错与恢复策略

> ⚠️ **核心原则：完成比完美更重要。** 遇到任何错误，优先保证所有 10 个核心字段都被输出。

1. **HTTP 429 限流处理**：如果遇到 HTTP 429 或 rate limit 错误，**不要恐慌，不要放弃**。记住失败的字段名，**跳过继续执行后续步骤**。到补漏扫描时再尝试补输出。
2. **其他工具调用失败**：如果 `write_output` 返回 "Sibling tool call errored" 或超时，**记住该字段名，跳过继续**。
3. **补漏扫描（必须执行）**：完成步骤 1-11 后，**必须**回顾哪些核心字段未成功写入。对每个缺失字段，**再尝试一次** `write_output`。
4. **极端情况（多个字段失败）**：如果超过 3 个核心字段失败，停止非核心步骤（步骤10、11），集中精力补输出核心字段。

## 知识点搜索协议

### 选择搜索模式

| 情况 | 选用模式 |
|------|---------|
| **所有题目**（主路径） | **Mode C（按优先级迭代搜索）** |
| Mode C 找不到 KP，或需要精确定位深层叶节点 | Mode B（层级遍历兜底） |

### Mode C：按优先级迭代搜索（主路径）

```
1. 从题干和答案提取 3-5 个关键词，按"核心程度"排序（最重要的在前）
2. 调用 search_knowledge_points_by_priority(keywords, leafOnly: true)
3. 审查返回的 rounds：
   - rounds[0].newKPs 是最重要关键词的结果 → 几乎总是需要选用
   - rounds[N].newKPs 为空 → 该关键词未找到新知识点，可忽略
   - 判断"看到第几轮就能解释题目所有要考察的内容"
4. 只选用必要轮次的结果，忽略多余轮次
5. 若 coveredKeywords 覆盖不足（核心概念未命中）→ 切换 Mode B 精确定位
```

**Mode C 示例（勾股定理题）**：
```
输入: keywords = ["勾股定理", "直角三角形", "面积"]
（最重要的放最前面）

返回:
rounds[0]: keyword="勾股定理", newKPs=["勾股定理的实际应用"], cumulativeCount=1
rounds[1]: keyword="直角三角形", newKPs=["直角三角形三边关系"], cumulativeCount=2
rounds[2]: keyword="面积", newKPs=[], cumulativeCount=2

→ Agent 判断：rounds[0] 直接命中核心知识点，rounds[2] 无新增
→ 选用 rounds[0] + rounds[1] 的结果即可
```

### Mode B：层级遍历（兜底路径）

```
Step 1: 获取根节点（按年级直接筛选）
  list_root_knowledge_points({ gradeLevel: "初中" })
  → 返回该年级下所有根节点，AI 判断题目属于哪个科目分支

Step 2: 从选中分支开始
  list_root_knowledge_points(subjectId)
  → 返回 ["数与代数", "图形与几何", "统计与概率", ...]
  → AI 判断：这道题属于哪个大类？选 1-2 个分支

Step 3: 逐层向下展开
  get_knowledge_point_children(selectedNodeId)
  → 返回子节点列表（每个节点含 isLeaf, childCount）
  → AI 判断：
    - isLeaf: true → 加入候选叶节点列表
    - isLeaf: false → 继续向下展开

Step 4: 精确匹配（当子节点 >10 个时）
  search_knowledge_points_under(currentNodeId, keyword)
  → 在选定子树内做关键词搜索，避免手动遍历过多节点

Step 5: 确认与标注
  verify_knowledge_point_tags(selectedIds) → 确认 ID 存在
  ℹ️ Mode A/C 已内联 fullName/pathNames，无需额外调用 get_knowledge_point_path
  write_output(field: 'knowledge_point_tags', ...)
```

### 实例：勾股定理题

```
题目：直角三角形两直角边为 3 和 4，求斜边长度。

Mode C（主路径）：
search_knowledge_points_by_priority(["勾股定理", "直角三角形"], leafOnly: true)
  → rounds[0]: newKPs=["勾股定理的实际应用"（leaf）] ✅
  → rounds[1]: newKPs=["直角三角形三边关系"（leaf）]
  → 选 "勾股定理的实际应用" ✅ → 停止搜索

Mode C 覆盖不足 → 切换 Mode B 层级遍历兜底
```

## 标准工作流

> 🔴 **执行前提醒**：你正在进入静默高效模式。从现在开始，**只调用工具和输出 `✅ N` 确认**。不要写分析文字。你的 token 预算只够完成 10 个 write_output + 必要的搜索工具调用。

### 步骤 1: 获取题目信息 📋

**工具**：`get_quiz_details`（题目 ID 方式）或直接从用户输入获取

获取：
- 题目内容（题干 + 选项）
- 参考答案
- 题目类型（选择题/填空题/解答题）
- 已有标注（若有）

**立即更新前端**：
```json
{
  "field": "quiz_analysis",
  "value": "正在分析题目...",
  "preview": "分析已开始"
}
```

**解析题目内容**（输出 `parsedContent`）：

根据题目格式判断题型并结构化解析：

| 判断规则 | quizType | 示例 |
|---------|----------|------|
| 有 A/B/C/D 选项或"（  ）"括号 | `choice` | "下列哪个…（ ）A.… B.…" |
| 有"______"或"= ______"填空符号 | `fill` | "分解因式：x²-9 = ______" |
| 以"求解""解方程""求…的值""证明"等开头 | `subjective` | "求解方程 x²-5x+6=0" |
| 计算题、应用题、证明题 | `subjective` | "某商场…求进价" |

> ⚠️ 注意：**计算题和应用题都归为 `subjective`**，不是 `fill`。只有明确有"______"填空符的才是 `fill`。

```json
{
  "field": "parsed_content",
  "value": {
    "stem": "判断方程 x² - 4x + 4 = 0 的根的情况",
    "options": ["两个不相等的实数根", "两个相等的实数根", "没有实数根", "无法判断"],
    "correctAnswer": "B",
    "quizType": "choice"
  },
  "preview": "题目解析完成"
}
```

> ⚠️ `options` 规则：
> - 选择题 → 选项**纯内容**数组，**必须去掉 A./B./C./D. 前缀**
> - 填空题/解答题 → 空数组 `[]`
>
> 🔴 **选项格式对比（必看）**：
> ```
> ❌ 错误: ["A. 两个不相等的实数根", "B. 两个相等的实数根", "C. 没有实数根", "D. 无法判断"]
> ✅ 正确: ["两个不相等的实数根", "两个相等的实数根", "没有实数根", "无法判断"]
> ```
> 去掉所有 `A.`/`B.`/`C.`/`D.` 前缀及其后面的空格，只保留纯选项文本。

**确定正确答案**（输出 `correctAnswer`）：

> 🔴 **答案必须正确。** 先独立解题，再用不同方法验证。两次结果一致才输出。

**按题型验证（内心默算，不要输出验证过程到聊天）**：
- **选择题**：计算后将答案与选项匹配，再将选项代入原条件排查确认。**只输出字母**（如 `"B"`），不写选项内容。
- **填空题**：将结果代回原式验证。输出最简结果（如 `"(x+3)(x-3)"`）。
- **解答题/计算题**：用另一种解法代入检验。输出完整结论（如 `"x₁ = 2, x₂ = 3"`）。

> ⚠️ **correctAnswer 与 solutionSteps 最后一步结论必须一致**，不一致会触发 -10 罚分。

```json
{
  "field": "correct_answer",
  "value": "B",
  "preview": "正确答案：B"
}
```

---

### 步骤 2: 标注知识点 🏷️

**目标**：区分题干来源（question）和解答来源（solution/both）的知识点

**执行搜索协议**（参见上方"知识点搜索协议"）

**知识点覆盖规则**：
> 🔴 **同时标注具体知识点和所属大类。** 例如题目考察"一元二次方程的判别式"，需要标注：
> 1. 叶节点"一元二次方程根的判别式"（具体考点，confidence 高）
> 2. 父类"一元二次方程"（所属知识域，confidence 稍低 0.7-0.85，作为独立标签）
>
> 这确保教师既能看到具体考点，也能看到知识域归属。标签数量建议 2-3 个。

**置信度规则**：
| 匹配情况 | 置信度 |
|---------|-------|
| 关键词完全匹配叶节点名称 | 0.9-1.0 |
| 关键词部分匹配 | 0.7-0.9 |
| 相关知识点（父子关系推断） | 0.5-0.7 |
| 间接相关 | 0.3-0.5 |

**source 字段规则**：
- `question`：仅在题干中出现
- `solution`：仅在标准答案/解法中出现
- `both`：题干和解法均涉及

**立即更新前端**：
```json
{
  "field": "knowledge_point_tags",
  "value": [
    {
      "id": "1998702114322400157",
      "name": "勾股定理及其证明",
      "confidence": 0.95,
      "verified": true,
      "level": 3,
      "path": ["数学", "图形与几何", "勾股定理", "勾股定理及其证明"],
      "source": "both"
    }
  ],
  "preview": "已标注 2 个知识点"
}
```

---

### 步骤 3: 整体分析 📝

> ⚠️ 先输出 quick_summary，再输出 quiz_analysis。**逐个调用，不要并行**。
> 🔴 **quiz_analysis 写入失败 → 直接跳到步骤 4，绝不重试。** quiz_analysis 不是 10 个核心字段之一，失败不影响评分。把 token 预算留给后面的核心字段。

**3a. 先输出快速摘要**（`quickSummary`）：

用一句话（20-50字）概括题目考点和核心思路，供教师快速浏览：

```json
{
  "field": "quick_summary",
  "value": "本题考察勾股定理求斜边，需代入公式 a²+b²=c² 计算",
  "preview": "快速摘要已生成"
}
```

**3b. 再输出整体分析**（`quiz_analysis`，Markdown 字符串）：

内容包括：
- 题目核心考察点
- 解题关键思路
- 与知识点的关联

```json
{
  "field": "quiz_analysis",
  "value": "# 题目分析\n\n本题考察勾股定理的实际应用...",
  "preview": "整体分析已完成"
}
```

---

### 步骤 4: 分析策略 🎯（⚠️ 必须输出，禁止跳过）

**字段**：`analysisStrategy`（结构化对象）

> ⚠️ 此字段在历史记录中经常被遗漏。你**必须**在此步骤调用 write_output 输出 analysis_strategy，不得跳过。

分析解题的目标分解和路径选择：

```json
{
  "field": "analysis_strategy",
  "value": {
    "goal": "求直角三角形斜边长度",
    "goalDecomposition": "已知两直角边，需要找到斜边与直角边的关系公式，代入计算",
    "approaches": [
      { "name": "勾股定理法", "description": "利用 a²+b²=c² 直接求解", "viability": "viable", "reason": "完全满足勾股定理使用条件" },
      { "name": "三角函数法", "description": "利用正弦或余弦求解", "viability": "complex", "reason": "需先求角度，更复杂" }
    ],
    "chosenApproach": "勾股定理法",
    "keyInsight": "识别直角三角形结构，确认已知两直角边后直接应用勾股定理"
  },
  "preview": "分析策略已生成"
}
```

> ⚠️ `approaches` 至少 1 个，最多 5 个。`viability` 只能是 `viable`/`complex`/`dead_end`。

---

### 步骤 5: 生成解题思路 💡

**字段**：`thinking_process`（Markdown 字符串）

> ⚠️ **不要调用 `generate_thinking_process_template`**，直接生成以下结构的 Markdown 内容（节省一次工具调用）：

```markdown
# 解题思路

## 1. 审题
[识别已知条件和求解目标]

## 2. 分析
[确定解题方法和关键公式]

## 3. 求解
[分步计算过程]

## 4. 验证
[检验答案正确性]
```

```json
{
  "field": "thinking_process",
  "value": "# 解题思路\n\n## 1. 审题\n...\n\n## 2. 分析\n...\n\n## 3. 求解\n...\n\n## 4. 验证\n...",
  "preview": "解题思路已生成"
}
```

---

### 步骤 6: 生成解题步骤 📐

**字段**：`solution_steps`（SolutionStep 数组，至少 2 步）

> ⚠️ 质量要求：
> - 每步必须有 `title`（简短标题）和 `description`（详细描述，≥20字）
> - **涉及数学公式/计算的步骤必须提供 `formula` 字段**（如代入公式、计算过程），`reasoning` 为可选
> - **最后一步的结论必须与 `correctAnswer` 一致**（否则会触发 -10 分罚分）
> - 步骤数量参考：简单题 2-3 步，中等题 3-4 步，复杂题 4-5 步
>
> 🔴 **formula 字段示例**：
> ```json
> {
>   "stepNumber": 2, "title": "计算判别式 Δ",
>   "description": "将系数 a=1, b=-4, c=4 代入判别式公式计算",
>   "formula": "Δ = b² - 4ac = (-4)² - 4×1×4 = 16 - 16 = 0",
>   "reasoning": "Δ = 0 说明方程有两个相等的实数根"
> }
> ```
> 只要步骤中出现了数学运算（代入、化简、求解），就必须把运算写入 `formula` 字段。

```json
{
  "field": "solution_steps",
  "value": [
    {
      "stepNumber": 1,
      "title": "列出勾股定理公式",
      "description": "根据勾股定理，直角三角形中两直角边的平方和等于斜边的平方：a² + b² = c²",
      "formula": "3² + 4² = c²",
      "reasoning": "题目给出直角三角形，已知两直角边，可直接应用勾股定理"
    },
    {
      "stepNumber": 2,
      "title": "代入计算求斜边",
      "description": "将已知直角边 a=3, b=4 代入公式，计算得 c² = 9 + 16 = 25，开方得 c = 5",
      "formula": "c = √(9 + 16) = √25 = 5",
      "reasoning": "代入数值后直接计算即可"
    }
  ],
  "preview": "解题步骤（2步）已生成"
}
```

---

### 步骤 7: 分析常见错误 ❌

**字段**：`common_mistakes`（Mistake 数组，至少 1 个）

> ⚠️ 每个错误必须有 `knowledgeGaps`（字符串数组）标识关联的知识薄弱点。

```json
{
  "field": "common_mistakes",
  "value": [
    {
      "description": "混淆斜边和直角边，写成 a² + c² = b²",
      "frequency": "high",
      "knowledgeGaps": ["勾股定理公式记忆", "直角三角形边的命名"],
      "remediation": "记住：斜边是最长边，勾股定理中 c 始终代表斜边"
    }
  ],
  "preview": "常见错误分析（1个）已完成"
}
```

---

### 步骤 8: 知识缺口分析 🔍（⚠️ 必须输出，禁止跳过）

**字段**：`knowledge_gap_analysis`（Markdown 字符串）

> ⚠️ 此字段在历史记录中经常被遗漏。你**必须**在此步骤调用 write_output 输出 knowledge_gap_analysis，不得跳过。

分析学生在此类题目上常见的知识盲点：

```json
{
  "field": "knowledge_gap_analysis",
  "value": "学生常见的知识缺口：\n1. 不能正确识别斜边...",
  "preview": "知识缺口分析已完成"
}
```

---

### 步骤 9: 评估难度 📊（⚠️ 核心字段，禁止跳过）

**字段**：`difficultyAssessment`（结构化对象，含分数、易错点、理由）

> ⚠️ `difficulty_assessment` 是 10 个核心字段之一，历史上经常因前面步骤耗时过长而被跳过。**必须**输出。

难度评估因子：
- 知识点数量与深度（层级）
- 题目类型（主观题 > 填空题 > 选择题）
- 综合程度（多知识域 > 单知识域）

```json
{
  "field": "difficulty_assessment",
  "value": {
    "score": 2,
    "pitfalls": ["容易混淆直角边和斜边", "开方计算出错"],
    "reasoning": "本题只考察勾股定理的直接应用，代入公式即可求解，属于基础题"
  },
  "preview": "难度评估：2/5"
}
```

> ⚠️ `score` 为 1-5 整数。`pitfalls` 至少 1 个字符串。

同时输出简单难度字段（兼容）：
```json
{
  "field": "difficulty",
  "value": 2,
  "preview": "难度等级：2/5"
}
```

---

### 步骤 10: 预估解题时间 ⏱️

**字段**：`time_estimate`（字符串）

根据题目类型和难度预估：

```json
{
  "field": "time_estimate",
  "value": "约 3-5 分钟",
  "preview": "时间预估：约 3-5 分钟"
}
```

---

### 步骤 11: 推荐相关题目 🔗

**字段**：`related_quizzes`（RelatedQuiz 数组）

使用 `search_quizzes` 按知识点搜索相似题目，**必须排除当前题目本身**：

```json
{
  "field": "related_quizzes",
  "value": [
    {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "content": "在直角三角形中，两直角边分别为5和12，求斜边长度",
      "similarity": 0.85,
      "sharedKnowledgePoints": ["勾股定理", "直角三角形"]
    }
  ],
  "preview": "推荐相关题目（3道）"
}
```

> ⚠️ `id` 必须是 UUID 格式。`content` 是题目内容（不是 title）。`sharedKnowledgePoints` 是共同知识点名称数组。

---

## 渐进式更新原则

⚠️ **关键**：每完成一个步骤，**立即**使用 `write_output` 更新前端，不要等到全部完成。

```
步骤1 → write_output(parsed_content)     ← 等返回后
步骤1 → write_output(correct_answer)     ← 等返回后
步骤2 → write_output(knowledge_point_tags) ← 等返回后
步骤3 → write_output(quick_summary)      ← 先输出摘要
步骤3 → write_output(quiz_analysis)      ← 再输出分析（失败则跳过）
步骤4 → write_output(analysis_strategy)  ← ⚠️ 禁止跳过
步骤5 → write_output(thinking_process)   ← 等返回后
步骤6 → write_output(solution_steps)     ← 等返回后
步骤7 → write_output(common_mistakes)    ← 等返回后
步骤8 → write_output(knowledge_gap_analysis) ← ⚠️ 核心字段，禁止跳过
步骤9 → write_output(difficulty_assessment) ← ⚠️ 核心字段，禁止跳过
步骤9 → write_output(difficulty)          ← 等返回后
步骤10 → write_output(time_estimate)     ← 等返回后
步骤11 → write_output(related_quizzes)   ← 等返回后
```

> ⚠️ 重要：每个 write_output **必须等前一个返回后再调用下一个**。禁止并行调用。

## 质量检查与补漏扫描（⚠️ 必须执行，不可跳过）

> 🔴 **这是最关键的步骤。** 步骤 1-11 完成后，**必须执行以下补漏检查**。

### 补漏扫描（强制）

逐个检查以下 10 个核心字段是否已成功写入。**对每个缺失字段，立即调用 write_output 补输出：**

| # | 字段名 | 已输出？ | 若缺失则补输出 |
|---|--------|---------|---------------|
| 1 | `parsed_content` | ？ | 根据题目内容生成 {stem, options, correctAnswer, quizType} |
| 2 | `correct_answer` | ？ | 独立解题并验证 |
| 3 | `knowledge_point_tags` | ？ | 用 Mode C 搜索关键词 |
| 4 | `quick_summary` | ？ | 一句话概括考点 |
| 5 | `analysis_strategy` | ？ | 生成 {goal, goalDecomposition, approaches, chosenApproach, keyInsight} |
| 6 | `thinking_process` | ？ | 生成 Markdown 解题思路 |
| 7 | `solution_steps` | ？ | 生成 ≥2 步的 SolutionStep 数组 |
| 8 | `common_mistakes` | ？ | 生成 ≥1 个 Mistake 对象 |
| 9 | `knowledge_gap_analysis` | ？ | 生成 Markdown 知识缺口分析 |
| 10 | `difficulty_assessment` | ？ | 生成 {score: 1-5, pitfalls: [≥1], reasoning} |

> ⚠️ **10 个字段全部成功写入后，分析才算完成。** 如果仍有字段因错误无法写入，在聊天中明确告知用户哪些字段缺失。

### 质量自检

- [ ] `correctAnswer` 经过独立验算确认正确
- [ ] `parsedContent.quizType` 与题目格式匹配（choice/fill/subjective）
- [ ] `parsedContent.options`：选择题 → 选项数组（去掉 A/B/C/D 前缀）；非选择题 → 空数组 `[]`
- [ ] 知识点标签均为**叶节点**（isLeaf: true），含 `verified`、`level`、`path`、`source` 字段
- [ ] 解题步骤至少 2 步，**最后一步结论与 correctAnswer 一致**
- [ ] 常见错误至少 1 个，每个有 `knowledgeGaps` 数组
- [ ] 所有输出为**中文**

## 持久化（可选）

分析完成后简要询问用户是否保存：`✅ 分析完成（10/10字段）。是否保存到数据库？`

## MCP 工具清单

| 工具名称 | 用途 | 步骤 |
|---------|------|------|
| `get_quiz_details` | 获取题目信息 | 步骤1 |
| `search_knowledge_points_by_priority` | **Mode C 按优先级迭代搜索（主路径）** | 步骤2 |
| `list_root_knowledge_points` | **Mode B 入口：按年级获取根节点** | 步骤2 Mode B |
| `get_knowledge_point_children` | 逐层展开 | 步骤2 Mode B |
| `search_knowledge_points_under` | 子树内搜索 | 步骤2 Mode B |
| `verify_knowledge_point_tags` | 验证知识点存在 | 步骤2 确认 |
| `get_knowledge_point_path` | 构建面包屑（Mode B 专用，Mode A/C 已内联） | 步骤2 Mode B 确认 |
| `generate_thinking_process_template` | 生成思路模板 | 步骤5 |
| `search_quizzes` | 搜索相关题目 | 步骤11 |
| `write_output` | 实时同步到前端 | 每步完成后 |
| `save_complete_analysis` | 持久化到数据库 | 可选 |
