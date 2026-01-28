<script setup lang="ts">
/**
 * AttentionEmpty - Empty state for attention feed
 *
 * @example
 * <AttentionEmpty category="pending" />
 */
import { computed } from 'vue'
import { CATEGORIES } from '../../stores/domain/attentionFeedStore'

const props = defineProps({
  category: {
    type: String,
    default: CATEGORIES.ALL
  }
})

const emptyMessages: Record<string, string> = {
  [CATEGORIES.ALL]: '太棒了！没有需要关注的事项',
  [CATEGORIES.PENDING]: '暂无待处理的反馈',
  [CATEGORIES.UPDATED]: '暂无新的更新',
  [CATEGORIES.REMINDER]: '暂无提醒',
  [CATEGORIES.ACTIVITY]: '暂无动态'
}

const message = computed(() => emptyMessages[props.category] || emptyMessages[CATEGORIES.ALL])
</script>

<template>
  <div class="attention-empty">
    <div class="attention-empty__icon">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
        <polyline points="22 4 12 14.01 9 11.01"/>
      </svg>
    </div>
    <p class="attention-empty__message">{{ message }}</p>
  </div>
</template>

<style scoped>
.attention-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-12) var(--space-6);
  text-align: center;
}

.attention-empty__icon {
  width: 64px;
  height: 64px;
  border-radius: var(--radius-full);
  background: var(--gray-100);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--gray-400);
  margin-bottom: var(--space-4);
}

.attention-empty__message {
  font-size: var(--text-base);
  color: var(--gray-500);
}
</style>
