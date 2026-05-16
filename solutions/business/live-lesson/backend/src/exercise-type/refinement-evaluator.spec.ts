import { evaluateRefinement, RefinementDef } from './refinement-evaluator';

describe('RefinementEvaluator', () => {
  describe('every-item', () => {
    const def: RefinementDef = {
      type: 'every-item',
      path: 'answers',
      expr: 'item.correct < item.options.length',
      message: 'quiz: correct index must be < options.length',
    };

    it('passes when all items satisfy the expression', () => {
      const data = { answers: [{ correct: 0, options: ['A', 'B'] }, { correct: 1, options: ['X', 'Y', 'Z'] }] };
      expect(evaluateRefinement(def, data)).toEqual({ pass: true });
    });

    it('fails when an item violates the expression', () => {
      const data = { answers: [{ correct: 3, options: ['A', 'B'] }] };
      expect(evaluateRefinement(def, data)).toEqual({ pass: false, message: def.message });
    });
  });

  describe('every-item (or pattern)', () => {
    const def: RefinementDef = {
      type: 'every-item',
      path: 'answers',
      expr: 'item.options || root.options',
      message: 'match: each answer must have options',
    };

    it('passes when item has options', () => {
      const data = { answers: [{ options: ['A'] }] };
      expect(evaluateRefinement(def, data)).toEqual({ pass: true });
    });

    it('passes when root has options', () => {
      const data = { answers: [{}], options: ['A', 'B'] };
      expect(evaluateRefinement(def, data)).toEqual({ pass: true });
    });

    it('fails when neither has options', () => {
      const data = { answers: [{}] };
      expect(evaluateRefinement(def, data)).toEqual({ pass: false, message: def.message });
    });
  });

  describe('array-length-eq', () => {
    const def: RefinementDef = {
      type: 'array-length-eq',
      paths: ['correctOrder', 'items'],
      message: 'order: lengths must match',
    };

    it('passes when arrays have equal length', () => {
      const data = { correctOrder: [1, 0], items: ['a', 'b'] };
      expect(evaluateRefinement(def, data)).toEqual({ pass: true });
    });

    it('fails when arrays differ in length', () => {
      const data = { correctOrder: [1], items: ['a', 'b'] };
      expect(evaluateRefinement(def, data)).toEqual({ pass: false, message: def.message });
    });
  });

  describe('every-value-in-set', () => {
    const def: RefinementDef = {
      type: 'every-value-in-set',
      valuePath: 'sections[].correctFunction',
      setPath: 'functionOptions',
      message: 'select-evidence: correctFunction must be in functionOptions',
    };

    it('passes when all values are in set', () => {
      const data = { functionOptions: ['desc', 'argue'], sections: [{ correctFunction: 'desc' }, { correctFunction: 'argue' }] };
      expect(evaluateRefinement(def, data)).toEqual({ pass: true });
    });

    it('fails when a value is not in set', () => {
      const data = { functionOptions: ['desc'], sections: [{ correctFunction: 'other' }] };
      expect(evaluateRefinement(def, data)).toEqual({ pass: false, message: def.message });
    });
  });

  describe('array-is-permutation', () => {
    const def: RefinementDef = {
      type: 'array-is-permutation',
      arrayPath: 'correctOrder',
      lengthRef: 'items.length',
      message: 'order: must be valid permutation',
    };

    it('passes for a valid permutation', () => {
      const data = { correctOrder: [2, 0, 1], items: ['a', 'b', 'c'] };
      expect(evaluateRefinement(def, data)).toEqual({ pass: true });
    });

    it('fails for duplicate indices', () => {
      const data = { correctOrder: [0, 0, 1], items: ['a', 'b', 'c'] };
      expect(evaluateRefinement(def, data)).toEqual({ pass: false, message: def.message });
    });

    it('fails for out-of-range index', () => {
      const data = { correctOrder: [0, 5], items: ['a', 'b'] };
      expect(evaluateRefinement(def, data)).toEqual({ pass: false, message: def.message });
    });
  });

  describe('conditional-required', () => {
    const def: RefinementDef = {
      type: 'conditional-required',
      path: 'answers',
      unless: 'isDemo',
      required: ['practice', 'reason'],
      message: 'matrix: non-demo rows must have practice and reason',
    };

    it('passes when demo row lacks required fields', () => {
      const data = { answers: [{ isDemo: true, place: 'X' }] };
      expect(evaluateRefinement(def, data)).toEqual({ pass: true });
    });

    it('passes when non-demo row has required fields', () => {
      const data = { answers: [{ isDemo: false, practice: 'p', reason: 'r' }] };
      expect(evaluateRefinement(def, data)).toEqual({ pass: true });
    });

    it('fails when non-demo row lacks required fields', () => {
      const data = { answers: [{ isDemo: false, practice: 'p' }] };
      expect(evaluateRefinement(def, data)).toEqual({ pass: false, message: def.message });
    });
  });
});
