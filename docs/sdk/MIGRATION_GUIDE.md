# SDK Migration Guide

Guide for migrating between SDK versions and frameworks.

## Table of Contents

- [Upgrading React SDK](#upgrading-react-sdk)
- [Upgrading Vue SDK](#upgrading-vue-sdk)
- [Migrating React → Vue](#migrating-react--vue)
- [Migrating Vue → React](#migrating-vue--react)
- [Breaking Changes](#breaking-changes)

---

## Upgrading React SDK

### v1.x → v2.x (Latest)

#### Breaking Changes

**1. useAgentConnection now requires explicit serverUrl**

```typescript
// ❌ Old (v1.x)
const connection = useAgentConnection()

// ✅ New (v2.x)
const connection = useAgentConnection({
  serverUrl: 'http://localhost:3001'
})
```

**2. ChatPanel props restructured**

```typescript
// ❌ Old
<ChatPanel
  connection={connection}
  chat={chat}
  status={status}
/>

// ✅ New
<ChatPanel
  messages={chat.messages}
  isProcessing={chat.isProcessing}
  onSendMessage={chat.sendMessage}
  agentStatus={status.agentStatus}
  currentActivity={status.currentActivity}
/>
```

**3. useOutputSync mode parameter now required**

```typescript
// ❌ Old
const sync = useOutputSync()

// ✅ New
const sync = useOutputSync({ mode: 'auto' })
```

#### Migration Steps

1. Update package version:
```bash
npm install @ccaas/react-sdk@latest
```

2. Update connection initialization
3. Update ChatPanel props
4. Add mode to useOutputSync
5. Run tests and verify

---

## Upgrading Vue SDK

### v1.x → v2.x (Latest)

#### Breaking Changes

**1. Provide/inject keys moved to symbols**

```typescript
// ❌ Old (v1.x)
provide('agentState', state)
const state = inject('agentState')

// ✅ New (v2.x)
import { AgentStateKey } from '@ccaas/vue-sdk'
provide(AgentStateKey, state)
const state = inject(AgentStateKey)
```

**2. useFormBridge registration API changed**

```typescript
// ❌ Old
formBridge.register('myForm', formData)

// ✅ New
formBridge.registerForm('myForm', formData, {
  fieldMapping: { /* ... */ }
})
```

**3. useAIEditing requires allSections parameter**

```typescript
// ❌ Old
const editing = useAIEditing()

// ✅ New
const editing = useAIEditing({
  allSections: ['intro', 'body'] as const
})
```

#### Migration Steps

1. Update package version:
```bash
npm install @ccaas/vue-sdk@latest
```

2. Replace string inject keys with symbols
3. Update formBridge.register calls
4. Add allSections to useAIEditing
5. Run tests and verify

---

## Migrating React → Vue

### Pattern Conversion

#### Hooks → Composables

| React Hook | Vue Composable | Notes |
|------------|----------------|-------|
| `useAgentConnection` | `useAgentChat` | Connection + chat combined in Vue |
| `useAgentChat` | `useAgentChat` | Similar API |
| `useAgentStatus` | `useAgentState` | Centralized state in Vue |
| `useOutputSync` | `useFormBridge` + `useOutputSync` | Vue has more specific tools |
| `useSkills` | `useSkills` | Almost identical |

#### State Management

```typescript
// React: Local state
const [messages, setMessages] = useState([])

// Vue: Reactive refs
const messages = ref([])
```

```typescript
// React: Context
const MyContext = createContext()
provide value={myValue} />
const value = useContext(MyContext)

// Vue: Provide/Inject
provide(MyKey, myValue)
const value = inject(MyKey)
```

#### Example Migration

**React Component:**
```tsx
import { useAgentConnection, useAgentChat } from '@ccaas/react-sdk'

function ChatApp() {
  const connection = useAgentConnection({ serverUrl: '...' })
  const chat = useAgentChat({ connection, tenantId: 'my-tenant' })

  return (
    <div>
      {chat.messages.map(msg => (
        <div key={msg.id}>{msg.content}</div>
      ))}
      <button onClick={() => chat.sendMessage('Hello')}>Send</button>
    </div>
  )
}
```

**Vue Component:**
```vue
<script setup lang="ts">
import { useAgentChat } from '@ccaas/vue-sdk'

const chat = useAgentChat({
  serverUrl: '...',
  tenantId: 'my-tenant'
})

const sendMessage = () => {
  chat.sendMessage('Hello')
}
</script>

<template>
  <div>
    <div v-for="msg in chat.messages.value" :key="msg.id">
      {{ msg.content }}
    </div>
    <button @click="sendMessage">Send</button>
  </div>
</template>
```

### UI Components

React SDK provides UI components; Vue SDK doesn't.

**Migration Strategy:**

1. Identify React SDK components you use:
   - ChatPanel
   - MessageBubble
   - AgentActivityLine
   - etc.

2. Rebuild in Vue using SDK composables:

```vue
<!-- Rebuild MessageBubble -->
<script setup lang="ts">
import type { Message } from '@ccaas/common'

const props = defineProps<{ message: Message }>()
</script>

<template>
  <div :class="`message message-${props.message.role}`">
    <div class="message-content">{{ props.message.content }}</div>
  </div>
</template>

<style scoped>
/* Your styles */
</style>
```

3. Use Vue UI libraries:
   - Element Plus
   - Vuetify
   - PrimeVue
   - Naive UI

---

## Migrating Vue → React

### Pattern Conversion

#### Composables → Hooks

| Vue Composable | React Hook | Notes |
|----------------|------------|-------|
| `useAgentState` | `useAgentStatus` | Similar tracking |
| `useFormBridge` | `useOutputSync` | React has generic version |
| `useAIEditing` | Build custom hook | No direct equivalent |
| `usePlanMode` | Build custom hook | No direct equivalent |
| `useTodoProgress` | Via `useAgentStatus` | Included in status |

#### State Management

```typescript
// Vue: Reactive refs
const messages = ref([])

// React: State hook
const [messages, setMessages] = useState([])
```

```typescript
// Vue: Provide/Inject
provide(MyKey, myValue)
const value = inject(MyKey)

// React: Context
const MyContext = createContext()
<MyContext.Provider value={myValue} />
const value = useContext(MyContext)
```

#### Example Migration

**Vue Component:**
```vue
<script setup lang="ts">
import { useAgentChat } from '@ccaas/vue-sdk'

const chat = useAgentChat({
  serverUrl: '...',
  tenantId: 'my-tenant'
})

const sendMessage = () => {
  chat.sendMessage('Hello')
}
</script>

<template>
  <div>
    <div v-for="msg in chat.messages.value" :key="msg.id">
      {{ msg.content }}
    </div>
    <button @click="sendMessage">Send</button>
  </div>
</template>
```

**React Component:**
```tsx
import { useAgentConnection, useAgentChat, ChatPanel } from '@ccaas/react-sdk'

function ChatApp() {
  const connection = useAgentConnection({ serverUrl: '...' })
  const chat = useAgentChat({ connection, tenantId: 'my-tenant' })

  return (
    <ChatPanel
      messages={chat.messages}
      isProcessing={chat.isProcessing}
      onSendMessage={chat.sendMessage}
    />
  )
}
```

### UI Components

Vue SDK has no UI components; React SDK does.

**Migration Benefit:** You can drop custom Vue UI and use React SDK components!

1. Replace custom Vue chat UI with `<ChatPanel />`
2. Use `MessageBubble`, `AgentActivityLine`, etc.
3. Customize via `renderMessage` prop if needed

---

## Breaking Changes Reference

### React SDK v2.0.0

**Date:** 2026-02-01

**Changes:**
1. `serverUrl` now required in `useAgentConnection`
2. `ChatPanel` props flattened (no nested objects)
3. `useOutputSync` requires `mode` parameter
4. Removed deprecated `useRealSession` hook

**Migration Time:** ~2 hours for typical app

### Vue SDK v2.0.0

**Date:** 2026-01-15

**Changes:**
1. String inject keys replaced with typed symbols
2. `formBridge.register` → `formBridge.registerForm`
3. `useAIEditing` requires `allSections`
4. `useAgentState` centralized (replaces multiple hooks)

**Migration Time:** ~3 hours for typical app

---

## Automated Migration Tools

### Code Transformers

**React SDK Upgrade:**
```bash
npx @ccaas/codemod react-sdk-v1-to-v2 src/
```

**Vue SDK Upgrade:**
```bash
npx @ccaas/codemod vue-sdk-v1-to-v2 src/
```

### Manual Checklist

React v1 → v2:
- [ ] Add serverUrl to useAgentConnection
- [ ] Flatten ChatPanel props
- [ ] Add mode to useOutputSync
- [ ] Remove useRealSession usage
- [ ] Update tests
- [ ] Verify build passes

Vue v1 → v2:
- [ ] Replace inject strings with symbols
- [ ] Update formBridge.register calls
- [ ] Add allSections to useAIEditing
- [ ] Update provide/inject patterns
- [ ] Update tests
- [ ] Verify build passes

---

## Getting Help

### Support Channels

- GitHub Issues: [github.com/your-org/ccaas/issues](https://github.com)
- Discord: [discord.gg/ccaas](https://discord.com)
- Email: support@ccaas.dev

### Migration Support

For complex migrations:
1. Review this guide
2. Check SDK-specific documentation
3. Try automated code mods
4. Ask in community channels
5. Consider professional migration service

---

## Related Documentation

- [React SDK API](../../packages/react-sdk/docs/API.md)
- [Vue SDK API](../../packages/vue-sdk/docs/API.md)
- [SDK Comparison](./SDK_COMPARISON.md)
- [Choosing an SDK](./CHOOSING_SDK.md)
