<script setup lang="ts">
import { ref, onMounted } from 'vue'
import AttentionFeed from '../components/attention-feed/AttentionFeed.vue'
import { useAuthStore } from '../stores/core/authStore'
import { lessonPlanApi, scheduleApi } from '../api/index'

const authStore = useAuthStore()
const loading = ref(false)

const user = ref({
  name: '',
  school: '',
  subject: '',
  avatar: '',
  following: 0,
  followers: 0,
  lessonPlans: 0,
  courses: 0
})

const fetchUserProfile = async () => {
  loading.value = true
  try {
    // Use auth store user info first
    if (authStore.user) {
      const userObj = authStore.user as { nickName?: string; userName?: string; deptName?: string; dept?: { deptName?: string }; subject?: string; avatar?: string }
      user.value.name = userObj.nickName || userObj.userName || '用户'
      user.value.school = userObj.deptName || userObj.dept?.deptName || ''
      user.value.subject = userObj.subject || ''
      user.value.avatar = userObj.avatar || ''
    }

    // Fetch additional profile stats
    const [lessonPlansRes, coursesRes] = await Promise.allSettled([
      lessonPlanApi.getList({ createBy: authStore.userId ?? undefined, pageSize: 1 }),
      scheduleApi.getList({ createBy: authStore.userId ?? undefined, pageSize: 1 })
    ])

    if (lessonPlansRes.status === 'fulfilled') {
      const resData = lessonPlansRes.value as { data?: { total?: number }; total?: number }
      const data = resData.data || resData
      user.value.lessonPlans = data.total || 0
    }

    if (coursesRes.status === 'fulfilled') {
      const resData = coursesRes.value as { data?: { total?: number }; total?: number }
      const data = resData.data || resData
      user.value.courses = data.total || 0
    }
  } catch (error) {
    console.error('Failed to fetch user profile:', error)
  } finally {
    loading.value = false
  }
}

const handleEditProfile = () => {
  alert('编辑资料功能开发中...')
}

const handleEditCover = () => {
  alert('编辑封面功能开发中...')
}

onMounted(() => {
  fetchUserProfile()
})
</script>

<template>
  <div class="profile-page">
    <!-- Cover -->
    <div class="profile-cover">
      <button class="cover-edit-btn" @click="handleEditCover">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
          <circle cx="8.5" cy="8.5" r="1.5"/>
          <polyline points="21 15 16 10 5 21"/>
        </svg>
        编辑封面图片
      </button>
    </div>

    <!-- Profile Header -->
    <div class="profile-header">
      <div class="profile-info">
        <div class="profile-avatar">
          <img v-if="user.avatar" :src="user.avatar" alt="">
          <img v-else src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='50' fill='%23fbbf24'/%3E%3Ccircle cx='50' cy='40' r='20' fill='%23fef3c7'/%3E%3Cellipse cx='50' cy='80' rx='30' ry='20' fill='%23fef3c7'/%3E%3C/svg%3E" alt="">
        </div>
        <div class="profile-details">
          <h1 class="profile-name">{{ user.name || '用户' }}</h1>
          <div class="profile-meta">
            <span v-if="user.school">{{ user.school }}</span>
            <span v-if="user.subject">{{ user.subject }}</span>
          </div>
        </div>
        <button class="btn btn-primary" @click="handleEditProfile">编辑资料</button>
      </div>

      <div class="profile-stats">
        <div class="stat-item">
          <span class="stat-label">我关注的</span>
          <span class="stat-value">{{ user.following }}</span>
        </div>
        <span class="stat-divider">|</span>
        <div class="stat-item">
          <span class="stat-label">关注我的</span>
          <span class="stat-value">{{ user.followers }}</span>
        </div>
        <span class="stat-divider">|</span>
        <div class="stat-item">
          <span class="stat-label">我创建的教案</span>
          <span class="stat-value">{{ user.lessonPlans }}</span>
        </div>
        <span class="stat-divider">|</span>
        <div class="stat-item">
          <span class="stat-label">我发布的课程</span>
          <span class="stat-value">{{ user.courses }}</span>
        </div>
      </div>
    </div>

    <!-- Activity -->
    <div class="profile-content">
      <AttentionFeed />
    </div>
  </div>
</template>

<style scoped>
.profile-page {
  background: var(--gray-50);
}

.profile-cover {
  height: 200px;
  background: linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%);
  position: relative;
}

.cover-edit-btn {
  position: absolute;
  top: var(--space-4);
  right: var(--space-4);
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: rgba(0, 0, 0, 0.3);
  color: var(--white);
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  cursor: pointer;
}

.profile-header {
  max-width: var(--max-width-medium, 1024px);
  margin: -60px auto 0;
  padding: 0 var(--space-6);
}

.profile-info {
  display: flex;
  align-items: flex-end;
  gap: var(--space-4);
  margin-bottom: var(--space-4);
}

.profile-avatar {
  width: 120px;
  height: 120px;
  border-radius: var(--radius-full);
  border: 4px solid var(--white);
  overflow: hidden;
  box-shadow: var(--shadow-lg);
}

.profile-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.profile-details {
  flex: 1;
  padding-bottom: var(--space-2);
}

.profile-name {
  font-size: var(--text-2xl);
  font-weight: 600;
  color: var(--gray-800);
  margin-bottom: var(--space-2);
}

.profile-meta {
  display: flex;
  gap: var(--space-4);
  font-size: var(--text-sm);
  color: var(--gray-500);
}

.profile-stats {
  display: flex;
  gap: var(--space-6);
  padding: var(--space-4) 0;
  border-bottom: 1px solid var(--gray-200);
}

.stat-item {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--text-sm);
}

.stat-label {
  color: var(--gray-500);
}

.stat-value {
  font-weight: 600;
  color: var(--gray-800);
}

.stat-divider {
  color: var(--gray-300);
}

.profile-content {
  max-width: var(--max-width-medium, 1024px);
  margin: 0 auto;
  padding: var(--space-6);
}
</style>
