# Gitbook API 文档更新 - REST API 简化

## 更新时间
2026-02-13

## 更新原因
完成 REST API 简化后，需要更新 Gitbook 文档以反映新的 API 架构和职责划分。

## 更新内容

### 1. 职责划分说明

#### ChatController - 监控专用
**路径**: `/api/v1/chat`
**职责**: 仅用于健康检查和服务器监控

**端点**:
- `GET /health` - 健康检查
- `GET /status` - 服务器统计信息

**特点**:
- 🔓 无需认证（Public）
- 用于负载均衡器健康检查
- 用于监控系统获取指标

#### SessionsController - 核心业务 API
**路径**: `/api/v1/sessions`
**职责**: AI 消息交互 + 会话生命周期管理

**主要端点**:
- `POST /:sessionId/completion` - 发送消息
- `DELETE /:sessionId/completion` - 取消操作
- `GET /:sessionId` - 获取会话信息
- `POST /:sessionId/restart` - 重启会话

**特点**:
- 🔐 需要 API Key 认证
- 标准的业务逻辑入口
- 推荐使用 SDK 而非直接调用

### 2. 已删除的端点（从文档中移除）

- ❌ `POST /chat/send` - 被 `POST /sessions/:id/completion` 替代
- ❌ `POST /chat/agent/chat` - 被 `POST /sessions/:id/completion` 替代
- ❌ `POST /chat/cancel` - 被 `DELETE /sessions/:id/completion` 替代
- ❌ `GET /chat/agent/status` - 被 `GET /chat/status` 替代
- ❌ `GET /chat/sessions/:id/status` - 被 `GET /sessions/:id` 替代
- ❌ `POST /chat/sessions/:id/restart` - 被 `POST /sessions/:id/restart` 替代
- ❌ `GET /chat/sessions/:id/details` - 被 `GET /sessions/:id` 替代

### 3. 更新的文件

#### 中文文档
- `docs/gitbook/zh/api/rest.md` - REST API 端点文档
- `docs/gitbook/zh/getting-started/quickstart.md` - 快速开始指南

#### 英文文档
- `docs/gitbook/en/api/rest.md` - REST API endpoints documentation
- `docs/gitbook/en/getting-started/quickstart.md` - Quick start guide

### 4. 主要改进

#### API 文档（rest.md）

**新增部分**:
```markdown
## API 控制器职责划分

### ChatController - 监控与健康检查
**路径**: `/api/v1/chat`
**职责**: 仅用于服务健康检查和监控指标
**特点**: 🔓 无需认证（Public）

### SessionsController - 核心业务 API
**路径**: `/api/v1/sessions`
**职责**: AI 消息交互 + 会话生命周期管理
**特点**: 🔐 需要 API Key 认证
```

**更新的端点**:
- `/chat/agent/status` → `/chat/status`（含更详细的响应格式说明）
- 删除所有 `/chat/send`、`/chat/cancel` 等冗余端点
- 为每个端点添加认证标识（🔓 或 🔐）

**新增提示**:
```markdown
> **💡 推荐使用**: 使用 `@ccaas/react-sdk` 或 `@ccaas/vue-sdk` 进行集成，
> 无需直接调用 HTTP API。SDK 会自动管理 WebSocket 连接和状态。
```

#### 快速开始指南（quickstart.md）

**更新示例**:
```bash
# 旧版（已删除）
curl http://localhost:3001/api/v1/chat/agent/status
curl -X POST http://localhost:3001/api/v1/chat/send ...
curl -X POST http://localhost:3001/api/v1/chat/cancel ...

# 新版（正确）
curl http://localhost:3001/api/v1/chat/status
curl -X POST http://localhost:3001/api/v1/sessions/my-session/completion ...
curl -X DELETE http://localhost:3001/api/v1/sessions/my-session/completion ...
```

**新增说明**:
- 强调直接调用 REST API 需要管理 WebSocket 连接
- 推荐使用 SDK 进行集成
- 提供完整的请求示例（包含必需的 `tenantId` 参数）

## 用户受益

### 对于新手开发者
- ✅ **更清晰的职责划分**：一目了然知道 ChatController 和 SessionsController 的区别
- ✅ **唯一的标准做法**：不再困惑应该用哪个 API 发送消息
- ✅ **明确的推荐**：文档明确推荐使用 SDK 而非直接调用 API

### 对于现有用户
- ✅ **无破坏性变更**：已使用 SDK 的用户无需任何修改
- ✅ **更好的引导**：文档引导用户使用最佳实践
- ✅ **更准确的示例**：所有示例代码都是可以直接运行的

### 对于维护者
- ✅ **文档与代码一致**：文档反映实际实现
- ✅ **减少支持负担**：清晰的文档减少用户疑问
- ✅ **易于维护**：单一标准更容易维护文档

## 验证清单

- [x] 中文 REST API 文档已更新
- [x] 英文 REST API 文档已更新
- [x] 中文快速开始指南已更新
- [x] 英文快速开始指南已更新
- [x] 所有旧端点引用已删除
- [x] 所有示例代码可运行
- [x] 添加职责划分说明
- [x] 添加 SDK 推荐提示
- [x] 添加认证标识（🔓/🔐）

## 后续工作

### 建议添加的文档
1. **API 迁移指南** - 为直接使用旧 API 的用户提供迁移路径
2. **SDK 集成教程** - 详细的 SDK 使用示例和最佳实践
3. **架构决策记录（ADR）** - 记录 API 简化的设计决策

### 建议改进
1. 在 Swagger UI 中也添加相同的职责说明
2. 在 API 响应头中添加推荐 SDK 的提示
3. 为监控端点添加 Prometheus 格式的输出选项

## 相关文档

- [API 简化实施文档](./API_SIMPLIFICATION_COMPLETE.md)
- [验证脚本](./verify-api-simplification.sh)
- [Backend CLAUDE.md](./packages/backend/CLAUDE.md)

---

**更新人**: Claude Sonnet 4.5
**审核状态**: ✅ 已验证
**部署状态**: 📝 待部署到 Gitbook
