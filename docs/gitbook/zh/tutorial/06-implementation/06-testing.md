# 6.6 测试

测试一个即见Agentic Solution 需要验证三个层面：Solution 后端服务、REST API 端点、以及从聊天到保存数据的端到端用户流程。在本节中，你将使用项目中已有的工具为每个层面编写测试。

## 测试策略

```
┌────────────────────────────────────────────────────┐
│                   测试金字塔                        │
│                                                    │
│                    ┌──────┐                        │
│                    │ E2E  │  用户流程               │
│                   ─┴──────┴─                       │
│                  ┌──────────┐                      │
│                  │ 集成测试  │  API 端点             │
│                 ─┴──────────┴─                     │
│                ┌──────────────┐                    │
│                │   单元测试   │  服务、工具函数       │
│                └──────────────┘                    │
└────────────────────────────────────────────────────┘
```

| 层面 | 工具 | 测试内容 |
|------|------|---------|
| 单元 | Jest（后端）、Vitest（前端） | 服务方法、工具函数、数据转换 |
| 集成 | Jest + supertest | API 端点、数据库操作、请求校验 |
| E2E | Vitest + Testing Library | 组件渲染、用户交互、Hook 行为 |

## 单元测试：后端服务

单元测试验证单个服务方法在隔离环境中正确工作。后端使用 Jest 和 `ts-jest`。

### 测试 LessonPlansService

在服务旁边创建测试文件：

```typescript
// backend/src/lesson-plans/lesson-plans.service.spec.ts

import { LessonPlansService } from './lesson-plans.service'
import Database from 'better-sqlite3'
import { NotFoundException } from '@nestjs/common'

describe('LessonPlansService', () => {
  let service: LessonPlansService
  let db: Database.Database

  beforeEach(() => {
    // 创建内存数据库用于测试
    db = new Database(':memory:')
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')

    // 初始化 schema
    db.exec(`
      CREATE TABLE lesson_plans (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        subject TEXT DEFAULT '',
        grade_level INTEGER DEFAULT 1,
        duration_minutes INTEGER DEFAULT 45,
        lesson_plan_code TEXT DEFAULT NULL,
        status TEXT DEFAULT 'DRAFT',
        publisher TEXT DEFAULT NULL,
        volume TEXT DEFAULT NULL,
        chapter_id INTEGER DEFAULT NULL,
        chapter_title TEXT DEFAULT NULL,
        curriculum_requirements TEXT DEFAULT NULL,
        objectives TEXT DEFAULT NULL,
        student_analysis TEXT DEFAULT NULL,
        materials_needed TEXT DEFAULT NULL,
        content TEXT DEFAULT NULL,
        assessment_methods TEXT DEFAULT NULL,
        teaching_methods TEXT DEFAULT NULL,
        extra_properties TEXT DEFAULT NULL,
        attachments TEXT DEFAULT NULL,
        create_by TEXT DEFAULT NULL,
        create_time TEXT NOT NULL,
        update_by TEXT DEFAULT NULL,
        update_time TEXT NOT NULL,
        remark TEXT DEFAULT NULL,
        deleted INTEGER DEFAULT 0
      )
    `)

    // 直接注入内存数据库
    service = new LessonPlansService(db)
  })

  afterEach(() => {
    db.close()
  })

  describe('create', () => {
    it('should create a lesson plan with default values', () => {
      const plan = service.create({ title: '分数入门' })

      expect(plan.title).toBe('分数入门')
      expect(plan.status).toBe('DRAFT')
      expect(plan.subject).toBe('')
      expect(plan.gradeLevel).toBe(1)
      expect(plan.durationMinutes).toBe(45)
      expect(plan.id).toBeDefined()
    })

    it('should create a lesson plan with all fields', () => {
      const plan = service.create({
        title: '一元一次方程',
        subject: '数学',
        gradeLevel: 8,
        durationMinutes: 40,
        publisher: '人教版',
        volume: '上册',
        chapterId: 3,
        chapterTitle: '第三章：一元一次方程',
      })

      expect(plan.title).toBe('一元一次方程')
      expect(plan.subject).toBe('数学')
      expect(plan.gradeLevel).toBe(8)
      expect(plan.durationMinutes).toBe(40)
      expect(plan.publisher).toBe('人教版')
    })
  })

  describe('findAll', () => {
    beforeEach(() => {
      service.create({ title: '教案 A', subject: '数学' })
      service.create({ title: '教案 B', subject: '英语' })
      service.create({ title: '教案 C', subject: '数学' })
    })

    it('should return all lesson plans', () => {
      const plans = service.findAll()
      expect(plans).toHaveLength(3)
    })
  })

  describe('findByIdOrFail', () => {
    it('should return a lesson plan by id', () => {
      const created = service.create({ title: '找到我' })
      const found = service.findByIdOrFail(created.id)
      expect(found.title).toBe('找到我')
    })

    it('should throw NotFoundException for missing id', () => {
      expect(() => service.findByIdOrFail('nonexistent')).toThrow(
        NotFoundException,
      )
    })
  })

  describe('update', () => {
    it('should update specific fields', () => {
      const plan = service.create({ title: '原始标题' })
      const updated = service.update(plan.id, {
        title: '更新后的标题',
        objectives: '学生将理解分数的基本概念',
      })

      expect(updated.title).toBe('更新后的标题')
      expect(updated.objectives).toBe('学生将理解分数的基本概念')
      expect(updated.status).toBe('DRAFT') // 未更改
    })
  })

  describe('delete', () => {
    it('should delete a lesson plan', () => {
      const plan = service.create({ title: '删除我' })
      const result = service.delete(plan.id)

      expect(result).toBe(true)
      expect(service.findById(plan.id)).toBeNull()
    })

    it('should return false for missing id', () => {
      const result = service.delete('nonexistent')
      expect(result).toBe(false)
    })
  })

  describe('patchField', () => {
    it('should update a single field', () => {
      const plan = service.create({ title: '补丁测试' })
      const updated = service.patchField(
        plan.id,
        'objectives',
        '新的学习目标',
      )

      expect(updated.objectives).toBe('新的学习目标')
      expect(updated.title).toBe('补丁测试') // 未更改
    })

    it('should handle JSON fields correctly', () => {
      const plan = service.create({ title: 'JSON 测试' })
      const standards = [
        { id: 1, standardCode: 'MA-3-1', title: '数感',
          stage: '小学', standardType: '核心',
          contentDomain: '数与代数' },
      ]
      const updated = service.patchField(
        plan.id,
        'curriculumRequirements',
        standards,
      )

      expect(updated.curriculumRequirements).toHaveLength(1)
      expect(updated.curriculumRequirements[0].standardCode).toBe(
        'MA-3-1',
      )
    })
  })
})
```

