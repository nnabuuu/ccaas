# Lesson Plan Designer Solution

AI辅助备课解决方案，提供结构化的备课表单和AI聊天界面，支持实时内容同步。

## 功能特性

- **结构化表单** - 支持教学目标、课程标准、教学材料、教学活动、评估方式、差异化教学等模块
- **AI辅助设计** - 通过Chat面板与AI交互，生成备课内容
- **同步按钮** - AI生成的内容显示"同步到表单"按钮，点击即可应用
- **AI修改标记** - 已被AI修改的字段显示黄色边框和徽章
- **撤销功能** - 支持30秒内撤销AI同步的内容
- **多租户支持** - 完整的租户隔离

## 架构设计

```
+-------------------------------------------------------------+
| Header: 标题 | 保存 | 发布 | 预览                             |
+-----------------------------------+-------------------------+
|                                   |                         |
|  备课表单 (60%)                    |  AI Chat (40%)          |
|  +-----------------------------+  |  +-------------------+  |
|  | 基本信息                      |  |  | 消息列表          |  |
|  +-----------------------------+  |  |                   |  |
|  | ▼ 教学目标 [AI已修改]         |  |  | [AI] 这是建议的  |  |
|  +-----------------------------+  |  | 教学目标...       |  |
|  | ▶ 课程标准                    |  |  | [同步到表单] ----|--|
|  +-----------------------------+  |  |                   |  |
|  | ▶ 教学材料                    |  |  | [用户] 继续...   |  |
|  +-----------------------------+  |  +-------------------+  |
|  | ▼ 教学活动                    |  |  | 输入框           |  |
|  +-----------------------------+  |  | 快捷提示按钮      |  |
|  | ▶ 评估方式                    |  |  +-------------------+  |
|  +-----------------------------+  |                         |
|  | ▶ 差异化教学                  |  |                         |
|  +-----------------------------+  |                         |
+-----------------------------------+-------------------------+
```

## 数据模型

### LessonPlan

```typescript
interface LessonPlan {
  id: string
  tenantId: string
  title: string
  subject: string           // 学科
  gradeLevel: string        // 年级
  duration: string          // 课时

  objectives: LearningObjective[]   // 教学目标
  standards: Standard[]             // 课程标准
  materials: Material[]             // 教学材料
  activities: Activity[]            // 教学活动
  assessment: Assessment            // 评估方式
  differentiation: Differentiation  // 差异化教学

  status: 'draft' | 'review' | 'published'
  createdAt: string
  updatedAt: string
}
```

### LearningObjective

```typescript
interface LearningObjective {
  id: string
  description: string
  bloomLevel: 'remember' | 'understand' | 'apply' | 'analyze' | 'evaluate' | 'create'
  assessmentCriteria?: string
}
```

### Activity

```typescript
interface Activity {
  id: string
  title: string
  description: string
  duration: number  // minutes
  type: 'introduction' | 'direct-instruction' | 'guided-practice' |
        'independent-practice' | 'group' | 'assessment' | 'closure'
  instructions: string[]
  materials?: string[]
  teacherNotes?: string
}
```

## API 接口

| 方法 | 路径 | 用途 |
|-----|-----|-----|
| POST | `/api/v1/lesson-plans` | 创建备课 |
| GET | `/api/v1/lesson-plans` | 列表查询 |
| GET | `/api/v1/lesson-plans/:id` | 获取详情 |
| PUT | `/api/v1/lesson-plans/:id` | 更新备课 |
| DELETE | `/api/v1/lesson-plans/:id` | 删除备课 |
| POST | `/api/v1/lesson-plans/:id/duplicate` | 复制备课 |
| PATCH | `/api/v1/lesson-plans/:id/field` | 单字段更新（AI同步） |

### 查询参数

```
GET /api/v1/lesson-plans?status=draft&subject=数学&gradeLevel=三年级
```

### 单字段更新（AI同步）

```json
PATCH /api/v1/lesson-plans/:id/field
{
  "field": "objectives",
  "value": [
    {
      "id": "obj-1",
      "description": "学生能够理解分数的基本概念",
      "bloomLevel": "understand"
    }
  ]
}
```

## 前端组件

### useLessonPlanSync Composable

