<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { sessionsApi } from '@/api/admin'
import type { SessionDetail, SessionTimeline, SessionTimelineEvent } from '@/types/admin'
import { message, Modal } from 'ant-design-vue'
import dayjs from 'dayjs'
import {
  ArrowLeftOutlined,
  StopOutlined,
  ReloadOutlined,
  MessageOutlined,
  ToolOutlined,
  BulbOutlined,
  WarningOutlined,
  ThunderboltOutlined
} from '@ant-design/icons-vue'

const route = useRoute()
const router = useRouter()

const loading = ref(true)
const killing = ref(false)
const session = ref<SessionDetail | null>(null)
const timeline = ref<SessionTimeline | null>(null)

const sessionId = computed(() => route.params.sessionId as string)

onMounted(() => {
  loadSession()
})

async function loadSession() {
  loading.value = true
  try {
    const [sessionData, timelineData] = await Promise.all([
      sessionsApi.getDetail(sessionId.value),
      sessionsApi.getTimeline(sessionId.value)
    ])
    session.value = sessionData
    timeline.value = timelineData
  } catch (error) {
    message.error('Failed to load session')
    console.error(error)
  } finally {
    loading.value = false
  }
}

async function killSession() {
  Modal.confirm({
    title: 'Kill Session',
    content: 'Are you sure you want to terminate this session? This will stop any running CLI process.',
    okText: 'Kill',
    okType: 'danger',
    async onOk() {
      killing.value = true
      try {
        const result = await sessionsApi.kill(sessionId.value)
        if (result.success) {
          message.success('Session terminated')
          loadSession()
        } else {
          message.warning(result.message)
        }
      } catch (error) {
        message.error('Failed to kill session')
      } finally {
        killing.value = false
      }
    }
  })
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'processing': return 'blue'
    case 'idle': return 'default'
    case 'error': return 'red'
    default: return 'default'
  }
}

function getEventIcon(type: string) {
  switch (type) {
    case 'message': return MessageOutlined
    case 'tool_event': return ToolOutlined
    case 'thinking_block': return BulbOutlined
    case 'api_error': return WarningOutlined
    case 'process_event': return ThunderboltOutlined
    default: return MessageOutlined
  }
}

function getEventColor(type: string): string {
  switch (type) {
    case 'message': return '#1890ff'
    case 'tool_event': return '#52c41a'
    case 'thinking_block': return '#faad14'
    case 'api_error': return '#ff4d4f'
    case 'process_event': return '#722ed1'
    default: return '#666'
  }
}

function formatEventData(event: SessionTimelineEvent): string {
  const data = event.data as Record<string, unknown>

  switch (event.type) {
    case 'message':
      return `[${data.role}] ${(data.content as string || '').substring(0, 200)}...`
    case 'tool_event':
      return `${data.toolName} (${data.phase}) ${data.durationMs ? `- ${data.durationMs}ms` : ''}`
    case 'thinking_block':
      return `${data.thinkingType}: ${(data.content as string || '').substring(0, 100)}...`
    case 'api_error':
      return `${data.errorType}: ${data.errorMessage}`
    case 'process_event':
      return `${data.eventType} (PID: ${data.pid})`
    default:
      return JSON.stringify(data).substring(0, 100)
  }
}
</script>

