import {
  SkillFrontmatterSchema,
  validateSkillFrontmatter,
} from './skill-frontmatter.dto';

describe('SkillFrontmatterSchema', () => {
  const validFrontmatter = {
    name: 'three-column-analysis',
    description: '三栏布局题目分析',
  };

  it('should parse a complete valid frontmatter', () => {
    const result = SkillFrontmatterSchema.parse(validFrontmatter);
    expect(result).toEqual(validFrontmatter);
  });

  it('should reject missing name', () => {
    const result = SkillFrontmatterSchema.safeParse({ description: 'A skill' });
    expect(result.success).toBe(false);
  });

  it('should reject empty name', () => {
    const result = SkillFrontmatterSchema.safeParse({
      name: '',
      description: 'A skill',
    });
    expect(result.success).toBe(false);
  });

  it('should reject missing description', () => {
    const result = SkillFrontmatterSchema.safeParse({ name: 'my-skill' });
    expect(result.success).toBe(false);
  });

  it('should reject empty description', () => {
    const result = SkillFrontmatterSchema.safeParse({
      name: 'my-skill',
      description: '',
    });
    expect(result.success).toBe(false);
  });

  it('should handle unicode characters in name and description', () => {
    const fm = {
      name: '教案优化专家',
      description: '基于崔允漷教授的课程与教学论，对教案进行专业化打磨和优化',
    };
    const result = SkillFrontmatterSchema.safeParse(fm);
    expect(result.success).toBe(true);
  });

  it('should strip unknown fields (slug, scope, triggers, allowedTools)', () => {
    const result = SkillFrontmatterSchema.safeParse({
      name: 'three-column-analysis',
      slug: 'three-column-analysis',
      description: '三栏布局题目分析',
      scope: 'solution',
      triggers: [{ type: 'keyword', value: '分析', priority: 10 }],
      allowedTools: ['parse_quiz_content'],
    });
    // Zod strips unknown fields - still valid
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        name: 'three-column-analysis',
        description: '三栏布局题目分析',
      });
    }
  });
});

describe('validateSkillFrontmatter', () => {
  it('should return success with parsed data for valid input', () => {
    const input = {
      name: 'test-skill',
      description: 'A test skill',
    };
    const result = validateSkillFrontmatter(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('test-skill');
      expect(result.data.description).toBe('A test skill');
    }
  });

  it('should return errors for empty object', () => {
    const result = validateSkillFrontmatter({});
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.errors.map((e) => e.path);
      expect(paths).toContain('name');
      expect(paths).toContain('description');
    }
  });

  it('should return structured errors with path, message, and code', () => {
    const result = validateSkillFrontmatter({ name: '', description: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      for (const error of result.errors) {
        expect(error).toHaveProperty('path');
        expect(error).toHaveProperty('message');
        expect(error).toHaveProperty('code');
        expect(typeof error.path).toBe('string');
        expect(typeof error.message).toBe('string');
        expect(typeof error.code).toBe('string');
      }
    }
  });

  it('should handle non-object input', () => {
    expect(validateSkillFrontmatter(null).success).toBe(false);
    expect(validateSkillFrontmatter(undefined).success).toBe(false);
    expect(validateSkillFrontmatter('string').success).toBe(false);
    expect(validateSkillFrontmatter(42).success).toBe(false);
  });
});
