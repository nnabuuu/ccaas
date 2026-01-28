<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '../stores/core/authStore'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const account = ref('admin')
const password = ref('admin123')
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
    <!-- Left Panel - Illustration -->
    <div class="login-illustration">
      <div class="illustration-container">
        <!-- Decorative circles -->
        <div class="deco-circle deco-circle-1"></div>
        <div class="deco-circle deco-circle-2"></div>
        <div class="deco-circle deco-circle-3"></div>

        <!-- Doodle text -->
        <span class="doodle doodle-1">SOLAR SYSTEM</span>
        <span class="doodle doodle-2">SCIENCE!</span>
        <span class="doodle doodle-3">ART AND DESIGN</span>
        <span class="doodle doodle-4">GEOGRAPHY</span>

        <!-- Paper Plane SVG -->
        <svg class="paper-plane" width="80" height="60" viewBox="0 0 80 60" fill="none">
          <path d="M5 30L75 5L55 55L40 35L5 30Z" fill="white" fill-opacity="0.9"/>
          <path d="M40 35L55 55L75 5L40 35Z" fill="white" fill-opacity="0.7"/>
          <path d="M40 35V50L48 42" stroke="white" stroke-opacity="0.5" stroke-width="2"/>
        </svg>

        <!-- Pencils SVG -->
        <svg class="pencils" width="60" height="80" viewBox="0 0 60 80" fill="none">
          <rect x="5" y="10" width="8" height="60" rx="2" fill="#fbbf24" transform="rotate(-15 5 10)"/>
          <rect x="25" y="5" width="8" height="65" rx="2" fill="#ef4444"/>
          <rect x="45" y="15" width="8" height="55" rx="2" fill="#22c55e" transform="rotate(10 45 15)"/>
        </svg>

        <!-- Main Illustration Scene -->
        <svg class="illustration-scene" viewBox="0 0 400 300" fill="none">
          <!-- Books stack -->
          <rect x="50" y="200" width="120" height="20" rx="2" fill="#3b82f6"/>
          <rect x="55" y="180" width="110" height="20" rx="2" fill="#60a5fa"/>
          <rect x="60" y="160" width="100" height="20" rx="2" fill="#93c5fd"/>
          <rect x="45" y="220" width="130" height="25" rx="2" fill="#2563eb"/>
          <rect x="40" y="245" width="140" height="30" rx="2" fill="#1d4ed8"/>

          <!-- Globe -->
          <circle cx="280" cy="180" r="50" fill="#60a5fa" stroke="white" stroke-width="3"/>
          <ellipse cx="280" cy="180" rx="50" ry="20" stroke="white" stroke-width="2" fill="none"/>
          <ellipse cx="280" cy="180" rx="20" ry="50" stroke="white" stroke-width="2" fill="none"/>
          <line x1="230" y1="180" x2="330" y2="180" stroke="white" stroke-width="2"/>
          <rect x="270" y="230" width="20" height="40" fill="#1e40af"/>
          <ellipse cx="280" cy="275" rx="30" ry="8" fill="#1e3a8a"/>

          <!-- Light bulb -->
          <circle cx="320" cy="80" r="25" fill="#fbbf24" opacity="0.9"/>
          <rect x="310" y="105" width="20" height="15" rx="3" fill="#f59e0b"/>
          <path d="M305 120 L335 120 L330 130 L310 130 Z" fill="#d97706"/>
          <line x1="320" y1="45" x2="320" y2="35" stroke="#fbbf24" stroke-width="3" stroke-linecap="round"/>
          <line x1="350" y1="60" x2="358" y2="52" stroke="#fbbf24" stroke-width="3" stroke-linecap="round"/>
          <line x1="290" y1="60" x2="282" y2="52" stroke="#fbbf24" stroke-width="3" stroke-linecap="round"/>

          <!-- Student figure -->
          <circle cx="180" cy="120" r="20" fill="#fde68a"/>
          <rect x="160" y="140" width="40" height="50" rx="5" fill="#3b82f6"/>
          <rect x="150" y="145" width="15" height="35" rx="3" fill="#3b82f6"/>
          <rect x="195" y="145" width="15" height="35" rx="3" fill="#3b82f6"/>
          <rect x="165" y="190" width="12" height="40" rx="3" fill="#1e40af"/>
          <rect x="183" y="190" width="12" height="40" rx="3" fill="#1e40af"/>
          <rect x="145" y="170" width="50" height="30" rx="2" fill="#1f2937"/>
          <rect x="148" y="173" width="44" height="22" rx="1" fill="#60a5fa"/>

          <!-- Plant decoration -->
          <path d="M30 280 Q40 250 50 280" stroke="#22c55e" stroke-width="3" fill="none"/>
          <ellipse cx="40" cy="255" rx="8" ry="15" fill="#22c55e" transform="rotate(-20 40 255)"/>
          <ellipse cx="50" cy="260" rx="8" ry="15" fill="#16a34a" transform="rotate(20 50 260)"/>
        </svg>

        <!-- Footer ICP -->
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
              <span class="form-input-icon" @click="togglePassword">
                <svg v-if="!showPassword" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
                <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                  <line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
              </span>
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
}

.deco-circle {
  position: absolute;
  border-radius: 50%;
  opacity: 0.1;
  background: white;
}

.deco-circle-1 {
  width: 300px;
  height: 300px;
  top: -100px;
  left: -100px;
}

.deco-circle-2 {
  width: 200px;
  height: 200px;
  bottom: 20%;
  right: -50px;
}

.deco-circle-3 {
  width: 150px;
  height: 150px;
  top: 40%;
  left: 10%;
  opacity: 0.05;
}

.paper-plane {
  position: absolute;
  top: 15%;
  left: 20%;
  animation: float 3s ease-in-out infinite;
}

@keyframes float {
  0%, 100% { transform: translateY(0) rotate(-10deg); }
  50% { transform: translateY(-15px) rotate(-5deg); }
}

.pencils {
  position: absolute;
  top: 10%;
  right: 15%;
}

.doodle {
  position: absolute;
  color: rgba(255, 255, 255, 0.3);
  font-size: var(--text-xs);
  font-family: monospace;
}

.doodle-1 { top: 20%; right: 25%; }
.doodle-2 { top: 35%; left: 15%; }
.doodle-3 { top: 25%; right: 10%; }
.doodle-4 { bottom: 40%; left: 8%; }

.illustration-scene {
  position: absolute;
  bottom: 10%;
  left: 50%;
  transform: translateX(-50%);
  width: 80%;
  max-width: 500px;
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
