# GitBook 文档更新完成 - 2026-02-06

## 更新摘要

已成功更新所有 GitBook 文档（中英文版本），将 "Claude Code CLI" 术语统一替换为 "AgentEngine"。

## 更新的文件

### 英文版 (3 个文件) ✅

1. **`docs/gitbook/en/getting-started/README.md`**
   ```diff
   - **Claude Code CLI** (required for AI Agent functionality)
   + **AgentEngine CLI** (Claude Code, OpenCode, or custom - required for AI Agent functionality)
   ```

2. **`docs/gitbook/en/platform/capabilities.md`**
   ```diff
   - Tasks run Claude Code CLI without an active WebSocket connection
   + Tasks run AgentEngine without an active WebSocket connection
   ```

3. **`docs/gitbook/en/platform/architecture.md`**
   ```diff
   - Spawn Claude Code CLI without WebSocket, collecting results in-process
   + Spawn AgentEngine without WebSocket, collecting results in-process
   ```

### 中文版 (3 个文件) ✅

1. **`docs/gitbook/zh/getting-started/README.md`**
   ```diff
   - **Claude Code CLI**（如需使用 AI Agent 功能）
   + **AgentEngine CLI**（Claude Code、OpenCode 或自定义引擎 - 如需使用 AI Agent 功能）
   ```

2. **`docs/gitbook/zh/platform/capabilities.md`**
   ```diff
   - 无需 WebSocket 连接，后台运行 Claude Code CLI
   + 无需 WebSocket 连接，后台运行 AgentEngine
   ```

3. **`docs/gitbook/zh/platform/architecture.md`**
   ```diff
   - 无需 WebSocket 即可启动 Claude Code CLI，在进程内收集结果
   + 无需 WebSocket 即可启动 AgentEngine，在进程内收集结果
   ```

## 术语对照

| 英文 | 中文 |
|------|------|
| AgentEngine | AgentEngine（保持英文） |
| AgentEngine CLI | AgentEngine CLI |
| Claude Code | Claude Code |
| OpenCode | OpenCode |
| custom engine | 自定义引擎 |

## Linear 检查结果

### 检查内容 ✅
- ✅ 搜索项目中的 Linear 集成
- ✅ 检查 Linear MCP server 配置
- ✅ 检查 Linear SDK 依赖
- ✅ 检查相关文档

### 发现结果
- **未发现 Linear 集成**: 项目中没有 Linear SDK 依赖或 MCP server
- **发现规格文档**: `docs/implementation/api-integration/LINEAR_ISSUE_SESSION_WORKSPACE_API.md`
  - 这是一个 API 设计文档，描述了 Session Workspace File API 功能
  - **不包含需要更新的术语**（已验证）
  - 文档内容与 AgentEngine 术语无关

### 结论
**无需更新 Linear 相关内容** - 项目中没有实际的 Linear 集成或需要更新的 Linear 相关文档。

## 验证

### GitBook 文档一致性检查
```bash
# 检查是否还有遗漏的 "Claude Code CLI" 引用
grep -r "Claude Code CLI" docs/gitbook/
# Result: 无匹配结果 ✅
```

### 中英文对照检查
- ✅ 英文版 3 处更新
- ✅ 中文版 3 处对应更新
- ✅ 术语翻译一致

## 完整更新清单

### 阶段 1: 根目录和 Backend 文档 ✅
- CLAUDE.md
- README.md
- SESSION_CANCEL_FIX_COMPLETE.md
- packages/backend/CLAUDE.md
- packages/backend/README.md

### 阶段 2: 代码注释 ✅
- session.service.ts (23+ 处)
- event-mapper.service.ts
- process-lifecycle-tracker.hook.ts
- process-lifecycle.service.ts
- headless-execution.service.ts
- admin-sessions.controller.ts
- sessions.controller.ts

### 阶段 3: Advanced 文档 ✅
- docs/advanced/AGENT_ENGINE_LIFECYCLE.md (移动并更新)
- docs/advanced/ENGINE_INTEGRATION_GUIDE.md (新建)

### 阶段 4: GitBook 文档 ✅ (本次更新)
- docs/gitbook/en/getting-started/README.md
- docs/gitbook/en/platform/capabilities.md
- docs/gitbook/en/platform/architecture.md
- docs/gitbook/zh/getting-started/README.md
- docs/gitbook/zh/platform/capabilities.md
- docs/gitbook/zh/platform/architecture.md

### 阶段 5: Linear 检查 ✅
- 无需更新

## 总计

- **更新文档**: 15 个文件
- **更新代码**: 8 个文件
- **新建文档**: 3 个文件
- **总变更**: 26 个文件

## 下一步

所有计划的术语标准化工作已完成：
- ✅ 根目录文档
- ✅ Backend 文档
- ✅ 代码注释
- ✅ Advanced 文档
- ✅ GitBook 中英文文档
- ✅ Linear 检查

**术语标准化项目完成！** 🎉
