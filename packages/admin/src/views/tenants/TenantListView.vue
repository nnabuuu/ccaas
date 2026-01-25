<script setup lang="ts">
import { ref, onMounted } from 'vue'
import axios from 'axios'
import { useAuthStore } from '@/stores/auth'
import type { Tenant } from '@/types/admin'
import { message } from 'ant-design-vue'
import dayjs from 'dayjs'
import { ReloadOutlined, TeamOutlined } from '@ant-design/icons-vue'

const authStore = useAuthStore()

const loading = ref(true)
const tenants = ref<Tenant[]>([])

onMounted(() => {
  loadTenants()
})

async function loadTenants() {
  loading.value = true
  try {
    const response = await axios.get<Tenant[]>('/api/v1/tenants', {
      headers: authStore.getAuthHeaders()
    })
    tenants.value = response.data
  } catch (error) {
    message.error('Failed to load tenants')
    console.error(error)
  } finally {
    loading.value = false
  }
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'active': return 'green'
    case 'pending': return 'orange'
    case 'suspended': return 'red'
    case 'deleted': return 'gray'
    default: return 'default'
  }
}

function getPlanColor(plan: string): string {
  switch (plan) {
    case 'enterprise': return 'purple'
    case 'professional': return 'blue'
    case 'starter': return 'cyan'
    case 'free': return 'default'
    default: return 'default'
  }
}
</script>

<template>
  <div class="tenants-list">
    <div class="page-header">
      <div>
        <h1>Tenants</h1>
        <p>Manage multi-tenant organizations</p>
      </div>
      <div class="header-actions">
        <a-button @click="loadTenants" :loading="loading">
          <ReloadOutlined />
          Refresh
        </a-button>
      </div>
    </div>

    <!-- Tenants Table -->
    <div class="card">
      <a-table
        :dataSource="tenants"
        :loading="loading"
        :pagination="{ pageSize: 20 }"
        :rowKey="(record: Tenant) => record.id"
      >
        <a-table-column title="Tenant" data-index="name" key="name">
          <template #default="{ record }">
            <div class="tenant-info">
              <div class="tenant-icon">
                <TeamOutlined />
              </div>
              <div>
                <router-link :to="`/tenants/${record.id}`">
                  <strong>{{ record.name }}</strong>
                </router-link>
                <div class="tenant-slug">
                  <code>{{ record.slug }}</code>
                </div>
              </div>
            </div>
          </template>
        </a-table-column>

        <a-table-column title="Status" data-index="status" key="status">
          <template #default="{ record }">
            <a-tag :color="getStatusColor(record.status)">
              {{ record.status }}
            </a-tag>
          </template>
        </a-table-column>

        <a-table-column title="Plan" data-index="plan" key="plan">
          <template #default="{ record }">
            <a-tag :color="getPlanColor(record.plan)">
              {{ record.plan }}
            </a-tag>
          </template>
        </a-table-column>

        <a-table-column title="Created" data-index="createdAt" key="createdAt">
          <template #default="{ record }">
            {{ dayjs(record.createdAt).format('YYYY-MM-DD') }}
          </template>
        </a-table-column>

        <a-table-column title="Action" key="action" width="120">
          <template #default="{ record }">
            <router-link :to="`/tenants/${record.id}`">
              <a-button type="link" size="small">Manage</a-button>
            </router-link>
          </template>
        </a-table-column>
      </a-table>
    </div>
  </div>
</template>

<style scoped>
.tenants-list {
  max-width: 1200px;
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

.tenant-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.tenant-icon {
  width: 40px;
  height: 40px;
  background: #f0f5ff;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #1890ff;
  font-size: 18px;
}

.tenant-slug {
  margin-top: 4px;
}

.tenant-slug code {
  font-size: 12px;
  color: #999;
}
</style>
