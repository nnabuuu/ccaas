# 6.3 MCP Server

## 本节目标

在本节中，你将为 Lesson Plan Designer Solution 构建 MCP Server。MCP Server 提供 AI Agent 在对话过程中可以调用的工具——最重要的是 `write_output` 工具，它将 AI 生成的数据同步到前端表单。

完成本节后，你将拥有：

- 一个使用 `@modelcontextprotocol/sdk` 构建的 MCP Server
- 一个带字段验证的 `write_output` 工具
- 使用 Zod schema 的输入校验
- 在 `solution.json` 中注册的 MCP Server

## 理解 MCP Server 的角色

回顾架构章节的内容：

```
用户 → 前端 → CCAAS → AI Agent → MCP Server → (响应) → CCAAS → 前端
```

MCP Server 处于这个链条的末端。当 AI Agent 决定更新表单字段时，它会调用 MCP Server 上的 `write_output`。MCP Server 验证输入并返回结构化响应。然后 CCAAS 将该响应包装成 `output_update` SSE 事件并推送到前端。

MCP Server **不会**直接与前端通信——CCAAS 负责处理这个中继。

## 项目设置

### 目录结构

```
solutions/business/lesson-plan-designer/
└── mcp-server/              # ← 我们要构建的部分
    ├── package.json
    ├── tsconfig.json
    └── src/
        ├── index.ts          # Server 入口
        └── schemas.ts        # Zod 验证 schema
```

### 初始化项目

```bash
cd solutions/business/lesson-plan-designer
mkdir -p mcp-server/src
cd mcp-server
```

创建 `package.json`：

```json
{
  "name": "lesson-plan-designer-mcp",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "@types/node": "^20.0.0"
  }
}
```

创建 `tsconfig.json`：

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "node16",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true
  },
  "include": ["src/**/*"]
}
```

安装依赖：

```bash
npm install
```

## 第 1 步：定义同步字段和类型

创建 `src/types.ts`，使用第 2 章中的同步字段定义：

```typescript
// src/types.ts

export const SYNC_FIELDS = [
  'title',
  'subject',
  'gradeLevel',
  'durationMinutes',
  'lessonPlanCode',
  'objectives',
  'content',
  'teachingMethods',
  'materialsNeeded',
  'assessmentMethods',
  'curriculumRequirements',
  'studentAnalysis',
  'extraProperties',
  'status',
  'attachments',
] as const;

export type SyncField = typeof SYNC_FIELDS[number];

export interface WriteOutputInput {
  field: SyncField;
  value: unknown;
  preview?: string;
}

export interface WriteOutputResult {
  data: {
    field?: SyncField;
    value?: unknown;
    preview?: string;
    error?: string;
    originalValue?: unknown;
  };
  status: 'success' | 'error';
}
```

{% hint style="info" %}
`SYNC_FIELDS` 数组是 AI Agent 可以更新哪些字段的唯一数据源。这个列表必须与 Skill 指令和前端处理器保持一致。
{% endhint %}

## 第 2 步：添加 Zod 验证 Schema

创建 `src/schemas.ts` 来验证 AI Agent 发送的数据：

```typescript
// src/schemas.ts

import { z } from 'zod';
import { SYNC_FIELDS, type SyncField } from './types.js';

// 每个字段的验证 schema
const fieldSchemas: Record<SyncField, z.ZodType> = {
  title: z.string().min(1, '标题不能为空').max(200),
  subject: z.string().max(100),
  gradeLevel: z.number().int().min(1).max(12),
  durationMinutes: z.number().int().min(1).max(600),
  lessonPlanCode: z.string().max(100).nullable(),
  objectives: z.string().max(10000),
  content: z.string().max(50000),
  teachingMethods: z.string().max(10000),
  materialsNeeded: z.string().max(5000),
  assessmentMethods: z.string().max(10000),
  curriculumRequirements: z.array(z.object({
    id: z.number(),
    standardCode: z.string(),
    title: z.string(),
    stage: z.string(),
    standardType: z.string(),
    contentDomain: z.string(),
  })),
  studentAnalysis: z.string().max(10000),
  extraProperties: z.record(z.string(), z.unknown()),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']),
  attachments: z.array(z.object({
    id: z.string(),
    fileId: z.string(),
    fileName: z.string(),
    fileType: z.enum(['script', 'audio', 'ppt', 'pdf', 'other']),
    mimeType: z.string(),
    size: z.number(),
    downloadUrl: z.string(),
    uploadedAt: z.string(),
    description: z.string().optional(),
  })),
};

export interface ValidationResult {
  success: boolean;
  data?: unknown;
  errors: string[];
}

/**
 * 根据 schema 验证 write_output 字段值。
 */
