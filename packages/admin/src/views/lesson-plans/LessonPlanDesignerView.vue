<script setup lang="ts">
/**
 * LessonPlanDesignerView
 *
 * Main view for the Lesson Plan Designer with split-pane layout.
 * Left: Form (60%), Right: AI Chat (40%)
 */
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  Layout,
  PageHeader,
  Button,
  Space,
  Spin,
  message,
  Modal,
} from 'ant-design-vue'
import {
  SaveOutlined,
  EyeOutlined,
  CopyOutlined,
  DeleteOutlined,
} from '@ant-design/icons-vue'
import LessonPlanForm from '@/components/lesson-plans/LessonPlanForm.vue'
import LessonPlanChat from '@/components/lesson-plans/LessonPlanChat.vue'
import { useLessonPlanStore } from '@/stores/lessonPlan'
import { useLessonPlanSync } from '@ccaas/vue-sdk'
import { createEmptyLessonPlan } from '@ccaas/shared'
import type { LessonPlan, LessonPlanSyncField } from '@ccaas/shared'
import * as api from '@/api/lessonPlans'

const route = useRoute()
const router = useRouter()
const store = useLessonPlanStore()

// Props
const props = defineProps<{
  id?: string
}>()

// State
const loading = ref(false)
const saving = ref(false)
const initialPlan = ref<LessonPlan | null>(null)
const chatRef = ref<InstanceType<typeof LessonPlanChat> | null>(null)

// Get the plan ID from route or props
const planId = computed(() => props.id || (route.params.id as string))
const isNewPlan = computed(() => !planId.value || planId.value === 'new')

// Initialize lesson plan sync
const {
  lessonPlan,
  pendingUpdates,
  hasPendingUpdates,
  modifiedFields,
  handleOutputUpdate,
  applyUpdate,
  applyAllUpdates,
  discardUpdate,
  discardAllUpdates,
  undoUpdate,
  canUndo,
  resetLessonPlan,
  isFieldModified,
} = useLessonPlanSync({
  initialPlan: createEmptyLessonPlan('default'),
  onApply: async (field, value) => {
    // Persist to backend
    if (!isNewPlan.value && lessonPlan.value.id) {
      try {
        await api.updateLessonPlanField(lessonPlan.value.id, field, value)
        message.success(`已同步「${getFieldLabel(field)}」`)
      } catch (e) {
        message.error('同步失败')
        throw e
      }
    }
  },
})

// Field labels
const fieldLabels: Record<LessonPlanSyncField, string> = {
  title: '课程标题',
  subject: '学科',
  gradeLevel: '年级',
  duration: '课时',
  objectives: '教学目标',
  standards: '课程标准',
  materials: '教学材料',
  activities: '教学活动',
  assessment: '评估方式',
  differentiation: '差异化教学',
}

function getFieldLabel(field: LessonPlanSyncField): string {
  return fieldLabels[field] || field
}

// Load lesson plan
async function loadLessonPlan() {
  if (isNewPlan.value) {
    const newPlan = createEmptyLessonPlan('default')
    initialPlan.value = newPlan
    resetLessonPlan(newPlan)
    return
  }

  loading.value = true
  try {
    const plan = await api.getLessonPlan(planId.value)
    initialPlan.value = plan
    resetLessonPlan(plan)
  } catch (e) {
    message.error('加载课程失败')
    router.push('/lesson-plans')
  } finally {
    loading.value = false
  }
}

// Save lesson plan
async function saveLessonPlan() {
  saving.value = true
  try {
    if (isNewPlan.value) {
      const newPlan = await store.createLessonPlan(lessonPlan.value)
      message.success('课程已创建')
      router.replace(`/lesson-plans/${newPlan.id}`)
    } else {
      await store.updateLessonPlan(lessonPlan.value.id, lessonPlan.value)
      message.success('课程已保存')
    }
  } catch (e) {
    message.error('保存失败')
  } finally {
    saving.value = false
  }
}

// Duplicate lesson plan
async function handleDuplicate() {
  if (isNewPlan.value) return

  try {
    const duplicated = await store.duplicateLessonPlan(lessonPlan.value.id)
    message.success('课程已复制')
    router.push(`/lesson-plans/${duplicated.id}`)
  } catch (e) {
    message.error('复制失败')
  }
}

// Delete lesson plan
async function handleDelete() {
  Modal.confirm({
    title: '确认删除',
    content: '确定要删除这个课程吗？此操作不可撤销。',
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    async onOk() {
      try {
        await store.deleteLessonPlan(lessonPlan.value.id)
        message.success('课程已删除')
        router.push('/lesson-plans')
      } catch (e) {
        message.error('删除失败')
      }
    },
  })
}

