<script setup lang="ts">
/**
 * SyncButton Component
 *
 * Button to sync AI-generated content to form fields.
 * Shows what will be synced and supports undo.
 */
import { computed, ref } from 'vue'
import { Button, Tooltip, Space, Typography } from 'ant-design-vue'
import { SyncOutlined, UndoOutlined, CheckOutlined } from '@ant-design/icons-vue'
import type { LessonPlanSyncField } from '@ccaas/shared'

const props = defineProps<{
  field: LessonPlanSyncField
  fieldLabel: string
  pendingValue: unknown
  canUndo: boolean
  isApplied?: boolean
}>()

const emit = defineEmits<{
  (e: 'apply'): void
  (e: 'undo'): void
  (e: 'discard'): void
}>()

const applying = ref(false)

const previewText = computed(() => {
  const value = props.pendingValue
  if (typeof value === 'string') {
    return value.length > 50 ? `${value.slice(0, 50)}...` : value
  }
  if (Array.isArray(value)) {
    return `${value.length} 项`
  }
  if (typeof value === 'object' && value !== null) {
    return 'AI生成内容'
  }
  return String(value)
})

async function handleApply() {
  applying.value = true
  try {
    emit('apply')
  } finally {
    applying.value = false
  }
}
</script>

<template>
  <div class="sync-button-container">
    <Space v-if="!isApplied">
      <Tooltip :title="`将AI生成的内容同步到「${fieldLabel}」字段`">
        <Button
          type="primary"
          size="small"
          :loading="applying"
          @click="handleApply"
        >
          <template #icon><SyncOutlined /></template>
          同步 {{ fieldLabel }}
        </Button>
      </Tooltip>
      <Typography.Text type="secondary" class="preview-text">
        {{ previewText }}
      </Typography.Text>
    </Space>
    <Space v-else>
      <Typography.Text type="success">
        <CheckOutlined /> 已同步 {{ fieldLabel }}
      </Typography.Text>
      <Button
        v-if="canUndo"
        size="small"
        @click="emit('undo')"
      >
        <template #icon><UndoOutlined /></template>
        撤销
      </Button>
    </Space>
  </div>
</template>

<style scoped>
.sync-button-container {
  display: inline-flex;
  align-items: center;
  padding: 4px 8px;
  background: #f6ffed;
  border: 1px solid #b7eb8f;
  border-radius: 4px;
  margin: 4px 0;
}

.preview-text {
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
