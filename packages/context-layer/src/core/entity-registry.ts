/**
 * `EntityRegistry` — the public surface that recipe-book, live-lesson,
 * and other context-layer consumers depend on.
 *
 * Phase 2 of the ontology rollout refactored this class to internally
 * delegate to `OntologyRegistry` from `@kedge-agentic/ontology`,
 * while keeping every existing public method signature
 * source-compatible. Two pieces of state coexist:
 *
 *   1. `ontology` — the `OntologyRegistry` instance. Holds an
 *      `ObjectTypeDef` per registered type. The `displayName`, `icon`,
 *      `color`, and ability-derived `picker` config are projected
 *      through it. `getObjectTypeSchema(type)` reads the Zod schema
 *      from this layer.
 *
 *   2. `meta` — a sidecar Map keeping the bits `ObjectTypeDef` can't
 *      carry: the full original `ReferenceableOptions` (for
 *      `getEntity` round-trip), `controllerPath`, and `entityClass`
 *      (both NestJS / TypeORM concerns the framework-free ontology
 *      package can't model).
 *
 * Relations, breadcrumb cache, and provider map stay as local
 * structures — they don't have direct `ObjectTypeDef` analogues. The
 * `OntologyRegistry` `LinkDef` / `SlotDef` model is a richer
 * representation we don't yet need to bridge for parity.
 *
 * Re-registering the same `type` (allowed by the original
 * `EntityRegistry` contract — "last write wins") is handled by
 * rebuilding the underlying `OntologyRegistry` from `meta`, since
 * `OntologyRegistry` rejects duplicates by design.
 */

import { z } from 'zod';
import {
  OntologyRegistry,
  type ObjectTypeDef,
} from '@kedge-agentic/ontology';
import type {
  EntityTypeInfo,
  RegisteredEntity,
  ReferenceableOptions,
  RelationInfo,
  RelationTree,
  EntityTypesResponse,
  BreadcrumbItem,
  EntityContextProvider,
} from './interfaces.js';
import { referenceableOptionsToPicker } from './referenceable-options-converter.js';

/**
 * Hoisted placeholder schema reused on every `optionsToObjectTypeDef`
 * call.
 *
 * `z.object({}).passthrough()` returns `ZodObject<{}, "passthrough">`
 * — a narrower type than `ObjectTypeDef.schema`'s
 * `ZodObject<ZodRawShape>`. The `as unknown as` cast bridges that
 * known Zod typing quirk in one place so the rest of the file isn't
 * sprinkled with it.
 */
const PASSTHROUGH_SCHEMA: z.ZodObject<z.ZodRawShape> =
  z.object({}).passthrough() as unknown as z.ZodObject<z.ZodRawShape>;

interface MetaEntry {
  readonly options: ReferenceableOptions;
  readonly controllerPath?: string;
  readonly entityClass?: unknown;
}

export class EntityRegistry {
  private ontology = new OntologyRegistry();
  private readonly meta = new Map<string, MetaEntry>();
  private relations: RelationInfo[] = [];
  private roots: string[] = [];
  private readonly parentCache = new Map<string, Map<string, { parentType: string; parentId: string; displayName: string }>>();
  private readonly providers = new Map<string, EntityContextProvider>();

  register(options: ReferenceableOptions, controllerPath?: string, entityClass?: unknown): void {
    const isOverwrite = this.meta.has(options.type);
    this.meta.set(options.type, { options, controllerPath, entityClass });

    if (isOverwrite) {
      // OntologyRegistry rejects duplicates by design; rebuild from
      // sidecar to honor EntityRegistry's "last write wins" contract.
      this.rebuildOntologyFromMeta();
    } else {
      this.ontology.registerObjectType(this.optionsToObjectTypeDef(options));
    }
  }

  setRelations(relations: RelationInfo[]): void {
    this.relations = relations;
    this.computeRoots();
  }

  private computeRoots(): void {
    const childTypes = new Set(this.relations.map((r) => r.child));
    this.roots = Array.from(this.meta.keys()).filter((type) => !childTypes.has(type));
  }

  getEntityTypes(): EntityTypesResponse {
    const types: EntityTypeInfo[] = Array.from(this.meta.values()).map((e) => ({
      type: e.options.type,
      displayName: e.options.displayName,
      icon: e.options.icon,
      color: e.options.color ?? null,
      searchable: this.isSearchable(e.options),
      browsable: this.isBrowsable(e.options),
    }));

    return {
      types,
      tree: this.getRelationTree(),
    };
  }

  getRelationTree(): RelationTree {
    return {
      roots: [...this.roots],
      relations: [...this.relations],
    };
  }

  getEntity(type: string): RegisteredEntity | undefined {
    const entry = this.meta.get(type);
    if (!entry) return undefined;
    return {
      options: entry.options,
      controllerPath: entry.controllerPath,
      entityClass: entry.entityClass,
    };
  }