// Handle chat message (simulated AI response)
async function handleChatMessage(msg: string) {
  // TODO: Connect to actual AI service via socket.io
  // For now, simulate AI response
  setTimeout(() => {
    // Simulate AI generating objectives
    if (msg.includes('目标') || msg.includes('设计')) {
      handleOutputUpdate('objectives', [
        {
          id: crypto.randomUUID(),
          description: '学生能够理解并解释分数的基本概念',
          bloomLevel: 'understand',
          assessmentCriteria: '能正确识别和命名分数',
        },
        {
          id: crypto.randomUUID(),
          description: '学生能够在实际情境中应用分数',
          bloomLevel: 'apply',
          assessmentCriteria: '能解决简单的分数应用题',
        },
      ])
    }

    // Simulate AI generating activities
    if (msg.includes('活动') || msg.includes('课堂')) {
      handleOutputUpdate('activities', [
        {
          id: crypto.randomUUID(),
          title: '导入：分享蛋糕',
          description: '通过分享蛋糕的情境引入分数概念',
          duration: 5,
          type: 'introduction',
          instructions: ['展示蛋糕图片', '提问：如何公平分享？'],
        },
        {
          id: crypto.randomUUID(),
          title: '探索：动手实践',
          description: '学生使用纸片进行折叠和分割练习',
          duration: 15,
          type: 'guided-practice',
          instructions: ['发放圆形纸片', '指导学生进行等分', '讨论分割结果'],
        },
      ])
    }

    // Simulate AI generating differentiation
    if (msg.includes('差异化') || msg.includes('分层')) {
      handleOutputUpdate('differentiation', {
        struggling: ['提供更多视觉辅助', '使用具体实物操作', '一对一指导'],
        onLevel: ['标准课堂活动', '小组合作学习'],
        advanced: ['探索分数的加减', '设计自己的分数问题'],
      })
    }
  }, 1500)
}

// Handle field update from form
function handleFieldUpdate(field: LessonPlanSyncField, value: unknown) {
  lessonPlan.value = {
    ...lessonPlan.value,
    [field]: value,
  }
}

// Watch route changes
watch(
  () => route.params.id,
  () => loadLessonPlan(),
  { immediate: false }
)

// Initial load
onMounted(() => {
  loadLessonPlan()
})
</script>

<template>
  <Layout class="designer-layout">
    <!-- Header -->
    <PageHeader
      :title="isNewPlan ? '新建备课' : lessonPlan.title || '编辑备课'"
      :sub-title="lessonPlan.subject && lessonPlan.gradeLevel ? `${lessonPlan.subject} · ${lessonPlan.gradeLevel}` : ''"
      @back="() => router.push('/lesson-plans')"
    >
      <template #extra>
        <Space>
          <Button
            v-if="!isNewPlan"
            @click="handleDuplicate"
          >
            <template #icon><CopyOutlined /></template>
            复制
          </Button>
          <Button
            v-if="!isNewPlan"
            danger
            @click="handleDelete"
          >
            <template #icon><DeleteOutlined /></template>
            删除
          </Button>
          <Button @click="() => {}">
            <template #icon><EyeOutlined /></template>
            预览
          </Button>
          <Button
            type="primary"
            :loading="saving"
            @click="saveLessonPlan"
          >
            <template #icon><SaveOutlined /></template>
            保存
          </Button>
        </Space>
      </template>
    </PageHeader>

    <!-- Main content -->
    <Spin :spinning="loading" tip="加载中...">
      <Layout.Content class="designer-content">
        <div class="split-pane">
          <!-- Left: Form (60%) -->
          <div class="form-pane">
            <LessonPlanForm
              :lesson-plan="lessonPlan"
              :modified-fields="modifiedFields"
              :disabled="loading"
              @update:lesson-plan="(val) => (lessonPlan = val)"
              @update:field="handleFieldUpdate"
            />
          </div>

          <!-- Right: Chat (40%) -->
          <div class="chat-pane">
            <LessonPlanChat
              ref="chatRef"
              :pending-updates="pendingUpdates"
              :can-undo="canUndo"
              @send="handleChatMessage"
              @apply-update="applyUpdate"
              @undo-update="undoUpdate"
              @discard-update="discardUpdate"
            />
          </div>
        </div>
      </Layout.Content>
    </Spin>
  </Layout>
</template>

<style scoped>
.designer-layout {
  min-height: 100vh;
  background: #f0f2f5;
}

.designer-content {
  padding: 0 24px 24px;
}

.split-pane {
  display: flex;
  gap: 16px;
  height: calc(100vh - 140px);
}

.form-pane {
  flex: 6;
  overflow-y: auto;
  background: #fff;
  border-radius: 8px;
  padding: 16px;
}

.chat-pane {
  flex: 4;
  min-width: 350px;
}
</style>
