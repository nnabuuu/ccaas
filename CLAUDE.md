# CLAUDE.md - Claude Code as a Service Monorepo

This file provides guidance to Claude Code when working with this monorepo.

## Project Overview

This is the **Claude Code as a Service (CCAAS)** monorepo containing all packages for running and interacting with a relay service for Claude Code CLI.

## Directory Structure

```
ccaas/
├── package.json                 # Workspace root (npm workspaces)
├── packages/
│   ├── backend/                 # @ccaas/backend - NestJS server
│   ├── admin/                   # @ccaas/admin - Vue 3 admin UI
│   ├── vue-sdk/                 # @ccaas/vue-sdk - Vue composables
│   └── shared/                  # @ccaas/shared - Shared types
└── docs/                        # Consolidated documentation
```

## Package Overview

| Package | Tech Stack | Purpose |
|---------|------------|---------|
| `@ccaas/backend` | NestJS, TypeORM, Socket.io | API server, session management |
| `@ccaas/admin` | Vue 3, Ant Design, ECharts | Admin dashboard |
| `@ccaas/vue-sdk` | Vue 3 Composition API | Client integration |
| `@ccaas/shared` | TypeScript, Zod | Types and protocols |

## Build Commands

```bash
# Install all dependencies
npm install

# Build all packages
npm run build

# Build specific package
npm run build:shared    # Build shared first (required)
npm run build:backend
npm run build:admin
npm run build:vue-sdk

# Development
npm run dev:backend     # Start backend on :3001
npm run dev:admin       # Start admin on :5174
```

## Package Dependencies

```
@ccaas/shared           <- No internal deps
    ↑
@ccaas/vue-sdk         <- Depends on shared
    ↑
@ccaas/admin           <- Can use vue-sdk (optional)

@ccaas/backend         <- Can use shared types (optional)
```

**Build order:** shared → vue-sdk → admin/backend

## Key Conventions

### Imports

```typescript
// Import from workspace packages
import { Session, Skill, TokenUsage } from '@ccaas/shared'
import { useAgentState, useFormBridge } from '@ccaas/vue-sdk'
```

### Adding New Types

1. Add interface to `packages/shared/src/types/index.ts`
2. Re-export from `packages/shared/src/index.ts`
3. Run `npm run build:shared`
4. Import from `@ccaas/shared` in consumer packages

### Adding New Protocols

1. Add to `packages/shared/src/protocols/`
2. Export from `packages/shared/src/protocols/index.ts`
3. Run `npm run build:shared`

### Adding New Composables (vue-sdk)

1. Create file in `packages/vue-sdk/src/composables/`
2. Export from `packages/vue-sdk/src/composables/index.ts`
3. Document usage in file JSDoc

## Testing

```bash
# Run all tests
npm run test

# Run specific package tests
npm run test -w @ccaas/backend
npm run test -w @ccaas/vue-sdk
npm run test -w @ccaas/shared
```

## Individual Package Details

### @ccaas/backend

See: `packages/backend/CLAUDE.md`

- NestJS modular architecture
- TypeORM with SQLite (upgradeable to PostgreSQL)
- API key authentication with scopes
- MCP server pool management

### @ccaas/admin

See: `packages/admin/README.md`

- Vue 3 with Composition API
- Ant Design Vue 4.x components
- ECharts for analytics visualizations
- Socket.io for real-time updates

### @ccaas/vue-sdk

See: `packages/vue-sdk/docs/ARCHITECTURE.md`

- Composables for state management
- Socket.io connection management
- Form synchronization utilities
- Type-safe event handling

### @ccaas/shared

See: `packages/shared/README.md`

- TypeScript interfaces for all entities
- Zod schemas for runtime validation
- Output update protocol definitions
- Field mapping utilities

## Development Principles

### TDD 强制规则 (2025-01 教训)

**背景**：曾因"信任计划文档 > 信任测试"导致 API 格式不兼容，前端功能完全失效。

**根本原因**：修改代码前没有运行测试，修改后也没有验证。

**强制检查清单**：

```
修改任何代码前：
□ 运行 npm test 确认当前所有测试通过
□ 如果计划要改变 API/接口，先检查前端类型定义和现有测试

修改代码后：
□ 立即运行相关测试，不要等到最后
□ 测试失败 = 停下来分析，不要继续前进
```

**核心原则**：
```
测试是代码的契约，计划只是意图的表达。
当计划与测试冲突时，应该质疑计划，而不是忽略测试。
```

## Response Language

Respond in the same language as the user's message.
