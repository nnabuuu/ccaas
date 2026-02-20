# Vue SDK 故障排除指南

`@kedge-agentic/vue-sdk` 的常见问题、调试技术和解决方案。

## 目录

- [常见错误](#常见错误)
- [响应式问题](#响应式问题)
- [连接问题](#连接问题)
- [表单同步问题](#表单同步问题)
- [调试技术](#调试技术)
- [常见问题解答](#常见问题解答)

---

## 常见错误

### 错误："inject() can only be used inside setup()"

**症状：**
```
[Vue warn]: inject() can only be used inside setup() or functional components.
```

**原因：** 在 Vue 组合式上下文之外使用 SDK composables。

**解决方案：**
```typescript
// ❌ 错误：在 setup() 之外
const agentState = useAgentState()

export default {
  data() {
    return { agentState }
  }
}

// ✅ 正确：在 setup() 内部
export default {
  setup() {
    const agentState = useAgentState()
    return { agentState }
  }
}

// ✅ 更好：使用 <script setup>
<script setup lang="ts">
const agentState = useAgentState()
</script>
```

---

### 错误："Injection not provided"

**症状：**
```
[Vue warn]: injection "Symbol(agentState)" not found
```

**原因：** 在状态被提供之前使用 composable。

**解决方案：**
```vue
<!-- ✅ 在应用级别提供状态 -->
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

## 响应式问题

### 问题：解构后失去响应性

**症状：** 解构后值不再更新。

```typescript
// ❌ 失去响应性
const { title } = formData.value
// title 现在是普通字符串

// ✅ 保持响应性
import { toRefs } from 'vue'
const { title } = toRefs(formData.value)
// title 现在是 ref

// ✅ 或使用 computed
const title = computed(() => formData.value.title)
```

---

## 连接问题

### WebSocket 无法连接

**调试：**
```typescript
import { useAgentChat } from '@kedge-agentic/vue-sdk'

const { connectionState } = useAgentChat()

watch(connectionState, (state) => {
  console.log('连接状态:', state)
  if (state.error) {
    console.error('连接错误:', state.error)
  }
})
```

---

## 表单同步问题

### 表单未接收更新

**检查注册：**
```typescript
const formBridge = useFormBridge()

// 验证表单已注册
onMounted(() => {
  console.log('已注册的表单:', formBridge.getRegisteredForms())
})
```

---

## 调试技术

### Vue DevTools

1. 安装 Vue DevTools 浏览器扩展
2. 打开 DevTools → Vue 选项卡
3. 检查组件状态和注入

### 响应式跟踪

```typescript
import { watch, watchEffect } from 'vue'

// 跟踪所有响应式依赖
watchEffect(() => {
  console.log('响应式值:', {
    title: formData.value.title,
    isProcessing: agentState.isProcessing.value
  })
})
```

---

## 常见问题解答

### 问：如何测试使用 inject() 的 composables？

**答：** 在测试中提供模拟值：

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

## 相关文档

- [API 参考](./API_ZH.md)
- [高级模式](./ADVANCED_PATTERNS_ZH.md)
- [架构文档](./ARCHITECTURE.md)
