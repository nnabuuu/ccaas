import { StanceGrader } from './stance.grader';
import type { StanceAnswerKey } from '../../schemas';

describe('StanceGrader', () => {
  const grader = new StanceGrader();

  const key: StanceAnswerKey = {
    type: 'stance',
    validPositions: ['I agree', 'I partly agree', 'I disagree'],
    minEvidence: 2,
    stanceQ: 'Do you agree?',
    stanceOpts: ['I agree', 'I partly agree', 'I disagree'],
    evidence: ['Evidence A', 'Evidence B', 'Evidence C'],
  };

  describe('text position input', () => {
    it('matches exact text (case-insensitive)', () => {
      const result = grader.grade(key, { position: 'i agree', evidence: [0, 1] });
      expect(result.total).toBe(100);
      expect(result.byDimension.position).toBe(true);
    });

    it('matches mixed-case text', () => {
      const result = grader.grade(key, { position: 'I Agree', evidence: [0, 1] });
      expect(result.total).toBe(100);
    });

    it('rejects invalid text', () => {
      const result = grader.grade(key, { position: 'maybe', evidence: [0, 1] });
      expect(result.total).toBe(50);
      expect(result.byDimension.position).toBe(false);
      expect(result.byDimension.evidence).toBe(true);
    });
  });

  describe('numeric index input (legacy frontend)', () => {
    it('resolves index 0 via stanceOpts', () => {
      const result = grader.grade(key, { position: 0, evidence: [0, 1] });
      expect(result.total).toBe(100);
      expect(result.byDimension.position).toBe(true);
    });

    it('resolves index 1 via stanceOpts', () => {
      const result = grader.grade(key, { position: 1, evidence: [0, 1] });
      expect(result.total).toBe(100);
    });

    it('resolves index 2 via stanceOpts', () => {
      const result = grader.grade(key, { position: 2, evidence: [0, 1] });
      expect(result.total).toBe(100);
    });

    it('out-of-range index 99 → invalid position', () => {
      const result = grader.grade(key, { position: 99, evidence: [0, 1] });
      expect(result.total).toBe(50);
      expect(result.byDimension.position).toBe(false);
    });
  });

  describe('evidence dimension', () => {
    it('requires minEvidence items', () => {
      const result = grader.grade(key, { position: 'I agree', evidence: [0] });
      expect(result.total).toBe(50);
      expect(result.byDimension.evidence).toBe(false);
    });

    it('empty evidence → 50 with valid position', () => {
      const result = grader.grade(key, { position: 'I agree', evidence: [] });
      expect(result.total).toBe(50);
    });

    it('no position + no evidence → 0', () => {
      const result = grader.grade(key, { position: 'nope', evidence: [] });
      expect(result.total).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('handles undefined position', () => {
      const result = grader.grade(key, { evidence: [0, 1] });
      expect(result.byDimension.position).toBe(false);
    });

    it('handles null position', () => {
      const result = grader.grade(key, { position: null, evidence: [0, 1] });
      expect(result.byDimension.position).toBe(false);
    });
  });
});
