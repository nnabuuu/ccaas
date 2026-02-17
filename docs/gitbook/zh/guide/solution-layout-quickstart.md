# Solution 布局系统快速入门指南

## 概述 (2分钟阅读)

布局系统让您的 Solution 用户可以根据工作需求调整聊天面板的位置和大小，提供三种布局模式：

### 三种布局模式

| 模式 | 预览 | 说明 | 适用场景 |
|------|------|------|----------|
| **固定侧栏** (Default) | 固定 450px 宽度 | 聊天面板固定在右侧，不可折叠 | 简单 Solution，快速原型 |
| **浮层** (Overlay) | 可拖拽调整宽度 | 聊天面板浮在内容之上，可折叠，拖拽左边框调整宽度（320px - 70vw） | 内容密集型应用，需要同时查看文档和聊天 |
| **并排** (Side-by-Side) | 可调整分割比例 | 聊天面板和内容并排显示，使用拖拽条调整比例（20% - 60%），可折叠 | 复杂多面板 UI，需要灵活调整空间分配 |

### 为什么需要这个功能？

- ✅ **提高用户体验**：让用户根据屏幕大小和工作内容选择最佳布局
- ✅ **状态持久化**：布局选择自动保存到 localStorage，刷新后保持
- ✅ **无障碍支持**：键盘导航和屏幕阅读器友好
- ✅ **开箱即用**：react-sdk 提供完整实现，只需几行代码集成

---

## 前置条件 (1分钟)

### 依赖

确保您的 Solution 已安装：

```json
{
  "dependencies": {
    "@ccaas/react-sdk": "^2.x",
    "react": "^18.0.0"
  }
}
```

**Side-by-Side 模式额外依赖**：

```json
{
  "dependencies": {
    "react-resizable-panels": "^4.5.7"
  }
}
```

### 导入

```typescript
import {
  useChatLayout,
  ChatSection,
  ChatLayoutControls,
  CollapsedChatTab,
  useAgentConnection,
  useAgentChat,
  ChatPanel
} from '@ccaas/react-sdk'

// Side-by-Side 模式需要
import { Group, Panel, Separator, usePanelRef } from 'react-resizable-panels'
```

---

## 5分钟集成（快速路径）

### 步骤1: 添加 hook (30秒)

```typescript
function App() {
  const layout = useChatLayout() // 一行代码启用布局系统

  // 现有的 connection 和 chat hooks
  const connection = useAgentConnection({ serverUrl: 'http://localhost:3001' })
  const chat = useAgentChat({ connection, tenantId: 'default' })

  // ...
}
```

### 步骤2: 用 ChatSection 包装 ChatPanel (1分钟)

```typescript
// 之前
<ChatPanel {...chatProps} />

// 之后
<ChatSection
  mode={layout.mode}
  isCollapsed={layout.isCollapsed}
  onModeChange={layout.setMode}
  onToggleCollapse={() => layout.setCollapsed(!layout.isCollapsed)}
>
  <ChatPanel {...chatProps} />
</ChatSection>
```

### 步骤3: 选择布局模式实现 (2分钟)

**最简单：Default 模式（固定侧栏）**

```typescript
return (
  <div className="flex h-screen">
    <main className="flex-1 bg-gray-50">
      {/* 您的主要内容 */}
    </main>

    <aside className="w-[450px] flex-shrink-0 bg-gray-50 border-l">
      <ChatSection
        mode={layout.mode}
        isCollapsed={layout.isCollapsed}
        onModeChange={layout.setMode}
        onToggleCollapse={() => layout.setCollapsed(!layout.isCollapsed)}
      >
        <ChatPanel {...chatProps} />
      </ChatSection>
    </aside>
  </div>
)
```

### 步骤4: 测试 (1分钟)

1. 启动开发服务器
2. 在聊天面板顶部看到布局切换器（三个按钮）
3. 点击切换不同模式
4. 刷新页面，验证选择被保存

✅ **完成！** 您的 Solution 现在支持布局调整。

---

## 三种布局模式详解 (3分钟)

### Mode 1: Default 模式（固定侧栏）

#### 何时使用

- 简单的 Solution，不需要复杂的布局调整
- 快速原型开发
- 聊天面板始终可见，不需要折叠功能

#### 完整代码示例

