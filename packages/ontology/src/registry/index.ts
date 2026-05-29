/**
 * `@kedge-agentic/ontology/registry` subpath — Phase 1 (core).
 *
 * The OntologyRegistry class: central catalog of ObjectTypes,
 * Manifests, and Functions. Two-phase registration (local validation
 * eager / cross-def validation deferred to `validate()` / `seal()`).
 *
 * Phase 4 will add: registerInterface, registerObjectSet,
 * registerPredicate, getImplementersOf, getObjectSetsForType,
 * getPredicate.
 */

export { OntologyRegistry } from './ontology-registry.js';
