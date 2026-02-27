# CLAUDE.md - LEGO Playground

## 项目概述

LEGO Playground 是一个 AI 驱动的乐高马赛克设计工具。用户上传图片，AI Agent 将其转换为 2D 乐高马赛克拼图，生成零件清单（BOM）和 PDF 拼装指南。

## 架构

```
┌──────────────┐    ┌──────────────┐    ┌──────────────────────────┐
│   Frontend   │◄──►│   Backend    │◄──►│    CCAAS Backend         │
│  (React)     │    │  (NestJS)    │    │    (port 3001)           │
│  port 5285   │    │  port 3008   │    │                          │
└──────────────┘    └──────────────┘    └──────────┬───────────────┘
                                                    │
                                                    ▼
                                        ┌──────────────────────────┐
                                        │   MCP Server (stdio)     │
                                        │   REST fallback: 3009    │
                                        │                          │
                                        │   Tools:                 │
                                        │   - write_output         │
                                        │   - analyze_image        │
                                        │   - generate_mosaic      │
                                        │   - generate_assembly_pdf│
                                        │   - get_lego_colors      │
                                        │   - get_lego_bricks      │
                                        └──────────────────────────┘
```

## 技术栈

| 组件 | 技术 | 端口 |
|------|------|------|
| Frontend | React 18 + Vite + Tailwind + Konva.js + Zustand | 5285 |
| Backend | NestJS + TypeORM + SQLite | 3008 |
| MCP Server | stdio (primary) / Express.js REST (fallback) | 3009 |
| CCAAS | NestJS (前置条件) | 3001 |

## CCAAS 集成

### 传输协议

前端通过 `@kedge-agentic/react-sdk` 的 `useAgentConnection` + `useAgentChat` 连接 CCAAS，使用 **SSE** (Server-Sent Events) 传输。

```typescript
const connection = useAgentConnection({
  serverUrl: 'http://localhost:3001',  // 绝对 URL，直连 CCAAS
  sessionPrefix: 'lego',
  transport: 'sse',
})
```

### tenantId（必填）

硬编码 `tenantId = 'lego-playground'`。

### sessionTemplate

使用 `mosaic-designer` 模板（定义在 solution.json 的 `sessionTemplates` 中）。

## 关键领域知识

- 乐高马赛克是 **2D 墙面艺术**（类似 LEGO Art 系列），不是 3D 模型
- 2-3 层结构用于 **错缝加固**，不是立体深度
- BrickLink ID 体系（零件 ID 如 "3024" = 1x1 板、颜色 ID 如 11 = 黑色）
- 颜色匹配使用 CIEDE2000 感知色差算法
- 结构规则：相邻层接缝不得垂直对齐

## 开发命令

```bash
# MCP Server
cd mcp-server && npm install && npm run build
cd mcp-server && npm run start       # REST 模式 port 3009
cd mcp-server && npm run start:stdio  # Stdio 模式

# Backend
cd backend && npm install
cd backend && npm run start:dev       # port 3008

# Frontend
cd frontend && npm install
cd frontend && npm run dev            # port 5285

# 一键启动
./setup.sh
```

## SYNC_FIELDS

```typescript
export const SYNC_FIELDS = [
  'mosaicConfig',       // 马赛克配置 (object)
  'placements',         // 砖块排布 (Placement[])
  'billOfMaterials',    // 零件清单 (BillItem[])
  'assessment',         // AI 评估 (LLMAssessment)
  'iterationHistory',   // 迭代历史 (IterationSummary[])
  'generationStatus',   // 生成状态 (object)
  'assemblyGuideUrl',   // PDF 下载链接 (string)
] as const;
```

## CRITICAL: serverUrl 必须是绝对 URL

```typescript
// ✅ 正确
const SERVER_URL = 'http://localhost:3001'

// ❌ 错误（会把请求发到前端端口 5285）
const SERVER_URL = ''
const SERVER_URL = '/'
```

## 强制检查清单

修改代码前：
- [ ] 运行相关测试确认通过
- [ ] 检查前端类型定义是否受影响

修改代码后：
- [ ] 立即运行相关测试
- [ ] 测试失败 = 停下分析

## 响应语言

根据用户消息语言回复。
