/**
 * Tests for the `ReferenceableOptions` ↔ `PickerConfig` bidirectional
 * converters.
 *
 * Round-trip is lossy by design (the two shapes carry different
 * fields). These tests pin what DOES round-trip cleanly (type,
 * displayName, icon, color, picker presence) and what does NOT
 * (contextFields, hideRelations, relationLabels — explicitly absent
 * on the reverse direction).
 */

import { describe, expect, it } from 'vitest';
import type { PickerConfig } from '@kedge-agentic/ontology';
import {
  pickerToReferenceableOptions,
  referenceableOptionsToPicker,
} from '../referenceable-options-converter.js';
import type { ReferenceableOptions } from '../interfaces.js';

describe('referenceableOptionsToPicker', () => {
  it('projects icon and color when picker-able', () => {
    const picker = referenceableOptionsToPicker({
      type: 'recipe',
      displayName: '食谱',
      icon: '🍳',
      color: 'orange',
      abilities: { search: true, browse: true },
    });
    expect(picker).toEqual({
      icon: '🍳',
      color: 'orange',
      searchFields: [],
      titleField: 'displayName',
    });
  });

  it('returns undefined when both search AND browse are explicitly disabled', () => {
    const picker = referenceableOptionsToPicker({
      type: 'opaque',
      displayName: 'Opaque',
      icon: '⬛',
      abilities: { search: false, browse: false },
    });
    expect(picker).toBeUndefined();
  });

  it('returns a picker when only browse is disabled (search still on)', () => {
    const picker = referenceableOptionsToPicker({
      type: 'searchable_only',
      displayName: 'Searchable Only',
      icon: '🔍',
      abilities: { search: true, browse: false },
    });
    expect(picker).toBeDefined();
    expect(picker?.icon).toBe('🔍');
  });

  it('returns a picker when only search is disabled (browse still on)', () => {
    const picker = referenceableOptionsToPicker({
      type: 'browseable_only',
      displayName: 'Browseable Only',
      icon: '📂',
      abilities: { search: false, browse: true },
    });
    expect(picker).toBeDefined();
  });

  it('defaults search/browse to enabled when abilities is omitted', () => {
    const picker = referenceableOptionsToPicker({
      type: 'default',
      displayName: 'Default',
      icon: '⚪',
    });
    expect(picker).toBeDefined();
  });
});

describe('pickerToReferenceableOptions', () => {
  it('rebuilds the options shape from picker + type + displayName', () => {
    const opts = pickerToReferenceableOptions({
      type: 'recipe',
      displayName: '食谱',
      picker: {
        icon: '🍳',
        color: 'orange',
        searchFields: ['name', 'tags'],
        titleField: 'name',
      },
    });
    expect(opts).toEqual({
      type: 'recipe',
      displayName: '食谱',
      icon: '🍳',
      color: 'orange',
      abilities: { search: true, browse: true },
    });
  });

  it('omits color when the picker has no color set', () => {
    const opts = pickerToReferenceableOptions({
      type: 'plain',
      displayName: 'Plain',
      picker: {
        icon: '⚪',
        searchFields: [],
        titleField: 'displayName',
      },
    });
    expect(opts.color).toBeUndefined();
    expect('color' in opts).toBe(false);
  });
});

describe('round-trip (forward → reverse)', () => {
  function roundTrip(opts: ReferenceableOptions): ReferenceableOptions | null {
    const picker = referenceableOptionsToPicker(opts);
    if (!picker) return null;
    return pickerToReferenceableOptions({
      type: opts.type,
      displayName: opts.displayName,
      picker,
    });
  }

  it('preserves the picker-relevant fields exactly for default-abilities input', () => {
    const original: ReferenceableOptions = {
      type: 'recipe',
      displayName: '食谱',
      icon: '🍳',
      color: 'orange',
      abilities: { search: true, browse: true },
    };
    expect(roundTrip(original)).toEqual({
      type: 'recipe',
      displayName: '食谱',
      icon: '🍳',
      color: 'orange',
      abilities: { search: true, browse: true },
    });
  });

  it('preserves the picker-relevant fields for color-less input', () => {
    const original: ReferenceableOptions = {
      type: 'plain',
      displayName: 'Plain',
      icon: '⚪',
      abilities: { search: true, browse: true },
    };
    expect(roundTrip(original)).toEqual({
      type: 'plain',
      displayName: 'Plain',
      icon: '⚪',
      abilities: { search: true, browse: true },
    });
  });

  it('preserves picker-relevant fields for a Chinese-displayName input', () => {
    const original: ReferenceableOptions = {
      type: 'recipe_section',
      displayName: '章节',
      icon: '📑',
      color: 'amber',
      abilities: { search: true, browse: true },
    };
    expect(roundTrip(original)).toEqual({
      type: 'recipe_section',
      displayName: '章节',
      icon: '📑',
      color: 'amber',
      abilities: { search: true, browse: true },
    });
  });

  it('drops non-picker-modeled fields (contextFields, hideRelations, recommender) on round-trip', () => {
    // Documents the lossiness: these fields are NOT modeled by PickerConfig
    // and the converter explicitly does not invent them on the reverse path.
    // If a Solution wants to preserve them, it must hold them out-of-band.
    const original: ReferenceableOptions = {
      type: 'recipe',
      displayName: '食谱',
      icon: '🍳',
      color: 'orange',
      abilities: { search: true, browse: true },
      contextFields: ['ingredients', 'steps'],
      hideRelations: ['private_notes'],
      relationLabels: { recipe_section: '章节' },
    };
    const back = roundTrip(original);
    expect(back).not.toBeNull();
    expect(back?.contextFields).toBeUndefined();
    expect(back?.hideRelations).toBeUndefined();
    expect(back?.relationLabels).toBeUndefined();
  });

  it('round-trip returns null when source is not picker-able', () => {
    const original: ReferenceableOptions = {
      type: 'opaque',
      displayName: 'Opaque',
      icon: '⬛',
      abilities: { search: false, browse: false },
    };
    expect(roundTrip(original)).toBeNull();
  });
});

describe('round-trip (reverse → forward)', () => {
  it('preserves picker icon + color through reverse-then-forward', () => {
    const originalPicker: PickerConfig = {
      icon: '🍳',
      color: 'orange',
      searchFields: ['name', 'tags'],
      titleField: 'name',
    };
    const opts = pickerToReferenceableOptions({
      type: 'recipe',
      displayName: '食谱',
      picker: originalPicker,
    });
    const back = referenceableOptionsToPicker(opts);
    expect(back?.icon).toBe('🍳');
    expect(back?.color).toBe('orange');
  });

  it('reverse-then-forward drops picker-only fields (searchFields, titleField)', () => {
    // PickerConfig's structural fields (searchFields, titleField,
    // subtitleField) don't survive to ReferenceableOptions and back;
    // forward conversion uses placeholders. Documenting the lossiness.
    const originalPicker: PickerConfig = {
      icon: '⚪',
      searchFields: ['name', 'description'],
      titleField: 'name',
      subtitleField: 'category',
    };
    const opts = pickerToReferenceableOptions({
      type: 'x',
      displayName: 'X',
      picker: originalPicker,
    });
    const back = referenceableOptionsToPicker(opts);
    expect(back?.searchFields).toEqual([]);
    expect(back?.titleField).toBe('displayName');
    expect(back?.subtitleField).toBeUndefined();
  });
});
