import type { OrmAdapter } from '@kedge-agentic/context-layer/core';

export class RecipeOrmAdapter implements OrmAdapter {
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
