# CCAAS 研发流程（一人公司 + AI Review）

## 流程总览

```
┌─────────────────────────────────────────────────────────┐
│ 1. Linear Issue 创建                                     │
│    需求描述 → 优先级 → 验收标准                          │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ 2. 设计阶段（可选 - 大功能或架构变更）                   │
│    设计文档 → Claude Code review 设计 → ADR 记录         │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ 3. TDD 开发                                              │
│    分支 → 测试先行 → 实现 → Git Hooks 检查               │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ 4. Claude Code Review                                    │
│    PR 创建 → AI review → 讨论 → 修改 → 再次 review      │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ 5. CI 自动检查 → Merge → Linear Done                     │
└─────────────────────────────────────────────────────────┘
```

---

## 阶段 1: Linear Issue 创建

### Issue 模板

```markdown
## 背景
为什么需要这个功能/修复？

## 目标
期望达到什么结果？

## 范围
影响哪些模块？

## 验收标准
- [ ] 标准 1
- [ ] 标准 2

## 架构考虑
- [ ] 需要修改 Core Backend
- [ ] 需要新建 Solution Backend
- [ ] 只涉及 SDK/Frontend
```

### 优先级

- **高**: 紧急 bug，阻塞功能
- **中**: 重要功能，计划内开发
- **低**: Nice to have

---

## 阶段 2: 设计阶段（可选）

### 何时需要设计文档？

- ✅ 新功能开发
- ✅ 架构变更
- ✅ 重大重构
- ✅ 公共 API 修改
- ✅ 新增 TypeORM Entity（核心后端）

### 设计文档流程

```bash
# 1. 创建设计文档
cp docs/designs/TEMPLATE.md docs/designs/$(date +%Y-%m-%d)-feature-name.md

# 2. 填写设计内容
# - 背景与动机
# - 目标架构
# - 数据模型
# - API 设计
# - 测试策略
# - 风险评估

# 3. 请 Claude Code review
"请 review 这个设计文档 docs/designs/2026-02-14-feature-name.md
重点检查架构合规性和技术可行性"

# 4. 讨论与修改

# 5. 设计通过，提取关键决策到 ADR
```

### ADR (Architecture Decision Records)

重要决策记录在 `docs/adr/`:

```bash
cp docs/adr/TEMPLATE.md docs/adr/0001-use-nestjs-for-backend.md
```

ADR 格式：
```markdown
# ADR-{number}: {决策标题}

## 背景
什么情况下需要做这个决策？

## 决策
我们决定...

## 考虑的方案
- 方案 A: ...
- 方案 B: ...（选择的方案）

## 结果
这个决策带来的影响
```

---

## 阶段 3: TDD 开发

### 分支创建

```bash
git checkout -b feature/ccaas-123-feature-name
```

### TDD 循环

```bash
# 1. 写测试（Red）
# 创建测试文件
touch packages/backend/src/my-module/my-service.spec.ts

# 编写测试
describe('MyService', () => {
  it('should do something', () => {
    expect(service.doSomething()).toBe(expectedResult);
  });
});

# 运行测试 - 应该失败
npm test

# 2. 写代码（Green）
# 实现最小代码让测试通过

# 运行测试 - 应该通过
npm test

# 3. 重构（Refactor）
# 优化代码，测试仍然通过

# 4. 重复
```

### Commit

```bash
git add .
git commit -m "feat(backend): add user authentication

Implement JWT-based authentication for API endpoints.

Linear-Issue: CCaas-123"

# Git Hooks 会自动检查 commit message 格式
```

---

## 阶段 4: Code Review (code-reviewer + code-simplifier)

### 创建 PR

```bash
git push origin feature/ccaas-123-feature-name
gh pr create --fill
```

GitHub 会自动填充 PR template，包含 **Code Review Checklist**。

### 请 Claude Code Review

