# 测试后台 SubAgent 显示功能

## 实施总结

✅ **已完成的修改**：

### 1. EventMapper 修改 (event-mapper.service.ts)

- ✅ 扩展 `SubAgentTracker` 接口，添加 `isPersistent` 和 `outputFile` 字段
- ✅ 修改 `trackSubAgentStart()` 接收 `toolInput` 参数，检测 `run_in_background`
- ✅ 修改调用处传递 `block.input`
- ✅ 修改 `tool_result` 处理逻辑，检测持久化任务并提取 `output_file`
- ✅ 添加后台任务回调接口：
  - `registerBackgroundTaskCallback()` - 注册回调
  - `emitBackgroundTaskRegistration()` - 发送注册事件
  - `markBackgroundTaskComplete()` - 外部标记完成

### 2. SessionService 修改 (session.service.ts)

- ✅ 添加 `backgroundTaskMonitors` Map 存储监控器
- ✅ 构造函数中注册 EventMapper 回调
- ✅ 实现监控方法：
  - `startBackgroundTaskMonitor()` - 启动监控（3秒轮询）
  - `checkBackgroundTaskStatus()` - 检查输出文件状态
  - `stopBackgroundTaskMonitor()` - 停止监控并发送完成事件
- ✅ 修改 `closeSession()` 在关闭时清理监控器
- ✅ 修改 `shutdown()` 在关闭时清理所有监控器

## 测试计划

### 验证步骤

1. **启动后端服务**
   ```bash
   cd packages/backend
   npm run start:dev
   ```

2. **启动前端（Lesson Plan Designer）**
   ```bash
   cd solutions/lesson-plan-designer/frontend
   npm run dev
   ```

3. **测试用例 1：模拟后台任务**

   在聊天界面输入：
   ```
   请使用 Task 工具在后台运行一个任务，等待 30 秒后返回 "完成"
   ```

   **期望结果**：
   - ✅ 看到 Task 工具的 SubAgentCard 显示
   - ✅ SubAgentCard 持续显示约 30 秒（而不是立即消失）
   - ✅ 后端日志显示：
     ```
     [BackgroundTask] Starting monitor: {sessionId}:{subAgentId}
     [BackgroundTask] Task completed: {subAgentId}
     [BackgroundTask] Sent subagent_completed event
     ```
   - ✅ 30 秒后 SubAgentCard 自动消失

4. **测试用例 2：NotebookLM 播客生成（真实场景）**

   在聊天界面输入：
   ```
   /notebooklm 生成一个关于人工智能的播客
   ```

   **期望结果**：
   - ✅ SubAgentCard 持续显示直到播客生成完成
   - ✅ 显示 "notebooklm" 类型的 SubAgent
   - ✅ 任务完成后自动移除

5. **测试用例 3：多个并发后台任务**

   ```
   同时启动 3 个不同的后台任务
   ```

   **期望结果**：
   - ✅ 所有 3 个任务都显示为独立的 SubAgentCard
   - ✅ 每个任务独立跟踪，互不干扰
   - ✅ 各自完成后独立移除

6. **测试用例 4：任务超时**

   不完成任务，等待 30 分钟

   **期望结果**：
   - ✅ 30 分钟后自动标记为 failed
   - ✅ 后端日志显示 "Task timeout after 30 minutes"
   - ✅ SubAgentCard 消失

### 验证清单

- [ ] 后台任务的 SubAgentCard 持续显示（不立即消失）
- [ ] 后端日志显示监控器启动
- [ ] 后端日志显示文件轮询（每 3 秒）
- [ ] 任务完成后发送 `subagent_completed` 事件
- [ ] 前端接收事件并移除 SubAgentCard
- [ ] 多个后台任务可以并发显示
- [ ] 超时后自动标记为 failed
- [ ] 会话关闭时停止所有监控器

## 监控逻辑说明

### 完成检测标记

监控器会检查输出文件的最后 20 行，寻找以下标记：

**成功标记**：
- `"Agent completed successfully"`
- `"type":"result"`
- `agentId:` (Task 工具返回)

**失败标记**：
- `Error`
- `Failed`

### 监控参数

- **轮询间隔**：3 秒
- **超时时间**：30 分钟
- **读取范围**：输出文件最后 20 行

## 架构说明

### 数据流

```
1. Claude CLI 执行 Task 工具（run_in_background=true）
   ↓
2. EventMapper 检测到 isPersistent=true
   ↓
3. EventMapper 提取 outputFile 路径
   ↓
4. EventMapper 调用回调 → SessionService.startBackgroundTaskMonitor()
   ↓
5. SessionService 每 3 秒轮询输出文件
   ↓
6. 检测到完成标记
   ↓
7. SessionService 调用 EventMapper.markBackgroundTaskComplete()
   ↓
8. EventMapper 更新 tracker 状态
   ↓
9. SessionService 通过 socket.emit() 发送 subagent_completed 事件
   ↓
10. 前端接收事件，移除 SubAgentCard
```

### 关键设计点

1. **无需修改 Claude CLI**：完全基于现有的 `output_file` 机制
2. **后端监控**：问题在后端层解决，架构正确
3. **前端无需修改**：复用现有的 SubAgent 显示逻辑
4. **容错设计**：
   - 多种完成标记（降低误判）
   - 文件读取失败不报错（继续等待）
   - 30 分钟超时保护
   - 会话关闭时自动清理

## 下一步

测试通过后，可以考虑以下优化：

1. **精度提升**：
   - 解析 stream-json 格式（而不是纯文本）
   - 识别更多完成标记模式
   - 提取进度信息

2. **性能优化**：
   - 自适应监控间隔（接近完成时提高频率）
   - 使用 `fs.watch` 而不是轮询
   - 批量处理多个任务的监控

3. **用户体验增强**：
   - SubAgentCard 显示部分输出（最后几行）
   - 提供"查看完整日志"按钮
   - 显示预计剩余时间