### 关键测试模式

**内存数据库。** 通过创建 `Database(':memory:')` 实例，每个测试套件都获得一个干净的 SQLite 数据库。这既快速又避免了文件清理。

**真实数据库，不用 mock。** 对于数据访问服务，使用真实数据库（即使是内存数据库）可以捕获 mock 会遗漏的 SQL 错误和 schema 问题。

**beforeEach/afterEach 生命周期。** 每个测试获得一个新的数据库。这防止一个测试的数据影响另一个测试。

### 运行单元测试

```bash
cd solutions/lesson-plan-designer/backend
npm test
```

预期输出：

```
PASS  src/lesson-plans/lesson-plans.service.spec.ts
  LessonPlansService
    create
      ✓ should create a lesson plan with default values
      ✓ should create a lesson plan with all fields
    findAll
      ✓ should return all lesson plans
    findByIdOrFail
      ✓ should return a lesson plan by id
      ✓ should throw NotFoundException for missing id
    update
      ✓ should update specific fields
    delete
      ✓ should delete a lesson plan
      ✓ should return false for missing id
    patchField
      ✓ should update a single field
      ✓ should handle JSON fields correctly
```

## 集成测试：API 端点

集成测试验证 HTTP 请求产生正确的响应。它们同时测试控制器、服务和数据库。

### 设置集成测试

安装 `supertest` 用于 HTTP 测试：

```bash
cd solutions/lesson-plan-designer/backend
npm install --save-dev supertest @types/supertest
```

