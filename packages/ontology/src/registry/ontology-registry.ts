/**
 * `OntologyRegistry` is the central catalog of all ObjectTypes,
 * Manifests, and Functions in a Solution's ontology. Spec §6.
 *
 * Registration is two-phase to allow out-of-order definition without
 * forcing dependency-sorted call sites:
 *
 *   1. `register*` runs LOCAL validation only (semantic non-empty,
 *      meta keys, payload exclusivity, wildcard policy). Local
 *      failures throw `RegistrationError` immediately so misshapen
 *      defs never enter the registry.
 *
 *   2. `validate()` runs FULL cross-def validation (link/slot/
 *      derivedFrom/lifecycle/precondition resolution). Run this once
 *      after all defs are registered. Throws `RegistrationError` if
 *      anything is unresolved. Idempotent and safe to call any number
 *      of times.
 *
 *   3. `seal()` is `validate()` plus a sealed flag: subsequent
 *      `register*` calls throw. Use when wiring an ontology at boot to
 *      catch accidental late mutations.
 *
 * Duplicate apiName/name within the same category is always an error
 * (no shadowing). Re-registering with the exact same reference is also
 * an error — explicit, no accidental no-ops.
 *
 * Query API (read-only): getObjectType / getManifest / getFunction /
 * getAll*; plus three convenience queries used by the picker UI and
 * agent projection layer: getPickableTypes, getTraversableLinks,
 * getManifestsForType. `getDisplayName(apiName, locale)` resolves
 * across all categories.
 *
 * `getSchemaDigest()` is a Phase 8 deliverable (distribution layer).
 * The Phase 7 stub returns a placeholder and is replaced in commit 8.
 *
 * Phase 4 additions (partial): `registerObjectSet`, `getObjectSet`,
 * `getAllObjectSets`, `getObjectSetsForType` shipped. Still deferred:
 * `registerInterface`, `registerPredicate`, `getImplementersOf`,
 * `getPredicate`. Phase 5 additions: `getPropertiesByClassification`,
 * `registerNotificationChannel`.
 *
 * @see ../../../docs/ontology/kedge-ontology-design.md (§6)
 */

import type { FunctionDef, ObjectSetDef, ObjectTypeDef } from '../schema/index.js';
import type { LinkDef } from '../schema/index.js';
import type { ManifestDef } from '../manifest/index.js';
import {
  RegistrationError,
  validateAll,
  validateFunction,
  validateObjectSetLocal,
  validateObjectTypeLocal,
  type ValidationContext,
} from '../schema/index.js';
import {
  serializeRegistry,
  computeSchemaDigest,
} from '../distribution/index.js';

export class OntologyRegistry {
  private readonly objectTypes = new Map<string, ObjectTypeDef>();
  private readonly manifests = new Map<string, ManifestDef>();
  private readonly functions = new Map<string, FunctionDef>();
  /** Phase 4 (Tier 2 — partial). Keyed by ObjectSetDef.apiName. */
  private readonly objectSets = new Map<string, ObjectSetDef>();
  private sealed = false;

  registerObjectType(t: ObjectTypeDef): void {
    this.assertNotSealed();
    if (this.objectTypes.has(t.apiName)) {
      throw new RegistrationError([
        {
          code: 'DUPLICATE_DEFINITION',
          message: `duplicate ObjectType apiName '${t.apiName}'`,
          path: `ObjectType:${t.apiName}`,
        },
      ]);
    }
    const errors = validateObjectTypeLocal(t);
    if (errors.length > 0) throw new RegistrationError(errors);
    this.objectTypes.set(t.apiName, t);
  }

  registerManifest(m: ManifestDef): void {
    this.assertNotSealed();
    if (this.manifests.has(m.name)) {
      throw new RegistrationError([
        {
          code: 'DUPLICATE_DEFINITION',
          message: `duplicate Manifest name '${m.name}'`,
          path: `Manifest:${m.name}`,
        },
      ]);
    }
    // Manifest has no useful local-only validator (every interesting
    // invariant needs cross-def context). Defer to validate().
    this.manifests.set(m.name, m);
  }

  registerFunction(f: FunctionDef): void {
    this.assertNotSealed();
    if (this.functions.has(f.apiName)) {
      throw new RegistrationError([
        {
          code: 'DUPLICATE_DEFINITION',
          message: `duplicate Function apiName '${f.apiName}'`,
          path: `Function:${f.apiName}`,
        },
      ]);
    }
    const errors = validateFunction(f);
    if (errors.length > 0) throw new RegistrationError(errors);
    this.functions.set(f.apiName, f);
  }

  /**
   * Register an `ObjectSetDef`. Phase 4 (Tier 2 — partial).
   *
   * Local validation runs eagerly: semantic non-empty + duplicate
   * detection. Filter path resolution against the target
   * `ObjectType`'s Zod schema is cross-def and runs in
   * `validate()`/`seal()`.
   */
  registerObjectSet(s: ObjectSetDef): void {
    this.assertNotSealed();
    if (this.objectSets.has(s.apiName)) {
      throw new RegistrationError([
        {
          code: 'DUPLICATE_DEFINITION',
          message: `duplicate ObjectSet apiName '${s.apiName}'`,
          path: `ObjectSet:${s.apiName}`,
        },
      ]);
    }
    const errors = validateObjectSetLocal(s);
    if (errors.length > 0) throw new RegistrationError(errors);
    this.objectSets.set(s.apiName, s);
  }

