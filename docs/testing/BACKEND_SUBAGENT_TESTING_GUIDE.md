# 后台 SubAgent 显示功能 - 测试指南

## ✅ 实施完成

**方案**：方案 A - CCAAS Backend 监控后台任务输出文件

**状态**：
- ✅ 代码修改完成
- ✅ 编译通过
- ✅ 后端服务运行中 (http://localhost:3001)
- ⏳ 等待功能测试

---

## 修改内容总结

### 1. EventMapper 增强 (`packages/backend/src/chat/event-mapper.service.ts`)

**扩展 SubAgentTracker 接口**：
```typescript
interface SubAgentTracker {
  // ... 原有字段
  isPersistent?: boolean;  // 是否为持久化后台任务
  outputFile?: string;     // 后台任务的输出文件路径
}
```

**新增功能**：
- 检测 `run_in_background: true` 的 Task 工具调用
- 提取输出文件路径 (output_file)
- 触发后台任务注册回调
- 提供外部完成标记接口

### 2. SessionService 监控器 (`packages/backend/src/chat/session.service.ts`)

**新增监控系统**：
- **startBackgroundTaskMonitor()**: 启动 3 秒轮询监控
- **checkBackgroundTaskStatus()**: 检查输出文件状态
- **stopBackgroundTaskMonitor()**: 停止监控并发送完成事件

**完成检测标记**：
- ✅ `"Agent completed successfully"`
- ✅ `"type":"result"`
- ✅ `agentId:` (Task 工具返回标记)
- ❌ `Error` / `Failed` (失败标记)

**安全保护**：
- 30 分钟超时自动标记为 failed
- 会话关闭时自动清理监控器
- 服务关闭时清理所有监控器

---

## 如何测试

### 前提条件

1. ✅ 后端已运行 (localhost:3001)
2. ⏳ 需要启动前端 (Lesson Plan Designer)

### 测试步骤

#### 1. 启动 Lesson Plan Designer 前端

```bash
cd solutions/lesson-plan-designer/frontend
npm run dev
```

前端将在 http://localhost:5176 启动

#### 2. 打开浏览器开发者工具

- 打开 Chrome DevTools (F12)
- 切换到 **Network** 标签
- 过滤 **WS** (WebSocket)
- 查看 WebSocket 消息流

#### 3. 测试用例 1：模拟简单后台任务

在聊天界面输入：

```
请帮我测试后台任务功能。使用 Task 工具运行一个后台任务（run_in_background=true），
任务描述是"测试后台 SubAgent 显示"，提示词是"等待 20 秒后返回 'Done'"
```

**预期观察**：

✅ **前端 UI**：
- AgentActivityLine 显示 SubAgentCard
- 卡片类型：Task
- 描述：测试后台 SubAgent 显示
- 状态：running (持续显示约 20 秒)

✅ **后端日志** (终端输出):
```
[SubAgent] Tool use detected: toolName=Task, toolUseId=..., isBackgroundTask=true
[SubAgent] Tracking start: sessionId=..., subAgentId=...
[SubAgent] Persistent task detected: toolUseId=..., outputFile=...
[BackgroundTask] Starting monitor: ..., outputFile=...
[BackgroundTask] Task completed: ...
[BackgroundTask] Sent subagent_completed event: ..., status=completed
```

✅ **WebSocket 消息** (DevTools):
```json
// 1. 任务开始
{ "type": "subagent_started", "payload": { "subAgentId": "...", "status": "running" } }

// 2. 任务完成 (约 20 秒后)
{ "type": "subagent_completed", "payload": { "subAgentId": "...", "status": "completed" } }
```

#### 4. 测试用例 2：NotebookLM 播客生成（真实场景）

在聊天界面输入：

```
/notebooklm 创建一个简短的测试播客
```

**预期观察**：
- SubAgentCard 显示类型：notebooklm
- 持续显示直到播客生成完成（可能需要几分钟）
- 完成后自动消失

#### 5. 测试用例 3：多任务并发

```
同时创建 2 个后台任务：
1. 任务 A：等待 10 秒
2. 任务 B：等待 20 秒
```

**预期观察**：
- 同时显示 2 个 SubAgentCard
- 任务 A 在 10 秒后消失
- 任务 B 在 20 秒后消失
- 互不干扰

---

## 验证清单

### ✅ 基本功能
- [ ] SubAgentCard 出现（任务开始时）
- [ ] SubAgentCard 持续显示（不立即消失）
- [ ] SubAgentCard 自动消失（任务完成后）

### ✅ 后端日志
- [ ] 显示 "[BackgroundTask] Starting monitor"
- [ ] 显示 "[BackgroundTask] Task completed"
- [ ] 显示 "[BackgroundTask] Sent subagent_completed event"

### ✅ WebSocket 事件
- [ ] 收到 `subagent_started` 事件
- [ ] 收到 `subagent_completed` 事件
- [ ] 事件的 subAgentId 匹配

### ✅ 边界情况
- [ ] 多任务并发正常工作
- [ ] 会话关闭时监控器停止
- [ ] 长时间任务（接近 30 分钟）能正常完成

---

## 调试技巧

### 1. 查看后端日志

如果后端在另一个终端运行：
```bash
# 查找后端进程
ps aux | grep "nest start" | grep -v grep

# 或者重启并查看完整日志
cd packages/backend
npm run start:dev
```

### 2. 查看输出文件（调试用）

后台任务的输出文件通常在：
```bash
ls -lth .agent-workspace/sessions/*/tasks/*.output | head -5
tail -f .agent-workspace/sessions/*/tasks/*.output
```

### 3. 检查 WebSocket 连接

在浏览器控制台：
```javascript
// 检查 Socket.io 连接状态
window.socket?.connected

// 手动监听 subagent 事件
window.socket?.on('subagent_completed', (data) => {
  console.log('SubAgent completed:', data);
});
```

### 4. 强制触发测试事件（开发用）

如果需要快速测试，可以使用 curl 模拟：
```bash
# 健康检查
curl http://localhost:3001/api/v1/chat/health

# 查看会话状态
curl http://localhost:3001/api/v1/chat/status
```

---

## 问题排查

### 问题 1：SubAgentCard 立即消失

**可能原因**：
- EventMapper 没有正确检测 `isPersistent`
- 输出文件路径提取失败

**检查**：
```bash
# 查看后端日志，搜索
grep "Persistent task" packages/backend/*.log
grep "outputFile=" packages/backend/*.log
```

### 问题 2：SubAgentCard 永不消失

**可能原因**：
- 监控器未检测到完成标记
- 输出文件格式不符合预期

**检查**：
```bash
# 手动查看输出文件内容
cat .agent-workspace/sessions/*/tasks/*.output | tail -30

# 检查是否包含完成标记
grep -E "completed successfully|type.*result|agentId" \
  .agent-workspace/sessions/*/tasks/*.output
```

### 问题 3：后端日志无 "[BackgroundTask]"

**可能原因**：
- Task 工具没有设置 `run_in_background: true`
- EventMapper 回调未注册

**检查**：
```bash
# 确认 EventMapper 日志
grep "SubAgent.*Persistent task" -A 2 -B 2 backend.log
```

---

## 架构说明

### 工作流程

```
┌─────────────────────────────────────────────────────────────┐
│ 1. 用户发送消息触发后台任务                                │
└────────────────────┬────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. Claude CLI 执行 Task 工具 (run_in_background=true)      │
│    返回: { agentId, output_file }                           │
└────────────────────┬────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. EventMapper 检测到 isPersistent=true                     │
│    - 提取 output_file 路径                                  │
│    - 不发送 subagent_completed（保持 running）             │
│    - 触发回调 → SessionService                              │
└────────────────────┬────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. SessionService 启动监控器                                │
│    - 每 3 秒轮询 output_file                                │
│    - 检测完成标记（最后 20 行）                            │
│    - 30 分钟超时保护                                        │
└────────────────────┬────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. 检测到完成标记                                           │
│    - 调用 EventMapper.markBackgroundTaskComplete()          │
│    - 通过 socket.emit() 发送 subagent_completed             │
└────────────────────┬────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. 前端接收事件并移除 SubAgentCard                         │
└─────────────────────────────────────────────────────────────┘
```

### 关键设计点

1. **无需修改 Claude CLI**：完全基于现有 `output_file` 机制
2. **后端监控**：在后端层解决问题，架构正确
3. **前端无需修改**：复用现有 SubAgent 显示逻辑
4. **容错设计**：多种完成标记 + 超时保护 + 自动清理

---

## 下一步优化（可选）

测试通过后，可以考虑：

### 1. 精度提升
- 解析 stream-json 格式（而不是纯文本）
- 识别更多完成标记模式
- 提取进度信息（如有）

### 2. 性能优化
- 自适应监控间隔（任务接近完成时提高频率）
- 使用 `fs.watch` 替代轮询
- 批量处理多个任务监控

### 3. 用户体验增强
- SubAgentCard 显示部分输出（最后几行）
- 提供"查看完整日志"按钮
- 显示预计剩余时间（基于历史数据）

---

## 联系与支持

**实施者**: Claude Code
**实施日期**: 2026-02-04
**方案**: 方案 A - CCAAS Backend 监控后台任务输出文件

如有问题，请查看：
- 后端日志：终端输出
- 测试文档：`test-background-subagent.md`
- 实施计划：原始 plan 文件
