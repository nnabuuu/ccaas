# write_output Schema 校验系统

本文档说明 `write_output` 工具的数据校验和自动修复机制。

## 概述

`write_output` 工具使用两层校验机制：

1. **JSON Schema（给 AI 的提示）** - 在工具的 `inputSchema` 中定义，帮助 AI 生成正确格式的数据
2. **Zod Schema（运行时校验）** - 在 MCP server 中使用 Zod 进行运行时校验和自动修复

## 为什么需要两层校验？

| 层级 | 作用 | 优势 |
|------|------|------|
| JSON Schema | AI 生成时遵循 | 减少格式错误，提高 AI 输出质量 |
| Zod Schema | 运行时校验修复 | 即使 AI 输出不完美，也能自动修复 |

## 支持的字段

### 基础字段（字符串）

| 字段 | 类型 | 说明 |
|------|------|------|
| `title` | string | 课程标题 |
| `subject` | string | 学科 |
| `gradeLevel` | string | 年级 |
| `duration` | string | 课时 |

### 数组字段

#### objectives（教学目标）

```typescript
interface LearningObjective {
  id: string;           // 唯一标识符（可自动生成）
  description: string;  // 目标描述（必填）
  bloomLevel: BloomLevel; // 认知层级（默认 'understand'）
  assessmentCriteria?: string; // 评估标准
}

type BloomLevel = 'remember' | 'understand' | 'apply' | 'analyze' | 'evaluate' | 'create';
```

**示例：**
```json
{
  "field": "objectives",
  "value": [
    {
      "id": "obj-1",
      "description": "学生能够理解分数的基本概念",
      "bloomLevel": "understand",
      "assessmentCriteria": "能用自己的话解释分数的含义"
    }
  ],
  "preview": "1个教学目标"
}
```

#### activities（教学活动）

```typescript
interface Activity {
  id: string;           // 唯一标识符（可自动生成）
  title: string;        // 活动标题（必填）
  description: string;  // 活动描述
  duration: number;     // 时长（分钟，默认 10）
  type: ActivityType;   // 活动类型（默认 'direct-instruction'）
  instructions: string[]; // 步骤说明（默认空数组）
  materials?: string[]; // 所需材料
  teacherNotes?: string; // 教师备注
}

type ActivityType =
  | 'introduction'       // 导入
  | 'direct-instruction' // 讲授
  | 'guided-practice'    // 引导练习
  | 'independent-practice' // 独立练习
  | 'group'              // 小组活动
  | 'assessment'         // 评估
  | 'closure';           // 总结
```

**示例：**
```json
{
  "field": "activities",
  "value": [
    {
      "id": "act-1",
      "title": "情境导入",
      "description": "通过生活场景引入分数概念",
      "duration": 5,
      "type": "introduction",
      "instructions": ["展示图片", "提问学生", "引出课题"],
      "materials": ["PPT课件"],
      "teacherNotes": "注意观察学生反应"
    }
  ],
  "preview": "1个教学活动"
}
```

#### standards（课程标准）

```typescript
interface Standard {
  id: string;          // 唯一标识符（可自动生成）
  code: string;        // 标准代码
  description: string; // 标准描述（必填）
}
```

#### materials（教学材料）

```typescript
interface Material {
  id: string;         // 唯一标识符（可自动生成）
  name: string;       // 材料名称（必填）
  type: MaterialType; // 材料类型（默认 'other'）
  url?: string;       // 资源链接
  notes?: string;     // 备注
}

type MaterialType = 'textbook' | 'handout' | 'digital' | 'manipulative' | 'other';
```

### 对象字段

#### assessment（评估方案）

```typescript
interface Assessment {
  formative: string[];  // 形成性评估（默认空数组）
  summative: string[];  // 总结性评估（默认空数组）
  rubric?: string;      // 评分标准
}
```

**示例：**
```json
{
  "field": "assessment",
  "value": {
    "formative": ["课堂观察", "提问检查", "即时反馈"],
    "summative": ["单元测试", "作业评价"],
    "rubric": "90-100分：优秀..."
  },
  "preview": "评估方案"
}
```

#### differentiation（差异化教学）

```typescript
interface Differentiation {
  struggling: string[]; // 学困生支持（默认空数组）
  onLevel: string[];    // 普通学生策略（默认空数组）
  advanced: string[];   // 优秀学生拓展（默认空数组）
  ell?: string[];       // ELL学生支持
  accommodations?: string[]; // 特殊需求调适
}
```

## 自动修复机制

Zod Schema 会自动处理以下情况：

### 1. 缺失 ID 字段

**输入：**
```json
{ "description": "学生能够理解概念", "bloomLevel": "understand" }
```

**输出：**
```json
{ "id": "obj-1706012345678-abc123", "description": "学生能够理解概念", "bloomLevel": "understand" }
```

### 2. 无效枚举值

**输入：**
```json
{ "id": "obj-1", "description": "...", "bloomLevel": "knowing" }
```

**输出：**
```json
{ "id": "obj-1", "description": "...", "bloomLevel": "understand" }
```
（无效的 `bloomLevel` 被替换为默认值 `understand`）

### 3. JSON 字符串解析

如果 AI 返回的是 JSON 字符串而不是对象：

**输入：**
```json
"[{\"id\": \"obj-1\", \"description\": \"...\"}]"
```

**输出：**
```json
[{ "id": "obj-1", "description": "..." }]
```

### 4. 缺失必填数组

**输入：**
```json
{ "id": "act-1", "title": "活动" }
```

**输出：**
```json
{ "id": "act-1", "title": "活动", "description": "", "duration": 10, "type": "direct-instruction", "instructions": [] }
```

## 错误处理

当数据无法修复时，会返回错误：

```json
{
  "data": {
    "error": "Data validation failed for field \"objectives\": description: 目标描述不能为空",
    "field": "objectives",
    "originalValue": [{ "id": "obj-1" }]
  },
  "status": "error"
}
```

## 最佳实践

### 对于 AI（SKILL.md 中的指导）

1. **始终提供 ID** - 虽然可以自动生成，但提供 ID 有助于追踪
2. **使用正确的枚举值** - 参考上面的类型定义
3. **确保必填字段** - `description` 是大多数类型的必填字段
4. **数组字段提供数组** - 不要用字符串包装 JSON

### 对于开发者

1. **Schema 文件位置**: `mcp-server/src/schemas.ts`
2. **添加新字段时**:
   - 在 `schemas.ts` 中添加 Zod schema
   - 在 `FieldSchemas` 对象中注册
   - 更新工具的 JSON Schema（在 `index.ts` 中）

## Solution 配置（可选）

Schema 校验是 **可选的**。如果你的 solution 不需要严格校验：

1. 不导入 `schemas.ts`
2. 在 `write_output` handler 中直接返回 `input.value`

```typescript
// 不使用校验
const result: WriteOutputResult = {
  data: {
    field: input.field,
    value: input.value, // 直接使用原始值
    preview: input.preview,
  },
  status: 'success',
};
```

## 文件结构

```
mcp-server/
├── src/
│   ├── index.ts      # MCP server 入口，包含 JSON Schema 定义
│   ├── schemas.ts    # Zod Schema 定义和校验函数
│   └── types.ts      # TypeScript 类型定义
└── docs/
    └── SCHEMA_VALIDATION.md  # 本文档
```
