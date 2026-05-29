/**
 * `createSingleSlotManifestAccessor` — bridges an
 * `EntityContextProvider` (context-layer's per-entity data interface)
 * into a `ManifestAccessor` (ontology's runtime context interface)
 * for the simplest topology: a manifest with exactly one slot,
 * bound to one specific entity.
 *
 * **Opt-in.** Existing context-layer call sites are unchanged. This
 * adapter exists so future consumers (recipe-book's planned
 * schema-driven `@Picker`, the ontology-projection layer) can speak
 * the `ManifestAccessor` API against today's `EntityContextProvider`
 * implementations without forcing a rewrite.
 *
 * Scope of the bridge:
 *   - `getSlot(apiName)` returns the resolved entity's `structured`
 *     data when `apiName` matches the manifest's single slot
 *   - `getState` / `setState` throw — Phase 2 has no state model
 *   - `listActions()` returns `[]` — Phase 2 manifests in this shape
 *     carry no actions
 *   - `invokeAction(...)` returns `{ ok: false, errorCode:
 *     'internal_error' }` for the same reason
 *   - `subscribe()` throws — no stream model in this shape
 *
 * Async factory: `EntityContextProvider.getContext` is async but
 * `ManifestAccessor.getSlot` is synchronous, so we resolve the slot
 * value at construction time. Callers `await` the factory and then
 * use the returned accessor synchronously.
 */

import type {
  ActionResult,
  BoundaryRole,
  ManifestAccessor,
  ManifestDef,
  ActionDescriptor,
} from '@kedge-agentic/ontology';
import type {
  EntityContext,
  EntityContextProvider,
} from './interfaces.js';

export interface SingleSlotManifestAccessorArgs {
  readonly manifest: ManifestDef;
  readonly role: BoundaryRole;
  readonly entityId: string;
  readonly userId: string;
  readonly provider: EntityContextProvider;
}

/**
 * Create a `ManifestAccessor` that exposes the entity loaded via
 * `provider.getContext(entityId, userId)` through the manifest's
 * single slot.
 *
 * Throws if `manifest.slots.length !== 1` — this adapter is for the
 * single-slot topology only. Multi-slot manifests need a real
 * implementation that holds runtime state, which lands in Phase 3.
 */
export async function createSingleSlotManifestAccessor(
  args: SingleSlotManifestAccessorArgs,
): Promise<ManifestAccessor> {
  const { manifest, role, entityId, userId, provider } = args;
  if (manifest.slots.length !== 1) {
    throw new Error(
      `createSingleSlotManifestAccessor requires a manifest with exactly 1 slot; manifest '${manifest.name}' has ${manifest.slots.length}.`,
    );
  }
  const slot = manifest.slots[0];

  // Resolve eagerly so the synchronous getSlot can answer without
  // mutating state on first call.
  const context: EntityContext = await provider.getContext(entityId, userId);

  return {
    manifest,
    role,

    getState<T = unknown>(_apiName: string): T {
      throw new Error(
        `getState is not supported by the single-slot EntityContextProvider adapter; the underlying provider has no state model.`,
      );
    },

    setState<T = unknown>(_apiName: string, _value: T): void {
      throw new Error(
        `setState is not supported by the single-slot EntityContextProvider adapter; the underlying provider has no state model.`,
      );
    },

    getSlot<T = unknown>(apiName: string): T | readonly T[] | null {
      if (apiName !== slot.apiName) return null;
      // NOTE: snapshot taken at createSingleSlotManifestAccessor()
      // time — recreate the accessor if the entity may have changed
      // since construction. No re-fetch happens here; that would
      // require the (currently sync) ManifestAccessor.getSlot to
      // become async.
      //
      // The `readonly T[]` branch of the return type is unused by
      // this adapter — single-slot accessors always resolve a scalar.
      // The branch exists because the ManifestAccessor interface
      // accepts collection slots in the general case.
      //
      // The single slot holds the entity's structured data. Caller
      // gets the same Record<string, any> shape
      // EntityContext.structured already used.
      return context.structured as unknown as T;
    },

    listActions(): readonly ActionDescriptor[] {
      // Phase 2 single-slot manifests carry no actions — callers can
      // observe the lack and decide whether to fall back to the
      // EntityContextProvider.edit() pathway for mutations.
      return [];
    },

    async invokeAction(
      apiName: string,
      _params: Record<string, unknown>,
    ): Promise<ActionResult> {
      return {
        ok: false,
        errorCode: 'internal_error',
        message: `Action '${apiName}' is not exposed by the single-slot EntityContextProvider adapter. Use the EntityContextProvider.edit() path directly for entity mutations.`,
      };
    },

    subscribe(
      streamApiName: string,
      _handler: (event: unknown) => void,
    ): () => void {
      throw new Error(
        `subscribe is not supported by the single-slot EntityContextProvider adapter; stream '${streamApiName}' has no source. Subscribe to events through the underlying transport instead.`,
      );
    },
  };
}
