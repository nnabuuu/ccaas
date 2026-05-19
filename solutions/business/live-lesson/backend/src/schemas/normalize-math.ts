/**
 * Normalize a math expression for comparison:
 * - trim + lowercase
 * - Chinese brackets → English
 * - superscript ² → ^2, ³ → ^3
 * - × → *, ÷ → /
 * - strip all whitespace
 */
export function normalizeMath(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\uff08/g, '(')
    .replace(/\uff09/g, ')')
    .replace(/\u00b2/g, '^2')
    .replace(/\u00b3/g, '^3')
    .replace(/\u00d7/g, '*')
    .replace(/\u00f7/g, '/')
    .replace(/[\u2212\u2014\u2013]/g, '-')
    .replace(/\uff1d/g, '=')
    .replace(/\s+/g, '');
}

export function matchesAny(student: string, accepts: string[]): boolean {
  const norm = normalizeMath(student);
  return accepts.some(a => normalizeMath(a) === norm);
}