Review 流程和检查清单详见 [DEVELOPMENT_PRINCIPLES.md - Code Review Best Practices](./DEVELOPMENT_PRINCIPLES.md#code-review-best-practices)。

### 讨论与修改

```
# Claude Code 发现问题：
"packages/backend/src/lesson-plans/lesson-plan.entity.ts
是领域实体，应该在 solution backend"

# 讨论：
"为什么不能在 core backend？"

# Claude Code 解释：
"根据 CLAUDE.md 架构原则，Core Backend 只应包含
基础设施实体。LessonPlan 是教育领域的业务实体，
应该放在 lesson-plan-designer solution backend。

理由：
1. 保持架构纯净
2. 避免代码重复
3. 便于维护和扩展"

# 修改：
git commit -m "refactor(backend): move lesson-plan entity to solution"
git push

# 再次请 Claude Code review
"请重新 review，我已经修改了"
```

---

## 阶段 5: CI & Merge

### CI 检查

GitHub Actions 自动运行：

```yaml
✅ Lint          - ESLint 检查
✅ Type Check    - TypeScript 类型检查
✅ Tests         - 所有测试通过
✅ Architecture  - 架构规则验证
✅ Build         - 构建成功
```

### Merge

所有检查通过后：

```bash
# Squash and merge
gh pr merge --squash

# 或在 GitHub UI 操作
```

### Linear 更新

在 Linear 手动标记 Issue 为 Done。

---

## 工作流示例

### 示例 1: 添加新功能

```bash
# 1. Linear Issue
Create Issue: CCaas-123 "Add user authentication"

# 2. 设计文档（可选）
vim docs/designs/2026-02-14-user-auth.md
# 请 Claude Code review 设计

# 3. TDD 开发
git checkout -b feature/ccaas-123-add-user-auth

# 写测试
vim packages/backend/src/auth/auth.service.spec.ts
npm test  # 失败

# 写代码
vim packages/backend/src/auth/auth.service.ts
npm test  # 通过

# 提交
git commit -m "feat(backend): add JWT authentication"

# 4. PR & Review
git push
gh pr create
# 请 Claude Code review

# 5. Merge
gh pr merge --squash

# 6. Linear Done
```

### 示例 2: Bug 修复

```bash
# 1. Linear Issue
Create Issue: CCaas-456 "Fix API response parsing"

# 2. 分支
git checkout -b fix/ccaas-456-fix-api-parsing

# 3. TDD
# 写测试复现 bug
npm test  # 失败
# 修复代码
npm test  # 通过

# 4. 提交
git commit -m "fix(react-sdk): fix API response parsing

Backend returns { tree: [] } but SDK expected array.
Changed flattenFiles(data) to flattenFiles(data.tree || [])

Linear-Issue: CCaas-456"

# 5. PR & Review
git push
gh pr create
# 请 Claude Code review

# 6. Merge
gh pr merge --squash
```

---

## 自动化工具

### Git Hooks

- **pre-commit**: 快速检查（占位，实际检查在 CI）
- **commit-msg**: 验证 commit message 格式

### GitHub Actions CI

- 自动运行所有检查
- 提供清晰的错误反馈
- 架构测试防止违规

### 架构测试

```bash
npm run test:architecture

# 测试内容：
# ✅ 核心后端不包含领域实体
# ✅ 没有从 solutions 导入
# ✅ 实体放在正确位置
```

---

## Commit Message Convention

Format: `<type>(<scope>): <subject>`

**Types**: feat, fix, refactor, docs, test, chore, perf
**Scopes**: backend, frontend, react-sdk, vue-sdk, admin, docs, common, ci, deps

**Examples**:
```
feat(backend): add JWT authentication
fix(react-sdk): fix API response parsing
docs(readme): update installation guide
```

**Reference Linear**: Include `Related: NIE-XX` in commit body.

Git hooks automatically validate format.

---

## Task Tracking with Linear

All tasks are tracked in Linear using the `linear-task-workflow` skill:

- **New tasks**: Linear issue auto-created when you describe a task
- **Progress updates**: Milestones recorded in Linear comments
- **Final summary**: Complete deliverables summary in Linear
- **No `*_COMPLETE.md` files**: All tracking in Linear, not code repo

For details, see: [`.claude/skills/linear-task-workflow/SKILL.md`](../.claude/skills/linear-task-workflow/SKILL.md)

---

## Documentation Rules

**Don't create**:
- `PHASE_*_COMPLETE.md` - Use Linear comments
- `*_IMPLEMENTATION.md` - Use Linear summary
- `*_PROGRESS.md` - Use Linear status

**Do create** (only when necessary):
- ADR (`docs/adr/`) - For architectural decisions
- Implementation guides (`docs/implementation/`) - For complex mechanisms
- API docs - For new endpoints

**Decision tree**: See [PROJECT_MANAGEMENT_GUIDE.md](./PROJECT_MANAGEMENT_GUIDE.md)

---

## 最佳实践

### 1. 频繁提交

小步提交，易于 review 和回滚：

```bash
# ✅ 好
git commit -m "feat(backend): add user entity"
git commit -m "feat(backend): add user service"
git commit -m "feat(backend): add user controller"

# ❌ 不好
# 一次提交 3000 行代码
```

### 2. 描述性 Commit Message

```bash
# ✅ 好
git commit -m "fix(react-sdk): fix useFiles API parsing

Backend returns { tree: [] } but SDK expected array.
This caused files tab to show 'No files' even when files exist.

Linear-Issue: CCaas-456"

# ❌ 不好
git commit -m "fix bug"
```

### 3. 测试先行

```bash
# ✅ 好
1. 写测试
2. 测试失败
3. 写代码
4. 测试通过

# ❌ 不好
1. 写代码
2. 不写测试
3. 手动测试
4. "应该没问题"
```

### 4. 请 Claude Code Review

```bash
# ✅ 好
"请 review 这个 PR，重点检查：
1. 架构合规性
2. 测试覆盖
3. API 契约"

# ❌ 不好
直接 merge，不 review
```

### 5. 文档同步

```bash
# 如果修改了 API
1. 更新代码
2. 更新 CLAUDE.md
3. 更新 Swagger 注释
4. 更新 SDK 类型定义
```

---

## 疑难解答

### Commit message 验证失败

```bash
# 错误
git commit -m "add feature"
# ❌ subject must be lower-case

# 正确
git commit -m "feat(backend): add feature"
```

### 架构测试失败

```bash
npm run test:architecture

# 错误提示：
"Core backend contains domain-specific entities: LessonPlan"

# 修复：
# 将 LessonPlan 移动到 solution backend
mv packages/backend/src/lesson-plans solutions/lesson-plan-designer/backend/src/
```

### CI 检查失败

```bash
# 查看 GitHub Actions 日志
gh run list
gh run view {run-id}

# 本地重现
npm run lint
npm run typecheck
npm test
npm run build
```

---

## 总结

这套流程的核心是：

1. **轻量但完整** - 适合一人公司
2. **AI-assisted review** - Claude Code 作为 reviewer
3. **自动化优先** - Git Hooks + CI
4. **架构保护** - 自动测试防止违规
5. **可追溯** - Linear → PR → Code

遵循这套流程，可以：
- ✅ 避免架构违规（如 lesson-plans 模块事件）
- ✅ 保持代码质量（TDD + AI review）
- ✅ 快速迭代（自动化检查）
- ✅ 清晰追溯（Issue → PR → Code）

Happy Coding! 🚀
