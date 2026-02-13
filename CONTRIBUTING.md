# Contributing to CCAAS

欢迎！这是一个一人公司项目，使用 **Claude Code Agent** 进行 AI-assisted code review。

## 核心流程（简化版）

```
Linear Issue → 分支 → TDD 开发 → PR → Claude Code Review → Merge → Linear Done
```

## 快速开始

### 1. 创建任务（Linear）

在 Linear 创建 Issue，描述要做什么：

```markdown
标题: [FEATURE] Add user authentication

描述:
- 背景: 用户需要登录才能使用
- 目标: 实现 JWT 认证
- 影响: Backend + SDK
```

### 2. 创建分支

```bash
git checkout -b feature/ccaas-123-add-user-auth
```

**分支命名规范**:
```
{type}/{linear-id}-{short-description}

type:
  - feature/  新功能
  - fix/      Bug 修复
  - refactor/ 重构
  - docs/     文档
```

### 3. TDD 开发

**强制规则**（来自惨痛教训）:

```bash
# ✅ 修改代码前
npm test  # 确保所有测试通过

# ✅ 开发时
# 1. 写测试（Red）
# 2. 写代码（Green）
# 3. 重构（Refactor）

# ✅ 修改代码后
npm test  # 立即验证
```

### 4. 提交代码

Git Hooks 会自动验证 commit message 格式：

```bash
# ✅ 正确格式
git commit -m "feat(backend): add JWT authentication"
git commit -m "fix(react-sdk): fix API response parsing"
git commit -m "docs(readme): update installation guide"

# ❌ 错误格式
git commit -m "add feature"  # 缺少 type 和 scope
git commit -m "Fix bug"      # subject 必须小写
```

**Commit Message 规范**:
```
<type>(<scope>): <subject>

<body>

<footer>
```

- **type**: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`
- **scope**: `backend`, `frontend`, `react-sdk`, `vue-sdk`, `admin`, `docs`, `common`
- **subject**: 简洁描述（≤80 字符，小写）
- **body**: 详细说明（可选）
- **footer**: `Linear-Issue: CCaas-123` (可选)

### 5. 创建 PR

```bash
# 推送分支
git push origin feature/ccaas-123-add-user-auth

# 创建 PR
gh pr create --fill
```

GitHub 会自动填充 PR template，包含 **Code Review Checklist for Claude Code Agent**。

### 6. Claude Code Review

**这是关键步骤！** 请 Claude Code 根据 PR template 进行 review：

```
请根据 PR template 中的 checklist review 这个 PR，重点检查：
1. 架构合规性（核心后端是否包含领域实体）
2. 测试覆盖
3. API 契约
4. 安全性
```

Claude Code 会逐项检查并给出反馈。

### 7. 讨论与修改

与 Claude Code 讨论发现的问题：

```
# Claude Code 可能会指出：
"packages/backend/src/lesson-plans/lesson-plan.entity.ts
是领域实体，应该在 solution backend 而不是 core backend"

# 你可以：
1. 同意并修改
2. 讨论为什么需要这样做
3. 请求替代方案
```

修改后重新请 Claude Code review。

### 8. CI 检查

GitHub Actions 会自动运行：
- ✅ Lint
- ✅ Type Check
- ✅ Tests
- ✅ Architecture Tests（防止架构违规）
- ✅ Build

所有检查通过才能 merge。

### 9. Merge & Linear

```bash
# Merge PR (Squash and merge)
gh pr merge --squash

# 在 Linear 手动标记 Done
```

---

## 架构原则（必读！）

### Core vs Solution 分离

> **Core Backend** = 中继服务 + 技能路由 + 认证
>
> **Solution Backend** = 领域数据 + 业务逻辑 + 集成

**Core Backend 允许的实体**:
- ✅ `Session`, `Skill`, `User`, `ApiKey`, `Message`, `File`

**Core Backend 禁止的实体**:
- ❌ `LessonPlan`, `Textbook`, `Product`, `Order`（领域实体）

**为什么重要**？

曾经因为在 core backend 添加了 lesson-plans 模块（1,370 行），导致：
- 代码重复（solution backend 也有）
- 架构混乱
- 难以维护

现在有 **架构测试** 自动防止这种错误。

### TDD 原则（必读！）

曾经因为"信任计划 > 信任测试"导致 API 格式不兼容，前端功能完全失效。

**强制规则**:
```
1. 修改代码前 → 运行测试确认通过
2. 开发时 → 先写测试，再写代码
3. 修改后 → 立即运行测试验证
4. 测试失败 → 停下来分析，不要继续
```

---

## 设计文档（可选）

对于大功能或架构变更，建议先写设计文档：

```bash
# 1. 创建设计文档
cp docs/designs/TEMPLATE.md docs/designs/2026-02-14-user-auth.md

# 2. 填写设计内容
# 3. 请 Claude Code review 设计文档
# 4. 设计通过后开始实现
```

设计文档不是强制的，但对于：
- ✅ 新功能开发
- ✅ 架构变更
- ✅ 重大重构
- ✅ 公共 API 修改

建议先写设计文档，与 Claude Code 讨论后再实现。

---

## 常用命令

```bash
# 开发
npm run dev:backend    # 启动 backend
npm run dev:admin      # 启动 admin

# 测试
npm test               # 运行所有测试
npm run test:architecture  # 运行架构测试

# 构建
npm run build          # 构建所有 packages

# 类型检查
npm run typecheck      # TypeScript 类型检查

# Lint
npm run lint           # ESLint 检查
```

---

## 架构测试

自动防止架构违规：

```bash
# 运行架构测试
npm run test:architecture

# 测试会检查：
# ✅ 核心后端不包含领域实体
# ✅ 没有从 solutions 导入
# ✅ 实体放在正确的位置
```

如果违反规则，测试会失败并给出明确提示。

---

## 获取帮助

```bash
# 运行测试
npm test

# 查看文档
ls docs/

# 请教 Claude Code
"请帮我 review 这段代码"
"这个架构设计是否合理"
"如何写测试覆盖这个功能"
```

---

## 记住

1. **先写测试，再写代码** - TDD 原则
2. **保持架构纯净** - Core vs Solution 分离
3. **使用 Claude Code** - AI-assisted review
4. **小步提交** - 频繁提交，易于 review
5. **文档同步** - 代码变更时更新文档

Happy Coding! 🚀
