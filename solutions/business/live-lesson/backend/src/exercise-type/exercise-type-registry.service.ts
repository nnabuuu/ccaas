import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Ajv, { ValidateFunction } from 'ajv';
import { ExerciseTypeDef } from '../adapters/persistence/entities/exercise-type-def.entity';
import { evaluateRefinement, RefinementDef, RefinementResult } from './refinement-evaluator';
import * as fs from 'fs';
import * as path from 'path';

export interface ValidationError {
  type: 'schema' | 'refinement';
  message: string;
}

export interface ExerciseTypeValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

@Injectable()
export class ExerciseTypeRegistryService implements OnModuleInit {
  private readonly logger = new Logger(ExerciseTypeRegistryService.name);
  private readonly ajv = new Ajv({ allErrors: true, strict: false });
  private validators = new Map<string, ValidateFunction>();
  private refinements = new Map<string, RefinementDef[]>();
  private defs: ExerciseTypeDef[] = [];

  constructor(
    @InjectRepository(ExerciseTypeDef)
    private readonly repo: Repository<ExerciseTypeDef>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.seed();
    await this.loadAll();
  }

  private async seed(): Promise<void> {
    const seedPath = path.resolve(process.cwd(), 'data/seed/exercise-type-defs.json');
    if (!fs.existsSync(seedPath)) {
      this.logger.warn(`Seed file not found: ${seedPath}`);
      return;
    }

    let seedData: ExerciseTypeDef[];
    try {
      seedData = JSON.parse(fs.readFileSync(seedPath, 'utf-8'));
    } catch (e) {
      this.logger.error(`Failed to parse seed file: ${e}`);
      return;
    }

    if (!Array.isArray(seedData)) {
      this.logger.error('Seed file must be a JSON array');
      return;
    }

    const existing = await this.repo.find();
    const existingTypes = new Set(existing.map((e) => e.type));
    const toInsert = seedData.filter((d) => {
      if (!d.type || !d.label) {
        this.logger.warn(`Skipping invalid seed entry: missing type or label`);
        return false;
      }
      return !existingTypes.has(d.type);
    });

    if (toInsert.length > 0) {
      await this.repo.save(toInsert);
      this.logger.log(`Seeded ${toInsert.length} exercise types: ${toInsert.map((d) => d.type).join(', ')}`);
    }
  }

  private async loadAll(): Promise<void> {
    this.defs = await this.repo.find({ order: { sortOrder: 'ASC' } });
    this.validators.clear();
    this.refinements.clear();
    this.ajv.removeSchema();

    for (const def of this.defs) {
      try {
        const schema = JSON.parse(def.jsonSchema);
        const validate = this.ajv.compile(schema);
        this.validators.set(def.type, validate);
      } catch (e) {
        this.logger.error(`Failed to compile schema for type "${def.type}": ${e}`);
      }

      try {
        const refs: RefinementDef[] = JSON.parse(def.refinements);
        this.refinements.set(def.type, refs);
      } catch (e) {
        this.logger.error(`Failed to parse refinements for type "${def.type}": ${e}`);
      }
    }

    this.logger.log(`Loaded ${this.defs.length} exercise type definitions`);
  }

  getAllDefs(): ExerciseTypeDef[] {
    return this.defs;
  }

  getDefaultValue(type: string): Record<string, unknown> | null {
    const def = this.defs.find((d) => d.type === type);
    if (!def) return null;
    try {
      return JSON.parse(def.defaultValue);
    } catch {
      return null;
    }
  }

  validate(data: unknown): ExerciseTypeValidationResult {
    if (data == null || typeof data !== 'object') {
      return { valid: false, errors: [{ type: 'schema', message: 'data must be an object' }] };
    }

    const obj = data as Record<string, unknown>;
    const type = obj['type'];
    if (typeof type !== 'string') {
      return { valid: false, errors: [{ type: 'schema', message: 'missing or invalid "type" field' }] };
    }

    const validator = this.validators.get(type);
    if (!validator) {
      return { valid: false, errors: [{ type: 'schema', message: `unknown exercise type: "${type}"` }] };
    }

    const errors: ValidationError[] = [];

    // Step 1: AJV structural validation
    const schemaValid = validator(data);
    if (!schemaValid && validator.errors) {
      for (const err of validator.errors) {
        errors.push({
          type: 'schema',
          message: `${err.instancePath || '/'}: ${err.message}`,
        });
      }
      return { valid: false, errors };
    }

    // Step 2: Refinement evaluation
    const refs = this.refinements.get(type) || [];
    for (const ref of refs) {
      const result: RefinementResult = evaluateRefinement(ref, data);
      if (!result.pass) {
        errors.push({ type: 'refinement', message: result.message || 'refinement check failed' });
      }
    }

    return { valid: errors.length === 0, errors };
  }
}
