<script setup lang="ts">
/**
 * LessonPlanChat Component
 *
 * Chat panel for AI-assisted lesson planning with sync buttons.
 */
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import {
  Card,
  Input,
  Button,
  Space,
  Typography,
  Spin,
  Alert,
  Divider,
} from 'ant-design-vue'
import {
  SendOutlined,
  RobotOutlined,
  UserOutlined,
  BulbOutlined,
} from '@ant-design/icons-vue'
import SyncButton from './SyncButton.vue'
import type { LessonPlanSyncField } from '@ccaas/shared'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  pendingUpdates?: Map<LessonPlanSyncField, unknown>
  appliedFields?: Set<LessonPlanSyncField>
}

const props = defineProps<{
  pendingUpdates: Partial<Record<LessonPlanSyncField, unknown>>
  canUndo: (field: LessonPlanSyncField) => boolean
}>()

const emit = defineEmits<{
  (e: 'send', message: string): void
  (e: 'applyUpdate', field: LessonPlanSyncField): void
  (e: 'undoUpdate', field: LessonPlanSyncField): void
  (e: 'discardUpdate', field: LessonPlanSyncField): void
}>()

// State
const messages = ref<ChatMessage[]>([])
const inputMessage = ref('')
const loading = ref(false)
const messagesContainer = ref<HTMLElement | null>(null)

// Field labels
const fieldLabels: Record<LessonPlanSyncField, string> = {
  title: '课程标题',
  subject: '学科',
  gradeLevel: '年级',
  duration: '课时',
  objectives: '教学目标',
  standards: '课程标准',
  materials: '教学材料',
  activities: '教学活动',
  assessment: '评估方式',
  differentiation: '差异化教学',
}

// Quick prompts
const quickPrompts = [
  '帮我设计教学目标',
  '建议课堂活动',
  '如何进行差异化教学',
  '设计评估方式',
]

// Send message
function sendMessage() {
  if (!inputMessage.value.trim() || loading.value) return

  const userMessage: ChatMessage = {
    id: crypto.randomUUID(),
    role: 'user',
    content: inputMessage.value.trim(),
    timestamp: new Date(),
  }

  messages.value.push(userMessage)
  emit('send', inputMessage.value.trim())
  inputMessage.value = ''
  loading.value = true

  scrollToBottom()
}

// Add AI response
function addAIResponse(content: string, pendingUpdates?: Map<LessonPlanSyncField, unknown>) {
  const aiMessage: ChatMessage = {
    id: crypto.randomUUID(),
    role: 'assistant',
    content,
    timestamp: new Date(),
    pendingUpdates,
    appliedFields: new Set(),
  }

  messages.value.push(aiMessage)
  loading.value = false

  nextTick(() => scrollToBottom())
}

// Mark field as applied in message
function markFieldApplied(messageId: string, field: LessonPlanSyncField) {
  const message = messages.value.find((m) => m.id === messageId)
  if (message) {
    message.appliedFields = message.appliedFields || new Set()
    message.appliedFields.add(field)
  }
}

// Scroll to bottom
function scrollToBottom() {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
}

// Handle quick prompt click
function handleQuickPrompt(prompt: string) {
  inputMessage.value = prompt
  sendMessage()
}

// Get pending updates for display
const pendingFields = computed(() =>
  Object.entries(props.pendingUpdates)
    .filter(([_, value]) => value !== undefined)
    .map(([field, value]) => ({
      field: field as LessonPlanSyncField,
      value,
      label: fieldLabels[field as LessonPlanSyncField] || field,
    }))
)

// Watch for new pending updates (simulated AI response)
watch(
  () => props.pendingUpdates,
  (newUpdates) => {
    const keys = Object.keys(newUpdates)
    if (keys.length > 0 && loading.value) {
      const pendingMap = new Map<LessonPlanSyncField, unknown>()
      for (const [k, v] of Object.entries(newUpdates)) {
        pendingMap.set(k as LessonPlanSyncField, v)
      }

      addAIResponse('我已经为您生成了以下内容，点击"同步"按钮可以将其应用到表单中。', pendingMap)
    }
  },
  { deep: true }
)

