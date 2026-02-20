import type { OutputUpdateEvent } from '@kedge-agentic/common'
import type { SyncField, OutputUpdate } from '../types'

/**
 * Data structure returned by the write_output MCP tool.
 * This is placed in OutputUpdateEvent.payload.data by the backend EventMapper.
 */
export interface WriteOutputData {
  field: string
  value: unknown
  preview?: string
}

/**
 * Parse an output_update event from the backend, extracting sync data.
 *
 * The backend sends output_update events in two possible formats:
 * 1. payload.data.field (from write_output MCP tool via EventMapper)
 * 2. payload.field (generic format)
 *
 * This function normalizes both formats into a consistent OutputUpdate structure.
 *
 * @param event - The raw OutputUpdateEvent from the backend
 * @returns Parsed OutputUpdate or null if the event is invalid/missing field
 */
export function parseOutputUpdateEvent(event: OutputUpdateEvent): OutputUpdate | null {
  const { payload } = event

  // Try to extract from payload.data (write_output MCP tool format)
  const dataField = payload.data as WriteOutputData | undefined
  if (dataField?.field) {
    return {
      field: dataField.field as SyncField,
      value: dataField.value,
      preview: dataField.preview || `更新 ${dataField.field}`,
      synced: false,
    }
  }

  // Try to extract from payload directly (generic format)
  if (payload.field) {
    return {
      field: payload.field as SyncField,
      value: payload.value,
      preview: `更新 ${payload.field}`,
      synced: false,
    }
  }

  // Neither format found, return null
  return null
}
