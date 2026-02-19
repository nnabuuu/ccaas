---
name: Quiz Analyzer - Student Answer Analysis
description: 分析学生答案，识别错误类型和错误步骤，支持错误模式推荐
---

# Skill: 学生答案错误分析

## 目标

自动分析学生的答案，识别错误类型、错误步骤，并生成详细的错误分析报告。这是错误模式推荐系统的核心组件。

## 触发条件

**关键词触发**：
- "分析学生答案"
- "检查这道题"
- "学生错在哪里"
- "错误分析"
- "学生做错了"
- "分析错题"

**使用场景**：
1. 教师批改作业时，输入学生答案进行自动分析
2. 学生自测后，想了解自己错在哪里
3. 批量分析多个学生的答案，找出共同错误

## 核心功能

### 1. 错误识别
- 判断答案是否正确
- 定位具体错在第几步
- 识别错误类型（12种预定义分类）
- 评估错误严重程度（critical/major/minor）

### 2. 错误分类（两级分类）

**Level 1: 预定义错误类型**
| 错误类型 | 英文标识 | 典型表现 |
|---------|---------|---------|
| 概念理解错误 | `concept_misunderstanding` | 混淆定义、定理、公式适用条件 |
| 计算错误 | `calculation_error` | 加减乘除、运算顺序错误 |
| 公式应用错误 | `formula_misuse` | 选错公式、套错公式、记错公式 |
| 步骤遗漏 | `step_omission` | 跳过关键步骤、解题不完整 |
| 步骤顺序错误 | `step_order_wrong` | 颠倒解题顺序 |
| 条件遗漏 | `condition_neglect` | 忘记题目条件、隐含条件 |
| 推理错误 | `reasoning_error` | 逻辑推理失误、因果关系错误 |
| 符号混淆 | `symbol_confusion` | 符号使用错误、正负号错误 |
| 单位换算错误 | `unit_conversion_error` | 单位转换失误 |
| 取值范围错误 | `range_error` | 答案超出定义域、值域 |
| 特殊情况遗漏 | `special_case_neglect` | 忽略边界条件、分类讨论不全 |
| 其他 | `other` | 需详细描述的其他错误 |

**Level 2: 自然语言描述**
- 用一句简洁的话描述具体错误
- 例如："把二次项系数看成了一次项系数"
- 例如："忘记考虑分母不为零的条件"
- 例如："混淆了完全平方公式和平方差公式"

### 3. 提供正确做法
- 针对每个错误步骤，给出正确的解题方法
- 简明扼要，易于学生理解

## 标准工作流

### 步骤 1: 获取题目信息

使用 `get_quiz_details` 或 `analyze_student_answer` 工具获取：
- 题目内容
- 标准答案
- 标准解题步骤
- 关联的知识点

```typescript
// 调用示例
await tools.analyze_student_answer({
  quizId: "quiz-uuid",
  studentAnswer: "学生答案内容",
  sessionId: "session-uuid"
});
```

### 步骤 2: 对比分析

**2.1 整体判断**
- 先判断最终答案是否正确
- 如果正确，标记为 `isCorrect: true`，`errorSteps: []`

**2.2 逐步对比**（如果答案错误）
- 将学生答案按步骤拆解
- 与标准解题步骤逐一对比
- 找出第一个出错的位置（步骤号）

### 步骤 3: 错误分类

对于每个错误步骤：

**3.1 选择错误类型**
- 从12种预定义类型中选择最匹配的
- 优先使用精确类型（避免滥用 `other`）
- 一个步骤可能有多个错误，都要标注

**3.2 编写错误描述**
- 使用自然语言（中文）
- 一句话说清楚错在哪里
- 具体、可操作，避免模糊表达

**示例对比**：
- ❌ "公式用错了" （太模糊）
- ✅ "应该用平方差公式 (a+b)(a-b)=a²-b²，但学生用了完全平方公式"

**3.3 判断严重程度**
- **critical**: 关键性错误，直接导致答案完全错误
  - 例如：公式完全选错、计算方法根本性错误
- **major**: 重要错误，严重影响答案准确性
  - 例如：步骤遗漏、推理错误
- **minor**: 小错误，不影响整体思路
  - 例如：计算笔误、单位忘写

### 步骤 4: 识别受影响的知识点

对于每个错误：
- 分析该错误涉及哪些知识点
- 使用 `search_knowledge_points` 工具查找知识点ID
- 填入 `affectedKnowledgePoints` 数组

**示例**：
- 错误："混淆了完全平方公式和平方差公式"
- 受影响知识点：["因式分解", "完全平方公式", "平方差公式"]

### 步骤 5: 提供正确做法

对于每个错误步骤：
- 用1-2句话说明正确的做法
- 给出关键公式或方法
- 解释为什么这样做是对的