// Expose methods for parent
defineExpose({
  addAIResponse,
  markFieldApplied,
})
</script>

<template>
  <Card class="chat-panel" :body-style="{ padding: 0, display: 'flex', flexDirection: 'column', height: '100%' }">
    <template #title>
      <Space>
        <RobotOutlined />
        <span>AI备课助手</span>
      </Space>
    </template>

    <!-- Messages area -->
    <div ref="messagesContainer" class="messages-container">
      <!-- Empty state -->
      <div v-if="messages.length === 0" class="empty-state">
        <BulbOutlined class="empty-icon" />
        <Typography.Title :level="5">开始AI辅助备课</Typography.Title>
        <Typography.Text type="secondary">
          输入您的需求，AI将帮助您设计课程内容
        </Typography.Text>
        <Divider>快捷提示</Divider>
        <Space wrap>
          <Button
            v-for="prompt in quickPrompts"
            :key="prompt"
            size="small"
            @click="handleQuickPrompt(prompt)"
          >
            {{ prompt }}
          </Button>
        </Space>
      </div>

      <!-- Messages -->
      <div v-for="msg in messages" :key="msg.id" class="message" :class="msg.role">
        <div class="message-avatar">
          <UserOutlined v-if="msg.role === 'user'" />
          <RobotOutlined v-else />
        </div>
        <div class="message-content">
          <Typography.Text>{{ msg.content }}</Typography.Text>

          <!-- Sync buttons for AI messages with pending updates -->
          <div v-if="msg.role === 'assistant' && msg.pendingUpdates" class="sync-buttons">
            <template v-for="[field, value] in msg.pendingUpdates" :key="field">
              <SyncButton
                :field="field"
                :field-label="fieldLabels[field] || field"
                :pending-value="value"
                :can-undo="canUndo(field)"
                :is-applied="msg.appliedFields?.has(field)"
                @apply="emit('applyUpdate', field); markFieldApplied(msg.id, field)"
                @undo="emit('undoUpdate', field)"
              />
            </template>
          </div>
        </div>
      </div>

      <!-- Loading indicator -->
      <div v-if="loading" class="message assistant">
        <div class="message-avatar">
          <RobotOutlined />
        </div>
        <div class="message-content">
          <Spin size="small" />
          <Typography.Text type="secondary" style="margin-left: 8px">
            AI正在思考...
          </Typography.Text>
        </div>
      </div>
    </div>

    <!-- Pending updates alert -->
    <Alert
      v-if="pendingFields.length > 0"
      type="info"
      show-icon
      class="pending-alert"
    >
      <template #message>
        有 {{ pendingFields.length }} 个字段待同步
      </template>
    </Alert>

    <!-- Input area -->
    <div class="input-area">
      <Input.TextArea
        v-model:value="inputMessage"
        placeholder="输入您的需求，如：帮我设计一节三年级数学课..."
        :rows="2"
        :disabled="loading"
        @press-enter="(e: KeyboardEvent) => { if (!e.shiftKey) { e.preventDefault(); sendMessage() } }"
      />
      <Button
        type="primary"
        :disabled="!inputMessage.trim() || loading"
        @click="sendMessage"
      >
        <template #icon><SendOutlined /></template>
        发送
      </Button>
    </div>
  </Card>
</template>

<style scoped>
.chat-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  background: #fafafa;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  text-align: center;
  padding: 24px;
}

.empty-icon {
  font-size: 48px;
  color: #1890ff;
  margin-bottom: 16px;
}

.message {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.message.user {
  flex-direction: row-reverse;
}

.message-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #1890ff;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.message.user .message-avatar {
  background: #52c41a;
}

.message-content {
  max-width: 70%;
  padding: 12px 16px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.message.user .message-content {
  background: #1890ff;
  color: #fff;
}

.sync-buttons {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.pending-alert {
  margin: 0 16px 8px;
}

.input-area {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid #f0f0f0;
  background: #fff;
}

.input-area :deep(.ant-input) {
  flex: 1;
}
</style>
