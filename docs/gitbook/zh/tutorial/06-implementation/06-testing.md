# 6.6 测试

测试一个 LoopAI Solution 需要验证三个层面：Solution 后端服务、REST API 端点、以及从聊天到保存数据的端到端用户流程。在本节中，你将使用项目中已有的工具为每个层面编写测试。

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

### 测试 TasksService

在服务旁边创建测试文件：

```typescript
// backend/src/tasks/tasks.service.spec.ts

import { TasksService } from './tasks.service'
import { DatabaseService } from '../database/database.service'
import { NotFoundException } from '@nestjs/common'

describe('TasksService', () => {
  let service: TasksService
  let dbService: DatabaseService

  beforeEach(() => {
    // 创建内存数据库用于测试
    dbService = new DatabaseService()
    process.env.DATABASE_PATH = ':memory:'
    dbService.onModuleInit()
    service = new TasksService(dbService)
  })

  afterEach(() => {
    dbService.onModuleDestroy()
  })

  describe('create', () => {
    it('should create a task with default values', () => {
      const task = service.create({ title: 'Test task' })

      expect(task.title).toBe('Test task')
      expect(task.status).toBe('todo')
      expect(task.priority).toBe('medium')
      expect(task.tags).toEqual([])
      expect(task.id).toBeDefined()
    })

    it('should create a task with all fields', () => {
      const task = service.create({
        title: 'Full task',
        description: 'A detailed description',
        status: 'in_progress',
        priority: 'high',
        dueDate: '2026-03-01',
        tags: ['backend', 'api'],
      })

      expect(task.title).toBe('Full task')
      expect(task.description).toBe('A detailed description')
      expect(task.status).toBe('in_progress')
      expect(task.priority).toBe('high')
      expect(task.tags).toEqual(['backend', 'api'])
    })
  })

  describe('findAll', () => {
    beforeEach(() => {
      service.create({ title: 'Task A', priority: 'high' })
      service.create({ title: 'Task B', priority: 'low' })
      service.create({
        title: 'Task C', priority: 'high', status: 'done',
      })
    })

    it('should return all tasks', () => {
      const tasks = service.findAll()
      expect(tasks).toHaveLength(3)
    })

    it('should filter by priority', () => {
      const tasks = service.findAll({ priority: 'high' })
      expect(tasks).toHaveLength(2)
      expect(tasks.every(t => t.priority === 'high')).toBe(true)
    })

    it('should filter by status', () => {
      const tasks = service.findAll({ status: 'done' })
      expect(tasks).toHaveLength(1)
      expect(tasks[0].title).toBe('Task C')
    })
  })

  describe('findOne', () => {
    it('should return a task by id', () => {
      const created = service.create({ title: 'Find me' })
      const found = service.findOne(created.id)
      expect(found.title).toBe('Find me')
    })

    it('should throw NotFoundException for missing id', () => {
      expect(() => service.findOne('nonexistent')).toThrow(
        NotFoundException,
      )
    })
  })

  describe('update', () => {
    it('should update specific fields', () => {
      const task = service.create({ title: 'Original' })
      const updated = service.update(task.id, {
        title: 'Updated',
        priority: 'urgent',
      })

      expect(updated.title).toBe('Updated')
      expect(updated.priority).toBe('urgent')
      expect(updated.status).toBe('todo') // 未更改
    })
  })

  describe('remove', () => {
    it('should delete a task', () => {
      const task = service.create({ title: 'Delete me' })
      const result = service.remove(task.id)

      expect(result.deleted).toBe(true)
      expect(() => service.findOne(task.id)).toThrow(NotFoundException)
    })

    it('should throw NotFoundException for missing id', () => {
      expect(() => service.remove('nonexistent')).toThrow(
        NotFoundException,
      )
    })
  })
})
```

### 关键测试模式

**内存数据库。** 通过将 `DATABASE_PATH` 设置为 `:memory:`，每个测试套件都获得一个干净的 SQLite 数据库。这既快速又避免了文件清理。

**真实数据库，不用 mock。** 对于数据访问服务，使用真实数据库（即使是内存数据库）可以捕获 mock 会遗漏的 SQL 错误和 schema 问题。

**beforeEach/afterEach 生命周期。** 每个测试获得一个新的数据库。这防止一个测试的数据影响另一个测试。

### 运行单元测试

```bash
cd solutions/task-manager-tutorial/backend
npm test
```

预期输出：

