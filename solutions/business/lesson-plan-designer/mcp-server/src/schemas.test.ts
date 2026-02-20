/**
 * Schema Validation Tests
 *
 * TDD tests for lesson plan field schemas (simplified plain-text model)
 */

import { describe, it, expect } from 'vitest';
import {
  TitleSchema,
  SubjectSchema,
  GradeLevelSchema,
  DurationMinutesSchema,
  LessonPlanCodeSchema,
  ObjectivesSchema,
  ContentSchema,
  TeachingMethodsSchema,
  MaterialsNeededSchema,
  AssessmentMethodsSchema,
  CurriculumRequirementsSchema,
  StudentAnalysisSchema,
  ExtraPropertiesSchema,
  StatusSchema,
  validateAndFix,
  validateAndFixField,
  parseJsonSafely,
  FieldSchemas,
} from './schemas.js';

// ============================================================================
// Basic field tests
// ============================================================================

describe('Basic Field Schemas', () => {
  describe('TitleSchema', () => {
    it('should accept valid title', () => {
      const result = TitleSchema.safeParse('分数的认识');
      expect(result.success).toBe(true);
      expect(result.data).toBe('分数的认识');
    });

    it('should reject empty title', () => {
      const result = TitleSchema.safeParse('');
      expect(result.success).toBe(false);
    });
  });

  describe('SubjectSchema', () => {
    it('should accept valid subject', () => {
      const result = SubjectSchema.safeParse('数学');
      expect(result.success).toBe(true);
    });

    it('should reject empty subject', () => {
      const result = SubjectSchema.safeParse('');
      expect(result.success).toBe(false);
    });
  });

  describe('GradeLevelSchema', () => {
    it('should accept valid grade level (1-12)', () => {
      expect(GradeLevelSchema.safeParse(1).success).toBe(true);
      expect(GradeLevelSchema.safeParse(6).success).toBe(true);
      expect(GradeLevelSchema.safeParse(12).success).toBe(true);
    });

    it('should reject out of range', () => {
      expect(GradeLevelSchema.safeParse(0).success).toBe(false);
      expect(GradeLevelSchema.safeParse(13).success).toBe(false);
    });

    it('should reject non-integer', () => {
      expect(GradeLevelSchema.safeParse(3.5).success).toBe(false);
    });
  });

  describe('DurationMinutesSchema', () => {
    it('should accept valid duration', () => {
      expect(DurationMinutesSchema.safeParse(45).success).toBe(true);
      expect(DurationMinutesSchema.safeParse(90).success).toBe(true);
    });

    it('should reject zero or negative', () => {
      expect(DurationMinutesSchema.safeParse(0).success).toBe(false);
      expect(DurationMinutesSchema.safeParse(-1).success).toBe(false);
    });
  });

  describe('LessonPlanCodeSchema', () => {
    it('should accept any string', () => {
      expect(LessonPlanCodeSchema.safeParse('LP-2025-001').success).toBe(true);
      expect(LessonPlanCodeSchema.safeParse('').success).toBe(true);
    });
  });

  describe('StatusSchema', () => {
    it('should accept valid status values', () => {
      expect(StatusSchema.safeParse('DRAFT').success).toBe(true);
      expect(StatusSchema.safeParse('PUBLISHED').success).toBe(true);
      expect(StatusSchema.safeParse('ARCHIVED').success).toBe(true);
    });

    it('should reject invalid status', () => {
      expect(StatusSchema.safeParse('draft').success).toBe(false);
      expect(StatusSchema.safeParse('review').success).toBe(false);
    });
  });
});

// ============================================================================
// Content field tests (all plain strings)
// ============================================================================

describe('Content Field Schemas', () => {
  it('ObjectivesSchema accepts string', () => {
    const result = ObjectivesSchema.safeParse('1. 学习目标一\n2. 学习目标二');
    expect(result.success).toBe(true);
  });

  it('ContentSchema accepts string', () => {
    const result = ContentSchema.safeParse('学习过程内容...');
    expect(result.success).toBe(true);
  });

  it('TeachingMethodsSchema accepts string', () => {
    const result = TeachingMethodsSchema.safeParse('讲授法、讨论法');
    expect(result.success).toBe(true);
  });

  it('MaterialsNeededSchema accepts string', () => {
    const result = MaterialsNeededSchema.safeParse('教材、PPT、练习册');
    expect(result.success).toBe(true);
  });

  it('AssessmentMethodsSchema accepts string', () => {
    const result = AssessmentMethodsSchema.safeParse('课堂练习、课后作业');
    expect(result.success).toBe(true);
  });

  it('CurriculumRequirementsSchema accepts string', () => {
    const result = CurriculumRequirementsSchema.safeParse('符合新课标要求...');
    expect(result.success).toBe(true);
  });

  it('StudentAnalysisSchema accepts string', () => {
    const result = StudentAnalysisSchema.safeParse('学生已掌握加减法...');
    expect(result.success).toBe(true);
  });
});

