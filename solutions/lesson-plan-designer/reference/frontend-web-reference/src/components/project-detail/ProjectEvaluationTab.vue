<script setup lang="ts">
import { ref, computed, onMounted, type PropType } from 'vue'
import { projectEvaluationApi } from '../../api/index'

interface CriterionScore {
  score: number
  comment: string
}

interface ProjectEvaluation {
  id: number
  projectId: number
  overallScore: number
  overallComment?: string
  criteriaScores?: Record<string, CriterionScore>
  status: string
  createTime?: string
  createByName?: string
}

const props = defineProps({
  projectId: {
    type: [Number, String] as PropType<number | string>,
    required: true
  }
})

// Research evaluation criteria (6 criteria)
const criteria = [
  { key: 'research_question_clarity', label: '研究问题明确性', description: '研究问题是否清晰、具体、可研究' },
  { key: 'literature_review', label: '文献综述完整性', description: '文献收集是否全面、引用是否规范' },
  { key: 'methodology', label: '研究方法适当性', description: '研究方法是否适合研究问题' },
  { key: 'data_analysis', label: '数据分析严谨性', description: '数据收集与分析过程是否严谨' },
  { key: 'conclusion_validity', label: '结论合理性', description: '结论是否基于数据、逻辑是否清晰' },
  { key: 'innovation', label: '成果创新性', description: '研究成果是否有创新价值' }
]

// Data
const evaluations = ref<ProjectEvaluation[]>([])
const loading = ref(true)
const expandedId = ref<number | null>(null)
const showModal = ref(false)
const editingEvaluation = ref<ProjectEvaluation | null>(null)

// Form data
const formData = ref<{
  overallComment: string
  criteriaScores: Record<string, CriterionScore>
}>({
  overallComment: '',
  criteriaScores: {}
})

// Initialize form data
const initFormData = () => {
  formData.value = {
    overallComment: '',
    criteriaScores: {}
  }
  criteria.forEach(c => {
    formData.value.criteriaScores[c.key] = { score: 70, comment: '' }
  })
}

// Computed overall score
const computedOverallScore = computed(() => {
  const scores = Object.values(formData.value.criteriaScores) as CriterionScore[]
  if (scores.length === 0) return 0
  const total = scores.reduce((sum: number, s: CriterionScore) => sum + (s.score || 0), 0)
  return Math.round(total / scores.length)
})

// Fetch evaluations
const fetchEvaluations = async () => {
  loading.value = true
  try {
    const res = await projectEvaluationApi.getByProjectId(Number(props.projectId))
    const wrappedResponse = res as { data?: ProjectEvaluation[] }
    const unwrappedResponse = res as unknown as ProjectEvaluation[]
    const data = wrappedResponse.data || unwrappedResponse
    evaluations.value = Array.isArray(data) ? data : []
  } catch (error) {
    console.error('Failed to fetch evaluations:', error)
  } finally {
    loading.value = false
  }
}

// Toggle expansion
const toggleExpand = (id: number) => {
  expandedId.value = expandedId.value === id ? null : id
}

// Open add modal
const openAddModal = () => {
  editingEvaluation.value = null
  initFormData()
  showModal.value = true
}

// Open edit modal
const openEditModal = (evaluation: ProjectEvaluation) => {
  editingEvaluation.value = evaluation
  formData.value = {
    overallComment: evaluation.overallComment || '',
    criteriaScores: evaluation.criteriaScores || {}
  }
  // Ensure all criteria exist
  criteria.forEach(c => {
    if (!formData.value.criteriaScores[c.key]) {
      formData.value.criteriaScores[c.key] = { score: 70, comment: '' }
    }
  })
  showModal.value = true
}

// Save evaluation
const saveEvaluation = async (status = 'draft') => {
  try {
    const data: Partial<ProjectEvaluation> & { status: string } = {
      projectId: Number(props.projectId),
      overallComment: formData.value.overallComment,
      criteriaScores: formData.value.criteriaScores,
      overallScore: computedOverallScore.value,
      status
    }

    if (editingEvaluation.value) {
      data.id = editingEvaluation.value.id
      await projectEvaluationApi.update(data)
    } else {
      await projectEvaluationApi.create(data)
    }

    showModal.value = false
    await fetchEvaluations()
  } catch (error) {
    console.error('Failed to save evaluation:', error)
  }
}

// Delete evaluation
const deleteEvaluation = async (id: number) => {
  if (!confirm('确定要删除这条评价吗？')) return

  try {
    await projectEvaluationApi.delete(id)
    await fetchEvaluations()
  } catch (error) {
    console.error('Failed to delete evaluation:', error)
  }
}

// Get score color
const getScoreColor = (score: number) => {
  if (score >= 80) return '#22c55e'
  if (score >= 60) return '#3b82f6'
  if (score >= 40) return '#f59e0b'
  return '#ef4444'
}

// Format date
const formatDate = (dateStr: string | undefined) => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
}