```typescript
import {
  useChatLayout,
  ChatSection,
  useAgentConnection,
  useAgentChat,
  ChatPanel
} from '@ccaas/react-sdk'

function App() {
  const layout = useChatLayout()
  const connection = useAgentConnection({
    serverUrl: 'http://localhost:3001',
    sessionPrefix: 'demo'
  })
  const chat = useAgentChat({ connection, tenantId: 'default' })

  return (
    <div className="flex h-screen">
      {/* 主要内容区域 */}
      <main className="flex-1 bg-gray-50 overflow-auto p-6">
        <h1>我的 Solution</h1>
        {/* 您的内容 */}
      </main>

      {/* 固定侧栏 - 450px 宽度 */}
      <aside className="w-[450px] flex-shrink-0 bg-gray-50 border-l border-gray-200">
        <ChatSection
          mode={layout.mode}
          isCollapsed={layout.isCollapsed}
          onModeChange={layout.setMode}
          onToggleCollapse={() => layout.setCollapsed(!layout.isCollapsed)}
        >
          <ChatPanel
            messages={chat.messages}
            isProcessing={chat.isProcessing}
            connected={connection.connected}
            onSendMessage={chat.sendMessage}
          />
        </ChatSection>
      </aside>
    </div>
  )
}
```

#### UI 特性

- 聊天面板固定在右侧，宽度 450px
- 不可折叠（Default 模式不显示折叠按钮）
- 布局切换器显示在聊天面板顶部
- 用户可以切换到其他模式

---

### Mode 2: Overlay 模式（浮层）

#### 何时使用

- 内容密集型应用（文档编辑器、阅读器）
- 需要在查看内容和聊天之间快速切换
- 希望最大化内容区域，同时保持聊天可访问

#### 完整代码示例

```typescript
import {
  useChatLayout,
  ChatSection,
  CollapsedChatTab,
  useAgentConnection,
  useAgentChat,
  ChatPanel
} from '@ccaas/react-sdk'

function App() {
  const layout = useChatLayout()
  const connection = useAgentConnection({
    serverUrl: 'http://localhost:3001',
    sessionPrefix: 'demo'
  })
  const chat = useAgentChat({ connection, tenantId: 'default' })

  return (
    <div className="flex h-screen">
      {/* 主要内容区域 - 相对定位以容纳浮层 */}
      <main className="flex-1 relative bg-gray-50 overflow-auto p-6">
        <h1>我的 Solution</h1>
        {/* 您的内容 */}

        {/* 浮层聊天面板 */}
        {!layout.isCollapsed ? (
          <div
            className={`absolute top-0 right-0 bottom-0 flex flex-col bg-gray-50 border-l border-gray-200 shadow-xl z-10 ${
              layout.isResizing ? 'select-none' : ''
            }`}
            style={{ width: layout.overlayWidth, minWidth: '320px' }}
          >
            {/* 拖拽条 - 左边框 */}
            <div
              className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-400 transition-colors z-20"
              {...layout.overlayResizeProps}
            />

            <ChatSection
              mode={layout.mode}
              isCollapsed={layout.isCollapsed}
              onModeChange={layout.setMode}
              onToggleCollapse={() => layout.setCollapsed(!layout.isCollapsed)}
            >
              <ChatPanel
                messages={chat.messages}
                isProcessing={chat.isProcessing}
                connected={connection.connected}
                onSendMessage={chat.sendMessage}
              />
            </ChatSection>
          </div>
        ) : (
          // 折叠按钮
          <CollapsedChatTab onClick={() => layout.setCollapsed(false)} />
        )}
      </main>
    </div>
  )
}
```

#### UI 特性

- **浮层位置**：聊天面板浮在内容之上，右侧对齐
- **可拖拽调整**：拖动左边框调整宽度（320px - 70vw）
- **可折叠**：点击折叠按钮，聊天面板缩小为右侧标签
- **阴影效果**：`shadow-xl` 使浮层有明显的层次感
- **拖拽状态**：拖拽时 `select-none` 防止文本选中
- **宽度持久化**：调整后的宽度保存到 localStorage

---

### Mode 3: Side-by-Side 模式（并排）

#### 何时使用

