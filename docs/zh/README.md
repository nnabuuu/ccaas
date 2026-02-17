# CCAAS 中文文档

欢迎使用 Claude Code as a Service (CCAAS) 中文文档。

## 📚 文档目录

### 快速开始
- **[快速开始指南](./quick-start.md)** - 快速上手 CCAAS

### 核心概念

#### 会话持久化
- **[会话持久化架构](./CONVERSATION_PERSISTENCE.md)** - 会话持久化的工作原理和集成指南
- **[会话持久化实施状态](./CONVERSATION_PERSISTENCE_IMPLEMENTATION_STATUS.md)** - 完整的实施状态、测试覆盖
  - **[理解消息模型](./CONVERSATION_PERSISTENCE_IMPLEMENTATION_STATUS.md#理解消息模型)** ⭐ - Session、Message、Turn 实体的概念解释（含可视化图表）

### 架构文档
- **[后端架构](./architecture/backend.md)** - NestJS 后端架构说明
- **[React SDK 架构](./architecture/react-sdk.md)** - React SDK 设计和使用
- **[Vue SDK 架构](./architecture/vue-sdk.md)** - Vue SDK 设计和使用

### 开发指南
- **[创建解决方案](./guides/creating-a-solution.md)** - 如何创建新的 CCAAS 解决方案
- **[解决方案快速开始](./guides/solution-quick-start.md)** - 解决方案开发快速入门
- **[认证与授权](./guides/authentication-authorization.md)** - API 密钥认证和权限管理

### 架构决策记录 (ADR)
- **[ADR 中文版](../adr/zh/)** - 重要架构决策的记录

## 🌐 英文文档

完整的英文文档位于根 `docs/` 目录:
- [English Documentation](../)
- [Architecture Decision Records](../adr/)

## 📖 推荐阅读路径

### 新用户
1. [快速开始指南](./quick-start.md)
2. [理解消息模型](./CONVERSATION_PERSISTENCE_IMPLEMENTATION_STATUS.md#理解消息模型)
3. [会话持久化架构](./CONVERSATION_PERSISTENCE.md)

### 解决方案开发者
1. [创建解决方案](./guides/creating-a-solution.md)
2. [React SDK 架构](./architecture/react-sdk.md) 或 [Vue SDK 架构](./architecture/vue-sdk.md)
3. [认证与授权](./guides/authentication-authorization.md)

### 后端开发者
1. [后端架构](./architecture/backend.md)
2. [会话持久化实施状态](./CONVERSATION_PERSISTENCE_IMPLEMENTATION_STATUS.md)
3. [ADR 中文版](../adr/zh/)

## 🤝 贡献

欢迎改进和更新中文文档! 请确保:
- 保持与英文文档的一致性
- 使用清晰、准确的中文术语
- 在技术术语后标注英文原文 (首次出现时)

## 📝 术语对照

| 中文 | 英文 | 说明 |
|-----|------|------|
| 会话 | Conversation / Session | 用户与助手的对话 |
| 消息 | Message | 单次用户或助手的发言 |
| 轮次 | Turn | 一次完整的问答交互 |
| 租户 | Tenant | 多租户隔离的租户 |
| 技能 | Skill | 可扩展的代理能力 |
| 解决方案 | Solution | 基于 CCAAS 构建的应用 |