  getAllEntities(): Map<string, RegisteredEntity> {
    const out = new Map<string, RegisteredEntity>();
    for (const [type, entry] of this.meta) {
      out.set(type, {
        options: entry.options,
        controllerPath: entry.controllerPath,
        entityClass: entry.entityClass,
      });
    }
    return out;
  }

  /**
   * Read the underlying Zod schema for a registered type.
   *
   * Phase 2 addition. Returns the `ObjectTypeDef.schema` that the
   * delegated `OntologyRegistry` holds. In Phase 2 every registered
   * type carries a placeholder `z.object({}).passthrough()` because
   * `ReferenceableOptions` has no schema field; solutions can wire
   * real schemas later by switching to `defineObjectType` directly.
   *
   * Used by downstream consumers (recipe-book's future
   * schema-driven `@Picker`, ontology projection layer) to introspect
   * fields without rebuilding the type info from scratch.
   *
   * Returns `undefined` when the type was never registered.
   */
  getObjectTypeSchema(typeName: string): z.ZodObject<z.ZodRawShape> | undefined {
    return this.ontology.getObjectType(typeName)?.schema;
  }

  hasChildren(entityType: string): boolean {
    return this.relations.some((r) => r.parent === entityType);
  }

  getChildRelations(parentType: string): RelationInfo[] {
    return this.relations.filter((r) => r.parent === parentType);
  }

  getParentRelation(childType: string): RelationInfo | undefined {
    return this.relations.find((r) => r.child === childType);
  }

  // Breadcrumb parent cache management
  cacheParent(entityType: string, entityId: string, parentType: string, parentId: string, displayName: string): void {
    if (!this.parentCache.has(entityType)) {
      this.parentCache.set(entityType, new Map());
    }
    this.parentCache.get(entityType)!.set(entityId, { parentType, parentId, displayName });
  }

  getBreadcrumb(entityType: string, entityId: string): BreadcrumbItem[] | null {
    const crumbs: BreadcrumbItem[] = [];
    let currentType = entityType;
    let currentId = entityId;

    while (true) {
      const typeCache = this.parentCache.get(currentType);
      if (!typeCache) break;
      const parent = typeCache.get(currentId);
      if (!parent) break;

      const parentEntry = this.meta.get(parent.parentType);
      if (!parentEntry) break;

      crumbs.unshift({
        type: parent.parentType,
        id: parent.parentId,
        displayName: parent.displayName,
        icon: parentEntry.options.icon,
      });

      currentType = parent.parentType;
      currentId = parent.parentId;
    }

    return crumbs.length > 0 ? crumbs : null;
  }

  // ─── EntityContextProvider registration ───

  registerProvider(type: string, provider: EntityContextProvider): void {
    this.providers.set(type, provider);
  }

  getProvider(type: string): EntityContextProvider | undefined {
    return this.providers.get(type);
  }

  hasProvider(type: string): boolean {
    return this.providers.has(type);
  }

  // ─── Internals ───

  private isSearchable(options: ReferenceableOptions): boolean {
    if (options.abilities?.search === false) return false;
    if (options.abilities?.search === true || typeof options.abilities?.search === 'object') return true;
    return true; // default searchable
  }

  private isBrowsable(options: ReferenceableOptions): boolean {
    if (options.abilities?.browse === false) return false;
    return true; // default browsable
  }

  /**
   * Build a placeholder `ObjectTypeDef` from `ReferenceableOptions`.
   *
   * `ReferenceableOptions` has no Zod schema or semantic text;
   * `ObjectTypeDef` requires both. We use:
   *   - `z.object({}).passthrough()` — accepts any shape, matching
   *     the reality that entity instances have fields we haven't
   *     declared yet. Solutions can override the schema later.
   *   - A generated `semantic` string so the ontology validator's
   *     non-empty check passes.
   *   - `picker` derived from `icon`/`color`/`abilities`. Omitted
   *     when the type is neither searchable nor browsable (no picker
   *     UI affordance).
   */
  private optionsToObjectTypeDef(options: ReferenceableOptions): ObjectTypeDef {
    // Use the exported converter as the single source of truth for
    // the picker projection — no parallel private helper to drift
    // against.
    const picker = referenceableOptionsToPicker(options);
    return {
      apiName: options.type,
      displayName: options.displayName,
      semantic: `Derived from ReferenceableOptions for '${options.type}'.`,
      schema: PASSTHROUGH_SCHEMA,
      links: [],
      actions: [],
      ...(picker ? { picker } : {}),
    };
  }

  private rebuildOntologyFromMeta(): void {
    this.ontology = new OntologyRegistry();
    for (const entry of this.meta.values()) {
      this.ontology.registerObjectType(this.optionsToObjectTypeDef(entry.options));
    }
  }
}
