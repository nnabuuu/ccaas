/**
 * SHA-256 digest over a canonical serialization.
 *
 * The digest is a stable identifier for "this exact ontology shape"
 * — two registries with the same defs in different order produce the
 * same digest. Used for cache keys, migration gating, and the
 * `OntologyRegistry.getSchemaDigest()` method.
 *
 * Note on hash dependency: uses Node's `crypto` module (BUILTIN
 * Node), not an external dep, to keep the package framework-free
 * and dependency-light. This means the package targets Node runtimes
 * only — a browser-targeted build would need a different digest
 * implementation, which would be added as a sibling
 * (`browser-digest.ts`) when that need arises.
 */

import { createHash } from 'node:crypto';
import { canonicalize, type SerializedOntology } from './serialize.js';

/**
 * Compute the SHA-256 digest of a serialized ontology. Returns a
 * lowercase hex string prefixed with `sha256:`.
 */
export function computeSchemaDigest(ontology: SerializedOntology): string {
  const canonical = canonicalize(ontology);
  const hash = createHash('sha256').update(canonical).digest('hex');
  return `sha256:${hash}`;
}
