# SubAgent 非阻塞聊天测试指南

## 前置条件

1. 启动后端服务
```bash
cd backend
npm run start:dev
```

2. 启动前端服务
```bash
cd frontend
npm run dev
```

3. 确保有可用的教案

## 手动测试步骤

### 测试 1：SubAgent 运行时 UI 状态

#### 步骤

1. **打开浏览器 DevTools**
   - 按 F12 或右键 → 检查
   - 切换到 Console 标签

2. **发送触发 SubAgent 的消息**
   ```
   用 notebooklm 生成一个关于这个教案的播客
   ```

3. **观察阶段 1：主 Claude 响应前**
   - [ ] Header 显示旋转图标 + "思考中..."
   - [ ] 输入框禁用（背景变灰）
   - [ ] 发送按钮禁用
   - [ ] Console 显示：`🤖 Agent status: running`

4. **观察阶段 2：SubAgent 启动后（约 2-5 秒）**
   - [ ] Header 的 "思考中..." 消失
   - [ ] **输入框变为可用**（背景恢复白色）
   - [ ] **发送按钮变为可用**
   - [ ] 显示蓝色背景的状态条："后台任务运行中"
   - [ ] 状态条显示 SubAgent 描述（例如："生成播客"）
   - [ ] 状态条下方显示提示："您可以继续发送消息，新消息将在后台任务完成后处理"
   - [ ] 聊天区域显示 SubAgent 进度卡片
   - [ ] 进度卡片显示：
     - 蓝色左边框
     - 🔄 图标
     - SubAgent 描述
     - 运行时间（实时更新，例如 "运行中 · 0:05"）
   - [ ] Console 显示：`🤖 SubAgent started: Task 生成播客`

5. **观察阶段 3：SubAgent 运行期间**
   - [ ] 可以在输入框中输入文字
   - [ ] 可以点击发送按钮
   - [ ] 进度卡片的运行时间每秒更新（0:06 → 0:07 → 0:08...）

6. **观察阶段 4：SubAgent 完成后（约 2-5 分钟）**
   - [ ] 蓝色状态条消失
   - [ ] 进度卡片边框变为绿色
   - [ ] 进度卡片图标变为 ✅
   - [ ] 进度卡片文字变为 "已完成"
   - [ ] Console 显示：`✅ SubAgent completed: ... completed`

### 测试 2：发送新消息（SubAgent 运行期间）

#### 步骤

1. **触发 SubAgent**
   ```
   用 notebooklm 生成一个播客
   ```

2. **等待 SubAgent 启动**
   - 等待输入框变为可用

3. **发送第二条消息**
   ```
   帮我总结一下这个教案
   ```

4. **预期行为**
   - [ ] 第二条消息被接受（不显示错误）
   - [ ] 第二条消息显示在聊天历史中
   - [ ] 输入框再次禁用（主 Claude 开始处理第二条消息）
   - [ ] SubAgent 进度卡片继续显示
   - [ ] 第二条消息排队等待处理（在 SubAgent 完成后或主 Claude 空闲后）

### 测试 3：WebSocket 事件验证

#### 步骤

1. **在 Console 中监听事件**
   ```javascript
   // 复制以下代码到 Console
   const originalLog = console.log
   console.log = function(...args) {
     if (args[0] && typeof args[0] === 'string' &&
         (args[0].includes('SubAgent') || args[0].includes('Agent status'))) {
       originalLog.apply(console, ['🔔 Event:', ...args])
     }
     originalLog.apply(console, args)
   }
   ```

2. **发送消息触发 SubAgent**
   ```
   用 notebooklm 生成播客
   ```

3. **验证事件序列**
   - [ ] `🔔 Event: 🤖 Agent status: running`
   - [ ] `🔔 Event: 🤖 SubAgent started: Task ...`
   - [ ] `🔔 Event: 🤖 Agent status: complete` (主 Claude 完成)
   - [ ] (2-5 分钟后) `🔔 Event: ✅ SubAgent completed: ...`

