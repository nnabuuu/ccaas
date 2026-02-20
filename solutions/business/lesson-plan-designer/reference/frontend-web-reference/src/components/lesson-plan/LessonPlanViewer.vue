<script setup lang="ts">
/**
 * LessonPlanViewer - Read-only display component for lesson plans
 *
 * Reuses the same sub-components as LessonPlanEditor but accepts data via props
 * instead of using the lessonPlanStore. This ensures visual consistency across
 * the app while allowing flexible data sources (e.g., snapshots in CourseDetailView).
 */
import { computed, ref, watch, type PropType } from 'vue'
import { parseLessonPlanContent, type CourseRequirement, type LessonPlanContent, type LearningTask, type HomeworkTask, type CourseRequirements, type LearningObjective, type PreparationTask } from '../../composables/useLessonPlanParser'
import type { LessonPlan, CurriculumStandard } from '@/types'
import { curriculumStandardApi } from '@/api'
import { gradeToStage } from '@/utils/gradeStageMapping'

// Extended content interface for the viewer which maps fields differently
interface ViewerContent {
  courseRequirements: CourseRequirements
  textbookAnalysis: string
  learningObjectives: LearningObjective[]
  studentAnalysis: string
  preClassPreparation: PreparationTask[]
  learningProcess: LearningTask[]  // Maps to learningTasks in LessonPlanContent
  homeworkAssessment: HomeworkTask[]  // Maps to homeworkTasks in LessonPlanContent
  courseware: string
  resources: string
}
import OutlinePanel from './OutlinePanel.vue'
import StandardsDisplay from './StandardsDisplay.vue'
import MarkdownSection from './MarkdownSection.vue'
import LearningObjectivesEditor from './LearningObjectivesEditor.vue'
import PreparationTasksEditor from './PreparationTasksEditor.vue'
import LearningTasksEditor from './LearningTasksEditor.vue'
import HomeworkAssessmentEditor from './HomeworkAssessmentEditor.vue'

const props = defineProps({
  lessonPlan: {
    type: Object as PropType<LessonPlan | Record<string, unknown>>,
    required: true
  },
  // Optional parsed content override (for snapshots)
  parsedContent: {
    type: Object as PropType<Partial<ViewerContent> | null>,
    default: null
  },
  // Hide outline panel (for embedded use)
  hideOutline: {
    type: Boolean,
    default: false
  },
  // Compact mode (less padding)
  compact: {
    type: Boolean,
    default: false
  }
})

// Sidebar navigation
const outlineItems = [
  { id: 'courseRequirements', label: '1. 课程要求' },
  { id: 'textbookAnalysis', label: '2. 教材分析' },
  { id: 'learningObjectives', label: '3. 学习目标' },
  { id: 'studentAnalysis', label: '4. 学情分析' },
  { id: 'preClassPreparation', label: '5. 课前准备' },
  { id: 'learningProcess', label: '6. 学习过程' },
  { id: 'homeworkAssessment', label: '7. 作业检测' },
  { id: 'courseware', label: '8. 课件' },
  { id: 'resources', label: '9. 资源' }
]

// Parse content using the same parser as the store
const content = computed((): ViewerContent => {
  if (props.parsedContent) return props.parsedContent as ViewerContent

  // Use the shared parser that handles lesson plan content field
  const parsed = parseLessonPlanContent(props.lessonPlan as LessonPlan)

  // Map parser output to viewer format
  return {
    courseRequirements: parsed.courseRequirements,
    textbookAnalysis: parsed.textbookAnalysis,
    learningObjectives: parsed.learningObjectives,
    studentAnalysis: parsed.studentAnalysis,
    preClassPreparation: parsed.preClassPreparation,
    learningProcess: parsed.learningTasks,
    homeworkAssessment: parsed.homeworkTasks,
    courseware: parsed.courseware,
    resources: parsed.resources
  }
})

// Computed stage from gradeLevel
const stage = computed(() => {
  const gradeLevel = (props.lessonPlan as LessonPlan)?.gradeLevel || 0
  return gradeToStage(gradeLevel)
})

// Fetched curriculum standards for displaying titles in learning objectives
const fetchedStandards = ref<Map<number, CurriculumStandard>>(new Map())

// Fetch curriculum standards by IDs
const fetchStandards = async () => {
  const cr = content.value.courseRequirements
  const ids = [
    ...(cr?.contentIds || []),
    ...(cr?.academicIds || [])
  ]
  if (ids.length === 0) {
    fetchedStandards.value = new Map()
    return
  }

  try {
    const response = await curriculumStandardApi.getList({
      subject: (props.lessonPlan as LessonPlan)?.subject || '',
      stage: stage.value,
      pageSize: 500
    })
    const data = response as { data?: { rows?: CurriculumStandard[] }; rows?: CurriculumStandard[] }
    const all = data.data?.rows || data.rows || []

    const newMap = new Map<number, CurriculumStandard>()
    all.forEach(std => {
      if (ids.includes(std.id)) {
        newMap.set(std.id, std)
      }
    })
    fetchedStandards.value = newMap
  } catch (err) {
    console.error('[LessonPlanViewer] Failed to fetch standards:', err)
  }
}

// Watch for content changes to fetch standards
watch(
  () => JSON.stringify([
    content.value.courseRequirements?.contentIds,
    content.value.courseRequirements?.academicIds
  ]),
  fetchStandards,
  { immediate: true }
)

