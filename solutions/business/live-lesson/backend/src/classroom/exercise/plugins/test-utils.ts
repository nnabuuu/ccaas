/**
 * Test utilities for the ExerciseTypeRegistry.
 *
 * The Stage 6 cleanup removes the legacy graders dict from GradingService, so
 * standalone TestingModule specs need to provide the registry themselves.
 * This helper returns the full provider list (all 11 plugins + registry) for
 * easy inclusion in `Test.createTestingModule({ providers: [...] })`.
 */
import { Test, type TestingModule } from '@nestjs/testing';
import { DiscoveryModule } from '@nestjs/core';
import { ExerciseTypeRegistry } from '../exercise-type-registry';
import { QuizPlugin } from './quiz.plugin';
import { MatchPlugin } from './match.plugin';
import { OrderPlugin } from './order.plugin';
import { StancePlugin } from './stance.plugin';
import { FillBlankPlugin } from './fill-blank.plugin';
import { MatrixPlugin } from './matrix.plugin';
import { MapPlugin } from './map.plugin';
import { ImageUploadPlugin } from './image-upload.plugin';
import { SelectEvidencePlugin } from './select-evidence.plugin';
import { RichContentQuizPlugin } from './rich-content-quiz.plugin';
import { GuidedDiscoveryPlugin } from './guided-discovery.plugin';
import { AiPromptBuilder } from '../../ai-prompt-builder';

/** Providers needed to bootstrap a fully-populated ExerciseTypeRegistry. */
export const PLUGIN_PROVIDERS = [
  ExerciseTypeRegistry,
  QuizPlugin,
  MatchPlugin,
  OrderPlugin,
  StancePlugin,
  FillBlankPlugin,
  MatrixPlugin,
  MapPlugin,
  ImageUploadPlugin,
  SelectEvidencePlugin,
  RichContentQuizPlugin,
  GuidedDiscoveryPlugin,
];

export interface TestRegistryHandle {
  module: TestingModule;
  registry: ExerciseTypeRegistry;
  aiPromptBuilder: AiPromptBuilder;
}

/**
 * Bootstrap a TestingModule with a real, fully-populated ExerciseTypeRegistry.
 * Auto-discovery via NestJS lifecycle runs `onModuleInit()`, registering all
 * 11 plugins.
 */
export async function createPluginRegistryTestingModule(
  options: {
    /** Provide a mock AiPromptBuilder (default: stub that rejects on llm calls) */
    aiPromptBuilder?: AiPromptBuilder;
  } = {},
): Promise<TestRegistryHandle> {
  const mockAi =
    options.aiPromptBuilder ??
    ({
      callLlm: () => Promise.reject(new Error('mock — not configured in test')),
      callVisionLlm: () => Promise.reject(new Error('mock — not configured in test')),
    } as unknown as AiPromptBuilder);

  const module = await Test.createTestingModule({
    imports: [DiscoveryModule],
    providers: [{ provide: AiPromptBuilder, useValue: mockAi }, ...PLUGIN_PROVIDERS],
  }).compile();

  // Trigger onModuleInit lifecycle so the registry discovers plugins
  await module.init();

  const registry = module.get(ExerciseTypeRegistry);
  return { module, registry, aiPromptBuilder: mockAi };
}
