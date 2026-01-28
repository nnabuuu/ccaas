<script setup lang="ts">
/**
 * CourseRequirementsEditor - Compact editor for course requirements with modal selection
 *
 * Displays selected curriculum standards in compact list format with edit button.
 * Opens modal for selecting/modifying content and academic requirements.
 *
 * Automatically maps gradeLevel (1-12) to curriculum stage (学段) for filtering:
 * - 第一学段: 1-2年级
 * - 第二学段: 3-4年级
 * - 第三学段: 5-6年级
 * - 第四学段: 7-8-9年级
 *
 * @example
 * <CourseRequirementsEditor :subject="subject" :grade-level="grade" :content-ids="contentIds" :academic-ids="academicIds" @update:content-ids="..." />
 */
import { ref, computed, onMounted, type PropType } from 'vue'
import StandardsSelectionModal from './StandardsSelectionModal.vue'
import StandardsDisplay from './StandardsDisplay.vue'
import { gradeToStage } from '@/utils/gradeStageMapping'

const props = defineProps({
  subject: { type: String, default: '' },
  gradeLevel: { type: [Number, String] as PropType<number | string>, default: 0 },
  contentIds: { type: Array as PropType<number[]>, default: () => [] },
  academicIds: { type: Array as PropType<number[]>, default: () => [] },
  autoOpenModal: { type: Boolean, default: false }
})

// Compute stage from gradeLevel for child components
const stage = computed(() => {
  const level = typeof props.gradeLevel === 'string'
    ? parseInt(props.gradeLevel, 10)
    : props.gradeLevel
  return gradeToStage(level)
})

const emit = defineEmits<{
  'update:contentIds': [ids: number[]]
  'update:academicIds': [ids: number[]]
}>()

const modalVisible = ref(false)

// Auto-open modal on mount if requested
onMounted(() => {
  if (props.autoOpenModal) {
    modalVisible.value = true
  }
})

const openModal = () => {
  modalVisible.value = true
}

const handleConfirm = ({ contentIds, academicIds }: { contentIds: number[]; academicIds: number[] }) => {
  emit('update:contentIds', contentIds)
  emit('update:academicIds', academicIds)
}

const handleRemove = ({ id, type }: { id: number; type: 'content' | 'academic' }) => {
  if (type === 'content') {
    emit('update:contentIds', props.contentIds.filter(i => i !== id))
  } else {
    emit('update:academicIds', props.academicIds.filter(i => i !== id))
  }
}
</script>

<template>
  <div class="course-requirements-editor">
    <!-- Compact display with edit button -->
    <StandardsDisplay
      :content-ids="contentIds"
      :academic-ids="academicIds"
      :subject="subject"
      :stage="stage"
      editable
      @edit="openModal"
      @remove="handleRemove"
    />

    <!-- Selection Modal -->
    <StandardsSelectionModal
      v-if="modalVisible"
      v-model:visible="modalVisible"
      :subject="subject"
      :stage="stage"
      :content-ids="contentIds"
      :academic-ids="academicIds"
      @confirm="handleConfirm"
    />
  </div>
</template>

<style scoped>
.course-requirements-editor {
  width: 100%;
}
</style>