// Computed available requirements with actual titles from fetched standards
const availableRequirements = computed((): CourseRequirement[] => {
  const cr = content.value.courseRequirements
  if (!cr) return []

  // Convert IDs to requirement objects with actual titles (use level3 as fallback)
  const contentReqs: CourseRequirement[] = (cr.contentIds || []).map(id => {
    const std = fetchedStandards.value.get(id)
    return {
      id,
      type: 'content' as const,
      label: std?.title || std?.level3 || `内容要求 ${id}`,
      description: std?.contentDomain || ''
    }
  })

  const academicReqs: CourseRequirement[] = (cr.academicIds || []).map(id => {
    const std = fetchedStandards.value.get(id)
    return {
      id,
      type: 'academic' as const,
      label: std?.title || std?.level3 || `学业要求 ${id}`,
      description: std?.contentDomain || ''
    }
  })

  return [...contentReqs, ...academicReqs]
})
</script>

<template>
  <div :class="['viewer-container', { compact, 'no-outline': hideOutline }]">
    <!-- Left: Outline Panel -->
    <OutlinePanel
      v-if="!hideOutline"
      :items="outlineItems"
      :active-section="''"
    />

    <!-- Center: Main Content -->
    <main class="main-viewer">
      <!-- 课程要求 -->
      <section id="courseRequirements" class="viewer-section">
        <div class="section-header">
          <h2 class="section-title">1. 课程要求</h2>
        </div>
        <div class="section-content">
          <StandardsDisplay
            :content-ids="content.courseRequirements?.contentIds || []"
            :academic-ids="content.courseRequirements?.academicIds || []"
            :subject="(lessonPlan as LessonPlan)?.subject || ''"
            :stage="stage"
          />
        </div>
      </section>

      <!-- 教材分析 -->
      <section id="textbookAnalysis" class="viewer-section">
        <div class="section-header">
          <h2 class="section-title">2. 教材分析</h2>
        </div>
        <div class="section-content markdown-preview">
          <MarkdownSection
            :model-value="content.textbookAnalysis"
            :readonly="true"
            :hide-title="true"
          />
        </div>
      </section>

      <!-- 学习目标 -->
      <section id="learningObjectives" class="viewer-section">
        <div class="section-header">
          <h2 class="section-title">3. 学习目标</h2>
        </div>
        <div class="section-content">
          <LearningObjectivesEditor
            :model-value="content.learningObjectives"
            :available-requirements="availableRequirements"
            :readonly="true"
          />
        </div>
      </section>

      <!-- 学情分析 -->
      <section id="studentAnalysis" class="viewer-section">
        <div class="section-header">
          <h2 class="section-title">4. 学情分析</h2>
        </div>
        <div class="section-content markdown-preview">
          <MarkdownSection
            :model-value="content.studentAnalysis"
            :readonly="true"
            :hide-title="true"
          />
        </div>
      </section>

      <!-- 课前准备 -->
      <section id="preClassPreparation" class="viewer-section">
        <div class="section-header">
          <h2 class="section-title">5. 课前准备</h2>
        </div>
        <div class="section-content">
          <PreparationTasksEditor
            :model-value="content.preClassPreparation"
            :available-objectives="content.learningObjectives"
            :readonly="true"
          />
        </div>
      </section>

      <!-- 学习过程 -->
      <section id="learningProcess" class="viewer-section">
        <div class="section-header">
          <h2 class="section-title">6. 学习过程</h2>
        </div>
        <div class="section-content">
          <LearningTasksEditor
            :model-value="content.learningProcess"
            :available-requirements="availableRequirements"
            :readonly="true"
          />
        </div>
      </section>

      <!-- 作业检测 -->
      <section id="homeworkAssessment" class="viewer-section">
        <div class="section-header">
          <h2 class="section-title">7. 作业检测</h2>
        </div>
        <div class="section-content">
          <HomeworkAssessmentEditor
            :model-value="content.homeworkAssessment"
            :available-objectives="content.learningObjectives"
            :readonly="true"
          />
        </div>
      </section>

      <!-- 课件 -->
      <section id="courseware" class="viewer-section">
        <div class="section-header">
          <h2 class="section-title">8. 课件</h2>
        </div>
        <div class="section-content markdown-preview">
          <MarkdownSection
            :model-value="content.courseware"
            :readonly="true"
            :hide-title="true"
          />
        </div>
      </section>

      <!-- 资源 -->
      <section id="resources" class="viewer-section">
        <div class="section-header">
          <h2 class="section-title">9. 资源</h2>
        </div>
        <div class="section-content markdown-preview">
          <MarkdownSection
            :model-value="content.resources"
            :readonly="true"
            :hide-title="true"
          />
        </div>
      </section>
    </main>
  </div>
</template>

<style scoped>
.viewer-container {
  display: grid;
  grid-template-columns: 240px 1fr;
  gap: 24px;
  min-height: 400px;
}

.viewer-container.no-outline {
  grid-template-columns: 1fr;
}

.viewer-container.compact .main-viewer {
  padding: 24px;
}

.main-viewer {
  background: white;
  border-radius: 16px;
  padding: 40px;
  border: 1px solid rgba(203, 213, 225, 0.4);
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
}

.viewer-section {
  margin-bottom: 32px;
  scroll-margin-top: 120px;
}

.viewer-section:last-child {
  margin-bottom: 0;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.section-title {
  font-size: 18px;
  font-weight: 600;
  color: #0f172a;
  margin: 0;
}

.section-content {
  color: #334155;
  line-height: 1.6;
}

@media (max-width: 768px) {
  .viewer-container {
    grid-template-columns: 1fr;
  }
}
</style>
