<script setup lang="ts">
/**
 * InlineEditText - Inline editable text input with auto-save
 *
 * A text input component that appears as static text until clicked, then becomes editable.
 * Supports different variants (default, title, subtitle) and auto-saves on blur or Enter key.
 *
 * @example
 * <InlineEditText v-model="title" variant="title" placeholder="Enter title" @save="handleSave" />
 */
import { ref, computed, watch, nextTick } from 'vue'
import { useInlineAutoSave } from '../../composables/useAutoSave'

const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  placeholder: {
    type: String,
    default: '点击输入...'
  },
  readonly: {
    type: Boolean,
    default: false
  },
  maxLength: {
    type: Number,
    default: null
  },
  // For title/heading styling
  variant: {
    type: String,
    default: 'default', // 'default' | 'title' | 'subtitle'
    validator: (v: string) => ['default', 'title', 'subtitle'].includes(v)
  }
})

const emit = defineEmits(['update:modelValue', 'save'])

const inputRef = ref<HTMLInputElement | null>(null)

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
    emit('update:modelValue', value)
    emit('save', value)
  },
  showToast: true
})

// Watch for external model value changes
watch(() => props.modelValue, (newValue) => {
  setValue(newValue)
})

// Display value (for view mode)
const displayValue = computed(() => {
  return props.modelValue || ''
})

// Is empty (show placeholder)
const isEmpty = computed(() => {
  return !displayValue.value
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
      'inline-edit-text',
      `inline-edit-text--${variant}`,
      {
        'inline-edit-text--editing': isEditing,
        'inline-edit-text--saving': saving,
        'inline-edit-text--error': error,
        'inline-edit-text--readonly': readonly,
        'inline-edit-text--empty': isEmpty
      }
    ]"
  >
    <!-- Edit Mode -->
    <div v-if="isEditing" class="inline-edit-text__edit">
      <input
        ref="inputRef"
        v-model="editValue"
        type="text"
        class="inline-edit-text__input"
        :placeholder="placeholder"
        :maxlength="maxLength"
        :disabled="saving"
        @blur="handleBlur"
        @keydown="handleKeydown"
      />
      <span v-if="saving" class="inline-edit-text__spinner">
        <svg class="spinner-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10" stroke-dasharray="60" stroke-dashoffset="20" />
        </svg>
      </span>
    </div>

    <!-- View Mode -->
    <div
      v-else
      class="inline-edit-text__view"
      :tabindex="readonly ? -1 : 0"
      role="button"
      :aria-label="isEmpty ? placeholder : `${displayValue}, 点击编辑`"
      @click="handleClick"
      @keydown="handleViewKeydown"
    >
      <span v-if="isEmpty" class="inline-edit-text__placeholder">{{ placeholder }}</span>
      <span v-else class="inline-edit-text__value">{{ displayValue }}</span>
      <span v-if="!readonly" class="inline-edit-text__icon">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
      </span>
    </div>

    <!-- Error State -->
    <div v-if="error" class="inline-edit-text__error">
      <span class="inline-edit-text__error-message">{{ error }}</span>
      <button class="inline-edit-text__retry" @click="retry">重试</button>
    </div>
  </div>
</template>

<style scoped>
.inline-edit-text {
  position: relative;
  display: inline-flex;
  flex-direction: column;
  min-width: 100px;
}

/* View Mode */
.inline-edit-text__view {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  margin: -4px -8px;
  border-radius: 6px;
  cursor: text;
  transition: background-color 0.2s, box-shadow 0.2s;
}

.inline-edit-text__view:focus {
  outline: none;
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.3);
}

.inline-edit-text:not(.inline-edit-text--readonly) .inline-edit-text__view:hover {
  background: rgba(37, 99, 235, 0.05);
}

.inline-edit-text__value {
  color: inherit;
}

.inline-edit-text__placeholder {
  color: #9ca3af;
  font-style: italic;
}

/* Pencil Icon */
.inline-edit-text__icon {
  opacity: 0;
  color: #94a3b8;
  transition: opacity 0.2s, color 0.2s;
  flex-shrink: 0;
}

.inline-edit-text:not(.inline-edit-text--readonly) .inline-edit-text__view:hover .inline-edit-text__icon,
.inline-edit-text:not(.inline-edit-text--readonly) .inline-edit-text__view:focus .inline-edit-text__icon {
  opacity: 1;
}

.inline-edit-text:not(.inline-edit-text--readonly) .inline-edit-text__view:hover .inline-edit-text__icon {
  color: #2563eb;
}

/* Touch devices: always show icon */
@media (hover: none) {
  .inline-edit-text:not(.inline-edit-text--readonly) .inline-edit-text__icon {
    opacity: 0.5;
  }
}

/* Edit Mode */
.inline-edit-text__edit {
  display: inline-flex;
  align-items: center;
  position: relative;
}

.inline-edit-text__input {
  width: 100%;
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

.inline-edit-text__input:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.inline-edit-text__spinner {
  position: absolute;
  right: 8px;
  color: #2563eb;
}

.spinner-icon {
  width: 16px;
  height: 16px;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Error State */
.inline-edit-text__error {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
  font-size: 12px;
}

.inline-edit-text__error-message {
  color: #ef4444;
}

.inline-edit-text__retry {
  padding: 2px 8px;
  border: 1px solid #ef4444;
  border-radius: 4px;
  background: white;
  color: #ef4444;
  font-size: 12px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.inline-edit-text__retry:hover {
  background: #fef2f2;
}

/* Variant: Title */
.inline-edit-text--title .inline-edit-text__value,
.inline-edit-text--title .inline-edit-text__placeholder,
.inline-edit-text--title .inline-edit-text__input {
  font-size: 24px;
  font-weight: 700;
  line-height: 1.2;
}

/* Variant: Subtitle */
.inline-edit-text--subtitle .inline-edit-text__value,
.inline-edit-text--subtitle .inline-edit-text__placeholder,
.inline-edit-text--subtitle .inline-edit-text__input {
  font-size: 14px;
  color: #64748b;
}

/* Readonly */
.inline-edit-text--readonly .inline-edit-text__view {
  cursor: default;
}
</style>
