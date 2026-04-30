import { validateAnswerKey } from './answer-key.schema';

describe('validateAnswerKey', () => {
  it('rejects null/undefined', () => {
    expect(validateAnswerKey(null).valid).toBe(false);
    expect(validateAnswerKey(undefined).valid).toBe(false);
  });

  it('rejects missing type', () => {
    const r = validateAnswerKey({ answers: [] });
    expect(r.valid).toBe(false);
  });

  it('rejects unknown type', () => {
    const r = validateAnswerKey({ type: 'bogus' });
    expect(r.valid).toBe(false);
  });

  // ── Quiz ──
  describe('quiz', () => {
    const validQuiz = {
      type: 'quiz',
      answers: [
        { questionIdx: 0, correct: 1, questionText: 'Q1?', options: ['A', 'B', 'C'] },
        { questionIdx: 1, correct: 0, questionText: 'Q2?', options: ['X', 'Y'] },
      ],
    };

    it('passes valid quiz', () => {
      expect(validateAnswerKey(validQuiz).valid).toBe(true);
    });

    it('rejects empty answers', () => {
      expect(validateAnswerKey({ type: 'quiz', answers: [] }).valid).toBe(false);
    });

    it('rejects missing questionText', () => {
      const ak = { type: 'quiz', answers: [{ questionIdx: 0, correct: 0, options: ['A', 'B'] }] };
      const r = validateAnswerKey(ak);
      expect(r.valid).toBe(false);
    });

    it('rejects correct >= options.length', () => {
      const ak = { type: 'quiz', answers: [{ questionIdx: 0, correct: 3, questionText: 'Q?', options: ['A', 'B', 'C'] }] };
      const r = validateAnswerKey(ak);
      expect(r.valid).toBe(false);
    });

    it('rejects < 2 options', () => {
      const ak = { type: 'quiz', answers: [{ questionIdx: 0, correct: 0, questionText: 'Q?', options: ['A'] }] };
      expect(validateAnswerKey(ak).valid).toBe(false);
    });
  });

  // ── Match ──
  describe('match', () => {
    const validMatch = {
      type: 'match',
      options: ['opt1', 'opt2', 'opt3'],
      answers: [
        { pairIdx: 0, left: 'left1', correct: 'opt1' },
        { pairIdx: 1, left: 'left2', correct: 'opt2' },
      ],
    };

    it('passes valid match', () => {
      expect(validateAnswerKey(validMatch).valid).toBe(true);
    });

    it('rejects missing left', () => {
      const ak = { type: 'match', options: ['a', 'b'], answers: [{ pairIdx: 0, correct: 'a' }] };
      expect(validateAnswerKey(ak).valid).toBe(false);
    });

    it('rejects missing correct', () => {
      const ak = { type: 'match', options: ['a', 'b'], answers: [{ pairIdx: 0, left: 'L' }] };
      expect(validateAnswerKey(ak).valid).toBe(false);
    });
  });

  // ── Matrix ──
  describe('matrix', () => {
    const validMatrix = {
      type: 'matrix',
      answers: [
        { rowIdx: 0, place: 'Egypt', practice: 'painting', reason: 'beauty', isDemo: true },
        { rowIdx: 1, place: 'Europe', practice: 'pale skin', reason: 'wealth' },
      ],
    };

    it('passes valid matrix', () => {
      expect(validateAnswerKey(validMatrix).valid).toBe(true);
    });

    it('rejects non-demo row without practice', () => {
      const ak = { type: 'matrix', answers: [{ rowIdx: 0, place: 'X', reason: 'Y' }] };
      expect(validateAnswerKey(ak).valid).toBe(false);
    });

    it('allows demo row without practice', () => {
      const ak = { type: 'matrix', answers: [{ rowIdx: 0, place: 'X', isDemo: true }] };
      expect(validateAnswerKey(ak).valid).toBe(true);
    });
  });

  // ── Stance ──
  describe('stance', () => {
    const validStance = {
      type: 'stance',
      validPositions: ['I agree', 'I disagree'],
      minEvidence: 2,
      stanceOpts: ['I agree', 'I partly agree', 'I disagree'],
      evidence: ['fact1', 'fact2'],
    };

    it('passes valid stance', () => {
      expect(validateAnswerKey(validStance).valid).toBe(true);
    });

    it('rejects minEvidence < 1', () => {
      const ak = { ...validStance, minEvidence: 0 };
      expect(validateAnswerKey(ak).valid).toBe(false);
    });

    it('rejects < 2 stanceOpts', () => {
      const ak = { ...validStance, stanceOpts: ['only one'] };
      expect(validateAnswerKey(ak).valid).toBe(false);
    });
  });

  // ── Order ──
  describe('order', () => {
    const validOrder = {
      type: 'order',
      items: ['A', 'B', 'C', 'D'],
      correctOrder: [1, 3, 0, 2],
    };

    it('passes valid order', () => {
      expect(validateAnswerKey(validOrder).valid).toBe(true);
    });

    it('rejects mismatched lengths', () => {
      const ak = { type: 'order', items: ['A', 'B'], correctOrder: [1, 0, 2] };
      expect(validateAnswerKey(ak).valid).toBe(false);
    });

    it('rejects correctOrder value >= items.length', () => {
      const ak = { type: 'order', items: ['A', 'B'], correctOrder: [0, 5] };
      expect(validateAnswerKey(ak).valid).toBe(false);
    });
  });

  // ── Select-Evidence ──
  describe('select-evidence', () => {
    const validSE = {
      type: 'select-evidence',
      functionOptions: ['Phenomenon', 'History', 'Culture', 'Conclusion'],
      sections: [
        { id: 'p12', label: '¶1-2', range: [1, 2], correctFunction: 'Phenomenon' },
        { id: 'p34', label: '¶3-4', range: [3, 4], correctFunction: 'History' },
      ],
      paragraphTokens: {
        '1': [{ t: 'text' }],
        '2': [{ t: 'text' }],
        '3': [{ t: 'text' }],
        '4': [{ t: 'text' }],
      },
    };

    it('passes valid select-evidence', () => {
      expect(validateAnswerKey(validSE).valid).toBe(true);
    });

    it('rejects correctFunction not in functionOptions', () => {
      const ak = {
        ...validSE,
        sections: [{ id: 's1', label: 'L', range: [1], correctFunction: 'NotAnOption' }],
      };
      const r = validateAnswerKey(ak);
      expect(r.valid).toBe(false);
    });

    it('rejects missing paragraphTokens for range', () => {
      const ak = {
        ...validSE,
        sections: [{ id: 's1', label: 'L', range: [99], correctFunction: 'Phenomenon' }],
      };
      const r = validateAnswerKey(ak);
      expect(r.valid).toBe(false);
    });

    it('passes without paragraphTokens (optional cross-check)', () => {
      const ak = { ...validSE, paragraphTokens: undefined };
      expect(validateAnswerKey(ak).valid).toBe(true);
    });
  });

  // ── Real manifest data (ideal-beauty-reading) ──
  describe('ideal-beauty-reading manifest answerKeys', () => {
    it('validates quiz answerKey (step 1)', () => {
      const ak = {
        type: 'quiz',
        answers: [
          { questionIdx: 0, correct: 1, questionText: 'What did Happiness Edem do?', options: ['A', 'B', 'C', 'D'] },
          { questionIdx: 1, correct: 2, questionText: 'What beauty does media promote?', options: ['A', 'B', 'C', 'D'] },
          { questionIdx: 2, correct: 1, questionText: 'Writer\'s main question?', options: ['A', 'B', 'C', 'D'] },
        ],
      };
      expect(validateAnswerKey(ak).valid).toBe(true);
    });

    it('validates matrix answerKey (step 5)', () => {
      const ak = {
        type: 'matrix',
        answers: [
          { rowIdx: 0, place: 'Ancient Egypt', practice: 'slim dark-haired', reason: 'beauty ideal', isDemo: true },
          { rowIdx: 1, place: '1600s Europe', practice: 'plump', reason: 'wealth' },
          { rowIdx: 2, place: 'Borneo', practice: 'tattoos', reason: 'diary' },
          { rowIdx: 3, place: 'NZ Maori', practice: 'tattoos', reason: 'position' },
          { rowIdx: 4, place: 'Myanmar', practice: 'neck rings', reason: 'beauty' },
          { rowIdx: 5, place: 'Indonesia', practice: 'teeth', reason: 'identity' },
        ],
      };
      expect(validateAnswerKey(ak).valid).toBe(true);
    });

    it('validates stance answerKey (step 7)', () => {
      const ak = {
        type: 'stance',
        validPositions: ['I agree', 'I partly agree', 'I disagree'],
        minEvidence: 2,
        stanceQ: 'Do you agree?',
        stanceOpts: ['I agree', 'I partly agree', 'I disagree'],
        evidence: ['fact1', 'fact2', 'fact3'],
      };
      expect(validateAnswerKey(ak).valid).toBe(true);
    });

    it('validates order answerKey (step 9)', () => {
      const ak = {
        type: 'order',
        items: ['Scanning', 'Predicting', 'Evaluating', 'Skimming'],
        correctOrder: [1, 3, 0, 2],
      };
      expect(validateAnswerKey(ak).valid).toBe(true);
    });
  });
});
