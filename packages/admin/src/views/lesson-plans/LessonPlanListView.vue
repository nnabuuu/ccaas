<script setup lang="ts">
/**
 * LessonPlanListView
 *
 * List view for managing lesson plans.
 */
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  Layout,
  Table,
  Card,
  Button,
  Space,
  Tag,
  Input,
  Select,
  Typography,
  Empty,
  Dropdown,
  Menu,
  message,
  Modal,
} from 'ant-design-vue'
import {
  PlusOutlined,
  SearchOutlined,
  EditOutlined,
  CopyOutlined,
  DeleteOutlined,
  MoreOutlined,
} from '@ant-design/icons-vue'
import { useLessonPlanStore } from '@/stores/lessonPlan'
import type { LessonPlan } from '@ccaas/shared'

const router = useRouter()
const store = useLessonPlanStore()

// Filters
const searchText = ref('')
const statusFilter = ref<string | undefined>()
const subjectFilter = ref<string | undefined>()
const gradeLevelFilter = ref<string | undefined>()

// Load data on mount
onMounted(() => {
  store.fetchLessonPlans()
})

// Filtered plans
const filteredPlans = computed(() => {
  let plans = store.lessonPlans

  if (searchText.value) {
    const search = searchText.value.toLowerCase()
    plans = plans.filter(
      (p) =>
        p.title.toLowerCase().includes(search) ||
        p.subject.toLowerCase().includes(search)
    )
  }

  if (statusFilter.value) {
    plans = plans.filter((p) => p.status === statusFilter.value)
  }

  if (subjectFilter.value) {
    plans = plans.filter((p) => p.subject === subjectFilter.value)
  }

  if (gradeLevelFilter.value) {
    plans = plans.filter((p) => p.gradeLevel === gradeLevelFilter.value)
  }

  return plans
})

// Status colors
const statusColors: Record<string, string> = {
  draft: 'default',
  review: 'processing',
  published: 'success',
}

const statusLabels: Record<string, string> = {
  draft: '草稿',
  review: '审核中',
  published: '已发布',
}

// Table columns
const columns = [
  {
    title: '课程标题',
    dataIndex: 'title',
    key: 'title',
    ellipsis: true,
  },
  {
    title: '学科',
    dataIndex: 'subject',
    key: 'subject',
    width: 100,
  },
  {
    title: '年级',
    dataIndex: 'gradeLevel',
    key: 'gradeLevel',
    width: 100,
  },
  {
    title: '课时',
    dataIndex: 'duration',
    key: 'duration',
    width: 100,
  },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: 100,
  },
  {
    title: '更新时间',
    dataIndex: 'updatedAt',
    key: 'updatedAt',
    width: 180,
  },
  {
    title: '操作',
    key: 'actions',
    width: 120,
    fixed: 'right',
  },
]

// Actions
function handleCreate() {
  router.push('/lesson-plans/new')
}

function handleEdit(plan: LessonPlan) {
  router.push(`/lesson-plans/${plan.id}`)
}

async function handleDuplicate(plan: LessonPlan) {
  try {
    const duplicated = await store.duplicateLessonPlan(plan.id)
    message.success('课程已复制')
    router.push(`/lesson-plans/${duplicated.id}`)
  } catch (e) {
    message.error('复制失败')
  }
}

function handleDelete(plan: LessonPlan) {
  Modal.confirm({
    title: '确认删除',
    content: `确定要删除「${plan.title}」吗？此操作不可撤销。`,
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    async onOk() {
      try {
        await store.deleteLessonPlan(plan.id)
        message.success('课程已删除')
      } catch (e) {
        message.error('删除失败')
      }
    },
  })
}

// Format date
function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}
</script>

<template>
  <Layout.Content style="padding: 24px">
    <Card>
      <template #title>
        <Space>
          <span>备课管理</span>
          <Tag>{{ filteredPlans.length }} 个课程</Tag>
        </Space>
      </template>

      <template #extra>
        <Button type="primary" @click="handleCreate">
          <template #icon><PlusOutlined /></template>
          新建备课
        </Button>
      </template>

      <!-- Filters -->
      <Space style="margin-bottom: 16px" wrap>
        <Input
          v-model:value="searchText"
          placeholder="搜索课程标题或学科"
          style="width: 200px"
          allow-clear
        >
          <template #prefix><SearchOutlined /></template>
        </Input>

        <Select
          v-model:value="statusFilter"
          placeholder="状态"
          style="width: 120px"
          allow-clear
        >
          <Select.Option value="draft">草稿</Select.Option>
          <Select.Option value="review">审核中</Select.Option>
          <Select.Option value="published">已发布</Select.Option>
        </Select>

        <Select
          v-model:value="subjectFilter"
          placeholder="学科"
          style="width: 120px"
          allow-clear
        >
          <Select.Option v-for="subject in store.subjects" :key="subject" :value="subject">
            {{ subject }}
          </Select.Option>
        </Select>

        <Select
          v-model:value="gradeLevelFilter"
          placeholder="年级"
          style="width: 120px"
          allow-clear
        >
          <Select.Option v-for="grade in store.gradeLevels" :key="grade" :value="grade">
            {{ grade }}
          </Select.Option>
        </Select>
      </Space>

      <!-- Table -->
      <Table
        :columns="columns"
        :data-source="filteredPlans"
        :loading="store.loading"
        :pagination="{ pageSize: 10, showSizeChanger: true }"
        row-key="id"
        :scroll="{ x: 900 }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'title'">
            <a @click="handleEdit(record)">{{ record.title || '(无标题)' }}</a>
          </template>

          <template v-else-if="column.key === 'status'">
            <Tag :color="statusColors[record.status]">
              {{ statusLabels[record.status] }}
            </Tag>
          </template>

          <template v-else-if="column.key === 'updatedAt'">
            {{ formatDate(record.updatedAt) }}
          </template>

          <template v-else-if="column.key === 'actions'">
            <Space>
              <Button type="link" size="small" @click="handleEdit(record)">
                <EditOutlined />
              </Button>
              <Dropdown>
                <Button type="link" size="small">
                  <MoreOutlined />
                </Button>
                <template #overlay>
                  <Menu>
                    <Menu.Item key="duplicate" @click="handleDuplicate(record)">
                      <CopyOutlined /> 复制
                    </Menu.Item>
                    <Menu.Divider />
                    <Menu.Item key="delete" danger @click="handleDelete(record)">
                      <DeleteOutlined /> 删除
                    </Menu.Item>
                  </Menu>
                </template>
              </Dropdown>
            </Space>
          </template>
        </template>

        <template #emptyText>
          <Empty description="暂无备课">
            <Button type="primary" @click="handleCreate">
              <PlusOutlined /> 开始备课
            </Button>
          </Empty>
        </template>
      </Table>
    </Card>
  </Layout.Content>
</template>
