<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { dashboardApi } from '@/api/admin'
import { useAuthStore } from '@/stores/auth'
import type { DashboardSummary, RecentSession } from '@/types/admin'
import { message } from 'ant-design-vue'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import {
  DesktopOutlined,
  MessageOutlined,
  DollarOutlined,
  WarningOutlined,
  ThunderboltOutlined,
  KeyOutlined
} from '@ant-design/icons-vue'

dayjs.extend(relativeTime)

const authStore = useAuthStore()
const loading = ref(true)
const summary = ref<DashboardSummary | null>(null)
const recentSessions = ref<RecentSession[]>([])

async function loadDashboard() {
  loading.value = true
  try {
    const tenantId = authStore.selectedTenantId || undefined
    const [summaryData, sessionsData] = await Promise.all([
      dashboardApi.getSummary(tenantId),
      dashboardApi.getRecentSessions(10, tenantId)
    ])
    summary.value = summaryData
    recentSessions.value = sessionsData
  } catch (error) {
    message.error('Failed to load dashboard data')
    console.error(error)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadDashboard()
})

// Reload when tenant selection changes
watch(() => authStore.selectedTenantId, () => {
  loadDashboard()
})

function formatNumber(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K'
  return n.toString()
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
  <div class="dashboard">
    <div class="page-header">
      <h1>Dashboard</h1>
      <p>Overview of your Claude Code as a Service platform</p>
    </div>

    <a-spin :spinning="loading">
      <!-- Stats Row -->
      <a-row :gutter="[24, 24]" v-if="summary">
        <a-col :xs="24" :sm="12" :lg="6">
          <div class="stat-card">
            <div class="stat-icon" style="background: #e6f7ff; color: #1890ff;">
              <DesktopOutlined />
            </div>
            <div class="stat-content">
              <div class="stat-value">{{ summary.activeSessions }} / {{ summary.totalSessions }}</div>
              <div class="stat-label">Active Sessions</div>
              <div class="stat-sub">Max: {{ summary.maxSessions }}</div>
            </div>
          </div>
        </a-col>

        <a-col :xs="24" :sm="12" :lg="6">
          <div class="stat-card">
            <div class="stat-icon" style="background: #f6ffed; color: #52c41a;">
              <MessageOutlined />
            </div>
            <div class="stat-content">
              <div class="stat-value">{{ formatNumber(summary.totalMessages24h) }}</div>
              <div class="stat-label">Messages (24h)</div>
            </div>
          </div>
        </a-col>

        <a-col :xs="24" :sm="12" :lg="6">
          <div class="stat-card">
            <div class="stat-icon" style="background: #fff7e6; color: #fa8c16;">
              <DollarOutlined />
            </div>
            <div class="stat-content">
              <div class="stat-value">{{ formatNumber(summary.totalTokens24h.total) }}</div>
              <div class="stat-label">Tokens (24h)</div>
              <div class="stat-sub">
                In: {{ formatNumber(summary.totalTokens24h.input) }} /
                Out: {{ formatNumber(summary.totalTokens24h.output) }}
              </div>
            </div>
          </div>
        </a-col>

        <a-col :xs="24" :sm="12" :lg="6">
          <div class="stat-card">
            <div class="stat-icon" :style="{
              background: summary.errorRate24h > 5 ? '#fff2f0' : '#f6ffed',
              color: summary.errorRate24h > 5 ? '#ff4d4f' : '#52c41a'
            }">
              <WarningOutlined />
            </div>
            <div class="stat-content">
              <div class="stat-value">{{ summary.errorRate24h.toFixed(2) }}%</div>
              <div class="stat-label">Error Rate (24h)</div>
            </div>
          </div>
        </a-col>
      </a-row>

      <!-- Second Stats Row -->
      <a-row :gutter="[24, 24]" style="margin-top: 24px;" v-if="summary">
        <a-col :xs="24" :sm="12">
          <div class="stat-card">
            <div class="stat-icon" style="background: #f9f0ff; color: #722ed1;">
              <ThunderboltOutlined />
            </div>
            <div class="stat-content">
              <div class="stat-value">{{ summary.publishedSkills }} / {{ summary.totalSkills }}</div>
              <div class="stat-label">Published Skills</div>
            </div>
          </div>
        </a-col>

        <a-col :xs="24" :sm="12">
          <div class="stat-card">
            <div class="stat-icon" style="background: #e6fffb; color: #13c2c2;">
              <KeyOutlined />
            </div>
            <div class="stat-content">
              <div class="stat-value">{{ summary.activeApiKeys }}</div>
              <div class="stat-label">Active API Keys</div>
            </div>
          </div>
        </a-col>
      </a-row>

      <!-- Recent Sessions -->
      <div class="card" style="margin-top: 24px;">
        <div class="card-header">
          <h3>Recent Sessions</h3>
          <router-link to="/sessions">
            <a-button type="link">View All</a-button>
          </router-link>
        </div>
        <a-table
          :dataSource="recentSessions"
          :columns="[
            { title: 'Session ID', dataIndex: 'sessionId', key: 'sessionId', ellipsis: true },
            { title: 'Status', dataIndex: 'status', key: 'status' },
            { title: 'Messages', dataIndex: 'messageCount', key: 'messageCount', align: 'right' },
            { title: 'Last Activity', dataIndex: 'lastActivity', key: 'lastActivity' }
          ]"
          :pagination="false"
          :rowKey="(record: RecentSession) => record.sessionId"
          size="small"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'sessionId'">
              <router-link :to="`/sessions/${record.sessionId}`">
                <code>{{ record.sessionId.substring(0, 8) }}...</code>
              </router-link>
            </template>
            <template v-else-if="column.key === 'status'">
              <a-tag :color="getStatusColor(record.status)">
                {{ record.status }}
              </a-tag>
            </template>
            <template v-else-if="column.key === 'lastActivity'">
              {{ dayjs(record.lastActivity).fromNow() }}
            </template>
          </template>
        </a-table>
      </div>
    </a-spin>
  </div>
</template>

<style scoped>
.dashboard {
  max-width: 1400px;
}

.stat-card {
  background: #fff;
  border-radius: 8px;
  padding: 24px;
  display: flex;
  align-items: flex-start;
  gap: 16px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  flex-shrink: 0;
}

.stat-content {
  flex: 1;
}

.stat-value {
  font-size: 28px;
  font-weight: 600;
  line-height: 1.2;
}

.stat-label {
  color: #666;
  margin-top: 4px;
}

.stat-sub {
  color: #999;
  font-size: 12px;
  margin-top: 4px;
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
</style>
