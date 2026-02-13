# SubAgent 状态展示 - 验证清单

## 自动验证 ✅

### 测试通过
```bash
cd frontend
npm test -- --run useLessonPlanSession
```
**结果**: ✅ 22 tests passed (22)

### 构建通过
```bash
cd frontend
npm run build
```
**结果**: ✅ Build successful (309.06 kB)

### 代码移除
```bash
grep "useSubAgentPolling" src/hooks/useLessonPlanSession.ts
```
**期望**: 只有注释，无实际调用 ✅

## 手动验证 (开发者模式)

### 1. 启动应用

```bash
# Terminal 1: 启动后端
cd /Users/niex/Documents/GitHub/kedge-ccaas/solutions/lesson-plan-designer/backend
npm run start:dev

# Terminal 2: 启动前端
cd /Users/niex/Documents/GitHub/kedge-ccaas/solutions/lesson-plan-designer/frontend
npm run dev
```

### 2. 打开浏览器 DevTools

**Chrome DevTools 设置**:
1. 打开 http://localhost:5280
2. 按 F12 打开 DevTools
3. 切换到 **Network** 标签
4. 筛选器选择 **WS** (WebSocket)
5. 切换到 **Console** 标签准备监听

### 3. 验证 WebSocket 连接

**Console 输入**:
```javascript
// 获取 Socket.io 实例 (react-sdk 自动连接)
const socket = window.__SOCKET_DEBUG__  // 如果暴露了 debug 接口

// 或者监听全局 WebSocket
socket.on('subagent_started', (data) => {
  console.log('✅ SubAgent Started:', data)
})
socket.on('subagent_completed', (data) => {
  console.log('✅ SubAgent Completed:', data)
})
```

### 4. 触发 SubAgent 任务

**测试消息**:
```
帮我设计一个数学教学目标，内容是"分数的加减法"
```

**预期 AI 行为**:
1. AI 启动 Task tool (Explore agent 或其他)
2. Task tool 在后台执行
3. 完成后返回结果

### 5. 验证 UI 展示

**检查项**:

#### AgentActivityLine (底部状态栏)
- [ ] 显示 "🔄 后台运行中 (1)" 或类似文本
- [ ] 右侧有"详情"按钮
- [ ] 点击"详情"按钮，展开 SubAgent 列表

#### SubAgentCard (展开详情后)
- [ ] 显示 agentType (例如 "Explore", "Task", "general-purpose")
- [ ] 显示 description (例如 "搜索课程标准")
- [ ] 显示运行时长 (例如 "0:23", 每秒更新)
- [ ] 状态图标：🔄 (运行中) 或 ✅ (完成)
- [ ] 完成后 3 秒，卡片自动消失

#### MessageBubble (消息气泡)
- [ ] SubAgent 生成 output_update 后显示"同步到表单"按钮
- [ ] 点击同步按钮，表单字段更新
- [ ] 按钮变绿色或消失 (已同步)

### 6. 验证无轮询请求

**Network 标签检查**:
- [ ] 筛选器选择 **Fetch/XHR**
- [ ] 确认 **没有** 重复的 `/api/v1/sessions/.../sub-agents` 请求
- [ ] 如果有，说明轮询未正确移除 ❌

**预期行为**:
- ✅ 只有初始连接请求 (WebSocket upgrade)
- ✅ 无定时轮询 GET 请求

### 7. 验证 WebSocket 事件

**Network → WS → Messages**:
- [ ] 看到 `42["subagent_started", {...}]` (Socket.io 格式)
- [ ] 看到 `42["subagent_completed", {...}]`
- [ ] 事件数据包含 `subAgentId`, `agentType`, `description`, `startedAt`

**示例事件**:
```json
{
  "subAgent": {
    "subAgentId": "toolu_abc123",
    "agentType": "Task",
    "description": "搜索课程标准",
    "startedAt": "2026-02-11T15:19:48.123Z",
    "status": "running",
    "nestingLevel": 1
  }
}
```

## 调试命令

### REST API 调试 (不影响前端功能)

```bash
# 获取活跃 SubAgent 列表
curl http://localhost:3002/api/v1/sessions/{sessionId}/sub-agents

# 期望响应
{
  "sessionId": "lpd_...",
  "activeSubAgents": [
    {
      "subAgentId": "toolu_abc123",
      "agentType": "Task",
      "description": "...",
      "startedAt": "2026-02-11T15:19:48.123Z",
      "status": "running"
    }
  ],
  "timestamp": "2026-02-11T15:19:50.123Z"
}
```

### React DevTools 调试

1. 安装 React DevTools 扩展
2. 打开 Components 标签
3. 搜索 `useLessonPlanSession`
4. 查看 hook state:
   - `activeSubAgents`: ActiveSubAgent[]
   - `hasActiveSubAgents`: boolean
   - `isMainProcessing`: boolean

**验证逻辑**:
```
如果 activeSubAgents.length > 0:
  hasActiveSubAgents = true
  isMainProcessing = false (即使 chat.isProcessing = true)
```

## 常见问题排查

### 问题 1: AgentActivityLine 不显示

**可能原因**:
- `activeSubAgents` 为空数组
- `isProcessing` 为 false 且 `hasActiveSubAgents` 为 false

**检查**:
```javascript
// Console
console.log('activeSubAgents:', activeSubAgents)
console.log('isProcessing:', isProcessing)
```

### 问题 2: SubAgentCard 不显示计时器

**可能原因**:
- `startedAt` 字段缺失或格式错误

**检查**:
```javascript
// SubAgentCard.tsx 内部
console.log('startedAt:', subAgent.startedAt)
console.log('elapsedSeconds:', elapsedSeconds)
```

### 问题 3: SubAgent 完成后不自动消失

**可能原因**:
- `subagent_completed` 事件未触发
- 3 秒延迟未执行

**检查**:
```javascript
// useAgentStatus.ts (line 144-153)
socket.on('subagent_completed', (data) => {
  console.log('⏰ Will remove in 3s:', data.subAgent.subAgentId)
  setTimeout(() => {
    console.log('🗑️ Removing:', data.subAgent.subAgentId)
    // ...
  }, 3000)
})
```

### 问题 4: 仍有轮询请求

**可能原因**:
- 缓存的旧版前端代码
- `useSubAgentPolling` 未正确移除

**解决方案**:
```bash
# 清理缓存并重新构建
cd frontend
rm -rf node_modules/.vite
npm run dev
```

## 成功标准

✅ **所有检查项通过**:
- 测试通过
- 构建通过
- UI 正确显示 SubAgent 状态
- 无轮询请求
- WebSocket 事件正常
- SubAgent 完成后 3 秒自动消失

🎉 **实施成功！**
