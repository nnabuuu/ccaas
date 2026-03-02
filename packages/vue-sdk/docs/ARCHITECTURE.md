# @kedge-agentic/vue-sdk 架构文档

## 概述

`@kedge-agentic/vue-sdk` 是一个基于 Vue 3 Composition API 的 SDK，用于与 Claude-Code-as-a-Service 后端服务集成。该 SDK 采用 **Composables 优先** 的设计理念，提供可复用的状态管理和交互模式。

## 设计理念

### 为什么选择 Composables 而非 Vue Plugin？

| 方案 | 优点 | 缺点 |
|------|------|------|
| **Composables (采用)** | 渐进式采用、易于测试、类型安全、Tree-shaking 友好 | 需要手动导入 |
| Vue Plugin | 全局注册、使用便捷 | 增加抽象层、难以 Tree-shake |

**决策**：AgentListener.vue 已经是一个成熟的解决方案（1,941行），Vue Plugin 会增加不必要的抽象。Composables 允许渐进式采用，更易于测试和维护。

## 架构图

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        @kedge-agentic/vue-sdk                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                        COMPOSABLES 层                               │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │ │
│  │  │useAgentState │  │ useFormBridge│  │    useAIEditing          │  │ │
│  │  │ • 集中状态   │  │ • 表单注册   │  │ • AI编辑模式管理         │  │ │
│  │  │ • 注入访问   │  │ • 数据同步   │  │ • 分段进度跟踪           │  │ │
│  │  └──────────────┘  └──────────────┘  └──────────────────────────┘  │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │ │
│  │  │ usePlanMode  │  │useTodoProgress│ │   useToolActivity        │  │ │
│  │  │ • 计划提案   │  │ • 任务进度   │  │ • 工具执行跟踪           │  │ │
│  │  │ • 确认/拒绝  │  │ • 统计计算   │  │ • 历史记录               │  │ │
│  │  └──────────────┘  └──────────────┘  └──────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                    │                                     │
│  ┌────────────────────────────────▼────────────────────────────────────┐│
│  │                        SERVICES 层                                  ││
│  │  ┌─────────────────────────────────────────────────────────────┐   ││
│  │  │              FormStateSynchronizer (单例)                    │   ││
│  │  │  • 表单状态注册/注销                                         │   ││
│  │  │  • 字段级别更新                                              │   ││
│  │  │  • 事件发布/订阅                                             │   ││
│  │  └─────────────────────────────────────────────────────────────┘   ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                    │                                     │
│  ┌────────────────────────────────▼────────────────────────────────────┐│
│  │                        TYPES & SYMBOLS 层                           ││
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  ││
│  │  │ Connection Types │  │  Agent State     │  │ Injection Keys   │  ││
│  │  │ • ConnectionState│  │ • TodoItem       │  │ • 40+ 类型安全   │  ││
│  │  │ • PageContext    │  │ • ToolActivity   │  │   注入符号       │  ││
│  │  └──────────────────┘  └──────────────────┘  └──────────────────┘  ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    @kedge-agentic/shared                        │
│                    (共享协议定义)                                        │
└─────────────────────────────────────────────────────────────────────────┘
```

## 核心组件详解

### 1. useAIEditing - AI 编辑模式管理

**用途**：管理 AI 生成内容时的分段编辑状态，支持进度跟踪和回调。

```typescript
// 使用示例
const sectionIds = ['intro', 'body', 'conclusion'] as const

const {
  aiEditingMode,        // 是否处于AI编辑模式
  aiCurrentSection,     // 当前正在编辑的分段
  aiCompletedSections,  // 已完成的分段集合
  aiPendingSections,    // 待处理的分段集合
  progress,             // 进度百分比 (0-100)
  startAIEditing,       // 开始AI编辑
  updateFromAI,         // 从AI更新分段内容
  completeAISection,    // 标记分段完成
  finishAIEditing,      // 结束AI编辑
  cancelAIEditing,      // 取消AI编辑
} = useAIEditing({
  allSections: sectionIds,
  onSectionUpdate: (id, content) => {
    // 更新对应分段的内容
    form[id] = content
  },
  onComplete: () => {
    // 所有分段完成时的回调
    toast.success('AI生成完成')
  }
})
```

**状态流转图**：

```
  startAIEditing()
        │
        ▼
