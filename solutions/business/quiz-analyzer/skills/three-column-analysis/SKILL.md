---
name: Quiz Analyzer - Three Column Analysis
description: 三栏布局题目分析 - 解析题目、标注知识点、查找目录、生成思路（使用 JSON 数据源）
---

# Skill: Quiz Three-Column Analysis (三栏布局题目分析)

## 概述

配合前端三栏布局，提供完整的题目分析流程：解析题目 → 标注知识点 → 查找目录 → 生成思路。

## 目标

1. 将原始题目文本解析为结构化数据（题干、选项、答案）
2. 使用 JSON 数据源快速查找知识点和目录
3. 实时更新前端中栏展示（通过 `write_output`）
4. 支持纯题目分析和题目+学生答案分析两种模式

## 触发条件

前端用户点击 "🚀 开始分析" 按钮后，发送包含以下结构的提示词：

```
请帮我分析这道题目：

【题目内容】
{content}

【参考答案】
{correctAnswer}

【学生答案】 (可选)
{studentAnswer}

请按以下步骤进行分析：
1. 使用 parse_quiz_content 工具解析题目内容（题干、选项、题型）
2. 使用 batch_search_knowledge_points（leafOnly: true）标注相关知识点；如有父节点混入，使用层级遍历（Mode B）精确定位
3. 使用 list_subjects 工具查找所属目录
4. (可选) 分析学生答案的错误原因和知识盲点
5. 生成标准解题思路

请使用 write_output 工具将每个步骤的结果写入对应字段。
```

## 核心原则

### 1. 渐进式分析

⚠️ **关键**：每完成一个步骤，**立即**使用 `write_output` 更新前端，实现流式展示。

```
步骤1完成 → write_output(parsedQuiz)
步骤2完成 → write_output(knowledgePointTags)
步骤3完成 → write_output(catalog)
步骤4完成 → write_output(difficulty)
步骤5完成 → write_output(thinkingProcess)
```

### 2. 工具调用顺序

✅ **必须严格按顺序**：
1. `parse_quiz_content` - 解析题目（前置步骤）
2. `search_knowledge_points_by_priority` - 标注知识点，Mode C（依赖题目内容）；核心概念未命中时切换 Mode B 层级遍历
3. `list_subjects` - 查找目录（依赖知识点）
4. `write_output` - 更新前端（每步完成后）

❌ **禁止**：
- 跳过任何步骤
- 并行调用依赖工具
- 延迟 `write_output` 调用

### 3. 数据源选择

优先使用 **JSON 数据源** (更快):
- ✅ `search_knowledge_points_by_priority` (Mode C，按优先级迭代搜索，leafOnly: true)
- ✅ `list_subjects` (科目搜索，JSON)
- ✅ `list_root_knowledge_points` / `get_knowledge_point_children` / `search_knowledge_points_under` (Mode B 层级遍历兜底，JSON)
- ⚠️ `search_knowledge_points` (仅在以上工具失败时使用)

## 标准工作流

### 步骤 1: 解析题目内容 📝

**目标**：将原始文本转换为结构化数据

**工具**：`parse_quiz_content`

**输入**：
```json
{
  "content": "已知函数 f(x) = x² - 2x + 1，求 f(x) 的最小值。\nA. -1\nB. 0\nC. 1\nD. 2"
}
```

**输出**：
```json
{
  "stem": "已知函数 f(x) = x² - 2x + 1，求 f(x) 的最小值。",
  "options": ["A. -1", "B. 0", "C. 1", "D. 2"],
  "quizType": "choice"
}
```

**立即更新前端**：
```json
// write_output
{
  "field": "parsedQuiz",
  "value": {
    "stem": "...",
    "options": [...],
    "correctAnswer": "B",  // 来自用户输入
    "quizType": "choice"
  },
  "preview": "题目解析完成"
}
```

**前端效果**：中栏立即显示题干和选项

---

### 步骤 2: 标注知识点 🏷️

