<script setup lang="ts">
/**
 * AIEditingOverlay - Progress overlay for AI-generated lesson plan content
 *
 * Displays real-time progress when AI is generating lesson plan sections.
 * Shows section status (pending, in progress, completed) and provides
 * a cancel button to stop generation.
 */
import { computed, inject, type Ref } from 'vue'
import { useLessonPlanStore } from '@/stores/domain/lessonPlanStore'

const store = useLessonPlanStore()

// Inject AI output progress from AgentListener
const aiOutputGenerating = inject<Ref<boolean>>('aiOutputGenerating')
const aiOutputProgress = inject<Ref<{
  totalSteps: number
  completedSteps: number
  currentStep: string
  percentage: number
}>>('aiOutputProgress')

// All section definitions with labels (for reference)
const allSections = [
  { id: 'courseRequirements', label: '1. 课程要求' },
  { id: 'textbookAnalysis', label: '2. 教材分析' },
  { id: 'learningObjectives', label: '3. 学习目标' },
  { id: 'studentAnalysis', label: '4. 学情分析' },
  { id: 'preClassPreparation', label: '5. 课前准备' },
  { id: 'learningProcess', label: '6. 学习过程' },
  { id: 'homeworkAssessment', label: '7. 作业检测' },
]

// Filter sections to only show those in the plan (aiPendingSections)
const activeSections = computed(() => {
  // If no pending sections specified, show all (backward compatibility)
  if (store.aiPendingSections.size === 0) {
    return allSections
  }
  return allSections.filter(s => store.aiPendingSections.has(s.id))
})

// Determine if we should show the overlay
// Show when AI editing mode is active OR when output is generating
const isVisible = computed(() => {
  return store.aiEditingMode || aiOutputGenerating?.value
})

// Get section status: 'completed' | 'in_progress' | 'pending'
function getSectionStatus(sectionId: string): 'completed' | 'in_progress' | 'pending' {
  if (store.aiCompletedSections.has(sectionId)) {
    return 'completed'
  }
  if (store.aiCurrentSection === sectionId) {
    return 'in_progress'
  }
  return 'pending'
}

// Get section icon based on status
function getSectionIcon(status: 'completed' | 'in_progress' | 'pending'): string {
  switch (status) {
    case 'completed':
      return '✓'
    case 'in_progress':
      return '⏳'
    case 'pending':
      return '○'
  }
}

// Handle cancel button
function handleCancel(): void {
  store.cancelAIEditing()
}

// Progress bar percentage
const progressPercentage = computed(() => {
  if (aiOutputProgress?.value?.percentage) {
    return aiOutputProgress.value.percentage
  }
  // Calculate from completed sections (only count planned sections)
  const total = activeSections.value.length
  if (total === 0) return 0
  // Count completed sections that are in the active plan
  const completedInPlan = activeSections.value.filter(s => store.aiCompletedSections.has(s.id)).length
  return Math.round((completedInPlan / total) * 100)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="isVisible" class="ai-overlay">
        <div class="ai-progress-card">
          <div class="ai-header">
            <div class="ai-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
              </svg>
            </div>
            <h3 class="ai-title">AI 正在生成教案...</h3>
          </div>

          <!-- Progress bar -->
          <div class="progress-container">
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: `${progressPercentage}%` }"></div>
            </div>
            <span class="progress-text">{{ progressPercentage }}%</span>
          </div>

          <!-- Current step display -->
          <div v-if="aiOutputProgress?.currentStep" class="current-step">
            {{ aiOutputProgress.currentStep }}
          </div>

          <!-- Section list (only planned sections) -->
          <ul class="section-list">
            <li
              v-for="section in activeSections"
              :key="section.id"
              :class="['section-item', getSectionStatus(section.id)]"
            >
              <span class="section-icon">{{ getSectionIcon(getSectionStatus(section.id)) }}</span>
              <span class="section-label">{{ section.label }}</span>
              <span v-if="getSectionStatus(section.id) === 'in_progress'" class="generating-text">
                正在生成...
              </span>
            </li>
          </ul>

          <!-- Cancel button -->
          <button class="cancel-btn" @click="handleCancel">
            取消生成
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.ai-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.ai-progress-card {
  background: white;
  border-radius: 16px;
  padding: 32px;
  min-width: 400px;
  max-width: 500px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
}

.ai-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;
}

.ai-icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: linear-gradient(135deg, #a855f7 0%, #7c3aed 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.05);
    opacity: 0.9;
  }
}

.ai-title {
  font-size: 20px;
  font-weight: 600;
  color: #0f172a;
  margin: 0;
}

.progress-container {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.progress-bar {
  flex: 1;
  height: 8px;
  background: #e2e8f0;
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #a855f7 0%, #7c3aed 100%);
  border-radius: 4px;
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 14px;
  font-weight: 600;
  color: #7c3aed;
  min-width: 40px;
}

.current-step {
  font-size: 14px;
  color: #64748b;
  margin-bottom: 20px;
  padding: 8px 12px;
  background: #f8fafc;
  border-radius: 8px;
}

.section-list {
  list-style: none;
  margin: 0 0 24px 0;
  padding: 0;
}

.section-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 0;
  border-bottom: 1px solid #f1f5f9;
  transition: all 0.2s;
}

.section-item:last-child {
  border-bottom: none;
}

.section-icon {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
}

.section-item.completed .section-icon {
  color: #22c55e;
  font-weight: bold;
}

.section-item.in_progress .section-icon {
  color: #a855f7;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.section-item.pending .section-icon {
  color: #cbd5e1;
}

.section-label {
  flex: 1;
  font-size: 14px;
  color: #334155;
}

.section-item.completed .section-label {
  color: #22c55e;
}

.section-item.in_progress .section-label {
  color: #7c3aed;
  font-weight: 500;
}

.section-item.pending .section-label {
  color: #94a3b8;
}

.generating-text {
  font-size: 12px;
  color: #a855f7;
  animation: blink 1.5s ease-in-out infinite;
}

@keyframes blink {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.cancel-btn {
  width: 100%;
  padding: 12px 24px;
  background: #f1f5f9;
  color: #64748b;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.cancel-btn:hover {
  background: #e2e8f0;
  color: #475569;
}

/* Transition animations */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.fade-enter-active .ai-progress-card {
  animation: slideUp 0.3s ease;
}

.fade-leave-active .ai-progress-card {
  animation: slideDown 0.3s ease;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes slideDown {
  from {
    opacity: 1;
    transform: translateY(0);
  }
  to {
    opacity: 0;
    transform: translateY(20px);
  }
}
</style>
