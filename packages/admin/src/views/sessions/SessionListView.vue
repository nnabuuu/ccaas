<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import { useRouter } from 'vue-router'
import { sessionsApi } from '@/api/admin'
import { useAuthStore } from '@/stores/auth'
import type { SessionListItem, PaginatedSessions } from '@/types/admin'
import { message } from 'ant-design-vue'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { ReloadOutlined, ThunderboltOutlined } from '@ant-design/icons-vue'

dayjs.extend(relativeTime)

const router = useRouter()
const authStore = useAuthStore()

const loading = ref(true)
const sessions = ref<PaginatedSessions | null>(null)
const selectedSession = ref<SessionListItem | null>(null)

// Filters
const filters = ref({
  status: undefined as string | undefined,
  limit: 20,
  offset: 0
})

// Combine filters with tenant selection
const queryParams = computed(() => ({
  ...filters.value,
  tenantId: authStore.selectedTenantId || undefined
}))

onMounted(() => {
  loadSessions()
})

// Watch both filters and tenant selection
watch([filters, () => authStore.selectedTenantId], () => {
  loadSessions()
}, { deep: true })

async function loadSessions() {
  loading.value = true
  try {
    sessions.value = await sessionsApi.list(queryParams.value)
  } catch (error) {
    message.error('Failed to load sessions')
    console.error(error)
  } finally {
    loading.value = false
  }
}

function selectSession(session: SessionListItem) {
  selectedSession.value = session
  router.push(`/sessions/${session.sessionId}`)
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'processing': return 'blue'
    case 'idle': return 'default'
    case 'error': return 'red'
    case 'closed': return 'gray'
    default: return 'default'
  }
}

function handlePageChange(page: number, pageSize: number) {
  filters.value.offset = (page - 1) * pageSize
  filters.value.limit = pageSize
}
</script>

<template>
  <div class="sessions-list">
    <div class="page-header">
      <div>
        <h1>Sessions</h1>
        <p>View and manage active and historical sessions</p>
      </div>
      <div class="header-actions">
        <router-link to="/sessions/active">
          <a-button type="primary">
            <ThunderboltOutlined />
            Active Sessions
          </a-button>
        </router-link>
        <a-button @click="loadSessions" :loading="loading">
          <ReloadOutlined />
          Refresh
        </a-button>
      </div>
    </div>

    <!-- Filters -->
    <div class="card" style="margin-bottom: 24px;">
      <div class="card-body" style="padding: 16px 24px;">
        <a-space size="middle">
          <a-select
            v-model:value="filters.status"
            placeholder="Status"
            style="width: 150px"
            allowClear
          >
            <a-select-option value="idle">Idle</a-select-option>
            <a-select-option value="processing">Processing</a-select-option>
            <a-select-option value="error">Error</a-select-option>
            <a-select-option value="closed">Closed</a-select-option>
          </a-select>
        </a-space>
      </div>
    </div>

    <!-- Sessions Table -->
    <div class="card">
      <a-table
        :dataSource="sessions?.items || []"
        :loading="loading"
        :pagination="{
          total: sessions?.total || 0,
          pageSize: filters.limit,
          current: Math.floor(filters.offset / filters.limit) + 1,
          showSizeChanger: true,
          showTotal: (total: number) => `Total ${total} sessions`,
          onChange: handlePageChange
        }"
        :rowKey="(record: SessionListItem) => record.sessionId"
        :rowClassName="(record: SessionListItem) => selectedSession?.sessionId === record.sessionId ? 'selected-row' : ''"
        @row-click="selectSession"
      >
        <a-table-column title="Session ID" data-index="sessionId" key="sessionId">
          <template #default="{ record }">
            <code>{{ record.sessionId.substring(0, 8) }}...</code>
          </template>
        </a-table-column>

        <a-table-column title="Client" data-index="clientId" key="clientId">
          <template #default="{ record }">
            <span>{{ record.clientId.substring(0, 12) }}...</span>
          </template>
        </a-table-column>

        <a-table-column title="Status" data-index="status" key="status">
          <template #default="{ record }">
            <a-tag :color="getStatusColor(record.status)">
              {{ record.status }}
            </a-tag>
            <a-tag v-if="record.hasActiveProcess" color="green" size="small">
              CLI Active
            </a-tag>
          </template>
        </a-table-column>

        <a-table-column title="Messages" data-index="messageCount" key="messageCount" align="right" />

        <a-table-column title="Created" data-index="createdAt" key="createdAt">
          <template #default="{ record }">
            {{ dayjs(record.createdAt).format('MM/DD HH:mm') }}
          </template>
        </a-table-column>

        <a-table-column title="Last Activity" data-index="lastActivity" key="lastActivity">
          <template #default="{ record }">
            {{ dayjs(record.lastActivity).fromNow() }}
          </template>
        </a-table-column>

        <a-table-column title="Action" key="action" width="100">
          <template #default="{ record }">
            <router-link :to="`/sessions/${record.sessionId}`">
              <a-button type="link" size="small">View</a-button>
            </router-link>
          </template>
        </a-table-column>
      </a-table>
    </div>
  </div>
</template>

<style scoped>
.sessions-list {
  max-width: 1400px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
}

.page-header h1 {
  font-size: 24px;
  font-weight: 600;
  margin: 0;
}

.page-header p {
  color: #666;
  margin-top: 8px;
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

:deep(.ant-table-row) {
  cursor: pointer;
}

:deep(.ant-table-row:hover) {
  background: #fafafa;
}

:deep(.selected-row) {
  background: #e6f7ff !important;
}
</style>
