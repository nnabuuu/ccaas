<script setup lang="ts">
/**
 * LessonPlanForm Component
 *
 * Form for editing lesson plan content with collapsible sections.
 * Shows AI modification indicators on modified fields.
 */
import { ref, computed, watch } from 'vue'
import {
  Form,
  Input,
  InputNumber,
  Select,
  Collapse,
  Badge,
  Space,
  Button,
  Tag,
  Card,
  Typography,
} from 'ant-design-vue'
import {
  PlusOutlined,
  DeleteOutlined,
  RobotOutlined,
} from '@ant-design/icons-vue'
import type {
  LessonPlan,
  LessonPlanSyncField,
  LearningObjective,
  Activity,
  BloomLevel,
  ActivityType,
} from '@ccaas/shared'

const props = defineProps<{
  lessonPlan: LessonPlan
  modifiedFields: Set<LessonPlanSyncField>
  disabled?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:lessonPlan', value: LessonPlan): void
  (e: 'update:field', field: LessonPlanSyncField, value: unknown): void
}>()

// Local form state
const form = ref({ ...props.lessonPlan })

// Watch for external changes
watch(
  () => props.lessonPlan,
  (newPlan) => {
    form.value = { ...newPlan }
  },
  { deep: true }
)

// Update parent on changes
function updateField<K extends LessonPlanSyncField>(
  field: K,
  value: LessonPlan[K]
) {
  form.value = { ...form.value, [field]: value }
  emit('update:field', field, value)
}

// Check if a field is AI-modified
function isModified(field: LessonPlanSyncField): boolean {
  return props.modifiedFields.has(field)
}

// Bloom levels
const bloomLevels: BloomLevel[] = [
  'remember',
  'understand',
  'apply',
  'analyze',
  'evaluate',
  'create',
]

const bloomLevelLabels: Record<BloomLevel, string> = {
  remember: '记忆',
  understand: '理解',
  apply: '应用',
  analyze: '分析',
  evaluate: '评价',
  create: '创造',
}

// Activity types
const activityTypes: ActivityType[] = [
  'introduction',
  'direct-instruction',
  'guided-practice',
  'independent-practice',
  'group',
  'assessment',
  'closure',
]

const activityTypeLabels: Record<ActivityType, string> = {
  introduction: '导入',
  'direct-instruction': '直接教学',
  'guided-practice': '引导练习',
  'independent-practice': '独立练习',
  group: '小组活动',
  assessment: '评估',
  closure: '结束',
}

// Objectives management
function addObjective() {
  const newObjective: LearningObjective = {
    id: crypto.randomUUID(),
    description: '',
    bloomLevel: 'understand',
  }
  updateField('objectives', [...form.value.objectives, newObjective])
}

function removeObjective(index: number) {
  const objectives = [...form.value.objectives]
  objectives.splice(index, 1)
  updateField('objectives', objectives)
}

function updateObjective(index: number, updates: Partial<LearningObjective>) {
  const objectives = [...form.value.objectives]
  objectives[index] = { ...objectives[index], ...updates }
  updateField('objectives', objectives)
}

// Activities management
function addActivity() {
  const newActivity: Activity = {
    id: crypto.randomUUID(),
    title: '',
    description: '',
    duration: 10,
    type: 'introduction',
    instructions: [],
  }
  updateField('activities', [...form.value.activities, newActivity])
}

function removeActivity(index: number) {
  const activities = [...form.value.activities]
  activities.splice(index, 1)
  updateField('activities', activities)
}

function updateActivity(index: number, updates: Partial<Activity>) {
  const activities = [...form.value.activities]
  activities[index] = { ...activities[index], ...updates }
  updateField('activities', activities)
}

// Calculate total duration
const totalDuration = computed(() =>
  form.value.activities.reduce((sum, act) => sum + (act.duration || 0), 0)
)
</script>

