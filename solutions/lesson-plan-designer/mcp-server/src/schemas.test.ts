/**
 * Schema Validation Tests
 *
 * TDD tests for lesson plan field schemas
 * Testing: validation, auto-fix, defaults, and error handling
 */

import { describe, it, expect } from 'vitest';
import {
  // Basic field schemas
  TitleSchema,
  SubjectSchema,
  GradeLevelSchema,
  DurationSchema,
  // Complex schemas
  BloomLevelSchema,
  LearningObjectiveSchema,
  ObjectivesSchema,
  StandardSchema,
  StandardsSchema,
  MaterialTypeSchema,
  MaterialSchema,
  MaterialsSchema,
  ActivityTypeSchema,
  ActivitySchema,
  ActivitiesSchema,
  AssessmentSchema,
  DifferentiationSchema,
  // Utility functions
  validateAndFix,
  validateAndFixField,
  parseJsonSafely,
  FieldSchemas,
} from './schemas.js';

// ============================================================================
// 基础字段测试
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
    it('should accept valid grade level', () => {
      const result = GradeLevelSchema.safeParse('三年级');
      expect(result.success).toBe(true);
    });

    it('should reject empty grade level', () => {
      const result = GradeLevelSchema.safeParse('');
      expect(result.success).toBe(false);
    });
  });

  describe('DurationSchema', () => {
    it('should accept valid duration', () => {
      const result = DurationSchema.safeParse('45分钟');
      expect(result.success).toBe(true);
    });

    it('should reject empty duration', () => {
      const result = DurationSchema.safeParse('');
      expect(result.success).toBe(false);
    });
  });
});

// ============================================================================
// 教学目标测试
// ============================================================================

