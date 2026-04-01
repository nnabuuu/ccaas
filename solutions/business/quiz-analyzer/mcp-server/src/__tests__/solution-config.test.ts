/**
 * solution.json ↔ SYNC_FIELDS consistency test
 *
 * Prevents field-name typos in toolEventTriggers that silently break
 * the solution.json → EventMapper → SSE → frontend pipeline.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { SYNC_FIELDS } from '../common/types.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const solutionJson = JSON.parse(
  readFileSync(resolve(__dirname, '../../../solution.json'), 'utf-8'),
)

describe('solution.json field name consistency', () => {
  const mcpConfig = solutionJson.mcpServers['quiz-analyzer-tools']

  it('toolEventTriggers fields are all valid SYNC_FIELDS', () => {
    const syncFields = new Set<string>(SYNC_FIELDS)
    for (const trigger of mcpConfig.toolEventTriggers) {
      if (trigger.field) {
        expect(syncFields.has(trigger.field)).toBe(true)
      }
    }
  })
})
