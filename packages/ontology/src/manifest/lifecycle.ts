/**
 * `LifecycleDef` declares hooks for manifest lifecycle events. Each
 * field references an `ActionDef.apiName` (not a function); the
 * runtime invokes those actions via the same `executeAction` path
 * that handles agent-initiated calls. So hooks inherit governance,
 * audit, and approval gates for free.
 *
 * @see ../../docs/ontology/kedge-ontology-design.md (§4.5)
 */

export interface LifecycleDef {
  /** `ActionDef.apiName` fired when a manifest instance is created / started. */
  readonly onActivate?: string;
  /** Fired when a manifest instance ends. */
  readonly onDeactivate?: string;
  /** Fired when a slot binding changes. */
  readonly onSlotChange?: string;
  /** Fired when manifest state transitions. */
  readonly onStateChange?: string;
}
