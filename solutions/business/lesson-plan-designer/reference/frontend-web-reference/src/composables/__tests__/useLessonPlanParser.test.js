import { describe, it, expect } from 'vitest'
import {
  getDefaultContent,
  parseNewFormat,
  parseLegacyFormat,
  isNewFormat,
  parseLessonPlanContent,
  serializeLessonPlanContent
} from '../useLessonPlanParser'

describe('useLessonPlanParser', () => {
  describe('getDefaultContent', () => {
    it('returns default empty content structure', () => {
      const content = getDefaultContent()

      expect(content.courseRequirements).toEqual({ contentIds: [], academicIds: [] })
      expect(content.textbookAnalysis).toBe('')
      expect(content.learningObjectives).toEqual([])
      expect(content.studentAnalysis).toBe('')
      expect(content.preClassPreparation).toEqual([])
      expect(content.learningTasks).toEqual([])
      expect(content.homeworkTasks).toEqual([])
      expect(content.courseware).toBe('')
      expect(content.resources).toBe('')
    })
  })

  describe('isNewFormat', () => {
    it('returns true when courseRequirements exists', () => {
      expect(isNewFormat({ courseRequirements: {} })).toBe(true)
    })

    it('returns true when learningObjectives exists', () => {
      expect(isNewFormat({ learningObjectives: [] })).toBe(true)
    })

    it('returns false for legacy format', () => {
      expect(isNewFormat({ objectives: {} })).toBe(false)
      expect(isNewFormat({ process: '' })).toBe(false)
    })
  })

  describe('parseNewFormat', () => {
    it('parses courseRequirements correctly', () => {
      const content = {
        courseRequirements: { contentIds: [1, 2], academicIds: [3, 4] }
      }
      const result = parseNewFormat(content)

      expect(result.courseRequirements.contentIds).toEqual([1, 2])
      expect(result.courseRequirements.academicIds).toEqual([3, 4])
    })

    it('handles missing courseRequirements', () => {
      const result = parseNewFormat({})
      expect(result.courseRequirements).toEqual({ contentIds: [], academicIds: [] })
    })

    it('parses array learningObjectives', () => {
      const objectives = [{ id: 1, content: 'Test', linkedRequirements: [] }]
      const result = parseNewFormat({ learningObjectives: objectives })

      expect(result.learningObjectives).toEqual(objectives)
    })

    it('converts string learningObjectives to array', () => {
      const result = parseNewFormat({ learningObjectives: 'Test objective' })

      expect(result.learningObjectives).toHaveLength(1)
      expect(result.learningObjectives[0].content).toBe('Test objective')
      expect(result.learningObjectives[0].linkedRequirements).toEqual([])
    })

    it('parses array preClassPreparation', () => {
      const tasks = [{ id: 1, content: 'Prep', linkedObjectives: [] }]
      const result = parseNewFormat({ preClassPreparation: tasks })

      expect(result.preClassPreparation).toEqual(tasks)
    })

    it('converts string preClassPreparation to array', () => {
      const result = parseNewFormat({ preClassPreparation: 'Prep task' })

      expect(result.preClassPreparation).toHaveLength(1)
      expect(result.preClassPreparation[0].content).toBe('Prep task')
    })

    it('parses array learningTasks', () => {
      const tasks = [{ id: 1, name: 'Task', description: 'Desc' }]
      const result = parseNewFormat({ learningTasks: tasks })

      expect(result.learningTasks).toEqual(tasks)
    })

    it('converts legacy learningProcess string to learningTasks array', () => {
      const result = parseNewFormat({ learningProcess: 'Process content' })

      expect(result.learningTasks).toHaveLength(1)
      expect(result.learningTasks[0].name).toBe('学习任务')
      expect(result.learningTasks[0].description).toBe('Process content')
    })

    it('parses array homeworkTasks', () => {
      const tasks = [{ id: 1, name: 'HW', description: 'Homework' }]
      const result = parseNewFormat({ homeworkTasks: tasks })

      expect(result.homeworkTasks).toEqual(tasks)
    })

    it('converts legacy homeworkAssessment string to homeworkTasks array', () => {
      const result = parseNewFormat({ homeworkAssessment: 'Homework content' })

      expect(result.homeworkTasks).toHaveLength(1)
      expect(result.homeworkTasks[0].name).toBe('作业任务')
      expect(result.homeworkTasks[0].description).toBe('Homework content')
    })

    it('parses markdown sections correctly', () => {
      const content = {
        textbookAnalysis: 'Analysis text',
        studentAnalysis: 'Student text',
        courseware: 'Courseware text',
        resources: 'Resources text'
      }
      const result = parseNewFormat(content)

      expect(result.textbookAnalysis).toBe('Analysis text')
      expect(result.studentAnalysis).toBe('Student text')
      expect(result.courseware).toBe('Courseware text')
      expect(result.resources).toBe('Resources text')
    })
  })

  describe('parseLegacyFormat', () => {
    it('migrates legacy objectives to learningObjectives array', () => {
      const content = {
        objectives: {
          knowledge: 'Know this',
          process: 'Do this',
          emotion: 'Feel this'
        }
      }
      const result = parseLegacyFormat(content)

      expect(result.learningObjectives).toHaveLength(1)
      expect(result.learningObjectives[0].content).toContain('Know this')
      expect(result.learningObjectives[0].content).toContain('Do this')
      expect(result.learningObjectives[0].content).toContain('Feel this')
    })

    it('migrates keyPoints to studentAnalysis', () => {
      const content = {
        keyPoints: {
          key: 'Key point',
          difficulty: 'Hard part'
        }
      }
      const result = parseLegacyFormat(content)

      expect(result.studentAnalysis).toContain('重点：Key point')
      expect(result.studentAnalysis).toContain('难点：Hard part')
    })

    it('migrates process to learningTasks', () => {
      const content = { process: 'Teaching process' }
      const result = parseLegacyFormat(content)

      expect(result.learningTasks).toHaveLength(1)
      expect(result.learningTasks[0].description).toBe('Teaching process')
    })

    it('migrates homework to homeworkTasks', () => {
      const content = { homework: 'Homework assignment' }
      const result = parseLegacyFormat(content)

      expect(result.homeworkTasks).toHaveLength(1)
      expect(result.homeworkTasks[0].description).toBe('Homework assignment')
    })

    it('migrates reflection to resources', () => {
      const content = { reflection: 'Reflection notes' }
      const result = parseLegacyFormat(content)

      expect(result.resources).toBe('Reflection notes')
    })
  })

  describe('parseLessonPlanContent', () => {
    it('returns default content for null lesson plan', () => {
      const result = parseLessonPlanContent(null)
      expect(result).toEqual(getDefaultContent())
    })

    it('returns default content for lesson plan without content', () => {
      const result = parseLessonPlanContent({ id: 1, title: 'Test' })
      expect(result).toEqual(getDefaultContent())
    })

    it('parses new format content', () => {
      const lessonPlan = {
        content: JSON.stringify({
          courseRequirements: { contentIds: [1, 2], academicIds: [3] },
          textbookAnalysis: 'Analysis'
        })
      }
      const result = parseLessonPlanContent(lessonPlan)

      expect(result.courseRequirements.contentIds).toEqual([1, 2])
      expect(result.textbookAnalysis).toBe('Analysis')
    })

    it('parses legacy format content', () => {
      const lessonPlan = {
        content: JSON.stringify({
          objectives: { knowledge: 'Knowledge' },
          process: 'Process'
        })
      }
      const result = parseLessonPlanContent(lessonPlan)

      expect(result.learningObjectives).toHaveLength(1)
      expect(result.learningTasks).toHaveLength(1)
    })

    it('handles malformed JSON gracefully', () => {
      const lessonPlan = {
        content: 'not valid json',
        objectives: 'Plain text objectives'
      }
      const result = parseLessonPlanContent(lessonPlan)

      expect(result.learningObjectives).toHaveLength(1)
      expect(result.learningObjectives[0].content).toBe('Plain text objectives')
    })

    it('handles empty string content', () => {
      const lessonPlan = { content: '' }
      const result = parseLessonPlanContent(lessonPlan)
      expect(result).toEqual(getDefaultContent())
    })
  })

  describe('serializeLessonPlanContent', () => {
    it('serializes content to JSON string', () => {
      const content = {
        courseRequirements: { contentIds: [1], academicIds: [2] },
        textbookAnalysis: 'Test'
      }
      const result = serializeLessonPlanContent(content)

      expect(typeof result).toBe('string')
      expect(JSON.parse(result)).toEqual(content)
    })

    it('roundtrip: parse then serialize produces equivalent data', () => {
      const original = {
        courseRequirements: { contentIds: [1, 2], academicIds: [3] },
        textbookAnalysis: 'Analysis',
        learningObjectives: [{ id: 1, content: 'Objective', linkedRequirements: [] }],
        studentAnalysis: 'Student',
        preClassPreparation: [],
        learningTasks: [],
        homeworkTasks: [],
        courseware: 'Courseware',
        resources: 'Resources'
      }
      const lessonPlan = { content: JSON.stringify(original) }

      const parsed = parseLessonPlanContent(lessonPlan)
      const serialized = serializeLessonPlanContent(parsed)
      const reparsed = JSON.parse(serialized)

      expect(reparsed.courseRequirements).toEqual(original.courseRequirements)
      expect(reparsed.textbookAnalysis).toBe(original.textbookAnalysis)
      expect(reparsed.learningObjectives).toEqual(original.learningObjectives)
    })
  })
})
