import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { DiscoveryService, Reflector } from '@nestjs/core';
import { z } from 'zod';
import { EXERCISE_TYPE_KEY } from './exercise-type.decorator';
import type {
  ExerciseTypePlugin,
  GradeContext,
  CheckItemContext,
  SanitizeContext,
} from './exercise-type-plugin.interface';
import type { GradeResult } from '../../schemas';
import type { ExerciseSpec } from '../../schemas/exercise-spec.schema';

/**
 * Central registry for exercise type plugins.
 *
 * - Auto-discovers all providers carrying \@ExerciseType('...') metadata at module init.
 * - Dynamically composes a union answerKey schema from registered plugins.
 * - Dispatches sanitize / grade / buildCheckItems to the right plugin by type.
 *
 * During the migration period, this registry coexists with the legacy code paths
 * (GradingService.graders, manifest.utils.ts sanitizers, build-check-items.ts switch).
 * Callers (GradingService etc.) can use this registry preferentially with a fallback
 * to legacy logic.
 */
@Injectable()
export class ExerciseTypeRegistry implements OnModuleInit {
  private readonly logger = new Logger(ExerciseTypeRegistry.name);
  private readonly plugins = new Map<string, ExerciseTypePlugin>();
  private composedSchema: z.ZodType<unknown> | null = null;
  /** Re-entrancy guard so ensureInitialized() called during onModuleInit() no-ops */
  private initializing = false;

  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly reflector: Reflector,
  ) {}

  onModuleInit() {
    if (this.composedSchema !== null || this.initializing) return;
    this.initializing = true;
    try {
      for (const wrapper of this.discoveryService.getProviders()) {
        if (!wrapper.metatype) continue;
        const type = this.reflector.get<string>(EXERCISE_TYPE_KEY, wrapper.metatype);
        if (type && wrapper.instance) {
          const plugin = wrapper.instance as ExerciseTypePlugin;
          if (this.plugins.has(type)) {
            this.logger.warn(`Duplicate exercise type "${type}" — overriding`);
          }
          this.plugins.set(type, plugin);
          this.logger.log(`Registered exercise type plugin "${type}": ${wrapper.metatype.name}`);
        }
      }
      this.composedSchema = this.buildComposedSchema();
      this.logger.log(
        `ExerciseTypeRegistry initialized with ${this.plugins.size} plugin(s): [${[...this.plugins.keys()].join(', ')}]`,
      );
    } finally {
      this.initializing = false;
    }
  }

  /**
   * Lazy initialization fallback: if onModuleInit hasn't fired yet (e.g., in
   * TestingModule.compile() without explicit .init()), discover plugins on
   * first access. Idempotent + re-entrancy safe via `initializing` guard.
   */
  private ensureInitialized(): void {
    if (this.composedSchema !== null || this.initializing) return;
    this.onModuleInit();
  }

  /** Get a plugin by its exercise type string */
  get(type: string): ExerciseTypePlugin | undefined {
    this.ensureInitialized();
    return this.plugins.get(type);
  }

  /** Whether the given type has a registered plugin */
  has(type: string): boolean {
    this.ensureInitialized();
    return this.plugins.has(type);
  }

  /** All registered type identifiers */
  getRegisteredTypes(): string[] {
    this.ensureInitialized();
    return [...this.plugins.keys()];
  }

  /** Composed answer key schema (z.union of all registered plugins' schemas) */
  getAnswerKeySchema(): z.ZodType<unknown> {
    this.ensureInitialized();
    if (!this.composedSchema) {
      throw new Error('ExerciseTypeRegistry not initialized — call onModuleInit first');
    }
    return this.composedSchema;
  }

  /** Validate raw answerKey against composed schema */
  validateAnswerKey(ak: unknown): { valid: boolean; errors: string[] } {
    const result = this.getAnswerKeySchema().safeParse(ak);
    if (result.success) return { valid: true, errors: [] };
    return {
      valid: false,
      errors: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
    };
  }

  /**
   * Sanitize answerKey using the registered plugin for its type.
   * Returns null when no plugin is registered for the type, or when the plugin
   * does not implement sanitize() (caller should fall back to legacy).
   */
  sanitize(ctx: SanitizeContext): ExerciseSpec | null {
    this.ensureInitialized();
    const type = (ctx.answerKey as { type?: string })?.type;
    if (!type) return null;
    const plugin = this.plugins.get(type);
    if (!plugin || !plugin.sanitize) return null;
    return plugin.sanitize(ctx);
  }

  /**
   * Grade student submission using the registered plugin for its type.
   * Returns null when no plugin is registered for the type (caller should fall back).
   */
  async grade(rawKey: unknown, data: Record<string, unknown>): Promise<GradeResult | null> {
    this.ensureInitialized();
    if (!rawKey || typeof rawKey !== 'object') return null;
    const type = (rawKey as { type?: string }).type;
    if (!type) return null;
    const plugin = this.plugins.get(type);
    if (!plugin) return null;
    // Use plugin's own schema for type-narrowing validation
    const parsed = plugin.answerKeySchema.safeParse(rawKey);
    if (!parsed.success) return null;
    return plugin.grade({ key: parsed.data as Record<string, unknown>, data });
  }

  /**
   * Build check items using the registered plugin for its type.
   * Returns null when no plugin is registered or plugin does not implement
   * buildCheckItems() (caller should fall back to legacy).
   */
  buildCheckItems(
    ak: Record<string, unknown>,
    data: Record<string, unknown>,
    gradeResult: GradeResult,
  ): Array<Record<string, unknown>> | null {
    this.ensureInitialized();
    const type = ak.type as string | undefined;
    if (!type) return null;
    const plugin = this.plugins.get(type);
    if (!plugin || !plugin.buildCheckItems) return null;
    return plugin.buildCheckItems({ key: ak, data, gradeResult });
  }

  /** Build the union schema from all registered plugins' answerKeySchemas */
  private buildComposedSchema(): z.ZodType<unknown> {
    const schemas = [...this.plugins.values()].map((p) => p.answerKeySchema);
    if (schemas.length === 0) return z.never();
    if (schemas.length === 1) return schemas[0];
    return z.union([schemas[0], schemas[1], ...schemas.slice(2)] as [
      z.ZodType<unknown>,
      z.ZodType<unknown>,
      ...z.ZodType<unknown>[],
    ]);
  }
}