onMounted(() => {
  fetchEvaluations()
})
</script>

<template>
  <div class="evaluation-tab">
    <!-- Header -->
    <div class="tab-header">
      <h3>项目评价</h3>
      <button class="btn btn-primary" @click="openAddModal">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19"/>
          <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        发起评价
      </button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="loading-state">
      加载中...
    </div>

    <!-- Empty state -->
    <div v-else-if="evaluations.length === 0" class="empty-state">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
        <rect x="9" y="3" width="6" height="4" rx="2"/>
        <line x1="9" y1="12" x2="15" y2="12"/>
        <line x1="9" y1="16" x2="15" y2="16"/>
      </svg>
      <p>暂无评价记录</p>
      <button class="btn btn-outline" @click="openAddModal">添加第一条评价</button>
    </div>

    <!-- Evaluation cards -->
    <div v-else class="evaluation-list">
      <div
        v-for="evaluation in evaluations"
        :key="evaluation.id"
        :class="['evaluation-card', { expanded: expandedId === evaluation.id }]"
      >
        <!-- Card header -->
        <div class="card-header" @click="toggleExpand(evaluation.id)">
          <div class="evaluator-info">
            <span class="avatar">{{ evaluation.createByName?.[0] || '评' }}</span>
            <div class="evaluator-details">
              <span class="evaluator-name">{{ evaluation.createByName || '评审人' }}</span>
              <span class="eval-date">{{ formatDate(evaluation.createTime) }}</span>
            </div>
          </div>
          <div class="score-badge" :style="{ backgroundColor: getScoreColor(evaluation.overallScore) }">
            {{ evaluation.overallScore || 0 }}分
          </div>
          <span :class="['status-badge', evaluation.status]">
            {{ evaluation.status === 'submitted' ? '已提交' : '草稿' }}
          </span>
          <svg :class="['expand-icon', { rotated: expandedId === evaluation.id }]" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </div>

        <!-- Expanded content -->
        <div v-if="expandedId === evaluation.id" class="card-body">
          <!-- Criteria scores -->
          <div class="criteria-list">
            <div v-for="c in criteria" :key="c.key" class="criterion-item">
              <div class="criterion-header">
                <span class="criterion-label">{{ c.label }}</span>
                <span class="criterion-score">{{ evaluation.criteriaScores?.[c.key]?.score || 0 }}分</span>
              </div>
              <div class="progress-bar">
                <div
                  class="progress-fill"
                  :style="{
                    width: (evaluation.criteriaScores?.[c.key]?.score || 0) + '%',
                    backgroundColor: getScoreColor(evaluation.criteriaScores?.[c.key]?.score || 0)
                  }"
                ></div>
              </div>
              <p v-if="evaluation.criteriaScores?.[c.key]?.comment" class="criterion-comment">
                {{ evaluation.criteriaScores[c.key].comment }}
              </p>
            </div>
          </div>

          <!-- Overall comment -->
          <div v-if="evaluation.overallComment" class="overall-comment">
            <h5>总体评价</h5>
            <p>{{ evaluation.overallComment }}</p>
          </div>

          <!-- Actions -->
          <div class="card-actions">
            <button class="btn btn-sm" @click.stop="openEditModal(evaluation)">编辑</button>
            <button class="btn btn-sm btn-danger" @click.stop="deleteEvaluation(evaluation.id)">删除</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Add/Edit Modal -->
    <div v-if="showModal" class="modal-overlay" @click.self="showModal = false">
      <div class="modal-content large">
        <div class="modal-header">
          <h4>{{ editingEvaluation ? '编辑评价' : '发起评价' }}</h4>
          <button class="close-btn" @click="showModal = false">&times;</button>
        </div>
        <div class="modal-body">
          <!-- Criteria scores -->
          <div class="criteria-form">
            <div v-for="c in criteria" :key="c.key" class="criterion-form-item">
              <div class="criterion-form-header">
                <span class="criterion-label">{{ c.label }}</span>
                <span class="criterion-score-display">{{ formData.criteriaScores[c.key]?.score || 0 }}分</span>
              </div>
              <p class="criterion-description">{{ c.description }}</p>
              <input
                type="range"
                min="0"
                max="100"
                v-model.number="formData.criteriaScores[c.key].score"
                class="score-slider"
              />
              <textarea
                v-model="formData.criteriaScores[c.key].comment"
                placeholder="评价说明（可选）"
                rows="2"
              ></textarea>
            </div>
          </div>

          <!-- Overall comment -->
          <div class="overall-form">
            <label>总体评价</label>
            <textarea
              v-model="formData.overallComment"
              placeholder="请输入总体评价..."
              rows="4"
            ></textarea>
          </div>

          <!-- Computed score -->
          <div class="computed-score">
            <span>综合评分：</span>
            <span class="score-value" :style="{ color: getScoreColor(computedOverallScore) }">
              {{ computedOverallScore }}分
            </span>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showModal = false">取消</button>
          <button class="btn btn-outline" @click="saveEvaluation('draft')">保存草稿</button>
          <button class="btn btn-primary" @click="saveEvaluation('submitted')">提交评价</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.evaluation-tab {
  padding: 24px 0;
}