- 复杂的多面板 UI（表单编辑器 + AI 辅助）
- 需要同时操作内容和聊天
- 希望灵活调整空间分配（内容 40% - 聊天 60%，或反之）

#### 完整代码示例

```typescript
import {
  useChatLayout,
  ChatSection,
  CollapsedChatTab,
  useAgentConnection,
  useAgentChat,
  ChatPanel
} from '@ccaas/react-sdk'
import { Group, Panel, Separator, usePanelRef } from 'react-resizable-panels'

function App() {
  const layout = useChatLayout()
  const chatPanelRef = usePanelRef() // 用于控制面板折叠/展开

  const connection = useAgentConnection({
    serverUrl: 'http://localhost:3001',
    sessionPrefix: 'demo'
  })
  const chat = useAgentChat({ connection, tenantId: 'default' })

  return (
    <div className="flex h-screen">
      {/* react-resizable-panels 容器 */}
      <Group orientation="horizontal" id="my-solution-layout">
        {/* 主要内容面板 */}
        <Panel id="content" minSize="20%">
          <main className="h-full bg-gray-50 overflow-auto p-6">
            <h1>我的 Solution</h1>
            {/* 您的内容 */}
          </main>
        </Panel>

        {/* 分隔条 - 可拖拽 */}
        <Separator className="w-1.5 bg-gray-200 hover:bg-blue-400 transition-colors" />

        {/* 聊天面板 */}
        <Panel
          id="chat"
          panelRef={chatPanelRef}
          defaultSize="35%"
          minSize="20%"
          maxSize="60%"
          collapsible
          collapsedSize="0%"
          onResize={(size) => {
            // 同步折叠状态
            const collapsed = size.asPercentage === 0
            layout.setCollapsed(collapsed)
          }}
        >
          {!layout.isCollapsed && (
            <aside className="h-full flex flex-col bg-gray-50 border-l border-gray-200">
              <ChatSection
                mode={layout.mode}
                isCollapsed={layout.isCollapsed}
                onModeChange={layout.setMode}
                onToggleCollapse={() => {
                  // 使用 panelRef 控制面板折叠
                  chatPanelRef.current?.collapse()
                }}
              >
                <ChatPanel
                  messages={chat.messages}
                  isProcessing={chat.isProcessing}
                  connected={connection.connected}
                  onSendMessage={chat.sendMessage}
                />
              </ChatSection>
            </aside>
          )}
        </Panel>
      </Group>

      {/* 折叠按钮 */}
      {layout.isCollapsed && (
        <div className="relative flex-shrink-0">
          <CollapsedChatTab onClick={() => chatPanelRef.current?.expand()} />
        </div>
      )}
    </div>
  )
}
```

#### UI 特性

- **可调整分割比例**：拖动分隔条调整内容和聊天的比例
- **约束**：聊天面板 20% - 60%，内容面板至少 20%
- **可折叠**：折叠后聊天面板宽度为 0%
- **面板引用**：使用 `usePanelRef` 控制面板的 `collapse()` 和 `expand()`
- **状态同步**：`onResize` 回调同步 `isCollapsed` 状态

---

## 完整集成示例 (5分钟)

以下是支持所有三种模式的完整 App.tsx 模板：

