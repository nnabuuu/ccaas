<script setup lang="ts">
/**
 * InlineEditTimeRange - Inline editable time range picker with validation
 *
 * A time range component that displays start and end times until clicked, then shows
 * two native time inputs. Validates that end time is after start time and auto-saves on blur.
 *
 * @example
 * <InlineEditTimeRange v-model:startTime="start" v-model:endTime="end" @save="handleSave" />
 */
import { ref, computed, watch, nextTick } from 'vue'
import toast from '../../utils/toast'

const props = defineProps({
  startTime: {
    type: String,
    default: ''
  },
  endTime: {
    type: String,
    default: ''
  },
  placeholder: {
    type: String,
    default: '选择时间'
  },
  readonly: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:startTime', 'update:endTime', 'save'])

const startInputRef = ref<HTMLInputElement | null>(null)
const endInputRef = ref<HTMLInputElement | null>(null)
const isEditing = ref(false)
const editStartTime = ref(props.startTime)
const editEndTime = ref(props.endTime)
const saving = ref(false)
const error = ref<string | null>(null)

// Watch for external value changes
watch(() => props.startTime, (val) => {
  if (!isEditing.value) editStartTime.value = val
})
watch(() => props.endTime, (val) => {
  if (!isEditing.value) editEndTime.value = val
})

// Display value
const displayValue = computed(() => {
  if (!props.startTime && !props.endTime) return ''
  return `${props.startTime || '--:--'} - ${props.endTime || '--:--'}`
})

const isEmpty = computed(() => {
  return !props.startTime && !props.endTime
})

// Validate time range
const validateTimeRange = () => {
  if (!editStartTime.value || !editEndTime.value) {
    return true // Allow partial values
  }
  if (editStartTime.value >= editEndTime.value) {
    return '结束时间必须晚于开始时间'
  }
  return true
}

// Handle click to start editing
const handleClick = () => {
  if (props.readonly) return
  isEditing.value = true
  editStartTime.value = props.startTime
  editEndTime.value = props.endTime
  error.value = null
  nextTick(() => {
    startInputRef.value?.focus()
  })
}

// Handle save
const handleSave = async () => {
  // Skip if values haven't changed
  if (editStartTime.value === props.startTime && editEndTime.value === props.endTime) {
    isEditing.value = false
    return
  }

  // Validate
  const validationResult = validateTimeRange()
  if (validationResult !== true) {
    error.value = validationResult
    return
  }

  saving.value = true
  error.value = null

  try {
    emit('update:startTime', editStartTime.value)
    emit('update:endTime', editEndTime.value)
    emit('save', { startTime: editStartTime.value, endTime: editEndTime.value })
    toast.success('已保存', { duration: 2000 })
    isEditing.value = false
  } catch (err) {
    const errorMsg = (err as Error).message || '保存失败'
    error.value = errorMsg
    toast.error(errorMsg)
  } finally {
    saving.value = false
  }
}

// Handle cancel
const handleCancel = () => {
  isEditing.value = false
  editStartTime.value = props.startTime
  editEndTime.value = props.endTime
  error.value = null
}

// Handle blur - save when both inputs lose focus
const handleBlur = () => {
  // Check if focus is moving to the other time input
  setTimeout(() => {
    const activeEl = document.activeElement
    if (activeEl !== startInputRef.value && activeEl !== endInputRef.value) {
      handleSave()
    }
  }, 100)
}

// Handle keyboard
const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Enter') {
    event.preventDefault()
    handleSave()
  } else if (event.key === 'Escape') {
    event.preventDefault()
    handleCancel()
  }
}

// Handle keyboard in view mode
const handleViewKeydown = (event: KeyboardEvent) => {
  if (props.readonly) return
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    handleClick()
  }
}

// Retry on error
const retry = () => {
  error.value = null
}
</script>

