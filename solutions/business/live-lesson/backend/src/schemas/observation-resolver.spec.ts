import { resolveObserve, buildRegistry, resolveGlobalObservations } from './observation-resolver';
import type { ObservationDef } from './observation.schema';

// Helper: build a typed registry from loose test data
function reg(defs: Record<string, Partial<ObservationDef>>): Record<string, ObservationDef> {
  return defs as Record<string, ObservationDef>;
}

describe('observation-resolver', () => {

  describe('auto-generate from answerKey', () => {

    it('quiz: generates q{idx} dimensions with labels', () => {
      const step = {
        answerKey: {
          type: 'quiz',
          answers: [
            { questionIdx: 0, correct: 1, label: 'Main Idea' },
            { questionIdx: 1, correct: 2 },
          ],
        },
      };
      const r = resolveObserve(step);
      expect(r.dimensions).toHaveLength(2);
      expect(r.dimensionNameMap['q0']).toBe('Main Idea');
      expect(r.dimensionNameMap['q1']).toBe('Q2');
      expect(r.issueRules).toHaveLength(0);
      expect(r.surfaces).toHaveLength(0);
    });

    it('match: generates p{idx} dimensions', () => {
      const step = {
        answerKey: {
          type: 'match',
          answers: [
            { pairIdx: 0, left: 'Cat', correct: 'Feline' },
            { pairIdx: 1 },
          ],
        },
      };
      const r = resolveObserve(step);
      expect(r.dimensions).toHaveLength(2);
      expect(r.dimensionNameMap['p0']).toBe('Cat\u2192Feline');
      expect(r.dimensionNameMap['p1']).toBe('P2');
    });

    it('matrix: generates place/practice/reason dimensions', () => {
      const step = { answerKey: { type: 'matrix' } };
      const r = resolveObserve(step);
      expect(r.dimensions).toHaveLength(3);
      expect(r.dimensionNameMap['place']).toBe('Where');
      expect(r.dimensionNameMap['practice']).toBe('What');
      expect(r.dimensionNameMap['reason']).toBe('Why');
    });

    it('stance: generates position/evidence dimensions', () => {
      const step = { answerKey: { type: 'stance' } };
      const r = resolveObserve(step);
      expect(r.dimensions).toHaveLength(2);
      expect(r.dimensionNameMap['position']).toBe('Position');
      expect(r.dimensionNameMap['evidence']).toBe('Evidence');
    });

    it('order: generates correct dimension', () => {
      const step = { answerKey: { type: 'order' } };
      const r = resolveObserve(step);
      expect(r.dimensions).toHaveLength(1);
      expect(r.dimensionNameMap['correct']).toBe('Correct');
    });

    it('select-evidence: generates per-section func dimensions + issue rules', () => {
      const step = {
        answerKey: {
          type: 'select-evidence',
          sections: [
            { id: 'intro', label: 'Introduction' },
            { id: 'body', label: 'Body' },
          ],
        },
      };
      const r = resolveObserve(step);
      expect(r.dimensions).toHaveLength(2);
      expect(r.dimensionNameMap['intro_func']).toBe('Introduction Function');
      expect(r.dimensionNameMap['body_func']).toBe('Body Function');
      expect(r.dimensions[0].group).toBe('intro');
      expect(r.issueRules).toHaveLength(1);
      expect(r.issueRules[0].dimension).toBe('*_func');
    });

    it('map: generates placed/reasoned/positionScore per item + issue rules + surfaces', () => {
      const step = {
        answerKey: {
          type: 'map',
          items: [
            { id: 'kohl', label: 'Kohl' },
            { id: 'henna', label: 'Henna' },
          ],
        },
      };
      const r = resolveObserve(step);

      // 3 dimensions per item
      expect(r.dimensions).toHaveLength(6);
      expect(r.dimensionNameMap['kohl_placed']).toBe('Kohl \u2014 Placed');
      expect(r.dimensionNameMap['kohl_reasoned']).toBe('Kohl \u2014 Reasoning');
      expect(r.dimensionNameMap['kohl_positionScore']).toBe('Kohl \u2014 Position');
      expect(r.dimensionNameMap['henna_placed']).toBe('Henna \u2014 Placed');

      // Groups
      expect(r.dimensions[0].group).toBe('kohl');
      expect(r.dimensions[3].group).toBe('henna');

      // Issue rules (wildcard patterns)
      expect(r.issueRules).toHaveLength(3);
      expect(r.issueRules[0].dimension).toBe('*_placed');
      expect(r.issueRules[1].dimension).toBe('*_reasoned');
      expect(r.issueRules[2].dimension).toBe('*_positionScore');

      // Surfaces
      expect(r.surfaces).toHaveLength(4);
      expect(r.surfaces.map(s => s.type)).toEqual(['reasoning', 'llmFeedback', 'llmItems', 'positions']);
    });
  });

  describe('$ref resolution', () => {

    it('resolves $ref from registry', () => {
      const registry = reg({
        'custom-observe': {
          id: 'custom-observe',
          label: 'Custom',
          dimensions: [
            { key: 'x', label: 'X Dim', type: 'boolean' },
          ],
          issueRules: [
            { dimension: 'x', condition: 'wrong_pct_gte', threshold: 50, template: '{count} wrong' },
          ],
        },
      });
      const step = {
        answerKey: { type: 'quiz', answers: [] },
        observe: ['$ref:custom-observe'],
      };
      const r = resolveObserve(step, registry);
      expect(r.dimensions).toHaveLength(1);
      expect(r.dimensionNameMap['x']).toBe('X Dim');
      expect(r.issueRules).toHaveLength(1);
    });

    it('merges multiple $ref definitions', () => {
      const registry = reg({
        a: { id: 'a', label: 'A', dimensions: [{ key: 'k1', label: 'K1' }] },
        b: { id: 'b', label: 'B', dimensions: [{ key: 'k2', label: 'K2' }], surfaces: [{ type: 'reasoning', source: 'data.x', label: 'X' }] },
      });
      const step = { observe: ['$ref:a', '$ref:b'] };
      const r = resolveObserve(step, registry);
      expect(r.dimensions).toHaveLength(2);
      expect(r.dimensionNameMap['k1']).toBe('K1');
      expect(r.dimensionNameMap['k2']).toBe('K2');
      expect(r.surfaces).toHaveLength(1);
    });

    it('deduplicates dimensions by key', () => {
      const registry = reg({
        a: { id: 'a', label: 'A', dimensions: [{ key: 'x', label: 'X from A' }] },
        b: { id: 'b', label: 'B', dimensions: [{ key: 'x', label: 'X from B' }] },
      });
      const step = { observe: ['$ref:a', '$ref:b'] };
      const r = resolveObserve(step, registry);
      expect(r.dimensions).toHaveLength(1);
      expect(r.dimensionNameMap['x']).toBe('X from A');
    });

    it('merges $ref and inline definitions in same array', () => {
      const registry = reg({
        a: { id: 'a', label: 'A', dimensions: [{ key: 'k1', label: 'K1' }] },
      });
      const step = {
        observe: [
          '$ref:a',
          { id: 'inline', label: 'Inline', dimensions: [{ key: 'k2', label: 'K2' }] },
        ],
      };
      const r = resolveObserve(step, registry);
      expect(r.dimensions).toHaveLength(2);
      expect(r.dimensionNameMap['k1']).toBe('K1');
      expect(r.dimensionNameMap['k2']).toBe('K2');
    });

    it('supports inline definition in observe', () => {
      const step = {
        observe: {
          id: 'inline',
          label: 'Inline',
          dimensions: [{ key: 'z', label: 'Z' }],
        },
      };
      const r = resolveObserve(step);
      expect(r.dimensions).toHaveLength(1);
      expect(r.dimensionNameMap['z']).toBe('Z');
    });
  });

  describe('backward compatibility', () => {

    it('returns empty for undefined stepDef', () => {
      const r = resolveObserve(undefined);
      expect(r.dimensions).toHaveLength(0);
      expect(r.dimensionNameMap).toEqual({});
    });

    it('returns empty for step with no answerKey and no observe', () => {
      const r = resolveObserve({});
      expect(r.dimensions).toHaveLength(0);
    });

    it('returns empty for unknown answerKey type', () => {
      const r = resolveObserve({ answerKey: { type: 'unknown-future-type' } });
      expect(r.dimensions).toHaveLength(0);
    });

    it('explicit observe overrides auto-generate', () => {
      const step = {
        answerKey: { type: 'quiz', answers: [{ questionIdx: 0, label: 'Auto' }] },
        observe: {
          id: 'custom',
          label: 'Custom',
          dimensions: [{ key: 'custom_dim', label: 'Custom Dim' }],
        },
      };
      const r = resolveObserve(step);
      // Should use explicit, not auto-generated
      expect(r.dimensions).toHaveLength(1);
      expect(r.dimensionNameMap['custom_dim']).toBe('Custom Dim');
      expect(r.dimensionNameMap['q0']).toBeUndefined();
    });

    it('ignores invalid $ref gracefully', () => {
      const step = { observe: ['$ref:nonexistent'] };
      const r = resolveObserve(step, {});
      expect(r.dimensions).toHaveLength(0);
    });
  });

  describe('buildRegistry', () => {

    it('builds from new observations field', () => {
      const manifest = {
        observations: {
          K1: { id: 'K1', type: 'knowledge' as const, label: 'K1 Label', description: 'K1 Desc' },
          'map-dims': { id: 'map-dims', label: 'Map', dimensions: [{ key: 'x', label: 'X' }] },
        },
      };
      const r = buildRegistry(manifest);
      expect(Object.keys(r)).toEqual(['K1', 'map-dims']);
      expect(r['K1'].type).toBe('knowledge');
      expect(r['map-dims'].dimensions).toHaveLength(1);
    });

    it('builds from legacy observeDefinitions', () => {
      const manifest = {
        observeDefinitions: {
          'step-obs': { id: 'step-obs', label: 'Step Obs', dimensions: [{ key: 'a', label: 'A' }] },
        },
      };
      const r = buildRegistry(manifest);
      expect(r['step-obs'].label).toBe('Step Obs');
    });

    it('builds from legacy observationIndicators', () => {
      const manifest = {
        observationIndicators: [
          { id: 'K1', type: 'knowledge', label: 'K Label', description: 'K Desc' },
          { id: 'M1', type: 'misconception', label: 'M Label', description: 'M Desc' },
        ],
      };
      const r = buildRegistry(manifest);
      expect(Object.keys(r)).toHaveLength(2);
      expect(r['K1'].type).toBe('knowledge');
      expect(r['M1'].type).toBe('misconception');
      expect(r['K1'].description).toBe('K Desc');
    });

    it('observations takes priority over observeDefinitions', () => {
      const manifest = {
        observations: {
          dup: { id: 'dup', label: 'From observations' },
        },
        observeDefinitions: {
          dup: { id: 'dup', label: 'From observeDefinitions', dimensions: [{ key: 'x', label: 'X' }] },
        },
      };
      const r = buildRegistry(manifest);
      expect(r['dup'].label).toBe('From observations');
      expect(r['dup'].dimensions).toBeUndefined();
    });

    it('observeDefinitions takes priority over observationIndicators', () => {
      const manifest = {
        observeDefinitions: {
          K1: { id: 'K1', label: 'From defs', dimensions: [{ key: 'k', label: 'K' }] },
        },
        observationIndicators: [
          { id: 'K1', type: 'knowledge', label: 'From indicators', description: 'Desc' },
        ],
      };
      const r = buildRegistry(manifest);
      expect(r['K1'].label).toBe('From defs');
    });

    it('merges all three sources without overlap', () => {
      const manifest = {
        observations: {
          A: { id: 'A', label: 'A Obs', type: 'knowledge' as const, description: 'A Desc' },
        },
        observeDefinitions: {
          B: { id: 'B', label: 'B Def', dimensions: [{ key: 'b', label: 'B Dim' }] },
        },
        observationIndicators: [
          { id: 'C', type: 'misconception', label: 'C Ind', description: 'C Desc' },
        ],
      };
      const r = buildRegistry(manifest);
      expect(Object.keys(r).sort()).toEqual(['A', 'B', 'C']);
    });

    it('returns empty for null/undefined manifest', () => {
      expect(buildRegistry(null)).toEqual({});
      expect(buildRegistry(undefined)).toEqual({});
    });

    it('skips observations entries that fail Zod validation', () => {
      const manifest = {
        observations: {
          valid: { id: 'valid', label: 'Valid' },
          noLabel: { id: 'noLabel' }, // missing required 'label'
          noId: { label: 'No Id' },   // missing required 'id'
        },
      };
      const r = buildRegistry(manifest);
      expect(Object.keys(r)).toEqual(['valid']);
    });

    it('skips observeDefinitions entries that fail Zod validation', () => {
      const manifest = {
        observeDefinitions: {
          good: { id: 'good', label: 'Good', dimensions: [{ key: 'x', label: 'X' }] },
          bad: { label: 'Bad' }, // missing 'id'
        },
      };
      const r = buildRegistry(manifest);
      expect(Object.keys(r)).toEqual(['good']);
    });

    it('skips observationIndicators with invalid type enum', () => {
      const manifest = {
        observationIndicators: [
          { id: 'K1', type: 'knowledge', label: 'K1', description: 'K1 Desc' },
          { id: 'X1', type: 'invalid_type', label: 'X1', description: 'X1 Desc' },
        ],
      };
      const r = buildRegistry(manifest);
      expect(Object.keys(r)).toEqual(['K1']);
    });
  });

  describe('resolveGlobalObservations', () => {

    it('returns only entries with type field', () => {
      const manifest = {
        observations: {
          K1: { id: 'K1', type: 'knowledge' as const, label: 'K1', description: 'K1 Desc' },
          M1: { id: 'M1', type: 'misconception' as const, label: 'M1', description: 'M1 Desc' },
          'map-obs': { id: 'map-obs', label: 'Map', dimensions: [{ key: 'x', label: 'X' }] },
        },
      };
      const globals = resolveGlobalObservations(manifest);
      expect(globals).toHaveLength(2);
      expect(globals.map(g => g.id).sort()).toEqual(['K1', 'M1']);
    });

    it('works with legacy observationIndicators', () => {
      const manifest = {
        observationIndicators: [
          { id: 'K1', type: 'knowledge', label: 'K1', description: 'K1 Desc' },
        ],
      };
      const globals = resolveGlobalObservations(manifest);
      expect(globals).toHaveLength(1);
      expect(globals[0].id).toBe('K1');
    });

    it('returns empty for manifest with no indicators', () => {
      expect(resolveGlobalObservations({})).toHaveLength(0);
      expect(resolveGlobalObservations(null)).toHaveLength(0);
    });

    it('includes hybrid entries (type + dimensions)', () => {
      const manifest = {
        observations: {
          'discuss-depth': {
            id: 'discuss-depth',
            type: 'knowledge' as const,
            label: 'Discuss Depth',
            description: 'Assess depth...',
            dimensions: [{ key: 'depth', label: 'Depth', type: 'score' as const }],
          },
        },
      };
      const globals = resolveGlobalObservations(manifest);
      expect(globals).toHaveLength(1);
      expect(globals[0].dimensions).toHaveLength(1);
    });
  });

  describe('discuss observe field', () => {

    it('discuss $ref resolves from registry', () => {
      const registry = reg({
        'discuss-depth': {
          id: 'discuss-depth',
          label: 'Discussion Depth',
          description: 'Depth analysis',
          dimensions: [{ key: 'depth', label: 'Depth', type: 'score' }],
        },
      });
      // Simulating a discuss step with observe refs
      const step = { observe: ['$ref:discuss-depth'] };
      const r = resolveObserve(step, registry);
      expect(r.dimensions).toHaveLength(1);
      expect(r.dimensionNameMap['depth']).toBe('Depth');
    });
  });

  describe('integration: full pipeline', () => {

    it('legacy observationIndicators → resolveGlobalObservations → indicator filter', () => {
      const manifest = {
        observationIndicators: [
          { id: 'K1', type: 'knowledge', label: 'Conflict', description: 'Identifies conflict' },
          { id: 'M1', type: 'misconception', label: 'Literal', description: 'Surface reading' },
        ],
      };
      const globals = resolveGlobalObservations(manifest);
      // Same filter as classroom.service.ts
      const indicators = globals.filter(d => !!d.id && !!d.label && !!d.type && !!d.description);
      expect(indicators).toHaveLength(2);
      expect(indicators[0]).toMatchObject({ id: 'K1', type: 'knowledge', label: 'Conflict' });
      expect(indicators[1]).toMatchObject({ id: 'M1', type: 'misconception', label: 'Literal' });
    });

    it('unified manifest: global indicators + step dimensions through single pipeline', () => {
      const manifest = {
        observations: {
          K1: { id: 'K1', type: 'knowledge' as const, label: 'K1', description: 'K1 Desc' },
          M1: { id: 'M1', type: 'misconception' as const, label: 'M1', description: 'M1 Desc' },
          'map-dims': {
            id: 'map-dims', label: 'Map Dims',
            dimensions: [
              { key: 'x_placed', label: 'X Placed', type: 'boolean' as const },
            ],
            issueRules: [
              { dimension: '*_placed', condition: 'wrong_pct_gte' as const, threshold: 30, template: '{count} wrong' },
            ],
          },
        },
      };

      // 1. Global indicators for LLM pipeline
      const globals = resolveGlobalObservations(manifest);
      const indicators = globals.filter(d => !!d.id && !!d.label && !!d.type && !!d.description);
      expect(indicators).toHaveLength(2);
      expect(indicators.map(i => i.id).sort()).toEqual(['K1', 'M1']);

      // 2. Step dimensions via registry
      const registry = buildRegistry(manifest);
      const step = { observe: ['$ref:map-dims'] };
      const resolved = resolveObserve(step, registry);
      expect(resolved.dimensions).toHaveLength(1);
      expect(resolved.dimensions[0].key).toBe('x_placed');
      expect(resolved.issueRules).toHaveLength(1);
    });

    it('mixed legacy manifest: observationIndicators + observeDefinitions unified', () => {
      const manifest = {
        observationIndicators: [
          { id: 'K1', type: 'knowledge', label: 'K1', description: 'K1 Desc' },
        ],
        observeDefinitions: {
          'step-obs': {
            id: 'step-obs', label: 'Step Obs',
            dimensions: [{ key: 'a', label: 'A', type: 'boolean' as const }],
          },
        },
      };

      // Global indicators come from legacy observationIndicators
      const globals = resolveGlobalObservations(manifest);
      expect(globals).toHaveLength(1);
      expect(globals[0].id).toBe('K1');

      // Step dimensions come from legacy observeDefinitions via registry
      const registry = buildRegistry(manifest);
      const step = { observe: ['$ref:step-obs'] };
      const resolved = resolveObserve(step, registry);
      expect(resolved.dimensions).toHaveLength(1);
      expect(resolved.dimensions[0].key).toBe('a');
    });

    it('getState-like pipeline: buildRegistry → resolveObserve per task step', () => {
      const manifest = {
        observations: {
          K1: { id: 'K1', type: 'knowledge' as const, label: 'K1', description: 'K1 Desc' },
          'quiz-obs': {
            id: 'quiz-obs', label: 'Quiz Observe',
            dimensions: [{ key: 'custom_q', label: 'Custom Q', type: 'boolean' as const }],
          },
        },
      };

      const registry = buildRegistry(manifest);

      // Step with explicit observe → uses $ref
      const step1 = { observe: ['$ref:quiz-obs'], answerKey: { type: 'quiz', answers: [{ questionIdx: 0 }] } };
      const r1 = resolveObserve(step1, registry);
      expect(r1.dimensions).toHaveLength(1);
      expect(r1.dimensions[0].key).toBe('custom_q');

      // Step with no observe → falls back to auto-generate from answerKey
      const step2 = { answerKey: { type: 'quiz', answers: [{ questionIdx: 0 }, { questionIdx: 1 }] } };
      const r2 = resolveObserve(step2, registry);
      expect(r2.dimensions).toHaveLength(2);
      expect(r2.dimensions[0].key).toBe('q0');

      // Instruction step (no answerKey, no observe) → empty
      const step3 = {};
      const r3 = resolveObserve(step3, registry);
      expect(r3.dimensions).toHaveLength(0);
    });
  });
});
