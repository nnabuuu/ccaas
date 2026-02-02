# CLAUDE.md - LEGO Playground

## 项目概述

LEGO Playground 是一个 AI 驱动的乐高马赛克设计工具。用户上传图片，AI Agent 将其转换为 2D 乐高马赛克拼图，生成零件清单（BOM）和 PDF 拼装指南。

## 架构

```
┌──────────────┐    ┌──────────────┐    ┌──────────────────────────┐
│   Frontend   │◄──►│   Backend    │◄──►│    CCAAS Backend         │
│  (React)     │    │  (NestJS)    │    │    (port 3001)           │
│  port 5282   │    │  port 3005   │    │                          │
└──────────────┘    └──────────────┘    └──────────┬───────────────┘
                                                    │
                                                    ▼
                                        ┌──────────────────────────┐
                                        │   MCP REST Server        │
                                        │   (Express.js)           │
                                        │   port 3006              │
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
| Frontend | React 18 + Vite + Tailwind + Konva.js + Zustand | 5282 |
| Backend | NestJS + TypeORM + SQLite | 3005 |
| MCP Server | Express.js REST + stdio wrapper | 3006 |
| CCAAS | NestJS (前置条件) | 3001 |

## CCAAS 集成要点

### tenantId（必填）

CCAAS 的 DTO 将 `tenantId` 标记为 `@IsOptional()`，但业务逻辑实际上 **要求它存在**。如果不传 `tenantId`：
- WebSocket chat → `agent_status` error，聊天立即失败
- REST completion → `BadRequestException` (400)
- 原因：Skill 同步需要 tenantId 来定位租户的技能文件

本项目硬编码 `tenantId = 'lego-playground'`，在 `useMosaicSync.ts` 中用于：
- 文件上传 (`POST /api/v1/files/upload`)
- 消息发送 (`POST /api/v1/sessions/{sessionId}/completion`)

### WebSocket 连接

前端 WebSocket 通过 Vite dev server 代理连接（`io('/')`），与 lesson-plan-designer 保持一致。Vite 配置将 `/socket.io` 代理到 `localhost:3001`。连接后 CCAAS 自动分配 `clientId`（通过 `client_id` 事件），无需手动 emit `session:join`。

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
cd mcp-server && npm run start       # REST 模式 port 3006
cd mcp-server && npm run start:stdio  # Stdio 模式

# Backend
cd backend && npm install
cd backend && npm run start:dev       # port 3005

# Frontend
cd frontend && npm install
cd frontend && npm run dev            # port 5282

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

## 强制检查清单

修改代码前：
- [ ] 运行相关测试确认通过
- [ ] 检查前端类型定义是否受影响

修改代码后：
- [ ] 立即运行相关测试
- [ ] 测试失败 = 停下分析

## 响应语言

根据用户消息语言回复。
