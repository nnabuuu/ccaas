/**
 * `ManifestAccessor` is the runtime-facing view of a single live
 * manifest instance. Spec §5.1.
 *
 * Phase 1 ships only the INTERFACE. No implementation lives in this
 * package — implementations belong to whichever runtime layer owns
 * persistence (Phase 3 ships a NestJS-bound implementation in the
 * backend). The interface here is the contract those implementations
 * must satisfy.
 *
 * Why a thin interface vs an abstract class: implementations differ
 * substantially across runtimes (in-memory test stub vs NestJS+TypeORM
 * vs a future stateless edge variant). The shared surface is the seven
 * methods below; everything else is implementation-private.
 *
 * @see ../../../docs/ontology/kedge-ontology-design.md (§5.1)
 */

import type { z } from 'zod';
import type { LocalizedString, ActionPrecondition } from '../schema/index.js';
import type { ManifestDef } from '../manifest/index.js';
import type { BoundaryRole } from '../types.js';
import type { ActionResult } from './action-result.js';

/**
 * Per-action summary returned by `listActions()`. Pre-computed
 * `allowed` (against the accessor's bound role + current state) lets
 * UIs render an enable/disable state without invoking the action.
 */
export interface ActionDescriptor {
  readonly apiName: string;
  readonly displayName: LocalizedString;
  readonly semantic: string;
  readonly paramsSchema: z.ZodObject<z.ZodRawShape>;
  /** Whether the bound role can currently invoke (boundary + preconditions). */
  readonly allowed: boolean;
  /** When `allowed === false`, why. */
  readonly unmetPreconditions?: readonly ActionPrecondition[];
}

export interface ManifestAccessor {
  readonly manifest: ManifestDef;
  readonly role: BoundaryRole;

  /** Read a state field's current value. Throws if path not in role's readable. */
  getState<T = unknown>(apiName: string): T;
  /** Write a state field. Throws if path not in role's writable. */
  setState<T = unknown>(apiName: string, value: T): void;

  /** Read a slot's bound value(s). `null` for unbound singletons; `[]` for unbound collections. */
  getSlot<T = unknown>(apiName: string): T | readonly T[] | null;

  /** All actions visible to this accessor's role, with current `allowed` state. */
  listActions(): readonly ActionDescriptor[];
  /** Invoke an action by apiName. Always resolves (never throws); errors surface in `ActionResult.ok=false`. */
  invokeAction(
    apiName: string,
    params: Record<string, unknown>,
  ): Promise<ActionResult>;

  /** Subscribe to a stream. Returns an unsubscribe handle. Throws if stream not in subscribes. */
  subscribe(
    streamApiName: string,
    handler: (event: unknown) => void,
  ): () => void;
}
