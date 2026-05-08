import { OrderGrader } from './order.grader';
import type { OrderAnswerKey } from '../../../schemas';

describe('OrderGrader', () => {
  const grader = new OrderGrader();

  const key: OrderAnswerKey = {
    type: 'order',
    items: ['Scanning', 'Predicting', 'Evaluating', 'Skimming'],
    correctOrder: [1, 3, 0, 2], // Predicting → Skimming → Scanning → Evaluating
  };

  describe('string label input', () => {
    it('correct order via string labels returns total 100', () => {
      const result = grader.grade(key, {
        order: ['Predicting', 'Skimming', 'Scanning', 'Evaluating'],
      });
      expect(result.total).toBe(100);
      expect(result.byDimension.correct).toBe(true);
    });

    it('case-insensitive string comparison', () => {
      const result = grader.grade(key, {
        order: ['predicting', 'skimming', 'scanning', 'evaluating'],
      });
      expect(result.total).toBe(100);
    });

    it('wrong string order returns total 0', () => {
      const result = grader.grade(key, {
        order: ['Scanning', 'Predicting', 'Evaluating', 'Skimming'],
      });
      expect(result.total).toBe(0);
      expect(result.byDimension.correct).toBe(false);
    });
  });

  describe('numeric index input', () => {
    it('correct order via numeric indices returns total 100', () => {
      const result = grader.grade(key, { order: [1, 3, 0, 2] });
      expect(result.total).toBe(100);
      expect(result.byDimension.correct).toBe(true);
    });

    it('wrong numeric order returns total 0', () => {
      const result = grader.grade(key, { order: [0, 1, 2, 3] });
      expect(result.total).toBe(0);
      expect(result.byDimension.correct).toBe(false);
    });

    it('out-of-bounds numeric index returns total 0', () => {
      const result = grader.grade(key, { order: [999, 3, 0, 2] });
      expect(result.total).toBe(0);
    });
  });

  describe('object label input', () => {
    it('correct order via { label } objects returns total 100', () => {
      const result = grader.grade(key, {
        order: [
          { label: 'Predicting' },
          { label: 'Skimming' },
          { label: 'Scanning' },
          { label: 'Evaluating' },
        ],
      });
      expect(result.total).toBe(100);
    });
  });

  describe('edge cases', () => {
    it('mismatched length returns total 0', () => {
      const result = grader.grade(key, { order: [1, 3] });
      expect(result.total).toBe(0);
    });

    it('empty order returns total 0', () => {
      const result = grader.grade(key, { order: [] });
      expect(result.total).toBe(0);
    });

    it('missing order field returns total 0', () => {
      const result = grader.grade(key, {});
      expect(result.total).toBe(0);
    });
  });
});
