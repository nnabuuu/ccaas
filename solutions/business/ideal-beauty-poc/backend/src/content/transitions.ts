/**
 * 17 transitional expressions in "Ideal Beauty" + category mapping.
 * Extracted from PoC JSX (ideal-beauty-student.jsx).
 */

export const TRANS: string[] = [
  'So',
  'because',
  'but',
  'However,',
  'while',
  'also',
  'In the early 1600s,',
  'In Elizabethan England,',
  'Within different cultures around the world,',
  'like',
  'for instance,',
  'Today',
  'but the Myanmar people',
  'while it is perfectly acceptable',
  'through the ages and across different cultures,',
  'Whether',
  'over time',
];

export type TransitionCategory =
  | 'example'
  | 'contrast'
  | 'temporal'
  | 'causal'
  | 'cultural'
  | 'addition';

export const TCAT: Record<TransitionCategory, string[]> = {
  example: ['like', 'for instance,'],
  contrast: [
    'However,',
    'while',
    'but',
    'but the Myanmar people',
    'while it is perfectly acceptable',
  ],
  temporal: [
    'So',
    'In the early 1600s,',
    'In Elizabethan England,',
    'Today',
    'over time',
    'through the ages and across different cultures,',
  ],
  causal: ['because'],
  cultural: ['Within different cultures around the world,', 'Whether'],
  addition: ['also'],
};

export function categoryOf(phrase: string): TransitionCategory | 'other' {
  for (const [cat, phrases] of Object.entries(TCAT)) {
    if (phrases.includes(phrase)) return cat as TransitionCategory;
  }
  return 'other';
}