**格式**：
```
应该 + [正确方法] + 因为 + [原因]
```

**示例**：
```
应该使用平方差公式 (a+b)(a-b) = a²-b²，
因为题目是两项平方差的形式，不是完全平方式。
```

### 步骤 6: 生成 StudentAnswer 对象

按照以下格式构造完整的分析结果：

```typescript
{
  id: "生成UUID",
  quizId: "题目ID",
  studentId: "学生ID（可选）",
  sessionId: "会话ID",
  answerContent: "学生的完整答案",
  stepsAttempted: ["步骤1描述", "步骤2描述", ...],
  submittedAt: "ISO时间戳",
  isCorrect: false,
  errorSteps: [
    {
      stepNumber: 2,
      errorType: "formula_misuse",
      errorDescription: "应该用平方差公式，但学生用了完全平方公式",
      affectedKnowledgePoints: ["kp-001", "kp-045"],
      severity: "critical",
      correctApproach: "应使用 (a+b)(a-b) = a² - b² 的平方差公式"
    }
  ]
}
```

### 步骤 7: 保存分析结果

**重要**：分析完成后，再次调用 MCP 工具保存结果到数据库。

这一步会自动：
- 保存学生答案记录
- 保存每个错误步骤的详细信息
- 更新错误模式的统计数据（aggregation）

## 输出格式要求

### 必需字段
- `id`: UUID格式
- `quizId`: 题目ID
- `sessionId`: 会话ID
- `answerContent`: 学生答案原文
- `submittedAt`: ISO 8601 时间戳
- `isCorrect`: boolean
- `errorSteps`: ErrorStep 数组

### ErrorStep 必需字段
- `stepNumber`: 步骤号（从1开始）
- `errorType`: ErrorType 枚举值
- `errorDescription`: 具体错误描述（中文）
- `affectedKnowledgePoints`: 知识点ID数组（可为空）
- `severity`: "critical" | "major" | "minor"
- `correctApproach`: 正确做法说明

### 可选字段
- `studentId`: 学生ID
- `stepsAttempted`: 学生解题步骤数组

## 注意事项

### ⚠️ 避免过度分析
- 不要把每个小错误都单独列出
- 同一类型的连续错误可以合并
- 关注影响答案的关键错误

### ⚠️ 错误类型选择
- 优先使用精确的预定义类型
- 只有无法归类时才用 `other`
- 一个步骤可能有多个错误类型

### ⚠️ 描述准确性
- 描述要基于客观事实，不要猜测
- 指出具体错在哪里，不要模糊表达
- 避免使用教育术语，用通俗语言

### ⚠️ 严重程度判断
- `critical`: 导致答案完全错误
- `major`: 严重影响但可能部分正确
- `minor`: 不影响核心思路的小错误

## 示例分析

### 示例 1: 公式应用错误

**题目**：
```
解方程：x² - 4 = 0（用因式分解法）
```

**标准答案**：
```
解：x² - 4 = 0
   (x+2)(x-2) = 0    # 使用平方差公式
   x+2=0 或 x-2=0
   x=-2 或 x=2
```

**学生答案**：
```
解：x² - 4 = 0
   (x-2)² = 0        # 错误：用了完全平方公式
   x-2 = 0
   x = 2
```

**分析结果**：
```json
{
  "id": "ans-001",
  "quizId": "quiz-123",
  "sessionId": "session-456",
  "answerContent": "解：x² - 4 = 0\n(x-2)² = 0\nx-2 = 0\nx = 2",
  "stepsAttempted": [
    "x² - 4 = 0",
    "(x-2)² = 0",
    "x-2 = 0",
    "x = 2"
  ],
  "submittedAt": "2026-02-06T12:00:00Z",
  "isCorrect": false,
  "errorSteps": [
    {
      "stepNumber": 2,
      "errorType": "formula_misuse",
      "errorDescription": "应该用平方差公式 (a+b)(a-b)=a²-b²，但学生用了完全平方公式 (a-b)²=a²-2ab+b²",
      "affectedKnowledgePoints": ["kp-因式分解", "kp-平方差公式"],
      "severity": "critical",
      "correctApproach": "x²-4 是两项平方差，应使用平方差公式：x²-4 = (x+2)(x-2)"
    }
  ]
}
```

### 示例 2: 步骤遗漏

**题目**：
```
化简：(2x+3)(2x-3) - 4x²
```

**标准答案**：
```
解：(2x+3)(2x-3) - 4x²
   = 4x² - 9 - 4x²      # 使用平方差公式展开
   = -9                 # 合并同类项
```

**学生答案**：
```
解：(2x+3)(2x-3) - 4x²
   = -9                 # 直接跳到结果
```

