# CLAUDE.md - KedgeAgentic (即见Agentic) Monorepo

This file provides guidance to Claude Code when working with this monorepo.

## Project Overview

This is the **KedgeAgentic (即见Agentic)** monorepo containing all packages for running and interacting with a relay service for AgentEngine instances (supports Claude Code, OpenCode, and custom engines).

**Platform Context**: KedgeAgentic is a **hosted platform** where users interact via the platform interface. Users do NOT install AgentEngine themselves - the platform manages all AgentEngine infrastructure. Always frame documentation and code from the platform user perspective, not from a self-hosted installation perspective.

## Directory Structure

```
ccaas/
├── package.json                 # Workspace root (npm workspaces)
├── packages/
│   ├── backend/                 # @ccaas/backend - NestJS server
│   ├── admin-next/              # @ccaas/admin-next - React admin UI (Refine + shadcn/ui)
│   ├── vue-sdk/                 # @ccaas/vue-sdk - Vue composables
│   ├── react-sdk/               # @ccaas/react-sdk - React hooks
│   └── shared/                  # @ccaas/common - Shared types
└── docs/                        # Consolidated documentation
```

## Package Overview

| Package | Tech Stack | Purpose |
|---------|------------|---------|
| `@ccaas/backend` | NestJS, TypeORM, Socket.io | API server, AgentEngine lifecycle management, session management, scheduled tasks |
| `@ccaas/admin-next` | React, Refine, shadcn/ui, Tailwind | Admin dashboard |
| `@ccaas/vue-sdk` | Vue 3 Composition API | Vue client integration |
| `@ccaas/react-sdk` | React hooks, Socket.io | React client integration |
| `@ccaas/common` | TypeScript, Zod | Types and protocols |

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
npm run build:react-sdk

# Development
npm run dev:backend     # Start backend on :3001
npm run dev:admin       # Start admin on :5175
```

## Package Dependencies

```
@ccaas/common           <- No internal deps
    ↑
@ccaas/vue-sdk         <- Depends on shared
@ccaas/react-sdk       <- Depends on shared
    ↑
@ccaas/admin-next      <- Can use react-sdk (optional)

@ccaas/backend         <- Can use shared types (optional)
```

**Build order:** shared → vue-sdk/react-sdk → admin-next/backend

## Key Conventions

### Imports

```typescript
// Import from workspace packages
import { Session, Skill, TokenUsage } from '@ccaas/common'
import { useAgentState, useFormBridge } from '@ccaas/vue-sdk'
```

### Adding New Types

1. Add interface to `packages/common/src/types/index.ts`
2. Re-export from `packages/common/src/index.ts`
3. Run `npm run build:shared`
4. Import from `@ccaas/common` in consumer packages

### Adding New Protocols

1. Add to `packages/common/src/protocols/`
2. Export from `packages/common/src/protocols/index.ts`
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
npm run test -w @ccaas/common
```

## Individual Package Details

### @ccaas/backend

See: `packages/backend/CLAUDE.md`

- NestJS modular architecture
- TypeORM with SQLite (upgradeable to PostgreSQL)
- API key authentication with scopes
- AgentEngine lifecycle management (Claude Code, OpenCode, custom engines)
- MCP server pool management

### @ccaas/admin-next

See: `packages/admin-next/README.md`

- React 18 with TypeScript
- Refine framework for data management
- shadcn/ui components + Tailwind CSS
- Socket.io for real-time updates
- Recharts for analytics visualizations

### @ccaas/vue-sdk

See: `packages/vue-sdk/docs/ARCHITECTURE.md`

- Vue 3 composables for state management
- Socket.io connection management
- Form synchronization utilities
- Type-safe event handling

### @ccaas/react-sdk

See: `packages/react-sdk/README.md`

- React hooks for state management
- Socket.io connection management
- Chat UI components (ChatPanel, MessageBubble, etc.)
- Form synchronization utilities
- Type-safe event handling

### @ccaas/common

See: `packages/common/README.md`

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

### 架构原则 (2026-02 教训)

