import type { OrmAdapter } from '@kedge-agentic/context-layer/core';

/**
 * Minimal OrmAdapter for edu-platform.
 * Relation inference is not needed since we register providers manually.
 */
export class EduOrmAdapter implements OrmAdapter {
  getEntityRelations(): Array<{
    propertyName: string;
    relationType: 'one-to-many' | 'many-to-one' | 'many-to-many';
    targetEntity: unknown;
    foreignKey?: string;
  }> {
    return [];
  }

  getEntityClass(): unknown | null {
    return null;
  }
}
