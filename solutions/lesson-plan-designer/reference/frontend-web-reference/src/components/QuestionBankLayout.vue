<script setup lang="ts">
/**
 * QuestionBankLayout - Shared layout wrapper for Question Bank module
 *
 * Features:
 * - Persistent curriculum tree sidebar for filtering
 * - Tab navigation between Browse, My Questions, and Review Queue
 * - Slot for child route views
 */
import { ref, onMounted, computed, provide } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { curriculumStandardApi } from '../api/index'
import type { CurriculumStandardTreeNode } from '@/types'

interface CurriculumTreeItem {
  id: number
  name: string
  count: number
}

const route = useRoute()
const router = useRouter()

// Curriculum tree state
const curriculumTree = ref<CurriculumTreeItem[]>([])
const selectedCurriculumId = ref<number | null>(null)
const loadingTree = ref(false)

// Tab navigation
const tabs = [
  { path: '/question-bank/browse', label: '题库浏览' },
  { path: '/question-bank/my', label: '我的题目' },
  { path: '/question-bank/review', label: '待审核' }
]

const activeTabPath = computed(() => {
  const path = route.path
  // Find matching tab
  for (const tab of tabs) {
    if (path.startsWith(tab.path)) {
      return tab.path
    }
  }
  return tabs[0].path
})

const navigateToTab = (path: string) => {
  router.push(path)
}

// Curriculum tree methods
const fetchCurriculumTree = async () => {
  loadingTree.value = true
  try {
    const response = await curriculumStandardApi.getTree()
    const data = response.data || []
    curriculumTree.value = data.map((item: CurriculumStandardTreeNode) => ({
      id: item.id,
      name: item.title || item.subject || '',
      count: item.children?.length || 0
    }))
  } catch (error) {
    console.error('[QuestionBankLayout] Failed to fetch curriculum tree:', error)
    // Fallback to static items
    curriculumTree.value = [
      { id: 1, name: '学前教育阶段', count: 0 },
      { id: 2, name: '义务教育第一学段', count: 0 },
      { id: 3, name: '义务教育第二学段', count: 0 },
      { id: 4, name: '义务教育第三学段', count: 0 },
      { id: 5, name: '高中阶段', count: 0 }
    ]
  } finally {
    loadingTree.value = false
  }
}

const selectCurriculum = (item: CurriculumTreeItem) => {
  selectedCurriculumId.value = selectedCurriculumId.value === item.id ? null : item.id
}

const clearCurriculumFilter = () => {
  selectedCurriculumId.value = null
}

// Provide curriculum filter state to child components
provide('curriculumFilter', {
  selectedCurriculumId,
  clearFilter: clearCurriculumFilter
})

onMounted(() => {
  fetchCurriculumTree()
})
</script>

<template>
  <div class="question-bank-layout">
    <div class="layout-content">
      <!-- Tree Sidebar -->
      <aside class="tree-sidebar">
        <div class="tree-header">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
          </svg>
          <span>课标筛选</span>
        </div>
        <div class="tree-list">
          <div v-if="loadingTree" class="tree-loading">加载中...</div>
          <template v-else>
            <div
              v-for="item in curriculumTree"
              :key="item.id"
              :class="['tree-item', { active: selectedCurriculumId === item.id }]"
              @click="selectCurriculum(item)"
            >
              {{ item.name }}
              <span v-if="item.count" class="tree-count">({{ item.count }})</span>
            </div>
          </template>
          <div
            v-if="selectedCurriculumId"
            class="tree-item clear-filter"
            @click="clearCurriculumFilter"
          >
            清除筛选
          </div>
        </div>
      </aside>

      <main class="layout-main">
        <!-- Tab Navigation -->
        <div class="tab-navigation">
          <button
            v-for="tab in tabs"
            :key="tab.path"
            :class="['tab-btn', { active: activeTabPath === tab.path }]"
            @click="navigateToTab(tab.path)"
          >
            {{ tab.label }}
          </button>
        </div>

        <!-- Child Route View -->
        <div class="tab-content">
          <router-view :curriculum-id="selectedCurriculumId" />
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
.question-bank-layout {
  padding: 24px;
  width: 100%;
  box-sizing: border-box;
}

.layout-content {
  display: flex;
  gap: 24px;
}

.tree-sidebar {
  width: 220px;
  flex-shrink: 0;
}

.tree-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: var(--white, #ffffff);
  border: 1px solid var(--gray-200, #e5e7eb);
  border-radius: 8px;
  margin-bottom: 16px;
  font-weight: 500;
  color: var(--gray-700, #374151);
}

.tree-list {
  background: var(--white, #ffffff);
  border: 1px solid var(--gray-200, #e5e7eb);
  border-radius: 8px;
  padding: 8px;
}

.tree-loading {
  padding: 16px;
  text-align: center;
  color: var(--gray-500, #6b7280);
  font-size: 14px;
}

.tree-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  font-size: 14px;
  color: var(--gray-600, #4b5563);
  cursor: pointer;
  border-radius: 6px;
  transition: background-color 0.15s, color 0.15s;
}

.tree-item:hover {
  background: var(--gray-50, #f9fafb);
}

.tree-item.active {
  background: rgba(59, 130, 246, 0.1);
  color: var(--primary, #3b82f6);
}

.tree-item.clear-filter {
  color: var(--gray-500, #6b7280);
  font-size: 13px;
  margin-top: 8px;
  border-top: 1px solid var(--gray-100, #f3f4f6);
  padding-top: 12px;
}

.tree-item.clear-filter:hover {
  color: var(--error, #ef4444);
}

.tree-count {
  font-size: 12px;
  color: var(--gray-400, #9ca3af);
}

.layout-main {
  flex: 1;
  min-width: 0;
}

.tab-navigation {
  display: flex;
  gap: 24px;
  border-bottom: 1px solid var(--gray-200, #e5e7eb);
  margin-bottom: 20px;
}

.tab-btn {
  padding: 12px 0;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  font-size: 16px;
  font-weight: 500;
  color: var(--gray-500, #6b7280);
  cursor: pointer;
  margin-bottom: -1px;
  transition: color 0.15s, border-color 0.15s;
}

.tab-btn:hover {
  color: var(--gray-700, #374151);
}

.tab-btn.active {
  color: var(--primary, #3b82f6);
  border-bottom-color: var(--primary, #3b82f6);
}

.tab-content {
  min-height: 400px;
}

@media (max-width: 768px) {
  .layout-content {
    flex-direction: column;
  }

  .tree-sidebar {
    width: 100%;
  }

  .tab-navigation {
    gap: 16px;
    overflow-x: auto;
    padding-bottom: 1px;
  }

  .tab-btn {
    white-space: nowrap;
    font-size: 14px;
  }
}
</style>