export function validateField(
  field: SyncField,
  value: unknown
): ValidationResult {
  const schema = fieldSchemas[field];
  if (!schema) {
    return {
      success: false,
      errors: [`未知字段: ${field}`],
    };
  }

  const result = schema.safeParse(value);
  if (result.success) {
    return {
      success: true,
      data: result.data,
      errors: [],
    };
  }

  return {
    success: false,
    errors: result.error.issues.map(
      (issue) => `${issue.path.join('.')}: ${issue.message}`
    ),
  };
}
```

### 为什么在 MCP Server 中验证？

AI Agent 并不总是能产生格式完全正确的数据。常见问题包括：

- 期望字符串时发送了数字
- 使用了无效的枚举值（例如 `"completed"` 而不是 `"done"`）
- 缺少必填字段

通过在 MCP Server 中验证，你可以尽早捕获这些问题。AI Agent 会收到清晰的错误消息并能自我修正。

## 第 3 步：构建 MCP Server

创建 `src/index.ts`——主要的 server 文件：

```typescript
#!/usr/bin/env node
// src/index.ts

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js';
import {
  SYNC_FIELDS,
  type SyncField,
  type WriteOutputInput,
  type WriteOutputResult,
} from './types.js';
import { validateField } from './schemas.js';

// 创建 MCP server
const server = new Server(
  {
    name: 'lesson-plan-tools',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// 定义 write_output 工具
const writeOutputTool: Tool = {
  name: 'write_output',
  description: `将教案数据写入前端表单。每次更新一个字段。

有效字段: ${SYNC_FIELDS.join(', ')}

字段类型:
- title: string (课程标题，1-200 字符)
- subject: string (学科名称，如 "数学"、"语文")
- gradeLevel: number (年级，1-12)
- durationMinutes: number (课时时长，分钟)
- lessonPlanCode: string | null (教案编号)
- objectives: string (学习目标，ABCD 格式)
- content: string (教学过程 / 学习活动)
- teachingMethods: string (教学方法)
- materialsNeeded: string (所需材料)
- assessmentMethods: string (评估设计)
- curriculumRequirements: object[] (课程标准引用)
- studentAnalysis: string (学情分析)
- extraProperties: object (可扩展键值存储)
- status: "DRAFT" | "PUBLISHED" | "ARCHIVED"
- attachments: object[] (附件)

示例:
{
  "field": "objectives",
  "value": "学生将理解分数的概念",
  "preview": "设置学习目标"
}`,
  inputSchema: {
    type: 'object',
    properties: {
      field: {
        type: 'string',
        enum: [...SYNC_FIELDS],
        description: '要更新的教案字段',
      },
      value: {
        description: '字段的值',
      },
      preview: {
        type: 'string',
        description: '变更的人类可读摘要',
      },
    },
    required: ['field', 'value'],
  },
};

// 注册工具
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: [writeOutputTool] };
});

// 处理工具调用
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === 'write_output') {
    return handleWriteOutput(args as unknown as WriteOutputInput);
  }

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        data: { error: `未知工具: ${name}` },
        status: 'error',
      }),
    }],
    isError: true,
  };
});

/**
 * 处理 write_output 工具调用。
 */
function handleWriteOutput(input: WriteOutputInput) {
  // 1. 检查字段名是否有效
  if (!SYNC_FIELDS.includes(input.field)) {
    const result: WriteOutputResult = {
      data: {
        error: `无效字段: "${input.field}"。有效字段: ${SYNC_FIELDS.join(', ')}`,
      },
      status: 'error',
    };
    return {
      content: [{ type: 'text' as const, text: JSON.stringify(result) }],
      isError: true,
    };
  }

  // 2. 根据字段的 schema 验证值
  const validation = validateField(input.field, input.value);
  if (!validation.success) {
    const result: WriteOutputResult = {
      data: {
        error: `"${input.field}" 验证失败: ${validation.errors.join('; ')}`,
      },
      status: 'error',
    };
    return {
      content: [{ type: 'text' as const, text: JSON.stringify(result) }],
      isError: true,
    };
  }

  // 3. 返回成功结果和已验证的数据
  const result: WriteOutputResult = {
    data: {
      field: input.field,
      value: validation.data,
      preview: input.preview,
    },
    status: 'success',
  };

  return {
    content: [{ type: 'text' as const, text: JSON.stringify(result) }],
  };
}

// 启动 server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // 使用 stderr 输出日志，因为 stdout 预留给 MCP 协议
  console.error('Lesson Plan Designer MCP Server 已启动');
}

