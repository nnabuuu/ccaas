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

### Testing the LessonPlansService

Create a test file next to the service:

```typescript
// backend/src/lesson-plans/lesson-plans.service.spec.ts

import { LessonPlansService } from './lesson-plans.service'
import Database from 'better-sqlite3'
import { NotFoundException } from '@nestjs/common'

describe('LessonPlansService', () => {
  let service: LessonPlansService
  let db: Database.Database

  beforeEach(() => {
    // Create an in-memory database for testing
    db = new Database(':memory:')
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')

    // Initialize schema
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

    // Inject the in-memory database directly
    service = new LessonPlansService(db)
  })

  afterEach(() => {
    db.close()
  })

  describe('create', () => {
    it('should create a lesson plan with default values', () => {
      const plan = service.create({ title: 'Fractions Introduction' })

      expect(plan.title).toBe('Fractions Introduction')
      expect(plan.status).toBe('DRAFT')
      expect(plan.subject).toBe('')
      expect(plan.gradeLevel).toBe(1)
      expect(plan.durationMinutes).toBe(45)
      expect(plan.id).toBeDefined()
    })

    it('should create a lesson plan with all fields', () => {
      const plan = service.create({
        title: 'Linear Equations',
        subject: 'math',
        gradeLevel: 8,
        durationMinutes: 40,
        publisher: 'PEP',
        volume: 'Volume 1',
        chapterId: 3,
        chapterTitle: 'Chapter 3: Linear Equations',
      })

      expect(plan.title).toBe('Linear Equations')
      expect(plan.subject).toBe('math')
      expect(plan.gradeLevel).toBe(8)
      expect(plan.durationMinutes).toBe(40)
      expect(plan.publisher).toBe('PEP')
    })
  })

  describe('findAll', () => {
    beforeEach(() => {
      service.create({ title: 'Plan A', subject: 'math' })
      service.create({ title: 'Plan B', subject: 'english' })
      service.create({ title: 'Plan C', subject: 'math' })
    })

    it('should return all lesson plans', () => {
      const plans = service.findAll()
      expect(plans).toHaveLength(3)
    })
  })

  describe('findByIdOrFail', () => {
    it('should return a lesson plan by id', () => {
      const created = service.create({ title: 'Find me' })
      const found = service.findByIdOrFail(created.id)
      expect(found.title).toBe('Find me')
    })

    it('should throw NotFoundException for missing id', () => {
      expect(() => service.findByIdOrFail('nonexistent')).toThrow(
        NotFoundException,
      )
    })
  })

  describe('update', () => {
    it('should update specific fields', () => {
      const plan = service.create({ title: 'Original' })
      const updated = service.update(plan.id, {
        title: 'Updated Title',
        objectives: 'Students will understand fractions',
      })

      expect(updated.title).toBe('Updated Title')
      expect(updated.objectives).toBe(
        'Students will understand fractions',
      )
      expect(updated.status).toBe('DRAFT') // unchanged
    })
  })

  describe('delete', () => {
    it('should delete a lesson plan', () => {
      const plan = service.create({ title: 'Delete me' })
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
      const plan = service.create({ title: 'Patch test' })
      const updated = service.patchField(
        plan.id,
        'objectives',
        'New learning objectives',
      )

      expect(updated.objectives).toBe('New learning objectives')
      expect(updated.title).toBe('Patch test') // unchanged
    })

    it('should handle JSON fields correctly', () => {
      const plan = service.create({ title: 'JSON test' })
      const standards = [
        { id: 1, standardCode: 'MA-3-1', title: 'Number sense',
          stage: 'Primary', standardType: 'Core',
          contentDomain: 'Numbers' },
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

### Key Testing Patterns

**In-memory database.** By creating a `Database(':memory:')` instance, each test suite gets a clean SQLite database. This is fast and avoids file cleanup.

**Real database, no mocks.** For data access services, testing with a real database (even in-memory) catches SQL errors and schema issues that mocks would miss.

**beforeEach/afterEach lifecycle.** Each test gets a fresh database. This prevents test pollution where one test's data affects another.

### Running Unit Tests

```bash
cd solutions/lesson-plan-designer/backend
npm test
```

Expected output:

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

## Integration Tests: API Endpoints

Integration tests verify that HTTP requests produce the correct responses. They test the controller, service, and database together.

### Setting Up Integration Tests

Install `supertest` for HTTP testing:

```bash
cd solutions/lesson-plan-designer/backend
npm install --save-dev supertest @types/supertest
```

Create the integration test:

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
        .send({ title: 'Fractions Intro' })
        .expect(201)

      expect(response.body.title).toBe('Fractions Intro')
      expect(response.body.id).toBeDefined()
      expect(response.body.status).toBe('DRAFT')
    })

    it('should create a lesson plan with all fields', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/lesson-plans')
        .send({
          title: 'Quadratic Equations',
          subject: 'math',
          gradeLevel: 9,
          durationMinutes: 40,
          publisher: 'PEP',
          volume: 'Volume 2',
        })
        .expect(201)

      expect(response.body.subject).toBe('math')
      expect(response.body.gradeLevel).toBe(9)
    })

    it('should return 400 when title is missing', async () => {
      await request(app.getHttpServer())
        .post('/api/lesson-plans')
        .send({ subject: 'math' })
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
        .send({ title: 'Find this plan' })

      const response = await request(app.getHttpServer())
        .get(`/api/lesson-plans/${created.body.id}`)
        .expect(200)

      expect(response.body.title).toBe('Find this plan')
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
        .send({ title: 'Before update' })

      const response = await request(app.getHttpServer())
        .put(`/api/lesson-plans/${created.body.id}`)
        .send({
          title: 'After update',
          objectives: 'Students will learn fractions',
        })
        .expect(200)

      expect(response.body.title).toBe('After update')
      expect(response.body.objectives).toBe(
        'Students will learn fractions',
      )
    })
  })

  describe('PATCH /api/lesson-plans/:id/field', () => {
    it('should patch a single field', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/lesson-plans')
        .send({ title: 'Patch test' })

      const response = await request(app.getHttpServer())
        .patch(`/api/lesson-plans/${created.body.id}/field`)
        .send({
          field: 'content',
          value: 'Step 1: Introduction...',
        })
        .expect(200)

      expect(response.body.content).toBe('Step 1: Introduction...')
    })

    it('should reject invalid fields', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/lesson-plans')
        .send({ title: 'Invalid field test' })

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
        .send({ title: 'Delete me' })

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

### What Integration Tests Catch

Integration tests catch issues that unit tests miss:

- **Routing errors** -- a typo in the controller decorator means the endpoint does not exist
- **Validation pipeline** -- the `ValidationPipe` strips unknown fields and transforms types
- **HTTP status codes** -- NestJS converts `NotFoundException` to 404 automatically
- **JSON serialization** -- the response body matches the expected shape

## Frontend Tests: Components and Hooks

The frontend uses Vitest and React Testing Library. These tests verify that components render correctly and hooks behave as expected.

### Testing the LessonPlanContent Component

```typescript
// frontend/src/components/LessonPlanContent.test.tsx

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LessonPlanContent } from './LessonPlanContent'
import type { LessonPlan, SyncField } from '../types'

