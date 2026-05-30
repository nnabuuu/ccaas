/**
 * Stub `OrmAdapter` for context-layer integration tests.
 *
 * Returns a configurable static relations table — no TypeORM, no
 * metadata reflection. The mapping is `entityClass identity → relations`,
 * so tests can register fake "entity classes" (any non-null object will
 * do) and assert that `RelationInferrer` picks them up.
 */

import type { OrmAdapter } from '../../../core/interfaces.js';

export interface StubRelation {
  readonly propertyName: string;
  readonly relationType: 'one-to-many' | 'many-to-one' | 'many-to-many';
  readonly targetEntity: unknown;
  readonly foreignKey?: string;
}

export class StubOrmAdapter implements OrmAdapter {
  private readonly relations = new Map<unknown, StubRelation[]>();
  private readonly controllerToEntity = new Map<string, unknown>();

  setRelations(entityClass: unknown, relations: StubRelation[]): void {
    this.relations.set(entityClass, relations);
  }

  // Unused by ContextLayerInitService today; implemented to satisfy
  // the OrmAdapter interface shape so tests can swap this fixture in
  // for the real adapter without per-method TODO casts.
  setEntityClassForController(controllerPath: string, entityClass: unknown): void {
    this.controllerToEntity.set(controllerPath, entityClass);
  }

  getEntityRelations(entityClass: unknown): StubRelation[] {
    return this.relations.get(entityClass) ?? [];
  }

  getEntityClass(controllerPath: string): unknown | null {
    return this.controllerToEntity.get(controllerPath) ?? null;
  }
}
