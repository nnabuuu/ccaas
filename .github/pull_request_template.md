## 概述
<!-- 简要描述这个 PR 做了什么 -->

## Linear Issue
<!-- 链接 Linear Issue (可选) -->
- Linear-Issue: CCaas-{number}

## 变更类型
<!-- 选择一个 -->
- [ ] 🚀 新功能 (Feature)
- [ ] 🐛 Bug 修复 (Bug Fix)
- [ ] ♻️ 重构 (Refactoring)
- [ ] 📝 文档 (Documentation)
- [ ] ✅ 测试 (Tests)
- [ ] 🔧 工具/配置 (Chore)

## 变更说明
### 主要修改
<!-- 列出关键的代码变更 -->

### Breaking Changes
- [ ] 有 Breaking Changes（需要详细说明）
- [ ] 无 Breaking Changes

---

## Code Review Checklist (for Claude Code Agent)

### 1️⃣ 架构合规性 (Architecture Compliance)
**核心原则**: Core Backend = 中继 + 路由 + 认证；Solution Backend = 领域逻辑

- [ ] **核心后端不包含领域实体**
  - 检查：是否在 `packages/backend/src/` 添加了领域相关的 Entity？
  - 禁止：`LessonPlan`, `Textbook`, `Product`, `Order` 等
  - 允许：`Session`, `Skill`, `User`, `ApiKey`, `Message`, `File`

- [ ] **代码放在正确的 package**
  - Core backend: 基础设施代码
  - Solution backend: 领域逻辑
  - SDK: 客户端集成

- [ ] **没有违反架构分层**
  - Core 不依赖 Solution
  - SDK 不包含业务逻辑

### 2️⃣ 测试覆盖 (Test Coverage)
- [ ] **单元测试已添加/更新**
  - 新功能有对应的测试
  - 修改的代码有测试覆盖

- [ ] **测试质量检查**
  - 测试实际运行（不是空测试）
  - Mock 数据匹配真实 API 格式
  - 测试验证了核心逻辑

- [ ] **集成测试（如果适用）**
  - API 调用链路测试
  - 数据流验证

### 3️⃣ 代码质量 (Code Quality)
- [ ] **遵循 TDD 原则**
  - 是否先写测试后写代码？
  - 测试是否真正失败过？

- [ ] **代码可读性**
  - 变量和函数命名清晰
  - 复杂逻辑有注释
  - 没有过度设计

- [ ] **错误处理**
  - 边界情况处理
  - 错误信息清晰
  - 没有吞掉异常

- [ ] **清理工作**
  - 没有 console.log 或调试代码
  - 没有注释掉的代码
  - 没有未使用的 import

### 4️⃣ API 契约 (API Contract)
- [ ] **API 格式一致**
  - Frontend 和 Backend API 格式匹配
  - 检查所有消费者（react-sdk, vue-sdk, demo）

- [ ] **向后兼容**
  - 修改现有 API 是否会破坏现有功能？
  - 是否需要版本升级？

- [ ] **文档更新**
  - API 变更是否更新了文档？
  - 类型定义是否同步？

### 5️⃣ 安全性 (Security)
- [ ] **输入验证**
  - 用户输入是否验证？
  - 使用 DTO 和 Zod schema

- [ ] **认证授权**
  - 是否需要认证？
  - 权限检查是否正确？

- [ ] **敏感数据**
  - 没有硬编码密钥/密码
  - 敏感数据正确处理

### 6️⃣ 性能 (Performance)
- [ ] **数据库查询优化**
  - 避免 N+1 查询
  - 使用合适的索引

- [ ] **前端性能**
  - 避免不必要的 re-render
  - 大列表使用虚拟滚动

---

## Review 指南 (for Claude Code Agent)

### 如何使用这个 Checklist

1. **逐项检查**：按照 checklist 顺序检查每一项
2. **标记问题**：发现问题时，引用具体的文件和行号
3. **提供建议**：不仅指出问题，还提供改进建议
4. **讨论权衡**：如果有多种方案，讨论利弊

### Review 示例输出

```markdown
## Architecture Review

✅ 架构合规性：通过
- 未在 core backend 添加领域实体
- 代码正确放在 solution backend

## Test Coverage Review

⚠️ 测试覆盖：需要改进
- `packages/backend/src/sessions/session.service.ts:L123`: 缺少错误处理的测试
- 建议：添加测试验证 session 不存在时的行为

## Code Quality Review

✅ 代码质量：良好
- 命名清晰，逻辑易懂
- 错误处理完善

❌ 发现问题：
- `packages/react-sdk/src/hooks/useFiles.ts:L77`:
  - 问题：`flattenFiles(data)` 期望数组，但 backend 返回 `{ tree: [] }`
  - 建议：改为 `flattenFiles(data.tree || [])`
```

---

## 部署说明
<!-- 是否需要特殊部署步骤 -->
- [ ] 需要数据库迁移
- [ ] 需要更新环境变量
- [ ] 不需要特殊步骤
