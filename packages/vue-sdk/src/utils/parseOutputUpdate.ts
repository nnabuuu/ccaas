import type { OutputUpdateEvent } from '@ccaas/shared'
import type { OutputUpdate } from '../types'

/**
 * Data structure returned by the write_output MCP tool.
 * Placed in OutputUpdateEvent.payload.data by the backend EventMapper.
 */
export interface WriteOutputData {
  field: string
  value: unknown
  preview?: string
}

/**
 * Parse an output_update event from the backend, extracting sync data.
 *
 * The backend sends output_update events in multiple possible formats:
 * 1. payload.data.field (from write_output MCP tool via EventMapper)
 * 2. payload.field (generic format)
 * 3. payload.data as content blocks array [{ type: "text", text: "{JSON}" }]
 *
 * This function normalizes all formats into a consistent OutputUpdate structure.
 */
export function parseOutputUpdate(event: OutputUpdateEvent): OutputUpdate | null {
  const { payload } = event

  // Format 1: payload.data.field (write_output MCP tool format)
  const dataField = payload.data as WriteOutputData | undefined
  if (dataField && typeof dataField === 'object' && !Array.isArray(dataField) && dataField.field) {
    return {
      field: dataField.field,
      value: dataField.value,
      preview: dataField.preview || `Update ${dataField.field}`,
      synced: false,
    }
  }

  // Format 2: payload.data as content blocks array [{ type: "text", text: "{JSON}" }]
  if (Array.isArray(payload.data)) {
    for (const block of payload.data as Array<{ type?: string; text?: string }>) {
      if (block.type === 'text' && typeof block.text === 'string') {
        try {
          const obj = JSON.parse(block.text)
          // May be wrapped: { status, data: { field, value, preview } }
          const source = obj.data?.field ? obj.data : obj.field ? obj : null
          if (source?.field) {
            return {
              field: source.field,
              value: source.value,
              preview: source.preview || `Update ${source.field}`,
              synced: false,
            }
          }
        } catch {
          // not JSON, skip
        }
      }
    }
  }

  // Format 3: payload.field (generic format)
  if (payload.field) {
    return {
      field: payload.field as string,
      value: payload.value,
      preview: `Update ${payload.field}`,
      synced: false,
    }
  }

  return null
}