```typescript
import { useState, useMemo } from 'react'
import {
  useChatLayout,
  ChatSection,
  CollapsedChatTab,
  useAgentConnection,
  useAgentChat,
  useAgentStatus,
  ChatPanel
} from '@ccaas/react-sdk'
import { Group, Panel, Separator, usePanelRef } from 'react-resizable-panels'

const TENANT_ID = 'default'
const SERVER_URL = 'http://localhost:3001' // 或您的 solution backend URL

function App() {
  // 布局系统 hook
  const {
    mode: layoutMode,
    setMode: setLayoutMode,
    isCollapsed,
    setCollapsed,
    overlayWidth,
    isResizing,
    overlayResizeProps,
  } = useChatLayout()

  // Side-by-Side 模式的面板引用
  const chatPanelRef = usePanelRef()

  // CCAAS 连接
  const connection = useAgentConnection({
    serverUrl: SERVER_URL,
    sessionPrefix: 'my-solution'
  })

  const chat = useAgentChat({ connection, tenantId: TENANT_ID })
  const status = useAgentStatus({ connection })

  // 您的 Solution 特定状态
  const [myData, setMyData] = useState(null)

  // 聊天面板 props
  const chatPanelProps = useMemo(() => ({
    messages: chat.messages,
    isProcessing: status.isProcessing,
    connected: connection.connected,
    activeTools: status.activeTools,
    activeSubAgents: status.activeSubAgents,
    onSendMessage: chat.sendMessage,
    // 您可以添加自定义 renderMessage, renderQuickActions 等
  }), [chat, status, connection])

  // 主要内容元素
  const mainContentEl = (
    <div className="h-full bg-gray-50 overflow-auto p-6">
      <h1 className="text-2xl font-bold mb-4">我的 Solution</h1>
      {/* 您的内容 */}
      <p>这里是您的主要内容区域</p>
    </div>
  )

  // 聊天区域元素（共享）
  const chatSectionEl = (
    <ChatSection
      mode={layoutMode}
      isCollapsed={isCollapsed}
      onModeChange={setLayoutMode}
      onToggleCollapse={() => {
        if (layoutMode === 'side-by-side') {
          chatPanelRef.current?.collapse()
        } else {
          setCollapsed(!isCollapsed)
        }
      }}
    >
      <ChatPanel {...chatPanelProps} />
    </ChatSection>
  )

  return (
    <div className="flex h-screen">
      {/* === DEFAULT MODE === */}
      {layoutMode === 'default' && (
        <>
          <main className="flex-1 bg-gray-50 overflow-auto">
            {mainContentEl}
          </main>
          <aside className="w-[450px] flex-shrink-0 bg-gray-50 border-l border-gray-200">
            {chatSectionEl}
          </aside>
        </>
      )}

      {/* === OVERLAY MODE === */}
      {layoutMode === 'overlay' && (
        <main className="flex-1 relative bg-gray-50 overflow-auto">
          {mainContentEl}

          {!isCollapsed ? (
            <div
              className={`absolute top-0 right-0 bottom-0 flex flex-col bg-gray-50 border-l border-gray-200 shadow-xl z-10 ${
                isResizing ? 'select-none' : ''
              }`}
              style={{ width: overlayWidth, minWidth: '320px' }}
            >
              {/* 拖拽条 */}
              <div
                className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-400 transition-colors z-20"
                {...overlayResizeProps}
              />
              {chatSectionEl}
            </div>
          ) : (
            <CollapsedChatTab onClick={() => setCollapsed(false)} />
          )}
        </main>
      )}

      {/* === SIDE-BY-SIDE MODE === */}
      {layoutMode === 'side-by-side' && (
        <>
          <Group orientation="horizontal" id="my-solution-layout">
            <Panel id="content" minSize="20%">
              <main className="h-full bg-gray-50 overflow-auto">
                {mainContentEl}
              </main>
            </Panel>

            <Separator className="w-1.5 bg-gray-200 hover:bg-blue-400 transition-colors" />

            <Panel
              id="chat"
              panelRef={chatPanelRef}
              defaultSize="35%"
              minSize="20%"
              maxSize="60%"
              collapsible
              collapsedSize="0%"
              onResize={(size) => {
                setCollapsed(size.asPercentage === 0)
              }}
            >
              {!isCollapsed && (
                <aside className="h-full flex flex-col bg-gray-50 border-l border-gray-200">
                  {chatSectionEl}
                </aside>
              )}
            </Panel>
          </Group>

          {isCollapsed && (
            <div className="relative flex-shrink-0">
              <CollapsedChatTab onClick={() => chatPanelRef.current?.expand()} />
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default App
```

---

## 三种模式对比表

| 特性 | Default | Overlay | Side-by-Side |
|------|---------|---------|--------------|
| **聊天宽度** | 固定 450px | 可调整 320px - 70vw | 可调整 20% - 60% |
| **可折叠** | ❌ 否 | ✅ 是 | ✅ 是 |
| **可拖拽调整** | ❌ 否 | ✅ 是（左边框） | ✅ 是（分隔条） |
| **内容遮挡** | ❌ 否（并排） | ✅ 是（浮层） | ❌ 否（并排） |
| **使用场景** | 简单方案 | 内容密集型 | 复杂多面板 UI |
| **适合 Solution** | 快速原型 | 文档阅读 + 聊天 | 表单编辑 + AI 辅助 |
| **复杂度** | 低 | 中 | 中高 |
| **依赖** | 无 | 无 | react-resizable-panels |
| **实现难度** | ⭐ 容易 | ⭐⭐ 中等 | ⭐⭐⭐ 较难 |

