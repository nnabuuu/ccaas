import type { EntityContext, ApplyRequest, EditOperation, EditResult } from './interfaces.js';
import type { EntityRegistry } from './entity-registry.js';

export class ContextRouter {
  constructor(private registry: EntityRegistry) {}

  async getEntityContext(type: string, id: string, userId: string): Promise<EntityContext> {
    const provider = this.registry.getProvider(type);
    if (!provider) {
      throw new Error(`No EntityContextProvider registered for type "${type}"`);
    }
    return provider.getContext(id, userId);
  }

  /** @deprecated Use editEntity() instead */
  async apply(
    targetType: string,
    targetId: string,
    req: Omit<ApplyRequest, 'entity_id'>,
    userId: string,
  ): Promise<{ success: boolean; error?: string }> {
    const provider = this.registry.getProvider(targetType);
    if (!provider) {
      return { success: false, error: `No provider registered for type "${targetType}"` };
    }
    if (!provider.apply) {
      return { success: false, error: `Provider for type "${targetType}" does not support apply` };
    }
    return provider.apply({ entity_id: targetId, ...req }, userId);
  }

  async getDocument(type: string, id: string, userId: string): Promise<string> {
    const provider = this.registry.getProvider(type);
    if (!provider) {
      throw new Error(`No EntityContextProvider registered for type "${type}"`);
    }
    if (!provider.serialize) {
      throw new Error(`Provider for type "${type}" does not support serialize`);
    }
    return provider.serialize(id, userId);
  }

  async editEntity(
    type: string,
    id: string,
    ops: EditOperation[],
    userId: string,
  ): Promise<EditResult> {
    const provider = this.registry.getProvider(type);
    if (!provider) {
      return { success: false, error: `No provider registered for type "${type}"` };
    }
    if (!provider.edit) {
      return { success: false, error: `Provider for type "${type}" does not support edit` };
    }
    return provider.edit(id, ops, userId);
  }
}
