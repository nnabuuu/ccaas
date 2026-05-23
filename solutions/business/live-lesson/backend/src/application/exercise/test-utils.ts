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
import { ExerciseTypeRegistry } from './exercise-type-registry';
import { QuizPlugin } from '../../domain/exercise-types/quiz/quiz.plugin';
import { MatchPlugin } from '../../domain/exercise-types/match/match.plugin';
import { OrderPlugin } from '../../domain/exercise-types/order/order.plugin';
import { StancePlugin } from '../../domain/exercise-types/stance/stance.plugin';
import { FillBlankPlugin } from '../../domain/exercise-types/fill-blank/fill-blank.plugin';
import { MatrixPlugin } from '../../domain/exercise-types/matrix/matrix.plugin';
import { MapPlugin } from '../../domain/exercise-types/map/map.plugin';
import { ImageUploadPlugin } from '../../domain/exercise-types/image-upload/image-upload.plugin';
import { SelectEvidencePlugin } from '../../domain/exercise-types/select-evidence/select-evidence.plugin';
import { RichContentQuizPlugin } from '../../domain/exercise-types/rich-content-quiz/rich-content-quiz.plugin';
import { GuidedDiscoveryPlugin } from '../../domain/exercise-types/guided-discovery/guided-discovery.plugin';
import { AiPromptBuilder } from '../ai/ai-prompt-builder';
import { LLM_PORT } from '../../domain/ports/llm.port';

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
    providers: [
      { provide: AiPromptBuilder, useValue: mockAi },
      { provide: LLM_PORT, useValue: mockAi }, // plugins inject LLM_PORT, not AiPromptBuilder
      ...PLUGIN_PROVIDERS,
    ],
  }).compile();

  // Trigger onModuleInit lifecycle so the registry discovers plugins
  await module.init();

  const registry = module.get(ExerciseTypeRegistry);
  return { module, registry, aiPromptBuilder: mockAi };
}
