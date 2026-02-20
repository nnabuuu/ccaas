<script setup lang="ts">
/**
 * QuickActions - Quick action shortcuts for common tasks
 *
 * @example
 * <QuickActions />
 */
import { useRouter } from 'vue-router'

const router = useRouter()

const actions = [
  {
    id: 'lesson-plan',
    label: '新建教案',
    icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="12" y1="18" x2="12" y2="12"/>
      <line x1="9" y1="15" x2="15" y2="15"/>
    </svg>`,
    color: '#3b82f6',
    bgColor: '#dbeafe',
    path: '/lesson-plan/new'
  },
  {
    id: 'test-paper',
    label: '新建试卷',
    icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M9 11l3 3L22 4"/>
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
    </svg>`,
    color: '#10b981',
    bgColor: '#d1fae5',
    path: '/test-paper/new'
  },
  {
    id: 'projects',
    label: '查看项目',
    icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
    </svg>`,
    color: '#8b5cf6',
    bgColor: '#ede9fe',
    path: '/projects'
  }
]

const handleActionClick = (action: { path: string }) => {
  router.push(action.path)
}
</script>

<template>
  <div class="quick-actions">
    <h3 class="quick-actions__title">快捷操作</h3>
    <div class="quick-actions__list">
      <button
        v-for="action in actions"
        :key="action.id"
        class="quick-actions__item"
        @click="handleActionClick(action)"
      >
        <div
          class="quick-actions__icon"
          :style="{ backgroundColor: action.bgColor, color: action.color }"
          v-html="action.icon"
        ></div>
        <span class="quick-actions__label">{{ action.label }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.quick-actions {
  background: var(--white);
  border-radius: var(--radius-xl);
  border: 1px solid var(--gray-200);
  padding: var(--space-4);
}

.quick-actions__title {
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--gray-800);
  margin-bottom: var(--space-4);
}

.quick-actions__list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.quick-actions__item {
  display: flex;
  align-items: center;
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

.quick-actions__item:hover {
  background: var(--gray-100);
  transform: translateX(4px);
}

.quick-actions__icon {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.quick-actions__label {
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--gray-700);
}
</style>