// ============================================================================
// ExtraProperties tests
// ============================================================================

describe('ExtraProperties Schema', () => {
  it('should accept valid record', () => {
    const result = ExtraPropertiesSchema.safeParse({
      '教材分析': '本课是分数单元的第一课',
      '课件': 'PPT 12页',
    });
    expect(result.success).toBe(true);
  });

  it('should accept empty record', () => {
    const result = ExtraPropertiesSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('should reject non-string values', () => {
    const result = ExtraPropertiesSchema.safeParse({ key: 123 });
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// Validation function tests
// ============================================================================

describe('validateAndFix', () => {
  it('should validate and return success for valid data', () => {
    const result = validateAndFix('title', '分数的认识');
    expect(result.success).toBe(true);
    expect(result.data).toBe('分数的认识');
    expect(result.errors).toEqual([]);
  });

  it('should return error for invalid data', () => {
    const result = validateAndFix('title', '');
    expect(result.success).toBe(false);
    expect(result.data).toBeNull();
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should return error for unknown field', () => {
    const result = validateAndFix('unknownField' as any, 'value');
    expect(result.success).toBe(false);
    expect(result.errors).toContain('未知字段: unknownField');
  });

  it('should validate gradeLevel as number', () => {
    const result = validateAndFix('gradeLevel', 3);
    expect(result.success).toBe(true);
    expect(result.data).toBe(3);
  });

  it('should reject gradeLevel as string', () => {
    const result = validateAndFix('gradeLevel', '三年级');
    expect(result.success).toBe(false);
  });

  it('should validate extraProperties', () => {
    const result = validateAndFix('extraProperties', { '教材分析': '内容' });
    expect(result.success).toBe(true);
  });
});

describe('parseJsonSafely', () => {
  it('should parse JSON object string', () => {
    const jsonStr = '{"key": "value"}';
    const result = parseJsonSafely(jsonStr);
    expect(result).toEqual({ key: 'value' });
  });

  it('should return original value for non-JSON string', () => {
    const value = '普通字符串';
    const result = parseJsonSafely(value);
    expect(result).toBe('普通字符串');
  });

  it('should return original value for non-string types', () => {
    const obj = { key: 'value' };
    const result = parseJsonSafely(obj);
    expect(result).toBe(obj);
  });

  it('should handle whitespace around JSON', () => {
    const jsonStr = '  {"key": "value"}  ';
    const result = parseJsonSafely(jsonStr);
    expect(result).toEqual({ key: 'value' });
  });

  it('should return original value for invalid JSON', () => {
    const invalidJson = '{invalid}';
    const result = parseJsonSafely(invalidJson);
    expect(result).toBe(invalidJson);
  });
});

describe('validateAndFixField', () => {
  it('should parse JSON string and validate extraProperties', () => {
    const jsonStr = '{"教材分析": "内容"}';
    const result = validateAndFixField('extraProperties', jsonStr);
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ '教材分析': '内容' });
  });

  it('should handle already parsed data', () => {
    const result = validateAndFixField('objectives', '目标内容');
    expect(result.success).toBe(true);
    expect(result.data).toBe('目标内容');
  });
});

// ============================================================================
// FieldSchemas mapping test
// ============================================================================

describe('FieldSchemas', () => {
  it('should have all expected fields', () => {
    const expectedFields = [
      'title',
      'subject',
      'gradeLevel',
      'durationMinutes',
      'lessonPlanCode',
      'objectives',
      'content',
      'teachingMethods',
      'materialsNeeded',
      'assessmentMethods',
      'curriculumRequirements',
      'studentAnalysis',
      'extraProperties',
      'status',
    ];
    expectedFields.forEach((field) => {
      expect(FieldSchemas).toHaveProperty(field);
    });
  });
});
