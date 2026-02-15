# write\_output Best Practices

## Overview

`write_output` is the most essential MCP tool in LoopAI, used to synchronize AI Agent-generated structured data to frontend forms in real time. Mastering its proper usage is critical to building high-quality Solutions.

## Core Mechanism

```
AI Agent ──calls──→ write_output ──triggers──→ output_update event ──pushes──→ Frontend Form
```

After the AI Agent calls the write\_output tool, the CCAAS backend wraps the data into an `output_update` event and pushes it to the frontend via WebSocket.

## Data Format

### Instructions in the Skill

Explicitly specify the write\_output output format in your SKILL.md:

```markdown
# Output Format

Use the write_output tool to output data, updating one field per call:

- field: "title" → Topic name (string)
- field: "objectives" → Learning objectives (array)
- field: "activities" → Teaching activities (array of objects)
- field: "assessment" → Assessment method (object)
```

### MCP Server Implementation

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js'

const VALID_FIELDS = [
  'title', 'objectives', 'activities',
  'assessment', 'materials'
] as const

const server = new Server(
  { name: 'my-solution-tools', version: '1.0.0' },
  { capabilities: { tools: {} } }
)

// Define the write_output tool
const writeOutputTool: Tool = {
  name: 'write_output',
  description: `Write structured data to the frontend form.
Valid fields: ${VALID_FIELDS.join(', ')}`,
  inputSchema: {
    type: 'object',
    properties: {
      field: {
        type: 'string',
        enum: [...VALID_FIELDS],
        description: 'The form field to update',
      },
      value: {
        description: 'The value for the field',
      },
      preview: {
        type: 'string',
        description: 'Human-readable summary shown on the sync button',
      },
    },
    required: ['field', 'value'],
  },
}

// Register tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: [writeOutputTool] }
})

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params

  if (name === 'write_output') {
    const { field, value, preview } = args as {
      field: string; value: unknown; preview?: string
    }

    // Validate field name
    if (!VALID_FIELDS.includes(field as any)) {
      return {
        content: [{ type: 'text', text: JSON.stringify({
          data: { error: `Invalid field: ${field}` },
          status: 'error',
        })}],
        isError: true,
      }
    }

    // Return success -- CCAAS wraps this into an output_update event
    return {
      content: [{ type: 'text', text: JSON.stringify({
        data: { field, value, preview },
        status: 'success',
      })}],
    }
  }

  return {
    content: [{ type: 'text', text: JSON.stringify({
      data: { error: `Unknown tool: ${name}` },
      status: 'error',
    })}],
    isError: true,
  }
})

// Start the server
const transport = new StdioServerTransport()
await server.connect(transport)
```

### Output Validation with Zod

It is recommended to use Zod schemas to validate write\_output data and ensure correct data structures:

```typescript
import { z } from 'zod'

// Define per-field schemas
const fieldSchemas: Record<string, z.ZodType> = {
  title: z.string().min(1),
  objectives: z.array(z.object({
    description: z.string(),
    bloomLevel: z.enum([
      'remember', 'understand', 'apply',
      'analyze', 'evaluate', 'create'
    ])
  })),
  activities: z.array(z.object({
    title: z.string(),
    duration: z.number().min(1),
    type: z.string(),
    description: z.string()
  }))
}

function validateField(field: string, value: unknown) {
  const schema = fieldSchemas[field]
  if (!schema) return { success: true, data: value, errors: [] }

  const result = schema.safeParse(value)
  if (result.success) {
    return { success: true, data: result.data, errors: [] }
  }
  return {
    success: false,
    errors: result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`),
  }
}

// Use inside the CallToolRequestSchema handler:
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params

  if (name === 'write_output') {
    const { field, value, preview } = args as {
      field: string; value: unknown; preview?: string
    }

    // Validate the value against its field schema
    const validation = validateField(field, value)
    if (!validation.success) {
      return {
        content: [{ type: 'text', text: JSON.stringify({
          data: { error: `Validation failed: ${validation.errors.join('; ')}` },
          status: 'error',
        })}],
        isError: true,
      }
    }

    return {
      content: [{ type: 'text', text: JSON.stringify({
        data: { field, value: validation.data, preview },
        status: 'success',
      })}],
    }
  }

  // ... handle other tools
})
```

## Frontend Handling

### output\_update Event Structure

```typescript
// output_update events use a nested structure
interface OutputUpdateEvent {
  type: 'output_update'
  sessionId: string
  payload: {
    data: {
      field: string
      value: any
      operation: 'set' | 'append' | 'merge'
    }
    progressive?: boolean
    complete?: boolean
    status?: string
    progress?: number
  }
}
```

{% hint style="danger" %}
**Common mistake**: Accessing `event.field` directly instead of `event.payload.data.field`. output\_update uses a nested structure -- make sure to parse it correctly.
{% endhint %}

### Correct Handling Example

```typescript
socket.on('output_update', (event) => {
  // Correct: use the nested path
  const { field, value, operation } = event.payload.data

  switch (operation) {
    case 'set':
      formState[field] = value
      break
    case 'append':
      if (Array.isArray(formState[field])) {
        formState[field].push(value)
      } else {
        formState[field] += value
      }
      break
    case 'merge':
      formState[field] = { ...formState[field], ...value }
      break
  }
})
```

### Using a Parser

It is recommended to use the `parseOutputUpdateEvent` parser for unified handling:

```typescript
import { parseOutputUpdateEvent } from '../utils/outputUpdateParser'

socket.on('output_update', (raw) => {
  const parsed = parseOutputUpdateEvent(raw)
  if (parsed) {
    updateField(parsed.field, parsed.value, parsed.operation)
  }
})
```

## Operation Types in Detail

### set -- Overwrite

The most commonly used operation, which directly overwrites the field value:

```json
{ "field": "title", "value": "New Title", "operation": "set" }
```

### append -- Append

Appends an element to an array field, or appends content to a string:

```json
{ "field": "objectives", "value": {"description": "New objective"}, "operation": "append" }
```

### merge -- Merge

Merges into an object field:

```json
{ "field": "assessment", "value": {"rubric": "New rubric"}, "operation": "merge" }
```

## Troubleshooting

### write\_output Not Showing Up

1. Confirm that the MCP Server is correctly registered with CCAAS
2. Confirm that the Skill's `allowedTools` includes `write_output`
3. Check whether the frontend is correctly listening for `output_update` events
4. Verify that the nested structure is being parsed correctly

### Data Format Mismatch

1. Add Zod validation in the MCP Server
2. Ensure the format specified in the Skill instructions matches the frontend type definitions
3. Use `parseOutputUpdateEvent` for unified parsing

### Field Updates Not Taking Effect

1. Confirm that the `field` value exactly matches the frontend form field name
2. Check that the `operation` type is correct
3. Verify the state update logic for the corresponding frontend field
