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

#### 架构原则

- [ADR-0001](0001-core-must-not-contain-domain-entities.md) - **核心后端不得包含领域实体** ⭐
  - 确保核心后端仅处理基础设施（Session, Skill, Auth），所有领域逻辑在 Solution backends
  - 防止架构违规（如 lesson-plans 模块事件）
  - 2026-02-13

- [ADR-0002](0002-rest-resource-naming-principles.md) - **REST 资源命名原则**
  - URL 路径必须代表资源（名词），不是动作（动词）
  - ChatModule → SessionsModule 重构案例
  - 2026-02-13

#### 技术架构

- [ADR-0003](0003-tenant-level-mcp-server-management.md) - **租户级 MCP 服务器管理**
  - MCP 服务器集中管理在租户级别
  - Session 通过 symlinks 访问
  - 提供隔离、稳定性和版本控制
  - 2026-02-11

- [ADR-0004](0004-single-entry-point-for-messages.md) - **消息发送单一入口**
  - 所有 session 操作通过 SessionsController
  - 移除 ChatController 冗余端点
  - 简化 API，减少 HTTP 请求
  - 2026-02-13

#### 开发流程

- [ADR-0006](0006-ai-assisted-development-workflow.md) - **AI 辅助开发工作流** 🤖
  - Claude Code Agent 作为代码审查员
  - Git Hooks + GitHub Actions CI 自动化
  - 架构测试防护
  - 适合一人公司场景
  - 2026-02-14

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

### ADR-0001: 核心后端不得包含领域实体

**背景**:
2026-02-13 发现 core backend 包含了完整的 lesson-plans 模块（1,370 行），与 solution backend 重复，违反架构分层原则。

**决策**:
核心后端**禁止**包含领域实体（LessonPlan, Product, Order 等）。仅允许基础设施实体（Session, Skill, Auth, Message, File）。

**考虑的方案**:
- 方案 A: 允许领域实体在 core（被拒绝 - 导致耦合和重复）
- 方案 B: 核心无实体（选择 - 清晰边界）
- 方案 C: 共享实体库（被拒绝 - 创建耦合）

**结果**:
- ✅ 架构清晰：核心 = 中继，Solution = 领域
- ✅ 移除 1,427 行重复代码
- ✅ 架构测试自动防护
- ✅ 零破坏性变更（前端已使用 solution backend）

详见: [ADR-0001 完整文档](0001-core-must-not-contain-domain-entities.md)

---

## 参考资料

- [ADR 方法论](https://adr.github.io/)
- [Documenting Architecture Decisions](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)
