/**
 * `WorkflowRegistry` — indexed in-memory store of registered
 * `TriggerDef`s, keyed for O(1) lookup on the engine's hot path.
 *
 * Internally: a flat `Map<apiName, TriggerDef>` for "do I have a
 * trigger with this name?" + a `Map<indexKey, TriggerDef[]>` for
 * "what triggers watch this (manifest, kind, watchKey)?".
 *
 * The duplicate-apiName policy matches `OntologyRegistry`'s style —
 * registering an apiName twice throws immediately, no shadowing.
 *
 * Test helper `reset()` lives only because spec-level isolation
 * across many `Test.createTestingModule` builds wants it.
 */

import { Injectable } from '@nestjs/common';
import {
  triggerIndexKey,
  type TriggerDef,
  type TriggerWatchKey,
} from './types';

@Injectable()
export class WorkflowRegistry {
  private readonly byName = new Map<string, TriggerDef>();
  private readonly byWatch = new Map<string, TriggerDef[]>();

  register(def: TriggerDef): void {
    if (this.byName.has(def.apiName)) {
      throw new Error(
        `WorkflowRegistry: trigger apiName '${def.apiName}' is already registered`,
      );
    }
    this.byName.set(def.apiName, def);
    const key = triggerIndexKey(def.manifest, watchKeyOf(def));
    const list = this.byWatch.get(key) ?? [];
    list.push(def);
    // Sort by priority then registration order. We sort on insert
    // because lookup is hot path; registration is boot-time.
    list.sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
    this.byWatch.set(key, list);
  }

  getByName(apiName: string): TriggerDef | undefined {
    return this.byName.get(apiName);
  }

  /**
   * Look up every trigger that watches `(manifest, watchKey)`.
   * Returns an empty array if none — caller is the engine's dispatch
   * loop, which is OK with no-op fan-out.
   */
  lookup(manifest: string, watch: TriggerWatchKey): readonly TriggerDef[] {
    return this.byWatch.get(triggerIndexKey(manifest, watch)) ?? [];
  }

  /** All registered triggers — used for boot-time wiring (subscribe per-stream). */
  all(): readonly TriggerDef[] {
    return Array.from(this.byName.values());
  }

  /** Test helper. */
  reset(): void {
    this.byName.clear();
    this.byWatch.clear();
  }
}

function watchKeyOf(def: TriggerDef): TriggerWatchKey {
  switch (def.kind) {
    case 'event':
      return { kind: 'event', stream: def.watch.stream };
    case 'state-change':
      return { kind: 'state-change', state: def.watch.state };
    case 'object-set-change':
      return { kind: 'object-set-change', objectSet: def.watch.objectSet };
  }
}
