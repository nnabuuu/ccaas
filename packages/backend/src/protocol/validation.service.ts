/**
 * Validation Service
 *
 * JSON Schema validation for skill outputs using Ajv.
 */

import { Injectable, Logger } from '@nestjs/common';
import AjvModule from 'ajv';
import type { ErrorObject } from 'ajv';
import {
  OutputSchemaRegistryService,
  OutputSchemaDefinition,
} from './output-schema';

// Create Ajv instance handling default export variations
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Ajv = (AjvModule as any).default || AjvModule;

// ============================================================================
// TYPES
// ============================================================================

/**
 * Generic validator function type
 */
type ValidatorFn = (data: unknown) => boolean;

/**
 * Extended validator with error tracking
 */
interface ExtendedValidator extends ValidatorFn {
  errors?: ErrorObject[] | null;
}

/**
 * Validation result
 */
export interface ValidationResult {
  /** Whether validation passed */
  valid: boolean;
  /** Validation errors (if any) */
  errors: ValidationError[];
  /** Warnings (non-fatal issues) */
  warnings: string[];
}

/**
 * Validation error details
 */
export interface ValidationError {
  /** JSON path to the error location */
  path: string;
  /** Error message */
  message: string;
  /** JSON Schema keyword that failed */
  keyword: string;
  /** Additional parameters */
  params?: Record<string, unknown>;
}

/**
 * Validation options
 */
export interface ValidationOptions {
  /** Strict mode - treat warnings as errors */
  strict?: boolean;
  /** Allow additional properties not in schema */
  allowAdditionalProperties?: boolean;
  /** Coerce types (e.g., string "123" to number 123) */
  coerceTypes?: boolean;
}

// ============================================================================
// VALIDATION SERVICE
// ============================================================================

/**
 * Validation service using Ajv - NestJS injectable
 */
@Injectable()
export class ValidationService {
  private readonly logger = new Logger(ValidationService.name);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private ajv: any;
  private validators: Map<string, ExtendedValidator> = new Map();

  constructor(
    private readonly schemaRegistry: OutputSchemaRegistryService,
  ) {
    this.ajv = new Ajv({
      allErrors: true,
      verbose: true,
      strict: false,
      coerceTypes: false,
      removeAdditional: false,
    });
    this.logger.log('Initialized Ajv validation service');
  }

  /**
   * Validate output against skill's schema
   *
   * @param skillId - The skill that generated the output
   * @param output - Output to validate
   * @returns Validation result
   */
  validate(skillId: string, output: unknown): ValidationResult {
    const schemaDef = this.schemaRegistry.get(skillId);

    // No schema - skip validation
    if (!schemaDef) {
      return {
        valid: true,
        errors: [],
        warnings: [`No schema registered for skill: ${skillId}`],
      };
    }

    // Get or compile validator
    let validator = this.validators.get(skillId);
    if (!validator) {
      validator = this.compileSchema(skillId, schemaDef);
      this.validators.set(skillId, validator);
    }

    // Run validation
    const valid = validator(output);

    if (valid) {
      return {
        valid: true,
        errors: [],
        warnings: [],
      };
    }

    // Convert Ajv errors to our format
    const errors = this.convertErrors(validator.errors || []);

    return {
      valid: false,
      errors,
      warnings: [],
    };
  }

  /**
   * Validate a single field against schema
   */
  validateField(
    skillId: string,
    fieldName: string,
    value: unknown,
  ): ValidationResult {
    const schemaDef = this.schemaRegistry.get(skillId);

    if (!schemaDef) {
      return {
        valid: true,
        errors: [],
        warnings: [`No schema registered for skill: ${skillId}`],
      };
    }

    const fieldSchema = schemaDef.schema.properties[fieldName];
    if (!fieldSchema) {
      return {
        valid: true,
        errors: [],
        warnings: [`No schema for field: ${fieldName}`],
      };
    }

    // Validate just this field
    const cacheKey = `${skillId}:${fieldName}`;
    let validator = this.validators.get(cacheKey);
    if (!validator) {
      const compiled = this.ajv.compile(fieldSchema);
      const extendedValidator: ExtendedValidator = ((data: unknown) => {
        const result = compiled(data);
        extendedValidator.errors = compiled.errors;
        return result;
      }) as ExtendedValidator;
      validator = extendedValidator;
      this.validators.set(cacheKey, validator);
    }

    const valid = validator(value);

    if (valid) {
      return { valid: true, errors: [], warnings: [] };
    }

    return {
      valid: false,
      errors: this.convertErrors(validator.errors || []),
      warnings: [],
    };
  }

  /**
   * Compile a schema definition into a validator
   */
  private compileSchema(
    skillId: string,
    schemaDef: OutputSchemaDefinition,
  ): ExtendedValidator {
    const schema = {
      $id: `skill:${skillId}`,
      ...schemaDef.schema,
    };

    try {
      const compiled = this.ajv.compile(schema);
      // Wrap to maintain error reference
      const extendedValidator: ExtendedValidator = ((data: unknown) => {
        const result = compiled(data);
        extendedValidator.errors = compiled.errors;
        return result;
      }) as ExtendedValidator;
      return extendedValidator;
    } catch (error) {
      this.logger.error(`Failed to compile schema for ${skillId}:`, error);
      // Return a validator that always passes (graceful degradation)
      const passValidator: ExtendedValidator = (() => true) as ExtendedValidator;
      passValidator.errors = null;
      return passValidator;
    }
  }

  /**
   * Convert Ajv errors to our format
   */
  private convertErrors(ajvErrors: ErrorObject[]): ValidationError[] {
    return ajvErrors.map((err) => ({
      path: err.instancePath || '/',
      message: err.message || 'Validation failed',
      keyword: err.keyword,
      params: err.params as Record<string, unknown>,
    }));
  }

  /**
   * Clear compiled validators (useful after schema update)
   */
  clearCache(): void {
    this.validators.clear();
    this.logger.debug('Cleared validator cache');
  }

  /**
   * Clear validator for a specific skill
   */
  clearCacheFor(skillId: string): void {
    // Clear main validator
    this.validators.delete(skillId);
    // Clear field validators
    for (const key of this.validators.keys()) {
      if (key.startsWith(`${skillId}:`)) {
        this.validators.delete(key);
      }
    }
    this.logger.debug(`Cleared validators for skill: ${skillId}`);
  }

  /**
   * Check if output is valid (simple boolean check)
   */
  isValid(skillId: string, output: unknown): boolean {
    return this.validate(skillId, output).valid;
  }
}
