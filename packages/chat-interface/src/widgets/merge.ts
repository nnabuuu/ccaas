import type { WidgetRegistry } from '@/types/widget'
import type { WidgetCatalogEntry } from './catalog'
import { builtinRegistry } from './registry'
import { builtinCatalog } from './catalog'

/**
 * Merge builtin + custom widget registries.
 * Custom entries override builtin entries with the same key.
 */
export function mergeRegistries(custom?: WidgetRegistry): WidgetRegistry {
  if (!custom || Object.keys(custom).length === 0) return builtinRegistry
  return { ...builtinRegistry, ...custom }
}

/**
 * Merge builtin + custom widget catalogs.
 * Custom entries with the same `type` override builtin entries.
 */
export function mergeCatalogs(custom?: WidgetCatalogEntry[]): WidgetCatalogEntry[] {
  if (!custom || custom.length === 0) return builtinCatalog
  const merged = new Map<string, WidgetCatalogEntry>()
  for (const entry of builtinCatalog) {
    merged.set(entry.type, entry)
  }
  for (const entry of custom) {
    merged.set(entry.type, entry)
  }
  return Array.from(merged.values())
}
