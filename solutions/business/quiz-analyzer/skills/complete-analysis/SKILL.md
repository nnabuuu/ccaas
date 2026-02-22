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
search_knowledge_points_by_priority(["勾股定理", "直角三角形", "斜边"], leafOnly: true)
  → rounds[0]: keyword="勾股定理", newKPs=["勾股定理及其证明"（leaf）, "勾股定理的实际应用"（leaf）]
  → rounds[1]: keyword="直角三角形", newKPs=["直角三角形三边关系"（leaf）]（若未被 dedup）
  → rounds[2]: keyword="斜边", newKPs=[]（已在 seenIds 中，跳过）
  → AI 判断：求斜边 = 应用场景 → 选 "勾股定理的实际应用" ✅

Mode C 覆盖率不足时，切换 Mode B（兜底）：
  list_root_knowledge_points(subjectId)
  → AI 判断：选 "图形与几何" 分支
  get_knowledge_point_children("图形与几何 id")
  → 找到 "勾股定理"（isLeaf: false）
  get_knowledge_point_children("勾股定理 id")
  → 返回：
    - "勾股定理及其证明"（isLeaf: true）
    - "勾股定理的实际应用"（isLeaf: true）
  → AI 选择合适的叶节点 ✅
```

## 标准工作流

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

---

### 步骤 2: 标注知识点 🏷️

**目标**：区分题干来源（question）和解答来源（solution/both）的知识点

**执行搜索协议**（参见上方"知识点搜索协议"）

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
      "source": "both"
    }
  ],
  "preview": "已标注 2 个知识点"
}
```

---

### 步骤 3: 整体分析 📝

**字段**：`quiz_analysis`（Markdown 字符串）

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

### 步骤 4: 生成解题思路 💡

**字段**：`thinking_process`（Markdown 字符串）

使用 `generate_thinking_process_template` 获取模板，然后填充具体内容：

```json
{
  "field": "thinking_process",
  "value": "# 解题思路\n\n## 1. 审题\n...",
  "preview": "解题思路已生成"
}
```

---

### 步骤 5: 生成解题步骤 📐

**字段**：`solution_steps`（SolutionStep 数组，至少 2 步）

```json
{
  "field": "solution_steps",
  "value": [
    {
      "stepNumber": 1,
      "description": "根据勾股定理：a² + b² = c²",
      "formula": "3² + 4² = c²",
      "explanation": "代入已知直角边"
    },
    {
      "stepNumber": 2,
      "description": "计算斜边",
      "formula": "c = √25 = 5",
      "explanation": "开方得到斜边长度"
    }
  ],
  "preview": "解题步骤（2步）已生成"
}
```

---

### 步骤 6: 分析常见错误 ❌

**字段**：`common_mistakes`（Mistake 数组，至少 1 个）

```json
{
  "field": "common_mistakes",
  "value": [
    {
      "description": "混淆斜边和直角边，写成 a² + c² = b²",
      "frequency": "high",
      "remediation": "记住：斜边是最长边，勾股定理中 c 始终代表斜边"
    }
  ],
  "preview": "常见错误分析（1个）已完成"
}
```

---

### 步骤 7: 知识缺口分析 🔍

**字段**：`knowledge_gap_analysis`（Markdown 字符串）

分析学生在此类题目上常见的知识盲点：

```json
{
  "field": "knowledge_gap_analysis",
  "value": "学生常见的知识缺口：\n1. 不能正确识别斜边...",
  "preview": "知识缺口分析已完成"
}
```

---

### 步骤 8: 评估难度 📊

**字段**：`difficulty`（1-5 的数字）

难度评估因子：
- 知识点数量与深度（层级）
- 题目类型（主观题 > 填空题 > 选择题）
- 综合程度（多知识域 > 单知识域）

```json
{
  "field": "difficulty",
  "value": 2,
  "preview": "难度等级：2/5"
}
```

---

### 步骤 9: 预估解题时间 ⏱️

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

### 步骤 10: 推荐相关题目 🔗

**字段**：`related_quizzes`（RelatedQuiz 数组）

使用 `search_quizzes` 按知识点搜索相似题目，**必须排除当前题目本身**：

```json
{
  "field": "related_quizzes",
  "value": [
    {
      "id": "quiz-456",
      "title": "勾股定理逆定理应用",
      "similarity": 0.85,
      "reason": "同考察勾股定理，题型不同（逆定理判断）"
    }
  ],
  "preview": "推荐相关题目（3道）"
}
```

---

## 渐进式更新原则

⚠️ **关键**：每完成一个步骤，**立即**使用 `write_output` 更新前端，不要等到全部完成。

```
步骤2完成 → write_output(knowledge_point_tags)
步骤3完成 → write_output(quiz_analysis)
步骤4完成 → write_output(thinking_process)
步骤5完成 → write_output(solution_steps)
步骤6完成 → write_output(common_mistakes)
步骤7完成 → write_output(knowledge_gap_analysis)
步骤8完成 → write_output(difficulty)
步骤9完成 → write_output(time_estimate)
步骤10完成 → write_output(related_quizzes)
```

## 质量检查（输出前必须确认）

- [ ] 所有 10 个维度均已生成
- [ ] 知识点标签均为**叶节点**（isLeaf: true），不含父类节点
- [ ] 知识点标签包含正确的 `source` 字段（question/solution/both）
- [ ] 知识点置信度在 0.0-1.0 范围内
- [ ] 解题步骤至少 2 步
- [ ] 常见错误至少 1 个
- [ ] 难度在 1-5 范围内
- [ ] 相关题目推荐**已排除当前题目本身**
- [ ] 所有 Markdown 格式正确

## 持久化（可选）

分析完成后询问用户：

```
✅ 完整分析已生成！

我已完成以下 10 个维度的分析：
📝 整体分析、🏷️ 知识点标注（X个）、💡 解题思路
📐 解题步骤（X步）、❌ 常见错误（X个）、🔍 知识缺口分析
📊 难度等级（X/5）、⏱️ 预估时间、🔗 相关题目（X道）

是否需要将分析结果保存到数据库以便后续查询？
（调用 save_complete_analysis 持久化）
```

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
| `generate_thinking_process_template` | 生成思路模板 | 步骤4 |
| `search_quizzes` | 搜索相关题目 | 步骤10 |
| `write_output` | 实时同步到前端 | 每步完成后 |
| `save_complete_analysis` | 持久化到数据库 | 可选 |
