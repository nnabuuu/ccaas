# Vue SDK 高级模式

使用 `@kedge-agentic/vue-sdk` 构建生产应用的高级模式和技术。

## 目录

- [Composable 组合模式](#composable-组合模式)
- [Provide/Inject 高级用法](#provideinject-高级用法)
- [响应式最佳实践](#响应式最佳实践)
- [状态管理集成](#状态管理集成)
- [自定义 Composables](#自定义-composables)
- [性能优化](#性能优化)
- [测试策略](#测试策略)

---

## Composable 组合模式

### 创建领域特定的 Composables

组合多个 SDK composables 创建领域特定的功能：

```typescript
import {
  useAgentState,
  useFormBridge,
  useAIEditing,
  usePlanMode,
  useTodoProgress
} from '@kedge-agentic/vue-sdk'
import { computed, ref } from 'vue'

export function useLessonPlanEditor() {
  // SDK composables
  const agentState = useAgentState()
  const formBridge = useFormBridge()
  const aiEditing = useAIEditing({
    allSections: ['title', 'objectives', 'activities', 'assessment'] as const,
    onSectionUpdate: (section, content) => {
      formData.value[section] = content
    },
    onComplete: () => {
      toast.success('课程计划生成完成')
    }
  })
  const planMode = usePlanMode()
  const todoProgress = useTodoProgress()

  // 领域状态
  const formData = ref({
    title: '',
    objectives: '',
    activities: '',
    assessment: ''
  })

  // 在 bridge 中注册表单
  formBridge.registerForm('lessonPlan', formData, {
    fieldMapping: {
      lesson_title: 'title',
      learning_objectives: 'objectives',
      learning_activities: 'activities',
      assessment_methods: 'assessment'
    }
  })

  // 计算属性
  const isGenerating = computed(() =>
    aiEditing.aiEditingMode.value || agentState.isProcessing.value
  )

  const generationProgress = computed(() => {
    if (aiEditing.aiEditingMode.value) {
      return aiEditing.progress.value
    }
    return todoProgress.progress.value
  })

  // 领域方法
  const generateFromPrompt = async (prompt: string) => {
    aiEditing.startAIEditing()
    // 通过 agent chat 发送消息...
  }

  return {
    formData,
    isGenerating,
    generationProgress,
    ...aiEditing,
    ...planMode,
    generateFromPrompt
  }
}
```

### 分层 Composables 模式

分层构建 composables 以实现更好的关注点分离：

```typescript
// 第 1 层：连接 composable
export function useAgentConnection() {
  const socket = ref<Socket | null>(null)
  const connected = ref(false)

  const connect = () => {
    socket.value = io(serverUrl)
    socket.value.on('connect', () => {
      connected.value = true
    })
  }

  return { socket, connected, connect }
}

// 第 2 层：聊天 composable（使用连接）
export function useAgentChat() {
  const { socket } = useAgentConnection()
  const messages = ref<Message[]>([])

  const sendMessage = (content: string) => {
    socket.value?.emit('message', { content })
  }

  return { messages, sendMessage }
}

// 第 3 层：领域 composable（使用聊天）
export function useSmartAssistant() {
  const { messages, sendMessage } = useAgentChat()
  const context = ref<string>('')

  const askQuestion = (question: string) => {
    sendMessage(\`上下文：\${context.value}\\n\\n问题：\${question}\`)
  }

  return { messages, context, askQuestion }
}
```

---

## Provide/Inject 高级用法

### 类型安全的注入与默认值

```typescript
import { inject, provide, type InjectionKey } from 'vue'

// 定义带类型的注入键
interface UserProfile {
  name: string
  role: string
}

const UserProfileKey: InjectionKey<UserProfile> = Symbol('userProfile')

// 提供者组件
export function provideUserProfile(profile: UserProfile) {
  provide(UserProfileKey, profile)
}

// 消费者（类型安全 + 默认值）
export function useUserProfile() {
  const profile = inject(UserProfileKey, {
    name: '访客',
    role: 'viewer'
  })

  return profile
}
```

## 相关文档

- [API 参考](./API_ZH.md)
- [故障排除](./TROUBLESHOOTING_ZH.md)
- [架构文档](./ARCHITECTURE.md)
