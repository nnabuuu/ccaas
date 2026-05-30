/**
 * Project a manifest to a Markdown system-prompt block.
 *
 * Renders the role's visible surface (slots, state, actions, streams)
 * as a structured Markdown document. The output is intended to be
 * inlined into a system prompt so the agent has a single canonical
 * place to learn "what is this context, and what can I do here."
 *
 * Visibility rules:
 *   - Slots / state fields: only listed if the role can READ them per
 *     AccessBoundary.readable / .writable.
 *   - Actions: only listed if the role can structurally invoke them
 *     (boundary + allowedRoles gates; preconditions ignored — runtime
 *     state isn't available at projection time).
 *   - Streams: only listed if the role's AccessBoundary.subscribes
 *     covers them.
 *
 * Spec §11 has the canonical golden-output structure this matches.
 */

import type { ManifestDef, SlotDef } from '../../manifest/index.js';
import type { OntologyRegistry } from '../../registry/index.js';
import type { BoundaryRole } from '../../types.js';
import { checkBoundary } from '../../accessor/index.js';

export function projectAsSystemPrompt(
  manifest: ManifestDef,
  registry: OntologyRegistry,
  role: BoundaryRole,
): string {
  const lines: string[] = [];

  lines.push(`# ${displayName(manifest.displayName)} (${manifest.name})`);
  lines.push('');
  lines.push(manifest.semantic);
  lines.push('');

  // ── Slots ──
  const visibleSlots = manifest.slots.filter((s) => allowed('read', s.apiName));
  if (visibleSlots.length > 0) {
    lines.push('## Slots');
    for (const s of visibleSlots) {
      const targetDesc = describeSlotTarget(s);
      const cardinality = s.collection ? '[]' : '';
      lines.push(`- **${s.apiName}** (${targetDesc}${cardinality}): ${s.semantic}`);
    }
    lines.push('');
  }

  // ── State ──
  const visibleState = manifest.state.filter((f) => allowed('read', f.apiName));
  if (visibleState.length > 0) {
    lines.push('## State');
    for (const f of visibleState) {
      const writable = allowed('write', f.apiName) ? ' (writable)' : '';
      lines.push(`- **${f.apiName}**${writable}: ${f.semantic}`);
    }
    lines.push('');
  }

  // ── Actions ──
  const visibleActions: { name: string; semantic: string; paramFieldHints: string[] }[] = [];
  for (const slot of manifest.slots) {
    if (slot.target.kind !== 'objectType') continue;
    const ot = registry.getObjectType(slot.target.apiName);
    if (!ot) continue;
    for (const action of ot.actions) {
      const decision = checkBoundary({
        manifest,
        role,
        op: { kind: 'action', actionApiName: action.apiName, actionDef: action },
      });
      // Same visibility relaxation as the tool-format projections.
      if (!decision.allowed && decision.unmetPreconditions === undefined) {
        continue;
      }
      visibleActions.push({
        name: action.apiName,
        semantic: action.semantic,
        paramFieldHints: describeParams(action.params.shape),
      });
    }
  }
  if (visibleActions.length > 0) {
    lines.push('## What you can do');
    for (const a of visibleActions) {
      const sig = a.paramFieldHints.length > 0 ? `(${a.paramFieldHints.join(', ')})` : '()';
      lines.push(`- **${a.name}**${sig}: ${a.semantic}`);
    }
    lines.push('');
  }

  // ── Streams ──
  const visibleStreams = (manifest.streams ?? []).filter((s) =>
    checkBoundary({
      manifest,
      role,
      op: { kind: 'subscribe', streamApiName: s.apiName },
    }).allowed,
  );
  if (visibleStreams.length > 0) {
    lines.push('## What you can subscribe to');
    for (const s of visibleStreams) {
      lines.push(`- **${s.apiName}**: ${s.semantic}`);
    }
    lines.push('');
  }

  // ── Functions (computed values) ──
  const visibleFunctions = registry
    .getAllFunctions()
    .filter((f) => f.allowedRoles.length === 0 || f.allowedRoles.includes(role));
  if (visibleFunctions.length > 0) {
    lines.push('## What you can compute');
    for (const f of visibleFunctions) {
      const sig = describeParams(f.params.shape);
      lines.push(`- **${f.apiName}**(${sig.join(', ')}): ${f.semantic}`);
    }
    lines.push('');
  }

  return lines.join('\n').trimEnd();

  function allowed(kind: 'read' | 'write', path: string): boolean {
    return checkBoundary({ manifest, role, op: { kind, path } }).allowed;
  }
}

function displayName(d: unknown): string {
  if (typeof d === 'string') return d;
  if (d && typeof d === 'object') {
    const obj = d as Record<string, string>;
    return obj.en ?? Object.values(obj)[0] ?? '';
  }
  return '';
}

function describeSlotTarget(slot: SlotDef): string {
  switch (slot.target.kind) {
    case 'objectType':
      return slot.target.apiName;
    case 'manifest':
      return `Manifest:${slot.target.name}`;
    case 'objectSet':
      return `ObjectSet:${slot.target.name}`;
  }
}

function describeParams(shape: Record<string, unknown>): string[] {
  return Object.keys(shape);
}