---

## 故障排查与常见问题

### 问题1: 布局切换器不显示

**症状**：聊天面板顶部没有布局切换器（三个按钮）

**排查**：
1. 检查是否用 `ChatSection` 包装了 `ChatPanel`
   ```typescript
   // ❌ 错误 - 没有 ChatSection
   <ChatPanel {...props} />

   // ✅ 正确 - 用 ChatSection 包装
   <ChatSection mode={layout.mode} ...>
     <ChatPanel {...props} />
   </ChatSection>
   ```

2. 检查是否传递了正确的 props
   ```typescript
   <ChatSection
     mode={layout.mode}                    // ✅ 必需
     isCollapsed={layout.isCollapsed}      // ✅ 必需
     onModeChange={layout.setMode}         // ✅ 必需
     onToggleCollapse={() => ...}          // ✅ 必需
   >
   ```

### 问题2: 模式不持久（刷新后重置）

**症状**：切换模式后，刷新页面，模式重置为 default

**原因**：
- localStorage 在无痕模式下被禁用
- localStorage 配额已满
- 浏览器设置阻止了 localStorage

**排查**：
1. 打开浏览器控制台，检查是否有 localStorage 错误
2. 验证 localStorage 是否可用
   ```javascript
   localStorage.setItem('test', '1')
   console.log(localStorage.getItem('test')) // 应该输出 '1'
   ```

3. 使用普通浏览器窗口（非无痕模式）

### 问题3: Overlay 面板宽度错误

**症状**：Overlay 模式下，聊天面板宽度不符合预期

**解决方法**：
- 拖拽左边框重新调整宽度
- 或清除 localStorage 重置为默认值
  ```javascript
  localStorage.removeItem('chat-overlay-width')
  ```

### 问题4: Side-by-Side 折叠无效

**症状**：点击折叠按钮，面板没有折叠

**排查**：
1. 检查 `chatPanelRef` 是否正确连接到 Panel
   ```typescript
   const chatPanelRef = usePanelRef()

   <Panel panelRef={chatPanelRef} ...>
   ```

2. 检查 `onToggleCollapse` 是否调用了正确的方法
   ```typescript
   onToggleCollapse={() => {
     if (layoutMode === 'side-by-side') {
       chatPanelRef.current?.collapse() // ✅ 正确
     } else {
       setCollapsed(!isCollapsed)
     }
   }}
   ```

3. 确保 Panel 的 `collapsible` 属性为 `true`

### 问题5: 拖拽条不工作

**症状**：无法拖动分隔条或拖拽条调整宽度

**Overlay 模式排查**：
1. 检查拖拽条元素是否有 `overlayResizeProps`
   ```typescript
   <div
     className="... cursor-col-resize ..."
     {...layout.overlayResizeProps} // ✅ 必需
   />
   ```

2. 检查父容器是否有 `position: relative`

**Side-by-Side 模式排查**：
1. 检查 Separator 组件是否正确放置在两个 Panel 之间
   ```typescript
   <Panel id="content" />
   <Separator />          {/* ✅ 在两个 Panel 之间 */}
   <Panel id="chat" />
   ```

2. 检查 Separator 样式是否包含 `cursor-col-resize`

### 问题6: 布局在小屏幕上显示异常

**症状**：在移动设备或小窗口中，布局显示错乱

**建议**：
1. 为小屏幕添加响应式设计
   ```typescript
   // 使用 Tailwind 的响应式类
   <aside className="w-full sm:w-[450px]"> {/* 小屏幕全宽 */}
   ```

2. 或者在小屏幕上默认使用 Overlay 模式
   ```typescript
   useEffect(() => {
     if (window.innerWidth < 768 && layoutMode === 'default') {
       setLayoutMode('overlay')
     }
   }, [])
   ```

### 问题7: Z-index 冲突

**症状**：Overlay 模式下，聊天面板被其他元素遮挡

**解决方法**：
- 确保 Overlay 容器的 z-index 足够高
  ```typescript
  // 默认 z-10，如果不够可以调整
  className="... z-10"  // 或 z-20, z-30
  ```

