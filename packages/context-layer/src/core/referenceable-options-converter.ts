/**
 * Bidirectional converters between context-layer's
 * `ReferenceableOptions` and `@kedge-agentic/ontology`'s
 * `PickerConfig`.
 *
 * Use these when a Solution wants to:
 *   - migrate from `@Referenceable(...)` decorators to
 *     `defineObjectType({ picker })` directly (forward direction:
 *     `referenceableOptionsToPicker`)
 *   - or expose a `PickerConfig`-defined type through the
 *     legacy `ReferenceableOptions` shape (reverse direction:
 *     `pickerToReferenceableOptions`)
 *
 * Round-trip is **lossy** by design:
 *
 *   - `ReferenceableOptions` carries fields `PickerConfig` doesn't
 *     model: `contextFields`, `hideRelations`, `relationLabels`,
 *     `recommender`. Forward conversion drops them; reverse
 *     conversion does not invent them.
 *   - `PickerConfig` carries `searchFields`, `titleField`,
 *     `subtitleField`, `crossManifestSources` that
 *     `ReferenceableOptions` doesn't model. Reverse conversion
 *     drops them; forward conversion uses safe placeholders
 *     (empty `searchFields`, `titleField = 'displayName'`).
 *
 * What DOES round-trip cleanly:
 *   - `type` ↔ (the apiName the picker is attached to — passed
 *     separately on the reverse path since `PickerConfig` doesn't
 *     hold the type itself)
 *   - `displayName` (passed alongside picker on the reverse path)
 *   - `icon`
 *   - `color` (preserved as `undefined` round-tripping; the
 *     `EntityRegistry.getEntityTypes` projection separately maps
 *     `undefined → null`, but that's an output-shape concern,
 *     not a converter concern)
 *   - `abilities.search` / `abilities.browse` — derived from the
 *     "is a picker attached at all?" presence on the reverse path
 */

import type { PickerConfig } from '@kedge-agentic/ontology';
import type { ReferenceableOptions } from './interfaces.js';

/**
 * Forward: `ReferenceableOptions` to `PickerConfig`.
 *
 * Returns `undefined` when the source has no picker-able affordance
 * (both `abilities.search === false` AND `abilities.browse === false`).
 * Default behavior in `ReferenceableOptions` is "searchable + browsable";
 * the explicit-false case is the rare one.
 */
export function referenceableOptionsToPicker(
  options: ReferenceableOptions,
): PickerConfig | undefined {
  const browseable = options.abilities?.browse !== false;
  const searchable = options.abilities?.search !== false;
  if (!browseable && !searchable) return undefined;
  return {
    icon: options.icon,
    color: options.color,
    searchFields: [],
    titleField: 'displayName',
  };
}

/**
 * Reverse: `PickerConfig` (+ the type + displayName held separately)
 * back to `ReferenceableOptions`.
 *
 * The caller supplies `type` and `displayName` because `PickerConfig`
 * doesn't carry either — they live on `ObjectTypeDef` alongside it.
 * Setting `abilities = { search: true, browse: true }` mirrors the
 * forward direction's "picker attached implies pickerable" assumption.
 *
 * Fields the picker doesn't model (`contextFields`, `hideRelations`,
 * `relationLabels`, `recommender`) are not invented — the caller can
 * spread additional `ReferenceableOptions` fields after the return if
 * they have them from another source.
 */
export function pickerToReferenceableOptions(args: {
  type: string;
  displayName: string;
  picker: PickerConfig;
}): ReferenceableOptions {
  const { type, displayName, picker } = args;
  const opts: ReferenceableOptions = {
    type,
    displayName,
    icon: picker.icon,
    abilities: { search: true, browse: true },
  };
  if (picker.color !== undefined) opts.color = picker.color;
  return opts;
}
