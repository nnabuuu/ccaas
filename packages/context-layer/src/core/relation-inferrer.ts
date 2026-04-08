import type { OrmAdapter, RelationInfo, ReferenceableOptions } from './interfaces.js';
import type { EntityRegistry } from './entity-registry.js';

export class RelationInferrer {
  constructor(
    private registry: EntityRegistry,
    private ormAdapter: OrmAdapter,
  ) {}

  async scanAndRegister(): Promise<void> {
    const entities = this.registry.getAllEntities();
    const referenceableTypes = new Set(entities.keys());
    const inferred: RelationInfo[] = [];

    for (const [type, entity] of entities) {
      if (!entity.entityClass) continue;

      const relations = this.ormAdapter.getEntityRelations(entity.entityClass);

      for (const rel of relations) {
        if (rel.relationType === 'many-to-one') {
          // Find the target entity type
          const targetType = this.findTypeByEntityClass(rel.targetEntity, entities);
          if (!targetType || !referenceableTypes.has(targetType)) continue;

          // Check for hideRelations
          if (entity.options.hideRelations?.includes(targetType)) continue;

          // This entity is a child of the target
          const foreignKey = rel.foreignKey ?? `${targetType}_id`;
          const label = entity.options.relationLabels?.[targetType] ?? entity.options.displayName;

          // Avoid duplicates
          if (!inferred.some(r => r.parent === targetType && r.child === type && r.foreignKey === foreignKey)) {
            inferred.push({
              parent: targetType,
              child: type,
              label,
              foreignKey,
            });
          }
        }
      }
    }

    this.registry.setRelations(inferred);
  }

  private findTypeByEntityClass(
    entityClass: unknown,
    entities: Map<string, { options: ReferenceableOptions; entityClass?: unknown }>,
  ): string | null {
    for (const [type, entity] of entities) {
      if (entity.entityClass === entityClass) return type;
    }
    return null;
  }
}