.tab-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.tab-header h3 {
  font-size: 18px;
  font-weight: 600;
  color: #111827;
  margin: 0;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-sm {
  padding: 6px 12px;
  font-size: 13px;
}

.btn-primary {
  background: #3b82f6;
  border: 1px solid #3b82f6;
  color: #fff;
}

.btn-primary:hover {
  background: #2563eb;
}

.btn-secondary {
  background: #fff;
  border: 1px solid #e5e7eb;
  color: #374151;
}

.btn-secondary:hover {
  background: #f9fafb;
}

.btn-outline {
  background: #fff;
  border: 1px solid #3b82f6;
  color: #3b82f6;
}

.btn-outline:hover {
  background: rgba(59, 130, 246, 0.05);
}

.btn-danger {
  background: #fff;
  border: 1px solid #ef4444;
  color: #ef4444;
}

.btn-danger:hover {
  background: #fef2f2;
}

.loading-state,
.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: #9ca3af;
}

.empty-state svg {
  margin-bottom: 16px;
}

.empty-state p {
  margin-bottom: 16px;
}

/* Evaluation cards */
.evaluation-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.evaluation-card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  overflow: hidden;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 20px;
  cursor: pointer;
}

.card-header:hover {
  background: #f9fafb;
}

.evaluator-info {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
}

.avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #3b82f6;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 500;
}

.evaluator-details {
  display: flex;
  flex-direction: column;
}

.evaluator-name {
  font-size: 15px;
  font-weight: 500;
  color: #111827;
}

.eval-date {
  font-size: 13px;
  color: #9ca3af;
}

.score-badge {
  padding: 4px 12px;
  border-radius: 20px;
  color: #fff;
  font-size: 14px;
  font-weight: 600;
}

.status-badge {
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 12px;
}

.status-badge.submitted {
  background: #dcfce7;
  color: #16a34a;
}

.status-badge.draft {
  background: #fef3c7;
  color: #d97706;
}

.expand-icon {
  color: #9ca3af;
  transition: transform 0.2s;
}

.expand-icon.rotated {
  transform: rotate(180deg);
}

/* Card body */
.card-body {
  padding: 20px;
  border-top: 1px solid #e5e7eb;
  background: #f9fafb;
}

.criteria-list {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
  margin-bottom: 20px;
}

@media (max-width: 768px) {
  .criteria-list {
    grid-template-columns: 1fr;
  }
}

.criterion-item {
  background: #fff;
  padding: 16px;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
}

.criterion-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
}

.criterion-label {
  font-size: 14px;
  font-weight: 500;
  color: #374151;
}

.criterion-score {
  font-size: 14px;
  font-weight: 600;
  color: #3b82f6;
}

.progress-bar {
  height: 8px;
  background: #e5e7eb;
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.3s;
}

.criterion-comment {
  margin-top: 8px;
  font-size: 13px;
  color: #6b7280;
}

.overall-comment {
  background: #fff;
  padding: 16px;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  margin-bottom: 16px;
}

.overall-comment h5 {
  font-size: 14px;
  font-weight: 600;
  color: #374151;
  margin: 0 0 8px 0;
}

.overall-comment p {
  font-size: 14px;
  color: #6b7280;
  margin: 0;
}

.card-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

/* Modal */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: #fff;
  border-radius: 12px;
  width: 100%;
  max-width: 600px;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.modal-content.large {
  max-width: 700px;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #e5e7eb;
}

.modal-header h4 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  color: #9ca3af;
  cursor: pointer;
}

.modal-body {
  padding: 20px;
  overflow-y: auto;
  flex: 1;
}

.criteria-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin-bottom: 24px;
}

.criterion-form-item {
  padding: 16px;
  background: #f9fafb;
  border-radius: 8px;
}

.criterion-form-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
}

.criterion-score-display {
  font-size: 16px;
  font-weight: 600;
  color: #3b82f6;
}

.criterion-description {
  font-size: 13px;
  color: #6b7280;
  margin: 0 0 12px 0;
}

.score-slider {
  width: 100%;
  margin-bottom: 12px;
}

.criterion-form-item textarea {
  width: 100%;
  padding: 10px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  font-size: 13px;
  resize: vertical;
}

.overall-form {
  margin-bottom: 16px;
}

.overall-form label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: #374151;
  margin-bottom: 8px;
}

.overall-form textarea {
  width: 100%;
  padding: 12px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  font-size: 14px;
  resize: vertical;
}

.computed-score {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px;
  background: #f3f4f6;
  border-radius: 8px;
  font-size: 15px;
}

.score-value {
  font-size: 24px;
  font-weight: 700;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 20px;
  border-top: 1px solid #e5e7eb;
}
</style>
