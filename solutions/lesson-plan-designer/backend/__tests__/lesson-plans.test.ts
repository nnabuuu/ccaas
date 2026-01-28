import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { LessonPlanService } from '../src/services/lesson-plan.service.js'
import initializeSchema from '../src/db/schema.js'

// Use in-memory database for testing
let db: Database.Database
let service: LessonPlanService

// Mock getDatabase to use in-memory database
const originalGetDatabase = await import('../src/db/index.js')

describe('LessonPlanService', () => {
  beforeEach(() => {
    // Create in-memory database
    db = new Database(':memory:')
    initializeSchema(db)

    // Create a fresh service instance
    service = new LessonPlanService()
  })

  afterEach(() => {
    db.close()
  })

  describe('create', () => {
    it('should create a new lesson plan', () => {
      const plan = service.create({
        tenantId: 'tenant-1',
        title: 'Math Lesson',
        subject: '数学',
        gradeLevel: '三年级',
      })

      expect(plan).toBeDefined()
      expect(plan.id).toBeTruthy()
      expect(plan.title).toBe('Math Lesson')
      expect(plan.subject).toBe('数学')
      expect(plan.gradeLevel).toBe('三年级')
      expect(plan.status).toBe('draft')
      expect(plan.objectives).toEqual([])
      expect(plan.activities).toEqual([])
    })

    it('should use default values for optional fields', () => {
      const plan = service.create({
        tenantId: 'tenant-1',
        title: 'Basic Lesson',
      })

      expect(plan.subject).toBe('')
      expect(plan.gradeLevel).toBe('')
      expect(plan.duration).toBe('')
    })
  })

  describe('findById', () => {
    it('should find a lesson plan by id', () => {
      const created = service.create({
        tenantId: 'tenant-1',
        title: 'Test Lesson',
      })

      const found = service.findById(created.id)

      expect(found).toBeDefined()
      expect(found?.id).toBe(created.id)
      expect(found?.title).toBe('Test Lesson')
    })

    it('should return null for non-existent id', () => {
      const found = service.findById('non-existent-id')
      expect(found).toBeNull()
    })
  })

  describe('findAll', () => {
    it('should return all lesson plans', () => {
      service.create({ tenantId: 'tenant-1', title: 'Lesson 1' })
      service.create({ tenantId: 'tenant-1', title: 'Lesson 2' })
      service.create({ tenantId: 'tenant-2', title: 'Lesson 3' })

      const all = service.findAll()
      expect(all).toHaveLength(3)
    })

    it('should filter by tenantId', () => {
      service.create({ tenantId: 'tenant-1', title: 'Lesson 1' })
      service.create({ tenantId: 'tenant-1', title: 'Lesson 2' })
      service.create({ tenantId: 'tenant-2', title: 'Lesson 3' })

      const tenant1Plans = service.findAll('tenant-1')
      expect(tenant1Plans).toHaveLength(2)
      expect(tenant1Plans.every(p => p.tenantId === 'tenant-1')).toBe(true)
    })
  })

  describe('update', () => {
    it('should update lesson plan fields', () => {
      const created = service.create({
        tenantId: 'tenant-1',
        title: 'Original Title',
      })

      const updated = service.update(created.id, {
        title: 'Updated Title',
        subject: '语文',
        status: 'review',
      })

      expect(updated?.title).toBe('Updated Title')
      expect(updated?.subject).toBe('语文')
      expect(updated?.status).toBe('review')
    })

    it('should return null for non-existent id', () => {
      const result = service.update('non-existent-id', { title: 'New' })
      expect(result).toBeNull()
    })

    it('should update objectives array', () => {
      const created = service.create({
        tenantId: 'tenant-1',
        title: 'Lesson',
      })

      const objectives = [
        {
          id: '1',
          description: 'Learn basics',
          bloomLevel: 'understand' as const,
        },
      ]

      const updated = service.update(created.id, { objectives })
      expect(updated?.objectives).toEqual(objectives)
    })
  })

  describe('patchField', () => {
    it('should patch a single field', () => {
      const created = service.create({
        tenantId: 'tenant-1',
        title: 'Lesson',
      })

      const patched = service.patchField(created.id, 'title', 'New Title')
      expect(patched?.title).toBe('New Title')
    })

    it('should patch JSON fields correctly', () => {
      const created = service.create({
        tenantId: 'tenant-1',
        title: 'Lesson',
      })

      const activities = [
        {
          id: '1',
          title: 'Activity 1',
          description: 'Test',
          duration: 10,
          type: 'introduction' as const,
          instructions: [],
        },
      ]

      const patched = service.patchField(created.id, 'activities', activities)
      expect(patched?.activities).toEqual(activities)
    })
  })

  describe('delete', () => {
    it('should delete a lesson plan', () => {
      const created = service.create({
        tenantId: 'tenant-1',
        title: 'To Delete',
      })

      const deleted = service.delete(created.id)
      expect(deleted).toBe(true)

      const found = service.findById(created.id)
      expect(found).toBeNull()
    })

    it('should return false for non-existent id', () => {
      const deleted = service.delete('non-existent-id')
      expect(deleted).toBe(false)
    })
  })
})
