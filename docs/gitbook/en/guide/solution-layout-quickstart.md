# Solution Layout System Quick Start Guide

## Overview (2-minute read)

The layout system allows your Solution users to adjust the chat panel's position and size based on their work needs, providing three layout modes:

### Three Layout Modes

| Mode | Preview | Description | Use Cases |
|------|---------|-------------|-----------|
| **Fixed Sidebar** (Default) | Fixed 450px width | Chat panel fixed on the right, not collapsible | Simple solutions, rapid prototyping |
| **Overlay** | Resizable width | Chat panel floats over content, collapsible, drag left edge to resize (320px - 70vw) | Content-intensive apps, need to view docs and chat simultaneously |
| **Side-by-Side** | Adjustable split ratio | Chat panel and content displayed side-by-side, drag separator to adjust ratio (20% - 60%), collapsible | Complex multi-panel UI, need flexible space allocation |

### Why Do You Need This Feature?

- ✅ **Improve User Experience**: Let users choose the best layout based on screen size and work content
- ✅ **State Persistence**: Layout choices automatically saved to localStorage, maintained after refresh
- ✅ **Accessibility Support**: Keyboard navigation and screen reader friendly
- ✅ **Out-of-the-Box**: react-sdk provides complete implementation, just a few lines of code to integrate

---

## Prerequisites (1 minute)

### Dependencies

Ensure your Solution has installed:

```json
{
  "dependencies": {
    "@kedge-agentic/react-sdk": "^2.x",
    "react": "^18.0.0"
  }
}
```

**Side-by-Side mode additional dependency**:

```json
{
  "dependencies": {
    "react-resizable-panels": "^4.5.7"
  }
}
```

### Imports

```typescript
import {
  useChatLayout,
  ChatSection,
  ChatLayoutControls,
  CollapsedChatTab,
  useAgentConnection,
  useAgentChat,
  ChatPanel
} from '@kedge-agentic/react-sdk'

// Required for Side-by-Side mode
import { Group, Panel, Separator, usePanelRef } from 'react-resizable-panels'
```

---

## 5-Minute Integration (Quick Path)

### Step 1: Add hook (30 seconds)

```typescript
function App() {
  const layout = useChatLayout() // One line enables layout system

  // Existing connection and chat hooks
  const connection = useAgentConnection({ serverUrl: 'http://localhost:3001' })
  const chat = useAgentChat({ connection, tenantId: 'default' })

  // ...
}
```

### Step 2: Wrap ChatPanel with ChatSection (1 minute)

```typescript
// Before
<ChatPanel {...chatProps} />

// After
<ChatSection
  mode={layout.mode}
  isCollapsed={layout.isCollapsed}
  onModeChange={layout.setMode}
  onToggleCollapse={() => layout.setCollapsed(!layout.isCollapsed)}
>
  <ChatPanel {...chatProps} />
</ChatSection>
```

### Step 3: Choose layout mode implementation (2 minutes)

**Simplest: Default mode (Fixed sidebar)**

```typescript
return (
  <div className="flex h-screen">
    <main className="flex-1 bg-gray-50">
      {/* Your main content */}
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

### Step 4: Test (1 minute)

1. Start dev server
2. See layout switcher at the top of chat panel (three buttons)
3. Click to switch different modes
4. Refresh page, verify selection is saved

✅ **Done!** Your Solution now supports layout adjustment.

---

## Three Layout Modes Explained (3 minutes)

### Mode 1: Default Mode (Fixed Sidebar)

#### When to Use

- Simple solutions that don't need complex layout adjustments
- Rapid prototyping
- Chat panel always visible, no need for collapse functionality

#### Complete Code Example

```typescript
import {
  useChatLayout,
  ChatSection,
  useAgentConnection,
  useAgentChat,
  ChatPanel
} from '@kedge-agentic/react-sdk'

