# ADR-0006: AI-Assisted Development Workflow

**Status**: Accepted
**Date**: 2026-02-14
**Decision Maker**: @niex
**Related Issue**: Establishing development workflow for solo development + AI assistance

---

## Background (Context)

### The Challenge

**CCAAS 项目特点**:
- **一人公司 (Solo Developer)** - 没有传统 code review 团队
- **快速迭代** - 需要高效的开发流程
- **架构风险** - 历史上发生过架构违规（如 lesson-plans 模块在 core）
- **质量要求** - 生产环境，需要高质量保证

**传统工作流的问题**:
- ❌ **人工 Code Review**: 一人公司无法实施
- ❌ **复杂流程**: 重量级流程降低效率
- ❌ **依赖手动检查**: 易出现架构违规和质量问题
- ❌ **缺乏结构化反馈**: 无明确的质量标准

### Why AI-Assisted Workflow?

**Claude Code 的优势**:
- 🤖 **智能代码审查**: 可以理解代码上下文和架构
- 📋 **结构化检查**: 遵循 checklist，不遗漏关键项
- ⚡ **即时反馈**: 无需等待人工 reviewer
- 📚 **项目知识**: 可读取 CLAUDE.md 和 ADR，理解项目规范
- 🔄 **持续改进**: 可基于历史问题更新 review 标准

---

## Decision

**We decided**: 采用 **AI-assisted development workflow**，使用 Claude Code Agent 作为智能代码审查员，配合自动化工具（Git Hooks, GitHub Actions CI, Architecture Tests）确保代码质量。

### Architecture Principle

> **Human** = 编写代码，定义需求，最终决策
>
> **Claude Code** = 代码审查，架构检查，质量保证建议
>
> **Automation** = Git Hooks, CI/CD, Architecture Tests（防护网）
>
> **Linear** = 任务跟踪（手动更新）

### Core Workflow

```
Linear Issue → Git Branch → TDD Development → Commit (Git Hooks)
  → PR (Template) → Claude Code Review → CI Checks → Merge → Linear Done
```

---

## Alternatives Considered

### Alternative A: 纯自动化（无 AI Review）

**Description**: 仅依赖 CI/CD 和自动化测试

**Pros**:
- ✅ 完全自动化，无需人工介入
- ✅ 快速反馈

**Cons**:
- ❌ 无法理解业务逻辑
- ❌ 无法检查架构合规性（beyond tests）
- ❌ 无法提供改进建议
- ❌ 难以捕捉设计问题

**Why Not Chosen**: 自动化测试只能检查规则，无法理解意图

---

### Alternative B: 传统人工 Code Review

**Description**: 邀请其他开发者 review

**Pros**:
- ✅ 人类理解和判断
- ✅ 可以讨论设计决策

**Cons**:
- ❌ **不适合一人公司**
- ❌ 需要等待 reviewer 时间
- ❌ Reviewer 可能不熟悉项目
- ❌ 成本高（需要雇佣或外包）

**Why Not Chosen**: 一人公司无法实施，成本过高

---

### Alternative C: AI-Assisted Workflow ⭐ **Selected Approach**

**Description**: Claude Code Agent + Automation Tools

**Pros**:
- ✅ **适合一人公司** - 无需额外人力
- ✅ **即时反馈** - 随时可用
- ✅ **理解项目上下文** - 读取 CLAUDE.md, ADRs, 代码库
- ✅ **结构化检查** - PR template checklist
- ✅ **持续改进** - 可更新 review 标准
- ✅ **成本低** - 按使用量付费

**Cons**:
- ❌ **需要清晰指令** - PR template 必须结构化
- ❌ **依赖 LLM** - 可能有限制或错误
- ⚠️ **最终判断仍需人工** - AI 提供建议，人类决策

**Why Chosen**: 最佳平衡效率、质量和成本

---

## Consequences

### Positive Impacts

- ✅ **高效开发**: 无需等待人工 reviewer，即时反馈
- ✅ **质量保证**: 结构化 checklist 确保不遗漏关键检查
- ✅ **架构保护**: Architecture tests + Claude Code 双重防护
- ✅ **知识传承**: ADR 和 PR review 积累项目知识
- ✅ **适合一人公司**: 无需额外人力成本
- ✅ **持续改进**: 基于历史问题更新 review 标准

### Negative Impacts

- ❌ **依赖 LLM**: Claude Code 可能不可用或有错误
- ⚠️ **需要结构化输入**: PR template 必须清晰
- ⚠️ **学习曲线**: 需要学习如何有效使用 Claude Code

### Measured Impact

**预期收益**（基于实施后 1 个月数据）:
- 🎯 100% PR 使用 template
- 🎯 100% commit 符合规范
- 🎯 100% CI 覆盖率
- 🎯 0 架构违规

**长期收益**（基于实施后 6 个月预测）:
- 🚀 生产 bug 率下降 50%
- 🚀 开发效率提升 30%
- 🚀 架构稳定性增强
- 🚀 代码可维护性提高

---

## Implementation Guide

### Step 1: Git Hooks Setup

**安装**:
```bash
npm install --save-dev husky lint-staged @commitlint/cli @commitlint/config-conventional
npx husky install
```

**配置 commit-msg hook** (`.husky/commit-msg`):
```bash
#!/bin/sh
npx --no-install commitlint --edit "$1"
```