┌───────────────────┐
│   aiEditingMode   │◄──────────────────┐
│      = true       │                   │
│                   │                   │
│ aiCurrentSection  │                   │
│   = sections[0]   │                   │
│                   │                   │
│ aiPendingSections │                   │
│   = all sections  │                   │
└───────────────────┘                   │
        │                               │
        │ updateFromAI(id, content)     │
        ▼                               │
┌───────────────────┐                   │
│ onSectionUpdate() │                   │
│    callback       │                   │
└───────────────────┘                   │
        │                               │
        │ completeAISection(id)         │
        ▼                               │
┌───────────────────┐                   │
│ Remove from       │                   │
│ pending, add to   │───► 还有待处理? ──┘
│ completed         │         │
└───────────────────┘         │ No
                              ▼
                    ┌───────────────────┐
                    │  onComplete()     │
                    │    callback       │
                    └───────────────────┘
```

### 2. FormStateSynchronizer - 表单状态同步服务

**用途**：桥接 Vue 响应式系统与外部表单更新，提供集中式的表单状态管理。

```typescript
// 服务端点
const sync = getFormStateSynchronizer()

// 注册表单
sync.registerForm('lesson-plan-form', reactiveFormState)

// 从Agent更新字段
sync.updateFields('lesson-plan-form', {
  title: '新标题',
  objectives: ['目标1', '目标2']
}, 'agent')

// 订阅更新事件
const unsubscribe = sync.onFormUpdated((event) => {
  console.log(`${event.formId}.${event.field} 已更新`)
  // 可用于高亮显示变更的字段
})
```

### 3. useFormBridge - 表单桥接 Composable

**用途**：简化组件与 Agent 的表单交互，自动处理注册/注销生命周期。

```typescript
// 在组件中使用
const form = reactive({ title: '', content: '' })

const { isActive } = useFormBridge({
  formId: 'my-form',
  readonly: false,
  getFormState: () => ({ ...form }),
  applyFormData: async (data) => {
    Object.assign(form, data)
    return { success: true, appliedFields: Object.keys(data) }
  },
  submit: async () => {
    await saveForm()
    return { success: true }
  }
})

// isActive 指示该表单是否为当前活动表单
```

### 4. 注入符号 (Injection Symbols)

SDK 导出 40+ 类型安全的注入符号，用于 Vue 的 provide/inject 模式：

```typescript
// 连接状态
AgentClientIdKey      // 客户端ID
AgentSessionIdKey     // 会话ID
AgentConnectedKey     // 连接状态

// 处理状态
IsAgentProcessingKey  // 是否正在处理
CurrentToolNameKey    // 当前工具名称
CurrentSkillNameKey   // 当前技能名称

// Todo 跟踪
TodoItemsKey          // Todo 列表
SubagentTodosKey      // 子Agent Todo
TodoStatsKey          // Todo 统计

// 计划模式
PendingPlanProposalKey   // 待处理计划提案
ConfirmPlanProposalKey   // 确认函数
RejectPlanProposalKey    // 拒绝函数

// 输出生成
AiOutputGeneratingKey    // 是否正在生成
AiOutputProgressKey      // 生成进度

// 表单桥接
RegisterAgentFormKey     // 注册表单函数
UnregisterAgentFormKey   // 注销表单函数
ActiveFormIdKey          // 当前活动表单ID
```

## 类型系统

### 核心类型定义

```typescript
// 连接状态
interface ConnectionState {
  status: 'disconnected' | 'connecting' | 'connected' | 'reconnecting'
  error?: string
  reconnectAttempts: number
}

// Todo 项
interface TodoItem {
  id?: string
  content: string
  status: 'pending' | 'in_progress' | 'completed'
  activeForm?: string
}

// 工具活动
interface ToolActivity {
  toolName: string
  toolId: string
  phase: 'start' | 'end'
  description: string
  agentType?: string
  duration?: number
  success?: boolean
}

