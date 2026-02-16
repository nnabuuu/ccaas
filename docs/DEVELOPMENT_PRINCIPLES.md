# Development Principles

Core development principles and lessons learned from building the CCAAS platform.

---

## TDD 强制规则 (2025-01 教训)

### Background

曾因"信任计划文档 > 信任测试"导致 API 格式不兼容，前端功能完全失效。

### Root Cause

修改代码前没有运行测试，修改后也没有验证。

### Mandatory Checklist

**修改任何代码前**:
- [ ] 运行 `npm test` 确认当前所有测试通过
- [ ] 如果计划要改变 API/接口，先检查前端类型定义和现有测试

**修改代码后**:
- [ ] 立即运行相关测试，不要等到最后
- [ ] 测试失败 = 停下来分析，不要继续前进

### Core Principle

```
测试是代码的契约，计划只是意图的表达。
当计划与测试冲突时，应该质疑计划，而不是忽略测试。
```

---

## 架构原则 (2026-02 教训)

### Background

核心后端曾包含完整的 lesson-plans 模块（1,370 行），与 solution 后端重复，违反架构分层原则。

### Root Causes

1. **历史演进**: 原型阶段在 core 快速开发
2. **技术债**: 后期提取到 solution，忘记从 core 删除
3. **边界模糊**: 缺乏明确的架构边界规则
4. **缺少检测**: 没有自动化检测机制

### Architecture Layering Principle (Mandatory)

> **Core Backend (CCAAS)** = 中继服务 + 技能路由 + 认证
>
> **Solution Backends** = 领域数据 + 业务逻辑 + 集成
>
> **严禁混合两者**

### Core Backend Allowed Entities (Infrastructure)

- ✅ `Session` - 会话管理（中继）
- ✅ `Skill` - 技能注册（路由）
- ✅ `User`, `ApiKey` - 认证授权
- ✅ `Message` - 消息历史（中继）
- ✅ `File` - 通用文件元数据
- ✅ `OutputUpdate` - 协议事件
- ✅ `ScheduledTask` - 定时任务

### Core Backend Forbidden Entities (Domain Logic)

- ❌ `LessonPlan`, `Textbook`, `CurriculumStandard` (教育领域)
- ❌ `Product`, `Order`, `Cart` (电商领域)
- ❌ `Patient`, `Appointment` (医疗领域)
- ❌ 任何特定行业/解决方案的业务实体

### Checklist (Before Adding New Entity)

```
□ 这是基础设施实体吗？(Session, Skill, Auth) → 允许添加到 core
□ 这是领域实体吗？(LessonPlan, Product, Order) → 必须放在 solution backend
□ 运行架构测试：npm run test:architecture (待实现)
□ 代码审查：新增 @Entity() 必须有正当理由
```

### Solution Backend Standard Structure

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

### Frontend Integration Pattern

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

### Preventing Architecture Violations

**Automated enforcement** (to be implemented):
1. 自动化架构测试 (检测 core 中的领域实体)
2. Pre-commit hook (阻止在 core 添加 `@Entity()`)
3. CI/CD 验证 (PR 必须通过架构测试)
4. 文档化允许/禁止的实体类型

**Reference**: See memory/MEMORY.md for the complete lesson-plans module removal case study.

---

## Over-Engineering Prevention

### Core Principle

**Only make changes that are directly requested or clearly necessary.**

### What to Avoid

❌ **Don't add**:
- Features beyond what was asked
- Refactoring surrounding code during bug fixes
- "Improvements" that weren't requested
- Docstrings/comments for unchanged code
- Error handling for scenarios that can't happen
- Helpers/utilities for one-time operations
- Abstractions for hypothetical future requirements

✅ **Do**:
- Implement exactly what was requested
- Keep solutions simple and focused
- Add comments only where logic isn't self-evident
- Validate only at system boundaries (user input, external APIs)
- Trust internal code and framework guarantees

### The Right Amount of Complexity

> Three similar lines of code is better than a premature abstraction.

### Backwards Compatibility

❌ **Avoid backwards-compatibility hacks**:
- Renaming unused `_vars`
- Re-exporting removed types
- Adding `// removed` comments for deleted code

✅ **If unused, delete it completely**

---

## Security

### Critical Rules

- ✅ **Always validate** user input at system boundaries
- ✅ **Use parameterized queries** to prevent SQL injection
- ✅ **Avoid** command injection, XSS, and OWASP Top 10 vulnerabilities
- ✅ **Fix immediately** if insecure code is discovered

### Priority

**Write safe, secure, and correct code first.**

---

## Code Review Best Practices

### Two-Agent Review Process

**Always use BOTH agents** for comprehensive review:

1. **code-reviewer**: Quality, security, performance, test coverage
2. **code-simplifier**: Over-engineering detection, simplification suggestions

### When Requesting Review

```
"请用 code-reviewer 和 code-simplifier 两个 agent review 这个 PR

code-reviewer 重点检查：
1. 架构合规性（核心后端是否包含领域实体）
2. 测试覆盖
3. API 契约
4. 安全性

code-simplifier 重点检查：
1. 是否存在 over-engineering
2. 是否有不必要的抽象
3. 是否添加了未被要求的功能"
```

### Review Focus Areas

**code-reviewer**:
1. **Architecture compliance** (core vs solution separation)
2. **Test coverage** (unit, integration, E2E)
3. **API contracts** (breaking changes?)
4. **Security** (vulnerabilities, input validation)
5. **Performance** (N+1 queries, indexes, caching)

**code-simplifier**:
1. **Unnecessary abstractions** (3 similar lines better than premature abstraction)
2. **Unrequested features** (scope creep)
3. **Over-engineering** (helper functions for one-time operations)
4. **Complexity** (simpler implementation available?)

---

## Summary

**Three Core Principles**:

1. **Tests are contracts** - Trust tests over plans
2. **Architecture separation** - Core = infrastructure, Solutions = domain
3. **Simplicity first** - Don't over-engineer

**When in doubt**: Run tests, check architecture, keep it simple.