**目标**：从题目内容中提取关键词，查找相关知识点

#### 2.1 知识点搜索协议

**选择搜索模式：**

| 情况 | 选用模式 |
|------|---------|
| **所有题目**（主路径） | **Mode C（按优先级迭代搜索）** |
| Mode C 核心概念未命中，或返回父节点 | Mode B（层级遍历兜底） |

**Mode C：按优先级迭代搜索（主路径）**

```
1. 从题干和答案提取 3-5 个关键词，按"核心程度"排序（最重要的在前）
2. 调用 search_knowledge_points_by_priority(keywords, leafOnly: true)
3. 审查返回的 rounds：
   - rounds[0].newKPs 是最重要关键词的结果 → 几乎总是需要选用
   - rounds[N].newKPs 为空 → 该关键词无新知识点，可忽略
   - 判断"看到第几轮就能解释题目所有要考察的内容"
4. 选用必要轮次的 KP，忽略多余轮次
5. 若核心关键词未命中（coveredKeywords 缺失重要概念）→ 切换 Mode B
```

**Mode B：层级遍历（兜底路径）**

```
Step 1: 识别科目
  list_subjects(科目名) → 获取 subjectId

Step 2: 从根节点开始
  list_root_knowledge_points(subjectId)
  → 返回顶层分类（如"数与代数"、"图形与几何"）
  → AI 判断：这道题属于哪个大类？选 1-2 个分支

Step 3: 向下展开
  get_knowledge_point_children(selectedNodeId)
  → 返回子节点列表（含 isLeaf 信息）
  → AI 判断：已到叶节点？
    → isLeaf: true → 加入候选列表
    → isLeaf: false → 继续向下展开

Step 4: 精确匹配（可选，当分支有 >10 个子节点时）
  search_knowledge_points_under(currentNodeId, keyword)
  → 在选定子树内做关键词搜索，快速定位

Step 5: 确认与标注
  verify_knowledge_point_tags(selectedIds) → 确认 ID 存在
  ℹ️ Mode A/C 已内联 fullName/pathNames，无需额外调用 get_knowledge_point_path
  write_output(field: 'knowledge_point_tags', ...)
```

**实例（勾股定理）：**
- Mode A 搜索 "勾股定理" → 返回父节点（isLeaf: false，有 2 个子节点）
- 切换 Mode B：`get_knowledge_point_children("勾股定理 id")`
  → 返回 "勾股定理及其证明"（isLeaf: true）和 "勾股定理的实际应用"（isLeaf: true）
- AI 判断题目考的是证明方法 → 选 "勾股定理及其证明" ✅

---

#### 2.2 提取关键词

从题干和选项中识别学科关键词：

**示例**：
- 题干："已知函数 f(x) = x² - 2x + 1，求 f(x) 的最小值"
- 关键词：`["函数", "二次函数", "最小值", "最值"]`

**策略**：
- 数学题：函数类型、运算方法、问题类型
- 物理题：物理量、定律名称、实验器材
- 化学题：物质名称、反应类型、实验操作

#### 2.2 搜索知识点（JSON 数据源）

**工具**：`search_knowledge_points`（单关键词备用）或 `batch_search_knowledge_points`（多关键词首选）

**多关键词搜索**：
```json
// 搜索 "二次函数"
{
  "keyword": "二次函数",
  "limit": 5
}

// 搜索 "最值"
{
  "keyword": "最值",
  "limit": 5
}

// 搜索 "函数"
{
  "keyword": "函数",
  "limit": 3
}
```

**结果去重**：
- 按 `id` 去重
- 按 `level` 排序（优先选择深层级节点）
- 选择最相关的 3-5 个知识点

#### 2.3 计算置信度

根据匹配程度评估置信度：

| 匹配情况 | 置信度 |
|---------|-------|
| 关键词完全匹配知识点名称 | 0.9-1.0 |
| 关键词部分匹配 | 0.7-0.9 |
| 相关知识点（父子关系） | 0.5-0.7 |
| 间接相关 | 0.3-0.5 |

