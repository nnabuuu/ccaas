<script setup lang="ts">
/**
 * AttentionFilters - Category filter tabs for attention feed
 *
 * @example
 * <AttentionFilters
 *   v-model="selectedCategory"
 *   :counts="categoryCounts"
 *   @mark-all-read="handleMarkAllRead"
 * />
 */
import { CATEGORIES, CATEGORY_LABELS } from '../../stores/domain/attentionFeedStore'

const props = defineProps({
  modelValue: {
    type: String,
    default: CATEGORIES.ALL
  },
  counts: {
    type: Object,
    default: () => ({
      pending: 0,
      updated: 0,
      reminder: 0,
      activity: 0
    })
  }
})

const emit = defineEmits(['update:modelValue', 'mark-all-read'])

const categories = [
  { key: CATEGORIES.ALL, label: CATEGORY_LABELS[CATEGORIES.ALL] },
  { key: CATEGORIES.PENDING, label: CATEGORY_LABELS[CATEGORIES.PENDING] },
  { key: CATEGORIES.UPDATED, label: CATEGORY_LABELS[CATEGORIES.UPDATED] },
  { key: CATEGORIES.REMINDER, label: CATEGORY_LABELS[CATEGORIES.REMINDER] },
  { key: CATEGORIES.ACTIVITY, label: CATEGORY_LABELS[CATEGORIES.ACTIVITY] }
]

const getCount = (key: string) => {
  if (key === CATEGORIES.ALL) {
    return Object.values(props.counts as Record<string, number>).reduce((sum: number, c: number) => sum + c, 0)
  }
  return (props.counts as Record<string, number>)[key] || 0
}

const selectCategory = (key: string) => {
  emit('update:modelValue', key)
}

const handleMarkAllRead = () => {
  const category = props.modelValue === CATEGORIES.ALL ? null : props.modelValue
  emit('mark-all-read', category)
}

const hasUnread = () => {
  if (props.modelValue === CATEGORIES.ALL) {
    return Object.values(props.counts as Record<string, number>).some((c: number) => c > 0)
  }
  return ((props.counts as Record<string, number>)[props.modelValue] || 0) > 0
}
</script>

<template>
  <div class="attention-filters">
    <div class="attention-filters__tabs">
      <button
        v-for="cat in categories"
        :key="cat.key"
        :class="['attention-filters__tab', { active: modelValue === cat.key }]"
        @click="selectCategory(cat.key)"
      >
        <span>{{ cat.label }}</span>
        <span v-if="getCount(cat.key) > 0" class="attention-filters__badge">
          {{ getCount(cat.key) > 99 ? '99+' : getCount(cat.key) }}
        </span>
      </button>
    </div>
    <button
      v-if="hasUnread()"
      class="attention-filters__mark-all"
      @click="handleMarkAllRead"
    >
      全部已读
    </button>
  </div>
</template>

<style scoped>
.attention-filters {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--gray-200);
  background: var(--white);
}

.attention-filters__tabs {
  display: flex;
  gap: var(--space-1);
}

.attention-filters__tab {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-2) var(--space-3);
  font-size: var(--text-sm);
  color: var(--gray-600);
  background: none;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.attention-filters__tab:hover {
  background: var(--gray-100);
  color: var(--gray-800);
}

.attention-filters__tab.active {
  background: var(--primary-light);
  color: var(--primary);
  font-weight: 500;
}

.attention-filters__badge {
  min-width: 18px;
  height: 18px;
  padding: 0 var(--space-1);
  font-size: var(--text-xs);
  font-weight: 500;
  color: var(--white);
  background: var(--primary);
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
}

.attention-filters__tab.active .attention-filters__badge {
  background: var(--primary);
}

.attention-filters__mark-all {
  font-size: var(--text-sm);
  color: var(--primary);
  background: none;
  border: none;
  cursor: pointer;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  transition: background var(--transition-fast);
}

.attention-filters__mark-all:hover {
  background: var(--gray-100);
}
</style>