- 检查其他元素的 z-index，确保不超过聊天面板

---

## 最佳实践

### 1. 推荐默认模式（按 Solution 类型）

| Solution 类型 | 推荐默认模式 | 理由 |
|---------------|--------------|------|
| 表单编辑器 | Side-by-Side | 需要同时查看表单和 AI 建议 |
| 文档阅读器 | Overlay | 阅读时隐藏聊天，需要时展开 |
| 数据可视化 | Default | 图表需要较大空间，聊天固定在侧边 |
| 代码编辑器 | Side-by-Side | 代码和 AI 辅助需要灵活调整 |
| 简单 CRUD | Default | 功能简单，不需要复杂布局 |

### 2. 配置推荐默认值

如果您希望某个模式作为默认值（而不是 'default'），可以在 localStorage 中设置：

```typescript
useEffect(() => {
  // 首次访问时设置默认模式
  if (!localStorage.getItem('chat-layout-mode')) {
    localStorage.setItem('chat-layout-mode', 'overlay')
  }
}, [])
```

### 3. 自定义颜色主题

`ChatSection` 和 `ChatLayoutControls` 支持 `colorScheme` 属性：

```typescript
<ChatSection
  colorScheme="green"  // 'blue' | 'green' | 'purple' | 'orange' | 'red'
  {...otherProps}
/>
```

### 4. 添加页脚

`ChatSection` 支持 `footer` 属性，用于显示额外信息（如 token 使用量）：

```typescript
<ChatSection
  footer={
    <div className="px-4 py-2 text-xs text-gray-500 bg-gray-100 border-t">
      Tokens: {tokenUsage.input} in / {tokenUsage.output} out
    </div>
  }
  {...otherProps}
/>
```

### 5. 无障碍支持

- 确保拖拽条有明显的视觉提示（`hover:bg-blue-400`）
- 折叠按钮包含 `title` 属性用于提示
- 键盘用户可以使用 Tab 键导航布局切换器

### 6. 性能优化

- 使用 `useMemo` 缓存 `chatPanelProps`，避免不必要的重渲染
  ```typescript
  const chatPanelProps = useMemo(() => ({
    messages: chat.messages,
    isProcessing: status.isProcessing,
    // ...
  }), [chat, status])
  ```

- Overlay 模式拖拽时使用 `select-none` 防止文本选中
  ```typescript
  className={isResizing ? 'select-none' : ''}
  ```

---

## 下一步

### 探索更多功能

- **自定义 renderMessage**：自定义消息渲染（显示特定格式的数据）
- **自定义 renderQuickActions**：添加 Solution 特定的快捷操作
- **表单同步**：使用 `OutputUpdateCard` 组件显示 AI 建议
- **子 Agent 跟踪**：使用 `SubAgentCard` 组件显示后台任务

### 相关文档

- [React SDK 聊天集成指南](chat-integration.md) - 完整的聊天系统集成
- [React SDK API 参考](../../../packages/react-sdk/docs/API.md) - 所有组件和 Hook 的详细 API
- [lesson-plan-designer](../../../solutions/lesson-plan-designer) - 完整的 Side-by-Side 模式实现示例
- [Solution 模板](../../SOLUTION_TEMPLATE.md) - 新 Solution 的模板

### 社区与支持

- [GitHub Issues](https://github.com/YOUR_ORG/kedge-ccaas/issues) - 报告问题或提出功能请求
- [示例代码](../../../solutions/) - 查看其他 Solution 的实现

---

## 附录：localStorage 键名

布局系统使用以下 localStorage 键名保存状态：

| 键名 | 类型 | 说明 | 示例值 |
|------|------|------|--------|
| `chat-layout-mode` | string | 当前布局模式 | `'default'`, `'overlay'`, `'side-by-side'` |
| `chat-overlay-width` | number | Overlay 模式宽度（px） | `500`, `600`, `800` |

**清除布局状态**（用于调试）：

```javascript
// 浏览器控制台执行
localStorage.removeItem('chat-layout-mode')
localStorage.removeItem('chat-overlay-width')
location.reload()
```

---

## 更新历史

- **2026-02-16**: 初始版本
- 适用于 `@ccaas/react-sdk` v2.x
