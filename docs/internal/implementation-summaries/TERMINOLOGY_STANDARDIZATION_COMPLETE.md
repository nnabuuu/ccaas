# Terminology Standardization Complete - 2026-02-06

## 实施摘要

成功将项目中的 "Claude Code instance/CLI process" 术语统一替换为 "AgentEngine"，以支持未来多引擎兼容性。

## 修改范围

### Phase 1: 创建 Advanced 文档结构 ✅

**新建目录**:
- `docs/advanced/` - 高级主题文档目录

**移动和重命名**:
- `CLI_PROCESS_LIFECYCLE.md` → `docs/advanced/AGENT_ENGINE_LIFECYCLE.md`

**更新内容**:
- 所有 "CLI" 引用 → "AgentEngine"
- 添加支持的 engine 类型说明 (Claude Code, OpenCode, Custom)
- 添加 engine 配置示例
- 添加进程管理 API 文档

### Phase 2: 更新根目录文档 ✅

**文件**: `CLAUDE.md`
- ✅ 项目描述: "relay service for AgentEngine instances"
- ✅ 后端模块: "AgentEngine lifecycle management"

**文件**: `README.md`
- ✅ 项目描述: "AgentEngine instances (Claude Code, OpenCode, custom engines)"
- ✅ 架构图: "Claude Code CLI" → "AgentEngine"
- ✅ 特性列表: "AgentEngine Lifecycle Management"

**文件**: `SESSION_CANCEL_FIX_COMPLETE.md`
- ✅ 全文替换: "CLI" → "AgentEngine"
- ✅ 全文替换: "cliProcess" → "engineProcess"

### Phase 3: 更新 Backend 文档 ✅

**文件**: `packages/backend/CLAUDE.md`
- ✅ 项目概述: "spawns AgentEngine instances"
- ✅ 架构图: "AgentEngine (claude/opencode)"
- ✅ 添加支持的 engine 类型说明
- ✅ ChatModule 描述: "AgentEngine process lifecycle"
- ✅ SchedulerModule: "Runs AgentEngine in headless mode"

**文件**: `packages/backend/README.md`
- ✅ 执行层架构图: "Persistent AgentEngine processes per session"

### Phase 4: 更新核心服务代码注释 ✅

**文件**: `packages/backend/src/chat/session.service.ts` (23+ 处更新)
- ✅ 文件头注释: "Manages persistent AgentEngine sessions"
- ✅ `ensureCLIProcess()` 注释: "Spawn or reuse AgentEngine process"
- ✅ `sendFollowUp()` 注释: "Send message to AgentEngine process"
- ✅ `handleCLIOutput()` 注释: "Handle AgentEngine stdout output"
- ✅ `handleCLIClose()` 注释: "Handle AgentEngine process close"
- ✅ `sendMessageToProcess()` 注释: "Send message to AgentEngine stdin"
- ✅ `cancelSession()` 注释: "Cancel/kill AgentEngine process"
- ✅ `hasActiveProcess()` 注释: "Check if session has active AgentEngine"
- ✅ `restartSession()` 注释: "Restart session by killing AgentEngine"
- ✅ 日志消息更新: "AgentEngine spawned", "AgentEngine exited"

**文件**: `packages/backend/src/chat/event-mapper.service.ts`
- ✅ 文件头注释: "Maps AgentEngine stream-json events"

**文件**: `packages/backend/src/admin/controllers/admin-sessions.controller.ts`
- ✅ `getActiveSessions()` 注释: "with active AgentEngine"
- ✅ `killSession()` 注释: "Force terminate AgentEngine process"

**文件**: `packages/backend/src/sessions/sessions.controller.ts`
- ✅ 注释: "spawn new AgentEngine"

### Phase 5: 更新进程生命周期文件 ✅

**文件**: `packages/backend/src/hooks/process-lifecycle-tracker.hook.ts`
- ✅ 文件头注释: "Captures AgentEngine process lifecycle events"

**文件**: `packages/backend/src/messages/process-lifecycle.service.ts`
- ✅ 文件头注释: "Tracks AgentEngine process lifecycle events"

**文件**: `packages/backend/src/scheduler/headless-execution.service.ts`
- ✅ 文件头注释: "Spawns AgentEngine processes without WebSocket"

### Phase 6: 创建 Engine 集成指南 ✅

**新建文件**: `docs/advanced/ENGINE_INTEGRATION_GUIDE.md`