main().catch((error) => {
  console.error('启动 MCP server 失败:', error);
  process.exit(1);
});
```

## 第 4 步：在 solution.json 中注册

MCP Server 必须在 `solution.json` 中注册，以便 CCAAS 知道如何启动它：

```json
{
  "mcpServers": {
    "lesson-plan-tools": {
      "command": "node",
      "args": ["mcp-server/dist/index.js"],
      "description": "Lesson Plan Designer MCP tools including write_output",
      "type": "stdio",
      "env": {}
    }
  }
}
```

关键字段：

| 字段 | 描述 |
|------|------|
| `command` | 要执行的命令 (`node`) |
| `args` | 命令的参数（编译后的 JS 路径） |
| `type` | 通信协议（`stdio` 标准输入输出） |
| `env` | 传递给进程的环境变量 |

{% hint style="warning" %}
`args` 路径指向 `dist/index.js`，而不是 `src/index.ts`。运行 MCP Server 之前必须先构建：`npm run build`。
{% endhint %}

## 第 5 步：构建和测试

### 构建 MCP Server

```bash
cd solutions/business/lesson-plan-designer/mcp-server
npm run build
```

### 手动测试

你可以通过 MCP inspector 或向 stdin 输入 JSON 来在本地测试 MCP Server：

```bash
# 列出可用工具
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node dist/index.js

# 使用有效字段调用 write_output
echo '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"write_output","arguments":{"field":"objectives","value":"学生将理解分数的概念","preview":"设置学习目标"}}}' | node dist/index.js

# 使用无效字段调用 write_output
echo '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"write_output","arguments":{"field":"invalid","value":"test"}}}' | node dist/index.js
```

期望的响应：

- **有效调用：** `{ "data": { "field": "objectives", "value": "学生将理解分数的概念" }, "status": "success" }`
- **无效字段：** `{ "data": { "error": "无效字段: \"invalid\"..." }, "status": "error" }`

## write_output 如何变成 output_update

当你的 MCP Server 返回成功的 `write_output` 结果后，CCAAS 内部会发生以下事情：

```
MCP Server 返回:
{
  "data": { "field": "objectives", "value": "学生将理解分数的概念" },
  "status": "success"
}
          │
          ▼
CCAAS EventMapper 将其包装为 output_update 事件:
{
  "type": "output_update",
  "sessionId": "abc-123",
  "payload": {
    "data": {
      "field": "objectives",
      "value": "学生将理解分数的概念",
      "operation": "set"
    }
  }
}
          │
          ▼
CCAAS 通过 SSE 推送到 Solution 后端，
Solution 后端再中继到前端。
```

你不需要实现这个中继——CCAAS 会自动处理。你的 MCP Server 只需要返回正确的 `{ data, status }` 响应格式。

## 添加自定义工具（可选）

除了 `write_output`，你还可以添加领域特定的工具。对于教案设计器，你可能会添加一个查询课程标准的工具：

```typescript
const getCurriculumStandardsTool: Tool = {
  name: 'get_curriculum_standards',
  description: '按学科、年级和关键词搜索课程标准',
  inputSchema: {
    type: 'object',
    properties: {
      subject: {
        type: 'string',
        description: '学科名称（如 "数学"、"语文"）',
      },
      keyword: {
        type: 'string',
        description: '搜索关键词',
      },
      grade: {
        type: 'number',
        description: '年级（1-12）',
      },
    },
  },
};
```

AI Agent 可以使用这个工具在设计教案时查询相关的课程标准，确保学习目标与官方要求保持一致。

## 检查点

进入下一节之前，请验证：

- [ ] MCP Server 构建无错误（`npm run build`）
- [ ] `tools/list` 返回带有正确字段描述的 `write_output` 工具
- [ ] 有效的 `write_output` 调用返回 `{ status: "success" }` 以及 field 和 value
- [ ] 无效的字段名返回 `{ status: "error" }` 和清晰的错误消息
- [ ] 无效的值（如 `gradeLevel: 15`）返回验证错误

## 常见错误

### 1. 向 stdout 输出日志

```typescript
// 错误：stdout 预留给 MCP 协议
console.log('Server 已启动');

// 正确：使用 stderr 输出日志
console.error('Server 已启动');
```

### 2. 忘记在运行前构建

`solution.json` 指向 `dist/index.js`。如果你修改了 `src/index.ts` 但忘记运行 `npm run build`，CCAAS 会启动旧版本。

### 3. 字段名不匹配

如果你的 MCP Server 验证 `objectives` 但 Skill 指令中写的是 `learningObjectives`，AI Agent 会发送 `learningObjectives` 然后得到验证错误。将 `SYNC_FIELDS` 数组作为唯一数据源，并在 MCP Server 和 Skill 中都引用它。

## 本节小结

在本节中你构建了：

- 使用 `@modelcontextprotocol/sdk` 和 stdio 传输的 MCP Server
- 带字段名和值验证的 `write_output` 工具
- 使用 Zod 的输入验证 schema
- 帮助 AI Agent 自我修正的错误处理

MCP Server 是 AI Agent 意图与前端表单之间的桥梁。在下一节中，我们将编写 **Skills**——告诉 AI Agent *如何*使用这些工具的指令。

---

**下一节：** [6.4 Skills](04-skills.md)
**上一节：** [6.2 后端实现](02-backend.md)
