<script setup lang="ts">
/**
 * EditorSection - Generic section editor with textarea input and readonly display
 *
 * Simple text-based section component with editable and readonly modes.
 * Used for straightforward text input sections without rich formatting.
 *
 * @example
 * <EditorSection id="section1" title="Section Title" v-model="content" :readonly="false" />
 */
defineProps({
  id: { type: String, required: true },
  title: { type: String, required: true },
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: '请输入内容...' },
  rows: { type: Number, default: 4 },
  readonly: { type: Boolean, default: false }
})

defineEmits(['update:modelValue'])
</script>

<template>
  <section :id="id" class="editor-section">
    <h2 class="section-title">{{ title }}</h2>
    <div class="section-content">
      <!-- Edit mode -->
      <textarea
        v-if="!readonly"
        :value="modelValue"
        :rows="rows"
        :placeholder="placeholder"
        @input="$emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
      ></textarea>
      <!-- Readonly mode -->
      <template v-else>
        <p v-if="modelValue" class="content-text">{{ modelValue }}</p>
        <p v-else class="empty-content">暂无内容</p>
      </template>
    </div>
  </section>
</template>

<style scoped>
.editor-section {
  margin-bottom: 32px;
  scroll-margin-top: 120px;
  border-radius: 12px;
  padding: 16px;
  margin-left: -16px;
  margin-right: -16px;
  transition: background-color 0.3s ease, box-shadow 0.3s ease;
}

.editor-section:last-child {
  margin-bottom: 0;
}

/* Section highlight animation for scroll-to-section */
.editor-section.section-highlight {
  background-color: rgba(37, 99, 235, 0.08);
  box-shadow: inset 0 0 0 2px rgba(37, 99, 235, 0.3);
  animation: highlight-pulse 2s ease-out;
}

@keyframes highlight-pulse {
  0% {
    background-color: rgba(37, 99, 235, 0.15);
    box-shadow: inset 0 0 0 2px rgba(37, 99, 235, 0.5);
  }
  100% {
    background-color: rgba(37, 99, 235, 0.08);
    box-shadow: inset 0 0 0 2px rgba(37, 99, 235, 0.3);
  }
}

.section-title {
  font-size: 18px;
  font-weight: 600;
  color: #0f172a;
  margin-bottom: 16px;
}

.section-content {
  color: #334155;
  line-height: 1.6;
}

.section-content textarea {
  width: 100%;
  padding: 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  line-height: 1.6;
  resize: vertical;
  font-family: inherit;
  box-sizing: border-box;
}

.section-content textarea:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.content-text {
  font-size: 14px;
  line-height: 1.8;
  color: #334155;
  white-space: pre-wrap;
}

.empty-content {
  color: #9ca3af;
  font-style: italic;
}
</style>
