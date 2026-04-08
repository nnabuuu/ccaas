import { Injectable } from '@nestjs/common';
import type { OrmAdapter } from '@kedge-agentic/context-layer';

@Injectable()
export class MockOrmAdapter implements OrmAdapter {
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
