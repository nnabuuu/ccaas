<script setup lang="ts">
/**
 * AttentionItem - Single item in the attention feed
 *
 * @example
 * <AttentionItem
 *   :item="feedItem"
 *   @click="handleClick"
 *   @mark-read="handleMarkRead"
 * />
 */
import { computed, type PropType } from 'vue'
import type { AttentionItem as AttentionItemType } from '@/types'

const props = defineProps({
  item: {
    type: Object as PropType<AttentionItemType>,
    required: true,
    validator: (item: AttentionItemType) => 'id' in item && 'category' in item && 'title' in item
  }
})

const emit = defineEmits<{
  click: [item: AttentionItemType]
  'mark-read': [item: AttentionItemType]
}>()

// Category icon mapping
const categoryIcons: Record<string, string> = {
  pending: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
    <polyline points="10 9 9 9 8 9"/>
  </svg>`,
  updated: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <polyline points="20 6 9 17 4 12"/>
  </svg>`,
  reminder: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
    <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </svg>`,
  activity: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>`
}

const icon = computed(() => categoryIcons[props.item.category] || categoryIcons.reminder)

const formattedTime = computed(() => {
  if (!props.item.timestamp) return ''
  const date = new Date(props.item.timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return '刚刚'
  if (diffMins < 60) return `${diffMins}分钟前`
  if (diffHours < 24) return `${diffHours}小时前`
  if (diffDays < 7) return `${diffDays}天前`
  return date.toLocaleDateString('zh-CN')
})

const handleClick = () => {
  emit('click', props.item)
}

const handleMarkRead = (e: Event) => {
  e.stopPropagation()
  emit('mark-read', props.item)
}
</script>

<template>
  <div
    :class="['attention-item', { 'is-unread': !item.isRead }]"
    @click="handleClick"
  >
    <div :class="['attention-item__icon', item.category]" v-html="icon"></div>
    <div class="attention-item__content">
      <div class="attention-item__header">
        <span class="attention-item__title">{{ item.title }}</span>
        <span v-if="!item.isRead" class="attention-item__unread-dot"></span>
      </div>
      <p v-if="item.description" class="attention-item__description">
        {{ item.description }}
      </p>
      <div class="attention-item__meta">
        <span class="attention-item__time">{{ formattedTime }}</span>
        <button
          v-if="!item.isRead"
          class="attention-item__mark-read"
          @click="handleMarkRead"
        >
          标为已读
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.attention-item {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-5);
  border-bottom: 1px solid var(--gray-100);
  cursor: pointer;
  transition: background var(--transition-fast);
}

.attention-item:last-child {
  border-bottom: none;
}

.attention-item:hover {
  background: var(--gray-50);
}

.attention-item.is-unread {
  background: var(--primary-light);
}

.attention-item.is-unread:hover {
  background: #e0e7ff;
}

.attention-item__icon {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.attention-item__icon.pending {
  background: #dbeafe;
  color: #2563eb;
}

.attention-item__icon.updated {
  background: #d1fae5;
  color: #10b981;
}

.attention-item__icon.reminder {
  background: #fef3c7;
  color: #f59e0b;
}

.attention-item__icon.activity {
  background: #ede9fe;
  color: #8b5cf6;
}

.attention-item__content {
  flex: 1;
  min-width: 0;
}

.attention-item__header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.attention-item__title {
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--gray-800);
}

.attention-item__unread-dot {
  width: 8px;
  height: 8px;
  border-radius: var(--radius-full);
  background: var(--primary);
  flex-shrink: 0;
}

.attention-item__description {
  font-size: var(--text-sm);
  color: var(--gray-600);
  margin-top: var(--space-1);
  line-height: 1.5;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.attention-item__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: var(--space-2);
}

.attention-item__time {
  font-size: var(--text-xs);
  color: var(--gray-400);
}

.attention-item__mark-read {
  font-size: var(--text-xs);
  color: var(--primary);
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
}

.attention-item__mark-read:hover {
  text-decoration: underline;
}
</style>