// 计划提案
interface PlanProposal {
  traceId: string
  sections: PlanProposalSection[]
  context: PlanProposalContext
}
```

## 与后端集成

### SSE 事件映射

| 后端事件 | SDK 处理 | 更新的状态 |
|----------|----------|-----------|
| `agent_status` | AgentListener | `isProcessing`, `currentToolName` |
| `tool_activity` | AgentListener | `toolActivityHistory` |
| `todo_update` | AgentListener | `todoItems`, `todoStats` |
| `output_update` | AgentListener | 触发 `onSectionUpdate` |
| `plan_proposal` | AgentListener | `pendingPlanProposal` |

### 页面上下文同步

```typescript
interface PageContext {
  route: string           // 当前路由
  pageType: string        // 页面类型
  entityId?: string       // 实体ID
  entityType?: string     // 实体类型
  editMode?: boolean      // 编辑模式
  selectedFields?: string[]  // 选中字段
  dirtyFields?: string[]     // 脏字段
  currentData?: Record<string, unknown>  // 当前数据
}
```

## 测试覆盖

### 测试统计

| 测试文件 | 测试数量 | 覆盖内容 |
|----------|----------|----------|
| `useAIEditing.spec.ts` | 21 | 状态转换、进度计算、回调触发 |
| `FormStateSynchronizer.spec.ts` | 18 | 注册/注销、字段更新、事件发布 |
| `useTodoProgress.spec.ts` | 11 | 统计计算、进度、过滤器 |
| `exports.spec.ts` | 14 | 导出完整性验证 |
| **总计** | **64** | |

### 关键测试场景

1. **AI编辑生命周期**
   - 开始编辑时设置首个分段为当前
   - 完成分段后自动推进到下一个
   - 所有分段完成时触发 onComplete
   - 取消编辑时清理所有状态

2. **表单同步**
   - 字段更新触发事件
   - 事件包含新旧值用于差异显示
   - 处理器错误不影响其他处理器

## 构建产物

```
dist/
├── index.js      (20.04 KB) - ESM 模块
├── index.cjs     (22.57 KB) - CommonJS 模块
├── index.d.ts    (32.98 KB) - TypeScript 声明
└── index.d.cts   (32.98 KB) - CTS 声明
```

## 使用示例

### 基础集成

```vue
<!-- App.vue -->
<template>
  <AgentListener>
    <RouterView />
  </AgentListener>
</template>
```

### 在组件中消费状态

```vue
<script setup lang="ts">
import { useAgentState, useTodoProgress } from '@kedge-agentic/vue-sdk'

const { isProcessing, currentToolName } = useAgentState()
const { progress, currentTodo, isComplete } = useTodoProgress()
</script>

<template>
  <div v-if="isProcessing" class="agent-status">
    <span>正在执行: {{ currentToolName }}</span>
    <ProgressBar :value="progress" />
    <span v-if="currentTodo">{{ currentTodo.content }}</span>
  </div>
  <div v-if="isComplete" class="success">
    所有任务已完成!
  </div>
</template>
```

### 在 Pinia Store 中使用 AI 编辑

```typescript
// stores/lessonPlanStore.ts
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useAIEditing } from '@kedge-agentic/vue-sdk'

export const useLessonPlanStore = defineStore('lessonPlan', () => {
  const sections = ref({
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
    finishAIEditing
  } = useAIEditing({
    allSections: ['objectives', 'activities', 'assessment'],
    onSectionUpdate: (id, content) => {
      sections.value[id] = content as string
    }
  })

  return {
    sections,
    aiEditingMode,
    aiCurrentSection,
    progress,
    startAIEditing,
    updateFromAI,
    completeAISection,
    finishAIEditing
  }
})
```

## 迁移指南

### 从直接 inject 迁移到 Composables

**之前**:
```typescript
const isProcessing = inject(IsAgentProcessingKey)
const todoItems = inject(TodoItemsKey)
const stats = computed(() => /* 手动计算统计 */)
```

**之后**:
```typescript
const { todoItems, stats, progress, currentTodo } = useTodoProgress()
```

### 从手动表单注册迁移

**之前**:
```typescript
const registerForm = inject(RegisterAgentFormKey)
const unregisterForm = inject(UnregisterAgentFormKey)

onMounted(() => registerForm('my-form', handlers))
onUnmounted(() => unregisterForm('my-form'))
```

**之后**:
```typescript
const { isActive } = useFormBridge({
  formId: 'my-form',
  ...handlers
})
// 自动处理生命周期
```

## 版本兼容性

| 依赖 | 最低版本 |
|------|----------|
| Vue | 3.3.0+ |
| @kedge-agentic/common | 0.2.0+ |
| TypeScript | 5.0.0+ |

## 许可证

MIT
