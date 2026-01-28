<script setup lang="ts">
/**
 * MarkdownSection - Rich markdown editor/viewer with image upload support
 *
 * Uses md-editor-v3 for markdown editing with toolbar and preview.
 * Supports image uploads via OSS API integration.
 *
 * @example
 * <MarkdownSection v-model="content" :readonly="false" title="Section Title" />
 */
import { MdEditor, MdPreview, type ToolbarNames } from 'md-editor-v3'
import 'md-editor-v3/lib/style.css'
import { ossApi } from '../../api/index'
import { useAiHighlight } from '../../agent/useAiHighlight'

interface UploadResult {
  url: string
  alt: string
  title: string
}

const props = defineProps({
  id: { type: String, default: '' },
  title: { type: String, default: '' },
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: '请输入内容，支持 Markdown 格式...' },
  readonly: { type: Boolean, default: false },
  previewTheme: { type: String, default: 'default' },
  hideTitle: { type: Boolean, default: false }
})

const emit = defineEmits(['update:modelValue'])

// AI update highlighting - triggers when this field is updated by AI
const { isHighlighted: isAiUpdated } = useAiHighlight(props.id)

// Standard toolbar
const toolbars: ToolbarNames[] = [
  'bold', 'italic', 'strikeThrough',
  '-',
  'title', 'quote',
  '-',
  'unorderedList', 'orderedList',
  '-',
  'link', 'image', 'table',
  '-',
  'preview'
]

// Handle image upload (paste or toolbar)
const onUploadImg = async (files: File[], callback: (results: UploadResult[]) => void) => {
  const results = await Promise.all(
    files.map(async (file): Promise<UploadResult | null> => {
      try {
        const response = await ossApi.upload(file)
        // Handle both wrapped and unwrapped response formats
        const wrappedResponse = response as { data?: { url: string; fileName: string } }
        const unwrappedResponse = response as unknown as { url: string; fileName: string }
        const data = wrappedResponse.data || unwrappedResponse
        return {
          url: data.url,
          alt: data.fileName || file.name,
          title: data.fileName || file.name
        }
      } catch (error) {
        console.error('Image upload failed:', error)
        return null
      }
    })
  )
  // Filter out failed uploads and call callback with successful ones
  callback(results.filter((r): r is UploadResult => r !== null))
}
</script>

<template>
  <section :id="id" class="markdown-section" :class="{ 'no-margin': hideTitle, 'ai-updated': isAiUpdated }">
    <h2 v-if="!hideTitle && title" class="section-title">{{ title }}</h2>
    <div class="section-content">
      <!-- Edit mode with toolbar -->
      <MdEditor
        v-if="!readonly"
        :editor-id="`md-editor-${id}`"
        :model-value="modelValue"
        @update:model-value="emit('update:modelValue', $event)"
        language="zh-CN"
        :toolbars="toolbars"
        :placeholder="placeholder"
        :preview="false"
        :footers="[]"
        :scrollAuto="false"
        :noMermaid="true"
        @on-upload-img="onUploadImg"
        class="md-editor-custom"
      />

      <!-- Preview only mode -->
      <template v-else>
        <MdPreview
          v-if="modelValue"
          :model-value="modelValue"
          :preview-theme="previewTheme"
          :noMermaid="true"
          class="md-preview-custom"
        />
        <p v-else class="empty-content">暂无内容</p>
      </template>
    </div>
  </section>
</template>

<style scoped>
.markdown-section {
  margin-bottom: 32px;
  scroll-margin-top: 120px;
  border-radius: 12px;
  padding: 16px;
  margin-left: -16px;
  margin-right: -16px;
  transition: background-color 0.3s ease, box-shadow 0.3s ease;
}

.markdown-section.no-margin {
  margin-bottom: 0;
}

/* Section highlight animation for scroll-to-section */
.markdown-section.section-highlight {
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

/* AI update highlight animation - green pulse that fades out */
.markdown-section.ai-updated {
  border-left: 3px solid #10b981;
  background-color: rgba(16, 185, 129, 0.1);
  animation: ai-highlight 3s ease-out forwards;
}

@keyframes ai-highlight {
  0% {
    background-color: rgba(16, 185, 129, 0.15);
    box-shadow: inset 0 0 0 2px rgba(16, 185, 129, 0.3);
  }
  70% {
    background-color: rgba(16, 185, 129, 0.1);
    box-shadow: inset 0 0 0 1px rgba(16, 185, 129, 0.2);
  }
  100% {
    background-color: transparent;
    box-shadow: none;
  }
}

.markdown-section:last-child {
  margin-bottom: 0;
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

.empty-content {
  color: #9ca3af;
  font-style: italic;
  padding: 16px;
}

/* Editor customization */
.md-editor-custom {
  --md-bk-color: #fff;
  --md-border-color: #e2e8f0;
  border-radius: 8px;
}

.md-editor-custom :deep(.md-editor-toolbar) {
  border-bottom: 1px solid #e2e8f0;
}

.md-editor-custom :deep(.md-editor-input-wrapper) {
  min-height: 150px;
}

/* Preview customization */
.md-preview-custom {
  background: #f8fafc;
  border-radius: 8px;
  padding: 16px;
}

.md-preview-custom :deep(h1),
.md-preview-custom :deep(h2),
.md-preview-custom :deep(h3) {
  color: #0f172a;
  margin-top: 16px;
  margin-bottom: 8px;
}

.md-preview-custom :deep(h1) {
  font-size: 1.5em;
}

.md-preview-custom :deep(h2) {
  font-size: 1.25em;
}

.md-preview-custom :deep(h3) {
  font-size: 1.1em;
}

.md-preview-custom :deep(ul),
.md-preview-custom :deep(ol) {
  padding-left: 24px;
  margin: 8px 0;
}

.md-preview-custom :deep(li) {
  margin: 4px 0;
}

.md-preview-custom :deep(p) {
  margin: 8px 0;
  line-height: 1.8;
}

.md-preview-custom :deep(strong) {
  font-weight: 600;
}

.md-preview-custom :deep(blockquote) {
  border-left: 4px solid #e2e8f0;
  padding-left: 16px;
  margin: 12px 0;
  color: #64748b;
}
</style>