function App() {
  const layout = useChatLayout()
  const connection = useAgentConnection({
    serverUrl: 'http://localhost:3001',
    sessionPrefix: 'demo'
  })
  const chat = useAgentChat({ connection, tenantId: 'default' })

  return (
    <div className="flex h-screen">
      {/* Main content area */}
      <main className="flex-1 bg-gray-50 overflow-auto p-6">
        <h1>My Solution</h1>
        {/* Your content */}
      </main>

      {/* Fixed sidebar - 450px width */}
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

#### UI Features

- Chat panel fixed on the right, 450px width
- Not collapsible (Default mode doesn't show collapse button)
- Layout switcher displayed at top of chat panel
- Users can switch to other modes

---

### Mode 2: Overlay Mode (Floating Panel)

#### When to Use

- Content-intensive applications (document editors, readers)
- Need to quickly switch between viewing content and chatting
- Want to maximize content area while keeping chat accessible

#### Complete Code Example

```typescript
import {
  useChatLayout,
  ChatSection,
  CollapsedChatTab,
  useAgentConnection,
  useAgentChat,
  ChatPanel
} from '@kedge-agentic/react-sdk'

function App() {
  const layout = useChatLayout()
  const connection = useAgentConnection({
    serverUrl: 'http://localhost:3001',
    sessionPrefix: 'demo'
  })
  const chat = useAgentChat({ connection, tenantId: 'default' })

  return (
    <div className="flex h-screen">
      {/* Main content area - relative positioning to contain overlay */}
      <main className="flex-1 relative bg-gray-50 overflow-auto p-6">
        <h1>My Solution</h1>
        {/* Your content */}

        {/* Overlay chat panel */}
        {!layout.isCollapsed ? (
          <div
            className={`absolute top-0 right-0 bottom-0 flex flex-col bg-gray-50 border-l border-gray-200 shadow-xl z-10 ${
              layout.isResizing ? 'select-none' : ''
            }`}
            style={{ width: layout.overlayWidth, minWidth: '320px' }}
          >
            {/* Drag handle - left edge */}
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
          // Collapsed button
          <CollapsedChatTab onClick={() => layout.setCollapsed(false)} />
        )}
      </main>
    </div>
  )
}
```

#### UI Features

- **Overlay Position**: Chat panel floats over content, right-aligned
- **Resizable**: Drag left edge to adjust width (320px - 70vw)
- **Collapsible**: Click collapse button, chat panel minimizes to right-side tab
- **Shadow Effect**: `shadow-xl` gives overlay a distinct layered appearance
- **Drag State**: `select-none` during drag prevents text selection
- **Width Persistence**: Adjusted width saved to localStorage

---

### Mode 3: Side-by-Side Mode (Split View)

#### When to Use

- Complex multi-panel UI (form editor + AI assistance)
- Need to operate on content and chat simultaneously
- Want flexible space allocation (content 40% - chat 60%, or vice versa)

#### Complete Code Example

```typescript
import {
  useChatLayout,
  ChatSection,
  CollapsedChatTab,
  useAgentConnection,
  useAgentChat,
  ChatPanel
} from '@kedge-agentic/react-sdk'
import { Group, Panel, Separator, usePanelRef } from 'react-resizable-panels'

function App() {
  const layout = useChatLayout()
  const chatPanelRef = usePanelRef() // Used to control panel collapse/expand

  const connection = useAgentConnection({
    serverUrl: 'http://localhost:3001',
    sessionPrefix: 'demo'
  })
  const chat = useAgentChat({ connection, tenantId: 'default' })

  return (
    <div className="flex h-screen">
      {/* react-resizable-panels container */}
      <Group orientation="horizontal" id="my-solution-layout">
        {/* Main content panel */}
        <Panel id="content" minSize="20%">
          <main className="h-full bg-gray-50 overflow-auto p-6">
            <h1>My Solution</h1>
            {/* Your content */}
          </main>
        </Panel>

        {/* Separator - draggable */}
        <Separator className="w-1.5 bg-gray-200 hover:bg-blue-400 transition-colors" />

        {/* Chat panel */}
        <Panel
          id="chat"
          panelRef={chatPanelRef}
          defaultSize="35%"
          minSize="20%"
          maxSize="60%"
          collapsible
          collapsedSize="0%"
          onResize={(size) => {
            // Sync collapse state
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
                  // Use panelRef to control panel collapse
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

      {/* Collapsed button */}
      {layout.isCollapsed && (
        <div className="relative flex-shrink-0">
          <CollapsedChatTab onClick={() => chatPanelRef.current?.expand()} />
        </div>
      )}
    </div>
  )
}
```

#### UI Features

- **Adjustable Split Ratio**: Drag separator to adjust content and chat ratio
- **Constraints**: Chat panel 20% - 60%, content panel at least 20%
- **Collapsible**: After collapse, chat panel width is 0%
- **Panel Reference**: Use `usePanelRef` to control panel's `collapse()` and `expand()`
- **State Sync**: `onResize` callback syncs `isCollapsed` state

---

## Complete Integration Example (5 minutes)

Below is a complete App.tsx template supporting all three modes:

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
} from '@kedge-agentic/react-sdk'
import { Group, Panel, Separator, usePanelRef } from 'react-resizable-panels'

const TENANT_ID = 'default'
const SERVER_URL = 'http://localhost:3001' // Or your solution backend URL

function App() {
  // Layout system hook
  const {
    mode: layoutMode,
    setMode: setLayoutMode,
    isCollapsed,
    setCollapsed,
    overlayWidth,
    isResizing,
    overlayResizeProps,
  } = useChatLayout()

  // Panel ref for side-by-side mode
  const chatPanelRef = usePanelRef()

  // CCAAS connection
  const connection = useAgentConnection({
    serverUrl: SERVER_URL,
    sessionPrefix: 'my-solution'
  })

  const chat = useAgentChat({ connection, tenantId: TENANT_ID })
  const status = useAgentStatus({ connection })

  // Your Solution-specific state
  const [myData, setMyData] = useState(null)

  // Chat panel props
  const chatPanelProps = useMemo(() => ({
    messages: chat.messages,
    isProcessing: status.isProcessing,
    connected: connection.connected,
    activeTools: status.activeTools,
    activeSubAgents: status.activeSubAgents,
    onSendMessage: chat.sendMessage,
    // You can add custom renderMessage, renderQuickActions, etc.
  }), [chat, status, connection])

  // Main content element
  const mainContentEl = (
    <div className="h-full bg-gray-50 overflow-auto p-6">
      <h1 className="text-2xl font-bold mb-4">My Solution</h1>
      {/* Your content */}
      <p>This is your main content area</p>
    </div>
  )

  // Chat section element (shared)
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
              {/* Drag handle */}
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

## Three Modes Comparison Table

| Feature | Default | Overlay | Side-by-Side |
|---------|---------|---------|--------------|
| **Chat Width** | Fixed 450px | Resizable 320px - 70vw | Resizable 20% - 60% |
| **Collapsible** | ❌ No | ✅ Yes | ✅ Yes |
| **Drag Resizable** | ❌ No | ✅ Yes (left edge) | ✅ Yes (separator) |
| **Content Occlusion** | ❌ No (side-by-side) | ✅ Yes (overlay) | ❌ No (side-by-side) |
| **Use Cases** | Simple solutions | Content-intensive | Complex multi-panel UI |
| **Suitable Solutions** | Rapid prototyping | Document reading + chat | Form editing + AI assistance |
| **Complexity** | Low | Medium | Medium-High |
| **Dependencies** | None | None | react-resizable-panels |
| **Implementation Difficulty** | ⭐ Easy | ⭐⭐ Medium | ⭐⭐⭐ Hard |

---

## Troubleshooting & FAQ

### Issue 1: Layout switcher not showing

**Symptom**: No layout switcher (three buttons) at top of chat panel

**Troubleshooting**:
1. Check if `ChatPanel` is wrapped with `ChatSection`
   ```typescript
   // ❌ Wrong - no ChatSection
   <ChatPanel {...props} />

   // ✅ Correct - wrapped with ChatSection
   <ChatSection mode={layout.mode} ...>
     <ChatPanel {...props} />
   </ChatSection>
   ```

2. Check if correct props are passed
   ```typescript
   <ChatSection
     mode={layout.mode}                    // ✅ Required
     isCollapsed={layout.isCollapsed}      // ✅ Required
     onModeChange={layout.setMode}         // ✅ Required
     onToggleCollapse={() => ...}          // ✅ Required
   >
   ```

### Issue 2: Mode not persisting (resets after refresh)

**Symptom**: After switching mode, page refresh resets mode to default

**Causes**:
- localStorage disabled in incognito mode
- localStorage quota exceeded
- Browser settings block localStorage

**Troubleshooting**:
1. Open browser console, check for localStorage errors
2. Verify localStorage is available
   ```javascript
   localStorage.setItem('test', '1')
   console.log(localStorage.getItem('test')) // Should output '1'
   ```

3. Use normal browser window (not incognito mode)

### Issue 3: Overlay panel width incorrect

**Symptom**: In Overlay mode, chat panel width doesn't match expectations

**Solution**:
- Drag left edge to readjust width
- Or clear localStorage to reset to default
  ```javascript
  localStorage.removeItem('chat-overlay-width')
  ```

### Issue 4: Side-by-Side collapse not working

**Symptom**: Clicking collapse button doesn't collapse panel

**Troubleshooting**:
1. Check if `chatPanelRef` is correctly connected to Panel
   ```typescript
   const chatPanelRef = usePanelRef()

   <Panel panelRef={chatPanelRef} ...>
   ```

2. Check if `onToggleCollapse` calls correct method
   ```typescript
   onToggleCollapse={() => {
     if (layoutMode === 'side-by-side') {
       chatPanelRef.current?.collapse() // ✅ Correct
     } else {
       setCollapsed(!isCollapsed)
     }
   }}
   ```

3. Ensure Panel's `collapsible` property is `true`

### Issue 5: Drag handle not working

**Symptom**: Cannot drag separator or drag handle to adjust width

**Overlay mode troubleshooting**:
1. Check if drag handle element has `overlayResizeProps`
   ```typescript
   <div
     className="... cursor-col-resize ..."
     {...layout.overlayResizeProps} // ✅ Required
   />
   ```

2. Check if parent container has `position: relative`

**Side-by-Side mode troubleshooting**:
1. Check if Separator component is correctly placed between two Panels
   ```typescript
   <Panel id="content" />
   <Separator />          {/* ✅ Between two Panels */}
   <Panel id="chat" />
   ```

2. Check if Separator styles include `cursor-col-resize`

### Issue 6: Layout displays abnormally on small screens

**Symptom**: Layout displays incorrectly on mobile devices or small windows

**Suggestions**:
1. Add responsive design for small screens
   ```typescript
   // Use Tailwind responsive classes
   <aside className="w-full sm:w-[450px]"> {/* Full width on small screens */}
   ```

2. Or default to Overlay mode on small screens
   ```typescript
   useEffect(() => {
     if (window.innerWidth < 768 && layoutMode === 'default') {
       setLayoutMode('overlay')
     }
   }, [])
   ```

### Issue 7: Z-index conflicts

**Symptom**: In Overlay mode, chat panel is obscured by other elements

**Solution**:
- Ensure Overlay container's z-index is high enough
  ```typescript
  // Default z-10, adjust if needed
  className="... z-10"  // or z-20, z-30
  ```

- Check other elements' z-index, ensure they don't exceed chat panel

---

## Best Practices

### 1. Recommended Default Mode (by Solution Type)

| Solution Type | Recommended Default | Reason |
|---------------|---------------------|--------|
| Form Editor | Side-by-Side | Need to view form and AI suggestions simultaneously |
| Document Reader | Overlay | Hide chat while reading, expand when needed |
| Data Visualization | Default | Charts need large space, chat fixed on side |
| Code Editor | Side-by-Side | Code and AI assistance need flexible adjustment |
| Simple CRUD | Default | Simple functionality, no need for complex layout |

### 2. Configure Recommended Defaults

If you want a specific mode as default (instead of 'default'), you can set it in localStorage:

```typescript
useEffect(() => {
  // Set default mode on first visit
  if (!localStorage.getItem('chat-layout-mode')) {
    localStorage.setItem('chat-layout-mode', 'overlay')
  }
}, [])
```

### 3. Custom Color Theme

`ChatSection` and `ChatLayoutControls` support `colorScheme` property:

```typescript
<ChatSection
  colorScheme="green"  // 'blue' | 'green' | 'purple' | 'orange' | 'red'
  {...otherProps}
/>
```

### 4. Add Footer

`ChatSection` supports `footer` property for displaying additional info (like token usage):

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

### 5. Accessibility Support

- Ensure drag handles have clear visual hints (`hover:bg-blue-400`)
- Collapse button includes `title` attribute for tooltips
- Keyboard users can navigate layout switcher with Tab key

### 6. Performance Optimization

- Use `useMemo` to cache `chatPanelProps`, avoid unnecessary re-renders
  ```typescript
  const chatPanelProps = useMemo(() => ({
    messages: chat.messages,
    isProcessing: status.isProcessing,
    // ...
  }), [chat, status])
  ```

- Use `select-none` during Overlay mode drag to prevent text selection
  ```typescript
  className={isResizing ? 'select-none' : ''}
  ```

---

## Next Steps

### Explore More Features

- **Custom renderMessage**: Customize message rendering (display data in specific formats)
- **Custom renderQuickActions**: Add Solution-specific quick actions
- **Form Sync**: Use `OutputUpdateCard` component to display AI suggestions
- **Sub-agent Tracking**: Use `SubAgentCard` component to display background tasks

### Related Documentation

- [React SDK Chat Integration Guide](chat-integration.md) - Complete chat system integration
- [React SDK API Reference](../../../packages/react-sdk/docs/API.md) - Detailed API for all components and Hooks
- [lesson-plan-designer](../../../solutions/lesson-plan-designer) - Complete Side-by-Side mode implementation example
- [Solution Template](../../SOLUTION_TEMPLATE.md) - Template for new Solutions

### Community & Support

- [GitHub Issues](https://github.com/YOUR_ORG/kedge-ccaas/issues) - Report issues or request features
- [Example Code](../../../solutions/) - View other Solution implementations

---

## Appendix: localStorage Keys

The layout system uses the following localStorage keys to save state:

| Key | Type | Description | Example Values |
|-----|------|-------------|----------------|
| `chat-layout-mode` | string | Current layout mode | `'default'`, `'overlay'`, `'side-by-side'` |
| `chat-overlay-width` | number | Overlay mode width (px) | `500`, `600`, `800` |

**Clear layout state** (for debugging):

```javascript
// Execute in browser console
localStorage.removeItem('chat-layout-mode')
localStorage.removeItem('chat-overlay-width')
location.reload()
```

---

## Update History

- **2026-02-16**: Initial version
- Compatible with `@kedge-agentic/react-sdk` v2.x
