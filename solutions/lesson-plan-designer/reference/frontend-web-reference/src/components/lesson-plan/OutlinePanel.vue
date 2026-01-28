<script setup lang="ts">
/**
 * OutlinePanel - Sticky sidebar navigation panel for lesson plan sections
 *
 * Displays a vertical list of navigation items with active section highlighting.
 * Handles smooth scrolling to sections with header offset compensation.
 *
 * @example
 * <OutlinePanel :items="outlineItems" :active-section="activeSection" @select="setActiveSection" />
 */
import { type PropType } from 'vue'

interface OutlineItem {
  id: string
  label: string
}

defineProps({
  items: { type: Array as PropType<OutlineItem[]>, required: true },
  activeSection: { type: String, required: true }
})

const emit = defineEmits<{
  'select': [sectionId: string]
}>()

// Header height offset (sticky header ~100px)
const HEADER_OFFSET = 120

const scrollToSection = (sectionId: string) => {
  emit('select', sectionId)
  const element = document.getElementById(sectionId)
  if (element) {
    const elementPosition = element.getBoundingClientRect().top + window.scrollY
    window.scrollTo({
      top: elementPosition - HEADER_OFFSET,
      behavior: 'smooth'
    })
  }
}
</script>

<template>
  <aside class="outline-panel">
    <button
      v-for="item in items"
      :key="item.id"
      :class="['outline-item', { active: activeSection === item.id }]"
      @click="scrollToSection(item.id)"
    >
      {{ item.label }}
    </button>
  </aside>
</template>

<style scoped>
.outline-panel {
  background: white;
  border-radius: 16px;
  padding: 20px;
  border: 1px solid rgba(203, 213, 225, 0.4);
  height: fit-content;
  max-height: calc(100vh - 160px);
  overflow-y: auto;
  position: sticky;
  top: 120px;
}

.outline-item {
  display: block;
  width: 100%;
  text-align: left;
  padding: 12px;
  border-radius: 8px;
  margin-bottom: 8px;
  cursor: pointer;
  color: #64748b;
  font-weight: 500;
  font-size: 14px;
  background: none;
  border: none;
  transition: all 0.2s;
}

.outline-item:last-child {
  margin-bottom: 0;
}

.outline-item:hover {
  background: #f1f5f9;
  color: #0f172a;
}

.outline-item.active {
  background: rgba(37, 99, 235, 0.1);
  color: #2563eb;
}

@media (max-width: 768px) {
  .outline-panel {
    position: static;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .outline-item {
    flex: none;
    margin-bottom: 0;
  }
}
</style>
