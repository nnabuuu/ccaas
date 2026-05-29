/**
 * `@kedge-agentic/ontology/distribution` subpath — Phase 1 (core).
 *
 * Canonical serialization + content-addressed digest. Use these to
 * compute stable IDs for an ontology version, ship schema definitions
 * over the wire, or feed diff tooling.
 */

export {
  serializeRegistry,
  canonicalize,
  type SerializedOntology,
  type SerializedObjectType,
  type SerializedLink,
  type SerializedAction,
  type SerializedFunction,
  type SerializedManifest,
} from './serialize.js';
export { computeSchemaDigest } from './digest.js';
