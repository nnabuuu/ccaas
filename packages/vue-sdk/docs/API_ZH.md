# Vue SDK API 参考文档

`@kedge-agentic/vue-sdk` 完整 API 文档 - Vue 3 组合式函数和工具库，用于与 Claude-Code-as-a-Service 后端集成。

## 目录

- [安装](#安装)
- [快速开始](#快速开始)
- [核心概念](#核心概念)
- [组合式函数](#组合式函数)
  - [useAgentState](#useagentstate)
  - [useAgentChat](#useagentchat)
  - [useFormBridge](#useformbridge)
  - [useAIEditing](#useaiediting)
  - [usePlanMode](#useplanmode)
  - [useTodoProgress](#usetodoprogress)
  - [useToolActivity](#usetoolactivity)
  - [useThinking](#usethinking)
  - [useTokenUsage](#usetokenusage)
  - [useExploration](#useexploration)
  - [useSkills](#useskills)
  - [useOutputSync](#useoutputsync)
  - [useLessonPlanSync](#uselessonplansync)
  - [useEntityBridge](#useentitybridge)
- [服务](#服务)
  - [FormStateSynchronizer](#formstatesynchronizer)
  - [AgentConnection](#agentconnection)
- [类型定义](#类型定义)
- [注入符号](#注入符号)
- [最佳实践](#最佳实践)

## 安装

```bash
npm install @kedge-agentic/vue-sdk
```

**依赖要求:**
- Vue 3.3+
- socket.io-client 4.x
- TypeScript 5.0+ (推荐)

## 快速开始

### 基础配置

```vue
<!-- App.vue -->
<template>
  <AgentListener>
    <RouterView />
  </AgentListener>
</template>
```

### 使用组合式函数

```vue
<script setup lang="ts">
import { useAgentState, useTodoProgress } from '@kedge-agentic/vue-sdk'

const { isProcessing, currentToolName } = useAgentState()
const { progress, currentTodo } = useTodoProgress()
</script>

<template>
  <div v-if="isProcessing" class="agent-status">
    <span>正在处理: {{ currentToolName }}</span>
    <ProgressBar :value="progress" />
    <span v-if="currentTodo">{{ currentTodo.content }}</span>
  </div>
</template>
```

## 核心概念

### 组合式函数优先设计

Vue SDK 遵循**组合式函数优先**的设计模式,提供细粒度的可复用函数,而不是单一的插件。这种方式提供了:

- **渐进式采用**: 只使用你需要的功能
- **Tree-shaking 友好**: 未使用的代码在构建时被消除
- **类型安全**: 完整的 TypeScript 支持和类型推断
- **可测试性**: 易于测试单个组合式函数

### Provide/Inject 模式

状态由 `AgentListener` 组件提供,通过组合式函数使用 Vue 的 provide/inject 系统消费:

```
AgentListener (提供状态)
    ↓
useAgentState (注入状态)
    ↓
你的组件
```

### 响应式

所有组合式函数返回 Vue 响应式引用 (Ref/ComputedRef),当状态改变时自动触发重新渲染。

## 组合式函数

### useAgentState

访问集中的 Agent 状态,包括连接状态、处理状态、待办事项和指标。

#### 函数签名

```typescript
function useAgentState(): UseAgentStateReturn
```

#### 返回类型

```typescript
interface UseAgentStateReturn {
  // 连接状态
  clientId: Readonly<Ref<string>>
  sessionId: Readonly<Ref<string>>
  isConnected: Readonly<Ref<boolean>>

  // 处理状态
  isProcessing: Readonly<Ref<boolean>>
  currentToolName: Readonly<Ref<string>>
  currentSkillName: Readonly<Ref<string>>
  currentAgentType: Readonly<Ref<string>>
  currentToolDuration: Readonly<Ref<number>>
  streamingText: Readonly<Ref<string>>

  // 工具活动
  currentToolActivity: Readonly<Ref<ToolActivity | null>>
  toolActivityHistory: Readonly<Ref<ToolActivity[]>>

  // 待办事项
  todoItems: Readonly<Ref<TodoItem[]>>
  subagentTodos: Readonly<Ref<TodoItem[]>>
  todoStats: Readonly<Ref<{
    completed: number
    inProgress: number
    pending: number
    total: number
  }>>

  // 推理状态
  reasoningPhase: Readonly<Ref<ReasoningPhase>>
  reasoningSummary: Readonly<Ref<string>>

  // 输出生成
  aiOutputGenerating: Readonly<Ref<boolean>>
  aiOutputProgress: Readonly<Ref<OutputProgress>>

  // 指标
  tokenUsage: Readonly<Ref<TokenUsage>>
  elapsedSeconds: Readonly<Ref<number>>

  // 运行跟踪
  currentRunSeq: Readonly<Ref<number | undefined>>
  totalAgentRuns: Readonly<Ref<number | undefined>>

  // 目标叙述
  goalNarrative: Readonly<Ref<GoalNarrative>>

  // 计算辅助属性
  hasActiveTodo: ComputedRef<boolean>
  isAnyToolRunning: ComputedRef<boolean>
  currentActivity: ComputedRef<string>
}
```

#### 示例

```vue
<script setup lang="ts">
import { useAgentState } from '@kedge-agentic/vue-sdk'

const {
  isProcessing,
  currentToolName,
  todoItems,
  todoStats,
  hasActiveTodo,
  currentActivity
} = useAgentState()
</script>

<template>
  <div class="agent-panel">
    <div v-if="isProcessing" class="status">
      <span class="tool">{{ currentToolName }}</span>
      <span class="activity">{{ currentActivity }}</span>
    </div>

    <div class="stats">
      <span>已完成: {{ todoStats.completed }}</span>
      <span>进行中: {{ todoStats.inProgress }}</span>
      <span>待处理: {{ todoStats.pending }}</span>
    </div>

    <ul class="todos">
      <li v-for="todo in todoItems" :key="todo.id || todo.content">
        <span :class="todo.status">{{ todo.content }}</span>
      </li>
    </ul>
  </div>
</template>
```

---

### useAgentChat

响应式 Socket.io 连接管理,用于 Agent 通信。

#### 函数签名

```typescript
function useAgentChat(options?: UseAgentChatOptions): UseAgentChatReturn
```

#### 选项

```typescript
interface UseAgentChatOptions extends AgentConnectionConfig {
  connection?: AgentConnection  // 自定义连接实例
  autoConnect?: boolean         // 挂载时自动连接 (默认: true)
}

interface AgentConnectionConfig {
  serverUrl?: string            // 后端 URL (默认: window.location.origin)
  apiKey?: string              // API 密钥
  tenantId?: string            // 租户 ID
  debug?: boolean              // 启用调试日志
}
```

#### 返回类型

```typescript
interface UseAgentChatReturn {
  // 连接状态
  isConnected: ComputedRef<boolean>
  connectionStatus: Readonly<Ref<ConnectionState>>
  sessionId: Readonly<Ref<string | null>>
  clientId: Readonly<Ref<string | null>>

  // 待处理结果状态
  hasPendingResult: Readonly<Ref<boolean>>
  pendingResultTruncated: Readonly<Ref<boolean>>
  pendingResultContext: Readonly<Ref<PendingResultContext | null>>

  // 方法
  sendMessage: (message: string, options?: SendMessageOptions) => Promise<SendMessageResult>
  cancel: () => void
  reconnectSession: (sessionId: string) => Promise<SendMessageResult>
  applyPendingResult: () => OutputUpdateEvent[]
  notifyNavigatedAway: () => void
  markContextForPending: (context: PageContext) => void

  // 事件订阅
  on: <T = unknown>(event: string, handler: (data: T) => void) => () => void
  off: <T = unknown>(event: string, handler: (data: T) => void) => void

  // 连接管理
  connect: (config?: AgentConnectionConfig) => void
  disconnect: () => void
  reconnect: () => void
}
```

#### 示例

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { useAgentChat } from '@kedge-agentic/vue-sdk'

const message = ref('')
const messages = ref<string[]>([])

const {
  isConnected,
  sessionId,
  sendMessage,
  cancel,
  on
} = useAgentChat({
  serverUrl: 'http://localhost:3001',
  tenantId: 'my-tenant',
  debug: true
})

// 订阅事件
on('text_delta', (data) => {
  messages.value.push(data.text)
})

on('complete', () => {
  console.log('Agent 完成')
})

async function handleSend() {
  if (!message.value.trim()) return

  await sendMessage(message.value, {
    context: {
      route: '/lesson-plan',
      pageType: 'lesson-plan',
      entityId: '123'
    }
  })

  message.value = ''
}
</script>

<template>
  <div class="chat">
    <div class="status">
      <span v-if="isConnected" class="connected">已连接</span>
      <span v-else class="disconnected">未连接</span>
      <span v-if="sessionId">会话: {{ sessionId }}</span>
    </div>

    <div class="messages">
      <div v-for="(msg, i) in messages" :key="i">{{ msg }}</div>
    </div>

    <div class="input">
      <input v-model="message" @keyup.enter="handleSend" />
      <button @click="handleSend" :disabled="!isConnected">发送</button>
      <button @click="cancel" :disabled="!isConnected">取消</button>
    </div>
  </div>
</template>
```

---

### useFormBridge

向 Agent 注册表单以实现双向数据同步。

#### 函数签名

```typescript
function useFormBridge(options: UseFormBridgeOptions): UseFormBridgeReturn
```

#### 选项

```typescript
interface UseFormBridgeOptions {
  formId: string                                                  // 唯一表单标识符
  readonly?: boolean                                              // 表单是否只读
  getFormState: () => Record<string, unknown>                     // 获取当前表单状态
  applyFormData: (data: Record<string, unknown>) => Promise<ApplyResult>  // 应用数据到表单
  submit?: () => Promise<SubmitResult>                           // 可选提交处理器
  getDataShape?: () => FormDataShape                             // 可选 schema 提供器
}

interface ApplyResult {
  success: boolean
  appliedFields?: string[]
  errors?: Record<string, string>
}

interface SubmitResult {
  success: boolean
  errors?: Record<string, string>
}

interface FormDataShape {
  fields: Array<{
    name: string
    type: string
    required?: boolean
    description?: string
  }>
}
```

#### 返回类型

```typescript
interface UseFormBridgeReturn {
  isActive: Readonly<Ref<boolean>>    // 该表单当前是否活动/已注册
  formId: string                      // 表单 ID
  register: () => void                // 手动注册表单
  unregister: () => void              // 手动注销表单
}
```

#### 示例

```vue
<script setup lang="ts">
import { reactive } from 'vue'
import { useFormBridge } from '@kedge-agentic/vue-sdk'

const form = reactive({
  title: '',
  subject: '',
  gradeLevel: '',
  objectives: []
})

const { isActive } = useFormBridge({
  formId: 'lesson-plan-form',
  readonly: false,

  getFormState: () => ({
    title: form.title,
    subject: form.subject,
    gradeLevel: form.gradeLevel,
    objectives: form.objectives
  }),

  applyFormData: async (data) => {
    try {
      Object.assign(form, data)
      return {
        success: true,
        appliedFields: Object.keys(data)
      }
    } catch (error) {
      return {
        success: false,
        errors: { _general: error.message }
      }
    }
  },

  submit: async () => {
    try {
      await api.saveLessonPlan(form)
      return { success: true }
    } catch (error) {
      return {
        success: false,
        errors: { _general: error.message }
      }
    }
  },

  getDataShape: () => ({
    fields: [
      { name: 'title', type: 'string', required: true },
      { name: 'subject', type: 'string', required: true },
      { name: 'gradeLevel', type: 'string', required: false },
      { name: 'objectives', type: 'array', required: false }
    ]
  })
})
</script>

<template>
  <form :class="{ active: isActive }">
    <input v-model="form.title" placeholder="标题" />
    <input v-model="form.subject" placeholder="学科" />
    <input v-model="form.gradeLevel" placeholder="年级" />
  </form>
</template>
```

---

### useAIEditing

管理基于分段内容生成的 AI 编辑模式,带有进度跟踪。

#### 函数签名

```typescript
function useAIEditing<T extends string>(options: UseAIEditingOptions<T>): UseAIEditingReturn<T>
```

#### 选项

```typescript
interface UseAIEditingOptions<T extends string> {
  allSections: readonly T[]                               // 所有可以 AI 编辑的分段 ID
  onSectionUpdate?: (sectionId: T, content: unknown) => void  // 分段更新时的回调
  onComplete?: () => void                                 // 所有分段完成时的回调
  onCancel?: () => void                                   // 编辑取消时的回调
}
```

#### 返回类型

```typescript
interface UseAIEditingReturn<T extends string> {
  // 状态
  aiEditingMode: Readonly<Ref<boolean>>         // AI 编辑模式是否活动
  aiCurrentSection: Readonly<Ref<T | null>>     // 当前活动分段
  aiCompletedSections: Readonly<Ref<Set<T>>>    // 已完成的分段
  aiPendingSections: Readonly<Ref<Set<T>>>      // 计划生成的分段
  progress: ComputedRef<number>                 // 进度百分比 (0-100)

  // 方法
  startAIEditing: (sections?: T[]) => void      // 启动指定分段的 AI 编辑
  updateFromAI: (sectionId: T, content: unknown) => void  // 从 AI 更新分段
  completeAISection: (sectionId: T) => void     // 标记分段为完成
  finishAIEditing: () => void                   // 结束 AI 编辑模式
  cancelAIEditing: () => void                   // 取消 AI 编辑并丢弃
  isAIEditing: (sectionId: T) => boolean        // 检查分段是否正在编辑
  isAICompleted: (sectionId: T) => boolean      // 检查分段是否已完成
  isAIPending: (sectionId: T) => boolean        // 检查分段是否待处理
  resetAIState: () => void                      // 重置所有 AI 编辑状态
}
```

#### 示例

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { useAIEditing } from '@kedge-agentic/vue-sdk'

const sectionIds = ['objectives', 'activities', 'assessment'] as const
type SectionId = typeof sectionIds[number]

const sections = ref<Record<SectionId, string>>({
  objectives: '',
  activities: '',
  assessment: ''
})

const {
  aiEditingMode,
  aiCurrentSection,
  progress,
  startAIEditing,
  updateFromAI,
  completeAISection,
  finishAIEditing,
  isAIEditing,
  isAICompleted
} = useAIEditing({
  allSections: sectionIds,

  onSectionUpdate: (id, content) => {
    sections.value[id] = content as string
  },

  onComplete: () => {
    console.log('所有分段生成完成!')
  }
})

function handleGenerate() {
  startAIEditing(['objectives', 'activities'])
}
</script>

<template>
  <div class="editor">
    <div v-if="aiEditingMode" class="progress">
      <span>生成中... {{ progress }}%</span>
      <span v-if="aiCurrentSection">当前: {{ aiCurrentSection }}</span>
    </div>

    <div
      v-for="section in sectionIds"
      :key="section"
      :class="{
        editing: isAIEditing(section),
        completed: isAICompleted(section)
      }"
    >
      <h3>{{ section }}</h3>
      <textarea v-model="sections[section]" />
    </div>

    <button @click="handleGenerate" :disabled="aiEditingMode">
      使用 AI 生成
    </button>
    <button v-if="aiEditingMode" @click="finishAIEditing">
      完成
    </button>
  </div>
</template>
```

---

### usePlanMode

处理人机协作工作流中的计划提案。

#### 函数签名

```typescript
function usePlanMode(): UsePlanModeReturn
```

#### 返回类型

```typescript
interface UsePlanModeReturn {
  pendingProposal: Readonly<Ref<PlanProposal | null>> | null  // 当前待处理提案
  hasPendingProposal: ComputedRef<boolean>                    // 是否有待处理提案
  plannedSections: ComputedRef<PlanProposalSection[]>         // 计划生成的分段
  confirm: () => void                                         // 确认待处理提案
  reject: () => void                                          // 拒绝待处理提案
}

interface PlanProposal {
  traceId: string
  sections: PlanProposalSection[]
  context: PlanProposalContext
}

interface PlanProposalSection {
  id: string
  name: string
  description?: string
}
```

#### 示例

```vue
<script setup lang="ts">
import { usePlanMode } from '@kedge-agentic/vue-sdk'

const {
  pendingProposal,
  hasPendingProposal,
  plannedSections,
  confirm,
  reject
} = usePlanMode()
</script>

<template>
  <div v-if="hasPendingProposal" class="plan-dialog">
    <h3>AI 生成计划</h3>
    <p>AI 将生成以下分段:</p>
    <ul>
      <li v-for="section in plannedSections" :key="section.id">
        <strong>{{ section.name }}</strong>
        <span v-if="section.description">: {{ section.description }}</span>
      </li>
    </ul>
    <div class="actions">
      <button @click="confirm" class="primary">
        确认计划
      </button>
      <button @click="reject" class="secondary">
        拒绝
      </button>
    </div>
  </div>
</template>
```

---

### useTodoProgress

跟踪待办事项/任务进度,带有计算统计。

#### 函数签名

```typescript
function useTodoProgress(): UseTodoProgressReturn
```

#### 返回类型

```typescript
interface UseTodoProgressReturn {
  todoItems: Readonly<Ref<TodoItem[]>>        // 主 Agent 待办事项
  subagentTodos: Readonly<Ref<TodoItem[]>>    // 子 Agent 待办事项
  stats: Readonly<Ref<{                       // 待办统计
    completed: number
    inProgress: number
    pending: number
    total: number
  }>>
  progress: ComputedRef<number>               // 进度百分比 (0-100)
  hasTodos: ComputedRef<boolean>              // 是否有待办事项
  isComplete: ComputedRef<boolean>            // 所有待办是否完成
  currentTodo: ComputedRef<TodoItem | undefined>  // 当前活动待办
  completedTodos: ComputedRef<TodoItem[]>     // 已完成待办
  pendingTodos: ComputedRef<TodoItem[]>       // 待处理待办
}

interface TodoItem {
  id?: string
  content: string
  status: 'pending' | 'in_progress' | 'completed'
  activeForm?: string
}
```

#### 示例

```vue
<script setup lang="ts">
import { useTodoProgress } from '@kedge-agentic/vue-sdk'

const {
  todoItems,
  stats,
  progress,
  currentTodo,
  isComplete,
  completedTodos,
  pendingTodos
} = useTodoProgress()
</script>

<template>
  <div class="progress-panel">
    <div class="progress-bar">
      <div class="fill" :style="{ width: progress + '%' }"></div>
      <span>{{ progress }}%</span>
    </div>

    <div class="stats">
      <div class="stat">
        <span class="label">已完成</span>
        <span class="value">{{ stats.completed }}</span>
      </div>
      <div class="stat">
        <span class="label">进行中</span>
        <span class="value">{{ stats.inProgress }}</span>
      </div>
      <div class="stat">
        <span class="label">待处理</span>
        <span class="value">{{ stats.pending }}</span>
      </div>
    </div>

    <div v-if="currentTodo" class="current-task">
      <h4>当前任务</h4>
      <p>{{ currentTodo.content }}</p>
      <span v-if="currentTodo.activeForm">表单: {{ currentTodo.activeForm }}</span>
    </div>

    <div v-if="isComplete" class="completion">
      ✓ 所有任务已完成!
    </div>
  </div>
</template>
```

---

### useToolActivity

跟踪工具执行活动,包含历史记录和决策逻辑。

#### 函数签名

```typescript
function useToolActivity(): UseToolActivityReturn
```

#### 返回类型

```typescript
interface UseToolActivityReturn {
  current: Readonly<Ref<ToolActivity | null>>       // 当前工具活动
  history: Readonly<Ref<ToolActivity[]>>            // 工具活动历史
  toolName: Readonly<Ref<string>>                   // 当前工具名称
  duration: Readonly<Ref<number>>                   // 当前工具持续时间(ms)
  isRunning: ComputedRef<boolean>                   // 工具是否正在运行
  lastSucceeded: ComputedRef<boolean | null>        // 最后一个工具是否成功
  decisionLogic: ComputedRef<{                      // 当前决策逻辑
    why: string
    benefit: string
    nextStep?: string
  } | null>
  recentActivities: (count?: number) => ToolActivity[]  // 获取最近活动
  getById: (toolId: string) => ToolActivity | undefined // 通过 ID 获取活动
}

interface ToolActivity {
  toolName: string
  toolId: string
  phase: 'start' | 'progress' | 'end'
  description: string
  agentType?: string
  duration?: number
  success?: boolean
  decisionLogic?: {
    why: string
    benefit: string
    nextStep?: string
  }
}
```

#### 示例

```vue
<script setup lang="ts">
import { useToolActivity } from '@kedge-agentic/vue-sdk'

const {
  current,
  isRunning,
  decisionLogic,
  recentActivities
} = useToolActivity()
</script>

<template>
  <div class="tool-activity">
    <div v-if="isRunning" class="current">
      <h4>当前工具: {{ current?.toolName }}</h4>
      <p>{{ current?.description }}</p>

      <div v-if="decisionLogic" class="decision">
        <p><strong>为什么:</strong> {{ decisionLogic.why }}</p>
        <p><strong>收益:</strong> {{ decisionLogic.benefit }}</p>
        <p v-if="decisionLogic.nextStep">
          <strong>下一步:</strong> {{ decisionLogic.nextStep }}
        </p>
      </div>
    </div>

    <div class="history">
      <h4>最近活动</h4>
      <ul>
        <li v-for="activity in recentActivities(5)" :key="activity.toolId">
          <span class="tool">{{ activity.toolName }}</span>
          <span class="desc">{{ activity.description }}</span>
          <span v-if="activity.duration" class="duration">
            {{ activity.duration }}ms
          </span>
        </li>
      </ul>
    </div>
  </div>
</template>
```

---

### useThinking

访问 Agent 思考/推理状态,用于扩展思考事件。

#### 函数签名

```typescript
function useThinking(): UseThinkingReturn
```

#### 返回类型

```typescript
interface UseThinkingReturn {
  isThinking: Readonly<Ref<boolean>>           // Agent 是否正在思考
  thinkingContent: Readonly<Ref<string>>       // 当前思考内容(流式)
  thinkingHistory: Readonly<Ref<string[]>>     // 思考块历史
  thinkingId: Readonly<Ref<string>>            // 当前思考块 ID
  hasThinking: ComputedRef<boolean>            // 是否有思考内容
  thinkingLength: ComputedRef<number>          // 当前思考内容长度
  thinkingPreview: ComputedRef<string>         // 截断预览(前 200 字符)
}
```

#### 示例

```vue
<script setup lang="ts">
import { useThinking } from '@kedge-agentic/vue-sdk'

const {
  isThinking,
  thinkingContent,
  thinkingPreview,
  thinkingHistory
} = useThinking()
</script>

<template>
  <div class="thinking-panel">
    <div v-if="isThinking" class="thinking-indicator">
      <span class="icon">🧠</span>
      <span class="label">Claude 正在思考...</span>
      <p v-if="thinkingContent" class="preview">{{ thinkingPreview }}</p>
    </div>

    <details v-if="thinkingHistory.length > 0">
      <summary>思考历史 ({{ thinkingHistory.length }} 个块)</summary>
      <div v-for="(block, i) in thinkingHistory" :key="i" class="thinking-block">
        <pre>{{ block }}</pre>
      </div>
    </details>
  </div>
</template>
```

---

### useTokenUsage

跟踪实时 token 使用指标和成本。

#### 函数签名

```typescript
function useTokenUsage(): UseTokenUsageReturn
```

#### 返回类型

```typescript
interface UseTokenUsageReturn {
  tokenUsage: Readonly<Ref<TokenUsage>>                  // 当前请求 token 使用
  sessionTokens: Readonly<Ref<SessionTokens>>            // 会话累计 token
  currentModel: Readonly<Ref<string>>                    // 当前使用的模型
  estimatedCost: Readonly<Ref<number>>                   // 估计成本(美元)
  totalTokens: ComputedRef<number>                       // 总 token(当前请求)
  sessionTotalTokens: ComputedRef<number>                // 会话总 token
  formattedTotalTokens: ComputedRef<string>              // 格式化计数(如 "1.2K")
  formattedSessionTokens: ComputedRef<string>            // 格式化会话 token
  formattedCost: ComputedRef<string>                     // 格式化成本(如 "$0.12")
  hasUsage: ComputedRef<boolean>                         // 是否有 token 使用
  cacheHitRate: ComputedRef<number>                      // 缓存命中率百分比
}

interface TokenUsage {
  input: number
  output: number
  total: number
}

interface SessionTokens {
  input: number
  output: number
  cached: number
  reasoning: number
  total: number
}
```

#### 示例

```vue
<script setup lang="ts">
import { useTokenUsage } from '@kedge-agentic/vue-sdk'

const {
  tokenUsage,
  sessionTokens,
  currentModel,
  formattedTotalTokens,
  formattedCost,
  cacheHitRate
} = useTokenUsage()
</script>

<template>
  <div class="token-usage">
    <div class="model">模型: {{ currentModel }}</div>

    <div class="current-request">
      <h4>当前请求</h4>
      <div class="stat">
        <span>输入:</span>
        <span>{{ tokenUsage.input }}</span>
      </div>
      <div class="stat">
        <span>输出:</span>
        <span>{{ tokenUsage.output }}</span>
      </div>
      <div class="stat total">
        <span>总计:</span>
        <span>{{ formattedTotalTokens }}</span>
      </div>
    </div>

    <div class="session">
      <h4>会话总计</h4>
      <div class="stat">
        <span>输入:</span>
        <span>{{ sessionTokens.input.toLocaleString() }}</span>
      </div>
      <div class="stat">
        <span>输出:</span>
        <span>{{ sessionTokens.output.toLocaleString() }}</span>
      </div>
      <div class="stat">
        <span>缓存:</span>
        <span>{{ sessionTokens.cached.toLocaleString() }}</span>
      </div>
      <div class="stat">
        <span>推理:</span>
        <span>{{ sessionTokens.reasoning.toLocaleString() }}</span>
      </div>
      <div class="stat">
        <span>缓存命中率:</span>
        <span>{{ cacheHitRate }}%</span>
      </div>
    </div>

    <div class="cost">
      <span>估计成本:</span>
      <span class="amount">{{ formattedCost }}</span>
    </div>
  </div>
</template>
```

---

### useExploration

跟踪来自探索/规划子 Agent 的探索活动。

#### 函数签名

```typescript
function useExploration(): UseExplorationReturn
```

#### 返回类型

```typescript
interface UseExplorationReturn {
  exploration: Readonly<Ref<ExplorationActivity | null>>     // 当前探索活动
  explorationHistory: Readonly<Ref<ExplorationHistoryEntry[]>>  // 探索历史
  isExploring: ComputedRef<boolean>                          // 是否正在探索
  actionIcon: ComputedRef<string>                            // 当前操作图标
  actionLabel: ComputedRef<string>                           // 当前操作标签
  totalResultCount: ComputedRef<number>                      // 找到的文件/匹配总数
  explorationCount: ComputedRef<number>                      // 探索操作数量
}

interface ExplorationActivity {
  action: 'search' | 'read' | 'glob' | 'grep' | 'analyze'
  target: string
  phase: 'start' | 'progress' | 'complete'
  agentType: string
  resultCount?: number
  resultSummary?: string
}
```

#### 示例

```vue
<script setup lang="ts">
import { useExploration } from '@kedge-agentic/vue-sdk'

const {
  exploration,
  isExploring,
  actionIcon,
  actionLabel,
  totalResultCount,
  explorationHistory
} = useExploration()
</script>

<template>
  <div class="exploration">
    <div v-if="isExploring" class="current">
      <span class="icon">{{ actionIcon }}</span>
      <span class="action">{{ actionLabel }}</span>
      <span class="target">{{ exploration?.target }}</span>
      <span v-if="exploration?.resultSummary" class="result">
        {{ exploration.resultSummary }}
      </span>
    </div>

    <div class="summary">
      <span>总结果数: {{ totalResultCount }}</span>
      <span>探索次数: {{ explorationHistory.length }}</span>
    </div>

    <details v-if="explorationHistory.length > 0">
      <summary>探索历史</summary>
      <ul>
        <li v-for="(entry, i) in explorationHistory" :key="i">
          <strong>{{ entry.action }}</strong>: {{ entry.target }}
          <span v-if="entry.resultCount">({{ entry.resultCount }} 个结果)</span>
        </li>
      </ul>
    </details>
  </div>
</template>
```

---

### useSkills

管理技能(获取、搜索、切换启用/禁用)。

#### 函数签名

```typescript
function useSkills(options: UseSkillsOptions): UseSkillsReturn
```

#### 选项

```typescript
interface UseSkillsOptions {
  serverUrl?: string    // 后端 URL
  tenantId: string      // 租户 ID
}
```

#### 返回类型

```typescript
interface UseSkillsReturn {
  skills: Ref<Skill[]>                          // 所有技能
  loading: Ref<boolean>                         // 加载状态
  error: Ref<string | null>                     // 错误消息
  searchQuery: Ref<string>                      // 搜索查询
  filteredSkills: ComputedRef<Skill[]>          // 基于搜索过滤的技能
  toggleSkill: (skillId: string) => Promise<void>  // 切换技能启用/禁用
  enabledSkillIds: ComputedRef<Set<string>>     // 已启用技能 ID 集合
  isSkillEnabled: (skillId: string) => boolean  // 检查技能是否启用
  refresh: () => Promise<void>                  // 刷新技能列表
}
```

#### 示例

```vue
<script setup lang="ts">
import { useSkills } from '@kedge-agentic/vue-sdk'

const {
  filteredSkills,
  loading,
  error,
  searchQuery,
  toggleSkill,
  isSkillEnabled
} = useSkills({
  serverUrl: 'http://localhost:3001',
  tenantId: 'my-tenant'
})
</script>

<template>
  <div class="skills-manager">
    <input
      v-model="searchQuery"
      placeholder="搜索技能..."
      class="search"
    />

    <div v-if="loading">加载技能中...</div>
    <div v-if="error" class="error">{{ error }}</div>

    <ul class="skills-list">
      <li v-for="skill in filteredSkills" :key="skill.id">
        <div class="info">
          <strong>{{ skill.name }}</strong>
          <p v-if="skill.description">{{ skill.description }}</p>
        </div>
        <button @click="toggleSkill(skill.id)">
          {{ isSkillEnabled(skill.id) ? '禁用' : '启用' }}
        </button>
      </li>
    </ul>
  </div>
</template>
```

---

### useOutputSync

通用输出同步,支持手动或自动同步模式。

#### 函数签名

```typescript
function useOutputSync<T extends Record<string, unknown>>(
  options: UseOutputSyncOptions
): UseOutputSyncReturn<T>
```

#### 选项

```typescript
interface UseOutputSyncOptions {
  mode: 'manual' | 'auto'                                      // 同步模式
  normalizeField?: (field: string, value: unknown) => unknown  // 字段标准化函数
  undoTimeout?: number                                         // 撤销超时时间(ms,默认: 30000)
}
```

#### 返回类型

```typescript
interface UseOutputSyncReturn<T extends Record<string, unknown>> {
  pendingUpdates: Ref<Map<string, OutputUpdate>>         // 来自 AI 的待处理更新
  modifiedFields: Ref<Set<string>>                       // AI 修改的字段集合
  handleOutputUpdate: (update: OutputUpdate) => void     // 处理传入的输出更新
  syncToForm: (field: string, formData: Ref<T>) => void  // 同步单个字段
  syncAllToForm: (formData: Ref<T>) => void             // 同步所有待处理更新
  discardUpdate: (field: string) => void                 // 丢弃待处理更新
  undoSync: (field: string, formData: Ref<T>) => void   // 撤销已同步字段
  canUndo: (field: string) => boolean                    // 检查是否可撤销
  reset: () => void                                      // 重置所有状态
}

interface OutputUpdate {
  field: string
  value: unknown
  synced?: boolean
  syncedAt?: Date
}
```

#### 示例

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { useOutputSync } from '@kedge-agentic/vue-sdk'

const formData = ref({
  title: '',
  content: '',
  tags: []
})

const {
  pendingUpdates,
  modifiedFields,
  handleOutputUpdate,
  syncToForm,
  syncAllToForm,
  discardUpdate,
  canUndo,
  undoSync
} = useOutputSync({
  mode: 'manual',
  normalizeField: (field, value) => {
    // 自定义标准化逻辑
    if (field === 'tags' && typeof value === 'string') {
      return value.split(',').map(t => t.trim())
    }
    return value
  }
})

// 订阅 output_update 事件
socket.on('output_update', (event) => {
  handleOutputUpdate({
    field: event.field,
    value: event.content
  })
})
</script>

<template>
  <div class="form-editor">
    <div v-if="pendingUpdates.size > 0" class="pending-updates">
      <h4>待处理 AI 更新</h4>
      <div v-for="[field, update] of pendingUpdates" :key="field">
        <strong>{{ field }}</strong>
        <button @click="syncToForm(field, formData)">应用</button>
        <button @click="discardUpdate(field)">丢弃</button>
      </div>
      <button @click="syncAllToForm(formData)">应用全部</button>
    </div>

    <div v-for="field in modifiedFields" :key="field" class="modified">
      <span>{{ field }} 已被 AI 修改</span>
      <button v-if="canUndo(field)" @click="undoSync(field, formData)">
        撤销
      </button>
    </div>

    <input v-model="formData.title" placeholder="标题" />
    <textarea v-model="formData.content" placeholder="内容" />
  </div>
</template>
```

---

### useLessonPlanSync

针对教案实体的专用同步,带有字段验证。

#### 函数签名

```typescript
function useLessonPlanSync(options: UseLessonPlanSyncOptions): UseLessonPlanSyncReturn
```

#### 选项

```typescript
interface UseLessonPlanSyncOptions {
  initialPlan: LessonPlan                                                    // 初始教案数据
  onApply?: (field: LessonPlanSyncField, value: unknown) => Promise<void>   // 更新应用时的回调
  onPendingUpdate?: (field: LessonPlanSyncField, value: unknown) => void    // 收到待处理更新时的回调
  undoTimeout?: number                                                       // 撤销超时时间(ms,默认: 30000)
}
```

#### 返回类型

```typescript
interface UseLessonPlanSyncReturn {
  lessonPlan: Ref<LessonPlan>                                        // 当前教案状态
  pendingUpdates: Ref<Partial<Record<LessonPlanSyncField, unknown>>>  // 待处理更新
  hasPendingUpdates: ComputedRef<boolean>                            // 是否有待处理更新
  modifiedFields: Ref<Set<LessonPlanSyncField>>                      // AI 修改的字段
  handleOutputUpdate: (field: LessonPlanSyncField, value: unknown) => void  // 处理输出更新
  applyUpdate: (field: LessonPlanSyncField) => Promise<void>         // 应用单个更新
  applyAllUpdates: () => Promise<void>                               // 应用所有更新
  discardUpdate: (field: LessonPlanSyncField) => void                // 丢弃单个更新
  discardAllUpdates: () => void                                      // 丢弃所有更新
  undoUpdate: (field: LessonPlanSyncField) => void                   // 撤销更新
  canUndo: ComputedRef<(field: LessonPlanSyncField) => boolean>      // 检查是否可撤销
  resetLessonPlan: (newPlan: LessonPlan) => void                     // 重置为新教案
  getPendingUpdateForField: (field: LessonPlanSyncField) => unknown | undefined  // 获取待处理更新
  isFieldModified: (field: LessonPlanSyncField) => boolean           // 检查字段是否已修改
}

type LessonPlanSyncField =
  | 'title'
  | 'subject'
  | 'gradeLevel'
  | 'duration'
  | 'objectives'
  | 'standards'
  | 'materials'
  | 'activities'
  | 'assessment'
  | 'differentiation'
```

#### 示例

```vue
<script setup lang="ts">
import { useLessonPlanSync } from '@kedge-agentic/vue-sdk'

const {
  lessonPlan,
  pendingUpdates,
  hasPendingUpdates,
  modifiedFields,
  handleOutputUpdate,
  applyUpdate,
  applyAllUpdates,
  discardUpdate,
  canUndo,
  undoUpdate
} = useLessonPlanSync({
  initialPlan: {
    id: '123',
    title: '',
    subject: '',
    objectives: [],
    // ...
  },
  onApply: async (field, value) => {
    await api.updateLessonPlanField(lessonPlan.value.id, field, value)
  }
})

// 订阅 output_update
socket.on('output_update', (event) => {
  handleOutputUpdate(event.field, event.value)
})
</script>

<template>
  <div class="lesson-plan-editor">
    <div v-if="hasPendingUpdates" class="pending-banner">
      <span>{{ Object.keys(pendingUpdates).length }} 个待处理更新</span>
      <button @click="applyAllUpdates">应用全部</button>
    </div>

    <div class="field" v-for="field in ['title', 'subject', 'objectives']" :key="field">
      <label>{{ field }}</label>

      <div v-if="pendingUpdates[field]" class="pending-indicator">
        AI 建议: {{ pendingUpdates[field] }}
        <button @click="applyUpdate(field)">应用</button>
        <button @click="discardUpdate(field)">丢弃</button>
      </div>

      <div v-if="modifiedFields.has(field)" class="modified-indicator">
        已被 AI 修改
        <button v-if="canUndo(field)" @click="undoUpdate(field)">撤销</button>
      </div>

      <input v-model="lessonPlan[field]" />
    </div>
  </div>
</template>
```

---

### useEntityBridge

实体无关的 AI 输出与实体存储之间的桥接,带有自动订阅。

#### 函数签名

```typescript
function useEntityBridge(config: EntityBridgeConfig): UseEntityBridgeReturn
```

#### 选项

```typescript
interface EntityBridgeConfig {
  chat?: UseAgentChatReturn                                  // 自定义聊天实例
  sections: string[]                                         // 分段 ID
  fieldMapping: Record<string, string>                       // 后端字段 -> 前端分段映射
  updateSection: (sectionId: string, content: unknown) => void  // 更新分段回调
  saveToBackend: () => Promise<void>                         // 保存回调
  onStart?: () => void                                       // 开始回调
  onComplete?: () => void                                    // 完成回调
  onError?: (error: Error) => void                           // 错误回调
  debug?: boolean                                            // 启用调试日志
}
```

#### 返回类型

```typescript
interface UseEntityBridgeReturn {
  chat: UseAgentChatReturn                                   // 暴露的聊天实例
  aiEditingMode: Readonly<Ref<boolean>>                      // AI 编辑模式活动
  currentSection: Readonly<Ref<string | null>>               // 当前正在编辑的分段
  sectionStates: Readonly<Ref<Record<string, SectionState>>> // 分段状态
  progress: ComputedRef<number>                              // 进度百分比
  isDirty: Readonly<Ref<boolean>>                            // 是否有未保存更改
  isSaving: Readonly<Ref<boolean>>                           // 是否正在保存
  startAIEditing: () => void                                 // 启动 AI 编辑模式
  stopAIEditing: () => void                                  // 停止 AI 编辑模式
  handleOutputUpdate: (event: EntityOutputUpdateEvent) => void  // 处理输出更新
  saveAll: () => Promise<void>                               // 保存所有更改
  discardAll: () => void                                     // 丢弃所有更改
  isSectionEditing: (sectionId: string) => boolean           // 检查分段是否编辑中
  isSectionCompleted: (sectionId: string) => boolean         // 检查分段是否完成
  reset: () => void                                          // 重置所有状态
}

interface SectionState {
  status: 'idle' | 'pending' | 'streaming' | 'completed' | 'error'
  error?: string
  lastUpdatedAt?: Date
}
```

#### 示例

```vue
<script setup lang="ts">
import { reactive } from 'vue'
import { useEntityBridge } from '@kedge-agentic/vue-sdk'

const draft = reactive({
  textbookAnalysis: '',
  studentAnalysis: '',
  learningObjectives: ''
})

const {
  aiEditingMode,
  currentSection,
  progress,
  isDirty,
  isSaving,
  saveAll,
  discardAll,
  isSectionEditing,
  isSectionCompleted
} = useEntityBridge({
  sections: ['textbookAnalysis', 'studentAnalysis', 'learningObjectives'],

  fieldMapping: {
    textbook_analysis: 'textbookAnalysis',
    student_analysis: 'studentAnalysis',
    learning_objectives: 'learningObjectives'
  },

  updateSection: (id, content) => {
    draft[id] = content as string
  },

  saveToBackend: async () => {
    await api.update('123', draft)
  },

  onComplete: () => {
    console.log('所有分段完成!')
  },

  debug: true
})
</script>

<template>
  <div class="entity-editor">
    <div v-if="aiEditingMode" class="ai-banner">
      <span>AI 编辑中: {{ progress }}%</span>
      <span v-if="currentSection">当前: {{ currentSection }}</span>
    </div>

    <div
      v-for="section in ['textbookAnalysis', 'studentAnalysis', 'learningObjectives']"
      :key="section"
      :class="{
        editing: isSectionEditing(section),
        completed: isSectionCompleted(section)
      }"
    >
      <h3>{{ section }}</h3>
      <textarea v-model="draft[section]" />
    </div>

    <div class="actions">
      <button @click="saveAll" :disabled="!isDirty || isSaving">
        {{ isSaving ? '保存中...' : '保存' }}
      </button>
      <button @click="discardAll" :disabled="!isDirty">
        丢弃更改
      </button>
    </div>
  </div>
</template>
```

---

## 服务

### FormStateSynchronizer

用于 Vue 响应式状态与外部更新之间表单状态同步的集中式服务。

#### 方法

```typescript
class FormStateSynchronizer {
  // 注册
  registerForm(formId: string, reactiveState: Record<string, unknown>): void
  unregisterForm(formId: string): void
  hasForm(formId: string): boolean

  // 更新
  updateField(formId: string, field: string, value: unknown, source: FormUpdateSource): boolean
  updateFields(formId: string, updates: Record<string, unknown>, source: FormUpdateSource): boolean

  // 状态访问
  getFormState(formId: string): Record<string, unknown> | null
  getFormStateCopy(formId: string): Record<string, unknown> | null

  // 事件订阅
  onFormUpdated(handler: EventHandler<FormUpdateEvent>): () => void
  onFormUpdatedFor(formId: string, handler: EventHandler<FormUpdateEvent>): () => void

  // 调试
  debug(): Array<{ formId: string; fields: string[] }>
  clear(): void
}

type FormUpdateSource = 'user' | 'agent' | 'a2ui' | 'api'

interface FormUpdateEvent {
  formId: string
  field: string
  value: unknown
  oldValue: unknown
  source: FormUpdateSource
  timestamp: number
}
```

#### 用法

```typescript
import { getFormStateSynchronizer } from '@kedge-agentic/vue-sdk'

const sync = getFormStateSynchronizer()

// 在组件中
const formState = reactive({ title: '', content: '' })
onMounted(() => sync.registerForm('my-form', formState))
onUnmounted(() => sync.unregisterForm('my-form'))

// 从外部来源
sync.updateFields('my-form', { title: '新标题' }, 'agent')

// 订阅更新
const unsubscribe = sync.onFormUpdated((event) => {
  console.log(`${event.formId}.${event.field} 从 ${event.source} 更新`)
})
```

---

### AgentConnection

用于 Agent 通信的单例 Socket.io 连接管理器。

#### 方法

```typescript
class AgentConnection {
  // 连接管理
  connect(config?: AgentConnectionConfig): void
  disconnect(): void
  reconnect(): void

  // 状态
  get isConnected(): boolean
  get sessionId(): string | null
  get clientId(): string | null
  get status(): ConnectionState

  // 消息
  sendMessage(message: string, options?: SendMessageOptions): Promise<SendMessageResult>
  cancel(): void

  // 待处理结果
  get hasPendingResult(): boolean
  get pendingResultTruncated(): boolean
  get pendingResultContext(): PendingResultContext | null
  applyPendingResult(): OutputUpdateEvent[]
  notifyNavigatedAway(): void
  markContextForPending(context: PageContext): void

  // 事件订阅
  on<T = unknown>(event: string, handler: (data: T) => void): () => void
  off<T = unknown>(event: string, handler: (data: T) => void): void
}

// 获取单例实例
import { agentConnection } from '@kedge-agentic/vue-sdk'

// 或创建自定义实例
import { createAgentConnection } from '@kedge-agentic/vue-sdk'
const connection = createAgentConnection()
```

---

## 类型定义

### 核心类型

```typescript
// 连接
interface ConnectionState {
  status: 'disconnected' | 'connecting' | 'connected' | 'reconnecting'
  error?: string
  reconnectAttempts: number
}

interface PageContext {
  route: string
  pageType: string
  entityId?: string
  entityType?: string
  editMode?: boolean
  selectedFields?: string[]
  dirtyFields?: string[]
  currentData?: Record<string, unknown>
}

// Agent 状态
interface TodoItem {
  id?: string
  content: string
  status: 'pending' | 'in_progress' | 'completed'
  activeForm?: string
}

interface ToolActivity {
  toolName: string
  toolId: string
  phase: 'start' | 'progress' | 'end'
  description: string
  agentType?: string
  duration?: number
  success?: boolean
  decisionLogic?: {
    why: string
    benefit: string
    nextStep?: string
  }
}

interface OutputProgress {
  totalSteps: number
  completedSteps: number
  percentage: number
}

interface TokenUsage {
  input: number
  output: number
  total: number
}

interface GoalNarrative {
  title: string
  subject: string
  chapter: string
  edition: string
}

type ReasoningPhase = '' | 'analyzing' | 'planning' | 'executing'

// 计划提案
interface PlanProposal {
  traceId: string
  sections: PlanProposalSection[]
  context: PlanProposalContext
}

interface PlanProposalSection {
  id: string
  name: string
  description?: string
}
```

### 事件类型

```typescript
// 输出更新事件
interface OutputUpdateEvent {
  field: string
  content?: unknown
  data?: unknown
  isFinal?: boolean
  timestamp?: string
}

// Agent 状态事件
interface AgentStatusEvent {
  status: 'idle' | 'processing' | 'waiting'
  toolName?: string
  skillName?: string
  agentType?: string
}

// 待办更新事件
interface TodoUpdateEvent {
  todos: TodoItem[]
  subagentTodos?: TodoItem[]
}

// 工具活动事件
interface ToolActivityEvent {
  toolName: string
  toolId: string
  phase: 'start' | 'progress' | 'end'
  description: string
  agentType?: string
  duration?: number
  success?: boolean
  decisionLogic?: {
    why: string
    benefit: string
    nextStep?: string
  }
}
```

---

## 注入符号

所有注入符号都是类型化的,可导出用于 Vue 的 `inject()`:

```typescript
import { inject } from 'vue'
import {
  // 连接
  AgentClientIdKey,
  AgentSessionIdKey,
  AgentConnectedKey,

  // 处理
  IsAgentProcessingKey,
  CurrentToolNameKey,
  CurrentSkillNameKey,
  CurrentAgentTypeKey,
  CurrentToolDurationKey,
  StreamingTextKey,

  // 工具活动
  CurrentToolActivityKey,
  ToolActivityHistoryKey,

  // 待办
  TodoItemsKey,
  SubagentTodosKey,
  TodoStatsKey,

  // 推理
  ReasoningPhaseKey,
  ReasoningSummaryKey,

  // 输出生成
  AiOutputGeneratingKey,
  AiOutputProgressKey,

  // 指标
  TokenUsageKey,
  ElapsedSecondsKey,

  // 运行跟踪
  CurrentRunSeqKey,
  TotalAgentRunsKey,

  // 目标叙述
  GoalNarrativeKey,

  // 计划模式
  PendingPlanProposalKey,
  ConfirmPlanProposalKey,
  RejectPlanProposalKey,

  // 表单桥接
  RegisterAgentFormKey,
  UnregisterAgentFormKey,
  ActiveFormIdKey,

  // 思考
  IsThinkingKey,
  ThinkingContentKey,
  ThinkingHistoryKey,
  ThinkingIdKey,

  // Token 使用
  SessionTokensKey,
  CurrentModelKey,
  EstimatedCostKey,

  // 探索
  ExplorationActivityKey,
  ExplorationHistoryKey,
} from '@kedge-agentic/vue-sdk'

// 使用
const isProcessing = inject(IsAgentProcessingKey)
const todoItems = inject(TodoItemsKey)
```

---

## 最佳实践

### 1. 使用组合式函数而非直接注入

**推荐:**
```typescript
const { todoItems, stats, progress } = useTodoProgress()
```

**不推荐:**
```typescript
const todoItems = inject(TodoItemsKey)
const stats = inject(TodoStatsKey)
// 手动计算进度
```

**原因:** 组合式函数提供计算辅助属性并封装逻辑。

### 2. 仅解构你需要的内容

```typescript
// 好 - 只导入你使用的
const { isProcessing, currentToolName } = useAgentState()

// 避免 - 导入所有内容
const agentState = useAgentState()
```

**原因:** 更好的 tree-shaking 和更清晰的依赖关系。

### 3. 正确处理异步操作

```typescript
async function handleApply() {
  try {
    await applyUpdate('objectives')
    toast.success('应用成功')
  } catch (error) {
    toast.error(`失败: ${error.message}`)
  }
}
```

**原因:** 正确的错误处理改善用户体验。

### 4. 清理订阅

```typescript
onMounted(() => {
  const unsubscribe = chat.on('text_delta', handler)

  onUnmounted(() => {
    unsubscribe()
  })
})
```

**原因:** 防止内存泄漏。

### 5. 使用 TypeScript 获得类型安全

```typescript
const sectionIds = ['intro', 'body', 'conclusion'] as const
type SectionId = typeof sectionIds[number]

const { aiEditingMode } = useAIEditing<SectionId>({
  allSections: sectionIds,
  // TypeScript 确保 sectionId 类型正确
  onSectionUpdate: (sectionId, content) => {
    sections.value[sectionId] = content as string
  }
})
```

**原因:** 在编译时捕获错误,更好的 IDE 支持。

### 6. 提供用户反馈

```typescript
const {
  aiEditingMode,
  progress,
  currentSection
} = useAIEditing({
  allSections: sections,
  onSectionUpdate: (id, content) => {
    form[id] = content
    toast.info(`更新了 ${id}`)
  },
  onComplete: () => {
    toast.success('所有分段生成完成!')
  }
})
```

**原因:** 用户知道发生了什么。

### 7. 防抖昂贵操作

```typescript
import { debounce } from 'lodash-es'

const debouncedSync = debounce((field) => {
  syncToForm(field, formData)
}, 300)
```

**原因:** 提高频繁更新的性能。

### 8. 使用模拟连接测试

```typescript
import { createAgentConnection } from '@kedge-agentic/vue-sdk'

const mockConnection = createAgentConnection()
const { isConnected } = useAgentChat({ connection: mockConnection })
```

**原因:** 更容易进行单元测试。

---

## 迁移指南

### 从直接注入迁移

**之前:**
```typescript
const isProcessing = inject(IsAgentProcessingKey)
const todoItems = inject(TodoItemsKey)
const stats = computed(() => {
  // 手动计算
})
```

**之后:**
```typescript
const { todoItems, stats, progress } = useTodoProgress()
```

### 从手动表单注册迁移

**之前:**
```typescript
const registerForm = inject(RegisterAgentFormKey)
onMounted(() => registerForm('my-form', handlers))
onUnmounted(() => unregisterForm('my-form'))
```

**之后:**
```typescript
const { isActive } = useFormBridge({
  formId: 'my-form',
  ...handlers
})
// 生命周期自动处理
```

---

## 许可证

MIT
