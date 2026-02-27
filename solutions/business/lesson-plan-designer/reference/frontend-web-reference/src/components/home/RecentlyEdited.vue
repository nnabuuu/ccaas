<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { lessonPlanApi, scheduleApi } from '../../api/index'

const router = useRouter()
const loading = ref(false)

interface RecentItem {
  id: number
  title: string
  type: 'lesson-plan' | 'course'
  typeLabel: string
  time: string
  path: string
}

const items = ref<RecentItem[]>([])

const formatRelativeTime = (dateStr: string) => {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  if (hours < 24) return `${hours}小时前`
  if (days < 7) return `${days}天前`
  return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
}

const fetchRecentItems = async () => {
  loading.value = true
  try {
    const [lessonPlansRes, coursesRes] = await Promise.allSettled([
      lessonPlanApi.getList({ pageNum: 1, pageSize: 5 }),
      scheduleApi.getList({ pageNum: 1, pageSize: 5 })
    ])

    const combined: RecentItem[] = []

    if (lessonPlansRes.status === 'fulfilled') {
      const data = lessonPlansRes.value as { data?: { rows?: Array<{ id: number; title?: string; name?: string; updateTime?: string; createTime?: string }> }; rows?: Array<{ id: number; title?: string; name?: string; updateTime?: string; createTime?: string }> }
      const rows = data.data?.rows || data.rows || []
      for (const item of rows) {
        combined.push({
          id: item.id,
          title: item.title || item.name || '未命名教案',
          type: 'lesson-plan',
          typeLabel: '教案',
          time: formatRelativeTime(item.updateTime || item.createTime || ''),
          path: `/lesson-plan/${item.id}`
        })
      }
    }

    if (coursesRes.status === 'fulfilled') {
      const data = coursesRes.value as { data?: { rows?: Array<{ id: number; courseName?: string; title?: string; updateTime?: string; createTime?: string }> }; rows?: Array<{ id: number; courseName?: string; title?: string; updateTime?: string; createTime?: string }> }
      const rows = data.data?.rows || data.rows || []
      for (const item of rows) {
        combined.push({
          id: item.id,
          title: item.courseName || item.title || '未命名课程',
          type: 'course',
          typeLabel: '课程',
          time: formatRelativeTime(item.updateTime || item.createTime || ''),
          path: `/course/${item.id}`
        })
      }
    }

    // Sort by time (most recent first) and take top 5
    items.value = combined.slice(0, 5)
  } catch (error) {
    console.error('Failed to fetch recent items:', error)
  } finally {
    loading.value = false
  }
}

const handleClick = (item: RecentItem) => {
  router.push(item.path)
}

onMounted(fetchRecentItems)
</script>

<template>
  <div class="recently-edited">
    <h3 class="section-title">最近编辑</h3>

    <div v-if="loading" class="loading-hint">加载中...</div>

    <div v-else-if="items.length === 0" class="empty-hint">暂无最近编辑的内容</div>

    <div v-else class="recent-list">
      <button
        v-for="item in items"
        :key="`${item.type}-${item.id}`"
        class="recent-item"
        @click="handleClick(item)"
      >
        <div class="recent-item__content">
          <span :class="['type-badge', item.type]">{{ item.typeLabel }}</span>
          <span class="recent-item__title">{{ item.title }}</span>
        </div>
        <span class="recent-item__time">{{ item.time }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.recently-edited {
  background: var(--white);
  border-radius: var(--radius-xl);
  border: 1px solid var(--gray-200);
  padding: var(--space-4);
}

.section-title {
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--gray-800);
  margin-bottom: var(--space-4);
}

.loading-hint,
.empty-hint {
  font-size: var(--text-sm);
  color: var(--gray-400);
  text-align: center;
  padding: var(--space-4) 0;
}

.recent-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.recent-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-3);
  background: var(--gray-50);
  border: none;
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all var(--transition-fast);
  width: 100%;
  text-align: left;
}

.recent-item:hover {
  background: var(--gray-100);
}

.recent-item__content {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
  flex: 1;
}

.type-badge {
  flex-shrink: 0;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.type-badge.lesson-plan {
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
}

.type-badge.course {
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
}

.recent-item__title {
  font-size: var(--text-sm);
  color: var(--gray-700);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.recent-item__time {
  flex-shrink: 0;
  font-size: var(--text-xs);
  color: var(--gray-400);
}
</style>