### 测试 4：轮询 API 验证

#### 步骤

1. **触发 SubAgent**
   ```
   用 notebooklm 生成播客
   ```

2. **等待 SubAgent 启动**
   - 看到进度卡片显示

3. **在另一个终端调用 API**
   ```bash
   # 从 Console 获取 sessionId（查看 Network 标签）
   # 或者从 localStorage 获取
   SESSION_ID="lpd_xxx..."

   curl http://localhost:3002/api/v1/sessions/$SESSION_ID/sub-agents
   ```

4. **验证响应**
   ```json
   {
     "sessionId": "lpd_xxx...",
     "activeSubAgents": [
       {
         "subAgentId": "...",
         "agentType": "Task",
         "description": "生成播客",
         "startedAt": "2026-02-03T...",
         "status": "running"
       }
     ],
     "timestamp": "2026-02-03T..."
   }
   ```

### 测试 5：向后兼容性

#### 步骤

1. **在 Console 中检查状态**
   ```javascript
   // 查看 React DevTools 或在代码中打印
   // isProcessing 应该等于 isMainProcessing
   ```

2. **验证旧代码仍然工作**
   - 使用 `isProcessing` 的组件应该正常工作
   - 不应该有控制台错误

## 预期结果摘要

### ✅ 成功标准

- SubAgent 启动后，输入框立即变为可用
- 显示清晰的蓝色状态条
- 显示 SubAgent 进度卡片（带实时计时）
- 可以输入新消息（虽然会排队）
- SubAgent 完成后，状态指示器消失
- 没有控制台错误
- WebSocket 事件序列正确
- 轮询 API 返回正确数据

### ❌ 失败标准

- 输入框在 SubAgent 运行期间仍然禁用
- 没有显示 SubAgent 状态指示器
- 没有显示进度卡片
- 控制台有类型错误
- WebSocket 事件缺失或顺序错误

## 故障排除

### 问题 1：输入框仍然禁用

**可能原因：**
- `isMainProcessing` 状态未正确更新
- `subagent_started` 事件未触发

**调试：**
```javascript
// 在 Console 中检查
console.log('isMainProcessing:', /* 从 React DevTools 获取 */)
console.log('hasActiveSubAgents:', /* 从 React DevTools 获取 */)
```

### 问题 2：没有显示状态指示器

**可能原因：**
- `activeSubAgents` 数组为空
- `hasActiveSubAgents` 为 false

**调试：**
```javascript
// 在 Console 中检查
console.log('activeSubAgents:', /* 从 React DevTools 获取 */)
```

### 问题 3：进度卡片不更新

**可能原因：**
- `startedAt` 时间格式错误
- `useEffect` 未正确设置

**调试：**
- 检查进度卡片组件的 `elapsed` 状态

## 回滚步骤

如果测试失败，可以回滚改动：

```bash
# 恢复所有改动
git checkout HEAD -- frontend/src/types/index.ts
git checkout HEAD -- frontend/src/hooks/useLessonPlanSession.ts
git checkout HEAD -- frontend/src/components/ChatPanel.tsx
git checkout HEAD -- frontend/src/App.tsx

# 删除新建的文件
rm frontend/src/components/SubAgentProgressCard.tsx
```

## 测试报告模板

```markdown
## 测试报告

**测试日期：** 2026-02-03
**测试人员：** [Your Name]
**环境：** [浏览器版本]

### 测试 1：SubAgent 运行时 UI 状态
- [ ] 阶段 1 通过
- [ ] 阶段 2 通过
- [ ] 阶段 3 通过
- [ ] 阶段 4 通过

### 测试 2：发送新消息
- [ ] 通过

### 测试 3：WebSocket 事件
- [ ] 通过

### 测试 4：轮询 API
- [ ] 通过

### 测试 5：向后兼容性
- [ ] 通过

### 问题记录
[如有问题，请在此记录]

### 总结
[测试总结]
```
