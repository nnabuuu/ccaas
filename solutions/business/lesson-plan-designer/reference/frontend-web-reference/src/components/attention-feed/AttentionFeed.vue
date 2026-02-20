<script setup lang="ts">
/**
 * AttentionFeed - Main container for the attention feed
 *
 * @example
 * <AttentionFeed />
 */
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAttentionFeedStore } from '../../stores/domain/attentionFeedStore'
import toast from '../../utils/toast'
import type { AttentionItem as AttentionItemType } from '@/types'
import AttentionFilters from './AttentionFilters.vue'
import AttentionItem from './AttentionItem.vue'
import AttentionEmpty from './AttentionEmpty.vue'

const router = useRouter()
const store = useAttentionFeedStore()

onMounted(async () => {
  try {
    await Promise.all([
      store.fetchFeed(),
      store.fetchCounts()
    ])
  } catch (err) {
    // Error already logged in store
  }
})

const handleItemClick = async (item: AttentionItemType) => {
  // Mark as read
  if (!item.isRead) {
    try {
      await store.markAsRead(item.id)
    } catch (err) {
      // Silent fail - navigation is more important
    }
  }

  // Navigate to target
  if (item.targetPath) {
    router.push(item.targetPath)
  }
}

const handleMarkRead = async (item: AttentionItemType) => {
  try {
    await store.markAsRead(item.id)
    toast.success('已标为已读')
  } catch (err) {
    toast.error('操作失败')
  }
}

const handleMarkAllRead = async (category: string | null) => {
  try {
    await store.markAllAsRead(category ?? undefined)
    toast.success('已全部标为已读')
  } catch (err) {
    toast.error('操作失败')
  }
}

const handleRefresh = async () => {
  try {
    await Promise.all([
      store.fetchFeed(),
      store.fetchCounts()
    ])
    toast.success('已刷新')
  } catch (err) {
    toast.error('刷新失败')
  }
}
</script>

<template>
  <div class="attention-feed">
    <div class="attention-feed__header">
      <h2 class="attention-feed__title">需要关注</h2>
      <button class="attention-feed__refresh" @click="handleRefresh" :disabled="store.loading">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="23 4 23 10 17 10"/>
          <polyline points="1 20 1 14 7 14"/>
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
        </svg>
      </button>
    </div>

    <AttentionFilters
      v-model="store.selectedCategory"
      :counts="store.categoryCounts"
      @mark-all-read="handleMarkAllRead"
    />

    <!-- Loading State -->
    <div v-if="store.loading" class="attention-feed__loading">
      <div class="attention-feed__spinner"></div>
      <span>加载中...</span>
    </div>

    <!-- Error State -->
    <div v-else-if="store.error" class="attention-feed__error">
      <p>{{ store.error }}</p>
      <button @click="handleRefresh">重试</button>
    </div>

    <!-- Empty State -->
    <AttentionEmpty v-else-if="store.isEmpty" :category="store.selectedCategory" />

    <!-- Feed Items -->
    <div v-else class="attention-feed__items">
      <AttentionItem
        v-for="item in store.filteredItems"
        :key="item.id"
        :item="item"
        @click="handleItemClick"
        @mark-read="handleMarkRead"
      />
    </div>
  </div>
</template>

<style scoped>
.attention-feed {
  background: var(--white);
  border-radius: var(--radius-xl);
  border: 1px solid var(--gray-200);
  overflow: hidden;
}

.attention-feed__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4) var(--space-5);
  border-bottom: 1px solid var(--gray-100);
}

.attention-feed__title {
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--gray-800);
}

.attention-feed__refresh {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-md);
  color: var(--gray-500);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.attention-feed__refresh:hover {
  background: var(--gray-50);
  color: var(--gray-700);
}

.attention-feed__refresh:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.attention-feed__items {
  max-height: 500px;
  overflow-y: auto;
}

.attention-feed__loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  padding: var(--space-12);
  color: var(--gray-500);
}

.attention-feed__spinner {
  width: 20px;
  height: 20px;
  border: 2px solid var(--gray-200);
  border-top-color: var(--primary);
  border-radius: var(--radius-full);
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.attention-feed__error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  padding: var(--space-12);
  text-align: center;
}

.attention-feed__error p {
  color: var(--error);
}

.attention-feed__error button {
  padding: var(--space-2) var(--space-4);
  font-size: var(--text-sm);
  color: var(--primary);
  background: var(--primary-light);
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
}

.attention-feed__error button:hover {
  background: #dbeafe;
}
</style>
