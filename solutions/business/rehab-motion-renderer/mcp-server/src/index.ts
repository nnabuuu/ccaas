#!/usr/bin/env node
/**
 * Rehab Motion Renderer MCP Server
 *
 * Tools:
 * 1. write_output - Send structured rehab plan data to the frontend (standard CCAAS tool)
 * 2. get_exercise_library - Return exercise metadata for AI to select from (no keyframes)
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// ═══════════════════════════════════════════
// VALID FIELDS (SyncFields whitelist)
// ═══════════════════════════════════════════

const VALID_FIELDS = [
  'title',
  'subtitle',
  'medicalSummary',
  'contraindications',
  'principlesDo',
  'principlesAvoid',
  'frequency',
  'exercises',
  'progressionPlan',
  'medicalReminder',
] as const

type ValidField = (typeof VALID_FIELDS)[number]

// ═══════════════════════════════════════════
// ZOD SCHEMAS (field validation)
// ═══════════════════════════════════════════

const ExerciseSpecSchema = z.object({
  type: z.string().min(1),
  sets: z.number().int().positive(),
  reps: z.number().int().positive(),
  restSec: z.number().nonnegative(),
  tempo: z.string(),
  howTo: z.array(z.string()),
  safety: z.array(z.string()),
})

const fieldSchemas: Record<ValidField, z.ZodType> = {
  title: z.string().min(1).max(50),
  subtitle: z.string().min(1).max(100),
  medicalSummary: z.string().min(1),
  contraindications: z.string().min(1),
  principlesDo: z.string().min(1),
  principlesAvoid: z.string().min(1),
  frequency: z.string().min(1),
  exercises: z.string().refine(
    (val) => {
      try {
        const parsed = JSON.parse(val)
        if (!Array.isArray(parsed) || parsed.length === 0) return false
        return parsed.every((item) => ExerciseSpecSchema.safeParse(item).success)
      } catch {
        return false
      }
    },
    { message: 'exercises must be a JSON string of valid ExerciseSpec[]' }
  ),
  progressionPlan: z.string().min(1),
  medicalReminder: z.string().min(1),
}

// ═══════════════════════════════════════════
// EXERCISE LIBRARY (loaded once)
// ═══════════════════════════════════════════

// Load exercise library metadata (strip keyframes for AI consumption)
function loadExerciseLibraryMeta() {
  try {
    // Try to load from frontend data directory
    const libPath = join(__dirname, '../../frontend/src/data/exercise-library.json')
    const raw = readFileSync(libPath, 'utf-8')
    const library = JSON.parse(raw) as Record<string, unknown>

    // Return metadata only (no keyframes)
    return Object.entries(library).map(([id, entry]) => {
      const e = entry as Record<string, unknown>
      return {
        id,
        name: e.name,
        nameZh: e.nameZh,
        muscles: e.muscles,
        figure: e.figure,
        phases: e.phases,
        // intentionally omit: keyframes, visualHints (not needed by AI)
      }
    })
  } catch (err) {
    // Fallback: hardcoded exercise list
    process.stderr.write(`[rehab-tools] Warning: exercise-library.json not found, using fallback\n`)
    return [
      {
        id: 'pelvic-tilt',
        nameZh: '骨盆前倾',
        name: 'Pelvic Tilt',
        muscles: '腹横肌 · 骨盆底肌 · 臀肌',
        figure: 'lying',
        phases: ['仰卧放松', '收紧腹部', '骨盆后倾', 'HOLD 保持', '缓慢放松'],
        difficulty: 1,
        indications: ['腰椎管狭窄', '腰椎间盘突出', '核心训练入门'],
        contraindications: [],
      },
      {
        id: 'dead-bug',
        nameZh: '死虫式',
        name: 'Dead Bug',
        muscles: '腹横肌 · 腹直肌 · 髂屈肌',
        figure: 'lying',
        phases: ['起始位', '右腿伸出+左臂', '回收', '左腿伸出+右臂', '回收'],
        difficulty: 2,
        indications: ['核心稳定通用', '腰椎保护'],
        contraindications: ['急性腰痛期'],
      },
      {
        id: 'cat-cow',
        nameZh: '猫牛式',
        name: 'Cat Stretch',
        muscles: '竖脊肌 · 腹肌 · 多裂肌',
        figure: 'cat',
        phases: ['四点跪姿', '弓背(猫式)↑', '回正', '轻微塌腰↓', '回正'],
        difficulty: 1,
        indications: ['脊柱灵活度', '椎管狭窄（屈曲方向）'],
        contraindications: ['严重椎间盘突出急性期'],
      },
      {
        id: 'seated-boxing',
        nameZh: '坐姿拳击',
        name: 'Seated Boxing',
        muscles: '三角肌 · 肱三头肌 · 核心',
        figure: 'seated',
        phases: ['防守姿势', '左直拳 Jab', '右直拳 Cross', '左勾拳 Hook', '右上勾 Upper'],
        difficulty: 2,
        indications: ['低冲击有氧', '心肺训练', '腰椎安全'],
        contraindications: ['肩关节问题'],
      },
    ]
  }
}

// ═══════════════════════════════════════════
// MCP SERVER FACTORY
// ═══════════════════════════════════════════

export function createServer(): Server {
  const server = new Server(
    { name: 'rehab-tools', version: '1.0.0' },
    { capabilities: { tools: {} } }
  )

  // List tools
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'write_output',
        description: `Write a single field to the rehab training plan form.
Call this once per field. Valid fields: ${VALID_FIELDS.join(', ')}.

The exercises field must be JSON.stringify(ExerciseSpec[]) where each ExerciseSpec is:
{
  "type": "pelvic-tilt" | "dead-bug" | "cat-cow" | "seated-boxing",
  "sets": number,
  "reps": number,
  "restSec": number,
  "tempo": string,
  "howTo": string[],
  "safety": string[]
}

Call get_exercise_library first to see available exercise types.`,
        inputSchema: {
          type: 'object',
          properties: {
            field: {
              type: 'string',
              enum: VALID_FIELDS,
              description: 'The field name to update',
            },
            value: {
              type: 'string',
              description: 'The value for the field (string; exercises field is JSON.stringify)',
            },
            preview: {
              type: 'string',
              description: 'Short preview text shown in the sync button (1-2 sentences)',
            },
          },
          required: ['field', 'value', 'preview'],
        },
      },
      {
        name: 'get_exercise_library',
        description: `Get the list of available exercises with their metadata.
Returns exercise IDs, Chinese/English names, target muscles, and figure type.
Use this before generating the exercises field to know what types are available.
Does NOT return keyframes (those are handled by the frontend renderer).`,
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
    ],
  }))

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params

    if (name === 'get_exercise_library') {
      const library = loadExerciseLibraryMeta()
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(library, null, 2),
          },
        ],
      }
    }

    if (name === 'write_output') {
      const { field, value, preview } = args as { field: string; value: string; preview: string }

      // Validate field name
      if (!VALID_FIELDS.includes(field as ValidField)) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: `Invalid field: "${field}". Valid fields: ${VALID_FIELDS.join(', ')}`,
              }),
            },
          ],
          isError: true,
        }
      }

      // Validate field value
      const schema = fieldSchemas[field as ValidField]
      const result = schema.safeParse(value)
      if (!result.success) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: `Validation failed for field "${field}": ${result.error.message}`,
              }),
            },
          ],
          isError: true,
        }
      }

      process.stderr.write(`[rehab-tools] write_output: field=${field}, preview=${preview}\n`)

      // CCAAS EventMapper reads content[].text JSON to build the output_update event.
      // It uses: parsedResult.data || parsedResult → payload.data
      // Frontend useOutputSync reads: payload.data.{ field, value, preview }
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              field,
              value,
              preview: preview || `已更新 ${field}`,
            }),
          },
        ],
      }
    }

    return {
      content: [{ type: 'text', text: `Unknown tool: ${name}` }],
      isError: true,
    }
  })

  return server
}

// Start server (only when run directly, not when imported by tests)
async function main() {
  const server = createServer()
  const transport = new StdioServerTransport()
  await server.connect(transport)
  process.stderr.write('[rehab-tools] MCP server started\n')
}

if (process.argv[1] === __filename) {
  main().catch((err) => {
    process.stderr.write(`[rehab-tools] Fatal error: ${err}\n`)
    process.exit(1)
  })
}