describe('Learning Objectives Schema', () => {
  describe('BloomLevelSchema', () => {
    it('should accept valid bloom levels', () => {
      const levels = ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'];
      levels.forEach((level) => {
        const result = BloomLevelSchema.safeParse(level);
        expect(result.success).toBe(true);
        expect(result.data).toBe(level);
      });
    });

    it('should default to understand for undefined', () => {
      const result = BloomLevelSchema.safeParse(undefined);
      expect(result.success).toBe(true);
      expect(result.data).toBe('understand');
    });

    it('should reject invalid bloom level', () => {
      const result = BloomLevelSchema.safeParse('knowing');
      expect(result.success).toBe(false);
    });
  });

  describe('LearningObjectiveSchema', () => {
    it('should accept complete objective', () => {
      const objective = {
        id: 'obj-1',
        description: '学生能够理解分数的基本概念',
        bloomLevel: 'understand',
        assessmentCriteria: '能用自己的话解释',
      };
      const result = LearningObjectiveSchema.safeParse(objective);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(objective);
    });

    it('should generate id when missing', () => {
      const objective = {
        description: '学生能够理解分数的基本概念',
        bloomLevel: 'understand',
      };
      const result = LearningObjectiveSchema.safeParse(objective);
      expect(result.success).toBe(true);
      expect(result.data?.id).toMatch(/^obj-\d+-[a-z0-9]+$/);
    });

    it('should use default bloomLevel when missing', () => {
      const objective = {
        description: '学生能够理解分数的基本概念',
      };
      const result = LearningObjectiveSchema.safeParse(objective);
      expect(result.success).toBe(true);
      expect(result.data?.bloomLevel).toBe('understand');
    });

    it('should reject objective without description', () => {
      const objective = {
        id: 'obj-1',
        bloomLevel: 'understand',
      };
      const result = LearningObjectiveSchema.safeParse(objective);
      expect(result.success).toBe(false);
    });

    it('should reject empty description', () => {
      const objective = {
        description: '',
        bloomLevel: 'understand',
      };
      const result = LearningObjectiveSchema.safeParse(objective);
      expect(result.success).toBe(false);
    });
  });

  describe('ObjectivesSchema', () => {
    it('should accept array of objectives', () => {
      const objectives = [
        { description: '目标1', bloomLevel: 'understand' },
        { description: '目标2', bloomLevel: 'apply' },
      ];
      const result = ObjectivesSchema.safeParse(objectives);
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
    });

    it('should default to empty array', () => {
      const result = ObjectivesSchema.safeParse(undefined);
      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it('should auto-generate ids for all objectives', () => {
      const objectives = [
        { description: '目标1' },
        { description: '目标2' },
      ];
      const result = ObjectivesSchema.safeParse(objectives);
      expect(result.success).toBe(true);
      result.data?.forEach((obj: { id: string }) => {
        expect(obj.id).toMatch(/^obj-\d+-[a-z0-9]+$/);
      });
    });
  });
});

// ============================================================================
// 课程标准测试
// ============================================================================

describe('Standards Schema', () => {
  describe('StandardSchema', () => {
    it('should accept complete standard', () => {
      const standard = {
        id: 'std-1',
        code: '数学-2-0123',
        description: '理解分数的意义',
      };
      const result = StandardSchema.safeParse(standard);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(standard);
    });

    it('should generate id when missing', () => {
      const standard = {
        code: '数学-2-0123',
        description: '理解分数的意义',
      };
      const result = StandardSchema.safeParse(standard);
      expect(result.success).toBe(true);
      expect(result.data?.id).toMatch(/^std-\d+-[a-z0-9]+$/);
    });

    it('should default code to empty string', () => {
      const standard = {
        description: '理解分数的意义',
      };
      const result = StandardSchema.safeParse(standard);
      expect(result.success).toBe(true);
      expect(result.data?.code).toBe('');
    });

    it('should reject standard without description', () => {
      const standard = {
        code: '数学-2-0123',
      };
      const result = StandardSchema.safeParse(standard);
      expect(result.success).toBe(false);
    });
  });

  describe('StandardsSchema', () => {
    it('should default to empty array', () => {
      const result = StandardsSchema.safeParse(undefined);
      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });
  });
});

// ============================================================================
// 教学材料测试
// ============================================================================

describe('Materials Schema', () => {
  describe('MaterialTypeSchema', () => {
    it('should accept valid material types', () => {
      const types = ['textbook', 'handout', 'digital', 'manipulative', 'other'];
      types.forEach((type) => {
        const result = MaterialTypeSchema.safeParse(type);
        expect(result.success).toBe(true);
      });
    });

    it('should default to other', () => {
      const result = MaterialTypeSchema.safeParse(undefined);
      expect(result.success).toBe(true);
      expect(result.data).toBe('other');
    });
  });

  describe('MaterialSchema', () => {
    it('should accept complete material', () => {
      const material = {
        id: 'mat-1',
        name: '人教版数学三年级上册',
        type: 'textbook',
        url: 'https://example.com/textbook.pdf',
        notes: '第3单元',
      };
      const result = MaterialSchema.safeParse(material);
      expect(result.success).toBe(true);
    });

    it('should generate id when missing', () => {
      const material = {
        name: '人教版数学三年级上册',
        type: 'textbook',
      };
      const result = MaterialSchema.safeParse(material);
      expect(result.success).toBe(true);
      expect(result.data?.id).toMatch(/^mat-\d+-[a-z0-9]+$/);
    });

    it('should accept empty string for url', () => {
      const material = {
        name: '课件',
        type: 'digital',
        url: '',
      };
      const result = MaterialSchema.safeParse(material);
      expect(result.success).toBe(true);
    });

    it('should reject invalid url', () => {
      const material = {
        name: '课件',
        type: 'digital',
        url: 'not-a-url',
      };
      const result = MaterialSchema.safeParse(material);
      expect(result.success).toBe(false);
    });

    it('should reject material without name', () => {
      const material = {
        type: 'textbook',
      };
      const result = MaterialSchema.safeParse(material);
      expect(result.success).toBe(false);
    });
  });

  describe('MaterialsSchema', () => {
    it('should default to empty array', () => {
      const result = MaterialsSchema.safeParse(undefined);
      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });
  });
});

// ============================================================================
// 教学活动测试
// ============================================================================

describe('Activities Schema', () => {
  describe('ActivityTypeSchema', () => {
    it('should accept valid activity types', () => {
      const types = [
        'introduction',
        'direct-instruction',
        'guided-practice',
        'independent-practice',
        'group',
        'assessment',
        'closure',
      ];
      types.forEach((type) => {
        const result = ActivityTypeSchema.safeParse(type);
        expect(result.success).toBe(true);
      });
    });

    it('should default to direct-instruction', () => {
      const result = ActivityTypeSchema.safeParse(undefined);
      expect(result.success).toBe(true);
      expect(result.data).toBe('direct-instruction');
    });
  });

  describe('ActivitySchema', () => {
    it('should accept complete activity', () => {
      const activity = {
        id: 'act-1',
        title: '情境导入',
        description: '通过生活情境引入分数概念',
        duration: 5,
        type: 'introduction',
        instructions: ['展示图片', '提问学生'],
        materials: ['PPT课件'],
        teacherNotes: '注意观察学生反应',
      };
      const result = ActivitySchema.safeParse(activity);
      expect(result.success).toBe(true);
    });

    it('should generate id when missing', () => {
      const activity = {
        title: '情境导入',
        description: '通过生活情境引入分数概念',
        duration: 5,
        type: 'introduction',
        instructions: [],
      };
      const result = ActivitySchema.safeParse(activity);
      expect(result.success).toBe(true);
      expect(result.data?.id).toMatch(/^act-\d+-[a-z0-9]+$/);
    });

    it('should use default values for optional fields', () => {
      const activity = {
        title: '情境导入',
      };
      const result = ActivitySchema.safeParse(activity);
      expect(result.success).toBe(true);
      expect(result.data?.description).toBe('');
      expect(result.data?.duration).toBe(10);
      expect(result.data?.type).toBe('direct-instruction');
      expect(result.data?.instructions).toEqual([]);
    });

    it('should reject activity without title', () => {
      const activity = {
        description: '活动描述',
        duration: 5,
      };
      const result = ActivitySchema.safeParse(activity);
      expect(result.success).toBe(false);
    });

    it('should reject duration out of range', () => {
      const activityTooShort = {
        title: '活动',
        duration: 0,
      };
      const activityTooLong = {
        title: '活动',
        duration: 150,
      };
      expect(ActivitySchema.safeParse(activityTooShort).success).toBe(false);
      expect(ActivitySchema.safeParse(activityTooLong).success).toBe(false);
    });

    it('should ensure instructions is always an array', () => {
      const activity = {
        title: '活动',
        instructions: undefined,
      };
      const result = ActivitySchema.safeParse(activity);
      expect(result.success).toBe(true);
      expect(Array.isArray(result.data?.instructions)).toBe(true);
    });
  });

  describe('ActivitiesSchema', () => {
    it('should default to empty array', () => {
      const result = ActivitiesSchema.safeParse(undefined);
      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });
  });
});

// ============================================================================
// 评估方案测试
// ============================================================================

describe('Assessment Schema', () => {
  it('should accept complete assessment', () => {
    const assessment = {
      formative: ['课堂观察', '提问检查'],
      summative: ['单元测试', '作业评价'],
      rubric: '90-100分：优秀',
    };
    const result = AssessmentSchema.safeParse(assessment);
    expect(result.success).toBe(true);
    expect(result.data).toEqual(assessment);
  });

  it('should use default values', () => {
    const result = AssessmentSchema.safeParse(undefined);
    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      formative: [],
      summative: [],
    });
  });

  it('should default arrays when partial', () => {
    const assessment = {
      formative: ['课堂观察'],
    };
    const result = AssessmentSchema.safeParse(assessment);
    expect(result.success).toBe(true);
    expect(result.data?.summative).toEqual([]);
  });
});

