<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import { useAuthStore } from '@/stores/auth'
import type { Tenant, ApiKey } from '@/types/admin'
import { message, Modal } from 'ant-design-vue'
import dayjs from 'dayjs'
import {
  ArrowLeftOutlined,
  KeyOutlined,
  DeleteOutlined,
  CopyOutlined
} from '@ant-design/icons-vue'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const loading = ref(true)
const tenant = ref<Tenant | null>(null)
const apiKeys = ref<ApiKey[]>([])

const tenantId = computed(() => route.params.tenantId as string)

onMounted(() => {
  loadTenant()
})

async function loadTenant() {
  loading.value = true
  try {
    const [tenantResponse, keysResponse] = await Promise.all([
      axios.get<Tenant>(`/api/v1/tenants/${tenantId.value}`, {
        headers: authStore.getAuthHeaders()
      }),
      axios.get<ApiKey[]>(`/api/v1/tenants/${tenantId.value}/api-keys`, {
        headers: authStore.getAuthHeaders()
      })
    ])
    tenant.value = tenantResponse.data
    apiKeys.value = keysResponse.data
  } catch (error) {
    message.error('Failed to load tenant')
    console.error(error)
    router.push('/tenants')
  } finally {
    loading.value = false
  }
}

async function revokeApiKey(keyId: string) {
  Modal.confirm({
    title: 'Revoke API Key',
    content: 'Are you sure you want to revoke this API key? This action cannot be undone.',
    okText: 'Revoke',
    okType: 'danger',
    async onOk() {
      try {
        await axios.put(`/api/v1/api-keys/${keyId}`, { status: 'revoked' }, {
          headers: authStore.getAuthHeaders()
        })
        message.success('API key revoked')
        loadTenant()
      } catch (error) {
        message.error('Failed to revoke API key')
      }
    }
  })
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text)
  message.success('Copied to clipboard')
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'active': return 'green'
    case 'revoked': return 'red'
    case 'expired': return 'gray'
    default: return 'default'
  }
}
</script>

<template>
  <div class="tenant-detail">
    <div class="page-header">
      <div class="header-left">
        <a-button type="text" @click="router.push('/tenants')">
          <ArrowLeftOutlined />
        </a-button>
        <div v-if="tenant">
          <h1>{{ tenant.name }}</h1>
          <code>{{ tenant.slug }}</code>
        </div>
      </div>
    </div>

    <a-spin :spinning="loading">
      <a-row :gutter="[24, 24]" v-if="tenant">
        <!-- Tenant Info -->
        <a-col :xs="24" :lg="8">
          <div class="card">
            <div class="card-header">
              <h3>Tenant Info</h3>
            </div>
            <div class="card-body">
              <a-descriptions :column="1" size="small">
                <a-descriptions-item label="ID">
                  <code>{{ tenant.id }}</code>
                </a-descriptions-item>
                <a-descriptions-item label="Slug">
                  <code>{{ tenant.slug }}</code>
                </a-descriptions-item>
                <a-descriptions-item label="Status">
                  <a-tag :color="getStatusColor(tenant.status)">
                    {{ tenant.status }}
                  </a-tag>
                </a-descriptions-item>
                <a-descriptions-item label="Plan">
                  {{ tenant.plan }}
                </a-descriptions-item>
                <a-descriptions-item label="Created">
                  {{ dayjs(tenant.createdAt).format('YYYY-MM-DD HH:mm') }}
                </a-descriptions-item>
              </a-descriptions>
            </div>
          </div>
        </a-col>

        <!-- API Keys -->
        <a-col :xs="24" :lg="16">
          <div class="card">
            <div class="card-header">
              <h3>
                <KeyOutlined style="margin-right: 8px;" />
                API Keys
              </h3>
            </div>
            <a-table
              :dataSource="apiKeys"
              :pagination="false"
              :rowKey="(record: ApiKey) => record.id"
              size="small"
            >
              <a-table-column title="Name" data-index="name" key="name" />

              <a-table-column title="Key" data-index="keyPrefix" key="keyPrefix">
                <template #default="{ record }">
                  <code>{{ record.keyPrefix }}...</code>
                  <a-button
                    type="text"
                    size="small"
                    @click="copyToClipboard(record.keyPrefix)"
                  >
                    <CopyOutlined />
                  </a-button>
                </template>
              </a-table-column>

              <a-table-column title="Scopes" data-index="scopes" key="scopes">
                <template #default="{ record }">
                  <a-tag v-for="scope in record.scopes.slice(0, 3)" :key="scope" size="small">
                    {{ scope }}
                  </a-tag>
                  <span v-if="record.scopes.length > 3" style="color: #999;">
                    +{{ record.scopes.length - 3 }} more
                  </span>
                </template>
              </a-table-column>

              <a-table-column title="Status" data-index="status" key="status">
                <template #default="{ record }">
                  <a-tag :color="getStatusColor(record.status)">
                    {{ record.status }}
                  </a-tag>
                </template>
              </a-table-column>

              <a-table-column title="Usage" data-index="usageCount" key="usageCount" align="right">
                <template #default="{ record }">
                  {{ record.usageCount }}
                </template>
              </a-table-column>

              <a-table-column title="Last Used" data-index="lastUsedAt" key="lastUsedAt">
                <template #default="{ record }">
                  {{ record.lastUsedAt ? dayjs(record.lastUsedAt).format('MM/DD HH:mm') : 'Never' }}
                </template>
              </a-table-column>

              <a-table-column title="Action" key="action" width="80">
                <template #default="{ record }">
                  <a-button
                    type="text"
                    danger
                    size="small"
                    :disabled="record.status === 'revoked'"
                    @click="revokeApiKey(record.id)"
                  >
                    <DeleteOutlined />
                  </a-button>
                </template>
              </a-table-column>
            </a-table>
          </div>
        </a-col>
      </a-row>
    </a-spin>
  </div>
</template>

<style scoped>
.tenant-detail {
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

.header-left code {
  color: #666;
  margin-top: 4px;
  display: block;
}

.card {
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.card-header {
  padding: 16px 24px;
  border-bottom: 1px solid #f0f0f0;
}

.card-header h3 {
  font-size: 16px;
  font-weight: 600;
  margin: 0;
}

.card-body {
  padding: 24px;
}
</style>
