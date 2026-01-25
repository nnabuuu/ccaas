<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { tenantsApi } from '@/api/admin'
import { message } from 'ant-design-vue'
import {
  DashboardOutlined,
  DesktopOutlined,
  ThunderboltOutlined,
  LineChartOutlined,
  TeamOutlined,
  AuditOutlined,
  LogoutOutlined,
  SettingOutlined,
  GlobalOutlined
} from '@ant-design/icons-vue'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const loadingTenants = ref(false)

const selectedKeys = computed(() => {
  const path = route.path
  if (path.startsWith('/dashboard')) return ['dashboard']
  if (path.startsWith('/sessions')) return ['sessions']
  if (path.startsWith('/skills')) return ['skills']
  if (path.startsWith('/analytics')) return ['analytics']
  if (path.startsWith('/tenants')) return ['tenants']
  if (path.startsWith('/audit')) return ['audit']
  return ['dashboard']
})

const openKeys = computed(() => {
  if (route.path.startsWith('/analytics')) return ['analytics-sub']
  return []
})

// Tenant selector options
const tenantOptions = computed(() => {
  const options = [
    { value: null, label: 'All Tenants' }
  ]
  for (const tenant of authStore.tenantList) {
    options.push({ value: tenant.id, label: tenant.name })
  }
  return options
})

// Load tenants on mount
onMounted(async () => {
  loadingTenants.value = true
  try {
    const tenants = await tenantsApi.list()
    authStore.setTenantList(tenants)
    authStore.loadSelectedTenant()
  } catch {
    message.error('Failed to load tenants')
  } finally {
    loadingTenants.value = false
  }
})

function handleTenantChange(tenantId: string | null) {
  authStore.selectTenant(tenantId)
}

function handleLogout() {
  authStore.clearApiKey()
  authStore.clearTenantSelection()
  router.push('/login')
}
</script>

<template>
  <a-layout class="admin-layout">
    <!-- Sidebar -->
    <a-layout-sider
      :width="220"
      theme="dark"
      class="admin-sidebar"
    >
      <div class="logo">
        <h1>Claude Admin</h1>
      </div>
      <a-menu
        v-model:selectedKeys="selectedKeys"
        v-model:openKeys="openKeys"
        mode="inline"
        theme="dark"
      >
        <a-menu-item key="dashboard">
          <router-link to="/dashboard">
            <DashboardOutlined />
            <span>Dashboard</span>
          </router-link>
        </a-menu-item>

        <a-menu-item key="sessions">
          <router-link to="/sessions">
            <DesktopOutlined />
            <span>Sessions</span>
          </router-link>
        </a-menu-item>

        <a-menu-item key="skills">
          <router-link to="/skills">
            <ThunderboltOutlined />
            <span>Skills</span>
          </router-link>
        </a-menu-item>

        <a-sub-menu key="analytics-sub">
          <template #title>
            <LineChartOutlined />
            <span>Analytics</span>
          </template>
          <a-menu-item key="analytics">
            <router-link to="/analytics/usage">Token Usage</router-link>
          </a-menu-item>
          <a-menu-item key="costs">
            <router-link to="/analytics/costs">Costs</router-link>
          </a-menu-item>
        </a-sub-menu>

        <a-menu-item key="tenants">
          <router-link to="/tenants">
            <TeamOutlined />
            <span>Tenants</span>
          </router-link>
        </a-menu-item>

        <a-menu-item key="audit">
          <router-link to="/audit">
            <AuditOutlined />
            <span>Audit Log</span>
          </router-link>
        </a-menu-item>
      </a-menu>
    </a-layout-sider>

    <!-- Main layout -->
    <a-layout>
      <!-- Header -->
      <a-layout-header class="admin-header">
        <div class="header-content">
          <a-breadcrumb>
            <a-breadcrumb-item>
              <router-link to="/">Home</router-link>
            </a-breadcrumb-item>
            <a-breadcrumb-item>{{ route.name }}</a-breadcrumb-item>
          </a-breadcrumb>
        </div>
        <div class="header-actions">
          <!-- Tenant Selector -->
          <div class="tenant-selector">
            <GlobalOutlined class="tenant-icon" />
            <a-select
              :value="authStore.selectedTenantId"
              :loading="loadingTenants"
              :options="tenantOptions"
              placeholder="Select Tenant"
              style="width: 180px"
              allow-clear
              @change="handleTenantChange"
            >
              <template #suffixIcon v-if="!loadingTenants">
                <span></span>
              </template>
            </a-select>
          </div>

          <a-dropdown>
            <a-button type="text">
              <SettingOutlined />
            </a-button>
            <template #overlay>
              <a-menu>
                <a-menu-item @click="handleLogout">
                  <LogoutOutlined />
                  Logout
                </a-menu-item>
              </a-menu>
            </template>
          </a-dropdown>
        </div>
      </a-layout-header>

      <!-- Content -->
      <a-layout-content class="admin-content">
        <router-view />
      </a-layout-content>
    </a-layout>
  </a-layout>
</template>

<style scoped>
.admin-layout {
  min-height: 100vh;
}

.admin-sidebar {
  overflow: auto;
  height: 100vh;
  position: fixed;
  left: 0;
  top: 0;
  bottom: 0;
}

.admin-sidebar .logo {
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.admin-sidebar .logo h1 {
  color: #fff;
  font-size: 18px;
  font-weight: 600;
  margin: 0;
}

.admin-header {
  position: fixed;
  top: 0;
  left: 220px;
  right: 0;
  z-index: 100;
  background: #fff;
  padding: 0 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}

.admin-content {
  margin-left: 220px;
  margin-top: 64px;
  padding: 24px;
  min-height: calc(100vh - 64px);
  background: #f5f5f5;
}

.header-content {
  flex: 1;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

.tenant-selector {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tenant-icon {
  color: #666;
  font-size: 16px;
}

:deep(.ant-menu-item a) {
  color: inherit;
}
</style>