```typescript
import { useLessonPlanSync } from '@ccaas/vue-sdk'

const {
  lessonPlan,           // 当前备课数据
  pendingUpdates,       // AI待同步更新
  hasPendingUpdates,    // 是否有待同步更新
  modifiedFields,       // 已被AI修改的字段集合
  handleOutputUpdate,   // 处理AI输出更新
  applyUpdate,          // 应用单个更新
  applyAllUpdates,      // 应用所有更新
  discardUpdate,        // 丢弃单个更新
  undoUpdate,           // 撤销已应用的更新
  canUndo,              // 检查是否可撤销
  isFieldModified,      // 检查字段是否被修改
} = useLessonPlanSync({
  initialPlan: myLessonPlan,
  onApply: async (field, value) => {
    // 持久化到后端
    await api.updateLessonPlanField(lessonPlan.value.id, field, value)
  },
  undoTimeout: 30000,  // 30秒撤销窗口
})
```

### 组件结构

```
src/
├── components/lesson-plans/
│   ├── SyncButton.vue        # 同步按钮（显示在Chat消息中）
│   ├── LessonPlanForm.vue    # 备课表单
│   └── LessonPlanChat.vue    # AI Chat面板
└── views/lesson-plans/
    ├── LessonPlanListView.vue      # 列表页面
    └── LessonPlanDesignerView.vue  # 设计器页面
```

## 同步流程

```
1. 用户在Chat中输入需求
2. AI处理并通过 output_update 事件返回结构化内容
3. 前端解析事件，调用 handleOutputUpdate()
4. Chat消息中显示"同步到表单"按钮
5. 用户点击按钮，调用 applyUpdate()
6. 表单字段更新，显示"AI已修改"标记
7. 后端API持久化更新
8. 30秒内可点击"撤销"恢复原值
```

## 快速开始

### 1. 启动服务

```bash
# 启动后端
npm run dev:backend

# 启动前端
npm run dev:admin
```

### 2. 访问页面

```
http://localhost:5174/admin/lesson-plans
```

### 3. 使用流程

1. 点击"新建备课"
2. 在右侧Chat输入"帮我设计一节三年级数学课"
3. AI返回后点击"同步到表单"按钮
4. 表单被填充，显示AI修改标记
5. 点击"保存"持久化

## 测试

```bash
# 运行所有相关测试
npm run test -w @ccaas/common
npm run test -w @ccaas/backend -- --testPathPattern="lesson-plans"
npm run test -w @ccaas/vue-sdk -- useLessonPlanSync

# 测试统计
# @ccaas/common: 18 tests
# @ccaas/backend: 43 tests
# @ccaas/vue-sdk: 18 tests
# Total: 79 tests
```

## 文件结构

```
packages/
├── shared/
│   └── src/types/lesson-plan.ts          # 类型定义
├── backend/
│   └── src/lesson-plans/
│       ├── entities/lesson-plan.entity.ts
│       ├── dto/
│       │   ├── create-lesson-plan.dto.ts
│       │   ├── update-lesson-plan.dto.ts
│       │   └── update-field.dto.ts
│       ├── lesson-plans.service.ts
│       ├── lesson-plans.controller.ts
│       ├── lesson-plans.module.ts
│       └── *.spec.ts
├── vue-sdk/
│   └── src/composables/useLessonPlanSync.ts
└── admin/
    ├── src/api/lessonPlans.ts
    ├── src/stores/lessonPlan.ts
    ├── src/components/lesson-plans/
    │   ├── SyncButton.vue
    │   ├── LessonPlanForm.vue
    │   └── LessonPlanChat.vue
    └── src/views/lesson-plans/
        ├── LessonPlanListView.vue
        └── LessonPlanDesignerView.vue
```

## 扩展开发

### 添加新字段

1. 在 `@ccaas/common/src/types/lesson-plan.ts` 添加类型
2. 在 `LESSON_PLAN_SYNC_FIELDS` 常量中添加字段名
3. 更新 Entity 和 DTO
4. 在 `LessonPlanForm.vue` 中添加表单控件
5. 运行测试确保通过

### 集成真实AI

当前Chat使用模拟响应，要集成真实AI：

1. 在 `LessonPlanDesignerView.vue` 中替换 `handleChatMessage`
2. 连接Socket.io监听 `output_update` 事件
3. 调用 `handleOutputUpdate(field, value)` 处理AI输出

```typescript
// 示例：连接真实AI
socket.on('output_update', (event) => {
  if (event.field && LESSON_PLAN_SYNC_FIELDS.includes(event.field)) {
    handleOutputUpdate(event.field, event.value)
  }
})
```

## 许可证

MIT
