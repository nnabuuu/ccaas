# SDK Comparison: React vs Vue

Feature comparison matrix between `@ccaas/react-sdk` and `@ccaas/vue-sdk`.

## Overview

| Aspect | React SDK | Vue SDK |
|--------|-----------|---------|
| **Framework** | React 18+ | Vue 3.3+ |
| **API Style** | Hooks | Composables |
| **Type Safety** | Full TypeScript | Full TypeScript |
| **Bundle Size** | ~77KB ESM | ~65KB ESM |
| **Components** | 12 UI components | Service-based (no UI) |
| **State Pattern** | Local hooks state | Provide/Inject |

## Feature Matrix

### Core Hooks/Composables

| Feature | React SDK | Vue SDK |
|---------|-----------|---------|
| **Connection Management** | `useAgentConnection` | `useAgentChat` + `useAgentState` |
| **Chat/Messaging** | `useAgentChat` | `useAgentChat` |
| **Agent Status** | `useAgentStatus` | `useAgentState` |
| **Form Sync** | `useOutputSync` | `useFormBridge` + `useOutputSync` |
| **Skills Management** | `useSkills` | `useSkills` |
| **Layout Control** | `useChatLayout` | ❌ Not included |
| **AI Editing Mode** | ❌ Not included | `useAIEditing` ✅ |
| **Plan Mode** | ❌ Not included | `usePlanMode` ✅ |
| **Todo Progress** | Via `useAgentStatus` | `useTodoProgress` ✅ |
| **Tool Activity** | Via `useAgentStatus` | `useToolActivity` ✅ |

### UI Components

| Component | React SDK | Vue SDK |
|-----------|-----------|---------|
| **ChatPanel** | ✅ Full component | ❌ Build your own |
| **MessageBubble** | ✅ | ❌ |
| **AgentActivityLine** | ✅ | ❌ |
| **ThinkingIndicator** | ✅ | ❌ |
| **ToolActivityIndicator** | ✅ | ❌ |
| **SubAgentCard** | ✅ | ❌ |
| **OutputUpdateCard** | ✅ | ❌ |

**React SDK Philosophy:** Batteries-included UI components  
**Vue SDK Philosophy:** Service layer only, bring your own UI

### State Management

| Pattern | React SDK | Vue SDK |
|---------|-----------|---------|
| **Local State** | `useState`, `useRef` | `ref`, `reactive` |
| **Shared State** | Props drilling or Context | Provide/Inject (built-in) |
| **External Store** | Redux, Zustand | Pinia (recommended) |
| **Middleware** | Custom hooks | Composable composition |

### Performance

| Metric | React SDK | Vue SDK |
|--------|-----------|---------|
| **Initial Bundle** | 77.38 KB | ~65 KB |
| **Tree-shaking** | Good | Excellent |
| **Re-render Control** | Manual `memo()` | Automatic reactivity |
| **Memory Usage** | Moderate | Low |
| **Streaming Performance** | Good (needs throttling) | Excellent (reactive updates) |

### Developer Experience

| Aspect | React SDK | Vue SDK |
|--------|-----------|---------|
| **Learning Curve** | Medium (hooks patterns) | Medium (reactivity system) |
| **TypeScript** | Full support | Full support |
| **DevTools** | React DevTools | Vue DevTools |
| **Hot Reload** | Fast Refresh | Vite HMR |
| **Documentation** | Comprehensive | Comprehensive |

### Testing

| Aspect | React SDK | Vue SDK |
|--------|-----------|---------|
| **Unit Testing** | Jest + RTL | Vitest + VTU |
| **Component Testing** | @testing-library/react | @vue/test-utils |
| **Mocking** | Manual mocks | Provide/inject mocks |
| **E2E Testing** | Playwright, Cypress | Playwright, Cypress |

## Architecture Differences

### React SDK Architecture

```
App Component
  ├─ useAgentConnection() → socket, connected
  ├─ useAgentChat() → messages, sendMessage
  ├─ useAgentStatus() → status, tools, thinking
  └─ ChatPanel Component
       ├─ MessageBubble
       ├─ AgentActivityLine
       └─ ToolActivityIndicator
```

**Characteristics:**
- Component-centric
- Props-based communication
- Hook composition
- UI components included

### Vue SDK Architecture

```
App (provide AgentState)
  ├─ useAgentState() → inject shared state
  ├─ useFormBridge() → register forms
  ├─ useAIEditing() → section tracking
  └─ Custom UI Components (you build)
       └─ Access via composables
```

**Characteristics:**
- Service-centric
- Provide/inject communication
- Composable composition
- No UI components (flexible)

## Use Case Recommendations

### Choose React SDK When:
- ✅ You want ready-made chat UI components
- ✅ Building a chat-first application
- ✅ Team is React-focused
- ✅ Need layout controls (overlay, side-by-side)
- ✅ Prefer component libraries

### Choose Vue SDK When:
- ✅ You want full control over UI
- ✅ Building form-heavy applications
- ✅ Team is Vue-focused
- ✅ Need advanced form synchronization
- ✅ Want AI-guided editing workflows
- ✅ Prefer service-based architecture

## Migration Considerations

### React → Vue
- Replace hooks with composables (similar patterns)
- Rebuild UI using Vue components
- Convert Context to Provide/Inject
- Adapt state management (Redux → Pinia)

### Vue → React
- Replace composables with hooks (similar patterns)
- Use built-in UI components or build custom
- Convert Provide/Inject to Context/Props
- Adapt state management (Pinia → Redux/Zustand)

## Bundle Size Comparison

```
React SDK:
  - @ccaas/react-sdk: 77.38 KB
  - react + react-dom: ~140 KB
  - socket.io-client: ~70 KB
  Total: ~290 KB

Vue SDK:
  - @ccaas/vue-sdk: ~65 KB
  - vue: ~110 KB
  - socket.io-client: ~70 KB
  Total: ~245 KB
```

## Conclusion

Both SDKs are production-ready and feature-complete. Choose based on:
1. **Framework preference** (React vs Vue)
2. **UI requirements** (pre-built vs custom)
3. **Application type** (chat-first vs form-heavy)
4. **Team expertise**

For detailed API documentation:
- [React SDK API](../packages/react-sdk/docs/API.md)
- [Vue SDK API](../packages/vue-sdk/docs/API.md)
