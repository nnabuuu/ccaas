<script setup lang="ts">
/**
 * InlineEditNumber - Inline editable number input with validation and auto-save
 *
 * A numeric input component that displays a number until clicked, then becomes editable.
 * Supports min/max validation, step increments, and optional suffix (e.g., "minutes", "items").
 *
 * @example
 * <InlineEditNumber v-model="duration" :min="0" :max="60" suffix="分钟" @save="handleSave" />
 */
import { ref, computed, watch, nextTick } from 'vue'
import { useInlineAutoSave } from '../../composables/useAutoSave'

const props = defineProps({
  modelValue: {
    type: [Number, String],
    default: null
  },
  placeholder: {
    type: String,
    default: '输入数值'
  },
  readonly: {
    type: Boolean,
    default: false
  },
  min: {
    type: Number,
    default: null
  },
  max: {
    type: Number,
    default: null
  },
  step: {
    type: Number,
    default: 1
  },
  suffix: {
    type: String,
    default: '' // e.g., '分钟', '个'
  }
})

const emit = defineEmits(['update:modelValue', 'save'])

const inputRef = ref<HTMLInputElement | null>(null)

// Validation function
const validate = (value: string | number | null) => {
  if (value === null || value === '') return true
  const num = Number(value)
  if (isNaN(num)) return '请输入有效数字'
  if (props.min !== null && num < props.min) return `不能小于 ${props.min}`
  if (props.max !== null && num > props.max) return `不能大于 ${props.max}`
  return true
}

// Use the inline auto-save composable
const {
  isEditing,
  editValue,
  saving,
  error,
  startEdit,
  cancel,
  commit,
  retry,
  setValue
} = useInlineAutoSave({
  initialValue: props.modelValue,
  onSave: async (value) => {
    const numValue = value === '' || value === null ? null : Number(value)
    emit('update:modelValue', numValue)
    emit('save', numValue)
  },
  validate,
  showToast: true
})

// Watch for external model value changes
watch(() => props.modelValue, (newValue) => {
  setValue(newValue)
})

// Display value (for view mode)
const displayValue = computed(() => {
  if (props.modelValue === null || props.modelValue === '') return ''
  return `${props.modelValue}${props.suffix}`
})

// Is empty (show placeholder)
const isEmpty = computed(() => {
  return props.modelValue === null || props.modelValue === ''
})

// Handle click to start editing
const handleClick = () => {
  if (props.readonly) return
  startEdit()
  nextTick(() => {
    inputRef.value?.focus()
    inputRef.value?.select()
  })
}

// Handle blur to save
const handleBlur = () => {
  commit()
}

// Handle keyboard
const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Enter') {
    event.preventDefault()
    commit()
  } else if (event.key === 'Escape') {
    event.preventDefault()
    cancel()
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
</script>

<template>
  <div
    :class="[
      'inline-edit-number',
      {
        'inline-edit-number--editing': isEditing,
        'inline-edit-number--saving': saving,
        'inline-edit-number--error': error,
        'inline-edit-number--readonly': readonly,
        'inline-edit-number--empty': isEmpty
      }
    ]"
  >
    <!-- Edit Mode -->
    <div v-if="isEditing" class="inline-edit-number__edit">
      <input
        ref="inputRef"
        v-model="editValue"
        type="number"
        class="inline-edit-number__input"
        :placeholder="placeholder"
        :min="min"
        :max="max"
        :step="step"
        :disabled="saving"
        @blur="handleBlur"
        @keydown="handleKeydown"
      />
      <span v-if="suffix" class="inline-edit-number__suffix">{{ suffix }}</span>
      <span v-if="saving" class="inline-edit-number__spinner">
        <svg class="spinner-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10" stroke-dasharray="60" stroke-dashoffset="20" />
        </svg>
      </span>
    </div>

    <!-- View Mode -->
    <div
      v-else
      class="inline-edit-number__view"
      :tabindex="readonly ? -1 : 0"
      role="button"
      :aria-label="isEmpty ? placeholder : `${displayValue}, 点击编辑`"
      @click="handleClick"
      @keydown="handleViewKeydown"
    >
      <span v-if="isEmpty" class="inline-edit-number__placeholder">{{ placeholder }}</span>
      <span v-else class="inline-edit-number__value">{{ displayValue }}</span>
      <span v-if="!readonly" class="inline-edit-number__icon">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
      </span>
    </div>

    <!-- Error State -->
    <div v-if="error" class="inline-edit-number__error">
      <span class="inline-edit-number__error-message">{{ error }}</span>
      <button class="inline-edit-number__retry" @click="retry">重试</button>
    </div>
  </div>
</template>

<style scoped>
.inline-edit-number {
  position: relative;
  display: inline-flex;
  flex-direction: column;
}

/* View Mode */
.inline-edit-number__view {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  margin: -4px -8px;
  border-radius: 6px;
  cursor: text;
  transition: background-color 0.2s, box-shadow 0.2s;
  font-size: 14px;
}

.inline-edit-number__view:focus {
  outline: none;
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.3);
}

.inline-edit-number:not(.inline-edit-number--readonly) .inline-edit-number__view:hover {
  background: rgba(37, 99, 235, 0.05);
}

.inline-edit-number__value {
  color: inherit;
}

.inline-edit-number__placeholder {
  color: #9ca3af;
  font-style: italic;
}

/* Pencil Icon */
.inline-edit-number__icon {
  opacity: 0;
  color: #94a3b8;
  transition: opacity 0.2s, color 0.2s;
  flex-shrink: 0;
}

.inline-edit-number:not(.inline-edit-number--readonly) .inline-edit-number__view:hover .inline-edit-number__icon,
.inline-edit-number:not(.inline-edit-number--readonly) .inline-edit-number__view:focus .inline-edit-number__icon {
  opacity: 1;
}

.inline-edit-number:not(.inline-edit-number--readonly) .inline-edit-number__view:hover .inline-edit-number__icon {
  color: #2563eb;
}

/* Touch devices */
@media (hover: none) {
  .inline-edit-number:not(.inline-edit-number--readonly) .inline-edit-number__icon {
    opacity: 0.5;
  }
}

/* Edit Mode */
.inline-edit-number__edit {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  position: relative;
}

.inline-edit-number__input {
  width: 80px;
  padding: 4px 8px;
  margin: -4px 0 -4px -8px;
  border: none;
  border-radius: 6px;
  background: white;
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.3);
  font: inherit;
  color: inherit;
  outline: none;
}

/* Hide spinner buttons */
.inline-edit-number__input::-webkit-inner-spin-button,
.inline-edit-number__input::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.inline-edit-number__input[type=number] {
  -moz-appearance: textfield;
}

.inline-edit-number__input:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.inline-edit-number__suffix {
  color: #64748b;
  font-size: 14px;
}

.inline-edit-number__spinner {
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
.inline-edit-number__error {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
  font-size: 12px;
}

.inline-edit-number__error-message {
  color: #ef4444;
}

.inline-edit-number__retry {
  padding: 2px 8px;
  border: 1px solid #ef4444;
  border-radius: 4px;
  background: white;
  color: #ef4444;
  font-size: 12px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.inline-edit-number__retry:hover {
  background: #fef2f2;
}

/* Readonly */
.inline-edit-number--readonly .inline-edit-number__view {
  cursor: default;
}
</style>
