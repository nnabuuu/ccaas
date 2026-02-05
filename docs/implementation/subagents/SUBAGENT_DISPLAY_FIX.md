# Sub-Agent 状态显示修复

## 问题描述

**用户反馈：** "我在页面上没有看到后台任务"

**场景：**
- 用户使用 notebooklm 生成 PDF
- CLI 启动了后台 Task agent
- 前端 UI 没有显示后台任务的进度或状态

## 根本原因

### EventMapper 条件判断过严

**位置：** `packages/backend/src/chat/event-mapper.service.ts:271`

**原始代码：**
```typescript
if (toolName === 'Task' || nestingLevel > 0) {
  this.trackSubAgentStart(...)
}
```

**问题：**
- 只追踪 `toolName === 'Task'` 的工具
- 只追踪 `nestingLevel > 0` (即 `agentType !== 'main'`) 的工具
- 不会追踪主代理中运行的其他长时间工具（Bash, Read, Write 等）
- 不支持 `run_in_background` 参数

## 修复方案

### 放宽追踪条件

**新代码：**
```typescript
// Track all potentially background tasks
const isBackgroundTask =
  toolName === 'Task' ||           // Task tool (subagent spawning)
  nestingLevel > 0 ||              // Nested tools (subagent context)
  agentType !== 'main' ||          // Non-main agents
  block.input?.run_in_background === true; // Explicitly marked as background

if (isBackgroundTask) {
  this.trackSubAgentStart(sessionId, toolId, agentType, description, nestingLevel);
  events.push({
    type: 'subagent_started',
    sessionId,
    clientId,
    timestamp,
    payload: {
      subAgentId: toolId,
      agentType: toolName,  // Use toolName for better visibility
      description,
      startedAt: new Date().toISOString(),
      status: 'running',
      nestingLevel,
    },
  });
}
```

**关键改进：**
1. 添加 `agentType !== 'main'` 条件（冗余但明确）
2. 添加 `run_in_background` 参数支持
3. 使用 `toolName` 而不是 `agentType` 作为显示名称，提供更好的可见性

### 同步完成追踪逻辑

**位置：** `packages/backend/src/chat/event-mapper.service.ts:417`

**修改：**
```typescript
// Track subagent completion and emit subagent_completed event
// Match the same conditions as subagent_started
const isBackgroundTask =
  toolName === 'Task' ||
  nestingLevel > 0 ||
  agentType !== 'main' ||
  toolCall?.input?.run_in_background === true;

if (isBackgroundTask) {
  const tracker = this.trackSubAgentComplete(
    sessionId,
    toolUseId,
    isError ? 'failed' : 'completed',
    isError ? this.extractErrorMessage(block.content) : undefined,
  );

  if (tracker) {
    const durationMs = Date.now() - tracker.startedAt.getTime();
    events.push({
      type: 'subagent_completed',
      sessionId,
      clientId,
      timestamp,
      payload: {
        subAgentId: toolUseId,
        status: tracker.status,
        durationMs,
        error: isError ? this.extractErrorMessage(block.content) : undefined,
      },
    });
  }
}
```

## 修改文件

1. `packages/backend/src/chat/event-mapper.service.ts` (第 269-289 行, 411-434 行)
   - 放宽 SubAgent 启动追踪条件
   - 放宽 SubAgent 完成追踪条件
   - 使用 `toolName` 作为 `agentType` 提供更好的可见性

## 测试验证

### ✅ 单元测试通过

```bash
cd packages/backend
npm test
```

**结果：**
```
Test Suites: 24 passed, 24 total
Tests:       482 passed, 482 total
```

### 人工验证步骤

#### 1. 启动服务

```bash
# Terminal 1 - Backend
cd packages/backend
npm run start:dev

# Terminal 2 - Frontend
cd solutions/lesson-plan-designer/frontend
npm run dev
```

#### 2. 测试场景

**测试 1：notebooklm 生成 PDF**
```
用户输入: "用notebooklm生成一个测试音频"
```

