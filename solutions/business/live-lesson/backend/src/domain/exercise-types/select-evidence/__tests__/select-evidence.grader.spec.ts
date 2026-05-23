import { SelectEvidenceGrader } from '../select-evidence.grader';
import type { SelectEvidenceAnswerKey } from '../../../../schemas';

describe('SelectEvidenceGrader', () => {
  const grader = new SelectEvidenceGrader();

  const makeKey = (overrides: Partial<SelectEvidenceAnswerKey> = {}): SelectEvidenceAnswerKey => ({
    type: 'select-evidence',
    functionOptions: ['cause-effect', 'compare-contrast'],
    sections: [
      { id: 'sec1', label: 'Section 1', range: [1], correctFunction: 'cause-effect' },
    ],
    paragraphTokens: {
      '1': [
        { t: 'The', kind: 'neutral' },
        { t: 'rain', kind: 'evidence', why: 'cause' },
        { t: 'caused', kind: 'evidence', why: 'link' },
        { t: 'flooding', kind: 'evidence', why: 'effect' },
        { t: 'yesterday', kind: 'distractor' },
      ],
    },
    ...overrides,
  });

  describe('perfect score', () => {
    it('returns 100 when function correct + all evidence picked, no distractors', () => {
      const key = makeKey();
      const data = {
        sections: {
          sec1: { function: 'cause-effect', picked: ['1:1', '1:2', '1:3'] },
        },
      };
      const result = grader.grade(key, data);
      expect(result.total).toBe(100);
      expect(result.byDimension['sec1_func']).toBe(true);
      expect(result.byDimension['sec1_hit']).toBe(3);
      expect(result.byDimension['sec1_total']).toBe(3);
      expect(result.byDimension['sec1_wrong']).toBe(0);
    });
  });

  describe('partial scores', () => {
    it('reduces score when evidence is missed (recall < 1)', () => {
      const key = makeKey();
      const data = {
        sections: {
          sec1: { function: 'cause-effect', picked: ['1:1'] },
        },
      };
      const result = grader.grade(key, data);
      expect(result.total).toBeGreaterThan(0);
      expect(result.total).toBeLessThan(100);
      expect(result.byDimension['sec1_hit']).toBe(1);
    });

    it('reduces score when distractors picked (precision penalty)', () => {
      const key = makeKey();
      const data = {
        sections: {
          sec1: { function: 'cause-effect', picked: ['1:1', '1:2', '1:3', '1:4'] },
        },
      };
      const result = grader.grade(key, data);
      // All 3 evidence tokens picked + 1 distractor
      expect(result.total).toBeLessThan(100);
      expect(result.byDimension['sec1_wrong']).toBe(1);
    });
  });

  describe('wrong function', () => {
    it('reduces weight to 0.3 when function is wrong', () => {
      const key = makeKey();
      const data = {
        sections: {
          sec1: { function: 'compare-contrast', picked: ['1:1', '1:2', '1:3'] },
        },
      };
      const result = grader.grade(key, data);
      // Wrong function: 0.3 * evidenceScore (which is 1.0 since all picked)
      expect(result.total).toBe(30);
      expect(result.byDimension['sec1_func']).toBe(false);
    });

    it('function comparison is case-insensitive', () => {
      const key = makeKey();
      const data = {
        sections: {
          sec1: { function: 'Cause-Effect', picked: ['1:1', '1:2', '1:3'] },
        },
      };
      const result = grader.grade(key, data);
      expect(result.total).toBe(100);
      expect(result.byDimension['sec1_func']).toBe(true);
    });
  });

  describe('empty / missing data', () => {
    it('returns 0 when student data is empty', () => {
      const key = makeKey();
      const result = grader.grade(key, {});
      expect(result.total).toBe(0);
      expect(result.byDimension['sectionsCompleted']).toBe(0);
    });

    it('returns 0 when sections object is empty', () => {
      const key = makeKey();
      const result = grader.grade(key, { sections: {} });
      expect(result.total).toBe(0);
    });

    it('returns 0 when student has no picked tokens', () => {
      const key = makeKey();
      const data = {
        sections: {
          sec1: { function: 'cause-effect', picked: [] },
        },
      };
      const result = grader.grade(key, data);
      // Function correct (0.3) but evidence = 0: 0.3 + 0.7*0 = 0.3 → 30
      expect(result.total).toBe(30);
    });
  });

  describe('multiple sections', () => {
    it('averages scores across sections', () => {
      const key = makeKey({
        sections: [
          { id: 'sec1', label: 'Section 1', range: [1], correctFunction: 'cause-effect' },
          { id: 'sec2', label: 'Section 2', range: [2], correctFunction: 'compare-contrast' },
        ],
        paragraphTokens: {
          '1': [
            { t: 'rain', kind: 'evidence' },
            { t: 'flood', kind: 'evidence' },
          ],
          '2': [
            { t: 'unlike', kind: 'evidence' },
            { t: 'similar', kind: 'evidence' },
          ],
        },
      });
      const data = {
        sections: {
          sec1: { function: 'cause-effect', picked: ['1:0', '1:1'] },
          sec2: { function: 'compare-contrast', picked: ['2:0', '2:1'] },
        },
      };
      const result = grader.grade(key, data);
      expect(result.total).toBe(100);
      expect(result.byDimension['sectionsCompleted']).toBe(2);
      expect(result.byDimension['sectionsTotal']).toBe(2);
    });

    it('handles one section complete, one missing', () => {
      const key = makeKey({
        sections: [
          { id: 'sec1', label: 'Section 1', range: [1], correctFunction: 'cause-effect' },
          { id: 'sec2', label: 'Section 2', range: [2], correctFunction: 'compare-contrast' },
        ],
        paragraphTokens: {
          '1': [{ t: 'rain', kind: 'evidence' }],
          '2': [{ t: 'unlike', kind: 'evidence' }],
        },
      });
      const data = {
        sections: {
          sec1: { function: 'cause-effect', picked: ['1:0'] },
        },
      };
      const result = grader.grade(key, data);
      // sec1 = 1.0, sec2 = 0 (missing). Average = 0.5 → 50
      expect(result.total).toBe(50);
      expect(result.byDimension['sectionsCompleted']).toBe(1);
    });
  });

  describe('missing paragraphTokens for range', () => {
    it('gracefully skips paragraphs with no tokens', () => {
      const key = makeKey({
        sections: [
          { id: 'sec1', label: 'Section 1', range: [1, 99], correctFunction: 'cause-effect' },
        ],
        paragraphTokens: {
          '1': [{ t: 'rain', kind: 'evidence' }],
          // paragraph 99 has no tokens entry
        },
      });
      const data = {
        sections: {
          sec1: { function: 'cause-effect', picked: ['1:0'] },
        },
      };
      const result = grader.grade(key, data);
      // Only 1 evidence token (from para 1), all picked
      expect(result.total).toBe(100);
    });
  });

  describe('sectionsCompleted/sectionsTotal tracking', () => {
    it('tracks completed vs total sections in byDimension', () => {
      const key = makeKey({
        sections: [
          { id: 'a', label: 'A', range: [1], correctFunction: 'cause-effect' },
          { id: 'b', label: 'B', range: [1], correctFunction: 'cause-effect' },
          { id: 'c', label: 'C', range: [1], correctFunction: 'cause-effect' },
        ],
      });
      const data = {
        sections: {
          a: { function: 'cause-effect', picked: [] },
          c: { function: 'cause-effect', picked: [] },
        },
      };
      const result = grader.grade(key, data);
      expect(result.byDimension['sectionsCompleted']).toBe(2);
      expect(result.byDimension['sectionsTotal']).toBe(3);
    });
  });
});
