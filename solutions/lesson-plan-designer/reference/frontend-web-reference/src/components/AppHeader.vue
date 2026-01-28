<script setup lang="ts">
/**
 * AppHeader - Main application header with navigation, school selector, and user menu
 *
 * @example
 * <AppHeader />
 */
import { ref, computed, onMounted, inject } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/core/authStore'
import { useSchoolStore } from '../stores/domain/schoolStore'
import { useSplitPanel } from '../composables/useSplitPanel'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const schoolStore = useSchoolStore()

// AI Panel toggle
const { toggle: toggleAiPanel, isOpen: isAiPanelOpen } = useSplitPanel()

// Inject agent connection status from AgentListener
const isAgentConnected = inject('agentConnected', ref(false))

const showUserMenu = ref(false)
const showSchoolMenu = ref(false)

const navItems = [
  { path: '/home', label: '首页' },
  { path: '/course', label: '课程' },
  { path: '/lesson-plan', label: '教案' },
  { path: '/question-bank', label: '题库' },
  { path: '/projects', label: '项目' },
]

const isActive = (path: string) => {
  // Special handling for question-bank routes - highlight nav if on any question-bank sub-route
  if (path.startsWith('/question-bank')) {
    return route.path.startsWith('/question-bank')
  }
  return route.path === path
}

const userName = computed(() => authStore.user?.nickName || authStore.user?.userName || '用户')
const userAvatar = computed(() => authStore.user?.avatar)

const toggleUserMenu = () => {
  showUserMenu.value = !showUserMenu.value
}

const closeUserMenu = () => {
  showUserMenu.value = false
}

const handleLogout = () => {
  authStore.logout()
  router.push('/login')
}

// School menu handlers
const toggleSchoolMenu = () => {
  showSchoolMenu.value = !showSchoolMenu.value
}

const closeSchoolMenu = () => {
  showSchoolMenu.value = false
}

const selectSchool = (schoolId: number) => {
  schoolStore.selectSchool(schoolId)
  closeSchoolMenu()
}

// Fetch schools on mount if user is logged in
onMounted(() => {
  if (authStore.isLoggedIn) {
    schoolStore.fetchSchools()
  }
})
</script>

<template>
  <header class="header">
    <div class="header-left">
      <div class="header-logo">
        <span class="logo-text">LOGO</span>
        <span class="logo-name">师范生发展平台</span>
      </div>

      <!-- School Selector -->
      <div class="school-selector" @mouseleave="closeSchoolMenu">
        <button class="school-btn" @click="toggleSchoolMenu" :disabled="schoolStore.loading">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
          <span class="school-name">{{ schoolStore.currentSchoolName }}</span>
          <svg class="chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
        <div v-if="showSchoolMenu" class="school-dropdown">
          <div v-if="schoolStore.loading" class="dropdown-loading">加载中...</div>
          <div v-else-if="schoolStore.schools.length === 0" class="dropdown-empty">暂无学校数据</div>
          <template v-else>
            <button
              v-for="school in schoolStore.schools"
              :key="school.id"
              :class="['school-item', { active: school.id === schoolStore.currentSchoolId }]"
              @click="selectSchool(school.id)"
            >
              <span class="school-item-name">{{ school.schoolName }}</span>
              <svg v-if="school.id === schoolStore.currentSchoolId" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </button>
          </template>
        </div>
      </div>
    </div>

    <nav class="header-nav">
      <router-link
        v-for="item in navItems"
        :key="item.path"
        :to="item.path"
        :class="['nav-link', { active: isActive(item.path) }]"
      >
        {{ item.label }}
      </router-link>
    </nav>

    <div class="header-right">
      <!-- AI Assistant Toggle Button -->
      <button
        class="ai-toggle-btn"
        :class="{ active: isAiPanelOpen, connected: isAgentConnected }"
        @click="toggleAiPanel"
        title="AI 助手"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1a7 7 0 0 1-7 7H10a7 7 0 0 1-7-7H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z"/>
          <circle cx="9" cy="13" r="1" fill="currentColor"/>
          <circle cx="15" cy="13" r="1" fill="currentColor"/>
          <path d="M9 17h6"/>
        </svg>
        <span class="ai-btn-text">AI 助手</span>
        <span v-if="isAgentConnected" class="ai-status-dot"></span>
      </button>

      <button class="notification-btn">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        <span class="notification-badge"></span>
      </button>
      <div class="user-menu-wrapper" @mouseleave="closeUserMenu">
        <button class="user-avatar" @click="toggleUserMenu">
          <img v-if="userAvatar" :src="userAvatar" alt="User">
          <img v-else src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='50' fill='%23fbbf24'/%3E%3Ccircle cx='50' cy='40' r='20' fill='%23fef3c7'/%3E%3Cellipse cx='50' cy='85' rx='35' ry='25' fill='%23fef3c7'/%3E%3C/svg%3E" alt="User">
        </button>
        <div v-if="showUserMenu" class="user-dropdown">
          <div class="dropdown-header">
            <span class="user-name">{{ userName }}</span>
          </div>
          <router-link to="/profile" class="dropdown-item" @click="closeUserMenu">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
            个人资料
          </router-link>
          <button class="dropdown-item logout" @click="handleLogout">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            退出登录
          </button>
        </div>
      </div>
    </div>
  </header>