// ============================================================================
// 差异化教学测试
// ============================================================================

describe('Differentiation Schema', () => {
  it('should accept complete differentiation', () => {
    const differentiation = {
      struggling: ['提供额外支持'],
      onLevel: ['完成标准任务'],
      advanced: ['拓展练习'],
      ell: ['双语词汇表'],
      accommodations: ['延长时间'],
    };
    const result = DifferentiationSchema.safeParse(differentiation);
    expect(result.success).toBe(true);
    expect(result.data).toEqual(differentiation);
  });

  it('should use default values', () => {
    const result = DifferentiationSchema.safeParse(undefined);
    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      struggling: [],
      onLevel: [],
      advanced: [],
    });
  });
});

// ============================================================================
// 校验和修复函数测试
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

  it('should indicate when data was fixed', () => {
    const objectives = [
      { description: '目标1' }, // missing id and bloomLevel
    ];
    const result = validateAndFix('objectives', objectives);
    expect(result.success).toBe(true);
    expect(result.fixed).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('should not indicate fixed when data is unchanged', () => {
    const result = validateAndFix('title', '分数的认识');
    expect(result.fixed).toBe(false);
    expect(result.warnings).toEqual([]);
  });
});

describe('parseJsonSafely', () => {
  it('should parse JSON array string', () => {
    const jsonStr = '[{"description": "目标1"}]';
    const result = parseJsonSafely(jsonStr);
    expect(result).toEqual([{ description: '目标1' }]);
  });

  it('should parse JSON object string', () => {
    const jsonStr = '{"formative": ["观察"], "summative": ["测试"]}';
    const result = parseJsonSafely(jsonStr);
    expect(result).toEqual({ formative: ['观察'], summative: ['测试'] });
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
    const jsonStr = '  [{"description": "目标1"}]  ';
    const result = parseJsonSafely(jsonStr);
    expect(result).toEqual([{ description: '目标1' }]);
  });

  it('should return original value for invalid JSON', () => {
    const invalidJson = '[{invalid}]';
    const result = parseJsonSafely(invalidJson);
    expect(result).toBe(invalidJson);
  });
});