```
PASS  src/tasks/tasks.service.spec.ts
  TasksService
    create
      ✓ should create a task with default values
      ✓ should create a task with all fields
    findAll
      ✓ should return all tasks
      ✓ should filter by priority
      ✓ should filter by status
    findOne
      ✓ should return a task by id
      ✓ should throw NotFoundException for missing id
    update
      ✓ should update specific fields
    remove
      ✓ should delete a task
      ✓ should throw NotFoundException for missing id
```

## 集成测试：API 端点

集成测试验证 HTTP 请求产生正确的响应。它们同时测试控制器、服务和数据库。

### 设置集成测试

安装 `supertest` 用于 HTTP 测试：

```bash
cd solutions/task-manager-tutorial/backend
npm install --save-dev supertest @types/supertest
```

创建集成测试：

```typescript
// backend/src/tasks/tasks.controller.spec.ts

import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication, ValidationPipe } from '@nestjs/common'
import * as request from 'supertest'
import { AppModule } from '../app.module'

describe('Tasks API (integration)', () => {
  let app: INestApplication

  beforeAll(async () => {
    process.env.DATABASE_PATH = ':memory:'

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

  describe('POST /api/tasks', () => {
    it('should create a task', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/tasks')
        .send({ title: 'Integration test task' })
        .expect(201)

      expect(response.body.title).toBe('Integration test task')
      expect(response.body.id).toBeDefined()
      expect(response.body.status).toBe('todo')
    })

    it('should create a task with all fields', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/tasks')
        .send({
          title: 'Full task',
          description: 'Detailed description',
          priority: 'high',
          status: 'in_progress',
          tags: ['api', 'test'],
        })
        .expect(201)

      expect(response.body.priority).toBe('high')
      expect(response.body.tags).toEqual(['api', 'test'])
    })
  })

  describe('GET /api/tasks', () => {
    it('should return all tasks', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/tasks')
        .expect(200)

      expect(Array.isArray(response.body)).toBe(true)
      expect(response.body.length).toBeGreaterThan(0)
    })

    it('should filter by status', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/tasks?status=in_progress')
        .expect(200)

      expect(
        response.body.every(
          (t: { status: string }) => t.status === 'in_progress',
        ),
      ).toBe(true)
    })
  })

  describe('GET /api/tasks/:id', () => {
    it('should return a specific task', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/tasks')
        .send({ title: 'Find this task' })

      const response = await request(app.getHttpServer())
        .get(`/api/tasks/${created.body.id}`)
        .expect(200)

      expect(response.body.title).toBe('Find this task')
    })

    it('should return 404 for missing task', async () => {
      await request(app.getHttpServer())
        .get('/api/tasks/nonexistent-id')
        .expect(404)
    })
  })

  describe('PUT /api/tasks/:id', () => {
    it('should update a task', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/tasks')
        .send({ title: 'Before update' })

      const response = await request(app.getHttpServer())
        .put(`/api/tasks/${created.body.id}`)
        .send({ title: 'After update', priority: 'urgent' })
        .expect(200)

      expect(response.body.title).toBe('After update')
      expect(response.body.priority).toBe('urgent')
    })
  })

  describe('DELETE /api/tasks/:id', () => {
    it('should delete a task', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/tasks')
        .send({ title: 'Delete me' })

      await request(app.getHttpServer())
        .delete(`/api/tasks/${created.body.id}`)
        .expect(200)

      await request(app.getHttpServer())
        .get(`/api/tasks/${created.body.id}`)
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

### 测试 TaskList 组件

```typescript
// frontend/src/components/TaskList.test.tsx

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TaskList } from './TaskList'
import type { Task, Project } from '../hooks/useTaskManagerSession'

const mockTasks: Task[] = [
  {
    id: '1', title: 'Review API docs', description: 'Check endpoints',
    status: 'todo', priority: 'high', projectId: 'p1',
    dueDate: null, tags: [], createdAt: '', updatedAt: '',
  },
  {
    id: '2', title: 'Fix login bug', description: null,
    status: 'in_progress', priority: 'urgent', projectId: null,
    dueDate: null, tags: ['bug'], createdAt: '', updatedAt: '',
  },
]

const mockProjects: Project[] = [
  {
    id: 'p1', name: 'Backend', description: null,
    color: '#3b82f6', createdAt: '', updatedAt: '',
  },
]

