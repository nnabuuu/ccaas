/**
 * @ccaas/shared - LessonPlan Types Tests
 *
 * TDD: Testing type definitions and utility functions for Lesson Plan
 */

import {
  LessonPlan,
  LessonPlanStatus,
  LearningObjective,
  Standard,
  Material,
  Activity,
  Assessment,
  Differentiation,
  BloomLevel,
  createEmptyLessonPlan,
  isLessonPlanComplete,
} from '../src/types/lesson-plan';

describe('LessonPlan Types', () => {
  describe('LessonPlanStatus', () => {
    it('should have valid status values', () => {
      const validStatuses: LessonPlanStatus[] = ['draft', 'review', 'published'];
      expect(validStatuses).toHaveLength(3);
    });
  });

  describe('BloomLevel', () => {
    it('should have all Bloom taxonomy levels', () => {
      const validLevels: BloomLevel[] = [
        'remember',
        'understand',
        'apply',
        'analyze',
        'evaluate',
        'create',
      ];
      expect(validLevels).toHaveLength(6);
    });
  });

  describe('LearningObjective', () => {
    it('should have required properties', () => {
      const objective: LearningObjective = {
        id: 'obj-1',
        description: '学生能够理解分数的基本概念',
        bloomLevel: 'understand',
        assessmentCriteria: '能正确识别分数',
      };

      expect(objective.id).toBe('obj-1');
      expect(objective.description).toBe('学生能够理解分数的基本概念');
      expect(objective.bloomLevel).toBe('understand');
      expect(objective.assessmentCriteria).toBe('能正确识别分数');
    });
  });

  describe('Standard', () => {
    it('should have required properties', () => {
      const standard: Standard = {
        id: 'std-1',
        code: 'MATH.3.NF.1',
        description: '理解分数作为整体的一部分',
        source: '国家课程标准',
      };

      expect(standard.id).toBe('std-1');
      expect(standard.code).toBe('MATH.3.NF.1');
      expect(standard.description).toBe('理解分数作为整体的一部分');
      expect(standard.source).toBe('国家课程标准');
    });
  });

  describe('Material', () => {
    it('should have required properties', () => {
      const material: Material = {
        id: 'mat-1',
        name: '分数卡片',
        type: 'manipulative',
        quantity: 30,
        url: 'https://example.com/cards',
      };

      expect(material.id).toBe('mat-1');
      expect(material.name).toBe('分数卡片');
      expect(material.type).toBe('manipulative');
      expect(material.quantity).toBe(30);
      expect(material.url).toBe('https://example.com/cards');
    });

    it('should allow different material types', () => {
      const types: Material['type'][] = [
        'handout',
        'digital',
        'manipulative',
        'video',
        'other',
      ];
      expect(types).toHaveLength(5);
    });
  });

  describe('Activity', () => {
    it('should have required properties', () => {
      const activity: Activity = {
        id: 'act-1',
        title: '分数探索活动',
        description: '使用实物探索分数概念',
        duration: 15,
        type: 'group',
        instructions: ['分组', '发放材料', '开始探索'],
        materials: ['mat-1'],
        teacherNotes: '注意引导学生思考',
      };

      expect(activity.id).toBe('act-1');
      expect(activity.title).toBe('分数探索活动');
      expect(activity.duration).toBe(15);
      expect(activity.type).toBe('group');
      expect(activity.instructions).toHaveLength(3);
      expect(activity.materials).toContain('mat-1');
    });

    it('should allow different activity types', () => {
      const types: Activity['type'][] = [
        'introduction',
        'direct-instruction',
        'guided-practice',
        'independent-practice',
        'group',
        'assessment',
        'closure',
      ];
      expect(types).toHaveLength(7);
    });
  });

  describe('Assessment', () => {
    it('should have required properties', () => {
      const assessment: Assessment = {
        formative: ['课堂观察', '问答'],
        summative: ['单元测试'],
        rubric: '评分标准...',
        selfAssessment: '学生自评表',
      };

      expect(assessment.formative).toHaveLength(2);
      expect(assessment.summative).toHaveLength(1);
      expect(assessment.rubric).toBe('评分标准...');
      expect(assessment.selfAssessment).toBe('学生自评表');
    });
  });

  describe('Differentiation', () => {
    it('should have required properties', () => {
      const differentiation: Differentiation = {
        struggling: ['提供额外支持', '简化任务'],
        onLevel: ['标准活动'],
        advanced: ['扩展挑战', '深入探究'],
        accommodations: ['视觉辅助', '额外时间'],
        modifications: ['简化目标'],
      };

      expect(differentiation.struggling).toHaveLength(2);
      expect(differentiation.onLevel).toHaveLength(1);
      expect(differentiation.advanced).toHaveLength(2);
      expect(differentiation.accommodations).toHaveLength(2);
      expect(differentiation.modifications).toHaveLength(1);
    });
  });

  describe('LessonPlan', () => {
    it('should have all required properties', () => {
      const lessonPlan: LessonPlan = {
        id: 'lp-1',
        tenantId: 'tenant-1',
        title: '分数的认识',
        subject: '数学',
        gradeLevel: '三年级',
        duration: '40分钟',

        objectives: [
          {
            id: 'obj-1',
            description: '理解分数的基本概念',
            bloomLevel: 'understand',
          },
        ],
        standards: [
          {
            id: 'std-1',
            code: 'MATH.3.NF.1',
            description: '理解分数',
            source: '课程标准',
          },
        ],
        materials: [
          {
            id: 'mat-1',
            name: '分数卡片',
            type: 'manipulative',
          },
        ],
        activities: [
          {
            id: 'act-1',
            title: '导入活动',
            description: '激发兴趣',
            duration: 5,
            type: 'introduction',
            instructions: ['展示问题'],
          },
        ],
        assessment: {
          formative: ['观察'],
          summative: [],
        },
        differentiation: {
          struggling: ['额外支持'],
          onLevel: ['标准活动'],
          advanced: ['扩展挑战'],
        },

        status: 'draft',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      expect(lessonPlan.id).toBe('lp-1');
      expect(lessonPlan.tenantId).toBe('tenant-1');
      expect(lessonPlan.title).toBe('分数的认识');
      expect(lessonPlan.subject).toBe('数学');
      expect(lessonPlan.gradeLevel).toBe('三年级');
      expect(lessonPlan.duration).toBe('40分钟');
      expect(lessonPlan.status).toBe('draft');
      expect(lessonPlan.objectives).toHaveLength(1);
      expect(lessonPlan.standards).toHaveLength(1);
      expect(lessonPlan.materials).toHaveLength(1);
      expect(lessonPlan.activities).toHaveLength(1);
    });

    it('should allow optional metadata', () => {
      const lessonPlan: LessonPlan = {
        id: 'lp-2',
        tenantId: 'tenant-1',
        title: '分数运算',
        subject: '数学',
        gradeLevel: '四年级',
        duration: '45分钟',
        objectives: [],
        standards: [],
        materials: [],
        activities: [],
        assessment: { formative: [], summative: [] },
        differentiation: { struggling: [], onLevel: [], advanced: [] },
        status: 'draft',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        metadata: {
          author: 'Teacher A',
          tags: ['分数', '运算'],
        },
      };

      expect(lessonPlan.metadata).toBeDefined();
      expect(lessonPlan.metadata?.author).toBe('Teacher A');
    });
  });

  describe('createEmptyLessonPlan', () => {
    it('should create an empty lesson plan with defaults', () => {
      const plan = createEmptyLessonPlan('tenant-1');

      expect(plan.id).toBeDefined();
      expect(plan.tenantId).toBe('tenant-1');
      expect(plan.title).toBe('');
      expect(plan.subject).toBe('');
      expect(plan.gradeLevel).toBe('');
      expect(plan.duration).toBe('');
      expect(plan.objectives).toEqual([]);
      expect(plan.standards).toEqual([]);
      expect(plan.materials).toEqual([]);
      expect(plan.activities).toEqual([]);
      expect(plan.assessment).toEqual({ formative: [], summative: [] });
      expect(plan.differentiation).toEqual({
        struggling: [],
        onLevel: [],
        advanced: [],
      });
      expect(plan.status).toBe('draft');
      expect(plan.createdAt).toBeDefined();
      expect(plan.updatedAt).toBeDefined();
    });

    it('should allow overriding defaults', () => {
      const plan = createEmptyLessonPlan('tenant-1', {
        title: '测试课程',
        subject: '语文',
      });

      expect(plan.title).toBe('测试课程');
      expect(plan.subject).toBe('语文');
    });
  });

  describe('isLessonPlanComplete', () => {
    it('should return false for empty lesson plan', () => {
      const plan = createEmptyLessonPlan('tenant-1');
      expect(isLessonPlanComplete(plan)).toBe(false);
    });

    it('should return false for incomplete lesson plan', () => {
      const plan = createEmptyLessonPlan('tenant-1', {
        title: '测试课程',
        subject: '数学',
        // Missing gradeLevel, duration, objectives, activities
      });
      expect(isLessonPlanComplete(plan)).toBe(false);
    });

    it('should return true for complete lesson plan', () => {
      const plan: LessonPlan = {
        id: 'lp-1',
        tenantId: 'tenant-1',
        title: '完整课程',
        subject: '数学',
        gradeLevel: '三年级',
        duration: '40分钟',
        objectives: [
          {
            id: 'obj-1',
            description: '目标',
            bloomLevel: 'understand',
          },
        ],
        standards: [],
        materials: [],
        activities: [
          {
            id: 'act-1',
            title: '活动',
            description: '描述',
            duration: 10,
            type: 'introduction',
            instructions: ['指令'],
          },
        ],
        assessment: { formative: ['观察'], summative: [] },
        differentiation: {
          struggling: ['支持'],
          onLevel: ['标准'],
          advanced: ['扩展'],
        },
        status: 'draft',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      expect(isLessonPlanComplete(plan)).toBe(true);
    });
  });
});

describe('LessonPlan Field Mapping', () => {
  it('should have field keys matching output_update protocol', () => {
    // These field keys should match what AI sends via output_update
    const fieldKeys = [
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

    const plan = createEmptyLessonPlan('tenant-1');

    fieldKeys.forEach((key) => {
      expect(plan).toHaveProperty(key);
    });
  });
});