**背景**：核心后端曾包含完整的 lesson-plans 模块（1,370 行），与 solution 后端重复，违反架构分层原则。

**根本原因**：
- 原型阶段在 core 快速开发
- 后期提取到 solution，忘记从 core 删除
- 缺乏明确的架构边界规则
- 没有自动化检测机制

**架构分层原则** (强制执行):

> **Core Backend (CCAAS)** = 中继服务 + 技能路由 + 认证
>
> **Solution Backends** = 领域数据 + 业务逻辑 + 集成
>
> **严禁混合两者**

**Core Backend 允许的实体** (基础设施):
- ✅ `Session` - 会话管理（中继）
- ✅ `Skill` - 技能注册（路由）
- ✅ `User`, `ApiKey` - 认证授权
- ✅ `Message` - 消息历史（中继）
- ✅ `File` - 通用文件元数据
- ✅ `OutputUpdate` - 协议事件
- ✅ `ScheduledTask` - 定时任务

**Core Backend 禁止的实体** (领域逻辑):
- ❌ `LessonPlan`, `Textbook`, `CurriculumStandard` (教育领域)
- ❌ `Product`, `Order`, `Cart` (电商领域)
- ❌ `Patient`, `Appointment` (医疗领域)
- ❌ 任何特定行业/解决方案的业务实体

**检查清单** (添加新实体前):
```
□ 这是基础设施实体吗？(Session, Skill, Auth) → 允许添加到 core
□ 这是领域实体吗？(LessonPlan, Product, Order) → 必须放在 solution backend
□ 运行架构测试：npm run test:architecture (待实现)
□ 代码审查：新增 @Entity() 必须有正当理由
```

**Solution Backend 标准结构**:
```
solutions/my-solution/
├── backend/                    # Solution 拥有独立后端
│   ├── src/
│   │   ├── domain/            # 领域实体在此
│   │   ├── api/               # REST endpoints
│   │   └── app.module.ts
│   └── package.json
└── frontend/
    └── src/hooks/
        └── useSolution.ts     # 调用 solution backend
```

**Frontend 集成模式**:
```typescript
export function useMyFeatureSession() {
  // Core CCAAS: WebSocket for chat relay
  const connection = useAgentConnection({
    serverUrl: 'http://localhost:3001'  // Core backend
  })

  // Solution backend: REST for domain data
  const domainData = useMyFeatureAPI({
    apiUrl: 'http://localhost:3002'     // Solution backend
  })

  return { connection, domainData }
}
```

**防止架构违规** (待实现):
1. 自动化架构测试 (检测 core 中的领域实体)
2. Pre-commit hook (阻止在 core 添加 `@Entity()`)
3. CI/CD 验证 (PR 必须通过架构测试)
4. 文档化允许/禁止的实体类型

**参考**: `LESSON_PLANS_MODULE_REMOVAL_COMPLETE.md` - 完整的架构违规案例分析

## Development Workflow (一人公司 + AI Review)

本项目采用 **AI-assisted development workflow**，使用 Claude Code Agent 进行代码审查。

### 核心流程

```
Linear Issue → 分支 → TDD 开发 → PR → Claude Code Review → CI → Merge → Linear Done
```

### 关键组件

1. **Git Hooks**: 自动验证 commit message 格式
2. **GitHub Actions CI**: 自动化测试和架构检查
3. **PR Template**: 为 Claude Code 提供结构化 review checklist
4. **架构测试**: 自动防止架构违规（如 lesson-plans 模块事件）
5. **Linear**: 个人任务管理（手动更新）

### 快速参考

```bash
# 创建分支
git checkout -b feature/ccaas-123-feature-name

# TDD 开发
npm test                    # 先运行测试确保通过
# 写测试 → 写代码 → 测试通过

# 提交（自动验证 commit message）
git commit -m "feat(backend): add feature"

# 创建 PR
gh pr create --fill

# 请 Claude Code review
"请根据 PR template 中的 checklist review 这个 PR"

# CI 自动检查
# ✅ Lint, Type Check, Tests, Architecture Tests, Build

# Merge
gh pr merge --squash
```

### 详细文档

