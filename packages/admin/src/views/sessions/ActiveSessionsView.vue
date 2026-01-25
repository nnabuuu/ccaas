<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { sessionsApi } from '@/api/admin'
import type { SessionListItem } from '@/types/admin'
import { message } from 'ant-design-vue'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { ReloadOutlined, ArrowLeftOutlined } from '@ant-design/icons-vue'

dayjs.extend(relativeTime)

const loading = ref(true)
const sessions = ref<SessionListItem[]>([])
let refreshInterval: number | null = null

onMounted(() => {
  loadActiveSessions()
  // Auto-refresh every 5 seconds
  refreshInterval = setInterval(loadActiveSessions, 5000) as unknown as number
})

onUnmounted(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval)
  }
})

async function loadActiveSessions() {
  try {
    sessions.value = await sessionsApi.getActive()
  } catch (error) {
    message.error('Failed to load active sessions')
    console.error(error)
  } finally {
    loading.value = false
  }
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'processing': return 'blue'
    case 'idle': return 'default'
    case 'error': return 'red'
    default: return 'default'
  }
}
</script>

<template>
  <div class="active-sessions">
    <div class="page-header">
      <div class="header-left">
        <router-link to="/sessions">
          <a-button type="text">
            <ArrowLeftOutlined />
          </a-button>
        </router-link>
        <div>
          <h1>Active Sessions</h1>
          <p>Real-time view of currently active sessions (auto-refreshes every 5s)</p>
        </div>
      </div>
      <div class="header-actions">
        <a-button @click="loadActiveSessions" :loading="loading">
          <ReloadOutlined />
          Refresh
        </a-button>
      </div>
    </div>

    <div class="sessions-grid" v-if="sessions.length > 0">
      <div
        v-for="session in sessions"
        :key="session.sessionId"
        class="session-card"
      >
        <div class="session-header">
          <a-tag :color="getStatusColor(session.status)">
            {{ session.status }}
          </a-tag>
          <span class="session-time">
            {{ dayjs(session.lastActivity).fromNow() }}
          </span>
        </div>
        <div class="session-id">
          <code>{{ session.sessionId.substring(0, 16) }}...</code>
        </div>
        <div class="session-stats">
          <div class="stat">
            <span class="stat-value">{{ session.messageCount }}</span>
            <span class="stat-label">Messages</span>
          </div>
          <div class="stat">
            <span class="stat-value">
              <a-badge :status="session.hasActiveProcess ? 'processing' : 'default'" />
            </span>
            <span class="stat-label">CLI</span>
          </div>
        </div>
        <div class="session-actions">
          <router-link :to="`/sessions/${session.sessionId}`">
            <a-button type="primary" size="small" block>View Details</a-button>
          </router-link>
        </div>
      </div>
    </div>

    <div v-else class="empty-state">
      <div class="card">
        <div class="card-body" style="text-align: center; padding: 48px;">
          <p style="font-size: 48px; margin-bottom: 16px;">🎉</p>
          <h3>No Active Sessions</h3>
          <p style="color: #666;">All sessions are currently idle or closed</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.active-sessions {
  max-width: 1400px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
}

.header-left {
  display: flex;
  align-items: flex-start;
  gap: 16px;
}

.header-left h1 {
  font-size: 24px;
  font-weight: 600;
  margin: 0;
}

.header-left p {
  color: #666;
  margin-top: 8px;
}

.header-actions {
  display: flex;
  gap: 12px;
}

.sessions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 24px;
}

.session-card {
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.session-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.session-time {
  color: #999;
  font-size: 12px;
}

.session-id {
  margin-bottom: 16px;
}

.session-id code {
  font-size: 13px;
  color: #666;
}

.session-stats {
  display: flex;
  gap: 24px;
  margin-bottom: 16px;
  padding: 12px 0;
  border-top: 1px solid #f0f0f0;
  border-bottom: 1px solid #f0f0f0;
}

.stat {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-value {
  font-size: 20px;
  font-weight: 600;
}

.stat-label {
  color: #999;
  font-size: 12px;
  margin-top: 4px;
}

.session-actions {
  margin-top: 12px;
}

.card {
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.card-body {
  padding: 24px;
}
</style>