const mockLessonPlan: LessonPlan = {
  id: 'lp-1',
  title: 'Fractions Introduction',
  subject: 'math',
  gradeLevel: 3,
  durationMinutes: 45,
  lessonPlanCode: null,
  status: 'DRAFT',
  publisher: 'PEP',
  volume: 'Volume 1',
  chapterId: 5,
  chapterTitle: 'Chapter 5: Fractions',
  curriculumRequirements: [],
  objectives: 'Students will understand basic fractions',
  studentAnalysis: null,
  materialsNeeded: 'Fraction cards, whiteboard',
  content: 'Step 1: Introduction to halves...',
  assessmentMethods: null,
  teachingMethods: 'Inquiry-based learning',
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
    const titleInput = screen.getByDisplayValue(
      'Fractions Introduction',
    )
    expect(titleInput).toBeDefined()
  })

  it('should render content sections', () => {
    render(<LessonPlanContent {...defaultProps} />)

    expect(screen.getByText('Learning Objectives')).toBeDefined()
    expect(screen.getByText('Teaching Methods')).toBeDefined()
    expect(screen.getByText('Learning Process')).toBeDefined()
  })

  it('should show AI-modified indicator for synced fields', () => {
    render(
      <LessonPlanContent
        {...defaultProps}
        modifiedFields={new Set<SyncField>(['objectives'])}
      />,
    )

    const objectivesTextarea = screen.getByDisplayValue(
      'Students will understand basic fractions',
    )
    expect(
      objectivesTextarea.classList.contains('ai-modified'),
    ).toBe(true)
  })

  it('should display publisher and volume when set', () => {
    render(<LessonPlanContent {...defaultProps} />)
    expect(screen.getByDisplayValue('PEP')).toBeDefined()
    expect(screen.getByDisplayValue('Volume 1')).toBeDefined()
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
      screen.getByText('Start a lesson planning conversation'),
    ).toBeDefined()
  })

  it('should show connection status', () => {
    const { rerender } = render(
      <ChatPanel {...defaultProps} connected={true} />,
    )

    // Re-render as disconnected
    rerender(
      <ChatPanel {...defaultProps} connected={false} />,
    )

    const input = screen.getByPlaceholderText(
      'Connecting to server...',
    )
    expect(input).toHaveProperty('disabled', true)
  })

  it('should call onSendMessage when form is submitted', () => {
    const onSend = vi.fn()
    render(
      <ChatPanel {...defaultProps} onSendMessage={onSend} />,
    )

    const input = screen.getByPlaceholderText(
      'Describe your lesson planning needs...',
    )
    fireEvent.change(input, {
      target: { value: 'Design a math lesson on fractions' },
    })
    fireEvent.submit(input.closest('form')!)

    expect(onSend).toHaveBeenCalledWith(
      'Design a math lesson on fractions',
    )
  })

  it('should disable input when disconnected', () => {
    render(
      <ChatPanel {...defaultProps} connected={false} />,
    )

    const input = screen.getByPlaceholderText(
      'Connecting to server...',
    )
    expect(input).toHaveProperty('disabled', true)
  })
})
```

### Running Frontend Tests

```bash
cd solutions/lesson-plan-designer/frontend
npm run test:run
```

## E2E Test: The Full User Flow

An end-to-end test verifies the complete user journey: open the app, type a message, see the AI response, and verify the lesson plan is updated. For a real E2E test you would use Playwright or Cypress, but here is a conceptual outline:

```
E2E Test: "Create a lesson plan via chat"

