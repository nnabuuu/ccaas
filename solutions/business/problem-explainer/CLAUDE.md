# CLAUDE.md - Problem Explainer Solution

## 项目概述

讲题助手 (Problem Explainer) 是一个 AI 驱动的完整讲题工作流解决方案：
1. **分析题目** - 识别知识点、分析解题步骤、评估难度
2. **生成讲稿** - 创建结构化的讲解文稿
3. **生成音频** - 通过 NotebookLM 生成讲解音频
4. **生成 PPT** - 创建演示文稿
5. **输出文件** - 所有产出物可下载

## 架构概览

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          Problem Explainer 架构                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────────┐  │
│  │   Frontend   │◄──►│   Backend    │◄──►│    CCAAS Backend         │  │
│  │  (React)     │    │  (NestJS)    │    │    (port 3001)           │  │
│  │  port 5281   │    │  port 3003   │    │                          │  │
│  └──────────────┘    └──────────────┘    └──────────┬───────────────┘  │
│                                                      │                  │
│                                                      ▼                  │
│                                          ┌──────────────────────────┐  │
│                                          │   MCP REST Server        │  │
│                                          │   (Express.js)           │  │
│                                          │   port 3004              │  │
│                                          │                          │  │
│                                          │   REST Adapter 类型      │  │
│                                          │   - write_output         │  │
│                                          │   - get_subjects         │  │
│                                          │   - get_knowledge_points │  │
│                                          │   - calculate_difficulty │  │
│                                          │   - generate_script      │  │
│                                          └──────────────────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## 技术栈

| 组件 | 技术 | 端口 |
|------|------|------|
| Frontend | React + Vite + Tailwind | 5281 |
| Backend | NestJS + TypeORM + SQLite | 3003 |
| MCP Server | Express.js REST API | 3004 |
| CCAAS | NestJS (前置条件) | 3001 |

**关联 Skills**: notebooklm, pptx

## 完整工作流

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        讲题完整工作流                                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  [题目输入] ──────► [Phase 1: 分析]                                      │
│      │                   │                                              │
│      │           ┌───────┴───────┐                                      │
│      │           │ 识别知识点      │                                      │
│      │           │ 分析解题步骤    │                                      │
│      │           │ 计算难度        │                                      │
│      │           └───────┬───────┘                                      │
│      │                   │                                              │
│      │                   ▼                                              │
│      │           [Phase 2: 讲稿]                                         │
│      │                   │                                              │
│      │           generate_script_template                                │
│      │                   │                                              │
│      │                   ▼                                              │
│      │           [Phase 3: 音频]                                         │
│      │                   │                                              │
│      │           /notebooklm skill                                       │
│      │                   │                                              │
│      │                   ▼                                              │
│      │           [Phase 4: PPT]                                          │
│      │                   │                                              │
│      │           /pptx skill                                             │
│      │                   │                                              │
│      │                   ▼                                              │
│      └─────────► [Phase 5: 输出]                                         │
│                         │                                               │
│                  📄 讲稿.md                                              │
│                  🎙️ 音频.mp3                                             │
│                  📊 PPT.pptx                                             │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## MCP REST API

MCP Server 作为 HTTP REST 服务运行在 port 3004，CCAAS 通过 `rest-adapter` 类型调用。

### 端点列表

| 端点 | 方法 | 说明 |
|------|------|------|
| `/health` | GET | 健康检查 |
| `/tools/write_output` | POST | 同步内容到前端 |
| `/tools/get_subjects` | GET/POST | 获取学科列表 |
| `/tools/get_knowledge_points` | POST | 查询知识点 |
| `/tools/calculate_difficulty` | POST | 计算难度 |
| `/tools/generate_script_template` | POST | 生成讲稿模板 |

### write_output

同步讲解内容到前端。

```typescript
// POST /tools/write_output
Request: {
  field: SyncField,    // 要更新的字段
  value: any,          // 字段值
  preview: string      // 用户预览描述
}

Response: {
  status: 'success',
  data: { field, value, preview }
}
```

### calculate_difficulty

