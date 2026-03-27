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
6. **CSS-only hiding** (overlays/panels using opacity/translate instead of conditional rendering)

**code-simplifier**:
1. **Unnecessary abstractions** (3 similar lines better than premature abstraction)
2. **Unrequested features** (scope creep)
3. **Over-engineering** (helper functions for one-time operations)
4. **Complexity** (simpler implementation available?)

---

## 前端组件可见性规则 (2026-02 教训)

### Background

TutoringPanel 始终挂载在 DOM 中，仅通过 CSS 类隐藏。CSS 未及时应用时面板可见，且关闭按钮无效（状态死锁：false→false 不触发 re-render）。

### Root Cause

使用 CSS-only 隐藏替代条件渲染。组件始终挂载 = 始终可交互，CSS 只是视觉层。

### Principle

> **不需要的组件不应该存在于 DOM 中。**
> CSS 是视觉层，不是逻辑层。

### 选择正确的模式

| 场景 | 模式 | 示例 |
|------|------|------|
| 无退场动画 | `{show && <Component />}` | 按钮、加载器、空状态 |
| 需要退场动画 | `mounted` + `visible` 双状态 | 面板、模态框、抽屉 |
| 小型装饰元素 | CSS 隐藏可接受 | Tooltip、badge |

### 退场动画参考实现

```tsx
const [mounted, setMounted] = useState(open)
const [visible, setVisible] = useState(open)

useEffect(() => {
  if (open) {
    setMounted(true)
    requestAnimationFrame(() => setVisible(true))
  } else {
    setVisible(false)
    const timer = setTimeout(() => setMounted(false), 300) // match CSS duration
    return () => clearTimeout(timer)
  }
}, [open])

if (!mounted) return null

return (
  <div className={visible
    ? 'opacity-100 pointer-events-auto transition-opacity duration-300'
    : 'opacity-0 pointer-events-none transition-opacity duration-300'  // ← 退场期间阻止点击
  }>
    ...
  </div>
)
```

### Checklist

```
□ 组件隐藏时是否从 DOM 移除？（优先条件渲染）
□ 如需退场动画，是否使用 mounted/visible 双状态？
□ 退场动画期间是否添加 pointer-events-none？（防止动画中的点击穿透）
□ absolute/fixed 定位的隐藏组件是否会在 CSS 失效时遮挡内容？
```

---

## Architecture Testing

```bash
npm run test:architecture

# Checks:
# - Core backend has no domain entities
# - No imports from solutions/
# - Entities in correct locations
```

Run before merging any PR that touches backend entities.

---

## Refactoring Guidelines

### Terminology and Field Name Changes

When refactoring terminology or field names across the codebase:

1. **Search First**: Use `Grep` to find ALL usages before making changes
2. **Document Scope**: List all affected files and usage contexts
3. **Make Changes**: Edit all affected files
4. **Verify Coverage**: After changes, grep again to ensure no instances were missed
5. **Update Tests**: Check that tests reflect the new terminology
6. **Update Documentation**: Ensure all docs use consistent terminology

---

## Chat UI Visual Design — Claude Web 对标 (2026-03 确立)

### Background

chat-interface 初版实现了功能，但视觉品质与 Claude Web 有显著差距。通过逆向分析 claude.ai 的设计 token，确立了以下设计标准。

### Design Identity (Non-Negotiable)

> **chat-interface 的视觉标准对标 claude.ai。**
> 设计 token 参考: `packages/chat-interface/example/claude-web-design.text`
> 完整设计系统: `packages/chat-interface/ARCHITECTURE.md` Section 10

### Key Rules

1. **Warm neutrals only** — light `#F5F5F0` / dark `#262624`。禁止纯黑 `#000` / 纯白 `#FFF` / 冷灰
2. **Sans + Serif 双字体** — 用户消息/Composer: sans-serif; 助手消息: serif (`Georgia, "Times New Roman"`)
3. **User messages right-aligned** — `flex justify-end` + `inline-flex` + `max-width: 75ch`，无头像时右对齐区分角色
4. **Assistant messages have NO bubble** — 裸 serif 文本, `leading-[1.65rem]`, `pb-3`
5. **Composer** — `rounded-[20px]` + shadow (非 border), Send: `w-8 h-8 rounded-lg` (32px, 8px radius)
6. **Terracotta accent** — `#AE5630`, 用于 Send 按钮和链接, 暗色模式不变
7. **Press feedback** — 所有按钮 `active:scale-[0.98]`, Send 按钮 `active:scale-95`
8. **Material easing** — `ease-claude` + `ease-claude-spring` 用于过渡动画
9. **Inline code** — coral 颜色 (`--inline-code-color`), subtle bg/border, `0.9em`, `rounded-[6.4px]`
10. **Markdown** — paragraph `my-0`, strong `font-medium` (530), OL serif `leading-[1.65rem]`

### Checklist (Before Modifying Chat UI)

```
□ 颜色是否 warm neutrals？(查 CSS variables)
□ 助手消息 serif + 无气泡？用户消息 sans-serif？
□ 用户消息右对齐？
□ Composer rounded-[20px] + shadow (非 border)？
□ Send 32px rounded-lg？
□ 按钮 active:scale 反馈？
□ dark mode 变量同步？
□ easing: ease-claude / ease-claude-spring？
□ Inline code coral 颜色 + subtle border？
□ Paragraph margin 0？Strong font-medium？
```

---

## Summary

**Four Core Principles**:

1. **Tests are contracts** - Trust tests over plans
2. **Architecture separation** - Core = infrastructure, Solutions = domain
3. **Simplicity first** - Don't over-engineer
4. **Claude Web visual standard** - Chat UI design tokens align with claude.ai

**When in doubt**: Run tests, check architecture, keep it simple, match Claude's design.