<template>
  <Form layout="vertical" :disabled="disabled">
    <!-- Basic Info -->
    <Card size="small" class="section-card">
      <template #title>
        <Space>
          <span>基本信息</span>
          <Tag v-if="isModified('title')" color="orange">
            <RobotOutlined /> AI已修改
          </Tag>
        </Space>
      </template>

      <Form.Item label="课程标题">
        <Input
          v-model:value="form.title"
          placeholder="输入课程标题"
          :class="{ 'ai-modified': isModified('title') }"
          @change="updateField('title', form.title)"
        />
      </Form.Item>

      <Space :size="16" wrap>
        <Form.Item label="学科" style="width: 150px">
          <Input
            v-model:value="form.subject"
            placeholder="学科"
            :class="{ 'ai-modified': isModified('subject') }"
            @change="updateField('subject', form.subject)"
          />
        </Form.Item>

        <Form.Item label="年级" style="width: 150px">
          <Input
            v-model:value="form.gradeLevel"
            placeholder="年级"
            :class="{ 'ai-modified': isModified('gradeLevel') }"
            @change="updateField('gradeLevel', form.gradeLevel)"
          />
        </Form.Item>

        <Form.Item label="课时" style="width: 150px">
          <Input
            v-model:value="form.duration"
            placeholder="如: 40分钟"
            :class="{ 'ai-modified': isModified('duration') }"
            @change="updateField('duration', form.duration)"
          />
        </Form.Item>
      </Space>
    </Card>

    <!-- Objectives -->
    <Collapse :bordered="false" class="section-collapse">
      <Collapse.Panel key="objectives">
        <template #header>
          <Space>
            <span>教学目标</span>
            <Badge :count="form.objectives.length" :number-style="{ backgroundColor: '#52c41a' }" />
            <Tag v-if="isModified('objectives')" color="orange">
              <RobotOutlined /> AI已修改
            </Tag>
          </Space>
        </template>

        <div v-for="(obj, index) in form.objectives" :key="obj.id" class="list-item">
          <Space direction="vertical" style="width: 100%">
            <Space wrap>
              <Input
                :value="obj.description"
                placeholder="描述学习目标"
                style="width: 400px"
                @change="(e: any) => updateObjective(index, { description: e.target.value })"
              />
              <Select
                :value="obj.bloomLevel"
                style="width: 100px"
                @change="(val: BloomLevel) => updateObjective(index, { bloomLevel: val })"
              >
                <Select.Option v-for="level in bloomLevels" :key="level" :value="level">
                  {{ bloomLevelLabels[level] }}
                </Select.Option>
              </Select>
              <Button type="text" danger @click="removeObjective(index)">
                <DeleteOutlined />
              </Button>
            </Space>
            <Input
              :value="obj.assessmentCriteria"
              placeholder="评估标准（选填）"
              size="small"
              @change="(e: any) => updateObjective(index, { assessmentCriteria: e.target.value })"
            />
          </Space>
        </div>

        <Button type="dashed" block @click="addObjective">
          <PlusOutlined /> 添加教学目标
        </Button>
      </Collapse.Panel>
    </Collapse>

    <!-- Activities -->
    <Collapse :bordered="false" class="section-collapse">
      <Collapse.Panel key="activities">
        <template #header>
          <Space>
            <span>教学活动</span>
            <Badge :count="form.activities.length" :number-style="{ backgroundColor: '#1890ff' }" />
            <Typography.Text type="secondary">
              总时长: {{ totalDuration }} 分钟
            </Typography.Text>
            <Tag v-if="isModified('activities')" color="orange">
              <RobotOutlined /> AI已修改
            </Tag>
          </Space>
        </template>

        <div v-for="(act, index) in form.activities" :key="act.id" class="activity-item">
          <Card size="small">
            <Space direction="vertical" style="width: 100%">
              <Space wrap>
                <Input
                  :value="act.title"
                  placeholder="活动标题"
                  style="width: 200px"
                  @change="(e: any) => updateActivity(index, { title: e.target.value })"
                />
                <Select
                  :value="act.type"
                  style="width: 120px"
                  @change="(val: ActivityType) => updateActivity(index, { type: val })"
                >
                  <Select.Option v-for="type in activityTypes" :key="type" :value="type">
                    {{ activityTypeLabels[type] }}
                  </Select.Option>
                </Select>
                <InputNumber
                  :value="act.duration"
                  :min="1"
                  :max="90"
                  addon-after="分钟"
                  style="width: 120px"
                  @change="(val: number | null) => updateActivity(index, { duration: val || 10 })"
                />
                <Button type="text" danger @click="removeActivity(index)">
                  <DeleteOutlined />
                </Button>
              </Space>
              <Input.TextArea
                :value="act.description"
                placeholder="活动描述"
                :rows="2"
                @change="(e: any) => updateActivity(index, { description: e.target.value })"
              />
            </Space>
          </Card>
        </div>

        <Button type="dashed" block @click="addActivity">
          <PlusOutlined /> 添加教学活动
        </Button>
      </Collapse.Panel>
    </Collapse>

    <!-- Assessment -->
    <Collapse :bordered="false" class="section-collapse">
      <Collapse.Panel key="assessment">
        <template #header>
          <Space>
            <span>评估方式</span>
            <Tag v-if="isModified('assessment')" color="orange">
              <RobotOutlined /> AI已修改
            </Tag>
          </Space>
        </template>

        <Form.Item label="形成性评估">
          <Select
            mode="tags"
            :value="form.assessment.formative"
            placeholder="添加形成性评估方式"
            @change="(vals: string[]) => updateField('assessment', { ...form.assessment, formative: vals })"
          />
        </Form.Item>

        <Form.Item label="总结性评估">
          <Select
            mode="tags"
            :value="form.assessment.summative"
            placeholder="添加总结性评估方式"
            @change="(vals: string[]) => updateField('assessment', { ...form.assessment, summative: vals })"
          />
        </Form.Item>
      </Collapse.Panel>
    </Collapse>

    <!-- Differentiation -->
    <Collapse :bordered="false" class="section-collapse">
      <Collapse.Panel key="differentiation">
        <template #header>
          <Space>
            <span>差异化教学</span>
            <Tag v-if="isModified('differentiation')" color="orange">
              <RobotOutlined /> AI已修改
            </Tag>
          </Space>
        </template>

        <Form.Item label="学困生支持">
          <Select
            mode="tags"
            :value="form.differentiation.struggling"
            placeholder="添加支持策略"
            @change="(vals: string[]) => updateField('differentiation', { ...form.differentiation, struggling: vals })"
          />
        </Form.Item>

        <Form.Item label="标准学生">
          <Select
            mode="tags"
            :value="form.differentiation.onLevel"
            placeholder="添加标准活动"
            @change="(vals: string[]) => updateField('differentiation', { ...form.differentiation, onLevel: vals })"
          />
        </Form.Item>

        <Form.Item label="优秀学生扩展">
          <Select
            mode="tags"
            :value="form.differentiation.advanced"
            placeholder="添加扩展活动"
            @change="(vals: string[]) => updateField('differentiation', { ...form.differentiation, advanced: vals })"
          />
        </Form.Item>
      </Collapse.Panel>
    </Collapse>
  </Form>
</template>

<style scoped>
.section-card {
  margin-bottom: 16px;
}

.section-collapse {
  margin-bottom: 16px;
  background: #fff;
}

.section-collapse :deep(.ant-collapse-header) {
  font-weight: 500;
}

.list-item {
  padding: 12px;
  margin-bottom: 8px;
  background: #fafafa;
  border-radius: 4px;
}

.activity-item {
  margin-bottom: 8px;
}

.ai-modified {
  border-color: #faad14 !important;
  background-color: #fffbe6 !important;
}
</style>