describe('validateAndFixField', () => {
  it('should parse JSON string and validate', () => {
    const jsonStr = '[{"description": "目标1"}]';
    const result = validateAndFixField('objectives', jsonStr);
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(1);
    expect(result.data?.[0].description).toBe('目标1');
  });

  it('should handle already parsed data', () => {
    const objectives = [{ description: '目标1' }];
    const result = validateAndFixField('objectives', objectives);
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(1);
  });

  it('should apply defaults and auto-fix', () => {
    const jsonStr = '[{"description": "目标1"}]';
    const result = validateAndFixField('objectives', jsonStr);
    expect(result.success).toBe(true);
    expect(result.data?.[0].id).toMatch(/^obj-\d+-[a-z0-9]+$/);
    expect(result.data?.[0].bloomLevel).toBe('understand');
  });
});

// ============================================================================
// FieldSchemas 映射测试
// ============================================================================

describe('FieldSchemas', () => {
  it('should have all expected fields', () => {
    const expectedFields = [
      'title',
      'subject',
      'gradeLevel',
      'duration',
      'objectives',
      'standards',
      'materials',
      'activities',
      'assessment',
      'differentiation',
    ];
    expectedFields.forEach((field) => {
      expect(FieldSchemas).toHaveProperty(field);
    });
  });
});

// ============================================================================
// 集成测试：模拟 AI 输出场景
// ============================================================================

// ============================================================================
// 边界条件测试：覆盖 transform 函数中的 ID 保留逻辑
// ============================================================================

