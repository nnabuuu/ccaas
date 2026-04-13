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

export class EntityRegistry {
  private entities = new Map<string, RegisteredEntity>();
  private relations: RelationInfo[] = [];
  private roots: string[] = [];
  private parentCache = new Map<string, Map<string, { parentType: string; parentId: string; displayName: string }>>();
  private providers = new Map<string, EntityContextProvider>();

  register(options: ReferenceableOptions, controllerPath?: string, entityClass?: unknown): void {
    this.entities.set(options.type, { options, controllerPath, entityClass });
  }

  setRelations(relations: RelationInfo[]): void {
    this.relations = relations;
    this.computeRoots();
  }

  private computeRoots(): void {
    const childTypes = new Set(this.relations.map(r => r.child));
    this.roots = Array.from(this.entities.keys()).filter(type => !childTypes.has(type));
  }

  getEntityTypes(): EntityTypesResponse {
    const types: EntityTypeInfo[] = Array.from(this.entities.values()).map(e => ({
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
    return this.entities.get(type);
  }

  getAllEntities(): Map<string, RegisteredEntity> {
    return this.entities;
  }

  hasChildren(entityType: string): boolean {
    return this.relations.some(r => r.parent === entityType);
  }

  getChildRelations(parentType: string): RelationInfo[] {
    return this.relations.filter(r => r.parent === parentType);
  }

  getParentRelation(childType: string): RelationInfo | undefined {
    return this.relations.find(r => r.child === childType);
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

      const parentEntity = this.entities.get(parent.parentType);
      if (!parentEntity) break;

      crumbs.unshift({
        type: parent.parentType,
        id: parent.parentId,
        displayName: parent.displayName,
        icon: parentEntity.options.icon,
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

  private isSearchable(options: ReferenceableOptions): boolean {
    if (options.abilities?.search === false) return false;
    if (options.abilities?.search === true || typeof options.abilities?.search === 'object') return true;
    return true; // default searchable
  }

  private isBrowsable(options: ReferenceableOptions): boolean {
    if (options.abilities?.browse === false) return false;
    return true; // default browsable
  }
}
