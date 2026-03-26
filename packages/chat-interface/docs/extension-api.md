# Extension API

## Solution 扩展模式

chat-interface 既是独立应用，也是可扩展的 React 组件库。Solution 通过 props 注入自定义 widget、content renderer、skill 展示，无需 fork。

**基础用法：注入自定义 widget**
```tsx
import { ChatInterface } from '@kedge-agentic/chat-interface'
import { QuizResultCard } from './widgets/QuizResultCard'

<ChatInterface
  serverUrl={...} tenantId={...} sessionTemplate="quiz-analyzer"
  customWidgets={{ QuizResultCard }}
  customCatalog={[{ type: 'QuizResultCard', description: '...', propsSchema: {...} }]}
  customBlockRenderers={{ quiz_result: (block) => <QuizResultCard data={block.data} /> }}
/>
```

**高级用法：自定义组合**
```tsx
import { ChatInterfaceProvider, MessageRenderer, SessionContextBar } from '@kedge-agentic/chat-interface'

<ChatInterfaceProvider customWidgets={myWidgets}>
  <SessionContextBar chips={...} />
  <div>{messages.map(msg => <MessageRenderer key={msg.id} ... />)}</div>
  <MyCustomInputBar />
</ChatInterfaceProvider>
```

## Widget 合并机制

- `mergeRegistries(custom?)` — 内置 + 自定义 widget 合并，同名覆盖
- `mergeCatalogs(custom?)` — 内置 + 自定义 catalog 合并，同 type 覆盖
- `ChatInterfaceProvider` 内部通过 `useMemo` 缓存合并结果

## Custom Block Renderer

Solution 可以通过 `customBlockRenderers` 处理自定义 ContentBlock 类型。
当 `ContentBlockView` switch 的 `default` case 命中时，查找 `blockRenderers[block.type]` 进行渲染。

## MCP Bridge

- `createMcpBridge({ serverUrl, tenantId })` — 调用 `POST /api/v1/mcp/call`
- `createMockMcpBridge()` — 开发/测试用 mock
- `useMcpBridge()` hook — 从 context 获取 bridge，暴露 `callMcp(toolName, params)`

## 双模式打包

| 模式 | 命令 | 输出 |
|------|------|------|
| 库模式 | `npm run build:lib` | `dist/index.js` + `dist/index.d.ts` |
| 应用模式 | `npm run build:app` | `dist/` (SPA) |
| 开发 | `npm run dev` | port 5190 |

## Exports

```
@kedge-agentic/chat-interface
├── ChatInterface, ChatInterfaceProvider    # 核心组件 + Context
├── MessageRenderer, WidgetRenderer         # 渲染器
├── SessionContextBar, SkillPanel, SkillBadge  # UI 组件
├── builtinRegistry, builtinCatalog         # Widget 系统
├── mergeRegistries, mergeCatalogs          # 合并工具
├── createMcpBridge, createMockMcpBridge    # MCP Bridge
├── parseAssistantContent, submitToEngine   # Harness (postprocessor + submit)
├── buildAppendPrompt, sessionContextToPrompt  # Harness (preprocessor)
├── useSessionContext, useQuickSuggestions  # Hooks
└── types (all exported)                    # 完整类型
```