根据知识点和步骤数计算难度。

```typescript
// POST /tools/calculate_difficulty
Request: {
  knowledgePointCount: number,
  stepCount: number
}

Response: {
  status: 'success',
  data: {
    difficulty: number,       // 1-5
    label: string,            // 基础/简单/中等/较难/困难
    formula: string,
    estimatedTime: string
  }
}
```

**公式**: `min(5, ceil((知识点数 × 0.5) + (步骤数 × 0.3)))`

### generate_script_template

生成讲稿模板。

```typescript
// POST /tools/generate_script_template
Request: {
  problemContent: string,
  subject: string,
  knowledgePoints: string[],
  solutionSteps: SolutionStep[],
  answer: string,
  difficulty: number,
  commonMistakes?: string[]
}

Response: {
  status: 'success',
  data: {
    script: string,           // Markdown 格式讲稿
    metadata: {...},
    instructions: string      // 保存说明
  }
}
```

## SYNC_FIELDS 定义

```typescript
export const SYNC_FIELDS = [
  'problemAnalysis',   // 题目分析
  'keyKnowledge',      // 核心知识点 (string[])
  'solutionSteps',     // 解题步骤 (SolutionStep[])
  'answer',            // 最终答案
  'commonMistakes',    // 易错点 (string[])
  'relatedProblems',   // 变式练习 (string[])
  'hints',             // 提示
  'difficulty',        // 难度 (1-5)
] as const
```

## 用户指令

| 指令 | 执行内容 |
|------|----------|
| `讲解这道题` | Phase 1 分析 |
| `生成讲稿` | Phase 1 + 2 |
| `生成音频` | Phase 1 + 2 + 3 |
| `生成PPT` | Phase 1 + 2 + 4 |
| `全套材料` | Phase 1-5 完整流程 |

## 文件输出

所有生成的文件保存到会话工作区：

```
.agent-workspace/sessions/{sessionId}/outputs/
├── 讲稿_{题目名}.md
├── 讲解音频.mp3
└── 讲解PPT.pptx
```

用户可以通过消息附件直接下载。

## 目录结构

```
problem-explainer/
├── solution.json          # 配置、工作流定义
├── CLAUDE.md              # 本文件
├── README.md              # 用户文档
├── setup.sh               # 启动脚本
├── inject-skills.sh       # Skill + MCP Server 注入
│
├── backend/               # NestJS (port 3003)
├── frontend/              # React (port 5281)
├── mcp-server/            # MCP REST API (port 3004)
├── data/                  # 领域数据
└── skills/                # SKILL.md
```

## 启动命令

```bash
# 开发模式 (启动所有服务)
./setup.sh

# 或分别启动
cd mcp-server && npm run start   # port 3004
cd backend && npm run start:dev  # port 3003
cd frontend && npm run dev       # port 5281

# 仅启动 MCP Server
./setup.sh --mcp-only

# 仅注入 Skills 和 MCP Server 配置
./setup.sh --inject-only
```

**前置条件**: CCAAS backend 运行在 port 3001

## MCP Server 注册

`inject-skills.sh` 会自动将 MCP Server 注册到 CCAAS：

```json
{
  "name": "Problem Explainer Tools",
  "slug": "problem-explainer-tools",
  "type": "rest-adapter",
  "config": {
    "restAdapter": {
      "baseUrl": "http://localhost:3004",
      "auth": { "type": "none" },
      "endpoints": [...]
    }
  }
}
```

验证注册：
```bash
curl http://localhost:3001/api/v1/mcp-servers -H 'X-Tenant-Id: problem-explainer'
```

## 开发原则

### TDD 强制规则

```
修改代码前：
□ 运行 npm test 确认测试通过
□ 检查前端类型定义

修改代码后：
□ 立即运行相关测试
□ 测试失败 = 停下分析
```

### API 修改检查

修改 API 前必须：
1. 检查 `frontend/src/types/index.ts`
2. 检查 `mcp-server/src/types.ts`
3. 运行 `npm test`

## 响应语言

根据用户消息语言回复。