- **[CONTRIBUTING.md](./CONTRIBUTING.md)** - 完整的贡献指南
- **[docs/WORKFLOW.md](./docs/WORKFLOW.md)** - 详细的研发流程
- **[docs/PROJECT_MANAGEMENT_GUIDE.md](./docs/PROJECT_MANAGEMENT_GUIDE.md)** - 项目管理和文档规范
- **[docs/designs/](./docs/designs/)** - 设计文档模板
- **[docs/adr/](./docs/adr/)** - 架构决策记录

### 任务跟踪与文档规范 (重要！)

**使用 Linear 跟踪任务，而不是生成完成总结文件**

❌ **不要做**:
- 不要为每个任务生成 `*_COMPLETE.md` 文件
- 不要创建 `PHASE_X_COMPLETE.md` 跟踪进度
- 简单任务不需要文档文件

✅ **应该做**:
- 在 Linear issue 中更新任务状态和进度
- 仅为**架构决策**创建 ADR (`docs/adr/`)
- 仅为**复杂技术机制**创建实现指南 (`docs/implementation/`)
- 使用 commit message 记录代码变更

**决策树**:
```
任务完成
    ↓
是架构决策吗？→ YES → 创建 ADR (docs/adr/)
    ↓ NO
是复杂技术机制需要解释吗？→ YES → 创建实现指南 (docs/implementation/)
    ↓ NO
是简单任务/Bug修复？→ YES → 更新 Linear + Commit → 完成 ✅
```

详细规范见 **[docs/PROJECT_MANAGEMENT_GUIDE.md](./docs/PROJECT_MANAGEMENT_GUIDE.md)**

### Linear Workflow Automation

All tasks are automatically tracked in Linear using the `linear-task-workflow` skill:

- **New tasks**: Linear issue auto-created when you describe a task
- **Progress updates**: Milestones recorded in Linear comments
- **Final summary**: Complete deliverables summary in Linear
- **No `*_COMPLETE.md` files**: All tracking in Linear, not code repo

For details, see: [`.claude/skills/linear-task-workflow/SKILL.md`](.claude/skills/linear-task-workflow/SKILL.md)

### Commit Message 规范

遵循 Conventional Commits:

```
<type>(<scope>): <subject>

type: feat, fix, refactor, docs, test, chore, perf
scope: backend, frontend, react-sdk, vue-sdk, admin, docs, common
subject: 简洁描述（≤80 字符，小写）

示例:
feat(backend): add JWT authentication
fix(react-sdk): fix API response parsing
docs(readme): update installation guide
```

Git Hooks 会自动验证格式。

### 架构测试

运行架构测试防止违规：

```bash
npm run test:architecture

# 检查：
# ✅ 核心后端不包含领域实体
# ✅ 没有从 solutions 导入
# ✅ 实体放在正确位置
```

### PR Review with Claude Code

创建 PR 后，请 Claude Code 进行 review：

```
请根据 PR template 中的 checklist review 这个 PR，重点检查：
1. 架构合规性（核心后端是否包含领域实体）
2. 测试覆盖
3. API 契约
4. 安全性
```

Claude Code 会逐项检查并提供反馈。

## Refactoring Guidelines

### Terminology and Field Name Changes

When refactoring terminology or field names across the codebase:

1. **Search First**: Always use `Grep` to find ALL usages of the term/field before making any changes
2. **Document Scope**: List all affected files and usage contexts
3. **Verify Coverage**: After changes, grep again to ensure no instances were missed
4. **Update Tests**: Check that tests reflect the new terminology
5. **Update Documentation**: Ensure all docs use consistent terminology

**Example Pattern**:
```bash
# 1. Find all usages
grep -r "old_term" --include="*.ts" --include="*.tsx" --include="*.md"

# 2. Make changes across all files
# ... edit files ...

# 3. Verify no old usages remain
grep -r "old_term" --include="*.ts" --include="*.tsx" --include="*.md"
```

This ensures complete coverage and prevents partial refactoring that leaves the codebase in an inconsistent state.

## Response Language

Respond in the same language as the user's message.