describe('TaskList', () => {
  it('should render tasks', () => {
    render(
      <TaskList
        tasks={mockTasks}
        projects={mockProjects}
        onRefresh={vi.fn()}
      />,
    )

    expect(screen.getByText('Review API docs')).toBeDefined()
    expect(screen.getByText('Fix login bug')).toBeDefined()
  })

  it('should show empty state when no tasks', () => {
    render(
      <TaskList tasks={[]} projects={[]} onRefresh={vi.fn()} />,
    )

    expect(screen.getByText('No tasks yet')).toBeDefined()
  })

  it('should display priority badges', () => {
    render(
      <TaskList
        tasks={mockTasks}
        projects={mockProjects}
        onRefresh={vi.fn()}
      />,
    )

    expect(screen.getByText('high')).toBeDefined()
    expect(screen.getByText('urgent')).toBeDefined()
  })

  it('should resolve project names', () => {
    render(
      <TaskList
        tasks={mockTasks}
        projects={mockProjects}
        onRefresh={vi.fn()}
      />,
    )

    expect(screen.getByText('Backend')).toBeDefined()
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
  it('should show empty state when no messages', () => {
    render(
      <ChatPanel
        messages={[]}
        isConnected={true}
        onSendMessage={vi.fn()}
      />,
    )

    expect(
      screen.getByText('Start a conversation to manage tasks'),
    ).toBeDefined()
  })

  it('should show connection status', () => {
    const { rerender } = render(
      <ChatPanel
        messages={[]}
        isConnected={true}
        onSendMessage={vi.fn()}
      />,
    )
    expect(screen.getByText('Connected')).toBeDefined()

    rerender(
      <ChatPanel
        messages={[]}
        isConnected={false}
        onSendMessage={vi.fn()}
      />,
    )
    expect(screen.getByText('Disconnected')).toBeDefined()
  })

  it('should call onSendMessage when form is submitted', () => {
    const onSend = vi.fn()
    render(
      <ChatPanel
        messages={[]}
        isConnected={true}
        onSendMessage={onSend}
      />,
    )

    const input = screen.getByPlaceholderText('Type a message...')
    fireEvent.change(input, { target: { value: 'Hello AI' } })
    fireEvent.submit(input.closest('form')!)

    expect(onSend).toHaveBeenCalledWith('Hello AI')
  })

  it('should disable input when disconnected', () => {
    render(
      <ChatPanel
        messages={[]}
        isConnected={false}
        onSendMessage={vi.fn()}
      />,
    )

    const input = screen.getByPlaceholderText('Type a message...')
    expect(input).toHaveProperty('disabled', true)
  })
})
```

### 运行前端测试

```bash
cd solutions/task-manager-tutorial/frontend
npm run test:run
```

## E2E 测试：完整用户流程

端到端测试验证完整的用户旅程：打开应用、输入消息、看到 AI 回复、验证任务出现在列表中。对于真正的 E2E 测试，你会使用 Playwright 或 Cypress，这里给出一个概念性的大纲：

```
E2E 测试："通过聊天创建任务"

1. 启动后端（端口 3003）和 CCAAS（端口 3001）
2. 启动前端（端口 5281）
3. 打开 http://localhost:5281
4. 验证 Task Manager 页面加载
5. 验证显示 "No tasks yet"
6. 输入 "Create a task: Review Q3 metrics, high priority"
7. 等待 AI 回复
8. 验证 output_update 事件填充表单
9. 点击 "Save"
10. 验证任务出现在任务列表中
11. 验证任务标题为 "Review Q3 metrics"，优先级为 "high"
```

对于本教程，手动验证此流程就足够了。在生产 Solution 中，使用 Playwright 自动化这个流程。

## 测试组织

推荐的测试文件放置方式：

```
backend/
└── src/
    └── tasks/
        ├── tasks.service.ts
        ├── tasks.service.spec.ts       # 单元测试
        ├── tasks.controller.ts
        └── tasks.controller.spec.ts    # 集成测试

frontend/
└── src/
    ├── components/
    │   ├── TaskList.tsx
    │   ├── TaskList.test.tsx           # 组件测试
    │   ├── ChatPanel.tsx
    │   └── ChatPanel.test.tsx          # 组件测试
    └── hooks/
        ├── useTaskManagerSession.ts
        └── useTaskManagerSession.test.ts  # Hook 测试
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
**陷阱 3：测试实现细节而不是行为。** 不要测试是否调用了特定的 SQL 查询。测试创建任务是否返回预期的形状。测试按优先级过滤是否返回正确的子集。这使测试在重构时保持稳健。
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
cd solutions/task-manager-tutorial/backend
npm test

# 前端测试
cd solutions/task-manager-tutorial/frontend
npm run test:run
```

两个命令都应该以零失败退出。

## 下一步

测试在整个技术栈中通过后，你就可以准备部署了。继续前往[第 7 章：部署上线](../07-deployment.md)。