1. Start Solution backend (port 3002) and CCAAS (port 3001)
2. Start frontend (port 5173)
3. Open http://localhost:5173
4. Click "New Lesson Plan" and fill in: title, subject, grade
5. Verify the empty lesson plan form loads
6. Type "Design learning objectives for teaching fractions to grade 3"
7. Wait for AI response
8. Verify output_update events populate the objectives field
9. Click "Sync" on the objectives update
10. Verify the objectives section shows AI-generated content
11. Verify the field is highlighted as AI-modified
```

For the tutorial, manual verification of this flow is sufficient. In a production Solution, automate this with Playwright.

## Test Organization

Recommended test file placement:

```
backend/
└── src/
    └── lesson-plans/
        ├── lesson-plans.service.ts
        ├── lesson-plans.service.spec.ts       # Unit tests
        ├── lesson-plans.controller.ts
        └── lesson-plans.controller.spec.ts    # Integration tests

frontend/
└── src/
    ├── components/
    │   ├── LessonPlanContent.tsx
    │   ├── LessonPlanContent.test.tsx          # Component tests
    │   ├── ChatPanel.tsx
    │   └── ChatPanel.test.tsx                  # Component tests
    └── hooks/
        ├── useLessonPlanSession.ts
        └── useLessonPlanSession.test.ts        # Hook tests
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
**Pitfall 3: Testing implementation details instead of behavior.** Do not test that a specific SQL query was called. Test that creating a lesson plan returns the expected shape. Test that patching a field updates only that field. This makes tests resilient to refactoring.
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
cd solutions/lesson-plan-designer/backend
npm test

# Frontend tests
cd solutions/lesson-plan-designer/frontend
npm run test:run
```

Both commands should exit with zero failures.

## Next Step

With tests passing across the stack, you can now add conversation persistence. Proceed to [6.7 Conversation Persistence](07-conversation-persistence.md).
