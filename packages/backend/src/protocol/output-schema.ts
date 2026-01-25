/**
 * Output Schema Registry
 *
 * Defines JSON schemas and field mappings for skill outputs.
 * Used for validation and transformation of Claude-generated content.
 */

import { Injectable, Logger } from '@nestjs/common';

// ============================================================================
// SCHEMA TYPES
// ============================================================================

/**
 * JSON Schema property definition
 */
export interface PropertySchema {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description?: string;
  items?: PropertySchema | { $ref: string };
  properties?: Record<string, PropertySchema>;
  required?: string[];
  $ref?: string;
}

/**
 * Output schema definition for a skill
 */
export interface OutputSchemaDefinition {
  /** Skill ID this schema applies to */
  skillId: string;
  /** Schema version */
  version: string;
  /** JSON Schema for the output structure */
  schema: {
    type: 'object';
    properties: Record<string, PropertySchema>;
    required?: string[];
    definitions?: Record<string, PropertySchema>;
  };
  /** Field mappings from Claude output to frontend model */
  fieldMapping?: FieldMapping[];
}

/**
 * Field mapping from backend to frontend
 */
export interface FieldMapping {
  /** Backend field name (Claude output) */
  source: string;
  /** Frontend field name (UI model) */
  target: string;
  /** Transformation type */
  transform: 'direct' | 'array' | 'nested' | 'flatten' | 'custom';
  /** Custom transform function name (for 'custom' type) */
  customTransform?: string;
  /** Default value if source is missing */
  defaultValue?: unknown;
}

/**
 * Transformed output result
 */
export interface TransformedOutput {
  /** Transformed data */
  data: unknown;
  /** Whether transformation was applied */
  mapped: boolean;
  /** Schema version used */
  schema?: string;
  /** Fields that were successfully mapped */
  mappedFields?: string[];
  /** Fields that had no mapping */
  unmappedFields?: string[];
}

// ============================================================================
// STANDARD SCHEMAS
// ============================================================================

/**
 * Lesson plan task schema (shared definition)
 */
const TaskSchema: PropertySchema = {
  type: 'object',
  properties: {
    title: { type: 'string', description: 'Task title' },
    description: { type: 'string', description: 'Task description' },
    duration: { type: 'number', description: 'Duration in minutes' },
    type: {
      type: 'string',
      description: 'Task type (e.g., discussion, exercise)',
    },
    materials: { type: 'array', items: { type: 'string' } },
    steps: { type: 'array', items: { type: 'string' } },
  },
};

/**
 * Lesson plan output schema
 */
export const LessonPlanSchema: OutputSchemaDefinition = {
  skillId: 'lesson-plan-designer',
  version: '1.0.0',
  schema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Lesson plan title' },
      subject: { type: 'string', description: 'Subject name' },
      grade: { type: 'string', description: 'Grade level' },
      duration: { type: 'number', description: 'Total duration in minutes' },
      teachingObjectives: {
        type: 'array',
        items: { type: 'string' },
        description: 'Learning objectives',
      },
      keyPoints: {
        type: 'array',
        items: { type: 'string' },
        description: 'Key teaching points',
      },
      difficultPoints: {
        type: 'array',
        items: { type: 'string' },
        description: 'Difficult concepts',
      },
      warmUp: {
        type: 'object',
        description: 'Lesson warm-up/introduction',
        properties: {
          duration: { type: 'number' },
          activities: { type: 'array', items: { type: 'string' } },
        },
      },
      learningTasks: {
        type: 'array',
        items: { $ref: '#/definitions/Task' },
        description: 'Main learning activities',
      },
      summary: {
        type: 'object',
        description: 'Lesson summary/consolidation',
        properties: {
          keyTakeaways: { type: 'array', items: { type: 'string' } },
          reflection: { type: 'string' },
        },
      },
      homeworkTasks: {
        type: 'array',
        items: { $ref: '#/definitions/Task' },
        description: 'Homework assignments',
      },
      boardDesign: {
        type: 'string',
        description: 'Board writing design',
      },
      teachingReflection: {
        type: 'string',
        description: 'Teaching reflection template',
      },
    },
    definitions: {
      Task: TaskSchema,
    },
  },
  fieldMapping: [
    {
      source: 'learningTasks',
      target: 'learningProcess',
      transform: 'direct',
    },
    {
      source: 'homeworkTasks',
      target: 'homeworkAssessment',
      transform: 'direct',
    },
    { source: 'teachingObjectives', target: 'objectives', transform: 'array' },
    { source: 'keyPoints', target: 'keyDifficulties', transform: 'direct' },
    { source: 'warmUp', target: 'introduction', transform: 'direct' },
    { source: 'summary', target: 'consolidation', transform: 'direct' },
    { source: 'boardDesign', target: 'boardWriting', transform: 'direct' },
  ],
};

/**
 * Test paper output schema
 */
export const TestPaperSchema: OutputSchemaDefinition = {
  skillId: 'test-paper-generator',
  version: '1.0.0',
  schema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Test paper title' },
      subject: { type: 'string', description: 'Subject name' },
      grade: { type: 'string', description: 'Grade level' },
      totalScore: { type: 'number', description: 'Total possible score' },
      duration: { type: 'number', description: 'Test duration in minutes' },
      questions: {
        type: 'array',
        description: 'Test questions',
        items: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            type: { type: 'string' },
            content: { type: 'string' },
            score: { type: 'number' },
            answer: { type: 'string' },
            options: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
  },
  fieldMapping: [
    { source: 'questions', target: 'items', transform: 'array' },
    { source: 'totalScore', target: 'score', transform: 'direct' },
  ],
};

// ============================================================================
// OUTPUT SCHEMA REGISTRY SERVICE
// ============================================================================

/**
 * Registry for output schemas - NestJS injectable service
 */
@Injectable()
export class OutputSchemaRegistryService {
  private readonly logger = new Logger(OutputSchemaRegistryService.name);
  private schemas: Map<string, OutputSchemaDefinition> = new Map();

  constructor() {
    // Register built-in schemas
    this.register(LessonPlanSchema);
    this.register(TestPaperSchema);
    this.logger.log('Initialized with built-in schemas');
  }

  /**
   * Register an output schema
   */
  register(schema: OutputSchemaDefinition): void {
    this.schemas.set(schema.skillId, schema);
    this.logger.debug(`Registered schema for skill: ${schema.skillId}`);
  }

  /**
   * Get schema for a skill
   */
  get(skillId: string): OutputSchemaDefinition | undefined {
    return this.schemas.get(skillId);
  }

  /**
   * Check if schema exists for skill
   */
  has(skillId: string): boolean {
    return this.schemas.has(skillId);
  }

  /**
   * List all registered skill IDs
   */
  listSkillIds(): string[] {
    return Array.from(this.schemas.keys());
  }

  /**
   * Get field mappings for a skill
   */
  getMappings(skillId: string): FieldMapping[] {
    const schema = this.schemas.get(skillId);
    return schema?.fieldMapping || [];
  }

  /**
   * Clear all schemas (for testing)
   */
  clear(): void {
    this.schemas.clear();
  }
}