**预期结果：**
- 前端显示 "🔄 后台运行中 (1个任务)"
- AgentActivityLine 显示 SubAgent 卡片
- 显示 agentType: "Task"
- 显示运行时长

**测试 2：长时间 Bash 命令**
```
用户输入: "运行 sleep 10"
```

**预期结果：**
- 如果被标记为后台任务，前端应该显示状态

#### 3. 浏览器 DevTools 检查

**打开 Chrome DevTools (F12) → Console**

**应该看到：**
```javascript
🔌 Socket connected to CCAAS
📋 Solution config loaded
🤖 SubAgent started: Task  // 关键日志！
✅ SubAgent completed: Task
```

#### 4. Network 请求检查

**DevTools → Network → 搜索 "sub-agents"**

**应该看到：**
```
GET /api/v1/sessions/{sessionId}/sub-agents
Response 200:
{
  "sessionId": "...",
  "activeSubAgents": [
    {
      "subAgentId": "toolu_...",
      "agentType": "Task",
      "description": "Executing Task",
      "startedAt": "2026-02-03T09:00:00.000Z",
      "status": "running",
      "nestingLevel": 1
    }
  ],
  "timestamp": "2026-02-03T09:00:15.000Z"
}
```

## 前端组件（已存在，无需修改）

### 显示组件

1. **AgentActivityLine.tsx**
   - 显示 "后台运行中 (N个任务)" 摘要
   - 条件：`activeSubAgents.length > 0`

2. **SubAgentCard.tsx**
   - 显示单个 SubAgent 详情
   - 显示 agentType, description, 运行时长

### 数据获取机制

1. **WebSocket 实时事件**
   ```typescript
   socket.on('subagent_started', (data) => {
     console.log('🤖 SubAgent started:', data.payload)
     setActiveSubAgents(prev => [...prev, data.payload])
   })

   socket.on('subagent_completed', (data) => {
     console.log('✅ SubAgent completed:', data.payload)
     setActiveSubAgents(prev =>
       prev.filter(agent => agent.subAgentId !== data.payload.subAgentId)
     )
   })
   ```

2. **REST 轮询备份**
   - `useSubAgentPolling` hook
   - 每 2 秒轮询活跃任务

3. **数据合并逻辑**
   - `mergeSubAgentData` 合并 WebSocket 和轮询数据

## 成功标准

✅ 用户在前端看到 "后台运行中 (N个任务)"
✅ AgentActivityLine 显示活跃的 SubAgent
✅ SubAgentCard 显示 agentType、description、运行时长
✅ DevTools Console 有 "🤖 SubAgent started" 日志
✅ Network 轮询返回非空 activeSubAgents
✅ 后台任务完成后，UI 自动更新移除任务

## 潜在影响

### 优点
- 用户能看到更多后台任务状态
- 提高透明度和用户体验
- 支持未来的后台任务功能

### 注意事项
- 可能显示更多工具执行状态
- 用户可能看到更详细的进度信息（这通常是好事）
- 如果出现性能问题，可以添加过滤条件

## 回滚方案

如果需要回滚，恢复原始条件：

```typescript
// 恢复到严格条件
if (toolName === 'Task' || nestingLevel > 0) {
  this.trackSubAgentStart(...)
}
```

## 相关文件

### 后端
- `packages/backend/src/chat/event-mapper.service.ts` (修改)
- `packages/backend/src/sessions/sessions.controller.ts` (无修改)
- `packages/backend/src/chat/chat.gateway.ts` (无修改)

### 前端
- `solutions/lesson-plan-designer/frontend/src/hooks/useLessonPlanSession.ts` (无修改)
- `solutions/lesson-plan-designer/frontend/src/components/AgentActivityLine.tsx` (无修改)
- `solutions/lesson-plan-designer/frontend/src/components/SubAgentCard.tsx` (无修改)
- `solutions/lesson-plan-designer/frontend/src/hooks/useSubAgentPolling.ts` (无修改)

## 实施时间

- 2026-02-03
- 修改行数: ~40 行
- 测试时间: 5 分钟