**示例**：
```json
[
  {
    "id": "kp_123",
    "name": "二次函数的图像与性质",
    "confidence": 0.95,  // "二次函数" 完全匹配
    "source": "题干"
  },
  {
    "id": "kp_456",
    "name": "函数的最值",
    "confidence": 0.90,  // "最值" 完全匹配
    "source": "题干"
  }
]
```

#### 2.4 立即更新前端

```json
// write_output
{
  "field": "knowledgePointTags",
  "value": [
    {
      "id": "kp_123",
      "name": "二次函数的图像与性质",
      "confidence": 0.95
    },
    {
      "id": "kp_456",
      "name": "函数的最值",
      "confidence": 0.90
    }
  ],
  "preview": "已标注 2 个知识点"
}
```

**前端效果**：中栏元数据区域显示知识点标签

---

### 步骤 3: 查找所属目录 📂

**目标**：根据知识点查找题目所属的目录/章节

#### 3.1 提取科目关键词

从题目内容或知识点推断科目：

**示例**：
- 知识点："二次函数" → 科目："数学"
- 知识点："牛顿第一定律" → 科目："物理"

#### 3.2 搜索目录（JSON 数据源）

**工具**：`list_subjects`

```json
// 搜索 "二次函数"
{
  "keyword": "二次函数",
  "limit": 10
}

// 搜索 "九年级" (如果知识点包含年级信息)
{
  "keyword": "九年级",
  "limit": 10
}
```

**结果筛选**：
- 优先选择完整路径（如 "九年级上册 > 第二章 > 二次函数"）
- 去除重复条目
- 选择最具体的目录（层级最深）

#### 3.3 构建目录路径

```json
{
  "subjectId": "math-001",
  "path": ["九年级上册", "第二章 函数", "2.1 二次函数"]
}
```

#### 3.4 立即更新前端

```json
// write_output
{
  "field": "catalog",
  "value": {
    "subjectId": "math-001",
    "path": ["九年级上册", "第二章 函数", "2.1 二次函数"]
  },
  "preview": "已定位到目录"
}
```

**前端效果**：中栏显示面包屑导航

---

### 步骤 4: 计算难度等级 📊

**目标**：基于知识点和题目复杂度评估难度

#### 4.1 难度因子

| 因子 | 权重 | 说明 |
|------|------|------|
| 知识点数量 | 0.4 | 每个知识点 +0.5 分 |
| 知识点层级 | 0.3 | 深层级知识点 +0.3 分 |
| 题型复杂度 | 0.2 | 主观题 > 填空题 > 选择题 |
| 综合程度 | 0.1 | 多知识点综合 +0.5 分 |

#### 4.2 计算公式

```
difficulty = min(5, ceil(
  知识点数量 × 0.5 × 0.4 +
  平均层级 × 0.3 +
  题型系数 × 0.2 +
  综合系数 × 0.1
))

题型系数:
- 选择题: 1.0
- 填空题: 1.5
- 主观题: 2.0

综合系数:
- 单一知识点: 1.0
- 2-3个知识点: 1.5
- 4+个知识点: 2.0
```

**示例**：
```
知识点: 2个, 平均层级: 4, 题型: 选择题, 综合程度: 中等
difficulty = min(5, ceil(2 × 0.5 × 0.4 + 4 × 0.3 + 1.0 × 0.2 + 1.5 × 0.1))
           = min(5, ceil(0.4 + 1.2 + 0.2 + 0.15))
           = min(5, ceil(1.95))
           = 2
```

#### 4.3 立即更新前端

```json
// write_output
{
  "field": "difficulty",
  "value": 3,
  "preview": "难度等级: 3/5"
}
```

**前端效果**：中栏显示难度可视化（3 个橙色方块）

---

### 步骤 5: 生成解题思路 💡

**目标**：基于知识点和题型生成标准解题思路

