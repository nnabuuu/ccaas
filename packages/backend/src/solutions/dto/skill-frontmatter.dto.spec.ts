import {
  SkillFrontmatterSchema,
  SkillTriggerSchema,
  SkillScopeSchema,
  SkillTriggerTypeSchema,
  SkillFrontmatterPartialSchema,
  validateSkillFrontmatter,
} from './skill-frontmatter.dto';

describe('SkillTriggerTypeSchema', () => {
  it('should accept valid trigger types', () => {
    expect(SkillTriggerTypeSchema.parse('keyword')).toBe('keyword');
    expect(SkillTriggerTypeSchema.parse('pattern')).toBe('pattern');
    expect(SkillTriggerTypeSchema.parse('intent')).toBe('intent');
    expect(SkillTriggerTypeSchema.parse('context')).toBe('context');
  });

  it('should reject invalid trigger types', () => {
    expect(() => SkillTriggerTypeSchema.parse('regex')).toThrow();
    expect(() => SkillTriggerTypeSchema.parse('')).toThrow();
  });
});

describe('SkillTriggerSchema', () => {
  it('should parse a valid trigger with all fields', () => {
    const trigger = {
      type: 'keyword',
      value: '请帮我分析这道题目',
      priority: 11,
      description: 'Main analysis trigger',
    };
    const result = SkillTriggerSchema.parse(trigger);
    expect(result).toEqual(trigger);
  });

  it('should apply default priority of 5', () => {
    const trigger = { type: 'pattern', value: '分析.*题目' };
    const result = SkillTriggerSchema.parse(trigger);
    expect(result.priority).toBe(5);
  });

  it('should allow description to be omitted', () => {
    const trigger = { type: 'keyword', value: 'test', priority: 10 };
    const result = SkillTriggerSchema.parse(trigger);
    expect(result.description).toBeUndefined();
  });

  it('should reject empty value', () => {
    const trigger = { type: 'keyword', value: '', priority: 5 };
    const result = SkillTriggerSchema.safeParse(trigger);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        'Trigger value must not be empty',
      );
    }
  });

  it('should reject priority below 1', () => {
    const trigger = { type: 'keyword', value: 'test', priority: 0 };
    const result = SkillTriggerSchema.safeParse(trigger);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        'Priority must be at least 1',
      );
    }
  });

  it('should reject priority above 100', () => {
    const trigger = { type: 'keyword', value: 'test', priority: 101 };
    const result = SkillTriggerSchema.safeParse(trigger);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        'Priority must be at most 100',
      );
    }
  });

  it('should reject non-integer priority', () => {
    const trigger = { type: 'keyword', value: 'test', priority: 5.5 };
    const result = SkillTriggerSchema.safeParse(trigger);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        'Priority must be an integer',
      );
    }
  });

  it('should accept boundary priority values', () => {
    expect(
      SkillTriggerSchema.parse({ type: 'keyword', value: 'a', priority: 1 })
        .priority,
    ).toBe(1);
    expect(
      SkillTriggerSchema.parse({ type: 'keyword', value: 'a', priority: 100 })
        .priority,
    ).toBe(100);
  });
});

describe('SkillScopeSchema', () => {
  it('should accept valid scopes', () => {
    expect(SkillScopeSchema.parse('tenant')).toBe('tenant');
    expect(SkillScopeSchema.parse('global')).toBe('global');
  });

  it('should reject invalid scopes', () => {
    expect(() => SkillScopeSchema.parse('personal')).toThrow();
    expect(() => SkillScopeSchema.parse('system')).toThrow();
    expect(() => SkillScopeSchema.parse('')).toThrow();
  });
});

