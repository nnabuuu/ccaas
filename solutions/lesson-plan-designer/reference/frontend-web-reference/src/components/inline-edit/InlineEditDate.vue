<script setup lang="ts">
/**
 * InlineEditDate - Inline editable date picker with auto-save
 *
 * A date picker component that displays a formatted date until clicked, then shows
 * a native date input. Auto-saves on selection and displays calendar icon.
 *
 * @example
 * <InlineEditDate v-model="dueDate" placeholder="Select date" @save="handleSave" />
 */
import { ref, computed, watch, nextTick } from 'vue'
import toast from '../../utils/toast'

const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  placeholder: {
    type: String,
    default: '选择日期'
  },
  readonly: {
    type: Boolean,
    default: false
  },
  format: {
    type: String,
    default: 'YYYY-MM-DD'
  }
})

const emit = defineEmits(['update:modelValue', 'save'])

const inputRef = ref<HTMLInputElement | null>(null)
const isOpen = ref(false)
const saving = ref(false)
const error = ref<string | null>(null)

// Format date for display
const formatDate = (dateStr: string) => {
  if (!dateStr) return ''
  try {
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) return dateStr
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).replace(/\//g, '-')
  } catch {
    return dateStr
  }
}

const displayValue = computed(() => {
  return formatDate(props.modelValue)
})

const isEmpty = computed(() => {
  return !props.modelValue
})

// Handle click to open date picker
const handleClick = () => {
  if (props.readonly) return
  isOpen.value = true
  nextTick(() => {
    inputRef.value?.showPicker?.()
    inputRef.value?.focus()
  })
}

// Handle date change
const handleChange = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const newValue = target.value
  if (newValue === props.modelValue) {
    isOpen.value = false
    return
  }

  saving.value = true
  error.value = null

  try {
    emit('update:modelValue', newValue)
    emit('save', newValue)
    toast.success('已保存', { duration: 2000 })
  } catch (err) {
    const errorMsg = (err as Error).message || '保存失败'
    error.value = errorMsg
    toast.error(errorMsg)
  } finally {
    saving.value = false
    isOpen.value = false
  }
}

// Handle blur
const handleBlur = () => {
  // Small delay to allow click events to fire
  setTimeout(() => {
    isOpen.value = false
  }, 150)
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
  handleClick()
}
</script>

<template>
  <div
    :class="[
      'inline-edit-date',
      {
        'inline-edit-date--open': isOpen,
        'inline-edit-date--saving': saving,
        'inline-edit-date--error': error,
        'inline-edit-date--readonly': readonly,
        'inline-edit-date--empty': isEmpty
      }
    ]"
  >
    <!-- Native date input (hidden when not editing) -->
    <input
      v-if="isOpen"
      ref="inputRef"
      type="date"
      class="inline-edit-date__input"
      :value="modelValue"
      :disabled="saving"
      @change="handleChange"
      @blur="handleBlur"
    />

    <!-- View Mode -->
    <div
      v-else
      class="inline-edit-date__view"
      :tabindex="readonly ? -1 : 0"
      role="button"
      :aria-label="isEmpty ? placeholder : `${displayValue}, 点击选择日期`"
      @click="handleClick"
      @keydown="handleViewKeydown"
    >
      <svg class="inline-edit-date__calendar-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
      <span v-if="isEmpty" class="inline-edit-date__placeholder">{{ placeholder }}</span>
      <span v-else class="inline-edit-date__value">{{ displayValue }}</span>
      <span v-if="saving" class="inline-edit-date__spinner">
        <svg class="spinner-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10" stroke-dasharray="60" stroke-dashoffset="20" />
        </svg>
      </span>
      <span v-else-if="!readonly" class="inline-edit-date__icon">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
      </span>
    </div>

    <!-- Error State -->
    <div v-if="error" class="inline-edit-date__error">
      <span class="inline-edit-date__error-message">{{ error }}</span>
      <button class="inline-edit-date__retry" @click="retry">重试</button>
    </div>
  </div>
</template>

<style scoped>
.inline-edit-date {
  position: relative;
  display: inline-flex;
  flex-direction: column;
}

/* View Mode */
.inline-edit-date__view {
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

.inline-edit-date__view:focus {
  outline: none;
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.3);
}

.inline-edit-date:not(.inline-edit-date--readonly) .inline-edit-date__view:hover {
  background: rgba(37, 99, 235, 0.05);
}

.inline-edit-date__calendar-icon {
  color: #64748b;
  flex-shrink: 0;
}

.inline-edit-date__value {
  color: inherit;
}

.inline-edit-date__placeholder {
  color: #9ca3af;
  font-style: italic;
}

/* Pencil Icon */
.inline-edit-date__icon {
  opacity: 0;
  color: #94a3b8;
  transition: opacity 0.2s, color 0.2s;
  flex-shrink: 0;
}

.inline-edit-date:not(.inline-edit-date--readonly) .inline-edit-date__view:hover .inline-edit-date__icon,
.inline-edit-date:not(.inline-edit-date--readonly) .inline-edit-date__view:focus .inline-edit-date__icon {
  opacity: 1;
}

.inline-edit-date:not(.inline-edit-date--readonly) .inline-edit-date__view:hover .inline-edit-date__icon {
  color: #2563eb;
}

/* Touch devices */
@media (hover: none) {
  .inline-edit-date:not(.inline-edit-date--readonly) .inline-edit-date__icon {
    opacity: 0.5;
  }
}

/* Native date input */
.inline-edit-date__input {
  padding: 4px 8px;
  margin: -4px -8px;
  border: none;
  border-radius: 6px;
  background: white;
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.3);
  font: inherit;
  color: inherit;
  outline: none;
}

.inline-edit-date__input:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

/* Spinner */
.inline-edit-date__spinner {
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
.inline-edit-date__error {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
  font-size: 12px;
}

.inline-edit-date__error-message {
  color: #ef4444;
}

.inline-edit-date__retry {
  padding: 2px 8px;
  border: 1px solid #ef4444;
  border-radius: 4px;
  background: white;
  color: #ef4444;
  font-size: 12px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.inline-edit-date__retry:hover {
  background: #fef2f2;
}

/* Readonly */
.inline-edit-date--readonly .inline-edit-date__view {
  cursor: default;
}
</style>