  /**
   * Run full cross-def validation. Throws `RegistrationError` if any
   * invariants are violated. Idempotent.
   */
  validate(): void {
    const errors = validateAll(this.context());
    if (errors.length > 0) throw new RegistrationError(errors);
  }

  /**
   * `validate()` + flip the sealed flag. After sealing, subsequent
   * `register*` calls throw to catch accidental late mutations.
   */
  seal(): void {
    this.validate();
    this.sealed = true;
  }

  isSealed(): boolean {
    return this.sealed;
  }

  // ────────────────────────────────────────────────────────────────
  // Read API
  // ────────────────────────────────────────────────────────────────

  getObjectType(apiName: string): ObjectTypeDef | undefined {
    return this.objectTypes.get(apiName);
  }
  getManifest(name: string): ManifestDef | undefined {
    return this.manifests.get(name);
  }
  getFunction(apiName: string): FunctionDef | undefined {
    return this.functions.get(apiName);
  }

  getAllObjectTypes(): readonly ObjectTypeDef[] {
    return Array.from(this.objectTypes.values());
  }
  getAllManifests(): readonly ManifestDef[] {
    return Array.from(this.manifests.values());
  }
  getAllFunctions(): readonly FunctionDef[] {
    return Array.from(this.functions.values());
  }
  /** Phase 4 (Tier 2 — partial). */
  getObjectSet(apiName: string): ObjectSetDef | undefined {
    return this.objectSets.get(apiName);
  }
  /** Phase 4 (Tier 2 — partial). */
  getAllObjectSets(): readonly ObjectSetDef[] {
    return Array.from(this.objectSets.values());
  }
  /**
   * Phase 4 (Tier 2 — partial). All registered ObjectSetDefs whose
   * `objectType` matches the given ObjectType apiName. Used by tooling
   * that asks "what curated subsets exist for Student?".
   *
   * Iterates the internal Map directly (matching the
   * `getManifestsForType` convention) — avoids the intermediate
   * `getAllObjectSets()` array allocation on every call.
   */
  getObjectSetsForType(objectTypeApiName: string): readonly ObjectSetDef[] {
    const out: ObjectSetDef[] = [];
    for (const s of this.objectSets.values()) {
      if (s.objectType === objectTypeApiName) out.push(s);
    }
    return out;
  }

  /**
   * Cross-def lookup surface for validators / other tooling. Exposed
   * so distribution / projection layers can run their own walks
   * without coupling to the internal Maps.
   */
  context(): ValidationContext {
    return {
      objectTypes: this.objectTypes,
      manifests: this.manifests,
      functions: this.functions,
      objectSets: this.objectSets,
    };
  }

  // ────────────────────────────────────────────────────────────────
  // Convenience queries
  // ────────────────────────────────────────────────────────────────

  /** ObjectTypes that have declared a `picker` config (UI-pickable). */
  getPickableTypes(): readonly ObjectTypeDef[] {
    return this.getAllObjectTypes().filter((t) => t.picker !== undefined);
  }

  /**
   * Links on the named type marked traversable. A link is traversable
   * when its `traversable` flag is not explicitly `false` — default is
   * true to match the picker's "drill into the relationship"
   * affordance for most relationships.
   */
  getTraversableLinks(apiName: string): readonly LinkDef[] {
    const t = this.objectTypes.get(apiName);
    if (!t) return [];
    return t.links.filter((l) => l.traversable !== false);
  }

  /**
   * All Manifests with at least one SlotDef targeting the named
   * ObjectType (objectType kind). Used by the picker UI when offering
   * "which contexts can this object appear in?".
   */
  getManifestsForType(apiName: string): readonly ManifestDef[] {
    const out: ManifestDef[] = [];
    for (const m of this.manifests.values()) {
      for (const slot of m.slots) {
        if (slot.target.kind === 'objectType' && slot.target.apiName === apiName) {
          out.push(m);
          break;
        }
      }
    }
    return out;
  }

  /**
   * Localized display name for any def by apiName/name. Resolution
   * order: ObjectType, then Manifest, then Function. Falls back to
   * the apiName itself if no def found OR if the locale key is absent
   * AND no default key matches.
   */
  getDisplayName(apiName: string, locale: string = 'en'): string {
    const display =
      this.objectTypes.get(apiName)?.displayName ??
      this.manifests.get(apiName)?.displayName ??
      this.functions.get(apiName)?.displayName;
    if (display === undefined) return apiName;
    if (typeof display === 'string') return display;
    // LocalizedString = string | { [locale]: string }
    return display[locale] ?? display.en ?? Object.values(display)[0] ?? apiName;
  }

  /**
   * SHA-256 digest of the canonical serialization. Stable identifier
   * for "this exact ontology shape" — two registries with the same
   * defs in different registration order return the same digest.
   * Implementation: `computeSchemaDigest(serializeRegistry(this.context()))`.
   */
  getSchemaDigest(): string {
    return computeSchemaDigest(serializeRegistry(this.context()));
  }

  // ────────────────────────────────────────────────────────────────
  // Internals
  // ────────────────────────────────────────────────────────────────

  private assertNotSealed(): void {
    if (this.sealed) {
      throw new Error(
        'OntologyRegistry is sealed; no further registrations allowed',
      );
    }
  }
}