**内容包括**:
- ✅ 支持的 engine 类型概述
- ✅ Engine 协议要求 (命令行参数)
- ✅ 输入/输出格式规范 (stream-json)
- ✅ 必需事件类型 (agent_start, text_delta, agent_stop)
- ✅ Session 管理规范
- ✅ 退出码和信号处理
- ✅ 环境变量说明
- ✅ 配置方法 (AGENT_ENGINE_PATH)
- ✅ 实施清单
- ✅ 示例实现骨架
- ✅ 最佳实践和故障排除

## 术语映射表

| 旧术语 | 新术语 | 使用场景 |
|--------|--------|----------|
| Claude Code CLI | AgentEngine CLI | 技术文档 |
| Claude Code instance | AgentEngine instance | 代码注释、文档 |
| CLI process | AgentEngine process | 代码实现 |
| spawn CLI | spawn AgentEngine | 代码注释 |
| CLI instance | AgentEngine instance | 实例引用 |
| **Claude Code as a Service** | **保持不变** | 产品名称 |
| **CCAAS** | **保持不变** | 项目缩写 |

## 保留的内容

### 产品名称
- ✅ "Claude Code as a Service (CCAAS)" - 在所有文档中保持不变
- ✅ 项目路径: `kedge-ccaas`
- ✅ 包名: `@ccaas/*`

### 命令引用
- ✅ `npx claude-code` - 实际执行命令保持原样
- ✅ 测试文件中的 mock 字符串

### 文件名/变量名
- ⚠️ `session.cliProcess` - 保留变量名（未重命名，只更新注释）
- ⚠️ `ensureCLIProcess()` - 保留方法名（未重命名，只更新注释）

**原因**: 重命名会导致破坏性变更，需要全面测试。当前阶段仅更新文档和注释。

## 验证结果

### 构建验证 ✅
```bash
# Backend 构建成功
cd packages/backend && npm run build
# ✅ Build successful
```

### 术语一致性 ✅
- ✅ 文档中 "CLI process" 引用已更新
- ✅ 代码注释中 "CLI process" 引用已更新
- ✅ 架构图使用 "AgentEngine"
- ✅ 产品名称保持一致

### 剩余引用
- ⚠️ 部分旧方案文档保留原术语（不影响使用）
- ⚠️ GitBook 文档需单独更新（下一步）

## 支持的 Engine 类型

### 1. Claude Code (默认)
```bash
AGENT_ENGINE_PATH=claude
# or
AGENT_ENGINE_PATH=npx claude-code
```

### 2. OpenCode
```bash
AGENT_ENGINE_PATH=opencode
```

### 3. Custom Engine
```bash
AGENT_ENGINE_PATH=/path/to/custom-engine
```

## 文档结构

```
docs/
└── advanced/
    ├── AGENT_ENGINE_LIFECYCLE.md      # 进程生命周期详解
    └── ENGINE_INTEGRATION_GUIDE.md    # 自定义 engine 集成指南
```

## 下一步建议

### 可选增强 (未实施)

1. **重命名代码变量/方法**:
   - `session.cliProcess` → `session.engineProcess`
   - `ensureCLIProcess()` → `ensureAgentEngine()`
   - 需要全面回归测试

2. **更新 GitBook 文档**:
   - `docs/gitbook/*/` 下的所有文件
   - 多语言版本同步更新

3. **Engine 抽象层**:
   - 创建 `IAgentEngine` 接口
   - 实现 `ClaudeCodeEngine`, `OpenCodeEngine` 适配器

4. **Engine 性能监控**:
   - 添加 engine 性能指标
   - 对比不同 engine 的性能

## 影响评估

### 对用户的影响
- ✅ **无破坏性变更** - 所有 API 和接口保持不变
- ✅ **文档更清晰** - 更好地表达多 engine 支持
- ✅ **未来兼容** - 为 OpenCode 和自定义 engine 铺路

### 对开发者的影响
- ✅ **代码更易理解** - 注释更准确反映架构
- ✅ **集成更简单** - 提供完整的 engine 集成指南
- ✅ **维护更容易** - 统一术语减少混淆

## 文件统计

### 修改的文件
- 文档文件: 7 个
- 源代码文件: 8 个
- 新建文件: 2 个

### 代码变更
- 仅更新注释和日志消息
- 未修改任何业务逻辑
- 未修改任何 API 接口

## 总结

✅ **成功完成术语标准化**

所有面向用户的文档和代码注释已更新为 "AgentEngine" 术语，同时保持产品名称 "Claude Code as a Service" 不变。项目现在更清楚地表达对多种 engine 实现的支持，为未来集成 OpenCode 和自定义 engine 奠定了基础。

核心改进：
1. 文档和注释术语统一
2. 创建高级主题文档目录
3. 提供完整的 engine 集成指南
4. 保持向后兼容性
5. 无破坏性变更
