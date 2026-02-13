# Architecture Decision Records (ADR)

记录 CCAAS 项目的重要架构决策。

## 什么是 ADR？

ADR (Architecture Decision Record) 记录了重要的架构决策及其背景。它帮助我们：
- 📝 记录为什么做出某个决策
- 🤔 理解当时的考虑和权衡
- 🔄 在未来重新评估决策时提供上下文
- 📚 为新成员提供架构演进历史

## ADR 格式

每个 ADR 包含：
1. **背景**: 为什么需要做这个决策
2. **决策**: 我们决定做什么
3. **考虑的方案**: 评估过的其他选项
4. **结果**: 这个决策带来的影响

## ADR 索引

### 活跃的决策 (Active)

- [ADR-0001](0001-use-nestjs-for-backend.md) - 使用 NestJS 构建后端
- [ADR-0002](0002-separate-core-and-solutions.md) - 核心与解决方案分离
- [ADR-0003](0003-use-typeorm-sqlite.md) - 使用 TypeORM + SQLite
- [ADR-0004](0004-api-key-authentication.md) - API Key 认证方案

### 已废弃的决策 (Deprecated)

- ~~[ADR-0005](0005-lesson-plans-in-core.md)~~ - ~~在核心后端存储 Lesson Plans~~ (Superseded by ADR-0002)

### 被取代的决策 (Superseded)

- ~~[ADR-0006](0006-use-express.md)~~ - ~~使用 Express 框架~~ (Superseded by ADR-0001)

---

## 如何创建新的 ADR

### 1. 复制模板

```bash
cp docs/adr/TEMPLATE.md docs/adr/NNNN-decision-title.md
```

### 2. 填写内容

按照模板填写各个部分，确保：
- 背景清晰
- 决策明确
- 方案对比充分
- 结果可预见

### 3. 请 Claude Code Review

```
请 review 这个 ADR: docs/adr/0007-new-decision.md

检查：
1. 决策是否合理
2. 是否考虑了足够的替代方案
3. 结果评估是否全面
```

### 4. 提交 PR

```bash
git add docs/adr/0007-new-decision.md
git commit -m "docs(adr): add ADR-0007 new decision"
gh pr create
```

### 5. 更新索引

在本文件中添加新的 ADR 链接。

---

## ADR 生命周期

### Proposed（提议）
刚创建的 ADR，正在讨论中。

### Accepted（接受）
决策已被接受并实施。

### Deprecated（废弃）
决策不再推荐，但可能还在使用。

### Superseded（被取代）
决策被新的 ADR 取代。

### Rejected（拒绝）
决策被拒绝，未实施。

---

## 何时创建 ADR

建议在以下情况创建 ADR：

- ✅ 选择新的技术栈
- ✅ 架构模式变更
- ✅ 数据模型重大变更
- ✅ API 设计重要决策
- ✅ 性能优化方案
- ✅ 安全策略变更
- ✅ 部署架构变更

不需要为小的实现细节创建 ADR。

---

## 示例

### ADR-0002: 核心与解决方案分离

**背景**:
曾经在 core backend 包含了 lesson-plans 模块，导致代码重复和架构混乱。

**决策**:
严格区分 Core Backend（基础设施）和 Solution Backend（领域逻辑）。

**考虑的方案**:
- 方案 A: 所有代码放在 core（被拒绝）
- 方案 B: 严格分离（选择）
- 方案 C: 混合模式（被拒绝）

**结果**:
- ✅ 架构清晰
- ✅ 代码重用性提高
- ✅ 维护性增强

---

## 参考资料

- [ADR 方法论](https://adr.github.io/)
- [Documenting Architecture Decisions](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)
