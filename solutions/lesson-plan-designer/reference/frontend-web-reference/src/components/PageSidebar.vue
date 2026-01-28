<script setup lang="ts">
/**
 * PageSidebar - Vertical navigation sidebar with icon-based menu items
 *
 * @example
 * <PageSidebar :items="sidebarItems" :activeIndex="currentIndex" @select="handleSelect" />
 */
import { type PropType } from 'vue'

interface SidebarItem {
  label: string
  icon: string
}

defineProps({
  items: {
    type: Array as PropType<SidebarItem[]>,
    required: true
  },
  activeIndex: {
    type: Number,
    default: 0
  }
})

const emit = defineEmits<{
  'select': [index: number]
}>()
</script>

<template>
  <aside class="page-sidebar">
    <button
      v-for="(item, index) in items"
      :key="index"
      :class="['sidebar-btn', { active: index === activeIndex }]"
      @click="emit('select', index)"
    >
      <span class="sidebar-icon" v-html="item.icon"></span>
      <span>{{ item.label }}</span>
    </button>
  </aside>
</template>

<style scoped>
.page-sidebar {
  width: 180px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.sidebar-btn {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--white);
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-lg);
  font-size: var(--text-sm);
  color: var(--gray-600);
  cursor: pointer;
  transition: all var(--transition-fast);
  text-align: left;
}

.sidebar-btn:hover {
  background: var(--gray-50);
  border-color: var(--gray-300);
}

.sidebar-btn.active {
  background: var(--primary);
  border-color: var(--primary);
  color: var(--white);
}

.sidebar-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
}

.sidebar-icon :deep(svg) {
  width: 18px;
  height: 18px;
}
</style>
