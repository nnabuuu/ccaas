<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import { auditApi } from '@/api/admin'
import { useAuthStore } from '@/stores/auth'
import type { PaginatedAuditLogs } from '@/types/admin'
import { message } from 'ant-design-vue'
import dayjs from 'dayjs'
import {
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined
} from '@ant-design/icons-vue'

const authStore = useAuthStore()
const loading = ref(true)
const auditLogs = ref<PaginatedAuditLogs | null>(null)

const filters = ref({
  action: undefined as string | undefined,
  targetType: undefined as string | undefined,
  success: undefined as boolean | undefined,
  limit: 50,
  offset: 0
})

// Combine filters with tenant selection
const queryParams = computed(() => ({
  ...filters.value,
  tenantId: authStore.selectedTenantId || undefined
}))

onMounted(() => {
  loadAuditLogs()
})

// Watch tenant selection changes
watch(() => authStore.selectedTenantId, () => {
  filters.value.offset = 0
  loadAuditLogs()
})

async function loadAuditLogs() {
  loading.value = true
  try {
    auditLogs.value = await auditApi.query(queryParams.value)
  } catch (error) {
    message.error('Failed to load audit logs')
    console.error(error)
  } finally {
    loading.value = false
  }
}

function handleFilterChange() {
  filters.value.offset = 0
  loadAuditLogs()
}

function handlePageChange(page: number, pageSize: number) {
  filters.value.offset = (page - 1) * pageSize
  filters.value.limit = pageSize
  loadAuditLogs()
}

function getActionColor(action: string): string {
  if (action.includes('create')) return 'green'
  if (action.includes('update')) return 'blue'
  if (action.includes('delete') || action.includes('revoke') || action.includes('kill')) return 'red'
  if (action.includes('publish')) return 'purple'
  if (action.includes('rollback')) return 'orange'
  return 'default'
}

function getTargetTypeIcon(type: string): string {
  switch (type) {
    case 'skill': return '⚡'
    case 'session': return '💻'
    case 'apikey': return '🔑'
    case 'tenant': return '👥'
    default: return '📄'
  }
}
</script>

<template>
  <div class="audit-log">
    <div class="page-header">
      <div>
        <h1>Audit Log</h1>
        <p>Track all admin actions for compliance and debugging</p>
      </div>
      <div class="header-actions">
        <a-button @click="loadAuditLogs" :loading="loading">
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
            v-model:value="filters.action"
            placeholder="Action"
            style="width: 150px"
            allowClear
            @change="handleFilterChange"
          >
            <a-select-option value="skill.create">skill.create</a-select-option>
            <a-select-option value="skill.update">skill.update</a-select-option>
            <a-select-option value="skill.publish">skill.publish</a-select-option>
            <a-select-option value="skill.archive">skill.archive</a-select-option>
            <a-select-option value="skill.rollback">skill.rollback</a-select-option>
            <a-select-option value="session.kill">session.kill</a-select-option>
            <a-select-option value="apikey.create">apikey.create</a-select-option>
            <a-select-option value="apikey.revoke">apikey.revoke</a-select-option>
          </a-select>

          <a-select
            v-model:value="filters.targetType"
            placeholder="Target Type"
            style="width: 130px"
            allowClear
            @change="handleFilterChange"
          >
            <a-select-option value="skill">Skill</a-select-option>
            <a-select-option value="session">Session</a-select-option>
            <a-select-option value="apikey">API Key</a-select-option>
            <a-select-option value="tenant">Tenant</a-select-option>
          </a-select>

          <a-select
            v-model:value="filters.success"
            placeholder="Result"
            style="width: 120px"
            allowClear
            @change="handleFilterChange"
          >
            <a-select-option :value="true">Success</a-select-option>
            <a-select-option :value="false">Failed</a-select-option>
          </a-select>
        </a-space>
      </div>
    </div>

    <!-- Audit Log Table -->
    <div class="card">
      <a-table
        :dataSource="auditLogs?.items || []"
        :loading="loading"
        :pagination="{
          total: auditLogs?.total || 0,
          pageSize: filters.limit,
          current: Math.floor(filters.offset / filters.limit) + 1,
          showSizeChanger: true,
          showTotal: (total: number) => `Total ${total} entries`,
          onChange: handlePageChange
        }"
        :rowKey="(record: PaginatedAuditLogs['items'][number]) => record.id"
      >
        <a-table-column title="Time" data-index="createdAt" key="createdAt" width="160">
          <template #default="{ record }">
            {{ dayjs(record.createdAt).format('MM/DD HH:mm:ss') }}
          </template>
        </a-table-column>

        <a-table-column title="Action" data-index="action" key="action">
          <template #default="{ record }">
            <a-tag :color="getActionColor(record.action)">
              {{ record.action }}
            </a-tag>
          </template>
        </a-table-column>

        <a-table-column title="Target" data-index="targetId" key="targetId">
          <template #default="{ record }">
            <span class="target-type">{{ getTargetTypeIcon(record.targetType) }}</span>
            <code>{{ record.targetId.substring(0, 12) }}...</code>
          </template>
        </a-table-column>

        <a-table-column title="Admin" data-index="adminId" key="adminId">
          <template #default="{ record }">
            <code>{{ record.adminId.substring(0, 12) }}...</code>
          </template>
        </a-table-column>

        <a-table-column title="Result" data-index="success" key="success" width="100" align="center">
          <template #default="{ record }">
            <a-tooltip v-if="!record.success" :title="record.errorMessage">
              <CloseCircleOutlined style="color: #ff4d4f; font-size: 18px;" />
            </a-tooltip>
            <CheckCircleOutlined v-else style="color: #52c41a; font-size: 18px;" />
          </template>
        </a-table-column>

        <a-table-column title="Details" key="details" width="100">
          <template #default="{ record }">
            <a-popover v-if="record.metadata" title="Metadata" trigger="click">
              <template #content>
                <pre class="metadata-content">{{ JSON.stringify(record.metadata, null, 2) }}</pre>
              </template>
              <a-button type="link" size="small">View</a-button>
            </a-popover>
            <span v-else style="color: #999;">-</span>
          </template>
        </a-table-column>
      </a-table>
    </div>
  </div>
</template>

<style scoped>
.audit-log {
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

.card-body {
  padding: 24px;
}

.target-type {
  margin-right: 8px;
}

.metadata-content {
  max-width: 400px;
  max-height: 300px;
  overflow: auto;
  font-size: 12px;
  background: #f5f5f5;
  padding: 12px;
  border-radius: 4px;
  margin: 0;
}
</style>
