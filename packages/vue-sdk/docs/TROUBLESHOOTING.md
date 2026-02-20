# Vue SDK Troubleshooting Guide

Common issues, debugging techniques, and solutions for `@kedge-agentic/vue-sdk`.

## Table of Contents

- [Common Errors](#common-errors)
- [Reactivity Issues](#reactivity-issues)
- [Connection Problems](#connection-problems)
- [Form Sync Issues](#form-sync-issues)
- [Debugging Techniques](#debugging-techniques)
- [FAQ](#faq)

---

## Common Errors

### Error: "inject() can only be used inside setup()"

**Symptoms:**
```
[Vue warn]: inject() can only be used inside setup() or functional components.
```

**Cause:** Using SDK composables outside of Vue's composition context.

**Solution:**
```typescript
// ❌ Bad: Outside setup()
const agentState = useAgentState()

export default {
  data() {
    return { agentState }
  }
}

// ✅ Good: Inside setup()
export default {
  setup() {
    const agentState = useAgentState()
    return { agentState }
  }
}

// ✅ Better: <script setup>
<script setup lang="ts">
const agentState = useAgentState()
</script>
```

---

### Error: "Injection not provided"

**Symptoms:**
```
[Vue warn]: injection "Symbol(agentState)" not found
```

**Cause:** Using composable before state is provided.

**Solution:**
```vue
<!-- ✅ Provide state at app level -->
<script setup lang="ts">
import { provide } from 'vue'
import { AgentStateKey, createAgentState } from '@kedge-agentic/vue-sdk'

const agentState = createAgentState()
provide(AgentStateKey, agentState)
</script>

<template>
  <ChildComponent />
</template>
```

---

## Reactivity Issues

### Problem: Reactivity Lost After Destructuring

**Symptom:** Values don't update after destructuring.

```typescript
// ❌ Loses reactivity
const { title } = formData.value
// title is now a plain string

// ✅ Maintain reactivity
import { toRefs } from 'vue'
const { title } = toRefs(formData.value)
// title is now a ref

// ✅ Or use computed
const title = computed(() => formData.value.title)
```

---

## Connection Problems

### WebSocket Fails to Connect

**Debugging:**
```typescript
import { useAgentChat } from '@kedge-agentic/vue-sdk'

const { connectionState } = useAgentChat()

watch(connectionState, (state) => {
  console.log('Connection state:', state)
  if (state.error) {
    console.error('Connection error:', state.error)
  }
})
```

---

## Form Sync Issues

### Form Not Receiving Updates

**Check registration:**
```typescript
const formBridge = useFormBridge()

// Verify form is registered
onMounted(() => {
  console.log('Registered forms:', formBridge.getRegisteredForms())
})
```

---

## Debugging Techniques

### Vue DevTools

1. Install Vue DevTools browser extension
2. Open DevTools → Vue tab
3. Inspect component state and injections

### Reactivity Tracking

```typescript
import { watch, watchEffect } from 'vue'

// Track all reactive dependencies
watchEffect(() => {
  console.log('Reactive values:', {
    title: formData.value.title,
    isProcessing: agentState.isProcessing.value
  })
})
```

---

## FAQ

### Q: How do I test composables that use inject()?

**A:** Provide mock values in your tests:

```typescript
import { mount } from '@vue/test-utils'

const wrapper = mount(MyComponent, {
  global: {
    provide: {
      [AgentStateKey]: mockAgentState
    }
  }
})
```

---

## Related Documentation

- [API Reference](./API.md)
- [Advanced Patterns](./ADVANCED_PATTERNS.md)
- [Architecture](./ARCHITECTURE_EN.md)