</template>

<style scoped>
.header {
  height: 56px;
  background: var(--white);
  border-bottom: 1px solid var(--gray-200);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--space-6);
  position: sticky;
  top: 0;
  z-index: 100;
  position: relative;
}

.header-left {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.header-logo {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

/* School Selector */
.school-selector {
  position: relative;
}

.school-btn {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: 6px 12px;
  background: var(--gray-50);
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-md);
  color: var(--gray-700);
  font-size: var(--text-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.school-btn:hover:not(:disabled) {
  background: var(--gray-100);
  border-color: var(--gray-300);
}

.school-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.school-name {
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.school-btn .chevron {
  transition: transform var(--transition-fast);
}

.school-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  background: var(--white);
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  min-width: 200px;
  max-width: 280px;
  z-index: 1000;
  overflow: hidden;
}

.dropdown-loading,
.dropdown-empty {
  padding: var(--space-3) var(--space-4);
  color: var(--gray-500);
  font-size: var(--text-sm);
  text-align: center;
}

.school-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: var(--space-2) var(--space-4);
  background: none;
  border: none;
  font-size: var(--text-sm);
  color: var(--gray-700);
  text-align: left;
  cursor: pointer;
  transition: background var(--transition-fast);
}

.school-item:hover {
  background: var(--gray-50);
}

.school-item.active {
  background: var(--primary-50, #eff6ff);
  color: var(--primary);
}

.school-item-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.logo-text {
  font-weight: 700;
  font-style: italic;
  color: var(--primary);
}

.logo-name {
  font-size: var(--text-sm);
  color: var(--gray-700);
}

.header-nav {
  display: flex;
  gap: var(--space-6);
  height: 100%;
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
}

.nav-link {
  display: flex;
  align-items: center;
  height: 100%;
  color: var(--gray-600);
  font-size: var(--text-base);
  font-weight: 500;
  border-bottom: 2px solid transparent;
  transition: all var(--transition-fast);
}

.nav-link:hover {
  color: var(--gray-800);
}

.nav-link.active {
  color: var(--primary);
  border-bottom-color: var(--primary);
}

.header-right {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

/* AI Toggle Button */
.ai-toggle-btn {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  height: 36px;
  padding: 0 var(--space-3);
  background: transparent;
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-full);
  color: var(--gray-600);
  font-size: var(--text-sm);
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.ai-toggle-btn:hover {
  background: var(--gray-50);
  border-color: var(--gray-300);
}

.ai-toggle-btn.active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-color: transparent;
  color: white;
}

.ai-toggle-btn.active:hover {
  opacity: 0.9;
}

.ai-btn-text {
  display: none;
}

@media (min-width: 768px) {
  .ai-btn-text {
    display: inline;
  }
}

.ai-status-dot {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 8px;
  height: 8px;
  background: #52c41a;
  border-radius: var(--radius-full);
  border: 2px solid var(--white);
}

.ai-toggle-btn.active .ai-status-dot {
  border-color: #667eea;
}

.notification-btn {
  position: relative;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: var(--gray-600);
  border-radius: var(--radius-full);
  transition: background var(--transition-fast);
}

.notification-btn:hover {
  background: var(--gray-100);
}

.notification-badge {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 8px;
  height: 8px;
  background: var(--error);
  border-radius: var(--radius-full);
  border: 2px solid var(--white);
}

.user-menu-wrapper {
  position: relative;
}

.user-avatar {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-full);
  overflow: hidden;
  cursor: pointer;
  border: none;
  padding: 0;
  background: none;
}

.user-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.user-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: var(--space-2);
  background: var(--white);
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  min-width: 160px;
  z-index: 1000;
  overflow: hidden;
}

.dropdown-header {
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--gray-100);
}

.user-name {
  font-weight: 500;
  color: var(--gray-800);
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  padding: var(--space-2) var(--space-4);
  background: none;
  border: none;
  font-size: var(--text-sm);
  color: var(--gray-700);
  text-align: left;
  cursor: pointer;
  transition: background var(--transition-fast);
}

.dropdown-item:hover {
  background: var(--gray-50);
}

.dropdown-item.logout {
  color: var(--error);
  border-top: 1px solid var(--gray-100);
}

.dropdown-item.logout:hover {
  background: #fef2f2;
}
</style>