#### 5.1 思路模板（按题型）

**选择题模板**：
```markdown
# 解题思路

## 1. 理解题意
- 识别题目类型：{知识点1}、{知识点2}
- 明确已知条件：{从题干提取}
- 确定求解目标：{问题}

## 2. 分析选项
- 逐一分析每个选项的可能性
- 使用排除法缩小范围

## 3. 知识点应用
- 应用 {知识点1} 的相关公式/定理
- 应用 {知识点2} 的解题方法

## 4. 验证答案
- 检查推理过程是否严密
- 验证答案是否符合题意
```

**填空题/主观题模板**：
```markdown
# 解题思路

## 1. 审题
- 关键信息：{提取关键条件}
- 问题本质：{转化为数学问题}

## 2. 解题步骤
1. 根据 {知识点1} 列出等式/关系
2. 应用 {知识点2} 进行化简/变形
3. 求解结果

## 3. 验证
- 检查结果的合理性
- 验证是否满足题目条件
```

#### 5.2 立即更新前端

```json
// write_output
{
  "field": "thinkingProcess",
  "value": "# 解题思路\n\n## 1. 理解题意\n...",
  "preview": "已生成解题思路"
}
```

**前端效果**：右栏聊天显示完整思路（Markdown 渲染）

---

### 步骤 6 (可选): 分析学生答案 ❌

**触发条件**：用户提供了学生答案

**目标**：识别错误类型和知识盲点

#### 6.1 对比答案

```
参考答案: B
学生答案: A

→ 答案错误
```

#### 6.2 错误分析

**分析策略**：
1. 如果是选择题，分析学生选择的选项为何错误
2. 推断可能的错误原因（概念混淆、计算错误、方法错误）
3. 关联到知识盲点（哪个知识点没掌握）

**示例**：
```json
{
  "studentAnswer": "A",
  "isCorrect": false,
  "errorAnalysis": {
    "errorType": "concept_misunderstanding",
    "description": "学生可能混淆了二次函数的顶点坐标公式，将最小值计算错误",
    "knowledgeGaps": ["二次函数的顶点公式", "函数最值的求法"],
    "remediation": "建议复习二次函数的配方法和顶点坐标公式"
  }
}
```

#### 6.3 立即更新前端

```json
// write_output
{
  "field": "knowledgeGapAnalysis",
  "value": "学生可能混淆了二次函数的顶点坐标公式...",
  "preview": "已分析学生错误"
}
```

---

## MCP 工具清单

### 必需工具

| 工具名称 | 用途 | 数据源 |
|---------|------|--------|
| `parse_quiz_content` | 解析题目内容 | - |
| `search_knowledge_points_by_priority` | **Mode C 按优先级迭代搜索知识点（主路径）** | JSON |
| `list_subjects` | 搜索科目/目录 | JSON |
| `write_output` | 更新前端展示 | - |

### 层级遍历工具（Mode B）

| 工具名称 | 用途 | 使用场景 |
|---------|------|----------|
| `list_root_knowledge_points` | 获取科目根节点 | Mode B Step 2：从顶层分类开始 |
| `get_knowledge_point_children` | 获取子节点列表 | Mode B Step 3：逐层展开 |
| `search_knowledge_points_under` | 在子树内关键词搜索 | Mode B Step 4：子节点过多时缩小范围 |
| `get_knowledge_point_path` | 获取知识点完整路径 | Mode B 确认步骤；Mode A/C 已内联 fullName |

### 可选工具

| 工具名称 | 用途 | 使用场景 |
|---------|------|----------|
| `search_knowledge_points` | 单关键词搜索知识点 | batch_search 无结果时的备用方案 |
| `generate_thinking_process_template` | 生成思路模板 | 辅助生成标准思路 |
| `verify_knowledge_point_tags` | 验证知识点 | 校验标注准确性 |
| `get_knowledge_points_tree` | 获取知识点树 | 展示层级结构 |

## 输出字段映射