创建集成测试：

```typescript
// backend/src/lesson-plans/lesson-plans.controller.spec.ts

import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication, ValidationPipe } from '@nestjs/common'
import * as request from 'supertest'
import { AppModule } from '../app.module'

describe('Lesson Plans API (integration)', () => {
  let app: INestApplication

  beforeAll(async () => {
    process.env.DB_PATH = ':memory:'

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication()
    app.setGlobalPrefix('api')
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      transform: true,
    }))
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  describe('POST /api/lesson-plans', () => {
    it('should create a lesson plan', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/lesson-plans')
        .send({ title: '分数入门' })
        .expect(201)

      expect(response.body.title).toBe('分数入门')
      expect(response.body.id).toBeDefined()
      expect(response.body.status).toBe('DRAFT')
    })

    it('should create a lesson plan with all fields', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/lesson-plans')
        .send({
          title: '一元二次方程',
          subject: '数学',
          gradeLevel: 9,
          durationMinutes: 40,
          publisher: '人教版',
          volume: '下册',
        })
        .expect(201)

      expect(response.body.subject).toBe('数学')
      expect(response.body.gradeLevel).toBe(9)
    })

    it('should return 400 when title is missing', async () => {
      await request(app.getHttpServer())
        .post('/api/lesson-plans')
        .send({ subject: '数学' })
        .expect(400)
    })
  })

  describe('GET /api/lesson-plans', () => {
    it('should return all lesson plans', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/lesson-plans')
        .expect(200)

      expect(Array.isArray(response.body)).toBe(true)
      expect(response.body.length).toBeGreaterThan(0)
    })
  })

  describe('GET /api/lesson-plans/:id', () => {
    it('should return a specific lesson plan', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/lesson-plans')
        .send({ title: '找到这个教案' })

      const response = await request(app.getHttpServer())
        .get(`/api/lesson-plans/${created.body.id}`)
        .expect(200)

      expect(response.body.title).toBe('找到这个教案')
    })

    it('should return 404 for missing lesson plan', async () => {
      await request(app.getHttpServer())
        .get('/api/lesson-plans/nonexistent-id')
        .expect(404)
    })
  })

  describe('PUT /api/lesson-plans/:id', () => {
    it('should update a lesson plan', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/lesson-plans')
        .send({ title: '更新前' })

      const response = await request(app.getHttpServer())
        .put(`/api/lesson-plans/${created.body.id}`)
        .send({
          title: '更新后',
          objectives: '学生将学习分数的基本概念',
        })
        .expect(200)

      expect(response.body.title).toBe('更新后')
      expect(response.body.objectives).toBe(
        '学生将学习分数的基本概念',
      )
    })
  })

  describe('PATCH /api/lesson-plans/:id/field', () => {
    it('should patch a single field', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/lesson-plans')
        .send({ title: '补丁测试' })

      const response = await request(app.getHttpServer())
        .patch(`/api/lesson-plans/${created.body.id}/field`)
        .send({
          field: 'content',
          value: '第一步：导入新课...',
        })
        .expect(200)

      expect(response.body.content).toBe('第一步：导入新课...')
    })

    it('should reject invalid fields', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/lesson-plans')
        .send({ title: '无效字段测试' })

      await request(app.getHttpServer())
        .patch(`/api/lesson-plans/${created.body.id}/field`)
        .send({ field: 'invalid_field', value: 'test' })
        .expect(400)
    })
  })

  describe('DELETE /api/lesson-plans/:id', () => {
    it('should delete a lesson plan', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/lesson-plans')
        .send({ title: '删除我' })

      await request(app.getHttpServer())
        .delete(`/api/lesson-plans/${created.body.id}`)
        .expect(204)

      await request(app.getHttpServer())
        .get(`/api/lesson-plans/${created.body.id}`)
        .expect(404)
    })
  })
})
```

### 集成测试能捕获什么

集成测试能捕获单元测试遗漏的问题：

- **路由错误** -- 控制器装饰器中的拼写错误意味着端点不存在
- **校验管道** -- `ValidationPipe` 会剥离未知字段并转换类型
- **HTTP 状态码** -- NestJS 自动将 `NotFoundException` 转换为 404
- **JSON 序列化** -- 响应体匹配预期的形状

