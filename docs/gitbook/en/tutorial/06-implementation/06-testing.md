# 6.6 Testing

Testing a LoopAI Solution requires verifying three layers: the Solution backend services, the REST API endpoints, and the end-to-end user flow from chat to saved data. In this section you will write tests for each layer using the tools already in your project.

## Testing Strategy

```
┌────────────────────────────────────────────────────┐
│                  Test Pyramid                      │
│                                                    │
│                    ┌──────┐                        │
│                    │ E2E  │  User flows            │
│                   ─┴──────┴─                       │
│                  ┌──────────┐                      │
│                  │Integration│ API endpoints        │
│                 ─┴──────────┴─                     │
│                ┌──────────────┐                    │
│                │  Unit Tests  │ Services, utils     │
│                └──────────────┘                    │
└────────────────────────────────────────────────────┘
```

| Layer | Tool | What it tests |
|-------|------|---------------|
| Unit | Jest (backend), Vitest (frontend) | Service methods, utility functions, data transformations |
| Integration | Jest + supertest | API endpoints, database operations, request validation |
| E2E | Vitest + Testing Library | Component rendering, user interactions, hook behavior |

## Unit Tests: Backend Services

Unit tests verify that individual service methods work correctly in isolation. The backend uses Jest with `ts-jest`.

### Testing the TasksService

Create a test file next to the service:

```typescript
// backend/src/tasks/tasks.service.spec.ts

import { TasksService } from './tasks.service'
import { DatabaseService } from '../database/database.service'
import { NotFoundException } from '@nestjs/common'

describe('TasksService', () => {
  let service: TasksService
  let dbService: DatabaseService

  beforeEach(() => {
    // Create a real in-memory database for testing
    dbService = new DatabaseService()
    // Override the database path to use in-memory
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
      expect(updated.status).toBe('todo') // unchanged
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

### Key Testing Patterns

**In-memory database.** By setting `DATABASE_PATH` to `:memory:`, each test suite gets a clean SQLite database. This is fast and avoids file cleanup.

**Real database, no mocks.** For data access services, testing with a real database (even in-memory) catches SQL errors and schema issues that mocks would miss.

**beforeEach/afterEach lifecycle.** Each test gets a fresh database. This prevents test pollution where one test's data affects another.

### Running Unit Tests

```bash
cd solutions/task-manager-tutorial/backend
npm test
```

Expected output:

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

## Integration Tests: API Endpoints

Integration tests verify that HTTP requests produce the correct responses. They test the controller, service, and database together.

### Setting Up Integration Tests

Install `supertest` for HTTP testing:

```bash
cd solutions/task-manager-tutorial/backend
npm install --save-dev supertest @types/supertest
```

Create the integration test:

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
      // Create a task first
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

### What Integration Tests Catch

Integration tests catch issues that unit tests miss:

- **Routing errors** -- a typo in the controller decorator means the endpoint does not exist
- **Validation pipeline** -- the `ValidationPipe` strips unknown fields and transforms types
- **HTTP status codes** -- NestJS converts `NotFoundException` to 404 automatically
- **JSON serialization** -- the response body matches the expected shape

## Frontend Tests: Components and Hooks

The frontend uses Vitest and React Testing Library. These tests verify that components render correctly and hooks behave as expected.

### Testing the TaskList Component

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

### Testing the ChatPanel Component

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

### Running Frontend Tests

```bash
cd solutions/task-manager-tutorial/frontend
npm test
```

## E2E Test: The Full User Flow

An end-to-end test verifies the complete user journey: open the app, type a message, see the AI response, and verify the task appears in the list. For a real E2E test you would use Playwright or Cypress, but here is a conceptual outline:

```
E2E Test: "Create a task via chat"

1. Start backend (port 3003) and CCAAS (port 3001)
2. Start frontend (port 5281)
3. Open http://localhost:5281
4. Verify the Task Manager page loads
5. Verify "No tasks yet" is shown
6. Type "Create a task: Review Q3 metrics, high priority"
7. Wait for AI response
8. Verify output_update events populate the form
9. Click "Save"
10. Verify the task appears in the task list
11. Verify the task has title "Review Q3 metrics" and priority "high"
```

For the tutorial, manual verification of this flow is sufficient. In a production Solution, automate this with Playwright.

## Test Organization

Recommended test file placement:

```
backend/
└── src/
    └── tasks/
        ├── tasks.service.ts
        ├── tasks.service.spec.ts       # Unit tests
        ├── tasks.controller.ts
        └── tasks.controller.spec.ts    # Integration tests

frontend/
└── src/
    ├── components/
    │   ├── TaskList.tsx
    │   ├── TaskList.test.tsx           # Component tests
    │   ├── ChatPanel.tsx
    │   └── ChatPanel.test.tsx          # Component tests
    └── hooks/
        ├── useTaskManagerSession.ts
        └── useTaskManagerSession.test.ts  # Hook tests
```

Tests live next to the code they test. This makes it easy to find the test for any file and keeps the relationship visible.

## Common Pitfalls

{% hint style="danger" %}
**Pitfall 1: Testing with mocked databases.** Mocking the database hides real SQL errors. Use an in-memory SQLite database (`:memory:`) instead. It is fast, disposable, and catches schema issues.
{% endhint %}

{% hint style="danger" %}
**Pitfall 2: Not running tests before and after code changes.** The TDD rule from CLAUDE.md applies: always run `npm test` before modifying code and immediately after. Test failures should stop you from moving forward.
{% endhint %}

{% hint style="danger" %}
**Pitfall 3: Testing implementation details instead of behavior.** Do not test that a specific SQL query was called. Test that creating a task returns the expected shape. Test that filtering by priority returns the correct subset. This makes tests resilient to refactoring.
{% endhint %}

## Checkpoint

Before proceeding to deployment, verify:

- [ ] `cd backend && npm test` passes all unit and integration tests
- [ ] `cd frontend && npm test` passes all component tests
- [ ] You understand the three-layer testing strategy: unit, integration, E2E
- [ ] Test files are co-located with the code they test

Run the full test suite:

```bash
# Backend tests
cd solutions/task-manager-tutorial/backend
npm test

# Frontend tests
cd solutions/task-manager-tutorial/frontend
npm run test:run
```

Both commands should exit with zero failures.

## Next Step

With tests passing across the stack, you can now add conversation persistence. Proceed to [6.7 Conversation Persistence](07-conversation-persistence.md).