describe('ID Preservation in Transforms', () => {
  describe('LearningObjectiveSchema - ID edge cases', () => {
    it('should preserve existing id (not regenerate)', () => {
      const objective = {
        id: 'custom-obj-123',
        description: '目标描述',
        bloomLevel: 'understand' as const,
      };
      const result = LearningObjectiveSchema.safeParse(objective);
      expect(result.success).toBe(true);
      expect(result.data?.id).toBe('custom-obj-123');
    });

    it('should regenerate id when id is empty string', () => {
      const objective = {
        id: '',
        description: '目标描述',
        bloomLevel: 'understand' as const,
      };
      const result = LearningObjectiveSchema.safeParse(objective);
      expect(result.success).toBe(true);
      expect(result.data?.id).toMatch(/^obj-\d+-[a-z0-9]+$/);
    });
  });

  describe('StandardSchema - ID edge cases', () => {
    it('should preserve existing id (not regenerate)', () => {
      const standard = {
        id: 'custom-std-456',
        code: 'CODE-123',
        description: '标准描述',
      };
      const result = StandardSchema.safeParse(standard);
      expect(result.success).toBe(true);
      expect(result.data?.id).toBe('custom-std-456');
    });

    it('should regenerate id when id is empty string', () => {
      const standard = {
        id: '',
        code: 'CODE-123',
        description: '标准描述',
      };
      const result = StandardSchema.safeParse(standard);
      expect(result.success).toBe(true);
      expect(result.data?.id).toMatch(/^std-\d+-[a-z0-9]+$/);
    });
  });

  describe('MaterialSchema - ID edge cases', () => {
    it('should preserve existing id (not regenerate)', () => {
      const material = {
        id: 'custom-mat-789',
        name: '材料名称',
        type: 'textbook' as const,
      };
      const result = MaterialSchema.safeParse(material);
      expect(result.success).toBe(true);
      expect(result.data?.id).toBe('custom-mat-789');
    });

    it('should regenerate id when id is empty string', () => {
      const material = {
        id: '',
        name: '材料名称',
        type: 'textbook' as const,
      };
      const result = MaterialSchema.safeParse(material);
      expect(result.success).toBe(true);
      expect(result.data?.id).toMatch(/^mat-\d+-[a-z0-9]+$/);
    });
  });

  describe('ActivitySchema - ID and instructions edge cases', () => {
    it('should preserve existing id (not regenerate)', () => {
      const activity = {
        id: 'custom-act-abc',
        title: '活动标题',
        instructions: [],
      };
      const result = ActivitySchema.safeParse(activity);
      expect(result.success).toBe(true);
      expect(result.data?.id).toBe('custom-act-abc');
    });

    it('should regenerate id when id is empty string', () => {
      const activity = {
        id: '',
        title: '活动标题',
        instructions: [],
      };
      const result = ActivitySchema.safeParse(activity);
      expect(result.success).toBe(true);
      expect(result.data?.id).toMatch(/^act-\d+-[a-z0-9]+$/);
    });

    it('should handle instructions as non-array gracefully', () => {
      // This tests the fallback in transform: obj.instructions || []
      const activity = {
        title: '活动标题',
        // instructions will be undefined and get default []
      };
      const result = ActivitySchema.safeParse(activity);
      expect(result.success).toBe(true);
      expect(result.data?.instructions).toEqual([]);
    });
  });
});

describe('Integration: AI Output Simulation', () => {
  it('should handle AI output with missing ids', () => {
    const aiOutput = [
      {
        description: '学生能够理解分数的基本概念',
        bloomLevel: 'understand',
      },
      {
        description: '学生能够比较分数的大小',
        bloomLevel: 'analyze',
      },
    ];
    const result = validateAndFixField('objectives', aiOutput);
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(2);
    result.data?.forEach((obj: { id: string }) => {
      expect(obj.id).toBeDefined();
      expect(obj.id).toMatch(/^obj-\d+-[a-z0-9]+$/);
    });
  });

  it('should handle AI output as JSON string', () => {
    const aiOutput = JSON.stringify([
      {
        title: '情境导入',
        description: '通过生活情境引入分数概念',
        duration: 5,
        type: 'introduction',
        instructions: ['展示图片', '提问学生'],
      },
    ]);
    const result = validateAndFixField('activities', aiOutput);
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(1);
    expect(result.data?.[0].title).toBe('情境导入');
  });

  it('should handle partial assessment object', () => {
    const aiOutput = {
      formative: ['课堂观察', '提问'],
      // missing summative
    };
    const result = validateAndFixField('assessment', aiOutput);
    expect(result.success).toBe(true);
    expect(result.data?.formative).toEqual(['课堂观察', '提问']);
    expect(result.data?.summative).toEqual([]);
  });

  it('should reject invalid AI output gracefully', () => {
    const aiOutput = [
      { id: 'obj-1' }, // missing description
    ];
    const result = validateAndFixField('objectives', aiOutput);
    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain('description');
  });

  it('should handle complex nested activities', () => {
    const aiOutput = [
      {
        title: '导入环节',
        description: '情境引入',
        duration: 5,
        type: 'introduction',
        instructions: ['步骤1', '步骤2'],
        materials: ['PPT'],
        teacherNotes: '注意事项',
      },
      {
        title: '讲解环节',
        // minimal fields - should get defaults
      },
    ];
    const result = validateAndFixField('activities', aiOutput);
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(2);
    expect(result.data?.[0].title).toBe('导入环节');
    expect(result.data?.[1].duration).toBe(10); // default
    expect(result.data?.[1].type).toBe('direct-instruction'); // default
  });
});
