# Quiz Analyzer MCP API 快速参考

## 基本信息

- **Base URL**: `http://localhost:3006`
- **格式**: JSON
- **方法**: POST

---

## 🔧 工具索引

| 工具 | 用途 | 页码 |
|------|------|-----|
| [write_output](#write_output) | 存储分析结果 | ⬇️ |
| [search_quizzes](#search_quizzes) | 搜索题目 | ⬇️ |
| [search_knowledge_points](#search_knowledge_points) | 搜索知识点 | ⬇️ |
| [get_quiz_details](#get_quiz_details) | 获取题目详情 | ⬇️ |
| [get_knowledge_points_tree](#get_knowledge_points_tree) | 获取知识点树 | ⬇️ |
| [verify_knowledge_point_tags](#verify_knowledge_point_tags) | 验证标签 | ⬇️ |
| [calculate_difficulty](#calculate_difficulty) | 计算难度 | ⬇️ |
| [generate_thinking_process_template](#generate_thinking_process_template) | 生成模板 | ⬇️ |

---

## write_output

**存储 AI 分析结果到同步字段**

```bash
POST /tools/write_output
```

### 参数

```typescript
{
  field: string;    // SYNC_FIELD 名称
  value: any;       // 字段值（会验证）
  preview?: string; // 预览文本
}
```

### SYNC_FIELDS

| 字段 | 类型 | 说明 |
|------|------|------|
| quizAnalysis | string | 整体分析（Markdown） |
| knowledgePointTags | array | 知识点标签 |
| thinkingProcess | string | 解题思路（Markdown） |
| solutionSteps | array | 解题步骤 |
| correctAnswer | string | 正确答案 |
| commonMistakes | array | 常见错误 |
| knowledgeGapAnalysis | string | 知识盲点分析（Markdown） |
| difficulty | number | 难度 1-5 |
| relatedQuizzes | array | 相关题目 |
| timeEstimate | string | 预计用时 |

### 示例

```bash
curl -X POST http://localhost:3006/tools/write_output \
  -H "Content-Type: application/json" \
  -d '{
    "field": "thinkingProcess",
    "value": "# 解题思路\n\n## 1. 审题..."
  }'
```

### 响应

```json
{
  "status": "success",
  "data": {
    "field": "thinkingProcess",
    "value": "...",
    "preview": "Updated thinking process"
  }
}
```

---

## search_quizzes

**多条件搜索题目**

```bash
POST /tools/search_quizzes
```

### 参数

```typescript
{
  query?: string;           // 关键词
  subjectId?: string;       // 科目ID
  gradeLevel?: string;      // 年级
  quizType?: string;        // 题型
  difficulty?: number;      // 难度
  knowledgePointId?: string; // 知识点ID
  limit?: number;           // 数量（默认10）
  offset?: number;          // 偏移（默认0）
}
```

### 示例

```bash
# 关键词搜索
curl -X POST http://localhost:3006/tools/search_quizzes \
  -H "Content-Type: application/json" \
  -d '{"query":"方程","limit":5}'

# 多条件
curl -X POST http://localhost:3006/tools/search_quizzes \
  -H "Content-Type: application/json" \
  -d '{
    "gradeLevel":"9",
    "difficulty":3,
    "quizType":"解答题"
  }'

# 按知识点
curl -X POST http://localhost:3006/tools/search_quizzes \
  -H "Content-Type: application/json" \
  -d '{"knowledgePointId":"kp-003"}'
```

### 响应

```json
{
  "status": "success",
  "data": {
    "quizzes": [
      {
        "id": "...",
        "content": "...",
        "quiz_type": "解答题",
        "difficulty": 3,
        "grade_level": "9",
        "subject_name": "数学",
        "knowledge_points": "一元二次方程"
      }
    ],
    "pagination": {
      "total": 100,
      "limit": 5,
      "offset": 0,
      "hasMore": true
    }
  }
}
```

---

## search_knowledge_points

**搜索知识点（支持树形导航）**

```bash
POST /tools/search_knowledge_points
```

### 参数

```typescript
{
  query?: string;        // 关键词
  subjectId?: string;    // 科目ID
  gradeLevel?: string;   // 年级
  parentId?: string | null; // 父ID（null=根节点）
  limit?: number;        // 数量（默认20）
}
```

### 示例

```bash
# 关键词搜索
curl -X POST http://localhost:3006/tools/search_knowledge_points \
  -H "Content-Type: application/json" \
  -d '{"query":"方程"}'

# 获取根节点
curl -X POST http://localhost:3006/tools/search_knowledge_points \
  -H "Content-Type: application/json" \
  -d '{"parentId":null}'

# 获取子节点
curl -X POST http://localhost:3006/tools/search_knowledge_points \
  -H "Content-Type: application/json" \
  -d '{"parentId":"kp-001"}'
```

### 响应

```json
{
  "status": "success",
  "data": {
    "knowledgePoints": [
      {
        "id": "kp-002",
        "name": "方程",
        "level": 1,
        "parent_id": "kp-001",
        "parent_name": "代数",
        "children_count": 2,
        "subject_name": "数学"
      }
    ],
    "count": 1
  }
}
```

---

## get_quiz_details

**获取题目完整详情（含分析）**

```bash
POST /tools/get_quiz_details
```

### 参数

```typescript
{
  quizId: string;  // 题目ID（必填）
}
```

### 示例

```bash
curl -X POST http://localhost:3006/tools/get_quiz_details \
  -H "Content-Type: application/json" \
  -d '{"quizId":"quiz-001"}'
```

### 响应

```json
{
  "status": "success",
  "data": {
    "quiz": {
      "id": "quiz-001",
      "content": "求解方程 x² - 5x + 6 = 0",
      "quiz_type": "解答题",
      "difficulty": 3,
      "grade_level": "9",
      "correct_answer": "x₁ = 2, x₂ = 3",
      "subject_name": "数学"
    },
    "knowledgePoints": [
      {
        "id": "kp-003",
        "name": "一元二次方程",
        "level": 2,
        "confidence_score": 1.0,
        "link_type": "manual"
      }
    ],
    "analysis": {
      "thinking_process": "# 解题思路...",
      "solution_steps": "[...]",
      "common_mistakes": "[...]",
      "time_estimate": "5-8分钟"
    }
  }
}
```

---

## get_knowledge_points_tree

**获取分层知识点树**

```bash
POST /tools/get_knowledge_points_tree
```

### 参数

```typescript
{
  subjectId: string;      // 科目ID
  gradeLevel?: string;    // 年级（可选）
}
```

### 示例

```bash
curl -X POST http://localhost:3006/tools/get_knowledge_points_tree \
  -H "Content-Type: application/json" \
  -d '{"subjectId":"math-id","gradeLevel":"9"}'
```

### 响应

```json
{
  "status": "success",
  "data": {
    "tree": [
      {
        "id": "kp-001",
        "name": "代数",
        "level": 0,
        "children": [
          {
            "id": "kp-002",
            "name": "方程",
            "level": 1,
            "children": [...]
          }
        ]
      }
    ],
    "totalNodes": 10
  }
}
```

---

## verify_knowledge_point_tags

**验证 AI 提议的知识点标签**

```bash
POST /tools/verify_knowledge_point_tags
```

### 参数

```typescript
{
  quizContent: string;      // 题目内容
  proposedTags: array;      // 建议的标签
}
```

### 示例

```bash
curl -X POST http://localhost:3006/tools/verify_knowledge_point_tags \
  -H "Content-Type: application/json" \
  -d '{
    "quizContent": "求解 x² + 3x + 2 = 0",
    "proposedTags": [
      {
        "id": "kp-003",
        "name": "一元二次方程",
        "confidence": 0.9
      }
    ]
  }'
```

### 响应

```json
{
  "status": "success",
  "data": {
    "instructions": "Analyze the quiz content and verify...",
    "availableKnowledgePoints": {...}
  }
}
```

---

## calculate_difficulty

**计算题目难度**

```bash
POST /tools/calculate_difficulty
```

### 参数

```typescript
{
  knowledgePointCount: number;  // 知识点数
  stepCount: number;            // 步骤数
  quizType: string;             // 题型
}
```

### 题型权重

- 选择题: 0.8
- 填空题: 1.0
- 解答题: 1.2
- 证明题: 1.5

### 公式

```
难度 = min(5, ceil((知识点数×0.5 + 步骤数×0.3) × 题型权重))
```

### 示例

```bash
curl -X POST http://localhost:3006/tools/calculate_difficulty \
  -H "Content-Type: application/json" \
  -d '{
    "knowledgePointCount": 3,
    "stepCount": 5,
    "quizType": "解答题"
  }'
```

### 响应

```json
{
  "status": "success",
  "data": {
    "difficulty": 4,
    "label": "较难",
    "timeEstimate": "12-18分钟",
    "formula": "min(5, ceil((3×0.5 + 5×0.3)×1.2))"
  }
}
```

### 难度等级

| 难度 | 标签 | 预计用时 |
|-----|------|---------|
| 1 | 简单 | 3-5分钟 |
| 2 | 较易 | 5-8分钟 |
| 3 | 中等 | 8-12分钟 |
| 4 | 较难 | 12-18分钟 |
| 5 | 困难 | 18分钟以上 |

---

## generate_thinking_process_template

**生成解题思路模板**

```bash
POST /tools/generate_thinking_process_template
```

### 参数

```typescript
{
  quizContent?: string;      // 题目内容（可选）
  quizType: string;          // 题型
  knowledgePoints?: string[]; // 知识点（可选）
}
```

### 示例

```bash
curl -X POST http://localhost:3006/tools/generate_thinking_process_template \
  -H "Content-Type: application/json" \
  -d '{
    "quizType": "解答题",
    "knowledgePoints": ["一元二次方程"]
  }'
```

### 响应

```json
{
  "status": "success",
  "data": {
    "template": "# 解题思路\n\n## 1. 审题\n- 理解题目条件\n- 明确求解目标\n\n## 2. 制定策略\n相关知识点：一元二次方程\n- 选择合适方法\n\n## 3. 详细求解\n[AI将在这里生成具体步骤]\n\n## 4. 检验\n- 验证结果合理性",
    "instructions": "Use this template as a starting point..."
  }
}
```

---

## 📊 数据类型

### KnowledgePointTag

```typescript
{
  id: string;              // 知识点ID
  name: string;            // 名称
  confidence: number;      // 置信度 0.0-1.0
  verified: boolean;       // 已验证
  level: number;           // 层级
  path: string[];          // 路径
}
```

### SolutionStep

```typescript
{
  stepNumber: number;      // 序号
  title: string;           // 标题
  description: string;     // 描述
  formula?: string;        // 公式
  reasoning: string;       // 推理
  commonErrors: string[];  // 常见错误
}
```

### Mistake

```typescript
{
  description: string;     // 描述
  frequency: "high"|"medium"|"low"; // 频率
  knowledgeGaps: string[]; // 知识盲点ID
  remediation: string;     // 补救措施
}
```

---

## ⚠️ 错误响应

### 格式

```json
{
  "status": "error",
  "error": "错误描述"
}
```

### 常见错误

**400 - 参数错误**
```json
{
  "status": "error",
  "error": "Invalid field: xxx"
}
```

**404 - 未找到**
```json
{
  "status": "error",
  "error": "Quiz not found"
}
```

**500 - 服务器错误**
```json
{
  "status": "error",
  "error": "Database error"
}
```

---

## 🎯 快速示例

### AI 分析完整流程

```bash
# 1. 搜索相似题目
curl -X POST http://localhost:3006/tools/search_quizzes \
  -d '{"query":"二次方程","limit":3}'

# 2. 获取知识点树
curl -X POST http://localhost:3006/tools/get_knowledge_points_tree \
  -d '{"subjectId":"math-id"}'

# 3. 存储知识点标签
curl -X POST http://localhost:3006/tools/write_output \
  -d '{
    "field":"knowledgePointTags",
    "value":[{"id":"kp-003","name":"一元二次方程","confidence":0.95,"verified":true,"level":2,"path":["代数","方程","一元二次方程"]}]
  }'

# 4. 生成思路模板
curl -X POST http://localhost:3006/tools/generate_thinking_process_template \
  -d '{"quizType":"解答题","knowledgePoints":["一元二次方程"]}'

# 5. 存储思路
curl -X POST http://localhost:3006/tools/write_output \
  -d '{"field":"thinkingProcess","value":"# 解题思路\n\n..."}'

# 6. 计算难度
curl -X POST http://localhost:3006/tools/calculate_difficulty \
  -d '{"knowledgePointCount":1,"stepCount":4,"quizType":"解答题"}'

# 7. 存储难度
curl -X POST http://localhost:3006/tools/write_output \
  -d '{"field":"difficulty","value":3}'
```

### 学生练习流程

```bash
# 1. 搜索知识点
curl -X POST http://localhost:3006/tools/search_knowledge_points \
  -d '{"query":"三角形"}'

# 2. 查找题目
curl -X POST http://localhost:3006/tools/search_quizzes \
  -d '{"knowledgePointId":"kp-xxx","difficulty":2}'

# 3. 获取详情
curl -X POST http://localhost:3006/tools/get_quiz_details \
  -d '{"quizId":"quiz-xxx"}'
```

### 教师组卷流程

```bash
# 1. 多条件筛选
curl -X POST http://localhost:3006/tools/search_quizzes \
  -d '{
    "gradeLevel":"9",
    "difficulty":3,
    "quizType":"解答题",
    "limit":20
  }'

# 2. 获取详情（批量）
# 对每个题目调用 get_quiz_details
```

---

## 🔗 相关文档

- [完整文档](README.md) - 详细说明和使用场景
- [测试结果](../MCP_TEST_RESULTS.md) - 所有工具的测试报告
- [项目文档](../README.md) - 整体架构和设计

---

**更新**: 2026-02-06
**版本**: 1.0.0