<template>
  <div
    :class="[
      'inline-edit-time-range',
      {
        'inline-edit-time-range--editing': isEditing,
        'inline-edit-time-range--saving': saving,
        'inline-edit-time-range--error': error,
        'inline-edit-time-range--readonly': readonly,
        'inline-edit-time-range--empty': isEmpty
      }
    ]"
  >
    <!-- Edit Mode -->
    <div v-if="isEditing" class="inline-edit-time-range__edit">
      <input
        ref="startInputRef"
        v-model="editStartTime"
        type="time"
        class="inline-edit-time-range__input"
        :disabled="saving"
        @blur="handleBlur"
        @keydown="handleKeydown"
      />
      <span class="inline-edit-time-range__separator">-</span>
      <input
        ref="endInputRef"
        v-model="editEndTime"
        type="time"
        class="inline-edit-time-range__input"
        :disabled="saving"
        @blur="handleBlur"
        @keydown="handleKeydown"
      />
      <span v-if="saving" class="inline-edit-time-range__spinner">
        <svg class="spinner-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10" stroke-dasharray="60" stroke-dashoffset="20" />
        </svg>
      </span>
    </div>

    <!-- View Mode -->
    <div
      v-else
      class="inline-edit-time-range__view"
      :tabindex="readonly ? -1 : 0"
      role="button"
      :aria-label="isEmpty ? placeholder : `${displayValue}, 点击编辑`"
      @click="handleClick"
      @keydown="handleViewKeydown"
    >
      <svg class="inline-edit-time-range__clock-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12 6 12 12 16 14"/>
      </svg>
      <span v-if="isEmpty" class="inline-edit-time-range__placeholder">{{ placeholder }}</span>
      <span v-else class="inline-edit-time-range__value">{{ displayValue }}</span>
      <span v-if="!readonly" class="inline-edit-time-range__icon">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
      </span>
    </div>

    <!-- Error State -->
    <div v-if="error" class="inline-edit-time-range__error">
      <span class="inline-edit-time-range__error-message">{{ error }}</span>
      <button class="inline-edit-time-range__retry" @click="retry">重试</button>
    </div>
  </div>
</template>

<style scoped>
.inline-edit-time-range {
  position: relative;
  display: inline-flex;
  flex-direction: column;
}

/* View Mode */
.inline-edit-time-range__view {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  margin: -4px -8px;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.2s, box-shadow 0.2s;
  font-size: 14px;
}

.inline-edit-time-range__view:focus {
  outline: none;
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.3);
}

.inline-edit-time-range:not(.inline-edit-time-range--readonly) .inline-edit-time-range__view:hover {
  background: rgba(37, 99, 235, 0.05);
}

.inline-edit-time-range__clock-icon {
  color: #64748b;
  flex-shrink: 0;
}

.inline-edit-time-range__value {
  color: inherit;
}

.inline-edit-time-range__placeholder {
  color: #9ca3af;
  font-style: italic;
}

/* Pencil Icon */
.inline-edit-time-range__icon {
  opacity: 0;
  color: #94a3b8;
  transition: opacity 0.2s, color 0.2s;
  flex-shrink: 0;
}

.inline-edit-time-range:not(.inline-edit-time-range--readonly) .inline-edit-time-range__view:hover .inline-edit-time-range__icon,
.inline-edit-time-range:not(.inline-edit-time-range--readonly) .inline-edit-time-range__view:focus .inline-edit-time-range__icon {
  opacity: 1;
}

.inline-edit-time-range:not(.inline-edit-time-range--readonly) .inline-edit-time-range__view:hover .inline-edit-time-range__icon {
  color: #2563eb;
}

/* Touch devices */
@media (hover: none) {
  .inline-edit-time-range:not(.inline-edit-time-range--readonly) .inline-edit-time-range__icon {
    opacity: 0.5;
  }
}

/* Edit Mode */
.inline-edit-time-range__edit {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  margin: -4px -8px;
  border-radius: 6px;
  background: white;
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.3);
}

.inline-edit-time-range__input {
  width: 90px;
  padding: 4px 8px;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  font: inherit;
  font-size: 14px;
  color: inherit;
  outline: none;
}

.inline-edit-time-range__input:focus {
  border-color: #2563eb;
}

.inline-edit-time-range__input:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.inline-edit-time-range__separator {
  color: #64748b;
}

/* Spinner */
.inline-edit-time-range__spinner {
  color: #2563eb;
}

.spinner-icon {
  width: 14px;
  height: 14px;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Error State */
.inline-edit-time-range__error {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
  font-size: 12px;
}

.inline-edit-time-range__error-message {
  color: #ef4444;
}

.inline-edit-time-range__retry {
  padding: 2px 8px;
  border: 1px solid #ef4444;
  border-radius: 4px;
  background: white;
  color: #ef4444;
  font-size: 12px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.inline-edit-time-range__retry:hover {
  background: #fef2f2;
}

/* Readonly */
.inline-edit-time-range--readonly .inline-edit-time-range__view {
  cursor: default;
}
</style>