## 前端测试：组件和 Hooks

前端使用 Vitest 和 React Testing Library。这些测试验证组件正确渲染和 hooks 按预期工作。

### 测试 LessonPlanContent 组件

```typescript
// frontend/src/components/LessonPlanContent.test.tsx

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LessonPlanContent } from './LessonPlanContent'
import type { LessonPlan, SyncField } from '../types'

const mockLessonPlan: LessonPlan = {
  id: 'lp-1',
  title: '分数入门',
  subject: '数学',
  gradeLevel: 3,
  durationMinutes: 45,
  lessonPlanCode: null,
  status: 'DRAFT',
  publisher: '人教版',
  volume: '上册',
  chapterId: 5,
  chapterTitle: '第五章：分数的初步认识',
  curriculumRequirements: [],
  objectives: '学生将理解分数的基本概念',
  studentAnalysis: null,
  materialsNeeded: '分数卡片、白板',
  content: '第一步：认识二分之一...',
  assessmentMethods: null,
  teachingMethods: '探究式学习',
  extraProperties: {},
  attachments: [],
  createBy: null,
  createTime: '2026-01-01T00:00:00Z',
  updateBy: null,
  updateTime: '2026-01-01T00:00:00Z',
  remark: null,
  deleted: 0,
}

describe('LessonPlanContent', () => {
  const defaultProps = {
    lessonPlan: mockLessonPlan,
    modifiedFields: new Set<SyncField>(),
    editingSections: new Set<string>(),
    savingSections: new Set<string>(),
    canUndo: () => false,
    onUndo: vi.fn(),
    onChange: vi.fn(),
    onStartEdit: vi.fn(),
    onSaveEdit: vi.fn(),
    onCancelEdit: vi.fn(),
  }

  it('should render the lesson plan title', () => {
    render(<LessonPlanContent {...defaultProps} />)
    const titleInput = screen.getByDisplayValue('分数入门')
    expect(titleInput).toBeDefined()
  })

  it('should render content sections', () => {
    render(<LessonPlanContent {...defaultProps} />)

    expect(screen.getByText('学习目标')).toBeDefined()
    expect(screen.getByText('教学方法')).toBeDefined()
    expect(screen.getByText('学习过程')).toBeDefined()
  })

  it('should show AI-modified indicator for synced fields', () => {
    render(
      <LessonPlanContent
        {...defaultProps}
        modifiedFields={new Set<SyncField>(['objectives'])}
      />,
    )

    const objectivesTextarea = screen.getByDisplayValue(
      '学生将理解分数的基本概念',
    )
    expect(
      objectivesTextarea.classList.contains('ai-modified'),
    ).toBe(true)
  })

  it('should display publisher and volume when set', () => {
    render(<LessonPlanContent {...defaultProps} />)
    expect(screen.getByDisplayValue('人教版')).toBeDefined()
    expect(screen.getByDisplayValue('上册')).toBeDefined()
  })
})
```

### 测试 ChatPanel 组件

```typescript
// frontend/src/components/ChatPanel.test.tsx

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ChatPanel } from './ChatPanel'

describe('ChatPanel', () => {
  const defaultProps = {
    messages: [],
    isProcessing: false,
    connected: true,
    onSendMessage: vi.fn(),
    onSync: vi.fn(),
    onDiscard: vi.fn(),
  }

  it('should show empty state when no messages', () => {
    render(<ChatPanel {...defaultProps} />)

    expect(
      screen.getByText('开始备课对话'),
    ).toBeDefined()
  })

  it('should show connection status', () => {
    const { rerender } = render(
      <ChatPanel {...defaultProps} connected={true} />,
    )

    // 重新渲染为断开连接状态
    rerender(
      <ChatPanel {...defaultProps} connected={false} />,
    )

    const input = screen.getByPlaceholderText('正在连接服务器...')
    expect(input).toHaveProperty('disabled', true)
  })

  it('should call onSendMessage when form is submitted', () => {
    const onSend = vi.fn()
    render(
      <ChatPanel {...defaultProps} onSendMessage={onSend} />,
    )

    const input = screen.getByPlaceholderText(
      '输入您的备课需求...',
    )
    fireEvent.change(input, {
      target: { value: '设计一节三年级分数教学的学习目标' },
    })
    fireEvent.submit(input.closest('form')!)

    expect(onSend).toHaveBeenCalledWith(
      '设计一节三年级分数教学的学习目标',
    )
  })

  it('should disable input when disconnected', () => {
    render(
      <ChatPanel {...defaultProps} connected={false} />,
    )

    const input = screen.getByPlaceholderText('正在连接服务器...')
    expect(input).toHaveProperty('disabled', true)
  })
})
```

