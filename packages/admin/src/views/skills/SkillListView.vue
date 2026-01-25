<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import axios from 'axios'
import { useAuthStore } from '@/stores/auth'
import type { Skill } from '@/types/admin'
import { message } from 'ant-design-vue'
import dayjs from 'dayjs'
import { ReloadOutlined } from '@ant-design/icons-vue'

const authStore = useAuthStore()

interface PaginatedSkills {
  items: Skill[]
  total: number
  page: number
  limit: number
  totalPages: number
}

const loading = ref(true)
const skills = ref<PaginatedSkills | null>(null)

const filters = ref({
  status: undefined as string | undefined,
  type: undefined as string | undefined,
  search: '',
  page: 1,
  limit: 20
})

// Combine filters with tenant selection
const queryParams = computed(() => ({
  ...filters.value,
  tenantId: authStore.selectedTenantId || undefined
}))

onMounted(() => {
  loadSkills()
})

// Watch tenant selection changes
watch(() => authStore.selectedTenantId, () => {
  filters.value.page = 1
  loadSkills()
})

async function loadSkills() {
  loading.value = true
  try {
    const response = await axios.get<PaginatedSkills>('/api/v1/skills', {
      params: queryParams.value,
      headers: authStore.getAuthHeaders()
    })
    skills.value = response.data
  } catch (error) {
    message.error('Failed to load skills')
    console.error(error)
  } finally {
    loading.value = false
  }
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'published': return 'green'
    case 'draft': return 'orange'
    case 'review': return 'blue'
    case 'deprecated': return 'red'
    case 'archived': return 'gray'
    default: return 'default'
  }
}

function getTypeColor(type: string): string {
  switch (type) {
    case 'skill': return 'blue'
    case 'sub-agent': return 'purple'
    case 'workflow': return 'cyan'
    case 'tool-config': return 'orange'
    default: return 'default'
  }
}

function handlePageChange(page: number) {
  filters.value.page = page
  loadSkills()
}
</script>

<template>
  <div class="skills-list">
    <div class="page-header">
      <div>
        <h1>Skills</h1>
        <p>Manage skill definitions and versions</p>
      </div>
      <div class="header-actions">
        <a-button @click="loadSkills" :loading="loading">
          <ReloadOutlined />
          Refresh
        </a-button>
      </div>
    </div>

    <!-- Filters -->
    <div class="card" style="margin-bottom: 24px;">
      <div class="card-body" style="padding: 16px 24px;">
        <a-space size="middle">
          <a-input-search
            v-model:value="filters.search"
            placeholder="Search skills..."
            style="width: 250px"
            @search="loadSkills"
          />

          <a-select
            v-model:value="filters.status"
            placeholder="Status"
            style="width: 130px"
            allowClear
            @change="loadSkills"
          >
            <a-select-option value="draft">Draft</a-select-option>
            <a-select-option value="review">Review</a-select-option>
            <a-select-option value="published">Published</a-select-option>
            <a-select-option value="deprecated">Deprecated</a-select-option>
            <a-select-option value="archived">Archived</a-select-option>
          </a-select>

          <a-select
            v-model:value="filters.type"
            placeholder="Type"
            style="width: 130px"
            allowClear
            @change="loadSkills"
          >
            <a-select-option value="skill">Skill</a-select-option>
            <a-select-option value="sub-agent">Sub-agent</a-select-option>
            <a-select-option value="workflow">Workflow</a-select-option>
            <a-select-option value="tool-config">Tool Config</a-select-option>
          </a-select>
        </a-space>
      </div>
    </div>

    <!-- Skills Table -->
    <div class="card">
      <a-table
        :dataSource="skills?.items || []"
        :loading="loading"
        :pagination="{
          total: skills?.total || 0,
          pageSize: filters.limit,
          current: filters.page,
          showTotal: (total: number) => `Total ${total} skills`,
          onChange: handlePageChange
        }"
        :rowKey="(record: Skill) => record.id"
      >
        <a-table-column title="Name" data-index="name" key="name">
          <template #default="{ record }">
            <router-link :to="`/skills/${record.slug}`">
              <strong>{{ record.name }}</strong>
            </router-link>
            <div class="skill-slug">
              <code>{{ record.slug }}</code>
            </div>
          </template>
        </a-table-column>

        <a-table-column title="Type" data-index="type" key="type">
          <template #default="{ record }">
            <a-tag :color="getTypeColor(record.type)">
              {{ record.type }}
            </a-tag>
          </template>
        </a-table-column>

        <a-table-column title="Status" data-index="status" key="status">
          <template #default="{ record }">
            <a-tag :color="getStatusColor(record.status)">
              {{ record.status }}
            </a-tag>
          </template>
        </a-table-column>

        <a-table-column title="Version" data-index="currentVersion" key="currentVersion" align="center">
          <template #default="{ record }">
            <code>{{ record.currentVersion }}</code>
          </template>
        </a-table-column>

        <a-table-column title="Updated" data-index="updatedAt" key="updatedAt">
          <template #default="{ record }">
            {{ dayjs(record.updatedAt).format('MM/DD HH:mm') }}
          </template>
        </a-table-column>

        <a-table-column title="Action" key="action" width="120">
          <template #default="{ record }">
            <router-link :to="`/skills/${record.slug}`">
              <a-button type="link" size="small">Edit</a-button>
            </router-link>
          </template>
        </a-table-column>
      </a-table>
    </div>
  </div>
</template>

<style scoped>
.skills-list {
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

.skill-slug {
  margin-top: 4px;
}

.skill-slug code {
  font-size: 12px;
  color: #999;
}
</style>
