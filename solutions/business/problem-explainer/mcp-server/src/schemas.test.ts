import { describe, it, expect } from 'vitest';
import {
  validateAndFixField,
  parseJsonSafely,
  SolutionStepSchema,
  ProblemAnalysisSchema,
  AnswerSchema,
  HintsSchema,
  DifficultySchema,
  KeyKnowledgeSchema,
  CommonMistakesSchema,
  RelatedProblemsSchema,
  SolutionStepsSchema,
} from './schemas.js';

describe('parseJsonSafely', () => {
  it('should parse valid JSON array string', () => {
    const result = parseJsonSafely('[1, 2, 3]');
    expect(result).toEqual([1, 2, 3]);
  });

  it('should parse valid JSON object string', () => {
    const result = parseJsonSafely('{"key": "value"}');
    expect(result).toEqual({ key: 'value' });
  });

  it('should return original value for non-JSON string', () => {
    const result = parseJsonSafely('hello world');
    expect(result).toBe('hello world');
  });

  it('should return original value for invalid JSON', () => {
    const result = parseJsonSafely('[invalid json');
    expect(result).toBe('[invalid json');
  });

  it('should return original value for non-string types', () => {
    expect(parseJsonSafely(123)).toBe(123);
    expect(parseJsonSafely(null)).toBe(null);
    expect(parseJsonSafely(undefined)).toBe(undefined);
    expect(parseJsonSafely([1, 2])).toEqual([1, 2]);
  });

  it('should handle whitespace around JSON', () => {
    const result = parseJsonSafely('  [1, 2]  ');
    expect(result).toEqual([1, 2]);
  });
});

describe('SolutionStepSchema', () => {
  it('should generate id when missing', () => {
    const result = SolutionStepSchema.safeParse({
      stepNumber: 1,
      description: '分析题意',
      explanation: '首先理解题目要求',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toMatch(/^step-\d+-[a-z0-9]+$/);
    }
  });

  it('should preserve existing id', () => {
    const result = SolutionStepSchema.safeParse({
      id: 'existing-id',
      stepNumber: 1,
      description: '分析题意',
      explanation: '首先理解题目要求',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe('existing-id');
    }
  });

  it('should include optional formula field', () => {
    const result = SolutionStepSchema.safeParse({
      stepNumber: 1,
      description: '应用公式',
      explanation: '使用勾股定理',
      formula: 'a^2 + b^2 = c^2',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.formula).toBe('a^2 + b^2 = c^2');
    }
  });

  it('should reject missing required fields', () => {
    const result = SolutionStepSchema.safeParse({
      stepNumber: 1,
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid stepNumber', () => {
    const result = SolutionStepSchema.safeParse({
      stepNumber: 0,
      description: '步骤',
      explanation: '说明',
    });
    expect(result.success).toBe(false);
  });

  it('should reject empty description', () => {
    const result = SolutionStepSchema.safeParse({
      stepNumber: 1,
      description: '',
      explanation: '说明',
    });
    expect(result.success).toBe(false);
  });

  it('should reject empty explanation', () => {
    const result = SolutionStepSchema.safeParse({
      stepNumber: 1,
      description: '步骤',
      explanation: '',
    });
    expect(result.success).toBe(false);
  });
});

describe('ProblemAnalysisSchema', () => {
  it('should accept valid string', () => {
    const result = ProblemAnalysisSchema.safeParse('这是一道关于勾股定理的题目');
    expect(result.success).toBe(true);
  });

  it('should reject empty string', () => {
    const result = ProblemAnalysisSchema.safeParse('');
    expect(result.success).toBe(false);
  });

  it('should reject non-string', () => {
    const result = ProblemAnalysisSchema.safeParse(123);
    expect(result.success).toBe(false);
  });
});

describe('AnswerSchema', () => {
  it('should accept valid string', () => {
    const result = AnswerSchema.safeParse('x = 5');
    expect(result.success).toBe(true);
  });

  it('should reject empty string', () => {
    const result = AnswerSchema.safeParse('');
    expect(result.success).toBe(false);
  });
});

describe('HintsSchema', () => {
  it('should accept valid string', () => {
    const result = HintsSchema.safeParse('提示：注意审题');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe('提示：注意审题');
    }
  });

  it('should provide default empty string', () => {
    const result = HintsSchema.safeParse(undefined);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe('');
    }
  });
});

describe('DifficultySchema', () => {
  it('should accept valid difficulty (1-5)', () => {
    for (let i = 1; i <= 5; i++) {
      const result = DifficultySchema.safeParse(i);
      expect(result.success).toBe(true);
    }
  });

  it('should reject difficulty outside range', () => {
    expect(DifficultySchema.safeParse(0).success).toBe(false);
    expect(DifficultySchema.safeParse(6).success).toBe(false);
  });

  it('should provide default value 3', () => {
    const result = DifficultySchema.safeParse(undefined);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe(3);
    }
  });
});

describe('KeyKnowledgeSchema', () => {
  it('should accept array of strings', () => {
    const result = KeyKnowledgeSchema.safeParse(['勾股定理', '三角形']);
    expect(result.success).toBe(true);
  });

  it('should provide default empty array', () => {
    const result = KeyKnowledgeSchema.safeParse(undefined);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual([]);
    }
  });

  it('should reject non-string array items', () => {
    const result = KeyKnowledgeSchema.safeParse([1, 2, 3]);
    expect(result.success).toBe(false);
  });
});