**分析结果**：
```json
{
  "id": "ans-002",
  "quizId": "quiz-124",
  "sessionId": "session-457",
  "answerContent": "(2x+3)(2x-3) - 4x² = -9",
  "stepsAttempted": ["(2x+3)(2x-3) - 4x² = -9"],
  "submittedAt": "2026-02-06T12:05:00Z",
  "isCorrect": true,
  "errorSteps": [
    {
      "stepNumber": 1,
      "errorType": "step_omission",
      "errorDescription": "跳过了展开和合并同类项的过程，虽然结果正确但步骤不完整",
      "affectedKnowledgePoints": ["kp-平方差公式", "kp-整式化简"],
      "severity": "minor",
      "correctApproach": "应该写出中间步骤：先用平方差公式展开得 4x²-9，再与 -4x² 合并得 -9"
    }
  ]
}
```

### 示例 3: 条件遗漏

**题目**：
```
解方程：x/(x-1) = 2
```

**标准答案**：
```
解：x/(x-1) = 2
   x = 2(x-1)           # 去分母
   x = 2x - 2
   x = 2
   检验：当 x=2 时，x-1=1≠0，所以 x=2 是原方程的解
```

**学生答案**：
```
解：x/(x-1) = 2
   x = 2(x-1)
   x = 2x - 2
   x = 2
```

**分析结果**：
```json
{
  "id": "ans-003",
  "quizId": "quiz-125",
  "sessionId": "session-458",
  "answerContent": "x/(x-1) = 2\nx = 2(x-1)\nx = 2x - 2\nx = 2",
  "stepsAttempted": [
    "x/(x-1) = 2",
    "x = 2(x-1)",
    "x = 2x - 2",
    "x = 2"
  ],
  "submittedAt": "2026-02-06T12:10:00Z",
  "isCorrect": false,
  "errorSteps": [
    {
      "stepNumber": 4,
      "errorType": "condition_neglect",
      "errorDescription": "忘记检验分数方程的增根，需要验证 x-1≠0",
      "affectedKnowledgePoints": ["kp-分式方程", "kp-增根"],
      "severity": "major",
      "correctApproach": "分式方程求解后必须检验：将 x=2 代入 x-1，得 2-1=1≠0，所以 x=2 是原方程的解"
    }
  ]
}
```

## 推荐使用的 MCP 工具

### 必用工具
1. `analyze_student_answer` - 获取题目信息并保存分析结果
2. `get_quiz_details` - 获取题目完整信息（备选）

### 辅助工具
3. `search_knowledge_points` - 查找知识点ID
4. `get_knowledge_points_tree` - 浏览知识点层级结构
5. `get_node_path` - 获取知识点的完整路径

### 后续推荐
6. `recommend_by_error_pattern` - 基于错误模式推荐相似题目
7. `get_error_statistics` - 查看该题的错误统计

## 性能优化建议

### 批量分析
如果需要分析多个学生的答案：
1. 先获取一次题目信息（避免重复查询）
2. 逐个分析学生答案
3. 批量保存分析结果

### 缓存策略
- 题目的标准答案和解题步骤可以缓存
- 知识点信息可以缓存（避免重复搜索）

## 错误处理

### 无法识别错误类型
- 如果实在无法归类，使用 `errorType: "other"`
- 在 `errorDescription` 中详细描述
- 标记为 `severity: "major"` 等待人工审核

### 标准答案不完整
- 如果题目没有标准答案或解题步骤
- 在分析结果中注明："标准答案缺失，分析可能不准确"
- 尽力基于题目内容判断

### 学生答案无法解析
- 如果学生答案格式混乱或无法理解
- 标记整体为错误
- `errorDescription`: "答案格式无法解析，请核对"

## 质量检查清单

在输出分析结果前，确认：

- [ ] 所有 `errorSteps` 的 `errorType` 都是有效的枚举值
- [ ] `errorDescription` 是具体的、可操作的描述
- [ ] `severity` 的判断合理（critical/major/minor）
- [ ] `correctApproach` 提供了明确的正确做法
- [ ] `affectedKnowledgePoints` 准确反映了涉及的知识点
- [ ] `stepNumber` 对应正确的步骤位置
- [ ] `isCorrect` 字段与 `errorSteps` 一致（有错误则为 false）
- [ ] 时间戳格式正确（ISO 8601）
- [ ] 所有必需字段都已填写

## 后续工作流

分析完成后，系统会自动：

1. **聚合错误模式**
   - 统计该题有多少学生犯了相同错误
   - 更新 `error_patterns` 表

2. **生成推荐**
   - 基于错误模式找相似题目
   - 计算相似度分数（40% 错误类型 + 30% 步骤位置 + 30% 知识点）

3. **教师仪表板**
   - 显示该题的常见错误统计
   - 可视化错误分布
   - 提供针对性教学建议

---

**版本**: 1.0.0
**最后更新**: 2026-02-06
**维护者**: Quiz Analyzer Team