| 前端字段 | write_output field | 数据类型 | 说明 |
|---------|-------------------|----------|------|
| 中栏-题干 | `parsedQuiz` | ParsedQuiz | 解析后的题目结构 |
| 中栏-知识点 | `knowledgePointTags` | Array | 知识点标签列表 |
| 中栏-目录 | `catalog` | Object | 所属目录路径 |
| 中栏-难度 | `difficulty` | Number | 难度等级 1-5 |
| 右栏-思路 | `thinkingProcess` | String | 解题思路 (Markdown) |
| 右栏-错误分析 | `knowledgeGapAnalysis` | String | 学生错误分析 (可选) |

## 完整示例流程

### 输入

```
【题目内容】
已知函数 f(x) = x² - 2x + 1，求 f(x) 的最小值。
A. -1
B. 0
C. 1
D. 2

【参考答案】
B

【学生答案】
A
```

### 执行步骤

1. **调用** `parse_quiz_content`
   - 输入: `{ content: "已知函数..." }`
   - 输出: `{ stem, options, quizType }`
   - **调用** `write_output(parsedQuiz, ...)`

2. **调用** `search_knowledge_points_by_priority`（Mode C）
   - 输入: `{ keywords: ["二次函数", "最值"], leafOnly: true }`
   - 输出: `{ rounds: [...], coveredKeywords: [...], ... }`（若核心概念未命中 → 切换 Mode B 层级遍历）
   - **调用** `write_output(knowledgePointTags, ...)`

3. **调用** `list_subjects`
   - 输入: `{ keyword: "二次函数" }`
   - 输出: `[{ id, name, ... }]`
   - **调用** `write_output(catalog, ...)`

4. **计算** 难度
   - 公式计算
   - **调用** `write_output(difficulty, 3)`

5. **生成** 思路
   - 使用模板填充
   - **调用** `write_output(thinkingProcess, ...)`

6. **分析** 学生答案（可选）
   - 对比 A vs B
   - 推断错误原因
   - **调用** `write_output(knowledgeGapAnalysis, ...)`

### 前端效果时间线

```
t=0s:  用户点击 "开始分析"
t=1s:  中栏显示 "解析中..."
t=2s:  中栏显示题干和选项 (步骤1完成)
t=4s:  中栏显示知识点标签 (步骤2完成)
t=5s:  中栏显示目录面包屑 (步骤3完成)
t=6s:  中栏显示难度条 (步骤4完成)
t=8s:  右栏显示解题思路 (步骤5完成)
t=10s: 右栏显示错误分析 (步骤6完成，如有学生答案)
```

## 注意事项

### ⚠️ 关键原则

1. **渐进式更新**：每完成一步立即 `write_output`，不要等到全部完成
2. **工具顺序**：严格按步骤执行，不跳过、不并行
3. **数据源优先级**：优先 JSON，数据库作为备用
4. **错误处理**：工具调用失败时，使用默认值继续流程

### ❌ 常见错误

1. **延迟更新**：等所有步骤完成后一次性 `write_output`
2. **跳过步骤**：直接生成思路，不调用解析工具
3. **并行调用**：同时调用多个依赖工具
4. **忽略学生答案**：提供了学生答案但未分析

### ✅ 最佳实践

1. **实时反馈**：每步完成立即更新，提升用户体验
2. **详细日志**：在聊天中展示每步进展
3. **友好错误**：工具失败时解释原因，不中断流程
4. **智能推断**：JSON 搜索无结果时，使用相关知识点

## 结束语

完成所有步骤后，询问用户：

```
✅ 题目分析完成！

我已为您完成：
- 📝 题目结构化解析
- 🏷️ 知识点标注（共 X 个）
- 📂 目录定位
- 📊 难度评估（X/5）
- 💡 解题思路生成
{如有学生答案}
- ❌ 学生答案错误分析

您还想了解什么？例如：
- "详细解释某个知识点"
- "提供类似题目练习"
- "分析错误的深层原因"
```