**配置 commitlint** (`commitlint.config.js`):
```javascript
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [2, 'always', [
      'feat', 'fix', 'refactor', 'docs', 'test', 'chore', 'perf'
    ]],
    'scope-enum': [2, 'always', [
      'backend', 'frontend', 'react-sdk', 'vue-sdk', 'admin', 'docs', 'common'
    ]],
    'subject-case': [2, 'always', 'lower-case']
  }
}
```

### Step 2: GitHub Actions CI

**创建** `.github/workflows/ci.yml`:
```yaml
name: CI

on:
  pull_request:
    branches: [main, master]
  push:
    branches: [main, master]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Type check
        run: npm run typecheck

      - name: Test
        run: npm run test

      - name: Architecture tests
        run: npm run test:architecture

      - name: Build
        run: npm run build
```

### Step 3: PR Template for Claude Code

**创建** `.github/pull_request_template.md`:
```markdown
# PR Description

## Changes
<!-- What does this PR do? -->

## Related Issue
<!-- Linear-Issue: CCaas-XXX -->

---

# 🤖 Claude Code Review Checklist

Please review this PR against the following criteria:

## 1️⃣ Architecture Compliance
- [ ] Core backend contains no domain entities (Session, Skill, Auth only)
- [ ] Solution-specific code in solution backends
- [ ] No imports from `solutions/` in core backend
- [ ] Entities in correct location

## 2️⃣ Test Coverage
- [ ] New code has tests (unit + integration)
- [ ] All tests pass
- [ ] Test coverage ≥ 80%
- [ ] Tests match actual code paths (no bypassing)

## 3️⃣ Code Quality
- [ ] Follows TypeScript best practices
- [ ] Clear naming (no misleading names)
- [ ] Proper error handling
- [ ] No code duplication

## 4️⃣ API Contract
- [ ] API matches backend implementation
- [ ] Frontend/SDK correctly consumes API
- [ ] Mock data matches real API format
- [ ] Response format documented

## 5️⃣ Security
- [ ] No hardcoded secrets
- [ ] Input validation present
- [ ] Authentication/authorization correct
- [ ] No SQL injection risks

## 6️⃣ Performance
- [ ] No obvious performance issues
- [ ] Database queries optimized
- [ ] No unnecessary HTTP requests

---

## Review Instructions for Claude Code

1. Read the code changes
2. Check each item in the checklist above
3. Provide feedback in this format:

### ✅ Passed
- Item 1
- Item 2

### ⚠️ Warnings
- Item 3: [explanation + suggestion]

### ❌ Issues
- Item 4: [explanation + fix required]
```

### Step 4: Architecture Tests

**创建** `packages/backend/test/architecture.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { getMetadataArgsStorage } from 'typeorm'

describe('Core Backend Architecture Rules', () => {
  it('should not contain domain-specific entities', () => {
    const storage = getMetadataArgsStorage()
    const entities = storage.tables.map(t => t.name)

    const forbidden = ['LessonPlan', 'Textbook', 'Product', 'Order']

    forbidden.forEach(name => {
      expect(entities).not.toContain(name)
    })
  })

  it('should only contain infrastructure entities', () => {
    const storage = getMetadataArgsStorage()
    const entities = storage.tables.map(t => t.name)

    const allowed = [
      'Session', 'Skill', 'User', 'ApiKey',
      'Message', 'File', 'OutputUpdate', 'ScheduledTask'
    ]

    entities.forEach(entity => {
      expect(allowed).toContain(entity)
    })
  })
})
```

### Step 5: Use the Workflow

**Complete workflow example**:
```bash
# 1. Create Linear Issue (manual)
# CCaas-123: "Add user authentication"

# 2. Create branch
git checkout -b feature/ccaas-123-add-user-auth

# 3. TDD Development
npm test  # Ensure current tests pass

# Write test
vim packages/backend/src/auth/auth.service.spec.ts
npm test  # Should fail ✅

# Write code
vim packages/backend/src/auth/auth.service.ts
npm test  # Should pass ✅

# 4. Commit (Git Hooks validate)
git commit -m "feat(backend): add JWT authentication

Implement JWT-based authentication for API endpoints.

Linear-Issue: CCaas-123"

# 5. Push and create PR
git push origin feature/ccaas-123-add-user-auth
gh pr create --fill

# 6. Request Claude Code review
"请根据 PR template 中的 checklist review 这个 PR，
重点检查架构合规性、测试覆盖和安全性"

# 7. CI runs automatically
# - Lint
# - Type Check
# - Tests
# - Architecture Tests
# - Build

# 8. Merge after approval
gh pr merge --squash

# 9. Update Linear (manual)
# Mark issue as Done
```

---

## References

- Original implementation: `docs/internal/implementation-summaries/DEVELOPMENT_WORKFLOW_IMPLEMENTATION.md`
- Conventional Commits: https://www.conventionalcommits.org/
- ADR Methodology: https://adr.github.io/
- Related: `CONTRIBUTING.md`, `docs/WORKFLOW.md`
- Related: ADR-0001 (Architecture principles)

---

## Update History

- **2026-02-14**: Initial implementation (development workflow)
- **2026-02-14**: Formalized as ADR-0006 during documentation cleanup
