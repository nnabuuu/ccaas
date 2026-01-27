# Best Practice: write_output Tool with Schema Validation

本文档介绍 MCP Server `write_output` 工具的最佳实践模式，包括双层校验、自动修复和错误处理机制。

## 概述

`write_output` 是 CCAAS 解决方案中 AI 向前端输出结构化数据的标准工具。该模式解决了 AI 输出不可靠的问题：

| 问题 | 解决方案 |
|------|----------|
| AI 可能遗漏字段 | Zod Schema 提供默认值 |
| AI 可能返回错误类型 | 运行时类型校验 |
| AI 可能返回 JSON 字符串而非对象 | 自动解析 JSON 字符串 |
| AI 可能使用无效枚举值 | 默认值替换 |

## 架构图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Claude (AI)                                     │
│                                                                              │
│  1. 读取 SKILL.md 了解 write_output 工具的使用方法                            │
│  2. 生成结构化数据                                                            │
│  3. 调用 write_output(field, value, preview)                                 │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         MCP Server (index.ts)                                │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    JSON Schema (工具定义)                            │    │
│  │  - 定义在 inputSchema 中                                             │    │
│  │  - 作用：帮助 AI 生成正确格式                                         │    │
│  │  - 时机：AI 调用工具前                                                │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                   │                                          │
│                                   ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    Zod Schema (运行时校验)                           │    │
│  │  - 定义在 schemas.ts 中                                              │    │
│  │  - 作用：校验 + 自动修复 + 提供默认值                                  │    │
│  │  - 时机：工具被调用时                                                 │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                   │                                          │
│                    ┌──────────────┴──────────────┐                          │
│                    ▼                              ▼                          │
│            ┌─────────────┐                ┌─────────────┐                    │
│            │   SUCCESS   │                │    ERROR    │                    │
│            │             │                │             │                    │
│            │ - 数据已校验 │                │ - 缺少必填字段│                    │
│            │ - 可能已修复 │                │ - 无法修复   │                    │
│            └──────┬──────┘                └──────┬──────┘                    │
│                   │                              │                          │
└───────────────────┼──────────────────────────────┼──────────────────────────┘
                    │                              │
                    ▼                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            CCAAS Backend                                     │
│                                                                              │
│  EventMapper 将 MCP 工具结果转换为 output_update 事件                         │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Frontend                                        │
│                                                                              │
│  1. 收到 output_update 事件                                                  │
│  2. 显示 "同步到表单" 按钮                                                    │
│  3. 用户点击后，数据同步到表单                                                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 实现指南

### 1. 定义 Zod Schema (schemas.ts)

```typescript
import { z } from 'zod';

// 辅助函数：生成唯一 ID
function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// 枚举类型带默认值
export const BloomLevelSchema = z.enum([
  'remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'
]).default('understand');

// 对象类型带自动生成 ID 和默认值
export const LearningObjectiveSchema = z.object({
  id: z.string().default(() => generateId('obj')),
  description: z.string().min(1, '目标描述不能为空'),  // 必填
  bloomLevel: BloomLevelSchema,
  assessmentCriteria: z.string().optional(),
}).transform((obj) => ({
  ...obj,
  id: obj.id || generateId('obj'),  // 空字符串也重新生成
}));

// 数组类型默认空数组
export const ObjectivesSchema = z.array(LearningObjectiveSchema).default([]);

// 字段映射
export const FieldSchemas = {
  title: z.string().min(1),
  objectives: ObjectivesSchema,
  // ... 其他字段
} as const;

export type SyncField = keyof typeof FieldSchemas;
```

### 2. 实现校验函数

```typescript
export interface ValidationResult<T> {
  success: boolean;
  data: T | null;
  errors: string[];
  warnings: string[];
  fixed: boolean;  // 是否进行了自动修复
}

// 尝试解析 JSON 字符串
export function parseJsonSafely(value: unknown): unknown {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if ((trimmed.startsWith('[') && trimmed.endsWith(']')) ||
        (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
      try {
        return JSON.parse(trimmed);
      } catch {
        // 解析失败，返回原值
      }
    }
  }
  return value;
}

// 校验并修复
export function validateAndFix<T extends SyncField>(
  field: T,
  value: unknown
): ValidationResult<z.infer<typeof FieldSchemas[T]>> {
  const schema = FieldSchemas[field];

  if (!schema) {
    return {
      success: false,
      data: null,
      errors: [`未知字段: ${field}`],
      warnings: [],
      fixed: false,
    };
  }

  const result = schema.safeParse(value);

  if (result.success) {
    const fixed = JSON.stringify(value) !== JSON.stringify(result.data);
    return {
      success: true,
      data: result.data,
      errors: [],
      warnings: fixed ? [`字段 ${field} 的数据已自动修复`] : [],
      fixed,
    };
  }

  return {
    success: false,
    data: null,
    errors: result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`),
    warnings: [],
    fixed: false,
  };
}

