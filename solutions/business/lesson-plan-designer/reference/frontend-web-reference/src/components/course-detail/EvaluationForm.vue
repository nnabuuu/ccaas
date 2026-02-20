<script setup lang="ts">
import { ref, computed, type PropType } from 'vue'
import StarRating from '../StarRating.vue'

const props = defineProps({
  type: {
    type: String as PropType<'lesson' | 'teaching'>,
    required: true,
    validator: (v: string) => ['lesson', 'teaching'].includes(v)
  },
  lessonPlanTitle: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['submit', 'cancel'])

const lessonPlanDimensions = [
  { key: 'objectiveDesignScore', label: '教学目标设计', desc: '目标明确、可测量、与课标对齐' },
  { key: 'contentOrganizationScore', label: '教学内容组织', desc: '内容结构清晰、重难点突出' },
  { key: 'taskDesignScore', label: '学习任务设计', desc: '任务有层次、促进主动学习' },
  { key: 'homeworkDesignScore', label: '作业设计', desc: '作业与目标匹配、难度适当' },
  { key: 'resourcePreparationScore', label: '资源准备', desc: '教具、课件、素材准备充分' }
]

const teachingDimensions = [
  { key: 'introductionScore', label: '课堂导入', desc: '导入吸引学生注意、与主题关联' },
  { key: 'processControlScore', label: '教学过程把控', desc: '环节流畅、节奏适当' },
  { key: 'interactionScore', label: '师生互动', desc: '提问有效、反馈及时' },
  { key: 'timeManagementScore', label: '时间管理', desc: '各环节时间分配合理' },
  { key: 'visualAidsScore', label: '板书/PPT运用', desc: '视觉辅助清晰、有效' }
]

const dimensions = computed(() => {
  return props.type === 'lesson' ? lessonPlanDimensions : teachingDimensions
})

const title = computed(() => {
  return props.type === 'lesson' ? '教案评价' : '授课评价'
})

const subtitle = computed(() => {
  if (props.type === 'lesson' && props.lessonPlanTitle) {
    return `评价教案：${props.lessonPlanTitle}`
  }
  return props.type === 'lesson' ? '请对教案进行评价' : '请对授课表现进行评价'
})

// Form state
const scores = ref<Record<string, number>>({})
const comment = ref('')
const submitting = ref(false)

// Initialize scores
dimensions.value.forEach(d => {
  scores.value[d.key] = 0
})

const allScoresFilled = computed(() => {
  return dimensions.value.every(d => scores.value[d.key] > 0)
})

const overallScore = computed(() => {
  const values = Object.values(scores.value).filter((s): s is number => s > 0)
  if (values.length === 0) return '-'
  return (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1)
})

const handleSubmit = async () => {
  if (!allScoresFilled.value) return

  submitting.value = true
  try {
    const data = {
      ...scores.value,
      comment: comment.value
    }
    emit('submit', data)
  } finally {
    submitting.value = false
  }
}

const handleCancel = () => {
  emit('cancel')
}
</script>

<template>
  <div class="evaluation-form">
    <div class="form-header">
      <h2 class="form-title">{{ title }}</h2>
      <p class="form-subtitle">{{ subtitle }}</p>
    </div>

    <div class="dimensions-list">
      <div v-for="dim in dimensions" :key="dim.key" class="dimension-row">
        <div class="dim-info">
          <span class="dim-label">{{ dim.label }}</span>
          <span class="dim-desc">{{ dim.desc }}</span>
        </div>
        <div class="dim-rating">
          <StarRating v-model="scores[dim.key]" size="large" />
        </div>
      </div>
    </div>

    <div class="overall-preview">
      <span class="preview-label">预计综合评分</span>
      <span class="preview-score">{{ overallScore }}</span>
      <span class="preview-max">/5</span>
    </div>

    <div class="comment-section">
      <label class="comment-label">综合评语 <span class="optional">(可选)</span></label>
      <textarea
        v-model="comment"
        class="comment-textarea"
        rows="4"
        placeholder="请输入对教学的整体评价和改进建议..."
      />
    </div>

    <div class="form-actions">
      <button class="btn btn-secondary" @click="handleCancel">取消</button>
      <button
        class="btn btn-primary"
        @click="handleSubmit"
        :disabled="!allScoresFilled || submitting"
      >
        {{ submitting ? '提交中...' : '提交评价' }}
      </button>
    </div>

    <div v-if="!allScoresFilled" class="form-hint">
      <span class="hint-icon">⚠️</span>
      请完成所有维度的评分后再提交
    </div>
  </div>
</template>

<style scoped>
.evaluation-form {
  padding: 24px;
}

.form-header {
  margin-bottom: 24px;
  text-align: center;
}

.form-title {
  font-size: 20px;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 8px 0;
}

.form-subtitle {
  font-size: 14px;
  color: #6b7280;
  margin: 0;
}

.dimensions-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 24px;
}

.dimension-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: #f9fafb;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
}

.dim-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.dim-label {
  font-size: 15px;
  font-weight: 500;
  color: #1f2937;
}

.dim-desc {
  font-size: 12px;
  color: #9ca3af;
}

.dim-rating {
  flex-shrink: 0;
}

.overall-preview {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 4px;
  padding: 16px;
  background: #eff6ff;
  border-radius: 8px;
  margin-bottom: 24px;
}

.preview-label {
  font-size: 14px;
  color: #3b82f6;
  margin-right: 8px;
}

.preview-score {
  font-size: 32px;
  font-weight: 700;
  color: #2563eb;
}

.preview-max {
  font-size: 16px;
  color: #93c5fd;
}

.comment-section {
  margin-bottom: 24px;
}

.comment-label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: #374151;
  margin-bottom: 8px;
}

.optional {
  font-weight: 400;
  color: #9ca3af;
}

.comment-textarea {
  width: 100%;
  padding: 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 14px;
  font-family: inherit;
  line-height: 1.6;
  resize: vertical;
}

.comment-textarea:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.comment-textarea::placeholder {
  color: #9ca3af;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.btn {
  padding: 10px 24px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-primary {
  background: #3b82f6;
  color: white;
  border: none;
}

.btn-primary:hover:not(:disabled) {
  background: #2563eb;
}

.btn-primary:disabled {
  background: #93c5fd;
  cursor: not-allowed;
}

.btn-secondary {
  background: white;
  color: #374151;
  border: 1px solid #d1d5db;
}

.btn-secondary:hover {
  background: #f3f4f6;
}

.form-hint {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin-top: 16px;
  padding: 12px;
  background: #fef3c7;
  border-radius: 8px;
  font-size: 13px;
  color: #92400e;
}

.hint-icon {
  font-size: 14px;
}
</style>