<template>
  <div class="session-detail">
    <div class="page-header">
      <div class="header-left">
        <a-button type="text" @click="router.back()">
          <ArrowLeftOutlined />
        </a-button>
        <div>
          <h1>Session Detail</h1>
          <code>{{ sessionId }}</code>
        </div>
      </div>
      <div class="header-actions">
        <a-button @click="loadSession" :loading="loading">
          <ReloadOutlined />
          Refresh
        </a-button>
        <a-button
          danger
          @click="killSession"
          :loading="killing"
          :disabled="!session?.hasActiveProcess"
        >
          <StopOutlined />
          Kill Session
        </a-button>
      </div>
    </div>

    <a-spin :spinning="loading">
      <!-- Session Info -->
      <div class="card" style="margin-bottom: 24px;" v-if="session">
        <div class="card-header">
          <h3>Session Info</h3>
          <a-tag :color="getStatusColor(session.status)">
            {{ session.status }}
          </a-tag>
        </div>
        <div class="card-body">
          <a-descriptions :column="2" bordered size="small">
            <a-descriptions-item label="Session ID">
              <code>{{ session.sessionId }}</code>
            </a-descriptions-item>
            <a-descriptions-item label="Client ID">
              {{ session.clientId }}
            </a-descriptions-item>
            <a-descriptions-item label="Messages">
              {{ session.messageCount }}
            </a-descriptions-item>
            <a-descriptions-item label="CLI Process">
              <a-tag :color="session.hasActiveProcess ? 'green' : 'default'">
                {{ session.hasActiveProcess ? 'Active' : 'Inactive' }}
              </a-tag>
            </a-descriptions-item>
            <a-descriptions-item label="Created">
              {{ dayjs(session.createdAt).format('YYYY-MM-DD HH:mm:ss') }}
            </a-descriptions-item>
            <a-descriptions-item label="Last Activity">
              {{ dayjs(session.lastActivity).format('YYYY-MM-DD HH:mm:ss') }}
            </a-descriptions-item>
            <a-descriptions-item label="Workspace" :span="2">
              <code>{{ session.workspaceDir }}</code>
            </a-descriptions-item>
          </a-descriptions>
        </div>
      </div>

      <!-- Timeline -->
      <div class="card" v-if="timeline">
        <div class="card-header">
          <h3>Timeline</h3>
          <span class="event-count">{{ timeline.totalEvents }} events</span>
        </div>
        <div class="timeline-container">
          <div
            v-for="event in timeline.events"
            :key="event.id"
            class="timeline-event"
            :class="event.type"
          >
            <div class="event-header">
              <div class="event-type">
                <component :is="getEventIcon(event.type)" :style="{ color: getEventColor(event.type) }" />
                <span>{{ event.type.replace('_', ' ') }}</span>
              </div>
              <span class="event-time">
                {{ dayjs(event.timestamp).format('HH:mm:ss.SSS') }}
              </span>
            </div>
            <div class="event-content">
              {{ formatEventData(event) }}
            </div>
          </div>

          <div v-if="timeline.events.length === 0" class="empty-state">
            <MessageOutlined />
            <p>No events yet</p>
          </div>
        </div>
      </div>
    </a-spin>
  </div>
</template>

<style scoped>
.session-detail {
  max-width: 1200px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.header-left h1 {
  font-size: 24px;
  font-weight: 600;
  margin: 0;
}

.header-left code {
  font-size: 12px;
  color: #666;
  margin-top: 4px;
  display: block;
}

.header-actions {
  display: flex;
  gap: 12px;
}

.card {
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.card-header {
  padding: 16px 24px;
  border-bottom: 1px solid #f0f0f0;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.card-header h3 {
  font-size: 16px;
  font-weight: 600;
  margin: 0;
}

.card-body {
  padding: 24px;
}

.event-count {
  color: #666;
  font-size: 14px;
}

.timeline-container {
  max-height: 600px;
  overflow-y: auto;
  padding: 16px 24px;
}

.timeline-event {
  padding: 12px 16px;
  border-left: 3px solid #d9d9d9;
  margin-bottom: 12px;
  background: #fafafa;
  border-radius: 0 4px 4px 0;
}

.timeline-event.message {
  border-left-color: #1890ff;
}

.timeline-event.tool_event {
  border-left-color: #52c41a;
}

.timeline-event.thinking_block {
  border-left-color: #faad14;
}

.timeline-event.api_error {
  border-left-color: #ff4d4f;
}

.timeline-event.process_event {
  border-left-color: #722ed1;
}

.event-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.event-type {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
  text-transform: capitalize;
}

.event-time {
  color: #999;
  font-size: 12px;
  font-family: monospace;
}

.event-content {
  font-size: 13px;
  line-height: 1.6;
  color: #333;
  white-space: pre-wrap;
  word-break: break-word;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px;
  color: #999;
}

.empty-state :deep(.anticon) {
  font-size: 48px;
  margin-bottom: 16px;
}
</style>
