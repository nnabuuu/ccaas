/**
 * ExerciseTypeRegistry init guard tests (§17 — re-entrancy).
 *
 * Pins the contract from code-review fix #4:
 *  - onModuleInit() is idempotent (calling it twice doesn't double-register
 *    plugins or rebuild the composed schema).
 *  - ensureInitialized() called during onModuleInit() does NOT recurse
 *    infinitely (the `initializing` guard breaks the cycle).
 *  - get/has/grade/sanitize/buildCheckItems/validateAnswerKey all funnel
 *    through ensureInitialized() so tests that call .compile() without
 *    .init() still see registered plugins.
 */
import { Test } from '@nestjs/testing';
import { DiscoveryModule } from '@nestjs/core';
import { ExerciseTypeRegistry } from './exercise-type-registry';
import { PLUGIN_PROVIDERS } from '../exercise/test-utils';
import { AiPromptBuilder } from '../ai/ai-prompt-builder';

const mockAi = {
  callLlm: () => Promise.reject(new Error('mock — not configured')),
  callVisionLlm: () => Promise.reject(new Error('mock — not configured')),
} as unknown as AiPromptBuilder;

async function buildRegistry(): Promise<ExerciseTypeRegistry> {
  const module = await Test.createTestingModule({
    imports: [DiscoveryModule],
    providers: [{ provide: AiPromptBuilder, useValue: mockAi }, ...PLUGIN_PROVIDERS],
  }).compile();
  return module.get(ExerciseTypeRegistry);
}

describe('ExerciseTypeRegistry init guard', () => {
  it('onModuleInit() is idempotent — second call is a no-op', async () => {
    const registry = await buildRegistry();
    registry.onModuleInit();
    const firstTypes = [...registry.getRegisteredTypes()].sort();

    // Second call must not re-register or duplicate
    registry.onModuleInit();
    const secondTypes = [...registry.getRegisteredTypes()].sort();
    expect(secondTypes).toEqual(firstTypes);

    // And the composed schema reference stays stable across re-init calls
    const schemaA = registry.getAnswerKeySchema();
    registry.onModuleInit();
    const schemaB = registry.getAnswerKeySchema();
    expect(schemaB).toBe(schemaA);
  });

  it('ensureInitialized fallback works when caller never called .init() — get/has/grade still see plugins', async () => {
    const registry = await buildRegistry();
    // NOTE: we did NOT call module.init() — pluginRegistry must self-bootstrap.
    expect(registry.has('quiz')).toBe(true);
    expect(registry.get('quiz')).toBeDefined();
    expect(registry.getRegisteredTypes().length).toBeGreaterThan(0);
  });

  it('grade() lazy-initialises and dispatches', async () => {
    const registry = await buildRegistry();
    const result = await registry.grade(
      { type: 'quiz', answers: [{ questionIdx: 0, correct: 0, questionText: 'Q?', options: ['A', 'B'] }] },
      { answers: [0] },
    );
    expect(result?.total).toBe(100);
  });

  it('sanitize() lazy-initialises and returns ExerciseSpec', async () => {
    const registry = await buildRegistry();
    const spec = registry.sanitize({
      answerKey: {
        type: 'quiz',
        answers: [{ questionIdx: 0, correct: 0, questionText: 'Q?', options: ['A', 'B'] }],
      },
    });
    expect(spec).not.toBeNull();
    expect((spec as { type?: string }).type).toBe('quiz');
  });

  it('validateAnswerKey() lazy-initialises and validates', async () => {
    const registry = await buildRegistry();
    const ok = registry.validateAnswerKey({
      type: 'quiz',
      answers: [{ questionIdx: 0, correct: 0, questionText: 'Q?', options: ['A', 'B'] }],
    });
    expect(ok.valid).toBe(true);

    const bad = registry.validateAnswerKey({ type: 'quiz' });
    expect(bad.valid).toBe(false);
  });

  it('re-entrancy guard: ensureInitialized() while initializing=true is a no-op, not a stack overflow', async () => {
    const registry = await buildRegistry();

    // Reset state so the guard can be exercised in isolation.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const reg = registry as any;
    reg.composedSchema = null;
    reg.plugins.clear();

    // Simulate being mid-init (the production code sets this flag inside the
    // try{} block of onModuleInit). A nested ensureInitialized() call must
    // see the flag and bail out — both no recursion AND no double work.
    reg.initializing = true;
    const spy = jest.spyOn(reg, 'onModuleInit');
    reg.ensureInitialized();
    expect(spy).not.toHaveBeenCalled(); // guard short-circuits before calling onModuleInit
    expect(reg.plugins.size).toBe(0);   // and no plugins were registered

    // Once the flag clears, the next ensureInitialized() proceeds normally.
    reg.initializing = false;
    spy.mockRestore();
    reg.ensureInitialized();
    expect(registry.has('quiz')).toBe(true);
  });

  it('onModuleInit() called while another onModuleInit() is in flight is a no-op (idempotent guard)', async () => {
    const registry = await buildRegistry();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const reg = registry as any;
    reg.composedSchema = null;
    reg.plugins.clear();
    reg.initializing = true; // pretend we're mid-init from a prior call

    registry.onModuleInit(); // second concurrent caller — must bail
    expect(reg.plugins.size).toBe(0);
    expect(reg.composedSchema).toBeNull();

    // Recover and verify the registry can still initialise once the flag clears.
    reg.initializing = false;
    registry.onModuleInit();
    expect(registry.has('quiz')).toBe(true);
  });
});
