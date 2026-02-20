<script setup lang="ts">
import { computed, type PropType } from 'vue'
import StarRating from '../StarRating.vue'

interface EvaluationData {
  overallScore?: number
  comment?: string
  createdBy?: string
  createTime?: string
  [key: string]: unknown
}

const props = defineProps({
  evaluation: {
    type: Object as PropType<EvaluationData>,
    required: true
  },
  type: {
    type: String as PropType<'lesson' | 'teaching'>,
    required: true,
    validator: (v: string) => ['lesson', 'teaching'].includes(v)
  }
})

const lessonPlanDimensions = [
  { key: 'objectiveDesignScore', label: '教学目标设计' },
  { key: 'contentOrganizationScore', label: '教学内容组织' },
  { key: 'taskDesignScore', label: '学习任务设计' },
  { key: 'homeworkDesignScore', label: '作业设计' },
  { key: 'resourcePreparationScore', label: '资源准备' }
]

const teachingDimensions = [
  { key: 'introductionScore', label: '课堂导入' },
  { key: 'processControlScore', label: '教学过程把控' },
  { key: 'interactionScore', label: '师生互动' },
  { key: 'timeManagementScore', label: '时间管理' },
  { key: 'visualAidsScore', label: '板书/PPT运用' }
]

const dimensions = computed(() => {
  return props.type === 'lesson' ? lessonPlanDimensions : teachingDimensions
})

const overallScore = computed(() => {
  if (props.evaluation.overallScore) return props.evaluation.overallScore
  const scores = dimensions.value.map(d => props.evaluation[d.key] as number).filter((s): s is number => s != null)
  if (scores.length === 0) return 0
  return (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)
})

const formatDate = (dateStr: string | undefined) => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}
</script>

<template>
  <div :class="['evaluation-card', { 'ai-generated': evaluation.isAiGenerated }]">
    <div class="card-header">
      <div class="reviewer-info">
        <span v-if="evaluation.isAiGenerated" class="ai-badge">
          <span class="ai-icon">🤖</span>
          AI评价
        </span>
        <span v-else class="reviewer-name">
          {{ evaluation.reviewerName || '评价者' }}
        </span>
        <span class="eval-date">{{ formatDate(evaluation.createTime) }}</span>
      </div>
      <div class="overall-score">
        <span class="score-label">综合评分</span>
        <span class="score-value">{{ overallScore }}</span>
        <span class="score-max">/5</span>
      </div>
    </div>

    <div class="dimensions-grid">
      <div v-for="dim in dimensions" :key="dim.key" class="dimension-item">
        <span class="dim-label">{{ dim.label }}</span>
        <div class="dim-score">
          <StarRating :modelValue="(evaluation[dim.key] as number) || 0" :readonly="true" size="small" />
        </div>
      </div>
    </div>

    <div v-if="evaluation.comment" class="comment-section">
      <div class="comment-label">评语</div>
      <div class="comment-text">{{ evaluation.comment }}</div>
    </div>

    <div v-if="evaluation.aiSuggestion" class="ai-suggestion">
      <div class="suggestion-label">
        <span class="ai-icon">💡</span>
        AI建议
      </div>
      <div class="suggestion-text">{{ evaluation.aiSuggestion }}</div>
    </div>
  </div>
</template>

<style scoped>
.evaluation-card {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  overflow: hidden;
}

.evaluation-card.ai-generated {
  border-color: #bae6fd;
  background: linear-gradient(to bottom, #f0f9ff, white);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
}

.ai-generated .card-header {
  background: #e0f2fe;
  border-bottom-color: #bae6fd;
}

.reviewer-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.ai-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 12px;
  background: #0ea5e9;
  color: white;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 500;
}

.ai-icon {
  font-size: 14px;
}

.reviewer-name {
  font-weight: 500;
  color: #374151;
}

.eval-date {
  font-size: 12px;
  color: #9ca3af;
}

.overall-score {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.score-label {
  font-size: 12px;
  color: #6b7280;
  margin-right: 8px;
}

.score-value {
  font-size: 24px;
  font-weight: 700;
  color: #3b82f6;
}

.score-max {
  font-size: 14px;
  color: #9ca3af;
}

.dimensions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1px;
  background: #e5e7eb;
  padding: 1px;
}

.dimension-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: white;
}

.dim-label {
  font-size: 13px;
  color: #6b7280;
}

.dim-score {
  display: flex;
  align-items: center;
}

.comment-section {
  padding: 16px 20px;
  border-top: 1px solid #e5e7eb;
}

.comment-label {
  font-size: 12px;
  font-weight: 500;
  color: #6b7280;
  margin-bottom: 8px;
}

.comment-text {
  font-size: 14px;
  color: #374151;
  line-height: 1.6;
}

.ai-suggestion {
  padding: 16px 20px;
  background: #fffbeb;
  border-top: 1px solid #fef3c7;
}

.suggestion-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 500;
  color: #92400e;
  margin-bottom: 8px;
}

.suggestion-text {
  font-size: 14px;
  color: #78350f;
  line-height: 1.6;
}
</style>
