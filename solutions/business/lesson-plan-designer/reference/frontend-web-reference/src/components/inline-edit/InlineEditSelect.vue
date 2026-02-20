<script setup lang="ts">
/**
 * InlineEditSelect - Inline editable dropdown selector with auto-save
 *
 * A select dropdown component that displays the selected option label until clicked,
 * then shows a native select element. Auto-saves on selection change.
 *
 * @example
 * <InlineEditSelect v-model="status" :options="[{value: 'active', label: 'Active'}]" @save="handleSave" />
 */
import { ref, computed, nextTick, type PropType } from 'vue'
import toast from '../../utils/toast'

interface SelectOption {
  value: string | number
  label: string
}

const props = defineProps({
  modelValue: {
    type: [String, Number] as PropType<string | number>,
    default: ''
  },
  options: {
    type: Array as PropType<SelectOption[]>,
    required: true,
    validator: (arr: SelectOption[]) => arr.every(opt => 'value' in opt && 'label' in opt)
  },
  placeholder: {
    type: String,
    default: '请选择'
  },
  readonly: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits<{
  'update:modelValue': [value: string | number]
  'save': [value: string | number]
}>()

const selectRef = ref<HTMLSelectElement | null>(null)
const isOpen = ref(false)
const saving = ref(false)
const error = ref<string | null>(null)

// Get display label for current value
const displayLabel = computed(() => {
  const option = props.options.find(opt => opt.value === props.modelValue)
  return option ? option.label : ''
})

const isEmpty = computed(() => {
  return props.modelValue === '' || props.modelValue === null || props.modelValue === undefined
})

// Handle click to open dropdown
const handleClick = () => {
  if (props.readonly) return
  isOpen.value = true
  error.value = null
  nextTick(() => {
    selectRef.value?.focus()
  })
}

// Handle selection change
const handleChange = async (event: Event) => {
  const target = event.target as HTMLSelectElement
  const newValue = target.value
  if (newValue === String(props.modelValue)) {
    isOpen.value = false
    return
  }

  saving.value = true
  error.value = null

  try {
    emit('update:modelValue', newValue)
    emit('save', newValue)
    toast.success('已保存', { duration: 2000 })
  } catch (err: unknown) {
    const errObj = err as Error
    error.value = errObj.message || '保存失败'
    toast.error(error.value)
  } finally {
    saving.value = false
    isOpen.value = false
  }
}

// Handle blur
const handleBlur = () => {
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
      'inline-edit-select',
      {
        'inline-edit-select--open': isOpen,
        'inline-edit-select--saving': saving,
        'inline-edit-select--error': error,
        'inline-edit-select--readonly': readonly,
        'inline-edit-select--empty': isEmpty
      }
    ]"
  >
    <!-- Native select (hidden when not editing) -->
    <select
      v-if="isOpen"
      ref="selectRef"
      class="inline-edit-select__select"
      :value="modelValue"
      :disabled="saving"
      @change="handleChange"
      @blur="handleBlur"
    >
      <option v-if="isEmpty" value="" disabled>{{ placeholder }}</option>
      <option
        v-for="option in options"
        :key="option.value"
        :value="option.value"
      >
        {{ option.label }}
      </option>
    </select>

    <!-- View Mode -->
    <div
      v-else
      class="inline-edit-select__view"
      :tabindex="readonly ? -1 : 0"
      role="button"
      :aria-label="isEmpty ? placeholder : `${displayLabel}, 点击选择`"
      @click="handleClick"
      @keydown="handleViewKeydown"
    >
      <span v-if="isEmpty" class="inline-edit-select__placeholder">{{ placeholder }}</span>
      <span v-else class="inline-edit-select__value">{{ displayLabel }}</span>
      <span v-if="saving" class="inline-edit-select__spinner">
        <svg class="spinner-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10" stroke-dasharray="60" stroke-dashoffset="20" />
        </svg>
      </span>
      <span v-else-if="!readonly" class="inline-edit-select__chevron">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </span>
    </div>

    <!-- Error State -->
    <div v-if="error" class="inline-edit-select__error">
      <span class="inline-edit-select__error-message">{{ error }}</span>
      <button class="inline-edit-select__retry" @click="retry">重试</button>
    </div>
  </div>
</template>

<style scoped>
.inline-edit-select {
  position: relative;
  display: inline-flex;
  flex-direction: column;
}

/* View Mode */
.inline-edit-select__view {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  margin: -4px -8px;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.2s, box-shadow 0.2s;
  font-size: 14px;
}

.inline-edit-select__view:focus {
  outline: none;
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.3);
}

.inline-edit-select:not(.inline-edit-select--readonly) .inline-edit-select__view:hover {
  background: rgba(37, 99, 235, 0.05);
}

.inline-edit-select__value {
  color: inherit;
}

.inline-edit-select__placeholder {
  color: #9ca3af;
  font-style: italic;
}

/* Chevron Icon */
.inline-edit-select__chevron {
  opacity: 0;
  color: #94a3b8;
  transition: opacity 0.2s, color 0.2s;
  flex-shrink: 0;
}

.inline-edit-select:not(.inline-edit-select--readonly) .inline-edit-select__view:hover .inline-edit-select__chevron,
.inline-edit-select:not(.inline-edit-select--readonly) .inline-edit-select__view:focus .inline-edit-select__chevron {
  opacity: 1;
}

.inline-edit-select:not(.inline-edit-select--readonly) .inline-edit-select__view:hover .inline-edit-select__chevron {
  color: #2563eb;
}

/* Touch devices */
@media (hover: none) {
  .inline-edit-select:not(.inline-edit-select--readonly) .inline-edit-select__chevron {
    opacity: 0.5;
  }
}

/* Native select */
.inline-edit-select__select {
  padding: 4px 24px 4px 8px;
  margin: -4px -8px;
  border: none;
  border-radius: 6px;
  background: white;
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.3);
  font: inherit;
  color: inherit;
  outline: none;
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 8px center;
}

.inline-edit-select__select:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

/* Spinner */
.inline-edit-select__spinner {
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
.inline-edit-select__error {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
  font-size: 12px;
}

.inline-edit-select__error-message {
  color: #ef4444;
}

.inline-edit-select__retry {
  padding: 2px 8px;
  border: 1px solid #ef4444;
  border-radius: 4px;
  background: white;
  color: #ef4444;
  font-size: 12px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.inline-edit-select__retry:hover {
  background: #fef2f2;
}

/* Readonly */
.inline-edit-select--readonly .inline-edit-select__view {
  cursor: default;
}
</style>
