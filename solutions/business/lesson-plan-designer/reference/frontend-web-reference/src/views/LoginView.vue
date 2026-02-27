<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '../stores/core/authStore'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const account = ref('')
const password = ref('')
const rememberPassword = ref(false)
const showPassword = ref(false)
const loading = ref(false)
const errorMessage = ref('')

const handleLogin = async () => {
  if (!account.value || !password.value) {
    errorMessage.value = '请输入账号和密码'
    return
  }

  loading.value = true
  errorMessage.value = ''

  try {
    const result = await authStore.login(account.value, password.value)
    if (result.success) {
      // Save remember password preference
      if (rememberPassword.value) {
        localStorage.setItem('rememberAccount', account.value)
      } else {
        localStorage.removeItem('rememberAccount')
      }
      // Redirect to the original requested page or home
      const redirect = (route.query.redirect as string) || '/home'
      router.push(redirect)
    } else {
      errorMessage.value = result.message || '登录失败，请检查账号密码'
    }
  } catch (error) {
    errorMessage.value = (error as Error).message || '登录失败，请稍后重试'
  } finally {
    loading.value = false
  }
}

const togglePassword = () => {
  showPassword.value = !showPassword.value
}

// Check for saved account
const savedAccount = localStorage.getItem('rememberAccount')
if (savedAccount) {
  account.value = savedAccount
  rememberPassword.value = true
}
</script>

<template>
  <div class="login-page">
    <!-- Left Panel - Brand -->
    <div class="login-illustration">
      <div class="illustration-container">
        <div class="brand-content">
          <h2 class="brand-title">师范生发展平台</h2>
          <p class="brand-subtitle">备课 / 上课 / 反思 / 研究</p>
        </div>
        <div class="login-footer">京ICP备14XXXXXXX号-1</div>
      </div>
    </div>

    <!-- Right Panel - Login Form -->
    <div class="login-form-panel">
      <div class="login-form-container">
        <div class="login-logo">LOGO</div>
        <div class="login-welcome">欢迎来到 师范生发展平台</div>

        <form class="login-form" @submit.prevent="handleLogin">
          <div v-if="errorMessage" class="error-message">{{ errorMessage }}</div>

          <div class="form-group">
            <label class="form-label" for="account">账号</label>
            <input
              type="text"
              id="account"
              class="form-input"
              v-model="account"
              placeholder="请输入账号"
              :disabled="loading"
            >
          </div>

          <div class="form-group">
            <label class="form-label" for="password">密码</label>
            <div class="form-input-wrapper">
              <input
                :type="showPassword ? 'text' : 'password'"
                id="password"
                class="form-input"
                v-model="password"
                placeholder="请输入密码"
                :disabled="loading"
                @keyup.enter="handleLogin"
              >
              <button type="button" class="form-input-icon" @click="togglePassword" :aria-label="showPassword ? '隐藏密码' : '显示密码'">
                <svg v-if="!showPassword" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
                <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                  <line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
              </button>
            </div>
          </div>

          <div class="form-checkbox">
            <input type="checkbox" id="remember" v-model="rememberPassword" :disabled="loading">
            <label for="remember">记住密码</label>
          </div>

          <button type="submit" class="btn btn-login" :disabled="loading">
            {{ loading ? '登录中...' : '登录' }}
          </button>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
}

/* Left Panel - Illustration */
.login-illustration {
  flex: 1;
  background: linear-gradient(135deg, #2563eb 0%, #1e40af 50%, #1e3a8a 100%);
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.illustration-container {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.brand-content {
  text-align: center;
  color: white;
}

.brand-title {
  font-size: 2.5rem;
  font-weight: 700;
  margin: 0 0 var(--space-4) 0;
  letter-spacing: 0.05em;
}

.brand-subtitle {
  font-size: var(--text-lg);
  opacity: 0.8;
  margin: 0;
  letter-spacing: 0.1em;
}

.login-footer {
  position: absolute;
  bottom: var(--space-4);
  left: 50%;
  transform: translateX(-50%);
  color: rgba(255, 255, 255, 0.5);
  font-size: var(--text-xs);
}

/* Right Panel - Form */
.login-form-panel {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-8);
  background: var(--white);
}

.login-form-container {
  width: 100%;
  max-width: 400px;
}

.login-logo {
  font-size: var(--text-3xl);
  font-weight: 700;
  font-style: italic;
  color: var(--primary);
  margin-bottom: var(--space-2);
}

.login-welcome {
  font-size: var(--text-lg);
  color: var(--gray-800);
  margin-bottom: var(--space-8);
}

.form-group {
  margin-bottom: var(--space-5);
}

.form-label {
  display: block;
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--gray-700);
  margin-bottom: var(--space-2);
}

.form-input-wrapper {
  position: relative;
}

.form-input-icon {
  position: absolute;
  right: var(--space-4);
  top: 50%;
  transform: translateY(-50%);
  color: var(--gray-400);
  cursor: pointer;
  transition: color var(--transition-fast);
  background: none;
  border: none;
  padding: 4px;
  display: flex;
  align-items: center;
}

.form-input-icon:hover {
  color: var(--gray-600);
}

.form-checkbox {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-6);
}

.form-checkbox input[type="checkbox"] {
  width: 16px;
  height: 16px;
  accent-color: var(--primary);
}

.form-checkbox label {
  font-size: var(--text-sm);
  color: var(--gray-600);
}

.btn-login {
  width: 100%;
  padding: var(--space-3) var(--space-6);
  background: var(--primary);
  color: var(--white);
  font-size: var(--text-base);
  font-weight: 500;
  border: none;
  border-radius: var(--radius-full);
  cursor: pointer;
  transition: background var(--transition-fast);
}

.btn-login:hover:not(:disabled) {
  background: var(--primary-hover);
}

.btn-login:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.error-message {
  background: #fef2f2;
  color: var(--error);
  padding: var(--space-3);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-4);
  font-size: var(--text-sm);
  border: 1px solid #fecaca;
}

@media (max-width: 768px) {
  .login-page {
    flex-direction: column;
  }

  .login-illustration {
    display: none;
  }
}
</style>