### 运行前端测试

```bash
cd solutions/lesson-plan-designer/frontend
npm run test:run
```

## E2E 测试：完整用户流程

端到端测试验证完整的用户旅程：打开应用、输入消息、看到 AI 回复、验证教案被更新。对于真正的 E2E 测试，你会使用 Playwright 或 Cypress，这里给出一个概念性的大纲：

```
E2E 测试："通过聊天创建教案"

1. 启动 Solution 后端（端口 3002）和 CCAAS（端口 3001）
2. 启动前端（端口 5173）
3. 打开 http://localhost:5173
4. 点击"新建教案"，填写：标题、学科、年级
5. 验证空白教案表单加载
6. 输入"设计一节三年级分数教学的学习目标"
7. 等待 AI 回复
8. 验证 output_update 事件填充学习目标字段
9. 点击学习目标更新上的"同步"按钮
10. 验证学习目标部分显示 AI 生成的内容
11. 验证该字段被高亮为 AI 修改
```

对于本教程，手动验证此流程就足够了。在生产 Solution 中，使用 Playwright 自动化这个流程。

## 测试组织

推荐的测试文件放置方式：

```
backend/
└── src/
    └── lesson-plans/
        ├── lesson-plans.service.ts
        ├── lesson-plans.service.spec.ts       # 单元测试
        ├── lesson-plans.controller.ts
        └── lesson-plans.controller.spec.ts    # 集成测试

frontend/
└── src/
    ├── components/
    │   ├── LessonPlanContent.tsx
    │   ├── LessonPlanContent.test.tsx          # 组件测试
    │   ├── ChatPanel.tsx
    │   └── ChatPanel.test.tsx                  # 组件测试
    └── hooks/
        ├── useLessonPlanSession.ts
        └── useLessonPlanSession.test.ts        # Hook 测试
```

测试放在它们所测试的代码旁边。这使得查找任何文件的测试变得容易，并保持关系可见。

## 常见陷阱

{% hint style="danger" %}
**陷阱 1：使用 mock 数据库测试。** Mock 数据库会隐藏真实的 SQL 错误。改用内存 SQLite 数据库（`:memory:`）。它快速、一次性、能捕获 schema 问题。
{% endhint %}

{% hint style="danger" %}
**陷阱 2：修改代码前后不运行测试。** CLAUDE.md 中的 TDD 规则适用：修改代码前始终运行 `npm test`，修改后立即运行。测试失败应该阻止你继续前进。
{% endhint %}

{% hint style="danger" %}
**陷阱 3：测试实现细节而不是行为。** 不要测试是否调用了特定的 SQL 查询。测试创建教案是否返回预期的形状。测试补丁字段是否只更新该字段。这使测试在重构时保持稳健。
{% endhint %}

## 检查点

在继续部署之前，验证：

- [ ] `cd backend && npm test` 通过所有单元和集成测试
- [ ] `cd frontend && npm test` 通过所有组件测试
- [ ] 你理解三层测试策略：单元、集成、E2E
- [ ] 测试文件与它们测试的代码放在一起

运行完整的测试套件：

```bash
# 后端测试
cd solutions/lesson-plan-designer/backend
npm test

# 前端测试
cd solutions/lesson-plan-designer/frontend
npm run test:run
```

两个命令都应该以零失败退出。

## 下一步

测试在整个技术栈中通过后，你可以添加会话持久化功能。继续前往 [6.7 会话持久化](07-conversation-persistence.md)。