describe('SkillFrontmatterSchema', () => {
  const validFrontmatter = {
    name: 'three-column-analysis',
    slug: 'three-column-analysis',
    description: '三栏布局题目分析',
    scope: 'tenant' as const,
    triggers: [
      { type: 'keyword' as const, value: '请帮我分析这道题目', priority: 11 },
    ],
    allowedTools: ['parse_quiz_content', 'write_output'],
  };

  it('should parse a complete valid frontmatter', () => {
    const result = SkillFrontmatterSchema.parse(validFrontmatter);
    expect(result).toEqual(validFrontmatter);
  });

  it('should apply defaults for optional fields', () => {
    const minimal = {
      name: 'my-skill',
      slug: 'my-skill',
      description: 'A test skill',
    };
    const result = SkillFrontmatterSchema.parse(minimal);
    expect(result.scope).toBe('tenant');
    expect(result.triggers).toEqual([]);
    expect(result.allowedTools).toEqual([]);
  });

  it('should reject missing name', () => {
    const { name: _, ...noName } = validFrontmatter;
    const result = SkillFrontmatterSchema.safeParse(noName);
    expect(result.success).toBe(false);
  });

  it('should reject empty name', () => {
    const result = SkillFrontmatterSchema.safeParse({
      ...validFrontmatter,
      name: '',
    });
    expect(result.success).toBe(false);
  });

  it('should reject missing slug', () => {
    const { slug: _, ...noSlug } = validFrontmatter;
    const result = SkillFrontmatterSchema.safeParse(noSlug);
    expect(result.success).toBe(false);
  });

  it('should reject invalid slug format - uppercase', () => {
    const result = SkillFrontmatterSchema.safeParse({
      ...validFrontmatter,
      slug: 'My-Skill',
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid slug format - spaces', () => {
    const result = SkillFrontmatterSchema.safeParse({
      ...validFrontmatter,
      slug: 'my skill',
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid slug format - underscores', () => {
    const result = SkillFrontmatterSchema.safeParse({
      ...validFrontmatter,
      slug: 'my_skill',
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid slug format - leading hyphen', () => {
    const result = SkillFrontmatterSchema.safeParse({
      ...validFrontmatter,
      slug: '-my-skill',
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid slug format - trailing hyphen', () => {
    const result = SkillFrontmatterSchema.safeParse({
      ...validFrontmatter,
      slug: 'my-skill-',
    });
    expect(result.success).toBe(false);
  });

  it('should accept valid slug formats', () => {
    const slugs = ['my-skill', 'a', 'skill123', 'my-cool-skill-v2'];
    for (const slug of slugs) {
      const result = SkillFrontmatterSchema.safeParse({
        ...validFrontmatter,
        slug,
      });
      expect(result.success).toBe(true);
    }
  });

  it('should reject missing description', () => {
    const { description: _, ...noDesc } = validFrontmatter;
    const result = SkillFrontmatterSchema.safeParse(noDesc);
    expect(result.success).toBe(false);
  });

  it('should reject empty description', () => {
    const result = SkillFrontmatterSchema.safeParse({
      ...validFrontmatter,
      description: '',
    });
    expect(result.success).toBe(false);
  });

  it('should parse frontmatter with multiple triggers', () => {
    const fm = {
      ...validFrontmatter,
      triggers: [
        { type: 'keyword', value: '分析这道题', priority: 10 },
        { type: 'pattern', value: '解题思路', priority: 9 },
        { type: 'intent', value: 'quiz_analysis', priority: 8 },
        { type: 'context', value: 'has_quiz_content', priority: 7 },
      ],
    };
    const result = SkillFrontmatterSchema.parse(fm);
    expect(result.triggers).toHaveLength(4);
  });

  it('should reject allowedTools with empty strings', () => {
    const result = SkillFrontmatterSchema.safeParse({
      ...validFrontmatter,
      allowedTools: ['valid_tool', ''],
    });
    expect(result.success).toBe(false);
  });

  it('should parse frontmatter matching real solution.json skill', () => {
    const realWorldFrontmatter = {
      name: 'Quiz Analyzer - Three Column Analysis',
      slug: 'three-column-analysis',
      description: '三栏布局题目分析 - 解析题目、标注知识点、查找目录、生成思路',
      scope: 'tenant',
      triggers: [
        { type: 'keyword', value: '请帮我分析这道题目', priority: 11 },
        { type: 'keyword', value: '开始分析', priority: 10 },
        { type: 'keyword', value: '分析这道题', priority: 10 },
        { type: 'keyword', value: '题目分析', priority: 9 },
        { type: 'keyword', value: '解题思路', priority: 9 },
      ],
      allowedTools: [
        'parse_quiz_content',
        'search_knowledge_points_json',
        'search_catalog',
        'write_output',
      ],
    };
    const result = SkillFrontmatterSchema.safeParse(realWorldFrontmatter);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.triggers).toHaveLength(5);
      expect(result.data.allowedTools).toHaveLength(4);
    }
  });

  it('should handle unicode characters in name and description', () => {
    const fm = {
      name: '教案优化专家',
      slug: 'lesson-plan-polish',
      description: '基于崔允漷教授的课程与教学论，对教案进行专业化打磨和优化',
      scope: 'tenant',
    };
    const result = SkillFrontmatterSchema.safeParse(fm);
    expect(result.success).toBe(true);
  });
});

describe('SkillFrontmatterPartialSchema', () => {
  it('should accept empty object', () => {
    const result = SkillFrontmatterPartialSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('should accept any subset of fields', () => {
    const result = SkillFrontmatterPartialSchema.safeParse({
      name: 'updated-name',
      triggers: [{ type: 'keyword', value: 'new trigger', priority: 5 }],
    });
    expect(result.success).toBe(true);
  });

  it('should still validate field values', () => {
    const result = SkillFrontmatterPartialSchema.safeParse({
      slug: 'INVALID SLUG',
    });
    expect(result.success).toBe(false);
  });
});

describe('validateSkillFrontmatter', () => {
  it('should return success with parsed data for valid input', () => {
    const input = {
      name: 'test-skill',
      slug: 'test-skill',
      description: 'A test skill',
    };
    const result = validateSkillFrontmatter(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('test-skill');
      expect(result.data.scope).toBe('tenant');
      expect(result.data.triggers).toEqual([]);
      expect(result.data.allowedTools).toEqual([]);
    }
  });

  it('should return errors for invalid input', () => {
    const result = validateSkillFrontmatter({});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.length).toBeGreaterThan(0);
      const paths = result.errors.map((e) => e.path);
      expect(paths).toContain('name');
      expect(paths).toContain('slug');
      expect(paths).toContain('description');
    }
  });

  it('should return structured errors with path, message, and code', () => {
    const result = validateSkillFrontmatter({ name: '', slug: 'OK', description: '' });
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

  it('should return nested paths for trigger validation errors', () => {
    const result = validateSkillFrontmatter({
      name: 'test',
      slug: 'test',
      description: 'test',
      triggers: [{ type: 'keyword', value: '', priority: 200 }],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.errors.map((e) => e.path);
      expect(paths.some((p) => p.startsWith('triggers.0'))).toBe(true);
    }
  });

  it('should handle non-object input', () => {
    expect(validateSkillFrontmatter(null).success).toBe(false);
    expect(validateSkillFrontmatter(undefined).success).toBe(false);
    expect(validateSkillFrontmatter('string').success).toBe(false);
    expect(validateSkillFrontmatter(42).success).toBe(false);
  });
});