describe('CommonMistakesSchema', () => {
  it('should accept array of strings', () => {
    const result = CommonMistakesSchema.safeParse(['忘记单位', '计算错误']);
    expect(result.success).toBe(true);
  });

  it('should provide default empty array', () => {
    const result = CommonMistakesSchema.safeParse(undefined);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual([]);
    }
  });
});

describe('RelatedProblemsSchema', () => {
  it('should accept array of strings', () => {
    const result = RelatedProblemsSchema.safeParse(['类似题目1', '类似题目2']);
    expect(result.success).toBe(true);
  });

  it('should provide default empty array', () => {
    const result = RelatedProblemsSchema.safeParse(undefined);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual([]);
    }
  });
});

describe('SolutionStepsSchema', () => {
  it('should accept array of steps and auto-generate ids', () => {
    const result = SolutionStepsSchema.safeParse([
      { stepNumber: 1, description: '步骤1', explanation: '说明1' },
      { stepNumber: 2, description: '步骤2', explanation: '说明2' },
    ]);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(2);
      expect(result.data[0].id).toMatch(/^step-\d+-[a-z0-9]+$/);
      expect(result.data[1].id).toMatch(/^step-\d+-[a-z0-9]+$/);
    }
  });

  it('should provide default empty array', () => {
    const result = SolutionStepsSchema.safeParse(undefined);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual([]);
    }
  });
});

describe('validateAndFixField', () => {
  describe('solutionSteps', () => {
    it('should parse JSON string for solutionSteps', () => {
      const jsonString =
        '[{"stepNumber":1,"description":"步骤1","explanation":"说明1"}]';
      const result = validateAndFixField('solutionSteps', jsonString);
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.fixed).toBe(true);
    });

    it('should auto-generate ids for steps without id', () => {
      const result = validateAndFixField('solutionSteps', [
        { stepNumber: 1, description: '步骤1', explanation: '说明1' },
      ]);
      expect(result.success).toBe(true);
      if (result.data) {
        expect(result.data[0].id).toMatch(/^step-\d+-[a-z0-9]+$/);
      }
      expect(result.fixed).toBe(true);
    });

    it('should preserve existing ids', () => {
      const result = validateAndFixField('solutionSteps', [
        { id: 'my-id', stepNumber: 1, description: '步骤1', explanation: '说明1' },
      ]);
      expect(result.success).toBe(true);
      if (result.data) {
        expect(result.data[0].id).toBe('my-id');
      }
    });

    it('should return errors for invalid steps', () => {
      const result = validateAndFixField('solutionSteps', [{ stepNumber: 1 }]);
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('difficulty', () => {
    it('should apply default for undefined difficulty', () => {
      const result = validateAndFixField('difficulty', undefined);
      expect(result.success).toBe(true);
      expect(result.data).toBe(3);
    });

    it('should accept valid difficulty', () => {
      const result = validateAndFixField('difficulty', 4);
      expect(result.success).toBe(true);
      expect(result.data).toBe(4);
    });

    it('should reject invalid difficulty', () => {
      const result = validateAndFixField('difficulty', 10);
      expect(result.success).toBe(false);
    });
  });

  describe('string fields', () => {
    it('should validate problemAnalysis', () => {
      const result = validateAndFixField('problemAnalysis', '这是题目分析');
      expect(result.success).toBe(true);
      expect(result.data).toBe('这是题目分析');
    });

    it('should reject empty problemAnalysis', () => {
      const result = validateAndFixField('problemAnalysis', '');
      expect(result.success).toBe(false);
    });

    it('should validate answer', () => {
      const result = validateAndFixField('answer', 'x = 5');
      expect(result.success).toBe(true);
    });

    it('should apply default for hints', () => {
      const result = validateAndFixField('hints', undefined);
      expect(result.success).toBe(true);
      expect(result.data).toBe('');
    });
  });

  describe('array fields', () => {
    it('should validate keyKnowledge array', () => {
      const result = validateAndFixField('keyKnowledge', ['知识点1', '知识点2']);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(['知识点1', '知识点2']);
    });

    it('should parse JSON string for keyKnowledge', () => {
      const result = validateAndFixField('keyKnowledge', '["知识点1","知识点2"]');
      expect(result.success).toBe(true);
      expect(result.data).toEqual(['知识点1', '知识点2']);
    });

    it('should apply default for undefined array fields', () => {
      const result = validateAndFixField('commonMistakes', undefined);
      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });
  });

  describe('unknown fields', () => {
    it('should return error for unknown field', () => {
      // @ts-expect-error - Testing invalid field
      const result = validateAndFixField('unknownField', 'value');
      expect(result.success).toBe(false);
      expect(result.errors).toContain('Unknown field: unknownField');
    });
  });
});
