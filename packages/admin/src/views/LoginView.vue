<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { message } from 'ant-design-vue'
import { KeyOutlined, ThunderboltOutlined } from '@ant-design/icons-vue'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const apiKey = ref('')
const loading = ref(false)
const demoLoading = ref(false)

async function validateAndRedirect() {
  const response = await fetch('/api/v1/admin/dashboard/health', {
    headers: authStore.getAuthHeaders()
  })

  if (response.ok) {
    message.success('Login successful')
    const redirect = route.query.redirect as string || '/dashboard'
    router.push(redirect)
    return true
  } else if (response.status === 401) {
    authStore.clearApiKey()
    message.error('Invalid API key')
  } else if (response.status === 403) {
    authStore.clearApiKey()
    message.error('API key does not have admin scope')
  } else {
    authStore.clearApiKey()
    message.error('Failed to authenticate')
  }
  return false
}

async function handleLogin() {
  if (!apiKey.value.trim()) {
    message.error('Please enter an API key')
    return
  }

  loading.value = true
  try {
    authStore.setApiKey(apiKey.value.trim())
    await validateAndRedirect()
  } catch (error) {
    authStore.clearApiKey()
    message.error('Failed to connect to server')
  } finally {
    loading.value = false
  }
}

async function handleDemoLogin() {
  if (!authStore.hasDemoKey) {
    message.warning('Demo key not configured. Set VITE_DEMO_API_KEY in .env')
    return
  }

  demoLoading.value = true
  try {
    authStore.useDemoKey()
    await validateAndRedirect()
  } catch (error) {
    authStore.clearApiKey()
    message.error('Failed to connect to server')
  } finally {
    demoLoading.value = false
  }
}
</script>

<template>
  <div class="login-container">
    <div class="login-card">
      <div class="login-header">
        <h1>Claude Code Admin</h1>
        <p>Enter your admin API key to continue</p>
      </div>

      <a-form layout="vertical" @submit.prevent="handleLogin">
        <a-form-item label="API Key">
          <a-input-password
            v-model:value="apiKey"
            size="large"
            placeholder="sk-xxxxxxxx-xxxxxxxxxxxx"
          >
            <template #prefix>
              <KeyOutlined />
            </template>
          </a-input-password>
        </a-form-item>

        <a-form-item>
          <a-button
            type="primary"
            html-type="submit"
            size="large"
            block
            :loading="loading"
          >
            Login
          </a-button>
        </a-form-item>

        <!-- Demo Key Button - only shown when VITE_DEMO_API_KEY is configured -->
        <a-form-item v-if="authStore.hasDemoKey">
          <a-button
            size="large"
            block
            :loading="demoLoading"
            @click="handleDemoLogin"
          >
            <template #icon>
              <ThunderboltOutlined />
            </template>
            Use Demo Key
          </a-button>
        </a-form-item>
      </a-form>

      <div class="login-footer">
        <p>
          You need an API key with the <code>admin</code> scope.
        </p>
        <p v-if="authStore.hasDemoKey" class="demo-hint">
          Or use the pre-configured demo key for quick access.
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #3B82F6 0%, #1E40AF 100%);
  padding: 24px;
}

.login-card {
  width: 100%;
  max-width: 400px;
  background: #fff;
  border-radius: 16px;
  padding: 48px 40px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
}

.login-header {
  text-align: center;
  margin-bottom: 32px;
}

.login-header h1 {
  font-size: 24px;
  font-weight: 600;
  margin: 0 0 8px 0;
  color: #1E293B;
  letter-spacing: -0.025em;
}

.login-header p {
  color: #64748B;
  margin: 0;
  font-size: 14px;
}

/* Ant Design Vue form overrides for proper alignment */
.login-card :deep(.ant-form-item) {
  margin-bottom: 20px;
}

.login-card :deep(.ant-form-item:last-child) {
  margin-bottom: 0;
}

.login-card :deep(.ant-form-item-label) {
  padding-bottom: 6px;
}

.login-card :deep(.ant-form-item-label > label) {
  font-size: 14px;
  font-weight: 500;
  color: #374151;
}

.login-card :deep(.ant-input-password),
.login-card :deep(.ant-input-affix-wrapper) {
  border-radius: 8px;
  border-color: #D1D5DB;
  padding: 8px 12px;
}

.login-card :deep(.ant-input-affix-wrapper:hover),
.login-card :deep(.ant-input-affix-wrapper:focus),
.login-card :deep(.ant-input-affix-wrapper-focused) {
  border-color: #3B82F6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
}

.login-card :deep(.ant-input-prefix) {
  margin-right: 10px;
  color: #9CA3AF;
}

.login-card :deep(.ant-btn) {
  height: 44px;
  border-radius: 8px;
  font-weight: 500;
  font-size: 15px;
  transition: all 0.2s ease;
}

.login-card :deep(.ant-btn-primary) {
  background: #3B82F6;
  border-color: #3B82F6;
}

.login-card :deep(.ant-btn-primary:hover) {
  background: #2563EB;
  border-color: #2563EB;
}

.login-card :deep(.ant-btn-default) {
  border-color: #D1D5DB;
  color: #374151;
}

.login-card :deep(.ant-btn-default:hover) {
  border-color: #3B82F6;
  color: #3B82F6;
}

.login-footer {
  text-align: center;
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid #E5E7EB;
}

.login-footer p {
  color: #9CA3AF;
  font-size: 13px;
  margin: 0;
  line-height: 1.5;
}

.login-footer .demo-hint {
  margin-top: 8px;
  color: #3B82F6;
}

.login-footer code {
  background: #F3F4F6;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-family: 'Fira Code', monospace;
  color: #1E293B;
}
</style>
