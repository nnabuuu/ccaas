/**
 * Output Transformer Service
 *
 * Transforms Claude output to frontend-expected format
 * using field mappings from the output schema registry.
 */

import { Injectable, Logger } from '@nestjs/common';
import {
  OutputSchemaRegistryService,
  OutputSchemaDefinition,
  FieldMapping,
  TransformedOutput,
} from './output-schema';

// ============================================================================
// CUSTOM TRANSFORM FUNCTIONS
// ============================================================================

type CustomTransformFn = (value: unknown, mapping: FieldMapping) => unknown;

// ============================================================================
// OUTPUT TRANSFORMER SERVICE
// ============================================================================

/**
 * Output transformer - maps Claude output to frontend model
 */
@Injectable()
export class OutputTransformerService {
  private readonly logger = new Logger(OutputTransformerService.name);
  private customTransforms: Map<string, CustomTransformFn> = new Map();

  constructor(
    private readonly schemaRegistry: OutputSchemaRegistryService,
  ) {}

  /**
   * Register a custom transform function
   */
  registerCustomTransform(name: string, fn: CustomTransformFn): void {
    this.customTransforms.set(name, fn);
    this.logger.debug(`Registered custom transform: ${name}`);
  }

  /**
   * Transform Claude output to frontend-expected format
   *
   * @param skillId - The skill that generated the output
   * @param claudeOutput - Raw output from Claude
   * @returns Transformed output with mapping metadata
   */
  transform(skillId: string, claudeOutput: unknown): TransformedOutput {
    const schema = this.schemaRegistry.get(skillId);

    // No schema - return as-is
    if (!schema) {
      return {
        data: claudeOutput,
        mapped: false,
      };
    }

    // No field mapping - return as-is with schema version
    if (!schema.fieldMapping || schema.fieldMapping.length === 0) {
      return {
        data: claudeOutput,
        mapped: false,
        schema: schema.version,
      };
    }

    // Apply field mappings
    return this.applyMappings(claudeOutput, schema);
  }

  /**
   * Apply field mappings to transform output
   */
  private applyMappings(
    claudeOutput: unknown,
    schema: OutputSchemaDefinition,
  ): TransformedOutput {
    if (!claudeOutput || typeof claudeOutput !== 'object') {
      return {
        data: claudeOutput,
        mapped: false,
        schema: schema.version,
      };
    }

    const source = claudeOutput as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    const mappedFields: string[] = [];
    const unmappedFields: string[] = [];

    // Track which source fields were mapped
    const mappedSourceFields = new Set<string>();

    // Apply each mapping
    for (const mapping of schema.fieldMapping || []) {
      const value = this.extractValue(source, mapping.source);

      if (value !== undefined) {
        result[mapping.target] = this.applyTransform(value, mapping);
        mappedFields.push(mapping.target);
        mappedSourceFields.add(mapping.source);
      } else if (mapping.defaultValue !== undefined) {
        result[mapping.target] = mapping.defaultValue;
        mappedFields.push(mapping.target);
      }
    }

    // Add unmapped source fields directly to result
    for (const key of Object.keys(source)) {
      if (!mappedSourceFields.has(key)) {
        result[key] = source[key];
        unmappedFields.push(key);
      }
    }

    return {
      data: result,
      mapped: true,
      schema: schema.version,
      mappedFields,
      unmappedFields,
    };
  }

  /**
   * Extract value from source using dot notation
   */
  private extractValue(
    source: Record<string, unknown>,
    path: string,
  ): unknown {
    const parts = path.split('.');
    let current: unknown = source;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      if (typeof current !== 'object') {
        return undefined;
      }
      current = (current as Record<string, unknown>)[part];
    }

    return current;
  }

  /**
   * Apply transformation to a value
   */
  private applyTransform(value: unknown, mapping: FieldMapping): unknown {
    switch (mapping.transform) {
      case 'direct':
        return value;

      case 'array':
        // Ensure the value is an array
        if (Array.isArray(value)) {
          return value;
        }
        return value !== undefined ? [value] : [];

      case 'nested':
        // Wrap in object if not already
        if (typeof value === 'object' && value !== null) {
          return value;
        }
        return { value };

      case 'flatten':
        // Extract first element if array
        if (Array.isArray(value)) {
          return value[0];
        }
        return value;

      case 'custom':
        if (mapping.customTransform) {
          const transform = this.customTransforms.get(mapping.customTransform);
          if (transform) {
            return transform(value, mapping);
          }
          this.logger.warn(
            `Custom transform not found: ${mapping.customTransform}`,
          );
        }
        return value;

      default:
        return value;
    }
  }

  /**
   * Transform a specific field only
   */
  transformField(
    skillId: string,
    fieldName: string,
    value: unknown,
  ): unknown {
    const mappings = this.schemaRegistry.getMappings(skillId);

    const mapping = mappings.find(
      (m) => m.source === fieldName || m.target === fieldName,
    );

    if (!mapping) {
      return value;
    }

    return this.applyTransform(value, mapping);
  }

  /**
   * Get the target field name for a source field
   */
  getTargetFieldName(skillId: string, sourceField: string): string {
    const mappings = this.schemaRegistry.getMappings(skillId);
    const mapping = mappings.find((m) => m.source === sourceField);
    return mapping?.target || sourceField;
  }

  /**
   * Get the source field name for a target field
   */
  getSourceFieldName(skillId: string, targetField: string): string {
    const mappings = this.schemaRegistry.getMappings(skillId);
    const mapping = mappings.find((m) => m.target === targetField);
    return mapping?.source || targetField;
  }
}