// 完整流程：解析 JSON + 校验
export function validateAndFixField<T extends SyncField>(
  field: T,
  value: unknown
): ValidationResult<z.infer<typeof FieldSchemas[T]>> {
  const parsed = parseJsonSafely(value);
  return validateAndFix(field, parsed);
}
```

### 3. 在 MCP Server 中使用 (index.ts)

```typescript
// Handle write_output tool
if (name === 'write_output') {
  const input = args as WriteOutputInput;

  // 1. 校验字段名
  if (!SYNC_FIELDS.includes(input.field as SyncField)) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          data: { error: `Invalid field: ${input.field}` },
          status: 'error',
        }),
      }],
      isError: true,
    };
  }

  // 2. 校验并修复数据
  const validation = validateAndFixField(input.field as SyncField, input.value);

  if (!validation.success) {
    // 校验失败，返回错误
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          data: {
            error: `Validation failed: ${validation.errors.join('; ')}`,
            field: input.field,
            originalValue: input.value,
          },
          status: 'error',
        }),
      }],
      isError: true,
    };
  }

  // 3. 返回校验后的数据
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        data: {
          field: input.field,
          value: validation.data,  // 使用校验/修复后的数据
          preview: input.preview,
        },
        status: 'success',
      }),
    }],
  };
}
```

## 自动修复场景

| 场景 | 输入 | 输出 |
|------|------|------|
| 缺失 ID | `{ description: "..." }` | `{ id: "obj-xxx", description: "..." }` |
| 空字符串 ID | `{ id: "", description: "..." }` | `{ id: "obj-xxx", description: "..." }` |
| 缺失枚举值 | `{ description: "..." }` | `{ ..., bloomLevel: "understand" }` |
| JSON 字符串 | `"[{...}]"` | `[{...}]` |
| 缺失数组 | `undefined` | `[]` |

## 错误场景（无法修复）

| 场景 | 原因 | 错误信息示例 |
|------|------|-------------|
| 缺少必填字段 | `description` 是必填的 | `description: 目标描述不能为空` |
| 无效 URL 格式 | URL 校验失败 | `url: Invalid url` |
| 数值超出范围 | `duration` 必须 1-120 | `duration: Number must be at most 120` |

## TDD 测试策略

### 测试文件结构

```
mcp-server/src/
├── schemas.ts        # Schema 定义
└── schemas.test.ts   # 测试文件
```

### 测试覆盖要点

```typescript
describe('LearningObjectiveSchema', () => {
  // 1. 有效数据通过
  it('should accept complete objective', () => {
    const result = LearningObjectiveSchema.safeParse({
      id: 'obj-1',
      description: '学生能够理解概念',
      bloomLevel: 'understand',
    });
    expect(result.success).toBe(true);
  });

  // 2. 缺失 ID 自动生成
  it('should generate id when missing', () => {
    const result = LearningObjectiveSchema.safeParse({
      description: '学生能够理解概念',
    });
    expect(result.success).toBe(true);
    expect(result.data?.id).toMatch(/^obj-\d+-[a-z0-9]+$/);
  });

  // 3. 空字符串 ID 重新生成
  it('should regenerate id when empty string', () => {
    const result = LearningObjectiveSchema.safeParse({
      id: '',
      description: '学生能够理解概念',
    });
    expect(result.data?.id).toMatch(/^obj-\d+-[a-z0-9]+$/);
  });

  // 4. 默认值应用
  it('should use default bloomLevel', () => {
    const result = LearningObjectiveSchema.safeParse({
      description: '学生能够理解概念',
    });
    expect(result.data?.bloomLevel).toBe('understand');
  });

  // 5. 必填字段校验
  it('should reject missing description', () => {
    const result = LearningObjectiveSchema.safeParse({
      id: 'obj-1',
    });
    expect(result.success).toBe(false);
  });
});

describe('validateAndFixField', () => {
  // 6. JSON 字符串解析
  it('should parse JSON string', () => {
    const result = validateAndFixField('objectives', '[{"description": "目标1"}]');
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(1);
  });

  // 7. 修复标记
  it('should indicate when data was fixed', () => {
    const result = validateAndFixField('objectives', [{ description: '目标1' }]);
    expect(result.fixed).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});
```

### 运行测试

```bash
cd solutions/your-solution/mcp-server

# 运行测试
npm test

# 测试覆盖率
npm run test:coverage
```

## 参考实现

- **lesson-plan-designer MCP Server**: `solutions/lesson-plan-designer/mcp-server/`
  - `src/schemas.ts` - 完整的 Zod Schema 实现
  - `src/schemas.test.ts` - 75 个测试用例
  - `docs/SCHEMA_VALIDATION.md` - 详细字段文档

## 常见问题

### Q: 什么时候应该使用 Schema 校验？

**A:** 当你的 solution 需要接收结构化数据（数组、嵌套对象）时，强烈建议使用。对于简单的字符串字段，可以选择性使用。

### Q: 校验失败后会自动重试吗？

**A:** 不会。MCP Server 返回错误给 Claude，Claude 看到错误后自行决定是否重试。这是标准的 MCP 模式。

```
AI → write_output({description缺失})
    → MCP Server 返回 error
    → AI 看到错误，决定重新生成正确数据
    → AI → write_output({description: "..."})
    → 成功
```

### Q: 如何添加新字段？

1. 在 `schemas.ts` 中添加 Zod Schema
2. 在 `FieldSchemas` 中注册
3. 在 `index.ts` 的 JSON Schema 中添加定义
4. 更新 SKILL.md 告诉 AI 新字段的用法
5. 添加测试用例

### Q: AI 总是忘记提供某个字段怎么办？

1. 在 SKILL.md 中强调该字段
2. 在 Zod Schema 中设置合理的默认值
3. 确保 JSON Schema 的 `required` 数组包含该字段

## 文件清单

新建 solution 时，需要创建以下文件：

```
your-solution/mcp-server/
├── package.json          # 依赖：zod, vitest
├── tsconfig.json
├── src/
│   ├── index.ts          # MCP Server 入口
│   ├── schemas.ts        # Zod Schema 定义
│   ├── schemas.test.ts   # 测试文件
│   └── types.ts          # TypeScript 类型
└── docs/
    └── SCHEMA_VALIDATION.md  # 字段文档
```
