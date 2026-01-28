<script setup lang="ts">
/**
 * TextbookAnalysisEditor - Structured editor for the "教材分析" section
 *
 * Displays 4 sub-modules: coursePosition, keyPointsAnalysis, logicalStructure, teachingStrategies
 * Each module has a title and markdown content.
 *
 * @example
 * <TextbookAnalysisEditor v-model="textbookAnalysis" :readonly="false" />
 */
import { computed } from 'vue'
import { MdEditor, MdPreview, type ToolbarNames } from 'md-editor-v3'
import 'md-editor-v3/lib/style.css'
import type { TextbookAnalysisValue, TextbookAnalysisSection } from '@/types/lesson-plan'
import { isTextbookAnalysisValue, textbookAnalysisToMarkdown } from '@/types/lesson-plan'

const props = defineProps<{
  modelValue: TextbookAnalysisValue | string | null
  readonly?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: TextbookAnalysisValue]
}>()

// Section metadata with Chinese labels
const sectionMeta = [
  { key: 'coursePosition' as const, label: '教学内容的地位和作用', defaultTitle: '教学内容的地位和作用' },
  { key: 'keyPointsAnalysis' as const, label: '教学重点和难点分析', defaultTitle: '教学重点和难点分析' },
  { key: 'logicalStructure' as const, label: '教材内容的逻辑结构', defaultTitle: '教材内容的逻辑结构和知识关联' },
  { key: 'teachingStrategies' as const, label: '教学策略建议', defaultTitle: '教学策略建议' }
]

// Convert model value to structured format
const structuredValue = computed((): TextbookAnalysisValue => {
  if (!props.modelValue) {
    return {}
  }
  if (typeof props.modelValue === 'string') {
    // Legacy string format - wrap in a single section
    if (props.modelValue.trim()) {
      return {
        coursePosition: {
          title: '教学内容的地位和作用',
          content: props.modelValue
        }
      }
    }
    return {}
  }
  if (isTextbookAnalysisValue(props.modelValue)) {
    return props.modelValue
  }
  return {}
})

// Check if content is empty
const isEmpty = computed(() => {
  const v = structuredValue.value
  return !v.coursePosition && !v.keyPointsAnalysis && !v.logicalStructure && !v.teachingStrategies
})

// For readonly preview, convert to markdown
const markdownPreview = computed(() => {
  return textbookAnalysisToMarkdown(structuredValue.value)
})

// Toolbar for markdown editors
const toolbars: ToolbarNames[] = [
  'bold', 'italic', 'strikeThrough',
  '-',
  'title', 'quote',
  '-',
  'unorderedList', 'orderedList',
  '-',
  'link',
  '-',
  'preview'
]

// Get section content
const getSectionContent = (key: keyof TextbookAnalysisValue): string => {
  return structuredValue.value[key]?.content || ''
}

// Get section title
const getSectionTitle = (key: keyof TextbookAnalysisValue, defaultTitle: string): string => {
  return structuredValue.value[key]?.title || defaultTitle
}

// Update a section's content
const updateSectionContent = (key: keyof TextbookAnalysisValue, content: string, defaultTitle: string) => {
  const current = structuredValue.value
  const newValue: TextbookAnalysisValue = {
    ...current,
    [key]: {
      title: current[key]?.title || defaultTitle,
      content
    } as TextbookAnalysisSection
  }
  emit('update:modelValue', newValue)
}

// Check if a section has content
const hasSectionContent = (key: keyof TextbookAnalysisValue): boolean => {
  const section = structuredValue.value[key]
  return !!(section?.content?.trim())
}
</script>

<template>
  <div class="textbook-analysis-editor">
    <!-- Readonly mode: show as markdown preview -->
    <template v-if="readonly">
      <template v-if="isEmpty">
        <p class="empty-content">暂无教材分析内容</p>
      </template>
      <template v-else>
        <div class="analysis-sections-preview">
          <template v-for="meta in sectionMeta" :key="meta.key">
            <div v-if="hasSectionContent(meta.key)" class="section-preview">
              <h4 class="section-preview-title">{{ getSectionTitle(meta.key, meta.defaultTitle) }}</h4>
              <MdPreview
                :model-value="getSectionContent(meta.key)"
                preview-theme="default"
                :no-mermaid="true"
                class="md-preview-inline"
              />
            </div>
          </template>
        </div>
      </template>
    </template>

    <!-- Edit mode: show structured editors -->
    <template v-else>
      <div class="analysis-sections-edit">
        <div
          v-for="meta in sectionMeta"
          :key="meta.key"
          class="section-editor"
        >
          <div class="section-header">
            <span class="section-label">{{ meta.label }}</span>
          </div>
          <MdEditor
            :editor-id="`textbook-${meta.key}`"
            :model-value="getSectionContent(meta.key)"
            @update:model-value="updateSectionContent(meta.key, $event, meta.defaultTitle)"
            language="zh-CN"
            :toolbars="toolbars"
            :placeholder="`请输入${meta.label}...`"
            :preview="false"
            :footers="[]"
            :scroll-auto="false"
            :no-mermaid="true"
            class="md-editor-section"
          />
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.textbook-analysis-editor {
  width: 100%;
}

.empty-content {
  color: #9ca3af;
  font-style: italic;
  padding: 16px;
  text-align: center;
}

/* Preview mode styles */
.analysis-sections-preview {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.section-preview {
  background: #f8fafc;
  border-radius: 8px;
  padding: 16px;
  border-left: 3px solid #2563eb;
}

.section-preview-title {
  font-size: 16px;
  font-weight: 600;
  color: #1e40af;
  margin: 0 0 12px 0;
}

.md-preview-inline {
  background: transparent;
  padding: 0;
}

.md-preview-inline :deep(p) {
  margin: 8px 0;
  line-height: 1.8;
  color: #334155;
}

.md-preview-inline :deep(h1),
.md-preview-inline :deep(h2),
.md-preview-inline :deep(h3),
.md-preview-inline :deep(h4) {
  color: #0f172a;
  margin-top: 12px;
  margin-bottom: 8px;
}

.md-preview-inline :deep(ul),
.md-preview-inline :deep(ol) {
  padding-left: 24px;
  margin: 8px 0;
}

.md-preview-inline :deep(li) {
  margin: 4px 0;
  color: #334155;
}

.md-preview-inline :deep(strong) {
  font-weight: 600;
  color: #0f172a;
}

.md-preview-inline :deep(blockquote) {
  border-left: 4px solid #e2e8f0;
  padding-left: 16px;
  margin: 12px 0;
  color: #64748b;
}

/* Edit mode styles */
.analysis-sections-edit {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.section-editor {
  background: #f8fafc;
  border-radius: 8px;
  padding: 16px;
  border: 1px solid #e2e8f0;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.section-editor:focus-within {
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.section-header {
  margin-bottom: 12px;
}

.section-label {
  font-size: 14px;
  font-weight: 600;
  color: #1e40af;
}

.md-editor-section {
  --md-bk-color: #fff;
  --md-border-color: #e2e8f0;
  border-radius: 6px;
}

.md-editor-section :deep(.md-editor-toolbar) {
  border-bottom: 1px solid #e2e8f0;
  background: #fafbfc;
  border-radius: 6px 6px 0 0;
}

.md-editor-section :deep(.md-editor-input-wrapper) {
  min-height: 100px;
}

.md-editor-section :deep(.md-editor-footer) {
  display: none;
}
</style>
