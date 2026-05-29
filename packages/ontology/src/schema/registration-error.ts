/**
 * Aggregate registration-time error. Spec §9.7.
 *
 * Surfaced when a definition (or set of definitions) fails one or more
 * invariants. Carries the full `ValidationError[]` so callers can
 * inspect per-rule failures without parsing the message string.
 *
 * Thrown by `OntologyRegistry.register*` methods (commit 7) and by
 * `validateAll` (this module) when consumers run validation explicitly.
 */

import type { ValidationError } from './validators.js';

export class RegistrationError extends Error {
  constructor(public readonly errors: readonly ValidationError[]) {
    const lines = errors.map(
      (e) => `  [${e.code}] ${e.path}: ${e.message}`,
    );
    super(
      `Ontology registration failed with ${errors.length} error(s):\n${lines.join('\n')}`,
    );
    this.name = 'RegistrationError';
  }
}
